# Publicación del sitio y digest

## Cambio del 14 de noviembre de 2026

El checkout original estaba limpio en `3e2f6ed`, pero remoto main estaba en `6748d5f` (digest del 14). El cambio se preparó desde ese remoto en una rama/worktree aislados; no se hizo pull, reset, stash ni sobrescritura del checkout original.

### Evidencia y límites de causalidad

- [Fallo del 14](https://github.com/calepes/calepes.github.io/actions/runs/43583240237): upload finalizado a las 10:01:16.732 UTC, ID `14109063020`; el desplegador inició la consulta a las 10:01:17.064 y obtuvo cero resultados. Abortó antes de crear deployment. Una consulta posterior del artifact por REST devuelve el ID y commit esperados. No demuestra que la causa fuera visibilidad transitoria en el servicio interno.
- [Run fallido del 12, intento 2](https://github.com/calepes/calepes.github.io/actions/runs/43196584920/attempts/2): repetir la subida con el mismo nombre produjo duplicidad. [Run nuevo de recuperación](https://github.com/calepes/calepes.github.io/actions/runs/43205058702): un artifact, deployment exitoso. No usar rerun del workflow antiguo como recuperación.
- Referencia oficial examinada: [deploy-pages api-client.js](https://github.com/actions/deploy-pages/blob/d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/src/internal/api-client.js), `getArtifactMetadata`: `new DefaultArtifactClient().listArtifacts()` sin opciones; filtra por nombre y exige exactamente uno. Usa Twirp `ArtifactService/ListArtifacts` del run actual, no el listado REST de artifacts. `deployment.js` crea el deployment una sola vez y después consulta su estado.

## Contrato de publicación

1. **Generado:** job `package` usa el commit del evento, prueba los controles y genera `.well-known/pages-build.json`. Contiene commit, run, intento de empaquetado y SHA256 de `index.html` y el último `digest/YYYY-MM-DD.html`. No regenera ni cambia el HTML del digest.
2. **Subido:** `upload-pages-artifact@v3` devuelve el ID; nombre `pages-<run_id>-<package_attempt>`. Un intento nuevo de empaquetado produce otro nombre; nunca overwrite/delete. ID/nombre/intento pasan como outputs al job `deploy`.
3. **Visible e identificado:** acción local Node (recibe el contexto runtime de Actions) consulta `@actions/artifact@2.1.3`, la misma versión y llamada sin opciones que la acción desplegadora fijada. No usa `findBy`, `getArtifact` ni `latest:true` que podrían cambiar ámbito u ocultar duplicados. Seis observaciones; solo cero coincidencias espera 2,4,8,16,30 segundos (60 s total de espera programada). Errores de consulta, duplicados, ID distinto o paquete vacío fallan sin elegir/borrar. El límite no elimina los tiempos internos de red del cliente oficial.
4. **Procedencia:** lectura pública REST del ID concreto comprueba ID/nombre/run/commit/expiración/tamaño. Es una comprobación adicional, no sustituye al servicio interno. El repositorio es público; no se envían tokens a estas consultas, no se añade `actions:read`. Permiso denegado/rate limit/errores de metadata detienen el flujo, sin fallback ni ampliar permisos.
5. **Conciliación:** inspecciona runs del mismo commit y todos sus intentos anteriores, incluidos runs distintos. Si un paso de despliegue comenzó y no terminó en éxito o skipped, bloquea cualquier nueva creación; hay que revisar Pages/logs y conservar la incertidumbre. Si terminó en éxito, solo verifica de nuevo el sitio. Un paso omitido o no ejecutado permite avanzar. Más de 100 runs/jobs se trata como historial incompleto y bloquea; no se elige arbitrariamente. Las lecturas de historial no se reintentan automáticamente.
6. **Desplegado:** `actions/deploy-pages` fijada al SHA examinado consulta nuevamente el nombre único, crea una vez y espera `succeed`. No se envuelve la creación con reintentos. La visibilidad aún puede cambiar después del gate; la acción debe fallar de forma segura, sin publicación automática repetida.
7. **Verificado:** HTTPS 200 de marker, índice y último digest; commit/run y hashes exactos. Sin cambios DNS. Reintentos de solo lectura limitados con las mismas esperas progresivas; 401/403 fallan inmediatamente. 404, marker viejo o HTML distinto no acreditan publicación. Verificación de una publicación previa puede conservar su intento de empaquetado, pero debe coincidir commit, run publicado y hashes. No se comprueban todos los assets del sitio.

Las dependencias están bloqueadas. El cliente conserva su implementación 2.1.3; sus transportes REST transitivos se actualizan mediante overrides a versiones corregidas (@actions/github 6.0.1, @octokit/core 6.1.6, @actions/http-client 3.0.2 y undici 6.29.1). El gate solo usa su listado interno. Cambiar la acción o el cliente exige revisar otra vez esta equivalencia.

## Reintento y conciliación

- Si `package` terminó y falla `deploy` antes de iniciar la acción de publicación, usar **Re-run failed jobs**: conserva outputs/ID/nombre del paquete; el job deploy no contiene upload. No usar **Re-run all jobs** para recuperar visibilidad.
- Si el deployment se completó pero falla la verificación pública, repetir solo el job fallido verifica el sitio sin crear otro deployment.
- Si el paso de deployment empezó y falló/se canceló o no tiene resultado, no reintentar creación. Revisar el run y el estado de Pages, artifact ID, commit y recibos antes de una recuperación autorizada. Ni 404 de la página ni ausencia de un recibo prueban ausencia de efecto.
- Un nuevo empaquetado usa su propio nombre por intento. Un fallo ambiguo previo del mismo commit sigue bloqueando una creación, incluso desde un run nuevo; no se sortea el control cambiando el nombre.
- El límite de retención sigue siendo el predeterminado de un día; un artifact expirado exige nuevo empaquetado, previa conciliación. No se recuperan artifacts eliminados ni se borra ninguno desde este flujo.

## Pruebas y revisión

Ejecutar `npm ci --prefix .github/pages --ignore-scripts` y `npm test --prefix .github/pages`. Casos simulados: inmediato; cero y luego uno; ausencia permanente; duplicados; ID/commit/run/nombre/expiración incorrectos; errores de permisos; nombre por nuevo intento; reintento solo deploy; fallo incierto previo; éxito previo sin segunda creación; página 404, marker obsoleto, HTML distinto y permisos públicos. El historial y el CDN se simulan; no confundirlos con una publicación real.

Validación local: 28/28 casos PASS; actionlint PASS; invariantes de permisos y ausencia de upload en deploy PASS; cliente 2.1.3 cargado e implementación interna contrastada. La revisión independiente encontró un caso de historial incompleto; dos regresiones reprodujeron el fallo y pasaron tras corregirlo. Auditoría npm sin vulnerabilidades reportadas en el lock final. El resultado del run de activación y la verificación real se informa por separado. Preserva estado generado/subido/desplegado/verificado: un push o upload no acredita los últimos dos.

## Reversión

Revertir el commit de esta corrección mediante un commit normal y revisar el diff antes del push; no reset/force-push y no revertir commits de contenido posteriores. El workflow anterior vuelve a tener el fallo de búsqueda única y a subir/desplegar en el mismo job. No rerun de runs antiguos que ya subieron; después de conciliar cualquier efecto incierto, lanzar un run nuevo. No borrar artifacts, alterar permisos, DNS, secretos ni controles del environment `github-pages`.

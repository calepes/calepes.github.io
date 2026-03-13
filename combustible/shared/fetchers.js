/**
 * Fetch y parsing de datos de estaciones de combustible
 * Portado de widget/cards-widget.js para uso en PWAs (fetch API)
 */

import { GASGROUP_MIN_LITROS } from './stations.js';

/* ── Proxy ────────────────────────────── */

export const PROXY_URL = 'https://combustible-proxy.carlos-cb4.workers.dev';

/**
 * Fetch a traves del proxy CORS (Cloudflare Worker)
 * @param {string} url — URL destino
 * @returns {Promise<Response>}
 */
export async function proxyFetch(url) {
  return fetch(`${PROXY_URL}/?url=${encodeURIComponent(url)}`);
}

/* ── Helpers ──────────────────────────── */

/**
 * Extrae solo digitos y retorna numero entero.
 * Maneja formatos como "1.234", "1,234", "1234".
 */
export function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/* ── Parsers ──────────────────────────── */

/**
 * Parsea HTML de Genex para extraer litros disponibles.
 * Busca patron: KEY ... FUEL ... N litros
 */
export function parseGenex(html, key, fuel) {
  if (!html) return 0;
  const clean = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');

  const escapedFuel = fuel
    .replace(/\./g, '\\.')
    .replace(/\+/g, '\\+');

  const re = new RegExp(
    `${key}[\\s\\S]*?${escapedFuel}[\\s\\S]*?(\\d{1,3}(?:[\\.,]\\d{3})*|\\d+)\\s*litros`,
    'i'
  );
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

/**
 * Parsea HTML de Biopetrol EC2 para extraer litros disponibles.
 * Busca patron: KEY ... Volumen disponible ... N Lts
 */
export function parseEC2(html, key) {
  if (!html) return 0;
  const clean = html.replace(/\s+/g, ' ');
  const re = new RegExp(
    `${key}[\\s\\S]*?Volumen disponible[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*Lts`,
    'i'
  );
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

/**
 * Parsea JSON de Gasgroup API. Suma volumen de tanques que contienen el producto.
 * Retorna 0 si el total esta por debajo del umbral minimo (lecturas poco confiables).
 */
export function parseGasGroup(json, product) {
  if (!json?.data?.tanques) return 0;
  let total = 0;
  for (const t of json.data.tanques) {
    if (t.producto?.toUpperCase().includes(product)) {
      total += t.volumen || 0;
    }
  }
  const rounded = Math.round(total);
  return rounded >= GASGROUP_MIN_LITROS ? rounded : 0;
}

/**
 * Parsea HTML de Google Sheets chartiframe para extraer litros.
 * Busca chartJson embebido, lo deserializa, y busca la fila del producto.
 */
export function parseChartJson(html, product) {
  if (!html) return 0;
  const upper = product.toUpperCase();
  const m = html.match(/'chartJson'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (!m) return 0;
  try {
    const unescaped = m[1].replace(/\\(x([0-9a-fA-F]{2})|.)/g, (match, esc, hex) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (esc === '\\') return '\\';
      if (esc === "'") return "'";
      if (esc === 'n') return '\n';
      return esc;
    });
    const chart = JSON.parse(unescaped);
    const rows = chart?.dataTable?.rows;
    if (rows) {
      for (const row of rows) {
        const cells = row.c || [];
        const hasProduct = cells.some(
          (c) =>
            typeof c?.v === 'string' &&
            c.v.toUpperCase().includes(upper)
        );
        if (!hasProduct) continue;
        for (const c of cells) {
          if (typeof c?.v === 'number' && c.v > 0)
            return Math.round(c.v);
        }
      }
    }
  } catch (_) {}
  return 0;
}

/* ── Distancias ───────────────────────── */

/**
 * Distancia en linea recta (Haversine) en km.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distancia real por ruta (driving) via OSRM, a traves del proxy.
 * Retorna array de distancias en km desde el origen a cada estacion, o null si falla.
 * @param {number} originLat
 * @param {number} originLon
 * @param {{lat: number, lon: number}[]} stations
 * @returns {Promise<number[]|null>}
 */
export async function osrmDistances(originLat, originLon, stations) {
  try {
    // Formato OSRM: lon,lat (invertido)
    const coords = [`${originLon},${originLat}`];
    for (const s of stations) {
      coords.push(`${s.lon},${s.lat}`);
    }
    const url = `https://router.project-osrm.org/table/v1/driving/${coords.join(';')}?sources=0&annotations=distance`;
    const resp = await proxyFetch(url);
    const json = await resp.json();
    if (json && json.code === 'Ok' && json.distances && json.distances[0]) {
      // distances[0] = distancias desde origen a cada destino (en metros)
      // El primer valor es origen->origen (0), los demas son las estaciones
      return json.distances[0].slice(1).map((m) => m / 1000);
    }
    console.log('OSRM respuesta inesperada:', JSON.stringify(json).substring(0, 200));
    return null;
  } catch (e) {
    console.log('OSRM ERROR:', e.message);
    return null;
  }
}

/* ── Fetch de estaciones ──────────────── */

/**
 * Cache de respuestas para evitar fetches duplicados (misma URL).
 */
const fetchCache = {};

async function cachedFetch(url, isJson) {
  const cacheKey = `${isJson ? 'json' : 'html'}:${url}`;
  if (!fetchCache[cacheKey]) {
    fetchCache[cacheKey] = proxyFetch(url).then((resp) =>
      isJson ? resp.json() : resp.text()
    );
  }
  return fetchCache[cacheKey];
}

/**
 * Obtiene litros de una estacion segun su tipo.
 */
async function fetchStation(s) {
  if (s.type === 'genex') {
    const html = await cachedFetch(s.url, false);
    return parseGenex(html, s.key, s.fuel);
  }
  if (s.type === 'ec2') {
    const html = await cachedFetch(s.url, false);
    return parseEC2(html, s.key);
  }
  if (s.type === 'gasgroup') {
    const json = await cachedFetch(s.url, true);
    return parseGasGroup(json, s.product);
  }
  if (s.type === 'gsheets') {
    const html = await cachedFetch(s.url, false);
    return parseChartJson(html, s.product);
  }
  return 0;
}

/**
 * Obtiene datos de todas las estaciones en paralelo.
 * @param {Array} stations — array de objetos estacion (de stations.js)
 * @returns {Promise<Array<{name, company, lat, lon, litros}>>}
 */
export async function fetchAllStations(stations) {
  return Promise.all(
    stations.map(async (s) => {
      const litros = await fetchStation(s);
      return {
        name: s.name,
        company: s.company,
        lat: s.lat,
        lon: s.lon,
        litros,
      };
    })
  );
}

/**
 * Obtiene distancias OSRM para cada resultado. Fallback a Haversine si OSRM falla.
 * Retorna nuevo array con propiedad distKm agregada.
 * @param {number} userLat
 * @param {number} userLon
 * @param {Array<{lat, lon}>} results — resultados de fetchAllStations
 * @returns {Promise<Array>}
 */
export async function getDistances(userLat, userLon, results) {
  const routeDistances = await osrmDistances(userLat, userLon, results);
  return results.map((r, i) => ({
    ...r,
    distKm: routeDistances != null
      ? routeDistances[i]
      : haversineKm(userLat, userLon, r.lat, r.lon),
  }));
}

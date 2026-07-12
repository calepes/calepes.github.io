const ZONE_ICONS = {
  'Muñeca': '🤚',
  'Codo': '💪',
  'Antebrazo': '💪',
  'Hombro': '🙌',
  'Mano': '✋',
  'Cuerpo Completo': '🧍',
  'Cadera': '🦵',
  'Tren Inferior': '🦵',
  'Bíceps': '💪',
  'Pecho': '🫁',
  'Trapecio': '🦾',
  'Gluteos': '🍑',
  'Pierna': '🦵',
  'Espalda': '🔙',
};

export function deriveZones(exercises) {
  const zones = new Set(exercises.map((e) => e.area).filter(Boolean));
  return [...zones].sort((a, b) => a.localeCompare(b, 'es'));
}

export function filterByZone(exercises, zone) {
  return exercises.filter((e) => e.area === zone);
}

export function posterSrc(videoUrl) {
  return `${videoUrl}#t=0.5`;
}

export function zoneIcon(zone) {
  return ZONE_ICONS[zone] ?? '🏋️';
}

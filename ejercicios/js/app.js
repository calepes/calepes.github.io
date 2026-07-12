import { deriveZones, filterByZone, posterSrc, zoneIcon } from './data.js';

const API_URL = 'https://ejercicios-proxy.carlos-cb4.workers.dev/api/ejercicios';
const CARD_TONES = ['tone-secondary', 'tone-accent', 'tone-hero'];

const screens = {
  loading: document.getElementById('screen-loading'),
  zones: document.getElementById('screen-zones'),
  list: document.getElementById('screen-list'),
  player: document.getElementById('screen-player'),
};
const zoneGrid = document.getElementById('zoneGrid');
const exerciseGrid = document.getElementById('exerciseGrid');
const backBtn = document.getElementById('backBtn');
const screenTitle = document.getElementById('screenTitle');
const errorState = document.getElementById('errorState');
const retryBtn = document.getElementById('retryBtn');
const playerVideo = document.getElementById('playerVideo');
const playerNombre = document.getElementById('playerNombre');
const playerNotas = document.getElementById('playerNotas');

let exercises = [];
let currentZone = null;

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].hidden = key !== name;
  }
  backBtn.hidden = name === 'zones' || name === 'loading';
}

function renderZones() {
  screenTitle.textContent = 'Ejercicios';
  zoneGrid.innerHTML = '';
  deriveZones(exercises).forEach((zone, i) => {
    const btn = document.createElement('button');
    btn.className = `card zone-card ${CARD_TONES[i % CARD_TONES.length]}`;
    btn.innerHTML = `
      <div class="icon">${zoneIcon(zone)}</div>
      <h3>${zone}</h3>
      <p>${filterByZone(exercises, zone).length} ejercicios</p>
    `;
    btn.addEventListener('click', () => openZone(zone));
    zoneGrid.appendChild(btn);
  });
  showScreen('zones');
}

function openZone(zone) {
  currentZone = zone;
  screenTitle.textContent = zone;
  exerciseGrid.innerHTML = '';
  filterByZone(exercises, zone).forEach((ex) => {
    const card = document.createElement('button');
    card.className = 'card exercise-card';
    card.innerHTML = `
      <video src="${posterSrc(ex.videoUrl)}" preload="metadata" muted></video>
      <h3>${ex.nombre}</h3>
    `;
    card.addEventListener('click', () => openPlayer(ex));
    exerciseGrid.appendChild(card);
  });
  showScreen('list');
}

function openPlayer(ex) {
  screenTitle.textContent = ex.nombre;
  playerVideo.src = ex.videoUrl;
  playerNombre.textContent = ex.nombre;
  playerNotas.textContent = ex.notas || '¡A darle con todo! 💪';
  showScreen('player');
}

backBtn.addEventListener('click', () => {
  if (!screens.player.hidden) {
    openZone(currentZone);
  } else if (!screens.list.hidden) {
    renderZones();
  }
});

async function load() {
  showScreen('loading');
  errorState.hidden = true;
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('bad status');
    exercises = await res.json();
    renderZones();
  } catch (err) {
    errorState.hidden = false;
    screens.loading.hidden = true;
  }
}

retryBtn.addEventListener('click', load);

load();

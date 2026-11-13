// Общее состояние игры, сохранение, календарь, инвентарь.
import {
  START_MONEY, MONTHS, SEASON_OF_MONTH, SEASONS, DAYS_PER_MONTH, START_CLOTHES, START_OUTFIT, START_RECIPES,
  CLOTHES_BY_ID, NPCS, resolveLook,
} from './data.js';
import { defaultLook } from './hamster.js';

const KEY = 'rhr-save-v1';

export const G = {
  state: null,
  scene: null,       // текущая сцена (world | villa)
  scenes: {},
  time: 0,           // секунды с запуска (для анимаций)
  modal: 0,          // сколько окон открыто (пока > 0 — мир на паузе)
  keys: new Set(),
  view: { w: 0, h: 0 },
  _ls: {},
  on(ev, fn) { (this._ls[ev] = this._ls[ev] || []).push(fn); },
  emit(ev, data) { (this._ls[ev] || []).forEach((fn) => { try { fn(data || {}); } catch (e) { console.error(e); } }); },
};

// Мебель, которая стоит на вилле в начале игры. floor: 0..2, x — центр, y — высота над полом (для настенных)
const START_VILLA = [
  ['lamp', 0, 372], ['rug_pink', 0, 540], ['sofa_mint', 0, 500], ['coffee_table', 0, 668], ['tv', 0, 800],
  ['pic_sea', 0, 500, 172], ['clock', 0, 660, 185], ['plant_ficus', 0, 888],
  ['fridge', 0, 978], ['chair', 0, 1425], ['table', 0, 1500], ['plant_flowers', 0, 1440, 0, 'table'],
  ['wardrobe', 1, 82], ['rug_blue', 1, 270], ['bed_pink', 1, 270], ['nightstand', 1, 412], ['mirror', 1, 470, 150], ['pic_hamster', 1, 180, 180],
  ['bed_blue', 1, 660], ['wheel', 1, 838], ['pic_sun', 1, 660, 180],
  ['bed_green', 1, 1060], ['bookshelf', 1, 1240], ['teddy', 1, 1150], ['pic_flowers', 1, 1060, 180],
  ['plant_palm', 2, 700], ['plant_palm', 2, 1565],
];

export function newGame(name) {
  let uid = 1;
  const look = defaultLook();
  look.outfit = { ...START_OUTFIT };
  G.state = {
    v: 1, name: name || 'Хомка', money: START_MONEY, spent: 0,
    day: 0, minutes: 7 * 60 + 30,
    look,
    clothes: [...START_CLOTHES],
    storage: {},                                   // мебель в кладовке: id → количество
    villa: START_VILLA.filter((r) => r[4] !== 'table').map(([id, floor, x, y]) => ({ uid: uid++, id, floor, x, y: y || 0 })),
    uid,
    ing: { flour: 2, egg: 2, milk: 2, sugar: 1, carrot: 2, strawberry: 2, tomato: 1, apple: 1, banana: 1, cheese: 1, fish: 1 },
    dishes: { cookies: 2, cocoa: 1 },
    seeds: { seed_carrot: 2 },
    recipes: [...START_RECIPES],
    garden: Array.from({ length: 8 }, () => ({ seed: null, age: 0 })),
    friends: Object.fromEntries(NPCS.map((n) => [n.id, { pts: 0, chat: -1, gift: -1, met: false }])),
    guests: [],
    mail: null, lastTasks: [], tasksDone: 0,
    stickers: [], best: {}, plays: {},
    pos: { scene: 'villa', floor: 1, x: 270 },
    flags: {},
  };
  rollDay(true);
  return G.state;
}

export function save() {
  if (!G.state) return;
  try { localStorage.setItem(KEY, JSON.stringify(G.state)); } catch (e) { /* хранилище недоступно */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return false;
    G.state = s;
    for (const r of START_RECIPES) if (!s.recipes.includes(r)) s.recipes.push(r);
    s.flags = s.flags || {}; s.dayFlags = s.dayFlags || {}; s.pearls = s.pearls || 0;
    for (const n of NPCS) if (!s.friends[n.id]) s.friends[n.id] = { pts: 0, chat: -1, gift: -1, met: false };
    return true;
  } catch (e) { return false; }
}
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

// ---------- календарь ----------
export function cal(s = G.state) {
  const month = Math.floor(s.day / DAYS_PER_MONTH) % 12;
  const season = SEASON_OF_MONTH[month];
  const m = s.minutes;
  const phase = m < 11 * 60 ? 'Утро' : m < 17 * 60 ? 'День' : m < 21 * 60 ? 'Вечер' : 'Ночь';
  const phaseIcon = m < 11 * 60 ? '🌅' : m < 17 * 60 ? '☀️' : m < 21 * 60 ? '🌇' : '🌙';
  return {
    month, monthName: MONTHS[month], dom: (s.day % DAYS_PER_MONTH) + 1, year: Math.floor(s.day / (DAYS_PER_MONTH * 12)) + 1,
    season, seasonName: SEASONS[season].name, seasonIcon: SEASONS[season].icon, phase, phaseIcon,
    time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`,
  };
}
export const season = () => cal().season;
/** 0 — день, 1 — глубокая ночь */
export function darkness() {
  const m = G.state.minutes;
  if (m < 18 * 60) return 0;
  return Math.min(1, (m - 18 * 60) / (3.5 * 60));
}

// Погода на день: sun | rain | snow | petals | leaves
function rollWeather() {
  const s = cal().season, r = Math.random();
  if (s === 'winter') return r < 0.65 ? 'snow' : 'sun';
  if (s === 'spring') return r < 0.25 ? 'rain' : r < 0.75 ? 'petals' : 'sun';
  if (s === 'summer') return r < 0.1 ? 'rain' : 'sun';
  return r < 0.3 ? 'rain' : 'leaves';
}
export function rollDay(first = false) {
  const s = G.state;
  s.weather = first ? 'snow' : rollWeather();
  s.guests = [];
  s.visitor = !first && Math.random() < 0.35 ? NPCS[Math.floor(Math.random() * NPCS.length)].id : null;
  s.dayFlags = {};
}

// ---------- внешность игрока ----------
let lookCache = null, lookKey = '';
export function playerLook() {
  const s = G.state;
  const key = JSON.stringify(s.look);
  if (key !== lookKey) { lookKey = key; lookCache = resolveLook(s.look); }
  return lookCache;
}
export function outfitTags() {
  const tags = new Set();
  for (const id of Object.values(G.state.look.outfit)) if (id && CLOTHES_BY_ID[id]) CLOTHES_BY_ID[id].tags.forEach((t) => tags.add(t));
  return tags;
}

// ---------- деньги и инвентарь ----------
export function spend(n) {
  const s = G.state;
  if (s.money < n) return false;
  s.money -= n; s.spent += n;
  G.emit('money');
  return true;
}
export const hasClothes = (id) => G.state.clothes.includes(id);
export function addClothes(id) { if (!hasClothes(id)) G.state.clothes.push(id); }
export function addTo(bag, id, n = 1) {
  const b = G.state[bag];
  b[id] = (b[id] || 0) + n;
  if (b[id] <= 0) delete b[id];
}
export const count = (bag, id) => G.state[bag][id] || 0;
export function canCook(dish) {
  return Object.entries(dish.needs).every(([id, n]) => count('ing', id) >= n);
}
export function friendHearts(id) { return Math.min(5, Math.floor(G.state.friends[id].pts / 4)); }
export function addSticker(id) {
  if (G.state.stickers.includes(id)) return false;
  G.state.stickers.push(id);
  return true;
}
export function nextUid() { return G.state.uid++; }

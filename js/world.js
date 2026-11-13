// Город, двор виллы и пляж: вид сверху, хомячок ходит сам.
import { clamp, lerp, rnd, pick, seeded, ell, fillRR, line, poly, shade, mix, rr, star, emoji, TAU, dist } from './util.js';
import { drawHamster, blinkAt } from './hamster.js';
import { NPCS, NPC_BY_ID, npcLook, ING_BY_ID, SEED_BY_ID, TASK_BY_ID } from './data.js';
import { G, playerLook, cal, darkness, addSticker, save, addTo } from './game.js';
import { toast } from './ui.js';
import { sfx } from './audio.js';
import * as F from './features.js';

export const T = 48, MW = 72, MH = 106;
const SEA_Y = 44;  // с этой строки начинается глубокое море
const BUOY_Y = 74; // линия буйков: дальше — открытое море, туда можно только на кораблике
const BOAT_HOME = { x: 52.5 * T, y: 46.5 * T }; // стоянка кораблика у пирса
const isDeep = (c) => c === 'w' || c === 'O';
const OUT = '#4a3728';
const PS = 0.78; // масштаб хомячка в городе

// ---------- здания ----------
// x, y, w, h — «пятно» здания в клетках; дверь — снизу по центру.
const B = (id, kind, x, y, w, h, o = {}) => ({ id, kind, x, y, w, h, ...o });
export const BUILDINGS = [
  B('villa', 'villa', 8, 2, 10, 5, { name: 'Моя вилла', wall: '#fff3d6', roof: '#f76e5c' }),
  B('salon', 'shop', 26, 8, 4, 4, { name: 'Салон красоты', icon: '💇', wall: '#ffc9de', roof: '#e64980' }),
  B('boutique', 'shop', 30, 8, 4, 4, { name: 'Бутик «Бантик»', icon: '🎀', wall: '#e5dbff', roof: '#845ef7' }),
  B('mall_fashion', 'mall', 36, 6, 7, 6, { name: 'ТЦ «Модный»', icon: '👗', wall: '#ffe066', roof: '#f59f00' }),
  B('mall_home', 'mall', 44, 6, 7, 6, { name: 'ТЦ «Уютный дом»', icon: '🛋️', wall: '#a5d8ff', roof: '#1c7ed6' }),
  B('fashion', 'tower', 55, 8, 4, 4, { name: 'Дом моды', icon: '👠', wall: '#f783ac', floors: 8 }),
  B('tower', 'tower', 60, 8, 4, 4, { name: 'Хомяк-Тауэр', icon: '🔭', wall: '#74c0fc', floors: 11 }),
  B('bank', 'tower', 65, 8, 4, 4, { name: 'Хомяк-Банк', icon: '💰', wall: '#ffd43b', floors: 7 }),
  B('mall_food', 'mall', 26, 18, 7, 6, { name: 'ТЦ «Вкусный»', icon: '🛒', wall: '#b2f2bb', roof: '#2f9e44' }),
  B('hospital', 'mall', 36, 18, 7, 6, { name: 'Больница', icon: '🏥', wall: '#ffffff', roof: '#fa5252' }),
  B('school', 'mall', 44, 18, 7, 6, { name: 'Школа', icon: '🔔', wall: '#ffd8a8', roof: '#e8590c' }),
  B('pool', 'shop', 54, 19, 5, 5, { name: 'Бассейн', icon: '🏊', wall: '#99e9f2', roof: '#0c8599' }),
  B('rest', 'shop', 26, 30, 7, 5, { name: '«Золотой орешек»', icon: '🍽️', wall: '#ffec99', roof: '#c92a2a' }),
  B('cafe', 'shop', 37, 31, 4, 4, { name: 'Кафе «Семечка»', icon: '☕', wall: '#ffdeeb', roof: '#d6336c' }),
  B('beachcafe', 'shop', 55, 31, 4, 4, { name: 'Пляжное кафе', icon: '🍹', wall: '#c3fae8', roof: '#12b886' }),
  B('house0', 'house', 3, 31, 4, 4, { wall: '#ffe8cc', roof: '#e8590c', npc: 'plusha' }),
  B('house1', 'house', 42, 31, 4, 4, { wall: '#d0ebff', roof: '#1971c2', npc: 'ponchik' }),
  B('house2', 'house', 60, 31, 4, 4, { wall: '#e9ecef', roof: '#495057', npc: 'senya' }),
  B('house3', 'house', 47, 31, 4, 4, { wall: '#ffdeeb', roof: '#c2255c', npc: 'busya' }),
  B('house4', 'house', 14, 31, 4, 4, { wall: '#f1e0c5', roof: '#8d5524', npc: 'prof' }),
  B('house5', 'house', 8, 31, 4, 4, { wall: '#d3f9d8', roof: '#2f9e44', npc: 'myata' }),
  B('house6', 'house', 65, 31, 4, 4, { wall: '#c5f6fa', roof: '#0b7285', npc: 'bob' }),
  B('house7', 'house', 19, 31, 4, 4, { wall: '#fff0f6', roof: '#f06595', npc: 'zefirka' }),
];
const B_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const doorOf = (id) => doorPx(B_BY_ID[id]);
const doorPx = (b) => ({ x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + T * 0.45 });

// Необитаемые острова в море: центр (в клетках), размеры и что на них лежит
const ISLES = [
  { name: 'Остров Сундука', x: 22, y: 53, rx: 3.6, ry: 2.3, deco: [['palm', 0, -1], ['umbrella', -2, 0], ['chest', 2, 0]] },
  { name: 'Пальмовый остров', x: 47, y: 57, rx: 4.6, ry: 2.8, deco: [['palm', -2, -1], ['palm', 1, -2], ['palm', 3, 0], ['starfish', -1, 1], ['crab', 1, 1]] },
  { name: 'Крабий островок', x: 64, y: 51, rx: 2.4, ry: 1.7, deco: [['palm', 0, -1], ['crab', -1, 0], ['crab', 1, 0]] },
  { name: 'Звёздный остров', x: 9, y: 63, rx: 3.4, ry: 2.5, deco: [['palm', -1, -1], ['starfish', 1, 0], ['starfish', -2, 1], ['starfish', 0, 1], ['flag', 2, -1]] },
  { name: 'Остров Кораблика', x: 33, y: 68, rx: 5.2, ry: 2.9, deco: [['palm', -3, -1], ['palm', 3, -1], ['boat', 0, 0], ['chest', -2, 1], ['crab', 2, 1]] },
  { name: 'Остров-крошка', x: 60, y: 67, rx: 1.9, ry: 1.5, deco: [['palm', 0, -1], ['starfish', 0, 0]] },
  // за буйками — только на кораблике
  { name: 'Остров Сокровищ', x: 36, y: 90, rx: 7.2, ry: 4.2, treasure: true, deco: [['volcano', 0, -2], ['palm', -5, -1], ['palm', -3, 1], ['palm', 4, -1], ['palm', 5, 1], ['chest', 1, 2], ['crab', -1, 2], ['flag', 3, 2]] },
  { name: 'Ледяной остров', x: 12, y: 93, rx: 4.4, ry: 2.8, ice: true, deco: [['igloo', 0, -1], ['penguin', -2, 0], ['penguin', 0, 1], ['penguin', 2, 0]] },
  { name: 'Остров Маяка', x: 61, y: 88, rx: 3.2, ry: 2.3, deco: [['lighthouse', 0, -1], ['starfish', -2, 0], ['crab', 1, 1]] },
];
const HANG = { plusha: [30, 5], ponchik: [39, 35], senya: [56, 24], busya: [41, 12], prof: [47, 24], myata: [15, 27], bob: [50, 44], zefirka: [42, 39] };

const W = {
  ground: [], solid: [], objs: [], cam: { x: 0, y: 0, zoom: 1 },
  p: { x: 12.5 * T, y: 7.6 * T, dir: 1, path: [], moving: false, walkT: 0, pending: null, surf: 'g' },
  npcs: [], sea: [], drops: [], crumbs: null, weather: [], built: false, down: null, sorted: [],
};

// ---------- построение карты ----------
function build() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('g'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = ch; };
  fill(0, 37, 71, 41, 's'); fill(0, 42, 71, 43, 'h'); fill(0, SEA_Y, 71, BUOY_Y, 'w'); fill(0, BUOY_Y + 1, 71, MH - 1, 'O');
  // необитаемые острова: песок, а вокруг мелководье
  for (const is of ISLES) for (let y = Math.floor(is.y - is.ry - 2); y <= is.y + is.ry + 2; y++) for (let x = Math.floor(is.x - is.rx - 2); x <= is.x + is.rx + 2; x++) {
    const d = ((x + 0.5 - is.x) / is.rx) ** 2 + ((y + 0.5 - is.y) / is.ry) ** 2;
    if (d <= 1) g[y][x] = is.ice ? 'I' : 's'; else if (d <= 2.1 && isDeep(g[y][x])) g[y][x] = 'h';
  }
  fill(25, 12, 71, 13, 'r'); fill(0, 24, 71, 25, 'r'); fill(34, 0, 35, 36, 'r'); fill(52, 0, 53, 36, 'r'); fill(0, 35, 71, 36, 'r');
  fill(36, 14, 51, 16, 'r'); // площадь с фонтаном
  fill(50, 37, 51, 47, 'i');
  // двор виллы
  fill(12, 7, 13, 23, 'y'); fill(12, 12, 24, 13, 'y');
  fill(2, 13, 11, 21, 'p'); fill(3, 14, 10, 20, 'o');
  for (let y = 14; y <= 20; y++) for (let x = 16; x <= 23; x++) { if (((x + 0.5 - 19.5) / 3.2) ** 2 + ((y + 0.5 - 17.5) / 2.6) ** 2 <= 1) g[y][x] = 'd'; }
  for (let x = 17; x <= 20; x++) { g[8][x] = 'b'; g[10][x] = 'b'; }
  // городской бассейн
  fill(59, 15, 69, 22, 'p'); fill(60, 16, 68, 21, 'o');
  W.ground = g;

  const solid = Array.from({ length: MH }, () => Array(MW).fill(false));
  const objs = [];
  const add = (type, tx, ty, o = {}) => { const ob = { type, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ...o }; objs.push(ob); return ob; };
  for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) solid[y][x] = true;
  // забор вокруг виллы (ворота: на восток и на юг)
  for (let x = 1; x <= 24; x++) for (const y of [1, 22]) { if (y === 22 && (x === 12 || x === 13)) continue; solid[y][x] = true; add('fenceH', x, y); }
  for (let y = 2; y <= 21; y++) for (const x of [1, 24]) { if (x === 24 && (y === 12 || y === 13)) continue; solid[y][x] = true; add('fenceV', x, y); }
  // грядки, почтовый ящик, особые предметы
  for (let x = 17; x <= 20; x++) { solid[8][x] = true; solid[10][x] = true; }
  solid[7][15] = true; add('mailbox', 15, 7);
  add('icehole', 19, 17);
  add('fountain', 43, 15, { big: true }); solid[15][43] = true; solid[15][44] = true;
  add('fishsign', 51, 47);
  for (const is of ISLES) for (const [type, dx, dy] of is.deco) {
    const ox = Math.floor(is.x) + dx, oy = Math.floor(is.y) + dy;
    add(type, ox, oy, type === 'umbrella' ? { beach: true } : {});
    if (type === 'palm' || type === 'igloo' || type === 'lighthouse') solid[oy][ox] = true;
    if (type === 'volcano') for (const vx of [-1, 0, 1]) solid[oy][ox + vx] = true;
  }
  for (let x = 1; x < MW; x += 5) add('buoy', x, BUOY_Y);
  for (const [x, y] of [[6, 87], [20, 98], [3, 99], [24, 84]]) add('iceberg', x, y);
  for (const [x, y] of [[4, 12], [6, 12], [8, 12]]) add('lounger', x, y);
  add('umbrella', 10, 12); solid[12][10] = true;
  for (const [x, y] of [[38, 15], [48, 15], [28, 14], [31, 14], [57, 14], [63, 14]]) { add('bench', x, y); solid[y][x] = true; }
  for (const [x, y] of [[8, 39], [20, 38], [30, 40], [40, 38], [60, 39], [67, 40]]) add('umbrella', x, y, { beach: true });
  // пальмы вдоль набережной
  for (let x = 2; x < 72; x += 4) { if (x >= 49 && x <= 52) continue; if (g[37][x] === 's') { solid[37][x] = true; add('palm', x, 37); } }
  // деревья, кусты, цветы
  const rng = seeded(20261112);
  const nearDoor = (x, y) => BUILDINGS.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y + b.h && y <= b.y + b.h + 1);
  const taken = new Set(objs.map((o) => o.tx + ',' + o.ty)); // где уже что-то стоит (лежаки, зонтики…) — зелень не сажаем
  const isG = (x, y) => g[y] && g[y][x] === 'g' && !solid[y][x] && !taken.has(x + ',' + y);
  const bush = Array.from({ length: MH }, () => Array(MW).fill(false));
  for (let y = 0; y < 37; y++) for (let x = 0; x < MW; x++) {
    if (!isG(x, y) || nearDoor(x, y)) continue;
    const yard = x > 1 && x < 24 && y > 1 && y < 22;
    let lonely = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = g[y + dy] && g[y + dy][x + dx]; if (c && c !== 'g') lonely = false; }
    const r = rng();
    if (yard) {
      if (y >= 2 && y <= 7 && x >= 7 && x <= 18) continue; // перед виллой чисто
      if (r < 0.07 && lonely) { solid[y][x] = true; add(rng() < 0.5 ? 'palm' : 'tree', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.16) { bush[y][x] = true; add('bush', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.34) add('flowers', x, y, { v: Math.floor(rng() * 4) });
    } else {
      if (r < 0.2 && lonely) { solid[y][x] = true; add(y >= 27 ? (rng() < 0.75 ? 'palm' : 'tree') : (rng() < 0.3 ? 'pine' : 'tree'), x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.26) { bush[y][x] = true; add('bush', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.36) add('flowers', x, y, { v: Math.floor(rng() * 4) });
    }
  }
  W.solid = solid; W.bush = bush; W.objs = objs; W.built = true;
  initSea();
  // жители
  W.npcs = NPCS.map((n) => { const [hx, hy] = HANG[n.id]; return { id: n.id, ph: 1 + NPCS.indexOf(n) * 2.3, x: (hx + 0.5) * T, y: (hy + 0.5) * T, dir: 1, path: [], wait: rnd(0, 3), walkT: 0, moving: false, hidden: false }; });
}

function ch(tx, ty) { return W.ground[ty] ? W.ground[ty][tx] : undefined; }
let DRY = false; // true — искать путь только по суше (для жителей)
function walkable(tx, ty, foot) {
  const c = ch(tx, ty);
  if (c === undefined) return false;
  if (!DRY && !foot && W.p.boat) return c === 'w' || c === 'O' || c === 'h'; // на кораблике — только по воде
  if (c === 'O') return false;                                              // за буйки вплавь нельзя
  if (DRY && (c === 'h' || c === 'w' || c === 'o' || c === 'd')) return false;
  if (c === 'd') return cal().season === 'winter';
  return !W.solid[ty][tx];
}

// ---------- поиск пути (A*) ----------
function nearestWalkable(tx, ty, maxR = 7) {
  if (walkable(tx, ty)) return [tx, ty];
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (walkable(tx + dx, ty + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
    }
    if (best) return best;
  }
  return null;
}
function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const idx = (x, y) => y * MW + x;
  const open = [], gS = new Float32Array(MW * MH).fill(1e9), from = new Int32Array(MW * MH).fill(-1), closed = new Uint8Array(MW * MH);
  const push = (i, f) => { open.push([f, i]); let k = open.length - 1; while (k > 0) { const pIdx = (k - 1) >> 1; if (open[pIdx][0] <= open[k][0]) break; [open[pIdx], open[k]] = [open[k], open[pIdx]]; k = pIdx; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top[1]; };
  const hF = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  gS[idx(sx, sy)] = 0; push(idx(sx, sy), hF(sx, sy));
  const goal = idx(tx, ty);
  let found = false, guard = 0;
  while (open.length && guard++ < 30000) {
    const cur = pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ni = idx(nx, ny), ng = gS[cur] + (dx && dy ? 1.41 : 1);
      if (ng < gS[ni]) { gS[ni] = ng; from[ni] = cur; push(ni, ng + hF(nx, ny)); }
    }
  }
  if (!found) return null;
  const path = [];
  for (let c = goal; c !== idx(sx, sy) && c !== -1; c = from[c]) path.push({ x: ((c % MW) + 0.5) * T, y: (((c / MW) | 0) + 0.5) * T });
  return path.reverse();
}
const tileOf = (px) => Math.floor(px / T);

function walkTo(ent, px, py, exact) {
  const s = nearestWalkable(tileOf(ent.x), tileOf(ent.y), 3) || [tileOf(ent.x), tileOf(ent.y)];
  const t = nearestWalkable(clamp(tileOf(px), 0, MW - 1), clamp(tileOf(py), 0, MH - 1));
  if (!t) return false;
  const path = findPath(s[0], s[1], t[0], t[1]);
  if (!path) return false;
  if (exact && t[0] === tileOf(px) && t[1] === tileOf(py)) { if (path.length) path[path.length - 1] = { x: px, y: py }; else path.push({ x: px, y: py }); }
  ent.path = path;
  return true;
}

// ---------- вход / выход ----------
export function enter(from) {
  if (!W.built) build();
  const p = W.p, s = G.state;
  p.path = []; p.pending = null; p.moving = false;
  const bt = boatState();
  if (from === 'villa') { const d = doorPx(B_BY_ID.villa); p.x = d.x; p.y = d.y; bt.x = BOAT_HOME.x; bt.y = BOAT_HOME.y; bt.on = false; } // кораблик возвращается к пирсу
  else if (s.pos && s.pos.scene === 'world') { p.x = s.pos.x; p.y = s.pos.y; }
  p.boat = !!bt.on;
  // позиция из сохранения могла испортиться или оказаться в стене — тогда встаём рядом, а если никак — у двери виллы
  const onMap = p.x >= 0 && p.x < MW * T && p.y >= 0 && p.y < MH * T;
  if (!onMap || !walkable(tileOf(p.x), tileOf(p.y))) {
    const nw = onMap ? nearestWalkable(tileOf(p.x), tileOf(p.y)) : null;
    if (nw) { p.x = (nw[0] + 0.5) * T; p.y = (nw[1] + 0.5) * T; }
    else { const d = doorPx(B_BY_ID.villa); p.x = d.x; p.y = d.y; p.boat = false; bt.on = false; }
  }
  layout(); W.cam.x = p.x; W.cam.y = p.y; clampCam();
  initWeather();
}
export function leave() { G.state.pos = { scene: 'world', x: W.p.x, y: W.p.y }; }
export function storePos() { if (G.scene === api) G.state.pos = { scene: 'world', x: W.p.x, y: W.p.y }; }

function layout() { const { w, h } = G.view; W.cam.zoom = clamp(Math.min(w, h) / (T * 9.4), 0.8, 1.4); }
function clampCam() {
  const { w, h } = G.view, z = W.cam.zoom, vw = w / z, vh = h / z;
  W.cam.x = vw >= MW * T ? (MW * T) / 2 : clamp(W.cam.x, vw / 2, MW * T - vw / 2);
  W.cam.y = vh >= MH * T ? (MH * T) / 2 : clamp(W.cam.y, vh / 2, MH * T - vh / 2);
}
function toWorld(sx, sy) { const { w, h } = G.view, z = W.cam.zoom; return { x: W.cam.x + (sx - w / 2) / z, y: W.cam.y + (sy - h / 2) / z }; }

/** Случайные свободные места для предметов задания. zone: beach | town */
export function randomSpots(zone, n, seed) {
  if (!W.built) build();
  const rng = seeded(seed), out = [];
  let guard = 0;
  while (out.length < n && guard++ < 4000) {
    const x = Math.floor(rng() * MW), y = zone === 'beach' ? 37 + Math.floor(rng() * 5) : Math.floor(rng() * 37);
    const c = ch(x, y);
    if (!walkable(x, y)) continue;
    if (zone === 'beach' ? c !== 's' : (c !== 'r' && c !== 'g')) continue;
    if (zone !== 'beach' && x < 25 && y < 23) continue; // не во дворе
    if (out.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 4)) continue;
    const s = nearestWalkable(12, 24); // достижимо с улицы
    if (zone !== 'beach' && c === 'g' && !findPath(s[0], s[1], x, y)) continue;
    out.push({ x, y, got: false });
  }
  return out;
}
/** Куда идти по заданию (пиксели мира) или null. */
function targetPx() {
  const m = G.state.mail;
  if (!m) return null;
  if (!m.read) { return { x: 15.5 * T, y: 7.5 * T, icon: '✉️' }; }
  if (m.done) return null;
  const t = TASK_BY_ID[m.task];
  if (!t) return null;
  if (t.type === 'collect' && m.items) { const it = m.items.find((i) => !i.got); return it ? { x: (it.x + 0.5) * T, y: (it.y + 0.5) * T, icon: t.sticker } : null; }
  const wh = t.where;
  if (wh === 'pier') return { x: 51 * T, y: 46.5 * T, icon: '⭐' };
  if (wh === 'beach') return { x: 40 * T, y: 42.5 * T, icon: '⭐' };
  if (wh === 'town') return null;
  const b = B_BY_ID[wh];
  if (b) { const d = doorPx(b); return { x: d.x, y: d.y - T, icon: '⭐' }; }
  return null;
}

// ---------- ввод ----------
export function pointerDown(sx, sy) { W.down = { sx, sy }; }
export function pointerMove() {}
export function pointerUp(sx, sy) {
  if (!W.down) return;
  const moved = Math.hypot(sx - W.down.sx, sy - W.down.sy) > 16;
  W.down = null;
  if (moved) return;
  const w = toWorld(sx, sy), p = W.p;
  const tx = tileOf(w.x), ty = tileOf(w.y);
  p.pending = null;
  if (p.boat) { boatTap(w, tx, ty); return; }
  const bt = boatState();
  if (dist(w.x, w.y, bt.x, bt.y - 20) < 60) { goNear(bt.x, bt.y, { act: 'board' }); sfx('tap'); return; } // кораблик
  // житель?
  for (const n of W.npcs) {
    if (n.hidden) continue;
    if (Math.abs(w.x - n.x) < 30 && w.y > n.y - 70 && w.y < n.y + 14) { goNear(n.x, n.y, { npc: n }); sfx('tap'); return; }
  }
  // почтовый ящик, лунка, табличка рыбака
  for (const o of W.objs) {
    if (o.type === 'mailbox' && Math.abs(w.x - o.x) < 34 && w.y > o.y - 64 && w.y < o.y + 30) { if (walkTo(p, o.x, o.y + T, true)) p.pending = { act: 'mail' }; sfx('tap'); return; }
    if (o.type === 'icehole' && cal().season === 'winter' && dist(w.x, w.y, o.x, o.y) < 30) { if (walkTo(p, o.x + T, o.y, true)) p.pending = { act: 'fish', spot: 'pond' }; sfx('tap'); return; }
  }
  // стайка рыбок — покормить
  for (const f of W.sea) if (f.kind === 'fish' && dist(w.x, w.y, f.x, f.y) < 44) { if (walkTo(p, f.x - 30, f.y + 20, true)) p.pending = { act: 'feed', f }; sfx('tap'); return; }
  // пальма — потрясти, упадёт кокос
  for (const o of W.objs) if (o.type === 'palm' && Math.abs(w.x - o.x - 4) < 34 && w.y > o.y - 78 && w.y < o.y + 18) { goNear(o.x, o.y, { act: 'palm', o }); sfx('tap'); return; }
  const c = ch(tx, ty);
  if (c === 'b') { const i = (ty === 8 ? 0 : 4) + (tx - 17); if (walkTo(p, (tx + 0.5) * T, (ty + 1.5) * T, true)) p.pending = { act: 'bed', i }; sfx('tap'); return; }
  if (c === 'd' && cal().season !== 'winter') { goNear((tx + 0.5) * T, (ty + 0.5) * T, { act: 'fish', spot: 'pond' }); sfx('tap'); return; }
  if (c === 'i' && ty >= 45) { if (walkTo(p, 50.5 * T, 46.5 * T, true)) p.pending = { act: 'fish', spot: 'pier' }; sfx('tap'); return; }
  // здание? (попадание в нарисованную часть)
  for (const b of BUILDINGS) {
    const topPad = b.kind === 'tower' ? b.floors * T * 0.62 : T * 0.8;
    if (w.x >= b.x * T && w.x <= (b.x + b.w) * T && w.y >= b.y * T - topPad && w.y <= (b.y + b.h) * T) {
      const d = doorPx(b);
      if (walkTo(p, d.x, d.y, true)) p.pending = { b };
      sfx('tap'); return;
    }
  }
  if (walkTo(p, w.x, w.y, true)) sfx('step');
}
function goNear(px, py, pending) {
  // подойти к соседней клетке рядом с целью
  const p = W.p, tx = tileOf(px), ty = tileOf(py);
  let best = null, bd = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || !walkable(tx + dx, ty + dy)) continue;
    const d = dist((tx + dx + 0.5) * T, (ty + dy + 0.5) * T, p.x, p.y) + (dx && dy ? 20 : 0);
    if (d < bd) { bd = d; best = [tx + dx, ty + dy]; }
  }
  if (!best) { const nw = nearestWalkable(tx, ty); if (!nw) return; best = nw; }
  if (dist(p.x, p.y, px, py) < T * 1.6) { p.path = []; p.pending = pending; arrive(); return; }
  if (walkTo(p, (best[0] + 0.5) * T, (best[1] + 0.5) * T, true)) p.pending = pending;
}
function arrive() {
  const p = W.p, pd = p.pending;
  p.pending = null;
  if (!pd) return;
  if (pd.npc) { p.dir = pd.npc.x >= p.x ? 1 : -1; pd.npc.dir = -p.dir; pd.npc.path = []; pd.npc.wait = 4; F.npcDialog(pd.npc.id); return; }
  if (pd.b) { sfx('door'); F.enterBuilding(pd.b.id); return; }
  if (pd.act === 'mail') F.openMailbox();
  else if (pd.act === 'bed') F.gardenBed(pd.i);
  else if (pd.act === 'fish') F.goFishing(pd.spot);
  else if (pd.act === 'palm') shakePalm(pd.o);
  else if (pd.act === 'feed') feedFish();
  else if (pd.act === 'board') boardBoat();
  else if (pd.act === 'land') landFromBoat(pd.tx, pd.ty);
}
export function interactNearest() {
  const p = W.p; let best = null, bd = T * 1.7;
  if (p.boat) { leaveBoat(); return; }
  { const bt = boatState(), d = dist(p.x, p.y, bt.x, bt.y); if (d < T * 2) { bd = d * 0.5; best = { act: 'board' }; } }
  for (const n of W.npcs) { if (n.hidden) continue; const d = dist(p.x, p.y, n.x, n.y); if (d < bd) { bd = d; best = { npc: n }; } }
  for (const b of BUILDINGS) { const dd = doorPx(b), d = dist(p.x, p.y, dd.x, dd.y); if (d < bd) { bd = d; best = { b }; } }
  const mb = dist(p.x, p.y, 15.5 * T, 8.5 * T); if (mb < bd) { bd = mb; best = { act: 'mail' }; }
  for (let i = 0; i < 8; i++) { const bx = (17 + (i % 4) + 0.5) * T, by = ((i < 4 ? 8 : 10) + 1.5) * T, d = dist(p.x, p.y, bx, by); if (d < bd * 0.6) { bd = d; best = { act: 'bed', i }; } }
  if (dist(p.x, p.y, 50.5 * T, 46.5 * T) < T * 1.5) best = { act: 'fish', spot: 'pier' };
  if (!best) { // рядом пруд?
    const tx = tileOf(p.x), ty = tileOf(p.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ch(tx + dx, ty + dy) === 'd' && cal().season !== 'winter') best = { act: 'fish', spot: 'pond' };
  }
  if (best) { p.path = []; p.pending = best; arrive(); }
  else if (canDive()) G.go('dive', 'world');
}

// ---------- обновление ----------
const inBush = (px, py) => !!(W.bush[tileOf(py)] && W.bush[tileOf(py)][tileOf(px)]);
function moveAlong(ent, speed, dt) {
  if (!ent.path.length) { ent.moving = false; return false; }
  if (inBush(ent.x, ent.y)) speed *= 0.5; // через кусты можно, но медленнее
  const t = ent.path[0], dx = t.x - ent.x, dy = t.y - ent.y, d = Math.hypot(dx, dy), step = speed * dt;
  ent.moving = true; ent.walkT += dt * 2.4;
  if (Math.abs(dx) > 2) ent.dir = dx > 0 ? 1 : -1;
  if (d <= step) { ent.x = t.x; ent.y = t.y; ent.path.shift(); if (!ent.path.length) { ent.moving = false; return true; } }
  else { ent.x += (dx / d) * step; ent.y += (dy / d) * step; }
  return false;
}
function canStand(px, py) {
  const r = 11;
  for (const [ox, oy] of [[-r, -6], [r, -6], [-r, 6], [r, 6]]) if (!walkable(tileOf(px + ox), tileOf(py + oy))) return false;
  return true;
}
export function update(dt) {
  const p = W.p, keys = G.keys;
  const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const ky = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  const sp = p.boat ? 330 : p.surf === 'w' ? 170 : p.surf === 'o' || p.surf === 'h' ? 140 : p.surf === 'd' ? 270 : 225;
  if (kx || ky) {
    p.path = []; p.pending = null;
    const k = (inBush(p.x, p.y) ? 0.5 : 1) * sp * dt / Math.hypot(kx, ky);
    if (canStand(p.x + kx * k, p.y)) p.x += kx * k;
    if (canStand(p.x, p.y + ky * k)) p.y += ky * k;
    if (kx) p.dir = kx;
    p.moving = true; p.walkT += dt * 2.4;
  } else if (moveAlong(p, sp, dt)) arrive();
  if (p.boat) { const bt = boatState(); bt.x = p.x; bt.y = p.y; }
  // на чём стоим
  const surf = ch(tileOf(p.x), tileOf(p.y));
  { const nb = inBush(p.x, p.y); if (nb && !p.inBush) sfx('paper'); p.inBush = nb; }
  // шаги: звук зависит от поверхности
  if (p.moving) {
    p.stepT = (p.stepT || 0) + dt;
    const water = surf === 'o' || surf === 'h' || surf === 'w' || surf === 'O';
    if (p.stepT > (water ? 0.5 : surf === 'd' ? 0.45 : 0.3)) {
      p.stepT = 0;
      if (p.boat) { p.stepT = -0.25; sfx('paddle'); }
      else sfx(water ? 'paddle' : surf === 'd' ? 'skate' : surf === 'I' ? 'stepSnow' : surf === 's' ? 'stepSand' : surf === 'i' ? 'stepWood' : surf === 'g' ? (cal().season === 'winter' ? 'stepSnow' : 'step') : 'stepStone');
    }
  } else p.stepT = 0.2;
  if (surf !== p.surf) {
    const wasWater = p.surf === 'o' || p.surf === 'h' || p.surf === 'w';
    if (p.boat) { if (surf === 'O' && addSticker('x_far')) { toast('Новая наклейка: 🌅 За буйками!', 'good'); toast('Это открытое море. Где-то здесь прячутся дальние острова…'); save(); } }
    else if ((surf === 'o' || surf === 'h' || surf === 'w') && !wasWater) { sfx('splash'); G.emit('swim', { where: surf === 'o' ? 'pool' : 'sea' }); }
    if ((surf === 's' || surf === 'I') && tileOf(p.y) > SEA_Y) landOnIsle();
    if (surf === 'd') G.emit('skate');
    p.surf = surf; G.emit('hud');
  }
  // предметы задания
  const m = G.state.mail;
  if (m && m.items && !m.done) for (const it of m.items) {
    if (!it.got && dist(p.x, p.y, (it.x + 0.5) * T, (it.y + 0.5) * T) < 34) { it.got = true; sfx('coin'); G.emit('collect'); }
  }
  // жители
  const min = G.state.minutes, night = min >= 22 * 60 || min < 6.5 * 60;
  for (const n of W.npcs) {
    n.hidden = night || G.state.guests.includes(n.id);
    if (n.hidden || G.modal) continue;
    if (n.path.length) { moveAlong(n, 90, dt); continue; }
    n.wait -= dt;
    if (n.wait > 0) continue;
    n.wait = rnd(2.5, 7);
    const home = BUILDINGS.find((b) => b.npc === n.id);
    const [ax, ay] = min >= 19 * 60 ? [home.x + 2, home.y + home.h + 1] : HANG[n.id];
    const far = dist(n.x, n.y, (ax + 0.5) * T, (ay + 0.5) * T) > T * 4;
    const tx = far ? ax : tileOf(n.x) + Math.round(rnd(-2, 2)), ty = far ? ay : tileOf(n.y) + Math.round(rnd(-2, 2));
    if (!far && dist((tx + 0.5) * T, (ty + 0.5) * T, (ax + 0.5) * T, (ay + 0.5) * T) > T * 3.5) continue;
    if (['o', 'h', 'w', 'd'].includes(ch(tx, ty))) continue;
    DRY = true; walkTo(n, (tx + 0.5) * T, (ty + 0.5) * T, false); DRY = false;
  }
  // камера
  layout();
  W.cam.x = lerp(W.cam.x, p.x, Math.min(1, dt * 6)); W.cam.y = lerp(W.cam.y, p.y - 20, Math.min(1, dt * 6));
  clampCam();
  updateWeather(dt);
  updateSea(dt);
  for (const q of W.drops) q.t += dt;
  W.drops = W.drops.filter((q) => q.t < 0.9);
}

// ---------- кораблик ----------
function boatState() {
  const s = G.state;
  if (!s.boat) s.boat = { x: BOAT_HOME.x, y: BOAT_HOME.y, on: false };
  return s.boat;
}
export const isBoating = () => !!W.p.boat;
function boardBoat() {
  const p = W.p, bt = boatState();
  if (dist(p.x, p.y, bt.x, bt.y) > T * 2.4) return;
  p.boat = true; bt.on = true; p.x = bt.x; p.y = bt.y; p.path = []; p.surf = ch(tileOf(p.x), tileOf(p.y));
  sfx('splash'); sfx('ok');
  if (addSticker('x_boat')) toast('Новая наклейка: ⛵ Капитан!', 'good');
  if (!G.state.flags.boatHint) { G.state.flags.boatHint = 1; toast('Ты на кораблике! Нажимай на воду — поплывём. Теперь можно и за буйки! ⛵'); }
  G.emit('boat'); G.emit('hud'); save();
}
function getOff(px, py) {
  const p = W.p, bt = boatState();
  bt.x = p.x; bt.y = p.y; bt.on = false; p.boat = false; p.path = []; p.pending = null;
  p.x = px; p.y = py; sfx('pop');
  G.emit('hud'); save();
}
function landFromBoat(tx, ty) {
  const p = W.p;
  if (dist(p.x / T, p.y / T, tx + 0.5, ty + 0.5) > 2.6 || !walkable(tx, ty, true)) { toast('Ближе на кораблике не подплыть. Попробуй с другой стороны!'); return; }
  getOff((tx + 0.5) * T, (ty + 0.5) * T);
}
/** Сойти с кораблика там, где он сейчас: на берег рядом или в воду. */
export function leaveBoat() {
  const p = W.p, tx = tileOf(p.x), ty = tileOf(p.y);
  if (!p.boat) return;
  let best = null, bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const c = ch(tx + dx, ty + dy);
    if (c === 'w' || c === 'O' || c === 'h' || c === 'o' || !walkable(tx + dx, ty + dy, true)) continue;
    const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; }
  }
  if (best) { getOff((best[0] + 0.5) * T, (best[1] + 0.5) * T); return; }
  if (ch(tx, ty) === 'O') { toast('Здесь открытое море — слишком далеко и глубоко. Сойти можно у берега или внутри буйков.'); return; }
  const ox = p.x - 46, oy = p.y + 26, okSpot = walkable(tileOf(ox), tileOf(oy), true);
  getOff(okSpot ? ox : p.x, okSpot ? oy : p.y); sfx('splash');
}
function boatTap(w, tx, ty) {
  const p = W.p;
  for (const f of W.sea) if (f.kind === 'fish' && dist(w.x, w.y, f.x, f.y) < 44) { if (walkTo(p, f.x - 50, f.y + 20, true)) p.pending = { act: 'feed', f }; sfx('tap'); return; }
  const c = ch(tx, ty);
  if (c === 'w' || c === 'O' || c === 'h') { if (walkTo(p, w.x, w.y, true)) sfx('paddle'); return; }
  if (walkable(tx, ty, true)) { if (walkTo(p, w.x, w.y, false)) p.pending = { act: 'land', tx, ty }; sfx('tap'); return; } // берег: подплыть и сойти
  walkTo(p, w.x, w.y, false);
}

// ---------- кокосы и корм для рыбок ----------
function shakePalm(o) {
  const s = G.state, key = o.tx + '_' + o.ty;
  s.dayFlags.palms = s.dayFlags.palms || {};
  o.shake = G.time + 0.8; sfx('paper');
  if (s.dayFlags.palms[key]) { toast('На этой пальме кокосы на сегодня закончились. Попробуй другую! 🌴'); return; }
  s.dayFlags.palms[key] = 1;
  addTo('ing', 'coconut', 1);
  W.drops.push({ x: o.x + 6, y: o.y - 58, t: 0, e: '🥥' });
  setTimeout(() => { sfx('pop'); toast('Бум! +1 🥥 Кокос', 'good'); }, 450);
  G.emit('coconut'); save();
}
function feedFish() {
  const p = W.p, tx = tileOf(p.x), ty = tileOf(p.y);
  const fx = p.x + p.dir * 46, fy = p.y + 6;
  W.crumbs = { x: fx, y: fy, until: G.time + 7 };
  let n = 0;
  for (const f of W.sea) if (f.kind === 'fish' && dist(f.x, f.y, fx, fy) < T * 9) { f.feed = G.time + 7; f.timer = Math.min(f.timer, rnd(0.4, 1.6)); n++; }
  sfx('paddle'); sfx('heart');
  toast(n > 1 ? 'Рыбки со всех сторон плывут на угощение! 🐟🐠' : 'Рыбки пробуют крошки — вкусно! 🐟');
  if (addSticker('x_feed')) setTimeout(() => toast('Новая наклейка: 🐟 Друг рыбок!', 'good'), 900);
  G.emit('feed'); save();
  void tx; void ty;
}

// ---------- острова ----------
function landOnIsle() {
  const p = W.p, s = G.state;
  let bi = 0, bd = 1e9;
  ISLES.forEach((is, i) => { const d = dist(p.x / T, p.y / T, is.x, is.y); if (d < bd) { bd = d; bi = i; } });
  s.flags.isles = s.flags.isles || {};
  if (s.flags.isles[bi]) return;
  if (ISLES[bi].treasure) setTimeout(() => F.giveSurprise('Клад с Острова Сокровищ!'), 1600);
  s.flags.isles[bi] = 1;
  const n = Object.keys(s.flags.isles).length;
  if (addSticker('x_island')) toast('Новая наклейка: 🏝️ Необитаемый остров!', 'good');
  toast(`Открыт «${ISLES[bi].name}» — ${n} из ${ISLES.length} 🏝️`, 'good');
  if (n >= ISLES.length && addSticker('x_isles')) setTimeout(() => toast('Новая наклейка: 🧭 Все острова открыты!', 'good'), 1200);
  sfx('magic'); save();
}

// ---------- морские жители: рыбки, акулы и киты ----------
const SEA_DUR = { fish: 0.85, shark: 2.4, whale: 5 };
function initSea() {
  const rng = seeded(777), list = [];
  const spawn = (kind, n) => {
    let guard = 0;
    while (n > 0 && guard++ < 500) {
      const tx = 2 + Math.floor(rng() * (MW - 4)), ty = SEA_Y + 2 + Math.floor(rng() * (MH - SEA_Y - 5));
      let ok = true;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!isDeep(ch(tx + dx, ty + dy))) ok = false;
      if (!ok) continue;
      list.push({ kind, x: (tx + 0.5) * T, y: (ty + 0.5) * T, a: rng() * TAU, turn: rng() * 3, timer: 1 + rng() * 8, up: 0, v: Math.floor(rng() * 3) });
      n--;
    }
  };
  spawn('fish', 22); spawn('shark', 6); spawn('whale', 6);
  W.sea = list;
}
function updateSea(dt) {
  const p = W.p;
  for (const c of W.sea) {
    c.turn -= dt;
    if (c.turn <= 0) { c.a += rnd(-0.9, 0.9); c.turn = rnd(2, 5); }
    if (c.feed && W.crumbs && G.time < c.feed) { // плывём к угощению и чаще выпрыгиваем
      const dd = dist(c.x, c.y, W.crumbs.x, W.crumbs.y);
      c.a = dd > 34 ? Math.atan2(W.crumbs.y - c.y, W.crumbs.x - c.x) : c.a + dt * 2.5;
      if (dd > 34) { c.x += Math.cos(c.a) * 60 * dt; c.y += Math.sin(c.a) * 60 * dt; }
      c.timer -= dt * 2.5;
    }
    const sp = { fish: 42, shark: 58, whale: 24 }[c.kind] * (c.up > 0 && c.kind !== 'fish' ? 0.25 : 1);
    const cs = Math.cos(c.a), sn = Math.sin(c.a);
    const ax = c.x + cs * 90, ay = c.y + sn * 90; // смотрим вперёд: не заплываем на мель и за край
    if (!isDeep(ch(tileOf(ax), tileOf(ay))) || ay > (MH - 3) * T || ay < (SEA_Y + 1) * T) c.a += Math.PI * 0.55 + rnd(0, 0.5);
    else { c.x += cs * sp * dt; c.y += sn * sp * dt; }
    if (c.up > 0) {
      c.up -= dt;
      if (c.kind === 'whale' && dist(c.x, c.y, p.x, p.y) < T * 6.5 && addSticker('x_whale')) { toast('Новая наклейка: 🐋 Встреча с китом!', 'good'); save(); }
      if (c.kind === 'shark' && dist(c.x, c.y, p.x, p.y) < T * 3 && !G.state.dayFlags.shark) { G.state.dayFlags.shark = 1; toast('Акула улыбнулась тебе и поплыла дальше 🦈'); }
      continue;
    }
    c.timer -= dt;
    if (c.timer <= 0) {
      c.up = SEA_DUR[c.kind]; c.dir = cs >= 0 ? 1 : -1;
      c.timer = c.kind === 'fish' ? rnd(2.5, 7) : c.kind === 'shark' ? rnd(8, 15) : rnd(10, 18);
      if (dist(c.x, c.y, p.x, p.y) < T * 7 && G.scene === api) sfx(c.kind === 'whale' ? 'spout' : 'paddle');
    }
  }
}
function drawSeaCreature(ctx, c, t) {
  const x = c.x, y = c.y, k = c.up > 0 ? 1 - c.up / SEA_DUR[c.kind] : -1, dir = c.dir || (Math.cos(c.a) >= 0 ? 1 : -1);
  const rise = k < 0 ? 0 : Math.sin(Math.min(1, k * (c.kind === 'fish' ? 1 : 1.15)) * Math.PI); // 0 → 1 → 0
  if (c.kind === 'fish') {
    ctx.fillStyle = 'rgba(15,55,120,.28)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + ((i * 23) % 40) - 20 + Math.sin(t * 3 + i) * 3, y + ((i * 17) % 26) - 13, 8, 3.5, c.a, 0, TAU); ctx.fill(); }
    if (k >= 0) {
      const jx = x + dir * (k - 0.5) * 70, jy = y - Math.sin(k * Math.PI) * 50, col = ['#ff922b', '#ffd43b', '#f783ac'][c.v];
      ell(ctx, x - dir * 35, y, 12 * (1 - k) + 4, 4, 'rgba(255,255,255,.7)'); if (k > 0.7) ell(ctx, x + dir * 35, y, 14, 4.5, 'rgba(255,255,255,.7)');
      ctx.save(); ctx.translate(jx, jy); ctx.scale(dir, 1); ctx.rotate(-Math.cos(k * Math.PI) * 0.9);
      poly(ctx, [-9, 0, -18, -7, -18, 7], col, OUT, 1.5); ell(ctx, 0, 0, 12, 7, col, OUT, 1.8); ell(ctx, 6, -2, 1.6, 1.6, OUT); poly(ctx, [-2, -6, 4, -12, 5, -6], col, OUT, 1.2);
      ctx.restore();
    }
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  if (c.kind === 'shark') {
    ell(ctx, 0, 4, 44, 13, 'rgba(15,45,100,.28)');
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-34, -2, -50, 6); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(-32, 10, -46, 14); ctx.stroke();
    if (rise < 0.25) poly(ctx, [-12, 4, 4, -24 + rise * 30, 12, 4], '#748ba0', OUT, 2); // плавник
    if (rise > 0.02) {
      ctx.beginPath(); ctx.rect(-90, -160, 180, 166); ctx.clip();
      ctx.scale(1.4, 1.4);
      const hy = 34 - rise * 66;
      ctx.beginPath(); ctx.moveTo(-26, hy + 60); ctx.quadraticCurveTo(-30, hy + 10, 6, hy - 16); ctx.quadraticCurveTo(30, hy + 6, 28, hy + 60); ctx.closePath();
      ctx.fillStyle = '#748ba0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, hy + 60); ctx.quadraticCurveTo(2, hy + 14, 20, hy + 8); ctx.quadraticCurveTo(28, hy + 20, 28, hy + 60); ctx.closePath(); ctx.fillStyle = '#f1f3f5'; ctx.fill();
      ell(ctx, 2, hy + 4, 3.2, 3.6, '#1d1b1b'); ell(ctx, 1, hy + 3, 1.1, 1.1, '#fff');
      ctx.beginPath(); ctx.arc(14, hy + 16, 10, 0.1 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 3; i++) poly(ctx, [8 + i * 5, hy + 24 - i, 10.5 + i * 5, hy + 29 - i * 1.5, 13 + i * 5, hy + 23.5 - i * 1.6], '#fff', OUT, 1);
      ctx.scale(1 / 1.4, 1 / 1.4); ell(ctx, 0, 6, 44, 7, 'rgba(255,255,255,.8)');
    }
  } else {
    ell(ctx, 0, 6, 92, 30, 'rgba(15,45,100,.26)');
    if (rise > 0.02) {
      ctx.save(); ctx.beginPath(); ctx.rect(-140, -160, 280, 168); ctx.clip();
      const by = 50 - rise * 74;
      ctx.beginPath(); ctx.ellipse(0, by + 26, 90, 54, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#34558f'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-6, by + 22, 62, 38, 0, Math.PI * 1.15, Math.PI * 1.75); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 5; ctx.stroke();
      ell(ctx, 58, by + 6, 4, 4.6, '#1d1b1b'); ell(ctx, 57, by + 5, 1.4, 1.4, '#fff');
      ctx.beginPath(); ctx.arc(68, by + 8, 13, 0.25 * Math.PI, 0.8 * Math.PI); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      if (k > 0.6) { const ty2 = by + 6 - (k - 0.6) * 60; poly(ctx, [-70, ty2 + 30, -84, ty2 - 6, -104, ty2 - 16, -92, ty2 + 2, -112, ty2 + 8, -90, ty2 + 14, -80, ty2 + 34], '#4c6ea8', OUT, 2); }
      ctx.restore();
      if (k > 0.1 && k < 0.6) { // фонтан
        const top = 50 - rise * 74 - 28;
        for (let i = 0; i < 9; i++) { const ph = (t * 1.6 + i / 9) % 1, sx = (i % 2 ? 1 : -1) * ph * (10 + (i % 3) * 7); ell(ctx, 14 + sx, top - ph * 70 + ph * ph * 46, 5 - ph * 2.4, 6 - ph * 2.4, 'rgba(255,255,255,.95)'); }
      }
      ell(ctx, 0, 9, 96, 8, 'rgba(255,255,255,.7)');
    }
  }
  ctx.restore();
}

// ---------- погода ----------
function initWeather() {
  W.weather = [];
  const kind = G.state.weather;
  if (kind === 'sun') return;
  const n = kind === 'rain' ? 70 : kind === 'snow' ? 60 : 22;
  for (let i = 0; i < n; i++) W.weather.push({ x: Math.random(), y: Math.random(), s: rnd(0.6, 1.3), ph: rnd(0, 6) });
  W.weatherKind = kind;
}
function updateWeather(dt) {
  if (W.weatherKind !== G.state.weather) initWeather();
  const k = G.state.weather, v = k === 'rain' ? 1.4 : k === 'snow' ? 0.16 : 0.1;
  for (const q of W.weather) { q.y += v * q.s * dt; q.x += (k === 'rain' ? -0.15 : Math.sin(G.time + q.ph) * 0.03) * dt; if (q.y > 1.05) { q.y = -0.05; q.x = Math.random(); } if (q.x < -0.05) q.x = 1.05; }
}
function drawWeather(ctx, w, h) {
  const k = G.state.weather;
  for (const q of W.weather) {
    const x = q.x * w, y = q.y * h;
    if (k === 'rain') line(ctx, x, y, x - 4, y + 14 * q.s, 'rgba(120,170,255,.7)', 2);
    else if (k === 'snow') ell(ctx, x, y, 3 * q.s, 3 * q.s, 'rgba(255,255,255,.95)');
    else ell(ctx, x, y, 6 * q.s, 3.5 * q.s, k === 'petals' ? 'rgba(255,170,200,.9)' : ['#f08c00', '#e8590c', '#ffd43b'][Math.floor(q.ph) % 3], null, 1, G.time * 2 + q.ph);
  }
}

// ---------- рисование земли ----------
const PAL = {
  winter: { g1: '#f6fbff', g2: '#eaf4fb', r1: '#e8e6e0', r2: '#dcd9d2', s: '#f3ead2', leaf: '#ffffff' },
  spring: { g1: '#a8e67a', g2: '#9be06c', r1: '#f0e0c0', r2: '#e6d4b0', s: '#ffe9a8', leaf: '#63c94d' },
  summer: { g1: '#86db5c', g2: '#7ad24f', r1: '#f0e0c0', r2: '#e6d4b0', s: '#ffe9a8', leaf: '#2f9e44' },
  autumn: { g1: '#cdd36a', g2: '#c2c85c', r1: '#ecd9b8', r2: '#e0cca6', s: '#f7dfa0', leaf: '#f08c00' },
};
function hash(x, y) { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >> 13)) * 1274126177) >>> 0; return (h & 0xffff) / 0xffff; }

// чем дальше от берега, тем темнее вода
const DEEP = {};
function deepCol(ty, sea) {
  const k = sea + ty;
  if (!DEEP[k]) DEEP[k] = mix(sea === 'winter' ? '#5aa9cf' : '#3fb0ea', sea === 'winter' ? '#2f6f9c' : '#1c6fc4', clamp((ty - SEA_Y) / 14, 0, 1));
  return DEEP[k];
}
function drawTile(ctx, c, tx, ty, t, pal, sea) {
  const x = tx * T, y = ty * T, alt = (tx + ty) % 2;
  switch (c) {
    case 'g': {
      ctx.fillStyle = alt ? pal.g1 : pal.g2; ctx.fillRect(x, y, T + 1, T + 1);
      const hsh = hash(tx, ty);
      if (hsh < 0.3) { ctx.fillStyle = sea === 'winter' ? 'rgba(180,210,235,.5)' : 'rgba(0,0,0,.06)'; ctx.fillRect(x + hsh * 90, y + 12 + hsh * 60, 9, 3); ctx.fillRect(x + 30 - hsh * 40, y + 34, 7, 3); }
      break;
    }
    case 'r':
      ctx.fillStyle = alt ? pal.r1 : pal.r2; ctx.fillRect(x, y, T + 1, T + 1);
      ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
      break;
    case 'y':
      ctx.fillStyle = sea === 'winter' ? '#e4e0d8' : '#ead9b5'; ctx.fillRect(x, y, T + 1, T + 1);
      ell(ctx, x + 13, y + 14, 9, 7, 'rgba(0,0,0,.07)'); ell(ctx, x + 34, y + 30, 10, 8, 'rgba(0,0,0,.07)'); ell(ctx, x + 12, y + 37, 6, 5, 'rgba(0,0,0,.06)');
      break;
    case 'p':
      ctx.fillStyle = alt ? '#f8f9fa' : '#e9f2f7'; ctx.fillRect(x, y, T + 1, T + 1);
      break;
    case 's':
      ctx.fillStyle = pal.s; ctx.fillRect(x, y, T + 1, T + 1);
      if (hash(tx, ty) < 0.5) { ctx.fillStyle = 'rgba(190,140,60,.25)'; ctx.fillRect(x + hash(ty, tx) * 40, y + hash(tx + 3, ty) * 40, 3, 3); ctx.fillRect(x + hash(ty + 5, tx) * 40, y + hash(tx, ty + 9) * 40, 3, 3); }
      break;
    case 'I':
      ctx.fillStyle = alt ? '#f4fbff' : '#e6f4fd'; ctx.fillRect(x, y, T + 1, T + 1);
      if (hash(tx, ty) < 0.4) { line(ctx, x + 10, y + 14, x + 24, y + 20, 'rgba(160,205,235,.8)', 2); line(ctx, x + 28, y + 34, x + 40, y + 30, 'rgba(160,205,235,.8)', 2); }
      break;
    case 'h': case 'w': case 'O': {
      ctx.fillStyle = c === 'h' ? (sea === 'winter' ? '#9fd8ee' : '#7fdcf7') : deepCol(ty, sea); ctx.fillRect(x, y, T + 1, T + 1);
      const ph = t * 1.2 + tx * 0.9 + ty * 1.7;
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); const wx = x + 8 + Math.sin(ph) * 6, wy = y + 16 + (hash(tx, ty) * 20);
      ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 8, wy - 5, wx + 16, wy); ctx.quadraticCurveTo(wx + 24, wy + 5, wx + 30, wy); ctx.stroke();
      if (c === 'h' && ty === 42) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x, y + Math.sin(t * 1.5 + tx) * 3 - 1, T + 1, 5); }
      break;
    }
    case 'o': {
      ctx.fillStyle = alt ? '#62cdf7' : '#58c6f2'; ctx.fillRect(x, y, T + 1, T + 1);
      const ph = t * 1.6 + tx * 1.3 + ty * 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + 6 + Math.sin(ph) * 4, y + 14); ctx.quadraticCurveTo(x + 20, y + 8 + Math.cos(ph) * 4, x + 38 + Math.sin(ph) * 4, y + 16);
      ctx.moveTo(x + 10 - Math.sin(ph) * 4, y + 36); ctx.quadraticCurveTo(x + 26, y + 30 + Math.sin(ph) * 4, x + 42, y + 38); ctx.stroke();
      break;
    }
    case 'd':
      if (sea === 'winter') { ctx.fillStyle = alt ? '#d9f1ff' : '#cdeafc'; ctx.fillRect(x, y, T + 1, T + 1); line(ctx, x + 8, y + 12, x + 26, y + 20, 'rgba(255,255,255,.9)', 2); line(ctx, x + 22, y + 34, x + 40, y + 30, 'rgba(255,255,255,.9)', 2); }
      else { ctx.fillStyle = '#5db6dc'; ctx.fillRect(x, y, T + 1, T + 1); if (hash(tx, ty) < 0.35) { ell(ctx, x + 24, y + 24, 11, 8, '#51cf66', '#2f9e44', 1.5); if (hash(ty, tx) < 0.5) ell(ctx, x + 26, y + 22, 4, 4, '#ff8fab'); } }
      break;
    case 'i':
      ctx.fillStyle = '#c98b5a'; ctx.fillRect(x, y, T + 1, T + 1);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x, y + 15, T, 2); ctx.fillRect(x, y + 31, T, 2); ctx.fillRect(x, y + 47, T, 2);
      break;
    case 'b': drawBed(ctx, tx, ty, x, y, sea); break;
    default: break;
  }
}
function drawBed(ctx, tx, ty, x, y, sea) {
  ctx.fillStyle = sea === 'winter' ? '#f6fbff' : '#a8e67a'; ctx.fillRect(x, y, T + 1, T + 1);
  fillRR(ctx, x + 3, y + 5, T - 6, T - 9, 8, '#8d5a3a', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 8, y + 17, T - 16, 3); ctx.fillRect(x + 8, y + 29, T - 16, 3);
  const i = (ty === 8 ? 0 : 4) + (tx - 17), bed = G.state.garden[i];
  if (bed && bed.seed) {
    const sd = SEED_BY_ID[bed.seed], ripe = sd && bed.age >= sd.days, k = sd ? Math.min(1, bed.age / sd.days) : 0;
    if (ripe) { emoji(ctx, ING_BY_ID[sd.crop].e, x + T / 2, y + T / 2 - 4 + Math.sin(G.time * 3 + i) * 2, 28); }
    else {
      const hgt = 8 + k * 14;
      line(ctx, x + T / 2, y + 30, x + T / 2, y + 30 - hgt, '#2f9e44', 3);
      ell(ctx, x + T / 2 - 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, -0.5); ell(ctx, x + T / 2 + 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, 0.5);
    }
  }
  if (sea === 'winter') { ctx.beginPath(); ctx.ellipse(x + T / 2, y + T - 6, T / 2 - 4, T - 14, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = 'rgba(210,240,255,.4)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke(); }
}

// ---------- рисование предметов ----------
function leafCol(sea, v) {
  if (sea === 'winter') return '#eef7fd';
  if (sea === 'autumn') return ['#f08c00', '#e8590c', '#fcc419'][v % 3];
  if (sea === 'spring') return ['#8ce99a', '#69db7c', '#ffc9de'][v % 3];
  return ['#40c057', '#2f9e44', '#51cf66'][v % 3];
}
function drawObj(ctx, o, t, sea) {
  let x = o.x; const y = o.y, v = o.v || 0;
  switch (o.type) {
    case 'tree': {
      ell(ctx, x, y + 14, 20, 7, 'rgba(0,0,0,.14)');
      fillRR(ctx, x - 6, y - 24, 12, 40, 4, '#a8703f', OUT, 2);
      const c = leafCol(sea, v);
      if (sea === 'winter') { line(ctx, x, y - 20, x - 16, y - 44, '#a8703f', 5); line(ctx, x, y - 22, x + 15, y - 48, '#a8703f', 5); line(ctx, x, y - 24, x, y - 58, '#a8703f', 5); ell(ctx, x - 15, y - 46, 12, 8, '#fff', '#cfe3f0', 1.5); ell(ctx, x + 14, y - 50, 12, 8, '#fff', '#cfe3f0', 1.5); ell(ctx, x, y - 60, 13, 9, '#fff', '#cfe3f0', 1.5); }
      else {
        const sw = Math.sin(t * 1.2 + x) * 1.5;
        ell(ctx, x - 16 + sw, y - 38, 20, 18, c, OUT); ell(ctx, x + 16 + sw, y - 38, 20, 18, c, OUT); ell(ctx, x + sw, y - 56, 24, 22, c, OUT); ell(ctx, x + sw, y - 38, 20, 16, c);
        if (sea === 'spring') for (const [dx, dy] of [[-14, -44], [10, -60], [16, -36], [-2, -48]]) ell(ctx, x + dx + sw, y + dy, 3.5, 3.5, '#fff0f6');
        if (sea === 'summer' && v === 0) for (const [dx, dy] of [[-12, -40], [12, -54], [4, -34]]) ell(ctx, x + dx + sw, y + dy, 4, 4, '#fa5252', OUT, 1);
      }
      break;
    }
    case 'pine': {
      ell(ctx, x, y + 14, 18, 6, 'rgba(0,0,0,.14)');
      fillRR(ctx, x - 5, y - 4, 10, 20, 3, '#8d5524', OUT, 2);
      for (let i = 0; i < 3; i++) { const w2 = 26 - i * 6, yy = y - 6 - i * 20; poly(ctx, [x - w2, yy, x, yy - 32, x + w2, yy], sea === 'autumn' ? '#2b8a3e' : '#2f9e44', OUT); if (sea === 'winter') poly(ctx, [x - w2 * 0.5, yy - 14, x, yy - 32, x + w2 * 0.5, yy - 14, x + w2 * 0.2, yy - 18, x, yy - 13, x - w2 * 0.25, yy - 18], '#fff'); }
      break;
    }
    case 'palm': {
      ell(ctx, x, y + 14, 18, 6, 'rgba(0,0,0,.14)');
      ctx.beginPath(); ctx.moveTo(x - 6, y + 14); ctx.quadraticCurveTo(x - 10, y - 30, x + 2, y - 62); ctx.lineTo(x + 10, y - 60); ctx.quadraticCurveTo(x + 2, y - 28, x + 7, y + 14); ctx.closePath();
      ctx.fillStyle = '#c98b5a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 4; i++) line(ctx, x - 6 + i, y + 2 - i * 14, x + 5 + i, y - i * 14, 'rgba(0,0,0,.2)', 1.5);
      const sw = Math.sin(t * 1.4 + x * 0.1) * 0.06 + (o.shake > t ? Math.sin(t * 34) * 0.16 : 0), col = sea === 'autumn' ? '#94d82d' : '#40c057';
      for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.02 + i * 0.192) + sw; ctx.save(); ctx.translate(x + 6, y - 62); ctx.rotate(a); ell(ctx, 24, 0, 26, 7.5, i % 2 ? col : shade(col, -0.12), OUT, 1.6); if (sea === 'winter') ell(ctx, 24, -3, 18, 4, '#fff'); ctx.restore(); }
      ell(ctx, x + 2, y - 58, 5, 5, '#8d5524', OUT, 1.2); ell(ctx, x + 10, y - 56, 5, 5, '#8d5524', OUT, 1.2);
      break;
    }
    case 'bush': {
      const c = leafCol(sea, v + 1);
      if (Math.abs(W.p.x - x) < 26 && Math.abs(W.p.y - y) < 26) x += Math.sin(t * 22) * 1.8; // шуршит, когда сквозь него идут
      ell(ctx, x, y + 12, 18, 5, 'rgba(0,0,0,.12)');
      ell(ctx, x - 9, y + 2, 12, 11, c, OUT); ell(ctx, x + 9, y + 2, 12, 11, c, OUT); ell(ctx, x, y - 6, 13, 12, c, OUT); ell(ctx, x, y + 3, 10, 8, c);
      if (sea === 'summer' || sea === 'spring') { ell(ctx, x - 6, y - 4, 2.5, 2.5, v ? '#ff6b9d' : '#fff'); ell(ctx, x + 7, y + 2, 2.5, 2.5, v ? '#ff6b9d' : '#fff'); }
      break;
    }
    case 'flowers': {
      if (sea === 'winter') { if (v === 0) { ell(ctx, x, y + 6, 12, 7, '#fff', '#cfe3f0', 1.5); } break; }
      if (sea === 'autumn') { ell(ctx, x - 6, y + 4, 6, 3.5, '#e8590c', null, 1, 0.5); ell(ctx, x + 7, y - 3, 6, 3.5, '#fcc419', null, 1, -0.4); break; }
      const cols = ['#ff6b9d', '#ffd43b', '#fff', '#b197fc'];
      for (const [dx, dy, k] of [[-9, 4, 0], [7, -4, 1], [2, 10, 2]]) { line(ctx, x + dx, y + dy, x + dx, y + dy + 7, '#2f9e44', 2); for (let i = 0; i < 5; i++) ell(ctx, x + dx + Math.cos((i * TAU) / 5) * 3.5, y + dy + Math.sin((i * TAU) / 5) * 3.5, 2.6, 2.6, cols[(v + k) % 4]); ell(ctx, x + dx, y + dy, 1.8, 1.8, '#ffa94d'); }
      break;
    }
    case 'fenceH': case 'fenceV': {
      const c = '#fff', s = '#cdbfae';
      if (o.type === 'fenceH') { fillRR(ctx, x - T / 2, y - 6, T, 6, 2, c, s, 1.5); for (const dx of [-16, 0, 16]) { fillRR(ctx, x + dx - 4, y - 20, 8, 28, 3, c, s, 1.5); } }
      else { fillRR(ctx, x - 3, y - T / 2 - 14, 6, T, 2, c, s, 1.5); fillRR(ctx, x - 5, y - 22, 10, 30, 3, c, s, 1.5); }
      break;
    }
    case 'mailbox': {
      const m = G.state.mail, has = m && !m.read;
      ell(ctx, x, y + 14, 14, 5, 'rgba(0,0,0,.14)');
      fillRR(ctx, x - 4, y - 14, 8, 30, 2, '#8d5524', OUT, 2);
      fillRR(ctx, x - 20, y - 40, 40, 28, 12, '#fa5252', OUT, 2.5);
      fillRR(ctx, x - 12, y - 30, 24, 4, 2, '#7a1f1f');
      if (has) { line(ctx, x + 20, y - 28, x + 20, y - 52, OUT, 3); poly(ctx, [x + 20, y - 52, x + 34, y - 47, x + 20, y - 42], '#ffd43b', OUT, 1.5); emoji(ctx, '✉️', x, y - 64 + Math.sin(t * 5) * 5, 26); }
      break;
    }
    case 'icehole':
      if (sea !== 'winter') break;
      ell(ctx, x, y, 15, 10, '#3fa9e6', '#fff', 3); line(ctx, x + 18, y + 6, x + 30, y - 22, '#8d5524', 3); line(ctx, x + 30, y - 22, x + 4, y - 2, '#868e96', 1);
      break;
    case 'buoy': {
      const by = y + Math.sin(t * 2 + o.tx) * 4;
      ell(ctx, x, by + 8, 16, 5, 'rgba(255,255,255,.5)');
      ell(ctx, x, by, 13, 13, '#fa5252', OUT, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 12, by - 3, 24, 6);
      line(ctx, x, by - 13, x, by - 24, OUT, 2.5); ell(ctx, x, by - 26, 3.5, 3.5, '#ffd43b', OUT, 1.5);
      break;
    }
    case 'crab': {
      const cx = x + Math.sin(t * 1.3 + o.tx * 2) * 14, cy = y + 6;
      for (const sx of [-1, 1]) { for (let i = 0; i < 3; i++) line(ctx, cx + sx * 6, cy + 2, cx + sx * (13 + i * 2), cy + 5 + (i - 1) * 4 + Math.sin(t * 12 + i) * 1.5, '#c92a2a', 2); ell(ctx, cx + sx * 12, cy - 7, 4.5, 3.5, '#fa5252', OUT, 1.2); }
      ell(ctx, cx, cy, 10, 7, '#fa5252', OUT, 1.6); ell(ctx, cx - 3.5, cy - 6, 2, 2.5, '#fff', OUT, 1); ell(ctx, cx + 3.5, cy - 6, 2, 2.5, '#fff', OUT, 1);
      break;
    }
    case 'starfish':
      ctx.save(); ctx.translate(x + ((o.tx * 7) % 11) - 5, y + 8); ctx.rotate(o.tx); star(ctx, 0, 0, 10, ['#ff922b', '#f783ac', '#ffd43b'][o.tx % 3], OUT, 1.6); ctx.restore();
      break;
    case 'flag':
      line(ctx, x, y + 12, x, y - 44, OUT, 3); poly(ctx, [x, y - 44, x + 26, y - 37 + Math.sin(t * 4) * 2, x, y - 28], '#fa5252', OUT, 1.8);
      break;
    case 'boat':
      ell(ctx, x, y + 14, 44, 8, 'rgba(0,0,0,.14)');
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
      ctx.beginPath(); ctx.moveTo(-46, -8); ctx.lineTo(46, -8); ctx.quadraticCurveTo(36, 16, 16, 16); ctx.lineTo(-22, 16); ctx.quadraticCurveTo(-40, 14, -46, -8); ctx.closePath();
      ctx.fillStyle = '#a8703f'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      line(ctx, -38, 2, 38, 2, 'rgba(0,0,0,.25)', 2); line(ctx, 0, -8, 0, -58, OUT, 3);
      poly(ctx, [2, -56, 30, -22, 2, -18], '#fff3bf', OUT, 1.8); ell(ctx, -22, 8, 5, 5, '#343a40');
      ctx.restore();
      break;
    case 'penguin': {
      const px = x + Math.sin(t * 1.1 + o.tx * 3) * 16, py = y + 8, wob = Math.sin(t * 7 + o.tx) * 0.12;
      ctx.save(); ctx.translate(px, py); ctx.rotate(wob);
      ell(ctx, -6, 2, 6, 3, '#ff922b', OUT, 1.2); ell(ctx, 6, 2, 6, 3, '#ff922b', OUT, 1.2);
      ell(ctx, 0, -18, 14, 20, '#343a40', OUT, 2); ell(ctx, 0, -14, 9, 14, '#fff');
      ell(ctx, -15, -16, 4, 10, '#343a40', OUT, 1.5, 0.3); ell(ctx, 15, -16, 4, 10, '#343a40', OUT, 1.5, -0.3);
      ell(ctx, -4, -28, 2, 2.4, '#fff'); ell(ctx, 4, -28, 2, 2.4, '#fff'); ell(ctx, -4, -28, 1, 1.2, '#000'); ell(ctx, 4, -28, 1, 1.2, '#000');
      poly(ctx, [-3, -24, 3, -24, 0, -19], '#ff922b', OUT, 1);
      ctx.restore();
      break;
    }
    case 'igloo':
      ell(ctx, x, y + 14, 34, 8, 'rgba(0,0,0,.1)');
      ctx.beginPath(); ctx.ellipse(x, y + 14, 34, 42, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      for (const [ax, ay, bx, by] of [[-30, -2, 30, -2], [-24, -16, 24, -16], [-12, -27, 12, -27], [-12, 14, -12, -2], [12, 14, 12, -2], [0, -2, 0, -16]]) line(ctx, x + ax, y + ay, x + bx, y + by, 'rgba(120,170,210,.7)', 1.6);
      ctx.beginPath(); ctx.ellipse(x, y + 14, 11, 16, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#343a40'; ctx.fill(); ctx.stroke();
      break;
    case 'iceberg': {
      const by = y + Math.sin(t * 1.3 + o.tx) * 4;
      ell(ctx, x, by + 20, 44, 8, 'rgba(255,255,255,.5)');
      poly(ctx, [x - 40, by + 18, x - 24, by - 30, x - 6, by - 12, x + 10, by - 52, x + 30, by - 14, x + 42, by + 18], '#f4fbff', OUT, 2.5);
      poly(ctx, [x + 10, by - 52, x + 30, by - 14, x + 42, by + 18, x + 12, by + 18], '#cfe8f9');
      break;
    }
    case 'lighthouse': {
      const dk = darkness();
      if (dk > 0.3) { const a = t * 0.8; ctx.globalAlpha = 0.28; for (const s2 of [0, Math.PI]) poly(ctx, [x, y - 118, x + Math.cos(a + s2 - 0.16) * 420, y - 118 + Math.sin(a + s2 - 0.16) * 150, x + Math.cos(a + s2 + 0.16) * 420, y - 118 + Math.sin(a + s2 + 0.16) * 150], '#fff3bf'); ctx.globalAlpha = 1; }
      ell(ctx, x, y + 14, 28, 7, 'rgba(0,0,0,.14)');
      poly(ctx, [x - 22, y + 14, x - 14, y - 100, x + 14, y - 100, x + 22, y + 14], '#fff', OUT, 2.5);
      ctx.save(); ctx.beginPath(); ctx.moveTo(x - 22, y + 14); ctx.lineTo(x - 14, y - 100); ctx.lineTo(x + 14, y - 100); ctx.lineTo(x + 22, y + 14); ctx.closePath(); ctx.clip(); ctx.fillStyle = '#fa5252'; ctx.fillRect(x - 30, y - 78, 60, 22); ctx.fillRect(x - 30, y - 34, 60, 22); ctx.restore();
      fillRR(ctx, x - 7, y - 10, 14, 24, 6, '#8d5524', OUT, 2);
      fillRR(ctx, x - 20, y - 108, 40, 10, 3, '#343a40', OUT, 2); fillRR(ctx, x - 13, y - 132, 26, 26, 3, dk > 0.3 ? '#ffe066' : '#d0ebff', OUT, 2);
      poly(ctx, [x - 18, y - 132, x, y - 152, x + 18, y - 132], '#fa5252', OUT, 2);
      break;
    }
    case 'volcano': {
      ell(ctx, x, y + 16, 92, 14, 'rgba(0,0,0,.14)');
      poly(ctx, [x - 96, y + 18, x - 28, y - 104, x + 28, y - 104, x + 96, y + 18], '#8d6e53', OUT, 3);
      poly(ctx, [x - 28, y - 104, x - 12, y - 70, x - 2, y - 92, x + 10, y - 62, x + 28, y - 104], '#ff922b', OUT, 2);
      ell(ctx, x, y - 104, 28, 8, '#ff6b6b', OUT, 2);
      poly(ctx, [x - 60, y - 20, x - 44, y - 46, x - 30, y - 22], 'rgba(0,0,0,.12)'); poly(ctx, [x + 30, y - 4, x + 48, y - 36, x + 62, y - 6], 'rgba(0,0,0,.12)');
      for (let i = 0; i < 4; i++) { const k = (t * 0.25 + i / 4) % 1; ctx.globalAlpha = 0.7 * (1 - k); ell(ctx, x + Math.sin(k * 5 + i) * 14, y - 116 - k * 90, 12 + k * 18, 10 + k * 14, '#dee2e6'); } ctx.globalAlpha = 1;
      break;
    }
    case 'chest':
      ell(ctx, x, y + 12, 18, 5, 'rgba(0,0,0,.14)');
      fillRR(ctx, x - 16, y - 10, 32, 22, 4, '#a8703f', OUT, 2); fillRR(ctx, x - 17, y - 18, 34, 12, 6, '#c98b5a', OUT, 2);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 16, y - 3, 32, 3); fillRR(ctx, x - 4, y - 9, 8, 9, 2, '#ffd43b', OUT, 1.5);
      star(ctx, x + 12, y - 24 + Math.sin(t * 4) * 2, 4, '#fff3bf');
      break;
    case 'fishsign':
      fillRR(ctx, x - 3, y - 20, 6, 30, 2, '#8d5524', OUT, 1.5); fillRR(ctx, x - 20, y - 46, 40, 28, 6, '#fff3bf', OUT, 2); emoji(ctx, '🎣', x, y - 32, 20);
      break;
    case 'fountain': {
      const cx = x + T / 2;
      ell(ctx, cx, y + 8, 50, 30, '#dee2e6', OUT, 2.5); ell(ctx, cx, y + 5, 42, 24, sea === 'winter' ? '#d9f1ff' : '#74c0fc', OUT, 2);
      fillRR(ctx, cx - 8, y - 26, 16, 34, 5, '#dee2e6', OUT, 2); ell(ctx, cx, y - 26, 18, 8, '#dee2e6', OUT, 2);
      if (sea !== 'winter') for (let i = 0; i < 5; i++) { const ph = (t * 0.9 + i / 5) % 1, a = -Math.PI / 2 + (i - 2) * 0.35; ell(ctx, cx + Math.cos(a) * ph * 34, y - 30 + Math.sin(a) * ph * 40 + ph * ph * 44, 3.5, 3.5, 'rgba(255,255,255,.9)'); }
      break;
    }
    case 'bench':
      fillRR(ctx, x - 20, y - 4, 40, 8, 3, '#c98b5a', OUT, 2); fillRR(ctx, x - 20, y - 18, 40, 10, 3, '#d9a066', OUT, 2); line(ctx, x - 15, y + 4, x - 15, y + 12, OUT, 3); line(ctx, x + 15, y + 4, x + 15, y + 12, OUT, 3);
      break;
    case 'lounger':
      fillRR(ctx, x - 12, y - 16, 24, 40, 6, '#fff', OUT, 2); fillRR(ctx, x - 12, y - 16, 24, 14, 6, '#ffd43b', OUT, 2); ctx.fillStyle = '#ff8fab'; ctx.fillRect(x - 10, y + 4, 20, 5); ctx.fillRect(x - 10, y + 14, 20, 5);
      break;
    case 'umbrella': {
      if (sea === 'winter' && o.beach) break;
      if (o.beach) fillRR(ctx, x - 26, y + 2, 26, 40, 5, ['#ff8fab', '#74c0fc', '#ffd43b'][o.tx % 3], OUT, 1.5);
      line(ctx, x, y + 14, x, y - 40, OUT, 3);
      const cols = o.beach ? ['#fa5252', '#fff'] : ['#4dabf7', '#fff'];
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.arc(x, y - 30, 32, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6); ctx.closePath(); ctx.fillStyle = cols[i % 2]; ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, y - 30, 32, Math.PI, 0); ctx.closePath(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      break;
    }
    default: break;
  }
}

function label(ctx, text, cx, cy, maxW, size, bg, fg = OUT) {
  ctx.font = `900 ${size}px ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif`;
  let tw = ctx.measureText(text).width;
  if (tw > maxW - 14) { size *= (maxW - 14) / tw; ctx.font = `900 ${size}px ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif`; tw = maxW - 14; }
  fillRR(ctx, cx - tw / 2 - 8, cy - size * 0.75, tw + 16, size * 1.5, size * 0.5, bg, OUT, 2);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1);
}
function drawBuilding(ctx, b, sea, dark) {
  const X = b.x * T, Y = b.y * T, Wd = b.w * T, H = b.h * T, bot = Y + H, cx = X + Wd / 2;
  const lit = dark > 0.35, win = lit ? '#ffe066' : '#d0ebff', snow = sea === 'winter';
  ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(X + 2, bot - 6, Wd + 6, 12);
  if (b.kind === 'house') {
    fillRR(ctx, X + 8, Y + H * 0.42, Wd - 16, H * 0.58, 4, b.wall, OUT, 2.5);
    fillRR(ctx, X + Wd * 0.68, Y - 6, 18, 40, 3, '#adb5bd', OUT, 2);
    poly(ctx, [X - 6, Y + H * 0.48, cx, Y - 20, X + Wd + 6, Y + H * 0.48], snow ? '#fff' : b.roof, OUT, 2.5);
    if (snow) poly(ctx, [X + 14, Y + H * 0.48 - 8, cx, Y + 8, X + Wd - 14, Y + H * 0.48 - 8, X + Wd + 2, Y + H * 0.48, X - 2, Y + H * 0.48], b.roof);
    fillRR(ctx, cx - 16, bot - 58, 32, 58, 6, shade(b.roof, -0.15), OUT, 2); ell(ctx, cx + 8, bot - 28, 3, 3, '#ffd43b');
    fillRR(ctx, X + 20, Y + H * 0.56, 34, 34, 5, win, OUT, 2); fillRR(ctx, X + Wd - 54, Y + H * 0.56, 34, 34, 5, win, OUT, 2);
    line(ctx, X + 37, Y + H * 0.56, X + 37, Y + H * 0.56 + 34, OUT, 1.5); line(ctx, X + Wd - 37, Y + H * 0.56, X + Wd - 37, Y + H * 0.56 + 34, OUT, 1.5);
    ell(ctx, cx, Y + H * 0.2, 12, 12, win, OUT, 2);
    const n = NPC_BY_ID[b.npc]; label(ctx, n.name.split(' ').pop(), cx, bot - 70, Wd, 13, 'rgba(255,255,255,.92)');
    return;
  }
  if (b.kind === 'tower') {
    const top = bot - b.floors * T * 0.62 - T;
    fillRR(ctx, X + 10, top, Wd - 20, bot - top, 8, b.wall, OUT, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(X + 14, top + 4, 16, bot - top - 8);
    for (let f = 0; f < b.floors; f++) for (let i = 0; i < 4; i++) {
      const wy = top + 20 + f * T * 0.62, wx = X + 24 + i * ((Wd - 48 - 22) / 3);
      const on = lit && hash(b.x + i, f) < 0.7;
      fillRR(ctx, wx, wy, 22, 18, 3, on ? '#ffe066' : lit ? '#3b4a6b' : '#e7f5ff', OUT, 1.5);
    }
    fillRR(ctx, X + 4, top - 10, Wd - 8, 16, 5, snow ? '#fff' : shade(b.wall, -0.2), OUT, 2.5);
    line(ctx, cx, top - 10, cx, top - 44, OUT, 3); ell(ctx, cx, top - 46, 5, 5, Math.sin(G.time * 4) > 0 ? '#fa5252' : '#7a1f1f', OUT, 1.5);
    fillRR(ctx, cx - 26, bot - 54, 52, 54, 6, '#fff', OUT, 2); fillRR(ctx, cx - 20, bot - 48, 18, 48, 3, win, OUT, 1.5); fillRR(ctx, cx + 2, bot - 48, 18, 48, 3, win, OUT, 1.5);
    label(ctx, `${b.icon} ${b.name}`, cx, bot - 74, Wd + 60, 15, '#fff');
    return;
  }
  if (b.kind === 'villa') {
    fillRR(ctx, X + 6, Y + 30, Wd - 12, H - 30, 6, b.wall, OUT, 3);
    poly(ctx, [X - 14, Y + 40, X + 60, Y - 34, X + Wd - 60, Y - 34, X + Wd + 14, Y + 40], snow ? '#fff' : b.roof, OUT, 3);
    if (snow) poly(ctx, [X + 4, Y + 40, X + 70, Y - 12, X + Wd - 70, Y - 12, X + Wd - 4, Y + 40], b.roof);
    poly(ctx, [cx - 76, Y + 40, cx, Y - 10, cx + 76, Y + 40], '#fff', OUT, 2.5); ell(ctx, cx, Y + 20, 13, 13, win, OUT, 2);
    for (const dx of [-70, 70]) { fillRR(ctx, cx + dx - 9, Y + 40, 18, H - 40, 5, '#fff', OUT, 2); }
    for (let r = 0; r < 2; r++) for (const dx of [-190, -130, 130, 190]) { fillRR(ctx, cx + dx - 18, Y + 62 + r * 74, 36, 44, 16, win, OUT, 2); line(ctx, cx + dx, Y + 62 + r * 74, cx + dx, Y + 106 + r * 74, OUT, 1.5); if (r === 0) fillRR(ctx, cx + dx - 24, Y + 104, 48, 8, 3, '#fff', OUT, 1.5); }
    fillRR(ctx, cx - 48, Y + 96, 96, 10, 4, '#fff', OUT, 2); for (let i = -2; i <= 2; i++) line(ctx, cx + i * 20, Y + 106, cx + i * 20, Y + 124, OUT, 2);
    fillRR(ctx, cx - 44, Y + 56, 88, 40, 6, win, OUT, 2);
    fillRR(ctx, cx - 30, bot - 84, 60, 84, 26, '#e8590c', OUT, 2.5); line(ctx, cx, bot - 84, cx, bot, OUT, 2); ell(ctx, cx - 7, bot - 38, 3.5, 3.5, '#ffd43b'); ell(ctx, cx + 7, bot - 38, 3.5, 3.5, '#ffd43b');
    return;
  }
  // магазин / ТЦ
  const mall = b.kind === 'mall', roofH = mall ? H * 0.3 : H * 0.34;
  fillRR(ctx, X + 4, Y + roofH - 8, Wd - 8, H - roofH + 8, 5, b.wall, OUT, 2.5);
  fillRR(ctx, X - 2, Y - 10, Wd + 4, roofH + 8, 8, snow ? '#fff' : b.roof, OUT, 2.5);
  if (snow) fillRR(ctx, X + 2, Y + roofH * 0.45, Wd - 4, roofH * 0.55 - 6, 4, b.roof);
  else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(X + 4, Y - 4, Wd - 8, 8); }
  // навес в полоску
  const aw = Y + roofH - 2;
  for (let i = 0; i < b.w * 2; i++) { ctx.fillStyle = i % 2 ? '#fff' : b.roof; ctx.beginPath(); ctx.moveTo(X + 4 + i * ((Wd - 8) / (b.w * 2)), aw); ctx.lineTo(X + 4 + (i + 1) * ((Wd - 8) / (b.w * 2)), aw); ctx.lineTo(X + 4 + (i + 1) * ((Wd - 8) / (b.w * 2)), aw + 14); ctx.arc(X + 4 + (i + 0.5) * ((Wd - 8) / (b.w * 2)), aw + 14, (Wd - 8) / (b.w * 4), 0, Math.PI); ctx.closePath(); ctx.fill(); }
  line(ctx, X + 4, aw, X + Wd - 4, aw, OUT, 2);
  // витрины и дверь
  const wy = aw + 34, wh = bot - wy - 16;
  if (mall) {
    for (const sx of [-1, 1]) { fillRR(ctx, cx + sx * (Wd * 0.3) - Wd * 0.14, wy, Wd * 0.28, wh, 6, win, OUT, 2); line(ctx, cx + sx * (Wd * 0.3), wy, cx + sx * (Wd * 0.3), wy + wh, OUT, 1.5); }
    fillRR(ctx, cx - 34, bot - wh - 22, 68, wh + 22, 8, '#fff', OUT, 2.5); fillRR(ctx, cx - 28, bot - wh - 16, 26, wh + 16, 4, win, OUT, 1.5); fillRR(ctx, cx + 2, bot - wh - 16, 26, wh + 16, 4, win, OUT, 1.5);
  } else {
    fillRR(ctx, X + 14, wy, Wd * 0.36, wh, 6, win, OUT, 2);
    if (b.w >= 5) fillRR(ctx, X + Wd - 14 - Wd * 0.26, wy, Wd * 0.26, wh, 6, win, OUT, 2);
    fillRR(ctx, cx - 14 + (b.w < 5 ? 26 : 0), bot - 62, 34, 62, 7, shade(b.roof, -0.1), OUT, 2);
    fillRR(ctx, cx - 8 + (b.w < 5 ? 26 : 0), bot - 54, 22, 26, 4, win, OUT, 1.5);
  }
  label(ctx, `${b.icon} ${b.name}`, cx, Y + roofH * 0.5 - 2, Wd + 30, mall ? 19 : 15, '#fff');
}

function drawBoat(ctx, x, y, dir, t, look, moving) {
  const bob = Math.sin(t * 2.2 + x * 0.01) * 3;
  ell(ctx, x, y + 16, 62, 12, 'rgba(255,255,255,.4)');
  if (moving) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const k = ((t * 1.6 + i / 3) % 1); ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(x - dir * (50 + k * 46), y + 16, 10 + k * 16, 4 + k * 5, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(dir, 1); // мачта и паруса — позади хомячка
  line(ctx, 2, -8, 2, -104, OUT, 6); line(ctx, 2, -8, 2, -104, '#a8703f', 3);
  const puff = moving ? 6 : 2;
  ctx.beginPath(); ctx.moveTo(6, -100); ctx.quadraticCurveTo(40 + puff, -66, 48, -28); ctx.lineTo(6, -24); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#ff8fab'; ctx.fillRect(0, -74, 60, 12); ctx.fillRect(0, -48, 60, 12); ctx.restore();
  poly(ctx, [-2, -92, -30, -30, -2, -26], '#ffe066', OUT, 2);
  poly(ctx, [2, -104, -16, -98 + Math.sin(t * 6) * 2, 2, -92], '#fa5252', OUT, 1.5);
  ctx.restore();
  if (look) drawHamster(ctx, x - dir * 6, y + 8 + bob, PS, look, { dir, time: t, clipBelow: -26, shadow: false, blink: blinkAt(t), happy: moving });
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(dir, 1); // борт — перед хомячком
  ctx.beginPath(); ctx.moveTo(-54, -12); ctx.lineTo(60, -12); ctx.quadraticCurveTo(52, 16, 28, 20); ctx.lineTo(-34, 20); ctx.quadraticCurveTo(-52, 16, -54, -12); ctx.closePath();
  ctx.fillStyle = '#e8590c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  fillRR(ctx, -57, -17, 120, 9, 4, '#fff3bf', OUT, 2); ell(ctx, 14, 4, 5.5, 5.5, '#74c0fc', OUT, 1.5); ell(ctx, -12, 4, 5.5, 5.5, '#74c0fc', OUT, 1.5);
  ctx.restore();
  ell(ctx, x, y + 22 + bob * 0.3, 52, 5, 'rgba(255,255,255,.75)');
}
function drawChar(ctx, look, ent, t, small, isPlayer) {
  if (isPlayer && ent.boat) { drawBoat(ctx, ent.x, ent.y, ent.dir, t, look, ent.moving); return; }
  const surf = isPlayer ? ent.surf : 'g';
  const water = surf === 'o' || surf === 'h' || surf === 'w';
  const pose = { time: t + (ent.ph || 0), dir: ent.dir, walk: ent.moving ? ent.walkT : null, blink: blinkAt(t, ent.ph || 0) };
  if (water) { pose.clipBelow = surf === 'w' ? -38 : -30; pose.walk = ent.walkT; ell(ctx, ent.x, ent.y - 20, 26, 9, 'rgba(255,255,255,.55)'); }
  if (surf === 'd') pose.walk = null;
  drawHamster(ctx, ent.x, ent.y + (water ? 4 : 10), PS * (small ? 0.8 : 1), look, pose);
  if (water) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(ent.x, ent.y - 19, 24 + Math.sin(t * 4) * 3, 7, 0, 0, Math.PI); ctx.stroke(); }
}

export function draw(ctx) {
  const { w, h } = G.view, t = G.time, z = W.cam.zoom, c = cal(), sea = c.season, pal = PAL[sea], dark = darkness();
  ctx.fillStyle = '#3fb0ea'; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-W.cam.x, -W.cam.y);
  ctx.lineJoin = 'round';
  const x0 = Math.max(0, tileOf(W.cam.x - w / 2 / z)), x1 = Math.min(MW - 1, tileOf(W.cam.x + w / 2 / z));
  const y0 = Math.max(0, tileOf(W.cam.y - h / 2 / z)), y1 = Math.min(MH - 1, tileOf(W.cam.y + h / 2 / z));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) drawTile(ctx, W.ground[ty][tx], tx, ty, t, pal, sea);
  // бортики бассейнов и дорожки
  for (const [px, py, pw, ph] of [[3, 14, 8, 7], [60, 16, 9, 6]]) { rr(ctx, px * T - 3, py * T - 3, pw * T + 6, ph * T + 6, 10); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke(); rr(ctx, px * T - 6, py * T - 6, pw * T + 12, ph * T + 12, 12); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); }
  for (let i = 1; i < 6; i++) { ctx.setLineDash([10, 8]); line(ctx, 60 * T + 6, (16 + i) * T, 69 * T - 6, (16 + i) * T, 'rgba(255,255,255,.85)', 3); ctx.setLineDash([]); }

  // всё, что стоит на земле, — по порядку «дальше → ближе»
  const list = [];
  const mx0 = (x0 - 3) * T, mx1 = (x1 + 4) * T, my0 = (y0 - 2) * T, my1 = (y1 + 12) * T;
  for (const o of W.objs) if (o.x > mx0 && o.x < mx1 && o.y > my0 && o.y < my1) list.push({ y: o.y + (o.type === 'flowers' || o.type === 'lounger' || o.type === 'icehole' ? -40 : 14), o });
  for (const b of BUILDINGS) if ((b.x + b.w) * T > mx0 - 100 && b.x * T < mx1 + 100 && b.y * T < my1 && (b.y + b.h) * T > my0 - 100) list.push({ y: (b.y + b.h) * T, b });
  for (const n of W.npcs) if (!n.hidden && n.x > mx0 && n.x < mx1 && n.y > my0 && n.y < my1) list.push({ y: n.y + 10, n });
  for (const c of W.sea) if (c.x > mx0 && c.x < mx1 && c.y > my0 && c.y < my1) list.push({ y: c.y + 8, c });
  const m = G.state.mail;
  if (m && m.items && !m.done) for (const it of m.items) if (!it.got) list.push({ y: (it.y + 0.5) * T, it });
  list.push({ y: W.p.y + 10, p: true });
  if (!W.p.boat) list.push({ y: boatState().y + 12, boat: true });
  list.sort((a, b2) => a.y - b2.y);
  for (const e of list) {
    if (e.o) drawObj(ctx, e.o, t, sea);
    else if (e.c) drawSeaCreature(ctx, e.c, t);
    else if (e.b) drawBuilding(ctx, e.b, sea, dark);
    else if (e.n) {
      const nd = NPC_BY_ID[e.n.id];
      drawChar(ctx, npcLook(e.n.id), e.n, t, nd.small, false);
      if (dist(e.n.x, e.n.y, W.p.x, W.p.y) < T * 3.2) label(ctx, nd.name, e.n.x, e.n.y - 66 * (nd.small ? 0.82 : 1), 200, 12, 'rgba(255,255,255,.92)');
    } else if (e.it) {
      const ic = (TASK_BY_ID[m.task] || {}).sticker || '⭐', yy = (e.it.y + 0.5) * T + Math.sin(t * 4 + e.it.x) * 4;
      ell(ctx, (e.it.x + 0.5) * T, (e.it.y + 0.5) * T + 12, 12, 4, 'rgba(0,0,0,.15)'); ell(ctx, (e.it.x + 0.5) * T, yy - 4, 20, 20, 'rgba(255,255,255,.45)');
      emoji(ctx, ic, (e.it.x + 0.5) * T, yy - 4, 26);
    } else if (e.boat) { const bt = boatState(); drawBoat(ctx, bt.x, bt.y, 1, t, null, false); }
    else if (e.p) drawChar(ctx, playerLook(), W.p, t, false, true);
  }
  // падающие кокосы и крошки для рыбок
  for (const q of W.drops) { const k = Math.min(1, q.t / 0.45); emoji(ctx, q.e, q.x, q.y + k * k * 62, 22); }
  if (W.crumbs && t < W.crumbs.until) {
    const cr = W.crumbs, a = Math.min(1, (cr.until - t) / 2);
    ctx.globalAlpha = a;
    ell(ctx, cr.x, cr.y, 26 + Math.sin(t * 3) * 3, 9, null, 'rgba(255,255,255,.8)', 2);
    for (let i = 0; i < 7; i++) ell(ctx, cr.x + Math.cos(i * 2.4) * (8 + (i % 3) * 6), cr.y + Math.sin(i * 2.4) * 4 + Math.sin(t * 4 + i) * 1.5, 2.2, 1.8, '#c98b5a');
    ctx.globalAlpha = 1;
  }
  // звёздочка-цель
  const tg = targetPx();
  if (tg) { const by = tg.y - 78 + Math.sin(t * 4) * 6; if (tg.icon === '⭐') { star(ctx, tg.x, by, 15, '#ffd43b', OUT, 2.5); } }
  ctx.restore();

  if (dark > 0) { ctx.fillStyle = `rgba(24,24,72,${dark * 0.42})`; ctx.fillRect(0, 0, w, h); }
  drawWeather(ctx, w, h);
  // стрелка к цели, если она за экраном
  if (tg) {
    const sx = (tg.x - W.cam.x) * z + w / 2, sy = (tg.y - 40 - W.cam.y) * z + h / 2;
    const pad = 56;
    if (sx < pad || sx > w - pad || sy < pad + 50 || sy > h - pad) {
      const ax = clamp(sx, pad, w - pad), ay = clamp(sy, pad + 60, h - pad - 10), a = Math.atan2(sy - ay, sx - ax);
      ctx.save(); ctx.translate(ax, ay);
      ell(ctx, 0, 0, 24, 24, '#fff', OUT, 2.5);
      ctx.rotate(a); poly(ctx, [24, -9, 38, 0, 24, 9], '#ff6b9d', OUT, 2); ctx.rotate(-a);
      emoji(ctx, tg.icon, 0, 0, 24);
      ctx.restore();
    }
  }
}

// ---------- карта города ----------
const MAP_COL = { O: '#1c6fc4', I: '#eef8ff', r: '#eadcc0', y: '#ead9b5', p: '#f1f3f5', h: '#7fdcf7', w: '#3fb0ea', o: '#58c6f2', i: '#c98b5a', b: '#8d5a3a' };
export function drawMiniMap(ctx, k) {
  if (!W.built) build();
  const sea = cal().season, pal = PAL[sea];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = W.ground[y][x];
    ctx.fillStyle = c === 'g' ? pal.g1 : c === 's' ? pal.s : c === 'd' ? (sea === 'winter' ? '#d9f1ff' : '#5db6dc') : MAP_COL[c] || '#000';
    ctx.fillRect(x * k, y * k, k + 0.6, k + 0.6);
  }
  for (const o of W.objs) if (o.type === 'tree' || o.type === 'palm' || o.type === 'pine') ell(ctx, (o.tx + 0.5) * k, (o.ty + 0.5) * k, k * 0.42, k * 0.42, sea === 'winter' ? '#cfe3f0' : sea === 'autumn' ? '#f08c00' : '#40c057');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(1.5 * k, 1.5 * k, 23 * k, 21 * k);
  for (const b of BUILDINGS) {
    fillRR(ctx, b.x * k, b.y * k, b.w * k, b.h * k, k * 0.5, b.wall, OUT, 1.2);
    if (b.kind === 'house') { ctx.fillStyle = b.roof; ctx.fillRect(b.x * k + 1, b.y * k + 1, b.w * k - 2, b.h * k * 0.4); }
    else emoji(ctx, b.kind === 'villa' ? '🏡' : b.icon, (b.x + b.w / 2) * k, (b.y + b.h / 2) * k, Math.max(11, k * 2.3));
  }
  emoji(ctx, '🎣', 51 * k, 46 * k, Math.max(10, k * 2));
  ctx.setLineDash([k, k]); line(ctx, 0, (BUOY_Y + 0.5) * k, MW * k, (BUOY_Y + 0.5) * k, '#fa5252', 1.5); ctx.setLineDash([]);
  { const bt = boatState(); emoji(ctx, '⛵', (bt.x / T) * k, (bt.y / T) * k - k, Math.max(12, k * 2.6)); }
  const tg = targetPx();
  if (tg) star(ctx, (tg.x / T) * k, (tg.y / T) * k, k * 1.3 + 2, '#ffd43b', OUT, 1.5);
  const pr = k * 0.9 + 3 + Math.sin(G.time * 5) * 1.2;
  ell(ctx, (W.p.x / T) * k, (W.p.y / T) * k, pr, pr, '#ff3d7f', '#fff', 2.5);
}
/** Какое здание под точкой карты (в клетках); null — если рядом ничего нет. */
export function mapHit(tx, ty) {
  let best = null, bd = 3.2;
  for (const b of BUILDINGS) { const dx = Math.max(b.x - tx, 0, tx - (b.x + b.w)), dy = Math.max(b.y - ty, 0, ty - (b.y + b.h)), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = b; } }
  return best;
}
/** Отправить хомячка к зданию (или к пирсу / на пляж). */
export function walkToPlace(id) {
  const p = W.p; p.pending = null;
  if (id === 'pier') { if (walkTo(p, 50.5 * T, 46.5 * T, true)) p.pending = { act: 'fish', spot: 'pier' }; return true; }
  if (id === 'beach') return walkTo(p, 40.5 * T, 39.5 * T, true);
  const b = B_BY_ID[id]; if (!b) return false;
  const d = doorPx(b);
  if (!walkTo(p, d.x, d.y, true)) return false;
  p.pending = { b };
  return true;
}
export const playerPos = () => ({ x: W.p.x, y: W.p.y });
/** Нырять можно только там, где глубоко. */
export const canDive = () => W.built && isDeep(ch(tileOf(W.p.x), tileOf(W.p.y)));
/** Где всплыть: ближайшая глубокая клетка к точке (x, y). */
export function surfaceAt(x, y) {
  const tx = clamp(tileOf(x), 0, MW - 1), ty = clamp(tileOf(y), SEA_Y, MH - 2);
  for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (ch(tx + dx, ty + dy) === 'w') return { x: (tx + dx + 0.5) * T, y: (ty + dy + 0.5) * T };
  }
  return { x: W.p.x, y: W.p.y };
}
/** Насколько хорошо слышно море там, где стоит хомячок: 0..1 */
export function seaLevel() { return clamp((W.p.y / T - 29) / 11, 0, 1); }
export function debugSea() { const n = {}; for (const c of W.sea) n[c.kind] = (n[c.kind] || 0) + 1; return n; }
/** Для тестов: перенести ближайшее существо этого вида к хомячку и заставить вынырнуть. */
export function debugSeaShow(kind) { const c = W.sea.find((q) => q.kind === kind); c.x = W.p.x + 110; c.y = W.p.y + 60; c.up = SEA_DUR[kind]; c.dir = 1; c.feed = 0; return debugScreen(c.x, c.y); }
export function debugScreen(wx, wy) { const { w, h } = G.view, z = W.cam.zoom; return { x: (wx - W.cam.x) * z + w / 2, y: (wy - W.cam.y) * z + h / 2 }; }
export function debugNpc(id) { const n = W.npcs.find((q) => q.id === id); return { ...debugScreen(n.x, n.y - 20), tx: Math.floor(n.x / T), ty: Math.floor(n.y / T), hidden: n.hidden }; }
export function debugTeleport(tx, ty) { W.p.x = (tx + 0.5) * T; W.p.y = (ty + 0.5) * T; W.p.path = []; W.cam.x = W.p.x; W.cam.y = W.p.y; }
const api = { enter, leave, storePos, update, draw, pointerDown, pointerMove, pointerUp, interactNearest };
export default api;

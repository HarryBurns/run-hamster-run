// Город, двор виллы и пляж: вид сверху, хомячок ходит сам.
import { clamp, lerp, rnd, pick, seeded, ell, fillRR, line, poly, shade, mix, rr, star, emoji, TAU, dist } from './util.js';
import { drawHamster } from './hamster.js';
import { NPCS, NPC_BY_ID, npcLook, ING_BY_ID, SEED_BY_ID, TASK_BY_ID } from './data.js';
import { G, playerLook, cal, darkness, addSticker, save } from './game.js';
import { toast } from './ui.js';
import { sfx } from './audio.js';
import * as F from './features.js';

export const T = 48, MW = 72, MH = 62;
const SEA_Y = 44; // с этой строки начинается глубокое море
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
const doorPx = (b) => ({ x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + T * 0.45 });

const HANG = { plusha: [30, 5], ponchik: [39, 35], senya: [56, 24], busya: [41, 12], prof: [47, 24], myata: [15, 27], bob: [50, 44], zefirka: [42, 39] };

const W = {
  ground: [], solid: [], objs: [], cam: { x: 0, y: 0, zoom: 1 },
  p: { x: 12.5 * T, y: 7.6 * T, dir: 1, path: [], moving: false, walkT: 0, pending: null, surf: 'g' },
  npcs: [], weather: [], built: false, down: null, sorted: [],
};

// ---------- построение карты ----------
function build() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('g'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = ch; };
  fill(0, 37, 71, 41, 's'); fill(0, 42, 71, 43, 'h'); fill(0, SEA_Y, 71, MH - 1, 'w');
  // островок далеко в море: песок, а вокруг мелководье
  for (let y = 49; y <= 57; y++) for (let x = 15; x <= 29; x++) {
    const d = ((x + 0.5 - 22) / 3.6) ** 2 + ((y + 0.5 - 53) / 2.3) ** 2;
    if (d <= 1) g[y][x] = 's'; else if (d <= 2.1) g[y][x] = 'h';
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
  solid[52][22] = true; add('palm', 22, 52); add('umbrella', 20, 53, { beach: true }); add('chest', 24, 53);
  for (let x = 1; x < MW; x += 5) add('buoy', x, MH - 2);
  for (const [x, y] of [[4, 12], [6, 12], [8, 12]]) add('lounger', x, y);
  add('umbrella', 10, 12); solid[12][10] = true;
  for (const [x, y] of [[38, 15], [48, 15], [28, 14], [31, 14], [57, 14], [63, 14]]) { add('bench', x, y); solid[y][x] = true; }
  for (const [x, y] of [[8, 39], [20, 38], [30, 40], [40, 38], [60, 39], [67, 40]]) add('umbrella', x, y, { beach: true });
  // пальмы вдоль набережной
  for (let x = 2; x < 72; x += 4) { if (x >= 49 && x <= 52) continue; if (g[37][x] === 's') { solid[37][x] = true; add('palm', x, 37); } }
  // деревья, кусты, цветы
  const rng = seeded(20261112);
  const nearDoor = (x, y) => BUILDINGS.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y + b.h && y <= b.y + b.h + 1);
  const isG = (x, y) => g[y] && g[y][x] === 'g' && !solid[y][x];
  for (let y = 0; y < 37; y++) for (let x = 0; x < MW; x++) {
    if (!isG(x, y) || nearDoor(x, y)) continue;
    const yard = x > 1 && x < 24 && y > 1 && y < 22;
    let lonely = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = g[y + dy] && g[y + dy][x + dx]; if (c && c !== 'g') lonely = false; }
    const r = rng();
    if (yard) {
      if (y >= 2 && y <= 7 && x >= 7 && x <= 18) continue; // перед виллой чисто
      if (r < 0.07 && lonely) { solid[y][x] = true; add(rng() < 0.5 ? 'palm' : 'tree', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.16) { solid[y][x] = true; add('bush', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.34) add('flowers', x, y, { v: Math.floor(rng() * 4) });
    } else {
      if (r < 0.2 && lonely) { solid[y][x] = true; add(y >= 27 ? (rng() < 0.75 ? 'palm' : 'tree') : (rng() < 0.3 ? 'pine' : 'tree'), x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.26) { solid[y][x] = true; add('bush', x, y, { v: Math.floor(rng() * 3) }); }
      else if (r < 0.36) add('flowers', x, y, { v: Math.floor(rng() * 4) });
    }
  }
  W.solid = solid; W.objs = objs; W.built = true;
  // жители
  W.npcs = NPCS.map((n) => { const [hx, hy] = HANG[n.id]; return { id: n.id, x: (hx + 0.5) * T, y: (hy + 0.5) * T, dir: 1, path: [], wait: rnd(0, 3), walkT: 0, moving: false, hidden: false }; });
}

function ch(tx, ty) { return W.ground[ty] ? W.ground[ty][tx] : undefined; }
let DRY = false; // true — искать путь только по суше (для жителей)
function walkable(tx, ty) {
  const c = ch(tx, ty);
  if (c === undefined) return false;
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
  if (from === 'villa') { const d = doorPx(B_BY_ID.villa); p.x = d.x; p.y = d.y; }
  else if (s.pos && s.pos.scene === 'world') { p.x = s.pos.x; p.y = s.pos.y; }
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
}
export function interactNearest() {
  const p = W.p; let best = null, bd = T * 1.7;
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
}

// ---------- обновление ----------
function moveAlong(ent, speed, dt) {
  if (!ent.path.length) { ent.moving = false; return false; }
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
  const sp = p.surf === 'w' ? 170 : p.surf === 'o' || p.surf === 'h' ? 140 : p.surf === 'd' ? 270 : 225;
  if (kx || ky) {
    p.path = []; p.pending = null;
    const k = sp * dt / Math.hypot(kx, ky);
    if (canStand(p.x + kx * k, p.y)) p.x += kx * k;
    if (canStand(p.x, p.y + ky * k)) p.y += ky * k;
    if (kx) p.dir = kx;
    p.moving = true; p.walkT += dt * 2.4;
  } else if (moveAlong(p, sp, dt)) arrive();
  // на чём стоим
  const surf = ch(tileOf(p.x), tileOf(p.y));
  // шаги: звук зависит от поверхности
  if (p.moving) {
    p.stepT = (p.stepT || 0) + dt;
    const water = surf === 'o' || surf === 'h' || surf === 'w';
    if (p.stepT > (water ? 0.5 : surf === 'd' ? 0.45 : 0.3)) {
      p.stepT = 0;
      sfx(water ? 'paddle' : surf === 'd' ? 'skate' : surf === 's' ? 'stepSand' : surf === 'i' ? 'stepWood' : surf === 'g' ? (cal().season === 'winter' ? 'stepSnow' : 'step') : 'stepStone');
    }
  } else p.stepT = 0.2;
  if (surf !== p.surf) {
    const wasWater = p.surf === 'o' || p.surf === 'h' || p.surf === 'w';
    if ((surf === 'o' || surf === 'h' || surf === 'w') && !wasWater) { sfx('splash'); G.emit('swim', { where: surf === 'o' ? 'pool' : 'sea' }); }
    if (surf === 's' && tileOf(p.y) > SEA_Y && addSticker('x_island')) { toast('Новая наклейка: 🏝️ Необитаемый остров!', 'good'); save(); }
    if (surf === 'd') G.emit('skate');
    p.surf = surf;
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
    case 'h': case 'w': {
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
    const sd = SEED_BY_ID[bed.seed], ripe = bed.age >= sd.days, k = Math.min(1, bed.age / sd.days);
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
  const x = o.x, y = o.y, v = o.v || 0;
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
      const sw = Math.sin(t * 1.4 + x * 0.1) * 0.06, col = sea === 'autumn' ? '#94d82d' : '#40c057';
      for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.02 + i * 0.192) + sw; ctx.save(); ctx.translate(x + 6, y - 62); ctx.rotate(a); ell(ctx, 24, 0, 26, 7.5, i % 2 ? col : shade(col, -0.12), OUT, 1.6); if (sea === 'winter') ell(ctx, 24, -3, 18, 4, '#fff'); ctx.restore(); }
      ell(ctx, x + 2, y - 58, 5, 5, '#8d5524', OUT, 1.2); ell(ctx, x + 10, y - 56, 5, 5, '#8d5524', OUT, 1.2);
      break;
    }
    case 'bush': {
      const c = leafCol(sea, v + 1);
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

function drawChar(ctx, look, ent, t, small, isPlayer) {
  const surf = isPlayer ? ent.surf : 'g';
  const water = surf === 'o' || surf === 'h' || surf === 'w';
  const pose = { time: t + ent.x * 0.01, dir: ent.dir, walk: ent.moving ? ent.walkT : null, blink: (t + ent.x) % 3.6 > 3.45 };
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
  for (const n of W.npcs) if (!n.hidden) list.push({ y: n.y + 10, n });
  const m = G.state.mail;
  if (m && m.items && !m.done) for (const it of m.items) if (!it.got) list.push({ y: (it.y + 0.5) * T, it });
  list.push({ y: W.p.y + 10, p: true });
  list.sort((a, b2) => a.y - b2.y);
  for (const e of list) {
    if (e.o) drawObj(ctx, e.o, t, sea);
    else if (e.b) drawBuilding(ctx, e.b, sea, dark);
    else if (e.n) {
      const nd = NPC_BY_ID[e.n.id];
      drawChar(ctx, npcLook(e.n.id), e.n, t, nd.small, false);
      if (dist(e.n.x, e.n.y, W.p.x, W.p.y) < T * 3.2) label(ctx, nd.name, e.n.x, e.n.y - 66 * (nd.small ? 0.82 : 1), 200, 12, 'rgba(255,255,255,.92)');
    } else if (e.it) {
      const ic = TASK_BY_ID[m.task].sticker, yy = (e.it.y + 0.5) * T + Math.sin(t * 4 + e.it.x) * 4;
      ell(ctx, (e.it.x + 0.5) * T, (e.it.y + 0.5) * T + 12, 12, 4, 'rgba(0,0,0,.15)'); ell(ctx, (e.it.x + 0.5) * T, yy - 4, 20, 20, 'rgba(255,255,255,.45)');
      emoji(ctx, ic, (e.it.x + 0.5) * T, yy - 4, 26);
    } else if (e.p) drawChar(ctx, playerLook(), W.p, t, false, true);
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
const MAP_COL = { r: '#eadcc0', y: '#ead9b5', p: '#f1f3f5', h: '#7fdcf7', w: '#3fb0ea', o: '#58c6f2', i: '#c98b5a', b: '#8d5a3a' };
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
/** Насколько хорошо слышно море там, где стоит хомячок: 0..1 */
export function seaLevel() { return clamp((W.p.y / T - 29) / 11, 0, 1); }
export function debugScreen(wx, wy) { const { w, h } = G.view, z = W.cam.zoom; return { x: (wx - W.cam.x) * z + w / 2, y: (wy - W.cam.y) * z + h / 2 }; }
export function debugNpc(id) { const n = W.npcs.find((q) => q.id === id); return { ...debugScreen(n.x, n.y - 20), tx: Math.floor(n.x / T), ty: Math.floor(n.y / T), hidden: n.hidden }; }
export function debugTeleport(tx, ty) { W.p.x = (tx + 0.5) * T; W.p.y = (ty + 0.5) * T; W.p.path = []; W.cam.x = W.p.x; W.cam.y = W.p.y; }
const api = { enter, leave, update, draw, pointerDown, pointerMove, pointerUp, interactNearest };
export default api;

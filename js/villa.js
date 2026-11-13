// Вилла внутри: вид «в разрезе», как кукольный домик. 3 этажа + лифт.
import { clamp, lerp, rnd, pick, ell, fillRR, line, poly, shade, mix, rr, heart, TAU, el } from './util.js';
import { drawHamster } from './hamster.js';
import { drawFurn, furnRect } from './props.js';
import { FURN_BY_ID, NPC_BY_ID, npcLook } from './data.js';
import { G, playerLook, cal, darkness, save, addTo } from './game.js';
import { sfx } from './audio.js';
import { toast, furnIcon } from './ui.js';
import * as F from './features.js';

const RH = 250, SLAB = 26, FH = RH + SLAB;   // высота комнаты, толщина перекрытия
const W = 1600, EX = 1660, WTOT = 1720;      // ширина жилой части, центр лифта, полная ширина
const HS = 1.45;                             // масштаб хомячка
const OUT = '#4a3728';
const fy = (f) => -f * FH;

const ROOMS = [
  { id: 'wc', f: 0, x0: 0, x1: 220, name: 'Туалет', wall: '#bfe9ff', floor: 'tile', win: null },
  { id: 'living', f: 0, x0: 220, x1: 920, name: 'Гостиная', wall: '#ffe3b3', floor: 'wood', win: 640 },
  { id: 'kitchen', f: 0, x0: 920, x1: 1600, name: 'Кухня', wall: '#d8f5c8', floor: 'check', win: 1500 },
  { id: 'bed1', f: 1, x0: 0, x1: 520, name: 'Моя спальня', wall: '#ffd6e7', floor: 'wood', win: 330 },
  { id: 'bed2', f: 1, x0: 520, x1: 920, name: 'Спальня', wall: '#cfe8ff', floor: 'wood', win: 800 },
  { id: 'bed3', f: 1, x0: 920, x1: 1320, name: 'Спальня', wall: '#d9f7d0', floor: 'wood', win: 1160 },
  { id: 'bath', f: 1, x0: 1320, x1: 1600, name: 'Ванная', wall: '#c5f0f0', floor: 'tile', win: null },
  { id: 'sauna', f: 2, x0: 0, x1: 320, name: 'Сауна', wall: '#e0a86b', floor: 'wood', win: null },
  { id: 'jacuzzi', f: 2, x0: 320, x1: 740, name: 'Джакузи', wall: '#e5dbff', floor: 'tile', win: 640 },
  { id: 'pool', f: 2, x0: 740, x1: 1600, name: 'Бассейн', wall: '#c5f6fa', floor: 'tile', win: null },
];

// Встроенные предметы: их нельзя переставить, но с ними можно играть.
const BUILT = [
  { id: 'door', f: 0, x: 285, w: 96, h: 176, act: 'exit' },
  { id: 'toilet', f: 0, x: 62, w: 76, h: 100, act: 'toilet' },
  { id: 'sink_wc', f: 0, x: 160, w: 70, h: 110, act: 'wash' },
  { id: 'stove', f: 0, x: 1120, w: 120, h: 110, act: 'cook' },
  { id: 'sink_k', f: 0, x: 1300, w: 110, h: 110, act: 'wash' },
  { id: 'bathtub', f: 1, x: 1490, w: 196, h: 100, act: 'bath' },
  { id: 'sink_b', f: 1, x: 1362, w: 64, h: 110, act: 'wash' },
  { id: 'sauna', f: 2, x: 190, w: 240, h: 170, act: 'sauna' },
  { id: 'jacuzzi', f: 2, x: 520, w: 280, h: 90, act: 'jacuzzi' },
  { id: 'pool', f: 2, x: 1150, w: 770, h: 90, act: 'pool' },
];
const SEAT_H = { sofa: 34, armchair: 34, chair: 50, beanbag: 36, throne: 54 };

const V = {
  cam: { x: 800, y: -300, zoom: 1 },
  p: { x: 270, f: 1, dir: 1, path: [], walkT: 0, state: 'idle', item: null, lift: null, pending: null, happy: 0 },
  guests: [], parts: [], liftY: 0, decor: false, sel: null, drag: null, pan: null, tray: null, stateT: 0,
};

// ---------- вход / выход ----------
export function enter(from) {
  const s = G.state, p = V.p;
  p.path = []; p.state = 'idle'; p.item = null; p.pending = null; p.lift = null;
  if (from === 'world') { p.f = 0; p.x = 290; p.dir = 1; }
  else if (from === 'wake') { const bed = findBed(); if (bed) { p.f = bed.floor; p.x = bed.x + 30; } }
  else { p.f = s.pos.floor || 0; p.x = s.pos.x || 290; }
  V.liftY = fy(p.f);
  syncGuests();
  setDecor(false);
  snapCam();
}
export function leave() { setDecor(false); storePos(); }
export function storePos() { G.state.pos = { scene: 'villa', floor: V.p.f, x: V.p.x }; }
function findBed() {
  const beds = G.state.villa.filter((i) => FURN_BY_ID[i.id] && FURN_BY_ID[i.id].act === 'sleep');
  return beds.find((b) => b.floor === 1 && b.x < 520) || beds[0] || null;
}

export function syncGuests() {
  const ids = G.state.guests;
  V.guests = V.guests.filter((g) => ids.includes(g.id));
  for (const id of ids) {
    if (!V.guests.find((g) => g.id === id)) V.guests.push({ id, x: 300 + V.guests.length * 70, f: 0, tx: rnd(420, 880), wait: 1, dir: 1, walkT: 0, happy: 0 });
  }
}
export function guestHappy(id) { const g = V.guests.find((q) => q.id === id); if (g) { sfx('heart'); g.happy = 2.5; burst(g.x, fy(g.f) - 130, 'heart', 6); } }
export function playerHappy() { V.p.happy = 2; burst(V.p.x, fy(V.p.f) - 130, 'heart', 5); }

// ---------- камера ----------
function layout() {
  const { w, h } = G.view;
  const fit = Math.min(w / (WTOT + 90), h / (3 * FH + 230));
  let z = fit >= 0.66 ? fit : clamp(Math.min(w, h) / 470, 0.62, 1.05);
  if (V.decor && fit < 0.66) z = Math.max(fit, z * 0.72); // в режиме обустройства видно побольше
  V.cam.zoom = z;
}
function clampCam() {
  const { w, h } = G.view, z = V.cam.zoom;
  const vw = w / z, vh = h / z;
  const x0 = -60, x1 = WTOT + 60, y0 = -(3 * FH) - 190, y1 = 90 + (V.decor ? 150 / z : 0);
  V.cam.x = x1 - x0 <= vw ? (x0 + x1) / 2 : clamp(V.cam.x, x0 + vw / 2, x1 - vw / 2);
  V.cam.y = y1 - y0 <= vh ? (y0 + y1) / 2 - 20 : clamp(V.cam.y, y0 + vh / 2, y1 - vh / 2);
}
function camTarget() { return { x: V.p.x, y: (V.p.lift ? V.liftY : fy(V.p.f)) - 110 }; }
function snapCam() { layout(); const t = camTarget(); V.cam.x = t.x; V.cam.y = t.y; clampCam(); }
function toWorld(sx, sy) {
  const { w, h } = G.view, z = V.cam.zoom;
  return { x: V.cam.x + (sx - w / 2) / z, y: V.cam.y + (sy - h / 2) / z };
}

// ---------- частицы ----------
function burst(x, y, kind, n = 6) {
  for (let i = 0; i < n; i++) V.parts.push({ x: x + rnd(-24, 24), y: y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-70, -30), life: rnd(0.8, 1.5), t: 0, kind, r: rnd(4, 9) });
}

// ---------- режим «Обустройство» ----------
export function isDecor() { return V.decor; }
export function setDecor(on) {
  V.decor = on; V.sel = null; V.drag = null;
  if (V.tray) { V.tray.remove(); V.tray = null; }
  if (on) { V.p.path = []; standUp(); buildTray(); }
  G.emit('hud');
}
function buildTray() {
  if (V.tray) V.tray.remove();
  const t = el('div', 'decor-tray');
  const s = G.state;
  const head = el('div', 'tray-head');
  const def = V.sel ? FURN_BY_ID[V.sel.id] : null;
  head.appendChild(el('span', '', def ? `<b>${def.name}</b>` : 'Перетаскивай мебель пальцем. Кладовка:'));
  if (V.sel) {
    const b = el('button', 'btn small blue', '📦 Убрать в кладовку');
    b.onclick = () => { sfx('tap'); stash(V.sel); };
    head.appendChild(b);
  }
  const done = el('button', 'btn small green', '✔ Готово');
  done.onclick = () => { sfx('tap'); setDecor(false); };
  head.appendChild(done);
  t.appendChild(head);
  const list = el('div', 'tray-list');
  const ids = Object.keys(s.storage);
  if (!ids.length) list.appendChild(el('div', 'muted', 'Кладовка пуста. Мебель продаётся в ТЦ «Уютный дом».'));
  for (const id of ids) {
    const d = FURN_BY_ID[id]; if (!d) continue;
    const c = el('button', 'tray-item');
    c.appendChild(furnIcon(d, 58));
    if (s.storage[id] > 1) c.appendChild(el('span', 'cnt', '×' + s.storage[id]));
    c.onclick = () => { sfx('pop'); placeFromStorage(id); };
    list.appendChild(c);
  }
  t.appendChild(list);
  document.body.appendChild(t);
  V.tray = t;
}
function placeFromStorage(id) {
  const d = FURN_BY_ID[id], s = G.state;
  const c = toWorld(G.view.w / 2, G.view.h / 2);
  const f = clamp(Math.floor((-c.y + 40) / FH), 0, 2);
  const it = { uid: s.uid++, id, floor: f, x: clamp(c.x, d.w / 2 + 6, W - d.w / 2 - 6), y: d.wall ? 160 : 0 };
  s.villa.push(it);
  addTo('storage', id, -1);
  V.sel = it;
  G.emit('place', { id });
  buildTray(); save();
}
function stash(it) {
  const s = G.state, d = FURN_BY_ID[it.id];
  if (d.act === 'sleep' && s.villa.filter((i) => FURN_BY_ID[i.id].act === 'sleep').length <= 1) { toast('Последнюю кровать убирать нельзя — где же спать?'); return; }
  s.villa = s.villa.filter((i) => i !== it);
  addTo('storage', it.id, 1);
  V.sel = null; buildTray(); save();
}

// ---------- поиск предметов под пальцем ----------
function itemsSorted() {
  // порядок рисования: коврики → настенные → напольные
  const key = (i) => { const d = FURN_BY_ID[i.id]; return d.layer === 0 ? 0 : d.wall ? 1 : 2; };
  return G.state.villa.filter((i) => FURN_BY_ID[i.id]).slice().sort((a, b) => key(a) - key(b));
}
function hitItem(wx, wy, forDecor) {
  const list = itemsSorted();
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i], d = FURN_BY_ID[it.id];
    if (!forDecor && (d.act === 'none' || !d.act)) continue;
    const r = furnRect(d, it.x, fy(it.floor), it.y);
    const pad = forDecor && d.layer === 0 ? 14 : 4;
    if (wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad) return it;
  }
  return null;
}
function hitBuilt(wx, wy) {
  for (const b of BUILT) {
    const y = fy(b.f);
    if (wx >= b.x - b.w / 2 && wx <= b.x + b.w / 2 && wy >= y - b.h && wy <= y + 6) return b;
  }
  return null;
}
function hitGuest(wx, wy) {
  for (const g of V.guests) { const y = fy(g.f); if (Math.abs(wx - g.x) < 42 && wy > y - 130 && wy < y + 8) return g; }
  return null;
}

// ---------- движение ----------
function standUp() {
  const p = V.p;
  if (p.item && p.state === 'wheel') p.item.on = false;
  p.state = 'idle'; p.item = null;
}
function goTo(x, f, pending) {
  const p = V.p;
  standUp();
  p.pending = pending || null;
  x = clamp(x, 34, f === p.f ? WTOT - 40 : W - 34);
  p.path = [];
  if (f !== p.f) { p.path.push({ t: 'walk', x: EX }, { t: 'lift', f }); }
  p.path.push({ t: 'walk', x });
}
function arrive() {
  const p = V.p, pd = p.pending;
  p.pending = null;
  if (!pd) return;
  if (pd.guest) { F.guestDialog(pd.guest.id); return; }
  if (pd.built) { actBuilt(pd.built); return; }
  if (pd.item) actItem(pd.item);
}
function actItem(it) {
  const d = FURN_BY_ID[it.id], p = V.p, y = fy(it.floor);
  switch (d.act) {
    case 'sleep': F.askSleep(); break;
    case 'wardrobe': sfx('door'); F.openWardrobe(); break;
    case 'fridge': sfx('door'); F.openFridge(); break;
    case 'sit': p.state = 'sit'; p.item = it; p.x = it.x; sfx('pop'); break;
    case 'tv': case 'lamp': case 'music': case 'disco': case 'fire':
      it.on = it.on === undefined ? d.act !== 'fire' : !it.on;
      sfx(d.act === 'tv' && it.on ? 'tvOn' : d.act === 'lamp' ? 'click' : 'tap');
      if (d.act === 'music' && it.on) { sfx('note', 523); setTimeout(() => sfx('note', 659), 150); setTimeout(() => sfx('note', 784), 300); }
      break;
    case 'plant': case 'toy': it.on = true; it.onT = 1.2; sfx('pop'); burst(it.x, y - d.h, 'spark', 4); break;
    case 'piano': {
      const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
      let i = 0; const n = 5;
      const play = () => { sfx('note', pick(notes)); burst(it.x + rnd(-40, 40), y - d.h - 10, 'note', 1); if (++i < n) setTimeout(play, 190); };
      play(); break;
    }
    case 'wheel': p.state = 'wheel'; p.item = it; p.x = it.x; it.on = true; V.stateT = 0; sfx('pop'); break;
    case 'fish': sfx('bubble'); sfx('heart'); burst(it.x, y - d.h + 20, 'bubble', 7); burst(it.x, y - d.h - 6, 'heart', 3); toast('Ты покормила рыбок. Они машут плавниками: «Спасибо!» 🐠'); G.emit('feed'); break;
    case 'book': toast(pick(['Ты прочитала сказку про храброго хомяка 📖', 'Книга рецептов: «100 блюд из семечек» 📖', 'Интересно! Хомяки запасают еду за щеками 📖', 'Стихи про море. Красиво! 📖'])); sfx('ok'); break;
    case 'mirror': toast(pick(['Свет мой, зеркальце… Да, ты красотка! 💖', 'Отличный наряд сегодня!'])); playerHappy(); sfx('magic'); break;
    default: break;
  }
}
function actBuilt(b) {
  const p = V.p, y = fy(b.f);
  switch (b.act) {
    case 'exit': sfx('door'); F.goOutside(); break;
    case 'toilet': sfx('flush'); burst(b.x, y - 90, 'spark', 5); toast('Пш-ш-ш! 🚽'); break;
    case 'wash': sfx('splash'); burst(b.x, y - 100, 'bubble', 6); toast('Лапки чистые! 🫧'); break;
    case 'cook': F.openCooking(); break;
    case 'bath': p.state = 'bath'; p.x = b.x; sfx('splash'); G.emit('spa', { what: 'bath' }); toast('Ванна с пеной! 🛁'); break;
    case 'sauna': p.state = 'sauna'; p.x = b.x + 20; sfx('hiss'); G.emit('spa', { what: 'sauna' }); toast('Ух, жарко! 🧖'); break;
    case 'jacuzzi': p.state = 'jacuzzi'; p.x = b.x; sfx('bubble'); G.emit('spa', { what: 'jacuzzi' }); toast('Буль-буль-буль! 🫧'); break;
    case 'pool': p.state = 'swim'; p.x = clamp(p.x, b.x - b.w / 2 + 60, b.x + b.w / 2 - 60); sfx('splash'); G.emit('homeswim'); break;
    default: break;
  }
}

// ---------- ввод ----------
export function pointerDown(sx, sy) {
  const w = toWorld(sx, sy);
  if (V.decor) {
    const it = hitItem(w.x, w.y, true);
    if (it) {
      V.sel = it; V.drag = { it, dx: w.x - it.x, dy: w.y, y0: it.y, moved: false };
      buildTray();
    } else { V.pan = { sx, sy, cx: V.cam.x, cy: V.cam.y }; if (V.sel) { V.sel = null; buildTray(); } }
    return;
  }
  V.down = { sx, sy };
}
export function pointerMove(sx, sy) {
  if (!V.decor) return;
  const w = toWorld(sx, sy);
  if (V.drag) {
    const it = V.drag.it, d = FURN_BY_ID[it.id];
    V.drag.moved = true;
    it.x = clamp(w.x - V.drag.dx, d.w / 2 + 6, W - d.w / 2 - 6);
    const f = clamp(Math.floor((-w.y + (d.wall ? 0 : 30)) / FH), 0, 2);
    it.floor = f;
    if (d.wall) it.y = clamp(fy(f) - w.y, d.h / 2 + 60, RH - d.h / 2 - 8);
  } else if (V.pan) {
    V.cam.x = V.pan.cx - (sx - V.pan.sx) / V.cam.zoom;
    V.cam.y = V.pan.cy - (sy - V.pan.sy) / V.cam.zoom;
    clampCam();
  }
}
export function pointerUp(sx, sy) {
  if (V.decor) {
    if (V.drag && V.drag.moved) { sfx('pop'); save(); }
    V.drag = null; V.pan = null;
    return;
  }
  if (!V.down) return;
  const moved = Math.hypot(sx - V.down.sx, sy - V.down.sy) > 14;
  V.down = null;
  if (moved) return;
  const w = toWorld(sx, sy);
  if (w.x > W && w.x < WTOT + 20) { // лифт
    const f = clamp(Math.floor(-w.y / FH), 0, 2);
    goTo(EX, f); sfx('tap'); return;
  }
  const f = clamp(Math.floor((-w.y + 12) / FH), 0, 2);
  const g = hitGuest(w.x, w.y);
  if (g) { goTo(g.x + (V.p.x < g.x ? -70 : 70), g.f, { guest: g }); sfx('tap'); return; }
  const it = hitItem(w.x, w.y, false);
  if (it) { goTo(it.x, it.floor, { item: it }); sfx('tap'); return; }
  const b = hitBuilt(w.x, w.y);
  if (b) { goTo(b.x, b.f, { built: b }); sfx('tap'); return; }
  goTo(w.x, f); sfx('step');
}
export function interactNearest() {
  const p = V.p; let best = null, bd = 90;
  for (const it of G.state.villa) { const d = FURN_BY_ID[it.id]; if (!d || d.act === 'none' || it.floor !== p.f) continue; const dd = Math.abs(it.x - p.x); if (dd < bd) { bd = dd; best = { item: it }; } }
  for (const b of BUILT) { if (b.f !== p.f) continue; const dd = Math.abs(b.x - p.x) - (b.w > 300 ? b.w / 2 - 60 : 0); if (dd < bd) { bd = dd; best = { built: b }; } }
  for (const g of V.guests) { if (g.f !== p.f) continue; const dd = Math.abs(g.x - p.x); if (dd < bd + 20) { bd = dd; best = { guest: g }; } }
  if (best) { p.pending = best; p.path = []; arrive(); }
}

// ---------- обновление ----------
export function update(dt) {
  const p = V.p, keys = G.keys;
  V.stateT += dt;
  if (!V.decor) {
    const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    if (kx && !p.lift) {
      if (p.state !== 'idle' && p.state !== 'swim') standUp();
      p.path = []; p.pending = null;
      p.x = clamp(p.x + kx * 320 * dt, 34, WTOT - 40); p.dir = kx; p.walkT += dt * 2.6; p.moving = true;
    } else if (!p.path.length) p.moving = false;
    if ((keys.has('ArrowUp') || keys.has('KeyW')) && !p.path.length && !p.lift && p.f < 2) goTo(p.x > W ? EX : p.x, p.f + 1);
    if ((keys.has('ArrowDown') || keys.has('KeyS')) && !p.path.length && !p.lift && p.f > 0) goTo(p.x > W ? EX : p.x, p.f - 1);
  }
  // путь
  if (p.path.length) {
    const st = p.path[0];
    if (st.t === 'walk') {
      const dx = st.x - p.x, step = 340 * dt;
      p.moving = true; p.walkT += dt * 2.6;
      if (Math.abs(dx) <= step) { p.x = st.x; p.path.shift(); if (!p.path.length) { p.moving = false; arrive(); } }
      else { p.x += Math.sign(dx) * step; p.dir = Math.sign(dx); }
    } else if (st.t === 'lift') {
      p.moving = false;
      if (!p.lift) { p.lift = { to: st.f }; sfx('door'); sfx('lift'); }
      const ty = fy(st.f), dy = ty - V.liftY, step = 460 * dt;
      if (Math.abs(dy) <= step) { V.liftY = ty; p.f = st.f; p.lift = null; p.path.shift(); sfx('ding'); }
      else V.liftY += Math.sign(dy) * step;
    }
  } else if (!p.lift) V.liftY = lerp(V.liftY, fy(p.f), Math.min(1, dt * 8));
  if (p.happy > 0) p.happy -= dt;
  // звуки шагов и колеса
  p.stepT = (p.stepT || 0) + dt;
  if (p.state === 'wheel') { if (p.stepT > 0.22) { p.stepT = 0; sfx('wheel'); } }
  else if (p.moving && !p.lift && p.stepT > 0.3) { p.stepT = 0; sfx(p.state === 'swim' ? 'paddle' : 'stepWood'); }
  if (p.state === 'wheel') { p.walkT += dt * 4; if (V.stateT > 2.5 && !p.wheelDone) { p.wheelDone = true; G.emit('wheel'); } } else p.wheelDone = false;
  if (p.state === 'swim') {
    const b = BUILT.find((q) => q.id === 'pool');
    p.swimDir = p.swimDir || 1;
    if (!p.moving) { p.x += p.swimDir * 70 * dt; p.dir = p.swimDir; }
    if (p.x > b.x + b.w / 2 - 60) p.swimDir = -1; if (p.x < b.x - b.w / 2 + 60) p.swimDir = 1;
    if (p.x < b.x - b.w / 2 + 20 || p.x > b.x + b.w / 2 - 20) p.state = 'idle';
    if (Math.random() < dt * 3) V.parts.push({ x: p.x + rnd(-30, 30), y: fy(2) - 62, vx: rnd(-20, 20), vy: rnd(-50, -20), life: 0.6, t: 0, kind: 'bubble', r: rnd(3, 6) });
  }
  if (p.state === 'bath' || p.state === 'jacuzzi') { if (Math.random() < dt * 5) V.parts.push({ x: p.x + rnd(-70, 70), y: fy(p.f) - 70, vx: rnd(-10, 10), vy: rnd(-45, -20), life: 1.2, t: 0, kind: 'bubble', r: rnd(4, 10) }); }
  if (p.state === 'sauna') { if (Math.random() < dt * 4) V.parts.push({ x: rnd(40, 300), y: fy(2) - rnd(40, 120), vx: rnd(-8, 8), vy: rnd(-40, -20), life: 1.8, t: 0, kind: 'steam', r: rnd(14, 26) }); }
  // джакузи бурлит всегда
  if (Math.random() < dt * 2) V.parts.push({ x: 520 + rnd(-110, 110), y: fy(2) - 66, vx: 0, vy: rnd(-30, -12), life: 0.8, t: 0, kind: 'bubble', r: rnd(3, 6) });

  // предметы с таймером
  for (const it of G.state.villa) if (it.onT) { it.onT -= dt; if (it.onT <= 0) { it.onT = 0; it.on = false; } }
  // гости бродят по первому этажу
  for (const g of V.guests) {
    if (g.happy > 0) g.happy -= dt;
    if (g.wait > 0) { g.wait -= dt; continue; }
    const dx = g.tx - g.x, step = 120 * dt;
    if (Math.abs(dx) <= step) { g.x = g.tx; g.wait = rnd(2, 6); g.tx = rnd(250, 1540); g.moving = false; }
    else { g.x += Math.sign(dx) * step; g.dir = Math.sign(dx); g.walkT += dt * 2; g.moving = true; }
  }
  // частицы
  for (const q of V.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  V.parts = V.parts.filter((q) => q.t < q.life);
  // камера
  layout();
  if (!V.decor) { const t = camTarget(); V.cam.x = lerp(V.cam.x, t.x, Math.min(1, dt * 5)); V.cam.y = lerp(V.cam.y, t.y, Math.min(1, dt * 5)); }
  clampCam();
}

// ---------- рисование ----------
function drawSky(ctx, w, h) {
  const d = darkness(), c = cal();
  const top = mix({ winter: '#a9d6f5', spring: '#8fd3ff', summer: '#6cc5ff', autumn: '#b5cfe0' }[c.season], '#1b1b4a', d * 0.92);
  const bot = mix({ winter: '#e9f4fb', spring: '#dff3ff', summer: '#c9ecff', autumn: '#f6e3c5' }[c.season], '#3b2f6b', d * 0.9);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (d > 0.5) { ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const x = (i * 197) % w, y = (i * 113) % (h * 0.6); ctx.globalAlpha = (d - 0.5) * 2 * (0.4 + ((i * 37) % 10) / 16); ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1; }
}
function wallpaper(ctx, r, y) {
  ctx.fillStyle = r.wall; ctx.fillRect(r.x0, y - RH, r.x1 - r.x0, RH);
  if (r.id === 'sauna') {
    ctx.strokeStyle = 'rgba(120,70,20,.3)'; ctx.lineWidth = 2;
    for (let yy = y - RH + 25; yy < y; yy += 25) line(ctx, r.x0, yy, r.x1, yy, 'rgba(120,70,20,.3)', 2);
  } else if (r.floor === 'tile') {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    for (let xx = r.x0 + 40; xx < r.x1; xx += 40) line(ctx, xx, y - RH, xx, y, 'rgba(255,255,255,.55)', 2);
    for (let yy = y - RH + 40; yy < y; yy += 40) line(ctx, r.x0, yy, r.x1, yy, 'rgba(255,255,255,.55)', 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let xx = r.x0 + 20; xx < r.x1 - 10; xx += 44) ctx.fillRect(xx, y - RH, 14, RH - 34);
    ctx.fillStyle = shade(r.wall, -0.12); ctx.fillRect(r.x0, y - 34, r.x1 - r.x0, 34);
    ctx.fillStyle = '#fff'; ctx.fillRect(r.x0, y - 38, r.x1 - r.x0, 5);
  }
}
function windowAt(ctx, x, y) {
  const d = darkness(), c = cal();
  const sky = mix({ winter: '#cfe9fb', spring: '#bfe6ff', summer: '#9bdcff', autumn: '#e3d6bd' }[c.season], '#232355', d * 0.9);
  fillRR(ctx, x - 52, y - 208, 104, 104, 10, '#fff', OUT);
  fillRR(ctx, x - 44, y - 200, 88, 88, 6, sky, null);
  if (d > 0.6) { ell(ctx, x + 18, y - 176, 11, 11, '#fff3bf'); ell(ctx, x + 23, y - 179, 9, 9, sky); }
  else if (c.season === 'winter') { for (let i = 0; i < 5; i++) ell(ctx, x - 34 + i * 17, y - 190 + ((i * 29 + G.time * 20) % 70), 2.5, 2.5, '#fff'); }
  else ell(ctx, x - 20, y - 178, 13, 13, c.season === 'autumn' ? '#ffc078' : '#ffe066');
  line(ctx, x, y - 200, x, y - 112, '#fff', 5); line(ctx, x - 44, y - 156, x + 44, y - 156, '#fff', 5);
  fillRR(ctx, x - 58, y - 110, 116, 9, 4, '#fff', OUT, 1.5);
}
function floorSlab(ctx, r, y) {
  const col = r.floor === 'wood' ? '#c98b5a' : r.floor === 'check' ? '#f1f3f5' : '#dfe9ee';
  ctx.fillStyle = col; ctx.fillRect(r.x0, y, r.x1 - r.x0, SLAB);
  if (r.floor === 'check') { ctx.fillStyle = '#ffa8a8'; for (let xx = r.x0, i = 0; xx < r.x1; xx += 26, i++) if (i % 2) ctx.fillRect(xx, y, Math.min(26, r.x1 - xx), 10); }
  else if (r.floor === 'wood') { ctx.fillStyle = 'rgba(0,0,0,.1)'; for (let xx = r.x0 + 60; xx < r.x1; xx += 60) ctx.fillRect(xx, y, 2, 10); }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(r.x0, y + 10, r.x1 - r.x0, SLAB - 10);
  line(ctx, r.x0, y, r.x1, y, OUT, 2.5);
}

function drawBuiltBack(ctx, t) {
  let y = fy(0);
  // входная дверь
  fillRR(ctx, 237, y - 176, 96, 176, 8, '#8d5524', OUT);
  fillRR(ctx, 245, y - 168, 80, 168, 5, '#e8590c', OUT, 1.5);
  fillRR(ctx, 259, y - 152, 52, 50, 24, '#d0ebff', OUT, 1.5); ell(ctx, 314, y - 82, 5, 5, '#ffd43b', OUT, 1.5);
  fillRR(ctx, 230, y - 6, 110, 10, 4, '#51cf66', OUT, 1.5);
  // туалет
  fillRR(ctx, 30, y - 100, 44, 52, 8, '#fff', OUT); fillRR(ctx, 38, y - 44, 50, 14, 6, '#fff', OUT);
  ctx.beginPath(); ctx.moveTo(36, y - 34); ctx.lineTo(96, y - 34); ctx.quadraticCurveTo(92, y - 8, 70, y - 6); ctx.lineTo(50, y - 6); ctx.quadraticCurveTo(38, y - 12, 36, y - 34); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  fillRR(ctx, 48, y - 8, 30, 8, 3, '#fff', OUT); ell(ctx, 66, y - 88, 4, 4, '#adb5bd', OUT, 1);
  fillRR(ctx, 6, y - 150, 16, 34, 4, '#fff', OUT, 1.5); // рулон
  // раковины (туалет, кухня — в столешнице, ванная)
  for (const [sx, sy] of [[160, fy(0)], [1362, fy(1)]]) {
    fillRR(ctx, sx - 28, sy - 204, 56, 70, 26, '#d0ebff', OUT); line(ctx, sx - 10, sy - 190, sx + 4, sy - 176, 'rgba(255,255,255,.9)', 4);
    fillRR(ctx, sx - 8, sy - 66, 16, 66, 4, '#fff', OUT); fillRR(ctx, sx - 32, sy - 86, 64, 26, 12, '#fff', OUT);
    line(ctx, sx, sy - 86, sx, sy - 102, '#adb5bd', 5); line(ctx, sx, sy - 102, sx + 12, sy - 102, '#adb5bd', 5);
  }
  // кухня: шкафчики, вытяжка, столешница с плитой и мойкой
  fillRR(ctx, 1050, y - 236, 160, 70, 8, '#fff', OUT); line(ctx, 1130, y - 236, 1130, y - 166, OUT, 1.5);
  ell(ctx, 1120, y - 200, 3, 3, '#ffd43b', OUT, 1); ell(ctx, 1140, y - 200, 3, 3, '#ffd43b', OUT, 1);
  fillRR(ctx, 1230, y - 236, 150, 70, 8, '#fff', OUT); line(ctx, 1305, y - 236, 1305, y - 166, OUT, 1.5);
  fillRR(ctx, 1050, y - 88, 350, 88, 8, '#ff8787', OUT);
  fillRR(ctx, 1044, y - 98, 362, 14, 5, '#f8f9fa', OUT);
  fillRR(ctx, 1066, y - 78, 108, 70, 6, '#f1f3f5', OUT); fillRR(ctx, 1078, y - 56, 84, 40, 5, '#343a40', OUT, 1.5);
  for (let i = 0; i < 4; i++) ell(ctx, 1080 + i * 27, y - 68, 4, 4, '#ff6b6b', OUT, 1);
  fillRR(ctx, 1088, y - 104, 26, 6, 2, '#343a40'); fillRR(ctx, 1128, y - 104, 26, 6, 2, '#343a40');
  fillRR(ctx, 1122, y - 128, 38, 24, 5, '#74c0fc', OUT); line(ctx, 1160, y - 118, 1176, y - 122, OUT, 4); // кастрюлька
  if (Math.sin(t * 2) > 0) { ctx.globalAlpha = 0.5; ell(ctx, 1141, y - 140 - ((t * 20) % 16), 6, 6, '#fff'); ctx.globalAlpha = 1; }
  for (const dx of [1196, 1290]) { fillRR(ctx, dx, y - 78, 86, 70, 6, '#ffa8a8', OUT, 1.5); ell(ctx, dx + 43, y - 62, 3, 3, '#fff', OUT, 1); }
  fillRR(ctx, 1262, y - 104, 76, 8, 3, '#ced4da', OUT, 1.5); line(ctx, 1300, y - 104, 1300, y - 128, '#adb5bd', 5); line(ctx, 1300, y - 128, 1316, y - 128, '#adb5bd', 5);
  // ванна (задняя часть) и душ
  y = fy(1);
  line(ctx, 1580, y - 210, 1580, y - 60, '#adb5bd', 5); line(ctx, 1580, y - 210, 1550, y - 210, '#adb5bd', 5); fillRR(ctx, 1532, y - 214, 26, 12, 5, '#adb5bd', OUT, 1.5);
  fillRR(ctx, 1395, y - 76, 190, 62, 26, '#fff', OUT);
  // сауна: печка, скамьи
  y = fy(2);
  fillRR(ctx, 70, y - 150, 232, 14, 4, '#b9834f', OUT); fillRR(ctx, 70, y - 136, 232, 60, 3, '#c98b5a', OUT, 1.5);
  fillRR(ctx, 40, y - 74, 262, 14, 4, '#b9834f', OUT); fillRR(ctx, 48, y - 60, 254, 60, 3, '#c98b5a', OUT, 1.5);
  fillRR(ctx, 8, y - 50, 44, 50, 5, '#495057', OUT); for (let i = 0; i < 3; i++) ell(ctx, 18 + i * 12, y - 54, 8, 6, '#868e96', OUT, 1.5);
  ell(ctx, 30, y - 30, 8, 8, V.p.state === 'sauna' ? '#ff6b6b' : '#e8590c');
  fillRR(ctx, 270, y - 212, 34, 44, 6, '#fff', OUT, 1.5); ell(ctx, 287, y - 190, 11, 11, '#ffe3e3', OUT, 1); line(ctx, 287, y - 190, 287 + Math.cos(-1) * 8, y - 190 + Math.sin(-1) * 8, '#e03131', 2); // термометр
  // джакузи (задняя стенка)
  fillRR(ctx, 380, y - 78, 280, 74, 30, '#fff', OUT);
  // бассейн: задняя стенка и лесенка
  fillRR(ctx, 765, y - 86, 770, 86, 12, '#e7f5ff', OUT);
  for (let xx = 790; xx < 1520; xx += 44) line(ctx, xx, y - 80, xx, y - 6, 'rgba(116,192,252,.35)', 2);
  line(ctx, 1500, y - 150, 1500, y - 30, '#adb5bd', 5); line(ctx, 1522, y - 150, 1522, y - 30, '#adb5bd', 5);
  for (let i = 0; i < 4; i++) line(ctx, 1500, y - 136 + i * 24, 1522, y - 136 + i * 24, '#adb5bd', 4);
  ell(ctx, 830, y - 100, 22, 9, '#ff6b6b', OUT); ell(ctx, 830, y - 100, 10, 4, '#e7f5ff', OUT, 1.5); // круг
}
function drawBuiltFront(ctx, t) {
  let y = fy(1);
  const inBath = V.p.state === 'bath';
  // ванна спереди
  ctx.beginPath(); ctx.moveTo(1392, y - 70); ctx.lineTo(1588, y - 70); ctx.quadraticCurveTo(1586, y - 12, 1550, y - 12); ctx.lineTo(1430, y - 12); ctx.quadraticCurveTo(1394, y - 12, 1392, y - 70); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  fillRR(ctx, 1386, y - 80, 208, 14, 7, '#fff', OUT);
  ell(ctx, 1420, y - 6, 10, 7, '#ffd43b', OUT, 1.5); ell(ctx, 1560, y - 6, 10, 7, '#ffd43b', OUT, 1.5);
  if (inBath) for (let i = 0; i < 9; i++) ell(ctx, 1404 + i * 22, y - 84 + Math.sin(t * 2 + i) * 3, 13, 11, '#fff', '#dbe4ff', 1.5);
  y = fy(2);
  // джакузи спереди + вода
  ctx.fillStyle = 'rgba(116,192,252,.75)'; rr(ctx, 392, y - 66, 256, 30, 10); ctx.fill();
  for (let i = 0; i < 7; i++) ell(ctx, 410 + i * 36 + Math.sin(t * 3 + i * 2) * 6, y - 64 + Math.cos(t * 4 + i) * 2, 7, 5, 'rgba(255,255,255,.85)');
  fillRR(ctx, 372, y - 52, 296, 52, 22, '#fff', OUT); fillRR(ctx, 366, y - 62, 308, 16, 8, '#ffd8a8', OUT);
  for (let i = 0; i < 5; i++) ell(ctx, 420 + i * 50, y - 26, 6, 6, '#d0ebff', OUT, 1.2);
  fillRR(ctx, 674, y - 26, 44, 26, 4, '#ffd8a8', OUT, 1.5); fillRR(ctx, 674, y - 48, 24, 24, 4, '#ffd8a8', OUT, 1.5); // ступеньки
  // бассейн: вода и стекло
  ctx.fillStyle = 'rgba(77,171,247,.62)'; rr(ctx, 771, y - 62, 758, 58, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let xx = 771; xx <= 1529; xx += 12) { const yy = y - 62 + Math.sin(xx * 0.05 + t * 2.4) * 2.5; if (xx === 771) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
  ctx.stroke();
  rr(ctx, 765, y - 86, 770, 86, 12); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  fillRR(ctx, 758, y - 12, 784, 12, 5, '#74c0fc', OUT);
}

function drawPlayer(ctx, t) {
  const p = V.p, look = playerLook();
  const base = { time: t, dir: p.dir, blink: t % 3.4 > 3.25, happy: p.happy > 0, armsUp: p.happy > 0 && Math.sin(t * 10) > 0 };
  let x = p.x, y = fy(p.f), pose = { ...base, walk: p.moving ? p.walkT : null };
  if (p.lift) y = V.liftY;
  switch (p.state) {
    case 'sit': y -= SEAT_H[FURN_BY_ID[p.item.id].kind] || 34; pose = { ...base, sit: true, shadow: false }; break;
    case 'bath': y -= 20; pose = { ...base, clipBelow: -36, happy: true }; break;
    case 'jacuzzi': y -= 14; pose = { ...base, clipBelow: -36, happy: true }; break;
    case 'swim': y -= 6; pose = { ...base, clipBelow: -38, walk: p.walkT + t }; break;
    case 'sauna': y -= 74; pose = { ...base, sit: true, shadow: false }; break;
    case 'wheel': {
      const d = FURN_BY_ID[p.item.id];
      drawHamster(ctx, x, y - d.h * 0.52 + d.w * 0.46 - 12, 1.02, look, { ...base, walk: p.walkT, shadow: false, dir: 1 });
      return;
    }
    default: break;
  }
  drawHamster(ctx, x, y, HS, look, pose);
}

export function draw(ctx) {
  const { w, h } = G.view, t = G.time, z = V.cam.zoom, c = cal();
  drawSky(ctx, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-V.cam.x, -V.cam.y);
  ctx.lineJoin = 'round';
  // земля
  ctx.fillStyle = { winter: '#f4f9fd', spring: '#9be36d', summer: '#7ed957', autumn: '#d9b65c' }[c.season];
  ctx.fillRect(-3000, 6, 8000, 600);
  for (let i = 0; i < 9; i++) { const bx = -260 + i * 60 + (i > 3 ? WTOT + 260 : 0); ell(ctx, bx, 6, 46, 34, c.season === 'winter' ? '#fff' : c.season === 'autumn' ? '#e8a03a' : '#51cf66', OUT); }
  // коробка дома
  const top = fy(2) - RH;
  fillRR(ctx, -18, top - 12, WTOT + 36, -top + 12 + SLAB, 6, '#fff3d6', OUT, 3);
  poly(ctx, [-70, top - 8, WTOT / 2, top - 150, WTOT + 70, top - 8], c.season === 'winter' ? '#f8f9fa' : '#f76e5c', OUT, 3);
  if (c.season !== 'winter') { ctx.strokeStyle = 'rgba(0,0,0,.1)'; for (let i = 1; i < 6; i++) line(ctx, -70 + i * 60, top - 8 - i * 4, WTOT + 70 - i * 60, top - 8 - i * 4, 'rgba(0,0,0,.0)', 1); }
  fillRR(ctx, WTOT / 2 - 46, top - 104, 92, 60, 30, '#d0ebff', OUT, 3); line(ctx, WTOT / 2, top - 104, WTOT / 2, top - 44, OUT, 2);
  fillRR(ctx, 300, top - 130, 60, 90, 4, '#e8590c', OUT, 3); fillRR(ctx, 292, top - 140, 76, 16, 4, '#f1e0c5', OUT, 2);
  // комнаты
  for (const r of ROOMS) {
    const y = fy(r.f);
    wallpaper(ctx, r, y);
    if (r.win) windowAt(ctx, r.win, y);
    floorSlab(ctx, r, y);
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(r.x0, y - RH - 3, r.x1 - r.x0, 3);
  }
  // перегородки с проёмами
  for (const r of ROOMS) {
    if (r.x0 === 0) continue;
    const y = fy(r.f);
    fillRR(ctx, r.x0 - 7, y - RH, 14, RH - 170, 2, '#fff3d6', OUT, 2);
  }
  // стеклянная крыша бассейна — блики
  ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) poly(ctx, [800 + i * 160, fy(2) - RH, 850 + i * 160, fy(2) - RH, 790 + i * 160, fy(2) - RH + 90, 760 + i * 160, fy(2) - RH + 90], 'rgba(255,255,255,.3)');
  // лифт
  for (let f = 0; f < 3; f++) {
    const y = fy(f);
    ctx.fillStyle = '#dee2e6'; ctx.fillRect(W, y - RH, WTOT - W, RH);
    ctx.fillStyle = '#ced4da'; ctx.fillRect(W, y, WTOT - W, SLAB);
    line(ctx, W, y - RH, W, y - 170, OUT, 2.5);
  }
  line(ctx, EX - 30, top, EX - 30, 0, '#868e96', 2); line(ctx, EX + 30, top, EX + 30, 0, '#868e96', 2);
  fillRR(ctx, EX - 50, V.liftY - 168, 100, 168, 10, '#ffd43b', OUT, 2.5);
  fillRR(ctx, EX - 40, V.liftY - 158, 80, 110, 6, '#fff9db', OUT, 1.5);
  fillRR(ctx, EX - 50, V.liftY - 6, 100, 8, 3, '#e0a800', OUT, 1.5);
  ctx.fillStyle = OUT; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲▼', EX, V.liftY - 28);

  drawBuiltBack(ctx, t);
  // мебель
  const minutes = G.state.minutes;
  for (const it of itemsSorted()) {
    const d = FURN_BY_ID[it.id], y = fy(it.floor);
    const on = it.on !== undefined ? it.on : d.act === 'fire' || (d.kind === 'lamp' && darkness() > 0.4);
    if (V.decor && V.sel === it) { const r = furnRect(d, it.x, y, it.y); ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20; rr(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 10); ctx.strokeStyle = '#ff6b9d'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
    drawFurn(ctx, d, it.x, d.wall ? y - it.y : y, { t, on, minutes });
  }
  // гости и игрок
  for (const g of V.guests) {
    const n = NPC_BY_ID[g.id];
    drawHamster(ctx, g.x, fy(g.f), HS * (n.small ? 0.78 : 1), npcLook(g.id), { time: t + g.x, dir: g.dir, walk: g.moving ? g.walkT : null, happy: g.happy > 0, armsUp: g.happy > 0 && Math.sin(t * 10) > 0, blink: (t + g.x) % 3.7 > 3.55 });
    ctx.font = '800 15px ui-rounded, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(n.name).width + 14;
    fillRR(ctx, g.x - tw / 2, fy(g.f) - 152 * (n.small ? 0.8 : 1), tw, 20, 10, 'rgba(255,255,255,.9)'); ctx.fillStyle = OUT; ctx.fillText(n.name, g.x, fy(g.f) - 142 * (n.small ? 0.8 : 1) + (n.small ? 2 : 0));
  }
  drawPlayer(ctx, t);
  drawBuiltFront(ctx, t);
  // частицы
  for (const q of V.parts) {
    const k = 1 - q.t / q.life; ctx.globalAlpha = Math.min(1, k * 1.6);
    if (q.kind === 'heart') heart(ctx, q.x, q.y, q.r, '#ff5c8a');
    else if (q.kind === 'bubble') ell(ctx, q.x, q.y, q.r, q.r, 'rgba(255,255,255,.7)', '#a5d8ff', 1.2);
    else if (q.kind === 'steam') ell(ctx, q.x, q.y, q.r, q.r * 0.8, 'rgba(255,255,255,.5)');
    else if (q.kind === 'note') { ctx.fillStyle = '#845ef7'; ctx.font = '800 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', q.x, q.y); }
    else { ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 0.5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Включена колонка или диско-шар — значит, на вилле вечеринка (и музыка другая). */
export function isParty() {
  return G.state.villa.some((i) => i.on === true && FURN_BY_ID[i.id] && (FURN_BY_ID[i.id].act === 'music' || FURN_BY_ID[i.id].act === 'disco'));
}
export function playerInBed() { /* зарезервировано для анимации сна */ }

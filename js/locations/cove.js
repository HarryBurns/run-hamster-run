// СЕКРЕТНЫЙ ПЛЯЖ (П.9) — шестое тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образцы — лес, гора, пещеры, пустыня и джунгли (разделы 14–18).
// Рисунки — cove_art.js.
//
// Как устроен: компактная бухта 30 × 30 правилами (build). Со всех сторон, кроме юга, — скалы (стена «лицом» к нам —
// предмет cliffFace на каждой клетке скалы над песком), на юге — узкий выход в открытое море между мысами. На северо-
// западе в скале — подводный грот: сюда приплывают из моря города (вход grotto), здесь же ныряют обратно (место
// grotto). Белый песок, пальмы, бирюзовая вода: у берега мелко (плыть можно), дальше глубже, за бухтой — открытое море.
// На камне в воде у берега сидит русалочка Жемчужинка (житель still — не гуляет). На песке: гнездо черепашат (вечером
// они вылупляются и ползут за хомячком к морю — крюки update и things), песочные куличики (мини-игра «Замок из песка»),
// крестик клада с карты Зефирки (выкопать раз за игру — крюк ground), редкие ракушки у кромки воды (находки pickups:
// 1–2 в день — data/economy.js, COVE.shells; места — жребий дня). Ночью вода светится (биолюминесценция): точки-огоньки
// в маленьком слое неба поверх ночной темноты (крюк sky — почти даром), а где плывёт хомячок — кольцо огоньков.
// Всё случайное — от seeded(), карта всегда одна и та же.
//
// Атмосфера: в бухту приходит тёплое течение — здесь всегда лето (season), снега и холодного дождя не бывает (dry),
// мёрзнуть нельзя (cold), а вода тёплая (swim с where: 'cove' — не «ледяное море»). Своя музыка (sound → soundscape).
import { G, darkness } from '../core/state.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { clamp, seeded, dist, rnd } from '../core/util.js';
import { COVE, SHELL_IDS, FIND_BY_ID, SEASON_OF_MONTH, pickOn, monthOfDay, npcLook } from '../data/index.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { T, PS, TILES, SP, put, hash, tileOf, defineArt, createTopDownScene } from '../engine/topdown/index.js';
import { drawXMark, drawDugHole, drawDolphinJump, DOLPHIN_JUMP } from './cove_art.js';
import './common/index.js';
import './jungle_art.js'; // цветы-геликонии у подножия скал — общие с джунглями

const W = 30,
  H = 30;
// особые места (клетки)
export const AT = {
  grotto: [6, 3], // арка грота в скале; вода грота — клетки 5–7 ряда 4
  entry: [6.5, 5.7], // куда выплываешь из грота
  rock: [19, 17], // камень Жемчужинки в воде
  nest: [9, 11], // гнездо черепашат
  castle: [15, 13], // песочные куличики — «Замок из песка»
  treasure: [22, 9], // крестик клада
};
/** Где море выносит ракушки: у кромки воды (последний ряд песка). Сегодняшние — жребий дня (shellsToday). */
const SHELL_X = [5, 8, 11, 14, 17, 21, 23, 25];

// ---------- карта ----------
/** Первый ряд песка под северными скалами. */
const topY = (x) => (x >= 4 && x <= 8 ? 4 : 4 + ((x * 7) % 5 === 0 ? 1 : 0));
/** Сколько клеток скалы с запада и с востока в ряду y (на юге мысы уходят в море, бухта сужается). */
const westW = (y) => (y < 19 ? 3 : Math.round(3 + (y - 18) * 0.62));
const eastW = (y) => (y < 19 ? 3 : Math.round(3 + (y - 18) * 0.58));
/** Где кончается песок в столбце x (дальше — мелководье, потом глубже, потом открытое море). */
export const sandEnd = (x) => 17 + Math.round(Math.sin(x * 0.42 + 1) * 0.8);
const isRock = (x, y) => y < topY(x) || x < westW(y) || x > W - 1 - eastW(y);

function build(m) {
  const rnd = seeded(7321);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const se = sandEnd(x);
      let k = y < se ? 'csand' : y < se + 3 ? 'clag' : y < se + 6 ? 'cdeep' : 'copen';
      if (isRock(x, y)) k = 'crock';
      m.set(x, y, k);
    }
  // грот: вода у подножия арки
  for (const x of [5, 6, 7]) m.set(x, 4, 'cgrotto');
  // камень Жемчужинки — в мелководье, над ним песок (сюда подходят поговорить)
  m.set(AT.rock[0], AT.rock[1] - 1, 'csand');
  m.set(AT.rock[0], AT.rock[1], 'clag');
  // стена скалы «лицом» к нам: на каждой клетке скалы, под которой не скала (кроме арки грота)
  const rockAt = (x, y) => x < 0 || x >= W || y < 0 || m.at(x, y) === 'crock';
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      if (!rockAt(x, y) || rockAt(x, y + 1) || (y === AT.grotto[1] && Math.abs(x - AT.grotto[0]) <= 1)) continue;
      const ends =
        (rockAt(x - 1, y + 1) || !rockAt(x - 1, y) ? 1 : 0) | (rockAt(x + 1, y + 1) || !rockAt(x + 1, y) ? 2 : 0);
      m.add('cliffFace', x, y, { v: Math.floor(rnd() * 3), ends });
    }
  m.add('grottoArch', ...AT.grotto);
  m.add('mermaidRock', ...AT.rock);
  // пальмы у подножия скал и вдоль пляжа; цветы, камни, звёзды и крабы
  for (const [x, y] of [
    [4, 7],
    [10, 5],
    [17, 6],
    [24, 5],
    [3, 11],
    [26, 9],
    [25, 14],
    [4, 15],
    [13, 8],
  ])
    m.add('palm', x, y);
  for (const [x, y] of [
    [8, 5],
    [14, 5],
    [20, 5],
    [3, 13],
    [26, 12],
  ])
    m.add('jflowers', x, y, { v: Math.floor(rnd() * 3) });
  for (const [x, y, v] of [
    [3, 17, 0],
    [26, 16, 1],
    [7, 19, 0],
    [23, 20, 1],
  ])
    if (m.at(x, y) !== 'crock') m.add('seaRock', x, y, { v });
  for (const [type, x, y] of [
    ['starfish', 12, 15],
    ['starfish', 24, 12],
    ['crab', 21, 15],
    ['crab', 6, 13],
  ])
    m.add(type, x, y);
  m.add('sandcastle', ...AT.castle);
  // лежаки под пальмой и полотенце — позагорать (отдых, пачка 20 ноября)
  m.add('lounger', 12, 10);
  m.add('lounger', 14, 10);
  m.add('towel', 18, 11, { v: 3 });
  m.add('signpost', 10, 7, { text: '🌊 Грот', dir: 'l', text2: '⛵ В город' }); // грот и есть дорога в город
}

// ---------- ракушки: море выносит их на песок (находки pickups, по жребию дня) ----------
const S = () => G.state;
const SC = () => (S() && S().dayFlags.cove) || {};
/** Лето ли по календарю (в бухте всегда тепло, но летом море выносит больше ракушек и черепашат больше). */
const summerNow = () => SEASON_OF_MONTH[monthOfDay(S() ? S().day : 0)] === 'summer';
/** Сколько ракушек море выносит сегодня: летом больше. */
export const shellsPerDay = () => (summerNow() ? COVE.shells.summer : COVE.shells.other);
/** Сегодняшние ракушки: [{ i — номер места в SHELL_X, kind — номер вида в SHELL_IDS }]. */
export function shellsToday() {
  const day = S().day,
    spots = pickOn(
      day,
      'cove:shells',
      SHELL_X.map((_, i) => String(i)),
      shellsPerDay(),
    ).map(Number);
  return spots.map((i, j) => ({ i, kind: (day + j) % SHELL_IDS.length }));
}
function placeShells(sc) {
  sc.setPickups(
    shellsToday().map(({ i, kind }) => {
      const id = SHELL_IDS[kind],
        f = FIND_BY_ID[id];
      return {
        id: 's' + i,
        at: [SHELL_X[i], sandEnd(SHELL_X[i]) - 1],
        icon: f.e,
        give: ['finds', id, 1],
        text: `+1 ${f.e} ${f.name}`,
        act: 'cove:shell',
      };
    }),
  );
}

// ---------- черепашата: вечером вылупляются и ползут за хомячком к морю ----------
const hatch = { on: false, list: [] };
/** Идут ли сейчас черепашата за хомячком. */
export const turtlesOut = () => hatch.on;
/** Сколько черепашат вылупляется сегодня (летом больше). */
export const turtlesToday = () => (summerNow() ? COVE.turtles.summer : COVE.turtles.other);
/** Можно ли сейчас вылупиться: вечер (COVE.turtles.from–to часов), сегодня ещё не провожали. */
export const hatchTime = () => {
  const h = S().minutes / 60;
  return h >= COVE.turtles.from && h < COVE.turtles.to;
};
/** Вылупились: черепашата у гнезда, дальше ползут за хомячком (каждый — за тем, кто впереди). */
export function startHatch() {
  const [nx, ny] = AT.nest,
    n = turtlesToday();
  hatch.on = true;
  hatch.list = Array.from({ length: n }, (_, i) => ({
    x: (nx + 0.5) * T + (i - (n - 1) / 2) * 12,
    y: (ny + 0.5) * T + 6 + (i % 2) * 6,
    dir: 1,
    step: i * 0.3,
    sea: 0, // > 0 — уже в воде: уплывает
  }));
  sfx('pop');
}
const isWater = (x, y) => {
  const k = TILES[S() && sceneMap ? sceneMap.at(tileOf(x), tileOf(y)) : ''];
  return !!(k && k.wet);
};
let sceneMap = null;
/** Можно ли черепашонку сюда: суша без пальм и камней или вода (там он уже уплывает). */
const blockedAt = (x, y) => {
  if (!sceneMap) return false;
  const tx = tileOf(x),
    ty = tileOf(y);
  return !isWater(x, y) && !sceneMap.foot(tx, ty);
};
function updateTurtles(sc, dt) {
  if (!hatch.on) return;
  const p = sc.p;
  let leader = p,
    left = 0;
  for (const q of hatch.list) {
    if (q.sea > 0) {
      q.sea += dt;
      q.y += 40 * dt;
      continue;
    }
    left++;
    const d = dist(q.x, q.y, leader.x, leader.y),
      gap = leader === p ? 30 : 22;
    if (d > gap) {
      const sp = Math.min(150, 60 + d) * dt;
      // обходят пальмы, камни и скалы (С6): впереди препятствие — поворачивают, пока путь не свободен
      const a0 = Math.atan2(leader.y - q.y, leader.x - q.x);
      let a = a0;
      for (const da of [0, 0.6, 1.2, 1.8, 2.4]) {
        const side = q.side || 1,
          a1 = a0 + da * side,
          a2 = a0 - da * side;
        if (!blockedAt(q.x + Math.cos(a1) * 20, q.y + Math.sin(a1) * 20)) {
          a = a1;
          break;
        }
        if (!blockedAt(q.x + Math.cos(a2) * 20, q.y + Math.sin(a2) * 20)) {
          a = a2;
          q.side = -side; // запомнить, в какую сторону обходит, — чтобы не метался
          break;
        }
      }
      q.x += Math.cos(a) * sp;
      q.y += Math.sin(a) * sp;
      if (Math.abs(Math.cos(a)) > 0.2) q.dir = Math.cos(a) > 0 ? 1 : -1;
      q.step += dt * 6;
    }
    if (isWater(q.x, q.y)) {
      q.sea = 0.01;
      sfx('splash');
    }
    leader = q;
  }
  if (!left && hatch.list.every((q) => q.sea > 1.6)) {
    hatch.on = false;
    hatch.list = [];
    emit('cove', { what: 'turtles' });
  }
}

// ---------- светящаяся вода ночью ----------
let glowCells = null,
  glowShore = null; // клетки воды у самого песка: ночью вдоль кромки светится пена (С9)
/**
 * Чёткие огоньки на воде и светящаяся пена прибоя (С9) — прямо в кадре, в координатах мира: на большом экране они не
 * расплываются (мягкое сияние вокруг даёт слой неба, drawGlow). Одним путём на всё видимое.
 */
function drawGlowCrisp(ctx, sc, t, k) {
  const z = sc.cam.zoom,
    hw = G.view.w / 2 / z + T,
    hh = G.view.h / 2 / z + T,
    x0 = sc.cam.x - hw,
    x1 = sc.cam.x + hw,
    y0 = sc.cam.y - hh,
    y1 = sc.cam.y + hh;
  ctx.fillStyle = `rgba(190,255,250,${(0.9 * k).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < glowCells.length; i += 3) {
    const h = glowCells[i + 2],
      tw = Math.sin(t * (1.3 + h) + h * 40);
    if (tw < -0.3) continue;
    const x = (glowCells[i] + 0.2 + h * 0.6) * T,
      y = (glowCells[i + 1] + 0.3 + ((h * 7) % 1) * 0.5) * T;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const r = 1.6 + Math.max(0, tw) * 1.6;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 6.2832);
  }
  ctx.fill();
  // пена у кромки: светящиеся искорки набегают и отступают вместе с волной
  ctx.fillStyle = `rgba(150,255,240,${(0.85 * k).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < glowShore.length; i += 2) {
    const tx = glowShore[i],
      ty = glowShore[i + 1];
    if ((tx + 1) * T < x0 || tx * T > x1 || ty * T < y0 || ty * T > y1) continue;
    const wave = Math.sin(t * 1.4 + tx * 0.7) * 5;
    for (let j = 0; j < 5; j++) {
      const hh = hash(tx * 5 + j, ty),
        tw = Math.sin(t * 3 + hh * 20);
      if (tw < -0.2) continue;
      const x = tx * T + (j + hh) * 9.6,
        y = ty * T + 4 + hh * 10 + wave,
        r = 1.4 + tw * 1.2;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 6.2832);
    }
  }
  ctx.fill();
}
/** Огоньки в воде: точки в слое неба (поверх ночной темноты — светятся по-настоящему), кольцо вокруг хомячка. */
function drawGlow(c, sc, lw, lh, t, k) {
  const vw = G.view.w,
    vh = G.view.h,
    kx = (lw - 1) / vw,
    ky = (lh - 1) / vh;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 2; pass++) {
    c.fillStyle = pass ? `rgba(200,255,250,${0.6 * k})` : `rgba(60,210,225,${0.32 * k})`;
    c.beginPath();
    for (let i = 0; i < glowCells.length; i += 3) {
      const tx = glowCells[i],
        ty = glowCells[i + 1],
        h = glowCells[i + 2],
        tw = Math.sin(t * (1.3 + h) + h * 40);
      if (pass ? tw < 0.7 : tw < -0.3) continue;
      const s = sc.cam.toScreen((tx + 0.2 + h * 0.6) * T, (ty + 0.3 + ((h * 7) % 1) * 0.5) * T);
      if (s.x < -10 || s.y < -10 || s.x > vw + 10 || s.y > vh + 10) continue;
      const x = s.x * kx,
        y = s.y * ky,
        r = pass ? 0.8 : 1.3 + tw * 0.4; // слой мелкий — пятнышки небольшие, чёткую точку рисует ground (С9)
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, 6.2832);
    }
    c.fill();
  }
  // кольцо огоньков вокруг хомячка в воде
  const p = sc.p;
  if (isWater(p.x, p.y)) {
    const s = sc.cam.toScreen(p.x, p.y),
      rr = (16 + Math.sin(t * 3) * 3) * kx * sc.cam.zoom;
    c.strokeStyle = `rgba(140,255,245,${0.8 * k})`;
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(s.x * kx, s.y * ky, rr * 2.2, rr, 0, 0, 6.2832);
    c.stroke();
  }
  c.restore();
}

// ---------- дельфины вдали (С5): днём за мысами, в открытом море, иногда выпрыгивает пара дельфинов ----------
const dolph = { j: null, next: 6 };
function updateDolphins(sc, dt) {
  if (dolph.j && G.time - dolph.j.t0 > DOLPHIN_JUMP * 1.8) dolph.j = null;
  if (darkness() > 0.4 || dolph.j || (dolph.next -= dt) > 0) return;
  dolph.next = rnd(16, 32);
  showDolphins(sc, 8 + rnd(0, 13), 24.5 + rnd(0, 3), rnd(0, 1) < 0.5 ? 1 : -1);
}
function showDolphins(sc, tx, ty, dir) {
  if (sc.map.at(Math.floor(tx), Math.floor(ty)) !== 'copen') return false;
  dolph.j = { x: tx * T, y: ty * T, dir, v: 30, t0: G.time, scale: 0.6 };
  return true;
}

// ---------- Жемчужинка плавает (С3): иногда, пока хомячок далеко, соскальзывает с камня, плавает по лагуне и ныряет ----------
const ROCK_PX = { x: (AT.rock[0] + 0.5) * T, y: (AT.rock[1] + 0.46) * T };
const swim = { on: false, t0: 0, dur: 14, next: 0 };
/** Пока плавает, на камне её нет: рисует её сама локация (things), нажать нельзя (hold.off — engine/topdown/actors.js). */
const PEARL_SWIMS = { off: true, draw() {} };
function updatePearl(sc) {
  sc.npcs[0].hold = swim.on ? PEARL_SWIMS : null;
  const near = Math.hypot(sc.p.x - ROCK_PX.x, sc.p.y - ROCK_PX.y) < T * 3.2;
  if (swim.on) {
    // подошла поближе — Жемчужинка возвращается на камень (поговорить можно всегда)
    if (near || G.time - swim.t0 > swim.dur) {
      swim.on = false;
      swim.next = G.time + rnd(25, 45);
    }
    return;
  }
  if (!swim.next) swim.next = G.time + rnd(6, 14);
  if (G.time < swim.next || near || darkness() > 0.6 || hatch.on) return;
  swim.on = true;
  swim.t0 = G.time;
  sfx('splash');
}
/** Где русалочка сейчас: петля по лагуне у камня; в середине — ныряет (виден только хвост). */
function pearlAt(t) {
  const k = clamp((t - swim.t0) / swim.dur, 0, 1),
    a = k * Math.PI * 3,
    cx = ROCK_PX.x - T * 1.8,
    cy = ROCK_PX.y + T * 2.3,
    lx = cx + Math.sin(a) * T * 3,
    ly = cy - Math.cos(a) * T * 1.1 + T * 0.4,
    edge = Math.min(1, k / 0.08, (1 - k) / 0.08); // соскользнула с камня / вернулась
  return {
    x: ROCK_PX.x + (lx - ROCK_PX.x) * edge,
    y: ROCK_PX.y + (ly - ROCK_PX.y) * edge,
    dir: Math.cos(a) >= 0 ? 1 : -1,
    dive: k > 0.42 && k < 0.58 ? (k - 0.42) / 0.16 : -1, // 0 → 1: нырнула
  };
}
defineArt({
  // Жемчужинка в воде по пояс: кадр — куда смотрит (dir) и моргает ли (b)
  pearlSwim: [
    [-56, -112, 56, 8],
    (ctx, dir, b) =>
      drawHamster(ctx, 0, 0, PS, npcLook('pearl'), {
        dir,
        clipBelow: -34,
        happy: true,
        blink: b ? 1 : 0,
        shadow: false,
      }),
  ],
});
function drawPearlSwim(ctx, q, t) {
  if (q.dive >= 0) {
    // нырнула: над водой мелькает хвост, кругом брызги
    const up = Math.sin(q.dive * Math.PI);
    ctx.save();
    ctx.translate(q.x, q.y - up * 26);
    ctx.scale(q.dir, 1);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#38d9a9';
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-4, -4);
    ctx.quadraticCurveTo(-18, -16, -22, -6);
    ctx.quadraticCurveTo(-8, -6, 0, 2);
    ctx.quadraticCurveTo(8, -6, 22, -6);
    ctx.quadraticCurveTo(18, -16, 4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      const ph = (q.dive * 1.6 + i * 0.5) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - ph)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y + 6, 14 + ph * 30, 5 + ph * 9, 0, 0, 6.2832);
      ctx.stroke();
    }
    return;
  }
  // плывёт: по пояс в воде, за ней — след
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(q.x - q.dir * 26, q.y - 14, 14, 4, 0, 0, 6.2832);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.ellipse(q.x, q.y - 18, 26, 8, 0, 0, 6.2832);
  ctx.fill();
  put('pearlSwim', q.x, q.y + 6, q.dir, blinkAt(t, 3) > 0.4 ? 1 : 0); // готовый кадр из кэша: по пояс в воде
  SP.world();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(q.x, q.y - 20, 24 + Math.sin(t * 3) * 3, 7, 0, 0, Math.PI);
  ctx.stroke();
}

// ---------- свой замок из песка (С7): после «Замка из песка» стоит на пляже до следующего дня ----------
const CASTLE_PX = { x: (AT.castle[0] + 1.9) * T, y: (AT.castle[1] + 0.75) * T };
/** Свой замок, если он ещё стоит: детали через запятую (ключ спрайта) или null. */
export function ownCastle() {
  const c = S() && S().flags.coveCastle;
  if (!c || !Array.isArray(c.cells) || S().day - c.day > 1 || S().day < c.day) return null;
  return c.cells.map((x) => x || '').join(',');
}

// ---------- клад ----------
export const treasureDug = () => !!(S() && S().flags.coveTreasure);

const cove = createTopDownScene({
  id: 'cove', // имя сцены лежит в сохранениях: { scene: 'cove', x, y } — не менять
  title: 'Карта секретного пляжа',
  w: W,
  h: H,
  base: 'csand',
  bg: '#1a86aa',
  water: { shoreY: 17, foamY: 17 },
  season: 'summer', // тёплое течение: в бухте всегда лето
  dry: true, // ни снега, ни холодного дождя
  clouds: false, // тени облаков на белом песке — серые пятна (как в пустыне)
  build,
  actors: [
    {
      npc: 'pearl',
      at: [AT.rock[0], AT.rock[1] - 0.04],
      still: true,
      act: 'mermaid',
    },
  ],
  places: [
    {
      id: 'grotto',
      tile: 'cgrotto',
      stand: AT.entry,
      reach: 1.6,
      act: 'inside:grotto_cave', // войти в грот (interiors/grotto.js); там нырнуть в озерцо — в город
      map: { icon: '🌊', at: [AT.grotto[0] + 0.5, AT.grotto[1] + 1], label: '🌊 Грот (в город)' },
    },
    {
      id: 'castle',
      at: AT.castle,
      hit: { dx: 34, up: 44, down: 22 },
      stand: [AT.castle[0] + 0.5, AT.castle[1] + 1.5],
      act: 'cove:castle',
      map: { icon: '🏰', at: [AT.castle[0] + 0.5, AT.castle[1] + 0.5], label: '🏰 Замок из песка' },
    },
    {
      id: 'nest',
      at: AT.nest,
      hit: { r: 40 },
      stand: [AT.nest[0] + 0.5, AT.nest[1] + 1.5],
      act: 'cove:nest',
      map: { icon: '🐢', at: [AT.nest[0] + 0.5, AT.nest[1] + 0.5], label: '🐢 Гнездо черепашат' },
    },
    {
      id: 'treasure',
      cell: AT.treasure,
      stand: [AT.treasure[0] + 0.5, AT.treasure[1] + 1.3],
      mark: [AT.treasure[0] + 0.5, AT.treasure[1] + 0.5],
      when: () => !treasureDug(),
      act: 'cove:dig',
      key: false,
      map: { icon: '❌', at: [AT.treasure[0] + 0.5, AT.treasure[1] + 0.5], label: '❌ Клад' },
    },
  ],
  spots: {
    rock: { at: [AT.rock[0] + 0.5, AT.rock[1] - 0.4], label: '🧜‍♀️ Камень Жемчужинки' },
  },
  entries: { grotto: { at: AT.entry } },
  built(sc) {
    // клетки, до которых от грота не дойти, — закрыть
    sc.map.sealFrom([[Math.floor(AT.entry[0]), Math.floor(AT.entry[1])]]);
    sceneMap = sc.map;
    // вода для огоньков: клетки мелководья и глубины (с постоянным «случайным» числом)
    const r = seeded(99),
      out = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (['clag', 'cdeep'].includes(sc.map.at(x, y))) out.push(x, y, r());
    glowCells = out;
    glowShore = [];
    for (let y = 1; y < H; y++)
      for (let x = 0; x < W; x++)
        if (sc.map.at(x, y) === 'clag' && sc.map.at(x, y - 1) === 'csand') glowShore.push(x, y);
  },
  enter(sc) {
    dolph.j = null;
    swim.on = false;
    swim.next = 0;
    hatch.on = false; // ушла — черепашата вернулись в гнездо (провожать — заново)
    hatch.list = [];
    placeShells(sc);
  },
  /** Ночью вода светится. */
  sky(c, sc, lw, lh) {
    const d = darkness();
    if (d > 0.35 && glowCells) drawGlow(c, sc, lw, lh, G.time, clamp((d - 0.35) / 0.3, 0, 1));
  },
  /** Крестик клада (или ямка после раскопок) — прямо на песке; ночью — чёткие огоньки на воде и светящаяся пена. */
  ground(ctx, sc) {
    const d = darkness();
    if (d > 0.35 && glowCells) drawGlowCrisp(ctx, sc, G.time, clamp((d - 0.35) / 0.3, 0, 1));
    const x = (AT.treasure[0] + 0.5) * T,
      y = (AT.treasure[1] + 0.5) * T;
    if (treasureDug()) drawDugHole(ctx, x, y);
    else drawXMark(ctx, x, y, G.time);
  },
  /** Гнездо и черепашата; дельфины вдали. */
  things(sc, add, v) {
    if (swim.on) {
      const q = pearlAt(G.time);
      add(q.y, (ctx, _v, t) => {
        SP.world();
        drawPearlSwim(ctx, q, t);
      });
    }
    const own = ownCastle();
    if (own) add(CASTLE_PX.y, () => put('ownCastle', CASTLE_PX.x, CASTLE_PX.y, own));
    if (dolph.j)
      add(
        dolph.j.y,
        (ctx, j, t) => {
          SP.world();
          drawDolphinJump(ctx, j, t);
        },
        dolph.j,
      );
    const nx = (AT.nest[0] + 0.5) * T,
      ny = (AT.nest[1] + 0.5) * T;
    add(ny - 20, () => put('cnest', nx, ny, hatch.on || SC().turtles ? 1 : 0));
    for (const q of hatch.list) {
      if (q.x < v.x0 || q.x > v.x1 || q.y < v.y0 || q.y > v.y1) continue;
      add(q.y, (ctx) => {
        if (q.sea > 0) ctx.globalAlpha = clamp(1 - q.sea / 1.6, 0, 1);
        put('cturtle', Math.round(q.x), Math.round(q.y), Math.floor(q.step) % 2, q.dir);
        ctx.globalAlpha = 1;
      });
    }
  },
  update(sc, dt) {
    updateTurtles(sc, dt);
    updateDolphins(sc, dt);
    updatePearl(sc);
  },
  /** Вошла в воду ночью — вода светится вокруг (событие: наклейка — features/cove.js). */
  surface(sc, kind, was) {
    const k = TILES[kind],
      w = TILES[was];
    if (k && k.wet && !(w && w.wet) && darkness() > 0.5) emit('cove', { what: 'glow' });
  },
  miniMap(ctx, sc, k) {
    if (!hatch.on) return;
    ctx.fillStyle = '#2f9e44';
    for (const q of hatch.list) if (!q.sea) ctx.fillRect((q.x / T) * k - 1.5, (q.y / T) * k - 1.5, 3, 3);
  },
  cold: () => false, // тёплое течение: здесь не мёрзнут
  /** Что слышно: своя музыка, шум прибоя (громче у воды), чайки днём, сверчки ночью. */
  sound(sc) {
    const ty = sc.p.y / T;
    return { day: 'cove', sea: clamp(0.35 + (ty - 10) / 12, 0.35, 1), rain: 0, birds: true, crickets: true };
  },
});
export default cove;
/** Для отладки и тестов: черепашата (где и сколько в воде). */
export const debugTurtles = () => ({ on: hatch.on, list: hatch.list.map((q) => ({ x: q.x, y: q.y, sea: q.sea })) });
/** Для тестов: дельфины выпрыгивают за мысами прямо сейчас (возвращает прыжок). */
export const debugPearl = (go) => {
  if (go) {
    swim.on = true;
    swim.t0 = G.time;
  }
  return { on: swim.on, at: swim.on ? pearlAt(G.time) : null };
};
export const debugDolphins = (sc) => (showDolphins(sc, 15, 25.5, 1) ? dolph.j : null);

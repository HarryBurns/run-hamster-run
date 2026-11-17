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
import { COVE, SHELL_IDS, FIND_BY_ID, SEASON_OF_MONTH, pickOn, monthOfDay } from '../data/index.js';
import { T, TILES, SP, put, tileOf, createTopDownScene } from '../engine/topdown/index.js';
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
      const ends = (rockAt(x - 1, y + 1) || !rockAt(x - 1, y) ? 1 : 0) | (rockAt(x + 1, y + 1) || !rockAt(x + 1, y) ? 2 : 0);
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
  m.add('signpost', 10, 7, { text: '🌊 Грот', text2: '⛵ В город' });
}
/** Клетки, до которых от грота не дойти, — закрыть. */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[Math.floor(AT.entry[0]), Math.floor(AT.entry[1])]];
  seen[q[0][1] * W + q[0][0]] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !m.foot(nx, ny)) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!seen[y * W + x] && m.foot(x, y)) m.block(x, y);
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
      return { id: 's' + i, at: [SHELL_X[i], sandEnd(SHELL_X[i]) - 1], icon: f.e, give: ['finds', id, 1], text: `+1 ${f.e} ${f.name}`, act: 'cove:shell' };
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
      q.x += ((leader.x - q.x) / d) * sp;
      q.y += ((leader.y - q.y) / d) * sp;
      if (Math.abs(leader.x - q.x) > 2) q.dir = leader.x > q.x ? 1 : -1;
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
let glowCells = null;
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
        r = pass ? 1.3 : 2.3 + tw * 0.6;
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
  actors: [{ npc: 'pearl', at: [AT.rock[0], AT.rock[1] - 0.04], always: true, still: true, act: 'mermaid' }],
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
    sealPockets(sc.map);
    sceneMap = sc.map;
    // вода для огоньков: клетки мелководья и глубины (с постоянным «случайным» числом)
    const r = seeded(99),
      out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (['clag', 'cdeep'].includes(sc.map.at(x, y))) out.push(x, y, r());
    glowCells = out;
  },
  enter(sc) {
    dolph.j = null;
    hatch.on = false; // ушла — черепашата вернулись в гнездо (провожать — заново)
    hatch.list = [];
    placeShells(sc);
  },
  /** Ночью вода светится. */
  sky(c, sc, lw, lh) {
    const d = darkness();
    if (d > 0.35 && glowCells) drawGlow(c, sc, lw, lh, G.time, clamp((d - 0.35) / 0.3, 0, 1));
  },
  /** Крестик клада (или ямка после раскопок) — прямо на песке. */
  ground(ctx) {
    const x = (AT.treasure[0] + 0.5) * T,
      y = (AT.treasure[1] + 0.5) * T;
    if (treasureDug()) drawDugHole(ctx, x, y);
    else drawXMark(ctx, x, y, G.time);
  },
  /** Гнездо и черепашата; дельфины вдали. */
  things(sc, add, v) {
    if (dolph.j)
      add(dolph.j.y, (ctx, j, t) => {
        SP.world();
        drawDolphinJump(ctx, j, t);
      }, dolph.j);
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
export const debugDolphins = (sc) => (showDolphins(sc, 15, 25.5, 1) ? dolph.j : null);
/** Для тестов: места ракушек (клетки). */
export const SHELL_SPOTS = SHELL_X.map((x) => [x, sandEnd(x) - 1]);

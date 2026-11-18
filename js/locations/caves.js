// ПЕЩЕРЫ (П.9) — третье тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образцы — лес и гора (разделы 14, 15). Рисунки — caves_art.js.
//
// Как устроена: карта 36 × 30 правилами (build): вся она — толща скалы, в которой вырезаны залы (CHAMBERS — овалы
// с неровным краем) и ходы между ними (TUNNELS). Снизу — выход к свету (на гору), над ним — большой зал с колоннами;
// на запад — грот с подземным озером, на север от него — грот светящихся грибов; на восток — шахта Камушкина
// с кристальной жилой, вагонеткой и фонарём; на севере — галерея с древними рисунками хомяков, где под потолком
// спят летучие мыши. Стена скалы «лицом» к нам — предметы caveFace по краю скалы над полом. Всё случайное —
// от seeded(), карта всегда одна и та же; клетки, до которых от выхода не дойти, закрываются (sealPockets).
//
// Темнота: sky: false и крюк gloom — тёмный слой с «дырами» света (render.js рисует его маленьким слоем неба,
// почти даром): вокруг хомячка круг света — большой и тёплый с фонариком (находка flashlight), маленький без него
// (фонарик можно выключить кнопкой 🔦 — тогда лучше видно, как светятся грибы); светятся сами грибы, кристаллы,
// фонарь и каска Камушкина, у выхода — дневной свет. Сезонов в пещере нет (season: 'summer' — земля одна и та же).
// Свои музыка и капли (sound → features/soundscape.js, core/audio.js).
import { G, questNow, landOpen } from '../core/state.js';
import { setDayFlag } from '../core/actions.js';
import { toast } from '../ui/toast.js';
import { emit } from '../core/events.js';
import { clamp, seeded } from '../core/util.js';
import { CAVES, QUEST_BY_ID, pickOn } from '../data/index.js';
import { T, put, createTopDownScene } from '../engine/topdown/index.js';
import './caves_art.js';
import './deep_art.js'; // люк с верёвочной лестницей на нижний ярус (этап 17в)
import './common/index.js';

const W = 36,
  H = 30;
// залы: [cx, cy, rx, ry] в клетках (овал; край чуть неровный)
const CHAMBERS = {
  mouth: [17.5, 25.8, 4.6, 3.2], // грот у выхода
  hall: [17.5, 16.5, 6, 3.8], // большой зал с колоннами
  lake: [7.5, 17, 6, 5.5], // подземное озеро
  shrooms: [8.5, 6.5, 5, 3.3], // грот светящихся грибов
  gallery: [24, 6.5, 7, 3.6], // галерея с древними рисунками, летучие мыши
  mine: [29.5, 18.5, 5, 4], // шахта Камушкина
};
// ходы между залами: ломаные [x, y] и полуширина r
const TUNNELS = [
  { r: 1.3, pts: [[17.5, 24], [17.5, 19.5]] },
  { r: 1.15, pts: [[13, 17.2], [9.5, 17]] },
  { r: 1.15, pts: [[22.5, 17.2], [27, 18.5]] },
  { r: 1.15, pts: [[19, 13.5], [21, 11], [22.5, 9]] },
  { r: 1.15, pts: [[6.5, 12.5], [7, 9]] },
  { r: 1.1, pts: [[12.5, 6.5], [15, 5.6], [18, 6]] },
];
const LAKE = [7.5, 18.4, 4, 2.6]; // вода — овал внутри зала с озером
export const AT = {
  paint: [22, 2, 26], // древние рисунки: ряд скалы y = 2, клетки x 22–26 (пол под ними — ряд 3)
  vein: [30, 14], // кристальная жила в северной стене шахты (пол — ряд 15)
  lantern: [32, 17],
  hole: [32, 20], // люк с верёвочной лестницей вниз, к подземной реке (нижний ярус, этап 17в — locations/deep.js)
  minecart: [26, 21],
  pick: [4, 14], // кирка Камушкина на северном берегу озера (задание «Счастливая кирка»)
  exit: [16, 29, 19, 29],
};
/** Места, где растут светящиеся грибы, которые можно сорвать (сегодня — CAVES.shrooms из них, по жребию дня). */
export const SHROOMS = [
  [7, 4],
  [10, 7],
  [5, 7],
  [12, 5],
  [8, 21],
  [29, 6],
];
const S3 = () => G.state.dayFlags.caves || {};
/** Какие места светящихся грибов сегодня «выросли» (номера в SHROOMS) — жребий по номеру дня. */
export const shroomsToday = () =>
  pickOn(
    G.state.day,
    'caves:shroom',
    SHROOMS.map((_, i) => String(i)),
    CAVES.shrooms,
  ).map(Number);
/** Гриб номер i сейчас можно сорвать: вырос сегодня и ещё не сорван. */
export const shroomOn = (i) => shroomsToday().includes(i) && !(S3().shroom || {})[i];
/** Кирка Камушкина лежит у озера: задание «Счастливая кирка» взято, а кирка ещё не найдена. */
export const pickHidden = () => {
  if (!QUEST_BY_ID.lucky_pick) return false;
  const w = questNow('lucky_pick');
  return w.status === 'active' && w.i === 0;
};

// ---------- карта ----------
const inChamber = (x, y, c, wob) => {
  const dx = (x + 0.5 - c[0]) / c[2],
    dy = (y + 0.5 - c[1]) / c[3];
  return dx * dx + dy * dy < 1 + wob;
};
function nearTunnel(x, y) {
  for (const { r, pts } of TUNNELS)
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        px = x + 0.5,
        py = y + 0.5,
        L = (bx - ax) ** 2 + (by - ay) ** 2,
        k = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L, 0, 1),
        d = Math.hypot(px - ax - k * (bx - ax), py - ay - k * (by - ay));
      if (d <= r) return true;
    }
  return false;
}
const isRock = (m, x, y) => x < 0 || y < 0 || x >= W || y >= H || m.at(x, y) === 'caveWall';

function build(m) {
  const rnd = seeded(5813);
  // 1. вырезать залы и ходы
  const floor = new Set();
  for (let y = 1; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const wob = (rnd() - 0.5) * 0.25;
      if (Object.values(CHAMBERS).some((c) => inChamber(x, y, c, wob)) || nearTunnel(x, y)) floor.add(x + ',' + y);
    }
  // выход к свету: ряды 26–29 посередине — всегда пол
  for (let y = 26; y < H; y++) for (let x = 15; x <= 20; x++) if (y < H - 1 || (x >= AT.exit[0] && x <= AT.exit[2])) floor.add(x + ',' + y);
  // ряд с рисунками — скала, под ним — пол; жила в шахте — так же
  for (let x = AT.paint[0] - 1; x <= AT.paint[2] + 1; x++) {
    floor.delete(x + ',' + AT.paint[1]);
    floor.add(x + ',' + (AT.paint[1] + 1));
  }
  for (let x = AT.vein[0] - 1; x <= AT.vein[0] + 1; x++) {
    floor.delete(x + ',' + AT.vein[1]);
    floor.add(x + ',' + (AT.vein[1] + 1));
  }
  for (const k of floor) {
    const [x, y] = k.split(',').map(Number);
    m.set(x, y, y >= 27 ? 'caveMouth' : 'caveFloor');
  }
  // 2. подземное озеро
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (floor.has(x + ',' + y) && inChamber(x, y, LAKE, 0)) m.set(x, y, 'caveLake');
  // 3. стена «лицом» к нам: на клетке скалы, под которой пол (или вода)
  const face = (x, y) => isRock(m, x, y) && y >= 0 && y < H - 1 && !isRock(m, x, y + 1);
  const keep = new Set(); // клетки, где ничего не растёт (особые места, проходы)
  const keepAround = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) keep.add(x + dx + ',' + (y + dy));
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!face(x, y)) continue;
      const ends = (face(x - 1, y) ? 0 : 1) | (face(x + 1, y) ? 0 : 2);
      const r = rnd();
      if (y === AT.paint[1] && x >= AT.paint[0] && x <= AT.paint[2])
        m.add('paintWall', x, y, { p: x - AT.paint[0] });
      else m.add('caveFace', x, y, { v: x === AT.vein[0] && y === AT.vein[1] ? 2 : r < 0.35 ? 1 : r < 0.5 ? 2 : r < 0.65 ? 3 : 0, ends });
    }
  // 4. особые места: что где стоит
  for (const x of [AT.paint[0], AT.paint[2]]) keepAround(x, AT.paint[1] + 1);
  keepAround(24, 4);
  keepAround(AT.vein[0], AT.vein[1] + 1);
  keepAround(AT.pick[0], AT.pick[1]);
  for (const [x, y] of SHROOMS) keepAround(x, y);
  keepAround(17, 27, 2);
  keepAround(28, 19, 1);
  keepAround(AT.hole[0], AT.hole[1]);
  const put1 = (type, x, y, o) => {
    m.clear(x, y);
    m.add(type, x, y, o);
    keep.add(x + ',' + y);
  };
  put1('crystals', AT.vein[0] - 1, AT.vein[1] + 1, { v: 0 });
  put1('crystals', AT.vein[0] + 1, AT.vein[1] + 1, { v: 1 });
  put1('caveLantern', ...AT.lantern);
  put1('ropeHole', ...AT.hole, { open: () => landOpen('deep') });
  put1('minecart', ...AT.minecart);
  // рельсы — от вагонетки (она у стены) вправо по полу её ряда
  const [cx, cy] = AT.minecart;
  for (let x = cx + 1; x <= cx + 7 && m.at(x, cy) === 'caveFloor'; x++) put1('rails', x, cy, { v: 0 });
  put1('column', 14, 15, { v: 0 });
  put1('column', 21, 15, { v: 1 });
  put1('signpost', 20, 24, { text: '⛏️ Шахта', text2: '🌊 Озеро' });
  put1('signpost', 15, 13, { text: '🎨 Рисунки', text2: '🍄 Грибы' });
  for (const [x, y, v] of [
    [12, 19, 2],
    [12, 13, 1],
    [33, 17, 2],
    [25, 16, 0],
    [19, 4, 1],
    [30, 8, 0],
    [3, 20, 1],
  ])
    if (floor.has(x + ',' + y) && m.at(x, y) !== 'caveLake') put1('crystals', x, y, { v });
  for (const [x, y, v] of [
    [5, 5, 0],
    [11, 4, 1],
    [4, 8, 1],
    [13, 8, 0],
    [8, 9, 0],
    [2, 15, 1],
    [13, 21, 0],
    [27, 8, 1],
  ])
    if (floor.has(x + ',' + y) && m.at(x, y) !== 'caveLake') put1('glowShroom', x, y, { v });
  // 5. сталагмиты по залам — не на проходах и не у особых мест
  const taken = new Set(m.objs.map((o) => o.tx + ',' + o.ty));
  for (let y = 1; y < H - 3; y++)
    for (let x = 1; x < W - 1; x++) {
      const r = rnd(),
        v = Math.floor(rnd() * 3);
      if (m.at(x, y) !== 'caveFloor' || keep.has(x + ',' + y) || nearTunnel(x, y) || taken.has(x + ',' + y)) continue;
      // у стены — чаще, посреди зала — реже; прямо под стеной не ставим (закрыл бы её «лицо»)
      const byWall = isRock(m, x - 1, y) || isRock(m, x + 1, y) || isRock(m, x, y + 1);
      if (isRock(m, x, y - 1)) continue;
      if (r < (byWall ? 0.16 : 0.04)) m.add('stalagmite', x, y, { v });
    }
}

/** Клетки, до которых от выхода не дойти пешком, — закрыть. */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[17, 28]];
  seen[28 * W + 17] = 1;
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

// ---------- летучие мыши: висят под сводом галереи, вспархивают, когда подходишь ----------
let bats = [];
/** Летучие мыши — на «лицах» скалы галереи, кроме рисунков (зовётся, когда карта построена). */
function placeBats(m) {
  bats = [];
  const spots = m.objs.filter((o) => o.type === 'caveFace' && o.ty <= 4 && o.tx >= 17 && o.tx <= 31);
  spots.forEach((o, i) => {
    if (i % 2) return;
    for (const dx of [-11, 9])
      bats.push({ hx: o.x + dx, hy: o.y + 64 + (dx > 0 ? 4 : 0), ph: (o.tx * 7 + dx) % 5, fly: 0, rest: 0 });
  });
}
const BAT_FLY = 3.2; // сколько секунд кружат
// Ночью летучие мыши улетают «гулять» (П6): с 20:30 до 21:00 одна за другой вылетают к выходу из пещер, всю ночь
// их нет, с 5:00 до 5:30 возвращаются. Возвращает 0 — висят дома, 1 — улетели; между — доля пути (вылет / возврат).
const BAT_OUT = [20.5 * 60, 21 * 60],
  BAT_IN = [5 * 60, 5.5 * 60];
export function batsAway(min = G.state ? G.state.minutes : 720) {
  if (min >= BAT_OUT[1] || min < BAT_IN[0]) return 1;
  if (min >= BAT_OUT[0]) return (min - BAT_OUT[0]) / (BAT_OUT[1] - BAT_OUT[0]);
  if (min < BAT_IN[1]) return 1 - (min - BAT_IN[0]) / (BAT_IN[1] - BAT_IN[0]);
  return 0;
}
/** Доля пути одной мыши (у каждой своя очередь вылета): 0 — дома, 1 — снаружи. */
const batOut = (b, k) => clamp(k * 1.8 - (b.ph / 5) * 0.8, 0, 1);
function updateBats(sc, dt) {
  const p = sc.p,
    away = batsAway();
  if (away > 0) {
    // ночью под сводом пусто — подсказка, куда делись мыши (раз в день, когда подошла к галерее)
    const near = bats.some((b) => Math.hypot(p.x - b.hx, p.y - 40 - b.hy) < T * 3);
    if (away >= 1 && near && !(G.state.dayFlags.caves || {}).batsOut) {
      setDayFlag('batsOut', 1, 'caves');
      toast('🦇 Летучих мышей нет — ночью они улетают гулять наружу, над горой. К утру вернутся домой!');
    }
    return;
  }
  let scared = false;
  for (const b of bats) {
    if (b.fly > 0) b.fly = Math.max(0, b.fly - dt);
    else if (b.rest > 0) b.rest -= dt;
    else if (Math.hypot(p.x - b.hx, p.y - 40 - b.hy) < T * 2.4) {
      b.fly = BAT_FLY;
      b.rest = 4;
      scared = true;
    }
  }
  if (scared) emit('caves', { what: 'bats' });
}
/** Где мышь сейчас: висит — дома; летит — петля «восьмёркой» и обратно домой; вечером — улетает к выходу. */
function batPos(b, t) {
  const away = batsAway();
  if (away > 0) {
    const k = batOut(b, away);
    if (k <= 0) return { x: b.hx, y: b.hy, wing: 0 };
    if (k >= 1) return null;
    // вниз по галерее к выходу, покачиваясь, с каждым взмахом дальше
    return { x: b.hx + Math.sin(k * 9 + b.ph) * 60 * k, y: b.hy + k * 520 - Math.sin(k * Math.PI) * 60, wing: Math.floor(t * 10 + b.ph) % 2 ? 1 : 2, a: 1 - k };
  }
  if (b.fly <= 0) return { x: b.hx, y: b.hy, wing: 0 };
  const k = 1 - b.fly / BAT_FLY,
    env = Math.sin(k * Math.PI),
    a = k * Math.PI * 4 + b.ph;
  return {
    x: b.hx + Math.sin(a) * 110 * env,
    y: b.hy + 30 * env + Math.sin(a * 2) * 40 * env,
    wing: Math.floor(t * 10 + b.ph) % 2 ? 1 : 2,
  };
}

// ---------- фонарик ----------
/** Есть ли у хомячка свет: фонарик или надетая каска с фонариком (без них в пещере видно только маленький круг). */
export const hasLamp = () => (G.state.finds.flashlight || 0) > 0 || G.state.look.outfit.head === 'helmet_lamp';
let lampOff = false; // выключила фонарик кнопкой 🔦 (не сохраняется: вошла в пещеры — фонарик снова горит)
const lampOn = () => hasLamp() && !lampOff;
/** Включить или выключить фонарик (кнопка HUD). */
export function toggleLamp() {
  lampOff = !lampOff;
  emit('hud');
  return !lampOff;
}

const gloomLights = [];
const caves = createTopDownScene({
  id: 'caves', // имя сцены лежит в сохранениях: { scene: 'caves', x, y } — не менять
  title: 'Карта пещер',
  w: W,
  h: H,
  base: 'caveWall',
  bg: '#2e2734',
  sky: false,
  dark: 0,
  season: 'summer', // сезонов под землёй нет
  build,
  actors: [{ npc: 'kamushkin', at: [28.5, 19.5], always: true, act: 'miner' }],
  places: [
    {
      id: 'paint',
      at: [24, AT.paint[1]],
      hit: { dx: 120, up: 0, down: 80 },
      stand: [24.5, 3.7],
      act: 'caves:paint',
      map: { icon: '🎨', at: [24.5, 3.3], label: '🎨 Древние рисунки' },
    },
    {
      id: 'vein',
      at: AT.vein,
      hit: { dx: 60, up: 0, down: 80 },
      stand: [AT.vein[0] + 0.5, AT.vein[1] + 1.6],
      act: 'caves:crystals',
      key: false,
      map: { icon: '⛏️', at: [AT.vein[0] + 0.5, AT.vein[1] + 1.3], label: '⛏️ Кристальная жила' },
    },
    {
      id: 'lake',
      tile: 'caveLake',
      stand: [7.5, 15.4],
      act: 'caves:lake',
      key: false,
      map: { icon: '🌊', at: [LAKE[0], LAKE[1]], label: '🌊 Подземное озеро' },
    },
    // люк с верёвочной лестницей на нижний ярус (этап 17в): открыт — спуск к подземной реке; закрыт — кто знает дорогу
    {
      id: 'ladder',
      at: AT.hole,
      hit: { dx: 40, up: 40, down: 30 },
      stand: [AT.hole[0] - 0.5, AT.hole[1] + 0.6],
      act: 'way:deep',
      key: false,
      map: { icon: '🪜', at: [AT.hole[0] + 0.5, AT.hole[1] + 0.5], label: '🪜 Лестница вниз', lock: () => !landOpen('deep') },
    },
    // кирка Камушкина (задание «Счастливая кирка»): видна, пока её не нашли
    { id: 'pick', at: AT.pick, hit: { r: 40 }, stand: [AT.pick[0] + 0.5, AT.pick[1] + 1.4], when: pickHidden, act: 'caves:pick', key: false },
    ...SHROOMS.map(([x, y], i) => ({
      id: 'shroom' + i,
      at: [x, y],
      hit: { r: 36 },
      stand: [x + 0.5, y + 1.5],
      mark: [x + 0.5, y + 0.5],
      when: () => shroomOn(i),
      reach: 1.4,
      act: 'caves:shroom:' + i,
    })),
  ],
  spots: {
    grotto: { at: [8.5, 6.8], label: '🍄 Грот светящихся грибов' },
    hall: { at: [17.5, 18.5], label: '🏛️ Большой зал' },
  },
  // с горы входят через скалу у вершины (way:caves); выход к свету — внизу, на гору ко входу caves
  entries: { gate: { at: [17.5, 27.6] }, ladder: { at: [AT.hole[0] - 0.5, AT.hole[1] + 0.6] } },
  exits: [{ id: 'mountain', area: AT.exit, to: 'mountain', entry: 'caves' }],
  built(sc) {
    sealPockets(sc.map);
    placeBats(sc.map);
  },
  enter() {
    lampOff = false; // вошла — фонарик горит
  },
  /** Темнота пещеры и пятна света (слой неба, render.js): хомячок с фонариком, грибы, каска Камушкина, выход. */
  gloom(sc) {
    const on = lampOn();
    gloomLights.length = 0;
    gloomLights.push([17.5 * T + 24, (H - 0.5) * T, 260, 190, 1]); // дневной свет у выхода
    for (const n of sc.npcs) if (!n.hidden) gloomLights.push([n.x, n.y - 50, 120, 100, 0.95]); // каска с фонарём
    SHROOMS.forEach(([x, y], i) => {
      if (shroomOn(i)) gloomLights.push([(x + 0.5) * T, (y + 0.4) * T, 70, 60, 1]);
    });
    if (pickHidden()) gloomLights.push([(AT.pick[0] + 0.5) * T, (AT.pick[1] + 0.5) * T, 34, 30, 0.5]);
    return {
      tint: [10, 8, 26, 0.9],
      hero: on ? [310, 270, 1] : [100, 88, 0.95],
      lights: gloomLights,
      warm: on ? 0.32 : 0.12,
    };
  },
  /** Блики фонарика на воде озера: тёплые дрожащие чёрточки рядом с хомячком. */
  ground(ctx, sc, env) {
    if (!lampOn()) return;
    const m = sc.map,
      hx = sc.p.x / T,
      hy = sc.p.y / T;
    if (hx > 16 || hy < 12 || hy > 25) return;
    ctx.strokeStyle = 'rgba(255,214,150,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = Math.floor(hy - 4); y <= hy + 4; y++)
      for (let x = Math.floor(hx - 4); x <= hx + 4; x++) {
        if (m.at(x, y) !== 'caveLake' || Math.hypot(x + 0.5 - hx, y + 0.5 - hy) > 4) continue;
        for (let k = 0; k < 2; k++) {
          const by = y * T + 12 + k * 20 + Math.sin(env.t * 2 + x + k) * 2,
            bx = x * T + 8 + ((x * 13 + k * 17) % 20),
            w = 8 + Math.sin(env.t * 3 + y + k * 2) * 5;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + w, by);
        }
      }
    ctx.stroke();
  },
  things(sc, add, v) {
    const t = G.time;
    // светящиеся грибы, которые можно сорвать
    SHROOMS.forEach(([x, y], i) => {
      if (!shroomOn(i)) return;
      const px = (x + 0.5) * T,
        py = (y + 0.5) * T;
      if (px > v.x0 && px < v.x1 && py > v.y0 && py < v.y1) add(py + 4, () => put('shroomBig', px, py + 8 + Math.sin(t * 2 + i) * 1.2));
    });
    // кирка Камушкина
    if (pickHidden()) {
      const px = (AT.pick[0] + 0.5) * T,
        py = (AT.pick[1] + 0.5) * T;
      add(py, () => put('pick', px, py + 6));
    }
    // летучие мыши (висят под сводом — рисуются поверх стены, «late»)
    for (const b of bats) {
      if (b.hx < v.x0 || b.hx > v.x1 || b.hy < v.y0 - 200 || b.hy > v.y1) continue;
      const q = batPos(b, t);
      if (!q) continue; // ночью улетела гулять
      add(
        b.hy + 40,
        (ctx) => {
          if (q.a !== undefined) ctx.globalAlpha = clamp(q.a * 2, 0, 1);
          put('bat', q.x, q.y + (q.wing ? 0 : Math.sin(t * 1.5 + b.ph) * 1.5), q.wing);
          ctx.globalAlpha = 1;
        },
        null,
        true,
      );
    }
  },
  update(sc, dt) {
    updateBats(sc, dt);
  },
  buttons: () =>
    hasLamp() ? [{ id: 'lamp', icon: '🔦', label: lampOn() ? 'Фонарик' : 'Включить', on: lampOn(), fn: () => toggleLamp() }] : [],
  cold: () => false, // под землёй прохладно, но не мороз
  /** Что слышно: своя музыка, капли; у озера — тихий плеск, у выхода — ветер с горы. */
  sound(sc) {
    const tx = sc.p.x / T,
      ty = sc.p.y / T;
    return {
      force: 'caves',
      day: 'caves',
      sea: clamp(0.18 - Math.hypot(tx - LAKE[0], ty - LAKE[1]) * 0.02, 0, 0.18),
      rain: 0,
      birds: false,
      crickets: false,
      wind: clamp((ty - 24) / 6, 0, 1) * 0.3,
      drips: 1,
    };
  },
});
export default caves;

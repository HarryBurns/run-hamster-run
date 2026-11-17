// ЛЕС (П.9) — первое тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»). Рисунки своих клеток, предметов и станции — forest_art.js.
//
// Как устроен: карта 50 × 40 правилами (build): тропа от ворот (юг, из города) к поляне с костром посередине;
// от неё — на север к грибной поляне и домику на дереве, на запад к избушке лесника на опушке, на восток через
// мостик над ручьём — к улью, дубу с белкой, ягодной поляне и станции канатной дороги (на гору; пока закрыта).
// Остальное — густой лес: ели, сосны, берёзы, лиственные деревья, кусты (сквозь них медленно), пни, брёвна,
// камни с мхом, папоротники. Всё случайное — от seeded(), карта всегда одна и та же. Клетки, до которых от ворот
// не дойти, после постройки закрываются (sealPockets) — так в «кармане» между деревьями никто не застрянет.
//
// Что здесь делают (действия реестра — features/forest.js): лесник Шишкин (житель, разговор 'forester'), сбор
// (растения с плодами — common/plants.js, сколько — FOREST_GATHER в economy.js; шишки и зимой еловые веточки —
// находки на земле), улей, белка, костёр, домик на дереве, бельчонок из задания Шишкина, станция канатной дороги
// (way:mountain — замочек, LANDS). Атмосфера: днём лучики сквозь кроны, зимой падает снег, ночью темно,
// светлячки летом (их рисует движок над травой), у ручья журчит вода.
import { G, cal, questNow, darkness, ownsHome, landOpen } from '../core/state.js';
import { clamp, seeded } from '../core/util.js';
import { FOREST_GATHER, FOREST, QUEST_BY_ID, FIND_BY_ID, wildIn, DAYS_PER_MONTH } from '../data/index.js';
import { T, put, createTopDownScene } from '../engine/topdown/index.js';
import { createPlants } from './common/plants.js';
import { hutArt, cabinArt, drawCabinPlate, drawSunbeams } from './forest_art.js';
import './common/index.js';

const W = 50,
  H = 40;
/** Левая клетка ручья в ряду y (ручей — две клетки шириной, с севера на юг, плавно петляет). */
const brookX = (y) => Math.round(33 + Math.sin(y * 0.33) * 1.6);
const BRIDGE = [21, 22]; // ряды мостика (через него идёт тропа на восток)

// ---------- тропы и поляны ----------
// Тропа — ломаная в клетках; r — полуширина: 0,75 — в две клетки (точки на границе клеток), 0,55 — в одну.
const PATHS = [
  {
    r: 0.75,
    pts: [
      [11, 40],
      [11, 34],
      [15, 31],
      [20, 26.5],
      [24.5, 24],
    ],
  }, // от ворот к костру
  {
    r: 0.55,
    pts: [
      [11, 34.5],
      [7.5, 33.5],
      [5.5, 32.5],
    ],
  }, // к избушке
  {
    r: 0.55,
    pts: [
      [24.5, 18],
      [22.5, 14.5],
      [18.5, 12.5],
      [13.5, 12.5],
    ],
  }, // на север, к домику на дереве
  {
    r: 0.55,
    pts: [
      [22.5, 14.5],
      [25.5, 10.5],
      [27.5, 7.5],
    ],
  }, // к грибной поляне
  {
    r: 0.55,
    pts: [
      [7.5, 33.5],
      [8.5, 24.5],
      [11.5, 16.5],
      [13, 12.5],
    ],
  }, // западная тропка: кругом
  {
    r: 0.75,
    pts: [
      [28, 22],
      [39, 22],
      [41.5, 19],
    ],
  }, // на восток, через мостик
  {
    r: 0.55,
    pts: [
      [41.5, 18.5],
      [42.5, 12.5],
      [44.5, 8.5],
      [44, 6],
    ],
  }, // к станции канатной дороги
  {
    r: 0.55,
    pts: [
      [39.5, 22],
      [40.5, 26.5],
      [40.5, 32.5],
    ],
  }, // к белке и ягодам
];
// поляны: круг [cx, cy, r] или прямоугольник [x0, y0, x1, y1] (в клетках) — там не растут деревья
const GLADES = {
  fire: { c: [24.5, 21.5, 4.2] },
  hut: { box: [2, 27, 13, 36] },
  treehouse: { box: [9, 7, 17, 13] },
  mushrooms: { c: [27.5, 6.5, 3.2] },
  hive: { box: [38, 11, 46, 18] },
  station: { box: [39, 2, 47, 8] },
  oak: { c: [42.5, 27, 3.2] },
  berries: { box: [37, 30, 46, 36] },
};
const inGlade = (x, y) => {
  const cx = x + 0.5,
    cy = y + 0.5;
  return Object.values(GLADES).some((g) =>
    g.c
      ? Math.hypot(cx - g.c[0], cy - g.c[1]) <= g.c[2]
      : x >= g.box[0] && x <= g.box[2] && y >= g.box[1] && y <= g.box[3],
  );
};

// ---------- что растёт и где (сколько всего — FOREST_GATHER; автотест сверяет с картой) ----------
const FRUIT = [
  // грибы — осенью: на грибной поляне, у костра, под ёлками
  ['mushrooms', 26, 8],
  ['mushrooms', 29, 7],
  ['mushrooms', 25, 5],
  ['mushrooms', 21, 12],
  ['mushrooms', 16, 13],
  ['mushrooms', 21, 19],
  ['mushrooms', 26, 24],
  ['mushrooms', 9, 22],
  // белые грибы — летом и осенью
  ['porcini', 22, 17],
  ['porcini', 17, 11],
  ['porcini', 28, 9],
  ['porcini', 10, 27],
  // черника — летом, на ягодной поляне
  ['berryBush', 38, 32],
  ['berryBush', 40, 34],
  ['berryBush', 42, 31],
  ['berryBush', 44, 33],
  ['berryBush', 45, 35],
  ['berryBush', 38, 35],
  // лесная земляника — весной и летом
  ['wildStrawberry', 8, 29],
  ['wildStrawberry', 12, 31],
  ['wildStrawberry', 21, 23],
  ['wildStrawberry', 27, 19],
  // лещина — осенью орешки
  ['hazelBush', 39, 25],
  ['hazelBush', 45, 27],
  ['hazelBush', 39, 29],
  ['hazelBush', 45, 31],
  // яблоня на опушке, у избушки лесника — в конце лета и осенью
  ['appleTree', 10, 28],
];
// находки на земле: шишки под ёлками — каждый день, еловые веточки — зимой (WILD_MONTHS.firTwig)
const CONES = [
  [13, 30],
  [18, 28],
  [22, 15],
  [26, 11],
  [31, 23],
  [40, 20],
];
const TWIGS = [
  [16, 30],
  [19, 13],
  [29, 5],
  [43, 9],
];
// особые места
const AT = {
  hut: { x: 4, y: 30, w: 3, h: 2 },
  cabin: { x: 14, y: 33, w: 3, h: 2 }, // лесной домик: дверь внизу посередине — клетка (15, 35)
  station: { x: 42, y: 3, w: 4, h: 2 },
  fire: [24, 21],
  hive: [42, 14],
  oak: [42, 26],
  treehouse: [12, 10],
  kit: [29, 5], // бельчонок из задания Шишкина
};
const monthNow = () => Math.floor(G.state.day / DAYS_PER_MONTH) % 12;
/** Горит ли костёр (вечером и ночью). */
export const fireBurning = () => {
  const m = G.state.minutes;
  return m >= FOREST.fire[0] || m < FOREST.fire[1];
};
/** Работают ли пчёлы (летом и осенью). */
export const beesBusy = () => wildIn('bees', monthNow());
/** Прячется ли в лесу бельчонок: задание Шишкина взято, а бельчонок ещё не найден. */
export const kitHidden = () => {
  if (!QUEST_BY_ID.squirrel_kit) return false;
  const w = questNow('squirrel_kit');
  return w.status === 'active' && w.i === 0;
};

function build(m) {
  const rnd = seeded(912);
  // 1. лесная подстилка большими пятнами (где гуще ели)
  const dense = (x, y) => Math.sin(x * 0.31) + Math.sin(y * 0.27 + 1) + Math.sin((x + y) * 0.19 + 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (dense(x, y) > 0.5 && !inGlade(x, y)) m.set(x, y, 'forestFloor');
  // 2. тропы
  const path = new Set();
  for (const { r, pts } of PATHS)
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
      for (let k = 0; k <= n; k++) {
        const px = ax + ((bx - ax) * k) / n,
          py = ay + ((by - ay) * k) / n;
        for (let y = Math.floor(py - 1); y <= py + 1; y++)
          for (let x = Math.floor(px - 1); x <= px + 1; x++)
            if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) {
              m.set(x, y, 'y');
              path.add(x + ',' + y);
            }
      }
    }
  // 3. ручей с мостиком
  const brook = new Set();
  for (let y = 0; y < H; y++) {
    const bx = brookX(y);
    for (const x of [bx, bx + 1]) {
      brook.add(x + ',' + y);
      m.set(x, y, BRIDGE.includes(y) ? 'logBridge' : 'brook');
    }
  }
  const free = (x, y) => !path.has(x + ',' + y) && !brook.has(x + ',' + y);
  // 4. деревья: по краю — стеной, внутри — гуще там, где подстилка; на полянах — цветы
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!free(x, y)) continue;
      const r = rnd(),
        edge = x < 2 || y < 2 || x > W - 3 || y > H - 3,
        glade = inGlade(x, y),
        floor = m.at(x, y) === 'forestFloor';
      if (glade) {
        if (r < 0.12) m.add('flowers', x, y, { v: Math.floor(rnd() * 3) });
        else if (r < 0.16) m.add('fern', x, y, { v: Math.floor(rnd() * 2) });
        continue;
      }
      // у ручья — реже (берег), у самого мостика — свободно
      const nearBrook = Math.abs(x - brookX(y) - 0.5) < 2.2;
      if (edge ? r < 0.96 : r < (nearBrook ? 0.24 : floor ? 0.5 : 0.36)) {
        const k = rnd(),
          v = Math.floor(rnd() * 3);
        if (floor || edge) m.add(k < 0.55 ? 'spruce' : k < 0.8 ? 'pine' : 'birch', x, y, { v });
        else if (k < 0.4) m.add('tree', x, y, { v }); // лиственное (плодов на обычных деревьях нет)
        else m.add(k < 0.7 ? 'birch' : 'spruce', x, y, { v });
        continue;
      }
      const d = rnd();
      if (d < 0.07) m.add('bush', x, y, { v: Math.floor(rnd() * 3) });
      else if (d < 0.17) m.add('fern', x, y, { v: Math.floor(rnd() * 2) });
      else if (d < 0.2) m.add('stump', x, y);
      else if (d < 0.23) m.add('mossRock', x, y, { v: Math.floor(rnd() * 2) });
      else if (d < 0.245) m.add('log', x, y);
      else if (d < 0.28 && !floor) m.add('flowers', x, y, { v: Math.floor(rnd() * 3) });
    }
  // 5. особые предметы — на место того, что выросло (m.clear)
  const put1 = (type, x, y, o) => {
    m.clear(x, y);
    m.add(type, x, y, o);
  };
  for (const [type, x, y] of FRUIT) put1(type, x, y, { v: (x + y) % 2 });
  for (const [x, y] of [...CONES, ...TWIGS]) m.clear(x, y); // там лежат находки — клетка свободна
  put1('campfire', ...AT.fire, { burning: fireBurning });
  put1('log', AT.fire[0] - 2, AT.fire[1]);
  put1('log', AT.fire[0] + 2, AT.fire[1]);
  put1('stump', AT.fire[0], AT.fire[1] - 2);
  put1('hive', ...AT.hive, { busy: beesBusy });
  for (const x of [AT.oak[0], AT.oak[0] + 1]) m.clear(x, AT.oak[1]);
  m.add('squirrelOak', ...AT.oak);
  for (const x of [AT.treehouse[0], AT.treehouse[0] + 1]) m.clear(x, AT.treehouse[1]);
  m.add('treehouse', ...AT.treehouse);
  // указатель у ворот
  put1('signpost', 12, 36, { text: '🏙️ Город', text2: '🔥 Костёр' });
  // перед зданиями — свободно (там двери)
  for (const b of [AT.hut, AT.station, AT.cabin])
    for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y; y <= b.y + b.h + 1; y++) m.clear(x, y);
  // полянка вокруг лесного домика: расчищена после того, как всё выросло (случайные числа леса не сдвигаются),
  // у крыльца — цветы
  for (let y = 32; y <= 38; y++)
    for (let x = 12; x <= 18; x++) if (!path.has(x + ',' + y) && !(x === 12 && y === 36)) m.clear(x, y);
  for (const [x, y, v] of [
    [13, 36, 0],
    [17, 36, 2],
    [18, 33, 1],
  ])
    m.add('flowers', x, y, { v });
}

/** Клетки, до которых от ворот не дойти пешком, — закрыть (чтобы туда не попасть и ничего там не потерять). */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[10, 38]];
  seen[38 * W + 10] = 1;
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

/** Находки дня: шишки — всегда, еловые веточки — зимой. Утром появляются снова (движок, dayFlags.finds). */
function dailyPickups(sc) {
  const list = CONES.map(([x, y], i) => ({
    id: 'cone' + i,
    at: [x, y],
    icon: FIND_BY_ID.cone.e,
    give: ['finds', 'cone', 1],
    text: `+1 ${FIND_BY_ID.cone.e} Шишка`,
  }));
  if (wildIn('firTwig', monthNow()))
    TWIGS.forEach(([x, y], i) =>
      list.push({
        id: 'twig' + i,
        at: [x, y],
        icon: '🎄',
        give: ['finds', 'fir_twig', 1],
        text: '+1 🎄 Еловая веточка',
      }),
    );
  sc.setPickups(list);
}

// ---------- снег зимой (если в этот день нет снегопада в погоде) ----------
const flakes = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 0.618) % 1,
  y: (i * 0.377) % 1,
  s: 0.6 + ((i * 0.29) % 0.7),
  ph: i,
}));
function drawSnow(ctx, w, h, t) {
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  for (const q of flakes) {
    const y = ((q.y + t * 0.05 * q.s) % 1.05) * h,
      x = (q.x * w + Math.sin(t * 1.1 + q.ph) * 8 + w) % w,
      r = 1.6 + q.s * 1.6;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 6.2832);
  }
  ctx.fill();
}

const plants = createPlants(); // подпись «Сорвать…», кнопка и клавиша E у растений с плодами

const forest = createTopDownScene({
  id: 'forest', // имя сцены лежит в сохранениях: { scene: 'forest', x, y } — не менять
  title: 'Карта леса',
  w: W,
  h: H,
  base: 'g',
  bg: '#2b6b3a',
  build,
  gather: FOREST_GATHER, // сколько дают растения леса (common/plants.js)
  buildings: [
    // избушка лесника на опушке: постучать — выйдет Шишкин
    {
      id: 'hut',
      kind: 'house',
      ...AT.hut,
      npc: 'shishkin',
      name: 'Избушка лесника',
      icon: '🛖',
      wall: '#d9a066',
      roof: '#5c7c34',
      shutters: '#8d5524',
      smoke: true,
      attic: false,
      art: hutArt,
      frame: [-64, -100, 3 * T + 64, 2 * T + 44],
      act: 'inside:hut_shishkin', // войти — внутри Шишкин (interiors/hut_shishkin.js)
    },
    // лесной домик — своё жильё (HOMES.cabin, building: 'cabin'): куплен — войти, нет — окно риелтора
    {
      id: 'cabin',
      kind: 'house',
      ...AT.cabin,
      name: 'Лесной домик',
      icon: '🏠',
      wall: '#c98b5a',
      roof: '#b8553a',
      shutters: '#2f9e44',
      smoke: true,
      art: cabinArt,
      frame: [-56, -100, 3 * T + 56, 2 * T + 44],
      act: 'home:cabin',
    },
    // станция канатной дороги: на гору (открывает задание Сени — LANDS.mountain); пока закрыто — окно с замочком,
    // открыто — вагончик ездит по тросу, а вход везёт наверх (way:mountain → cableway:up, features/mountain.js)
    {
      id: 'station',
      kind: 'cableway',
      ...AT.station,
      name: 'Канатная дорога',
      icon: '🚡',
      act: 'way:mountain',
      signText: () => (landOpen('mountain') ? '🚡 На гору' : '🔒 На гору'),
      running: () => landOpen('mountain'),
    },
  ],
  actors: [{ npc: 'shishkin', at: [9, 31], home: 'hut', always: true, act: 'forester' }],
  places: [
    {
      id: 'campfire',
      at: AT.fire,
      hit: { r: 46 },
      stand: [24.5, 22.7],
      act: 'forest:fire',
      map: { icon: '🔥', at: [24.5, 21.5], label: '🔥 Костёр' },
    },
    {
      id: 'hive',
      at: AT.hive,
      hit: { dx: 30, up: 52, down: 22 },
      stand: [42.5, 15.6],
      act: 'forest:hive',
      map: { icon: '🍯', at: [42.5, 14.5], label: '🍯 Улей' },
    },
    {
      id: 'squirrel',
      at: AT.oak,
      hit: { dx: 62, up: 130, down: 22 },
      stand: [42.9, 27.6],
      mark: [43, 26.5],
      act: 'forest:squirrel',
      map: { icon: '🐿️', at: [43, 26.5], label: '🐿️ Белка' },
    },
    {
      id: 'treehouse',
      at: AT.treehouse,
      hit: { dx: 70, up: 180, down: 22 },
      stand: [12.6, 11.5],
      mark: [13, 10.5],
      act: 'forest:treehouse',
      map: { icon: '🏡', at: [13, 10.5], label: '🏡 Домик на дереве' },
    },
    { id: 'kit', at: AT.kit, hit: { r: 40 }, stand: [29.5, 6.6], when: kitHidden, act: 'forest:kit', key: false },
  ],
  spots: {
    mushrooms: { at: [27.5, 6.6], label: '🍄 Грибная поляна' },
    berries: { at: [41.5, 33.5], label: '🫐 Ягодная поляна' },
    gate: { at: [10.5, 39.5], label: '🏙️ Тропа в город' },
  },
  // из города приходят по тропе (вход gate, у ворот); выход — нижняя кромка тропы: назад в город, за ворота виллы
  // с горы — на станцию канатной дороги (features/mountain.js, cableway:down)
  entries: { gate: { at: [10.5, 37.5], from: 'world' }, station: { building: 'station' } },
  exits: [{ id: 'town', area: [10, 39, 11, 39], to: 'world', entry: 'forest' }],
  // где разбрасывать предметы заданий (письма с loc: 'forest'): поляны и тропы
  zones: { glade: { tiles: ['g', 'y'], reach: { from: [10, 37] } } },
  parts: [plants],
  critters: 3, // бабочек днём и светлячков ночью — втрое больше, чем в городе (движок, render.js)
  critterTiles: ['g', 'forestFloor'],
  /** Перила мостика — неподвижный рисунок поверх земли (попадает в её кэш). */
  paintGround(ctx, env, x0, y0, x1, y1) {
    const bx = brookX(BRIDGE[0]),
      [r0, r1] = BRIDGE;
    if (x1 < bx - 1 || x0 > bx + 2 || y1 < r0 - 1 || y0 > r1 + 1) return;
    for (const yy of [r0 * T + 3, (r1 + 1) * T - 3]) {
      ctx.lineCap = 'round';
      for (const [w, c] of [
        [6, '#4a3728'],
        [3, '#e0ac78'],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(bx * T - 6, yy);
        ctx.lineTo((bx + 2) * T + 6, yy);
        ctx.stroke();
      }
      for (let i = 0; i <= 2; i++) {
        const px = bx * T - 6 + i * (T + 6);
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.arc(px, yy, 5.5, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#a8703f';
        ctx.beginPath();
        ctx.arc(px, yy, 3.5, 0, 6.2832);
        ctx.fill();
      }
    }
  },
  built(sc) {
    sealPockets(sc.map);
  },
  enter(sc) {
    dailyPickups(sc);
  },
  /**
   * Табличка у лесного домика («🔑 мой дом» или «ПРОДАЁТСЯ») и бельчонок из задания Шишкина: сидит в траве, пока
   * его не нашли (особое место kit).
   */
  things(sc, add, v) {
    const cb = sc.map.bById.cabin;
    if (cb.x * T < v.x1 + 60 && (cb.x + cb.w) * T > v.x0 - 60 && cb.y * T < v.y1 && (cb.y + cb.h) * T > v.y0)
      add((cb.y + cb.h) * T + 2, (ctx) => drawCabinPlate(ctx, cb, ownsHome('cabin')));
    if (!kitHidden()) return;
    const x = (AT.kit[0] + 0.5) * T,
      y = (AT.kit[1] + 0.5) * T;
    if (x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1)
      add(y + 12, (ctx, _v, t) =>
        put('squirrelKit', x, y + 8 + (Math.sin(t * 6) > 0.6 ? -4 : 0), Math.round(Math.sin(t * 4) * 2), -1),
      );
  },
  /** Лучики сквозь кроны днём — в слое неба (он есть, когда видны тени облаков: днём без дождя и снега). */
  sky(c, sc, lw, lh) {
    const d = sc.darkness();
    if (d < 0.3) drawSunbeams(c, lw, lh, G.time, (0.3 - d) / 0.3);
  },
  /** Зимой — тихий снег (если в погоде снегопада нет). */
  overlay(ctx, sc, w, h) {
    const weather = G.state.weather;
    if (cal().season === 'winter' && weather !== 'snow' && weather !== 'rain') drawSnow(ctx, w, h, G.time);
  },
  /** В лесу темнее, чем в городе (фонарей нет): ночью светят только костёр, окна избушки и светлячки. */
  dark: () => Math.min(0.95, darkness() * 1.12),
  /** Что слышно: лесная музыка, птицы днём, сверчки ночью, у ручья журчит вода (тихий «шум моря»). */
  sound: (sc) => ({
    day: 'forest',
    sea: clamp(0.3 - Math.abs(sc.p.x / T - brookX(Math.floor(sc.p.y / T)) - 1) * 0.05, 0, 0.3),
    rain: 1,
    birds: true,
    crickets: true,
  }),
});
export default forest;

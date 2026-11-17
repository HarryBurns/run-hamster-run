// ПУСТЫНЯ (П.9) — четвёртое тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образцы — лес, гора и пещеры (разделы 14–16). Рисунки —
// desert_art.js.
//
// Как устроена: карта 44 × 40 правилами (build). Снизу — остановка каравана (приехали из города на караван-автобусе),
// от неё на север бежит караванная тропа к оазису: вода, трава и пальмы, рядом — шатёр кочевника Бархана и его
// верблюд Финик (катание по кругу — верблюжья тропа на востоке). На северо-западе — пирамида с загадкой «Пары»
// и обелисками, на северо-востоке — раскопки (мини-игра «Раскопки»), на западе — кактусы-опунции с плодами (весной
// и летом), на юго-западе — старый колодец, на севере — Звёздный бархан (ночью там загадывают желание), на юго-
// востоке — мираж: озеро вдали, которое тает, когда подходишь. Всё остальное — барханы с рябью (гребни — клетки
// duneHi), кактусы-столбики, камни-песчаники и сухие кустики; по краю — скалы. Всё случайное — от seeded(), карта
// всегда одна и та же; клетки, до которых от остановки не дойти, закрываются (sealPockets).
//
// Атмосфера: дождя и снега здесь не бывает (dry), рисуется всегда летом (season); днём — жаркое марево (крюк sky:
// тёплые полосы в маленьком слое неба — почти даром), катится перекати-поле, ночью падают звёзды (overlay — одна
// чёрточка за раз). Свои музыка и ветер (sound → features/soundscape.js); у верблюда, когда бубенчик нашёлся, —
// звон бубенчика (колокольчики, как у коров на горе). Днём без шляпы жарко — крюк hot (добрая подсказка —
// features/desert.js).
import { G, questNow } from '../core/state.js';
import { emit } from '../core/events.js';
import { keys } from '../core/input.js';
import { clamp, seeded } from '../core/util.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { DESERT, DESERT_GATHER, QUEST_BY_ID } from '../data/index.js';
import { T, PS, SP, put, createTopDownScene } from '../engine/topdown/index.js';
import { createPlants } from './common/plants.js';
import './desert_art.js';
import './common/index.js';

const W = 44,
  H = 40;
// ---------- тропы (ломаные в клетках; r — полуширина) ----------
const PATHS = [
  {
    r: 0.75,
    pts: [
      [21.5, 37],
      [21.5, 30],
      [23, 25],
      [23.5, 21],
    ],
  }, // от остановки к оазису
  {
    r: 0.6,
    pts: [
      [23.5, 21],
      [21, 14],
      [15, 11.5],
      [8.5, 10.3],
    ],
  }, // от оазиса к пирамиде
  {
    r: 0.6,
    pts: [
      [21, 14],
      [21.5, 7],
    ],
  }, // к Звёздному бархану
  {
    r: 0.6,
    pts: [
      [23.5, 21],
      [28, 13],
      [34.5, 11],
    ],
  }, // к раскопкам
  {
    r: 0.55,
    pts: [
      [21.5, 30],
      [14, 30.5],
      [10, 32.5],
    ],
  }, // к старому колодцу
  {
    r: 0.55,
    pts: [
      [13, 22.5],
      [8, 23.5],
    ],
  }, // от оазиса к кактусам
];
// особые места
export const AT = {
  stop: { x: 19, y: 34, w: 4, h: 2 }, // остановка каравана: дверь — клетка (21, 36)
  tent: { x: 24, y: 16, w: 4, h: 2 }, // шатёр Бархана: дверь — клетка (26, 18)
  pyramid: { x: 6, y: 6, w: 5, h: 3 }, // пирамида: вход — клетка (8, 9)
  oasis: [17.5, 19.6, 3.8, 2.5], // вода: центр и полуоси (клетки)
  grass: [17.5, 19.8, 6.4, 4.4], // трава вокруг воды
  dig: [32, 7, 36, 9], // раскоп (клетки внутри верёвочной ограды)
  camel: [29, 18], // привязь верблюда
  ring: [33.5, 24.5, 3.2, 2.2], // верблюжья тропа: центр и полуоси
  well: [9, 31],
  bell: [11, 32], // бубенчик Финика (задание «Бубенчик верблюда»)
  stars: [21, 4], // фонарь-звезда на Звёздном бархане
  cacti: [
    [5, 21],
    [8, 25],
  ], // опунции с плодами (DESERT_GATHER)
  mirage: [39, 30.5], // где видно мираж (клетки, середина)
};
/** Бубенчик лежит у колодца: задание «Бубенчик верблюда» взято, а бубенчик ещё не найден. */
export const bellHidden = () => {
  if (!QUEST_BY_ID.camel_bell) return false;
  const w = questNow('camel_bell');
  return w.status === 'active' && w.i === 0;
};
/** Бубенчик уже на верблюде (задание дальше первого шага или сдано) — Финик звенит. */
const bellOn = () => {
  if (!QUEST_BY_ID.camel_bell) return false;
  const w = questNow('camel_bell');
  return w.status === 'done' || (w.status === 'active' && w.i > 0);
};

// ---------- карта ----------
const inEll = (x, y, e, k = 1) => ((x + 0.5 - e[0]) / e[2]) ** 2 + ((y + 0.5 - e[1]) / e[3]) ** 2 < k;
// гребни барханов: серп — эллипс с «выкушенным» с подветренной стороны боком [cx, cy, rx, ry, dx, dy]
const DUNES = [
  [21, 4.6, 6, 2.6, 0, 1.6], // Звёздный бархан
  [14, 27, 4.4, 2.2, 1, 1.3],
  [30, 30.5, 4.6, 2.4, -1, 1.2],
  [38, 16, 3.6, 3, -1.3, 1.2],
  [13, 15.5, 3.6, 2, 0.8, 1.1],
  [31, 3.5, 4.4, 1.8, 0.6, 1],
  [4, 14, 2.6, 3.4, 1.2, 0.6],
  [37, 35.5, 3.6, 1.6, -0.8, 1],
  [5, 34.5, 3, 1.8, 0.8, 1],
  [28, 9, 2.4, 1.6, 0.6, 1],
];
const inDune = (x, y) =>
  DUNES.some(([cx, cy, rx, ry, dx, dy]) => inEll(x, y, [cx, cy, rx, ry]) && !inEll(x, y, [cx + dx, cy + dy, rx * 0.9, ry * 0.85]));
// «тихие» места: тут ничего случайного не растёт
const CALM = [
  [18, 32, 27, 38], // остановка и автобус
  [22, 14, 31, 21], // шатёр и верблюд
  [3, 5, 14, 13], // пирамида и тропа к ней
  [30, 5, 38, 12], // раскопки
  [29, 21, 38, 28], // верблюжья тропа
  [34, 27, 43, 34], // мираж: открытые барханы
  [3, 19, 10, 27], // кактусы
  [7, 29, 13, 34], // колодец
  [17, 2, 25, 7], // Звёздный бархан
];
const calm = (x, y) => CALM.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

function build(m) {
  const rnd = seeded(7349);
  // 1. гребни барханов; оазис: вода и трава вокруг
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inDune(x, y)) m.set(x, y, 'duneHi');
      if (inEll(x, y, AT.grass, 1 + (rnd() - 0.5) * 0.12)) m.set(x, y, 'g');
      if (inEll(x, y, AT.oasis)) m.set(x, y, 'oasisWater');
    }
  // 2. раскоп
  for (let y = AT.dig[1]; y <= AT.dig[3]; y++) for (let x = AT.dig[0]; x <= AT.dig[2]; x++) m.set(x, y, 'digPit');
  // 3. тропы и верблюжья тропа по кругу
  const path = new Set();
  const mark = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = m.at(x, y);
    if (c !== 'oasisWater' && c !== 'digPit') m.set(x, y, 'trail');
    path.add(x + ',' + y);
  };
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
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) mark(x, y);
      }
    }
  const [rcx, rcy, rrx, rry] = AT.ring;
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const px = rcx + Math.cos(a) * rrx,
      py = rcy + Math.sin(a) * rry;
    mark(Math.floor(px), Math.floor(py));
  }
  // к кругу — от шатра
  for (let y = 19; y <= 22; y++) mark(30, y);
  const free = (x, y) => !path.has(x + ',' + y) && !['oasisWater', 'digPit', 'g'].includes(m.at(x, y));
  // 4. край карты — скалы и кактусы; внутри — редкие кактусы, камни и кустики
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = rnd(),
        v = Math.floor(rnd() * 3),
        edge = x < 2 || y < 2 || x > W - 3 || y > H - 3;
      if (!free(x, y)) continue;
      if (edge) {
        if (r < 0.75) m.add('sandRock', x, y, { v: 2 });
        else m.add('saguaro', x, y, { v });
        continue;
      }
      if (calm(x, y)) continue;
      const belowPath = path.has(x + ',' + (y - 1)) || path.has(x + ',' + (y - 2));
      if (r < (belowPath ? 0.01 : 0.035)) m.add('saguaro', x, y, { v });
      else if (r < 0.06) m.add('sandRock', x, y, { v: v % 2 });
      else if (r < 0.1) m.add('dryBush', x, y, { v: v % 2 });
    }
  // 5. особые предметы — на место того, что выросло (m.clear)
  const put1 = (type, x, y, o) => {
    m.clear(x, y);
    m.add(type, x, y, o);
  };
  // пальмы вокруг оазиса (по краю травы)
  for (const [x, y] of [
    [12, 18],
    [14, 16],
    [19, 16],
    [22, 17],
    [12, 21],
    [14, 23],
    [20, 23],
  ])
    put1('palm', x, y);
  // кактусы-опунции с плодами (сбор — common/plants.js) и кактусы-столбики рядом
  for (const [x, y] of AT.cacti) put1('pricklyPear', x, y);
  for (const [x, y, v] of [
    [4, 24, 0],
    [9, 22, 1],
    [7, 20, 2],
    [3, 21, 1],
  ])
    put1('saguaro', x, y, { v });
  // пирамида: обелиски по бокам входа
  put1('obelisk', 5, 9);
  put1('obelisk', 12, 9);
  // раскоп: верёвочная ограда (вход снизу посередине), инструменты
  const [dx0, dy0, dx1, dy1] = AT.dig;
  for (let x = dx0 - 1; x <= dx1 + 1; x++) {
    put1('fenceH', x, dy0 - 1, { v: 1 });
    if (x !== 34) put1('fenceH', x, dy1 + 1, { v: 1 });
    else m.clear(x, dy1 + 1);
  }
  for (let y = dy0; y <= dy1; y++) {
    put1('fenceV', dx0 - 1, y, { v: 1 });
    put1('fenceV', dx1 + 1, y, { v: 1 });
  }
  put1('digTools', dx1, dy0);
  // верблюд у привязи (пока на нём катаются — у привязи пусто: рисует способ передвижения героя)
  put1('camel', ...AT.camel, { away: () => riding });
  // колодец; фонарь-звезда на Звёздном бархане; автобус у остановки
  put1('well', ...AT.well);
  m.clear(...AT.bell);
  put1('starPost', ...AT.stars);
  put1('safariBus', 24, 35);
  for (const x of [25, 26]) m.clear(x, 35);
  // указатели
  put1('signpost', 23, 29, { text: '🌴 Оазис', text2: '🪣 Колодец' });
  put1('signpost', 20, 13, { text: '🌠 Бархан', text2: '🔺 Пирамида' });
  put1('signpost', 30, 12, { text: '🦴 Раскопки' });
  // перед зданиями — свободно (там двери)
  for (const b of [AT.stop, AT.tent, AT.pyramid])
    for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y; y <= b.y + b.h + 1; y++) if (m.at(x, y) !== 'oasisWater') m.clear(x, y);
}

/** Клетки, до которых от остановки не дойти пешком, — закрыть. */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[21, 37]];
  seen[37 * W + 21] = 1;
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

// ---------- катание на верблюде: хомячок верхом на Финике, круг по верблюжьей тропе ----------
let riding = false,
  rideT = 0;
const isRiding = (sc) => !!(sc.p.ride && sc.p.ride.camel);
/** Сесть на верблюда: способ передвижения ride — хомячок сам не ходит, верблюд везёт его по кругу. */
export function startCamelRide(sc) {
  if (isRiding(sc)) return false;
  const p = sc.p;
  p.path = [];
  p.pending = null;
  riding = true;
  rideT = 0;
  placeOnRing(p, 0);
  p.ride = {
    camel: true,
    speed: 0,
    pass: () => false,
    draw(ctx, _sc, e, t, look) {
      const leg = 1 + (Math.floor(t * 4) % 2);
      put('camel', e.x, e.y + 8, e.dir || 1, leg);
      SP.world(); // спрайт рисуется в пикселях устройства — дальше снова координаты мира
      const sx = e.x - (e.dir || 1) * 4,
        sy = e.y - 38 + (leg === 1 ? -1.5 : 0);
      drawHamster(ctx, sx, sy, PS * 0.86, look, { time: t, dir: e.dir || 1, clipBelow: -24, happy: true, blink: blinkAt(t) });
    },
    drop: (s) => endCamelRide(s),
  };
  return true;
}
/** Точка на верблюжьей тропе: k — доля круга (0 — внизу, у шатра). */
function placeOnRing(p, k) {
  const [cx, cy, rx, ry] = AT.ring,
    a = Math.PI * (1.25 - 2 * k), // по часовой стрелке, начиная слева снизу
    x = cx + Math.cos(a) * rx,
    y = cy + Math.sin(a) * ry;
  const nx = cx + Math.cos(a - 0.05) * rx;
  p.dir = nx >= x ? 1 : -1;
  p.x = x * T;
  p.y = y * T;
}
/** Слезть с верблюда (круг пройден — событие ride). false — хомячок и так не на верблюде. */
export function endCamelRide(sc, done = false) {
  if (!isRiding(sc)) return false;
  sc.p.ride = null;
  riding = false;
  sc.p.x = (AT.camel[0] + 0.5) * T;
  sc.p.y = (AT.camel[1] + 1.6) * T;
  if (done) emit('desert', { what: 'ride' });
  return true;
}
function updateRide(sc, dt) {
  if (!isRiding(sc)) {
    riding = false;
    return;
  }
  rideT += dt;
  const k = Math.min(1, rideT / DESERT.ride);
  placeOnRing(sc.p, k);
  if (k >= 1) endCamelRide(sc, true);
}

// ---------- мираж: озеро вдали тает, когда подходишь ----------
let mirageNear = false;
const MIRAGE_X = AT.mirage[0] * T,
  MIRAGE_Y = AT.mirage[1] * T;
const daytime = (sc) => sc.darkness() < 0.3;
function updateMirage(sc) {
  if (!daytime(sc)) return;
  const d = Math.hypot(sc.p.x - MIRAGE_X, sc.p.y - MIRAGE_Y);
  if (d < T * 3.2 && !mirageNear) {
    mirageNear = true;
    emit('desert', { what: 'mirage' });
  } else if (d > T * 9) mirageNear = false;
}
/** Насколько виден мираж: вдали — почти целиком, ближе 3 клеток — нет совсем. */
export const mirageAlpha = (sc) =>
  daytime(sc) ? clamp((Math.hypot(sc.p.x - MIRAGE_X, sc.p.y - MIRAGE_Y) - T * 3) / (T * 6), 0, 0.85) : 0;

// ---------- перекати-поле и звездопад ----------
const WEEDS = [
  { y: 27.6, sp: 46, off: 0 },
  { y: 12.6, sp: 38, off: 900 },
];
function drawWeeds(add, v) {
  const span = W * T + 300;
  for (const q of WEEDS) {
    const x = ((G.time * q.sp + q.off) % span) - 150,
      y = q.y * T + Math.abs(Math.sin(G.time * 3 + q.off)) * -10;
    if (x < v.x0 || x > v.x1 || q.y * T < v.y0 || q.y * T > v.y1) continue;
    add(q.y * T, () => put('tumbleweed', x, y + 6, Math.floor(x / 10) & 3));
  }
}
/** Падающая звезда ночью: одна светлая чёрточка через экран раз в несколько секунд (экранные координаты). */
function drawShootingStar(ctx, w, h, t) {
  const cyc = 4.5,
    i = Math.floor(t / cyc),
    k = (t % cyc) / 1.1;
  if (k > 1) return;
  const sx = (((i * 0.37) % 1) * 0.7 + 0.15) * w,
    sy = (((i * 0.61) % 1) * 0.35 + 0.05) * h,
    len = Math.min(w, h) * 0.3,
    x = sx + k * len,
    y = sy + k * len * 0.45;
  ctx.globalAlpha = Math.sin(k * Math.PI);
  ctx.strokeStyle = 'rgba(255,250,220,.95)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - len * 0.35, y - len * 0.16);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- жаркое марево: тёплые полосы в маленьком слое неба (его растягивает страница — кадр не дорожает) ----------
function drawHaze(c, lw, lh, t) {
  c.fillStyle = 'rgba(255,214,140,.07)';
  c.fillRect(0, 0, lw, lh);
  c.fillStyle = 'rgba(255,246,220,.09)';
  for (let i = 0; i < 4; i++) {
    const y0 = ((i * 0.27 + t * 0.015) % 1) * lh * 1.2 - lh * 0.1,
      bh = lh * 0.05;
    c.beginPath();
    c.moveTo(0, y0);
    for (let x = 0; x <= lw; x += lw / 8) c.lineTo(x, y0 + Math.sin(x * 0.08 + t * 1.4 + i) * bh * 0.6);
    for (let x = lw; x >= 0; x -= lw / 8) c.lineTo(x, y0 + bh + Math.sin(x * 0.08 + t * 1.4 + i + 1) * bh * 0.6);
    c.fill();
  }
}

const plants = createPlants(); // подпись «Сорвать…», кнопка и клавиша E у опунций с плодами
const desert = createTopDownScene({
  id: 'desert', // имя сцены лежит в сохранениях: { scene: 'desert', x, y } — не менять
  title: 'Карта пустыни',
  w: W,
  h: H,
  base: 'dune',
  bg: '#e9c58a',
  season: 'summer', // в пустыне всегда жарко: земля и пальмы — летние
  dry: true, // дождя и снега не бывает
  clouds: false, // и туч нет: тени облаков на песке выглядели бы грязными пятнами
  gather: DESERT_GATHER, // сколько дают опунции (common/plants.js)
  build,
  buildings: [
    // остановка каравана: обратно в город (caravan:back — features/desert.js)
    { id: 'stop', kind: 'caravanStop', ...AT.stop, name: 'Остановка каравана', mapName: 'Караван в город', icon: '🚌', act: 'caravan:back' },
    // шатёр кочевника Бархана у оазиса
    { id: 'tent', kind: 'tent', ...AT.tent, name: 'Шатёр', mapName: 'Шатёр Бархана', icon: '⛺', act: 'inside:tent_barkhan' },
    // пирамида: внутри — загадка «Пары»
    { id: 'pyramid', kind: 'pyramid', ...AT.pyramid, name: 'Пирамида', icon: '🔺', act: 'inside:pyramid_hall' },
  ],
  actors: [{ npc: 'barkhan', at: [27.5, 19.6], home: 'tent', always: true, act: 'nomad' }],
  places: [
    {
      id: 'dig',
      area: AT.dig,
      stand: [34.5, 9.5],
      act: 'desert:dig',
      key: false,
      map: { icon: '🦴', at: [34.5, 8.5], label: '🦴 Раскопки' },
    },
    {
      id: 'camel',
      at: AT.camel,
      hit: { dx: 56, up: 96, down: 24 },
      stand: [AT.camel[0] + 0.5, AT.camel[1] + 1.6],
      when: () => !riding,
      act: 'desert:camel',
      map: { icon: '🐫', at: [AT.camel[0] + 0.5, AT.camel[1] + 0.5], label: '🐫 Верблюд Финик' },
    },
    {
      id: 'stars',
      at: AT.stars,
      hit: { dx: 40, up: 110, down: 24 },
      stand: [AT.stars[0] + 0.5, AT.stars[1] + 1.6],
      act: 'desert:stars',
      map: { icon: '🌠', at: [AT.stars[0] + 0.5, AT.stars[1] + 0.5], label: '🌠 Звёздный бархан' },
    },
    {
      id: 'oasis',
      tile: 'oasisWater',
      stand: [17.5, 22.6],
      act: 'desert:oasis',
      key: false,
      map: { icon: '🌴', at: [AT.oasis[0], AT.oasis[1]], label: '🌴 Оазис' },
    },
    {
      id: 'well',
      at: AT.well,
      hit: { dx: 40, up: 80, down: 22 },
      stand: [AT.well[0] + 0.5, AT.well[1] + 1.6],
      act: 'desert:well',
      map: { icon: '🪣', at: [AT.well[0] + 0.5, AT.well[1] + 0.5], label: '🪣 Старый колодец' },
    },
    // бубенчик Финика (задание «Бубенчик верблюда»): виден, пока его не нашли
    { id: 'bell', at: AT.bell, hit: { r: 40 }, stand: [AT.bell[0] + 0.5, AT.bell[1] + 1.4], when: bellHidden, act: 'desert:bell', key: false },
  ],
  spots: {
    cacti: { at: [6.5, 23.5], label: '🌵 Кактусы' },
    ring: { at: [AT.ring[0], AT.ring[1] + AT.ring[3]], label: '🐫 Верблюжья тропа' },
  },
  // из города приезжают на караван-автобусе (вход stop — у остановки)
  entries: { stop: { building: 'stop' } },
  // где разбрасывать предметы заданий (письма с loc: 'desert'): тропы и барханы
  zones: { dunes: { tiles: ['dune', 'trail'], reach: { from: [21, 37] } } },
  parts: [plants],
  built(sc) {
    sealPockets(sc.map);
  },
  enter(sc) {
    mirageNear = false;
    if (isRiding(sc)) endCamelRide(sc);
    riding = false;
  },
  /** Днём — жаркое марево в слое неба. */
  sky(c, sc, lw, lh) {
    if (daytime(sc)) drawHaze(c, lw, lh, G.time);
  },
  /** Ночью падают звёзды. */
  overlay(ctx, sc, w, h) {
    if (sc.darkness() > 0.5) drawShootingStar(ctx, w, h, G.time);
  },
  things(sc, add, v) {
    // мираж вдали (тает, когда подходишь)
    const a = mirageAlpha(sc);
    if (a > 0.02 && MIRAGE_X > v.x0 - 150 && MIRAGE_X < v.x1 + 150 && MIRAGE_Y > v.y0 && MIRAGE_Y < v.y1)
      add(MIRAGE_Y - 40, (ctx, _v, t) => {
        ctx.globalAlpha = a * (0.85 + Math.sin(t * 2) * 0.15);
        put('mirage', MIRAGE_X + Math.sin(t * 1.3) * 3, MIRAGE_Y);
        ctx.globalAlpha = 1;
      });
    // бубенчик у колодца
    if (bellHidden()) {
      const bx = (AT.bell[0] + 0.5) * T,
        by = (AT.bell[1] + 0.5) * T;
      if (bx > v.x0 && bx < v.x1 && by > v.y0 && by < v.y1)
        add(by, (ctx, _v, t) => put('bell', bx, by + 6 + (Math.sin(t * 3) > 0.7 ? -2 : 0)));
    }
    drawWeeds(add, v);
  },
  /** На верблюде: нажатие куда угодно, стрелки и E ничего не ломают — Финик сам довезёт по кругу. */
  tap: (sc) => isRiding(sc),
  interact: (sc) => isRiding(sc),
  update(sc, dt) {
    if (isRiding(sc) && ['Escape'].some((k) => keys.has(k))) endCamelRide(sc);
    updateRide(sc, dt);
    updateMirage(sc);
  },
  buttons: (sc) => (isRiding(sc) ? [{ id: 'camel', icon: '🐫', label: 'Слезть', fn: () => endCamelRide(sc) }] : []),
  cold: () => false, // в пустыне не мёрзнут
  /** Жарко ли без шляпы: днём (подсказка — features/desert.js). */
  hot: (sc) => daytime(sc),
  /** Что слышно: своя музыка, ветер; у оазиса — тихий плеск; у верблюда с бубенчиком — дзынь-дзынь. */
  sound(sc) {
    const tx = sc.p.x / T,
      ty = sc.p.y / T,
      camel = isRiding(sc) ? 0 : Math.hypot(tx - AT.camel[0] - 0.5, ty - AT.camel[1] - 0.5);
    return {
      day: 'desert',
      sea: clamp(0.16 - Math.hypot(tx - AT.oasis[0], ty - AT.oasis[1]) * 0.02, 0, 0.16),
      rain: 0,
      birds: false,
      crickets: true,
      wind: 0.3 + clamp((6 - ty) / 6, 0, 1) * 0.3,
      bells: bellOn() ? clamp(1 - camel / 7, 0, 1) * 0.8 : 0,
    };
  },
});
export default desert;

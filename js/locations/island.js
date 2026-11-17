// УДАЛЁННЫЙ ОСТРОВ (П.9) — седьмое, последнее тайное место. Описание для «движка локаций» (engine/topdown/scene.js);
// рецепт — docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образцы — джунгли и секретный пляж (разделы 18–19).
// Рисунки — island_art.js.
//
// Как устроен: карта 40 × 36 правилами (build). Снизу — пляж и причал (приплыли из города на кораблике), хижина у
// причала — обратно в город. От причала на север бежит песчаная тропинка в деревню островитян: площадь с костром,
// вокруг — факелы и тотемы, хижины на сваях (хижина вождя Кокоса, домики островитян и хижина для гостей — в ней
// можно переночевать). Ещё севернее — вулкан: дымит днём, а ночью лава в кратере светится (крюк sky — пятно в
// маленьком слое неба, почти даром); у подножия — чёрное вулканическое стекло (кусочек в день), от него тропинка
// поднимается к смотровой у кратера (оттуда вулкан виден целиком, с дымком). На востоке —
// дорожка для «Кокосового боулинга» с кеглями-тотемчиками. Кругом пальмы, цветущие кусты (каждый день на одном из
// мест распускается цветок для леи — находка pickups), монстеры. Всё случайное — от seeded(), карта всегда одна и
// та же; клетки, до которых от причала не дойти, закрываются (sealPockets).
//
// Вечером (ISLAND.fest — с 19:00 до 22:00) у костра — праздник огней: гирлянда огоньков между факелами (днём её нет,
// ночью огоньки светятся в слое неба), вокруг костра танцуют островитяне (готовые кадры из кэша спрайтов — дёшево).
// Подошла к костру — можно потанцевать (features/island.js, сценка и наклейка).
//
// Атмосфера: всегда лето (season), снега и холодного дождя не бывает (dry), бабочки днём, светлячки ночью; своя
// музыка с барабанами (sound → features/soundscape.js), у моря шумит прибой.
import { G, darkness } from '../core/state.js';
import { setFlag, setDayFlag } from '../core/actions.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui/toast.js';
import { clamp, seeded } from '../core/util.js';
import { ell } from '../core/draw.js';
import { drawHamster } from '../art/hamster.js';
import { ISLAND, LEI_IDS, FIND_BY_ID, pickOn, resolveLook } from '../data/index.js';
import { T, PS, SP, put, hash, defineArt, createTopDownScene } from '../engine/topdown/index.js';
import './island_art.js';
import './cove_art.js'; // бирюзовая вода лагуны (clag, cdeep) — как в бухте секретного пляжа
import './common/index.js';

const W = 40,
  H = 36;
// ---------- где что ----------
export const AT = {
  volcano: [20, 7], // вулкан: нижний ряд — клетки 16–24 ряда 7
  lookout: [24.2, 3.4], // смотровая у кратера (сюда ведёт тропинка от стекла; камера показывает вулкан целиком)
  obsidian: [25, 8], // чёрное стекло у подножия
  fire: [20, 16], // костёр на площади
  plaza: [20, 16.5, 4.4, 2.9], // площадь: центр и полуоси (клетки)
  drum: [24, 15], // барабан Бума
  dock: { x: 15, y: 25, w: 3, h: 2 }, // хижина у причала: дверь — клетка (16, 27)
  chief: { x: 9, y: 12, w: 5, h: 2 }, // хижина вождя: дверь — клетка (11, 14)
  laguna: { x: 25, y: 11, w: 3, h: 2 }, // домик Лагуны: дверь — (26, 13)
  guest: { x: 27, y: 18, w: 3, h: 2 }, // хижина для гостей: дверь — (28, 20)
  bum: { x: 8, y: 19, w: 3, h: 2 }, // домик Бума: дверь — (9, 21)
  lane: [30, 23, 36, 25], // дорожка боулинга (клетки)
  lagoon: [8, 31.7, 5.4, 2.5], // тёплая лагуна для купания у западного пляжа (О10): центр и полуоси (клетки)
  pins: [36, 24], // кегли-тотемчики
  torches: [
    [15, 14],
    [25, 14],
    [15, 19],
    [25, 19],
  ],
  totems: [
    [13, 16, 0],
    [27, 15, 1],
    [29, 22, 2],
    [29, 26, 0],
    [14, 11, 1],
  ],
};
/** Где за день распускается цветок для леи (одно место в день — жребий дня). */
export const FLOWER_SPOTS = [
  [12, 24],
  [23, 22],
  [7, 15],
  [32, 15],
  [15, 9],
  [26, 26],
  [6, 25],
  [33, 19],
];
const PATHS = [
  {
    r: 0.7,
    pts: [
      [19.5, 28],
      [19.5, 23],
      [20.3, 19.6],
    ],
  }, // от причала к площади
  {
    r: 0.6,
    pts: [
      [20.5, 13.6],
      [21, 11],
      [21.5, 9.6],
      [25.5, 9.6],
    ],
  }, // от площади к вулкану и к стеклу
  {
    r: 0.55,
    pts: [
      [25.5, 9.6],
      [27.2, 8.8],
      [27.4, 5.6],
      [25.8, 3.3],
      [23.8, 2.9],
    ],
  }, // тропинка вверх, к смотровой у кратера (оттуда вулкан виден целиком)
  {
    r: 0.55,
    pts: [
      [16, 16.4],
      [13, 15.4],
      [11.5, 14.6],
    ],
  }, // к хижине вождя
  {
    r: 0.55,
    pts: [
      [24.4, 17.6],
      [27, 19.6],
      [28.5, 20.6],
      [29.5, 24.4],
    ],
  }, // к хижине для гостей и к боулингу
  {
    r: 0.5,
    pts: [
      [16.2, 18.4],
      [12, 20.6],
      [9.5, 21.6],
    ],
  }, // к домику Бума
  {
    r: 0.5,
    pts: [
      [23.6, 14.6],
      [26.5, 13.6],
    ],
  }, // к домику Лагуны
];
// «тихие» места: здесь ничего случайного не растёт
const CALM = [
  [13, 24, 24, 35], // причал и хижина
  [13, 12, 27, 21], // площадь
  [7, 11, 15, 15], // хижина вождя
  [24, 10, 30, 14], // домик Лагуны
  [26, 17, 31, 21], // хижина для гостей
  [6, 18, 12, 22], // домик Бума
  [28, 21, 38, 27], // боулинг
  [15, 8, 27, 10], // подножие вулкана
  [23, 1, 30, 10], // тропинка к смотровой у кратера
];
const calm = (x, y) => CALM.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
/** Где начинается пляж в столбце x. */
export const sandY = (x) => 28 + Math.round(Math.sin(x * 0.5) * 0.7);
const inEll = (x, y, e) => ((x + 0.5 - e[0]) / e[2]) ** 2 + ((y + 0.5 - e[1]) / e[3]) ** 2 < 1;

function stroke(pts, r, fn) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i],
      n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
    for (let k = 0; k <= n; k++) {
      const px = ax + ((bx - ax) * k) / n,
        py = ay + ((by - ay) * k) / n;
      for (let y = Math.floor(py - r - 1); y <= py + r + 1; y++)
        for (let x = Math.floor(px - r - 1); x <= px + r + 1; x++)
          if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) fn(x, y);
    }
  }
}

function build(m) {
  const rnd = seeded(7741);
  // 1. пляж и море снизу; вокруг вулкана — тёмная вулканическая земля
  for (let x = 0; x < W; x++) {
    const sy = sandY(x);
    for (let y = sy; y < H; y++) m.set(x, y, y >= sy + 3 ? 'O' : y >= sy + 2 ? 'h' : 's');
  }
  for (let y = 0; y < 13; y++) for (let x = 0; x < W; x++) if (inEll(x, y, [20.5, 4.5, 13, 6.6])) m.set(x, y, 'iash');
  // лагуна (О10): бирюзовое мелководье у пляжа — плавать можно, вода тёплая (swim where: 'cove' — не «ледяное море»)
  const [lx, ly, lrx, lry] = AT.lagoon;
  for (let y = 26; y < H; y++)
    for (let x = 1; x < 16; x++) {
      const d = ((x + 0.5 - lx) / lrx) ** 2 + ((y + 0.5 - ly) / lry) ** 2;
      if (d < 1) m.set(x, y, 'clag');
    }
  // 2. площадь у костра, дорожка боулинга, тропинки
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inEll(x, y, AT.plaza)) m.set(x, y, 'iplaza');
  const [lx0, ly0, lx1, ly1] = AT.lane;
  for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) m.set(x, y, 'ilane');
  const path = new Set();
  for (const { r, pts } of PATHS)
    stroke(pts, r, (x, y) => {
      const c = m.at(x, y);
      if (!['s', 'h', 'O', 'iplaza', 'ilane'].includes(c)) m.set(x, y, 'itrail');
      path.add(x + ',' + y);
    });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (['iplaza', 'ilane'].includes(m.at(x, y))) path.add(x + ',' + y);
  // причал: доски от пляжа в море
  for (let y = 28; y <= 33; y++) for (const x of [19, 20]) m.set(x, y, 'i');
  const free = (x, y) => !path.has(x + ',' + y) && ['igrass', 'iash'].includes(m.at(x, y));
  // 3. край карты — деревья и бамбук; внутри — пальмы, кусты, цветы
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!free(x, y)) continue;
      const r = rnd(),
        v = Math.floor(rnd() * 3),
        edge = x < 2 || y < 2 || x > W - 3,
        ash = m.at(x, y) === 'iash';
      if (edge) {
        if (ash) m.add(r < 0.6 ? 'mossRock' : 'bamboo', x, y, { v: v % 2 });
        else if (r < 0.7) m.add('jtree', x, y, { v });
        else m.add('palm', x, y);
        continue;
      }
      if (calm(x, y)) {
        if (r < 0.07 && !ash) m.add('jflowers', x, y, { v });
        continue;
      }
      // к югу от тропы высокое не растёт: кроны закрыли бы тропинку и хомячка
      const belowPath = [1, 2].some((k) => [-1, 0, 1].some((dx) => path.has(x + dx + ',' + (y - k))));
      if (ash) {
        if (r < 0.22) m.add('mossRock', x, y, { v: v % 2 });
        else if (r < 0.28 && !belowPath) m.add('fern', x, y, { v: v % 2 });
        continue;
      }
      if (belowPath) {
        if (r < 0.14) m.add('monstera', x, y, { v: v % 2 });
        else if (r < 0.24) m.add('jflowers', x, y, { v });
        else if (r < 0.3) m.add('fern', x, y, { v: v % 2 });
        continue;
      }
      if (r < 0.18) m.add('palm', x, y);
      else if (r < 0.26) m.add('jtree', x, y, { v });
      else if (r < 0.36) m.add('monstera', x, y, { v: v % 2 });
      else if (r < 0.44) m.add('jflowers', x, y, { v });
      else if (r < 0.5) m.add('fern', x, y, { v: v % 2 });
    }
  // пальмы вдоль пляжа
  for (let x = 3; x < W - 3; x += 3) {
    const y = sandY(x) - 1;
    if (!path.has(x + ',' + y) && m.at(x, y) === 'igrass' && !calm(x, y)) {
      m.clear(x, y);
      m.add('palm', x, y);
    }
  }
  // лагуну от моря отделяют камни-рифы (на вид: вода за ними — открытое море)
  for (const [x, y, v] of [
    [3, 33, 0],
    [13, 33, 1],
    [6, 34, 1],
    [11, 34, 0],
  ])
    if (m.at(x, y) === 'clag' || m.at(x, y) === 'O' || m.at(x, y) === 'h') m.add('mossRock', x, y, { v });
  // концы пляжа — камни (по краю карты не пройти)
  for (const x of [0, 1, W - 2, W - 1]) for (let y = sandY(x) - 1; y < H; y++) if (['s', 'h'].includes(m.at(x, y))) m.add('mossRock', x, y, { v: (x + y) % 2 });
  // 4. особые предметы — на место того, что выросло (m.clear)
  const put1 = (type, x, y, o) => {
    m.clear(x, y);
    m.add(type, x, y, o);
  };
  for (let dy = -2; dy <= 0; dy++) for (let dx = -4; dx <= 4; dx++) m.clear(AT.volcano[0] + dx, AT.volcano[1] + dy);
  put1('bigVolcano', ...AT.volcano);
  put1('obsidian', ...AT.obsidian, { waits: obsidianWaits });
  put1('campfire', ...AT.fire, { burning: fireBurning });
  put1('drum', ...AT.drum);
  for (const [x, y] of AT.torches) put1('tikiTorch', x, y);
  for (const [x, y, v] of AT.totems) put1('totem', x, y, { v });
  put1('pins', ...AT.pins);
  // цветущие кусты рядом с местами, где распускаются цветы для леи
  FLOWER_SPOTS.forEach(([x, y], i) => {
    const bx = x + (i % 2 ? 1 : -1);
    if (!path.has(bx + ',' + y) && ['igrass'].includes(m.at(bx, y))) put1('iflowers', bx, y, { v: i % 3 });
    m.clear(x, y);
  });
  // кораблик у причала; указатели
  put1('mooredBoat', 21, 33);
  m.clear(22, 33);
  put1('signpost', 21, 24, { text: '🔥 Деревня', text2: '🌋 Вулкан' });
  put1('signpost', 29, 21, { text: '🥥 Боулинг', text2: '🛖 Хижина' });
  put1('signpost', 26, 2, { text: '🌋 Смотровая', text2: 'у кратера' });
  // перед зданиями — свободно (там двери)
  for (const b of [AT.dock, AT.chief, AT.laguna, AT.guest, AT.bum])
    for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y; y <= b.y + b.h; y++) if (m.at(x, y) !== 'i') m.clear(x, y);
}

/** Клетки, до которых от причала не дойти пешком, — закрыть. */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[19, 28]];
  seen[28 * W + 19] = 1;
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

// ---------- время праздника, костёр, находки ----------
const S = () => G.state;
/** Идёт ли праздник огней: каждый вечер с ISLAND.fest.from до ISLAND.fest.to часов. */
export const festNow = () => {
  const m = S() ? S().minutes : 0;
  return m >= ISLAND.fest.from * 60 && m < ISLAND.fest.to * 60;
};
/** Костёр горит вечером и ночью (и весь праздник). */
const fireBurning = () => {
  const m = S() ? S().minutes : 0;
  return m >= 18 * 60 || m < 5 * 60 || festNow();
};
/** Лежит ли сегодня кусочек вулканического стекла у подножия (раз в день). */
export const obsidianWaits = () => !!S() && !(S().dayFlags.island && S().dayFlags.island.obsidian);
/** Сегодняшний цветок для леи: { i — номер места в FLOWER_SPOTS, id — какой цветок }. */
export function flowerToday() {
  const day = S().day,
    i = +pickOn(
      day,
      'island:flower',
      FLOWER_SPOTS.map((_, k) => String(k)),
      1,
    )[0];
  return { i, id: LEI_IDS[day % LEI_IDS.length] };
}
/** Положить сегодняшний цветок (на входе и утром после ночёвки в хижине). */
export function placeFlowers(sc) {
  const { i, id } = flowerToday(),
    f = FIND_BY_ID[id];
  sc.setPickups([{ id: 'f' + i, at: FLOWER_SPOTS[i], icon: f.e, give: ['finds', id, 1], text: `+1 ${f.e} ${f.name}`, act: 'island:flower' }]);
}

// ---------- «доброе извержение» (О9): раз в неделю вечером вулкан пускает искры над кратером, как салют ----------
/** Идёт ли сейчас доброе извержение (ISLAND.erupt: раз в неделю, вечером). */
export const eruptNow = () => {
  const s = S(),
    e = ISLAND.erupt;
  return !!s && s.day % e.every === e.on && s.minutes >= e.from * 60 && s.minutes < e.to * 60;
};
/** Через сколько дней следующее доброе извержение (0 — сегодня). */
export const eruptIn = (day = S().day) => (ISLAND.erupt.on - (day % ISLAND.erupt.every) + ISLAND.erupt.every) % ISLAND.erupt.every;
const CRATER = { x: (AT.volcano[0] + 0.5) * T - 4, y: (AT.volcano[1] + 0.5) * T - 262 };
const SPARK_C = ['#ffd43b', '#ff922b', '#ff6b9d', '#fff3bf', '#ffa94d'];
const BURST = 0.8, // новый залп каждые 0,8 с
  SPARK_LIFE = 1.9;
/**
 * Искры над кратером, как салют: из кратера взлетает огонёк и невысоко (кратер у края карты) раскрывается кольцом
 * искр, они разлетаются и осыпаются; заодно из кратера брызжет мелкий фонтанчик. Точки одним путём на цвет.
 */
function drawEruption(ctx, t) {
  const b0 = Math.floor(t / BURST);
  for (let c = 0; c < SPARK_C.length; c++) {
    ctx.fillStyle = SPARK_C[c];
    ctx.beginPath();
    for (let b = b0 - 2; b <= b0; b++) {
      const age = t - b * BURST,
        hb = hash(b, 3),
        ax = CRATER.x + (hb - 0.5) * 170,
        ay = CRATER.y - 28 - hash(5, b) * 34;
      if (age < 0 || age > SPARK_LIFE + 0.35) continue;
      if (age < 0.35) {
        // огонёк летит вверх
        if ((b + c) % SPARK_C.length) continue;
        const q = age / 0.35,
          x = CRATER.x + (ax - CRATER.x) * q,
          y = CRATER.y + (ay - CRATER.y) * (1 - (1 - q) * (1 - q));
        ctx.moveTo(x + 4, y);
        ctx.arc(x, y, 4, 0, 6.2832);
        continue;
      }
      const k = (age - 0.35) / SPARK_LIFE; // 0 → 1: кольцо раскрылось и осыпается
      for (let i = c; i < 20; i += SPARK_C.length) {
        const a = (i / 20) * 6.2832 + hb * 3,
          rr = 78 * (1 - (1 - k) * (1 - k)) * (0.8 + hash(i, b) * 0.4),
          x = ax + Math.cos(a) * rr,
          y = ay + Math.sin(a) * rr * 0.6 + 110 * k * k, // осыпаются по склонам
          r = 6 * (1 - k) * (Math.sin(t * 22 + i) > -0.4 ? 1 : 0.55);
        if (r <= 0.4) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, 6.2832);
      }
    }
    // фонтанчик искр над самым кратером
    for (let i = c; i < 15; i += SPARK_C.length) {
      const q = (t * 0.9 + i * 0.137) % 1,
        a = -Math.PI / 2 + (hash(i, 9) - 0.5) * 1.6,
        x = CRATER.x + Math.cos(a) * 130 * q,
        y = CRATER.y + Math.sin(a) * 110 * q + 170 * q * q,
        r = 3 * (1 - q);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 6.2832);
    }
    ctx.fill();
  }
  // вспышка в кратере
  ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2;
  ell(ctx, CRATER.x, CRATER.y + 6, 30, 10, '#ffd43b');
  ctx.globalAlpha = 1;
}
/** Извержение началось, а хомячок на острове — сказать об этом (раз в день). */
function updateEruption() {
  const s = S();
  if (!eruptNow() || (s.dayFlags.island && s.dayFlags.island.erupt)) return;
  setDayFlag('erupt', 1, 'island');
  emit('island', { what: 'erupt' });
  sfx('magic');
  toast('🌋✨ Доброе извержение! Раз в неделю вулкан пускает искры, как салют. Это совсем не опасно — полюбуйся со смотровой у кратера!', 'good');
}

// ---------- лагуна (О10): рыбки в тёплой воде ----------
const LAG_FISH = [0, 1, 2, 3, 4, 5].map((i) => ({ ph: i * 1.7, rx: 1.2 + (i % 3) * 0.9, ry: 0.5 + (i % 2) * 0.5, sp: 0.35 + (i % 3) * 0.12, c: ['#ff922b', '#ffd43b', '#f783ac', '#4dabf7', '#ff922b', '#69db7c'][i] }));
/** Рыбка лагуны i сейчас: где и куда плывёт (единицы мира). */
function lagFishAt(i, t) {
  const f = LAG_FISH[i],
    a = t * f.sp + f.ph,
    [lx, ly] = AT.lagoon;
  return { x: (lx + 0.3 + Math.cos(a) * f.rx) * T, y: (ly + 0.2 + Math.sin(a) * f.ry) * T, dir: -Math.sin(a) >= 0 ? 1 : -1, c: f.c };
}
function drawLagFish(ctx, q, t) {
  ctx.globalAlpha = 0.8;
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.scale(q.dir, 1);
  ctx.fillStyle = 'rgba(20,90,110,.25)';
  ctx.beginPath();
  ctx.ellipse(2, 8, 10, 3, 0, 0, 6.2832);
  ctx.fill();
  ctx.fillStyle = q.c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5, 0, 0, 6.2832);
  ctx.moveTo(-7, 0);
  ctx.lineTo(-15, -5 + Math.sin(t * 9) * 1.5);
  ctx.lineTo(-15, 5 + Math.sin(t * 9) * 1.5);
  ctx.fill();
  ctx.fillStyle = '#1d1b1b';
  ctx.beginPath();
  ctx.arc(4.5, -1, 1.3, 0, 6.2832);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------- праздник: танцующие островитяне и гирлянда огоньков ----------
const lk = (fur, outfit, beauty = {}) => resolveLook({ fur, spots: null, ear: '#ffb3c1', belly: '#fff3e0', outfit, beauty: { blush: '#ffb0bd', ...beauty } });
const grass = (c, c2) => ({ id: 'x_dancer_skirt', slot: 'legs', kind: 'grass', name: 'Юбочка из травы', c, c2 });
const leiOf = (c, c2) => ({ id: 'x_dancer_lei', slot: 'acc', kind: 'lei', name: 'Лея', c, c2 });
/** Островитяне, которые танцуют у костра на празднике. */
const DANCERS = [
  lk('#f2b34c', { legs: grass('#b5c95a', '#7f9a3a'), acc: leiOf('#ff6b9d', '#fff'), head: { id: 'x_d1', slot: 'head', kind: 'wreath', c: '#fff' } }, { lashes: true, tuft: 3, hair: '#4a3728' }),
  lk('#c98b5a', { legs: grass('#94b84a', '#6f9a2e'), acc: leiOf('#ffd43b', '#ff922b') }, { tuft: 1, hair: '#4a3728' }),
  lk('#fff', { legs: grass('#a9c95a', '#74a03a'), acc: leiOf('#da77f2', '#fff3bf'), head: { id: 'x_d3', slot: 'head', kind: 'flower', c: '#ffd43b', c2: '#ff922b' } }, { lashes: true, tuft: 2, hair: '#a0522d' }),
  lk('#e6c9a8', { legs: grass('#b5c95a', '#7f9a3a'), acc: leiOf('#4dabf7', '#fff') }, { tuft: 2, hair: '#6b4423' }),
];
defineArt({
  // кадр танцора: i — кто, f — фаза (0–3: лапки вверх / вниз, поворот)
  dancer: [
    [-48, -112, 48, 14],
    (ctx, i, f) => drawHamster(ctx, 0, 0, PS, DANCERS[i], { dir: f % 2 ? 1 : -1, time: 0, happy: true, armsUp: f >= 2, shadow: true }),
  ],
});
/**
 * Где танцоры сейчас: по кругу у костра, медленно идут хороводом (единицы мира). Хоровод обходит тех, кто стоит у
 * костра (О6): если на пути хомячок или житель острова (obst — точки { x, y }), танцор плавно огибает его.
 */
const DANCE_GAP = 74;
function dancerAt(i, t, obst = []) {
  const a = t * 0.35 + (i / DANCERS.length) * Math.PI * 2;
  let x = (AT.fire[0] + 0.5) * T + Math.cos(a) * 118,
    y = (AT.fire[1] + 0.5) * T + 10 + Math.sin(a) * 62;
  for (let pass = 0; pass < 2; pass++)
  for (const o of obst) {
    const dx = x - o.x,
      dy = y - o.y,
      d = Math.hypot(dx, dy);
    if (d >= DANCE_GAP) continue;
    // в сторону от препятствия; совсем вплотную — наружу от костра
    const ux = d > 1 ? dx / d : Math.cos(a),
      uy = d > 1 ? dy / d : Math.sin(a),
      k = DANCE_GAP - d;
    x += ux * k;
    y += uy * k;
  }
  return { x, y, a };
}
/** Кого обходит хоровод: хомячок и жители острова у площади (кто сейчас не спрятан). */
const danceObstacles = (sc) => [...sc.npcs.filter((n) => !n.hidden), sc.p] // хомячок — последним: его обходят наверняка.filter((o) => Math.hypot(o.x - (AT.fire[0] + 0.5) * T, o.y - (AT.fire[1] + 0.5) * T) < T * 5);
/**
 * Гирлянда (О7): огоньки на верёвке между факелами — буквой «П», по дальней стороне площади и по бокам; передняя
 * сторона открыта, чтобы гирлянда не закрывала танец и хомячка у костра. У каждого кусочка верёвки — своя глубина
 * (gy — где под ним земля): кто стоит ближе к нам, тот рисуется поверх гирлянды, кто дальше — под ней.
 */
const BULBS = (() => {
  const out = [],
    strands = [],
    tops = AT.torches.map(([x, y]) => [(x + 0.5) * T, (y + 0.5) * T - 72, (y + 0.5) * T]),
    order = [2, 0, 1, 3]; // левый бок (снизу вверх) → дальняя сторона → правый бок (сверху вниз)
  for (let k = 0; k < 3; k++) {
    const [ax, ay, ag] = tops[order[k]],
      [bx, by, bg] = tops[order[k + 1]],
      pts = [{ x: ax, y: ay, gy: ag }];
    for (let i = 1; i < 9; i++) {
      const q = i / 9,
        b = { x: ax + (bx - ax) * q, y: ay + (by - ay) * q + Math.sin(q * Math.PI) * 26, gy: ag + (bg - ag) * q, c: ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][(k * 8 + i) % 5], n: out.length };
      out.push(b);
      pts.push(b);
    }
    pts.push({ x: bx, y: by, gy: bg });
    strands.push(pts);
  }
  return { tops, strands, list: out };
})();
/** Гирлянда в общем порядке «дальше → ближе»: каждый кусочек верёвки с огоньком на конце — на своей глубине. */
function addGarland(add, v, t) {
  for (const pts of BULBS.strands)
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1],
        b = pts[j];
      if (Math.max(a.x, b.x) < v.x0 - 20 || Math.min(a.x, b.x) > v.x1 + 20 || b.gy < v.y0 || b.y > v.y1) continue;
      add((a.gy + b.gy) / 2 + 2, (ctx) => {
        SP.world();
        ctx.strokeStyle = 'rgba(74,55,40,.75)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if (b.c) {
          const on = Math.sin(t * 3 + b.n * 1.7) > -0.6;
          ell(ctx, b.x, b.y + 3, 3.6, 4.4, on ? b.c : '#868e96', 'rgba(74,55,40,.7)', 1);
        }
      });
    }
}
/** Гирлянда видна вечером и ночью (с 18:30 до 5:00) — к празднику уже горит. */
const garlandOn = () => {
  const m = S() ? S().minutes : 0;
  return m >= 18.5 * 60 || m < 5 * 60;
};
/** Ночью: свечение лавы в кратере и огоньки гирлянды в слое неба (режим lighter — светятся сквозь темноту). */
function drawNightGlow(c, sc, lw, lh, t, k) {
  const vw = G.view.w,
    vh = G.view.h,
    kx = (lw - 1) / vw,
    ky = (lh - 1) / vh,
    z = sc.cam.zoom;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const s = sc.cam.toScreen((AT.volcano[0] + 0.5) * T, (AT.volcano[1] + 0.5) * T - 250);
  if (s.x > -300 && s.y > -300 && s.x < vw + 300 && s.y < vh + 300) {
    const r = (120 + Math.sin(t * 1.3) * 10) * z * kx,
      g = c.createRadialGradient(s.x * kx, s.y * ky, 0, s.x * kx, s.y * ky, r);
    g.addColorStop(0, `rgba(255,110,50,${(0.55 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = g;
    c.fillRect(s.x * kx - r, s.y * ky - r, r * 2, r * 2);
  }
  if (garlandOn()) {
    c.fillStyle = `rgba(255,230,150,${(0.7 * k).toFixed(3)})`;
    c.beginPath();
    for (let i = 0; i < BULBS.list.length; i++) {
      if (Math.sin(t * 3 + i * 1.7) <= -0.6) continue;
      const b = BULBS.list[i],
        p = sc.cam.toScreen(b.x, b.y + 3);
      if (p.x < -10 || p.y < -10 || p.x > vw + 10 || p.y > vh + 10) continue;
      const r = Math.max(1, 1.6 * z * kx * 4);
      c.moveTo(p.x * kx + r, p.y * ky);
      c.arc(p.x * kx, p.y * ky, r, 0, 6.2832);
    }
    c.fill();
  }
  c.restore();
}

const island = createTopDownScene({
  id: 'island', // имя сцены лежит в сохранениях: { scene: 'island', x, y } — не менять
  title: 'Карта острова',
  w: W,
  h: H,
  base: 'igrass',
  bg: '#1c7ed6',
  season: 'summer', // на острове всегда лето
  dry: true, // ни снега, ни холодного дождя
  critters: 2,
  critterTiles: ['igrass'],
  water: { shoreY: 31, foamY: 30 },
  build,
  buildings: [
    // хижина у причала: кораблик обратно в город (faraway:back — features/island.js)
    { id: 'dock', kind: 'dock', ...AT.dock, name: 'Причал', mapName: 'Кораблик в город', icon: '⛵', act: 'faraway:back' },
    // хижина вождя Кокоса (вход — разговор с вождём)
    { id: 'chief', kind: 'chiefHut', ...AT.chief, name: 'Хижина вождя', icon: '🌴', act: 'inside:hut_kokos' },
    // хижина для гостей: переночевать (features/island.js)
    { id: 'guest', kind: 'stiltHut', ...AT.guest, v: 1, sign: '🛏️ Для гостей', name: 'Хижина для гостей', icon: '🛏️', act: 'inside:hut_guest' },
    // домики островитян
    { id: 'laguna', kind: 'stiltHut', ...AT.laguna, v: 0, name: 'Домик Лагуны', icon: '🛖', act: 'inside:hut_laguna' },
    { id: 'bumhut', kind: 'stiltHut', ...AT.bum, v: 2, name: 'Домик Бума', icon: '🛖', act: 'inside:hut_bum' },
  ],
  actors: [
    { npc: 'kokos', at: [18, 18], always: true, act: 'chief' },
    { npc: 'bum', at: [23, 15], still: true, always: true, act: 'islander:bum' },
    { npc: 'laguna', at: [11, 27], act: 'islander:laguna' },
  ],
  places: [
    {
      id: 'volcano',
      at: AT.volcano,
      hit: { dx: 170, up: 250, down: 10 },
      stand: AT.lookout,
      act: 'island:volcano',
      key: false,
      map: { icon: '🌋', at: [AT.volcano[0] + 0.5, AT.volcano[1] - 1], label: '🌋 Вулкан' },
    },
    {
      id: 'obsidian',
      at: AT.obsidian,
      hit: { r: 42 },
      stand: [AT.obsidian[0] + 0.5, AT.obsidian[1] + 1.6],
      act: 'island:obsidian',
      map: { icon: FIND_BY_ID.obsidian.e, at: [AT.obsidian[0] + 0.5, AT.obsidian[1] + 0.5], label: `${FIND_BY_ID.obsidian.e} Вулканическое стекло` },
    },
    {
      id: 'fire',
      at: AT.fire,
      hit: { r: 46 },
      stand: [AT.fire[0] + 0.5, AT.fire[1] + 1.7],
      act: 'island:fire',
      map: { icon: '🔥', at: [AT.fire[0] + 0.5, AT.fire[1] + 0.5], label: '🔥 Костёр' },
    },
    {
      id: 'bowling',
      area: AT.lane,
      stand: [AT.lane[0] - 0.6, AT.lane[1] + 1.5],
      act: 'island:bowling',
      map: { icon: '🥥', at: [33.5, 24.5], label: '🥥 Боулинг' },
    },
  ],
  spots: {
    plaza: { at: [20.5, 18.4], label: '🔥 Площадь' },
    beach: { at: [9.5, 28.4], label: '🏖️ Пляж' },
    lagoon: { at: [AT.lagoon[0] + 0.5, AT.lagoon[1] - 0.6], label: '🐠 Лагуна' },
  },
  // с кораблика выходят у хижины на причале (вход pier)
  entries: { pier: { building: 'dock' } },
  // где разбрасывать предметы заданий (письма с loc: 'island'): тропинки и трава
  zones: { trails: { tiles: ['itrail', 'igrass'], reach: { from: [19, 27] } } },
  built(sc) {
    sealPockets(sc.map);
  },
  enter(sc) {
    placeFlowers(sc);
  },
  /** Ночью: лава в кратере и огоньки гирлянды светятся сквозь темноту. */
  sky(c, sc, lw, lh) {
    const k = darkness();
    if (k > 0.2) drawNightGlow(c, sc, lw, lh, G.time, eruptNow() ? Math.min(1, k * 1.6) : k);
  },
  /** Ограждение дорожки боулинга — неподвижный рисунок поверх земли (в кэше земли). */
  paintGround(ctx, env, x0, y0, x1, y1) {
    const [lx0, ly0, lx1, ly1] = AT.lane;
    if (x1 < lx0 - 1 || x0 > lx1 + 1 || y1 < ly0 - 1 || y0 > ly1 + 1) return;
    ctx.lineCap = 'round';
    for (const yy of [ly0 * T + 2, (ly1 + 1) * T - 2])
      for (const [w, c] of [
        [6, '#4a3728'],
        [3.4, '#c98b5a'],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(lx0 * T + 4, yy);
        ctx.lineTo((lx1 + 1) * T - 4, yy);
        ctx.stroke();
      }
    // линия броска и стрелочки
    ctx.strokeStyle = 'rgba(224,49,49,.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx0 * T + 30, ly0 * T + 8);
    ctx.lineTo(lx0 * T + 30, (ly1 + 1) * T - 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,100,40,.45)';
    for (let i = 0; i < 3; i++) {
      const ax = (lx0 + 2.4) * T,
        ay = (ly0 + 0.6 + i * 0.9) * T;
      ctx.beginPath();
      ctx.moveTo(ax + 10, ay);
      ctx.lineTo(ax - 4, ay - 6);
      ctx.lineTo(ax - 4, ay + 6);
      ctx.fill();
    }
  },
  /** Рыбки в лагуне; праздник огней: островитяне танцуют хороводом вокруг костра. */
  things(sc, add, v) {
    const t = G.time;
    for (let i = 0; i < LAG_FISH.length; i++) {
      const q = lagFishAt(i, t);
      if (q.x > v.x0 - 30 && q.x < v.x1 + 30 && q.y > v.y0 - 30 && q.y < v.y1 + 30) add(q.y - 30, (ctx) => drawLagFish(ctx, q, t));
    }
    if (garlandOn()) addGarland(add, v, t);
    if (!festNow()) return;
    const obst = danceObstacles(sc);
    for (let i = 0; i < DANCERS.length; i++) {
      const p = dancerAt(i, t, obst);
      if (p.x < v.x0 - 60 || p.x > v.x1 + 60 || p.y < v.y0 || p.y > v.y1 + 120) continue;
      add(p.y, () => {
        const f = (Math.floor(t * 3 + i) % 2) + (Math.sin(t * 6 + i) > 0 ? 2 : 0);
        put('dancer', p.x, p.y - Math.round(Math.abs(Math.sin(t * 6 + i)) * 6), i, f);
      });
    }
  },
  /** Искры доброго извержения над кратером (над всем — они в небе). */
  over(ctx, sc, t) {
    if (eruptNow()) {
      SP.world();
      drawEruption(ctx, t);
    }
  },
  update() {
    updateEruption();
  },
  /** Зашла в лагуну — подсказка (один раз за игру) и событие. */
  surface(sc, kind, was) {
    if ((kind === 'clag' || kind === 'cdeep') && was !== 'clag' && was !== 'cdeep') {
      emit('island', { what: 'lagoon' });
      if (!S().flags.lagoonHint) {
        setFlag('lagoonHint');
        toast('🐠 Тёплая лагуна! Здесь мелко и тихо, плавают пёстрые рыбки. Купайся сколько хочешь!', 'good');
      }
    }
  },
  cold: () => false, // на острове всегда тепло
  /** Что слышно: своя музыка с барабанами; у моря — прибой; птицы днём, сверчки ночью. */
  sound(sc) {
    const ty = sc.p.y / T;
    return { day: 'island', sea: clamp((ty - 21) / 8, 0.08, 0.7), rain: 0, birds: true, crickets: true };
  },
});
export default island;
/** Для тестов: где танцоры сейчас и сколько огоньков в гирлянде. */
export const debugErupt = () => ({ on: eruptNow(), inDays: eruptIn(), crater: CRATER });
export const debugFest = (sc) => ({ fest: festNow(), garland: garlandOn(), dancers: DANCERS.map((_, i) => dancerAt(i, G.time, sc ? danceObstacles(sc) : [])), bulbs: BULBS.list.length });

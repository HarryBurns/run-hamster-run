// ДЖУНГЛИ (П.9) — пятое тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образцы — лес, гора, пещеры и пустыня (разделы 14–17).
// Рисунки — jungle_art.js.
//
// Как устроены: карта 46 × 42 правилами (build). Снизу — пляж и причал (приплыли из города на кораблике), хижина
// у причала — обратно в город. От причала на север бежит тропа к палатке исследовательницы Лианы, мимо банановых
// пальм и рощи (на западе), дальше — подвесной мост через реку. За рекой: поляна с деревом-великаном и лианами
// (мини-игра «Лианы»), на северо-западе — руины храма («Узор храма»), на северо-востоке — водопад: под ним можно
// искупаться, оттуда течёт река. Три попугая на жёрдочках повторяют фразы (подошла — говорит; нажала — поболтать,
// раз в день роняет перо). Всё остальное — густые джунгли: большие деревья с лианами, бамбук, монстеры, папоротники,
// геликонии и орхидеи. Всё случайное — от seeded(), карта всегда одна и та же; клетки, до которых от причала
// не дойти, закрываются (sealPockets).
//
// Атмосфера: всегда лето (season), снега и холодного дождя не бывает (dry); зато по утрам стелется туман (крюк sky —
// белёсые полосы в маленьком слое неба, почти даром), а в некоторые дни после обеда идёт тёплый дождик (overlay —
// одним путём несколько десятков чёрточек; промокнуть нельзя — он тёплый). Бабочек втрое больше, ночью — светлячки.
// Своя музыка и птичий щебет (sound → features/soundscape.js), у водопада шумит вода.
import { G, questNow } from '../core/state.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { clamp, seeded, dist } from '../core/util.js';
import { toast, hintOnce } from '../ui/toast.js';
import { emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { JUNGLE, JUNGLE_GATHER, QUEST_BY_ID, PARROT_WORD_BY_ID, dayRoll } from '../data/index.js';
import { T, PS, SP, put, label, tileOf, createTopDownScene, inEll } from '../engine/topdown/index.js';
import { bathSpot } from './common/bath.js';
import { createPlants } from './common/plants.js';
import './jungle_art.js';
import './common/index.js';

const W = 46,
  H = 42;
// ---------- тропы (ломаные в клетках; r — полуширина) ----------
const PATHS = [
  {
    r: 0.75,
    pts: [
      [22.5, 37],
      [22.5, 31],
      [24, 26],
      [22.5, 20],
      [21.5, 17],
      [21.5, 11.5],
      [19.5, 9.4],
    ],
  }, // от причала через мост к поляне с лианами
  {
    r: 0.6,
    pts: [
      [24, 26],
      [28.5, 25.5],
      [32, 25.5],
    ],
  }, // к палатке Лианы
  {
    r: 0.6,
    pts: [
      [21.5, 11.5],
      [15, 10.5],
      [9, 9.4],
    ],
  }, // к храму
  {
    r: 0.6,
    pts: [
      [21.5, 11.5],
      [27, 10.2],
      [31.6, 8.2],
    ],
  }, // к водопаду
  {
    r: 0.55,
    pts: [
      [22.5, 31],
      [16, 30.5],
      [10.5, 28],
    ],
  }, // в банановую рощу
  {
    r: 0.55,
    pts: [
      [22.5, 20],
      [16, 19.2],
      [12, 19.4],
    ],
  }, // к манго у реки
  {
    r: 0.5,
    pts: [
      [22.4, 18.6],
      [24.4, 16.8],
      [25.5, 16],
    ],
  }, // к мосткам у реки: там лодочка-пирога (Дж5)
];
// особые места
export const AT = {
  dock: { x: 19, y: 34, w: 3, h: 2 }, // хижина у причала: дверь — клетка (20, 36)
  camp: { x: 27, y: 23, w: 3, h: 2 }, // палатка Лианы: дверь — клетка (28, 25)
  temple: { x: 6, y: 5, w: 6, h: 3 }, // руины храма: вход — клетка (9, 8)
  vines: [19, 7], // дерево-великан с лианами (занимает клетки 18–20 ряда 7)
  fall: [37, 4], // скала с водопадом (клетки 35–39 ряда 4)
  pool: [37, 7, 3.4, 2.1], // заводь под водопадом: центр и полуоси (клетки)
  canoe: [25.5, 14.6], // лодочка-пирога у мостков на южном берегу реки (Дж5): где она ждёт (клетки)
  bridge: [21, 22], // столбцы подвесного моста
  notebook: [32, 6], // дневник Лианы (задание «Дневник исследовательницы»)
  bananas: [
    [9, 27],
    [13, 31],
  ],
  mangos: [
    [12, 18],
    [17, 18],
  ],
  pineapples: [
    [31, 22],
    [33, 23],
  ],
  coco: [17, 35],
  // лианы маракуйи на шпалерах (этап 12): осенью — плоды; у палатки Лианы, за ананасами
  passions: [
    [33, 25],
    [35, 25],
  ],
};
// попугаи на жёрдочках: где, какой (вид рисунка parrot) и как зовут
export const PARROTS = [
  { at: [25, 21], v: 0, name: 'Кеша' },
  { at: [10, 24], v: 1, name: 'Рико' },
  { at: [27, 8], v: 2, name: 'Лимончик' },
];
// что говорят попугаи (по кругу; {name} — имя хомячка)
const PHRASES = [
  'Пр-р-ривет, {name}!',
  'Кр-р-расавица!',
  'Банан-банан!',
  'Лиана хор-р-рошая!',
  '{name}! {name}!',
  'Ур-р-ра, гости!',
  'Кеша умница!',
  'Пиастр-р-ры!',
  'Тр-р-ропики!',
  'Здр-р-равствуй, {name}!',
];
/** Дневник лежит у водопада: задание «Дневник исследовательницы» взято, а дневник ещё не найден. */
export const notebookHidden = () => {
  if (!QUEST_BY_ID.lost_notebook) return false;
  const w = questNow('lost_notebook');
  return w.status === 'active' && w.i === 0;
};

// ---------- карта ----------
/** Река: от заводи под водопадом на запад, до края карты. */
const RIVER = [
  [36.5, 8.6],
  [33, 11.2],
  [28, 13.6],
  [22, 14.6],
  [15, 14.2],
  [9, 15.2],
  [3, 16],
  [-1, 16.4],
];
// «тихие» места: тут ничего случайного не растёт
const CALM = [
  [16, 32, 28, 41], // причал и хижина
  [24, 19, 36, 29], // лагерь Лианы (и ниже — чтобы кроны не закрывали Лиану)
  [3, 3, 15, 12], // храм
  [14, 3, 26, 11], // поляна с лианами
  [29, 2, 43, 10], // водопад
  [7, 23, 15, 33], // банановая роща
];
const calm = (x, y) => CALM.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
/** Где начинается пляж (песок) в столбце x — и мелководье. */
const sandY = (x) => 36 + Math.round(Math.sin(x * 0.45) * 0.8);

function build(m) {
  const rnd = seeded(5813);
  // 1. пляж и море снизу
  for (let x = 0; x < W; x++) {
    const sy = sandY(x);
    for (let y = sy; y < H; y++) m.set(x, y, y >= sy + 3 ? 'O' : y >= sy + 2 ? 'h' : 's');
  }
  // 2. заводь и река
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inEll(x, y, AT.pool)) m.set(x, y, 'jpool');
  m.stroke(RIVER, 1.25, (x, y) => m.at(x, y) !== 'jpool' && m.set(x, y, 'jriver'));
  // 3. плиты у храма
  for (let y = 8; y <= 11; y++)
    for (let x = 4; x <= 14; x++) if (!(y === 11 && (x === 4 || x === 14))) m.set(x, y, 'jstone');
  // 4. тропы; через реку — мост (плиты храма — тоже «тропа»: к югу от них высокое не растёт)
  const path = new Set();
  for (let y = 8; y <= 11; y++) for (let x = 4; x <= 14; x++) if (m.at(x, y) === 'jstone') path.add(x + ',' + y);
  for (const { r, pts } of PATHS)
    m.stroke(pts, r, (x, y) => {
      const c = m.at(x, y);
      if (c === 'jriver' || c === 'jpool') {
        if (AT.bridge.includes(x)) m.set(x, y, 'jbridge');
      } else if (!['s', 'jstone', 'jbridge'].includes(c)) m.set(x, y, 'jtrail');
      path.add(x + ',' + y);
    });
  for (const x of AT.bridge)
    for (let y = 12; y <= 17; y++)
      if (m.at(x, y) === 'jriver') {
        m.set(x, y, 'jbridge');
        path.add(x + ',' + y); // мост — тоже тропа: у его концов высокое не растёт (Дж10)
      }
  for (let y = 10; y <= 19; y++)
    if (m.at(AT.bridge[0], y) === 'jbridge')
      ((BRIDGE_ROWS[0] = Math.min(BRIDGE_ROWS[0], y)), (BRIDGE_ROWS[1] = Math.max(BRIDGE_ROWS[1], y)));
  // причал: доски от пляжа в море
  for (let y = 36; y <= 40; y++) for (const x of [22, 23]) m.set(x, y, 'i');
  const free = (x, y) => !path.has(x + ',' + y) && ['jfloor'].includes(m.at(x, y));
  // 5. край карты — сплошные деревья и бамбук; внутри — густые джунгли
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = rnd(),
        v = Math.floor(rnd() * 3),
        edge = x < 2 || y < 2 || x > W - 3;
      if (!free(x, y)) continue;
      if (edge) {
        if (r < 0.8) m.add('jtree', x, y, { v });
        else m.add('bamboo', x, y, { v: v % 2 });
        continue;
      }
      if (calm(x, y)) {
        if (r < 0.06) m.add('jflowers', x, y, { v });
        else if (r < 0.1) m.add('fern', x, y, { v: v % 2 });
        continue;
      }
      // у тропы высокое не растёт: крона дерева — до трёх клеток в высоту и по полторы в стороны, так что дерево
      // южнее тропы, сбоку от неё (на том же ряду) или наискосок закрыло бы тропу, мост и хомячка (Дж10)
      const belowPath = [0, 1, 2, 3].some((k) => [-2, -1, 0, 1, 2].some((dx) => path.has(x + dx + ',' + (y - k))));
      if (belowPath) {
        if (r < 0.2) m.add('monstera', x, y, { v: v % 2 });
        else if (r < 0.32) m.add('fern', x, y, { v: v % 2 });
        else if (r < 0.4) m.add('jflowers', x, y, { v });
        continue;
      }
      if (r < 0.36) m.add('jtree', x, y, { v });
      else if (r < 0.4) m.add('bamboo', x, y, { v: v % 2 });
      else if (r < 0.5) m.add('monstera', x, y, { v: v % 2 });
      else if (r < 0.58) m.add('fern', x, y, { v: v % 2 });
      else if (r < 0.64) m.add('jflowers', x, y, { v });
      else if (r < 0.66) m.add('mossRock', x, y, { v: v % 2 });
    }
  // концы пляжа — замшелые камни (по краю карты не пройти)
  for (const x of [0, 1, W - 2, W - 1])
    for (let y = sandY(x) - 1; y < H; y++)
      if (['s', 'h'].includes(m.at(x, y))) m.add('mossRock', x, y, { v: (x + y) % 2 });
  // пальмы вдоль пляжа
  for (let x = 2; x < W - 2; x += 3) {
    const y = sandY(x) - 1;
    if (!path.has(x + ',' + y) && m.at(x, y) === 'jfloor' && !calm(x, y)) {
      m.clear(x, y);
      m.add('palm', x, y);
    }
  }
  // 6. особые предметы — на место того, что выросло (m.clear)
  for (let dx = -2; dx <= 2; dx++) m.clear(AT.fall[0] + dx, AT.fall[1]);
  m.put1('jfall', ...AT.fall);
  for (let dx = -1; dx <= 1; dx++) m.clear(AT.vines[0] + dx, AT.vines[1]);
  m.put1('vineTree', ...AT.vines);
  for (const [x, y] of AT.bananas) m.put1('bananaPalm', x, y);
  for (const [x, y] of AT.mangos) m.put1('mangoTree', x, y);
  for (const [x, y] of AT.pineapples) m.put1('pineapple', x, y);
  for (const [x, y] of AT.passions) m.put1('passionVine', x, y);
  m.put1('cocoPalm', ...AT.coco);
  PARROTS.forEach((p, i) => m.put1('perch', ...p.at, { v: p.v, talk: () => talking(i) }));
  // храм: колонны и каменная голова
  for (const [x, y, v] of [
    [4, 8, 0],
    [14, 8, 0],
    [4, 11, 1],
    [14, 11, 1],
    [3, 6, 1],
  ])
    m.put1('ruinPillar', x, y, { v });
  m.put1('ruinHead', 13, 6);
  // кораблик у причала; указатели
  m.put1('mooredBoat', 24, 39);
  m.clear(25, 39);
  m.put1('signpost', 24, 30, { text: '⛺ Лагерь', text2: '🌴 Роща' });
  m.put1('signpost', 23, 18, { text: '🌉 Мост', text2: '🌊 Река' });
  m.put1('signpost', 23, 10, { text: '💦 Водопад', text2: '🗿 Храм' });
  // перед зданиями — свободно (там двери)
  for (const b of [AT.dock, AT.camp, AT.temple])
    for (let x = b.x - 1; x <= b.x + b.w; x++)
      for (let y = b.y; y <= b.y + b.h; y++) if (m.at(x, y) !== 'i') m.clear(x, y);
  // факелы по бокам палатки (ночью светят)
  m.put1('tikiTorch', AT.camp.x - 2, AT.camp.y + 1);
  m.put1('tikiTorch', AT.camp.x + AT.camp.w + 1, AT.camp.y + 1);
}

/** Ряды подвесного моста (первый и последний) — их находит build, перила рисует paintGround. */
const BRIDGE_ROWS = [99, -1];

// ---------- попугаи: подошла — говорит фразу (облачко над жёрдочкой), потом молчит JUNGLE.parrot секунд ----------
const talk = PARROTS.map(() => ({ until: 0, next: 0, text: '' }));
let said = 0;
/** Говорит ли попугай i прямо сейчас (машет крылом, над ним облачко). */
export const talking = (i) => talk[i].until > G.time;
/** Слова, которым хомячок научила попугая i (state.parrots, Дж6): тексты из PARROT_WORDS. */
export const parrotWords = (i) =>
  ((G.state && G.state.parrots && G.state.parrots[i]) || [])
    .map((id) => PARROT_WORD_BY_ID[id])
    .filter(Boolean)
    .map((w) => w.text);
/**
 * Попугай i говорит фразу (своя — text; без неё — следующая по кругу: через раз — выученное слово, если хомячок
 * его чему-то научила; {name} — имя хомячка).
 */
export function parrotSay(i, text) {
  const q = talk[i],
    name = (G.state && G.state.name) || 'хомячок';
  if (!text) {
    const n = said++,
      own = parrotWords(i);
    text = own.length && n % 2 === 0 ? own[(n >> 1) % own.length] : PHRASES[(n + i * 3) % PHRASES.length];
  }
  const line = text.replace(/\{name\}/g, name);
  q.text = line;
  q.until = G.time + 3.6;
  q.next = G.time + JUNGLE.parrot;
  sfx('squeak', 1.5 + i * 0.15);
  return line;
}
function updateParrots(sc) {
  for (let i = 0; i < PARROTS.length; i++) {
    const [px, py] = PARROTS[i].at,
      d = Math.hypot(sc.p.x / T - px - 0.5, sc.p.y / T - py - 0.5);
    if (d < 2.6 && G.time > talk[i].next) {
      parrotSay(i);
      emit('jungle', { what: 'parrot', i });
    }
  }
}

// ---------- купание под водопадом: хомячок в заводи (способ передвижения ride с bath: true) ----------
export const FALL_STAND = [32.6, 7.6];
/** Брызги водопада вокруг хомячка в заводи. */
function drawSplashes(ctx, e, t) {
  ctx.fillStyle = 'rgba(220,245,255,.9)';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.4 + i / 6) % 1,
      x = e.x + Math.cos(i * 1.05) * (16 + ph * 22),
      y = e.y - 60 + ph * ph * 50 - Math.sin(ph * Math.PI) * 26;
    ctx.moveTo(x + 2.4, y);
    ctx.arc(x, y, 2.4, 0, 6.2832);
  }
  ctx.fill();
}
/** Заводь под водопадом: хомячок в воде по шейку, сверху брызги (common/bath.js); вылезает на бережок. */
const bath = bathSpot({
  at: [AT.pool[0] - 0.4, AT.pool[1] - 0.3],
  stand: FALL_STAND,
  extra: drawSplashes,
  keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Escape'],
});
const isBathing = bath.isIn;
/** Искупаться под водопадом (features/jungle.js). */
export const startFallBath = bath.start;
/** Вылезти из заводи — на бережок. false — хомячок и так не в воде. */
const endFallBath = bath.end;

// ---------- туман по утрам и тёплый дождик после обеда ----------
/** Идёт ли сейчас тёплый дождик: в некоторые дни (JUNGLE.drizzle — доля дней) с 14:00 до 15:30. */
export const drizzleNow = () => {
  const s = G.state;
  return !!s && s.minutes >= 14 * 60 && s.minutes < 15 * 60 + 30 && dayRoll(s.day, 'jungle:drizzle') < JUNGLE.drizzle;
};
/** Утренний туман: насколько он густ (0..1) — с 5:00 до 9:30, гуще всего на рассвете. */
export const mistNow = () => {
  const m = G.state ? G.state.minutes : 0;
  return m < 5 * 60 || m > 9.5 * 60 ? 0 : clamp(1 - (m - 6 * 60) / 210, 0, 1);
};
function drawMist(c, lw, lh, t, k) {
  c.fillStyle = `rgba(235,248,240,${0.2 * k})`;
  c.fillRect(0, 0, lw, lh);
  c.fillStyle = `rgba(250,255,252,${0.22 * k})`;
  for (let i = 0; i < 3; i++) {
    const y0 = ((i * 0.33 + t * 0.006) % 1) * lh * 1.2 - lh * 0.1,
      bh = lh * 0.09;
    c.beginPath();
    c.moveTo(0, y0);
    for (let x = 0; x <= lw; x += lw / 6) c.lineTo(x, y0 + Math.sin(x * 0.05 + t * 0.3 + i) * bh * 0.5);
    for (let x = lw; x >= 0; x -= lw / 6) c.lineTo(x, y0 + bh + Math.sin(x * 0.05 + t * 0.3 + i + 2) * bh * 0.5);
    c.fill();
  }
}
/** Тёплый дождик: короткие косые чёрточки одним путём (экранные координаты). */
function drawDrizzle(ctx, w, h, t) {
  ctx.strokeStyle = 'rgba(200,235,255,.55)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = Math.round(Math.min(70, (w * h) / 14000));
  for (let i = 0; i < n; i++) {
    const sx = ((i * 0.618 + 0.13) % 1) * (w + 60),
      ph = (t * (0.9 + (i % 5) * 0.08) + i * 0.37) % 1,
      x = sx - ph * 40,
      y = ph * (h + 40) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 14);
  }
  ctx.stroke();
}

// ---------- лодочка-пирога (Дж5): по реке от моста до заводи под водопадом ----------
// Пирога ждёт у мостков (AT.canoe). Села — способ передвижения ride с canoe: true: плывёт только по реке и заводи
// (под мостом — нет: мост низкий), нажатие на воду — плыть туда, на берег рядом — сойти; лодочка остаётся, где сошла
// (до ухода из джунглей; вернулась — снова у мостков). Доплыла до водопада — брызги и событие jungle { what: 'canoe' }.
const CANOE_HOME = { x: AT.canoe[0] * T, y: AT.canoe[1] * T };
const canoe = { x: CANOE_HOME.x, y: CANOE_HOME.y, dir: -1, fall: false };
const isCanoeing = (sc) => !!(sc.p.ride && sc.p.ride.canoe);
const riverAt = (m, tx, ty) => {
  const c = m.at(tx, ty);
  return c === 'jriver' || c === 'jpool';
};
/** Нарисовать пирогу (и хомячка в ней, если look) в точке мира; dir — куда смотрит нос, весло машет на ходу. */
function drawCanoe(ctx, x, y, dir, t, look, moving) {
  const bob = Math.round(Math.sin(t * 2.4 + x * 0.01) * 2);
  if (moving) {
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.5 + i / 2) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(x - dir * (52 + k * 34), y + 12, 8 + k * 12, 3 + k * 4, 0, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  put('canoe', x, y + bob, dir < 0 ? 1 : 0);
  SP.world();
  if (!look) return;
  drawHamster(ctx, x + dir * 4, y + 6 + bob, PS, look, {
    dir,
    time: t,
    clipBelow: -24,
    shadow: false,
    blink: blinkAt(t),
    happy: true,
  });
  // весло: гребёт то слева, то справа
  const a = moving ? Math.sin(t * 5) : 0.3,
    hx = x + dir * 10,
    hy = y - 30 + bob;
  ctx.strokeStyle = '#4a3728';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx + a * 14, hy - 18);
  ctx.lineTo(hx - a * 22, hy + 34);
  ctx.stroke();
  ctx.strokeStyle = '#c98b5a';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.fillStyle = '#c98b5a';
  ctx.beginPath();
  ctx.ellipse(hx - a * 24, hy + 40, 5, 10, a * 0.4, 0, 6.2832);
  ctx.fill();
}
/** Сесть в пирогу (хомячок рядом с ней). */
export function startCanoe(sc) {
  const p = sc.p;
  if (isBathing(sc) || dist(p.x, p.y, canoe.x, canoe.y) > T * 2.6) return false;
  p.path = [];
  p.pending = null;
  p.x = canoe.x;
  p.y = canoe.y;
  p.dir = canoe.dir;
  canoe.fall = false;
  p.ride = {
    canoe: true,
    speed: 170,
    pass: (tx, ty) => riverAt(sc.map, tx, ty),
    step: { sfx: 'paddle', pause: 0.35 },
    draw: (ctx, _sc, e, t, look) => drawCanoe(ctx, e.x, e.y, e.dir || -1, t, look, e.moving),
    drop: (s) => endCanoe(s),
  };
  sfx('splash');
  hintOnce(
    'canoeHint',
    '🛶 Ты в лодочке! Нажимай на воду — поплывём вверх по реке, к водопаду. На берег рядом — сойти.',
  );
  return true;
}
/** Сойти с пироги на ближайший берег (у точки w, если она рядом, иначе — у хомячка). false — хомячок не в лодке. */
export function endCanoe(sc, w) {
  if (!isCanoeing(sc)) return false;
  const p = sc.p,
    m = sc.map,
    cx = tileOf(w ? w.x : p.x),
    cy = tileOf(w ? w.y : p.y);
  let best = null,
    bd = 1e9;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx,
        y = cy + dy;
      if (!m.foot(x, y) || riverAt(m, x, y) || m.at(x, y) === 'jbridge') continue;
      const d = Math.hypot((x + 0.5) * T - p.x, (y + 0.5) * T - p.y);
      if (d < bd && d < T * 2.8) ((bd = d), (best = [x, y]));
    }
  if (!best) {
    if (w) toast('Отсюда до берега далеко — подплыви поближе 🛶');
    else {
      // кнопка «Сойти» посреди воды: лодочка сама возвращается к мосткам
      canoe.x = CANOE_HOME.x;
      canoe.y = CANOE_HOME.y;
      p.ride = null;
      p.x = CANOE_HOME.x;
      p.y = CANOE_HOME.y + T * 1.2;
      sfx('pop');
      return true;
    }
    return true;
  }
  canoe.x = p.x;
  canoe.y = p.y;
  canoe.dir = p.dir || -1;
  p.ride = null;
  p.path = [];
  p.x = (best[0] + 0.5) * T;
  p.y = (best[1] + 0.5) * T;
  sfx('pop');
  emit('hud');
  return true;
}
/** Нажатие, пока хомячок в пироге: по воде — плыть, на берег рядом — сойти. */
function canoeTap(sc, w, tx, ty) {
  if (!isCanoeing(sc)) return false;
  if (riverAt(sc.map, tx, ty)) {
    if (sc.walkTo(w.x, w.y, true)) sfx('paddle');
    else toast('Туда на лодочке не проплыть 🛶');
  } else if (sc.map.at(tx, ty) === 'jbridge') toast('Под мостом лодочке не пройти — он низко над водой 🌉');
  else endCanoe(sc, w);
  return true;
}
/** Доплыла до заводи под водопадом — брызги и подсказка (раз за поездку). */
function updateCanoe(sc) {
  if (!isCanoeing(sc) || canoe.fall) return;
  if (Math.hypot(sc.p.x / T - AT.pool[0], sc.p.y / T - AT.pool[1]) < 2.6) {
    canoe.fall = true;
    sfx('splash');
    toast('💦 Водопад совсем рядом — брызги долетают до лодочки! Ух, как шумит!', 'good');
    emit('jungle', { what: 'canoe' });
  }
}

const plants = createPlants(); // подпись «Сорвать…», кнопка и клавиша E у бананов, манго, ананасов и кокоса
let bridgeOn = false;
const jungle = createTopDownScene({
  id: 'jungle', // имя сцены лежит в сохранениях: { scene: 'jungle', x, y } — не менять
  title: 'Карта джунглей',
  w: W,
  h: H,
  base: 'jfloor',
  bg: '#2f6e31',
  season: 'summer', // в джунглях всегда лето: деревья зелёные круглый год (плоды — по своим сезонам)
  dry: true, // ни снега, ни холодного дождя (свой тёплый дождик — overlay, промокнуть нельзя)
  critters: 3, // бабочек втрое больше, чем в городе (ночью — светлячки)
  critterTiles: ['jfloor'],
  gather: JUNGLE_GATHER, // сколько дают бананы, манго, ананасы и кокос (common/plants.js)
  build,
  buildings: [
    // хижина у причала: кораблик обратно в город (voyage:back — features/jungle.js)
    {
      id: 'dock',
      kind: 'dock',
      ...AT.dock,
      name: 'Причал',
      mapName: 'Кораблик в город',
      icon: '⛵',
      act: 'voyage:back',
    },
    // палатка исследовательницы Лианы
    {
      id: 'camp',
      kind: 'camp',
      ...AT.camp,
      name: 'Лагерь',
      mapName: 'Лагерь Лианы',
      icon: '⛺',
      act: 'inside:tent_liana',
    },
    // руины храма: загадка «Узор храма»
    { id: 'temple', kind: 'temple', ...AT.temple, name: 'Руины храма', icon: '🗿', act: 'inside:temple_hall' },
  ],
  actors: [{ npc: 'liana', at: [31.5, 25.6], home: 'camp', always: true, act: 'explorer' }],
  places: [
    {
      id: 'vines',
      at: AT.vines,
      hit: { dx: 110, up: 190, down: 24 },
      stand: [AT.vines[0] + 0.5, AT.vines[1] + 1.8],
      act: 'jungle:vines',
      map: { icon: '🐒', at: [AT.vines[0] + 0.5, AT.vines[1] + 0.5], label: '🐒 Лианы' },
    },
    {
      id: 'fall',
      tile: 'jpool',
      stand: FALL_STAND,
      act: 'jungle:fall',
      key: false,
      map: { icon: '💦', at: [AT.pool[0], AT.pool[1]], label: '💦 Водопад' },
    },
    // попугаи: нажми — поболтать (раз в день роняет перо)
    ...PARROTS.map((p, i) => ({
      id: 'parrot' + i,
      at: p.at,
      hit: { dx: 30, up: 80, down: 20 },
      stand: [p.at[0] + 0.5, p.at[1] + 1.5],
      act: { do: 'jungle', arg: 'parrot', i },
      shy: 0.6,
      ...(i === 0 ? { map: { icon: '🦜', at: [p.at[0] + 0.5, p.at[1] + 0.5], label: '🦜 Попугай Кеша' } } : null),
    })),
    // дневник Лианы у водопада (задание «Дневник исследовательницы»): виден, пока его не нашли
    {
      id: 'notebook',
      at: AT.notebook,
      hit: { r: 40 },
      stand: [AT.notebook[0] + 0.5, AT.notebook[1] + 1.4],
      when: notebookHidden,
      act: 'jungle:notebook',
      key: false,
    },
  ],
  spots: {
    grove: { at: [11.5, 29.5], label: '🍌 Банановая роща' },
    bridge: { at: [21.5, 18.4], label: '🌉 Подвесной мост' },
    canoe: { at: [AT.canoe[0], AT.canoe[1] + 1.3], label: '🛶 Лодочка на реке' },
  },
  // с кораблика выходят у хижины на причале (вход pier)
  entries: { pier: { building: 'dock' } },
  // где разбрасывать предметы заданий (письма с loc: 'jungle'): тропы и подстилка
  zones: { trails: { tiles: ['jtrail', 'jfloor'], reach: { from: [20, 37] } } },
  parts: [plants],
  built(sc) {
    // клетки, до которых от причала не дойти пешком, — закрыть
    sc.map.sealFrom([[20, 37]]);
  },
  enter(sc) {
    bridgeOn = false;
    if (isBathing(sc)) endFallBath(sc);
    if (isCanoeing(sc)) sc.p.ride = null;
    Object.assign(canoe, CANOE_HOME, { dir: -1, fall: false }); // вернулась в джунгли — лодочка снова у мостков
    for (const q of talk) q.next = G.time + 1.5; // попугаи заговорят не сразу
  },
  /** Утром — туман в слое неба. */
  sky(c, sc, lw, lh) {
    const k = mistNow();
    if (k > 0.02) drawMist(c, lw, lh, G.time, k);
  },
  /** Тёплый дождик после обеда (в некоторые дни). */
  overlay(ctx, sc, w, h) {
    if (drizzleNow()) drawDrizzle(ctx, w, h, G.time);
  },
  /** Верёвочные перила подвесного моста — неподвижный рисунок поверх досок (в кэше земли). */
  paintGround(ctx, env, x0, y0, x1, y1) {
    const [bx0, bx1] = AT.bridge;
    if (x1 < bx0 - 1 || x0 > bx1 + 1 || y1 < 11 || y0 > 18) return;
    const [top, bot] = BRIDGE_ROWS;
    if (bot < 0) return;
    for (const xx of [bx0 * T + 3, (bx1 + 1) * T - 3]) {
      ctx.lineCap = 'round';
      for (const [w, c] of [
        [5, '#4a3728'],
        [2.4, '#e0c48c'],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(xx, top * T - 4);
        ctx.quadraticCurveTo(xx + (xx < (bx0 + 1) * T ? 5 : -5), ((top + bot + 1) / 2) * T, xx, (bot + 1) * T + 4);
        ctx.stroke();
      }
      for (const yy of [top * T - 4, (bot + 1) * T + 4]) {
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.arc(xx, yy, 6, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#a8703f';
        ctx.beginPath();
        ctx.arc(xx, yy, 4, 0, 6.2832);
        ctx.fill();
      }
    }
  },
  things(sc, add, v) {
    if (!isCanoeing(sc) && canoe.x > v.x0 - 80 && canoe.x < v.x1 + 80 && canoe.y > v.y0 && canoe.y < v.y1 + 40)
      add(canoe.y + 10, (ctx, _v, t) => drawCanoe(ctx, canoe.x, canoe.y, canoe.dir, t, null, false));
    if (notebookHidden()) {
      const bx = (AT.notebook[0] + 0.5) * T,
        by = (AT.notebook[1] + 0.5) * T;
      if (bx > v.x0 && bx < v.x1 && by > v.y0 && by < v.y1)
        add(by, (ctx, _v, t) => put('notebook', bx, by + 6 + (Math.sin(t * 3) > 0.7 ? -2 : 0)));
    }
  },
  /** Облачка с фразами над попугаями. */
  over(ctx, sc, t) {
    for (let i = 0; i < PARROTS.length; i++) {
      if (!talking(i)) continue;
      const [px, py] = PARROTS[i].at;
      label(ctx, talk[i].text, (px + 0.5) * T + 4, (py + 0.5) * T - 112 + Math.sin(t * 4) * 2, 210, 14, '#fffbe6');
    }
  },
  /** Под водопадом: нажатие куда угодно, стрелки и E — вылезти. */
  tap(sc, w, tx, ty) {
    if (endFallBath(sc) || canoeTap(sc, w, tx, ty)) return true;
    // нажали на лодочку-пирогу — дойти до неё и сесть
    if (dist(w.x, w.y, canoe.x, canoe.y - 6) < 56) {
      sc.goNear(canoe.x, canoe.y, { fn: () => startCanoe(sc) });
      sfx('tap');
      return true;
    }
    return false;
  },
  interact: (sc) => endFallBath(sc) || endCanoe(sc),
  /** Клавиша E рядом с лодочкой — сесть в неё. */
  near(sc) {
    const d = dist(sc.p.x, sc.p.y, canoe.x, canoe.y);
    return !isCanoeing(sc) && d < T * 2 ? { d: d * 0.6, pending: { fn: () => startCanoe(sc) } } : null;
  },
  update(sc, dt) {
    bath.update(sc);
    updateParrots(sc);
    updateCanoe(sc);
  },
  /** Ступила на подвесной мост — событие (наклейка — features/jungle.js). */
  surface(sc, kind) {
    const on = kind === 'jbridge';
    if (on && !bridgeOn) emit('jungle', { what: 'bridge' });
    bridgeOn = on;
  },
  buttons: (sc) =>
    isBathing(sc)
      ? [bath.button(sc)]
      : isCanoeing(sc)
        ? [{ id: 'canoe', icon: '⚓', label: 'Сойти', on: true, fn: () => endCanoe(sc) }]
        : [],
  /** Лодочка-пирога на мини-карте. */
  miniMap(ctx, sc, k) {
    if (isCanoeing(sc)) return;
    emoji(ctx, '🛶', (canoe.x / T) * k, (canoe.y / T) * k, Math.max(12, k * 2.4));
  },
  cold: () => false, // в джунглях всегда тепло
  /** Что слышно: своя музыка, птицы весь год; у водопада и у моря — шум воды; в дождик — капли. */
  sound(sc) {
    const tx = sc.p.x / T,
      ty = sc.p.y / T,
      fall = Math.hypot(tx - AT.pool[0], ty - AT.pool[1]);
    return {
      day: 'jungle',
      sea: Math.max(clamp(0.5 - fall * 0.05, 0, 0.5), clamp((ty - 30) / 10, 0, 0.6)),
      rain: drizzleNow() ? 0.45 : 0,
      drizzle: drizzleNow(),
      birds: true,
      crickets: true,
    };
  },
});
export default jungle;
/** Для отладки и тестов: сколько попугаев сейчас говорит и что. */
export const debugParrots = () => talk.map((q, i) => ({ i, text: q.text, on: talking(i) }));
/** Для тестов: где лодочка-пирога и сидит ли в ней хомячок. */
export const debugCanoe = (sc) => ({ x: canoe.x, y: canoe.y, on: isCanoeing(sc), fall: canoe.fall });

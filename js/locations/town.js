// ГОРОД, двор виллы и пляж — ОПИСАНИЕ ЛОКАЦИИ для «движка локаций» (engine/topdown/scene.js).
// Море с корабликом и островами — часть этой же карты, оно описано в sea.js.
//
// Здесь только то, что есть именно в городе: размер карты и правила её постройки, здания и что происходит
// у их дверей, особые места (почтовый ящик, грядки, пруд, пирс), жители и их места, зоны для предметов
// заданий, точки входа и выхода — и свои виды клеток и предметов (грядка, почтовый ящик, лунка, табличка).
import { clamp, seeded } from '../core/util.js';
import { ell, fillRR, line, poly, emoji } from '../core/draw.js';
import { NPCS, ING_BY_ID, SEED_BY_ID, TASK_BY_ID } from '../data/index.js';
import { G, cal } from '../core/state.js';
import { T, OUT, SP, put, defineTiles, defineObjects } from '../engine/topdown/kinds.js';
import { createTopDownScene } from '../engine/topdown/scene.js';
import './common/index.js';
import { createSea, WORLD_SEA } from './sea.js';
import { HOUSE_ART, HOUSE_STYLE } from './town_buildings.js';

const MW = 96,
  MH = 121;

// ---------- здания ----------
// x, y, w, h — «пятно» здания в клетках; дверь — снизу по центру. id зданий лежат в заданиях и сохранениях —
// не переименовывать. Где что стоит — см. схему в docs/GDD.md («Город»).
const B = (id, kind, x, y, w, h, o = {}) => ({ id, kind, x, y, w, h, ...o });
export const BUILDINGS = [
  B('villa', 'villa', 11, 4, 10, 5, { name: 'Моя вилла', wall: '#fff3d6', roof: '#f76e5c' }),
  // северная улица: магазины и небоскрёбы
  B('salon', 'salon', 32, 9, 4, 4, { name: 'Салон красоты', icon: '💇', wall: '#ffc9de', roof: '#e64980' }),
  B('boutique', 'boutique', 38, 9, 4, 4, { name: 'Бутик «Бантик»', icon: '🎀', wall: '#e5dbff', roof: '#845ef7' }),
  B('mall_fashion', 'mallx', 44, 7, 7, 6, {
    theme: 'fashion',
    name: 'ТЦ «Модный»',
    icon: '👗',
    wall: '#ffe066',
    roof: '#f59f00',
  }),
  B('mall_home', 'mallx', 53, 7, 7, 6, {
    theme: 'home',
    name: 'ТЦ «Уютный дом»',
    icon: '🛋️',
    wall: '#a5d8ff',
    roof: '#1c7ed6',
  }),
  B('fashion', 'towerFashion', 67, 9, 4, 4, { name: 'Дом моды', icon: '👠', wall: '#f783ac', floors: 8 }),
  B('tower', 'towerHamster', 73, 9, 4, 4, { name: 'Хомяк-Тауэр', icon: '🔭', wall: '#74c0fc', floors: 11 }),
  B('bank', 'bank', 79, 9, 4, 4, { name: 'Хомяк-Банк', icon: '💰', wall: '#ffd43b', floors: 7 }),
  B('realtor', 'realtor', 86, 9, 5, 4, {
    name: 'Агентство «Свой домик»',
    icon: '🔑',
    wall: '#d8f5a2',
    roof: '#5c940d',
  }),
  // между северной и главной улицами: ТЦ, рыночная площадь, больница и школа
  B('mall_food', 'mallx', 33, 18, 7, 6, {
    theme: 'food',
    name: 'ТЦ «Вкусный»',
    icon: '🛒',
    wall: '#b2f2bb',
    roof: '#2f9e44',
  }),
  B('market', 'market', 44, 17, 7, 3, { name: 'Рынок', icon: '🧺', wall: '#ffe8cc', roof: '#e8590c' }),
  B('cafe', 'cafe', 56, 17, 4, 4, { name: 'Кафе «Семечка»', icon: '☕', wall: '#ffdeeb', roof: '#d6336c' }),
  B('hospital', 'hospital', 67, 18, 7, 6, { name: 'Больница', icon: '🏥', wall: '#ffffff', roof: '#fa5252' }),
  B('school', 'school', 77, 18, 7, 6, { name: 'Школа', icon: '🔔', wall: '#ffd8a8', roof: '#e8590c' }),
  // к югу от главной улицы
  B('home_apartment', 'apartment', 53, 31, 6, 5, { name: 'Жилой дом', icon: '🏢', wall: '#ffe3e3', roof: '#c92a2a' }),
  B('rest', 'rest', 51, 41, 7, 5, { name: '«Золотой орешек»', icon: '🍽️', wall: '#ffec99', roof: '#c92a2a' }),
  B('pool', 'poolhall', 67, 30, 5, 5, { name: 'Бассейн', icon: '🏊', wall: '#99e9f2', roof: '#0c8599' }),
  B('hotel', 'hotel', 83, 42, 11, 5, { name: 'Отель «Морская звезда»', icon: '🏨', wall: '#fff4e6', roof: '#1098ad' }),
  // на пляже
  B('beachcafe', 'beachcafe', 67, 50, 5, 3, { name: 'Пляжное кафе', icon: '🍹', wall: '#c3fae8', roof: '#12b886' }),
  B('home_bungalow', 'bungalow', 6, 50, 5, 3, { name: 'Бунгало', icon: '🛖', wall: '#ffe8cc', roof: '#e0a458' }),
  // дома жителей: западный квартал (Мята, Плюша, Профессор; Зефирка и Буся) и восточный (Сеня, Боб, Пончик)
  B('house5', 'house', 4, 30, 4, 4, { wall: '#d3f9d8', roof: '#2f9e44', npc: 'myata' }),
  B('house0', 'house', 12, 31, 4, 4, { wall: '#ffe8cc', roof: '#e8590c', npc: 'plusha' }),
  B('house4', 'house', 21, 30, 4, 4, { wall: '#f1e0c5', roof: '#8d5524', npc: 'prof' }),
  B('house7', 'house', 5, 40, 4, 4, { wall: '#fff0f6', roof: '#f06595', npc: 'zefirka' }),
  B('house3', 'house', 18, 41, 4, 4, { wall: '#ffdeeb', roof: '#c2255c', npc: 'busya' }),
  B('house2', 'house', 87, 30, 4, 4, { wall: '#e9ecef', roof: '#495057', npc: 'senya' }),
  B('house6', 'house', 67, 40, 4, 4, { wall: '#c5f6fa', roof: '#0b7285', npc: 'bob' }),
  B('house1', 'house', 75, 41, 4, 4, { wall: '#d0ebff', roof: '#1971c2', npc: 'ponchik' }),
];
// Что происходит на входе в здание: записи для реестра действий (core/registry.js). Сам город про магазины,
// мини-игры и диалоги ничего не знает. У домиков жителей действие одно: 'home-of:<житель>'.
// 'soon' — временная заглушка «Скоро открытие!» (features/soon.js) для мест, которые ещё строятся:
// ключ места — realtor, home_apartment, home_bungalow, hotel (и forest, desert — у выездов из города, см. PLACES).
const ask = (vendor, text, options) => ({ do: 'ask', vendor, text, options });
const soon = (key) => ({ do: 'soon', key });
const BUILDING_ACTS = {
  villa: 'scene:villa',
  salon: 'salon',
  boutique: { do: 'clothes-shop', vendor: 'boutique', shops: ['boutique'] },
  mall_fashion: { do: 'clothes-shop', vendor: 'mall', shops: ['mall'] },
  mall_home: 'home-mall',
  mall_food: 'food-mall',
  market: 'market',
  cafe: { do: 'cafe', kind: 'cafe' },
  tower: 'scene:tower',
  bank: 'bank',
  realtor: soon('realtor'),
  home_apartment: soon('home_apartment'),
  home_bungalow: soon('home_bungalow'),
  hotel: soon('hotel'),
  fashion: ask('fashion', 'Дорогая! Подиум ждёт. Выйдешь на показ мод?', [
    { text: '👠 На подиум!', cls: 'green', do: 'minigame:fashion' },
    { text: 'Не сейчас' },
  ]),
  hospital: ask('hospital', 'Ой, как хорошо, что ты пришла! Пациентов много. Поможешь их вылечить?', [
    { text: '🩺 Лечить', cls: 'green', do: 'minigame:doctor' },
    { text: 'Не сейчас' },
  ]),
  school: ask('school', 'Здравствуй! Детям как раз нужна учительница. Проведёшь урок?', [
    { text: '👩‍🏫 Провести урок', cls: 'green', do: 'minigame:teacher' },
    { text: 'Не сейчас' },
  ]),
  pool: ask('pool', 'На старт, внимание… Хочешь поучаствовать в заплыве?', [
    { text: '🏊 Плыть!', cls: 'green', do: 'minigame:swim' },
    { text: 'Не сейчас' },
  ]),
  rest: ask('rest', 'Добро пожаловать в «Золотой орешек»! Желаете поужинать — или поможете мне на кухне?', [
    { text: '👩‍🍳 Помочь на кухне', cls: 'green', do: 'minigame:chef' },
    { text: '🍽️ Меню', do: { do: 'cafe', kind: 'rest', title: 'Ресторан «Золотой орешек»' } },
    { text: 'Пока!' },
  ]),
  beachcafe: ask('beach', 'Привет! У нас холодный лимонад и всё для пляжа. Что тебе показать?', [
    { text: '🍹 Вкусняшки', cls: 'green', do: { do: 'cafe', kind: 'beach', title: 'Пляжное кафе' } },
    {
      text: '🩱 Пляжные вещи',
      do: { do: 'clothes-shop', vendor: 'beach', shops: ['beach'], title: 'Пляжный магазинчик' },
    },
    { text: 'Пока!' },
  ]),
};
for (const b of BUILDINGS) {
  b.act = BUILDING_ACTS[b.id] || (b.npc ? 'home-of:' + b.npc : null);
  // дома жителей — по характеру хозяина: ставни, дорисовка поверх общего домика
  if (b.npc) Object.assign(b, HOUSE_STYLE[b.npc], { art: HOUSE_ART[b.npc] });
}

// ---------- жители ----------
// Где кто гуляет днём (клетка); вечером каждый идёт к своему домику.
const HANG = {
  plusha: [45, 34], // парк, у детской площадки
  ponchik: [57, 23], // столики кафе на площади
  senya: [70, 36], // у бассейна
  busya: [49, 14], // у ТЦ «Модный»
  prof: [80, 25], // у школы
  myata: [36, 42], // парк, у пруда
  bob: [63, 58], // пирс
  zefirka: [40, 53], // пляж
};
const ACTORS = NPCS.map((n) => ({ npc: n.id, at: HANG[n.id], home: BUILDINGS.find((b) => b.npc === n.id).id }));

// ---------- выезды из города ----------
// Тропа в лес (северо-запад, за виллой) и дорога в пустыню (восточная окраина) перекрыты воротами и шлагбаумом.
// Клетки под ними (виды gateF, gateD) проходимы, только когда открыт выход с тем же именем — см. exits в описании:
// откроется выход (off: false / when) — ворота распахнутся сами.
const GATES = {
  forest: { cells: [1, 2, 2, 2], behind: [1, 0, 2, 1] }, // ворота: клетки x0, y0, x1, y1; behind — тропа за ними
  desert: { cells: [94, 26, 94, 27], behind: [95, 26, 95, 27] },
};
let townScene = null;
function gateOpen(id) {
  const e = townScene && townScene.exit(id);
  return !!e && !e.off && (!e.when || e.when());
}

// ---------- особые места ----------
const BEDS = { x: 20, n: 4, rows: [10, 12] }; // грядки: два ряда по четыре, слева направо
const bedIndex = (tx, ty) => (ty === BEDS.rows[0] ? 0 : BEDS.n) + (tx - BEDS.x);
const notWinter = () => cal().season !== 'winter',
  winter = () => cal().season === 'winter';
const PLACES = [
  // почтовый ящик у двери виллы
  {
    id: 'mailbox',
    at: [18, 9],
    hit: { dx: 34, up: 64, down: 30 },
    stand: [18.5, 10.5],
    mark: [18.5, 9.5],
    act: 'mailbox',
  },
  // зимняя лунка на пруду во дворе
  { id: 'icehole', at: [22, 19], hit: { r: 30 }, stand: [23.5, 19.5], when: winter, act: 'fish:pond', key: false },
  // грядки: встаём под грядкой
  ...Array.from({ length: BEDS.n * BEDS.rows.length }, (_, i) => {
    const x = BEDS.x + (i % BEDS.n),
      y = BEDS.rows[Math.floor(i / BEDS.n)];
    return { id: 'bed' + i, cell: [x, y], stand: [x + 0.5, y + 1.5], act: 'garden:' + i, shy: 0.6 };
  }),
  // пруды (во дворе и в парке), пока не замёрзли: рыбалка с берега
  { id: 'pond', tile: 'd', when: notWinter, act: 'fish:pond' },
  // конец пирса: рыбалка
  {
    id: 'pier',
    area: [63, 60, 64, 62],
    stand: [63.5, 61.5],
    mark: [64, 61.5],
    reach: 1.5,
    act: 'fish:pier',
    map: { icon: '🎣', at: [64, 61], label: '🎣 Пирс' },
  },
  // выезды из города (пока закрыты): тропа в лес и остановка каравана в пустыню
  {
    id: 'forest',
    at: [1.5, 2],
    hit: { dx: 62, up: 70, down: 30 },
    stand: [2, 3.6],
    act: soon('forest'),
    key: false,
    map: { icon: '🌲', at: [2, 2.5], label: '🌲 Тропа в лес' },
  },
  {
    id: 'desert',
    at: [89.5, 25],
    hit: { dx: 60, up: 84, down: 24 },
    stand: [91.5, 26.4],
    act: soon('desert'),
    key: false,
    map: { icon: '🐫', at: [92, 25.5], label: '🐫 Караван в пустыню' },
  },
];
const POOLS = [
  [6, 16, 8, 7],
  [74, 30, 9, 6],
]; // бассейны: клетка, ширина, высота
const YARD = [4, 3, 27, 24]; // двор виллы: по этим клеткам идёт забор
const PARK = { x0: 32, y0: 29, x1: 49, y1: 46, pond: [40.5, 38.5, 4.1, 2.9], ring: [6.6, 5.6] }; // парк с прудом

// ---------- свои виды клеток и предметов ----------
defineTiles({
  // грядка: что на ней растёт, записано в сохранении (state.garden); росток рисуется каждый кадр (live)
  b: {
    map: '#8d5a3a',
    block: true,
    z: 12,
    fill: (env) => (env.season === 'winter' ? '#9a735a' : '#8d5a3a'),
    edge: {
      r: 9,
      out: [
        ['rgba(60,40,20,.25)', 9],
        [OUT, 5],
      ],
      in: [['rgba(255,220,170,.22)', 5]],
    },
    deco: bedDeco,
    live: bedLive,
  },
  // клетки под воротами выездов: тропа и дорога, по которым можно пройти, только когда выезд открыт
  gateF: { like: 'y', gate: true, walk: () => gateOpen('forest') },
  gateD: { like: 'r', gate: true, walk: () => gateOpen('desert') },
});
function bedDeco(ctx, x, y, tx, ty, env) {
  // борозды и перегородка между соседними грядками
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(x + 7, y + 15, T - 14, 3);
  ctx.fillRect(x + 7, y + 28, T - 14, 3);
  ctx.fillStyle = 'rgba(255,225,180,.16)';
  ctx.fillRect(x + 7, y + 18, T - 14, 1.6);
  ctx.fillRect(x + 7, y + 31, T - 14, 1.6);
  ctx.fillStyle = 'rgba(60,35,15,.5)';
  ctx.fillRect(x - 1, y + 6, 2, T - 12);
  if (env.season === 'winter') {
    // парничок: прозрачный колпак
    ctx.beginPath();
    ctx.ellipse(x + T / 2, y + T - 6, T / 2 - 5, T - 16, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(210,240,255,.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function bedLive(ctx, cells, n) {
  for (let q = 0; q < n; q += 2) {
    const tx = cells[q],
      ty = cells[q + 1],
      x = tx * T,
      y = ty * T,
      i = bedIndex(tx, ty),
      bed = G.state.garden[i];
    if (!bed || !bed.seed) continue;
    const sd = SEED_BY_ID[bed.seed],
      ripe = sd && bed.age >= sd.days,
      k = sd ? Math.min(1, bed.age / sd.days) : 0;
    if (ripe) emoji(ctx, ING_BY_ID[sd.crop].e, x + T / 2, y + T / 2 - 4 + Math.sin(G.time * 3 + i) * 2, 28);
    else {
      const hgt = 8 + k * 14;
      line(ctx, x + T / 2, y + 30, x + T / 2, y + 30 - hgt, '#2f9e44', 3);
      ell(ctx, x + T / 2 - 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, -0.5);
      ell(ctx, x + T / 2 + 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, 0.5);
    }
  }
}
defineObjects({
  mailbox: {
    solid: true,
    art: {
      mailbox: [
        [-26, -58, 40, 24],
        (ctx, has) => {
          ell(ctx, 0, 14, 14, 5, 'rgba(0,0,0,.14)');
          fillRR(ctx, -4, -14, 8, 30, 2, '#8d5524', OUT, 2);
          fillRR(ctx, -20, -40, 40, 28, 12, '#fa5252', OUT, 2.5);
          fillRR(ctx, -12, -30, 24, 4, 2, '#7a1f1f');
          if (has) {
            line(ctx, 20, -28, 20, -52, OUT, 3);
            poly(ctx, [20, -52, 34, -47, 20, -42], '#ffd43b', OUT, 1.5);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      const m = G.state.mail,
        has = m && !m.read;
      put('mailbox', o.x, o.y, has ? 1 : 0);
      if (has) {
        SP.world();
        emoji(ctx, '✉️', o.x, o.y - 64 + Math.sin(env.t * 5) * 5, 26);
      }
    },
  },
  icehole: {
    flat: true,
    art: {
      icehole: [
        [-22, -28, 36, 16],
        (ctx) => {
          ell(ctx, 0, 0, 15, 10, '#3fa9e6', '#fff', 3);
          line(ctx, 18, 6, 30, -22, '#8d5524', 3);
          line(ctx, 30, -22, 4, -2, '#868e96', 1);
        },
      ],
    },
    draw(ctx, o, env) {
      if (env.season === 'winter') put('icehole', o.x, o.y);
    },
  },
  fishsign: {
    art: {
      fishsign: [
        [-26, -52, 26, 16],
        (ctx) => {
          fillRR(ctx, -3, -20, 6, 30, 2, '#8d5524', OUT, 1.5);
          fillRR(ctx, -20, -46, 40, 28, 6, '#fff3bf', OUT, 2);
          emoji(ctx, '🎣', 0, -32, 20);
        },
      ],
    },
    draw(ctx, o) {
      put('fishsign', o.x, o.y);
    },
  },
});

// ---------- построение карты ----------
const sea = createSea(WORLD_SEA);
function build(m) {
  const g = m.ground,
    solid = m.solid,
    fill = m.fill,
    add = m.add;
  const SH = WORLD_SEA.shallowY;
  // ---- пляж и море ----
  fill(0, 50, MW - 1, SH - 1, 's');
  sea.buildGround(m);
  // ---- улицы ----
  fill(28, 14, 93, 15, 'r'); // Северная улица
  fill(31, 13, 91, 13, 'r'); // тротуар перед магазинами
  fill(1, 26, 95, 27, 'r'); // Главная улица
  fill(29, 14, 30, 49, 'r'); // Западный проспект
  fill(63, 14, 64, 49, 'r'); // Морской проспект — к пирсу
  fill(0, 48, MW - 1, 49, 'r'); // набережная
  fill(42, 16, 61, 25, 'k'); // рыночная площадь с фонтаном
  fill(33, 24, 39, 25, 'r'); // перед ТЦ «Вкусный»
  fill(67, 24, 73, 25, 'r'); // перед больницей
  fill(77, 24, 83, 25, 'r'); // перед школой
  fill(83, 47, 93, 47, 'r'); // перед отелем
  fill(51, 46, 59, 47, 'r'); // терраса ресторана
  fill(63, 50, 64, 62, 'i'); // пирс
  for (const id of Object.keys(GATES)) {
    const [x0, y0, x1, y1] = GATES[id].cells;
    fill(x0, y0, x1, y1, id === 'forest' ? 'gateF' : 'gateD');
  }
  // ---- двор виллы ----
  fill(15, 9, 16, 25, 'y');
  fill(15, 14, 28, 15, 'y');
  fill(5, 15, 14, 23, 'p');
  fill(6, 16, 13, 22, 'o');
  for (let y = 16; y <= 22; y++)
    for (let x = 19; x <= 26; x++) {
      if (((x + 0.5 - 22.5) / 3.2) ** 2 + ((y + 0.5 - 19.5) / 2.6) ** 2 <= 1) g[y][x] = 'd';
    }
  for (const y of BEDS.rows) for (let x = BEDS.x; x < BEDS.x + BEDS.n; x++) g[y][x] = 'b';
  // ---- тропа в лес вдоль западного края ----
  fill(1, 0, 2, 1, 'y');
  fill(1, 3, 2, 25, 'y');
  // ---- западный квартал: тропинки между домами ----
  const path = (cells) => {
    for (const [x0, y0, x1, y1] of cells) fill(x0, y0, x1 === undefined ? x0 : x1, y1 === undefined ? y0 : y1, 'y');
  };
  path([
    [3, 36, 9, 36], // улочка петляет
    [9, 37, 17, 37],
    [17, 36, 28, 36],
    [5, 34, 5, 35], // к дому Мяты
    [13, 35, 13, 36], // к дому Плюши
    [22, 34, 22, 35], // к дому Профессора
    [12, 38, 12, 47], // с улочки на набережную
    [6, 44, 6, 47], // от дома Зефирки
    [19, 45, 19, 47], // от дома Буси
  ]);
  // ---- парк: кольцо вокруг пруда и дорожки к улицам ----
  {
    const [cx, cy, prx, pry] = PARK.pond,
      [rx, ry] = PARK.ring;
    for (let y = PARK.y0; y <= PARK.y1; y++)
      for (let x = PARK.x0; x <= PARK.x1; x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        if ((dx / prx) ** 2 + (dy / pry) ** 2 <= 1) g[y][x] = 'd';
        else {
          const d = Math.hypot(dx / rx, dy / ry);
          if (d > 0.86 && d <= 1.06) g[y][x] = 'y';
        }
      }
    path([
      [40, 28, 40, 33], // с Главной улицы
      [40, 44, 40, 47], // на набережную
      [31, 38, 34, 38], // с Западного проспекта
      [46, 38, 62, 38], // к жилому дому и Морскому проспекту
      [55, 36, 56, 37], // к двери жилого дома
    ]);
  }
  // ---- восточный квартал ----
  fill(73, 29, 83, 34, 'p'); // городской бассейн
  fill(67, 35, 83, 36, 'p');
  fill(74, 30, 82, 35, 'o');
  fill(83, 30, 83, 35, 'p');
  path([
    [65, 37, 88, 37], // улочка за бассейном
    [88, 34, 88, 36], // к дому Сени
    [68, 44, 68, 47], // от дома Боба
    [76, 45, 76, 47], // от дома Пончика
  ]);
  fill(69, 37, 70, 37, 'p');

  // ---- заборы ----
  const taken = new Set(); // клетки, где зелень сама не вырастет
  const keep = (x0, y0, x1 = x0, y1 = y0) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) taken.add(x + ',' + y);
  };
  const put1 = (type, x, y, o) => {
    keep(x, y);
    return add(type, x, y, o);
  };
  /** Забор по рамке [x0, y0, x1, y1]; skip(x, y) — где пропустить (калитки); стороны: 't', 'b', 'l', 'r'. */
  const fence = ([x0, y0, x1, y1], sides, skip = () => false, v = 0) => {
    const ok = (x, y) => g[y][x] === 'g' && !solid[y][x] && !skip(x, y) && !taken.has(x + ',' + y);
    for (let x = x0; x <= x1; x++)
      for (const [s, y] of [
        ['t', y0],
        ['b', y1],
      ])
        if (sides.includes(s) && ok(x, y)) put1('fenceH', x, y, { v });
    for (let y = y0 + 1; y <= y1 - 1; y++)
      for (const [s, x] of [
        ['l', x0],
        ['r', x1],
      ])
        if (sides.includes(s) && ok(x, y)) put1('fenceV', x, y, { v });
  };
  // вилла: белый штакетник кругом, ворота на восток и на юг
  fence(YARD, 'tblr');

  // ---- двор виллы: почтовый ящик, лежаки, фонари, клумбы ----
  put1('mailbox', 18, 9);
  put1('icehole', 22, 19);
  for (const x of [7, 9, 11]) put1('lounger', x, 14);
  put1('umbrella', 13, 14, { solid: true });
  put1('lamp', 14, 10);
  put1('lamp', 17, 23);
  put1('flowerbed', 13, 9, { v: 0 });
  put1('flowerbed', 19, 9, { v: 1 });
  put1('bench', 24, 22);
  put1('reeds', 19, 18);
  put1('reeds', 26, 20, { v: 1 });
  keep(10, 9, 21, 9); // перед виллой чисто
  keep(11, 3, 20, 3);

  // ---- выезды из города ----
  put1('gate', 1, 2, { open: () => gateOpen('forest'), text: '🌲 ЛЕС' });
  put1('signpost', 3, 4, { text: '🌲 В лес', solid: true });
  put1('busstop', 89, 25);
  put1('signpost', 92, 25, { text: '🐫 Пустыня' });
  put1('barrier', 94, 26, { open: () => gateOpen('desert') });
  put1('hedge', 95, 25); // за шлагбаум — только по дороге
  put1('hedge', 95, 28);
  put1('hedge', 94, 25);
  put1('hedge', 94, 28);
  keep(87, 24, 95, 25);

  // ---- северная улица: фонари, кадки, скамейки, указатели ----
  for (const x of [36, 42, 51, 60, 66, 72, 78, 84, 91]) put1('lamp', x, 12);
  for (const [x, v] of [
    [31, 0],
    [37, 1],
    [43, 2],
    [52, 0],
    [71, 1],
    [77, 2],
    [83, 0],
  ])
    put1('planter', x, 12, { v });
  for (const x of [41, 61, 65, 85]) put1('bench', x, 12);
  put1('bin', 62, 12);
  put1('signpost', 31, 16, { text: 'Площадь →', text2: '← Вилла' });
  // скверик у небоскрёбов
  put1('statue', 63, 9);
  for (const [x, y, v] of [
    [62, 10, 0],
    [64, 10, 2],
    [62, 8, 3],
    [64, 8, 1],
  ])
    put1('flowerbed', x, y, { v });
  keep(61, 7, 65, 12);

  // ---- рыночная площадь ----
  put1('fountain', 51, 22, { big: true });
  keep(52, 22);
  for (const [x, y] of [
    [42, 16],
    [61, 16],
    [42, 25],
    [61, 25],
    [52, 16],
  ])
    put1('lamp', x, y);
  for (const [x, y, v] of [
    [44, 20, 0],
    [45, 20, 1],
    [50, 20, 2],
    [43, 18, 3],
    [51, 18, 4],
  ])
    put1('crate', x, y, { v });
  put1('barrel', 51, 19);
  for (const [x, y, v] of [
    [54, 18, 0],
    [61, 19, 1],
    [55, 23, 4],
    [60, 22, 2],
  ])
    put1('cafeTable', x, y, { v });
  put1('bench', 48, 23);
  put1('bench', 55, 25);
  put1('bench', 46, 25);
  put1('flowerbed', 43, 23, { v: 2 });
  put1('flowerbed', 60, 25, { v: 0 });
  put1('bin', 53, 20);
  put1('signpost', 62, 25, { text: 'Пирс ↓', text2: '← Рынок', solid: true });
  // у ТЦ «Вкусный», больницы и школы
  put1('planter', 32, 24, { v: 1 });
  put1('planter', 40, 24, { v: 1 });
  put1('lamp', 41, 25);
  put1('ambulance', 74, 24);
  put1('lamp', 66, 25);
  put1('bench', 76, 25);
  put1('flag', 84, 24);
  put1('lamp', 85, 25);
  put1('swing', 87, 21);
  put1('ball', 86, 23, { v: 1 });
  put1('bench', 89, 22);
  keep(84, 17, 92, 23);

  // ---- западный квартал: дворики ----
  // Мята: теплица, клумбы, заборчик
  fence([2, 29, 10, 35], 'tlrb', (x, y) => y === 35 && (x === 5 || x === 6), 1);
  put1('greenhouse', 8, 32);
  for (const [x, y, v] of [
    [3, 31, 0],
    [3, 33, 1],
    [8, 34, 3],
  ])
    put1('flowerbed', x, y, { v });
  put1('postbox', 7, 35, { v: 2 });
  for (const [x, y, v] of [
    [3, 34, 1],
    [4, 34, 2],
    [7, 34, 0],
    [9, 34, 3],
    [9, 30, 0],
    [3, 30, 2],
  ])
    put1('flowers', x, y, { v });
  // Плюша: уютное крыльцо — скамейка, бельё, кадки
  fence([11, 30, 17, 36], 'tlr', undefined, 1);
  put1('clothesline', 16, 32, { v: 0 });
  put1('bench', 16, 35);
  put1('planter', 12, 35, { v: 1 });
  put1('planter', 15, 35, { v: 1 });
  put1('postbox', 15, 36, { v: 3 });
  put1('flowers', 11, 35, { v: 1 });
  put1('flowers', 17, 34, { v: 0 });
  // Профессор: глобус, скамейка с книгами
  fence([19, 29, 27, 35], 'tlrb', (x, y) => y === 35 && (x === 22 || x === 23), 1);
  put1('globe', 25, 34);
  put1('bench', 20, 34);
  put1('postbox', 24, 35, { v: 1 });
  put1('lamp', 26, 33);
  put1('flowerbed', 25, 31, { v: 3 });
  // Зефирка: качели, песочница, игрушки
  fence([2, 39, 10, 47], 'tlr', undefined, 1);
  put1('swing', 3, 45);
  put1('sandbox', 9, 45);
  put1('toys', 8, 46);
  put1('ball', 4, 43, { v: 0 });
  put1('postbox', 8, 44, { v: 4 });
  put1('flowers', 9, 41, { v: 0 });
  put1('flowers', 3, 41, { v: 3 });
  // Буся: манекен, розовые клумбы
  fence([15, 40, 24, 47], 'tr', undefined, 1);
  put1('mannequin', 22, 45, { v: 0 });
  put1('mannequin', 16, 45, { v: 1 });
  put1('flowerbed', 23, 43, { v: 1 });
  put1('flowerbed', 16, 43, { v: 0 });
  put1('postbox', 21, 45, { v: 4 });
  put1('clothesline', 22, 42, { v: 3 });
  // улочка: фонари и скамейки
  put1('lamp', 10, 38);
  put1('lamp', 18, 38);
  put1('lamp', 27, 37);
  put1('bench', 14, 38);
  put1('signpost', 28, 35, { text: '← Садовая улочка' });
  put1('hedge', 13, 39);
  put1('hedge', 14, 39);
  keep(5, 34, 6, 35);
  keep(13, 35, 14, 36);
  keep(22, 34, 23, 35);

  // ---- парк ----
  put1('signpost', 41, 29, { text: '🌳 Парк' });
  put1('lamp', 39, 30);
  put1('lamp', 33, 37);
  put1('lamp', 47, 39);
  put1('lamp', 41, 45);
  put1('lamp', 35, 33);
  put1('lamp', 46, 44);
  for (const [x, y] of [
    [37, 33],
    [44, 33],
    [34, 40],
    [47, 36],
    [37, 44],
    [43, 44],
  ])
    put1('bench', x, y);
  for (const [x, y, v] of [
    [33, 33, 0],
    [47, 43, 1],
    [33, 44, 2],
    [38, 30, 3],
    [42, 31, 1],
  ])
    put1('flowerbed', x, y, { v });
  // детская площадка в северо-восточном углу
  put1('swing', 45, 30);
  put1('slide', 48, 31);
  put1('sandbox', 46, 32);
  put1('toys', 47, 33);
  put1('ball', 44, 31, { v: 3 });
  keep(43, 29, 49, 34);
  // камыши и камни у пруда
  for (const [x, y, v] of [
    [36, 37, 0],
    [45, 40, 1],
    [38, 41, 1],
    [43, 36, 0],
  ])
    put1('reeds', x, y, { v });
  put1('rock', 36, 40, { v: 0 });
  put1('rock', 44, 37, { v: 1 });
  put1('bin', 41, 34);
  // живая изгородь вдоль улиц
  for (let x = 32; x <= 49; x++) if (x !== 40 && x !== 41 && x % 3 !== 1) put1('hedge', x, 28, { v: x % 2 });
  for (let x = 32; x <= 49; x++) if (x !== 40 && x !== 39 && x % 3 !== 0) put1('hedge', x, 47, { v: 1 });

  // ---- жилой дом и ресторан ----
  put1('planter', 54, 36, { v: 0 });
  put1('planter', 57, 36, { v: 0 });
  put1('bench', 59, 36);
  put1('lamp', 52, 37);
  put1('lamp', 61, 39);
  put1('postbox', 58, 37, { v: 0 });
  put1('hedge', 51, 30, { v: 1 });
  put1('hedge', 52, 30, { v: 0 });
  put1('hedge', 59, 30, { v: 1 });
  put1('hedge', 60, 30, { v: 0 });
  for (const [x, y, v] of [
    [59, 43, 0],
    [60, 45, 3],
    [59, 47, 0],
    [52, 47, 3],
    [57, 47, 0],
  ])
    put1('cafeTable', x, y, { v });
  put1('lamp', 58, 45);
  put1('planter', 51, 46, { v: 2 });
  keep(51, 46, 61, 47);
  keep(50, 36, 62, 37);

  // ---- восточный квартал ----
  for (const x of [73, 75, 77, 79, 81]) put1('lounger', x, 36);
  put1('umbrella', 83, 36, { solid: true });
  put1('umbrella', 78, 36, { solid: true });
  put1('lamp', 66, 36);
  put1('lamp', 72, 38);
  put1('lamp', 84, 38);
  put1('planter', 67, 35, { v: 2 });
  put1('planter', 71, 35, { v: 2 });
  put1('signpost', 65, 36, { text: 'Бассейн →' });
  // Сеня: спортплощадка
  fence([85, 29, 93, 36], 'tlr', undefined, 1);
  put1('hoop', 92, 34);
  put1('dumbbells', 86, 34);
  put1('ball', 91, 35, { v: 2 });
  put1('ball', 86, 32, { v: 1 });
  put1('postbox', 90, 35, { v: 1 });
  put1('bench', 86, 35);
  // Боб: якорь, лодка, бочки
  fence([65, 39, 73, 47], 'tr', undefined, 1);
  put1('anchor', 71, 45);
  put1('rowboat', 66, 45);
  put1('barrel', 71, 43);
  put1('barrel', 72, 44);
  put1('postbox', 70, 44, { v: 1 });
  put1('clothesline', 71, 41, { v: 2 });
  // Пончик: мангал, стол для пикника, тыквы
  fence([74, 40, 81, 47], 'tr', undefined, 1);
  put1('bbq', 79, 46);
  put1('picnicTable', 80, 44);
  put1('crate', 74, 45, { v: 1 });
  put1('postbox', 78, 45, { v: 3 });
  put1('flowerbed', 74, 43, { v: 2 });
  keep(68, 44, 69, 47);
  keep(76, 45, 77, 47);
  keep(88, 34, 89, 36);
  // отель: пальмы в кадках, фонари, столики
  for (const x of [84, 86, 91, 93]) put1('planter', x, 47, { v: 2 });
  put1('lamp', 82, 47);
  put1('signpost', 82, 46, { text: 'Отель →' });

  // ---- набережная ----
  for (let x = 4; x < MW; x += 8) if (g[47][x] === 'g' && !solid[47][x] && !taken.has(x + ',47')) put1('lamp', x, 47);
  for (const x of [25, 34, 45, 62, 81])
    if (g[47][x] === 'g' && !solid[47][x] && !taken.has(x + ',47')) put1('bench', x, 47);
  put1('signpost', 65, 47, { text: 'Пирс ↓', text2: '← Пляж', solid: true });
  // ---- пляж ----
  put1('fishsign', 64, 62);
  sea.buildObjects(m);
  for (const [x, y] of [
    [18, 52],
    [26, 53],
    [34, 51],
    [44, 53],
    [52, 52],
    [58, 54],
    [76, 53],
  ]) {
    put1('umbrella', x, y, { beach: true });
    keep(x - 1, y);
  }
  // пляж отеля: лежаки и зонтики рядами
  for (const x of [84, 87, 90, 93]) {
    put1('lounger', x, 52);
    put1('umbrella', x + 1, 52, { solid: true, v: 1 });
  }
  for (const [x, y, v] of [
    [22, 54, 0],
    [38, 52, 1],
    [48, 54, 2],
    [80, 54, 3],
  ])
    put1('towel', x, y, { v });
  put1('lifeguard', 56, 51);
  put1('net', 29, 54);
  put1('ball', 31, 55, { v: 3, summer: true });
  put1('sandcastle', 41, 54);
  put1('sandcastle', 73, 55);
  put1('starfish', 15, 55);
  put1('starfish', 60, 55);
  put1('starfish', 88, 55);
  put1('crab', 36, 55);
  put1('crab', 78, 55);
  put1('rowboat', 61, 53);
  // бунгало: гамак между пальмами, шезлонг
  put1('palm', 12, 51, { v: 0 });
  put1('hammock', 13, 51, { v: 0 });
  put1('palm', 15, 51, { v: 1 });
  put1('palm', 4, 51, { v: 2 });
  put1('lounger', 11, 53);
  put1('barrel', 5, 52);
  keep(6, 53, 10, 54);
  // пляжное кафе: столики
  put1('cafeTable', 73, 51, { v: 2 });
  put1('cafeTable', 66, 53, { v: 3 });
  put1('barrel', 72, 52);
  keep(67, 53, 71, 54);
  // пальмы вдоль набережной
  for (let x = 2; x < MW; x += 4) {
    if (x >= 62 && x <= 65) continue;
    if (g[50][x] === 's' && !solid[50][x] && !taken.has(x + ',50')) put1('palm', x, 50, { v: x % 3 });
  }

  // ---- деревья, кусты, цветы ----
  const rng = seeded(20261112);
  for (const o of m.objs) taken.add(o.tx + ',' + o.ty);
  const nearDoor = (x, y) =>
    BUILDINGS.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y + b.h && y <= b.y + b.h + 1);
  const isG = (x, y) => g[y] && g[y][x] === 'g' && !solid[y][x] && !taken.has(x + ',' + y);
  const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // где что растёт: [рамка, [деревья, кусты, цветы], виды деревьев]
  const WOODS = [0, 0, MW - 1, 2],
    AREAS = [
      [[0, 0, 0, 25], [0.92, 0, 0], 'pine'], // лесная опушка вдоль западного края и по северу
      [[3, 0, 3, 25], [0.8, 0.1, 0], 'pine'],
      [WOODS, [0.85, 0.05, 0], 'pine'],
      [[28, 3, MW - 1, 6], [0.4, 0.1, 0.1], 'mix'],
      [[5, 4, 26, 23], [0.07, 0.08, 0.18], 'yard'], // двор виллы
      [[PARK.x0, PARK.y0, PARK.x1, PARK.y1], [0.13, 0.05, 0.12], 'tree'],
      [[0, 28, 28, 47], [0.07, 0.05, 0.1], 'south'],
      [[65, 28, MW - 1, 47], [0.07, 0.05, 0.1], 'south'],
      [[50, 28, 62, 47], [0.08, 0.06, 0.08], 'south'],
      [[0, 0, MW - 1, 49], [0.13, 0.06, 0.1], 'mix'],
    ];
  for (let y = 0; y < 50; y++)
    for (let x = 0; x < MW; x++) {
      if (!isG(x, y) || nearDoor(x, y)) continue;
      const [, dens, kind] = AREAS.find((a) => inRect(x, y, a[0]));
      let lonely = true; // деревья — не вплотную к дорожкам
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const c = g[y + dy] && g[y + dy][x + dx];
        if (c && c !== 'g') lonely = false;
      }
      const r = rng(),
        v = Math.floor(rng() * 3);
      const wood = kind === 'pine';
      if (r < dens[0] && (lonely || wood)) {
        const q = rng();
        const type =
          kind === 'pine'
            ? q < 0.7
              ? 'pine'
              : 'tree'
            : kind === 'yard'
              ? q < 0.5
                ? 'palm'
                : 'tree'
              : kind === 'south'
                ? q < 0.6
                  ? 'palm'
                  : 'tree'
                : kind === 'tree'
                  ? q < 0.85
                    ? 'tree'
                    : 'pine'
                  : q < 0.3
                    ? 'pine'
                    : 'tree';
        add(type, x, y, { v });
      } else if (r < dens[0] + dens[1]) add('bush', x, y, { v });
      else if (r < dens[0] + dens[1] + dens[2]) add('flowers', x, y, { v: Math.floor(rng() * 4) });
    }
}

/**
 * Клетки города, до которых нельзя дойти от двери виллы (карманы между деревьями и заборами), становятся
 * непроходимыми: хомячок из старого сохранения, оказавшийся в таком кармане, встанет рядом, а не застрянет.
 * Ворота выездов считаются проходимыми — тропа за ними остаётся тропой.
 */
function sealPockets(m) {
  const w = m.w,
    h = 50;
  const seen = new Uint8Array(w * h);
  const ok = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (m.foot(x, y) || (m.kinds[y][x].gate && !m.solid[y][x]));
  const d = m.doorPx(m.bById.villa);
  const q = [[Math.floor(d.x / T), Math.floor(d.y / T)]];
  seen[q[0][1] * w + q[0][0]] = 1;
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
      if (ok(nx, ny) && !seen[ny * w + nx]) {
        seen[ny * w + nx] = 1;
        q.push([nx, ny]);
      }
    }
  }
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!seen[y * w + x] && m.foot(x, y)) {
        m.solid[y][x] = true;
        n++;
      }
  return n;
}

/** Куда идти по заданию из письма (единицы мира) или null. */
function target(sc) {
  const m = G.state.mail;
  if (!m) return null;
  if (!m.read) return { ...sc.spot('mailbox'), icon: '✉️' };
  if (m.done) return null;
  const t = TASK_BY_ID[m.task];
  if (!t) return null;
  if (t.type === 'collect' && m.items) {
    const it = m.items.find((i) => !i.got && sc.itemHere(i));
    return it ? { x: (it.x + 0.5) * T, y: (it.y + 0.5) * T, icon: t.sticker } : null;
  }
  const wh = t.where;
  if (wh === 'town') return null;
  const b = sc.map.bById[wh];
  if (b) {
    const d = sc.map.doorPx(b);
    return { x: d.x, y: d.y - T, icon: '⭐' };
  }
  const s = sc.spot(wh); // пирс, пляж
  return s ? { ...s, icon: '⭐' } : null;
}

const town = createTopDownScene({
  id: 'world', // имя сцены лежит в сохранениях: { scene: 'world', x, y } — не менять
  title: 'Карта города',
  home: true,
  w: MW,
  h: MH,
  build,
  water: { shoreY: WORLD_SEA.seaY, foamY: WORLD_SEA.shallowY },
  buildings: BUILDINGS,
  places: PLACES,
  spots: {
    beach: { at: [40.5, 53.5], mark: [40, 55.5], label: '🏖️ Пляж' },
    park: { at: [40.5, 34.5], label: '🌳 Парк' },
  },
  actors: ACTORS,
  // кто вышел из виллы — стоит у её двери; forest — куда приходят с лесной тропы (за воротами)
  entries: { villa: { building: 'villa', from: 'villa' }, forest: { at: [2, 1.5] } },
  start: 'villa',
  // Выезды. Тропа в лес пока ведёт в пробную локацию (demo_meadow.js) и закрыта: в игре её открывает только
  // автотест. Когда появится лес — поменять to и entry; пустыня — так же (сцены 'desert' пока нет).
  exits: [
    { id: 'forest', area: [1, 0, 2, 0], to: 'demo_meadow', entry: 'gate', off: true },
    { id: 'desert', area: [95, 26, 95, 27], to: 'desert', entry: 'bus', off: true },
  ],
  // где разбрасывать предметы заданий: на пляже и в городе (не во дворе виллы и только там, куда можно дойти с улицы)
  zones: {
    beach: { y: [50, WORLD_SEA.shallowY - 1], tiles: ['s'] },
    town: { y: [3, 49], tiles: ['r', 'g', 'k', 'y'], avoid: [[0, 0, 28, 25]], reach: { from: [15, 26], tiles: ['g'] } },
  },
  parts: [sea],
  target,
  built(sc) {
    townScene = sc;
    sealPockets(sc.map);
  },
  enter(sc, from) {
    if (from === 'villa') sea.boatHome(); // кораблик возвращается к пирсу
    // за закрытыми воротами (старое сохранение, отладка) не остаёмся: встаём перед ними
    const tx = Math.floor(sc.p.x / T),
      ty = Math.floor(sc.p.y / T);
    for (const id of Object.keys(GATES)) {
      const b = GATES[id].behind;
      if (from === 'demo_meadow' || gateOpen(id) || tx < b[0] || tx > b[2] || ty < b[1] || ty > b[3]) continue;
      const st = PLACES.find((pl) => pl.id === id).stand;
      sc.p.x = st[0] * T;
      sc.p.y = st[1] * T;
    }
  },
  /** Дорожки для плавания в городском бассейне — неподвижный рисунок поверх земли (попадает в её кэш). */
  paintGround(ctx, env, x0, y0, x1, y1) {
    const [lx, ly, lw, lh] = POOLS[1];
    if (x1 < lx || x0 >= lx + lw || y1 < ly || y0 >= ly + lh) return;
    for (let i = 1; i < lh; i++) {
      const y = (ly + i) * T;
      for (let x = lx * T + 10, n = 0; x < (lx + lw) * T - 10; x += 14, n++) {
        ctx.fillStyle = n % 2 ? '#fa5252' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 4.2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(74,55,40,.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  },
  /** На мини-карте: забор двора. */
  miniMap(ctx, sc, k) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((YARD[0] + 0.5) * k, (YARD[1] + 0.5) * k, (YARD[2] - YARD[0]) * k, (YARD[3] - YARD[1]) * k);
  },
  /** Что слышно в городе: дневная музыка города, море (чем ближе к пляжу — тем громче), птицы, сверчки. */
  sound: (sc) => ({ day: 'town', sea: clamp((sc.p.y / T - 42) / 11, 0, 1), rain: 1, birds: true, crickets: true }),
});
export default town;
/** Море города: кораблик, острова, ныряние (для отладки и тестов). */
export { sea };

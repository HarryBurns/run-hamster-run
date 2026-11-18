// ГОРОД, двор виллы и пляж — ОПИСАНИЕ ЛОКАЦИИ для «движка локаций» (engine/topdown/scene.js).
// Море с корабликом и островами — часть этой же карты, оно описано в sea.js.
//
// Здесь только то, что есть именно в городе: размер карты и правила её постройки, здания и что происходит
// у их дверей, особые места (почтовый ящик, грядки, пруд, пирс), жители и их места, зоны для предметов
// заданий, точки входа и выхода — и свои виды клеток и предметов (грядка, почтовый ящик, лунка, табличка).
import { clamp, seeded } from '../core/util.js';
import { ell, fillRR, line, poly, emoji } from '../core/draw.js';
import { NPCS, ING_BY_ID, SEED_BY_ID, TASK_BY_ID, LAND_BY_ID, BIZ_BY_ID } from '../data/index.js';
import { G, cal, ownsHome, landOpen, guestsWaiting, stepWaits, hotelPoolGuests, hotelRoomGuest } from '../core/state.js';
import { T, OUT, SP, put, defineTiles, defineObjects } from '../engine/topdown/kinds.js';
import { createTopDownScene } from '../engine/topdown/scene.js';
import { run } from '../core/registry.js';
import './common/index.js';
import { createSea, WORLD_SEA } from './sea.js';
import './jungle_art.js'; // остров причала джунглей за буйками (WORLD_SEA.port): тропические деревья и попугай
import { HOUSE_ART, HOUSE_STYLE } from './town_buildings.js';
import './town_pets.js';
import { signBoard, fitText, snowCap, shadow } from './common/paint.js';
import { createPlants, hasFruit } from './common/plants.js';
import { createHerbs } from './common/herbs.js';
import { createHolidayDecor, HOLIDAY_PLACES, blockHolidayCells } from './holidays.js';
import { createDoorman } from './doorman.js';

const MW = 96,
  MH = 121;

// ---------- здания ----------
// x, y, w, h — «пятно» здания в клетках; дверь — снизу по центру. id зданий лежат в заданиях и сохранениях —
// не переименовывать. name — на вывеске; mapName — подпись для карты и кнопки «дойти», если нужна понятнее. Где что стоит — см. схему в docs/GDD.md («Город»).
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
    mapName: 'Агентство «Свой домик»: жильё',
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
  B('market', 'market', 44, 17, 7, 3, {
    name: 'Рынок',
    mapName: 'Рынок: продать и купить',
    icon: '🧺',
    wall: '#ffe8cc',
    roof: '#e8590c',
  }),
  B('cafe', 'cafe', 56, 17, 4, 4, { name: 'Кафе «Семечка»', icon: '☕', wall: '#ffdeeb', roof: '#d6336c' }),
  B('hospital', 'hospital', 67, 18, 7, 6, { name: 'Больница', icon: '🏥', wall: '#ffffff', roof: '#fa5252' }),
  B('school', 'school', 77, 18, 7, 6, { name: 'Школа', icon: '🔔', wall: '#ffd8a8', roof: '#e8590c' }),
  // приют для зверят (этап 17б): за школой, у детской площадки — отсюда берут питомца (features/pet.js). Здание
  // и дорожка от него целиком в рамке keep(84, 17, 92, 23) детской площадки: «случайная» зелень города не сдвинулась
  B('shelter', 'shelter', 88, 17, 4, 4, {
    name: 'Приют «Тёплые лапки»',
    mapName: 'Приют «Тёплые лапки»: питомцы',
    icon: '🐾',
    wall: '#fff3d6',
    roof: '#ff922b',
  }),
  // к югу от главной улицы
  B('home_apartment', 'apartment', 53, 31, 6, 5, {
    name: 'Жилой дом',
    mapName: 'Жилой дом: квартира',
    icon: '🏢',
    wall: '#ffe3e3',
    roof: '#c92a2a',
  }),
  B('rest', 'rest', 51, 41, 7, 5, { name: '«Золотой орешек»', icon: '🍽️', wall: '#ffec99', roof: '#c92a2a' }),
  B('pool', 'poolhall', 67, 30, 5, 5, { name: 'Бассейн', icon: '🏊', wall: '#99e9f2', roof: '#0c8599' }),
  B('hotel', 'hotel', 83, 42, 11, 5, { name: 'Отель «Морская звезда»', icon: '🏨', wall: '#fff4e6', roof: '#1098ad' }),
  // на пляже
  B('beachcafe', 'beachcafe', 67, 50, 5, 3, { name: 'Пляжное кафе', icon: '🍹', wall: '#c3fae8', roof: '#12b886' }),
  B('home_bungalow', 'bungalow', 6, 50, 5, 3, {
    name: 'Бунгало',
    mapName: 'Пляжное бунгало',
    icon: '🛖',
    wall: '#ffe8cc',
    roof: '#e0a458',
  }),
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
// мини-игры и диалоги ничего не знает. У домиков жителей действие одно: 'home-of:<житель>' (features/visits.js).
// Агентство — 'realtor'; двери покупного жилья — 'home:<id жилья>' (features/homes.js): куплено — войти, нет —
// окно риелтора. Пентхаус — из лифта Хомяк-Тауэра. Какое здание — дверь какого жилья, записано и в HOMES
// (data/estate.js, поле building): туда ведёт кнопка «Домой».
// Курортный отель «Морская звезда» (П.17) открыт с начала игры: дверь ведёт в его сцену (interiors/hotel.js).
// Выезды в лес и пустыню — тайные места: у них действие 'way:<место>' (features/quests.js, см. PLACES).
const ask = (vendor, text, options) => ({ do: 'ask', vendor, text, options });
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
  realtor: 'realtor',
  home_apartment: 'home:flat',
  home_bungalow: 'home:bungalow',
  hotel: 'scene:hotel',
  shelter: 'shelter',
  fashion: ask('fashion', 'Дорогая! Подиум ждёт. Выйдешь на показ мод?', [
    { text: '👠 На подиум!', cls: 'green', do: 'minigame:fashion' },
    { text: 'Не сейчас' },
  ]),
  // больница: простуженную (Ф1) сразу ведут на приём к доктору, иначе медсестра зовёт поработать (features/health.js)
  hospital: {
    do: 'hospital',
    ask: ask('hospital', 'Ой, как хорошо, что ты пришла! Пациентов много. Поможешь их вылечить?', [
      { text: '🩺 Лечить', cls: 'green', do: 'minigame:doctor' },
      { text: '🌡️ Как не простыть?', do: 'health-tips' },
      { text: 'Не сейчас' },
    ]),
  },
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
/** Своё название купленного заведения (state.biz[id].title) — для большой вывески на здании; иначе null. */
const ownTitle = (id) => {
  const st = G.state && G.state.biz[id];
  return (st && st.title) || null;
};
for (const b of BUILDINGS) {
  b.act = BUILDING_ACTS[b.id] || (b.npc ? 'home-of:' + b.npc : null);
  // дома жителей — по характеру хозяина: ставни, дорисовка поверх общего домика
  if (b.npc) Object.assign(b, HOUSE_STYLE[b.npc], { art: HOUSE_ART[b.npc] });
  // заведение, которое можно купить: на вывеске — название, которое дала хозяйка (входит в ключ спрайта здания)
  if (BIZ_BY_ID[b.id]) b.signText = () => ownTitle(b.id);
}

// ---------- своё: заведения и жильё ----------
// У купленного заведения (state.biz; id заведения — это id его здания, data/estate.js) у левого угла фасада висит
// табличка «моё» — в цвете, который хозяйка выбрала для вывески; у купленного жилья — табличка «мой дом»
// (у бунгало она закрывает нарисованную на здании «Продаётся»). Таблички рисуются каждый кадр поверх спрайта
// здания: кэш спрайтов зданий не трогаем. Своё название заведения — на большой вывеске самого здания (поле
// signText выше: название входит в ключ спрайта, после переименования картинка перерисуется сама).
const HOME_DOORS = Object.entries(BUILDING_ACTS) // [id здания, id жилья] — по действиям 'home:<id>'
  .filter(([, a]) => typeof a === 'string' && a.startsWith('home:'))
  .map(([b, a]) => [b, a.slice(5)]);
function bladeSign(ctx, b, text, col, w) {
  const x = b.x * T + 4,
    y = (b.y + b.h) * T - 104;
  line(ctx, x + 8, y, x - w + 12, y, OUT, 3.5); // кронштейн от стены
  for (const dx of [-w + 20, -8]) line(ctx, x + dx, y, x + dx, y + 9, OUT, 1.6);
  signBoard(ctx, text, x - w / 2 + 6, y + 20, w, 24, 'plate', col);
}
function drawOwnBiz(ctx, b) {
  const st = G.state.biz[b.id];
  if (st) bladeSign(ctx, b, '👑 моё', st.sign || '#ff6b9d', 56);
}
function drawOwnHome(ctx, b) {
  if (b.id !== 'home_bungalow') return bladeSign(ctx, b, '🔑 мой дом', '#2f9e44', 84);
  // бунгало: поверх таблички «Продаётся» у крыльца (её место — в paintBungalow, town_buildings.js)
  const x = (b.x + b.w) * T + 2,
    bot = (b.y + b.h) * T;
  fillRR(ctx, x - 22, bot - 43, 44, 22, 3, '#fff', OUT, 1.6);
  fitText(ctx, 'МОЙ ДОМ', x, bot - 32, 36, 7.5, '#2f9e44');
}

// ---------- жители ----------
// Где кто гуляет днём (клетка); утром и вечером каждый — у своего домика (engine/topdown/actors.js).
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
// away — житель сейчас не в городе: днём через день кто-то из друзей отдыхает у бассейна отеля (hotelPoolGuest) или
// гостит в номере 203 (hotelRoomGuest, От1) — core/state.js; там же — кто остаётся в городе: ждёт гостей, позвал к себе,
// у него дело по журналу
const awayAtHotel = (id) => hotelPoolGuests().includes(id) || hotelRoomGuest() === id;
const ACTORS = NPCS.map((n) => ({
  npc: n.id,
  at: HANG[n.id],
  home: BUILDINGS.find((b) => b.npc === n.id).id,
  away: awayAtHotel,
}));

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
/** Кусочек карты Зефирки (задание «Карта сокровищ Зефирки», П.9) ещё ждёт на месте: tower | ship | isle. */
export const mapPieceWaits = (id) => stepWaits('treasure_map', { what: 'piece', id });
/** Где работы этапа 17в: вышка спасателя на пляже и садовая тележка в парке (клетки). */
export const JOB_SPOTS = { lifeguard: [56, 51], garden: [35, 44] };
const BOTTLE = [11, 78]; // бутылка с кусочком карты — под пальмой на Звёздном острове (WORLD_SEA в sea.js)
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
  // доска «Ореховая Гавань» на набережной и ореховые скалы на краях пляжа (этап 10): почему городок так зовут
  {
    id: 'townsign',
    at: [60.5, 46.6],
    hit: { dx: 56, up: 56, down: 22 },
    stand: [61, 48.5],
    act: {
      do: 'say',
      text: [
        '🌰 «Ореховая Гавань». Городок назвали по цвету скал у моря — тёплому, как лесной орех.',
        '🌰 «Ореховая Гавань». Первые хомячки приплыли сюда на лодочке и увидели скалы цвета ореха — так и назвали!',
      ],
    },
    key: false,
    map: { icon: '🌰', at: [61, 47], label: '🌰 Ореховая Гавань' },
  },
  {
    id: 'nutcliffs',
    at: [1.5, 54.5],
    hit: { dx: 80, up: 100, down: 70 },
    stand: [4.5, 54.5],
    act: { do: 'say', text: ['🪨 Ореховые скалы. На закате они светятся, как скорлупка лесного ореха!', '🪨 Тёплый рыжий камень. Вот почему наш городок — Ореховая Гавань.'] },
    key: false,
  },
  {
    id: 'nutcliffs2',
    at: [94.5, 55.5],
    hit: { dx: 80, up: 100, down: 70 },
    stand: [91.5, 54.5],
    act: { do: 'say', text: ['🪨 Ореховые скалы. Говорят, в шторм они укрывают гавань от волн.', '🪨 Скалы цвета лесного ореха. Чайки любят сидеть на самой макушке!'] },
    key: false,
  },
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
  // сетка на пляже: «Пляжный волейбол» (этап 17а, features/relax.js); зимой сетку убирают
  {
    id: 'volley',
    at: [29.5, 54],
    hit: { dx: 62, up: 72, down: 22 },
    stand: [30, 55.6],
    mark: [30, 53.4],
    when: notWinter,
    reach: 1.4,
    act: 'relax:volley',
    map: { icon: '🏐', at: [30, 54], label: '🏐 Волейбол' },
  },
  // выезды из города в тайные места: тропа в лес и остановка каравана в пустыню. Пока место закрыто (landOpen),
  // у ворот — доброе окно «кто знает дорогу», на карте — силуэт с замочком (lock); действие way — features/quests.js
  {
    id: 'forest',
    at: [1.5, 2],
    hit: { dx: 62, up: 70, down: 30 },
    stand: [2, 3.6],
    act: 'way:forest',
    key: false,
    map: { icon: '🌲', at: [2, 2.5], label: '🌲 Тропа в лес', lock: () => !landOpen('forest') },
  },
  {
    id: 'desert',
    at: [89.5, 25],
    hit: { dx: 60, up: 84, down: 24 },
    stand: [91.5, 26.4],
    act: 'way:desert',
    key: false,
    map: { icon: '🐫', at: [92, 25.5], label: '🐫 Караван в пустыню', lock: () => !landOpen('desert') },
  },
  // бутылка с кусочком карты Зефирки на Звёздном острове (П.9, задание «Карта сокровищ Зефирки»): видна, пока её ищут
  {
    id: 'bottle',
    at: BOTTLE,
    hit: { r: 40 },
    stand: [BOTTLE[0] + 0.5, BOTTLE[1] + 1.5],
    mark: [BOTTLE[0] + 0.5, BOTTLE[1] + 0.5],
    when: () => mapPieceWaits('isle'),
    act: 'cove:piece:isle',
    reach: 1.4,
  },
  // работы этапа 17в: вышка спасателя на пляже (спасатель Волна зовёт подежурить — «Спасатель») и садовая тележка
  // Мяты в парке («Садовник»). Парикмахер — кнопка в окне салона красоты (features/salon.js)
  {
    id: 'lifeguard',
    at: JOB_SPOTS.lifeguard,
    hit: { dx: 40, up: 110, down: 24 },
    stand: [JOB_SPOTS.lifeguard[0] + 0.5, JOB_SPOTS.lifeguard[1] + 1.5],
    // зимой в море не купаются — и спасателю на вышке делать нечего
    use: () =>
      run(
        winter()
          ? ask('guard', 'Брр! Зимой в море никто не купается — на вышке пусто. Приходи летом, вместе подежурим! ☀️', [{ text: 'Хорошо' }])
          : ask('guard', 'Привет! Я спасатель Волна. Подежуришь со мной на вышке? Смотри на море: кто устал плыть или уронил мячик — тому помоги!', [
              { text: '🛟 На вышку!', cls: 'green', do: 'minigame:lifeguard' },
              { text: 'Не сейчас' },
            ]),
      ),
    key: false,
    map: { icon: '🛟', at: [JOB_SPOTS.lifeguard[0] + 0.5, JOB_SPOTS.lifeguard[1]], label: '🛟 Вышка спасателя' },
  },
  {
    id: 'gardencart',
    at: JOB_SPOTS.garden,
    hit: { dx: 44, up: 60, down: 24 },
    stand: [JOB_SPOTS.garden[0] + 0.5, JOB_SPOTS.garden[1] + 1.5],
    act: {
      do: 'ask',
      npc: 'myata',
      text: 'Ой, привет! Парку нужны садовники: цветы поникли, кусты заросли, а клумба ждёт рассаду. Поможешь?',
      options: [{ text: '🌷 Помочь в парке', cls: 'green', do: 'minigame:gardener' }, { text: 'Не сейчас' }],
    },
    key: false,
    map: { icon: '🌷', at: [JOB_SPOTS.garden[0] + 0.5, JOB_SPOTS.garden[1]], label: '🌷 Садовая тележка' },
  },
  // праздники (П.13): ёлка, вертеп, фонарики, карусель, блины, канат — работают, пока город украшен (locations/holidays.js)
  ...HOLIDAY_PLACES,
];
const POOLS = [
  [6, 16, 8, 7],
  [74, 30, 9, 6],
]; // бассейны: клетка, ширина, высота
const YARD = [4, 3, 27, 24]; // двор виллы: по этим клеткам идёт забор
const PARK = { x0: 32, y0: 29, x1: 49, y1: 46, pond: [40.5, 38.5, 4.1, 2.9], ring: [6.6, 5.6] }; // парк с прудом

// ---------- что растёт в городе ----------
// Плодовые растения (виды и правила сбора — common/plants.js; сезоны — data/seasons.js; сколько их можно —
// GATHER в data/economy.js). Их немного, и стоят они на местах обычной зелени: дерева, пальмы, куста — так что
// проходы остаются прежними. Ставь так, чтобы растение не закрывали дом или ёлка с юга (грибы низкие!). Ещё две кокосовые пальмы — на островах (WORLD_SEA в sea.js). Грибов и ягод
// в городе мало нарочно: главное место для них — лес.
const COCO_BEACH = 38;
const HOTEL_PALMS = [
  [82, 42, 0],
  [82, 44, 1],
]; // пальмы у левого крыла отеля (справа от него — водная горка, она нарисована на здании) // кокосовая пальма на набережной — напротив пляжа (остальные пальмы там без плодов)
const FRUIT_PLANTS = [
  ['cocoPalm', 9, 10], // двор виллы, у бассейна
  ['bananaPalm', 22, 7], // двор виллы, над грядками
  ['bananaPalm', 66, 30], // у входа в бассейн, с Морского проспекта
  ['mangoTree', 16, 39], // Садовая улочка
  ['mangoTree', 60, 40], // у ресторана «Золотой орешек»
  ['mangoTree', 79, 39], // улочка за бассейном
  ['berryBush', 3, 22], // у тропы в лес
  ['berryBush', 36, 31], // парк
  ['berryBush', 7, 37], // Садовая улочка
  ['berryBush', 69, 38], // напротив бассейна
  ['mushrooms', 3, 7, { v: 0 }], // опушка: под ёлками у тропы в лес
  ['mushrooms', 3, 21, { v: 1 }], // там же, рядом с черникой
  ['mushrooms', 30, 3, { v: 1 }], // опушка за магазинами
  ['mushrooms', 35, 30, { v: 0 }], // парк: под деревьями у входа
  ['mushrooms', 37, 41, { v: 1 }], // парк: у пруда, в камышах
  ['appleTree', 16, 29], // у дороги под двором виллы
  ['appleTree', 37, 29, { v: 1 }], // парк, у входа с площади
];

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
  // садовая тележка Мяты в парке (этап 17в): лейка, грабельки, горшки с цветами — здесь работа «Садовник»
  gardenCart: {
    solid: true,
    art: {
      gardenCart: [
        [-46, -46, 42, 24],
        (ctx, season) => {
          shadow(ctx, 2, 14, 30, 6);
          line(ctx, 18, -6, 34, -22, OUT, 3.5); // ручки
          line(ctx, 18, -6, 34, -22, '#c98b5a', 1.8);
          ell(ctx, -16, 8, 8, 8, '#495057', OUT, 2); // колесо
          ell(ctx, -16, 8, 3, 3, '#adb5bd', null);
          poly(ctx, [-28, -18, 22, -18, 16, 4, -24, 4], '#2f9e44', OUT, 2.2); // кузов
          line(ctx, -26, -10, 19, -10, 'rgba(255,255,255,.35)', 2);
          // горшки с цветами (зимой — еловые ветки)
          const cs = season === 'winter' ? ['#2f9e44', '#2b8a3e', '#2f9e44'] : ['#ff6b9d', '#ffd43b', '#9775fa'];
          [-18, -4, 10].forEach((x, i) => {
            fillRR(ctx, x - 5, -26, 10, 9, 2, '#e8590c', OUT, 1.4);
            for (let k = 0; k < 4; k++) ell(ctx, x + Math.cos(k * 1.6) * 3.5, -32 + Math.sin(k * 1.6) * 3, 3, 3, cs[i], OUT, 0.8);
          });
          // лейка
          fillRR(ctx, -32, -6, 12, 12, 3, '#4dabf7', OUT, 1.6);
          line(ctx, -32, -2, -40, -10, OUT, 2.4);
          line(ctx, -32, -2, -40, -10, '#4dabf7', 1);
        },
      ],
    },
    draw(ctx, o, env) {
      put('gardenCart', o.x, o.y, env.season);
    },
  },
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
  // ---- Ореховая Гавань (этап 10): городок назван по цвету прибрежных скал — тёплому, как лесной орех ----
  // nutcliff — большая скала на краю пляжа (3 × 2 клетки, v: 1 — зеркально); nutrock — камень в воде у берега
  // (v: 0, 1 — низкие, 2 — высокий «палец»); townsign — резная доска «Ореховая Гавань» на набережной (2 клетки)
  nutcliff: {
    solid: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    art: {
      nutcliff: [
        [-44, -90, 144, 88],
        (ctx, v, snow) => {
          if (v) {
            ctx.translate(96, 0);
            ctx.scale(-1, 1);
          }
          shadow(ctx, 48, 66, 78, 10);
          // тело скалы
          poly(ctx, [-27, 68, -29, 22, -19, -18, -3, -50, 17, -63, 39, -49, 55, -70, 80, -62, 98, -38, 116, -10, 123, 30, 119, 68], NUT.base, OUT, 2.4);
          // светлые «полки» сверху
          poly(ctx, [-19, -18, -3, -50, 17, -63, 39, -49, 30, -30, 6, -24], NUT.light);
          poly(ctx, [39, -49, 55, -70, 80, -62, 98, -38, 74, -32, 52, -40], NUT.light);
          poly(ctx, [-29, 22, -19, -18, 6, -24, 2, 8, -12, 22], NUT.mid);
          // тёмные грани справа и снизу
          poly(ctx, [98, -38, 116, -10, 123, 30, 119, 68, 92, 68, 96, 24, 88, -8, 74, -32], NUT.dark);
          poly(ctx, [30, -30, 52, -40, 74, -32, 88, -8, 60, -2, 36, -6], NUT.mid);
          // слои камня — как прожилки в орехе
          ctx.strokeStyle = NUT.vein;
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-22, 34);
          ctx.quadraticCurveTo(10, 24, 40, 32);
          ctx.quadraticCurveTo(70, 40, 94, 30);
          ctx.moveTo(-18, 52);
          ctx.quadraticCurveTo(20, 44, 52, 52);
          ctx.quadraticCurveTo(80, 58, 110, 50);
          ctx.moveTo(4, 8);
          ctx.quadraticCurveTo(28, 2, 50, 10);
          ctx.moveTo(62, 14);
          ctx.quadraticCurveTo(78, 10, 92, 16);
          ctx.stroke();
          // контур поверх граней
          ctx.beginPath();
          ctx.moveTo(-19, -18);
          ctx.lineTo(6, -24);
          ctx.lineTo(30, -30);
          ctx.lineTo(39, -49);
          ctx.moveTo(30, -30);
          ctx.lineTo(52, -40);
          ctx.lineTo(74, -32);
          ctx.lineTo(98, -38);
          ctx.strokeStyle = 'rgba(74,55,40,.45)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          if (snow) {
            snowCap(ctx, 8, -52, 44, 8);
            snowCap(ctx, 66, -62, 48, 8);
          } else {
            // трава и кустик на макушке
            ell(ctx, 6, -52, 16, 6, '#74b85a', OUT, 1.6);
            ell(ctx, 66, -64, 18, 6.5, '#74b85a', OUT, 1.6);
            ell(ctx, 74, -72, 9, 7, '#51a34a', OUT, 1.6);
            ell(ctx, -2, -55, 2.4, 2.4, '#ffd43b');
            ell(ctx, 58, -66, 2.4, 2.4, '#fff');
          }
          // блики
          ell(ctx, -8, -8, 3, 6, 'rgba(255,255,255,.28)', null, 0, 0.5);
          ell(ctx, 50, -52, 3, 5, 'rgba(255,255,255,.28)', null, 0, 0.4);
        },
      ],
    },
    draw(ctx, o, env) {
      put('nutcliff', o.x, o.y, o.v || 0, env.season === 'winter' ? 1 : 0);
    },
  },
  nutrock: {
    solid: true,
    map: () => NUT.base,
    art: {
      nutrock: [
        [-28, -62, 28, 22],
        (ctx, v, snow) => {
          if (v === 2) {
            poly(ctx, [-13, 12, -15, -18, -7, -44, 4, -54, 13, -40, 16, -10, 15, 12], NUT.base, OUT, 2.2);
            poly(ctx, [-7, -44, 4, -54, 13, -40, 4, -34], NUT.light);
            poly(ctx, [4, -34, 13, -40, 16, -10, 15, 12, 6, 12], NUT.dark);
            line(ctx, -12, -8, 4, -12, NUT.vein, 1.5);
            line(ctx, -12, 2, 5, -2, NUT.vein, 1.5);
            if (snow) snowCap(ctx, 3, -48, 20, 5);
            else ell(ctx, 3, -50, 7, 3, '#74b85a', OUT, 1.3);
          } else if (v === 1) {
            poly(ctx, [-20, 12, -17, -8, -5, -20, 10, -16, 20, -2, 19, 12], NUT.base, OUT, 2.2);
            poly(ctx, [-5, -20, 10, -16, 4, -6, -8, -5], NUT.light);
            poly(ctx, [4, -6, 10, -16, 20, -2, 19, 12, 7, 12], NUT.dark);
            line(ctx, -16, 3, 3, 0, NUT.vein, 1.5);
            if (snow) snowCap(ctx, 2, -16, 22, 5);
          } else {
            poly(ctx, [-22, 12, -19, -4, -9, -14, 3, -9, 8, 12], NUT.base, OUT, 2.2);
            poly(ctx, [3, 12, 5, -4, 13, -11, 22, 0, 21, 12], NUT.dark, OUT, 2.2);
            poly(ctx, [-9, -14, 3, -9, -2, -1, -12, -2], NUT.light);
            line(ctx, -18, 4, -2, 2, NUT.vein, 1.5);
            if (snow) snowCap(ctx, -4, -11, 20, 5);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      // пена у камня дышит вместе с волной (камни стоят в воде у берега)
      if (o.wet && env.season !== 'winter') {
        const a = 0.5 + 0.5 * Math.sin(env.t * 1.6 + o.x * 0.05);
        ell(ctx, o.x, o.y + 11, 23 + a * 3, 7 + a, `rgba(255,255,255,${0.35 + a * 0.3})`);
      }
      put('nutrock', o.x, o.y, o.v || 0, env.season === 'winter' ? 1 : 0);
    },
  },
  townsign: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      townsign: [
        [-34, -92, 82, 20],
        (ctx, snow) => {
          shadow(ctx, 24, 14, 50, 5);
          for (const x of [-18, 66]) {
            fillRR(ctx, x - 4, -62, 8, 76, 2, '#a8703f', OUT, 2);
            ell(ctx, x, -64, 6, 5, '#c98b5a', OUT, 1.8);
          }
          // доска в форме волны с орешком наверху
          ctx.beginPath();
          ctx.moveTo(-28, -22);
          ctx.lineTo(-28, -56);
          ctx.quadraticCurveTo(-4, -68, 24, -66);
          ctx.quadraticCurveTo(52, -68, 76, -56);
          ctx.lineTo(76, -22);
          ctx.quadraticCurveTo(24, -14, -28, -22);
          ctx.closePath();
          ctx.fillStyle = '#ffe8c2';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-23, -26);
          ctx.lineTo(-23, -53);
          ctx.quadraticCurveTo(-2, -63, 24, -61);
          ctx.quadraticCurveTo(50, -63, 71, -53);
          ctx.lineTo(71, -26);
          ctx.quadraticCurveTo(24, -19, -23, -26);
          ctx.closePath();
          ctx.strokeStyle = NUT.base;
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.fillStyle = '#7a4a1f';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 13px ui-rounded, "Trebuchet MS", sans-serif';
          ctx.fillText('ОРЕХОВАЯ', 24, -48);
          ctx.fillText('ГАВАНЬ', 24, -33);
          // орешек с листиком над доской
          ell(ctx, 24, -76, 9, 10, NUT.base, OUT, 2);
          ctx.beginPath();
          ctx.moveTo(15, -79);
          ctx.quadraticCurveTo(24, -74, 33, -79);
          ctx.quadraticCurveTo(31, -88, 24, -88);
          ctx.quadraticCurveTo(17, -88, 15, -79);
          ctx.closePath();
          ctx.fillStyle = NUT.dark;
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ell(ctx, 34, -86, 7, 3.4, '#69db7c', OUT, 1.4, -0.5);
          ell(ctx, 21, -72, 2, 3, 'rgba(255,255,255,.5)', null, 0, 0.4);
          // волны внизу доски
          ctx.strokeStyle = '#4dabf7';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.moveTo(-14 + i * 20, -23);
            ctx.quadraticCurveTo(-9 + i * 20, -27, -4 + i * 20, -23);
          }
          ctx.stroke();
          if (snow) snowCap(ctx, 24, -64, 96, 6);
        },
      ],
    },
    draw(ctx, o, env) {
      put('townsign', o.x, o.y, env.season === 'winter' ? 1 : 0);
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
// Ореховые скалы: по ним городок назван Ореховой Гаванью (этап 10). Цвет — тёплый, как скорлупа лесного ореха.
const NUT = { base: '#c98a4b', light: '#e9b97f', mid: '#b97a40', dark: '#99602f', vein: '#8a5428' };
/** Ореховые скалы на карте города: середина (клетки) и зеркально ли — по скалам в build(). */
const NUT_CLIFFS_MAP = [
  [2.1, 55.2, false],
  [93.9, 56.2, true],
];
/** Значок ореховой скалы на карте: два рыжих уступа с травкой на макушке, k — пикселей карты в клетке. */
function mapNutCliff(ctx, x, y, k, flip) {
  const s = Math.max(k, 4) / 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.lineJoin = 'round';
  ell(ctx, 2, 19, 19, 4, 'rgba(60,40,30,.28)');
  poly(ctx, [-17, 19, -16, 2, -9, -10, -2, -16, 4, -9, 9, -19, 16, -13, 19, 2, 18, 19], NUT.base, '#fff', 4.5);
  poly(ctx, [-17, 19, -16, 2, -9, -10, -2, -16, 4, -9, 9, -19, 16, -13, 19, 2, 18, 19], NUT.base, OUT, 1.6);
  poly(ctx, [-9, -10, -2, -16, 4, -9, -1, -4, -8, -3], NUT.light);
  poly(ctx, [9, -19, 16, -13, 19, 2, 18, 19, 11, 19, 12, 0, 8, -10], NUT.dark);
  ctx.strokeStyle = NUT.vein;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, 8);
  ctx.quadraticCurveTo(0, 4, 14, 9);
  ctx.stroke();
  ell(ctx, -2, -16, 5, 2, '#74b85a', OUT, 1);
  ell(ctx, 10, -19, 5, 2, '#74b85a', OUT, 1);
  ctx.restore();
}
const sea = createSea(WORLD_SEA);
const plants = createPlants(); // подпись «Сорвать…», кнопка и клавиша E у плодовых растений
// Места, где можно сорвать находку для гербария Мяты (common/herbs.js): вид места и клетка клумбы, дерева или ёлки.
// В парке, где гуляет Мята, — клумбы и деревья; остальное — по городу: во дворе виллы, на площади, на улицах, у опушки.
// Клетка — ровно та, где стоит предмет (деревья города расставлены жребием по сиду: если расстановка поменяется,
// common/herbs.js скажет об этом ошибкой в консоли — её ловит автотест).
const HERB_SPOTS = [
  ['flowers', 19, 9], // двор виллы, клумба у почтового ящика
  ['flowers', 33, 33], // парк, клумба у входа
  ['flowers', 47, 43], // парк, клумба у пруда
  ['flowers', 43, 23], // площадь, клумба
  ['flowers', 23, 43], // Садовая улочка
  ['tree', 35, 29], // парк, у входа
  ['tree', 44, 40], // парк, у пруда
  ['tree', 16, 29], // улица под двором виллы
  ['tree', 58, 29], // за площадью
  ['pine', 3, 9], // опушка у тропы в лес
  ['pine', 39, 17], // за салоном и бутиком
  ['pine', 66, 23], // у Морского проспекта
];
const herbs = createHerbs(HERB_SPOTS);
const holidayDecor = createHolidayDecor(); // украшения к праздникам (П.13): ёлка, гирлянды, фонарики, ярмарка, фейерверк
const doorman = createDoorman(); // живой швейцар у входа в отель (От3): дышит, машет, с ним можно поздороваться
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
  fill(90, 21, 91, 23, 'y'); // от приюта «Тёплые лапки» — мимо площадки к Главной улице
  fill(91, 24, 91, 25, 'y');
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
  // табличка остановки: пока пустыня закрыта — замочек и подсказка, кто знает дорогу (Буся)
  put1('signpost', 92, 25, { text: '🐪 В пустыню', text2: () => (landOpen('desert') ? '🚌 Караван' : '🔒 Спроси Бусю') });
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
  put1('lamp', 48, 21);
  put1('lamp', 55, 21);
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
  // отель: пальмы в кадках, фонари, указатели (ещё один — на Морском проспекте, у Главной улицы)
  for (const x of [84, 86, 91, 93]) put1('planter', x, 47, { v: 2 });
  put1('lamp', 82, 47);
  put1('signpost', 81, 47, { text: '🏨 Отель →', text2: '🌀 Горки' });
  put1('signpost', 65, 28, { text: '🏨 Отель ↘', text2: 'на набережной' });

  // ---- набережная ----
  put1('townsign', 60, 47); // «Ореховая Гавань» — у спуска к пирсу, куда причаливает кораблик
  keep(61, 47);
  for (let x = 4; x < MW; x += 8) if (g[47][x] === 'g' && !solid[47][x] && !taken.has(x + ',47')) put1('lamp', x, 47);
  for (const x of [25, 34, 45, 62, 81])
    if (g[47][x] === 'g' && !solid[47][x] && !taken.has(x + ',47')) put1('bench', x, 47);
  put1('signpost', 65, 47, { text: 'Пирс ↓', text2: '← Пляж', solid: true });
  // ---- ореховые скалы по краям пляжа и камни в воде у берега (этап 10: по их цвету назван городок) ----
  put1('nutcliff', 0, 53, { v: 0 });
  put1('nutcliff', 0, 55, { v: 1 });
  put1('nutcliff', 93, 54, { v: 1 });
  put1('nutcliff', 93, 56, { v: 0 });
  for (const [x, y, v] of [
    [3, 55, 1],
    [1, 57, 2],
    [3, 58, 0],
    [0, 59, 1],
    [92, 55, 0],
    [94, 58, 2],
    [91, 58, 1],
    [95, 60, 0],
    [9, 60, 2],
    [24, 58, 0],
    [38, 59, 1],
    [79, 58, 0],
    [88, 60, 2],
  ])
    put1('nutrock', x, y, { v, wet: y >= 57 });
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
  put1('lifeguard', ...JOB_SPOTS.lifeguard);
  put1('gardenCart', ...JOB_SPOTS.garden);
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
  // бунгало: гамак между пальмами, шезлонг, банановая пальма
  put1('palm', 12, 51, { v: 0 });
  put1('hammock', 13, 51, { v: 0 });
  put1('palm', 15, 51, { v: 1 });
  put1('bananaPalm', 4, 51);
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
    if (g[50][x] === 's' && !solid[50][x] && !taken.has(x + ',50'))
      put1(x === COCO_BEACH ? 'cocoPalm' : 'palm', x, 50, { v: x % 3 });
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

  // ---- плодовые растения: на месте того, что выросло на клетке само (остальная зелень от этого не меняется) ----
  for (const [type, x, y, o] of FRUIT_PLANTS) {
    m.clear(x, y);
    add(type, x, y, o);
  }
  // ---- пальмы у курортного отеля (П.17): так же, поверх случайной зелени ----
  for (const [x, y, v] of HOTEL_PALMS) {
    m.clear(x, y);
    add('palm', x, y, { v });
  }
  // ---- клетки под праздничными украшениями (П.13): пока ёлка или карусель стоят, туда не пройти ----
  blockHolidayCells(m);
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
  // ворота и клетки под праздничными украшениями (locations/holidays.js) считаются проходимыми: закрыты они не навсегда
  const ok = (x, y) =>
    x >= 0 && y >= 0 && x < w && y < h && (m.foot(x, y) || ((m.kinds[y][x].gate || m.kinds[y][x].holiday) && !m.solid[y][x]));
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
  if (t.type === 'coconut') {
    // «Кокосовый день»: к ближайшей кокосовой пальме, на которой ещё есть орехи (сначала те, что на суше)
    const palms = plants.plants().filter((o) => o.type === 'cocoPalm' && hasFruit(o)),
      land = palms.filter((o) => o.ty < WORLD_SEA.shallowY),
      near = (o) => Math.hypot(o.x - sc.p.x, o.y - sc.p.y),
      palm = (land.length ? land : palms).sort((a, b) => near(a) - near(b))[0];
    if (palm) return { x: palm.x, y: palm.y - 46, icon: '⭐' };
  }
  const wh = t.where;
  if (t.hosts) {
    // «день гостей»: к двери ближайшего хозяина, который сегодня ждёт (письмо назвало их по именам)
    const doors = guestsWaiting()
      .map((id) => sc.map.buildings.find((b) => b.npc === id))
      .filter(Boolean)
      .map((b) => sc.map.doorPx(b))
      .sort((a, b) => Math.hypot(a.x - sc.p.x, a.y - sc.p.y) - Math.hypot(b.x - sc.p.x, b.y - sc.p.y));
    return doors.length ? { x: doors[0].x, y: doors[0].y - T, icon: '⭐' } : null;
  }
  if (wh === 'town') return null;
  const b = sc.map.bById[wh];
  if (b) {
    const d = sc.map.doorPx(b);
    return { x: d.x, y: d.y - T, icon: '⭐' };
  }
  const s = sc.spot(wh); // пирс, пляж
  return s ? { ...s, icon: '⭐' } : null;
}

/** Выход из города в тайное место: в его сцену из LANDS, если она уже есть, — и только когда место открыто. */
function landExit(id, area, to, entry) {
  const land = LAND_BY_ID[id];
  if (!land.scene) return { id, area, to, entry, off: true };
  // своя дорога (go — пустыня: караван-автобус везёт картинкой): за шлагбаумом выполняется действие, а не переход
  return { id, area, to: land.scene, entry: land.entry || entry, when: () => landOpen(id), ...(land.go ? { act: land.go } : null) };
}

const town = createTopDownScene({
  id: 'world', // имя сцены лежит в сохранениях: { scene: 'world', x, y } — не менять
  title: 'Ореховая Гавань — карта города',
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
    // где нырять к затонувшему кораблю (задание Зефирки — сундучок с кусочком карты на дне, interiors/dive.js)
    wreck: { at: [35.5, 64.5] },
  },
  actors: ACTORS,
  // кто вышел из виллы — стоит у её двери; forest — куда приходят с лесной тропы (за воротами); bus — у остановки
  // каравана, куда привозит караван-автобус из пустыни; pier — конец пирса, куда кораблик привозит из джунглей
  // grotto — у буйка-ракушки в море, куда выплываешь из подводного грота с секретного пляжа
  entries: {
    villa: { building: 'villa', from: 'villa' },
    forest: { at: [2, 1.5] },
    bus: { at: [91.5, 26.4] },
    pier: { at: [63.5, 60.6] },
    grotto: { at: [WORLD_SEA.grotto.x - 0.6, WORLD_SEA.grotto.y + 1.4] },
  },
  start: 'villa',
  // Выезды в тайные места. Сцена места и вход в неё — в LANDS (data/places.js): пока сцены нет, выход закрыт
  // (off), и у ворот — окно действия way:<место> (features/quests.js). Есть сцена — выход открыт, как только место
  // открыто (when): тропа в лес ведёт в лес (locations/forest.js), пока он закрыт — ворота заперты.
  exits: [landExit('forest', [1, 0, 2, 0], 'forest', 'gate'), landExit('desert', [95, 26, 95, 27], 'desert', 'bus')],
  // где разбрасывать предметы заданий: на пляже и в городе (не во дворе виллы и только там, куда можно дойти с улицы)
  zones: {
    beach: { y: [50, WORLD_SEA.shallowY - 1], tiles: ['s'] },
    town: { y: [3, 49], tiles: ['r', 'g', 'k', 'y'], avoid: [[0, 0, 28, 25]], reach: { from: [15, 26], tiles: ['g'] } },
  },
  parts: [sea, plants, herbs, holidayDecor, doorman],
  target,
  /** Таблички «моё» у купленных заведений и жилья — сразу после здания в порядке «дальше → ближе». */
  things(sc, add, v) {
    const own = (id, draw) => {
      const b = sc.map.bById[id];
      if (b && b.x * T < v.x1 + 90 && (b.x + b.w) * T > v.x0 - 30 && b.y * T < v.y1 && (b.y + b.h) * T > v.y0)
        add((b.y + b.h) * T, draw, b);
    };
    for (const id in G.state.biz) own(id, drawOwnBiz);
    for (const [bid, home] of HOME_DOORS) if (ownsHome(home)) own(bid, drawOwnHome);
    if (ownsHome('suite')) own('hotel', drawOwnHome); // свой номер-люкс в отеле
    // бутылка с кусочком карты под пальмой (задание Зефирки)
    const bx = (BOTTLE[0] + 0.5) * T,
      by = (BOTTLE[1] + 0.5) * T;
    if (bx > v.x0 && bx < v.x1 && by > v.y0 && by < v.y1 && mapPieceWaits('isle'))
      add(by, (ctx, _v, t) => put('mapBottle', bx, by + 4 + (Math.sin(t * 3) > 0.7 ? -2 : 0)));
  },
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
      if (from === 'demo_meadow' || from === 'forest' || gateOpen(id) || tx < b[0] || tx > b[2] || ty < b[1] || ty > b[3])
        continue;
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
  /** На мини-карте: забор двора виллы; ореховые скалы — значком-скалой (В13: раньше — россыпь коричневых точек). */
  miniMap(ctx, sc, k) {
    for (const [x, y, flip] of NUT_CLIFFS_MAP) mapNutCliff(ctx, x * k, y * k, k, flip);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, k * 0.22);
    ctx.setLineDash([k * 0.5, k * 0.35]);
    ctx.strokeRect((YARD[0] + 0.5) * k, (YARD[1] + 0.5) * k, (YARD[2] - YARD[0]) * k, (YARD[3] - YARD[1]) * k);
    ctx.setLineDash([]);
  },
  /** Что слышно в городе: дневная музыка города, море (чем ближе к пляжу — тем громче), птицы, сверчки. */
  sound: (sc) => ({ day: 'town', sea: clamp((sc.p.y / T - 42) / 11, 0, 1), rain: 1, birds: true, crickets: true }),
});
export default town;
/** Море города: кораблик, острова, ныряние (для отладки и тестов). */
export { sea, doorman };

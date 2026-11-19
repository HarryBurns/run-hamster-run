// ГОРОД, двор виллы и пляж — ОПИСАНИЕ ЛОКАЦИИ для «движка локаций» (engine/topdown/scene.js).
// Море с корабликом и островами — часть этой же карты, оно описано в sea.js.
//
// Здесь только то, что есть именно в городе: размер карты и правила её постройки, здания и что происходит
// у их дверей, особые места (почтовый ящик, грядки, пруд, пирс), жители и их места, зоны для предметов
// заданий, точки входа и выхода — и свои виды клеток и предметов (грядка, почтовый ящик, лунка, табличка).
import { clamp } from '../core/util.js';
import { ell, fillRR, line, poly, emoji } from '../core/draw.js';
import { NPCS, ING_BY_ID, SEED_BY_ID, TASK_BY_ID, LAND_BY_ID, BIZ_BY_ID, HOME_BY_ID } from '../data/index.js';
import { G, cal, ownsHome, homesWith, landOpen, guestsWaiting, stepWaits, hotelPoolGuests, hotelRoomGuest } from '../core/state.js';
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
import { createHolidayDecor, HOLIDAY_PLACES } from './holidays.js';
import { createDoorman } from './doorman.js';
import { MW, MH, GATES, BEDS, JOB_SPOTS, POOLS, YARD, buildTown } from './town_map.js';

export { JOB_SPOTS };

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
// Ворота и шлагбаум (GATES — в town_map.js) открыты, когда открыт выход с тем же именем.
let townScene = null;
function gateOpen(id) {
  const e = townScene && townScene.exit(id);
  return !!e && !e.off && (!e.when || e.when());
}

// ---------- особые места ----------
const bedIndex = (tx, ty) => (ty === BEDS.rows[0] ? 0 : BEDS.n) + (tx - BEDS.x);
const notWinter = () => cal().season !== 'winter',
  winter = () => cal().season === 'winter';
/** Кусочек карты Зефирки (задание «Карта сокровищ Зефирки», П.9) ещё ждёт на месте: tower | ship | isle. */
export const mapPieceWaits = (id) => stepWaits('treasure_map', { what: 'piece', id });
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
/**
 * Значок ореховой скалы на карте: два рыжих уступа с травкой на макушке, k — пикселей карты в клетке. На самом мелком
 * виде карты (телефон, k = 4) значок не мельче, чем при k = 6, — иначе его не разглядеть рядом со значками мест (В19).
 */
const nutCliffScale = (k) => Math.max(k, 6) / 10;
function mapNutCliff(ctx, x, y, k, flip) {
  const s = nutCliffScale(k);
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
/** Карта города — по кварталам, в locations/town_map.js. */
const build = (m) => buildTown(m, { sea, gateOpen });

/**
 * Клетки города, до которых нельзя дойти от двери виллы (карманы между деревьями и заборами), становятся
 * непроходимыми: хомячок из старого сохранения, оказавшийся в таком кармане, встанет рядом, а не застрянет.
 * Ворота выездов считаются проходимыми — тропа за ними остаётся тропой.
 */
function sealPockets(m) {
  const d = m.doorPx(m.bById.villa);
  // ворота и клетки под праздничными украшениями (locations/holidays.js) считаются проходимыми: закрыты они не навсегда
  const ok = (x, y) => (m.kinds[y][x].gate || m.kinds[y][x].holiday) && !m.solid[y][x];
  return m.sealFrom([[Math.floor(d.x / T), Math.floor(d.y / T)]], { ok, rows: 50 });
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
  if (t.thing) {
    // колесо, пианино: к двери ближайшего своего дома, где вещь стоит; дом в другом месте (лесной домик) — к дороге туда
    const homes = homesWith(t.thing).map((h) => HOME_BY_ID[h]),
      doors = homes
        .filter((h) => !h.loc && sc.map.bById[h.building])
        .map((h) => sc.map.doorPx(sc.map.bById[h.building]))
        .sort((a, b) => Math.hypot(a.x - sc.p.x, a.y - sc.p.y) - Math.hypot(b.x - sc.p.x, b.y - sc.p.y));
    if (doors.length) return { x: doors[0].x, y: doors[0].y - T, icon: '⭐' };
    const away = homes.find((h) => h.loc);
    if (away) return sc.wayTo(away.loc);
  }
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
    // у самого края карты — целиком на карте (значок шире скалы)
    const half = 20 * nutCliffScale(k);
    for (const [x, y, flip] of NUT_CLIFFS_MAP) mapNutCliff(ctx, clamp(x * k, half, sc.w * k - half), y * k, k, flip);
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

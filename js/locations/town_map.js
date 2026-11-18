// ПЛАН ГОРОДА (Ореховая Гавань): размер карты, улицы и кварталы, дворы, парк, набережная и пляж — построение карты
// по кварталам (build для «движка локаций», engine/topdown/map.js). Само описание локации — locations/town.js:
// здания (BUILDINGS), особые места, жители, выходы, свои виды клеток и предметов.
//
// Кварталы строятся по очереди (buildTown), и порядок менять нельзя: забор не ставится на занятые клетки, а случайная
// зелень (greenery) растёт только там, где кварталы до неё ничего не поставили, — от порядка зависит, где что стоит.
import { seeded } from '../core/util.js';
import { landOpen } from '../core/state.js';
import { WORLD_SEA } from './sea.js';
import { blockHolidayCells } from './holidays.js';

export const MW = 96,
  MH = 121;

// ---------- выезды из города ----------
// Тропа в лес (северо-запад, за виллой) и дорога в пустыню (восточная окраина) перекрыты воротами и шлагбаумом.
// Клетки под ними (виды gateF, gateD) проходимы, только когда открыт выход с тем же именем — см. exits в описании:
// откроется выход (off: false / when) — ворота распахнутся сами.
export const GATES = {
  forest: { cells: [1, 2, 2, 2], behind: [1, 0, 2, 1] }, // ворота: клетки x0, y0, x1, y1; behind — тропа за ними
  desert: { cells: [94, 26, 94, 27], behind: [95, 26, 95, 27] },
};

/** Грядки во дворе виллы: два ряда по четыре, слева направо (места у грядок — PLACES в town.js). */
export const BEDS = { x: 20, n: 4, rows: [10, 12] };
/** Где работы этапа 17в: вышка спасателя на пляже и садовая тележка в парке (клетки). */
export const JOB_SPOTS = { lifeguard: [56, 51], garden: [35, 44] };
export const POOLS = [
  [6, 16, 8, 7],
  [74, 30, 9, 6],
]; // бассейны: клетка, ширина, высота
export const YARD = [4, 3, 27, 24]; // двор виллы: по этим клеткам идёт забор
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

/**
 * Набор для кварталов: сетки земли и препятствий, m.fill / m.add и свои помощники. taken — клетки, где зелень сама
 * не вырастет; keep — пометить такие клетки; put1 — поставить предмет и пометить клетку; fence — забор по рамке;
 * path — тропинки по списку отрезков.
 */
function kit(m) {
  const g = m.ground,
    solid = m.solid,
    fill = m.fill,
    add = m.add;
  const path = (cells) => {
    for (const [x0, y0, x1, y1] of cells) fill(x0, y0, x1 === undefined ? x0 : x1, y1 === undefined ? y0 : y1, 'y');
  };
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
  return { m, g, solid, fill, add, taken, keep, put1, fence, path };
}

/** Земля: пляж и море, улицы, двор виллы, тропа в лес, тропинки кварталов, кольцо парка, бассейн. */
function ground(k, sea) {
  const { m, g, fill, path } = k;
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
}

/** Двор виллы: белый штакетник кругом, почтовый ящик, лежаки, фонари, клумбы. */
function villaYard(k) {
  const { keep, put1, fence } = k;
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
}

/** Выезды из города: ворота в лес, остановка и шлагбаум дороги в пустыню. */
function gates(k, gateOpen) {
  const { keep, put1 } = k;
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
}

/** Северная улица: фонари, кадки, скамейки, указатели, скверик у небоскрёбов. */
function northStreet(k) {
  const { keep, put1 } = k;
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
}

/** Рыночная площадь с фонтаном; у ТЦ «Вкусный», больницы и школы; площадка у приюта. */
function market(k) {
  const { keep, put1 } = k;
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
}

/** Западный квартал: дворики Мяты, Плюши, Профессора, Зефирки и Буси, Садовая улочка. */
function westYards(k) {
  const { keep, put1, fence } = k;
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
}

/** Парк: фонари, скамейки, клумбы, детская площадка, камыши у пруда, живая изгородь. */
function park(k) {
  const { keep, put1 } = k;
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
}

/** Жилой дом и ресторан «Золотой орешек» с террасой. */
function flatAndRestaurant(k) {
  const { keep, put1 } = k;
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
}

/** Восточный квартал: бассейн, дворики Сени, Боба и Пончика, подход к отелю. */
function eastQuarter(k) {
  const { keep, put1, fence } = k;
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
}

/** Набережная и ореховые скалы по краям пляжа, камни в воде у берега. */
function seafront(k) {
  const { g, solid, taken, keep, put1 } = k;
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
}

/** Пляж: зонтики, лежаки отеля, полотенца, вышка спасателя, бунгало, кафе, пальмы вдоль набережной. */
function beach(k, sea) {
  const { m, g, solid, taken, keep, put1 } = k;
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
}

/** Деревья, кусты и цветы — случайно (с постоянным зерном) на свободной траве; вплотную к дорожкам деревьев нет. */
function greenery(k) {
  const { m, g, solid, add, taken } = k;
  // ---- деревья, кусты, цветы ----
  const rng = seeded(20261112);
  for (const o of m.objs) taken.add(o.tx + ',' + o.ty);
  const nearDoor = (x, y) =>
    m.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y + b.h && y <= b.y + b.h + 1);
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

/** Построить карту города (build локации). sea — море города (createSea), gateOpen(id) — открыт ли выезд. */
export function buildTown(m, { sea, gateOpen }) {
  const k = kit(m),
    { add } = k;
  ground(k, sea);
  villaYard(k);
  gates(k, gateOpen);
  northStreet(k);
  market(k);
  westYards(k);
  park(k);
  flatAndRestaurant(k);
  eastQuarter(k);
  seafront(k);
  beach(k, sea);
  greenery(k);
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

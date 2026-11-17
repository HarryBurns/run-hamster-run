// Питомец, транспорт и двор (этап 17б). Механика — features/pet.js, features/wheels.js, features/yard.js;
// рисунки — art/pets.js, art/wheels.js, locations/common/yard.js; цены — PET_PRICES, RIDE_PRICES, YARD_PRICES
// в data/economy.js. id не переименовывать: они лежат в сохранении (state.pet.kind, state.wheels, state.yard).
import { PET_PRICES, RIDE_PRICES, YARD_PRICES } from './economy.js';

// ---------- питомец ----------
// Зверят не покупают: их берут из приюта «Тёплые лапки» (здание shelter в городе) — взнос PET_PRICES.fee идёт
// на корм тем, кто ещё ждёт хозяев. Питомец один; имя можно менять.
//   size — рост в единицах мира (зона нажатия и сердечки над головой); names — подсказки имён
export const PETS = [
  { id: 'kitten', name: 'Котёнок', icon: '🐱', size: 30, about: 'Рыжий клубочек. Любит играть с мячиком и мурлыкать.', names: ['Мурзик', 'Пушинка', 'Персик', 'Рыжик'] },
  { id: 'puppy', name: 'Щенок', icon: '🐶', size: 32, about: 'Весёлый и верный. Виляет хвостом, как только тебя увидит.', names: ['Дружок', 'Кнопка', 'Бублик', 'Тявка'] },
  { id: 'bunny', name: 'Крольчонок', icon: '🐰', size: 34, about: 'Тихий и мягкий. Смешно шевелит носом и прыгает за тобой.', names: ['Снежок', 'Морковка', 'Ушастик', 'Зайка'] },
  { id: 'hedgehog', name: 'Ёжик', icon: '🦔', size: 26, about: 'Колючий снаружи, добрый внутри. Топает и фыркает.', names: ['Фырк', 'Колючка', 'Топтыжка', 'Шуршик'] },
];
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));

/**
 * Дружба с питомцем: очки только растут (штрафов нет). heart — сколько очков в одном сердечке, hearts — сколько
 * сердечек всего; pet / feed / play — сколько очков даёт первое за день «погладить», «покормить», «поиграть»
 * (потом в этот день — просто радость и сердечки, без очков). hungryAfter — через сколько дней без еды питомец
 * грустит и просит поесть (только картинка и подсказка). nameMax — длина имени.
 */
export const PET = { heart: 20, hearts: 5, pet: 3, feed: 8, play: 5, hungryAfter: 2, nameMax: 12, fee: PET_PRICES.fee };
/** Что продаётся в приюте для питомца: корм (state.pet.food — штуки) и мячик (один на всю игру). */
export const PET_GOODS = [
  { id: 'food', name: 'Корм', icon: '🥣', price: PET_PRICES.food, about: 'Мисочка вкусного корма — на один раз.' },
  { id: 'ball', name: 'Мячик', icon: '🎾', price: PET_PRICES.ball, once: true, about: 'Бросай — питомец принесёт! Хватит навсегда.' },
];
/** Что говорит работница приюта и сам питомец. */
export const PET_LINES = {
  hello:
    'Здравствуй! Это приют «Тёплые лапки». Здесь зверята ждут друга. Мы их не продаём — отдаём в добрые руки. А взнос идёт на корм тем, кто ещё ждёт.',
  have: (name) => `Как поживает ${name}? У нас есть корм и мячик — заходи, когда понадобятся.`,
  done: (name) => `Теперь ${name} — твой друг! Гладь, корми, играй — и помни: друзей не бросают.`,
  hungry: 'Кушать хочу…',
};

// ---------- транспорт ----------
// speed — во сколько раз быстрее ходьбы по дороге (клетки ROAD_TILES); по траве и песку — как пешком.
// В воду, в здания и в места без дорог — пешком: хомячок слезает сам.
export const RIDES = [
  { id: 'scooter', name: 'Самокат', icon: '🛴', speed: 1.4, price: RIDE_PRICES.scooter, about: 'Лёгкий и быстрый: оттолкнулась — и поехала!' },
  { id: 'bike', name: 'Велосипед', icon: '🚲', speed: 1.7, price: RIDE_PRICES.bike, about: 'С корзинкой и звонком. По улицам — с ветерком.' },
  { id: 'car', name: 'Кабриолет', icon: '🚗', speed: 2.1, price: RIDE_PRICES.car, about: 'Маленькая машинка без крыши. Самая быстрая в городе!' },
];
export const RIDE_BY_ID = Object.fromEntries(RIDES.map((r) => [r.id, r]));
/** Клетки, по которым транспорт едет быстро: мостовая, брусчатка площади, дорожки, плитка, доски пирса. */
export const ROAD_TILES = ['r', 'k', 'y', 'p', 'i'];

// ---------- двор ----------
// Предметы двора — обычные предметы карты «вид сверху» (kind — вид из реестра engine/topdown/kinds.js, o — его
// поля): клумба цветёт по сезону, фонарик ночью горит, на скамейку и качели можно сесть (этап 17а).
//   art — чем нарисовать значок в магазине: [имя рисунка из ART, параметр a, параметр b]
export const YARD_ITEMS = [
  { id: 'y_bed_pink', name: 'Клумба розовая', kind: 'flowerbed', o: { v: 0 }, art: ['flowerbed', 'summer', 0] },
  { id: 'y_bed_lilac', name: 'Клумба сиреневая', kind: 'flowerbed', o: { v: 1 }, art: ['flowerbed', 'summer', 1] },
  { id: 'y_bed_sun', name: 'Клумба солнечная', kind: 'flowerbed', o: { v: 2 }, art: ['flowerbed', 'summer', 2] },
  { id: 'y_bush', name: 'Стриженый кустик', kind: 'yardBush', art: ['yardBush', 'summer'] },
  { id: 'y_lantern', name: 'Садовый фонарик', kind: 'yardLantern', art: ['yardLantern', 1, 0] },
  { id: 'y_garland', name: 'Гирлянда на колышках', kind: 'yardGarland', art: ['yardGarland', 1, 0] },
  { id: 'y_bench', name: 'Скамейка', kind: 'bench', art: ['bench', 0] },
  { id: 'y_swing', name: 'Качели', kind: 'swing', art: ['swing', 0, 0] },
  { id: 'y_pool', name: 'Бассейн-лягушатник', kind: 'yardPool', art: ['yardPool', 0] },
  { id: 'y_gnome', name: 'Садовый гномик', kind: 'yardGnome', art: ['yardGnome', 0] },
  { id: 'y_flamingo', name: 'Фламинго', kind: 'yardFlamingo', art: ['yardFlamingo', 0] },
  { id: 'y_birdbath', name: 'Купальня для птичек', kind: 'yardBirdbath', art: ['yardBirdbath', 0] },
].map((d) => ({ ...d, price: YARD_PRICES[d.id] || 0 }));
export const YARD_BY_ID = Object.fromEntries(YARD_ITEMS.map((d) => [d.id, d]));

/**
 * Дворы: у какого жилья (home — id из HOMES; вилла своя всегда) он есть, в какой локации (loc — имя сцены),
 * где (area — рамка в клетках), на каких клетках можно ставить (tiles) и сколько предметов помещается (max).
 */
export const YARDS = [
  { id: 'villa', home: 'villa', name: 'двор виллы', loc: 'world', area: [5, 4, 26, 23], tiles: ['g', 'p'], max: 40 },
  { id: 'bungalow', home: 'bungalow', name: 'дворик бунгало', loc: 'world', area: [3, 53, 14, 56], tiles: ['s'], max: 20 },
];
export const YARD_BY_ID_HOME = Object.fromEntries(YARDS.map((y) => [y.id, y]));

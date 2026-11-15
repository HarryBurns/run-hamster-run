// Экономика: ВСЕ числа баланса в одном месте — стартовый капитал, зарплаты, награды, цены, рынок.
// Таблицы одежды, мебели, еды и салона (clothes.js, furniture.js, food.js, beauty.js) берут цены отсюда,
// поэтому баланс правится только в этом файле.
//
// После любой правки:  node dev/balance.js  — печатает таблицу «сколько можно заработать за день и что сколько
// стоит» и проверяет, что у всего есть цена и нет «вечного двигателя» (купить → продать дороже).
// Принятые цифры и их объяснение — docs/DESIGN.md, раздел 1.

// ---------- старт ----------
export const START_MONEY = 3000; // новая игра
export const MIGRATED_MONEY = 20000; // старое сохранение с миллиардом после переноса (см. MIGRATIONS в core/state.js)

// ---------- заработок ----------
// Работа: мини-игра платит по звёздам — pay[звёзды − 1]. prize: это не зарплата, а приз (бассейн).
// Рыбалка не платит: улов продают на рынке.
export const JOBS = {
  swim: { pay: [150, 300, 600], prize: true },
  teacher: { pay: [200, 350, 500] },
  doctor: { pay: [250, 400, 600] },
  chef: { pay: [200, 400, 650] },
  fashion: { pay: [300, 500, 800] },
  barista: { pay: [200, 350, 550] }, // кафе «Семечка» и пляжное кафе: смены общие (игра одна)
};
/** Сколько смен в день оплачивается на каждом месте. Дальше играть можно, но «для удовольствия». */
export const PAID_SHIFTS = 2;

// Задание из конверта: монеты в дополнение к наклейке. Чем дольше задание, тем больше.
export const TASK_COINS_DEFAULT = 400;
export const TASK_COINS = {
  // быстрые: зайти, купить, нажать
  buy_clothes: 300, cafe: 300, salon: 300, talk: 300, wheel: 300, spa: 300, skate: 300, sea: 300, coconut: 300,
  plant: 300, tower: 300, market: 300, guesting: 300, teatime: 400, captain: 400,
  stargaze: 500, // звёзды видно только вечером
  // долгие: собрать по городу, выйти в море
  shells: 500, snow: 500, leaves: 500, flowers: 500, boat: 500,
  // самое трудное: нырнуть за жемчужиной
  pearl: 600,
};
/** Мешочек монет вместо сюрприза, когда все подарки уже подарены. */
export const SURPRISE_COINS = 1000;

/** Источники дохода — как их показывает Хомяк-Банк. earn(n, id) из core/actions.js пишет доход по этим id. */
export const INCOME_SOURCES = [
  { id: 'work', icon: '💼', name: 'Работа' },
  { id: 'market', icon: '🧺', name: 'Рынок' },
  { id: 'task', icon: '✉️', name: 'Задания' },
  { id: 'business', icon: '🏪', name: 'Свой бизнес' },
  { id: 'gift', icon: '🎁', name: 'Подарки' },
  { id: 'other', icon: '🪙', name: 'Другое' },
];
/** Наклейки за деньги: «Заработала 10 000» (всего заработано) и «Накопила 50 000» (на счету). */
export const MONEY_STICKERS = { earned: 10000, saved: 50000 };

// ---------- жильё и свой бизнес ----------
// Принятые цифры — docs/DESIGN.md, раздел 3. Описания (названия, сцены, кто хозяин) — data/estate.js.
/** Цены жилья. */
export const HOME_PRICES = { flat: 25000, cabin: 45000, bungalow: 60000, suite: 80000, penthouse: 150000 };
/** Заведения: цена покупки и выручка за день (копится в кассе заведения, забирать — там же). */
export const BIZ = {
  cafe: { price: 40000, income: 1500 },
  beachcafe: { price: 55000, income: 2000 },
  salon: { price: 60000, income: 2200 },
  boutique: { price: 70000, income: 2500 },
  rest: { price: 90000, income: 3500 },
};
export const BIZ_RULES = {
  /** В кассе помещается выручка за столько дней: дальше она не растёт, пока хозяйка её не заберёт. */
  tillDays: 3,
  /** Хозяйка сама поработала в заведении: прибавка к выручке этого дня — по звёздам мини-игры (1★, 2★, 3★). */
  workBonus: [0.2, 0.35, 0.5],
  /** Во столько раз больше платят хозяйке за смену в своём заведении (зарплата из JOBS × ownerPay). */
  ownerPay: 1.5,
  /** «Блюдо дня» в своём ресторане: прибавка к выручке; за секретный рецепт (узнала от друга) — больше. */
  special: 0.1,
  specialSecret: 0.2,
};

// ---------- рынок ----------
export const MARKET = {
  /** Кошелёк торговца: столько монет он может заплатить за день. Это и есть предел продаж в день. */
  purse: 2000,
  /** Что сколько стоит на рынке: своё — урожай, улов, находки. */
  sell: { carrot: 40, tomato: 60, strawberry: 70, seeds: 80, pumpkin: 150, fish: 120, coconut: 60, pearl: 400 },
  /** Купленное в магазине рынок берёт за эту долю магазинной цены. */
  shopShare: 0.4,
  /**
   * Порция блюда = сумма рыночных цен его продуктов × dishShare. Готовка даёт 1, 2 или 3 порции, то есть
   * «подгорело» × 0,8, «очень вкусно» × 1,6, «шедевр» × 2,4 от цены продуктов. Из-за shopShare блюдо из одних
   * магазинных продуктов продуктов не окупает (2,4 × 0,4 < 1): выгодно готовить из своего.
   */
  dishShare: 0.8,
  /** Блюдо, которое продают и в кафе, рынок берёт не дороже этой доли цены кафе. */
  cafeShare: 0.5,
  /** Фрукты не по сезону на рынке дороже, чем в ТЦ «Вкусный» в сезон. */
  rareMarkup: 1.5,
  /** Сколько «вещиц ручной работы» торговец привозит на день. */
  trinkets: 3,
};

// ---------- цены ----------
// Порядки: продукты 10–60, семена 20–60, блюда в кафе 60–250, салон 100–400, простая одежда 150–650,
// куртки 800–1 500, бутик 2 500–15 000, «королевское» 30 000–80 000, мебель 100–3 000, пианино 8 000.
export const PRICES = {
  // продукты в ТЦ «Вкусный»
  ing: {
    flour: 15, egg: 20, milk: 20, cheese: 50, butter: 35, sugar: 15, choco: 45, rice: 30, nuts: 55, apple: 15,
    banana: 20, honey: 60,
    coconut: 150, // с пальмы — бесплатно; в магазине дорого, иначе кокос выгодно перепродавать
    mango: 60, pineapple: 60, kiwi: 30, orange: 20, lemon: 20, peach: 30, grapes: 40, melon: 50, avocado: 45,
  },
  // семена в ТЦ «Уютный дом»
  seeds: { seed_carrot: 20, seed_tomato: 30, seed_strawberry: 50, seed_seeds: 40, seed_pumpkin: 60 },
  // готовые блюда в кафе и ресторане
  cafe: {
    cocoa: 60, cookies: 80, croissant: 70, donut: 60, choco_cake: 220, // кафе «Семечка»
    coco_shake: 130, icecream: 200, lemonade: 70, watermelon: 100, // пляжное кафе (мороженое — из своей клубники!)
    pizza: 180, sushi: 250, burger: 160, pasta: 170, // ресторан «Золотой орешек»
  },
  // салон красоты: цена за одну перемену
  beauty: { tuft: 400, hair: 300, lashes: 150, blush: 100, nails: 250, bow: 150 },
  // одежда: ТЦ «Модный», пляжный магазинчик, бутик «Бантик», рынок
  clothes: {
    // майки
    tee_sun: 180, tee_stripe: 180, tee_dots: 190, tee_star: 220, tee_orange: 150, tee_hawaii: 320, tee_hawaii_blue: 320,
    // платья
    dress_red: 550, dress_check: 500, dress_sea: 520, dress_stars: 600, dress_mint: 450, dress_sleeve: 650,
    dress_flowers: 580, dress_evening: 9000, dress_daisy: 6000, princess_pink: 30000, princess_gold: 80000,
    // кофты, худи, комбинезоны
    sw_orange: 420, sw_pink: 400, sw_green: 450, sw_cream: 430, hoodie_grey: 480, hoodie_violet: 550,
    overall_jeans: 520, overall_red: 520, tuxedo: 8000, tuxedo_white: 9000,
    // куртки
    jw_red: 1300, jw_pink: 1350, jw_white: 1500, ja_yellow: 1000, ja_orange: 1050, ja_wine: 1100,
    js_mint: 800, js_lilac: 850, js_pink: 850,
    // купальники, пижама, халат
    swim_blue: 300, swim_yellow: 300, swim_star: 380, pajama_pink: 280, robe: 2500,
    // низ
    shorts_red: 200, shorts_dots: 220, shorts_star: 250, skirt_check: 300, skirt_blue: 280, skirt_dots: 320,
    pants_grey: 400, pants_black: 450, tutu_pink: 3000, tutu_white: 3000,
    // обувь
    sn_white: 380, sn_mint: 400, boots_black: 550, ugg_beige: 600, ugg_pink: 650, rain_red: 400, rain_yellow: 400,
    sand_yellow: 250, sand_pink: 250, flippers: 300, rollers: 600, heels_red: 3500, heels_black: 3500,
    shoes_gold: 12000,
    // голова
    cap_yellow: 200, cap_red: 250, cap_blue: 200, panama_green: 230, panama_white: 220, panama_pink: 230,
    sunhat: 400, sunhat_blue: 400, beanie_blue: 300, beanie_pink: 320, earmuffs: 380, hat_cowboy: 500,
    beret_red: 380, beret_black: 2500, hat_chef: 300, hat_pith: 450, catears: 350, hair_flower: 250, hat_party: 150,
    tophat: 7000, crown: 50000,
    // аксессуары
    glasses_red: 250, glasses_black: 250, sung_yellow: 350, sung_pink: 350, scarf_blue: 280, scarf_pink: 280,
    bag_yellow: 450, backpack: 400, tie_red: 300, tie_blue: 300, lei: 280, camera: 900,
    neck_heart: 5000, neck_pearl: 15000, bag_pink: 2800, bowtie: 2500, cape_red: 4000,
    // рынок: вещицы ручной работы
    sunhat_daisy: 900, scarf_knit: 700, bag_straw: 1200, lei_shell: 1500,
  },
  // мебель: ТЦ «Уютный дом», рынок
  furn: {
    bed_pink: 1500, bed_blue: 1500, bed_green: 1500, bed_royal: 30000,
    wardrobe: 1800, wardrobe_white: 2200, fridge: 2000, fridge_pink: 2600,
    sofa_red: 1600, sofa_mint: 1600, sofa_purple: 1800, armchair: 800, armchair_blue: 800, beanbag: 500, chair: 250,
    table: 900, coffee_table: 500, nightstand: 350, bookshelf: 1200,
    tv: 3000, piano: 8000, wheel: 1500, music: 1200, teddy: 300, aquarium: 2500, fireplace: 3000,
    lamp: 300, lamp_pink: 300, plant_ficus: 200, plant_palm: 350, plant_cactus: 150, plant_flowers: 180,
    rug_pink: 300, rug_blue: 300, rug_rainbow: 700, balloons: 100,
    pic_sun: 400, pic_sea: 400, pic_hamster: 900, pic_flowers: 400, clock: 300, mirror: 600, garland: 250,
    shelf: 500, discoball: 2000,
    // рынок: вещицы ручной работы
    rug_craft: 1200, lamp_lantern: 900, beanbag_melon: 1500,
    // «как у соседей»: вещи из домов жителей
    ship_wheel: 1800, fishnet: 400, seamap: 700, anchor: 900, lifebuoy: 350, hammock: 1800,
    globe: 1200, telescope: 3500, desk: 1400, blackboard: 600,
    vanity: 2200, mannequin: 1300, clothes_rack: 1100,
    fridge_giant: 5000, oven: 2400, pot_rack: 500,
    barbell: 1500, punchbag: 1300, trophy_shelf: 800,
    rocking_chair: 1200, tea_table: 1000,
    toybox: 700, dollhouse: 1600, rocking_horse: 1100,
    seedling_shelf: 900, watering_can: 250, hanging_plant: 300,
  },
};

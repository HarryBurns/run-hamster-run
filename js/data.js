// Все «таблицы» игры: одежда, красота, мебель, еда, рецепты, друзья, задания, наклейки.

export const START_MONEY = 1_000_000_000;

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
export const SEASONS = {
  winter: { name: 'Зима', icon: '❄️' },
  spring: { name: 'Весна', icon: '🌸' },
  summer: { name: 'Лето', icon: '☀️' },
  autumn: { name: 'Осень', icon: '🍂' },
};
export const DAYS_PER_MONTH = 3;

// ====================== ОДЕЖДА ======================
// slot: head | body | legs | feet | acc
// shop: start (уже есть) | mall | boutique | beach | gift (только в подарок)
export const SLOTS = [
  { id: 'head', name: 'Голова', icon: '👒' },
  { id: 'body', name: 'Верх и платья', icon: '👗' },
  { id: 'legs', name: 'Низ', icon: '🩳' },
  { id: 'feet', name: 'Обувь', icon: '👟' },
  { id: 'acc', name: 'Аксессуары', icon: '👓' },
];

const CL = [];
function C(id, slot, kind, name, price, c, o = {}) {
  CL.push({ id, slot, kind, name, price, c, shop: 'mall', tags: [], ...o });
}
// --- майки
C('tee_heart', 'body', 'tee', 'Майка с сердечком', 0, '#ff6b9d', { print: 'heart', shop: 'start', tags: ['summer', 'sport', 'cute'] });
C('tee_sun', 'body', 'tee', 'Майка с солнышком', 900, '#74c0fc', { print: 'sun', tags: ['summer', 'sport', 'beach'] });
C('tee_stripe', 'body', 'tee', 'Майка-тельняшка', 900, '#ffffff', { pattern: 'stripes', c2: '#1c7ed6', tags: ['summer', 'sport', 'beach'] });
C('tee_dots', 'body', 'tee', 'Майка в горошек', 950, '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'cute'] });
C('tee_star', 'body', 'tee', 'Майка со звездой', 1100, '#845ef7', { print: 'star', tags: ['summer', 'sport'] });
C('tee_orange', 'body', 'tee', 'Апельсиновая майка', 800, '#ff922b', { tags: ['summer', 'sport'] });
// --- платья
C('dress_lilac', 'body', 'dress', 'Сиреневое платье в горошек', 0, '#c77dff', { pattern: 'dots', c2: '#fff', shop: 'start', tags: ['summer', 'cute', 'fancy'] });
C('dress_red', 'body', 'dress', 'Красное платье', 3500, '#f03e3e', { c2: '#fff', tags: ['fancy', 'cute'] });
C('dress_check', 'body', 'dress', 'Платье в клетку', 3200, '#ffd43b', { pattern: 'check', c2: '#f08c00', tags: ['cute', 'autumn'] });
C('dress_sea', 'body', 'dress', 'Морское платье', 3400, '#ffffff', { pattern: 'stripes', c2: '#339af0', tags: ['summer', 'beach', 'cute'] });
C('dress_stars', 'body', 'dress', 'Звёздное платье', 4200, '#3b5bdb', { pattern: 'stars', c2: '#ffe066', tags: ['fancy'] });
C('dress_mint', 'body', 'dress', 'Мятное платье', 3000, '#63e6be', { pattern: 'dots', c2: '#fff', tags: ['summer', 'spring', 'cute'] });
C('dress_sleeve', 'body', 'dress', 'Тёплое платье с рукавами', 4800, '#e8590c', { sleeves: 'long', pattern: 'check', c2: '#ffd8a8', tags: ['autumn', 'warm', 'cute'] });
C('dress_evening', 'body', 'dress', 'Вечернее платье', 45000, '#212529', { pattern: 'stars', c2: '#ffd43b', shop: 'boutique', tags: ['fancy'] });
C('dress_daisy', 'body', 'dress', 'Платье «Ромашка»', 28000, '#fff9db', { pattern: 'dots', c2: '#fcc419', shop: 'boutique', tags: ['fancy', 'summer', 'spring', 'cute'] });
C('princess_pink', 'body', 'princess', 'Платье принцессы', 250000, '#ffa8d9', { shop: 'boutique', tags: ['fancy'] });
C('princess_gold', 'body', 'princess', 'Золотое бальное платье', 1000000, '#ffd43b', { shop: 'boutique', tags: ['fancy'] });
C('princess_fairy', 'body', 'princess', 'Платье феи', 0, '#a5d8ff', { shop: 'gift', tags: ['fancy'] });
// --- кофты
C('sw_orange', 'body', 'sweater', 'Полосатая кофта', 2500, '#ff922b', { pattern: 'stripes', c2: '#fff4e6', tags: ['warm', 'autumn', 'home'] });
C('sw_pink', 'body', 'sweater', 'Розовая кофта', 2400, '#faa2c1', { tags: ['warm', 'spring', 'cute', 'home'] });
C('sw_green', 'body', 'sweater', 'Зелёная кофта со звёздами', 2700, '#2f9e44', { pattern: 'stars', c2: '#fff', tags: ['warm', 'winter'] });
C('sw_cream', 'body', 'sweater', 'Уютная бежевая кофта', 2600, '#f1e0c5', { tags: ['warm', 'autumn', 'home'] });
// --- куртки
C('jw_blue', 'body', 'jacketW', 'Зимняя куртка голубая', 0, '#4dabf7', { shop: 'start', season: 'winter', tags: ['warm', 'winter'] });
C('jw_red', 'body', 'jacketW', 'Зимняя куртка красная', 12000, '#f03e3e', { season: 'winter', tags: ['warm', 'winter'] });
C('jw_pink', 'body', 'jacketW', 'Зимняя куртка розовая', 12500, '#f783ac', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('jw_white', 'body', 'jacketW', 'Белоснежный пуховик', 15000, '#f8f9fa', { c2: '#d0bfff', season: 'winter', tags: ['warm', 'winter', 'fancy'] });
C('ja_yellow', 'body', 'jacketA', 'Осенняя куртка-дождевик', 9000, '#ffd43b', { season: 'autumn', tags: ['autumn', 'rain'] });
C('ja_orange', 'body', 'jacketA', 'Осенняя куртка рыжая', 9200, '#e8590c', { season: 'autumn', tags: ['autumn', 'rain', 'warm'] });
C('ja_wine', 'body', 'jacketA', 'Осенняя куртка вишнёвая', 9500, '#a61e4d', { c2: '#ffd43b', season: 'autumn', tags: ['autumn', 'rain', 'warm'] });
C('js_mint', 'body', 'jacketS', 'Весенняя куртка мятная', 8000, '#63e6be', { c2: '#fff', season: 'spring', tags: ['spring', 'rain', 'sport'] });
C('js_lilac', 'body', 'jacketS', 'Весенняя куртка сиреневая', 8200, '#b197fc', { c2: '#fff', season: 'spring', tags: ['spring', 'cute'] });
C('js_pink', 'body', 'jacketS', 'Весенняя куртка розовая', 8200, '#ff8fab', { c2: '#ffe066', season: 'spring', tags: ['spring', 'cute'] });
// --- купальники, пижама, халат
C('swim_pink', 'body', 'swim', 'Купальник в горошек', 0, '#ff5c8a', { pattern: 'dots', c2: '#fff', shop: 'start', tags: ['beach', 'summer', 'swim'] });
C('swim_blue', 'body', 'swim', 'Полосатый купальник', 2000, '#339af0', { pattern: 'stripes', c2: '#fff', tags: ['beach', 'summer', 'swim', 'sport'] });
C('swim_yellow', 'body', 'swim', 'Солнечный купальник', 2000, '#ffd43b', { tags: ['beach', 'summer', 'swim'] });
C('swim_star', 'body', 'swim', 'Звёздный купальник', 2600, '#20c997', { pattern: 'stars', c2: '#fff', shop: 'beach', tags: ['beach', 'summer', 'swim'] });
C('pajama', 'body', 'pajama', 'Пижама со звёздами', 0, '#b197fc', { pattern: 'stars', c2: '#fff', shop: 'start', tags: ['home'] });
C('pajama_pink', 'body', 'pajama', 'Пижама-зефирка', 1800, '#ffc9de', { pattern: 'dots', c2: '#fff', tags: ['home', 'cute'] });
C('robe', 'body', 'robe', 'Пушистый халат', 5000, '#74c0fc', { shop: 'boutique', tags: ['home'] });
// --- низ
C('shorts_jeans', 'legs', 'shorts', 'Джинсовые шорты', 0, '#4dabf7', { shop: 'start', tags: ['summer', 'sport', 'beach'] });
C('shorts_red', 'legs', 'shorts', 'Красные шорты', 1200, '#f03e3e', { tags: ['summer', 'sport'] });
C('shorts_dots', 'legs', 'shorts', 'Шорты в горошек', 1300, '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'cute', 'beach'] });
C('shorts_star', 'legs', 'shorts', 'Шорты со звёздами', 1500, '#845ef7', { pattern: 'stars', c2: '#ffe066', tags: ['summer', 'sport'] });
C('skirt_check', 'legs', 'skirt', 'Юбка в клетку', 1800, '#ff8fab', { pattern: 'check', c2: '#c2255c', tags: ['cute', 'spring', 'autumn'] });
C('skirt_blue', 'legs', 'skirt', 'Голубая юбочка', 1700, '#74c0fc', { tags: ['cute', 'summer', 'spring'] });
C('skirt_dots', 'legs', 'skirt', 'Юбка в горошек', 1900, '#ffd43b', { pattern: 'dots', c2: '#fff', tags: ['cute', 'summer'] });
C('pants_jeans', 'legs', 'pants', 'Джинсы', 0, '#1c7ed6', { shop: 'start', tags: ['warm', 'autumn', 'spring', 'winter', 'rain'] });
C('pants_grey', 'legs', 'pants', 'Тёплые штаны', 2800, '#868e96', { tags: ['warm', 'winter', 'home'] });
C('pants_black', 'legs', 'pants', 'Чёрные брючки', 3000, '#343a40', { tags: ['fancy', 'warm', 'autumn'] });
// --- обувь
C('sn_red', 'feet', 'sneakers', 'Красные кеды', 0, '#ff6b6b', { shop: 'start', tags: ['sport', 'summer', 'spring'] });
C('sn_white', 'feet', 'sneakers', 'Белые кроссовки', 2500, '#f1f3f5', { tags: ['sport', 'summer', 'spring'] });
C('sn_mint', 'feet', 'sneakers', 'Мятные кеды', 2600, '#63e6be', { tags: ['sport', 'cute', 'spring'] });
C('boots_brown', 'feet', 'boots', 'Коричневые ботинки', 0, '#8d5524', { shop: 'start', tags: ['warm', 'autumn', 'winter'] });
C('boots_black', 'feet', 'boots', 'Чёрные ботинки', 4000, '#343a40', { tags: ['warm', 'autumn', 'fancy'] });
C('ugg_beige', 'feet', 'wboots', 'Угги', 5500, '#d9a066', { season: 'winter', tags: ['warm', 'winter', 'home'] });
C('ugg_pink', 'feet', 'wboots', 'Розовые угги', 5800, '#f783ac', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('rain_red', 'feet', 'rainboots', 'Красные резиновые сапожки', 3000, '#e03131', { tags: ['rain', 'autumn', 'spring'] });
C('rain_yellow', 'feet', 'rainboots', 'Жёлтые резиновые сапожки', 3000, '#fcc419', { tags: ['rain', 'autumn', 'spring'] });
C('sand_yellow', 'feet', 'sandals', 'Жёлтые сандалии', 1500, '#fcc419', { tags: ['summer', 'beach', 'cute'] });
C('sand_pink', 'feet', 'sandals', 'Розовые сандалии', 1500, '#ff6b9d', { tags: ['summer', 'beach', 'fancy', 'cute'] });
C('flippers', 'feet', 'flippers', 'Ласты', 1800, '#20c997', { shop: 'beach', tags: ['beach', 'swim'] });
C('slippers', 'feet', 'slippers', 'Домашние тапочки', 0, '#ffc9de', { shop: 'start', tags: ['home'] });
C('shoes_gold', 'feet', 'sandals', 'Золотые туфельки', 60000, '#ffd43b', { c2: '#ff6b9d', shop: 'boutique', tags: ['fancy'] });
// --- голова
C('cap_yellow', 'head', 'cap', 'Жёлтая кепка', 1200, '#ffd43b', { tags: ['sport', 'summer'] });
C('cap_red', 'head', 'cap', 'Кепка со звездой', 1500, '#f03e3e', { print: 'star', tags: ['sport', 'summer', 'spring'] });
C('cap_blue', 'head', 'cap', 'Синяя кепка', 1200, '#339af0', { tags: ['sport', 'summer', 'spring'] });
C('panama_green', 'head', 'panama', 'Панамка в горошек', 1400, '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'beach', 'cute'] });
C('panama_white', 'head', 'panama', 'Белая панамка', 1300, '#f8f9fa', { c2: '#74c0fc', tags: ['summer', 'beach'] });
C('panama_pink', 'head', 'panama', 'Розовая панамка', 1400, '#ff8fab', { pattern: 'stripes', c2: '#fff', tags: ['summer', 'beach', 'cute'] });
C('sunhat', 'head', 'sunhat', 'Соломенная шляпа', 2600, '#ffe8a1', { c2: '#ff6b9d', tags: ['summer', 'beach', 'fancy'] });
C('sunhat_blue', 'head', 'sunhat', 'Шляпа с голубой лентой', 2600, '#fff3bf', { c2: '#4dabf7', shop: 'beach', tags: ['summer', 'beach', 'fancy'] });
C('beanie_red', 'head', 'beanie', 'Шапка с помпоном', 0, '#ff6b6b', { pattern: 'stripes', c2: '#fff', shop: 'start', season: 'winter', tags: ['warm', 'winter'] });
C('beanie_blue', 'head', 'beanie', 'Синяя шапка', 2200, '#4c6ef5', { season: 'winter', tags: ['warm', 'winter', 'sport'] });
C('beanie_pink', 'head', 'beanie', 'Розовая шапка в горошек', 2300, '#f783ac', { pattern: 'dots', c2: '#fff', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('earmuffs', 'head', 'earmuffs', 'Меховые наушники', 2800, '#ffc9de', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('tophat', 'head', 'tophat', 'Цилиндр', 35000, '#343a40', { c2: '#e03131', shop: 'boutique', tags: ['fancy'] });
C('crown', 'head', 'crown', 'Корона', 500000, '#ffd43b', { shop: 'boutique', tags: ['fancy'] });
C('wreath', 'head', 'wreath', 'Венок из цветов', 0, '#fff', { shop: 'gift', tags: ['fancy', 'spring', 'summer', 'cute'] });
// --- аксессуары
C('glasses_red', 'acc', 'glasses', 'Красные очки', 1600, '#e03131', { tags: ['cute'] });
C('glasses_black', 'acc', 'glasses', 'Умные очки', 1600, '#343a40', { tags: ['fancy'] });
C('sung_yellow', 'acc', 'sunglasses', 'Солнечные очки', 2200, '#ffd43b', { tags: ['summer', 'beach', 'sport'] });
C('sung_pink', 'acc', 'sunglasses', 'Розовые тёмные очки', 2200, '#ff6b9d', { shop: 'beach', tags: ['summer', 'beach', 'cute'] });
C('scarf_yellow', 'acc', 'scarf', 'Полосатый шарф', 0, '#ffd43b', { c2: '#ff6b6b', shop: 'start', season: 'winter', tags: ['warm', 'winter', 'autumn'] });
C('scarf_blue', 'acc', 'scarf', 'Голубой шарф', 1800, '#74c0fc', { c2: '#fff', season: 'winter', tags: ['warm', 'winter', 'autumn'] });
C('scarf_pink', 'acc', 'scarf', 'Розовый шарф', 1800, '#faa2c1', { c2: '#c2255c', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('neck_heart', 'acc', 'necklace', 'Кулон-сердечко', 20000, '#ffd43b', { pendant: 'heart', shop: 'boutique', tags: ['fancy', 'cute'] });
C('neck_pearl', 'acc', 'necklace', 'Жемчужные бусы', 80000, '#fff5f5', { shop: 'boutique', tags: ['fancy'] });
C('bag_pink', 'acc', 'bag', 'Розовая сумочка', 6000, '#e64980', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('bag_yellow', 'acc', 'bag', 'Жёлтая сумочка', 3000, '#fcc419', { tags: ['cute', 'summer'] });
C('bowtie', 'acc', 'bowtie', 'Бабочка', 2500, '#e03131', { c2: '#fff', shop: 'boutique', tags: ['fancy'] });
C('backpack', 'acc', 'backpack', 'Рюкзачок', 2400, '#4dabf7', { tags: ['sport', 'spring', 'autumn'] });
C('wings', 'acc', 'wings', 'Крылышки феи', 0, '#d0ebff', { shop: 'gift', tags: ['fancy'] });
C('medal', 'acc', 'medal', 'Золотая медаль', 0, '#ffd43b', { shop: 'gift', tags: ['sport'] });

// --- новая коллекция
C('tee_hawaii', 'body', 'tee', 'Гавайская рубашка', 1600, '#ff922b', { pattern: 'flowers', c2: '#fff', shop: 'beach', tags: ['summer', 'beach', 'cute'] });
C('tee_hawaii_blue', 'body', 'tee', 'Рубашка «Лагуна»', 1600, '#15aabf', { pattern: 'flowers', c2: '#fff3bf', shop: 'beach', tags: ['summer', 'beach'] });
C('dress_flowers', 'body', 'dress', 'Цветочное платье', 3800, '#f783ac', { pattern: 'flowers', c2: '#fff', tags: ['spring', 'summer', 'cute', 'fancy'] });
C('overall_jeans', 'body', 'overall', 'Джинсовый комбинезон', 3200, '#4c6ef5', { c2: '#fff', tags: ['spring', 'autumn', 'sport', 'cute'] });
C('overall_red', 'body', 'overall', 'Красный комбинезон', 3200, '#f03e3e', { c2: '#ffe066', tags: ['spring', 'autumn', 'cute'] });
C('hoodie_grey', 'body', 'hoodie', 'Серое худи', 2900, '#adb5bd', { tags: ['warm', 'sport', 'autumn', 'spring', 'home'] });
C('hoodie_violet', 'body', 'hoodie', 'Худи со звёздами', 3300, '#7950f2', { pattern: 'stars', c2: '#ffe066', tags: ['warm', 'sport', 'autumn', 'cute'] });
C('tuxedo', 'body', 'tuxedo', 'Смокинг', 38000, '#212529', { c2: '#e03131', shop: 'boutique', tags: ['fancy'] });
C('tuxedo_white', 'body', 'tuxedo', 'Белый смокинг', 42000, '#f8f9fa', { c2: '#1c7ed6', shop: 'boutique', tags: ['fancy', 'summer'] });
C('tutu_pink', 'legs', 'tutu', 'Балетная пачка', 4500, '#ffa8d9', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('tutu_white', 'legs', 'tutu', 'Белая пачка', 4500, '#ffffff', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('heels_red', 'feet', 'heels', 'Красные туфельки', 5200, '#f03e3e', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('heels_black', 'feet', 'heels', 'Чёрные туфельки', 5200, '#343a40', { c2: '#ffd43b', shop: 'boutique', tags: ['fancy'] });
C('rollers', 'feet', 'rollers', 'Ролики', 3600, '#20c997', { c2: '#ff6b9d', tags: ['sport', 'summer', 'spring'] });
C('hat_cowboy', 'head', 'cowboy', 'Ковбойская шляпа', 3400, '#c98b5a', { c2: '#8d5524', tags: ['summer', 'sport'] });
C('beret_red', 'head', 'beret', 'Красный берет', 2400, '#e03131', { c2: '#a51111', tags: ['fancy', 'autumn', 'spring', 'cute'] });
C('beret_black', 'head', 'beret', 'Чёрный берет', 2400, '#343a40', { c2: '#212529', shop: 'boutique', tags: ['fancy', 'autumn'] });
C('hat_chef', 'head', 'chef', 'Поварской колпак', 1800, '#fff', { tags: ['home'] });
C('hat_pith', 'head', 'pith', 'Шлем исследователя', 2800, '#f1e0c5', { c2: '#d9a066', tags: ['summer', 'sport'] });
C('catears', 'head', 'catears', 'Кошачьи ушки', 2200, '#343a40', { c2: '#ff6b9d', tags: ['cute', 'home'] });
C('hair_flower', 'head', 'flower', 'Цветок в причёску', 1500, '#ff6b9d', { c2: '#ffd43b', shop: 'beach', tags: ['summer', 'beach', 'cute', 'fancy', 'spring'] });
C('hat_party', 'head', 'party', 'Праздничный колпачок', 900, '#4dabf7', { c2: '#ffd43b', tags: ['cute', 'home'] });
C('hat_pirate', 'head', 'pirate', 'Пиратская треуголка', 0, '#212529', { shop: 'gift', tags: ['fancy'] });
C('hat_santa', 'head', 'santa', 'Новогодний колпак', 0, '#e03131', { shop: 'gift', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('hat_witch', 'head', 'witch', 'Шляпа волшебницы', 0, '#5f3dc4', { c2: '#ff922b', shop: 'gift', tags: ['fancy', 'autumn'] });
C('tie_red', 'acc', 'tie', 'Красный галстук', 1900, '#e03131', { c2: '#fff', tags: ['fancy'] });
C('tie_blue', 'acc', 'tie', 'Синий галстук', 1900, '#1c7ed6', { c2: '#ffd43b', tags: ['fancy'] });
C('lei', 'acc', 'lei', 'Гавайские бусы из цветов', 1700, '#ff6b9d', { c2: '#b197fc', shop: 'beach', tags: ['summer', 'beach', 'cute', 'fancy'] });
C('camera', 'acc', 'camera', 'Фотоаппарат', 6500, '#495057', { c2: '#fa5252', tags: ['sport', 'summer', 'spring', 'autumn'] });
C('cape_red', 'acc', 'cape', 'Плащ супергероя', 7500, '#e03131', { shop: 'boutique', tags: ['fancy', 'sport'] });
C('cape_violet', 'acc', 'cape', 'Волшебная мантия', 0, '#7048e8', { shop: 'gift', tags: ['fancy'] });

export const CLOTHES = CL;
export const CLOTHES_BY_ID = Object.fromEntries(CL.map((c) => [c.id, c]));
export const START_CLOTHES = CL.filter((c) => c.shop === 'start').map((c) => c.id);
export const START_OUTFIT = { head: 'beanie_red', body: 'jw_blue', legs: 'pants_jeans', feet: 'boots_brown', acc: 'scarf_yellow' };

// ====================== САЛОН КРАСОТЫ ======================
export const BEAUTY = {
  tuft: { name: 'Причёска', icon: '💇', price: 3000, options: [
    { v: 0, name: 'Гладкая' }, { v: 1, name: 'Хохолок' }, { v: 2, name: 'Чёлка' },
    { v: 3, name: 'Кудряшки' }, { v: 4, name: 'Хвостики' }, { v: 5, name: 'Ирокез' }] },
  hair: { name: 'Цвет причёски', icon: '🎨', price: 2000, options: [
    { v: null, name: 'Свой', c: '#2f2a2a' }, { v: '#ff6b9d', name: 'Розовый', c: '#ff6b9d' }, { v: '#845ef7', name: 'Фиолетовый', c: '#845ef7' },
    { v: '#4dabf7', name: 'Голубой', c: '#4dabf7' }, { v: '#ffd43b', name: 'Золотой', c: '#ffd43b' }, { v: '#ff922b', name: 'Рыжий', c: '#ff922b' },
    { v: '#20c997', name: 'Бирюзовый', c: '#20c997' }] },
  lashes: { name: 'Реснички', icon: '👁️', price: 1500, options: [{ v: false, name: 'Без ресничек' }, { v: true, name: 'Пушистые' }] },
  blush: { name: 'Румянец', icon: '☺️', price: 1000, options: [
    { v: '#ffb0bd', name: 'Нежный', c: '#ffb0bd' }, { v: '#ff6b9d', name: 'Яркий', c: '#ff6b9d' },
    { v: '#ffa94d', name: 'Персик', c: '#ffa94d' }, { v: null, name: 'Без румянца', c: '#eee' }] },
  nails: { name: 'Маникюр', icon: '💅', price: 2500, options: [
    { v: null, name: 'Без лака', c: '#eee' }, { v: '#e64980', name: 'Малина', c: '#e64980' }, { v: '#845ef7', name: 'Сирень', c: '#845ef7' },
    { v: '#ffd43b', name: 'Золото', c: '#ffd43b' }, { v: '#20c997', name: 'Мята', c: '#20c997' }, { v: '#f03e3e', name: 'Красный', c: '#f03e3e' }] },
  bow: { name: 'Бантик', icon: '🎀', price: 1200, options: [
    { v: null, name: 'Без бантика', c: '#eee' }, { v: '#ff5c8a', name: 'Розовый', c: '#ff5c8a' }, { v: '#4dabf7', name: 'Голубой', c: '#4dabf7' },
    { v: '#ffd43b', name: 'Жёлтый', c: '#ffd43b' }, { v: '#b197fc', name: 'Сиреневый', c: '#b197fc' }, { v: '#f03e3e', name: 'Красный', c: '#f03e3e' }] },
};

// ====================== МЕБЕЛЬ ======================
// kind — как предмет рисуется и что делает (см. props.js). wall: висит на стене.
// act: sleep | wardrobe | fridge | sit | tv | lamp | plant | piano | wheel | music | toy | fish | fire | none
const FU = [];
function F(id, kind, name, price, w, h, o = {}) {
  FU.push({ id, kind, name, price, w, h, shop: 'home', act: 'none', c: '#ff8fab', ...o });
}
F('bed_pink', 'bed', 'Кровать розовая', 18000, 210, 96, { act: 'sleep', c: '#ff8fab', cat: 'bed' });
F('bed_blue', 'bed', 'Кровать голубая', 18000, 210, 96, { act: 'sleep', c: '#74c0fc', cat: 'bed' });
F('bed_green', 'bed', 'Кровать зелёная', 18000, 210, 96, { act: 'sleep', c: '#8ce99a', cat: 'bed' });
F('bed_royal', 'bed', 'Королевская кровать', 400000, 230, 130, { act: 'sleep', c: '#b197fc', royal: true, cat: 'bed' });
F('wardrobe', 'wardrobe', 'Шкаф с одеждой', 25000, 130, 190, { act: 'wardrobe', c: '#d9a066', cat: 'furn' });
F('wardrobe_white', 'wardrobe', 'Белый шкаф', 32000, 130, 190, { act: 'wardrobe', c: '#f1f3f5', cat: 'furn' });
F('fridge', 'fridge', 'Холодильник', 30000, 96, 180, { act: 'fridge', c: '#e9ecef', cat: 'furn' });
F('fridge_pink', 'fridge', 'Розовый холодильник', 42000, 96, 180, { act: 'fridge', c: '#ffc9de', cat: 'furn' });
F('sofa_red', 'sofa', 'Диван красный', 22000, 200, 90, { act: 'sit', c: '#ff6b6b', cat: 'seat' });
F('sofa_mint', 'sofa', 'Диван мятный', 22000, 200, 90, { act: 'sit', c: '#63e6be', cat: 'seat' });
F('sofa_purple', 'sofa', 'Диван фиолетовый', 24000, 200, 90, { act: 'sit', c: '#b197fc', cat: 'seat' });
F('armchair', 'armchair', 'Кресло', 9000, 96, 92, { act: 'sit', c: '#ffa94d', cat: 'seat' });
F('armchair_blue', 'armchair', 'Синее кресло', 9000, 96, 92, { act: 'sit', c: '#4dabf7', cat: 'seat' });
F('beanbag', 'beanbag', 'Кресло-мешок', 5000, 96, 70, { act: 'sit', c: '#f783ac', cat: 'seat' });
F('chair', 'chair', 'Стул', 2500, 54, 92, { act: 'sit', c: '#d9a066', cat: 'seat' });
F('table', 'table', 'Обеденный стол', 12000, 170, 74, { c: '#d9a066', cat: 'furn' });
F('coffee_table', 'table', 'Журнальный столик', 6000, 110, 48, { c: '#f1e0c5', cat: 'furn' });
F('nightstand', 'nightstand', 'Тумбочка', 4000, 60, 60, { c: '#d9a066', cat: 'furn' });
F('bookshelf', 'bookshelf', 'Книжный шкаф', 15000, 120, 180, { c: '#b9834f', cat: 'furn', act: 'book' });
F('tv', 'tv', 'Телевизор', 60000, 170, 130, { act: 'tv', c: '#343a40', cat: 'fun' });
F('piano', 'piano', 'Пианино', 150000, 170, 120, { act: 'piano', c: '#343a40', cat: 'fun' });
F('wheel', 'wheel', 'Беговое колесо', 20000, 150, 160, { act: 'wheel', c: '#ff6b9d', cat: 'fun' });
F('music', 'music', 'Музыкальная колонка', 15000, 60, 90, { act: 'music', c: '#845ef7', cat: 'fun' });
F('teddy', 'teddy', 'Плюшевый мишка', 3000, 60, 70, { act: 'toy', c: '#c98b5a', cat: 'fun' });
F('aquarium', 'aquarium', 'Аквариум', 45000, 130, 120, { act: 'fish', c: '#74c0fc', cat: 'fun' });
F('fireplace', 'fireplace', 'Камин', 90000, 150, 140, { act: 'fire', c: '#c92a2a', cat: 'furn' });
F('lamp', 'lamp', 'Торшер', 3500, 50, 150, { act: 'lamp', c: '#ffd43b', cat: 'decor' });
F('lamp_pink', 'lamp', 'Розовый торшер', 3500, 50, 150, { act: 'lamp', c: '#ff8fab', cat: 'decor' });
F('plant_ficus', 'plant', 'Фикус', 2000, 70, 130, { act: 'plant', v: 0, c: '#2f9e44', cat: 'decor' });
F('plant_palm', 'plant', 'Пальма в горшке', 4000, 90, 170, { act: 'plant', v: 1, c: '#37b24d', cat: 'decor' });
F('plant_cactus', 'plant', 'Кактус', 1500, 50, 80, { act: 'plant', v: 2, c: '#51cf66', cat: 'decor' });
F('plant_flowers', 'plant', 'Ваза с цветами', 1800, 50, 80, { act: 'plant', v: 3, c: '#ff8fab', cat: 'decor' });
F('rug_pink', 'rug', 'Розовый коврик', 3000, 190, 16, { c: '#ffb3c6', cat: 'decor', layer: 0 });
F('rug_blue', 'rug', 'Голубой коврик', 3000, 190, 16, { c: '#a5d8ff', cat: 'decor', layer: 0 });
F('rug_rainbow', 'rug', 'Радужный коврик', 8000, 210, 16, { c: 'rainbow', cat: 'decor', layer: 0 });
F('balloons', 'balloons', 'Воздушные шарики', 900, 70, 170, { act: 'toy', cat: 'decor' });
F('pic_sun', 'picture', 'Картина «Солнышко»', 5000, 80, 64, { wall: true, v: 0, cat: 'wall' });
F('pic_sea', 'picture', 'Картина «Море»', 5000, 96, 64, { wall: true, v: 1, cat: 'wall' });
F('pic_hamster', 'picture', 'Портрет хомячка', 12000, 64, 80, { wall: true, v: 2, cat: 'wall' });
F('pic_flowers', 'picture', 'Картина «Цветы»', 5000, 64, 64, { wall: true, v: 3, cat: 'wall' });
F('clock', 'clock', 'Настенные часы', 3000, 56, 56, { wall: true, cat: 'wall' });
F('mirror', 'mirror', 'Зеркало', 7000, 64, 96, { wall: true, cat: 'wall', act: 'mirror' });
F('garland', 'garland', 'Гирлянда-огоньки', 2500, 220, 40, { wall: true, cat: 'wall' });
F('shelf', 'shelf', 'Полочка с игрушками', 6000, 110, 50, { wall: true, cat: 'wall' });
F('discoball', 'discoball', 'Диско-шар', 25000, 60, 80, { wall: true, cat: 'wall', act: 'disco' });
// подарки (только за задания)
F('statue', 'statue', 'Золотой хомяк', 0, 80, 130, { shop: 'gift', cat: 'decor', act: 'toy' });
F('throne', 'throne', 'Трон', 0, 110, 170, { shop: 'gift', act: 'sit', cat: 'seat', c: '#e03131' });
F('sunflower', 'plant', 'Гигантский подсолнух', 0, 90, 210, { shop: 'gift', act: 'plant', v: 4, cat: 'decor' });
F('neon', 'neon', 'Неоновая вывеска', 0, 150, 70, { shop: 'gift', wall: true, cat: 'wall' });
F('cup', 'cup', 'Кубок чемпиона', 0, 56, 80, { shop: 'gift', cat: 'decor', act: 'toy' });
F('rocket', 'rocket', 'Игрушечная ракета', 0, 70, 150, { shop: 'gift', cat: 'fun', act: 'toy' });

export const FURNITURE = FU;
export const FURN_BY_ID = Object.fromEntries(FU.map((f) => [f.id, f]));
export const FURN_CATS = [
  { id: 'bed', name: 'Кровати', icon: '🛏️' }, { id: 'seat', name: 'Диваны и кресла', icon: '🛋️' },
  { id: 'furn', name: 'Мебель', icon: '🚪' }, { id: 'fun', name: 'Развлечения', icon: '🎹' },
  { id: 'decor', name: 'Растения и декор', icon: '🪴' }, { id: 'wall', name: 'На стену', icon: '🖼️' },
];

// ====================== ЕДА ======================
// src: shop — ТЦ «Вкусный»; garden — грядки; fish — рыбалка
export const INGREDIENTS = [
  { id: 'flour', name: 'Мука', e: '🌾', price: 60, src: 'shop' },
  { id: 'egg', name: 'Яйца', e: '🥚', price: 90, src: 'shop' },
  { id: 'milk', name: 'Молоко', e: '🥛', price: 80, src: 'shop' },
  { id: 'cheese', name: 'Сыр', e: '🧀', price: 250, src: 'shop' },
  { id: 'butter', name: 'Масло', e: '🧈', price: 150, src: 'shop' },
  { id: 'sugar', name: 'Сахар', e: '🍬', price: 70, src: 'shop' },
  { id: 'choco', name: 'Шоколад', e: '🍫', price: 200, src: 'shop' },
  { id: 'rice', name: 'Рис', e: '🍚', price: 100, src: 'shop' },
  { id: 'nuts', name: 'Орешки', e: '🌰', price: 300, src: 'shop' },
  { id: 'apple', name: 'Яблоко', e: '🍎', price: 50, src: 'shop' },
  { id: 'banana', name: 'Банан', e: '🍌', price: 60, src: 'shop' },
  { id: 'honey', name: 'Мёд', e: '🍯', price: 350, src: 'shop' },
  { id: 'coconut', name: 'Кокос', e: '🥥', price: 450, src: 'shop' },
  // южные фрукты
  { id: 'mango', name: 'Манго', e: '🥭', price: 380, src: 'shop' },
  { id: 'pineapple', name: 'Ананас', e: '🍍', price: 420, src: 'shop' },
  { id: 'kiwi', name: 'Киви', e: '🥝', price: 160, src: 'shop' },
  { id: 'orange', name: 'Апельсин', e: '🍊', price: 90, src: 'shop' },
  { id: 'lemon', name: 'Лимон', e: '🍋', price: 80, src: 'shop' },
  { id: 'peach', name: 'Персик', e: '🍑', price: 140, src: 'shop' },
  { id: 'grapes', name: 'Виноград', e: '🍇', price: 220, src: 'shop' },
  { id: 'melon', name: 'Дыня', e: '🍈', price: 300, src: 'shop' },
  { id: 'avocado', name: 'Авокадо', e: '🥑', price: 260, src: 'shop' },
  { id: 'carrot', name: 'Морковка', e: '🥕', price: 40, src: 'garden' },
  { id: 'strawberry', name: 'Клубника', e: '🍓', price: 120, src: 'garden' },
  { id: 'seeds', name: 'Семечки', e: '🌻', price: 90, src: 'garden' },
  { id: 'tomato', name: 'Помидор', e: '🍅', price: 70, src: 'garden' },
  { id: 'pumpkin', name: 'Тыква', e: '🎃', price: 200, src: 'garden' },
  { id: 'fish', name: 'Рыбка', e: '🐟', price: 400, src: 'fish' },
];
export const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

// Семена: crop — что вырастет, days — сколько ночей растёт, n — урожай с грядки
export const SEEDS = [
  { id: 'seed_carrot', crop: 'carrot', name: 'Семена морковки', days: 1, n: 3, price: 100 },
  { id: 'seed_tomato', crop: 'tomato', name: 'Семена помидоров', days: 2, n: 3, price: 150 },
  { id: 'seed_strawberry', crop: 'strawberry', name: 'Рассада клубники', days: 2, n: 4, price: 250 },
  { id: 'seed_seeds', crop: 'seeds', name: 'Семена подсолнуха', days: 2, n: 3, price: 200 },
  { id: 'seed_pumpkin', crop: 'pumpkin', name: 'Семена тыквы', days: 3, n: 2, price: 300 },
];
export const SEED_BY_ID = Object.fromEntries(SEEDS.map((s) => [s.id, s]));

// Блюда. needs — продукты; start — рецепт известен с начала; cafe — где продают готовое
export const DISHES = [
  { id: 'pancakes', name: 'Блинчики', e: '🥞', needs: { flour: 1, egg: 1, milk: 1 }, start: true },
  { id: 'fruit_salad', name: 'Фруктовый салат', e: '🥗', needs: { apple: 1, banana: 1, strawberry: 1 }, start: true },
  { id: 'cocoa', name: 'Горячий шоколад', e: '☕', needs: { choco: 1, milk: 1 }, start: true, cafe: 'cafe', price: 450 },
  { id: 'carrot_cake', name: 'Морковный торт', e: '🍰', needs: { carrot: 2, flour: 1, egg: 1, sugar: 1 }, start: true },
  { id: 'pizza', name: 'Пицца', e: '🍕', needs: { flour: 1, cheese: 1, tomato: 1 }, start: true, cafe: 'rest', price: 1800 },
  { id: 'fish_soup', name: 'Уха', e: '🍲', needs: { fish: 1, carrot: 1 }, start: true },
  { id: 'cookies', name: 'Ореховое печенье', e: '🍪', needs: { nuts: 1, flour: 1, butter: 1 }, start: true, cafe: 'cafe', price: 600 },
  { id: 'coco_shake', name: 'Кокосовый коктейль', e: '🥤', needs: { coconut: 1, milk: 1, banana: 1 }, start: true, cafe: 'beach', price: 650 },
  { id: 'coco_candy', name: 'Кокосовые конфеты', e: '🍡', needs: { coconut: 1, choco: 1, sugar: 1 }, start: true },
  { id: 'mango_lassi', name: 'Манговый коктейль', e: '🧋', needs: { mango: 1, milk: 1, honey: 1 }, start: true },
  { id: 'tropic_plate', name: 'Тарелка «Тропики»', e: '🍱', needs: { mango: 1, pineapple: 1, kiwi: 1 }, start: true },
  { id: 'orange_juice', name: 'Апельсиновый сок', e: '🧃', needs: { orange: 2 }, start: true },
  { id: 'peach_pie', name: 'Персиковый пирог', e: '🥧', needs: { peach: 2, flour: 1, egg: 1, sugar: 1 } },
  { id: 'grape_jelly', name: 'Виноградное желе', e: '🍮', needs: { grapes: 2, sugar: 1 } },
  { id: 'avocado_toast', name: 'Тост с авокадо', e: '🥪', needs: { avocado: 1, flour: 1, egg: 1 }, start: true },
  { id: 'pineapple_pizza', name: 'Гавайская пицца', e: '🍕', needs: { pineapple: 1, flour: 1, cheese: 1 } },
  { id: 'melon_sorbet', name: 'Дынный сорбет', e: '🍧', needs: { melon: 1, lemon: 1, sugar: 1 } },
  { id: 'icecream', name: 'Клубничное мороженое', e: '🍨', needs: { strawberry: 2, milk: 1, sugar: 1 }, cafe: 'beach', price: 500 },
  { id: 'sushi', name: 'Суши', e: '🍣', needs: { fish: 1, rice: 1 }, cafe: 'rest', price: 2500 },
  { id: 'pumpkin_pie', name: 'Тыквенный пирог', e: '🥧', needs: { pumpkin: 1, flour: 1, egg: 1 } },
  { id: 'choco_cake', name: 'Шоколадный торт', e: '🎂', needs: { choco: 2, flour: 1, egg: 1, sugar: 1 }, cafe: 'cafe', price: 2200 },
  { id: 'kozinaki', name: 'Козинаки', e: '🍘', needs: { seeds: 2, honey: 1 } },
  { id: 'apple_pie', name: 'Яблочный пирог', e: '🥮', needs: { apple: 2, flour: 1, butter: 1, sugar: 1 } },
  { id: 'cheese_plate', name: 'Сырная тарелка', e: '🧀', needs: { cheese: 2, nuts: 1, honey: 1 } },
  // только в кафе
  { id: 'croissant', name: 'Круассан', e: '🥐', cafe: 'cafe', price: 350 },
  { id: 'donut', name: 'Пончик', e: '🍩', cafe: 'cafe', price: 300 },
  { id: 'lemonade', name: 'Лимонад', e: '🍹', needs: { lemon: 2, sugar: 1 }, start: true, cafe: 'beach', price: 400 },
  { id: 'watermelon', name: 'Арбуз', e: '🍉', cafe: 'beach', price: 700 },
  { id: 'burger', name: 'Бургер с морковной котлетой', e: '🍔', cafe: 'rest', price: 1500 },
  { id: 'pasta', name: 'Паста с сыром', e: '🍝', cafe: 'rest', price: 1600 },
];
export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const START_RECIPES = DISHES.filter((d) => d.start).map((d) => d.id);
export const SECRET_RECIPES = DISHES.filter((d) => d.needs && !d.start).map((d) => d.id);

// ====================== ДРУЗЬЯ ======================
const lk = (fur, o = {}) => ({ fur, spots: null, ear: '#ffb3c1', outfit: {}, beauty: { blush: '#ffb0bd' }, ...o });
export const NPCS = [
  {
    id: 'plusha', name: 'Плюша', fem: true, fav: 'pancakes', house: 0, hang: 'park',
    about: 'Добрая и мечтательная. Обожает блинчики.',
    look: lk('#f2b34c', { belly: '#fff3d6', mask: '#fff3d6', outfit: { body: 'dress_mint' }, beauty: { blush: '#ffb0bd', bow: '#ff5c8a', lashes: true } }),
    lines: ['Какие сегодня красивые облака! Вон то похоже на семечку.', 'Я вчера испекла сто блинчиков. И все съела. Ой.', 'Заходи ко мне в гости… хотя нет, лучше я к тебе, у тебя же бассейн!', 'Знаешь, о чём я мечтаю? О блинчике размером с луну.'],
  },
  {
    id: 'ponchik', name: 'Пончик', fem: false, fav: 'pizza', house: 1, hang: 'cafe',
    about: 'Главный обжора города. За пиццу готов на всё.',
    look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'tee_stripe', head: 'cap_blue' } }),
    lines: ['Я не толстый, я пушистый. И немножко пицца.', 'В кафе «Семечка» новые пончики. Я проверил шесть раз.', 'Говорят, у тебя на кухне огромная плита? Уважаю.', 'Мой рекорд — тридцать семечек за одну щёку!'],
  },
  {
    id: 'senya', name: 'Сеня', fem: false, fav: 'fish_soup', house: 2, hang: 'pool',
    about: 'Чемпион по плаванию. Любит уху и соревнования.',
    look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'tee_star', legs: 'shorts_red', acc: 'medal' }, beauty: { tuft: 1, hair: '#868e96', blush: '#ffb0bd' } }),
    lines: ['Раз-два, раз-два! Тренируюсь даже во сне.', 'Приходи в бассейн, посмотрим, кто быстрее!', 'Секрет чемпиона: много спать и много плавать.', 'Я переплыл бы море, но мама зовёт обедать.'],
  },
  {
    id: 'busya', name: 'Буся', fem: true, fav: 'icecream', house: 3, hang: 'mall',
    about: 'Модница. Знает всё о нарядах и обожает мороженое.',
    look: lk('#f6dfb8', { belly: '#fffaf0', outfit: { body: 'dress_stars', head: 'sunhat', acc: 'bag_pink', feet: 'sand_pink' }, beauty: { lashes: true, blush: '#ff6b9d', nails: '#e64980' } }),
    lines: ['Шляпа — это не просто шляпа. Это настроение!', 'В Доме моды сегодня показ. Ты ведь придёшь?', 'Розовый с жёлтым? Смело. Мне нравится!', 'У меня сорок платьев. Нужно ещё хотя бы одно.'],
  },
  {
    id: 'prof', name: 'Профессор Орешкин', fem: false, fav: 'cookies', house: 4, hang: 'school',
    about: 'Учитель. Знает ответ на любой вопрос, кроме «где мои очки».',
    look: lk('#a8703f', { belly: '#f6dfb8', mask: '#f6dfb8', outfit: { body: 'sw_cream', acc: 'glasses_black', head: 'tophat' } }),
    lines: ['А ты знала, что хомяки могут бежать всю ночь? Я вот не могу.', 'Дважды два — четыре. А дважды орешек — два орешка!', 'Детям в школе очень нужна хорошая учительница.', 'Где же мои очки?.. Ах, на носу.'],
  },
  {
    id: 'myata', name: 'Мята', fem: true, fav: 'carrot_cake', house: 5, hang: 'park',
    about: 'Садовница. Разговаривает с цветами, и они ей отвечают.',
    look: lk('#d8d2c4', { belly: '#fff', outfit: { body: 'sw_green', head: 'wreath' }, beauty: { blush: '#ffa94d', lashes: true } }),
    lines: ['Морковка любит, когда ей поют. Проверено!', 'Посади что-нибудь на своих грядках — и через пару дней будет урожай.', 'Клубника растёт два дня, тыква — целых три.', 'Тс-с… слышишь? Это ромашки шепчутся.'],
  },
  {
    id: 'bob', name: 'Капитан Боб', fem: false, fav: 'sushi', house: 6, hang: 'pier',
    about: 'Старый моряк. Рыбачит на пирсе и рассказывает истории.',
    look: lk('#7a5230', { belly: '#e6c9a8', mask: '#e6c9a8', outfit: { body: 'tee_stripe', head: 'cap_red', acc: 'scarf_blue' } }),
    lines: ['Однажды я поймал рыбу размером с небоскрёб. Честное моряцкое!', 'Рыба лучше всего клюёт с конца пирса. И в твоём пруду тоже.', 'Йо-хо-хо и корзинка семечек!', 'Море сегодня доброе. Как я после обеда.'],
  },
  {
    id: 'zefirka', name: 'Зефирка', fem: true, fav: 'choco_cake', house: 7, hang: 'beach',
    about: 'Самая маленькая в городе. Всё время задаёт вопросы.',
    look: lk('#fff0f6', { belly: '#fff', outfit: { body: 'tee_dots', legs: 'skirt_blue' }, beauty: { blush: '#ff6b9d', bow: '#b197fc', tuft: 4, hair: '#faa2c1' } }),
    small: true,
    lines: ['А почему море солёное? А небо синее? А ты пятнистая?', 'Когда я вырасту, у меня тоже будет вилла! И пони!', 'Я умею считать до ста. Один, два, сто!', 'А правда, что у тебя миллиард? А это больше, чем сто?'],
  },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// Что говорят друзья про погоду и одежду
export const SEASON_LINES = {
  winter: ['Бр-р, ну и морозец! Зато снежок хрустит.', 'Пруд у тебя во дворе замёрз? По нему можно кататься!'],
  spring: ['Весна! Всё цветёт, даже мой хвостик.', 'Слышишь? Птички вернулись.'],
  summer: ['Жарко! Самое время купаться в море.', 'Летом мороженое тает быстрее, чем я его ем.'],
  autumn: ['Листья шуршат — обожаю осень!', 'Осенью главное — резиновые сапожки и лужи.'],
};
export const OUTFIT_LINES = {
  cold: ['Ты не замёрзла? Зима же! Надень куртку и шапку.', 'Бр-р! В таком наряде зимой? Смелая!'],
  hot: ['Тебе не жарко в куртке? Лето на дворе!', 'Ух, в такой одежде летом можно растаять!'],
  swim: ['Ого, прямо в купальнике по городу? Стильно!'],
  fancy: ['Какой наряд! Ты сегодня просто звезда!', 'Вот это красота! Можно с тобой сфотографироваться?'],
};

// Продавцы (внешность)
export const VENDORS = {
  mall: { name: 'Продавщица Лапка', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'dress_red', acc: 'neck_pearl' }, beauty: { lashes: true, blush: '#ff6b9d', tuft: 2, hair: '#a8703f' } }) },
  home: { name: 'Мастер Винтик', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'sw_orange', head: 'cap_yellow' } }) },
  food: { name: 'Тётушка Крупа', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'dress_check' }, beauty: { blush: '#ff6b9d', tuft: 3, hair: '#f6dfb8' } }) },
  boutique: { name: 'Мадам Жужу', look: lk('#fff', { spots: '#b197fc', outfit: { body: 'dress_evening', head: 'tophat', acc: 'neck_heart' }, beauty: { lashes: true, blush: '#ff6b9d', nails: '#e64980' } }) },
  salon: { name: 'Стилист Кудряш', look: lk('#f2b34c', { belly: '#fff3d6', outfit: { body: 'js_lilac', acc: 'glasses_red' }, beauty: { tuft: 3, hair: '#ff6b9d', blush: '#ffb0bd' } }) },
  cafe: { name: 'Бариста Зёрнышко', look: lk('#a8703f', { belly: '#f6dfb8', outfit: { body: 'tee_orange', acc: 'bowtie' } }) },
  rest: { name: 'Шеф Трюфель', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'robe' }, beauty: { blush: '#ffa94d' } }) },
  beach: { name: 'Спасатель Волна', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'swim_blue', acc: 'sung_yellow', head: 'panama_white' } }) },
  pool: { name: 'Тренер Брызг', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'tee_sun', legs: 'shorts_red', head: 'cap_red' } }) },
  school: { name: 'Директор Буковка', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'sw_pink', acc: 'glasses_red' }, beauty: { blush: '#ffb0bd', tuft: 3, hair: '#868e96', lashes: true } }) },
  hospital: { name: 'Медсестра Ромашка', look: lk('#fff', { outfit: { body: 'robe', head: 'panama_white' }, beauty: { blush: '#ffb0bd', lashes: true } }) },
  fashion: { name: 'Модельер Пуговка', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'dress_evening', acc: 'sung_pink', head: 'sunhat' }, beauty: { blush: '#ff6b9d', lashes: true, nails: '#845ef7' } }) },
  tower: { name: 'Лифтёр Этажкин', look: lk('#a8703f', { belly: '#f6dfb8', outfit: { body: 'ja_wine', head: 'cap_blue' } }) },
  bank: { name: 'Банкир Монеткин', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'pajama', acc: 'bowtie', head: 'tophat' } }) },
};

// ====================== МЕСТА ГОРОДА ======================
export const PLACES = {
  mall_fashion: 'ТЦ «Модный»', mall_home: 'ТЦ «Уютный дом»', mall_food: 'ТЦ «Вкусный»',
  boutique: 'Бутик «Бантик»', salon: 'Салон красоты', pool: 'Городской бассейн', school: 'Школа',
  hospital: 'Больница', rest: 'Ресторан «Золотой орешек»', cafe: 'Кафе «Семечка»', beachcafe: 'Пляжное кафе',
  fashion: 'Дом моды', tower: 'Хомяк-Тауэр', bank: 'Хомяк-Банк', pier: 'Пирс', villa: 'Вилла',
};

// ====================== ЗАДАНИЯ ======================
// type: minigame | buy | cook | treat | collect | harvest | plant | salon | place | visit | talk | swim | spa | wheel | gift
export const TASKS = [
  { id: 'swim', type: 'minigame', game: 'swim', sticker: '🏊', title: 'Соревнования по плаванию', where: 'pool',
    text: 'Сегодня в городском бассейне большой заплыв! Приходи и покажи, как плавают хомячки с виллы.' },
  { id: 'teacher', type: 'minigame', game: 'teacher', sticker: '👩‍🏫', title: 'Учительница на день', where: 'school',
    text: 'Профессор Орешкин потерял очки и не может проверить тетрадки. Замени его в школе на один урок!' },
  { id: 'doctor', type: 'minigame', game: 'doctor', sticker: '🩺', title: 'Доктор Хомяк', where: 'hospital',
    text: 'В больнице очередь из пациентов, а доктор уехал в отпуск. Помоги вылечить всех!' },
  { id: 'chef', type: 'minigame', game: 'chef', sticker: '👩‍🍳', title: 'Шеф-повар', where: 'rest',
    text: 'В ресторане «Золотой орешек» аншлаг! Шеф Трюфель зовёт тебя на кухню — готовить по заказам.' },
  { id: 'fashion', type: 'minigame', game: 'fashion', sticker: '👠', title: 'Показ мод', where: 'fashion',
    text: 'Дом моды приглашает тебя на подиум! Оденься по теме показа и удиви жюри.' },
  { id: 'fish', type: 'minigame', game: 'fishing', sticker: '🎣', title: 'Большая рыбалка', where: 'pier',
    text: 'Капитан Боб говорит, что сегодня отличный клёв. Поймай рыбку с пирса или в своём пруду!' },
  { id: 'shells', type: 'collect', what: 'shell', n: 5, sticker: '🐚', title: 'Ракушки для коллекции', where: 'beach', seasons: ['spring', 'summer', 'autumn'],
    text: 'Море выбросило на пляж красивые ракушки. Собери 5 штук, пока их не унесло волной!' },
  { id: 'snow', type: 'collect', what: 'snowflake', n: 6, sticker: '❄️', title: 'Волшебные снежинки', where: 'town', seasons: ['winter'],
    text: 'Ночью в город упали волшебные снежинки, которые не тают. Найди и собери 6 штук!' },
  { id: 'leaves', type: 'collect', what: 'leaf', n: 6, sticker: '🍁', title: 'Осенний букет', where: 'town', seasons: ['autumn'],
    text: 'В городе самые красивые кленовые листья. Собери 6 штук для осеннего букета!' },
  { id: 'flowers', type: 'collect', what: 'flower', n: 6, sticker: '🌷', title: 'Первые цветы', where: 'town', seasons: ['spring'],
    text: 'Расцвели первые тюльпаны! Собери 6 цветков по всему городу.' },
  { id: 'sea', type: 'swim', sticker: '🌊', title: 'Купание в море', where: 'beach', seasons: ['summer'],
    text: 'Такая жара! Надень купальник и окунись в море у пляжа.' },
  { id: 'skate', type: 'skate', sticker: '⛸️', title: 'Каток во дворе', where: 'villa', seasons: ['winter'],
    text: 'Пруд у тебя во дворе замёрз и стал катком. Прокатись по льду!' },
  { id: 'cook', type: 'cook', sticker: '🍳', title: 'Кулинарный день', where: 'villa',
    text: 'Сегодня день вкусняшек! Купи продукты в ТЦ «Вкусный» и приготовь любое блюдо на своей кухне.' },
  { id: 'treat', type: 'treat', sticker: '🫖', title: 'Гости на пороге', where: 'villa',
    text: 'Позови кого-нибудь в гости (кнопка 📱) и угости чем-нибудь вкусным из холодильника.' },
  { id: 'plant', type: 'plant', sticker: '🌱', title: 'Садовница', where: 'villa',
    text: 'Грядки скучают! Купи семена в ТЦ «Уютный дом» и посади что-нибудь у себя во дворе.' },
  { id: 'harvest', type: 'harvest', sticker: '🥕', title: 'Урожай', where: 'villa', needsCrop: true,
    text: 'На грядках что-то выросло. Собери урожай!' },
  { id: 'buy_clothes', type: 'buy', cat: 'clothes', sticker: '🛍️', title: 'Обновка', where: 'mall_fashion',
    text: 'В магазины привезли новые наряды. Купи себе любую обновку!' },
  { id: 'buy_furn', type: 'place', sticker: '🛋️', title: 'Уют на вилле', where: 'mall_home',
    text: 'Вилле нужно что-то новенькое. Купи мебель или украшение в ТЦ «Уютный дом» и поставь у себя дома.' },
  { id: 'salon', type: 'salon', sticker: '💅', title: 'День красоты', where: 'salon',
    text: 'Стилист Кудряш придумал новые причёски. Загляни в салон красоты и поменяй что-нибудь!' },
  { id: 'tower', type: 'visit', place: 'tower', sticker: '🏙️', title: 'Выше облаков', where: 'tower',
    text: 'С крыши небоскрёба «Хомяк-Тауэр» видно весь город и море. Поднимись на смотровую площадку!' },
  { id: 'talk', type: 'talk', n: 3, sticker: '💬', title: 'Привет, соседи!', where: 'town',
    text: 'Давно не болтала с друзьями? Найди в городе трёх хомячков и поговори с каждым.' },
  { id: 'spa', type: 'spa', sticker: '🧖', title: 'Спа-день', where: 'villa',
    text: 'Сегодня отдыхаем! Попарься в сауне, посиди в джакузи и прими ванну с пеной.' },
  { id: 'wheel', type: 'wheel', sticker: '🎡', title: 'Беги, хомячок, беги!', where: 'villa',
    text: 'Настоящий хомячок должен бегать в колесе! Пробеги круг-другой в беговом колесе на вилле.' },
  { id: 'gift', type: 'gift', sticker: '🎁', title: 'Подарок другу', where: 'town',
    text: 'Сделай кому-нибудь приятное: найди друга в городе и подари ему любую вкусняшку.' },
  { id: 'feedfish', type: 'feed', sticker: '🐠', title: 'Обед для рыбок', where: 'beach',
    text: 'Рыбки проголодались! Заплыви в море и нажми на стайку рыбок, чтобы угостить их крошками. А можно покормить рыбок в аквариуме дома.' },
  { id: 'piano', type: 'piano', sticker: '🎼', title: 'Маленький концерт', where: 'villa',
    text: 'Друзья просят концерт! Сядь за пианино на вилле, выбери «Выучить песенку» и сыграй её до конца по зелёным клавишам.' },
  { id: 'boat', type: 'boat', sticker: '🚤', title: 'Морская прогулка', where: 'pier',
    text: 'У конца пирса тебя ждёт кораблик. Сядь на него и прокатись по морю — можно даже заплыть за буйки!' },
  { id: 'pearl', type: 'pearl', sticker: '🦪', title: 'Жемчужина со дна', where: 'beach',
    text: 'На морском дне лежат раковины с жемчугом. Заплыви туда, где глубоко, нажми 🤿 «Нырнуть» и найди на дне хотя бы одну жемчужину!' },
  { id: 'coconut', type: 'coconut', sticker: '🥥', title: 'Кокосовый день', where: 'beach',
    text: 'На пальмах созрели кокосы! Подойди к любой пальме и потряси её — кокос упадёт прямо в рюкзак.' },
  { id: 'cafe', type: 'buy', cat: 'dish', sticker: '🧁', title: 'Сладкий день', where: 'cafe',
    text: 'В кафе «Семечка» сегодня пахнет особенно вкусно. Купи себе что-нибудь и съешь!' },
];
export const TASK_BY_ID = Object.fromEntries(TASKS.map((t) => [t.id, t]));

// Особые наклейки (не за задания)
export const EXTRA_STICKERS = [
  { id: 'x_first', sticker: '🏡', title: 'Новоселье' },
  { id: 'x_3stars', sticker: '🌟', title: 'Три звезды!' },
  { id: 'x_friend', sticker: '💖', title: 'Лучшие друзья' },
  { id: 'x_master', sticker: '🏅', title: 'Шедевр на кухне' },
  { id: 'x_year', sticker: '🎆', title: 'Целый год!' },
  { id: 'x_rich', sticker: '💰', title: 'Потратила миллион' },
  { id: 'x_island', sticker: '🏝️', title: 'Необитаемый остров' },
  { id: 'x_isles', sticker: '🧭', title: 'Все острова открыты' },
  { id: 'x_feed', sticker: '🐟', title: 'Друг рыбок' },
  { id: 'x_piano', sticker: '🎹', title: 'Пианистка' },
  { id: 'x_boat', sticker: '⛵', title: 'Капитан' },
  { id: 'x_far', sticker: '🌅', title: 'За буйками' },
  { id: 'x_dive', sticker: '🤿', title: 'Первое погружение' },
  { id: 'x_pearl', sticker: '⚪', title: 'Ловец жемчуга' },
  { id: 'x_treasure', sticker: '👑', title: 'Сокровище корабля' },
  { id: 'x_whale', sticker: '🐋', title: 'Встреча с китом' },
  { id: 'x_tower', sticker: '🛗', title: 'На 101-й этаж!' },
  { id: 'x_ace', sticker: '🎯', title: 'Меткий пилот' },
];

// Темы показа мод: какие теги одежды ценит жюри
export const FASHION_THEMES = [
  { id: 'winter', name: 'Зимняя сказка', tags: ['warm', 'winter'], hint: 'Тёплая куртка, шапка, шарф, зимняя обувь' },
  { id: 'beach', name: 'Пляжная вечеринка', tags: ['beach', 'swim', 'summer'], hint: 'Купальник, панамка, очки от солнца, сандалии' },
  { id: 'ball', name: 'Королевский бал', tags: ['fancy'], hint: 'Самое нарядное платье, украшения, шляпа или корона' },
  { id: 'sport', name: 'Спортивный день', tags: ['sport'], hint: 'Майка, шорты, кеды, кепка' },
  { id: 'rain', name: 'Прогулка под дождём', tags: ['rain', 'autumn'], hint: 'Куртка-дождевик, резиновые сапожки, джинсы' },
  { id: 'home', name: 'Пижамная вечеринка', tags: ['home'], hint: 'Пижама или халат, тапочки' },
  { id: 'cute', name: 'Самая милая', tags: ['cute'], hint: 'Всё самое милое: горошек, бантики, юбочки' },
  { id: 'spring', name: 'Весенняя прогулка', tags: ['spring'], hint: 'Лёгкая куртка, юбка или джинсы, кеды' },
];

// ---------- помощники ----------
/** Превратить сохранённую внешность (с id вещей) в готовую для рисования (с объектами вещей). */
export function resolveLook(look) {
  const outfit = {};
  for (const k of ['head', 'body', 'legs', 'feet', 'acc']) {
    const v = look.outfit && look.outfit[k];
    outfit[k] = typeof v === 'string' ? CLOTHES_BY_ID[v] || null : v || null;
  }
  return { ...look, outfit };
}
const _npcLooks = {};
export function npcLook(id) {
  if (!_npcLooks[id]) _npcLooks[id] = resolveLook(NPC_BY_ID[id].look);
  return _npcLooks[id];
}
export function vendorLook(id) {
  const k = 'v_' + id;
  if (!_npcLooks[k]) _npcLooks[k] = resolveLook(VENDORS[id].look);
  return _npcLooks[k];
}

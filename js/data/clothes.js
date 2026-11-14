// Одежда: слоты, каталог вещей, стартовый гардероб.
// slot: head | body | legs | feet | acc
// shop: start (уже есть) | mall | boutique | beach | market (вещицы с рынка) | gift (только в подарок)
// Цены — в таблице PRICES.clothes (economy.js); у стартовых вещей и подарков цены нет (0).
import { PRICES } from './economy.js';
export const SLOTS = [
  { id: 'head', name: 'Голова', icon: '👒' },
  { id: 'body', name: 'Верх и платья', icon: '👗' },
  { id: 'legs', name: 'Низ', icon: '🩳' },
  { id: 'feet', name: 'Обувь', icon: '👟' },
  { id: 'acc', name: 'Аксессуары', icon: '👓' },
];

const CL = [];
function C(id, slot, kind, name, c, o = {}) {
  CL.push({ id, slot, kind, name, price: PRICES.clothes[id] || 0, c, shop: 'mall', tags: [], ...o });
}
// --- майки
C('tee_heart', 'body', 'tee', 'Майка с сердечком', '#ff6b9d', { print: 'heart', shop: 'start', tags: ['summer', 'sport', 'cute'] });
C('tee_sun', 'body', 'tee', 'Майка с солнышком', '#74c0fc', { print: 'sun', tags: ['summer', 'sport', 'beach'] });
C('tee_stripe', 'body', 'tee', 'Майка-тельняшка', '#ffffff', { pattern: 'stripes', c2: '#1c7ed6', tags: ['summer', 'sport', 'beach'] });
C('tee_dots', 'body', 'tee', 'Майка в горошек', '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'cute'] });
C('tee_star', 'body', 'tee', 'Майка со звездой', '#845ef7', { print: 'star', tags: ['summer', 'sport'] });
C('tee_orange', 'body', 'tee', 'Апельсиновая майка', '#ff922b', { tags: ['summer', 'sport'] });
// --- платья
C('dress_lilac', 'body', 'dress', 'Сиреневое платье в горошек', '#c77dff', { pattern: 'dots', c2: '#fff', shop: 'start', tags: ['summer', 'cute', 'fancy'] });
C('dress_red', 'body', 'dress', 'Красное платье', '#f03e3e', { c2: '#fff', tags: ['fancy', 'cute'] });
C('dress_check', 'body', 'dress', 'Платье в клетку', '#ffd43b', { pattern: 'check', c2: '#f08c00', tags: ['cute', 'autumn'] });
C('dress_sea', 'body', 'dress', 'Морское платье', '#ffffff', { pattern: 'stripes', c2: '#339af0', tags: ['summer', 'beach', 'cute'] });
C('dress_stars', 'body', 'dress', 'Звёздное платье', '#3b5bdb', { pattern: 'stars', c2: '#ffe066', tags: ['fancy'] });
C('dress_mint', 'body', 'dress', 'Мятное платье', '#63e6be', { pattern: 'dots', c2: '#fff', tags: ['summer', 'spring', 'cute'] });
C('dress_sleeve', 'body', 'dress', 'Тёплое платье с рукавами', '#e8590c', { sleeves: 'long', pattern: 'check', c2: '#ffd8a8', tags: ['autumn', 'warm', 'cute'] });
C('dress_evening', 'body', 'dress', 'Вечернее платье', '#212529', { pattern: 'stars', c2: '#ffd43b', shop: 'boutique', tags: ['fancy'] });
C('dress_daisy', 'body', 'dress', 'Платье «Ромашка»', '#fff9db', { pattern: 'dots', c2: '#fcc419', shop: 'boutique', tags: ['fancy', 'summer', 'spring', 'cute'] });
C('princess_pink', 'body', 'princess', 'Платье принцессы', '#ffa8d9', { shop: 'boutique', tags: ['fancy'] });
C('princess_gold', 'body', 'princess', 'Золотое бальное платье', '#ffd43b', { shop: 'boutique', tags: ['fancy'] });
C('princess_fairy', 'body', 'princess', 'Платье феи', '#a5d8ff', { shop: 'gift', tags: ['fancy'] });
// --- кофты
C('sw_orange', 'body', 'sweater', 'Полосатая кофта', '#ff922b', { pattern: 'stripes', c2: '#fff4e6', tags: ['warm', 'autumn', 'home'] });
C('sw_pink', 'body', 'sweater', 'Розовая кофта', '#faa2c1', { tags: ['warm', 'spring', 'cute', 'home'] });
C('sw_green', 'body', 'sweater', 'Зелёная кофта со звёздами', '#2f9e44', { pattern: 'stars', c2: '#fff', tags: ['warm', 'winter'] });
C('sw_cream', 'body', 'sweater', 'Уютная бежевая кофта', '#f1e0c5', { tags: ['warm', 'autumn', 'home'] });
// --- куртки
C('jw_blue', 'body', 'jacketW', 'Зимняя куртка голубая', '#4dabf7', { shop: 'start', season: 'winter', tags: ['warm', 'winter'] });
C('jw_red', 'body', 'jacketW', 'Зимняя куртка красная', '#f03e3e', { season: 'winter', tags: ['warm', 'winter'] });
C('jw_pink', 'body', 'jacketW', 'Зимняя куртка розовая', '#f783ac', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('jw_white', 'body', 'jacketW', 'Белоснежный пуховик', '#f8f9fa', { c2: '#d0bfff', season: 'winter', tags: ['warm', 'winter', 'fancy'] });
C('ja_yellow', 'body', 'jacketA', 'Осенняя куртка-дождевик', '#ffd43b', { season: 'autumn', tags: ['autumn', 'rain'] });
C('ja_orange', 'body', 'jacketA', 'Осенняя куртка рыжая', '#e8590c', { season: 'autumn', tags: ['autumn', 'rain', 'warm'] });
C('ja_wine', 'body', 'jacketA', 'Осенняя куртка вишнёвая', '#a61e4d', { c2: '#ffd43b', season: 'autumn', tags: ['autumn', 'rain', 'warm'] });
C('js_mint', 'body', 'jacketS', 'Весенняя куртка мятная', '#63e6be', { c2: '#fff', season: 'spring', tags: ['spring', 'rain', 'sport'] });
C('js_lilac', 'body', 'jacketS', 'Весенняя куртка сиреневая', '#b197fc', { c2: '#fff', season: 'spring', tags: ['spring', 'cute'] });
C('js_pink', 'body', 'jacketS', 'Весенняя куртка розовая', '#ff8fab', { c2: '#ffe066', season: 'spring', tags: ['spring', 'cute'] });
// --- купальники, пижама, халат
C('swim_pink', 'body', 'swim', 'Купальник в горошек', '#ff5c8a', { pattern: 'dots', c2: '#fff', shop: 'start', tags: ['beach', 'summer', 'swim'] });
C('swim_blue', 'body', 'swim', 'Полосатый купальник', '#339af0', { pattern: 'stripes', c2: '#fff', tags: ['beach', 'summer', 'swim', 'sport'] });
C('swim_yellow', 'body', 'swim', 'Солнечный купальник', '#ffd43b', { tags: ['beach', 'summer', 'swim'] });
C('swim_star', 'body', 'swim', 'Звёздный купальник', '#20c997', { pattern: 'stars', c2: '#fff', shop: 'beach', tags: ['beach', 'summer', 'swim'] });
C('pajama', 'body', 'pajama', 'Пижама со звёздами', '#b197fc', { pattern: 'stars', c2: '#fff', shop: 'start', tags: ['home'] });
C('pajama_pink', 'body', 'pajama', 'Пижама-зефирка', '#ffc9de', { pattern: 'dots', c2: '#fff', tags: ['home', 'cute'] });
C('robe', 'body', 'robe', 'Пушистый халат', '#74c0fc', { shop: 'boutique', tags: ['home'] });
// --- низ
C('shorts_jeans', 'legs', 'shorts', 'Джинсовые шорты', '#4dabf7', { shop: 'start', tags: ['summer', 'sport', 'beach'] });
C('shorts_red', 'legs', 'shorts', 'Красные шорты', '#f03e3e', { tags: ['summer', 'sport'] });
C('shorts_dots', 'legs', 'shorts', 'Шорты в горошек', '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'cute', 'beach'] });
C('shorts_star', 'legs', 'shorts', 'Шорты со звёздами', '#845ef7', { pattern: 'stars', c2: '#ffe066', tags: ['summer', 'sport'] });
C('skirt_check', 'legs', 'skirt', 'Юбка в клетку', '#ff8fab', { pattern: 'check', c2: '#c2255c', tags: ['cute', 'spring', 'autumn'] });
C('skirt_blue', 'legs', 'skirt', 'Голубая юбочка', '#74c0fc', { tags: ['cute', 'summer', 'spring'] });
C('skirt_dots', 'legs', 'skirt', 'Юбка в горошек', '#ffd43b', { pattern: 'dots', c2: '#fff', tags: ['cute', 'summer'] });
C('pants_jeans', 'legs', 'pants', 'Джинсы', '#1c7ed6', { shop: 'start', tags: ['warm', 'autumn', 'spring', 'winter', 'rain'] });
C('pants_grey', 'legs', 'pants', 'Тёплые штаны', '#868e96', { tags: ['warm', 'winter', 'home'] });
C('pants_black', 'legs', 'pants', 'Чёрные брючки', '#343a40', { tags: ['fancy', 'warm', 'autumn'] });
// --- обувь
C('sn_red', 'feet', 'sneakers', 'Красные кеды', '#ff6b6b', { shop: 'start', tags: ['sport', 'summer', 'spring'] });
C('sn_white', 'feet', 'sneakers', 'Белые кроссовки', '#f1f3f5', { tags: ['sport', 'summer', 'spring'] });
C('sn_mint', 'feet', 'sneakers', 'Мятные кеды', '#63e6be', { tags: ['sport', 'cute', 'spring'] });
C('boots_brown', 'feet', 'boots', 'Коричневые ботинки', '#8d5524', { shop: 'start', tags: ['warm', 'autumn', 'winter'] });
C('boots_black', 'feet', 'boots', 'Чёрные ботинки', '#343a40', { tags: ['warm', 'autumn', 'fancy'] });
C('ugg_beige', 'feet', 'wboots', 'Угги', '#d9a066', { season: 'winter', tags: ['warm', 'winter', 'home'] });
C('ugg_pink', 'feet', 'wboots', 'Розовые угги', '#f783ac', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('rain_red', 'feet', 'rainboots', 'Красные резиновые сапожки', '#e03131', { tags: ['rain', 'autumn', 'spring'] });
C('rain_yellow', 'feet', 'rainboots', 'Жёлтые резиновые сапожки', '#fcc419', { tags: ['rain', 'autumn', 'spring'] });
C('sand_yellow', 'feet', 'sandals', 'Жёлтые сандалии', '#fcc419', { tags: ['summer', 'beach', 'cute'] });
C('sand_pink', 'feet', 'sandals', 'Розовые сандалии', '#ff6b9d', { tags: ['summer', 'beach', 'fancy', 'cute'] });
C('flippers', 'feet', 'flippers', 'Ласты', '#20c997', { shop: 'beach', tags: ['beach', 'swim'] });
C('slippers', 'feet', 'slippers', 'Домашние тапочки', '#ffc9de', { shop: 'start', tags: ['home'] });
C('shoes_gold', 'feet', 'sandals', 'Золотые туфельки', '#ffd43b', { c2: '#ff6b9d', shop: 'boutique', tags: ['fancy'] });
// --- голова
C('cap_yellow', 'head', 'cap', 'Жёлтая кепка', '#ffd43b', { tags: ['sport', 'summer'] });
C('cap_red', 'head', 'cap', 'Кепка со звездой', '#f03e3e', { print: 'star', tags: ['sport', 'summer', 'spring'] });
C('cap_blue', 'head', 'cap', 'Синяя кепка', '#339af0', { tags: ['sport', 'summer', 'spring'] });
C('panama_green', 'head', 'panama', 'Панамка в горошек', '#69db7c', { pattern: 'dots', c2: '#fff', tags: ['summer', 'beach', 'cute'] });
C('panama_white', 'head', 'panama', 'Белая панамка', '#f8f9fa', { c2: '#74c0fc', tags: ['summer', 'beach'] });
C('panama_pink', 'head', 'panama', 'Розовая панамка', '#ff8fab', { pattern: 'stripes', c2: '#fff', tags: ['summer', 'beach', 'cute'] });
C('sunhat', 'head', 'sunhat', 'Соломенная шляпа', '#ffe8a1', { c2: '#ff6b9d', tags: ['summer', 'beach', 'fancy'] });
C('sunhat_blue', 'head', 'sunhat', 'Шляпа с голубой лентой', '#fff3bf', { c2: '#4dabf7', shop: 'beach', tags: ['summer', 'beach', 'fancy'] });
C('beanie_red', 'head', 'beanie', 'Шапка с помпоном', '#ff6b6b', { pattern: 'stripes', c2: '#fff', shop: 'start', season: 'winter', tags: ['warm', 'winter'] });
C('beanie_blue', 'head', 'beanie', 'Синяя шапка', '#4c6ef5', { season: 'winter', tags: ['warm', 'winter', 'sport'] });
C('beanie_pink', 'head', 'beanie', 'Розовая шапка в горошек', '#f783ac', { pattern: 'dots', c2: '#fff', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('earmuffs', 'head', 'earmuffs', 'Меховые наушники', '#ffc9de', { season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('tophat', 'head', 'tophat', 'Цилиндр', '#343a40', { c2: '#e03131', shop: 'boutique', tags: ['fancy'] });
C('crown', 'head', 'crown', 'Корона', '#ffd43b', { shop: 'boutique', tags: ['fancy'] });
C('wreath', 'head', 'wreath', 'Венок из цветов', '#fff', { shop: 'gift', tags: ['fancy', 'spring', 'summer', 'cute'] });
// --- аксессуары
C('glasses_red', 'acc', 'glasses', 'Красные очки', '#e03131', { tags: ['cute'] });
C('glasses_black', 'acc', 'glasses', 'Умные очки', '#343a40', { tags: ['fancy'] });
C('sung_yellow', 'acc', 'sunglasses', 'Солнечные очки', '#ffd43b', { tags: ['summer', 'beach', 'sport'] });
C('sung_pink', 'acc', 'sunglasses', 'Розовые тёмные очки', '#ff6b9d', { shop: 'beach', tags: ['summer', 'beach', 'cute'] });
C('scarf_yellow', 'acc', 'scarf', 'Полосатый шарф', '#ffd43b', { c2: '#ff6b6b', shop: 'start', season: 'winter', tags: ['warm', 'winter', 'autumn'] });
C('scarf_blue', 'acc', 'scarf', 'Голубой шарф', '#74c0fc', { c2: '#fff', season: 'winter', tags: ['warm', 'winter', 'autumn'] });
C('scarf_pink', 'acc', 'scarf', 'Розовый шарф', '#faa2c1', { c2: '#c2255c', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('neck_heart', 'acc', 'necklace', 'Кулон-сердечко', '#ffd43b', { pendant: 'heart', shop: 'boutique', tags: ['fancy', 'cute'] });
C('neck_pearl', 'acc', 'necklace', 'Жемчужные бусы', '#fff5f5', { shop: 'boutique', tags: ['fancy'] });
C('bag_pink', 'acc', 'bag', 'Розовая сумочка', '#e64980', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('bag_yellow', 'acc', 'bag', 'Жёлтая сумочка', '#fcc419', { tags: ['cute', 'summer'] });
C('bowtie', 'acc', 'bowtie', 'Бабочка', '#e03131', { c2: '#fff', shop: 'boutique', tags: ['fancy'] });
C('backpack', 'acc', 'backpack', 'Рюкзачок', '#4dabf7', { tags: ['sport', 'spring', 'autumn'] });
C('wings', 'acc', 'wings', 'Крылышки феи', '#d0ebff', { shop: 'gift', tags: ['fancy'] });
C('medal', 'acc', 'medal', 'Золотая медаль', '#ffd43b', { shop: 'gift', tags: ['sport'] });

// --- новая коллекция
C('tee_hawaii', 'body', 'tee', 'Гавайская рубашка', '#ff922b', { pattern: 'flowers', c2: '#fff', shop: 'beach', tags: ['summer', 'beach', 'cute'] });
C('tee_hawaii_blue', 'body', 'tee', 'Рубашка «Лагуна»', '#15aabf', { pattern: 'flowers', c2: '#fff3bf', shop: 'beach', tags: ['summer', 'beach'] });
C('dress_flowers', 'body', 'dress', 'Цветочное платье', '#f783ac', { pattern: 'flowers', c2: '#fff', tags: ['spring', 'summer', 'cute', 'fancy'] });
C('overall_jeans', 'body', 'overall', 'Джинсовый комбинезон', '#4c6ef5', { c2: '#fff', tags: ['spring', 'autumn', 'sport', 'cute'] });
C('overall_red', 'body', 'overall', 'Красный комбинезон', '#f03e3e', { c2: '#ffe066', tags: ['spring', 'autumn', 'cute'] });
C('hoodie_grey', 'body', 'hoodie', 'Серое худи', '#adb5bd', { tags: ['warm', 'sport', 'autumn', 'spring', 'home'] });
C('hoodie_violet', 'body', 'hoodie', 'Худи со звёздами', '#7950f2', { pattern: 'stars', c2: '#ffe066', tags: ['warm', 'sport', 'autumn', 'cute'] });
C('tuxedo', 'body', 'tuxedo', 'Смокинг', '#212529', { c2: '#e03131', shop: 'boutique', tags: ['fancy'] });
C('tuxedo_white', 'body', 'tuxedo', 'Белый смокинг', '#f8f9fa', { c2: '#1c7ed6', shop: 'boutique', tags: ['fancy', 'summer'] });
C('tutu_pink', 'legs', 'tutu', 'Балетная пачка', '#ffa8d9', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('tutu_white', 'legs', 'tutu', 'Белая пачка', '#ffffff', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('heels_red', 'feet', 'heels', 'Красные туфельки', '#f03e3e', { shop: 'boutique', tags: ['fancy', 'cute'] });
C('heels_black', 'feet', 'heels', 'Чёрные туфельки', '#343a40', { c2: '#ffd43b', shop: 'boutique', tags: ['fancy'] });
C('rollers', 'feet', 'rollers', 'Ролики', '#20c997', { c2: '#ff6b9d', tags: ['sport', 'summer', 'spring'] });
C('hat_cowboy', 'head', 'cowboy', 'Ковбойская шляпа', '#c98b5a', { c2: '#8d5524', tags: ['summer', 'sport'] });
C('beret_red', 'head', 'beret', 'Красный берет', '#e03131', { c2: '#a51111', tags: ['fancy', 'autumn', 'spring', 'cute'] });
C('beret_black', 'head', 'beret', 'Чёрный берет', '#343a40', { c2: '#212529', shop: 'boutique', tags: ['fancy', 'autumn'] });
C('hat_chef', 'head', 'chef', 'Поварской колпак', '#fff', { tags: ['home'] });
C('hat_pith', 'head', 'pith', 'Шлем исследователя', '#f1e0c5', { c2: '#d9a066', tags: ['summer', 'sport'] });
C('catears', 'head', 'catears', 'Кошачьи ушки', '#343a40', { c2: '#ff6b9d', tags: ['cute', 'home'] });
C('hair_flower', 'head', 'flower', 'Цветок в причёску', '#ff6b9d', { c2: '#ffd43b', shop: 'beach', tags: ['summer', 'beach', 'cute', 'fancy', 'spring'] });
C('hat_party', 'head', 'party', 'Праздничный колпачок', '#4dabf7', { c2: '#ffd43b', tags: ['cute', 'home'] });
C('hat_pirate', 'head', 'pirate', 'Пиратская треуголка', '#212529', { shop: 'gift', tags: ['fancy'] });
C('hat_santa', 'head', 'santa', 'Новогодний колпак', '#e03131', { shop: 'gift', season: 'winter', tags: ['warm', 'winter', 'cute'] });
C('hat_witch', 'head', 'witch', 'Шляпа волшебницы', '#5f3dc4', { c2: '#ff922b', shop: 'gift', tags: ['fancy', 'autumn'] });
C('tie_red', 'acc', 'tie', 'Красный галстук', '#e03131', { c2: '#fff', tags: ['fancy'] });
C('tie_blue', 'acc', 'tie', 'Синий галстук', '#1c7ed6', { c2: '#ffd43b', tags: ['fancy'] });
C('lei', 'acc', 'lei', 'Гавайские бусы из цветов', '#ff6b9d', { c2: '#b197fc', shop: 'beach', tags: ['summer', 'beach', 'cute', 'fancy'] });
C('camera', 'acc', 'camera', 'Фотоаппарат', '#495057', { c2: '#fa5252', tags: ['sport', 'summer', 'spring', 'autumn'] });
C('cape_red', 'acc', 'cape', 'Плащ супергероя', '#e03131', { shop: 'boutique', tags: ['fancy', 'sport'] });
C('cape_violet', 'acc', 'cape', 'Волшебная мантия', '#7048e8', { shop: 'gift', tags: ['fancy'] });

// --- рынок: вещицы ручной работы (торговец привозит по нескольку штук в день)
C('sunhat_daisy', 'head', 'sunhat', 'Шляпа с ромашками', '#fff9db', { c2: '#51cf66', shop: 'market', tags: ['summer', 'spring', 'beach', 'cute', 'fancy'] });
C('scarf_knit', 'acc', 'scarf', 'Вязаный шарф ручной работы', '#20c997', { c2: '#fff3bf', shop: 'market', season: 'winter', tags: ['warm', 'winter', 'autumn', 'cute'] });
C('bag_straw', 'acc', 'bag', 'Плетёная корзинка', '#d9a066', { c2: '#ff6b9d', shop: 'market', tags: ['cute', 'summer', 'spring', 'beach'] });
C('lei_shell', 'acc', 'lei', 'Бусы из ракушек', '#ffe8cc', { c2: '#74c0fc', shop: 'market', tags: ['summer', 'beach', 'cute', 'fancy'] });

export const CLOTHES = CL;
export const CLOTHES_BY_ID = Object.fromEntries(CL.map((c) => [c.id, c]));
export const START_CLOTHES = CL.filter((c) => c.shop === 'start').map((c) => c.id);
export const START_OUTFIT = { head: 'beanie_red', body: 'jw_blue', legs: 'pants_jeans', feet: 'boots_brown', acc: 'scarf_yellow' };

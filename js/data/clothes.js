// Одежда: слоты, каталог вещей, стартовый гардероб.
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

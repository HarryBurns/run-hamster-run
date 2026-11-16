// Мебель: каталог и разделы магазина.
// kind — как предмет рисуется (см. art/furniture.js). wall: висит на стене. layer: 0 — коврик (рисуется под всем).
// act — что будет, если потрогать (см. engine/side/items.js):
//   sleep | wardrobe | fridge | sit | tv | lamp | plant | piano | wheel | music | disco | toy | fish | fire | book | mirror | none
//   spin (покрутить: штурвал, глобус) | look (рассмотреть) | water (полить цветы) | sport (потренироваться)
//   telescope | bigfridge | oven — окна и сценки из features/visits.js
// say — что написать, когда предмет потрогали (для spin, look, sport).
// shop: home (ТЦ «Уютный дом») | market (вещицы с рынка) | gift (только в подарок) | forest (только из леса: золотая
//   шишка от белки, еловый венок от лесника Шишкина — features/forest.js; не продаются и не дарятся) | mountain (с горы)
//   | caves (из пещер: шкатулка самоцветов и грибной ночник от шахтёра Камушкина — features/caves.js)
//   | desert (из пустыни: коллекция окаменелостей от кочевника Бархана — features/desert.js)
//   | jungle (из джунглей: перья в рамке от исследовательницы Лианы — features/jungle.js)
//   | cove (с секретного пляжа: ракушки в рамке от русалочки Жемчужинки и сундучок из клада — features/cove.js).
// Цены — в таблице PRICES.furn (economy.js); у подарков цены нет (0).
// season — сезонная вещь: коллекция из таблицы сезонов вещей (WARE_MONTHS в data/seasons.js): 'cold' (осень и
//   зима), 'hot' (весна и лето), 'spring', 'newyear'… В сезон вещь в магазине всегда, не в сезон — редко.
// stock — «привоз» круглогодичной вещи: 'delivery' — два дня из трёх, 'special' — через день; поля нет — всегда.
//   Правила и цены по сезону — data/wares.js. Что уже куплено, ставится дома в любой сезон.
import { PRICES } from './economy.js';

const FU = [];
function F(id, kind, name, w, h, o = {}) {
  FU.push({ id, kind, name, price: PRICES.furn[id] || 0, w, h, shop: 'home', act: 'none', c: '#ff8fab', ...o });
}
F('bed_pink', 'bed', 'Кровать розовая', 210, 96, { act: 'sleep', c: '#ff8fab', cat: 'bed' });
F('bed_blue', 'bed', 'Кровать голубая', 210, 96, { act: 'sleep', c: '#74c0fc', cat: 'bed' });
F('bed_green', 'bed', 'Кровать зелёная', 210, 96, { act: 'sleep', c: '#8ce99a', cat: 'bed' });
F('bed_royal', 'bed', 'Королевская кровать', 230, 130, { stock: 'special', act: 'sleep', c: '#b197fc', royal: true, cat: 'bed' });
F('wardrobe', 'wardrobe', 'Шкаф с одеждой', 130, 190, { act: 'wardrobe', c: '#d9a066', cat: 'furn' });
F('wardrobe_white', 'wardrobe', 'Белый шкаф', 130, 190, { stock: 'delivery', act: 'wardrobe', c: '#f1f3f5', cat: 'furn' });
F('fridge', 'fridge', 'Холодильник', 96, 180, { act: 'fridge', c: '#e9ecef', cat: 'furn' });
F('fridge_pink', 'fridge', 'Розовый холодильник', 96, 180, { stock: 'delivery', act: 'fridge', c: '#ffc9de', cat: 'furn' });
F('sofa_red', 'sofa', 'Диван красный', 200, 90, { act: 'sit', c: '#ff6b6b', cat: 'seat' });
F('sofa_mint', 'sofa', 'Диван мятный', 200, 90, { act: 'sit', c: '#63e6be', cat: 'seat' });
F('sofa_purple', 'sofa', 'Диван фиолетовый', 200, 90, { stock: 'delivery', act: 'sit', c: '#b197fc', cat: 'seat' });
F('armchair', 'armchair', 'Кресло', 96, 92, { act: 'sit', c: '#ffa94d', cat: 'seat' });
F('armchair_blue', 'armchair', 'Синее кресло', 96, 92, { stock: 'delivery', act: 'sit', c: '#4dabf7', cat: 'seat' });
F('beanbag', 'beanbag', 'Кресло-мешок', 96, 70, { act: 'sit', c: '#f783ac', cat: 'seat' });
F('chair', 'chair', 'Стул', 54, 92, { act: 'sit', c: '#d9a066', cat: 'seat' });
F('table', 'table', 'Обеденный стол', 170, 74, { c: '#d9a066', cat: 'furn' });
F('coffee_table', 'table', 'Журнальный столик', 110, 48, { c: '#f1e0c5', cat: 'furn' });
F('nightstand', 'nightstand', 'Тумбочка', 60, 60, { c: '#d9a066', cat: 'furn' });
F('bookshelf', 'bookshelf', 'Книжный шкаф', 120, 180, { c: '#b9834f', cat: 'furn', act: 'book' });
F('tv', 'tv', 'Телевизор', 170, 130, { act: 'tv', c: '#343a40', cat: 'fun' });
F('piano', 'piano', 'Пианино', 170, 120, { act: 'piano', c: '#343a40', cat: 'fun' });
F('wheel', 'wheel', 'Беговое колесо', 150, 160, { act: 'wheel', c: '#ff6b9d', cat: 'fun' });
F('music', 'music', 'Музыкальная колонка', 60, 90, { act: 'music', c: '#845ef7', cat: 'fun' });
F('teddy', 'teddy', 'Плюшевый мишка', 60, 70, { act: 'toy', c: '#c98b5a', cat: 'fun' });
F('aquarium', 'aquarium', 'Аквариум', 130, 120, { act: 'fish', c: '#74c0fc', cat: 'fun' });
F('fireplace', 'fireplace', 'Камин', 150, 140, { season: 'cold', act: 'fire', c: '#c92a2a', cat: 'furn' });
F('lamp', 'lamp', 'Торшер', 50, 150, { act: 'lamp', c: '#ffd43b', cat: 'decor' });
F('lamp_pink', 'lamp', 'Розовый торшер', 50, 150, { stock: 'delivery', act: 'lamp', c: '#ff8fab', cat: 'decor' });
F('plant_ficus', 'plant', 'Фикус', 70, 130, { act: 'plant', v: 0, c: '#2f9e44', cat: 'decor' });
F('plant_palm', 'plant', 'Пальма в горшке', 90, 170, { stock: 'delivery', act: 'plant', v: 1, c: '#37b24d', cat: 'decor' });
F('plant_cactus', 'plant', 'Кактус', 50, 80, { act: 'plant', v: 2, c: '#51cf66', cat: 'decor' });
F('plant_flowers', 'plant', 'Ваза с цветами', 50, 80, { season: 'hot', act: 'plant', v: 3, c: '#ff8fab', cat: 'decor' });
F('rug_pink', 'rug', 'Розовый коврик', 190, 16, { c: '#ffb3c6', cat: 'decor', layer: 0 });
F('rug_blue', 'rug', 'Голубой коврик', 190, 16, { c: '#a5d8ff', cat: 'decor', layer: 0 });
F('rug_rainbow', 'rug', 'Радужный коврик', 210, 16, { stock: 'delivery', c: 'rainbow', cat: 'decor', layer: 0 });
F('balloons', 'balloons', 'Воздушные шарики', 70, 170, { act: 'toy', cat: 'decor' });
F('pic_sun', 'picture', 'Картина «Солнышко»', 80, 64, { wall: true, v: 0, cat: 'wall' });
F('pic_sea', 'picture', 'Картина «Море»', 96, 64, { wall: true, v: 1, cat: 'wall' });
F('pic_hamster', 'picture', 'Портрет хомячка', 64, 80, { stock: 'delivery', wall: true, v: 2, cat: 'wall' });
F('pic_flowers', 'picture', 'Картина «Цветы»', 64, 64, { wall: true, v: 3, cat: 'wall' });
F('clock', 'clock', 'Настенные часы', 56, 56, { wall: true, cat: 'wall' });
F('mirror', 'mirror', 'Зеркало', 64, 96, { wall: true, cat: 'wall', act: 'mirror' });
F('garland', 'garland', 'Гирлянда-огоньки', 220, 40, { season: 'newyear', wall: true, cat: 'wall' });
F('shelf', 'shelf', 'Полочка с игрушками', 110, 50, { wall: true, cat: 'wall' });
F('discoball', 'discoball', 'Диско-шар', 60, 80, { stock: 'special', wall: true, cat: 'wall', act: 'disco' });
// подарки (только за задания)
F('statue', 'statue', 'Золотой хомяк', 80, 130, { shop: 'gift', cat: 'decor', act: 'toy' });
F('throne', 'throne', 'Трон', 110, 170, { shop: 'gift', act: 'sit', cat: 'seat', c: '#e03131' });
F('sunflower', 'plant', 'Гигантский подсолнух', 90, 210, { shop: 'gift', act: 'plant', v: 4, cat: 'decor' });
F('neon', 'neon', 'Неоновая вывеска', 150, 70, { shop: 'gift', wall: true, cat: 'wall' });
F('cup', 'cup', 'Кубок чемпиона', 56, 80, { shop: 'gift', cat: 'decor', act: 'toy' });
// из леса (П.9)
F('golden_cone', 'goldcone', 'Золотая шишка', 60, 84, { shop: 'forest', cat: 'decor', act: 'look', say: 'Подарок белки из леса. Блестит!' });
// с горы (П.9): эдельвейсы в рамке — делает инструктор Вершинкин из трёх эдельвейсов (не продаются)
F('edelweiss_frame', 'edelframe', 'Эдельвейсы в рамке', 80, 96, { shop: 'mountain', wall: true, cat: 'wall', act: 'look', say: 'Редкие цветы с горы. Пушистые, как хомячок!' });
F('fir_wreath', 'firwreath', 'Еловый венок', 90, 90, { shop: 'forest', wall: true, cat: 'wall', act: 'look', say: 'Пахнет лесом и Новым годом!' });
// из пещер (П.9): делает шахтёр Камушкин — шкатулку из четырёх разных самоцветов, ночник из светящихся грибов
// (features/caves.js; не продаются). Ночник можно включить и выключить, как лампу
F('gem_geode', 'geode', 'Шкатулка самоцветов', 90, 70, { shop: 'caves', cat: 'decor', act: 'look', say: ['Хрусталь, топаз, сапфир и рубин — все сокровища пещер! 💎', 'Самоцветы переливаются: синий, жёлтый, красный… Как радуга под землёй!'] });
F('feather_frame', 'featherframe', 'Перья в рамке', 84, 96, { shop: 'jungle', wall: true, cat: 'wall', act: 'look', say: ['Красное, синее и жёлтое — перья попугаев из джунглей! 🦜', 'Кеша, Рико и Лимончик — у меня дома каждый день праздник цвета!'] });
F('shell_frame', 'shellframe', 'Ракушки в рамке', 84, 84, { shop: 'cove', wall: true, cat: 'wall', act: 'look', say: ['Розовая, витая и ракушка-солнышко — подарок моря с секретного пляжа! 🐚', 'Если прислушаться, слышно, как шумит море… и поёт Жемчужинка.'] });
F('treasure_chest', 'treasurechest', 'Сундучок с сокровищами', 84, 70, { shop: 'cove', cat: 'decor', act: 'look', say: ['Клад с секретного пляжа! Золотые монетки, жемчуг и бусы 💰', 'Карта Зефирки не обманула — крестик был на месте!'] });
F('fossil_box', 'fossils', 'Коллекция окаменелостей', 100, 74, { shop: 'desert', cat: 'decor', act: 'look', say: ['Ракушка-аммонит, отпечаток листа, зуб ящера и косточка динозавра — им миллионы лет! 🦴', 'Настоящий музей у меня дома! Профессор Орешкин бы обрадовался.'] });
F('shroom_lamp', 'shroomlamp', 'Грибной ночник', 60, 92, { shop: 'caves', cat: 'decor', act: 'lamp', c: '#63e6be' });
F('rocket', 'rocket', 'Игрушечная ракета', 70, 150, { shop: 'gift', cat: 'fun', act: 'toy' });
// рынок: вещицы ручной работы
F('rug_craft', 'rug', 'Коврик ручной работы', 190, 16, { shop: 'market', c: '#ffd8a8', cat: 'decor', layer: 0 });
F('lamp_lantern', 'lamp', 'Мятный фонарик', 50, 150, { shop: 'market', act: 'lamp', c: '#63e6be', cat: 'decor' });
F('beanbag_melon', 'beanbag', 'Кресло-мешок «Арбуз»', 96, 70, { season: 'hot', shop: 'market', act: 'sit', c: '#51cf66', cat: 'seat' });

// «как у соседей»: вещи, которые стоят в домах жителей (interiors/home_*.js), — их можно купить и себе
F('ship_wheel', 'ship_wheel', 'Штурвал', 96, 96, { stock: 'delivery', wall: true, cat: 'wall', act: 'spin', c: '#b9834f',
  say: ['Лево руля! Право руля! Полный вперёд! 🚢', 'Штурвал скрипит: «Курс — на приключения!» 🧭'] });
F('fishnet', 'fishnet', 'Рыбацкая сеть', 180, 84, { stock: 'delivery', wall: true, cat: 'wall' });
F('seamap', 'seamap', 'Морская карта', 130, 90, { stock: 'delivery', wall: true, cat: 'wall', act: 'look',
  say: ['На карте — море, острова и крестик. Наверное, там клад! 🗺️', 'Пунктир ведёт от пирса прямо за буйки… 🧭'] });
F('anchor', 'anchor', 'Якорь', 76, 104, { stock: 'delivery', cat: 'decor', act: 'toy', c: '#868e96' });
F('lifebuoy', 'lifebuoy', 'Спасательный круг', 66, 66, { wall: true, cat: 'wall' });
F('hammock', 'hammock', 'Гамак', 230, 124, { season: 'hot', cat: 'seat', act: 'sit', c: '#ffa94d' });
F('globe', 'globe', 'Глобус', 64, 100, { stock: 'delivery', cat: 'fun', act: 'spin', c: '#4dabf7',
  say: ['Глобус крутится… Стоп! Вот море, а вот наш город — меньше семечки 🌍', 'Вжух! Сколько же на свете мест, где хомячок ещё не был 🌍'] });
F('telescope', 'telescope', 'Телескоп', 110, 144, { stock: 'special', cat: 'fun', act: 'telescope', c: '#f08c00' });
F('desk', 'desk', 'Письменный стол', 156, 96, { cat: 'furn', act: 'book', c: '#b9834f' });
F('blackboard', 'blackboard', 'Школьная доска', 156, 96, { stock: 'delivery', wall: true, cat: 'wall', act: 'look',
  say: ['На доске написано: 2 + 2 = 4, а 2 орешка + 2 орешка = вкусно 🎓', 'Формула идеального печенья: мука + орешки + немножко терпения 🍪'] });
F('vanity', 'vanity', 'Туалетный столик', 116, 156, { stock: 'delivery', cat: 'furn', act: 'mirror', c: '#ffc9de' });
F('mannequin', 'mannequin', 'Манекен с платьем', 64, 146, { stock: 'delivery', cat: 'decor', act: 'toy', c: '#f783ac' });
F('clothes_rack', 'clothes_rack', 'Вешалка с нарядами', 150, 150, { stock: 'delivery', cat: 'furn', act: 'look',
  say: ['Платья, платья, платья… и одна шляпа с перьями 👗', 'Вот это наряды! На каждый день недели — и ещё на праздник ✨'] });
F('fridge_giant', 'fridge_giant', 'Гигантский холодильник', 156, 216, { stock: 'special', cat: 'furn', act: 'bigfridge', c: '#d0ebff' });
F('oven', 'oven', 'Духовка с пирогом', 104, 112, { cat: 'furn', act: 'oven', c: '#ffd8a8' });
F('pot_rack', 'pot_rack', 'Полка с кастрюлями', 156, 70, { wall: true, cat: 'wall' });
F('barbell', 'barbell', 'Штанга', 160, 76, { cat: 'fun', act: 'sport', c: '#495057',
  say: ['И-и-раз! И-и-два! Сильные лапки 💪', 'Ух, тяжёлая! Ещё чуть-чуть — и ты чемпионка 🏋️'] });
F('punchbag', 'punchbag', 'Боксёрская груша', 70, 196, { stock: 'delivery', cat: 'fun', act: 'toy', c: '#e03131' });
F('trophy_shelf', 'trophy_shelf', 'Полка с кубками', 140, 66, { stock: 'delivery', wall: true, cat: 'wall', act: 'look',
  say: ['Кубки блестят: «Лучший пловец», «Самый быстрый», «За волю к победе» 🏆', 'Столько кубков! А один — за самый громкий плюх 🏆'] });
F('rocking_chair', 'rocking_chair', 'Кресло-качалка с пледом', 104, 116, { season: 'cold', cat: 'seat', act: 'sit', c: '#f783ac' });
F('tea_table', 'tea_table', 'Чайный столик', 124, 84, { stock: 'delivery', cat: 'furn', act: 'look', c: '#f1e0c5',
  say: ['Чайник горячий, чашки ждут гостей 🫖', 'Пахнет мятой и вареньем 🍵'] });
F('toybox', 'toybox', 'Ящик с игрушками', 112, 80, { cat: 'fun', act: 'toy', c: '#74c0fc' });
F('dollhouse', 'dollhouse', 'Кукольный домик', 112, 136, { stock: 'delivery', cat: 'fun', act: 'toy', c: '#ffc9de' });
F('rocking_horse', 'rocking_horse', 'Лошадка-качалка', 116, 100, { stock: 'delivery', cat: 'fun', act: 'toy', c: '#e8a15c' });
F('seedling_shelf', 'seedling_shelf', 'Стеллаж с рассадой', 136, 166, { season: 'spring', cat: 'decor', act: 'plant', c: '#b9834f' });
F('watering_can', 'watering_can', 'Лейка', 70, 56, { season: 'hot', cat: 'decor', act: 'water', c: '#63e6be' });
F('hanging_plant', 'hanging_plant', 'Кашпо с плющом', 64, 96, { wall: true, cat: 'wall', c: '#37b24d' });

export const FURNITURE = FU;
export const FURN_BY_ID = Object.fromEntries(FU.map((f) => [f.id, f]));
export const FURN_CATS = [
  { id: 'bed', name: 'Кровати', icon: '🛏️' }, { id: 'seat', name: 'Диваны и кресла', icon: '🛋️' },
  { id: 'furn', name: 'Мебель', icon: '🚪' }, { id: 'fun', name: 'Развлечения', icon: '🎹' },
  { id: 'decor', name: 'Растения и декор', icon: '🪴' }, { id: 'wall', name: 'На стену', icon: '🖼️' },
];

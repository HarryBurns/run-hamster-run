// Мебель: каталог и разделы магазина.
// kind — как предмет рисуется (см. art/furniture.js). wall: висит на стене. layer: 0 — коврик (рисуется под всем).
// act — что будет, если потрогать (см. engine/side/items.js):
//   sleep | wardrobe | fridge | sit | tv | lamp | plant | piano | wheel | music | disco | toy | fish | fire | book | mirror | none
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

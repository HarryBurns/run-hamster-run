// Еда: продукты, семена, блюда и рецепты.
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

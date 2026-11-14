// Еда: продукты, семена, блюда и рецепты.
// src: shop — ТЦ «Вкусный»; garden — грядки; fish — рыбалка
// seasons — когда южный фрукт продают в ТЦ; в остальное время он есть только на рынке (дороже).
// Цены сюда подставляются из economy.js:
//   price — в магазине (у продуктов с грядки и у рыбы её нет); sell — сколько даёт рынок;
//   rare — цена на рынке не в сезон.
import { PRICES, MARKET } from './economy.js';

const floor5 = (n) => Math.max(5, Math.floor(n / 5) * 5);
const ING_LIST = [
  { id: 'flour', name: 'Мука', e: '🌾', src: 'shop' },
  { id: 'egg', name: 'Яйца', e: '🥚', src: 'shop' },
  { id: 'milk', name: 'Молоко', e: '🥛', src: 'shop' },
  { id: 'cheese', name: 'Сыр', e: '🧀', src: 'shop' },
  { id: 'butter', name: 'Масло', e: '🧈', src: 'shop' },
  { id: 'sugar', name: 'Сахар', e: '🍬', src: 'shop' },
  { id: 'choco', name: 'Шоколад', e: '🍫', src: 'shop' },
  { id: 'rice', name: 'Рис', e: '🍚', src: 'shop' },
  { id: 'nuts', name: 'Орешки', e: '🌰', src: 'shop' },
  { id: 'apple', name: 'Яблоко', e: '🍎', src: 'shop' },
  { id: 'banana', name: 'Банан', e: '🍌', src: 'shop' },
  { id: 'honey', name: 'Мёд', e: '🍯', src: 'shop' },
  { id: 'coconut', name: 'Кокос', e: '🥥', src: 'shop' },
  // южные фрукты
  { id: 'mango', name: 'Манго', e: '🥭', src: 'shop', seasons: ['summer'] },
  { id: 'pineapple', name: 'Ананас', e: '🍍', src: 'shop', seasons: ['spring', 'summer'] },
  { id: 'kiwi', name: 'Киви', e: '🥝', src: 'shop', seasons: ['autumn', 'winter'] },
  { id: 'orange', name: 'Апельсин', e: '🍊', src: 'shop', seasons: ['winter', 'spring'] },
  { id: 'lemon', name: 'Лимон', e: '🍋', src: 'shop', seasons: ['winter', 'spring'] },
  { id: 'peach', name: 'Персик', e: '🍑', src: 'shop', seasons: ['summer'] },
  { id: 'grapes', name: 'Виноград', e: '🍇', src: 'shop', seasons: ['autumn'] },
  { id: 'melon', name: 'Дыня', e: '🍈', src: 'shop', seasons: ['summer', 'autumn'] },
  { id: 'avocado', name: 'Авокадо', e: '🥑', src: 'shop', seasons: ['spring'] },
  { id: 'carrot', name: 'Морковка', e: '🥕', src: 'garden' },
  { id: 'strawberry', name: 'Клубника', e: '🍓', src: 'garden' },
  { id: 'seeds', name: 'Семечки', e: '🌻', src: 'garden' },
  { id: 'tomato', name: 'Помидор', e: '🍅', src: 'garden' },
  { id: 'pumpkin', name: 'Тыква', e: '🎃', src: 'garden' },
  { id: 'fish', name: 'Рыбка', e: '🐟', src: 'fish' },
];
export const INGREDIENTS = ING_LIST.map((i) => {
  const price = PRICES.ing[i.id] || 0;
  return {
    ...i,
    price,
    sell: MARKET.sell[i.id] || Math.round(price * MARKET.shopShare),
    rare: i.seasons ? floor5(price * MARKET.rareMarkup) : 0,
  };
});
export const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
/** Продаётся ли продукт сейчас в ТЦ «Вкусный» (южные фрукты — только в свой сезон). */
export const inSeason = (ing, season) => !ing.seasons || ing.seasons.includes(season);

// Семена: crop — что вырастет, days — сколько ночей растёт, n — урожай с грядки
const SEED_LIST = [
  { id: 'seed_carrot', crop: 'carrot', name: 'Семена морковки', days: 1, n: 3 },
  { id: 'seed_tomato', crop: 'tomato', name: 'Семена помидоров', days: 2, n: 3 },
  { id: 'seed_strawberry', crop: 'strawberry', name: 'Рассада клубники', days: 2, n: 4 },
  { id: 'seed_seeds', crop: 'seeds', name: 'Семена подсолнуха', days: 2, n: 3 },
  { id: 'seed_pumpkin', crop: 'pumpkin', name: 'Семена тыквы', days: 3, n: 2 },
];
export const SEEDS = SEED_LIST.map((s) => ({ ...s, price: PRICES.seeds[s.id] || 0 }));
export const SEED_BY_ID = Object.fromEntries(SEEDS.map((s) => [s.id, s]));

// Блюда. needs — продукты; start — рецепт известен с начала; cafe — где продают готовое
// price — цена в кафе; sell — сколько рынок даёт за порцию домашнего блюда (по продуктам, см. MARKET.dishShare);
// блюда, которые нельзя приготовить самой, рынок не берёт (sell = 0).
const DISH_LIST = [
  { id: 'pancakes', name: 'Блинчики', e: '🥞', needs: { flour: 1, egg: 1, milk: 1 }, start: true },
  { id: 'fruit_salad', name: 'Фруктовый салат', e: '🥗', needs: { apple: 1, banana: 1, strawberry: 1 }, start: true },
  { id: 'cocoa', name: 'Горячий шоколад', e: '☕', needs: { choco: 1, milk: 1 }, start: true, cafe: 'cafe' },
  { id: 'carrot_cake', name: 'Морковный торт', e: '🍰', needs: { carrot: 2, flour: 1, egg: 1, sugar: 1 }, start: true },
  { id: 'pizza', name: 'Пицца', e: '🍕', needs: { flour: 1, cheese: 1, tomato: 1 }, start: true, cafe: 'rest' },
  { id: 'fish_soup', name: 'Уха', e: '🍲', needs: { fish: 1, carrot: 1 }, start: true },
  { id: 'cookies', name: 'Ореховое печенье', e: '🍪', needs: { nuts: 1, flour: 1, butter: 1 }, start: true, cafe: 'cafe' },
  { id: 'coco_shake', name: 'Кокосовый коктейль', e: '🥤', needs: { coconut: 1, milk: 1, banana: 1 }, start: true, cafe: 'beach' },
  { id: 'coco_candy', name: 'Кокосовые конфеты', e: '🍡', needs: { coconut: 1, choco: 1, sugar: 1 }, start: true },
  { id: 'mango_lassi', name: 'Манговый коктейль', e: '🧋', needs: { mango: 1, milk: 1, honey: 1 }, start: true },
  { id: 'tropic_plate', name: 'Тарелка «Тропики»', e: '🍱', needs: { mango: 1, pineapple: 1, kiwi: 1 }, start: true },
  { id: 'orange_juice', name: 'Апельсиновый сок', e: '🧃', needs: { orange: 2 }, start: true },
  { id: 'peach_pie', name: 'Персиковый пирог', e: '🥧', needs: { peach: 2, flour: 1, egg: 1, sugar: 1 } },
  { id: 'grape_jelly', name: 'Виноградное желе', e: '🍮', needs: { grapes: 2, sugar: 1 } },
  { id: 'avocado_toast', name: 'Тост с авокадо', e: '🥪', needs: { avocado: 1, flour: 1, egg: 1 }, start: true },
  { id: 'pineapple_pizza', name: 'Гавайская пицца', e: '🍕', needs: { pineapple: 1, flour: 1, cheese: 1 } },
  { id: 'melon_sorbet', name: 'Дынный сорбет', e: '🍧', needs: { melon: 1, lemon: 1, sugar: 1 } },
  { id: 'icecream', name: 'Клубничное мороженое', e: '🍨', needs: { strawberry: 2, milk: 1, sugar: 1 }, cafe: 'beach' },
  { id: 'sushi', name: 'Суши', e: '🍣', needs: { fish: 1, rice: 1 }, cafe: 'rest' },
  { id: 'pumpkin_pie', name: 'Тыквенный пирог', e: '🥧', needs: { pumpkin: 1, flour: 1, egg: 1 } },
  { id: 'choco_cake', name: 'Шоколадный торт', e: '🎂', needs: { choco: 2, flour: 1, egg: 1, sugar: 1 }, cafe: 'cafe' },
  { id: 'kozinaki', name: 'Козинаки', e: '🍘', needs: { seeds: 2, honey: 1 } },
  { id: 'apple_pie', name: 'Яблочный пирог', e: '🥮', needs: { apple: 2, flour: 1, butter: 1, sugar: 1 } },
  { id: 'cheese_plate', name: 'Сырная тарелка', e: '🧀', needs: { cheese: 2, nuts: 1, honey: 1 } },
  // только в кафе
  { id: 'croissant', name: 'Круассан', e: '🥐', cafe: 'cafe' },
  { id: 'donut', name: 'Пончик', e: '🍩', cafe: 'cafe' },
  { id: 'lemonade', name: 'Лимонад', e: '🍹', needs: { lemon: 2, sugar: 1 }, start: true, cafe: 'beach' },
  { id: 'watermelon', name: 'Арбуз', e: '🍉', cafe: 'beach' },
  { id: 'burger', name: 'Бургер с морковной котлетой', e: '🍔', cafe: 'rest' },
  { id: 'pasta', name: 'Паста с сыром', e: '🍝', cafe: 'rest' },
];
export const DISHES = DISH_LIST.map((d) => {
  const price = PRICES.cafe[d.id] || 0;
  let sell = 0;
  if (d.needs) {
    const raw = Object.entries(d.needs).reduce((sum, [id, n]) => sum + ING_BY_ID[id].sell * n, 0);
    sell = floor5(raw * MARKET.dishShare);
    if (price) sell = Math.min(sell, floor5(price * MARKET.cafeShare));
  }
  return { ...d, price, sell };
});
export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const START_RECIPES = DISHES.filter((d) => d.start).map((d) => d.id);
export const SECRET_RECIPES = DISHES.filter((d) => d.needs && !d.start).map((d) => d.id);

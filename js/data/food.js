// Еда: продукты, семена, блюда и рецепты.
// src — откуда продукт берётся в первую очередь: shop — ТЦ «Вкусный»; garden — грядки; fish — рыбалка;
//   wild — собрать (растёт в городе и в лесу). В ТЦ «Вкусный» продаётся всё, кроме рыбы.
// raw — можно съесть просто так, не готовя (кнопка «Съесть» в рюкзаке и холодильнике).
// Сезон продукта — из общей таблицы data/seasons.js: months — месяцы (0–11), seasons — сезоны; у кого сезона
// нет, у того и полей нет. Сезонное — всё, что растёт: огород, сбор в городе, южные фрукты.
//
// Цены считаются из economy.js (PRICES.ing, SEASONAL, MARKET):
//   price    — обычная цена в магазине (у рыбы её нет);
//   priceIn  — цена сезонного продукта в сезон (дешевле обычной), priceOff — вне сезона (дороже);
//   sell     — сколько рынок платит игроку: доля самой низкой цены покупки (в сезон); sellOff — вне сезона (больше).
// Сколько продукт стоит СЕЙЧАС — buyPrice(ing, месяц) и sellPrice(ing, месяц); есть ли он сегодня на прилавке —
// foodRule(ing, месяц) → правило «ассортимента дня» (data/stock.js).
import { PRICES, MARKET, SEASONAL, STOCK, TREATS } from './economy.js';
import { harvestMonths, seasonsOf, ripeIn } from './seasons.js';

const floor5 = (n) => Math.max(5, Math.floor(n / 5) * 5);
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
const ING_LIST = [
  { id: 'flour', name: 'Мука', e: '🌾', src: 'shop' },
  { id: 'egg', name: 'Яйца', e: '🥚', src: 'shop' },
  { id: 'milk', name: 'Молоко', e: '🥛', src: 'shop' },
  { id: 'cheese', name: 'Сыр', e: '🧀', src: 'shop' },
  { id: 'butter', name: 'Масло', e: '🧈', src: 'shop' },
  { id: 'sugar', name: 'Сахар', e: '🍬', src: 'shop' },
  { id: 'choco', name: 'Шоколад', e: '🍫', src: 'shop' },
  { id: 'rice', name: 'Рис', e: '🍚', src: 'shop' },
  { id: 'nuts', name: 'Орешки', e: '🥜', src: 'shop' },
  { id: 'apple', name: 'Яблоко', e: '🍎', src: 'shop', raw: true },
  { id: 'honey', name: 'Мёд', e: '🍯', src: 'shop' },
  // растёт в городе (в сезон можно сорвать бесплатно) и продаётся в магазине
  { id: 'banana', name: 'Банан', e: '🍌', src: 'shop', raw: true },
  { id: 'coconut', name: 'Кокос', e: '🥥', src: 'shop' },
  { id: 'mango', name: 'Манго', e: '🥭', src: 'shop', raw: true },
  // южные фрукты
  { id: 'pineapple', name: 'Ананас', e: '🍍', src: 'shop', raw: true },
  { id: 'kiwi', name: 'Киви', e: '🥝', src: 'shop', raw: true },
  { id: 'orange', name: 'Апельсин', e: '🍊', src: 'shop', raw: true },
  { id: 'lemon', name: 'Лимон', e: '🍋', src: 'shop' },
  { id: 'peach', name: 'Персик', e: '🍑', src: 'shop', raw: true },
  { id: 'grapes', name: 'Виноград', e: '🍇', src: 'shop', raw: true },
  { id: 'melon', name: 'Дыня', e: '🍈', src: 'shop', raw: true },
  { id: 'avocado', name: 'Авокадо', e: '🥑', src: 'shop' },
  // огород
  { id: 'lettuce', name: 'Зелёный салат', e: '🥬', src: 'garden', raw: true },
  { id: 'carrot', name: 'Морковка', e: '🥕', src: 'garden', raw: true },
  { id: 'strawberry', name: 'Клубника', e: '🍓', src: 'garden', raw: true },
  { id: 'seeds', name: 'Семечки', e: '🌻', src: 'garden' },
  { id: 'tomato', name: 'Помидор', e: '🍅', src: 'garden', raw: true },
  { id: 'pumpkin', name: 'Тыква', e: '🎃', src: 'garden' },
  { id: 'fish', name: 'Рыбка', e: '🐟', src: 'fish' },
  // растёт само: кусты черники и грибы (в городе их мало — основное место сбора будет в лесу)
  { id: 'blueberry', name: 'Черника', e: '🫐', src: 'wild', raw: true },
  { id: 'mushroom', name: 'Гриб', e: '🍄', src: 'wild' },
  // растёт в лесу (П.9)
  { id: 'porcini', name: 'Белый гриб', e: '🍄‍🟫', src: 'wild' },
  // зефир — жарить на костре в лесу
  { id: 'marshmallow', name: 'Зефир', e: '🍡', src: 'shop', raw: true },
];
export const INGREDIENTS = ING_LIST.map((i) => {
  const price = PRICES.ing[i.id] || 0;
  const months = harvestMonths(i.id);
  const seasonal = !!months && price > 0;
  const priceIn = seasonal ? round5(price * SEASONAL.inPrice) : price;
  const sell = MARKET.sell[i.id] || Math.round(priceIn * MARKET.shopShare);
  return {
    ...i,
    ...(months ? { months, seasons: seasonsOf(i.id) } : null),
    price,
    priceIn,
    priceOff: seasonal ? round5(price * SEASONAL.offPrice) : price,
    sell,
    sellOff: seasonal ? Math.round(sell * SEASONAL.offSell) : sell,
    ...(TREATS.ing.includes(i.id) ? { treat: true } : null),
  };
});
export const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
/** Сезон ли сейчас у продукта (month — 0–11, как cal().month). У кого сезона нет — всегда. */
export const inSeason = (ing, month) => ripeIn(ing.id, month);
/** Сезонный ли это продукт (в сезон дешевле и его много, вне сезона — дороже, мало и не каждый день). */
export const isSeasonal = (ing) => !!ing.months && ing.price > 0;
/** Сколько продукт стоит в магазине и на рынке в этом месяце (0 — не продаётся: рыбу ловят). */
export const buyPrice = (ing, month) => (!isSeasonal(ing) ? ing.price : inSeason(ing, month) ? ing.priceIn : ing.priceOff);
/** Сколько рынок платит за продукт игроку в этом месяце: всегда заметно меньше, чем он сейчас стоит в магазине. */
export const sellPrice = (ing, month) => (!isSeasonal(ing) || inSeason(ing, month) ? ing.sell : ing.sellOff);
/**
 * Правило «ассортимента дня» для продукта в ТЦ «Вкусный» (data/stock.js): null — есть всегда и сколько угодно
 * (круглогодичное и сезонное в сезон), сезонное вне сезона и лакомства — не каждый день и понемногу.
 */
export const foodRule = (ing, month) =>
  ing.treat ? STOCK.treat : isSeasonal(ing) && !inSeason(ing, month) ? STOCK.offMall : null;

// Семена: crop — что вырастет, days — сколько ночей растёт, n — урожай с грядки; sow — «что сажают» для подсказки.
// Сажать можно только в сезон культуры (data/seasons.js); посаженное дорастает в любое время.
const SEED_LIST = [
  { id: 'seed_lettuce', crop: 'lettuce', name: 'Семена салата', sow: 'Салат', days: 1, n: 5 },
  { id: 'seed_carrot', crop: 'carrot', name: 'Семена морковки', sow: 'Морковку', days: 1, n: 5 },
  { id: 'seed_tomato', crop: 'tomato', name: 'Семена помидоров', sow: 'Помидоры', days: 2, n: 6 },
  { id: 'seed_strawberry', crop: 'strawberry', name: 'Рассада клубники', sow: 'Клубнику', days: 2, n: 6 },
  { id: 'seed_seeds', crop: 'seeds', name: 'Семена подсолнуха', sow: 'Подсолнухи', days: 2, n: 6 },
  { id: 'seed_pumpkin', crop: 'pumpkin', name: 'Семена тыквы', sow: 'Тыкву', days: 3, n: 4 },
];
export const SEEDS = SEED_LIST.map((s) => ({ ...s, price: PRICES.seeds[s.id] || 0 }));
export const SEED_BY_ID = Object.fromEntries(SEEDS.map((s) => [s.id, s]));
/** Можно ли сажать эти семена в этом месяце (сезон культуры). */
export const canSow = (seed, month) => ripeIn(seed.crop, month);

// Блюда. needs — продукты; start — рецепт известен с начала; cafe — где продают готовое;
// treat — «лакомство дня»: в кафе бывает не каждый день (TREATS в economy.js).
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
  // тёплое питьё: простуженной становится полегче (WARM_DRINKS в data/health.js)
  { id: 'honey_tea', name: 'Чай с мёдом и лимоном', e: '🍵', needs: { honey: 1, lemon: 1 }, start: true },
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
  // из собранного в городе и в лесу
  { id: 'mushroom_soup', name: 'Грибной суп', e: '🥣', needs: { mushroom: 2, carrot: 1 }, start: true },
  { id: 'blueberry_muffin', name: 'Черничный кекс', e: '🧁', needs: { blueberry: 2, flour: 1, egg: 1 }, start: true },
  // секретный рецепт лесника Шишкина (награда за задание в лесу)
  { id: 'forest_pie', name: 'Лесной пирог с белыми грибами', e: '🥧', needs: { porcini: 1, flour: 1, egg: 1 } },
  // жарят только на костре в лесу (на кухне не готовят): просто вкусно
  { id: 'toasted_marshmallow', name: 'Жареный зефир', e: '🍢', fire: true },
  // из зимней культуры — салата с грядки под парничком
  { id: 'lettuce_wrap', name: 'Лепёшка с салатом', e: '🥙', needs: { lettuce: 1, flour: 1, cheese: 1 }, start: true },
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
  return { ...d, price, sell, ...(TREATS.dish.includes(d.id) ? { treat: true } : null) };
});
export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const START_RECIPES = DISHES.filter((d) => d.start).map((d) => d.id);
export const SECRET_RECIPES = DISHES.filter((d) => d.needs && !d.start).map((d) => d.id);
/** Правило «ассортимента дня» для блюда в кафе: лакомства бывают не каждый день, остальное — всегда. */
export const dishRule = (d) => (d.treat ? STOCK.treat : null);

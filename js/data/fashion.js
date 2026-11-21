// Показ мод: темы и какие теги одежды ценит жюри; когда показ открыт (хватает ли нарядов в шкафу).
import { CLOTHES_BY_ID } from './clothes.js';

// Темы показа мод: какие теги одежды ценит жюри
export const FASHION_THEMES = [
  { id: 'winter', name: 'Зимняя сказка', tags: ['warm', 'winter'], hint: 'Тёплая куртка, шапка, шарф, зимняя обувь' },
  { id: 'beach', name: 'Пляжная вечеринка', tags: ['beach', 'swim', 'summer'], hint: 'Купальник, панамка, очки от солнца, сандалии' },
  { id: 'ball', name: 'Королевский бал', tags: ['fancy'], hint: 'Самое нарядное платье, украшения, шляпа или корона' },
  { id: 'sport', name: 'Спортивный день', tags: ['sport'], hint: 'Майка, шорты, кеды, кепка' },
  { id: 'rain', name: 'Прогулка под дождём', tags: ['rain', 'autumn'], hint: 'Куртка-дождевик, резиновые сапожки, джинсы' },
  { id: 'home', name: 'Пижамная вечеринка', tags: ['home'], hint: 'Пижама или халат, тапочки' },
  { id: 'cute', name: '{Самый милый|Самая милая}', tags: ['cute'], hint: 'Всё самое милое: горошек, бантики, юбочки' },
  { id: 'spring', name: 'Весенняя прогулка', tags: ['spring'], hint: 'Лёгкая куртка, юбка или джинсы, кеды' },
];

/** Вещи «на всё тело»: платье, купальник, пижама — и верх, и низ сразу (оценка наряда, нужные места показа). */
export const FULL_BODY_KINDS = ['dress', 'princess', 'swim', 'pajama', 'robe'];
/**
 * Показ мод — когда в шкафу есть из чего выбрать (решение заказчика 20 ноября): хотя бы FASHION_MIN вещей на каждое
 * нужное место — верх, низ, обувь (платье, купальник, пижама считаются и верхом, и низом). В новой игре в шкафу
 * по одной вещи (белая майка, джинсы, кроссовки) — показ откроется, когда купишь ещё (например, платье и обувь).
 */
export const FASHION_MIN = 2;
export const FASHION_FEW = 'У тебя пока мало нарядов — загляни в ТЦ «Модный», а потом приходи на показ!';
/** Сколько вещей в шкафу clothes (id) на каждое нужное место показа: { body, legs, feet }. */
export function fashionCount(clothes) {
  const n = { body: 0, legs: 0, feet: 0 };
  for (const id of clothes || []) {
    const c = CLOTHES_BY_ID[id];
    if (!c) continue;
    if (c.slot === 'body' || c.slot === 'legs' || c.slot === 'feet') n[c.slot]++;
    if (c.slot === 'body' && FULL_BODY_KINDS.includes(c.kind)) n.legs++;
  }
  return n;
}
/** Хватает ли нарядов в шкафу clothes для показа мод. */
export const fashionReady = (clothes) => {
  const n = fashionCount(clothes);
  return n.body >= FASHION_MIN && n.legs >= FASHION_MIN && n.feet >= FASHION_MIN;
};

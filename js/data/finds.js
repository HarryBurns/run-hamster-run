// Находки — то, что лежит в рюкзаке, но это не еда и не мебель (сумка finds в сохранении: id → сколько).
// Пока это находки для гербария Мяты (сюжетное задание «Гербарий для Мяты», data/quests.js). Они не продаются
// и не готовятся: собирать их можно, только пока они нужны для задания (core/state.js, wantedFinds), поэтому
// «вечного двигателя» из них не получится (проверяет dev/balance.js).
// kind — вид находки: задание просит «5 разных находок вида herb» (шаг bring в data/quests.js).
export const FINDS = [
  // ёлочки — круглый год
  { id: 'herb_fir', kind: 'herb', e: '🌲', name: 'Еловая веточка' },
  { id: 'herb_cone', kind: 'herb', e: '🌰', name: 'Еловая шишка' },
  // зима
  { id: 'herb_rowan', kind: 'herb', e: '🍒', name: 'Веточка рябины' },
  { id: 'herb_wheat', kind: 'herb', e: '🌾', name: 'Сухой колосок' },
  { id: 'herb_juniper', kind: 'herb', e: '🌿', name: 'Веточка можжевельника' },
  // весна
  { id: 'herb_tulip', kind: 'herb', e: '🌷', name: 'Тюльпан' },
  { id: 'herb_dandelion', kind: 'herb', e: '🌼', name: 'Одуванчик' },
  { id: 'herb_cherry', kind: 'herb', e: '🌸', name: 'Цветок вишни' },
  { id: 'herb_sprout', kind: 'herb', e: '🌱', name: 'Молодой листик' },
  // лето
  { id: 'herb_rose', kind: 'herb', e: '🌹', name: 'Роза' },
  { id: 'herb_mallow', kind: 'herb', e: '🌺', name: 'Мальва' },
  { id: 'herb_linden', kind: 'herb', e: '🍃', name: 'Листик липы' },
  { id: 'herb_clover', kind: 'herb', e: '🍀', name: 'Клевер' },
  // осень (и сухой дубовый листок — зимой)
  { id: 'herb_sunflower', kind: 'herb', e: '🌻', name: 'Подсолнух' },
  { id: 'herb_aster', kind: 'herb', e: '💮', name: 'Астра' },
  { id: 'herb_maple', kind: 'herb', e: '🍁', name: 'Кленовый лист' },
  { id: 'herb_oak', kind: 'herb', e: '🍂', name: 'Дубовый листок' },
  // лес (П.9): шишки — круглый год, еловые веточки — зимой (их не продают: шишки меняет белка, веточки — венок
  // у лесника Шишкина)
  { id: 'cone', kind: 'forest', e: '🌰', name: 'Шишка' },
  { id: 'fir_twig', kind: 'forest', e: '🎄', name: 'Еловая веточка' },
  // гора (П.9): эдельвейс — редкий горный цветок, летом один в день; из трёх Вершинкин сделает «Эдельвейс в рамке»
  { id: 'edelweiss', kind: 'mountain', e: '🤍', name: 'Эдельвейс' },
];
export const FIND_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

/**
 * Что можно сорвать для гербария: вид места (flowers — клумба или цветы, tree — лиственное дерево, pine — ёлка)
 * → сезон → две находки. В один день место даёт первую, в другой — вторую (herbFor), поэтому за день в городе
 * распускаются три разные находки (по одной с каждого вида мест), а пять разных собираются за два дня и больше.
 */
export const HERB_KINDS = {
  flowers: {
    winter: ['herb_wheat', 'herb_juniper'],
    spring: ['herb_tulip', 'herb_dandelion'],
    summer: ['herb_rose', 'herb_mallow'],
    autumn: ['herb_sunflower', 'herb_aster'],
  },
  tree: {
    winter: ['herb_rowan', 'herb_oak'],
    spring: ['herb_cherry', 'herb_sprout'],
    summer: ['herb_linden', 'herb_clover'],
    autumn: ['herb_maple', 'herb_oak'],
  },
  pine: {
    winter: ['herb_fir', 'herb_cone'],
    spring: ['herb_fir', 'herb_cone'],
    summer: ['herb_fir', 'herb_cone'],
    autumn: ['herb_cone', 'herb_fir'],
  },
};
/** Какую находку для гербария даёт место такого вида в этот день (season — 'winter' | 'spring' | …). */
export const herbFor = (type, season, day) => {
  const list = HERB_KINDS[type][season];
  return list[day % list.length];
};

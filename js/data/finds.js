// Находки — то, что лежит в рюкзаке, но это не еда и не мебель (сумка finds в сохранении: id → сколько).
// Пока это находки для гербария Мяты (сюжетное задание «Гербарий для Мяты», data/quests.js). Они не продаются
// и не готовятся: собирать их можно, только пока они нужны для задания (core/state.js, wantedFinds), поэтому
// «вечного двигателя» из них не получится (проверяет dev/balance.js).
// kind — вид находки: задание просит «5 разных находок вида herb» (шаг bring в data/quests.js).
// e — значок: эмодзи или рисованный значок ICON.имя (data/icons.js — у вещей, которым эмодзи не нашлось).
import { ICON } from './icons.js';

export const FINDS = [
  // ёлочки — круглый год
  { id: 'herb_fir', kind: 'herb', e: '🌲', name: 'Еловая веточка' },
  { id: 'herb_cone', kind: 'herb', e: ICON.cone, name: 'Еловая шишка' },
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
  { id: 'cone', kind: 'forest', e: ICON.cone, name: 'Шишка' },
  { id: 'fir_twig', kind: 'forest', e: '🎄', name: 'Еловая веточка' },
  // гора (П.9): эдельвейс — редкий горный цветок, летом один в день; из трёх Вершинкин сделает «Эдельвейс в рамке»
  { id: 'edelweiss', kind: 'mountain', e: ICON.edelweiss, name: 'Эдельвейс' },
  // пещеры (П.9): фонарик — инструмент из ТЦ «Уютный дом» (PRICES.tools; продать нельзя), с ним в пещере светло;
  // светящиеся грибы — CAVES.shrooms в день, из трёх Камушкин делает «Грибной ночник»; самоцветы — добыча
  // в мини-игре «Кристаллы», их берёт рынок (CAVES.gems), из четырёх разных — «Шкатулка самоцветов»
  { id: 'flashlight', kind: 'tool', e: '🔦', name: 'Фонарик' },
  { id: 'glow_shroom', kind: 'caves', e: ICON.glow_shroom, name: 'Светящийся гриб' },
  { id: 'gem_crystal', kind: 'gem', e: ICON.gem_crystal, name: 'Горный хрусталь' },
  { id: 'gem_topaz', kind: 'gem', e: ICON.gem_topaz, name: 'Топаз' },
  { id: 'gem_sapphire', kind: 'gem', e: ICON.gem_sapphire, name: 'Сапфир' },
  { id: 'gem_ruby', kind: 'gem', e: ICON.gem_ruby, name: 'Рубин' },
  // пустыня (П.9): окаменелости — находка в мини-игре «Раскопки» (по одной за первые DESERT.dig.paid игр в день,
  // виды по кругу); их берёт рынок (DESERT.fossils), из четырёх разных Бархан соберёт «Коллекцию окаменелостей»
  { id: 'fossil_shell', kind: 'fossil', e: ICON.fossil_shell, name: 'Ракушка-аммонит' },
  { id: 'fossil_leaf', kind: 'fossil', e: ICON.fossil_leaf, name: 'Отпечаток листа' },
  { id: 'fossil_tooth', kind: 'fossil', e: ICON.fossil_tooth, name: 'Зуб древнего ящера' },
  { id: 'fossil_bone', kind: 'fossil', e: ICON.fossil_bone, name: 'Косточка динозавра' },
  // джунгли (П.9): перья попугаев — каждый из трёх попугаев роняет своё перо раз в день, когда с ним поболтаешь; их
  // берёт рынок (JUNGLE.feathers), из трёх разных Лиана сделает «Перья в рамке»
  { id: 'feather_red', kind: 'feather', e: ICON.feather_red, name: 'Красное перо ары', c: '#e03131' },
  { id: 'feather_blue', kind: 'feather', e: ICON.feather_blue, name: 'Синее перо', c: '#1c7ed6' },
  { id: 'feather_yellow', kind: 'feather', e: ICON.feather_yellow, name: 'Жёлтое перо', c: '#fcc419' },
  // секретный пляж (П.9): редкие ракушки — море выносит их на песок бухты (1–2 в день, COVE.shells; виды по кругу);
  // их берёт рынок (COVE.shells.sell), из трёх разных русалочка Жемчужинка сделает «Ракушки в рамке»
  { id: 'shell_pink', kind: 'shell', e: ICON.shell_pink, name: 'Розовая ракушка', c: '#ff8fab' },
  { id: 'shell_spiral', kind: 'shell', e: ICON.shell_spiral, name: 'Витая ракушка', c: '#f4c27a' },
  { id: 'shell_sun', kind: 'shell', e: ICON.shell_sun, name: 'Ракушка-солнышко', c: '#ffd43b' },
  // удалённый остров (П.9): компас — подарок Капитана Боба за задание Лифтёра Этажкина (инструмент, только в подарок:
  // не продаётся и не покупается); вулканическое стекло — одно в день у подножия вулкана (рынок — ISLAND.obsidian,
  // из трёх Вождь Кокос вырежет «Маленький тотем»); цветы для леи — один в день, каждый день в новом месте, виды
  // по кругу (рынок — ISLAND.flowers, из трёх разных Вождь сплетёт «Лею из цветов»)
  { id: 'compass', kind: 'tool', e: '🧭', name: 'Компас' },
  { id: 'obsidian', kind: 'volcano', e: ICON.obsidian, name: 'Вулканическое стекло', c: '#343a40' },
  { id: 'flower_plumeria', kind: 'lei', e: ICON.flower_plumeria, name: 'Цветок плюмерии', c: '#fff3bf' },
  { id: 'flower_hibiscus', kind: 'lei', e: ICON.flower_hibiscus, name: 'Цветок гибискуса', c: '#ff6b6b' },
  { id: 'flower_orchid', kind: 'lei', e: ICON.flower_orchid, name: 'Орхидея', c: '#da77f2' },
];
/** Окаменелости по порядку — от частой к редкой («Раскопки» выдают их по кругу, features/desert.js). */
export const FOSSIL_IDS = FINDS.filter((f) => f.kind === 'fossil').map((f) => f.id);
/** Самоцветы по порядку — от частого к редкому (мини-игра «Кристаллы» выдаёт их по кругу, features/caves.js). */
export const GEM_IDS = FINDS.filter((f) => f.kind === 'gem').map((f) => f.id);
/** Перья попугаев по порядку попугаев (Кеша — красный, Рико — синий, Лимончик — жёлтый; features/jungle.js). */
export const FEATHER_IDS = FINDS.filter((f) => f.kind === 'feather').map((f) => f.id);
/** Редкие ракушки секретного пляжа по порядку — море выносит их по кругу (features/cove.js). */
export const SHELL_IDS = FINDS.filter((f) => f.kind === 'shell').map((f) => f.id);
/** Цветы для леи по порядку — каждый день распускается следующий (features/island.js). */
export const LEI_IDS = FINDS.filter((f) => f.kind === 'lei').map((f) => f.id);
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

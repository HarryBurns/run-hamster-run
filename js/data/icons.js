// РИСОВАННЫЕ ЗНАЧКИ ВЕЩЕЙ (этап 12). У шишки, эдельвейса, самоцветов, перьев и других находок нет своего эмодзи
// (или он одинаковый у трёх разных вещей, или есть не на всех устройствах) — их значки игра рисует сама
// (art/items.js). Чтобы значок попадал ВЕЗДЕ, где раньше стоял эмодзи (рюкзак, рынок, подсказки, награды, рецепты,
// подписи на карте), у вещи в поле `e` стоит не эмодзи, а особая буква из «частной» области Юникода (U+E000…):
//   - на канве её рисует emoji() из core/draw.js — картинкой из art/items.js;
//   - в окнах и подсказках её заменяет на картинку ui/itemicons.js (следит за страницей сам);
//   - там, где картинку вставить нельзя (всплывающая подпись title), — plainIcons(текст) вернёт запасные эмодзи.
// Как дать вещи рисованный значок: строка здесь (имя → запасной эмодзи), `e: ICON.имя` у вещи в data/finds.js или
// data/food.js и рисунок с тем же именем в art/items.js. Вещам без строки здесь ничего не нужно — у них обычный эмодзи.
const LIST = {
  cone: '🌰', // шишка (лес) и еловая шишка гербария
  porcini: '🍄', // белый гриб
  edelweiss: '🌼',
  glow_shroom: '🍄', // светящийся гриб из пещер
  gem_crystal: '💎',
  gem_topaz: '🔶',
  gem_sapphire: '🔷',
  gem_ruby: '🔴',
  fossil_shell: '🐚',
  fossil_leaf: '🍃',
  fossil_tooth: '🦷',
  fossil_bone: '🦴',
  cactus_fruit: '🌵',
  feather_red: '🪶',
  feather_blue: '🪶',
  feather_yellow: '🪶',
  shell_pink: '🐚',
  shell_spiral: '🐚',
  shell_sun: '🐚',
  obsidian: '🪨',
  flower_plumeria: '🌼',
  flower_hibiscus: '🌺',
  flower_orchid: '🌸',
  passionfruit: '🟣', // маракуйя
  map_piece: '🗺️', // кусочек карты сокровищ
  // блюда (этап 12)
  blini_jam: '🥞', // масленичные блины с вареньем
  blini_honey: '🥞', // масленичные блины с мёдом и маслом
  jam: '🍓', // лесное варенье
  honey_nuts: '🥜', // орешки в меду
  berry_bowl: '🍓', // земляника с молоком и мёдом
  passion_drink: '🍹', // морс из маракуйи
  // продукты
  sugar: '🍬', // мешочек сахара (у эмодзи-конфетки другой смысл)
};
const FIRST = 0xe000;
/** Имя значка → буква, которую кладут в поле `e` вещи. */
export const ICON = Object.fromEntries(Object.keys(LIST).map((name, i) => [name, String.fromCharCode(FIRST + i)]));
const NAME_BY_CH = Object.fromEntries(Object.entries(ICON).map(([name, ch]) => [ch, name]));
/** Поиск букв-значков в тексте (без флага g: для test). */
export const ICON_RE = /[\uE000-\uE0FF]/;
/** Имя рисованного значка по букве (или undefined — это обычный текст или эмодзи). */
export const iconName = (ch) => NAME_BY_CH[ch];
/** Запасной эмодзи значка по имени. */
export const iconFallback = (name) => LIST[name] || '';
/** Текст без букв-значков: вместо каждой — запасной эмодзи (для подписей, куда картинку не вставить). */
export const plainIcons = (str) => String(str).replace(/[\uE000-\uE0FF]/g, (ch) => LIST[NAME_BY_CH[ch]] || '');

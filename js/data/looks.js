// Внешность: хомячок по умолчанию и перевод «id вещей → вещи» для рисования.
// Маленькие чистые функции над таблицами — единственный «код» в data/.
import { CLOTHES_BY_ID, START_OUTFIT } from './clothes.js';
import { NPC_BY_ID, VENDORS } from './npcs.js';
import { holidayDress } from './holidays.js';

/** Самое длинное имя хомячка (поле на заставке, загрузка файлом, repair). */
export const NAME_MAX = 20;
/** Сколько слов может быть в имени героя. */
export const NAME_WORDS = 3;
const NAME_BAD = /[^A-Za-zА-Яа-яЁё \-]/g;
/**
 * Имя героя, пока его набирают: только буквы (русские и латинские), пробел и дефис; пробелы и дефисы не двоятся
 * и не стоят в начале; каждое слово и каждая часть через дефис — с заглавной буквы («анна-мария» → «Анна-Мария»);
 * не больше NAME_WORDS слов и NAME_MAX знаков. Пробел или дефис в конце остаётся — имя ещё дописывают.
 */
export function typeName(str) {
  let s = String(str == null ? '' : str)
    .replace(/[\u2010-\u2015\u2212]/g, '-') // длинные тире и «умные» дефисы с клавиатуры телефона
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(NAME_BAD, '')
    .replace(/ +/g, ' ')
    .replace(/-+/g, '-')
    .replace(/( -|- )[ -]*/g, ' ')
    .replace(/^[ -]+/, '');
  const words = s.split(' ');
  if (words.length > NAME_WORDS) s = words.slice(0, NAME_WORDS).join(' ');
  s = s.slice(0, NAME_MAX);
  return s.replace(/(^|[ -])([a-zа-яё])/g, (m, a, b) => a + b.toUpperCase());
}
/** Готовое имя героя: как typeName, без пробела и дефиса по краям. Пустая строка — имени нет. */
export const cleanName = (str) => typeName(str).replace(/[ -]+$/, '');
/** Что не так с набранным (для мягкой подсказки): 'chars' — не буквы, 'words' — слов больше трёх, 'long' — длинно, null. */
export function nameProblem(str) {
  const s = String(str == null ? '' : str)
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\s\u00a0]+/g, ' ');
  const letters = s.replace(NAME_BAD, '');
  if (letters !== s) return 'chars';
  if (s.replace(/^ +/, '').split(/ +/).length > NAME_WORDS) return 'words';
  if (s.trim().length > NAME_MAX) return 'long';
  return null;
}

/** Хомячок по умолчанию: белый с пятнышком, без одежды. */
export function defaultLook() {
  return {
    fur: '#ffffff',
    spots: '#2f2a2a',
    belly: null,
    ear: '#ffb3c1',
    outfit: { head: null, body: null, legs: null, feet: null, acc: null },
    beauty: { tuft: 0, hair: null, lashes: false, blush: '#ffb0bd', nails: null, bow: null },
  };
}
/**
 * С чем герой начинает игру: майка, джинсы и кроссовки — одинаково хомячку ('m') и хомячке ('f'); у хомячки ещё
 * реснички и розовый бантик (в салоне можно убрать или добавить — всем).
 */
export function startLook(gender) {
  const look = defaultLook();
  look.outfit = { ...START_OUTFIT };
  if (gender !== 'm') Object.assign(look.beauty, { lashes: true, bow: '#ff5c8a' });
  return look;
}
/** Превратить сохранённую внешность (с id вещей) в готовую для рисования (с объектами вещей). */
export function resolveLook(look) {
  const outfit = {};
  for (const k of ['head', 'body', 'legs', 'feet', 'acc']) {
    const v = look.outfit && look.outfit[k];
    outfit[k] = typeof v === 'string' ? CLOTHES_BY_ID[v] || null : v || null;
  }
  return { ...look, outfit };
}
const _npcLooks = {};
/**
 * Внешность жителя для рисования. fest — праздник, в чей наряд он одет (этап 15: HOLIDAY_DRESS в data/holidays.js;
 * сегодняшний — npcDress() в core/state.js); без него — обычная одежда. rain — что надето от дождя (RAIN_GEAR в
 * data/weather.js: { coat, boots } — дождевик и сапожки поверх наряда; у кого зонтик — одежда прежняя).
 */
export function npcLook(id, fest = null, rain = null) {
  const patch = holidayDress(fest, id),
    coat = rain && rain.coat ? { body: rain.coat, feet: rain.boots } : null,
    k = id + (patch ? '|' + fest : '') + (coat ? '|rain' : '');
  if (!_npcLooks[k]) {
    const base = NPC_BY_ID[id].look;
    _npcLooks[k] = resolveLook(patch || coat ? { ...base, outfit: { ...base.outfit, ...patch, ...coat } } : base);
  }
  return _npcLooks[k];
}
export function vendorLook(id) {
  const k = 'v_' + id;
  if (!_npcLooks[k]) _npcLooks[k] = resolveLook(VENDORS[id].look);
  return _npcLooks[k];
}

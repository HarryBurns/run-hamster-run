// Внешность: хомячок по умолчанию и перевод «id вещей → вещи» для рисования.
// Маленькие чистые функции над таблицами — единственный «код» в data/.
import { CLOTHES_BY_ID } from './clothes.js';
import { NPC_BY_ID, VENDORS } from './npcs.js';
import { holidayDress } from './holidays.js';

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
 * сегодняшний — npcDress() в core/state.js); без него — обычная одежда.
 */
export function npcLook(id, fest = null) {
  const patch = holidayDress(fest, id),
    k = patch ? id + '|' + fest : id;
  if (!_npcLooks[k]) {
    const base = NPC_BY_ID[id].look;
    _npcLooks[k] = resolveLook(patch ? { ...base, outfit: { ...base.outfit, ...patch } } : base);
  }
  return _npcLooks[k];
}
export function vendorLook(id) {
  const k = 'v_' + id;
  if (!_npcLooks[k]) _npcLooks[k] = resolveLook(VENDORS[id].look);
  return _npcLooks[k];
}

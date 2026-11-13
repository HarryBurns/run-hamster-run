// Внешность: хомячок по умолчанию и перевод «id вещей → вещи» для рисования.
// Маленькие чистые функции над таблицами — единственный «код» в data/.
import { CLOTHES_BY_ID } from './clothes.js';
import { NPC_BY_ID, VENDORS } from './npcs.js';

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
export function npcLook(id) {
  if (!_npcLooks[id]) _npcLooks[id] = resolveLook(NPC_BY_ID[id].look);
  return _npcLooks[id];
}
export function vendorLook(id) {
  const k = 'v_' + id;
  if (!_npcLooks[k]) _npcLooks[k] = resolveLook(VENDORS[id].look);
  return _npcLooks[k];
}

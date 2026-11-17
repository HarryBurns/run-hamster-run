// КУРОРТНЫЙ ОТЕЛЬ «Морская звезда» (П.17): номера, шведский стол и расписание — чистые таблицы и функции.
// Числа баланса (цена номера, спа, приз «Горки», часы аниматора) — HOTEL в economy.js; сцена отеля —
// interiors/hotel.js, что там происходит — features/hotel.js.
import { HOTEL } from './economy.js';
import { dayRoll, pickOn } from './stock.js';

/** Номера на втором этаже (двери в коридоре; свой номер на ночь — ROOM, люкс — дверь «Люкс»). */
export const HOTEL_DOORS = [201, 202, 203, 204, 205];
/** Номер, который сдают на ночь (комната справа от коридора). */
export const HOTEL_ROOM = 207;
/**
 * Номера на ночь разных классов (От2): стандарт — 207 (комната отеля справа от коридора, окно на море), эконом — 201
 * (окно во двор), с балконом — 202 (балкон на море). Эконом и балкон — свои маленькие сцены (interiors/hotel_rooms.js),
 * дверь в коридоре открывается, когда номер снят. id лежит в отметке дня dayFlags.hotel.room (1 — стандарт, как раньше).
 */
export const HOTEL_ROOMS = [
  { id: 'eco', no: 201, name: 'Эконом', icon: '🛏️', view: 'окно во двор', price: HOTEL.rooms.eco },
  { id: 'std', no: HOTEL_ROOM, name: 'Стандарт', icon: '🌊', view: 'окно на море', price: HOTEL.room },
  { id: 'balcony', no: 202, name: 'С балконом', icon: '🌅', view: 'свой балкон над морем', price: HOTEL.rooms.balcony },
];
/** Номер, где гостит житель (От1): к нему можно зайти в гости — дверь открыта. */
export const GUEST_ROOM = 203;
/** Кто из жителей гостит в номере GUEST_ROOM (не те, что отдыхают у бассейна, — POOL_GUESTS). */
export const ROOM_GUESTS = ['plusha', 'myata', 'prof', 'ponchik'];
/** Шведский стол: блюда из кафе, пляжного кафе и ресторана (цены — PRICES.cafe). Только «съесть тут». */
export const BUFFET = ['croissant', 'cocoa', 'cookies', 'watermelon', 'lemonade', 'pasta', 'pizza'];

/** Аниматор у бассейна: 'morning' (зарядка), 'evening' (дискотека) или null — его нет. minutes — время суток. */
export function animatorNow(minutes) {
  const h = minutes / 60,
    a = HOTEL.animator;
  if (h >= a.morning[0] && h < a.morning[1]) return 'morning';
  if (h >= a.evening[0] && h < a.evening[1]) return 'evening';
  return null;
}

/** Кто из жителей может прийти к бассейну отеля (те, кто любит воду и отдых). */
export const POOL_GUESTS = ['senya', 'zefirka', 'busya', 'bob'];
/**
 * Кто из жителей сегодня в это время отдыхает у бассейна отеля — id или null. Через день (жребий по номеру дня —
 * перезагрузка не меняет), только в часы HOTEL.poolGuest. Пока он здесь, в городе его нет (locations/town.js).
 */
export function poolGuestOn(day, minutes) {
  return poolGuestsOn(day, minutes)[0] || null;
}
/**
 * Все, кто из жителей сейчас у бассейна отеля (От4): смены HOTEL.poolSlots — утро, день, вечер; в смену приходят
 * один или двое (жребий по номеру дня — перезагрузка не меняет). Дневная смена — та же, что раньше (через день).
 */
export function poolGuestsOn(day, minutes) {
  const h = minutes / 60,
    i = HOTEL.poolSlots.findIndex((q) => h >= q.from && h < q.to);
  if (i < 0) return [];
  const q = HOTEL.poolSlots[i],
    key = i === 1 ? 'hotel:pool' : 'hotel:pool' + i;
  if (dayRoll(day, key) >= q.p) return [];
  const n = dayRoll(day, key + ':two') < q.two ? 2 : 1;
  return pickOn(day, key, q.who === 'room' ? ROOM_GUESTS : POOL_GUESTS, n);
}

/**
 * Кто из жителей сегодня в это время гостит в номере GUEST_ROOM — id или null. Через день (свой жребий — не в те же
 * дни, что бассейн, не обязательно), только в часы HOTEL.roomGuest. Пока он здесь, в городе его нет.
 */
export function roomGuestOn(day, minutes) {
  const h = minutes / 60;
  if (h < HOTEL.roomGuest.from || h >= HOTEL.roomGuest.to) return null;
  if (dayRoll(day, 'hotel:room') >= 0.5) return null;
  return pickOn(day, 'hotel:room', ROOM_GUESTS, 1)[0] || null;
}

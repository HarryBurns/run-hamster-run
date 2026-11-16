// КУРОРТНЫЙ ОТЕЛЬ «Морская звезда» (П.17): номера, шведский стол и расписание — чистые таблицы и функции.
// Числа баланса (цена номера, спа, приз «Горки», часы аниматора) — HOTEL в economy.js; сцена отеля —
// interiors/hotel.js, что там происходит — features/hotel.js.
import { HOTEL } from './economy.js';
import { dayRoll, pickOn } from './stock.js';

/** Номера на втором этаже (двери в коридоре; свой номер на ночь — ROOM, люкс — дверь «Люкс»). */
export const HOTEL_DOORS = [201, 202, 203, 204, 205];
/** Номер, который сдают на ночь (комната справа от коридора). */
export const HOTEL_ROOM = 207;
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
  const h = minutes / 60;
  if (h < HOTEL.poolGuest.from || h >= HOTEL.poolGuest.to) return null;
  if (dayRoll(day, 'hotel:pool') >= 0.5) return null;
  return pickOn(day, 'hotel:pool', POOL_GUESTS, 1)[0] || null;
}

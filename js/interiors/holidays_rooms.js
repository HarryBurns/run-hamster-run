// ПРАЗДНИК В ДОМАХ (этап 15, Пр2): общая часть всех домов (addSidePart движка домов) — в каждой комнате виллы,
// купленного жилья, домиков жителей и отеля гирлянда праздника под потолком и украшение у двери. Рисуется один раз
// на комнату в свою картинку (кэш на дом, комнату и праздник), в кадре — копия. Когда — как в городе: накануне,
// в праздник (и утром 1 января). Украшения за городом — locations/holidays_lands.js.
//
// Когда город украшен (decorNow) и как рисуется гирлянда (paintString), знают locations/holidays.js и holidays_art.js —
// из interiors/ их не взять (соседний слой), поэтому их передаёт features/holidays.js: setupRoomDecor({ … }).
import { G } from '../core/state.js';
import { FURN_BY_ID } from '../data/index.js';
import { makeCanvas } from '../core/draw.js';
import { ART } from '../engine/topdown/index.js';
import { addSidePart } from '../engine/side/scene.js';

let decorNow = () => false,
  paintString = () => {};

/** Гирлянда праздника под потолком и украшение у стены в комнатах. */
const ROOM = {
  newyear: { str: 'ny', art: 'hFirMini', a: 2 },
  xmas: { str: 'ny', art: 'hXmasPost', a: 1 },
  cny: { str: 'cny', art: 'hLanternPost' },
  maslenitsa: { str: 'mas', art: 'hFlowerPot', a: 1 },
  mayday: { str: 'may', art: 'hBalloons', a: 1 },
  kupala: { str: 'kup', art: 'hFlowerBasket' },
  halloween: { str: 'hal', art: 'hJack', a: 1, b: 1 },
};
/** Дома, где праздник не украшают: подводный грот, древние пирамида и храм. */
const NO_DECOR = new Set(['grotto_cave', 'pyramid_hall', 'temple_hall']);
// Картинки гирлянд — только для дома, где хомячок сейчас (на iPad картинка комнаты — до 2,5 МБ: «День гостей» в праздник
// обходит 8 домов), и только пока праздник: кончился или вышли в другой дом — кэш чистится.
const pics = new Map();
let picsFor = '', // праздник, для которого нарисованы картинки
  picsHouse = ''; // дом, для которого нарисованы картинки
/** Высота картинки гирлянды: нижний край подвесок — не ниже 76 (фонарики «cny», флажки и шарики «may»), и запас. */
const STRING_H = 96;
/** Картинка комнаты: гирлянда от x0 до x1 на высоте top + 16, высотой h. */
function roomPic(id, x0, x1, h) {
  const r = ROOM[id],
    { canvas, ctx } = makeCanvas(x1 - x0, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(14, 16);
  paintString(ctx, r.str, x1 - x0 - 28, 0, 0);
  return canvas;
}
/** Украшение у двери (праздник id) отдельной картинкой: { canvas, box } — box в единицах дома от точки на полу. */
let floorPic = null;
function floorArt(id) {
  if (floorPic && floorPic.id === id) return floorPic;
  const r = ROOM[id],
    art = ART[r.art];
  if (!art) return (floorPic = { id, canvas: null });
  const [l, t, rr, b] = art[0].map((v) => v * 0.9),
    { canvas, ctx } = makeCanvas(rr - l, b - t);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(-l, -t);
  ctx.scale(0.9, 0.9);
  art[1](ctx, r.a, r.b);
  return (floorPic = { id, canvas, box: [l, t, rr - l, b - t], hw: Math.max(-l, rr) * 0.8 });
}
/**
 * Где на полу комнаты с дверью поставить украшение: ближе к двери (сначала справа, потом слева), где не стоят ни мебель,
 * ни встроенные предметы (дверь, плита, ванна…). Ковры и настенное не мешают. Места нет (гостиная виллы заставлена) —
 * справа от двери: украшение всё равно видно, оно рисуется перед мебелью (В3).
 */
function freeSpot(sc, rm, door, hw, x0, x1) {
  const busy = [];
  for (const it of sc.items() || []) {
    const d = FURN_BY_ID[it.id];
    if (d && it.floor === rm.f && !d.wall && d.layer !== 0) busy.push([it.x - d.w / 2, it.x + d.w / 2]);
  }
  for (const b of sc.fixtures || []) if (b.f === rm.f && b.w) busy.push([b.x - b.w / 2, b.x + b.w / 2]);
  const free = (x) => x - hw >= x0 && x + hw <= x1 && busy.every(([a, b]) => x + hw + 6 <= a || x - hw - 6 >= b);
  for (let dx = 70; dx < rm.x1 - rm.x0; dx += 10) {
    if (free(door.x + dx)) return door.x + dx;
    if (free(door.x - dx)) return door.x - dx;
  }
  return Math.min(x1 - hw, door.x + 90);
}
/**
 * freeSpot с памятью: место меняется, только когда переставили мебель, — считать его каждый кадр незачем.
 * Ключ — дом, комната, ширина украшения и мебель этажа (что и где стоит).
 */
let spotKey = '',
  spotX = 0;
function spotFor(sc, rm, door, hw) {
  let key = `${sc.name}|${rm.f}|${rm.x0}|${door.x}|${hw}`;
  for (const it of sc.items() || []) if (it.floor === rm.f) key += `|${it.id}@${Math.round(it.x)}`;
  if (key !== spotKey) {
    spotKey = key;
    spotX = freeSpot(sc, rm, door, hw, rm.x0 + 12, rm.x1 - 12);
  }
  return spotX;
}
/** Праздник, который сейчас украшает этот дом, или ''. */
const roomHoliday = (sc) => (!G.state || NO_DECOR.has(sc.name) ? '' : Object.keys(ROOM).find(decorNow) || '');
/** Гирлянда — позади всего. */
function drawGarlands(ctx, sc) {
  const id = roomHoliday(sc);
  if (picsFor !== id || picsHouse !== sc.name) {
    pics.clear(); // праздник сменился (или кончился), или это другой дом — старые картинки не нужны
    picsFor = id;
    picsHouse = sc.name;
  }
  if (!id) return;
  const rooms = sc.desc.rooms || [],
    view = sc.view;
  rooms.forEach((rm, i) => {
    const y = sc.geo.fy(rm.f),
      top = y - sc.geo.RH;
    if (view && (y < view.y0 - 20 || top > view.y1 + 20)) return; // этаж не на экране
    const x0 = rm.x0 + 12,
      x1 = rm.x1 - 12;
    if (x1 - x0 < 160) return;
    const key = `${sc.name}:${i}:${x0}:${x1}:${top}`; // дом достроили («Вилла растёт») — комнаты другие
    let pic = pics.get(key);
    const h = Math.min(STRING_H, y - top + 12);
    if (!pic) pics.set(key, (pic = roomPic(id, x0, x1, h)));
    ctx.drawImage(pic, x0, top, x1 - x0, h);
  });
}
/** Украшение на полу у двери — перед мебелью, но за жильцами и хомячком (В3: раньше пряталось за торшером и диваном). */
function drawDoorDecor(ctx, sc) {
  const id = roomHoliday(sc);
  if (!id) return;
  const door = sc.desc.door || { f: 0, x: 100 },
    rm = (sc.desc.rooms || []).find((q) => q.f === door.f && door.x >= q.x0 && door.x <= q.x1);
  if (!rm || rm.x1 - rm.x0 < 184) return;
  const pic = floorArt(id);
  if (!pic.canvas) return;
  const y = sc.geo.fy(rm.f),
    view = sc.view;
  if (view && (y < view.y0 - 20 || y - sc.geo.RH > view.y1 + 20)) return;
  const at = spotFor(sc, rm, door, pic.hw),
    [l, t, w, h] = pic.box;
  sc.holidayDecorAt = at; // для тестов
  ctx.drawImage(pic.canvas, at + l, y - 2 + t, w, h);
}
/** Включить украшения в домах: decorNow(id) — украшен ли город к празднику id, paintString — рисунок гирлянды. */
export function setupRoomDecor(o) {
  decorNow = o.decorNow;
  paintString = o.paintString;
  addSidePart({ back: drawGarlands, front: drawDoorDecor });
}

// ---------- холл Хомяк-Тауэра (interiors/tower.js — не на движке домов, Т2) ----------
/** Праздник, который сейчас украшает холл башни, или ''. */
export const hallHoliday = () => (G.state ? Object.keys(ROOM).find(decorNow) || '' : '');
const hallPics = new Map(); // «праздник:x0:x1» → картинка гирлянды
/** Гирлянда праздника id под потолком холла: от x0 до x1, потолок на высоте top. */
export function drawHallGarland(ctx, id, x0, x1, top) {
  const key = `${id}:${x0}:${x1}`;
  let pic = hallPics.get(key);
  if (!pic) {
    if (hallPics.size > 4) hallPics.clear(); // праздник сменился — старые картинки не нужны
    hallPics.set(key, (pic = roomPic(id, x0, x1, STRING_H)));
  }
  ctx.drawImage(pic, x0, top, x1 - x0, STRING_H);
}
/** Украшение праздника id на полу холла в точке x (пол — y). */
export function drawHallFloor(ctx, id, x, y) {
  const pic = floorArt(id);
  if (!pic.canvas) return;
  const [l, t, w, h] = pic.box;
  ctx.drawImage(pic.canvas, x + l, y - 2 + t, w, h);
}

/** Для тестов: какой праздник украшает дома и сколько комнат уже нарисовано. */
export const debugRoomDecor = () => ({ holiday: picsFor, rooms: pics.size });

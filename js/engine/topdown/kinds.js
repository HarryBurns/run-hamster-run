// «Движок локаций»: РЕЕСТР ВИДОВ — из чего собирают карты «вид сверху».
//
// Три таблицы: виды клеток земли, виды предметов и виды зданий. Общие виды (трава, дорога, вода, деревья,
// кусты, заборы, скамейки, дома…) записаны в js/locations/common/, свои — в файле локации.
// Вид добавляют один раз, имя — общее на всю игру (повтор имени — предупреждение в консоли).
//
// КЛЕТКА  defineTiles({ имя: { … } })      имя — любая строка; в сетке карты лежат эти имена
//   draw(ctx, x, y, tx, ty, env)   нарисовать клетку: (x, y) — её левый верхний угол в единицах мира
//   map                            цвет на мини-карте: строка или (env) => строка
//   walk                           false — пешком нельзя; функция () => bool — «когда можно» (пруд — только зимой)
//   block: true                    сюда нельзя встать никому (грядка)
//   wet: true                      вода: жители сюда не ходят
//   swim: { clip, where }          хомячок здесь плывёт: clip — насколько он в воде, where — что сообщить событию swim
//   slide: true                    лёд: хомячок скользит, а не шагает
//   speed                          скорость героя на этой клетке (обычная — 225)
//   step, stepEvery                звук шага (имя из core/audio.js или () => имя) и как часто (0,3 с)
//   onEnter(sc)                    герой ступил на клетку этого вида с клетки другого вида
//   like: 'вид'                    «как этот вид»: рисунок, звук и прочее берутся у него, свои поля — поверх
//
// ПРЕДМЕТ  defineObjects({ имя: { … } })
//   art: { рисунок: [рамка, paint] }   неподвижные части для кэша спрайтов — см. put() ниже
//   draw(ctx, o, env)              нарисовать предмет o ({ type, tx, ty, x, y, … }) — обычно это вызовы put()
//   solid                          true — на клетку предмета не встать; [[dx, dy], …] — занятые клетки
//   slow, rustle                   «медленная» клетка: множитель скорости (куст — 0,5) и звук, когда в неё входят
//   flat: true                     лежит на земле: рисуется под всем, что стоит (цветы, лежак)
//   map                            (env) => цвет точки на мини-карте (деревья)
//   tap: { dx, up, down, ox }      зона нажатия вокруг предмета;  use(sc, o) — что делает подошедший хомячок
//
// ЗДАНИЕ  defineBuildings({ вид: { … } })
//   paint(ctx, b, snow, lit)       нарисовать здание b ({ id, kind, x, y, w, h, … }) в координатах мира
//   box(b)                         рамка спрайта вокруг левого верхнего угла «пятна» здания
//   hitUp(b)                       на сколько рисунок выше «пятна» — для попадания пальцем
//   live(ctx, b, t, env)           то, что шевелится (рисуется поверх спрайта каждый кадр)
//   lights(b)                      пятна света ночью: [[x, y, радиус], …] в единицах мира (у окон и дверей)
//   icon                           значок на карте, если у самого здания его нет
//   mapDraw(ctx, b, k)             своя отметка на мини-карте вместо значка
//
// env (одно на кадр): { t — время, season — сезон, dark — темнота 0..1, map — карта, hero — герой, sc — сцена }.
import { SpriteSet } from '../../core/sprites.js';
import { fillRR } from '../../core/draw.js';

/** Размер клетки в единицах мира. Под него нарисованы все спрайты и хомячок — у всех локаций он один. */
export const T = 48;
/** Цвет контура. */
export const OUT = '#4a3728';
/** Масштаб хомячка на картах «вид сверху». */
export const PS = 0.78;
export const tileOf = (px) => Math.floor(px / T);

export const TILES = {},
  OBJECTS = {},
  BUILDING_KINDS = {},
  ART = {};

function define(table, what, defs) {
  for (const [id, d] of Object.entries(defs)) {
    if (table[id]) console.warn(`${what} «${id}» определён дважды`);
    table[id] = { id, ...d };
  }
}
/**
 * Добавить виды клеток: { имя: { draw, map, walk, wet, swim, speed, step, … } }.
 * like: 'вид' — «выглядит и звучит как этот вид» (он уже должен быть определён): свои поля записываются поверх.
 */
export function defineTiles(defs) {
  const out = {};
  for (const [id, d] of Object.entries(defs)) {
    if (d.like && !TILES[d.like]) throw new Error(`Вид клетки «${id}»: нет вида «${d.like}» (like)`);
    out[id] = d.like ? { ...TILES[d.like], ...d } : d;
  }
  define(TILES, 'Вид клетки', out);
}
/** Добавить виды предметов: { имя: { art, draw, solid, slow, flat, map, tap, use } }. */
export function defineObjects(defs) {
  for (const d of Object.values(defs)) if (d.art) defineArt(d.art);
  define(OBJECTS, 'Вид предмета', defs);
}
/** Добавить виды зданий: { вид: { paint, box, hitUp, live, icon, mapDraw } }. */
export const defineBuildings = (defs) => define(BUILDING_KINDS, 'Вид здания', defs);
/**
 * Добавить рисунки для кэша спрайтов: { имя: [рамка [x0, y0, x1, y1] с запасом, paint(ctx, a, b)] }.
 * paint рисует вокруг точки (0, 0) — центра клетки предмета; a, b — параметры (сезон, вариант…), они входят в ключ.
 * Здесь только неподвижные части; всё, что шевелится, дорисовывает draw предмета.
 */
export const defineArt = (defs) => define(ART, 'Рисунок', defs);

/** Кэш спрайтов — один на все локации: ключи общие, а масштаб у всех карт одинаковый. */
export const SP = new SpriteSet();
/** Нарисовать рисунок из ART в точке мира (x, y) — копией из кэша. a, b — параметры рисунка (часть ключа). */
export function put(name, x, y, a, b) {
  const key = b !== undefined ? `${name}:${a}:${b}` : a !== undefined ? `${name}:${a}` : name;
  let s = SP.find(key);
  if (!s) {
    const art = ART[name];
    s = SP.get(key, art[0], (c) => art[1](c, a, b));
  }
  SP.draw(s, x, y);
}

/** Постоянное «случайное» число 0..1 для клетки — чтобы пятнышки на земле не прыгали от кадра к кадру. */
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
  return (h & 0xffff) / 0xffff;
}

/** Табличка с подписью (вывеска, имя жителя). */
export function label(ctx, text, cx, cy, maxW, size, bg, fg = OUT) {
  ctx.font = `900 ${size}px ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif`;
  let tw = ctx.measureText(text).width;
  if (tw > maxW - 14) {
    size *= (maxW - 14) / tw;
    ctx.font = `900 ${size}px ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif`;
    tw = maxW - 14;
  }
  fillRR(ctx, cx - tw / 2 - 8, cy - size * 0.75, tw + 16, size * 1.5, size * 0.5, bg, OUT, 2);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

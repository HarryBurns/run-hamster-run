// «Движок локаций»: КАРТА из описания — сетка клеток, препятствия, «медленные» клетки, предметы, здания.
//
// createMap(описание) строит карту один раз. Сетку задают одним из двух способов (можно и обоими сразу):
//
//   rows + legend   картинка из строк: каждый символ — клетка. legend: { '.': 'g', 'T': ['g', 'tree'],
//                   'M': ['g', 'mushroom', { v: 2 }] } — вид клетки и, если надо, предмет на ней.
//                   Символ без записи в legend — сам себе имя вида клетки.
//   w, h + build(m) правила: функция получает карту и заполняет её (m.fill, m.set, m.add, m.block).
//                   base — чем залита карта до правил ('g').
//
// В build(m) доступны: m.fill(x0, y0, x1, y1, вид), m.set(x, y, вид), m.at(x, y), m.add(предмет, x, y, поля),
// m.block(x, y), m.ground / m.solid (сетки [y][x]), m.objs, m.buildings, m.w, m.h.
// Предмет сам занимает клетку, если его вид «твёрдый» (solid) или в полях передано solid: true;
// «медленный» вид (slow) помечает клетку медленной. Здания (описание.buildings) занимают своё «пятно».
//
// После постройки: m.kindAt(tx, ty) — вид клетки; m.foot / m.dry — «можно ли пройти» для героя пешком и для
// жителей (их передают в поиск пути, см. path.js); m.route(кто, x, y, точно, pass) — проложить путь.
import { clamp } from '../../core/util.js';
import { T, TILES, OBJECTS, BUILDING_KINDS, tileOf } from './kinds.js';
import { findPath, nearest } from './path.js';

/** Размер карты в клетках по описанию (не строя её). */
export function mapSize(desc) {
  if (desc.rows) return { w: Math.max(...desc.rows.map((r) => r.length)), h: desc.rows.length };
  return { w: desc.w, h: desc.h };
}

export function createMap(desc) {
  const { w, h } = mapSize(desc);
  const name = `Локация «${desc.id}»`;
  if (!(w > 0 && h > 0)) throw new Error(`${name}: не задан размер карты (w, h или rows)`);
  const ground = Array.from({ length: h }, () => Array(w).fill(desc.base || 'g'));
  const solid = Array.from({ length: h }, () => Array(w).fill(false));
  const slow = Array.from({ length: h }, () => Array(w).fill(null)); // предмет, который замедляет, или null
  const objs = [];
  const buildings = desc.buildings || [];
  for (const b of buildings) {
    if (!BUILDING_KINDS[b.kind]) throw new Error(`${name}: неизвестный вид здания «${b.kind}» (${b.id})`);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) solid[y][x] = true;
  }

  const m = {
    id: desc.id,
    desc,
    w,
    h,
    ground,
    solid,
    slow,
    objs,
    buildings,
    bById: Object.fromEntries(buildings.map((b) => [b.id, b])),
    water: desc.water || {}, // подсказки рисункам воды: { shoreY, foamY }
    kinds: null, // виды клеток [y][x] — после постройки
    tappable: [], // предметы, на которые можно нажать

    // ---------- для правил постройки ----------
    at: (tx, ty) => (ground[ty] ? ground[ty][tx] : undefined),
    set(x, y, c) {
      if (ground[y] && ground[y][x] !== undefined) ground[y][x] = c;
    },
    fill(x0, y0, x1, y1, c) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, c);
    },
    block(x, y) {
      solid[y][x] = true;
    },
    /** Поставить предмет вида type на клетку (tx, ty); o — свои поля (v — вариант, solid: true…). */
    add(type, tx, ty, o = {}) {
      const kind = OBJECTS[type];
      if (!kind) throw new Error(`${name}: неизвестный вид предмета «${type}»`);
      const ob = { type, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ...o };
      ob.sy = ob.y + (kind.flat ? -40 : 14); // глубина для сортировки: «плоское» — под всем остальным
      objs.push(ob);
      const s = o.solid !== undefined ? o.solid : kind.solid;
      if (s === true) solid[ty][tx] = true;
      else if (s) for (const [dx, dy] of s) solid[ty + dy][tx + dx] = true;
      if (kind.slow) slow[ty][tx] = ob;
      if (kind.tap) m.tappable.push(ob);
      return ob;
    },

    // ---------- после постройки ----------
    kindAt: (tx, ty) => (m.kinds[ty] ? m.kinds[ty][tx] : undefined),
    inside: (px, py) => px >= 0 && px < w * T && py >= 0 && py < h * T,
    /** Предмет, который замедляет идущего через точку (px, py), или null. */
    slowAt(px, py) {
      const row = slow[tileOf(py)];
      return (row && row[tileOf(px)]) || null;
    },
    /** Где стоят, войдя в здание или выйдя из него: под дверью (дверь — снизу по центру «пятна»). */
    doorPx: (b) => ({ x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + T * 0.45 }),
    nearest: (pass, tx, ty, maxR) => nearest(pass, tx, ty, maxR),
    path: (pass, sx, sy, tx, ty) => findPath(w, h, pass, sx, sy, tx, ty),
    /**
     * Проложить путь для ent ({ x, y, path }) к точке (px, py). exact — закончить ровно в точке, а не в центре
     * клетки. pass — кто идёт (m.foot, m.dry или свой). false — дойти нельзя.
     */
    route(ent, px, py, exact, pass) {
      const s = nearest(pass, tileOf(ent.x), tileOf(ent.y), 3) || [tileOf(ent.x), tileOf(ent.y)];
      const t = nearest(pass, clamp(tileOf(px), 0, w - 1), clamp(tileOf(py), 0, h - 1));
      if (!t) return false;
      const path = findPath(w, h, pass, s[0], s[1], t[0], t[1]);
      if (!path) return false;
      if (exact && t[0] === tileOf(px) && t[1] === tileOf(py)) {
        if (path.length) path[path.length - 1] = { x: px, y: py };
        else path.push({ x: px, y: py });
      }
      ent.path = path;
      return true;
    },
  };

  // картинка из строк
  if (desc.rows) {
    const legend = desc.legend || {};
    desc.rows.forEach((row, y) => {
      [...row].forEach((chr, x) => {
        const e = legend[chr];
        if (e === undefined) ground[y][x] = chr;
        else if (typeof e === 'string') ground[y][x] = e;
        else {
          ground[y][x] = e[0];
          if (e[1]) m.add(e[1], x, y, e[2] || {});
        }
      });
    });
  }
  if (desc.build) desc.build(m);

  // виды клеток; клетки-преграды
  m.kinds = ground.map((row, y) =>
    row.map((c, x) => {
      const k = TILES[c];
      if (!k) throw new Error(`${name}: неизвестный вид клетки «${c}» в (${x}, ${y})`);
      if (k.block) solid[y][x] = true;
      return k;
    }),
  );
  const kinds = m.kinds;
  /** Может ли пройти герой пешком. */
  m.foot = (tx, ty) => {
    const row = kinds[ty],
      k = row && row[tx];
    if (!k) return false;
    if (k.walk !== undefined && (k.walk === false || (typeof k.walk === 'function' && !k.walk()))) return false;
    return !solid[ty][tx];
  };
  /** Может ли пройти житель: только по суше. */
  m.dry = (tx, ty) => {
    const row = kinds[ty],
      k = row && row[tx];
    return !!k && !k.wet && m.foot(tx, ty);
  };
  return m;
}

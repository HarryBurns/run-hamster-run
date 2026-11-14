// «Движок локаций»: поиск пути по клеткам — чистые функции.
//
// Кто и где может пройти, решает pass(tx, ty) → bool: его передают в каждый вызов. У карты есть готовые
// (map.foot — герой пешком, map.dry — жители, только по суше); свой способ передвижения (кораблик) даёт свой pass.
// Глобальных переключателей «режима» здесь нет.
import { T } from './kinds.js';

/** Ближайшая к (tx, ty) клетка, куда можно встать, в пределах maxR клеток: [x, y] или null. */
export function nearest(pass, tx, ty, maxR = 7) {
  if (pass(tx, ty)) return [tx, ty];
  for (let r = 1; r <= maxR; r++) {
    let best = null,
      bd = 1e9;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (pass(tx + dx, ty + dy)) {
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = [tx + dx, ty + dy];
          }
        }
      }
    if (best) return best;
  }
  return null;
}

/**
 * Путь (A*, восемь направлений, углы не срезаются) по карте w × h клеток из клетки (sx, sy) в клетку (tx, ty).
 * Возвращает точки пути в единицах мира — центры клеток: первая клетка, повороты и цель; [] — уже на месте;
 * null — пути нет.
 */
export function findPath(w, h, pass, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const idx = (x, y) => y * w + x;
  const open = [],
    gS = new Float32Array(w * h).fill(1e9),
    from = new Int32Array(w * h).fill(-1),
    closed = new Uint8Array(w * h);
  const push = (i, f) => {
    open.push([f, i]);
    let k = open.length - 1;
    while (k > 0) {
      const pIdx = (k - 1) >> 1;
      if (open[pIdx][0] <= open[k][0]) break;
      [open[pIdx], open[k]] = [open[k], open[pIdx]];
      k = pIdx;
    }
  };
  const pop = () => {
    const top = open[0],
      last = open.pop();
    if (open.length) {
      open[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1,
          r = l + 1;
        let m = k;
        if (l < open.length && open[l][0] < open[m][0]) m = l;
        if (r < open.length && open[r][0] < open[m][0]) m = r;
        if (m === k) break;
        [open[m], open[k]] = [open[k], open[m]];
        k = m;
      }
    }
    return top[1];
  };
  const hF = (x, y) => {
    const dx = Math.abs(x - tx),
      dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  gS[idx(sx, sy)] = 0;
  push(idx(sx, sy), hF(sx, sy));
  const goal = idx(tx, ty);
  let found = false,
    guard = 0;
  while (open.length && guard++ < 30000) {
    const cur = pop();
    if (cur === goal) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w,
      cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx,
          ny = cy + dy;
        if (!pass(nx, ny)) continue;
        if (dx && dy && (!pass(cx + dx, cy) || !pass(cx, cy + dy))) continue;
        const ni = idx(nx, ny),
          ng = gS[cur] + (dx && dy ? 1.41 : 1);
        if (ng < gS[ni]) {
          gS[ni] = ng;
          from[ni] = cur;
          push(ni, ng + hF(nx, ny));
        }
      }
  }
  if (!found) return null;
  const cells = [];
  for (let c = goal; c !== idx(sx, sy) && c !== -1; c = from[c]) cells.push(c);
  cells.reverse();
  // точки на одной прямой пропускаем: остаются первая клетка, повороты и цель
  const path = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (i > 0 && i < cells.length - 1 && cells[i + 1] - c === c - cells[i - 1]) continue;
    path.push({ x: ((c % w) + 0.5) * T, y: (((c / w) | 0) + 0.5) * T });
  }
  return path;
}

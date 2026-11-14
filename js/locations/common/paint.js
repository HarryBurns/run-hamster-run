// ОБЩИЕ ПРИЁМЫ РИСОВАНИЯ мира «вид сверху»: тени, объём, вывески, палитра. Ими рисуют клетки земли (tiles.js),
// предметы (objects.js, props.js) и здания (buildings.js) — и ими же стоит рисовать новые локации,
// чтобы всё выглядело одной рукой.
//
// Правила стиля:
//  - контур — тёплый тёмно-коричневый OUT, 2–2,5 единицы у крупных форм, 1–1,5 у деталей; у земли контуров нет;
//  - объём — 2–3 тона: основной цвет, тень справа-снизу (shade(c, -0.14)) и блик слева-сверху (shade(c, 0.2));
//    свет всегда слева сверху;
//  - тень на земле — мягкий эллипс SHADOW под предметом, чуть сдвинутый вправо (shadow());
//  - тёплая палитра: дерево WOOD, камень STONE, черепица — цвет здания; зелень — LEAF по сезону.
import { TAU } from '../../core/util.js';
import { ell, fillRR, poly, rr, shade } from '../../core/draw.js';
import { OUT } from '../../engine/topdown/kinds.js';

/** Цвет тени на земле. */
export const SHADOW = 'rgba(52,38,70,.17)';
export const WOOD = '#c98b5a',
  WOOD_D = '#a8703f',
  WOOD_L = '#e0ac78',
  STONE = '#cfd4da',
  STONE_D = '#aab2bd',
  SNOW = '#ffffff',
  SNOW_D = '#d6e8f5',
  GOLD = '#ffd43b',
  LIT = '#ffe48a'; // окно, в котором горит свет

/** Листва по сезону: [тёмный, основной, светлый] тон; v — вариант (0..2). */
export function leafTones(sea, v = 0) {
  const base =
    sea === 'winter'
      ? '#eef7fd'
      : sea === 'autumn'
        ? ['#f59f00', '#e8590c', '#fcc419'][v % 3]
        : sea === 'spring'
          ? ['#8ce99a', '#74d680', '#b2f2bb'][v % 3]
          : ['#40c057', '#37b24d', '#51cf66'][v % 3];
  return [shade(base, sea === 'winter' ? -0.1 : -0.2), base, shade(base, sea === 'winter' ? 0.5 : 0.28)];
}

/** Мягкая тень на земле под предметом: эллипс с центром (x, y). */
export function shadow(ctx, x, y, rx, ry, a) {
  ctx.fillStyle = a ? `rgba(52,38,70,${a})` : SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.12, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
/** Линейный градиент двумя цветами (сверху вниз, если не заданы x). */
export function grad(ctx, y0, y1, c0, c1, x0 = 0, x1 = 0) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}
/** Шар-«клубок» с объёмом: основной тон, тень снизу справа, блик сверху слева. Для крон, кустов, облаков. */
export function puff(ctx, x, y, rx, ry, tones, lw = 2) {
  ell(ctx, x, y, rx, ry, tones[1], lw ? OUT : null, lw);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.clip();
  ell(ctx, x + rx * 0.35, y + ry * 0.5, rx, ry * 0.8, tones[0]);
  ell(ctx, x - rx * 0.05, y - ry * 0.12, rx * 0.92, ry * 0.86, tones[1]);
  ell(ctx, x - rx * 0.32, y - ry * 0.42, rx * 0.42, ry * 0.3, tones[2]);
  ctx.restore();
}
/** Прямоугольник со скруглением и объёмом: блик сверху, тень снизу. */
export function box(ctx, x, y, w, h, r, col, lw = 2) {
  fillRR(ctx, x, y, w, h, r, col);
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(x, y, w, Math.min(5, h * 0.3));
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.fillRect(x, y + h - Math.min(5, h * 0.3), w, Math.min(5, h * 0.3));
  ctx.restore();
  if (lw) fillRR(ctx, x, y, w, h, r, null, OUT, lw);
}
/** Дощатая поверхность: горизонтальные доски с тёмными швами. */
export function planks(ctx, x, y, w, h, col = WOOD, step = 8) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  for (let yy = y + step; yy < y + h - 1; yy += step) ctx.fillRect(x, yy, w, 1.4);
}
/** Шапка снега сверху предмета: белая «подушка» шириной w с центром (x, y). */
export function snowCap(ctx, x, y, w, h = 7) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y - h, x - w / 4, y - h);
  ctx.quadraticCurveTo(x, y - h * 1.5, x + w / 4, y - h);
  ctx.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y);
  ctx.quadraticCurveTo(x + w / 4, y + h * 0.5, x, y + h * 0.2);
  ctx.quadraticCurveTo(x - w / 4, y + h * 0.5, x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = SNOW;
  ctx.fill();
  ctx.strokeStyle = SNOW_D;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
const FONT = 'ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif';
/** Текст по центру (cx, cy), ужатый до maxW. Возвращает итоговый размер шрифта. */
export function fitText(ctx, str, cx, cy, maxW, size, fill, stroke) {
  ctx.font = `900 ${size}px ${FONT}`;
  const tw = ctx.measureText(str).width;
  if (tw > maxW) {
    size *= maxW / tw;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.lineJoin = 'round';
    ctx.strokeText(str, cx, cy + 1);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, cx, cy + 1);
  return size;
}
/**
 * ВЫВЕСКА с текстом, центр (cx, cy), ширина w, высота h. kind:
 *   'wood'    деревянная доска с гвоздиками (лавки, дома, указатели)
 *   'plate'   цветная табличка с белой каймой (col — цвет)
 *   'neon'    тёмная панель со светящимися буквами (col — цвет свечения; lit — ночью ярче)
 *   'banner'  светлая лента-маркиза
 * Возвращает ничего; текст сам ужимается под ширину.
 */
export function signBoard(ctx, text, cx, cy, w, h, kind = 'wood', col = '#e64980', lit = false) {
  const x = cx - w / 2,
    y = cy - h / 2;
  if (kind === 'wood') {
    fillRR(ctx, x, y + 2, w, h, 5, 'rgba(0,0,0,.18)');
    fillRR(ctx, x, y, w, h, 5, WOOD_L, OUT, 2);
    ctx.fillStyle = 'rgba(120,70,30,.22)';
    ctx.fillRect(x + 3, y + h * 0.48, w - 6, 1.5);
    for (const sx of [x + 5, x + w - 5]) ell(ctx, sx, cy, 1.6, 1.6, '#7a4a22');
    fitText(ctx, text, cx, cy, w - 18, h * 0.62, '#5b3413');
  } else if (kind === 'plate') {
    fillRR(ctx, x, y + 2, w, h, h * 0.35, 'rgba(0,0,0,.18)');
    fillRR(ctx, x, y, w, h, h * 0.35, '#fff', OUT, 2);
    fillRR(ctx, x + 3, y + 3, w - 6, h - 6, h * 0.28, col);
    fitText(ctx, text, cx, cy, w - 18, h * 0.6, '#fff', 'rgba(0,0,0,.25)');
  } else if (kind === 'neon') {
    fillRR(ctx, x, y, w, h, 6, '#2b2440', OUT, 2);
    fillRR(ctx, x + 3, y + 3, w - 6, h - 6, 4, null, lit ? shade(col, 0.3) : shade(col, -0.1), 1.5);
    if (lit) {
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 8;
      fitText(ctx, text, cx, cy, w - 18, h * 0.62, shade(col, 0.55));
      ctx.restore();
    }
    fitText(ctx, text, cx, cy, w - 18, h * 0.62, lit ? '#fff' : shade(col, 0.45));
  } else {
    fillRR(ctx, x, y + 2, w, h, 4, 'rgba(0,0,0,.15)');
    fillRR(ctx, x, y, w, h, 4, '#fffaf0', OUT, 2);
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    ctx.fillRect(x + 2, y + h - 5, w - 4, 3);
    fitText(ctx, text, cx, cy, w - 16, h * 0.56, shade(col, -0.35));
  }
}
/** Полосатый навес-маркиза: от (x, y) шириной w, высотой h; n полос, цвета c1/c2; низ — фестонами. */
export function awning(ctx, x, y, w, h, n, c1, c2 = '#fff') {
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.moveTo(x + i * sw, y);
    ctx.lineTo(x + (i + 1) * sw, y);
    ctx.lineTo(x + (i + 1) * sw, y + h - sw / 2);
    ctx.arc(x + (i + 0.5) * sw, y + h - sw / 2, sw / 2, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(x, y, w, 3);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}
/** Цветок: пять лепестков вокруг серединки. */
export function flower(ctx, x, y, r, col, mid = '#ffa94d') {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - 1.57;
    ctx.moveTo(x + Math.cos(a) * r + r * 0.72, y + Math.sin(a) * r);
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, TAU);
  }
  ctx.fill();
  ell(ctx, x, y, r * 0.5, r * 0.5, mid);
}
/** Треугольная крыша/фронтон и т. п. — многоугольник с бликом по левому скату. */
export function shaded(ctx, pts, col, lw = 2.5) {
  poly(ctx, pts, col, OUT, lw);
}

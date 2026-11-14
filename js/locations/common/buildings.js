// ОБЩИЕ ВИДЫ ЗДАНИЙ и «конструктор» для рисования зданий — для любых локаций «вид сверху»
// (как описывать вид — engine/topdown/kinds.js).
//
//   house   домик жителя (поле npc — чей; на дощечке его имя; shutters — цвет ставней; art(ctx, g, snow, lit) —
//           своя дорисовка поверх: якорь, телескоп, цветы…; smoke: true — из трубы всегда идёт дымок)
//   shop    лавка с навесом и вывеской                       mall   большой магазин с витринами
//   tower   высотка (поле floors — этажи)
//
// Здание в описании локации: { id, kind, x, y, w, h, name, icon, wall, roof, act }. Цвета wall и roof — свои
// у каждого здания. Снег на крыше и свет в окнах рисунок получает параметрами (snow, lit).
//
// КОНСТРУКТОР (экспортируется): geom, baseShadow, wall, roof, gable, win, door, chimney, steps, glow — из них
// собраны все здания города (locations/town_buildings.js); новые здания стоит собирать из них же.
// Свет ночью: вид здания может вернуть lights(b) → [[x, y, радиус], …] — пятна тёплого света у окон и дверей.
import { NPC_BY_ID } from '../../data/index.js';
import { TAU } from '../../core/util.js';
import { ell, fillRR, line, poly, rr, shade } from '../../core/draw.js';
import { T, OUT, SP, hash, defineBuildings } from '../../engine/topdown/kinds.js';
import { SHADOW, STONE, LIT, signBoard, awning, flower, grad, snowCap } from './paint.js';

/** Размеры «пятна» здания b в единицах мира. */
export const geom = (b) => {
  const X = b.x * T,
    Y = b.y * T,
    W = b.w * T,
    H = b.h * T;
  return { X, Y, W, H, bot: Y + H, cx: X + W / 2 };
};
/** Мягкая тень здания на земле (под нижним краем, чуть вправо). */
export function baseShadow(ctx, g, pad = 6) {
  fillRR(ctx, g.X - pad + 8, g.bot - 9, g.W + pad * 2, 18, 9, SHADOW);
}
/**
 * Стена: o.r — скругление; o.plinth — цвет цоколя (false — без него); o.siding — шаг горизонтальной вагонки;
 * o.brick: true — редкие кирпичики; o.eave — тень от крыши сверху (высота).
 */
export function wall(ctx, x, y, w, h, col, o = {}) {
  const r = o.r === undefined ? 5 : o.r;
  fillRR(ctx, x, y, w, h, r, col);
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  if (o.siding) {
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    for (let yy = y + o.siding; yy < y + h; yy += o.siding) ctx.fillRect(x, yy, w, 1.3);
  }
  if (o.brick) {
    ctx.fillStyle = shade(col, -0.1);
    for (let i = 0; i < Math.round((w * h) / 2600); i++) {
      const bx = x + 8 + hash(i * 7 + 1, Math.round(x)) * (w - 30),
        by = y + 10 + Math.floor(hash(i * 3 + 2, Math.round(y)) * ((h - 30) / 8)) * 8;
      ctx.fillRect(bx, by, 13, 5);
      ctx.fillRect(bx + 8, by + 8, 13, 5);
    }
  }
  // свет слева, тень справа и под крышей
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.fillRect(x, y, 7, h);
  ctx.fillStyle = 'rgba(0,0,0,.07)';
  ctx.fillRect(x + w - 9, y, 9, h);
  if (o.eave !== 0) {
    ctx.fillStyle = 'rgba(60,40,30,.16)';
    ctx.fillRect(x, y, w, o.eave || 9);
  }
  if (o.plinth !== false) {
    ctx.fillStyle = o.plinth || STONE;
    ctx.fillRect(x, y + h - 10, w, 10);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    for (let xx = x + 16; xx < x + w; xx += 22) ctx.fillRect(xx, y + h - 10, 1.3, 10);
    ctx.fillRect(x, y + h - 10, w, 1.4);
  }
  ctx.restore();
  fillRR(ctx, x, y, w, h, r, null, OUT, o.lw || 2.5);
}
/**
 * Крыша-многоугольник pts с черепицей: ряды «чешуек», блик сверху. snow — шапка снега на верхней части
 * (цвет крыши остаётся виден по нижнему краю). o.rows — шаг рядов (10), o.flat — без черепицы (плоская).
 */
export function roof(ctx, pts, col, snow, o = {}) {
  poly(ctx, pts, col);
  let y0 = 1e9,
    y1 = -1e9,
    x0 = 1e9,
    x1 = -1e9;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.clip();
  if (!o.flat) {
    const step = o.rows || 10,
      sw = step * 1.5;
    ctx.strokeStyle = shade(col, -0.22);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let row = 0;
    for (let y = y1 - step; y > y0 - step; y -= step, row++)
      for (let x = x0 - (row % 2 ? sw / 2 : 0); x < x1 + sw; x += sw) {
        ctx.moveTo(x, y);
        ctx.arc(x + sw / 2, y, sw / 2, Math.PI, 0, true);
      }
    ctx.stroke();
  }
  // блик по верху, тень по низу
  ctx.fillStyle = grad(ctx, y0, y1, 'rgba(255,255,255,.22)', 'rgba(0,0,0,.12)');
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (snow) {
    const cut = y1 - (y1 - y0) * (o.snowKeep === undefined ? 0.26 : o.snowKeep);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0, y0 - 2, x1 - x0, cut - y0);
    ctx.beginPath();
    for (let x = x0; x < x1 + 14; x += 14) {
      ctx.moveTo(x + 8, cut);
      ctx.arc(x, cut, 8, 0, Math.PI);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,195,225,.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = x0; x < x1 + 14; x += 14) {
      ctx.moveTo(x + 8, cut);
      ctx.arc(x, cut, 8, 0, Math.PI);
    }
    ctx.stroke();
  }
  ctx.restore();
  poly(ctx, pts, null, OUT, o.lw || 2.5);
}
/** Двускатная крыша «лицом»: треугольник с белыми досками по скатам. (left, eaveY) — (cx, peakY) — (right, eaveY). */
export function gable(ctx, left, right, eaveY, peakY, col, snow, o = {}) {
  const cx = (left + right) / 2;
  roof(ctx, [left, eaveY, cx, peakY, right, eaveY], col, snow, o);
  // доски по скатам
  ctx.lineCap = 'round';
  for (const [lw, c] of [
    [8.5, OUT],
    [5, snow ? '#fff' : o.trim || '#fff8ec'],
  ]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(left, eaveY);
    ctx.lineTo(cx, peakY);
    ctx.lineTo(right, eaveY);
    ctx.stroke();
  }
}
/**
 * Окно: o.arch — полукруглый верх; o.cross — переплёт (по умолчанию есть); o.shutters — цвет ставней;
 * o.box — цвет ящика с цветами (или true); o.curtain — цвет занавесок; o.sill — подоконник (по умолчанию есть).
 */
export function win(ctx, x, y, w, h, lit, o = {}) {
  const glass = lit ? grad(ctx, y, y + h, '#fff3c4', '#ffc94d') : grad(ctx, y, y + h, '#d9f0ff', '#b4dcf7');
  const shape = () => {
    if (o.arch) {
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + w / 2);
      ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
    } else rr(ctx, x, y, w, h, o.r === undefined ? 4 : o.r);
  };
  if (o.shutters) {
    const sw = Math.max(8, w * 0.3);
    for (const sx of [x - sw - 1, x + w + 1]) {
      fillRR(ctx, sx, y, sw, h, 2, o.shutters, OUT, 1.6);
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      for (let yy = y + 5; yy < y + h - 3; yy += 5) ctx.fillRect(sx + 2, yy, sw - 4, 1.4);
    }
  }
  shape();
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  if (o.curtain) {
    ctx.fillStyle = o.curtain;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.5, x, y + h * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.5, x + w, y + h * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  if (!lit) {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.5);
    ctx.lineTo(x + w * 0.5, y + h * 0.08);
    ctx.lineTo(x + w * 0.66, y + h * 0.08);
    ctx.lineTo(x + w * 0.12, y + h * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  shape();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = o.lw || 2;
  ctx.stroke();
  if (o.cross !== false) {
    line(ctx, x + w / 2, y + (o.arch ? 2 : 0), x + w / 2, y + h, OUT, 1.5);
    line(ctx, x, y + h * (o.arch ? 0.55 : 0.5), x + w, y + h * (o.arch ? 0.55 : 0.5), OUT, 1.5);
  }
  if (o.sill !== false) fillRR(ctx, x - 4, y + h - 1, w + 8, 5, 2, '#fff', OUT, 1.5);
  if (o.box) {
    const c = o.box === true ? '#c98b5a' : o.box;
    fillRR(ctx, x - 3, y + h + 1, w + 6, 8, 2, c, OUT, 1.5);
    if (!o.snow) {
      for (let i = 0; i < 4; i++) ell(ctx, x + 3 + (i * (w - 6)) / 3, y + h, 5, 4, '#51b85c');
      for (let i = 0; i < 4; i++)
        flower(ctx, x + 3 + (i * (w - 6)) / 3, y + h - 3, 2.5, ['#ff6b9d', '#ffd43b', '#fff', '#b197fc'][i % 4]);
    } else snowCap(ctx, x + w / 2, y + h + 1, w + 4, 4);
  }
}
/**
 * Дверь, низ по центру (cx, bot): o.arch — полукруглый верх; o.glass — окошко; o.double — две створки;
 * o.lit — свет в окошке; o.frame — цвет наличника.
 */
export function door(ctx, cx, bot, w, h, col, o = {}) {
  const x = cx - w / 2,
    y = bot - h;
  const shape = (pad) => {
    if (o.arch) {
      ctx.beginPath();
      ctx.moveTo(x - pad, bot);
      ctx.lineTo(x - pad, y + w / 2);
      ctx.arc(cx, y + w / 2, w / 2 + pad, Math.PI, 0);
      ctx.lineTo(x + w + pad, bot);
      ctx.closePath();
    } else rr(ctx, x - pad, y - pad, w + pad * 2, h + pad, 5);
  };
  if (o.frame) {
    shape(4);
    ctx.fillStyle = o.frame;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  shape(0);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.save();
  shape(0);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fillRect(x, y, w * 0.3, h);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(x + w * 0.78, y, w * 0.22, h);
  ctx.restore();
  shape(0);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  if (o.double) line(ctx, cx, y + (o.arch ? 1 : 0), cx, bot, OUT, 1.8);
  if (o.glass) {
    const gw = o.double ? w * 0.3 : w * 0.5,
      gh = h * 0.34,
      gy = y + (o.arch ? w * 0.32 : h * 0.14);
    const g = o.lit ? LIT : '#cfeaff';
    if (o.double) {
      fillRR(ctx, cx - gw - 3, gy, gw, gh, 3, g, OUT, 1.4);
      fillRR(ctx, cx + 3, gy, gw, gh, 3, g, OUT, 1.4);
    } else fillRR(ctx, cx - gw / 2, gy, gw, gh, 3, g, OUT, 1.4);
  }
  // ручки
  if (o.double) {
    ell(ctx, cx - 5, bot - h * 0.42, 2.4, 2.4, '#ffd43b', OUT, 1);
    ell(ctx, cx + 5, bot - h * 0.42, 2.4, 2.4, '#ffd43b', OUT, 1);
  } else ell(ctx, x + w - 7, bot - h * 0.42, 2.6, 2.6, '#ffd43b', OUT, 1);
}
/** Каменные ступеньки под дверью. */
export function steps(ctx, cx, bot, w) {
  fillRR(ctx, cx - w / 2 - 5, bot - 3, w + 10, 7, 2, '#e3e7ec', OUT, 1.8);
  fillRR(ctx, cx - w / 2, bot - 8, w, 6, 2, '#f1f3f5', OUT, 1.8);
}
/** Кирпичная труба; верх — (x, y). */
export function chimney(ctx, x, y, w, h, snow) {
  fillRR(ctx, x, y, w, h, 2, '#c97b5a', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  for (let yy = y + 8; yy < y + h - 2; yy += 7) ctx.fillRect(x + 1, yy, w - 2, 1.3);
  ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
  fillRR(ctx, x - 3, y - 4, w + 6, 7, 2, '#a85f42', OUT, 2);
  if (snow) snowCap(ctx, x + w / 2, y - 4, w + 8, 5);
}
/** Тёплое свечение вокруг горящего окна или фонаря (рисуется в спрайт здания, когда lit). */
export function glow(ctx, x, y, r, a = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,220,120,${a})`);
  g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
/** Фонарик на стене у двери. */
export function wallLamp(ctx, x, y, lit) {
  if (lit) glow(ctx, x, y + 4, 22, 0.5);
  line(ctx, x, y - 6, x, y - 1, OUT, 2);
  poly(ctx, [x - 5, y - 1, x + 5, y - 1, x + 3.5, y + 9, x - 3.5, y + 9], lit ? LIT : '#e7f5ff', OUT, 1.5);
  fillRR(ctx, x - 6, y - 3, 12, 3.5, 1.5, '#4b5563', OUT, 1.2);
}

// ---------- домик жителя ----------
/** Размеры частей домика — чтобы дорисовка (b.art) знала, где что. */
export function houseGeom(b) {
  const g = geom(b);
  const wallTop = g.Y + g.H * 0.46;
  return {
    ...g,
    wallTop,
    wx: g.X + 12,
    ww: g.W - 24,
    eaveY: wallTop + 10,
    peakY: g.Y - 26,
    left: g.X - 6,
    right: g.X + g.W + 6,
    winY: wallTop + 28,
    winL: g.X + 26,
    winR: g.X + g.W - 26 - 36,
    atticY: g.Y + g.H * 0.22,
  };
}
function paintHouse(ctx, b, snow, lit) {
  const g = houseGeom(b),
    { X, W, bot, cx } = g;
  const trim = b.shutters || shade(b.roof, -0.05);
  baseShadow(ctx, g);
  chimney(ctx, X + W * 0.68, g.Y + 4, 20, 50, snow);
  wall(ctx, g.wx, g.wallTop, g.ww, bot - g.wallTop, b.wall, { siding: 9, eave: 14 });
  gable(ctx, g.left, g.right, g.eaveY, g.peakY, b.roof, snow);
  // слуховое окошко
  if (b.attic !== false) {
    ell(ctx, cx, g.atticY, 15, 15, '#fff8ec', OUT, 2);
    ell(ctx, cx, g.atticY, 10.5, 10.5, lit ? LIT : '#cfeaff', OUT, 1.6);
    line(ctx, cx - 10, g.atticY, cx + 10, g.atticY, OUT, 1.3);
    line(ctx, cx, g.atticY - 10, cx, g.atticY + 10, OUT, 1.3);
  }
  if (lit) {
    glow(ctx, g.winL + 18, g.winY + 18, 40);
    glow(ctx, g.winR + 18, g.winY + 18, 40);
  }
  const wo = {
    shutters: trim,
    box: b.box === false ? null : true,
    snow,
    curtain: lit ? null : 'rgba(255,255,255,.75)',
  };
  win(ctx, g.winL, g.winY, 36, 36, lit, wo);
  win(ctx, g.winR, g.winY, 36, 36, lit, wo);
  steps(ctx, cx, bot, 40);
  door(ctx, cx, bot - 6, 34, 58, shade(b.roof, -0.12), { arch: true, frame: '#fff8ec' });
  if (b.art) b.art(ctx, g, snow, lit);
  const n = NPC_BY_ID[b.npc];
  if (n) signBoard(ctx, n.name.split(' ').pop(), cx, bot - 84, 76, 19, 'wood');
}

// ---------- лавка и ТЦ (общий вид; у зданий города свои рисунки — locations/town_buildings.js) ----------
/** Общий корпус лавки: стена, плоская крыша с карнизом, навес. Возвращает размеры частей. */
export function shopBody(ctx, b, snow, o = {}) {
  const g = geom(b),
    { X, Y, W, H, bot } = g;
  const roofH = o.roofH || Math.min(60, H * 0.3),
    top = Y - (o.up || 10);
  baseShadow(ctx, g);
  wall(ctx, X + 5, top + roofH - 6, W - 10, bot - top - roofH + 6, b.wall, { eave: 0, ...(o.wall || {}) });
  // крыша-парапет
  fillRR(ctx, X - 3, top, W + 6, roofH, 8, snow ? '#fff' : b.roof, OUT, 2.5);
  ctx.save();
  rr(ctx, X - 3, top, W + 6, roofH, 8);
  ctx.clip();
  if (snow) {
    ctx.fillStyle = b.roof;
    ctx.fillRect(X - 3, top + roofH * 0.55, W + 6, roofH);
    ctx.fillStyle = '#fff';
    for (let x = X; x < X + W + 12; x += 14) ell(ctx, x, top + roofH * 0.55, 8, 6, '#fff');
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(X - 3, top, W + 6, 7);
  }
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  ctx.fillRect(X - 3, top + roofH - 7, W + 6, 7);
  ctx.restore();
  fillRR(ctx, X - 3, top, W + 6, roofH, 8, null, OUT, 2.5);
  const aw = top + roofH;
  if (o.awning !== false) awning(ctx, X + 5, aw - 2, W - 10, 18, b.w * 2, o.awningCol || b.roof);
  return { ...g, top, roofH, aw, wy: aw + (o.awning === false ? 14 : 30) };
}
/** Витрина: стекло со светом и полкой; inside(ctx, x, y, w, h) — что стоит за стеклом. */
export function showcase(ctx, x, y, w, h, lit, inside) {
  fillRR(ctx, x - 3, y - 3, w + 6, h + 6, 5, '#fff8ec', OUT, 2);
  ctx.fillStyle = lit ? grad(ctx, y, y + h, '#fff3c4', '#ffd66b') : grad(ctx, y, y + h, '#dff2ff', '#bfe2f8');
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (inside) inside(ctx, x, y, w, h);
  if (!lit) {
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.6);
    ctx.lineTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.42, y);
    ctx.lineTo(x + w * 0.08, y + h * 0.95);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);
}
function paintShop(ctx, b, snow, lit, mall) {
  const g = shopBody(ctx, b, snow),
    { X, W, bot, cx } = g;
  const wh = bot - g.wy - 18;
  if (mall) {
    for (const sx of [-1, 1]) showcase(ctx, cx + sx * W * 0.3 - W * 0.13, g.wy, W * 0.26, wh, lit);
    door(ctx, cx, bot, 60, wh + 18, '#fff', { double: true, glass: true, lit });
  } else {
    showcase(ctx, X + 16, g.wy, W * 0.4, wh, lit);
    door(ctx, cx + (b.w < 5 ? 28 : 0), bot, 34, 60, shade(b.roof, -0.1), { glass: true, lit });
  }
  signBoard(
    ctx,
    `${b.icon || ''} ${b.name || ''}`.trim(),
    cx,
    g.top + g.roofH * 0.5,
    Math.min(W - 16, 220),
    mall ? 26 : 22,
    'plate',
    shade(b.roof, -0.15),
  );
}

// ---------- высотка ----------
/** Размеры высотки: top — верх корпуса. */
export const towerTop = (b) => (b.y + b.h) * T - b.floors * T * 0.62 - T;
export function towerBody(ctx, b, snow, lit, o = {}) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = towerTop(b);
  baseShadow(ctx, g);
  fillRR(ctx, X + 10, top, W - 20, bot - top, 8, b.wall, OUT, 2.5);
  ctx.save();
  rr(ctx, X + 10, top, W - 20, bot - top, 8);
  ctx.clip();
  ctx.fillStyle = grad(ctx, top, bot, 'rgba(255,255,255,.25)', 'rgba(0,0,0,.08)');
  ctx.fillRect(X + 10, top, W - 20, bot - top);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(X + 14, top, 14, bot - top);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(X + W - 24, top, 14, bot - top);
  ctx.restore();
  const cols = o.cols || 4,
    ww = (W - 48) / cols - 6;
  for (let f = 0; f < b.floors; f++)
    for (let i = 0; i < cols; i++) {
      const wy = top + 20 + f * T * 0.62,
        wx = X + 24 + i * ((W - 48) / cols) + 3;
      const on = lit && hash(b.x + i, f) < 0.7;
      fillRR(ctx, wx, wy, ww, 18, 3, on ? LIT : lit ? '#3b4a6b' : '#e3f3ff', OUT, 1.5);
      if (!lit) {
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillRect(wx + 2, wy + 2, ww * 0.35, 3);
      }
    }
  fillRR(ctx, X + 4, top - 10, W - 8, 16, 5, snow ? '#fff' : shade(b.wall, -0.2), OUT, 2.5);
  return { ...g, top, cx };
}
function paintTower(ctx, b, snow, lit) {
  const { cx, top, bot, W } = towerBody(ctx, b, snow, lit);
  line(ctx, cx, top - 10, cx, top - 44, OUT, 3);
  ell(ctx, cx, top - 46, 5, 5, '#7a1f1f', OUT, 1.5); // погасший огонёк; горящий рисует live
  door(ctx, cx, bot, 48, 52, '#fff', { double: true, glass: true, lit });
  signBoard(ctx, `${b.icon || ''} ${b.name || ''}`.trim(), cx, bot - 70, W + 40, 22, 'plate', shade(b.wall, -0.3));
}
/** Мигающий огонёк на шпиле высотки (dy — насколько шпиль выше корпуса). */
export function beacon(ctx, b, t, dy = 46) {
  if (Math.sin(t * 4) > 0) {
    const cx = (b.x + b.w / 2) * T;
    SP.world();
    ell(ctx, cx, towerTop(b) - dy, 5, 5, '#fa5252', OUT, 1.5);
  }
}
/** Рамка спрайта высотки: высоко вверх и с запасом по бокам (вывеска). up — запас над корпусом. */
export const towerBox = (b, up = 60, side = 44) => [
  -side,
  -(b.floors * T * 0.62 + T + up - b.h * T),
  b.w * T + side,
  b.h * T + 14,
];

/** Свет ночью для здания: пятно на земле у двери и мягкий свет на фасаде (up — насколько фасад выше «пятна»). */
export function facadeLights(b, r = 90, up = 0) {
  const cx = (b.x + b.w / 2) * T,
    bot = (b.y + b.h) * T,
    hh = b.h * T + up;
  return [
    [cx, bot + 8, r, r * 0.42, 0.9],
    [cx, bot - hh * 0.5, b.w * T * 0.56, hh * 0.56, 0.72],
  ];
}
/** Дымок из трубы — рисуется каждый кадр поверх спрайта: (x, y) — верх трубы. */
export function smoke(ctx, x, y, t) {
  SP.world();
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.22 + i / 3) % 1;
    ctx.globalAlpha = 0.55 * (1 - k);
    ell(ctx, x + Math.sin(k * 5 + i) * 7 + k * 10, y - k * 48, 6 + k * 9, 5 + k * 7, '#f1f3f5');
  }
  ctx.globalAlpha = 1;
}

defineBuildings({
  house: {
    paint: paintHouse,
    // дымок из трубы: зимой у всех, а у дома с полем smoke — всегда
    live(ctx, b, t, env) {
      if (b.smoke || env.season === 'winter') smoke(ctx, (b.x + b.w * 0.68) * T + 10, b.y * T - 2, t + b.x);
    },
    box: (b) => [-30, -60, b.w * T + 30, b.h * T + 14],
    // свет ночью: окна, слуховое окошко и пятно на земле у двери
    lights: (b) => {
      const g = houseGeom(b);
      return [
        [g.winL + 18, g.winY + 20, 44, 44, 0.9],
        [g.winR + 18, g.winY + 20, 44, 44, 0.9],
        [g.cx, g.atticY, 26, 26, 0.7],
        [g.cx, g.bot + 8, 84, 34, 0.85],
      ];
    },
    mapDraw(ctx, b, k) {
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x * k + 1, b.y * k + 1, b.w * k - 2, b.h * k * 0.4);
    },
  },
  shop: {
    paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, false),
    lights: (b) => facadeLights(b, 80),
  },
  mall: {
    paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, true),
    lights: (b) => facadeLights(b, 110),
  },
  tower: {
    paint: paintTower,
    box: (b) => towerBox(b),
    hitUp: (b) => b.floors * T * 0.62,
    live: (ctx, b, t) => beacon(ctx, b, t),
    lights: (b) => facadeLights(b, 80, b.floors * T * 0.62 - b.h * T + T),
  },
});

// «Движок домов», часть 1: размеры дома и рисование коробки — небо, земля, стены, крыша, комнаты
// (обои, окна, полы), перегородки, шахта лифта. Всё по описанию дома (см. scene.js и docs/ARCHITECTURE.md).
//
// Координаты дома: x — слева направо от 0, y — вниз; пол первого этажа — y = 0, пол этажа f — y = −f × FH.
import { G, cal, darkness } from '../../core/state.js';
import { ell, fillRR, line, poly, shade, mix } from '../../core/draw.js';

export const OUT = '#4a3728'; // цвет контура
export const HS = 1.45; // масштаб хомячка в доме

/** Размеры дома по описанию. */
export function geometry(desc) {
  const RH = desc.roomH || 250, // высота комнаты
    SLAB = desc.slab || 26, // толщина перекрытия
    FH = RH + SLAB,
    floors = desc.floors || 1,
    W = desc.width, // ширина жилой части
    lift = !!desc.lift,
    LIFT_W = 120;
  return {
    RH,
    SLAB,
    FH,
    floors,
    W,
    lift,
    EX: W + LIFT_W / 2, // центр лифта
    WTOT: W + (lift ? LIFT_W : 0), // полная ширина вместе с лифтом
    fy: (f) => -f * FH, // y пола этажа
    top: -(floors - 1) * FH - RH, // потолок верхнего этажа
    /** На каком этаже точка y (dy — поправка: «чуть выше пола — всё ещё этот этаж»). */
    floorAt: (y, dy = 0) => Math.max(0, Math.min(floors - 1, Math.floor((-y + dy) / FH))),
  };
}

/** Небо за домом (в экранных координатах, до включения камеры). */
export function drawSky(ctx, w, h) {
  const d = darkness(),
    c = cal();
  const top = mix(
    { winter: '#a9d6f5', spring: '#8fd3ff', summer: '#6cc5ff', autumn: '#b5cfe0' }[c.season],
    '#1b1b4a',
    d * 0.92,
  );
  const bot = mix(
    { winter: '#e9f4fb', spring: '#dff3ff', summer: '#c9ecff', autumn: '#f6e3c5' }[c.season],
    '#3b2f6b',
    d * 0.9,
  );
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (d > 0.5) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const x = (i * 197) % w,
        y = (i * 113) % (h * 0.6);
      ctx.globalAlpha = (d - 0.5) * 2 * (0.4 + ((i * 37) % 10) / 16);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Обои комнаты: paper — 'planks' (доски, как в сауне), 'tile' (плитка) или полоски с панелью понизу. */
function wallpaper(ctx, geo, r, y) {
  const { RH } = geo;
  const paper = r.paper || (r.floor === 'tile' ? 'tile' : 'stripes');
  ctx.fillStyle = r.wall;
  ctx.fillRect(r.x0, y - RH, r.x1 - r.x0, RH);
  if (paper === 'planks') {
    ctx.strokeStyle = 'rgba(120,70,20,.3)';
    ctx.lineWidth = 2;
    for (let yy = y - RH + 25; yy < y; yy += 25) line(ctx, r.x0, yy, r.x1, yy, 'rgba(120,70,20,.3)', 2);
  } else if (paper === 'tile') {
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    for (let xx = r.x0 + 40; xx < r.x1; xx += 40) line(ctx, xx, y - RH, xx, y, 'rgba(255,255,255,.55)', 2);
    for (let yy = y - RH + 40; yy < y; yy += 40) line(ctx, r.x0, yy, r.x1, yy, 'rgba(255,255,255,.55)', 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let xx = r.x0 + 20; xx < r.x1 - 10; xx += 44) ctx.fillRect(xx, y - RH, 14, RH - 34);
    ctx.fillStyle = shade(r.wall, -0.12);
    ctx.fillRect(r.x0, y - 34, r.x1 - r.x0, 34);
    ctx.fillStyle = '#fff';
    ctx.fillRect(r.x0, y - 38, r.x1 - r.x0, 5);
  }
}
/** Окно: x — центр, y — пол этажа. За окном — время суток и сезон. */
function windowAt(ctx, x, y) {
  const d = darkness(),
    c = cal();
  const sky = mix(
    { winter: '#cfe9fb', spring: '#bfe6ff', summer: '#9bdcff', autumn: '#e3d6bd' }[c.season],
    '#232355',
    d * 0.9,
  );
  fillRR(ctx, x - 52, y - 208, 104, 104, 10, '#fff', OUT);
  fillRR(ctx, x - 44, y - 200, 88, 88, 6, sky, null);
  if (d > 0.6) {
    ell(ctx, x + 18, y - 176, 11, 11, '#fff3bf');
    ell(ctx, x + 23, y - 179, 9, 9, sky);
  } else if (c.season === 'winter') {
    for (let i = 0; i < 5; i++) ell(ctx, x - 34 + i * 17, y - 190 + ((i * 29 + G.time * 20) % 70), 2.5, 2.5, '#fff');
  } else ell(ctx, x - 20, y - 178, 13, 13, c.season === 'autumn' ? '#ffc078' : '#ffe066');
  line(ctx, x, y - 200, x, y - 112, '#fff', 5);
  line(ctx, x - 44, y - 156, x + 44, y - 156, '#fff', 5);
  fillRR(ctx, x - 58, y - 110, 116, 9, 4, '#fff', OUT, 1.5);
}
/** Пол комнаты: floor — 'wood' (доски), 'check' (шашечки) или 'tile' (плитка). */
function floorSlab(ctx, geo, r, y) {
  const { SLAB } = geo;
  const col = r.floor === 'wood' ? '#c98b5a' : r.floor === 'check' ? '#f1f3f5' : '#dfe9ee';
  ctx.fillStyle = col;
  ctx.fillRect(r.x0, y, r.x1 - r.x0, SLAB);
  if (r.floor === 'check') {
    ctx.fillStyle = '#ffa8a8';
    for (let xx = r.x0, i = 0; xx < r.x1; xx += 26, i++) if (i % 2) ctx.fillRect(xx, y, Math.min(26, r.x1 - xx), 10);
  } else if (r.floor === 'wood') {
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    for (let xx = r.x0 + 60; xx < r.x1; xx += 60) ctx.fillRect(xx, y, 2, 10);
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(r.x0, y + 10, r.x1 - r.x0, SLAB - 10);
  line(ctx, r.x0, y, r.x1, y, OUT, 2.5);
}

/**
 * Дом снаружи и комнаты без мебели (в координатах дома, камера уже включена).
 * desc.shell: { wall, roof, chimneyX, bushes } — цвета коробки и крыши, где труба, рисовать ли кусты.
 */
export function drawHouse(ctx, desc, geo) {
  const { RH, SLAB, WTOT, fy, top } = geo;
  const c = cal(),
    sh = { wall: '#fff3d6', roof: '#f76e5c', chimneyX: 300, bushes: true, ...desc.shell };
  // земля и кусты
  ctx.fillStyle = { winter: '#f4f9fd', spring: '#9be36d', summer: '#7ed957', autumn: '#d9b65c' }[c.season];
  ctx.fillRect(-3000, 6, 8000, 600);
  if (sh.bushes) {
    for (let i = 0; i < 9; i++) {
      const bx = -260 + i * 60 + (i > 3 ? WTOT + 260 : 0);
      ell(ctx, bx, 6, 46, 34, c.season === 'winter' ? '#fff' : c.season === 'autumn' ? '#e8a03a' : '#51cf66', OUT);
    }
  }
  // коробка дома, крыша, чердачное окно, труба
  fillRR(ctx, -18, top - 12, WTOT + 36, -top + 12 + SLAB, 6, sh.wall, OUT, 3);
  poly(
    ctx,
    [-70, top - 8, WTOT / 2, top - 150, WTOT + 70, top - 8],
    c.season === 'winter' ? '#f8f9fa' : sh.roof,
    OUT,
    3,
  );
  fillRR(ctx, WTOT / 2 - 46, top - 104, 92, 60, 30, '#d0ebff', OUT, 3);
  line(ctx, WTOT / 2, top - 104, WTOT / 2, top - 44, OUT, 2);
  if (sh.chimneyX !== null) {
    fillRR(ctx, sh.chimneyX, top - 130, 60, 90, 4, '#e8590c', OUT, 3);
    fillRR(ctx, sh.chimneyX - 8, top - 140, 76, 16, 4, '#f1e0c5', OUT, 2);
  }
  // комнаты
  for (const r of desc.rooms) {
    const y = fy(r.f);
    wallpaper(ctx, geo, r, y);
    if (r.win) windowAt(ctx, r.win, y);
    floorSlab(ctx, geo, r, y);
    ctx.fillStyle = sh.wall;
    ctx.fillRect(r.x0, y - RH - 3, r.x1 - r.x0, 3);
  }
  // перегородки с проёмами
  for (const r of desc.rooms) {
    if (r.x0 === 0) continue;
    const y = fy(r.f);
    fillRR(ctx, r.x0 - 7, y - RH, 14, RH - 170, 2, sh.wall, OUT, 2);
  }
  // стеклянная крыша (glass: true) — блики
  for (const r of desc.rooms) {
    if (!r.glass) continue;
    const y = fy(r.f) - RH,
      n = Math.floor((r.x1 - r.x0 - 60) / 160);
    for (let i = 0; i < n; i++) {
      const x = r.x0 + 60 + i * 160;
      poly(ctx, [x, y, x + 50, y, x - 10, y + 90, x - 40, y + 90], 'rgba(255,255,255,.3)');
    }
  }
}

/** Шахта лифта и кабина (liftY — где сейчас пол кабины). */
export function drawLift(ctx, geo, liftY) {
  const { RH, SLAB, W, WTOT, EX, floors, fy, top } = geo;
  for (let f = 0; f < floors; f++) {
    const y = fy(f);
    ctx.fillStyle = '#dee2e6';
    ctx.fillRect(W, y - RH, WTOT - W, RH);
    ctx.fillStyle = '#ced4da';
    ctx.fillRect(W, y, WTOT - W, SLAB);
    line(ctx, W, y - RH, W, y - 170, OUT, 2.5);
  }
  line(ctx, EX - 30, top, EX - 30, 0, '#868e96', 2);
  line(ctx, EX + 30, top, EX + 30, 0, '#868e96', 2);
  fillRR(ctx, EX - 50, liftY - 168, 100, 168, 10, '#ffd43b', OUT, 2.5);
  fillRR(ctx, EX - 40, liftY - 158, 80, 110, 6, '#fff9db', OUT, 1.5);
  fillRR(ctx, EX - 50, liftY - 6, 100, 8, 3, '#e0a800', OUT, 1.5);
  ctx.fillStyle = OUT;
  ctx.font = '900 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▲▼', EX, liftY - 28);
}

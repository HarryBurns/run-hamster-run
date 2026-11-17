// «Движок домов», часть 1: размеры дома и рисование коробки — небо, земля, стены, крыша, комнаты
// (обои, окна, полы), перегородки, шахта лифта. Всё по описанию дома (см. scene.js и docs/ARCHITECTURE.md).
//
// Координаты дома: x — слева направо от 0, y — вниз; пол первого этажа — y = 0, пол этажа f — y = −f × FH.
import { G, cal, darkness } from '../../core/state.js';
import { ell, fillRR, line, poly, rr, star, shade, mix } from '../../core/draw.js';
import { TAU } from '../../core/util.js';

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

/** Узор на обоях: мелкие фигурки рядами (dots, flowers, stars, waves, diamonds, brick). */
function pattern(ctx, r, y, RH, kind) {
  const top = y - RH,
    bot = y - 38;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x0, top, r.x1 - r.x0, bot - top);
  ctx.clip();
  const lite = 'rgba(255,255,255,.42)',
    dark = shade(r.wall, -0.1);
  if (kind === 'waves') {
    ctx.strokeStyle = lite;
    ctx.lineWidth = 3;
    for (let yy = top + 26; yy < bot; yy += 34) {
      ctx.beginPath();
      for (let xx = r.x0 - 20; xx <= r.x1 + 20; xx += 20) {
        const k = Math.round((xx - r.x0 + 20) / 20) % 2 ? -7 : 7;
        if (xx === r.x0 - 20) ctx.moveTo(xx, yy);
        else ctx.quadraticCurveTo(xx - 10, yy + k, xx, yy);
      }
      ctx.stroke();
    }
  } else if (kind === 'brick') {
    for (let yy = top + 22, i = 0; yy < bot; yy += 22, i++) {
      line(ctx, r.x0, yy, r.x1, yy, dark, 2);
      for (let xx = r.x0 + (i % 2 ? 28 : 0); xx < r.x1; xx += 56) line(ctx, xx, yy - 22, xx, yy, dark, 2);
    }
  } else if (kind === 'diamonds') {
    for (let yy = top + 30, i = 0; yy < bot + 20; yy += 44, i++)
      for (let xx = r.x0 + (i % 2 ? 46 : 20); xx < r.x1; xx += 52)
        poly(ctx, [xx, yy - 13, xx + 9, yy, xx, yy + 13, xx - 9, yy], lite);
  } else {
    for (let yy = top + 30, i = 0; yy < bot + 10; yy += 46, i++)
      for (let xx = r.x0 + (i % 2 ? 50 : 22); xx < r.x1; xx += 58) {
        if (kind === 'stars') star(ctx, xx, yy, 8, lite);
        else if (kind === 'flowers') {
          for (let k = 0; k < 5; k++)
            ell(ctx, xx + Math.cos((k * TAU) / 5) * 6, yy + Math.sin((k * TAU) / 5) * 6, 4.2, 4.2, lite);
          ell(ctx, xx, yy, 3, 3, dark);
        } else ell(ctx, xx, yy, 6, 6, lite);
      }
  }
  ctx.restore();
}
const SKY_TOP = { winter: '#a9d6f5', spring: '#8fd3ff', summer: '#6cc5ff', autumn: '#b5cfe0' };
const SKY_BOT = { winter: '#e9f4fb', spring: '#dff3ff', summer: '#c9ecff', autumn: '#f6e3c5' };
/** Силуэты города: дома от x0 до x1, основание y, высота до maxH; ночью в окнах свет. */
function skyline(ctx, x0, x1, y, maxH, d, seed) {
  const cols = ['#b197fc', '#74c0fc', '#f783ac', '#ffd43b', '#8ce99a', '#ffa94d'];
  for (let xx = x0 - 6, i = seed; xx < x1; i++) {
    const bw = 20 + ((i * 13) % 20),
      bh = maxH * (0.35 + ((i * 29) % 13) / 20);
    ctx.fillStyle = mix(cols[i % cols.length], '#232355', 0.25 + d * 0.5);
    ctx.fillRect(xx, y - bh, bw, bh);
    ctx.fillStyle = d > 0.4 ? '#ffe066' : 'rgba(255,255,255,.55)';
    for (let wy = y - bh + 5; wy < y - 5; wy += 9)
      for (let wx = xx + 4, k = 0; wx < xx + bw - 5; wx += 8, k++)
        if ((k + i + Math.round(wy)) % 3 < 2) ctx.fillRect(wx, wy, 3.5, 4.5);
    xx += bw + 3;
  }
}
/** Открытая терраса вместо стены: небо, далёкий город внизу (view: 'sea' — море), стеклянные перила, гирлянда лампочек. */
function terrace(ctx, geo, r, y) {
  const { RH } = geo,
    d = darkness(),
    c = cal(),
    w = r.x1 - r.x0;
  const top = mix(SKY_TOP[c.season], '#1b1b4a', d * 0.92);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x0, y - RH, w, RH);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y - RH, 0, y);
  g.addColorStop(0, top);
  g.addColorStop(1, mix(SKY_BOT[c.season], '#3b2f6b', d * 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(r.x0, y - RH, w, RH);
  if (d > 0.5) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = (d - 0.5) * 2 * (0.4 + ((i * 37) % 10) / 16);
      ctx.fillRect(r.x0 + ((i * 97) % w), y - RH + 8 + ((i * 53) % (RH - 110)), 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    ell(ctx, r.x1 - 70, y - RH + 56, 20, 20, '#fff3bf');
    ell(ctx, r.x1 - 61, y - RH + 50, 17, 17, top);
  } else {
    ell(ctx, r.x1 - 70, y - RH + 56, 22, 22, c.season === 'autumn' ? '#ffc078' : '#ffe066');
    for (let i = 0; i < 3; i++) {
      const cx = r.x0 + ((i * 230 + G.time * 7) % (w + 160)) - 80,
        cy = y - RH + 74 + i * 26;
      ell(ctx, cx, cy, 40, 13, 'rgba(255,255,255,.85)');
      ell(ctx, cx + 22, cy - 9, 24, 13, 'rgba(255,255,255,.85)');
    }
  }
  if (r.view === 'sea') {
    // вид на море (крыша отеля): полоса моря у горизонта, блики одним путём, кораблик
    ctx.fillStyle = mix('#4dabf7', '#16214d', d * 0.85);
    ctx.fillRect(r.x0, y - 70, w, 70);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let xx = r.x0 + ((G.time * 9) % 60); xx < r.x1; xx += 60) {
      ctx.moveTo(xx, y - 52);
      ctx.lineTo(xx + 22, y - 52);
      ctx.moveTo(xx + 30, y - 36);
      ctx.lineTo(xx + 48, y - 36);
    }
    ctx.stroke();
    if (d < 0.6) {
      const bx = r.x0 + ((G.time * 14) % (w + 80)) - 40;
      poly(ctx, [bx - 16, y - 66, bx + 16, y - 66, bx + 11, y - 58, bx - 11, y - 58], '#e8590c');
      poly(ctx, [bx, y - 67, bx, y - 92, bx + 15, y - 70], '#fff');
    }
  } else skyline(ctx, r.x0, r.x1, y - 4, 50, d, 3);
  ctx.restore();
  // перила: стекло между столбиками
  ctx.fillStyle = 'rgba(208,235,255,.45)';
  ctx.fillRect(r.x0, y - 74, w, 70);
  for (let xx = r.x0 + 8; xx < r.x1; xx += 88) fillRR(ctx, xx - 3, y - 78, 6, 78, 2, '#ced4da', OUT, 1.2);
  fillRR(ctx, r.x0, y - 82, w, 9, 4, '#f1f3f5', OUT, 1.5);
  // гирлянда лампочек под навесом
  const cols = ['#ffd43b', '#ff8fab', '#74c0fc', '#8ce99a'];
  for (let i = 0, xx = r.x0 + 26; xx < r.x1 - 10; xx += 44, i++) {
    const yy = y - RH + 16 + Math.sin(i * 1.3) * 5;
    if (d > 0.3) ell(ctx, xx, yy, 11, 11, 'rgba(255,236,153,.35)');
    ell(ctx, xx, yy, 5, 6.5, cols[i % 4], OUT, 1);
  }
}

/**
 * Обои комнаты: paper — 'planks' (доски, как в сауне), 'logs' (бревенчатая стена), 'tile' (плитка), 'open' (терраса без стены),
 * узор с панелью понизу ('dots', 'flowers', 'stars', 'waves', 'diamonds', 'brick') или полоски с панелью (по умолчанию).
 */
function wallpaper(ctx, geo, r, y) {
  const { RH } = geo;
  const paper = r.paper || (r.floor === 'tile' ? 'tile' : 'stripes');
  if (paper === 'open') {
    terrace(ctx, geo, r, y);
    return;
  }
  ctx.fillStyle = r.wall;
  ctx.fillRect(r.x0, y - RH, r.x1 - r.x0, RH);
  if (paper === 'planks') {
    ctx.strokeStyle = 'rgba(120,70,20,.3)';
    ctx.lineWidth = 2;
    for (let yy = y - RH + 25; yy < y; yy += 25) line(ctx, r.x0, yy, r.x1, yy, 'rgba(120,70,20,.3)', 2);
  } else if (paper === 'logs') {
    // бревенчатая стена: брёвна одно на другом — блик сверху, тень снизу, редкие сучки
    const lh = 28,
      w = r.x1 - r.x0;
    for (let yy = y - RH, i = 0; yy < y; yy += lh, i++) {
      const h = Math.min(lh, y - yy);
      if (i % 2) {
        ctx.fillStyle = shade(r.wall, -0.07);
        ctx.fillRect(r.x0, yy, w, h);
      }
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.fillRect(r.x0, yy + 3, w, 3);
      ctx.fillStyle = 'rgba(90,50,20,.3)';
      ctx.fillRect(r.x0, yy + h - 4, w, 4);
      for (let xx = r.x0 + 30 + ((i * 97) % 150); xx < r.x1 - 20; xx += 190) ell(ctx, xx, yy + h / 2, 4.5, 2.6, 'rgba(90,50,20,.32)');
    }
  } else if (paper === 'stone') {
    // каменные блоки (пирамида, храм): ряды со сдвигом швов, блоки чуть разного тона
    const bh = 36,
      bw = 78;
    for (let yy = y - RH, i = 0; yy < y; yy += bh, i++) {
      const h = Math.min(bh, y - yy);
      for (let xx = r.x0 - (i % 2 ? bw / 2 : 0), j = 0; xx < r.x1; xx += bw, j++) {
        const k = (i * 7 + j * 13) % 5;
        if (k < 2) {
          ctx.fillStyle = k ? 'rgba(255,255,255,.1)' : 'rgba(90,60,20,.08)';
          ctx.fillRect(Math.max(r.x0, xx), yy, Math.min(bw, r.x1 - xx, xx + bw - r.x0), h);
        }
        if (xx > r.x0) line(ctx, xx, yy, xx, yy + h, 'rgba(90,60,20,.28)', 2);
      }
      line(ctx, r.x0, yy, r.x1, yy, 'rgba(90,60,20,.28)', 2);
    }
  } else if (paper === 'fabric') {
    // ткань шатра: широкие полотнища, складки и фестоны поверху
    const sw = 70,
      dark = shade(r.wall, -0.12);
    for (let xx = r.x0, i = 0; xx < r.x1; xx += sw, i++) {
      if (i % 2) {
        ctx.fillStyle = dark;
        ctx.fillRect(xx, y - RH, Math.min(sw, r.x1 - xx), RH);
      }
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(xx + 8, y - RH, 6, RH);
    }
    ctx.fillStyle = r.trim || '#ffd43b';
    for (let xx = r.x0; xx < r.x1; xx += 46) {
      ctx.beginPath();
      ctx.arc(xx + 23, y - RH + 6, 23, 0, Math.PI);
      ctx.fill();
    }
  } else if (paper === 'rock') {
    // скала (грот): неровные пятна светлее и темнее
    const w = r.x1 - r.x0;
    for (let i = 0; i < w / 26; i++) {
      const xx = r.x0 + ((i * 137) % w),
        yy = y - RH + 14 + ((i * 89) % (RH - 30));
      ell(ctx, xx, yy, 26 + (i % 4) * 8, 15 + (i % 3) * 5, i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(10,20,40,.12)');
    }
  } else if (paper === 'reed') {
    // стена из тростника (хижины острова): вертикальные стебли и обвязки
    for (let xx = r.x0 + 6, i = 0; xx < r.x1; xx += 13, i++)
      line(ctx, xx, y - RH, xx, y, i % 2 ? 'rgba(120,80,20,.22)' : 'rgba(255,255,255,.18)', 4);
    for (const k of [0.25, 0.62]) {
      const yy = y - RH + RH * k;
      line(ctx, r.x0, yy, r.x1, yy, 'rgba(110,70,20,.45)', 5);
    }
  } else if (paper === 'tile') {
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    for (let xx = r.x0 + 40; xx < r.x1; xx += 40) line(ctx, xx, y - RH, xx, y, 'rgba(255,255,255,.55)', 2);
    for (let yy = y - RH + 40; yy < y; yy += 40) line(ctx, r.x0, yy, r.x1, yy, 'rgba(255,255,255,.55)', 2);
  } else {
    if (paper === 'stripes') {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      for (let xx = r.x0 + 20; xx < r.x1 - 10; xx += 44) ctx.fillRect(xx, y - RH, 14, RH - 34);
    } else pattern(ctx, r, y, RH, paper);
    ctx.fillStyle = shade(r.wall, -0.12);
    ctx.fillRect(r.x0, y - 34, r.x1 - r.x0, 34);
    ctx.fillStyle = '#fff';
    ctx.fillRect(r.x0, y - 38, r.x1 - r.x0, 5);
  }
}
/**
 * Окно: x — центр, y — пол этажа. За окном — время суток и сезон. hw — половина ширины стекла (обычное окно — 44,
 * панорамное — шире); view — что видно: 'sea' (море), 'city' (город внизу), 'forest' (ёлки), 'mountain' (горы в снегу),
 * 'dunes' (барханы), 'jungle' (листья джунглей), иначе просто небо.
 */
function windowAt(ctx, x, y, hw = 44, view = null) {
  const d = darkness(),
    c = cal();
  const sky = mix(
    { winter: '#cfe9fb', spring: '#bfe6ff', summer: '#9bdcff', autumn: '#e3d6bd' }[c.season],
    '#232355',
    d * 0.9,
  );
  fillRR(ctx, x - hw - 8, y - 208, hw * 2 + 16, 104, 10, '#fff', OUT);
  fillRR(ctx, x - hw, y - 200, hw * 2, 88, 6, sky, null);
  // обрезка по стеклу нужна только виду за окном (у обычного окна всё и так внутри рамы)
  ctx.save();
  if (view) {
    rr(ctx, x - hw, y - 200, hw * 2, 88, 6);
    ctx.clip();
  }
  if (d > 0.6) {
    ell(ctx, x + 18, y - 176, 11, 11, '#fff3bf');
    ell(ctx, x + 23, y - 179, 9, 9, sky);
    if (view) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < hw / 5; i++) ctx.fillRect(x - hw + ((i * 47) % (hw * 2)), y - 196 + ((i * 31) % 40), 2, 2);
    }
  } else if (c.season === 'winter' && !view) {
    for (let i = 0; i < 5; i++) ell(ctx, x - 34 + i * 17, y - 190 + ((i * 29 + G.time * 20) % 70), 2.5, 2.5, '#fff');
  } else ell(ctx, x - 20, y - 178, 13, 13, c.season === 'autumn' ? '#ffc078' : '#ffe066');
  if (view === 'sea') {
    ctx.fillStyle = mix('#4dabf7', '#16214d', d * 0.85);
    ctx.fillRect(x - hw, y - 152, hw * 2, 40);
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let xx = x - hw; xx <= x + hw; xx += 8) {
        const yy = y - 144 + i * 11 + Math.sin(xx * 0.09 + G.time * 1.6 + i * 2) * 1.8;
        if (xx === x - hw) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = mix('#ffe8a1', '#3b3566', d * 0.8);
    ctx.fillRect(x - hw, y - 118, hw * 2, 8);
    if (d < 0.6) {
      const bx = x - hw + ((G.time * 5 + x) % (hw * 2 + 40)) - 20; // кораблик плывёт вдоль горизонта
      poly(ctx, [bx - 9, y - 152, bx + 9, y - 152, bx + 6, y - 147, bx - 6, y - 147], '#e8590c');
      poly(ctx, [bx, y - 153, bx, y - 168, bx + 9, y - 155], '#fff');
    }
  } else if (view === 'city') skyline(ctx, x - hw, x + hw, y - 112, 54, d, Math.round(x / 37));
  else if (view === 'mountain') {
    // горы в снегу (шале на горе)
    const rock = mix('#868e96', '#1d2350', d * 0.7),
      snow = mix('#f8f9fa', '#3b4a8c', d * 0.7);
    for (const [dx, h, w] of [
      [-0.55, 62, 40],
      [0.25, 78, 52],
      [0.95, 50, 36],
    ]) {
      const px = x + dx * hw;
      poly(ctx, [px - w, y - 112, px, y - 112 - h, px + w, y - 112], rock);
      poly(ctx, [px - w * 0.36, y - 112 - h * 0.64, px, y - 112 - h, px + w * 0.36, y - 112 - h * 0.64], snow);
    }
  } else if (view === 'dunes') {
    ctx.fillStyle = mix('#f2c46d', '#3b3566', d * 0.75);
    ctx.beginPath();
    ctx.moveTo(x - hw, y - 112);
    ctx.quadraticCurveTo(x - hw * 0.4, y - 150, x + hw * 0.1, y - 128);
    ctx.quadraticCurveTo(x + hw * 0.6, y - 112 - 44, x + hw, y - 124);
    ctx.lineTo(x + hw, y - 112);
    ctx.closePath();
    ctx.fill();
  } else if (view === 'jungle') {
    const leaf = mix('#2f9e44', '#16214d', d * 0.75);
    for (let i = 0, xx = x - hw; xx < x + hw + 20; xx += 26, i++)
      ell(ctx, xx, y - 116 - (i % 3) * 16, 22, 12, i % 2 ? leaf : shade(leaf, -0.15), null, 2, (i % 2 ? 0.5 : -0.5));
  }
  else if (view === 'forest') {
    const fir = mix(c.season === 'winter' ? '#b8d8c8' : '#2f9e44', '#16214d', d * 0.75);
    for (let i = 0, xx = x - hw - 6; xx < x + hw + 12; xx += 17, i++) {
      const h = 34 + ((i * 17) % 22);
      poly(ctx, [xx - 11, y - 112, xx, y - 112 - h, xx + 11, y - 112], i % 2 ? fir : shade(fir, -0.15));
    }
  }
  ctx.restore();
  // переплёт: у обычного окна — крест, у панорамного — только стойки
  const bars = Math.max(1, Math.round(hw / 44));
  for (let i = 1; i < bars * 2; i += bars === 1 ? 1 : 2) {
    const bx = x - hw + (i * hw) / bars;
    line(ctx, bx, y - 200, bx, y - 112, '#fff', 5);
  }
  if (bars === 1) line(ctx, x - hw, y - 156, x + hw, y - 156, '#fff', 5);
  fillRR(ctx, x - hw - 14, y - 110, hw * 2 + 28, 9, 4, '#fff', OUT, 1.5);
}
/** Полы «тайных мест»: песок (шатёр), каменные плиты (пирамида, храм), циновка (хижины), скала (грот). */
const FLOOR_COL = { sand: '#e9c98a', stone: '#b5946a', mat: '#d9b26f', rock: '#6b6e7c' };
/** Пол комнаты: floor — 'wood' (доски), 'check' (шашечки), 'deck' (светлый настил) или 'tile' (плитка). */
function floorSlab(ctx, geo, r, y) {
  const { SLAB } = geo;
  const col =
    FLOOR_COL[r.floor] ||
    (r.floor === 'wood' ? '#c98b5a' : r.floor === 'deck' ? '#e8c9a0' : r.floor === 'check' ? '#f1f3f5' : '#dfe9ee');
  ctx.fillStyle = col;
  ctx.fillRect(r.x0, y, r.x1 - r.x0, SLAB);
  if (r.floor === 'sand' || r.floor === 'rock') {
    ctx.fillStyle = r.floor === 'sand' ? 'rgba(160,110,40,.25)' : 'rgba(255,255,255,.12)';
    for (let xx = r.x0 + 9, i = 0; xx < r.x1; xx += 23, i++) ctx.fillRect(xx, y + 2 + (i % 3) * 3, 4, 3);
  } else if (r.floor === 'stone') {
    ctx.fillStyle = 'rgba(80,50,20,.25)';
    for (let xx = r.x0 + 90; xx < r.x1; xx += 90) ctx.fillRect(xx, y, 2, 10);
  } else if (r.floor === 'mat') {
    ctx.fillStyle = 'rgba(120,80,20,.22)';
    for (let xx = r.x0, i = 0; xx < r.x1; xx += 14, i++) ctx.fillRect(xx, y + (i % 2 ? 0 : 5), 7, 5);
  } else if (r.floor === 'check') {
    ctx.fillStyle = '#ffa8a8';
    for (let xx = r.x0, i = 0; xx < r.x1; xx += 26, i++) if (i % 2) ctx.fillRect(xx, y, Math.min(26, r.x1 - xx), 10);
  } else if (r.floor === 'wood' || r.floor === 'deck') {
    const step = r.floor === 'deck' ? 30 : 60;
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    for (let xx = r.x0 + step; xx < r.x1; xx += step) ctx.fillRect(xx, y, 2, 10);
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(r.x0, y + 10, r.x1 - r.x0, SLAB - 10);
  line(ctx, r.x0, y, r.x1, y, OUT, 2.5);
}

/** Что растёт у дома: кусты (по умолчанию), пальмы или ёлки. */
function greenery(ctx, kind, WTOT, season) {
  for (let i = 0; i < 9; i++) {
    const bx = -260 + i * 60 + (i > 3 ? WTOT + 260 : 0);
    if (kind === 'palm') {
      if (i % 2) continue;
      const h = 150 + (i % 3) * 26,
        tx = bx + (i > 3 ? 40 : -20);
      ctx.strokeStyle = '#a8703f';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, 6);
      ctx.quadraticCurveTo(tx + 14, -h / 2, tx + 6, -h);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        ctx.save();
        ctx.translate(tx + 6, -h);
        ctx.rotate(-Math.PI * (0.02 + k * 0.19));
        ell(ctx, 40, 0, 44, 11, k % 2 ? '#37b24d' : '#2f9e44', OUT, 1.6);
        ctx.restore();
      }
      ell(ctx, tx + 2, -h + 8, 7, 7, '#8d5524', OUT, 1.5);
    } else if (kind === 'fir') {
      const col = season === 'winter' ? '#cfe8dc' : '#2f9e44',
        h = 120 + (i % 3) * 30;
      fillRR(ctx, bx - 6, -18, 12, 26, 3, '#8d5524', OUT);
      for (let k = 0; k < 3; k++)
        poly(
          ctx,
          [bx - 44 + k * 8, -14 - k * (h / 4), bx, -h * 0.55 - k * (h / 4), bx + 44 - k * 8, -14 - k * (h / 4)],
          k % 2 ? shade(col, -0.1) : col,
          OUT,
        );
    } else ell(ctx, bx, 6, 46, 34, season === 'winter' ? '#fff' : season === 'autumn' ? '#e8a03a' : '#51cf66', OUT);
  }
}

/** Земля у «тайных мест» (shell.ground): песок пустыни, снег горы, джунгли, скала, лагуна под сваями. */
const GROUND = { desert: '#f2d49b', snow: '#f4f9fd', jungle: '#37b24d', rock: '#7a7d8a', lagoon: '#3bc9db' };
function lagoon(ctx, WTOT, d) {
  ctx.fillStyle = mix('#22b8cf', '#14365a', d * 0.8);
  ctx.fillRect(-3000, 6, 8000, 600);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 4; i++)
    for (let xx = -1400 + ((G.time * 12 + i * 70) % 140); xx < WTOT + 1400; xx += 140) {
      ctx.moveTo(xx, 40 + i * 34);
      ctx.lineTo(xx + 40, 40 + i * 34);
    }
  ctx.stroke();
}
/**
 * Свои формы дома снаружи (shell.shape): 'pyramid' — каменная пирамида вокруг зала, 'tent' — шатёр на шестах,
 * 'cave' — скала вокруг грота, 'thatch' — хижина с соломенной крышей, 'temple' — храм ступенями, во мху.
 */
function shellShape(ctx, sh, geo, c) {
  const { WTOT, SLAB, top } = geo,
    wall = sh.wall;
  if (sh.shape === 'pyramid') {
    const { B, H } = pyramidSize(geo),
      cx = WTOT / 2;
    poly(ctx, [cx - B, SLAB, cx, top - H, cx + B, SLAB], wall, OUT, 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - B, SLAB);
    ctx.lineTo(cx, top - H);
    ctx.lineTo(cx + B, SLAB);
    ctx.closePath();
    ctx.clip();
    for (let yy = SLAB - 34, i = 0; yy > top - H; yy -= 34, i++) {
      line(ctx, cx - B, yy, cx + B, yy, 'rgba(110,70,20,.25)', 2);
      for (let xx = cx - B + (i % 2 ? 40 : 0); xx < cx + B; xx += 80) line(ctx, xx, yy, xx, yy + 34, 'rgba(110,70,20,.18)', 2);
    }
    ctx.restore();
    return;
  }
  if (sh.shape === 'cave') {
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(-220, SLAB + 10);
    ctx.quadraticCurveTo(-260, top - 120, WTOT * 0.25, top - 170);
    ctx.quadraticCurveTo(WTOT * 0.5, top - 240, WTOT * 0.75, top - 170);
    ctx.quadraticCurveTo(WTOT + 260, top - 120, WTOT + 220, SLAB + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 9; i++)
      ell(ctx, -120 + ((i * 331) % (WTOT + 240)), top - 40 - ((i * 53) % 110), 40, 20, i % 2 ? shade(wall, 0.1) : shade(wall, -0.12));
    if (sh.moss) for (let i = 0; i < 6; i++) ell(ctx, -80 + i * ((WTOT + 160) / 5), top - 150 + (i % 2) * 40, 46, 14, sh.moss);
    return;
  }
  if (sh.shape === 'tent') {
    const col = c.season === 'winter' && sh.snow ? '#f1f3f5' : sh.roof;
    poly(ctx, [-90, SLAB, -30, top - 10, WTOT / 2, top - 130, WTOT + 30, top - 10, WTOT + 90, SLAB], col, OUT, 3);
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      line(ctx, WTOT / 2, top - 130, -90 + (WTOT + 180) * k, SLAB, 'rgba(0,0,0,.1)', 10);
    }
    line(ctx, WTOT / 2, top - 130, WTOT / 2, top - 175, '#8d5524', 7);
    poly(ctx, [WTOT / 2, top - 175, WTOT / 2 + 40, top - 165, WTOT / 2, top - 155], sh.flag || '#ffd43b', OUT, 1.5);
    line(ctx, -30, top - 10, -160, SLAB, '#a68b6a', 2);
    line(ctx, WTOT + 30, top - 10, WTOT + 160, SLAB, '#a68b6a', 2);
    return;
  }
  // хижина и храм — коробка, сверху своя крыша
  fillRR(ctx, -18, top - 12, WTOT + 36, -top + 12 + SLAB, 6, wall, OUT, 3);
  if (sh.shape === 'thatch') {
    const straw = c.season === 'winter' ? '#e3c98f' : sh.roof || '#d9a441';
    poly(ctx, [-90, top + 4, WTOT / 2, top - 170, WTOT + 90, top + 4], straw, OUT, 3);
    for (let xx = -80; xx < WTOT + 90; xx += 16) line(ctx, xx, top + 4, xx + 4, top + 22, shade(straw, -0.2), 4);
    for (let i = 1; i < 4; i++) {
      const yy = top + 4 - i * 42,
        hw = (WTOT / 2 + 90) * (1 - (i * 42) / 174);
      line(ctx, WTOT / 2 - hw, yy, WTOT / 2 + hw, yy, shade(straw, -0.18), 3);
    }
  } else if (sh.shape === 'temple') {
    const stone = sh.roof || shade(wall, -0.08);
    for (let i = 0; i < 3; i++) {
      const inset = 40 + i * 120;
      fillRR(ctx, -30 + inset, top - 46 - i * 46, WTOT + 60 - inset * 2, 50, 4, shade(stone, i * 0.05), OUT, 3);
    }
    if (sh.moss)
      for (let i = 0; i < 7; i++) {
        const xx = 30 + i * ((WTOT - 60) / 6);
        ell(ctx, xx, top - 10 - (i % 3) * 30, 34, 10, sh.moss);
        line(ctx, xx, top - 8, xx + 6, top + 40 + (i % 3) * 22, shade(sh.moss, -0.2), 4);
      }
  }
}

/**
 * Дом снаружи и комнаты без мебели (в координатах дома, камера уже включена).
 * desc.shell: { wall, roof, chimneyX, bushes, flat, ground, trees }:
 *   wall, roof — цвета коробки и крыши;  chimneyX — где труба (null — без трубы);  bushes — рисовать ли зелень;
 *   flat: true — плоская крыша (квартира, пентхаус);  trees: 'palm' | 'fir' — что растёт вместо кустов;
 *   ground: 'sand' — пляж и полоска моря, 'tower' — дом стоит на вершине небоскрёба, иначе — трава.
 * Рисуется в три слоя (От12): drawHouseGround — земля, море, зелень (позади дома, с анимацией); drawHouseStill —
 * коробка, крыша, обои и полы — неподвижное, сцена кладёт это в кэш (engine/side/cache.js); drawHouseLive — окна
 * и открытые террасы (за стеклом идёт снег, плывут облака и кораблик) и перегородки.
 */
export function drawHouse(ctx, desc, geo, view = null) {
  drawHouseGround(ctx, desc, geo);
  drawHouseStill(ctx, desc, geo, view);
  drawHouseLive(ctx, desc, geo, view);
}
const shellOf = (desc) => ({ wall: '#fff3d6', roof: '#f76e5c', chimneyX: 300, bushes: true, ...desc.shell });
/** Комната видна (view в единицах дома; без view — все). */
const roomSeen = (geo, r, view) =>
  !view || (r.x1 > view.x0 && r.x0 < view.x1 && geo.fy(r.f) - geo.RH < view.y1 && geo.fy(r.f) + geo.SLAB > view.y0);
/** Рамка неподвижного слоя дома [x0, y0, x1, y1] (единицы дома): коробка, крыша и труба. */
export function houseBox(desc, geo) {
  const sh = desc.shell || {};
  if (sh.shape === 'pyramid') {
    const p = pyramidSize(geo);
    return [geo.WTOT / 2 - p.B - 4, geo.top - p.H - 4, geo.WTOT / 2 + p.B + 4, geo.SLAB + 4];
  }
  if (sh.shape === 'cave') return [-290, geo.top - 250, geo.WTOT + 290, geo.SLAB + 14];
  if (sh.shape === 'tent') return [-170, geo.top - 190, geo.WTOT + 170, geo.SLAB + 4];
  if (sh.shape) return [-100, geo.top - 180, geo.WTOT + 100, geo.SLAB + 4];
  return [-80, geo.top - 160, geo.WTOT + 80, geo.SLAB + 4];
}
/** Пирамида вокруг зала: полуширина основания B и высота вершины над потолком H (зал целиком внутри). */
function pyramidSize(geo) {
  const B = geo.WTOT / 2 + 280;
  return { B, H: ((geo.WTOT / 2 + 30) * (-geo.top + geo.SLAB)) / (B - geo.WTOT / 2 - 30) };
}

/** Земля вокруг дома: море и песок, трава или вершина небоскрёба, зелень. */
export function drawHouseGround(ctx, desc, geo) {
  const { SLAB, WTOT } = geo;
  const c = cal(),
    d = darkness(),
    sh = shellOf(desc);
  if (sh.ground === 'tower') {
    // вершина небоскрёба: стеклянная башня уходит вниз, вокруг — небо и облака
    for (let i = 0; i < 5; i++) {
      const cx = -900 + ((i * 760 + G.time * (5 + i)) % (WTOT + 1900)),
        cy = 60 + ((i * 97) % 260) - (i % 2) * 300;
      ctx.globalAlpha = 0.85 - d * 0.5;
      ell(ctx, cx, cy, 110, 30, '#fff');
      ell(ctx, cx + 60, cy - 22, 70, 30, '#fff');
      ell(ctx, cx - 60, cy - 12, 60, 24, '#fff');
      ctx.globalAlpha = 1;
    }
    fillRR(ctx, -40, SLAB - 4, WTOT + 80, 900, 4, mix('#74c0fc', '#1f2a5c', d * 0.6), OUT, 3);
    for (let yy = SLAB + 26, j = 0; yy < 700; yy += 62, j++)
      for (let xx = -14, i = 0; xx < WTOT + 20; xx += 74, i++)
        fillRR(
          ctx,
          xx,
          yy,
          52,
          40,
          4,
          d > 0.4 && (i * 3 + j * 5) % 7 < 4 ? '#ffe066' : mix('#d0ebff', '#3b4a8c', d * 0.7),
          OUT,
          1.2,
        );
    fillRR(ctx, -64, SLAB - 6, WTOT + 128, 16, 5, '#e9ecef', OUT, 2.5);
  } else {
    if (sh.ground === 'sand') {
      ctx.fillStyle = mix('#4dabf7', '#16214d', d * 0.8);
      ctx.fillRect(-3000, -46, 8000, 60);
      ctx.strokeStyle = 'rgba(255,255,255,.65)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        for (let xx = -1400; xx <= WTOT + 1400; xx += 24) {
          const yy = -32 + i * 16 + Math.sin(xx * 0.03 + G.time * 1.4 + i * 2) * 3;
          if (xx === -1400) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    }
    ctx.fillStyle =
      sh.ground === 'sand'
        ? c.season === 'winter'
          ? '#f6efe0'
          : '#ffe8a1'
        : GROUND[sh.ground] || { winter: '#f4f9fd', spring: '#9be36d', summer: '#7ed957', autumn: '#d9b65c' }[c.season];
    ctx.fillRect(-3000, 6, 8000, 600);
    if (sh.ground === 'lagoon') lagoon(ctx, WTOT, d);
    if (sh.bushes) greenery(ctx, sh.trees || 'bush', WTOT, c.season);
  }
  // сваи хижины над лагуной — под полом, в слое земли
  if (sh.stilts) for (let xx = 20; xx < WTOT; xx += Math.max(120, WTOT / 6)) fillRR(ctx, xx - 9, SLAB - 4, 18, 150, 4, '#8d5524', OUT, 2);
}

/** Неподвижное: коробка дома, крыша, чердачное окно, труба; обои и полы комнат (кроме открытых террас). */
export function drawHouseStill(ctx, desc, geo, view = null) {
  const { RH, SLAB, WTOT, fy, top } = geo;
  const c = cal(),
    sh = shellOf(desc);
  // коробка дома, крыша, чердачное окно, труба (у «тайных мест» — своя форма: пирамида, шатёр, скала, хижина, храм)
  if (sh.shape) shellShape(ctx, sh, geo, c);
  else fillRR(ctx, -18, top - 12, WTOT + 36, -top + 12 + SLAB, 6, sh.wall, OUT, 3);
  if (sh.shape) {
    // форма уже нарисована
  } else if (sh.flat) {
    const snow = c.season === 'winter' && sh.ground !== 'tower';
    fillRR(ctx, -34, top - 34, WTOT + 68, 28, 6, snow ? '#f8f9fa' : sh.roof, OUT, 3);
    fillRR(ctx, -22, top - 46, WTOT + 44, 14, 5, snow ? '#fff' : shade(sh.roof, 0.25), OUT, 2);
  } else {
    poly(
      ctx,
      [-70, top - 8, WTOT / 2, top - 150, WTOT + 70, top - 8],
      c.season === 'winter' || sh.snowRoof ? '#f8f9fa' : sh.roof,
      OUT,
      3,
    );
    fillRR(ctx, WTOT / 2 - 46, top - 104, 92, 60, 30, '#d0ebff', OUT, 3);
    line(ctx, WTOT / 2, top - 104, WTOT / 2, top - 44, OUT, 2);
  }
  if (sh.chimneyX !== null && !sh.flat && !sh.shape) {
    fillRR(ctx, sh.chimneyX, top - 130, 60, 90, 4, '#e8590c', OUT, 3);
    fillRR(ctx, sh.chimneyX - 8, top - 140, 76, 16, 4, '#f1e0c5', OUT, 2);
  }
  // комнаты: обои (открытая терраса — в живом слое), пол, полоска под потолком
  for (const r of desc.rooms) {
    if (!roomSeen(geo, r, view)) continue;
    const y = fy(r.f);
    if (r.paper !== 'open') wallpaper(ctx, geo, r, y);
    floorSlab(ctx, geo, r, y);
    ctx.fillStyle = sh.wall;
    ctx.fillRect(r.x0, y - RH - 3, r.x1 - r.x0, 3);
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

/** Живое: открытые террасы и окна (за ними время суток, погода, облака, кораблик) и перегородки с проёмами. */
export function drawHouseLive(ctx, desc, geo, view = null) {
  const { RH, fy } = geo;
  const sh = shellOf(desc);
  for (const r of desc.rooms) {
    if (!roomSeen(geo, r, view)) continue;
    const y = fy(r.f);
    if (r.paper === 'open') wallpaper(ctx, geo, r, y);
    // окна: win — x центра или список x; winW — ширина стекла (панорамное окно); view — что за окном
    for (const wx of r.win ? [].concat(r.win) : []) windowAt(ctx, wx, y, (r.winW || 88) / 2, r.view || null);
  }
  // перегородки с проёмами
  for (const r of desc.rooms) {
    if (r.x0 === 0) continue;
    const y = fy(r.f);
    fillRR(ctx, r.x0 - 7, y - RH, 14, RH - 170, 2, sh.wall, OUT, 2);
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

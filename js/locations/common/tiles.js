// ОБЩИЕ ВИДЫ КЛЕТОК земли — для любых локаций «вид сверху» (как описывать вид — engine/topdown/kinds.js,
// как земля рисуется слоями с плавными краями — engine/topdown/ground.js).
//
//   g  трава (зимой — снег)        r  мостовая улиц            y  утоптанная дорожка
//   s  песок                       p  плитка у бассейна        i  доски (пирс, мостик)
//   I  снег и лёд (ледяной остров) h  мелководье: можно зайти  w  глубокая вода: можно плыть
//   O  открытое море: пешком и вплавь нельзя                   o  бассейн
//   d  пруд: летом вода (не зайти), зимой лёд — каток          k  брусчатка площади
//
// Слои снизу вверх (поле z): море 0 → мелководье 1 → песок 2 → лёд острова 3 → трава 4 → дорожка 5 →
// мостовая 6 → площадь 7 → плитка 8 → бассейн 9 → пруд 10 → доски 11. Свои виды локации ставят между ними
// (клевер — 4.5) или выше (грядка — 12).
// Свою клетку локация добавляет у себя: defineTiles({ имя: { z, fill, edge, deco, live, … } }).
import { cal } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { TAU } from '../../core/util.js';
import { ell, mix } from '../../core/draw.js';
import { T, defineTiles, hash } from '../../engine/topdown/kinds.js';
import { flower } from './paint.js';

/**
 * Цвета земли по сезонам: g — трава (основной тон, светлое и тёмное пятно, кайма), s — песок, r — мостовая,
 * y — дорожка, k — площадь, leaf — листва (для мини-карты и украшений).
 */
export const PAL = {
  winter: {
    g: '#f2f8fd',
    gl: '#ffffff',
    gd: '#dcebf7',
    gr: '#c9dff0',
    s: '#f1ead8',
    sd: '#e2d7bb',
    r: '#e6e3df',
    rj: 'rgba(110,110,130,.16)',
    y: '#e9e4dc',
    k: '#ebe6e3',
    bl: 'rgba(255,255,255,.55)',
    bd: 'rgba(190,215,238,.3)',
    leaf: '#ffffff',
    g1: '#f6fbff',
  },
  spring: {
    g: '#9fdc72',
    gl: '#b4e88a',
    gd: '#8bd061',
    gr: '#6fbb4c',
    s: '#ffe7a6',
    sd: '#f0d58d',
    r: '#ecdcc0',
    rj: 'rgba(120,90,50,.17)',
    y: '#e6cfa3',
    k: '#f1dfd0',
    bl: 'rgba(200,245,150,.3)',
    bd: 'rgba(90,170,60,.14)',
    leaf: '#63c94d',
    g1: '#a8e67a',
  },
  summer: {
    g: '#86d45c',
    gl: '#9cdf70',
    gd: '#73c64d',
    gr: '#5bb03d',
    s: '#ffe7a6',
    sd: '#f0d58d',
    r: '#ecdcc0',
    rj: 'rgba(120,90,50,.17)',
    y: '#e6cfa3',
    k: '#f1dfd0',
    bl: 'rgba(185,240,130,.28)',
    bd: 'rgba(70,150,50,.14)',
    leaf: '#2f9e44',
    g1: '#86db5c',
  },
  autumn: {
    g: '#c3cc66',
    gl: '#d3d878',
    gd: '#b2bd57',
    gr: '#98a548',
    s: '#f7dfa0',
    sd: '#e6cb86',
    r: '#e8d6b8',
    rj: 'rgba(120,90,50,.17)',
    y: '#dfc596',
    k: '#eddacb',
    bl: 'rgba(235,235,140,.3)',
    bd: 'rgba(150,150,50,.14)',
    leaf: '#f08c00',
    g1: '#cdd36a',
  },
};
const isWinter = () => cal().season === 'winter';
const pal = (env) => PAL[env.season];

// ---------- мелочи на земле ----------
/** Большое мягкое пятно другого тона: убирает «плоскость» заливки. */
function blotch(ctx, x, y, r, i, col, a = 1) {
  if (r(i) > 0.4 * a) return;
  const cx = x + r(i + 1) * T,
    cy = y + r(i + 2) * T,
    rx = 20 + r(i + 3) * 22,
    ry = 11 + r(i + 4) * 13,
    rot = r(i + 5) * 3;
  ctx.fillStyle = col;
  // два вложенных эллипса — край пятна получается мягче
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.62, ry * 0.62, rot, 0, TAU);
  ctx.fill();
}
/** Пучки травы: по три травинки веером. */
function tufts(ctx, x, y, r, n, col, lw = 1.5) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = x + 4 + r(20 + i * 3) * (T - 8),
      cy = y + 8 + r(21 + i * 3) * (T - 10),
      hgt = 4 + r(22 + i * 3) * 4;
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx - 4.5, cy - hgt * 0.8);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - hgt);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 4.5, cy - hgt * 0.8);
  }
  ctx.stroke();
}
function grassDeco(ctx, x, y, tx, ty, env, r) {
  const p = pal(env),
    sea = env.season;
  blotch(ctx, x, y, r, 0, p.bl);
  blotch(ctx, x, y, r, 6, p.bd);
  if (sea === 'winter') {
    // сугробы: голубая тень снизу, блик сверху; иногда — цепочка следов
    if (r(12) < 0.5) {
      const cx = x + 6 + r(13) * 30,
        cy = y + 10 + r(14) * 28,
        w = 10 + r(15) * 9;
      ell(ctx, cx, cy + 2.5, w, 4.5, p.gr);
      ell(ctx, cx, cy, w, 4.5, '#ffffff');
    }
    if (r(16) < 0.07) {
      ctx.fillStyle = 'rgba(150,185,215,.55)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + 6 + i * 10, y + 30 - i * 5 + (i % 2) * 5, 2.6, 1.8, -0.5, 0, TAU);
        ctx.fill();
      }
    }
    if (r(17) < 0.25) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(x + r(18) * 44, y + r(19) * 44, 1.6, 1.6);
    }
    return;
  }
  tufts(ctx, x, y, r, 2 + Math.floor(r(30) * 2), p.gr);
  if (r(31) < 0.5) tufts(ctx, x + 7, y + 5, r, 1, p.gl, 1.3);
  if (sea === 'autumn') {
    // опавшие листья
    const n = Math.floor(r(32) * 3.2);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = ['#e8590c', '#f59f00', '#c2410c', '#fcc419'][Math.floor(r(33 + i) * 4)];
      ctx.beginPath();
      ctx.ellipse(x + r(36 + i) * T, y + r(39 + i) * T, 3.6, 2, r(42 + i) * 3, 0, TAU);
      ctx.fill();
    }
    return;
  }
  // цветочки-крапинки: весной их больше
  const many = sea === 'spring' ? 0.5 : 0.22;
  if (r(34) < many) {
    const n = 1 + Math.floor(r(35) * (sea === 'spring' ? 3 : 2));
    for (let i = 0; i < n; i++) {
      const fx = x + 5 + r(36 + i) * 38,
        fy = y + 6 + r(40 + i) * 36,
        col = ['#ffffff', '#fff3a0', '#ffc2d6', '#e5dbff'][Math.floor(r(44 + i) * 4)];
      if (r(48 + i) < 0.5) flower(ctx, fx, fy, 1.7, col, '#ffb84d');
      else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (r(52) < 0.05) {
    // камешек
    ell(ctx, x + 10 + r(53) * 28, y + 12 + r(54) * 26, 3.4, 2.4, '#c9cfd4');
    ell(ctx, x + 9.4 + r(53) * 28, y + 11.4 + r(54) * 26, 1.6, 1, '#e9edf0');
  }
}
function sandDeco(ctx, x, y, tx, ty, env, r) {
  const p = pal(env);
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.13)');
  blotch(ctx, x, y, r, 6, 'rgba(214,170,90,.055)');
  // песчинки
  ctx.fillStyle = 'rgba(190,140,60,.32)';
  for (let i = 0; i < 5; i++) ctx.fillRect(x + r(12 + i) * T, y + r(18 + i) * T, 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 2; i++) ctx.fillRect(x + r(24 + i) * T, y + r(27 + i) * T, 1.6, 1.6);
  if (r(30) < 0.16) {
    // рябь на песке
    ctx.strokeStyle = p.sd;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const cx = x + 8 + r(31) * 22,
      cy = y + 10 + r(32) * 26;
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + 7, cy - 4, cx + 14, cy);
    ctx.moveTo(cx + 3, cy + 6);
    ctx.quadraticCurveTo(cx + 10, cy + 2, cx + 17, cy + 6);
    ctx.stroke();
  }
  if (env.season !== 'winter' && r(33) < 0.05) {
    // ракушка
    const cx = x + 10 + r(34) * 28,
      cy = y + 12 + r(35) * 26;
    ctx.fillStyle = ['#ffd8e4', '#fff', '#ffe3c2'][Math.floor(r(36) * 3)];
    ctx.strokeStyle = 'rgba(160,110,70,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.arc(cx, cy, 4.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (env.season === 'winter' && r(37) < 0.35)
    ell(ctx, x + r(38) * T, y + r(39) * T, 9 + r(40) * 8, 4, 'rgba(255,255,255,.85)');
}
/** Мостовая: камни «в перевязку» — швы идут сплошным рисунком через все клетки. */
function paveDeco(ctx, x, y, tx, ty, env, r) {
  const p = pal(env);
  // отдельные камни чуть другого тона
  for (let i = 0; i < 3; i++) {
    const row = Math.floor(r(i) * 3),
      col = Math.floor(r(3 + i) * 2);
    ctx.fillStyle = r(6 + i) < 0.5 ? 'rgba(255,255,255,.2)' : 'rgba(150,115,70,.09)';
    ctx.fillRect(x + col * 24 + ((row + ty * 3) % 2 ? 12 : 0) - 12, y + row * 16, 24, 16);
  }
  ctx.strokeStyle = p.rj;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 16;
    ctx.moveTo(x, yy);
    ctx.lineTo(x + T, yy);
    const off = (i + ty * 3) % 2 ? 12 : 0;
    for (let vx = off; vx < T; vx += 24) {
      ctx.moveTo(x + vx, yy);
      ctx.lineTo(x + vx, yy + 16);
    }
  }
  ctx.stroke();
  if (r(10) < 0.07) {
    // трещинка
    ctx.strokeStyle = 'rgba(100,75,45,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = x + 8 + r(11) * 26,
      cy = y + 8 + r(12) * 26;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 5, cy + 3);
    ctx.lineTo(cx + 4, cy + 8);
    ctx.lineTo(cx + 9, cy + 11);
    ctx.stroke();
  }
  if (env.season === 'winter') snowDust(ctx, x, y, r);
  else if (env.season === 'autumn' && r(14) < 0.2) leafOn(ctx, x, y, r);
}
function snowDust(ctx, x, y, r) {
  if (r(60) < 0.55) ell(ctx, x + r(61) * T, y + r(62) * T, 10 + r(63) * 12, 4 + r(64) * 4, 'rgba(255,255,255,.75)');
}
function leafOn(ctx, x, y, r) {
  ctx.fillStyle = ['#e8590c', '#f59f00', '#c2410c'][Math.floor(r(65) * 3)];
  ctx.beginPath();
  ctx.ellipse(x + r(66) * T, y + r(67) * T, 3.6, 2, r(68) * 3, 0, TAU);
  ctx.fill();
}
/** Площадь: крупные плиты с ромбиками на стыках. */
function plazaDeco(ctx, x, y, tx, ty, env, r) {
  ctx.fillStyle =
    r(1) < 0.33 ? 'rgba(255,255,255,.22)' : r(1) < 0.66 ? 'rgba(170,120,80,.05)' : 'rgba(255,255,255,.08)';
  ctx.fillRect(x + 1.5, y + 1.5, T - 3, T - 3);
  ctx.strokeStyle = 'rgba(130,95,60,.2)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.7, y + 0.7, T - 1.4, T - 1.4);
  // ромбик на углу четырёх плит
  ctx.fillStyle = env.season === 'winter' ? '#d5d9df' : '#e3bfa6';
  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x + 7, y);
  ctx.lineTo(x, y + 7);
  ctx.lineTo(x - 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,95,60,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (env.season === 'winter') snowDust(ctx, x, y, r);
  else if (env.season === 'autumn' && r(14) < 0.2) leafOn(ctx, x, y, r);
}
function pathDeco(ctx, x, y, tx, ty, env, r) {
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.1)');
  blotch(ctx, x, y, r, 6, 'rgba(140,100,50,.05)');
  const winter = env.season === 'winter';
  // камешки
  for (let i = 0; i < 3; i++) {
    const cx = x + 4 + r(12 + i) * 40,
      cy = y + 4 + r(15 + i) * 40,
      s = 2 + r(18 + i) * 2.4;
    ell(ctx, cx, cy + 0.8, s, s * 0.7, winter ? 'rgba(150,170,190,.45)' : 'rgba(140,100,55,.4)');
    ell(ctx, cx, cy, s, s * 0.7, winter ? '#f6f9fc' : '#f1dfbd');
  }
  if (winter) snowDust(ctx, x, y, r);
  else if (env.season === 'autumn' && r(22) < 0.3) leafOn(ctx, x, y, r);
}
function deckDeco(ctx, x, y, tx, ty, env, r) {
  ctx.fillStyle = (tx + ty) % 2 ? 'rgba(255,255,255,.55)' : 'rgba(170,205,225,.2)';
  ctx.fillRect(x, y, T, T);
  ctx.strokeStyle = 'rgba(120,160,185,.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + T, y);
  ctx.moveTo(x, y + 24);
  ctx.lineTo(x + T, y + 24);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + T);
  ctx.moveTo(x + 24, y);
  ctx.lineTo(x + 24, y + T);
  ctx.stroke();
  if (env.season === 'winter') snowDust(ctx, x, y, r);
}
function poolDeco(ctx, x, y, tx, ty, env, r) {
  // плитка на дне и светлые блики
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    ctx.moveTo(x, y + i * 24);
    ctx.lineTo(x + T, y + i * 24);
    ctx.moveTo(x + i * 24, y);
    ctx.lineTo(x + i * 24, y + T);
  }
  ctx.stroke();
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.07)', 1.6);
}
function pondDeco(ctx, x, y, tx, ty, env, r) {
  if (env.season === 'winter') {
    // лёд: блики и следы коньков
    blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.25)', 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 12 + r(7) * 8);
    ctx.quadraticCurveTo(x + 20, y + 10 + r(8) * 14, x + 30, y + 20 + r(9) * 8);
    if (r(10) < 0.5) {
      ctx.moveTo(x + 20, y + 36);
      ctx.quadraticCurveTo(x + 30, y + 30, x + 42, y + 34);
    }
    ctx.stroke();
    return;
  }
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.06)', 1.4);
  blotch(ctx, x, y, r, 6, 'rgba(20,70,120,.045)', 1.4);
  if (r(12) < 0.3) {
    // кувшинка
    const cx = x + 12 + r(13) * 24,
      cy = y + 12 + r(14) * 24,
      rad = 8 + r(15) * 3,
      a = r(16) * 6;
    ctx.fillStyle = 'rgba(20,70,110,.18)';
    ctx.beginPath();
    ctx.ellipse(cx + 1.5, cy + 2.5, rad, rad * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, rad, rad * 0.72, 0, a, a + TAU - 0.7);
    ctx.closePath();
    ctx.fillStyle = env.season === 'autumn' ? '#9fb24a' : '#56c267';
    ctx.fill();
    ctx.strokeStyle = env.season === 'autumn' ? '#7d8f38' : '#2f9e44';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    if (r(17) < 0.55 && env.season !== 'autumn')
      flower(ctx, cx + 1, cy - 1, 2.8, r(18) < 0.5 ? '#ffb3cb' : '#fff', '#ffd43b');
  }
}
function plankDeco(ctx, x, y, tx, ty, env, r) {
  // доски поперёк: каждая чуть своего тона, гвоздики по краям
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 16;
    ctx.fillStyle = r(i) < 0.5 ? 'rgba(255,255,255,.1)' : 'rgba(80,45,15,.08)';
    ctx.fillRect(x, yy, T, 16);
    ctx.fillStyle = 'rgba(70,40,15,.3)';
    ctx.fillRect(x, yy + 14.6, T, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x, yy, T, 1.2);
    ctx.fillStyle = 'rgba(70,40,15,.45)';
    ctx.fillRect(x + 5, yy + 7, 1.8, 1.8);
    ctx.fillRect(x + T - 7, yy + 7, 1.8, 1.8);
  }
  if (env.season === 'winter') snowDust(ctx, x, y, r);
}
function iceDeco(ctx, x, y, tx, ty, env, r) {
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.5)', 1.4);
  blotch(ctx, x, y, r, 6, 'rgba(170,210,235,.18)', 1.2);
  if (r(12) < 0.4) {
    ctx.strokeStyle = 'rgba(150,200,232,.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 14);
    ctx.lineTo(x + 24, y + 20);
    ctx.moveTo(x + 28, y + 34);
    ctx.lineTo(x + 40, y + 30);
    ctx.stroke();
  }
}
function seaDeco(ctx, x, y, tx, ty, env, r) {
  // тёмные и светлые разводы — глубина не «плоская»
  blotch(ctx, x, y, r, 0, 'rgba(255,255,255,.03)', 1);
  blotch(ctx, x, y, r, 6, 'rgba(10,50,120,.022)', 1);
}

// ---------- вода ----------
/** Цвет глубины: от берега (описание.water.shoreY) вглубь вода темнеет плавно. */
function seaFill(env, ctx) {
  const shore = (env.map.water.shoreY || 0) * T,
    w = env.season === 'winter';
  const g = ctx.createLinearGradient(0, shore - T, 0, shore + 16 * T);
  g.addColorStop(0, w ? '#74bcd9' : '#55c3f0');
  g.addColorStop(0.3, w ? '#559fca' : '#3aa7e8');
  g.addColorStop(1, w ? '#2f6f9c' : '#1c6fc4');
  return g;
}
/** Бегущие блики на воде: один путь на все видимые клетки. */
function seaLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.42)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const tx = cells[i],
      ty = cells[i + 1],
      hsh = hash(tx, ty);
    if (hsh > 0.62) continue;
    const ph = t * 1.1 + tx * 0.9 + ty * 1.7,
      wx = tx * T + 6 + Math.sin(ph) * 7 + hsh * 10,
      wy = ty * T + 10 + hash(ty, tx) * 28,
      len = 7 + hsh * 8;
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + len * 0.5, wy - 4, wx + len, wy);
    ctx.quadraticCurveTo(wx + len * 1.5, wy + 4, wx + len * 2, wy);
  }
  ctx.stroke();
}
function poolLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const tx = cells[i],
      ty = cells[i + 1],
      x = tx * T,
      y = ty * T,
      ph = t * 1.6 + tx * 1.3 + ty * 0.7;
    ctx.moveTo(x + 6 + Math.sin(ph) * 4, y + 14);
    ctx.quadraticCurveTo(x + 20, y + 8 + Math.cos(ph) * 4, x + 36 + Math.sin(ph) * 4, y + 16);
    if ((tx + ty) % 2) {
      ctx.moveTo(x + 12 - Math.sin(ph) * 4, y + 36);
      ctx.quadraticCurveTo(x + 26, y + 30 + Math.sin(ph) * 4, x + 40, y + 38);
    }
  }
  ctx.stroke();
}
const SEA = { wet: true, surf: true, step: 'paddle', stepEvery: 0.5, deco: seaDeco, live: seaLive };

defineTiles({
  w: {
    ...SEA,
    map: '#3fb0ea',
    z: 0,
    fill: seaFill,
    swim: { clip: -38, where: 'sea' },
    speed: 170,
  },
  O: { ...SEA, map: '#1c6fc4', z: 0, fill: seaFill, walk: false },
  h: {
    ...SEA,
    map: '#7fdcf7',
    z: 1,
    fill: (env) => (env.season === 'winter' ? '#a5d9ec' : '#86e0f6'),
    // мелководье светлее и расплывается в глубину мягким ореолом
    edge: {
      wob: 7,
      out: [
        [(env) => (env.season === 'winter' ? 'rgba(165,217,236,.3)' : 'rgba(134,224,246,.28)'), 34],
        [(env) => (env.season === 'winter' ? 'rgba(165,217,236,.45)' : 'rgba(134,224,246,.45)'), 16],
      ],
    },
    swim: { clip: -30, where: 'sea' },
    speed: 140,
  },
  s: {
    map: (env) => pal(env).s,
    step: 'stepSand',
    z: 2,
    fill: (env) => pal(env).s,
    // берег: пена на воде, полоса мокрого песка и светлая кромка
    edge: {
      wob: 7,
      out: [
        ['rgba(255,255,255,.35)', 16],
        ['rgba(255,255,255,.75)', 7],
      ],
      in: [
        [(env) => pal(env).sd, 30],
        [(env) => mix(pal(env).sd, '#c9a35e', 0.3), 14],
        ['rgba(255,255,255,.6)', 4],
      ],
    },
    deco: sandDeco,
  },
  I: {
    map: '#eef8ff',
    step: 'stepSnow',
    z: 3,
    fill: '#eef7fd',
    edge: {
      wob: 6,
      out: [
        ['rgba(255,255,255,.5)', 14],
        ['#ffffff', 6],
      ],
      in: [
        ['#bfe0f3', 16],
        ['#ffffff', 5],
      ],
    },
    deco: iceDeco,
  },
  g: {
    map: (env) => pal(env).g1,
    step: () => (isWinter() ? 'stepSnow' : 'step'),
    z: 4,
    fill: (env) => pal(env).g,
    // край травы: мягкая тень на песке и тёмная кайма
    edge: {
      wob: 6,
      out: [['rgba(90,70,30,.14)', 10]],
      in: [
        [(env) => pal(env).gr, 7],
        [(env) => pal(env).gd, 3],
      ],
    },
    deco: grassDeco,
  },
  y: {
    map: '#ead9b5',
    z: 5,
    fill: (env) => pal(env).y,
    edge: {
      wob: 5,
      out: [[(env) => (env.season === 'winter' ? 'rgba(160,190,215,.5)' : 'rgba(70,120,40,.3)'), 5]],
      in: [[(env) => (env.season === 'winter' ? 'rgba(170,190,210,.4)' : 'rgba(150,105,55,.28)'), 6]],
    },
    deco: pathDeco,
  },
  r: {
    map: '#eadcc0',
    z: 6,
    fill: (env) => pal(env).r,
    // бордюр: камень по краю улицы
    edge: {
      r: 10,
      out: [
        ['rgba(90,70,45,.35)', 8],
        [(env) => (env.season === 'winter' ? '#f4f6f8' : '#d8c6a6'), 5.5],
      ],
      in: [['rgba(255,255,255,.35)', 4]],
    },
    deco: paveDeco,
  },
  k: {
    map: '#e3d3c3',
    z: 7,
    fill: (env) => pal(env).k,
    edge: {
      r: 8,
      out: [
        ['rgba(90,70,45,.35)', 8],
        [(env) => (env.season === 'winter' ? '#f4f6f8' : '#dcc3ad'), 5.5],
      ],
    },
    deco: plazaDeco,
  },
  p: {
    map: '#f1f3f5',
    z: 8,
    fill: (env) => (env.season === 'winter' ? '#f3f7fa' : '#eef3f6'),
    edge: {
      r: 8,
      out: [
        ['rgba(60,80,100,.22)', 7],
        ['#ffffff', 4],
      ],
    },
    deco: deckDeco,
  },
  o: {
    map: '#58c6f2',
    wet: true,
    swim: { clip: -30, where: 'pool' },
    speed: 140,
    step: 'paddle',
    stepEvery: 0.5,
    z: 9,
    fill: '#5cc9f4',
    // бортик бассейна: белый камень с контуром, внутри — тень от бортика на воде
    edge: {
      r: 12,
      out: [
        ['#4a3728', 15],
        ['#ffffff', 11],
        ['rgba(120,170,200,.6)', 2],
      ],
      in: [
        ['rgba(20,90,150,.22)', 12],
        ['rgba(255,255,255,.5)', 3],
      ],
    },
    deco: poolDeco,
    live: poolLive,
  },
  d: {
    map: (env) => (env.season === 'winter' ? '#d9f1ff' : '#5db6dc'),
    wet: true,
    walk: isWinter,
    slide: true,
    speed: 270,
    step: 'skate',
    stepEvery: 0.45,
    onEnter: () => emit('skate'),
    z: 10,
    fill: (env) => (env.season === 'winter' ? '#d3edfb' : '#5fb9df'),
    // берег пруда: тёмная влажная земля, у воды — тень и светлая кромка
    edge: {
      wob: 7,
      out: [
        [(env) => (env.season === 'winter' ? '#c5d9e8' : '#6ea548'), 9],
        [(env) => (env.season === 'winter' ? '#e4eff7' : '#9a8558'), 4],
      ],
      in: [
        [(env) => (env.season === 'winter' ? 'rgba(140,190,225,.5)' : 'rgba(20,80,130,.3)'), 14],
        ['rgba(255,255,255,.45)', 3],
      ],
    },
    deco: pondDeco,
  },
  i: {
    map: '#c98b5a',
    step: 'stepWood',
    bridge: true,
    z: 11,
    fill: '#cd9160',
    edge: {
      r: 3,
      out: [
        ['rgba(10,40,90,.2)', 16],
        ['#6b4423', 5],
      ],
    },
    deco: plankDeco,
  },
});

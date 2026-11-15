// Мебель «как у соседей»: вещи из домов жителей (штурвал, телескоп, гигантский холодильник…).
// Таблица подключается к общей в art/furniture.js. Правила те же: у напольных предметов начало координат —
// середина нижнего края, у настенных — центр; st: { t: время, on: «потрогали» или включён }.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade, rr, heart } from '../core/draw.js';

const OUT = '#4a3728';
const WOOD = '#d9a066';
/** Подпрыгивание игрушки, которую потрогали. */
const hop = (st, k = 8) => (st.on ? Math.abs(Math.sin(st.t * 9)) * k : 0);
/** Линия с тёмной обводкой — «палочка» (ножка, древко, труба). */
function bar(c, x1, y1, x2, y2, col, lw) {
  line(c, x1, y1, x2, y2, OUT, lw + 3);
  line(c, x1, y1, x2, y2, col, lw);
}
/** Замкнутая кривая по точкам [x, y, …] с заливкой и обводкой. */
function blob(c, pts, fill, stroke = OUT, lw = 2) {
  c.beginPath();
  c.moveTo((pts[0] + pts[pts.length - 2]) / 2, (pts[1] + pts[pts.length - 1]) / 2);
  for (let i = 0; i < pts.length; i += 2) {
    const nx = pts[(i + 2) % pts.length],
      ny = pts[(i + 3) % pts.length];
    c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + nx) / 2, (pts[i + 1] + ny) / 2);
  }
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}
/** Горшочек с ростком. */
function sprout(c, x, y, s, leaf, sway = 0) {
  poly(c, [x - 9 * s, y - 14 * s, x + 9 * s, y - 14 * s, x + 7 * s, y, x - 7 * s, y], '#e8590c', OUT, 1.5);
  c.save();
  c.translate(x, y - 14 * s);
  c.rotate(sway);
  line(c, 0, 0, 0, -12 * s, '#2f9e44', 2.5);
  ell(c, -6 * s, -14 * s, 7 * s, 4 * s, leaf, OUT, 1.2, 0.5);
  ell(c, 6 * s, -16 * s, 7 * s, 4 * s, leaf, OUT, 1.2, -0.5);
  c.restore();
}
/** Кубок. */
function cupAt(c, x, y, s, col = '#ffd43b') {
  fillRR(c, x - 8 * s, y - 5 * s, 16 * s, 5 * s, 1.5, '#8d5524', OUT, 1.2);
  fillRR(c, x - 2 * s, y - 12 * s, 4 * s, 8 * s, 1, col, OUT, 1.2);
  c.beginPath();
  c.moveTo(x - 10 * s, y - 30 * s);
  c.lineTo(x + 10 * s, y - 30 * s);
  c.quadraticCurveTo(x + 9 * s, y - 12 * s, x, y - 11 * s);
  c.quadraticCurveTo(x - 9 * s, y - 12 * s, x - 10 * s, y - 30 * s);
  c.closePath();
  c.fillStyle = col;
  c.fill();
  c.strokeStyle = OUT;
  c.lineWidth = 1.5;
  c.stroke();
  c.beginPath();
  c.arc(x - 11 * s, y - 23 * s, 4.5 * s, 0.5 * Math.PI, 1.5 * Math.PI);
  c.stroke();
  c.beginPath();
  c.arc(x + 11 * s, y - 23 * s, 4.5 * s, -0.5 * Math.PI, 0.5 * Math.PI);
  c.stroke();
}

export const D_HOMES = {
  // ---------- море: Капитан Боб ----------
  ship_wheel(c, d, w, h, st) {
    c.save();
    c.rotate(st.on ? st.t * 5 : 0.2);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        x = Math.cos(a),
        y = Math.sin(a);
      bar(c, x * 8, y * 8, x * 42, y * 42, shade(d.c, -0.15), 5);
      ell(c, x * 43, y * 43, 5.5, 5.5, d.c, OUT, 1.5);
    }
    ell(c, 0, 0, 30, 30, null, OUT, 12);
    ell(c, 0, 0, 30, 30, null, d.c, 8);
    ell(c, 0, 0, 30, 30, null, shade(d.c, 0.25), 2);
    ell(c, 0, 0, 10, 10, '#ffd43b', OUT);
    ell(c, 0, 0, 3.5, 3.5, '#e0a800');
    c.restore();
  },
  fishnet(c, d, w, h) {
    const path = () => {
      c.beginPath();
      c.moveTo(-w / 2 + 4, -h / 2 + 4);
      c.quadraticCurveTo(0, -h / 2 + 22, w / 2 - 4, -h / 2 + 4);
      c.quadraticCurveTo(w / 2 - 6, h / 2 - 20, w / 2 - 30, h / 2 - 14);
      c.quadraticCurveTo(0, h / 2 + 10, -w / 2 + 30, h / 2 - 14);
      c.quadraticCurveTo(-w / 2 + 6, h / 2 - 20, -w / 2 + 4, -h / 2 + 4);
      c.closePath();
    };
    c.save();
    path();
    c.fillStyle = 'rgba(217,160,102,.22)';
    c.fill();
    c.clip();
    for (let x = -w; x < w; x += 15) {
      line(c, x, -h / 2, x + h, h / 2, '#a8703f', 1.5);
      line(c, x + h, -h / 2, x, h / 2, '#a8703f', 1.5);
    }
    c.restore();
    path();
    c.strokeStyle = '#8d5524';
    c.lineWidth = 3;
    c.stroke();
    // улов: рыбка, морская звезда, поплавки
    ell(c, -30, 2, 15, 8, '#74c0fc', OUT, 1.5);
    poly(c, [-44, 2, -55, -5, -55, 9], '#74c0fc', OUT, 1.5);
    ell(c, -23, 0, 1.8, 1.8, OUT);
    star(c, 30, 8, 12, '#ff922b', OUT, 1.5);
    for (const x of [-60, 0, 60]) ell(c, x, -h / 2 + 12 + (x ? 0 : 6), 6, 6, '#ff6b6b', OUT, 1.5);
    ell(c, -w / 2 + 4, -h / 2 + 4, 4.5, 4.5, '#ffd43b', OUT, 1.5);
    ell(c, w / 2 - 4, -h / 2 + 4, 4.5, 4.5, '#ffd43b', OUT, 1.5);
  },
  seamap(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h, 4, '#f6e2b3', OUT);
    c.save();
    rr(c, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 2);
    c.clip();
    c.fillStyle = '#cfe9f5';
    c.fillRect(-w / 2, -h / 2, w, h);
    blob(c, [-50, -24, -22, -30, -16, -6, -40, -2], '#e9d59a', '#a8703f', 1.5);
    blob(c, [14, 8, 44, 4, 50, 26, 22, 30], '#b2e3a0', '#a8703f', 1.5);
    blob(c, [-40, 20, -22, 16, -18, 30, -36, 34], '#b2e3a0', '#a8703f', 1.5);
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(-28, -10);
    c.quadraticCurveTo(6, -22, 4, 2);
    c.quadraticCurveTo(2, 18, 30, 16);
    c.strokeStyle = '#e03131';
    c.lineWidth = 2;
    c.stroke();
    c.setLineDash([]);
    line(c, 26, 11, 36, 21, '#e03131', 3);
    line(c, 36, 11, 26, 21, '#e03131', 3);
    // роза ветров
    star(c, 42, -22, 11, '#fff', OUT, 1.2);
    ell(c, 42, -22, 2.5, 2.5, '#e03131');
    c.restore();
    fillRR(c, -w / 2 - 3, -h / 2 - 4, w + 6, 8, 3, WOOD, OUT, 1.5);
    fillRR(c, -w / 2 - 3, h / 2 - 4, w + 6, 8, 3, WOOD, OUT, 1.5);
  },
  anchor(c, d, w, h, st) {
    c.save();
    c.translate(0, -hop(st, 6));
    c.rotate(st.on ? Math.sin(st.t * 9) * 0.08 : 0);
    const arms = (lw, col) => {
      c.beginPath();
      c.arc(0, -40, 28, 0.08 * Math.PI, 0.92 * Math.PI);
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.lineCap = 'round';
      c.stroke();
    };
    arms(13, OUT);
    bar(c, 0, -h + 22, 0, -12, d.c, 8);
    arms(8, d.c);
    bar(c, -20, -h + 34, 20, -h + 34, d.c, 6);
    ell(c, 0, -h + 12, 9, 9, null, OUT, 9);
    ell(c, 0, -h + 12, 9, 9, null, d.c, 5);
    poly(c, [-36, -34, -22, -42, -24, -24], d.c, OUT);
    poly(c, [36, -34, 22, -42, 24, -24], d.c, OUT);
    c.restore();
  },
  lifebuoy(c, d, w, h) {
    const r = w / 2 - 11;
    ell(c, 0, 0, r, r, null, OUT, 20);
    ell(c, 0, 0, r, r, null, '#fff', 16);
    c.strokeStyle = '#ff6b6b';
    c.lineWidth = 16;
    c.lineCap = 'butt';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(0, 0, r, (i * TAU) / 4 + 0.3, (i * TAU) / 4 + 1.27);
      c.stroke();
    }
    ell(c, 0, 0, r + 8, r + 8, null, OUT, 1.5);
    ell(c, 0, 0, r - 8, r - 8, null, OUT, 1.5);
  },
  hammock(c, d, w, h) {
    // стойки
    bar(c, -w / 2 + 10, 0, -w / 2 + 22, -h + 8, WOOD, 7);
    bar(c, w / 2 - 10, 0, w / 2 - 22, -h + 8, WOOD, 7);
    fillRR(c, -w / 2, -8, 34, 8, 3, shade(WOOD, -0.2), OUT);
    fillRR(c, w / 2 - 34, -8, 34, 8, 3, shade(WOOD, -0.2), OUT);
    // верёвки и полотно
    line(c, -w / 2 + 21, -h + 12, -w / 2 + 52, -h + 46, '#a8703f', 2.5);
    line(c, w / 2 - 21, -h + 12, w / 2 - 52, -h + 46, '#a8703f', 2.5);
    c.beginPath();
    c.moveTo(-w / 2 + 48, -h + 42);
    c.quadraticCurveTo(0, -h + 62, w / 2 - 48, -h + 42);
    c.quadraticCurveTo(w / 2 - 40, -16, 0, -14);
    c.quadraticCurveTo(-w / 2 + 40, -16, -w / 2 + 48, -h + 42);
    c.closePath();
    c.fillStyle = d.c;
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (let x = -w / 2 + 62; x < w / 2 - 50; x += 30) c.fillRect(x, -h, 12, h);
    c.restore();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    fillRR(c, -w / 2 + 58, -h + 46, 40, 22, 10, '#fff', OUT, 1.5);
  },
  // ---------- наука: Профессор Орешкин ----------
  globe(c, d, w, h, st) {
    fillRR(c, -20, -8, 40, 8, 4, shade(WOOD, -0.2), OUT);
    fillRR(c, -4, -26, 8, 20, 2, WOOD, OUT);
    const cy = -h + 34,
      r = 30;
    c.beginPath();
    c.arc(0, cy, r + 5, -0.35 * Math.PI, 0.6 * Math.PI);
    c.strokeStyle = OUT;
    c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = '#ffd43b';
    c.lineWidth = 3;
    c.stroke();
    ell(c, 0, cy, r, r, d.c, OUT);
    c.save();
    c.beginPath();
    c.arc(0, cy, r - 1, 0, TAU);
    c.clip();
    const sh = ((st.on ? st.t * 90 : 12) % 120) - 60; // материки «уезжают» за край, когда глобус крутят
    for (const dx of [sh - 120, sh, sh + 120]) {
      blob(c, [dx - 18, cy - 20, dx + 4, cy - 24, dx + 8, cy - 6, dx - 12, cy + 2], '#69db7c', null);
      blob(c, [dx + 20, cy + 2, dx + 40, cy - 2, dx + 38, cy + 20, dx + 22, cy + 18], '#8ce99a', null);
      blob(c, [dx - 34, cy + 10, dx - 20, cy + 8, dx - 22, cy + 24, dx - 34, cy + 22], '#69db7c', null);
    }
    ell(c, -10, cy - 12, 8, 5, 'rgba(255,255,255,.35)', null, 0, -0.5);
    c.restore();
    ell(c, 0, cy, r, r, null, OUT, 2);
  },
  telescope(c, d, w, h) {
    // тренога
    bar(c, -6, -h * 0.5, -34, 0, '#868e96', 4);
    bar(c, -6, -h * 0.5, 22, 0, '#868e96', 4);
    bar(c, -6, -h * 0.5, -6, -6, '#adb5bd', 4);
    // труба смотрит вправо-вверх
    c.save();
    c.translate(-6, -h * 0.5 - 6);
    c.rotate(-0.62);
    fillRR(c, -44, -8, 26, 16, 4, shade(d.c, -0.2), OUT);
    fillRR(c, -22, -11, 64, 22, 5, d.c, OUT);
    fillRR(c, 38, -15, 22, 30, 5, shade(d.c, 0.25), OUT);
    ell(c, 60, 0, 5, 13, '#d0ebff', OUT, 1.5);
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.fillRect(-18, -8, 54, 4);
    fillRR(c, -52, -5, 10, 10, 3, '#343a40', OUT, 1.5);
    c.restore();
    ell(c, -6, -h * 0.5 - 4, 6, 6, '#ffd43b', OUT, 1.5);
  },
  desk(c, d, w, h) {
    fillRR(c, -w / 2 + 6, -54, 12, 54, 3, shade(d.c, -0.15), OUT);
    fillRR(c, w / 2 - 58, -54, 52, 54, 5, shade(d.c, -0.08), OUT);
    for (const y of [-46, -24]) {
      fillRR(c, w / 2 - 52, y, 40, 16, 3, shade(d.c, 0.2), OUT, 1.5);
      ell(c, w / 2 - 32, y + 8, 2.5, 2.5, '#ffd43b', OUT, 1);
    }
    fillRR(c, -w / 2, -64, w, 12, 5, d.c, OUT);
    // стопка книг, лампа, листок
    const cols = ['#ff6b6b', '#4dabf7', '#51cf66'];
    cols.forEach((col, i) => fillRR(c, -w / 2 + 12 + i * 3, -74 - i * 9, 44 - i * 5, 9, 2, col, OUT, 1.2));
    fillRR(c, 0, -67, 34, 4, 1, '#fff', OUT, 1);
    line(c, 6, -70, 26, -76, '#845ef7', 2.5);
    fillRR(c, w / 2 - 38, -70, 22, 6, 3, '#2f9e44', OUT, 1.5);
    line(c, w / 2 - 27, -70, w / 2 - 27, -88, OUT, 3);
    poly(c, [w / 2 - 44, -86, w / 2 - 12, -86, w / 2 - 18, -h + 0, w / 2 - 38, -h + 0], '#51cf66', OUT);
  },
  blackboard(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h - 8, 5, WOOD, OUT);
    fillRR(c, -w / 2 + 7, -h / 2 + 7, w - 14, h - 22, 3, '#2b8a5e', OUT, 1.5);
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.font = '800 17px ui-rounded, "Trebuchet MS", sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('2 + 2 = 4', -w / 2 + 16, -h / 2 + 24);
    c.fillStyle = '#ffe066';
    c.fillText('🌰 + 🌰 = 😋', -w / 2 + 16, -h / 2 + 50);
    line(c, w / 2 - 44, -h / 2 + 20, w / 2 - 20, -h / 2 + 20, 'rgba(255,255,255,.8)', 2);
    line(c, w / 2 - 44, -h / 2 + 28, w / 2 - 28, -h / 2 + 28, 'rgba(255,255,255,.8)', 2);
    fillRR(c, -w / 2 - 4, h / 2 - 12, w + 8, 8, 3, shade(WOOD, -0.15), OUT, 1.5);
    fillRR(c, -20, h / 2 - 17, 16, 5, 2, '#fff', OUT, 1);
    fillRR(c, 4, h / 2 - 17, 12, 5, 2, '#ffa8a8', OUT, 1);
  },
  // ---------- мода: Буся ----------
  vanity(c, d, w, h) {
    fillRR(c, -w / 2 + 6, -56, 9, 56, 3, shade(d.c, -0.2), OUT);
    fillRR(c, w / 2 - 15, -56, 9, 56, 3, shade(d.c, -0.2), OUT);
    fillRR(c, -w / 2, -66, w, 26, 7, d.c, OUT);
    fillRR(c, -w / 2 + 10, -60, w - 20, 14, 4, shade(d.c, 0.3), OUT, 1.5);
    ell(c, 0, -53, 3, 3, '#ffd43b', OUT, 1);
    // зеркало с лампочками
    ell(c, 0, -h + 44, 36, 42, '#ffd43b', OUT);
    ell(c, 0, -h + 44, 29, 35, '#d0ebff', OUT, 1.5);
    line(c, -12, -h + 34, 2, -h + 20, 'rgba(255,255,255,.9)', 4);
    line(c, -4, -h + 48, 6, -h + 38, 'rgba(255,255,255,.9)', 3);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i * Math.PI) / 6;
      ell(c, Math.cos(a) * 40, -h + 44 + Math.sin(a) * 46, 4, 4, '#fff9db', OUT, 1.2);
    }
    // флакончики
    fillRR(c, -w / 2 + 12, -80, 12, 14, 3, '#f783ac', OUT, 1.5);
    fillRR(c, -w / 2 + 15, -86, 6, 6, 2, '#ffd43b', OUT, 1);
    fillRR(c, w / 2 - 26, -78, 14, 12, 5, '#b197fc', OUT, 1.5);
    ell(c, w / 2 - 19, -82, 4, 4, '#fff', OUT, 1);
  },
  mannequin(c, d, w, h, st) {
    ell(c, 0, -4, 20, 5, '#868e96', OUT);
    fillRR(c, -2.5, -h * 0.42, 5, h * 0.42 - 4, 2, '#868e96', OUT, 1.5);
    c.save();
    c.translate(0, -hop(st, 5));
    c.rotate(st.on ? Math.sin(st.t * 9) * 0.06 : 0);
    // платье: лиф и пышная юбка
    poly(c, [-13, -h + 30, 13, -h + 30, 10, -h + 62, -10, -h + 62], d.c, OUT);
    blob(c, [-12, -h + 60, 12, -h + 60, 30, -h * 0.36, 0, -h * 0.3, -30, -h * 0.36], shade(d.c, 0.18), OUT);
    for (const x of [-14, 0, 14]) line(c, x * 0.5, -h + 66, x, -h * 0.36, shade(d.c, -0.12), 1.5);
    fillRR(c, -14, -h + 58, 28, 7, 3, '#ffd43b', OUT, 1.5);
    poly(c, [-13, -h + 30, -5, -h + 22, 5, -h + 22, 13, -h + 30], '#f3ede4', OUT, 1.5);
    fillRR(c, -4, -h + 10, 8, 14, 3, '#f3ede4', OUT, 1.5);
    ell(c, 0, -h + 8, 7, 5, '#f3ede4', OUT, 1.5);
    heart(c, 0, -h + 44, 5, '#fff');
    c.restore();
  },
  clothes_rack(c, d, w, h) {
    bar(c, -w / 2 + 12, 0, -w / 2 + 12, -h + 26, '#adb5bd', 4);
    bar(c, w / 2 - 12, 0, w / 2 - 12, -h + 26, '#adb5bd', 4);
    bar(c, -w / 2 + 6, -h + 26, w / 2 - 6, -h + 26, '#ced4da', 4);
    fillRR(c, -w / 2, -6, 26, 6, 3, '#868e96', OUT, 1.5);
    fillRR(c, w / 2 - 26, -6, 26, 6, 3, '#868e96', OUT, 1.5);
    const cols = ['#ff6b9d', '#74c0fc', '#ffd43b', '#b197fc', '#63e6be'];
    cols.forEach((col, i) => {
      const x = -w / 2 + 30 + i * 23,
        len = 70 + ((i * 17) % 28);
      line(c, x, -h + 26, x, -h + 36, OUT, 2);
      poly(c, [x - 9, -h + 40, x + 9, -h + 40, x + 13, -h + 40 + len, x - 13, -h + 40 + len], col, OUT, 1.5);
      line(c, x - 9, -h + 52, x + 9, -h + 52, shade(col, -0.15), 2);
    });
    // шляпа с пером на углу
    ell(c, w / 2 - 12, -h + 16, 22, 6, '#f783ac', OUT, 1.5);
    fillRR(c, w / 2 - 24, -h + 2, 24, 14, 6, '#f783ac', OUT, 1.5);
    c.beginPath();
    c.moveTo(w / 2 - 4, -h + 6);
    c.quadraticCurveTo(w / 2 + 14, -h - 8, w / 2 + 4, -h + 12);
    c.strokeStyle = '#845ef7';
    c.lineWidth = 4;
    c.stroke();
  },
  // ---------- кухня: Пончик ----------
  fridge_giant(c, d, w, h) {
    fillRR(c, -w / 2 + 10, -8, 14, 8, 2, '#868e96', OUT);
    fillRR(c, w / 2 - 24, -8, 14, 8, 2, '#868e96', OUT);
    fillRR(c, -w / 2, -h, w, h - 6, 16, d.c, OUT);
    line(c, 0, -h + 4, 0, -h * 0.34, OUT, 2);
    line(c, -w / 2, -h * 0.34, w / 2, -h * 0.34, OUT, 2);
    fillRR(c, -14, -h + 40, 6, 60, 3, '#adb5bd', OUT, 1.5);
    fillRR(c, 8, -h + 40, 6, 60, 3, '#adb5bd', OUT, 1.5);
    fillRR(c, -30, -h * 0.34 + 10, 60, 6, 3, '#adb5bd', OUT, 1.5);
    // окошко с лампочкой, магниты и записка
    fillRR(c, w / 2 - 54, -h + 22, 36, 26, 5, '#e7f5ff', OUT, 1.5);
    c.font = '18px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('🍩', w / 2 - 36, -h + 36);
    fillRR(c, -w / 2 + 16, -h + 24, 30, 34, 3, '#fff9db', OUT, 1.2);
    for (let i = 0; i < 3; i++) line(c, -w / 2 + 21, -h + 34 + i * 7, -w / 2 + 41, -h + 34 + i * 7, '#adb5bd', 1.5);
    ell(c, -w / 2 + 31, -h + 24, 4, 4, '#ff6b6b', OUT, 1);
    star(c, -w / 2 + 30, -h + 80, 9, '#ffd43b', OUT, 1.2);
    heart(c, w / 2 - 30, -h + 76, 8, '#ff6b9d');
    ell(c, w / 2 - 44, -h + 100, 7, 7, '#69db7c', OUT, 1.2);
  },
  oven(c, d, w, h, st) {
    fillRR(c, -w / 2, -h + 22, w, h - 22, 8, d.c, OUT);
    fillRR(c, -w / 2 - 3, -h + 14, w + 6, 12, 5, '#f8f9fa', OUT);
    for (let i = 0; i < 4; i++) ell(c, -w / 2 + 18 + i * 22, -h + 40, 5, 5, '#ff6b6b', OUT, 1.2);
    // окошко духовки: внутри пирог, «включена» — светится
    const lit = st.on !== false;
    fillRR(c, -w / 2 + 12, -h + 52, w - 24, 44, 6, lit ? '#ffb86b' : '#343a40', OUT);
    if (lit) {
      const g = c.createRadialGradient(0, -h + 76, 4, 0, -h + 76, 40);
      g.addColorStop(0, 'rgba(255,243,191,.9)');
      g.addColorStop(1, 'rgba(255,146,43,0)');
      c.fillStyle = g;
      c.fillRect(-w / 2 + 14, -h + 54, w - 28, 40);
    }
    ell(c, 0, -h + 84, 24, 8, '#e8a15c', OUT, 1.5);
    ell(c, 0, -h + 80, 20, 6, '#ffd8a8', OUT, 1.2);
    fillRR(c, -w / 2 + 16, -h + 46, w - 32, 5, 2, '#adb5bd', OUT, 1.2);
    // на плите — готовый пирог, от него идёт пар
    ell(c, 10, -h + 12, 26, 7, '#e8a15c', OUT, 1.5);
    ell(c, 10, -h + 8, 22, 6, '#ffd8a8', OUT, 1.2);
    ell(c, 10, -h + 6, 5, 3, '#ff6b6b');
    for (let i = 0; i < 2; i++) {
      const p = (st.t * 0.5 + i * 0.5) % 1;
      c.globalAlpha = 0.6 * (1 - p);
      ell(c, 4 + i * 14 + Math.sin(p * 6 + i) * 4, -h - 2 - p * 26, 5, 5, '#fff');
    }
    c.globalAlpha = 1;
  },
  pot_rack(c, d, w, h, st) {
    fillRR(c, -w / 2, -h / 2, w, 9, 4, WOOD, OUT);
    const sw = Math.sin(st.t * 1.3) * 0.03;
    const hang = (x, fn) => {
      c.save();
      c.translate(x, -h / 2 + 8);
      c.rotate(sw);
      line(c, 0, 0, 0, 12, OUT, 2);
      fn();
      c.restore();
    };
    hang(-52, () => {
      fillRR(c, -17, 12, 34, 24, 5, '#ff8787', OUT);
      fillRR(c, -20, 10, 40, 6, 3, '#ffa8a8', OUT, 1.5);
      line(c, 17, 20, 30, 16, OUT, 4);
    });
    hang(-4, () => {
      ell(c, 0, 30, 18, 18, '#495057', OUT);
      ell(c, 0, 30, 12, 12, '#868e96');
      line(c, 0, 12, 0, 14, OUT, 5);
    });
    hang(40, () => {
      fillRR(c, -13, 12, 26, 30, 5, '#74c0fc', OUT);
      fillRR(c, -16, 10, 32, 6, 3, '#a5d8ff', OUT, 1.5);
    });
    hang(68, () => {
      line(c, 0, 12, 0, 34, '#adb5bd', 3);
      ell(c, 0, 40, 7, 8, '#ced4da', OUT, 1.5);
    });
  },
  // ---------- спорт: Сеня ----------
  barbell(c, d, w, h, st) {
    for (const x of [-w / 2 + 34, w / 2 - 34]) {
      bar(c, x, 0, x, -h + 26, '#adb5bd', 5);
      fillRR(c, x - 14, -6, 28, 6, 3, '#868e96', OUT, 1.5);
      fillRR(c, x - 8, -h + 20, 16, 8, 3, '#ffd43b', OUT, 1.5);
    }
    c.save();
    c.translate(0, -(st.on ? Math.abs(Math.sin(st.t * 5)) * 22 : 0));
    bar(c, -w / 2 + 6, -h + 18, w / 2 - 6, -h + 18, '#ced4da', 4);
    for (const s of [-1, 1]) {
      fillRR(c, s * (w / 2 - 14) - 6, -h, 12, 36, 4, d.c, OUT);
      fillRR(c, s * (w / 2 - 27) - 5, -h + 5, 10, 26, 4, '#ff6b6b', OUT);
    }
    c.restore();
  },
  punchbag(c, d, w, h, st) {
    fillRR(c, -w / 2, -8, w, 8, 3, '#868e96', OUT);
    bar(c, -w / 2 + 8, -4, -w / 2 + 8, -h + 6, '#adb5bd', 5);
    bar(c, -w / 2 + 8, -h + 6, 14, -h + 6, '#adb5bd', 5);
    c.save();
    c.translate(10, -h + 8);
    c.rotate(st.on ? Math.sin(st.t * 8) * 0.28 * Math.max(0.2, 1 - st.t * 0.1) : Math.sin(st.t * 1.2) * 0.015);
    line(c, 0, 0, 0, 22, OUT, 2.5);
    fillRR(c, -19, 22, 38, 98, 17, d.c, OUT);
    fillRR(c, -19, 36, 38, 9, 2, shade(d.c, -0.25), null);
    fillRR(c, -19, 96, 38, 9, 2, shade(d.c, -0.25), null);
    star(c, 0, 70, 9, '#ffd43b', OUT, 1.2);
    c.fillStyle = 'rgba(255,255,255,.3)';
    c.fillRect(-13, 30, 6, 80);
    c.restore();
  },
  trophy_shelf(c, d, w, h) {
    fillRR(c, -w / 2, h / 2 - 10, w, 10, 3, WOOD, OUT);
    fillRR(c, -w / 2 + 14, h / 2 - 2, 8, 8, 2, shade(WOOD, -0.2), OUT, 1.2);
    fillRR(c, w / 2 - 22, h / 2 - 2, 8, 8, 2, shade(WOOD, -0.2), OUT, 1.2);
    cupAt(c, -w / 2 + 26, h / 2 - 10, 1.15);
    cupAt(c, 0, h / 2 - 10, 1.5);
    cupAt(c, w / 2 - 26, h / 2 - 10, 1.05, '#ced4da');
    star(c, 0, h / 2 - 44, 6, '#fff');
    // медаль на ленточке
    line(c, -34, h / 2 - 52, -30, h / 2 - 26, '#4dabf7', 4);
    ell(c, -30, h / 2 - 20, 7, 7, '#ffa94d', OUT, 1.2);
  },
  // ---------- уют: Плюша ----------
  rocking_chair(c, d, w, h, st) {
    c.save();
    c.rotate(Math.sin(st.t * 1.6) * 0.035);
    // полозья
    c.beginPath();
    c.moveTo(-w / 2, -8);
    c.quadraticCurveTo(0, 12, w / 2, -10);
    c.strokeStyle = OUT;
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = WOOD;
    c.lineWidth = 5;
    c.stroke();
    bar(c, -w / 2 + 22, -2, -w / 2 + 26, -46, WOOD, 5);
    bar(c, w / 2 - 20, -4, w / 2 - 24, -46, WOOD, 5);
    // спинка и сиденье
    fillRR(c, -w / 2 + 14, -h, 20, h - 40, 8, WOOD, OUT);
    fillRR(c, -w / 2 + 14, -54, w - 26, 14, 6, WOOD, OUT);
    bar(c, -w / 2 + 30, -70, w / 2 - 16, -70, WOOD, 5);
    // плед в клетку перекинут через спинку
    c.save();
    blob(
      c,
      [-w / 2 + 6, -h + 4, -w / 2 + 44, -h + 2, -w / 2 + 48, -50, w / 2 - 20, -52, w / 2 - 18, -30, -w / 2 + 8, -34],
      d.c,
      OUT,
    );
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,.6)';
    c.lineWidth = 3;
    for (let x = -w / 2; x < w / 2; x += 16) {
      c.beginPath();
      c.moveTo(x, -h);
      c.lineTo(x, 0);
      c.stroke();
    }
    for (let y = -h + 12; y < -24; y += 16) {
      c.beginPath();
      c.moveTo(-w / 2, y);
      c.lineTo(w / 2, y);
      c.stroke();
    }
    c.restore();
    c.restore();
  },
  tea_table(c, d, w, h, st) {
    fillRR(c, -5, -46, 10, 42, 3, shade(WOOD, -0.1), OUT);
    ell(c, 0, -4, 26, 6, shade(WOOD, -0.2), OUT);
    // скатерть
    blob(
      c,
      [-w / 2, -52, w / 2, -52, w / 2 - 4, -30, w / 2 - 30, -36, 0, -28, -w / 2 + 30, -36, -w / 2 + 4, -30],
      d.c,
      OUT,
    );
    fillRR(c, -w / 2, -58, w, 10, 5, '#fff', OUT);
    for (let x = -w / 2 + 18; x < w / 2 - 8; x += 22) heart(c, x, -40, 4, '#ff8fab');
    // чайник
    ell(c, -6, -70, 20, 15, '#ff8fab', OUT);
    fillRR(c, -16, -86, 20, 6, 3, '#ff8fab', OUT, 1.5);
    ell(c, -6, -89, 4, 4, '#ffd43b', OUT, 1.2);
    c.beginPath();
    c.moveTo(12, -72);
    c.quadraticCurveTo(26, -74, 28, -86);
    c.strokeStyle = OUT;
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = '#ff8fab';
    c.lineWidth = 4;
    c.stroke();
    c.beginPath();
    c.arc(-26, -70, 9, 0.5 * Math.PI, 1.5 * Math.PI);
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.stroke();
    ell(c, -11, -74, 4, 5, 'rgba(255,255,255,.5)');
    // чашки и пар
    for (const x of [36, -44]) {
      fillRR(c, x - 8, -68, 16, 11, 4, '#fff', OUT, 1.5);
      ell(c, x, -57, 12, 3, '#fff', OUT, 1.2);
    }
    for (let i = 0; i < 2; i++) {
      const p = (st.t * 0.45 + i * 0.5) % 1;
      c.globalAlpha = 0.55 * (1 - p);
      ell(c, 30 + Math.sin(p * 6 + i) * 4, -92 - p * 22, 4.5, 4.5, '#fff');
    }
    c.globalAlpha = 1;
  },
  // ---------- детская: Зефирка ----------
  toybox(c, d, w, h, st) {
    const j = hop(st, 14);
    // игрушки выглядывают из ящика
    ell(c, -30, -h + 16 - j, 15, 15, '#ff6b6b', OUT);
    line(c, -44, -h + 14 - j, -16, -h + 14 - j, '#fff', 3);
    fillRR(c, -6, -h + 2 - j * 0.6, 22, 22, 4, '#ffd43b', OUT);
    c.fillStyle = OUT;
    c.font = '900 15px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('A', 5, -h + 14 - j * 0.6);
    ell(c, 30, -h + 4 - j, 5, 12, '#f1e0c5', OUT, 1.5, -0.2);
    ell(c, 40, -h + 4 - j, 5, 12, '#f1e0c5', OUT, 1.5, 0.2);
    ell(c, 35, -h + 18 - j, 12, 10, '#f1e0c5', OUT, 1.5);
    ell(c, 31, -h + 16 - j, 1.6, 1.6, OUT);
    ell(c, 39, -h + 16 - j, 1.6, 1.6, OUT);
    // сам ящик
    fillRR(c, -w / 2, -h + 22, w, h - 22, 8, d.c, OUT);
    fillRR(c, -w / 2 - 3, -h + 18, w + 6, 12, 5, shade(d.c, 0.3), OUT);
    star(c, 0, -22, 13, '#ffd43b', OUT, 1.5);
    ell(c, -w / 2 + 16, -22, 5, 5, '#fff', OUT, 1.2);
    ell(c, w / 2 - 16, -22, 5, 5, '#fff', OUT, 1.2);
  },
  dollhouse(c, d, w, h, st) {
    fillRR(c, -w / 2 + 6, -h + 46, w - 12, h - 46, 4, d.c, OUT);
    poly(c, [-w / 2 - 2, -h + 50, 0, -h, w / 2 + 2, -h + 50], '#ff6b9d', OUT);
    fillRR(c, 14, -h + 10, 12, 22, 2, '#e8590c', OUT, 1.5);
    line(c, -w / 2 + 6, -h + 90, w / 2 - 6, -h + 90, OUT, 2);
    const lit = st.on ? '#fff3bf' : '#d0ebff';
    for (const [x, y] of [
      [-34, -h + 58],
      [12, -h + 58],
      [-34, -h + 98],
    ]) {
      fillRR(c, x, y, 22, 22, 3, lit, OUT, 1.5);
      line(c, x + 11, y, x + 11, y + 22, OUT, 1.2);
      line(c, x, y + 11, x + 22, y + 11, OUT, 1.2);
    }
    fillRR(c, 10, -34, 24, 34, 5, '#b197fc', OUT, 1.5);
    ell(c, 28, -17, 2, 2, '#ffd43b', OUT, 1);
    ell(c, 0, -h + 34, 8, 8, '#fff', OUT, 1.5);
    if (st.on) heart(c, 0, -h - 12 - Math.abs(Math.sin(st.t * 9)) * 8, 8, '#ff5c8a');
  },
  rocking_horse(c, d, w, h, st) {
    c.save();
    c.rotate(st.on ? Math.sin(st.t * 9) * 0.16 : Math.sin(st.t * 1.4) * 0.02);
    c.beginPath();
    c.moveTo(-w / 2, -10);
    c.quadraticCurveTo(0, 14, w / 2, -10);
    c.strokeStyle = OUT;
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#ff6b9d';
    c.lineWidth = 6;
    c.stroke();
    bar(c, -26, -40, -32, -4, d.c, 7);
    bar(c, 22, -40, 30, -4, d.c, 7);
    ell(c, -2, -48, 34, 17, d.c, OUT);
    // шея и голова
    poly(c, [16, -56, 30, -h + 14, 44, -h + 22, 34, -46], d.c, OUT);
    ell(c, 42, -h + 16, 15, 10, d.c, OUT, 2, 0.5);
    ell(c, 46, -h + 12, 2, 2.4, OUT);
    poly(c, [28, -h + 10, 31, -h, 36, -h + 8], d.c, OUT, 1.5);
    for (let i = 0; i < 4; i++) ell(c, 24 - i * 3, -h + 22 + i * 9, 6, 6, '#8d5524');
    // хвост и седло
    c.beginPath();
    c.moveTo(-34, -52);
    c.quadraticCurveTo(-56, -52, -52, -26);
    c.strokeStyle = '#8d5524';
    c.lineWidth = 7;
    c.stroke();
    fillRR(c, -18, -66, 30, 12, 6, '#ff6b9d', OUT, 1.5);
    c.restore();
  },
  // ---------- сад: Мята ----------
  seedling_shelf(c, d, w, h, st) {
    const sw = Math.sin(st.t * (st.on ? 14 : 1.4)) * (st.on ? 0.25 : 0.04);
    fillRR(c, -w / 2, -h, 9, h, 3, d.c, OUT);
    fillRR(c, w / 2 - 9, -h, 9, h, 3, d.c, OUT);
    const leaf = ['#51cf66', '#94d82d', '#37b24d'];
    for (let r = 0; r < 3; r++) {
      const y = -8 - r * 52;
      fillRR(c, -w / 2 - 3, y - 4, w + 6, 9, 3, shade(d.c, 0.15), OUT);
      for (let i = 0; i < 3; i++) sprout(c, -38 + i * 38, y - 4, 1, leaf[(i + r) % 3], sw * (i % 2 ? -1 : 1));
    }
    // цветок расцвёл на верхней полке
    const fx = 0 + Math.sin(sw) * 20,
      fy = -8 - 104 - 34;
    for (let k = 0; k < 5; k++)
      ell(c, fx + Math.cos((k * TAU) / 5) * 6, fy + Math.sin((k * TAU) / 5) * 6, 4.5, 4.5, '#ff8fab');
    ell(c, fx, fy, 3.5, 3.5, '#fff3bf');
  },
  watering_can(c, d, w, h, st) {
    c.save();
    c.translate(0, -hop(st, 6));
    c.rotate(st.on ? -0.35 : 0);
    // носик
    c.beginPath();
    c.moveTo(-14, -18);
    c.lineTo(-w / 2 + 2, -h + 8);
    c.strokeStyle = OUT;
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = d.c;
    c.lineWidth = 6;
    c.stroke();
    ell(c, -w / 2 + 2, -h + 6, 8, 5, shade(d.c, 0.3), OUT, 1.5, -0.8);
    // ручка и корпус
    c.beginPath();
    c.arc(20, -26, 15, -0.5 * Math.PI, 0.5 * Math.PI);
    c.strokeStyle = OUT;
    c.lineWidth = 8;
    c.stroke();
    c.strokeStyle = d.c;
    c.lineWidth = 4;
    c.stroke();
    fillRR(c, -18, -42, 38, 42, 8, d.c, OUT);
    fillRR(c, -20, -46, 42, 8, 4, shade(d.c, 0.3), OUT, 1.5);
    for (let k = 0; k < 5; k++)
      ell(c, 1 + Math.cos((k * TAU) / 5) * 6, -20 + Math.sin((k * TAU) / 5) * 6, 4, 4, '#fff');
    ell(c, 1, -20, 3, 3, '#ffd43b');
    if (st.on)
      for (let i = 0; i < 4; i++) {
        const p = (st.t * 2 + i * 0.25) % 1;
        ell(c, -w / 2 - 4 - i * 3, -h + 12 + p * 30, 2.5, 3.5, '#74c0fc');
      }
    c.restore();
  },
  hanging_plant(c, d, w, h, st) {
    const sw = Math.sin(st.t * (st.on ? 12 : 1.2)) * (st.on ? 0.16 : 0.03);
    ell(c, 0, -h / 2 + 4, 4, 4, '#ffd43b', OUT, 1.2);
    c.save();
    c.translate(0, -h / 2 + 4);
    c.rotate(sw);
    line(c, 0, 0, -18, 34, '#a8703f', 1.8);
    line(c, 0, 0, 18, 34, '#a8703f', 1.8);
    // плющ свисает из горшка
    for (const [x, len, k] of [
      [-18, 44, -1],
      [-6, 30, 1],
      [10, 40, 1],
      [20, 26, -1],
    ]) {
      c.beginPath();
      c.moveTo(x, 40);
      c.quadraticCurveTo(x + k * 10, 40 + len / 2, x + k * 2, 40 + len);
      c.strokeStyle = '#2f9e44';
      c.lineWidth = 2.5;
      c.stroke();
      for (let i = 1; i <= 3; i++)
        ell(c, x + k * (7 - i), 40 + (len * i) / 3.2, 6, 4, i % 2 ? d.c : shade(d.c, 0.2), OUT, 1, k * 0.6);
    }
    poly(c, [-22, 32, 22, 32, 15, 54, -15, 54], '#e8590c', OUT);
    fillRR(c, -24, 28, 48, 8, 4, '#f76707', OUT, 1.5);
    ell(c, -8, 26, 10, 7, d.c, OUT, 1.2);
    ell(c, 8, 24, 11, 8, shade(d.c, 0.15), OUT, 1.2);
    c.restore();
  },
};

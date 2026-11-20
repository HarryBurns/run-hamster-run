// Мебель и украшения для виллы (вид сбоку). Всё рисуется кодом.
// Напольные предметы: начало координат — середина нижнего края (на полу).
// Настенные: начало координат — центр предмета.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade, rr, heart } from '../core/draw.js';
import { D_HOMES } from './furniture_homes.js';
import { D_FEST } from './furniture_fest.js';

const OUT = '#4a3728';
const WOOD = '#d9a066';

const D = {
  bed(c, d, w, h, st) {
    const royal = d.royal;
    fillRR(c, -w / 2 + 6, -14, 10, 14, 3, shade(WOOD, -0.2), OUT);
    fillRR(c, w / 2 - 16, -14, 10, 14, 3, shade(WOOD, -0.2), OUT);
    const hb = royal ? h : h - 6;
    fillRR(c, -w / 2, -hb, 26, hb - 8, 12, royal ? '#ffd43b' : WOOD, OUT);
    if (royal) {
      star(c, -w / 2 + 13, -hb + 18, 8, '#fff', OUT, 1.5);
      fillRR(c, w / 2 - 20, -62, 20, 54, 8, '#ffd43b', OUT);
    } else fillRR(c, w / 2 - 16, -50, 16, 42, 7, WOOD, OUT);
    fillRR(c, -w / 2 + 12, -44, w - 22, 34, 10, '#fff', OUT);
    fillRR(c, -w / 2 + 22, -58, 54, 24, 11, '#fff', OUT);
    fillRR(c, -w / 2 + 70, -48, w - 82, 40, 12, d.c, OUT);
    c.fillStyle = shade(d.c, 0.35);
    c.fillRect(-w / 2 + 72, -40, w - 86, 7);
    for (let i = 0; i < 4; i++) ell(c, -w / 2 + 100 + i * 28, -22, 4, 4, shade(d.c, 0.35));
  },
  wardrobe(c, d, w, h) {
    fillRR(c, -w / 2 + 8, -10, 12, 10, 2, shade(d.c, -0.3), OUT);
    fillRR(c, w / 2 - 20, -10, 12, 10, 2, shade(d.c, -0.3), OUT);
    fillRR(c, -w / 2, -h, w, h - 8, 10, d.c, OUT);
    fillRR(c, -w / 2 + 8, -h + 10, w / 2 - 11, h - 30, 6, shade(d.c, 0.18), OUT, 1.5);
    fillRR(c, 3, -h + 10, w / 2 - 11, h - 30, 6, shade(d.c, 0.18), OUT, 1.5);
    ell(c, -8, -h / 2, 4, 4, '#ffd43b', OUT, 1.5);
    ell(c, 8, -h / 2, 4, 4, '#ffd43b', OUT, 1.5);
    heart(c, -w / 4 - 1, -h + 40, 9, shade(d.c, -0.18));
    heart(c, w / 4 + 1, -h + 40, 9, shade(d.c, -0.18));
  },
  /** Душевая кабинка: поддон, стеклянные стенки, лейка; включена (st.on) — льётся вода. */
  shower(c, d, w, h, st) {
    fillRR(c, -w / 2, -14, w, 14, 5, '#f1f3f5', OUT);
    fillRR(c, -w / 2 + 4, -h, w - 8, h - 12, 10, 'rgba(208,235,255,.38)', OUT);
    fillRR(c, -w / 2 + 4, -h, w - 8, 16, 6, d.c, OUT);
    line(c, w / 2 - 16, -h + 16, w / 2 - 16, -h + 44, '#adb5bd', 5);
    line(c, w / 2 - 16, -h + 44, 4, -h + 44, '#adb5bd', 5);
    fillRR(c, -14, -h + 42, 32, 10, 5, '#ced4da', OUT, 1.5);
    poly(
      c,
      [-w / 2 + 14, -h + 30, -w / 2 + 30, -h + 30, -w / 2 + 16, -h + 96, -w / 2 + 8, -h + 96],
      'rgba(255,255,255,.4)',
    );
    ell(c, -w / 2 + 12, -h / 2, 3.5, 9, '#adb5bd', OUT, 1.2);
    if (st.on) {
      c.strokeStyle = 'rgba(116,192,252,.9)';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = -12 + i * 6,
          y = -h + 56 + ((st.t * 260 + i * 37) % (h - 80));
        c.moveTo(x, y);
        c.lineTo(x - 1, y + 12);
      }
      c.stroke();
    }
  },
  fridge(c, d, w, h) {
    fillRR(c, -w / 2, -h, w, h, 14, d.c, OUT);
    line(c, -w / 2, -h * 0.62, w / 2, -h * 0.62, OUT, 2);
    fillRR(c, w / 2 - 16, -h + 18, 6, 34, 3, '#adb5bd', OUT, 1.5);
    fillRR(c, w / 2 - 16, -h * 0.62 + 12, 6, 44, 3, '#adb5bd', OUT, 1.5);
    star(c, -w / 2 + 22, -h + 30, 8, '#ffd43b', OUT, 1.2);
    heart(c, -w / 2 + 44, -h + 48, 7, '#ff6b9d');
    fillRR(c, -w / 2 + 14, -h * 0.5, 20, 16, 3, '#fff', OUT, 1.2);
  },
  sofa(c, d, w, h) {
    fillRR(c, -w / 2 + 14, -8, 10, 8, 2, OUT);
    fillRR(c, w / 2 - 24, -8, 10, 8, 2, OUT);
    fillRR(c, -w / 2 + 12, -h, w - 24, h - 22, 18, shade(d.c, -0.12), OUT);
    fillRR(c, -w / 2, -h * 0.62, 30, h * 0.62 - 6, 13, d.c, OUT);
    fillRR(c, w / 2 - 30, -h * 0.62, 30, h * 0.62 - 6, 13, d.c, OUT);
    fillRR(c, -w / 2 + 24, -h * 0.45, w - 48, h * 0.45 - 6, 10, shade(d.c, 0.15), OUT);
    line(c, 0, -h * 0.45, 0, -8, shade(d.c, -0.2), 2);
    fillRR(c, -w / 2 + 34, -h * 0.78, 34, 30, 9, '#fff3bf', OUT, 1.5);
  },
  armchair(c, d, w, h) {
    fillRR(c, -w / 2 + 10, -8, 9, 8, 2, OUT);
    fillRR(c, w / 2 - 19, -8, 9, 8, 2, OUT);
    fillRR(c, -w / 2 + 10, -h, w - 20, h - 20, 18, shade(d.c, -0.12), OUT);
    fillRR(c, -w / 2, -h * 0.6, 24, h * 0.6 - 6, 11, d.c, OUT);
    fillRR(c, w / 2 - 24, -h * 0.6, 24, h * 0.6 - 6, 11, d.c, OUT);
    fillRR(c, -w / 2 + 20, -h * 0.42, w - 40, h * 0.42 - 6, 9, shade(d.c, 0.15), OUT);
  },
  beanbag(c, d, w, h) {
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.bezierCurveTo(-w / 2 - 6, -h * 0.9, -w * 0.2, -h * 1.05, 0, -h * 0.8);
    c.bezierCurveTo(w * 0.25, -h * 1.1, w / 2 + 8, -h * 0.7, w / 2, 0);
    c.closePath();
    c.fillStyle = d.c;
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    ell(c, -6, -h * 0.5, w * 0.22, h * 0.16, shade(d.c, 0.2));
  },
  chair(c, d, w, h) {
    fillRR(c, -w / 2 + 4, -44, 7, 44, 3, shade(d.c, -0.15), OUT, 1.5);
    fillRR(c, w / 2 - 11, -44, 7, 44, 3, shade(d.c, -0.15), OUT, 1.5);
    fillRR(c, -w / 2 + 2, -h, 8, h - 40, 4, d.c, OUT, 1.5);
    fillRR(c, w / 2 - 10, -h, 8, h - 40, 4, d.c, OUT, 1.5);
    fillRR(c, -w / 2 + 6, -h + 6, w - 12, 24, 6, shade(d.c, 0.15), OUT, 1.5);
    fillRR(c, -w / 2, -50, w, 10, 5, d.c, OUT);
  },
  table(c, d, w, h) {
    fillRR(c, -w / 2 + 12, -h + 6, 10, h - 6, 3, shade(d.c, -0.15), OUT);
    fillRR(c, w / 2 - 22, -h + 6, 10, h - 6, 3, shade(d.c, -0.15), OUT);
    fillRR(c, -w / 2, -h, w, 12, 6, d.c, OUT);
  },
  nightstand(c, d, w, h) {
    fillRR(c, -w / 2, -h, w, h, 8, d.c, OUT);
    fillRR(c, -w / 2 + 7, -h + 8, w - 14, 18, 4, shade(d.c, 0.2), OUT, 1.5);
    fillRR(c, -w / 2 + 7, -h + 32, w - 14, 18, 4, shade(d.c, 0.2), OUT, 1.5);
    ell(c, 0, -h + 17, 3, 3, '#ffd43b', OUT, 1);
    ell(c, 0, -h + 41, 3, 3, '#ffd43b', OUT, 1);
  },
  bookshelf(c, d, w, h) {
    fillRR(c, -w / 2, -h, w, h, 8, d.c, OUT);
    const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc', '#ff922b', '#f783ac'];
    for (let r = 0; r < 4; r++) {
      const y = -h + 10 + r * ((h - 16) / 4),
        sh = (h - 16) / 4 - 8;
      fillRR(c, -w / 2 + 8, y, w - 16, sh, 3, shade(d.c, -0.3), null);
      let x = -w / 2 + 11,
        i = r * 3;
      while (x < w / 2 - 22) {
        const bw = 9 + ((i * 7) % 8),
          bh = sh - 4 - ((i * 5) % 9);
        fillRR(c, x, y + sh - bh, bw, bh, 2, cols[i % cols.length], OUT, 1);
        x += bw + 1;
        i++;
      }
    }
  },
  tv(c, d, w, h, st) {
    fillRR(c, -w * 0.32, -30, w * 0.64, 30, 6, WOOD, OUT);
    fillRR(c, -8, -44, 16, 16, 2, '#868e96', OUT, 1.5);
    fillRR(c, -w / 2, -h, w, h - 40, 10, d.c, OUT);
    const sx = -w / 2 + 8,
      sy = -h + 8,
      sw = w - 16,
      sh = h - 56;
    if (st.on) {
      c.save();
      rr(c, sx, sy, sw, sh, 5);
      c.clip();
      c.fillStyle = '#8fd3ff';
      c.fillRect(sx, sy, sw, sh);
      c.fillStyle = '#69db7c';
      c.fillRect(sx, sy + sh * 0.68, sw, sh);
      ell(c, sx + 26, sy + 20, 11, 11, '#ffd43b');
      const bx = sx + ((st.t * 40) % (sw + 40)) - 20,
        by = sy + sh * 0.66 - Math.abs(Math.sin(st.t * 6)) * 12;
      ell(c, bx, by - 10, 12, 10, '#fff', OUT, 1.5);
      ell(c, bx + 4, by - 13, 1.8, 1.8, OUT);
      ell(c, bx - 6, by - 20, 4, 4, '#fff', OUT, 1.2);
      c.restore();
    } else {
      fillRR(c, sx, sy, sw, sh, 5, '#212529');
      c.fillStyle = 'rgba(255,255,255,.12)';
      poly(c, [sx + 10, sy, sx + 40, sy, sx + 14, sy + sh, sx, sy + sh], 'rgba(255,255,255,.1)');
    }
  },
  piano(c, d, w, h) {
    fillRR(c, -w / 2 + 6, -h * 0.5, 12, h * 0.5, 3, d.c, OUT);
    fillRR(c, w / 2 - 18, -h * 0.5, 12, h * 0.5, 3, d.c, OUT);
    fillRR(c, -w / 2, -h, w, h * 0.55, 8, d.c, OUT);
    fillRR(c, -w / 2 - 4, -h * 0.5, w + 8, 20, 4, shade(d.c, 0.15), OUT);
    fillRR(c, -w / 2 + 4, -h * 0.5 + 2, w - 8, 13, 2, '#fff', OUT, 1);
    for (let i = 1; i < 14; i++) {
      const x = -w / 2 + 4 + (i * (w - 8)) / 14;
      line(c, x, -h * 0.5 + 2, x, -h * 0.5 + 15, '#adb5bd', 1);
      if (i % 7 !== 3 && i % 7 !== 0) {
        c.fillStyle = '#212529';
        c.fillRect(x - 3, -h * 0.5 + 2, 6, 8);
      }
    }
    fillRR(c, -26, -h + 12, 52, 30, 3, '#fff', OUT, 1.2);
    for (let i = 0; i < 4; i++) line(c, -20, -h + 19 + i * 5, 20, -h + 19 + i * 5, '#adb5bd', 1);
  },
  wheel(c, d, w, h, st) {
    poly(
      c,
      [-w * 0.36, 0, -6, -h * 0.52, 6, -h * 0.52, w * 0.36, 0, w * 0.26, 0, 0, -h * 0.4, -w * 0.26, 0],
      '#adb5bd',
      OUT,
    );
    const r = w * 0.46,
      cy = -h * 0.52;
    ell(c, 0, cy, r, r, 'rgba(255,255,255,.35)', d.c, 9);
    ell(c, 0, cy, r + 4.5, r + 4.5, null, OUT, 2);
    ell(c, 0, cy, r - 4.5, r - 4.5, null, OUT, 1.5);
    const a0 = st.on ? st.t * 9 : 0.3;
    for (let i = 0; i < 6; i++) {
      const a = a0 + (i * TAU) / 6;
      line(c, 0, cy, Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), shade(d.c, -0.2), 2.5);
    }
    ell(c, 0, cy, 7, 7, '#ffd43b', OUT);
  },
  music(c, d, w, h, st) {
    fillRR(c, -w / 2, -h, w, h, 10, d.c, OUT);
    const k = st.on ? 1 + Math.sin(st.t * 14) * 0.08 : 1;
    ell(c, 0, -h * 0.68, 14 * k, 14 * k, '#343a40', OUT);
    ell(c, 0, -h * 0.68, 5, 5, '#868e96');
    ell(c, 0, -h * 0.28, 19 * k, 19 * k, '#343a40', OUT);
    ell(c, 0, -h * 0.28, 7, 7, '#868e96');
    if (st.on) {
      c.fillStyle = '#ff6b9d';
      c.font = '800 20px sans-serif';
      c.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const p = (st.t * 0.6 + i / 3) % 1;
        c.globalAlpha = 1 - p;
        c.fillText(i % 2 ? '♪' : '♫', (i - 1) * 26 + Math.sin(p * 6 + i) * 8, -h - 10 - p * 50);
      }
      c.globalAlpha = 1;
    }
  },
  teddy(c, d, w, h, st) {
    const j = st.on ? Math.abs(Math.sin(st.t * 9)) * 8 : 0;
    c.save();
    c.translate(0, -j);
    ell(c, -16, -6, 10, 7, d.c, OUT);
    ell(c, 16, -6, 10, 7, d.c, OUT);
    ell(c, 0, -24, 20, 20, d.c, OUT);
    ell(c, 0, -20, 11, 12, shade(d.c, 0.35));
    ell(c, -19, -30, 7, 9, d.c, OUT, 2, 0.5);
    ell(c, 19, -30, 7, 9, d.c, OUT, 2, -0.5);
    ell(c, -13, -62, 7, 7, d.c, OUT);
    ell(c, 13, -62, 7, 7, d.c, OUT);
    ell(c, 0, -50, 17, 15, d.c, OUT);
    ell(c, 0, -45, 7, 5.5, shade(d.c, 0.35));
    ell(c, -6, -53, 2, 2, OUT);
    ell(c, 6, -53, 2, 2, OUT);
    ell(c, 0, -47, 2.5, 2, OUT);
    c.restore();
  },
  aquarium(c, d, w, h, st) {
    fillRR(c, -w / 2 + 6, -44, w - 12, 44, 6, WOOD, OUT);
    const gy = -h,
      gh = h - 44;
    fillRR(c, -w / 2, gy, w, gh, 8, '#d0ebff', OUT);
    c.save();
    rr(c, -w / 2 + 3, gy + 10, w - 6, gh - 13, 5);
    c.clip();
    c.fillStyle = '#74c0fc';
    c.fillRect(-w / 2, gy, w, gh);
    c.fillStyle = '#ffe8a1';
    c.fillRect(-w / 2, -52, w, 10);
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 20 + i * 40;
      line(c, x, -50, x + Math.sin(st.t * 2 + i) * 5, -80, '#2f9e44', 4);
    }
    const fc = ['#ff922b', '#ff6b9d', '#ffd43b'];
    for (let i = 0; i < 3; i++) {
      const p = (st.t * (0.12 + i * 0.04) + i * 0.37) % 2;
      const dir = p < 1 ? 1 : -1,
        px = -w / 2 + 14 + (p < 1 ? p : 2 - p) * (w - 28),
        py = gy + 26 + i * 16 + Math.sin(st.t * 2 + i) * 4;
      ell(c, px, py, 9, 5.5, fc[i], OUT, 1);
      poly(c, [px - dir * 8, py, px - dir * 15, py - 5, px - dir * 15, py + 5], fc[i], OUT, 1);
      ell(c, px + dir * 4, py - 1, 1.3, 1.3, OUT);
    }
    for (let i = 0; i < 4; i++) {
      const p = (st.t * 0.3 + i * 0.25) % 1;
      ell(c, w / 2 - 20 + Math.sin(p * 9) * 3, -52 - p * (gh - 20), 2.5, 2.5, 'rgba(255,255,255,.8)');
    }
    c.restore();
  },
  fireplace(c, d, w, h, st) {
    fillRR(c, -w / 2, -h, w, h, 6, '#e8590c', OUT);
    c.strokeStyle = 'rgba(0,0,0,.18)';
    c.lineWidth = 1.5;
    for (let y = -h + 18; y < 0; y += 18) {
      line(c, -w / 2 + 3, y, w / 2 - 3, y, 'rgba(0,0,0,.18)', 1.5);
    }
    fillRR(c, -w / 2 - 6, -h - 4, w + 12, 14, 4, '#f1e0c5', OUT);
    c.beginPath();
    c.moveTo(-w * 0.3, 0);
    c.lineTo(-w * 0.3, -h * 0.45);
    c.quadraticCurveTo(0, -h * 0.75, w * 0.3, -h * 0.45);
    c.lineTo(w * 0.3, 0);
    c.closePath();
    c.fillStyle = '#343a40';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    if (st.on !== false) {
      for (let i = 0; i < 3; i++) {
        const k = 1 + Math.sin(st.t * 9 + i * 2) * 0.18,
          x = (i - 1) * 16;
        c.beginPath();
        c.moveTo(x - 12, -4);
        c.quadraticCurveTo(x - 10, -26 * k, x, -48 * k);
        c.quadraticCurveTo(x + 10, -26 * k, x + 12, -4);
        c.closePath();
        c.fillStyle = i === 1 ? '#ffd43b' : '#ff922b';
        c.fill();
      }
    }
    fillRR(c, -26, -8, 52, 8, 3, '#8d5524', OUT, 1.5);
  },
  lamp(c, d, w, h, st) {
    if (st.on) {
      const g = c.createRadialGradient(0, -h + 20, 5, 0, -h + 20, 110);
      g.addColorStop(0, 'rgba(255,236,153,.55)');
      g.addColorStop(1, 'rgba(255,236,153,0)');
      c.fillStyle = g;
      c.fillRect(-120, -h - 90, 240, 220);
    }
    ell(c, 0, -4, 18, 5, '#868e96', OUT);
    fillRR(c, -2.5, -h + 30, 5, h - 34, 2, '#868e96', OUT, 1.5);
    poly(c, [-14, -h, 14, -h, 25, -h + 38, -25, -h + 38], st.on ? shade(d.c, 0.35) : d.c, OUT);
  },
  plant(c, d, w, h, st) {
    const sw = Math.sin(st.t * (st.on ? 14 : 1.4)) * (st.on ? 0.12 : 0.02);
    const v = d.v || 0;
    if (v === 4) {
      // гигантский подсолнух
      poly(c, [-24, 0, 24, 0, 19, -34, -19, -34], '#e8590c', OUT);
      c.save();
      c.translate(0, -34);
      c.rotate(sw);
      line(c, 0, 0, 0, -h + 80, '#2f9e44', 7);
      ell(c, -20, -50, 20, 9, '#37b24d', OUT, 2, 0.5);
      ell(c, 20, -80, 20, 9, '#37b24d', OUT, 2, -0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        ell(c, Math.cos(a) * 34, -h + 80 + Math.sin(a) * 34, 15, 8, '#ffd43b', OUT, 1.5, a);
      }
      ell(c, 0, -h + 80, 24, 24, '#8d5524', OUT);
      ell(c, -7, -h + 76, 2.5, 3, '#1d1b1b');
      ell(c, 7, -h + 76, 2.5, 3, '#1d1b1b');
      c.beginPath();
      c.arc(0, -h + 82, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      c.strokeStyle = '#1d1b1b';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
      return;
    }
    const pw = v === 1 ? 20 : 15,
      ph = v === 1 ? 36 : 28;
    poly(c, [-pw - 4, 0, pw + 4, 0, pw, 0, pw + 5, -ph, -pw - 5, -ph, -pw, 0], v === 3 ? '#74c0fc' : '#e8590c', OUT);
    c.save();
    c.translate(0, -ph);
    c.rotate(sw);
    if (v === 0) {
      line(c, 0, 0, 0, -h + ph + 30, '#8d5524', 5);
      for (const [x, y, r] of [
        [0, -h + ph + 28, 26],
        [-20, -h + ph + 52, 20],
        [20, -h + ph + 52, 20],
        [0, -h + ph + 64, 20],
      ])
        ell(c, x, y, r, r * 0.9, d.c, OUT);
    } else if (v === 1) {
      line(c, 0, 0, 4, -h + ph + 40, '#a8703f', 7);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * (0.05 + i * 0.18);
        c.save();
        c.translate(4, -h + ph + 40);
        c.rotate(a);
        ell(c, 34, 0, 36, 9, i % 2 ? d.c : shade(d.c, -0.12), OUT, 1.6);
        c.restore();
      }
    } else if (v === 2) {
      fillRR(c, -11, -h + ph + 4, 22, h - ph - 4, 11, d.c, OUT);
      fillRR(c, -24, -30, 12, 8, 4, d.c, OUT);
      fillRR(c, -24, -40, 9, 16, 4, d.c, OUT);
      ell(c, 3, -h + ph + 4, 5, 5, '#ff8fab', OUT, 1.2);
    } else {
      for (let i = -1; i <= 1; i++) {
        line(c, i * 4, 0, i * 13, -h + ph + 16, '#2f9e44', 3);
        const fx = i * 13,
          fy = -h + ph + 14;
        for (let k = 0; k < 5; k++)
          ell(
            c,
            fx + Math.cos((k * TAU) / 5) * 6,
            fy + Math.sin((k * TAU) / 5) * 6,
            4.5,
            4.5,
            [d.c, '#ffd43b', '#b197fc'][i + 1],
          );
        ell(c, fx, fy, 3.5, 3.5, '#fff3bf');
      }
    }
    c.restore();
  },
  rug(c, d, w, h) {
    if (d.c === 'rainbow') {
      const cols = ['#ff6b6b', '#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc'];
      c.save();
      rr(c, -w / 2, -6, w, 14, 7);
      c.clip();
      cols.forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(-w / 2 + (i * w) / 6, -6, w / 6 + 1, 14);
      });
      c.restore();
      rr(c, -w / 2, -6, w, 14, 7);
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.stroke();
    } else {
      fillRR(c, -w / 2, -6, w, 14, 7, d.c, OUT);
      c.fillStyle = shade(d.c, 0.4);
      c.fillRect(-w / 2 + 12, -1, w - 24, 4);
    }
  },
  balloons(c, d, w, h, st) {
    fillRR(c, -8, -10, 16, 10, 3, '#868e96', OUT, 1.5);
    const cols = ['#ff6b6b', '#ffd43b', '#4dabf7'];
    for (let i = 0; i < 3; i++) {
      const sw = Math.sin(st.t * (st.on ? 8 : 1.5) + i * 2) * (st.on ? 9 : 4);
      const bx = (i - 1) * 20 + sw,
        by = -h + 26 + (i % 2) * 18;
      line(c, 0, -10, bx, by + 24, '#868e96', 1.2);
      ell(c, bx, by, 17, 22, cols[i], OUT);
      ell(c, bx - 6, by - 8, 4, 6, 'rgba(255,255,255,.5)');
    }
  },
  picture(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h, 5, '#f1e0c5', OUT);
    c.save();
    rr(c, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 2);
    c.clip();
    const v = d.v || 0;
    if (v === 0) {
      c.fillStyle = '#a5d8ff';
      c.fillRect(-w, -h, w * 2, h * 2);
      ell(c, 0, 0, 14, 14, '#ffd43b');
      for (let i = 0; i < 8; i++)
        line(
          c,
          Math.cos(i * 0.785) * 18,
          Math.sin(i * 0.785) * 18,
          Math.cos(i * 0.785) * 25,
          Math.sin(i * 0.785) * 25,
          '#ffd43b',
          3,
        );
    } else if (v === 1) {
      c.fillStyle = '#a5d8ff';
      c.fillRect(-w, -h, w * 2, h * 2);
      c.fillStyle = '#339af0';
      c.fillRect(-w, 2, w * 2, h);
      c.fillStyle = '#ffe8a1';
      c.fillRect(-w, 16, w * 2, h);
      poly(c, [-10, 2, 6, 2, 6, -18], '#fff', OUT, 1);
      ell(c, 24, -14, 7, 7, '#ffd43b');
    } else if (v === 2) {
      c.fillStyle = '#ffdeeb';
      c.fillRect(-w, -h, w * 2, h * 2);
      ell(c, -12, -17, 6, 6, '#fff', OUT, 1.5);
      ell(c, 12, -17, 6, 6, '#333', OUT, 1.5);
      ell(c, 0, 2, 19, 17, '#fff', OUT, 1.5);
      ell(c, 9, -3, 8, 8, '#333');
      ell(c, -6, 0, 2.5, 3, '#1d1b1b');
      ell(c, 7, 0, 2.5, 3, '#fff');
      ell(c, 0, 6, 2.5, 2, '#ff8fa3');
    } else {
      c.fillStyle = '#d3f9d8';
      c.fillRect(-w, -h, w * 2, h * 2);
      for (const [x, y, col] of [
        [-12, -4, '#ff6b9d'],
        [8, -10, '#ffd43b'],
        [2, 10, '#b197fc'],
      ]) {
        for (let k = 0; k < 5; k++)
          ell(c, x + Math.cos((k * TAU) / 5) * 6, y + Math.sin((k * TAU) / 5) * 6, 4.5, 4.5, col);
        ell(c, x, y, 3, 3, '#fff');
      }
    }
    c.restore();
  },
  clock(c, d, w, h, st) {
    ell(c, 0, 0, w / 2, h / 2, '#fff', OUT, 2);
    ell(c, 0, 0, w / 2 - 5, h / 2 - 5, null, '#ff6b9d', 3);
    const m = st.minutes || 600;
    const ah = (((m / 60) % 12) / 12) * TAU - Math.PI / 2,
      am = ((m % 60) / 60) * TAU - Math.PI / 2;
    line(c, 0, 0, Math.cos(ah) * 11, Math.sin(ah) * 11, OUT, 3);
    line(c, 0, 0, Math.cos(am) * 17, Math.sin(am) * 17, OUT, 2);
    ell(c, 0, 0, 2.5, 2.5, '#ff6b9d');
  },
  mirror(c, d, w, h, st) {
    ell(c, 0, 0, w / 2, h / 2, '#ffd43b', OUT);
    ell(c, 0, 0, w / 2 - 7, h / 2 - 7, '#d0ebff', OUT, 1.5);
    line(c, -8, -h / 4, 6, -h / 4 - 14, 'rgba(255,255,255,.9)', 4);
    line(c, 2, -h / 4 + 6, 10, -h / 4 - 2, 'rgba(255,255,255,.9)', 3);
  },
  // из леса (П.9): золотая шишка на подставке и еловый венок с бантом
  goldcone(c, d, w, h, st) {
    fillRR(c, -22, -12, 44, 12, 4, '#8d5524', OUT);
    c.save();
    c.translate(0, -12 - (st.on ? Math.abs(Math.sin(st.t * 10)) * 4 : 0));
    ell(c, 0, -34, 17, 30, '#f2b705', OUT);
    for (let r = 0; r < 6; r++)
      for (let i = -1; i <= 1; i++) {
        const y = -58 + r * 9,
          x = i * 8 + (r % 2) * 4 - 2;
        if (Math.abs(x) > 15 - Math.abs(r - 2.5) * 2) continue;
        ell(c, x, y, 5, 4, r % 2 ? '#ffd43b' : '#fcc419', 'rgba(74,55,40,.55)', 1);
      }
    ell(c, -7, -48, 4, 9, 'rgba(255,255,255,.55)', null, 1, -0.3);
    line(c, 0, -64, 0, -72, OUT, 3);
    c.restore();
    star(c, 16, -70, 4, '#fff');
  },
  // с горы (П.9): три эдельвейса под стеклом в деревянной рамке
  edelframe(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h, 6, '#a8703f', OUT);
    fillRR(c, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 3, '#d3f9d8', OUT, 1.5);
    for (const [x, y, s] of [
      [-12, -14, 1],
      [12, -4, 0.9],
      [-4, 18, 1.1],
    ]) {
      line(c, x, y, x + 2, y + 16 * s, '#5c940d', 2);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ell(c, x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, 4.5 * s, 2.2 * s, '#f8f9fa', '#adb5bd', 1, a);
      }
      ell(c, x, y, 3 * s, 3 * s, '#ffe066', '#e0a800', 1);
    }
    line(c, -w / 2 + 12, -h / 2 + 12, -w / 2 + 22, -h / 2 + 30, 'rgba(255,255,255,.7)', 3);
  },
  // из пещер (П.9): шкатулка с четырьмя самоцветами и ночник из светящихся грибов
  geode(c, d, w, h) {
    // откинутая крышка
    poly(c, [-38, -40, 38, -40, 32, -66, -32, -66], '#8d5524', OUT, 2);
    poly(c, [-30, -44, 30, -44, 26, -60, -26, -60], '#c2255c');
    // ящичек
    fillRR(c, -42, -40, 84, 40, 6, '#a0662d', OUT, 2);
    fillRR(c, -36, -44, 72, 14, 4, '#c2255c', OUT, 1.5);
    const gem = (x, y, col, r) => {
      poly(c, [x, y - r, x + r * 0.9, y - r * 0.2, x, y + r * 0.8, x - r * 0.9, y - r * 0.2], col, OUT, 1.4);
      poly(c, [x, y - r, x + r * 0.9, y - r * 0.2, x, y - r * 0.1], 'rgba(255,255,255,.55)');
    };
    gem(-24, -46, '#e7f5ff', 9);
    gem(-8, -48, '#ffa94d', 9);
    gem(8, -48, '#4dabf7', 9);
    gem(24, -46, '#fa5252', 9);
    ell(c, 0, -22, 6, 6, '#ffd43b', OUT, 1.4);
    star(c, 30, -70, 4, '#fff');
  },
  // из джунглей (П.9): три пера попугаев под стеклом в бамбуковой рамке
  featherframe(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h, 6, '#c9a24a', OUT);
    for (let i = 0; i < 4; i++) {
      line(c, -w / 2 + 3, -h / 2 + 12 + i * 24, -w / 2 + 7, -h / 2 + 12 + i * 24, 'rgba(74,55,40,.5)', 1.4);
      line(c, w / 2 - 7, -h / 2 + 12 + i * 24, w / 2 - 3, -h / 2 + 12 + i * 24, 'rgba(74,55,40,.5)', 1.4);
    }
    fillRR(c, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 3, '#fff4d6', OUT, 1.5);
    for (const [x, a, col, col2] of [
      [-16, -0.25, '#e03131', '#ffd43b'],
      [0, 0, '#1c7ed6', '#74c0fc'],
      [16, 0.25, '#fcc419', '#69db7c'],
    ]) {
      c.save();
      c.translate(x, 10);
      c.rotate(a);
      line(c, 0, 22, 0, -30, OUT, 1.6);
      c.beginPath();
      c.moveTo(0, -32);
      c.quadraticCurveTo(10, -14, 3, 14);
      c.lineTo(0, 16);
      c.lineTo(-3, 14);
      c.quadraticCurveTo(-10, -14, 0, -32);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 1.3;
      c.stroke();
      ell(c, 0, -20, 3, 6, col2);
      line(c, 0, -28, 0, 12, 'rgba(255,255,255,.55)', 1);
      c.restore();
    }
    line(c, -w / 2 + 12, -h / 2 + 12, -w / 2 + 22, -h / 2 + 30, 'rgba(255,255,255,.7)', 3);
  },
  // с секретного пляжа (П.9): три ракушки на сине-бирюзовом фоне в рамке из ракушек и сундучок с кладом
  shellframe(c, d, w, h) {
    fillRR(c, -w / 2, -h / 2, w, h, 8, '#f8e7c8', OUT);
    fillRR(c, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 4, '#66d9e8', OUT, 1.5);
    fillRR(c, -w / 2 + 8, h / 2 - 26, w - 16, 18, 4, '#ffe8a8');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ell(c, Math.cos(a) * (w / 2 - 3), Math.sin(a) * (h / 2 - 3), 3.4, 3.4, i % 2 ? '#ffc9de' : '#fff', OUT, 0.8);
    }
    // розовый гребешок
    c.save();
    c.translate(-18, -6);
    c.beginPath();
    c.moveTo(0, 10);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      c.lineTo(Math.cos(a) * 13, 4 + Math.sin(a) * 13);
    }
    c.closePath();
    c.fillStyle = '#ff8fab';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 1.4;
    c.stroke();
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      line(c, 0, 9, Math.cos(a) * 11, 4 + Math.sin(a) * 11, '#e64980', 1);
    }
    c.restore();
    // витая ракушка
    c.beginPath();
    for (let a = 0; a < 13; a += 0.35) {
      const r = 1 + a * 0.95;
      c.lineTo(18 + Math.cos(a) * r, -10 + Math.sin(a) * r * 0.8);
    }
    c.strokeStyle = '#b07a2a';
    c.lineWidth = 3.4;
    c.stroke();
    c.strokeStyle = '#f4c27a';
    c.lineWidth = 1.8;
    c.stroke();
    // ракушка-солнышко
    ell(c, 0, 20, 11, 8, '#ffd43b', OUT, 1.4);
    for (let i = -2; i <= 2; i++) line(c, 0, 26, i * 5, 13, '#e8a400', 1.1);
    line(c, -w / 2 + 12, -h / 2 + 12, -w / 2 + 22, -h / 2 + 28, 'rgba(255,255,255,.7)', 3);
  },
  minitotem(c, d, w, h) {
    // маленький тотем из вулканического стекла (удалённый остров): три лица друг на друге, сверху — крылышки
    fillRR(c, -24, -10, 48, 10, 4, '#495057', OUT, 2);
    const faces = [
      ['#343a40', '#ff922b'],
      ['#3b3f46', '#69db7c'],
      ['#2f3338', '#ff6b9d'],
    ];
    faces.forEach(([col, eye], i) => {
      const y = -10 - (i + 1) * 30;
      fillRR(c, -18, y, 36, 30, 6, col, OUT, 2);
      ell(c, -7, y + 11, 4.5, 4, '#fff', OUT, 1.2);
      ell(c, 7, y + 11, 4.5, 4, '#fff', OUT, 1.2);
      ell(c, -7, y + 11, 2, 2, eye);
      ell(c, 7, y + 11, 2, 2, eye);
      if (i === 1) fillRR(c, -8, y + 19, 16, 6, 3, '#fff', OUT, 1.2);
      else {
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, y + 19, 6, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();
      }
      line(c, -14, y + 4, -10, y + 4, 'rgba(255,255,255,.35)', 2);
    });
    for (const sd of [-1, 1]) poly(c, [sd * 18, -96, sd * 30, -104, sd * 26, -88, sd * 18, -84], '#ff922b', OUT, 1.6);
    poly(c, [-10, -100, 0, -110, 10, -100], '#ffd43b', OUT, 1.6);
  },
  treasurechest(c, d, w, h) {
    // откинутая крышка, внутри монеты и жемчуг
    poly(c, [-36, -40, 36, -40, 30, -64, -30, -64], '#a0662d', OUT, 2);
    line(c, -33, -52, 33, -52, '#ffd43b', 3);
    fillRR(c, -40, -42, 80, 42, 6, '#8d5524', OUT, 2);
    for (const x of [-26, 26]) fillRR(c, x - 4, -42, 8, 42, 2, '#ffd43b', OUT, 1.2);
    for (let i = 0; i < 9; i++)
      ell(c, -26 + i * 6.5, -44 - (i % 3) * 3, 5, 5, i % 4 === 3 ? '#fff5f5' : '#ffd43b', OUT, 1);
    for (let i = 0; i < 4; i++) ell(c, -12 + i * 8, -50, 3, 3, '#fff5f5', OUT, 0.8);
    fillRR(c, -7, -30, 14, 12, 3, '#ffd43b', OUT, 1.4);
    ell(c, 0, -24, 2, 2.4, OUT);
    star(c, 30, -68, 4, '#fff');
    star(c, -28, -60, 3, '#fff');
  },
  fossils(c, d, w, h) {
    // витрина-ящичек под стеклом: на песке — аммонит, отпечаток листа, зуб и косточка
    fillRR(c, -48, -16, 96, 16, 5, '#a0662d', OUT, 2);
    fillRR(c, -46, -70, 92, 56, 8, '#f3d9a4', OUT, 2);
    for (let i = 0; i < 7; i++) ell(c, -38 + i * 13, -22 - (i % 2) * 3, 6, 2, 'rgba(160,110,50,.25)');
    // аммонит
    c.beginPath();
    for (let a = 0; a < 15; a += 0.3) {
      const r = 1 + a * 0.85;
      c.lineTo(-28 + Math.cos(a) * r, -46 + Math.sin(a) * r);
    }
    c.strokeStyle = '#8d5524';
    c.lineWidth = 2.4;
    c.stroke();
    // отпечаток листа
    ell(c, -4, -50, 7, 13, '#d9b77a', '#8d5524', 1.4, 0.4);
    line(c, -9, -38, 1, -61, '#8d5524', 1.2);
    // зуб
    poly(c, [12, -36, 15, -60, 22, -36], '#fff9db', OUT, 1.6);
    // косточка
    line(c, 28, -40, 40, -56, OUT, 6);
    line(c, 28, -40, 40, -56, '#fff4e0', 3.6);
    for (const [x, y] of [
      [27, -38],
      [30, -42],
      [38, -58],
      [42, -54],
    ])
      ell(c, x, y, 3.4, 3.4, '#fff4e0', OUT, 1.2);
    // стекло с бликом
    fillRR(c, -46, -70, 92, 56, 8, 'rgba(220,240,255,.18)', OUT, 2);
    line(c, -38, -64, -26, -54, 'rgba(255,255,255,.75)', 3);
    fillRR(c, -14, -10, 28, 7, 2, '#ffd43b', OUT, 1.2);
  },
  shroomlamp(c, d, w, h, st) {
    if (st.on) {
      const g = c.createRadialGradient(0, -40, 4, 0, -40, 90);
      g.addColorStop(0, 'rgba(99,230,190,.5)');
      g.addColorStop(1, 'rgba(99,230,190,0)');
      c.fillStyle = g;
      c.fillRect(-100, -140, 200, 200);
    }
    fillRR(c, -26, -14, 52, 14, 5, '#8d5524', OUT, 1.8);
    // стеклянная банка
    fillRR(c, -24, -84, 48, 72, 14, st.on ? 'rgba(195,250,232,.55)' : 'rgba(220,240,250,.45)', OUT, 2);
    for (const [x, y, r, col] of [
      [-9, -30, 10, '#63e6be'],
      [9, -38, 12, '#96f2d7'],
      [-2, -52, 8, '#38d9a9'],
    ]) {
      line(c, x, y, x, -14, '#f1f3f5', 4);
      c.beginPath();
      c.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0);
      c.closePath();
      c.fillStyle = st.on ? col : shade(col, -0.25);
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 1.3;
      c.stroke();
      ell(c, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.18, 'rgba(255,255,255,.8)');
    }
    fillRR(c, -20, -92, 40, 10, 3, '#adb5bd', OUT, 1.6);
    line(c, -16, -76, -16, -30, 'rgba(255,255,255,.7)', 3);
  },
  firwreath(c, d, w, h, st) {
    const r = w / 2 - 12;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ell(c, Math.cos(a) * r, Math.sin(a) * r, 13, 9, i % 2 ? '#2f9e44' : '#37b24d', OUT, 1.4, a + 1.2);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.17;
      ell(c, Math.cos(a) * r, Math.sin(a) * r, 8, 5, '#51cf66', null, 1, a + 1.2);
    }
    for (const a of [0.4, 2.1, 3.6, 5.2]) ell(c, Math.cos(a) * r, Math.sin(a) * r, 4.5, 4.5, '#fa5252', OUT, 1.2);
    for (const a of [1.2, 2.9, 4.4]) ell(c, Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), 4, 5, '#a0662d', OUT, 1.1);
    // бантик снизу
    poly(c, [0, r, -16, r - 8, -16, r + 10], '#e03131', OUT, 1.6);
    poly(c, [0, r, 16, r - 8, 16, r + 10], '#e03131', OUT, 1.6);
    ell(c, 0, r, 5, 5, '#c92a2a', OUT, 1.4);
  },
  // гирлянда из цветов острова: зелёная лиана дугой и на ней по очереди плюмерия, гибискус и орхидея
  flowergarland(c, d, w, h) {
    const at = (t) => [-w / 2 + t * w, -h / 2 + 4 + 4 * t * (1 - t) * (h - 22)];
    c.beginPath();
    c.moveTo(...at(0));
    for (let i = 1; i <= 20; i++) c.lineTo(...at(i / 20));
    c.strokeStyle = OUT;
    c.lineWidth = 4.5;
    c.stroke();
    c.strokeStyle = '#51cf66';
    c.lineWidth = 2.4;
    c.stroke();
    const kinds = [
      ['#fff8e1', '#ffd43b'],
      ['#f03e3e', '#ffd43b'],
      ['#da77f2', '#fff3bf'],
    ];
    for (let i = 0; i < 9; i++) {
      const [x, y] = at((i + 0.5) / 9),
        [col, mid] = kinds[i % 3];
      ell(c, x - 9, y + 2, 6, 3, '#40c057', OUT, 1, -0.5);
      ell(c, x + 9, y + 2, 6, 3, '#40c057', OUT, 1, 0.5);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + i;
        ell(c, x + Math.cos(a) * 5, y + 4 + Math.sin(a) * 5, 5, 3.6, col, OUT, 1.1, a);
      }
      ell(c, x, y + 4, 2.6, 2.6, mid, OUT, 0.8);
    }
  },
  garland(c, d, w, h, st) {
    c.beginPath();
    c.moveTo(-w / 2, -h / 2);
    c.quadraticCurveTo(0, h, w / 2, -h / 2);
    c.strokeStyle = OUT;
    c.lineWidth = 1.5;
    c.stroke();
    const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#f783ac'];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10,
        x = -w / 2 + t * w,
        y = -h / 2 + 4 * t * (1 - t) * (h * 0.75 + h / 2) * 0.5 * 2;
      const lit = Math.floor(st.t * 2 + i) % 2 === 0;
      if (lit) ell(c, x, y + 5, 10, 10, 'rgba(255,240,170,.35)');
      ell(c, x, y + 5, 5, 6.5, lit ? cols[i % 5] : shade(cols[i % 5], -0.3), OUT, 1.2);
    }
  },
  shelf(c, d, w, h) {
    fillRR(c, -w / 2, h / 2 - 9, w, 9, 3, WOOD, OUT);
    ell(c, -w / 2 + 22, h / 2 - 23, 14, 14, '#ff6b6b', OUT);
    line(c, -w / 2 + 8, h / 2 - 23, -w / 2 + 36, h / 2 - 23, '#fff', 3);
    fillRR(c, -10, h / 2 - 33, 24, 24, 4, '#4dabf7', OUT);
    star(c, 2, h / 2 - 21, 7, '#ffd43b');
    ell(c, w / 2 - 24, h / 2 - 20, 13, 10, '#ffd43b', OUT);
    ell(c, w / 2 - 15, h / 2 - 31, 8, 8, '#ffd43b', OUT);
    poly(c, [w / 2 - 8, h / 2 - 32, w / 2 - 1, h / 2 - 30, w / 2 - 8, h / 2 - 28], '#ff922b', OUT, 1);
    ell(c, w / 2 - 14, h / 2 - 33, 1.5, 1.5, OUT);
  },
  discoball(c, d, w, h, st) {
    line(c, 0, -h / 2, 0, -8, OUT, 2);
    const r = w / 2 - 4,
      cy = h / 2 - r - 4;
    if (st.on) {
      const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#f783ac', '#b197fc'];
      for (let i = 0; i < 6; i++) {
        const a = st.t * 1.5 + (i * TAU) / 6;
        c.globalAlpha = 0.28;
        poly(
          c,
          [0, cy, Math.cos(a) * 240, cy + Math.sin(a) * 240, Math.cos(a + 0.22) * 240, cy + Math.sin(a + 0.22) * 240],
          cols[i],
        );
      }
      c.globalAlpha = 1;
    }
    ell(c, 0, cy, r, r, '#ced4da', OUT);
    c.save();
    c.beginPath();
    c.arc(0, cy, r - 1, 0, TAU);
    c.clip();
    for (let y = -r; y < r; y += 9)
      for (let x = -r; x < r; x += 9) {
        if ((Math.floor(x / 9) + Math.floor(y / 9) + Math.floor(st.on ? st.t * 6 : 0)) % 2 === 0) {
          c.fillStyle = 'rgba(255,255,255,.75)';
          c.fillRect(x + 1, cy + y + 1, 7, 7);
        }
      }
    c.restore();
  },
  statue(c, d, w, h, st) {
    const j = st.on ? Math.abs(Math.sin(st.t * 10)) * 5 : 0;
    fillRR(c, -w / 2 + 8, -26, w - 16, 26, 4, '#adb5bd', OUT);
    c.save();
    c.translate(0, -26 - j);
    ell(c, 0, -30, 24, 26, '#ffd43b', OUT);
    ell(c, -18, -72, 8, 8, '#ffd43b', OUT);
    ell(c, 18, -72, 8, 8, '#ffd43b', OUT);
    ell(c, 0, -60, 25, 21, '#ffd43b', OUT);
    ell(c, -8, -62, 3, 3.5, '#e0a800');
    ell(c, 8, -62, 3, 3.5, '#e0a800');
    ell(c, 0, -55, 3, 2, '#e0a800');
    line(c, -14, -72, -6, -80, 'rgba(255,255,255,.8)', 3);
    c.restore();
  },
  throne(c, d, w, h) {
    fillRR(c, -w / 2 + 14, -h, w - 28, h - 30, 14, '#ffd43b', OUT);
    fillRR(c, -w / 2 + 24, -h + 12, w - 48, h - 70, 10, d.c, OUT);
    star(c, 0, -h + 4, 12, '#ffd43b', OUT);
    fillRR(c, -w / 2, -78, 22, 72, 8, '#ffd43b', OUT);
    fillRR(c, w / 2 - 22, -78, 22, 72, 8, '#ffd43b', OUT);
    fillRR(c, -w / 2 + 16, -52, w - 32, 22, 8, shade(d.c, 0.15), OUT);
    fillRR(c, -w / 2 + 6, -30, w - 12, 30, 6, '#ffd43b', OUT);
  },
  neon(c, d, w, h, st) {
    fillRR(c, -w / 2, -h / 2, w, h, 12, '#2b2d42', OUT);
    const lit = Math.sin(st.t * 3) > -0.8;
    c.shadowColor = '#ff6b9d';
    c.shadowBlur = lit ? 14 : 0;
    c.font = '900 26px ui-rounded, "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = lit ? '#ffc9de' : '#7a4a5d';
    c.fillText('ХОМЯК', -10, 1);
    heart(c, w / 2 - 24, 0, 9, lit ? '#ff6b9d' : '#7a4a5d');
    c.shadowBlur = 0;
  },
  cup(c, d, w, h, st) {
    const j = st.on ? Math.abs(Math.sin(st.t * 10)) * 5 : 0;
    fillRR(c, -18, -12, 36, 12, 3, '#8d5524', OUT);
    c.save();
    c.translate(0, -j);
    fillRR(c, -5, -30, 10, 20, 2, '#ffd43b', OUT);
    c.beginPath();
    c.moveTo(-22, -h + 4);
    c.lineTo(22, -h + 4);
    c.quadraticCurveTo(20, -32, 0, -28);
    c.quadraticCurveTo(-20, -32, -22, -h + 4);
    c.closePath();
    c.fillStyle = '#ffd43b';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.arc(-24, -h + 20, 9, 0.5 * Math.PI, 1.5 * Math.PI);
    c.stroke();
    c.beginPath();
    c.arc(24, -h + 20, 9, -0.5 * Math.PI, 0.5 * Math.PI);
    c.stroke();
    star(c, 0, -h + 22, 8, '#fff');
    c.restore();
  },
  rocket(c, d, w, h, st) {
    const j = st.on ? ((st.t * 1.2) % 1) * 60 : 0;
    c.save();
    c.translate(0, -j);
    if (st.on) poly(c, [-10, -20, 10, -20, 0, 14 + Math.sin(st.t * 30) * 6], '#ff922b');
    poly(c, [-w / 2 + 4, -18, -14, -62, -14, -22], '#ff6b6b', OUT);
    poly(c, [w / 2 - 4, -18, 14, -62, 14, -22], '#ff6b6b', OUT);
    c.beginPath();
    c.moveTo(-18, -20);
    c.lineTo(-18, -h + 46);
    c.quadraticCurveTo(-16, -h + 6, 0, -h);
    c.quadraticCurveTo(16, -h + 6, 18, -h + 46);
    c.lineTo(18, -20);
    c.closePath();
    c.fillStyle = '#f1f3f5';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    ell(c, 0, -h + 58, 10, 10, '#74c0fc', OUT);
    c.fillStyle = '#ff6b6b';
    c.fillRect(-17, -36, 34, 7);
    c.restore();
  },
};

Object.assign(D, D_HOMES); // вещи из домов жителей — в отдельном файле
Object.assign(D, D_FEST); // праздничная полка (этап 15) — в отдельном файле

/** Нарисовать предмет. st: { t: время, on: включён, minutes: игровое время } */
export function drawFurn(ctx, def, x, y, st = {}) {
  const f = D[def.kind];
  if (!f) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  f(ctx, def, def.w, def.h, { t: 0, ...st });
  ctx.restore();
}

/** Прямоугольник предмета для попадания пальцем: {x, y, w, h} (y — верх). */
export function furnRect(def, x, floorY, yOff = 0) {
  if (def.wall) return { x: x - def.w / 2, y: floorY - yOff - def.h / 2, w: def.w, h: def.h };
  const h = Math.max(def.h, 34);
  return { x: x - def.w / 2, y: floorY - h, w: def.w, h };
}

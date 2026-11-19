// РИСУНКИ ФОТО-РЕЖИМА (features/photo.js) — без логики: рамка с подписью (карточка, сердечки, звёзды, цветы, плёнка)
// и наклейки-украшения поверх кадра. Один рисунок и для предпросмотра, и для самого снимка. Какие рамки и наклейки
// бывают — PHOTO_FRAMES, PHOTO_DECOR (data/photo.js); окно, снимок и альбом — photo.js.
import { clamp } from '../core/util.js';
import { heart, star } from '../core/draw.js';

/**
 * Нарисовать рамку frame с подписью caption на канве w × h (в её единицах). k — масштаб (1 — экран в CSS-пикселях).
 * Возвращает отступы рамки { l, t, r, b } — там, где ничего от игры не видно.
 */
export function drawFrame(ctx, w, h, frame, caption, k = 1) {
  const cap = (caption || '').trim();
  const s = Math.min(w, h);
  const font = (px) => `900 ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const capText = (y, color, size, shadow) => {
    if (!cap) return;
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = shadow;
      ctx.lineJoin = 'round';
      ctx.strokeText(cap, w / 2, y, w * 0.9);
    }
    ctx.fillStyle = color;
    ctx.fillText(cap, w / 2, y, w * 0.9);
  };
  const border = (b, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, b.t);
    ctx.fillRect(0, h - b.b, w, b.b);
    ctx.fillRect(0, 0, b.l, h);
    ctx.fillRect(w - b.r, 0, b.r, h);
  };
  const ribbon = () => {
    if (!cap) return;
    const sz = clamp(s * 0.07, 14 * k, 32 * k);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillRect(0, h - sz * 2.1, w, sz * 2.1);
    capText(h - sz * 1.05, '#4a3728', sz);
  };
  if (frame === 'polaroid') {
    const e = Math.max(8 * k, s * 0.035),
      b = { l: e, t: e, r: e, b: Math.max(e * 2.6, s * 0.12) };
    border(b, '#fffdf7');
    ctx.strokeStyle = 'rgba(74,55,40,.25)';
    ctx.lineWidth = Math.max(1, k);
    ctx.strokeRect(b.l, b.t, w - b.l - b.r, h - b.t - b.b);
    capText(h - b.b / 2, '#4a3728', clamp(b.b * 0.38, 12 * k, 30 * k));
    return b;
  }
  if (frame === 'film') {
    const e = Math.max(18 * k, s * 0.075),
      b = { l: 0, t: e, r: 0, b: e };
    border(b, '#212529');
    ctx.fillStyle = '#f8f9fa';
    const hw = e * 0.42,
      gap = e * 0.9;
    for (let x = gap * 0.4; x < w; x += gap) {
      ctx.fillRect(x, e * 0.3, hw, e * 0.4);
      ctx.fillRect(x, h - e * 0.7, hw, e * 0.4);
    }
    ribbon();
    return b;
  }
  if (frame === 'hearts' || frame === 'stars' || frame === 'flowers') {
    const e = Math.max(14 * k, s * 0.055),
      b = { l: e, t: e, r: e, b: e };
    const col = { hearts: '#ffdeeb', stars: '#364fc7', flowers: '#d3f9d8' }[frame];
    border(b, col);
    const per = (len) => Math.max(3, Math.round(len / (e * 1.6)));
    const deco = (x, y, i) => {
      if (frame === 'hearts') heart(ctx, x, y - e * 0.08, e * 0.32, i % 2 ? '#ff6b9d' : '#f783ac');
      else if (frame === 'stars') star(ctx, x, y, e * 0.33, i % 3 ? '#ffd43b' : '#fff3bf', null);
      else {
        const c = ['#ff6b9d', '#ffd43b', '#b197fc', '#74c0fc'][i % 4];
        for (let a = 0; a < 5; a++) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(
            x + Math.cos((a * Math.PI * 2) / 5) * e * 0.17,
            y + Math.sin((a * Math.PI * 2) / 5) * e * 0.17,
            e * 0.14,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.fillStyle = '#fff3bf';
        ctx.beginPath();
        ctx.arc(x, y, e * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    let i = 0;
    const nx = per(w),
      ny = per(h);
    for (let q = 0; q <= nx; q++) {
      const x = e / 2 + ((w - e) * q) / nx;
      deco(x, e / 2, i++);
      deco(x, h - e / 2, i++);
    }
    for (let q = 1; q < ny; q++) {
      const y = e / 2 + ((h - e) * q) / ny;
      deco(e / 2, y, i++);
      deco(w - e / 2, y, i++);
    }
    if (cap) {
      const sz = clamp(s * 0.06, 14 * k, 30 * k);
      capText(h - e - sz * 0.9, '#fff', sz, frame === 'stars' ? '#364fc7' : '#4a3728');
    }
    return b;
  }
  ribbon();
  return { l: 0, t: 0, r: 0, b: 0 };
}
/** Наклейки: [{ e, fx, fy }] — доли ширины и высоты кадра. */
export function drawDecor(ctx, w, h, list, size) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillStyle = '#000';
  for (const d of list) ctx.fillText(d.e, d.fx * w, d.fy * h);
}

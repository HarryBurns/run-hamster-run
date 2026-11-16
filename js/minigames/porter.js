// Мини-игра «Носильщица» (курортный отель, П.17; работа — её предлагает носильщик Тележкин, features/hotel.js).
// Отель в разрезе: этажи с дверями номеров (201–205, 301–305…), внизу — холл с тележкой. Сверху — чемодан гостя
// с биркой: на ней номер комнаты. Нажми на дверь с этим номером — хомячок довезёт чемодан на тележке (лифт слева).
// Угадала с первого раза — 2 очка, со второго — 1; довезла быстро — ещё +1. Ошиблась дверью — добрая подсказка
// («Здесь 204, а на бирке 203»), после двух ошибок нужная дверь подмигивает. Проигрыша нет. 8 чемоданов; звёзды —
// по очкам. Зарплату платит занятие (JOBS.porter — features/minigames.js).
import { el, clamp, shuffle } from '../core/util.js';
import { ell, fillRR, line, star } from '../core/draw.js';

const N = 8; // чемоданов за смену
const OUT = '#4a3728';
/** Сколько очков на 2★ и 3★ (из 24). */
export const PORTER_STARS = [12, 19];
const FAST = 6; // довезла быстрее — ещё очко (секунды с появления чемодана)
const COLORS = ['#ff8fab', '#74c0fc', '#ffd43b', '#b197fc', '#8ce99a', '#ffa94d'];
const DOOR_COLORS = ['#ffd8a8', '#c5f6fa', '#d0bfff', '#b2f2bb', '#ffc9c9'];

function suitcase(ctx, x, y, w, h, col, tag) {
  fillRR(ctx, x - w / 2, y - h, w, h, w * 0.12, col, OUT, 2.2);
  fillRR(ctx, x - w * 0.16, y - h - w * 0.14, w * 0.32, w * 0.16, 4, null, OUT, 2.2);
  line(ctx, x - w / 2 + 6, y - h * 0.5, x + w / 2 - 6, y - h * 0.5, 'rgba(0,0,0,.18)', 3);
  for (const dx of [-0.3, 0.3]) ell(ctx, x + w * dx, y + 2, 5, 5, '#495057', OUT, 1.2);
  if (tag) {
    line(ctx, x + w * 0.3, y - h + 6, x + w * 0.55, y - h * 0.62, OUT, 1.5);
    fillRR(ctx, x + w * 0.42, y - h * 0.66, w * 0.62, h * 0.42, 6, '#fff', OUT, 2);
    ctx.font = `900 ${Math.round(h * 0.22)}px ui-rounded, "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUT;
    ctx.fillText(tag, x + w * 0.73, y - h * 0.44);
  }
}
/** Картинка для правил. */
function pic(draw, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.lineJoin = 'round';
  draw(x, size, size / 50);
  return `<img src="${c.toDataURL()}" width="${size}" height="${size}" alt="">`;
}
function doorPic(ctx, size, s, n, col) {
  fillRR(ctx, size * 0.22, size * 0.12, size * 0.56, size * 0.84, 4, '#8d5524', OUT, 1.5);
  fillRR(ctx, size * 0.27, size * 0.17, size * 0.46, size * 0.79, 3, col, OUT, 1.2);
  fillRR(ctx, size * 0.3, size * 0.22, size * 0.4, size * 0.2, 4, '#fff', OUT, 1.2);
  ctx.font = `900 ${Math.round(size * 0.15)}px ui-rounded, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = OUT;
  ctx.fillText(n, size / 2, size * 0.33);
}

const CSS = `
.pt-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.pt-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #74c0fc;text-align:center}
.pt-col.ok{border-color:#8ce99a}
.pt-col b{display:block;font-size:16px}
.pt-col .row{display:flex;gap:4px;justify-content:center;align-items:center;font-size:26px;font-weight:900}
.pt-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.pt-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.pt-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'porter',
  title: 'Носильщица',
  icon: '🧳',
  get howTo() {
    return `<style>${CSS}</style>Гости приехали! Развези чемоданы по номерам.
      <div class="pt-rules">
        <div class="pt-col"><b>🏷️ Смотри на бирку</b><div class="row">${pic((c, size) => suitcase(c, size * 0.4, size * 0.9, size * 0.5, size * 0.55, '#ff8fab', '203'))}</div><small>на бирке — номер<br>комнаты</small></div>
        <div class="pt-col ok"><b>👆 Нажми на дверь</b><div class="row">${pic((c, size, s) => doorPic(c, size, s, '203', '#d0bfff'))}</div><small>с тем же номером:<br>2 — этаж, 03 — дверь</small></div>
      </div>
      Чем меньше ошибок и чем быстрее — тем больше звёзд. Ошиблась — ничего страшного, подскажем!`;
  },
  start(host) {
    const root = host.root;
    const style = el('style', '', CSS);
    const top = el('div', 'pt-top');
    const tLeft = el('div', 'pt-chip'),
      tPts = el('div', 'pt-chip');
    top.append(tLeft, tPts);
    root.append(style, top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    const floors = level >= 3 ? [2, 3, 4] : level >= 1 ? [2, 3] : [2];
    const rooms = floors.flatMap((f) => [1, 2, 3, 4, 5].map((d) => f * 100 + d));
    // чемоданы смены: разные номера (если номеров меньше, чем чемоданов, — по кругу)
    const order = [];
    while (order.length < N) order.push(...shuffle(rooms));
    const bags = order.slice(0, N).map((n, i) => ({ n, col: COLORS[i % COLORS.length] }));
    let t = 0,
      last = performance.now(),
      raf = 0,
      stopped = false,
      over = false,
      i = 0, // какой чемодан везём
      pts = 0,
      mistakes = 0,
      tries = 0, // ошибок с этим чемоданом
      shown = 0, // когда появился чемодан
      move = null, // { from: {x,y}, to: {x,y}, door, t } — хомячок едет к двери
      opened = null, // { door, t } — дверь открыта, гость машет
      hint = null; // { text, t }
    const hero = { x: 0, y: 0 };
    const pops = [];

    // ---------- раскладка ----------
    const L = () => {
      const W = cv.w,
        H = cv.h,
        head = clamp(H * 0.22, 96, 150),
        bw = Math.min(W - 24, 720),
        bx = (W - bw) / 2,
        liftW = clamp(bw * 0.12, 44, 70),
        rows = floors.length + 1,
        fh = Math.min(170, (H - head - 20) / rows),
        by = H - 14 - Math.max(0, (H - head - 20 - rows * fh) * 0.35); // пол холла (лишнее место — поровну сверху и снизу)
      const dw = (bw - liftW - 16) / 5;
      return { W, H, head, bw, bx, liftW, fh, by, dw };
    };
    const floorY = (k) => {
      const g = L();
      return g.by - (k + 1) * g.fh; // k — индекс этажа в floors (0 — нижний из номерных)
    };
    const doors = () => {
      const g = L(),
        list = [];
      floors.forEach((f, k) => {
        const y = floorY(k);
        for (let d = 0; d < 5; d++) {
          const x = g.bx + g.liftW + 8 + g.dw * (d + 0.5);
          list.push({ n: f * 100 + d + 1, k, d, x, y, w: Math.min(g.dw * 0.66, g.fh * 0.5), h: g.fh * 0.72 });
        }
      });
      return list;
    };
    const lobbyPos = () => {
      const g = L();
      return { x: g.bx + g.liftW + 40, y: g.by };
    };
    Object.assign(hero, lobbyPos());

    // ---------- управление ----------
    function tapAt(px, py) {
      if (over || move || opened) return;
      const hit = doors().find((d) => px > d.x - d.w / 2 - 6 && px < d.x + d.w / 2 + 6 && py > d.y - d.h - 6 && py < d.y + 6);
      if (!hit) return;
      host.sfx('tap');
      move = { from: { ...hero }, to: { x: hit.x, y: hit.y }, door: hit, t: 0 };
    }
    const down = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      tapAt(((e.clientX - r.left) / r.width) * cv.w, ((e.clientY - r.top) / r.height) * cv.h);
    };
    cv.canvas.addEventListener('pointerdown', down);
    // клавиатура: цифры — номер двери на нижнем этаже (1–5), стрелки ↑↓ — этаж; Enter — к выбранной двери
    let sel = { k: 0, d: 0 };
    const kd = (e) => {
      if (e.code === 'ArrowLeft') sel.d = Math.max(0, sel.d - 1);
      else if (e.code === 'ArrowRight') sel.d = Math.min(4, sel.d + 1);
      else if (e.code === 'ArrowUp') sel.k = Math.min(floors.length - 1, sel.k + 1);
      else if (e.code === 'ArrowDown') sel.k = Math.max(0, sel.k - 1);
      else if (e.code === 'Enter' || e.code === 'Space') {
        const d = doors().find((q) => q.k === sel.k && q.d === sel.d);
        if (d) tapAt(d.x, d.y - 10);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', kd);
    // для автотеста (dev/smoke_hotel.js): номер на бирке, двери (CSS-пиксели канвы), сколько довезено и ошибок
    cv.canvas.__porter = () => ({
      tag: bags[i] ? bags[i].n : null,
      done: i,
      mistakes,
      busy: !!(move || opened),
      w: cv.w,
      h: cv.h,
      doors: doors().map((d) => ({ n: d.n, x: d.x, y: d.y - d.h / 2 })),
    });

    function arrive() {
      const d = move.door,
        bag = bags[i];
      move = null;
      if (d.n === bag.n) {
        const fast = t - shown < FAST;
        const got = (tries === 0 ? 2 : tries === 1 ? 1 : 0) + (fast ? 1 : 0);
        pts += got;
        host.sfx('win');
        opened = { door: d, t: 0, ok: true };
        pops.push({ text: got ? `+${got} ⭐ Спасибо!` : 'Спасибо!', col: '#2f9e44', x: d.x, y: d.y - d.h - 10, t: 0 });
      } else {
        mistakes++;
        tries++;
        host.sfx('bad');
        opened = { door: d, t: 0, ok: false };
        hint = {
          text: `Здесь ${d.n}, а на бирке ${bag.n}. ${Math.floor(d.n / 100) !== Math.floor(bag.n / 100) ? `Нужен ${Math.floor(bag.n / 100)}-й этаж!` : bag.n > d.n ? 'Дальше вправо →' : '← Левее'}`,
          t: 0,
        };
      }
    }
    function update(dt) {
      t += dt;
      if (move) {
        move.t += dt / 0.7;
        const k = Math.min(1, move.t),
          g = L(),
          liftX = g.bx + g.liftW / 2;
        // путь: к лифту → вверх/вниз → вдоль этажа к двери
        const a = move.from,
          b = move.to;
        if (k < 0.33) {
          const q = k / 0.33;
          hero.x = a.x + (liftX - a.x) * q;
          hero.y = a.y;
        } else if (k < 0.66) {
          const q = (k - 0.33) / 0.33;
          hero.x = liftX;
          hero.y = a.y + (b.y - a.y) * q;
        } else {
          const q = (k - 0.66) / 0.34;
          hero.x = liftX + (b.x - liftX) * q;
          hero.y = b.y;
        }
        if (k >= 1) arrive();
      } else if (opened) {
        opened.t += dt;
        if (opened.t > (opened.ok ? 0.9 : 0.6)) {
          const ok = opened.ok;
          opened = null;
          if (ok) {
            i++;
            tries = 0;
            shown = t;
            hint = null;
            if (i >= N) finish();
          }
        }
      }
      if (hint) hint.t += dt;
      for (const p of pops) p.t += dt;
      for (let q = pops.length - 1; q >= 0; q--) if (pops[q].t > 1.2) pops.splice(q, 1);
    }

    function draw() {
      const g = L(),
        { W, H } = g,
        bag = bags[Math.min(i, N - 1)];
      // небо и море за отелем
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#a5d8ff');
      sky.addColorStop(1, '#e7f5ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // шапка: чемодан с биркой
      fillRR(ctx, 10, 46, W - 20, g.head - 50, 16, 'rgba(255,255,255,.9)', OUT, 2);
      const sh = g.head - 76;
      if (i < N) {
        suitcase(ctx, W / 2 - sh * 0.45, g.head - 12, sh * 0.85, sh * 0.8, bag.col, String(bag.n));
        ctx.font = `800 ${Math.round(clamp(W / 26, 13, 18))}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText(`В номер ${bag.n}!`, W / 2 + sh * 0.6, 40 + g.head * 0.42);
      }
      // здание
      const topY = floorY(floors.length - 1) - g.fh;
      fillRR(ctx, g.bx, topY, g.bw, g.by - topY + 4, 10, '#fff4e6', OUT, 2.5);
      fillRR(ctx, g.bx - 8, topY - 10, g.bw + 16, 14, 5, '#1098ad', OUT, 2);
      // шахта лифта
      fillRR(ctx, g.bx + 4, topY + 4, g.liftW - 4, g.by - topY - 4, 6, '#dee2e6', OUT, 1.5);
      // этажи: пол, номер этажа у лифта
      floors.forEach((f, k) => {
        const y = floorY(k);
        fillRR(ctx, g.bx + g.liftW, y, g.bw - g.liftW, 6, 2, '#c98b5a', OUT, 1.2);
        ctx.font = `900 ${Math.round(clamp(g.liftW * 0.36, 13, 22))}px ui-rounded, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1098ad';
        ctx.fillText(String(f), g.bx + g.liftW / 2 + 2, y - g.fh * 0.55);
      });
      // холл
      fillRR(ctx, g.bx + g.liftW, g.by - 4, g.bw - g.liftW, 6, 2, '#1098ad', OUT, 1.2);
      ctx.font = `800 ${Math.round(clamp(g.fh * 0.16, 11, 16))}px ui-rounded, sans-serif`;
      ctx.fillStyle = '#0b7285';
      ctx.fillText('Холл', g.bx + g.bw - 40, g.by - g.fh * 0.5);
      // двери
      const want = i < N ? bags[i].n : 0;
      for (const d of doors()) {
        const open = opened && opened.door.n === d.n,
          wink = tries >= 2 && d.n === want && Math.sin(t * 8) > 0;
        if (wink) ell(ctx, d.x, d.y - d.h / 2, d.w * 0.9, d.h * 0.62, 'rgba(255,212,59,.45)');
        fillRR(ctx, d.x - d.w / 2, d.y - d.h, d.w, d.h, 4, '#8d5524', OUT, 1.8);
        if (open && opened.ok) {
          fillRR(ctx, d.x - d.w / 2 + 3, d.y - d.h + 3, d.w - 6, d.h - 3, 3, '#fff3bf');
          host.drawHamster(ctx, d.x, d.y - 2, clamp(d.h / 190, 0.32, 0.6), host.friends.length ? host.friends[(i + d.n) % host.friends.length].look : host.look, { time: t, happy: true, armsUp: Math.sin(t * 10) > 0 });
        } else {
          const shake = open && !opened.ok ? Math.sin(t * 50) * 3 : 0;
          fillRR(ctx, d.x - d.w / 2 + 3 + shake, d.y - d.h + 3, d.w - 6, d.h - 3, 3, DOOR_COLORS[d.d], OUT, 1.2);
          ell(ctx, d.x + d.w * 0.28 + shake, d.y - d.h * 0.45, 2.6, 2.6, '#ffd43b', OUT, 1);
        }
        const pw = Math.max(30, d.w * 0.86);
        fillRR(ctx, d.x - pw / 2, d.y - d.h - 4 - 20, pw, 20, 6, '#fff', OUT, 1.5);
        ctx.font = `900 ${Math.round(clamp(d.w * 0.32, 11, 17))}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText(String(d.n), d.x, d.y - d.h - 13);
      }
      // выбор клавиатурой
      const sd = doors().find((q) => q.k === sel.k && q.d === sel.d);
      if (sd && !move) {
        ctx.strokeStyle = 'rgba(28,126,214,.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(sd.x - sd.w / 2 - 6, sd.y - sd.h - 30, sd.w + 12, sd.h + 32);
        ctx.setLineDash([]);
      }
      // хомячок с тележкой: платформа на колёсиках впереди, ручка — у лапок, чемодан на платформе
      const s = clamp(g.fh / 170, 0.34, 0.75),
        px = hero.x + 8 * s,
        pw = 70 * s;
      line(ctx, px + 4 * s, hero.y - 8, px + 4 * s, hero.y - 70 * s, '#f59f00', 4 * s);
      fillRR(ctx, px, hero.y - 14 * s, pw, 8 * s, 3, '#ffd43b', OUT, 1.4);
      for (const dx of [12, 58]) ell(ctx, px + dx * s, hero.y - 4 * s, 6 * s, 6 * s, '#495057', OUT, 1.2);
      if (i < N && !(opened && opened.ok)) suitcase(ctx, px + pw * 0.55, hero.y - 14 * s, 46 * s, 40 * s, bags[i].col);
      host.drawHamster(ctx, hero.x - 10 * s, hero.y, s, host.look, { time: t, dir: 1, walk: move ? t * 3 : null, happy: !!(opened && opened.ok) });
      // подсказка
      if (hint && i < N) {
        const fs = Math.round(clamp(W / 26, 13, 17));
        ctx.font = `800 ${fs}px ui-rounded, "Trebuchet MS", sans-serif`;
        const tw = Math.min(W - 30, ctx.measureText(hint.text).width + 24);
        fillRR(ctx, W / 2 - tw / 2, g.head + 2, tw, fs + 14, 10, '#fff3bf', OUT, 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = OUT;
        ctx.fillText(hint.text, W / 2, g.head + 9 + fs / 2, W - 40);
      }
      for (const p of pops) {
        ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
        ctx.font = '900 18px ui-rounded, "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(p.text, p.x, p.y - p.t * 26);
        ctx.fillStyle = p.col;
        ctx.fillText(p.text, p.x, p.y - p.t * 26);
      }
      ctx.globalAlpha = 1;
      if (i >= N) star(ctx, W / 2, H / 2, 40, '#ffd43b', OUT, 3);
    }

    function frame(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!over) update(dt);
      tLeft.textContent = `🧳 ${Math.min(i + 1, N)} из ${N}`;
      tPts.textContent = `⭐ ${pts}`;
      draw();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      over = true;
      const stars = pts >= PORTER_STARS[1] ? 3 : pts >= PORTER_STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `Все ${N} чемоданов на месте! Очков — ${pts}${mistakes ? `, ошибок дверью — ${mistakes}.` : ', и ни одной ошибки!'}${stars === 3 ? ' Лучшая носильщица отеля!' : ''}`,
        extra: { pts, mistakes },
      });
    }
    raf = requestAnimationFrame(frame);
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        cv.canvas.removeEventListener('pointerdown', down);
        window.removeEventListener('keydown', kd);
        if (cv.destroy) cv.destroy();
        style.remove();
        top.remove();
      },
    };
  },
};

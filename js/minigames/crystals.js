// Мини-игра «Кристаллы» (пещеры, П.9; запускает шахтёр Камушкин — features/caves.js).
// Хомячок в каске стоит у кристальной жилы. Внизу полоска: по ней туда-сюда бегает кирка-указатель, на полоске —
// зелёная зона, в её серединке — золотая. Стучи (палец, мышка, пробел или Enter), когда кирка над зелёным: дзынь —
// кристалл откололся! В золотой серединке — двойная добыча. Мимо — просто «тук» по камню, без наказания. После
// каждого удара зона переезжает в новое место, а кирка бегает чуть быстрее. 15 ударов; звёзды — по добыче.
// Проигрыша нет. Монеты и самоцветы по звёздам выдаёт занятие (features/caves.js).
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';
import { pic as kitPic } from './kit.js';

const STRIKES = 15;
const OUT = '#4a3728';
/** Сколько набрать (кристаллов) на 2★ и 3★; золото — 2, зелёное — 1. */
export const CRYSTAL_STARS = [10, 20];
const GEMS = [
  ['#d0bfff', '#9775fa'],
  ['#a5d8ff', '#4dabf7'],
  ['#fcc2d7', '#f06595'],
  ['#ffd8a8', '#ff922b'],
];

/** Гранёный кристалл: (x, y) — низ, h — высота, a — наклон. */
function crystal(ctx, x, y, h, a, col, w = h * 0.22) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  poly(ctx, [-w, 0, -w, -h + w, 0, -h, w, -h + w, w, 0], col[0], OUT, 2);
  poly(ctx, [0, -h, w, -h + w, w, 0, 0, 0], col[1]);
  line(ctx, -w * 0.5, -h + w + 3, -w * 0.5, -5, 'rgba(255,255,255,.7)', 2);
  poly(ctx, [-w, 0, -w, -h + w, 0, -h, w, -h + w, w, 0], null, OUT, 2);
  ctx.restore();
}
/** Кирка: (x, y) — где её держат, a — поворот (0 — клюв вправо-вниз), s — масштаб. */
function pickaxe(ctx, x, y, a, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  line(ctx, 0, 0, 46, 0, OUT, 7);
  line(ctx, 0, 0, 46, 0, '#e03131', 4.4);
  ctx.beginPath();
  ctx.moveTo(40, -24);
  ctx.quadraticCurveTo(54, -6, 50, 22);
  ctx.lineTo(45, 21);
  ctx.quadraticCurveTo(46, -2, 36, -18);
  ctx.closePath();
  ctx.fillStyle = '#ced4da';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  line(ctx, 42, -18, 48, -4, '#fff', 1.4);
  ctx.restore();
}
/** Полоска с зоной и киркой-указателем (для правил и для игры). */
function bar(ctx, x, y, w, h, z0, z1, g0, g1, pos, flash = 0) {
  fillRR(ctx, x, y, w, h, h / 2, '#5c5065', OUT, 2.5);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, h / 2) : ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = flash ? '#b2f2bb' : '#69db7c';
  ctx.fillRect(x + z0 * w, y, (z1 - z0) * w, h);
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(x + g0 * w, y, (g1 - g0) * w, h);
  ctx.restore();
  fillRR(ctx, x, y, w, h, h / 2, null, OUT, 2.5);
  // указатель: треугольник над полоской и черта поперёк
  const px = x + pos * w;
  line(ctx, px, y - 4, px, y + h + 4, OUT, 5);
  line(ctx, px, y - 4, px, y + h + 4, '#fff', 2.4);
  poly(ctx, [px - 9, y - 16, px + 9, y - 16, px, y - 5], '#fff', OUT, 2);
}

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 120, h = 50) => kitPic(draw, w, h);

const CSS = `
.cr-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.cr-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #8ce99a;text-align:center}
.cr-col.gold{border-color:#ffd43b}
.cr-col.how{border-color:#74c0fc}
.cr-col b{display:block;font-size:16px}
.cr-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.cr-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.cr-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'crystals',
  title: 'Кристаллы',
  icon: '💎',
  css: CSS,
  get howTo() {
    return `По полоске бегает кирка. <b>Стучи, когда она над зелёным!</b>
      <div class="cr-rules">
        <div class="cr-col"><b>✅ Зелёное</b>${pic((c, w, h) => bar(c, 6, 20, w - 12, 18, 0.3, 0.7, 0.45, 0.55, 0.36))}<small>дзынь! — кристалл</small></div>
        <div class="cr-col gold"><b>⭐ Серединка</b>${pic((c, w, h) => bar(c, 6, 20, w - 12, 18, 0.3, 0.7, 0.45, 0.55, 0.5))}<small>золото — два кристалла!</small></div>
        <div class="cr-col how"><b>👆 Стучи</b>${pic((c, w, h) => {
          pickaxe(c, 30, 30, -0.5, 0.55);
          crystal(c, 86, 46, 34, 0.1, GEMS[0]);
          crystal(c, 100, 46, 24, 0.4, GEMS[1]);
        })}<small>пальцем, мышкой,<br>пробелом или Enter</small></div>
      </div>
      Мимо — не страшно, просто «тук». ${STRIKES} ударов — добудь побольше!`;
  },
  start(host) {
    const top = el('div', 'cr-top');
    const tLeft = el('div', 'cr-chip'),
      tGot = el('div', 'cr-chip');
    top.append(tLeft, tGot);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    // у жилы хомячок всегда в каске шахтёра (только на время игры — наряд не меняется)
    const look = { ...host.look, outfit: { ...host.look.outfit, head: { kind: 'helmet', c: '#ffd43b', c2: '#e8a400' } } };
    let t = 0,
      over = false,
      left = STRIKES,
      got = 0,
      phase = 0, // бег кирки: 0..2 — туда и обратно
      cool = 0, // после удара — короткая пауза
      swing = 0, // анимация замаха (1 → 0)
      flash = 0,
      gold = 0;
    const zone = { c: 0.5, w: 0.24, g: 0.08 };
    const pops = host.pops({ line: 5 }),
      chips = [];
    const pos = () => (phase < 1 ? phase : 2 - phase);
    const zoneAt = () => ({
      z0: zone.c - zone.w / 2,
      z1: zone.c + zone.w / 2,
      g0: zone.c - zone.g / 2,
      g1: zone.c + zone.g / 2,
    });
    const period = () => clamp(1.75 - (STRIKES - left) * 0.035 - level * 0.05, 1.05, 1.8); // секунд на «туда и обратно»
    const S = () => clamp(Math.min(cv.w, cv.h * 1.2) / 520, 0.7, 1.4);
    const BAR = () => {
      const w = Math.min(cv.w * 0.84, 560),
        h = 34 * S();
      return { x: (cv.w - w) / 2, y: cv.h * 0.8 - h / 2, w, h };
    };
    const vein = () => ({ x: cv.w * 0.56, y: cv.h * 0.56 });

    function strike() {
      if (over || cool > 0 || left <= 0) return;
      const p = pos(),
        z = zoneAt();
      left--;
      cool = 0.28;
      swing = 1;
      const v = vein(),
        s = S();
      let n = 0;
      if (p >= z.g0 && p <= z.g1) n = 2;
      else if (p >= z.z0 && p <= z.z1) n = 1;
      got += n;
      if (n) {
        host.sfx(n === 2 ? 'win' : 'clink');
        flash = 0.25;
        if (n === 2) gold++;
        pops.add(n === 2 ? 'Отлично! +2' : 'Дзынь! +1', v.x, v.y - 120 * s, n === 2 ? '#f08c00' : '#2b8a3e');
        for (let i = 0; i < n * 3; i++)
          chips.push({
            x: v.x + (Math.random() - 0.5) * 60 * s,
            y: v.y - 40 * s,
            vx: (Math.random() - 0.5) * 260,
            vy: -160 - Math.random() * 200,
            c: GEMS[(i + got) % GEMS.length],
            t: 0,
          });
      } else {
        host.sfx('thud');
        pops.add('Тук!', v.x, v.y - 110 * s, '#868e96');
      }
      // зона переезжает, становится чуть уже
      zone.w = Math.max(0.15, 0.24 - (STRIKES - left) * 0.006 - level * 0.01);
      zone.g = Math.max(0.05, zone.w * 0.32);
      let c = zone.c;
      for (let k = 0; k < 6 && Math.abs(c - zone.c) < 0.2; k++) c = 0.15 + Math.random() * 0.7;
      zone.c = c;
      if (left <= 0) host.later(finish, 650);
    }

    // ---------- управление ----------
    const down = (e) => {
      e.preventDefault();
      strike();
    };
    host.on(cv.canvas, 'pointerdown', down);
    const kd = (e) => {
      if (['Space', 'Enter', 'NumpadEnter', 'ArrowDown', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) strike();
      }
    };
    host.on(window, 'keydown', kd);
    // для автотеста (dev/smoke_caves.js): где кирка, где зона, сколько ударов осталось
    cv.canvas.__crystals = () => ({ pos: pos(), ...zoneAt(), left, got, gold, ready: cool <= 0 && !over });

    function update(dt) {
      t += dt;
      phase = (phase + (dt * 2) / period()) % 2;
      cool = Math.max(0, cool - dt);
      swing = Math.max(0, swing - dt * 4);
      flash = Math.max(0, flash - dt);
      pops.step(dt);
      for (const c of chips) {
        c.t += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vy += 520 * dt;
      }
      for (let i = chips.length - 1; i >= 0; i--) if (chips[i].t > 1.1) chips.splice(i, 1);
    }

    function draw() {
      const W = cv.w,
        H = cv.h,
        s = S(),
        v = vein();
      // стена пещеры: тёмный камень, тёплый свет фонаря посередине
      ctx.fillStyle = '#2e2734';
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.45, H * 0.5, 30, W * 0.45, H * 0.5, Math.max(W, H) * 0.6);
      g.addColorStop(0, 'rgba(255,214,140,.38)');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(15,10,20,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const y = H * (0.12 + i * 0.11);
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(W * 0.5, y + 20 * Math.sin(i), W, y - 10);
      }
      ctx.stroke();
      // пол
      ctx.fillStyle = '#5b4f49';
      ctx.fillRect(0, v.y + 10 * s, W, H);
      ell(ctx, W / 2, v.y + 12 * s, W * 0.7, 14 * s, '#6b5f58');
      // кристальная жила: друза растёт из камня; чем больше добыто — тем ярче
      ell(ctx, v.x, v.y, 110 * s, 34 * s, '#4a4152', OUT, 2.5);
      const sh = flash > 0 ? Math.sin(flash * 60) * 3 : 0;
      [
        [-70, 70, -0.5, 0],
        [-34, 120, -0.18, 1],
        [6, 150, 0.02, 2],
        [44, 110, 0.25, 0],
        [80, 70, 0.55, 3],
        [-8, 80, -0.3, 1],
      ].forEach(([dx, h, a, c]) => crystal(ctx, v.x + dx * s + sh, v.y + 8 * s, h * s, a, GEMS[c]));
      // корзинка с добычей
      const bx = W * 0.86,
        by = v.y + 6 * s;
      ctx.beginPath();
      ctx.arc(bx, by - 30 * s, 30 * s, Math.PI, 0);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6 * s;
      ctx.stroke();
      ctx.strokeStyle = '#a0662d';
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      fillRR(ctx, bx - 36 * s, by - 34 * s, 72 * s, 38 * s, 10 * s, '#c98b5a', OUT, 2);
      for (let i = 1; i < 3; i++) line(ctx, bx - 34 * s, by - 34 * s + i * 12 * s, bx + 34 * s, by - 34 * s + i * 12 * s, 'rgba(74,55,40,.35)', 1.5);
      for (let i = 0; i < Math.min(got, 12); i++)
        crystal(ctx, bx - 28 * s + (i % 6) * 11 * s, by - 32 * s + Math.floor(i / 6) * 4 * s, 18 * s, ((i % 3) - 1) * 0.3, GEMS[i % 4], 4 * s);
      // хомячок с киркой
      const hx = v.x - 170 * s,
        hy = v.y + 14 * s;
      host.drawHamster(ctx, hx, hy, 0.95 * s, look, { time: t, dir: 1, happy: flash > 0, blink: t % 3.1 < 0.12 });
      const a = swing > 0 ? -1.4 + (1 - swing) * 1.8 : -1.2 + Math.sin(t * 2) * 0.05;
      pickaxe(ctx, hx + 20 * s, hy - 40 * s, a, 1.3 * s);
      // полоска
      const b = BAR(),
        z = zoneAt();
      bar(ctx, b.x, b.y, b.w, b.h, z.z0, z.z1, z.g0, z.g1, pos(), flash > 0);
      // осколки и надписи
      for (const c of chips) {
        ctx.globalAlpha = Math.max(0, 1 - c.t / 1.1);
        crystal(ctx, c.x, c.y, 16 * s, c.t * 8, c.c, 4 * s);
      }
      ctx.globalAlpha = 1;
      pops.draw(ctx, Math.round(22 * s));
    }

    host.loop((dt) => {
      if (!over) update(dt);
      tLeft.textContent = `⛏️ ${left}`;
      tGot.textContent = `💎 ${got}`;
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      const stars = got >= CRYSTAL_STARS[1] ? 3 : got >= CRYSTAL_STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `Добыто кристаллов: ${got} 💎${gold ? `, из них золотых ударов — ${gold}` : ''}.${stars === 3 ? ' Настоящая шахтёрка!' : ' Кирка звенит — жила довольна!'}`,
        extra: { got, gold },
      });
    }
  },
};

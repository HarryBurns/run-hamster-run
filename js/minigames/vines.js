// Мини-игра «Лианы» (джунгли, П.9; запускает исследовательница Лиана — features/jungle.js).
// Хомячок висит на лиане, лиана качается туда-сюда. Нажми (палец, мышка, пробел или Enter), когда лиана летит
// ВПЕРЁД, — хомячок прыгает на следующую лиану. Чем ближе к самому дальнему качу, тем лучше прыжок: «Отлично!» —
// и по пути ловишь бабочку. По дороге в каждом пролёте висит фрукт — его хватаешь на лету. Нажала, когда лиана
// летит назад, — «Подожди!» и ничего страшного: висишь дальше. Девять прыжков — и ты у Лианы на дереве.
// Проигрыша нет. Монеты по звёздам выдаёт занятие (features/jungle.js).
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line, emoji } from '../core/draw.js';
import { pic as kitPic } from './kit.js';

const OUT = '#4a3728';
const JUMPS = 9;
/** Сколько очков на 2★ и 3★: хороший прыжок — 1, отличный — 2 (самое большее — 18). */
export const VINE_STARS = [10, 15];
const D = 180, // расстояние между лианами (единицы игры)
  L = 150, // длина лианы
  A = 0.56, // размах качания (радианы)
  TOP = 30; // где лианы привязаны
const FRUITS = ['🍌', '🥭', '🍍', '🍌', '🥥', '🥭', '🍍', '🍌', '🥭'];

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 110, h = 64) => kitPic(draw, w, h, { cap: true });
/** Лиана от (x, y0) длиной len под углом a; листики по длине. */
function vine(ctx, x, y0, len, a, s = 1) {
  const ex = x + Math.sin(a) * len,
    ey = y0 + Math.cos(a) * len;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.quadraticCurveTo((x + ex) / 2 + Math.cos(a) * 8 * s, (y0 + ey) / 2, ex, ey);
  ctx.stroke();
  ctx.strokeStyle = '#4a9a35';
  ctx.lineWidth = 3.4 * s;
  ctx.stroke();
  for (let k = 0.2; k < 0.95; k += 0.2) {
    const px = x + (ex - x) * k + Math.cos(a) * 8 * s * 2 * k * (1 - k),
      py = y0 + (ey - y0) * k;
    ell(ctx, px + 5 * s, py, 6 * s, 2.6 * s, '#69c24c', OUT, 1, 0.6);
  }
  return { x: ex, y: ey };
}
/** Стрелка «вперёд» для правил. */
function arrow(ctx, x, y, dir, col) {
  line(ctx, x - dir * 16, y, x + dir * 10, y, OUT, 6);
  line(ctx, x - dir * 16, y, x + dir * 10, y, col, 3.5);
  poly(ctx, [x + dir * 18, y, x + dir * 6, y - 8, x + dir * 6, y + 8], col, OUT, 1.6);
}

const CSS = `
.vn-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.vn-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #8ce99a;text-align:center}
.vn-col.no{border-color:#ffa8a8}
.vn-col.gold{border-color:#ffd43b}
.vn-col b{display:block;font-size:16px}
.vn-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.vn-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.vn-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'vines',
  title: 'Лианы',
  icon: '🐒',
  css: CSS,
  get howTo() {
    return `Хомячок висит на лиане, лиана качается. <b>Нажми, когда она летит вперёд!</b>
      <div class="vn-rules">
        <div class="vn-col"><b>✅ Вперёд</b>${pic((c, w, h) => {
          vine(c, 40, 4, 44, 0.45, 0.6);
          arrow(c, 82, 40, 1, '#69db7c');
        })}<small>прыг — на следующую!</small></div>
        <div class="vn-col gold"><b>⭐ Дальше всех</b>${pic((c, w, h) => {
          vine(c, 36, 4, 44, 0.6, 0.6);
          emoji(c, '🦋', 86, 18, 20);
          emoji(c, '🍌', 80, 46, 18);
        })}<small>отличный прыжок<br>и бабочка в придачу</small></div>
        <div class="vn-col no"><b>✋ Назад</b>${pic((c, w, h) => {
          vine(c, 66, 4, 44, -0.45, 0.6);
          arrow(c, 30, 40, -1, '#ff8787');
        })}<small>подожди — не страшно</small></div>
      </div>
      Палец, мышка, пробел или Enter. ${JUMPS} прыжков до Лианы — лови фрукты по пути!`;
  },
  start(host) {
    const top = el('div', 'vn-top');
    const tJump = el('div', 'vn-chip'),
      tFruit = el('div', 'vn-chip'),
      tFly = el('div', 'vn-chip');
    top.append(tJump, tFruit, tFly);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    let t = 0,
      over = false,
      at = 0, // на какой лиане висим
      score = 0,
      fruits = 0,
      flies = 0,
      perfect = 0,
      miss = 0,
      fly = null, // прыжок: { t, from: {x, y}, to: i, q }
      camX = 0;
    const pops = host.pops({ life: 1.1, fade: 1, line: 5 });
    // у каждой лианы своя фаза — чтобы качались не в лад
    const phase = Array.from({ length: JUMPS + 1 }, (_, i) => i * 1.9);
    const period = () => clamp(1.9 - at * 0.05 - level * 0.06, 1.3, 2); // секунд на «туда и обратно»
    const ang = (i, tt = t) => A * Math.sin((tt * Math.PI * 2) / period() + phase[i]);
    const vel = (i) => Math.cos((t * Math.PI * 2) / period() + phase[i]); // > 0 — летит вперёд (вправо)
    const anchor = (i) => ({ x: 120 + i * D, y: TOP });
    const endOf = (i, tt = t) => {
      const a = anchor(i),
        q = ang(i, tt);
      return { x: a.x + Math.sin(q) * L, y: a.y + Math.cos(q) * L };
    };
    const goal = () => anchor(JUMPS).x + 60;
    // масштаб: мир игры — 420 единиц в высоту и не уже 360 (на высоком телефоне мир — посередине экрана)
    const K = () => Math.min(cv.h / 420, cv.w / 360);
    const OY = () => Math.max(0, (cv.h - 420 * K()) * 0.42);

    function jump() {
      if (over || fly || at >= JUMPS) return;
      const q = ang(at) / A;
      if (vel(at) <= 0 || q < -0.1) {
        miss++;
        host.sfx('thud');
        const e = endOf(at);
        pops.add('Подожди!', e.x, e.y - 70, '#e03131');
        return;
      }
      const best = q > 0.72;
      fly = { t: 0, from: endOf(at), to: at + 1, q, best };
      host.sfx('pop');
    }
    function land() {
      const f = fly;
      fly = null;
      at = f.to;
      fruits++;
      score += f.best ? 2 : 1;
      if (f.best) {
        flies++;
        perfect++;
      }
      host.sfx(f.best ? 'win' : 'ok');
      const e = endOf(at);
      pops.add(f.best ? `Отлично! ${FRUITS[at - 1]}🦋` : `Хоп! ${FRUITS[at - 1]}`, e.x, e.y - 80, f.best ? '#f08c00' : '#2b8a3e');
      if (at >= JUMPS) host.later(finish, 900);
    }

    // ---------- управление ----------
    const down = (e) => {
      e.preventDefault();
      jump();
    };
    host.on(cv.canvas, 'pointerdown', down);
    const kd = (e) => {
      if (['Space', 'Enter', 'NumpadEnter', 'ArrowRight', 'ArrowUp', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) jump();
      }
    };
    host.on(window, 'keydown', kd);
    // для автотеста (dev/smoke_jungle.js): на какой лиане, летит ли вперёд, насколько далеко качнулась (−1..1)
    cv.canvas.__vines = () => ({ at, n: JUMPS, forward: vel(at) > 0, q: ang(at) / A, flying: !!fly, score, miss, over });

    // ---------- фон: слои джунглей (рисуются один раз на размер, дальше только копируются со сдвигом) ----------
    let bg = null;
    function makeBg() {
      const w = Math.ceil(cv.w * cv.dpr),
        h = Math.ceil(cv.h * cv.dpr);
      if (bg && bg.w === w && bg.h === h) return bg;
      const layer = (fn) => {
        const c = document.createElement('canvas');
        c.width = w * 2;
        c.height = h;
        const x = c.getContext('2d');
        x.scale(cv.dpr, cv.dpr);
        fn(x, cv.w * 2, cv.h);
        return c;
      };
      const far = layer((x, W, H) => {
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#b7e4c7');
        g.addColorStop(1, '#52b788');
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
        // слой повторяется по кругу: всё, что вылезает за край, дорисовано и с другой стороны (без шва)
        for (let i = 0; i < 26; i++) {
          const px = (i / 26) * W,
            r = 40 + ((i * 37) % 30);
          for (const dx of [-W, 0, W]) ell(x, px + dx, H * 0.5 + ((i * 53) % 40), r, r * 1.4, i % 2 ? '#40916c' : '#2d6a4f');
        }
      });
      const near = layer((x, W, H) => {
        for (let i = 0; i < 18; i++) {
          const px = (i / 18) * W + 20,
            py = H - 30 - ((i * 29) % 50);
          for (const dx of [-W, 0, W]) {
            ell(x, px + dx, py, 46, 30, i % 2 ? '#1b4332' : '#2d6a4f', OUT, 2);
            ell(x, px + dx - 14, py - 10, 16, 8, 'rgba(255,255,255,.12)');
          }
        }
        x.fillStyle = '#1b4332';
        x.fillRect(0, H - 24, W, 24);
        // река внизу
        x.fillStyle = '#3aa6a0';
        x.fillRect(0, H - 14, W, 14);
      });
      bg = { w, h, far, near };
      return bg;
    }

    function update(dt) {
      t += dt;
      if (fly) {
        fly.t += dt / 0.62;
        if (fly.t >= 1) land();
      }
      pops.step(dt);
    }
    function heroPos() {
      if (fly) {
        const to = endOf(fly.to),
          k = fly.t,
          arc = Math.sin(k * Math.PI) * (fly.best ? 90 : 60);
        return { x: fly.from.x + (to.x - fly.from.x) * k, y: fly.from.y + (to.y - fly.from.y) * k - arc, a: 0 };
      }
      const e = endOf(Math.min(at, JUMPS));
      return { x: e.x, y: e.y, a: -ang(Math.min(at, JUMPS)) };
    }

    function draw() {
      const k = K(),
        W = cv.w / k,
        H = 420,
        hp = heroPos();
      camX += (hp.x - W * 0.35 - camX) * 0.12;
      camX = clamp(camX, 0, Math.max(0, goal() + 100 - W));
      // фон двумя слоями с параллаксом
      const b = makeBg();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const lw = b.far.width, // слой — два экрана в ширину, рисунок на нём повторяется с этим периодом
        fx = -((camX * k * 0.25 * cv.dpr) % lw),
        nx = -((camX * k * 0.6 * cv.dpr) % lw);
      ctx.drawImage(b.far, fx, 0);
      ctx.drawImage(b.far, fx + lw, 0);
      ctx.drawImage(b.near, nx, 0);
      ctx.drawImage(b.near, nx + lw, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(0, OY());
      ctx.scale(k, k);
      ctx.translate(-camX, 0);
      // над веткой — густые кроны (на высоком телефоне они занимают верх экрана)
      const up = OY() / k + 10;
      ctx.fillStyle = '#2d6a4f';
      ctx.fillRect(camX - 20, -up, W + 40, up + TOP - 4);
      for (let x = Math.floor(camX / 90) * 90 - 45; x < camX + W + 90; x += 90) ell(ctx, x, TOP - 6, 56, 26, (x / 90) % 2 ? '#1b4332' : '#2b8a3e', OUT, 2);
      // ветка сверху, к которой привязаны лианы
      fillRR(ctx, camX - 20, 0, W + 40, TOP + 6, 10, '#7a5a3a', OUT, 2.5);
      for (let x = Math.floor(camX / 60) * 60; x < camX + W + 60; x += 60) ell(ctx, x + 20, TOP + 4, 22, 10, '#2f9e44', OUT, 1.6);
      // фрукты и бабочки в пролётах (что уже собрано — нет)
      for (let i = 0; i < JUMPS; i++) {
        if (i < at) continue;
        const x = anchor(i).x + D / 2,
          y = TOP + L - 20 + Math.sin(t * 2 + i) * 4;
        if (x < camX - 40 || x > camX + W + 40) continue;
        emoji(ctx, FRUITS[i], x, y, 26);
        emoji(ctx, '🦋', x + 14 + Math.sin(t * 3 + i) * 10, y - 70 + Math.cos(t * 2.4 + i) * 8, 22);
      }
      // дерево Лианы в конце
      const gx = goal();
      fillRR(ctx, gx - 20, TOP + 20, 40, H, 8, '#a0855c', OUT, 2.5);
      fillRR(ctx, gx - 70, TOP + L + 20, 140, 16, 6, '#c98b5a', OUT, 2);
      ell(ctx, gx, TOP + 10, 90, 40, '#2b8a3e', OUT, 2.5);
      emoji(ctx, '🏁', gx + 40, TOP + L - 4, 26);
      // лианы
      for (let i = 0; i <= JUMPS; i++) {
        const a = anchor(i);
        if (a.x < camX - L - 20 || a.x > camX + W + L + 20) continue;
        vine(ctx, a.x, a.y, L, ang(i));
      }
      // хомячок: висит на лапках, ладошки сжимают кончик лианы (поза grip, Дж8), в полёте — кувырок
      ctx.save();
      ctx.translate(hp.x, hp.y);
      ctx.rotate(fly ? Math.sin(fly.t * Math.PI) * 0.5 : hp.a * 0.8);
      host.drawHamster(ctx, 0, 70, 0.72, host.look, { time: t, dir: 1, grip: true, happy: !!fly || at >= JUMPS, blink: t % 3.1 < 0.12, shadow: false });
      ctx.restore();
      // надписи
      pops.draw(ctx, 22);
      // стрелка-подсказка у лианы: зелёная — можно прыгать
      if (!fly && at < JUMPS) {
        const e = endOf(at),
          ok = vel(at) > 0 && ang(at) / A > -0.1;
        ctx.globalAlpha = 0.85;
        arrow(ctx, e.x + 70, e.y + 30, ok ? 1 : -1, ok ? '#69db7c' : '#ff8787');
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    host.loop((dt) => {
      if (!over) update(dt);
      tJump.textContent = `🐒 ${at} из ${JUMPS}`;
      tFruit.textContent = `🍌 ${fruits}`;
      tFly.textContent = `🦋 ${flies}`;
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      const stars = score >= VINE_STARS[1] ? 3 : score >= VINE_STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `Ты долетела до Лианы! Фруктов поймано: ${fruits}, бабочек — ${flies}.${stars === 3 ? ' Настоящая обезьянка джунглей!' : ' Прыгай подальше — когда лиана качнётся вперёд до конца!'}`,
        extra: { score, fruits, flies, perfect, miss },
      });
    }
  },
};

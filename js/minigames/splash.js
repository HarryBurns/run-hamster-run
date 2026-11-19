// Мини-игра «Водяная битва» (Иван Купала, П.13; запускают вёдра и водяные пистолеты на пляже — features/holidays_summer.js).
// На пляже три укрытия: песочный замок, надувной круг и пляжный зонтик. Из-за них выглядывают друзья — брызни
// в того, кто выглянул, пока он не спрятался! Попала — «Ой, мокро!», друг смеётся и прячется. Не успела — друг
// брызгает в ответ (капли по экрану — просто весело). Проигрыша нет: звёзды — по брызгам (SPLASH_STARS).
// Управление: нажми пальцем или мышью на укрытие (в любом месте его столбика), или клавиши ← ↑ → (A W D, 1 2 3;
// пробел — середина). Промах — пистолет «булькает» и полсекунды накачивается: так «барабанить» по всем укрытиям
// невыгодно. 40 секунд; ближе к концу друзья выглядывают чаще и прячутся быстрее.
// Монеты по звёздам выдаёт занятие (features/holidays_summer.js).
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';
import { pic as kitPic } from './kit.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
/** Сколько секунд длится игра. */
export const SPLASH_TIME = 40;
/** Сколько брызг-попаданий на 2★ и 3★. */
export const SPLASH_STARS = [12, 20];
const LANES = 3;
/** Друг выглядывает так долго (с): в начале и в конце игры. */
const STAY = [1.45, 0.95];
/** Новый друг выглядывает раз в столько секунд (в начале и в конце). */
const GAP = [1.5, 1.05];
/** Промах: пистолет накачивается столько секунд; после попадания — совсем коротко. */
const PUMP = 0.5,
  QUICK = 0.15;

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 110, h = 70) => kitPic(draw, w, h, { cap: true });
// ---------- укрытия ----------
/** Песочный замок: (x, y) — середина основания, s — масштаб. */
function castle(ctx, x, y, s) {
  ell(ctx, x, y + 2 * s, 62 * s, 10 * s, 'rgba(120,80,30,.18)');
  fillRR(ctx, x - 56 * s, y - 46 * s, 112 * s, 48 * s, 6 * s, '#f2cf86', OUT, 2);
  for (const dx of [-44, 30]) {
    fillRR(ctx, x + dx * s, y - 74 * s, 26 * s, 34 * s, 4 * s, '#f6d896', OUT, 2);
    for (let i = 0; i < 3; i++) fillRR(ctx, x + (dx + i * 9) * s, y - 80 * s, 6 * s, 8 * s, 2 * s, '#f6d896', OUT, 1.4);
  }
  fillRR(ctx, x - 10 * s, y - 24 * s, 20 * s, 26 * s, 10 * s, '#c99a54', OUT, 1.6); // ворота
  line(ctx, x - 31 * s, y - 80 * s, x - 31 * s, y - 100 * s, OUT, 2);
  poly(ctx, [x - 31 * s, y - 100 * s, x - 15 * s, y - 95 * s, x - 31 * s, y - 90 * s], '#ff6b6b', OUT, 1.2);
  for (const [dx, dy] of [
    [-30, -16],
    [22, -30],
    [40, -12],
  ])
    ell(ctx, x + dx * s, y + dy * s, 4 * s, 3 * s, '#ffe8cc', OUT, 1);
}
/** Надувной круг-уточка, стоит на ребре. */
function ring(ctx, x, y, s) {
  ell(ctx, x, y + 2 * s, 58 * s, 10 * s, 'rgba(120,80,30,.18)');
  ctx.save();
  ctx.translate(x, y - 50 * s);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 50 * s, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    ctx.arc(0, 0, 22 * s, ((i + 1) / 8) * Math.PI * 2, (i / 8) * Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#fff' : '#ff6b9d';
    ctx.fill();
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#e9c48e';
  ctx.fill();
  ctx.stroke();
  ell(ctx, -26 * s, -26 * s, 9 * s, 5 * s, 'rgba(255,255,255,.7)', null, 0, -0.7);
  // головка уточки сверху
  ell(ctx, 18 * s, -52 * s, 14 * s, 13 * s, '#ffd43b', OUT, 1.8);
  poly(ctx, [30 * s, -54 * s, 42 * s, -50 * s, 30 * s, -46 * s], '#ff922b', OUT, 1.2);
  ell(ctx, 22 * s, -56 * s, 2.2 * s, 2.2 * s, OUT);
  ctx.restore();
}
/** Пляжный зонтик с шезлонгом. */
function umbrella(ctx, x, y, s) {
  ell(ctx, x, y + 2 * s, 64 * s, 10 * s, 'rgba(120,80,30,.18)');
  line(ctx, x + 8 * s, y, x + 2 * s, y - 116 * s, OUT, 4);
  line(ctx, x + 8 * s, y, x + 2 * s, y - 116 * s, '#f1f3f5', 2.2);
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI,
      a1 = Math.PI + ((i + 1) / 6) * Math.PI;
    poly(
      ctx,
      [
        x + 2 * s,
        y - 128 * s,
        x + 2 * s + Math.cos(a0) * 70 * s,
        y - 96 * s,
        x + 2 * s + Math.cos(a1) * 70 * s,
        y - 96 * s,
      ],
      i % 2 ? '#fff' : '#22b8cf',
      OUT,
      1.6,
    );
  }
  // шезлонг перед зонтиком (за ним и прячутся)
  poly(
    ctx,
    [x - 58 * s, y - 2 * s, x + 50 * s, y - 2 * s, x + 56 * s, y - 40 * s, x - 52 * s, y - 40 * s],
    '#ffd43b',
    OUT,
    2,
  );
  for (let i = 1; i < 6; i++)
    line(ctx, x + (-56 + i * 18) * s, y - 4 * s, x + (-50 + i * 18) * s, y - 38 * s, 'rgba(240,140,0,.6)', 3);
  ell(ctx, x - 30 * s, y - 22 * s, 9 * s, 6 * s, '#fff', OUT, 1.2); // полотенце-рулончик
}
const COVERS = [castle, ring, umbrella];
/** Насколько высоко над основанием укрытия видна макушка спрятавшегося (масштаб 1). */
const COVER_H = [46, 100, 44];

/** Капля воды. */
function drop(ctx, x, y, r, a = 1) {
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.8);
  ctx.quadraticCurveTo(x + r, y - r * 0.2, x, y + r);
  ctx.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.8);
  ctx.fillStyle = '#74c0fc';
  ctx.fill();
  ctx.strokeStyle = 'rgba(28,126,214,.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ell(ctx, x - r * 0.3, y - r * 0.4, r * 0.25, r * 0.35, 'rgba(255,255,255,.8)');
  ctx.globalAlpha = 1;
}
/** Водяной пистолет (для картинок правил и в лапке у хомячка на экране). */
function pistol(ctx, x, y, s, dir = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dir, s);
  fillRR(ctx, -4, -2, 8, 13, 3, '#12b886', OUT, 1.4);
  fillRR(ctx, -9, -9, 30, 10, 5, '#20c997', OUT, 1.6);
  fillRR(ctx, 18, -7, 8, 5, 2, '#ffd43b', OUT, 1.2);
  ell(ctx, 3, -13, 8, 6, 'rgba(165,216,255,.85)', OUT, 1.3);
  ell(ctx, 3, -11, 6, 3, '#4dabf7');
  ctx.restore();
}

const CSS = `
.sp-rules{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.sp-col{background:#fff;border-radius:14px;padding:4px 8px;border:3px solid #74c0fc;text-align:center;max-width:132px}
.sp-col.y{border-color:#ffd43b}
.sp-col.g{border-color:#63e6be}
.sp-col b{display:block;font-size:15px}
.sp-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.sp-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.sp-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'splash',
  title: 'Водяная битва',
  icon: '💦',
  css: CSS,
  get howTo() {
    return `Купальская забава: кто кого обрызгает!
      <div class="sp-rules">
        <div class="sp-col y"><b>1 · Выглянул!</b>${pic((c, w, h) => {
          ell(c, w / 2, 36, 15, 15, '#e9c48e', OUT, 1.6);
          ell(c, w / 2 - 5, 33, 2, 2.4, OUT);
          ell(c, w / 2 + 5, 33, 2, 2.4, OUT);
          castle(c, w / 2, h - 4, 0.5);
        })}<small>друг выглянул из-за укрытия</small></div>
        <div class="sp-col"><b>2 · Брызни!</b>${pic((c, w, h) => {
          pistol(c, 24, h - 18, 1);
          for (let i = 0; i < 5; i++) drop(c, 54 + i * 10, h - 30 - i * 6, 3.4);
          c.font = '18px sans-serif';
          c.fillText('👆', w - 30, 24);
        })}<small>нажми на него — пальцем, мышкой или ← ↑ →</small></div>
        <div class="sp-col g"><b>3 · Ой, мокро!</b>${pic((c, w, h) => {
          ell(c, w / 2, h / 2 + 4, 17, 17, '#e9c48e', OUT, 1.6);
          c.lineWidth = 2;
          c.strokeStyle = OUT;
          c.beginPath();
          c.arc(w / 2, h / 2 + 8, 6, 0.1 * Math.PI, 0.9 * Math.PI);
          c.stroke();
          for (let i = 0; i < 6; i++) drop(c, w / 2 + Math.cos(i) * 26, h / 2 - 6 + Math.sin(i * 2) * 14, 3);
        })}<small>чем больше брызг — тем больше звёзд</small></div>
      </div>
      ${SPLASH_TIME} секунд. Не успела — друг обрызгает тебя в ответ, это тоже весело! 💦`;
  },
  start(host) {
    const top = el('div', 'sp-top');
    const tTime = el('div', 'sp-chip'),
      tHits = el('div', 'sp-chip'),
      tSay = el('div', 'sp-chip');
    top.append(tTime, tHits, tSay);
    host.root.append(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = Math.min(1, (host.level || 0) * 0.25);
    const looks = (host.friends || []).map((f) => f.look);
    let t = 0,
      over = false,
      hits = 0,
      pops = 0,
      backs = 0, // сколько раз друзья обрызгали в ответ
      next = 0.9, // когда выглянет следующий
      cool = 0,
      say = '',
      sayT = 0,
      aim = 1, // куда смотрит пистолет (дорожка)
      wet = 0; // капли на экране (друг обрызгал в ответ) 0..1
    // друзья за укрытиями: up — выглядывает (0..1 — как высоко), stay — сколько ещё, look, wet — обрызган (смеётся)
    const lanes = Array.from({ length: LANES }, () => ({ on: false, up: 0, stay: 0, look: null, wet: 0, li: 0 }));
    const streams = []; // струи воды: { lane, t, hit }
    const splats = []; // брызги: { x, y, t }
    let li = 0;
    function shout(text, d = 1) {
      say = text;
      sayT = d;
    }
    const k01 = () => clamp(t / SPLASH_TIME, 0, 1);
    function pop() {
      const free = lanes.map((l, i) => (l.on ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)],
        l = lanes[i];
      l.on = true;
      l.up = 0;
      l.wet = 0;
      l.stay = (STAY[0] + (STAY[1] - STAY[0]) * k01()) * (1 - level * 0.12);
      l.look = looks.length ? looks[li++ % looks.length] : host.look;
      pops++;
    }
    /** Брызнуть в дорожку i. */
    function shoot(i) {
      if (over || cool > 0 || t < 0.3) return;
      aim = i;
      const l = lanes[i],
        hit = l.on && l.up > 0.35 && !l.wet;
      streams.push({ lane: i, t: 0, hit });
      if (hit) {
        hits++;
        l.wet = 0.01;
        l.stay = Math.min(l.stay, 0.55);
        cool = QUICK;
        host.sfx('splash');
        shout(['💦 Ой, мокро!', '💦 Хи-хи!', '💦 Попала!', '💦 Брызь!'][hits % 4], 0.7);
      } else {
        cool = PUMP;
        host.sfx('tap');
        shout('🙂 Мимо! Накачиваем…', 0.6);
      }
    }
    function update(dt) {
      t += dt;
      cool = Math.max(0, cool - dt);
      wet = Math.max(0, wet - dt * 0.6);
      if (sayT > 0) {
        sayT -= dt;
        if (sayT <= 0) say = '';
      }
      if (t >= SPLASH_TIME) {
        over = true;
        const stars = hits >= SPLASH_STARS[1] ? 3 : hits >= SPLASH_STARS[0] ? 2 : 1;
        host.later(
          () =>
            host.finish({
              stars,
              text: `Брызг: <b>${hits}</b>. ${stars === 3 ? 'Самая меткая на всём пляже!' : stars === 2 ? 'Отличная водяная битва!' : 'Было весело — все мокрые и смеются! В следующий раз получится ещё лучше.'}`,
              extra: { hits, pops, backs },
            }),
          500,
        );
        return;
      }
      next -= dt;
      if (next <= 0) {
        pop();
        if (t > 15 && Math.random() < 0.3) pop(); // ближе к концу — иногда двое сразу
        next = GAP[0] + (GAP[1] - GAP[0]) * k01() + Math.random() * 0.3;
      }
      for (const l of lanes) {
        if (!l.on) {
          l.up = Math.max(0, l.up - dt * 5);
          continue;
        }
        if (l.wet) l.wet = Math.min(1, l.wet + dt * 2);
        l.stay -= dt;
        if (l.stay > 0) l.up = Math.min(1, l.up + dt * 6);
        else {
          l.on = false;
          if (!l.wet) {
            // не успела — друг брызгает в ответ (просто весело)
            backs++;
            wet = 1;
            host.sfx('splash');
            shout('😄 Брызь в ответ!', 0.8);
          }
        }
      }
      for (const s of streams) s.t += dt;
      while (streams.length && streams[0].t > 0.5) streams.shift();
      for (const s of splats) s.t += dt;
      while (splats.length && splats[0].t > 0.6) splats.shift();
    }
    /** Где дорожки: x середины, ширина, низ укрытий, масштаб, где стоит хомячок. */
    function layout() {
      const w = cv.w,
        h = cv.h,
        lw = Math.min(w / LANES, 270),
        x0 = w / 2 - lw * (LANES / 2 - 0.5),
        s = clamp(Math.min(lw / 150, h / 560), 0.55, 1.35);
      const tall = h > w * 1.15; // телефон стоя: укрытия выше, хомячок крупнее — без пустого песка посередине
      return {
        w,
        h,
        lw,
        s,
        tall,
        xs: Array.from({ length: LANES }, (_, i) => x0 + i * lw),
        base: h * (tall ? 0.56 : 0.6),
        py: h - (tall ? 24 : 10),
      };
    }
    function draw() {
      const { w, h, lw, s, tall, xs, base, py } = layout();
      // небо, солнце, море, песок
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#74c0fc');
      g.addColorStop(0.3, '#d0ebff');
      g.addColorStop(0.31, '#4dabf7');
      g.addColorStop(0.42, '#99e9f2');
      g.addColorStop(0.43, '#ffe8a3');
      g.addColorStop(1, '#f6d58e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ell(ctx, w * 0.84, h * 0.09, 28, 28, '#ffe066', '#fab005', 2);
      for (let i = 0; i < 2; i++) {
        const cx = ((t * 8 + i * w * 0.55) % (w + 160)) - 80,
          cy = h * (0.08 + i * 0.07);
        ell(ctx, cx, cy, 34, 12, 'rgba(255,255,255,.9)');
        ell(ctx, cx + 18, cy - 8, 20, 12, 'rgba(255,255,255,.9)');
      }
      for (let i = 0; i < 7; i++) {
        const y = h * (0.33 + (i % 3) * 0.03),
          x = ((i * 0.31 + t * 0.02 * (1 + (i % 2))) % 1) * w;
        line(ctx, x, y, x + 26, y, 'rgba(255,255,255,.55)', 2);
      }
      // купальская гирлянда из цветов и зелени поверх неба
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.04);
      ctx.quadraticCurveTo(w / 2, h * 0.16, w, h * 0.04);
      ctx.stroke();
      for (let i = 1; i < 14; i++) {
        const q = i / 14,
          x = q * w,
          y = h * 0.04 + Math.sin(q * Math.PI) * h * 0.06;
        ell(ctx, x, y, 5, 5, ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4], OUT, 1);
        ell(ctx, x, y, 1.8, 1.8, '#ffa94d');
      }
      // друзья за укрытиями и сами укрытия
      xs.forEach((x, i) => {
        const l = lanes[i];
        if (l.up > 0.01 && l.look) {
          const hy = base - COVER_H[i] * s - l.up * 62 * s + 84 * s;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - lw / 2, 0, lw, base - 6 * s);
          ctx.clip();
          host.drawHamster(ctx, x, hy, 0.95 * s, l.look, {
            time: t + i,
            dir: 0,
            happy: l.wet > 0,
            armsUp: l.wet > 0 || l.stay < 0.25,
          });
          if (l.wet > 0)
            for (let k = 0; k < 7; k++)
              drop(
                ctx,
                x + Math.cos(k * 0.9) * 34 * s,
                hy - 60 * s + Math.sin(k * 1.7 + l.wet * 6) * 22 * s - l.wet * 10,
                4 * s,
                1 - l.wet * 0.6,
              );
          ctx.restore();
        }
        COVERS[i](ctx, x, base, s);
      });
      // хомячок с пистолетом внизу, поворачивается к дорожке
      const hx = w / 2 + (xs[aim] - w / 2) * 0.25,
        hs = clamp(s * (tall ? 1.7 : 1.15), 0.7, 1.6);
      host.drawHamster(ctx, hx, py, hs, host.look, {
        time: t,
        dir: aim === 0 ? -1 : aim === 2 ? 1 : 0,
        happy: sayT > 0 && say.startsWith('💦'),
        armsUp: false,
      });
      pistol(ctx, hx + (aim === 0 ? -30 : 24) * hs, py - 22 * hs, hs, aim === 0 ? -1 : 1);
      // струи: капли летят от пистолета к дорожке
      for (const st of streams) {
        const q = clamp(st.t / 0.25, 0, 1),
          tx = xs[st.lane],
          ty = base - COVER_H[st.lane] * s - 30 * s,
          sx = hx + (st.lane === 0 ? -50 : 44) * hs,
          sy = py - 28 * hs;
        for (let k = 0; k < 7; k++) {
          const qq = q - k * 0.07;
          if (qq <= 0) continue;
          const x = sx + (tx - sx) * qq,
            y = sy + (ty - sy) * qq - Math.sin(qq * Math.PI) * 60 * s;
          drop(ctx, x, y, 4.2 * s, 1 - st.t * 1.6);
        }
        if (q >= 1 && !st.hit)
          for (let k = 0; k < 4; k++)
            drop(ctx, tx + (k - 1.5) * 12 * s, ty + 26 * s - st.t * 20, 3 * s, Math.max(0, 1 - st.t * 2));
      }
      // друг обрызгал в ответ: капли по экрану
      if (wet > 0)
        for (let k = 0; k < 16; k++) {
          const x = ((k * 0.377) % 1) * w,
            y = ((k * 0.613) % 1) * h * 0.9 + (1 - wet) * 60;
          drop(ctx, x, y, 7 + (k % 3) * 3, wet * 0.85);
        }
      // подсказка на телефоне: дорожки-кнопки внизу у укрытий
      if (t < 5)
        xs.forEach((x, i) => {
          // нарисованные стрелки (как клавиши ← ↑ →): кружок со стрелкой под укрытием
          const y = base + 36 * s,
            r = 16 * s + 4,
            d = [-1, 0, 1][i];
          ctx.globalAlpha = 0.8 * Math.min(1, (5 - t) / 1.5);
          ell(ctx, x, y, r, r, '#fff', OUT, 2);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(d ? (d > 0 ? 0 : Math.PI) : -Math.PI / 2);
          poly(
            ctx,
            [
              -r * 0.5,
              -r * 0.18,
              r * 0.05,
              -r * 0.18,
              r * 0.05,
              -r * 0.45,
              r * 0.55,
              0,
              r * 0.05,
              r * 0.45,
              r * 0.05,
              r * 0.18,
              -r * 0.5,
              r * 0.18,
            ],
            '#4dabf7',
            OUT,
            1.4,
          );
          ctx.restore();
          ctx.globalAlpha = 1;
        });
    }
    function chips() {
      tTime.textContent = `⏱ ${Math.max(0, Math.ceil(SPLASH_TIME - t))}`;
      tHits.textContent = `💦 ${hits}`;
      tSay.textContent = say || (t < 1 ? 'Приготовились!' : '👀 Кто выглянет?');
    }

    host.loop((dt) => {
      if (!over) update(dt);
      draw();
      chips();
    });

    const pd = (e) => {
      e.preventDefault();
      const r = cv.canvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        { xs, lw } = layout();
      let best = 0;
      xs.forEach((cx, i) => {
        if (Math.abs(x - cx) < Math.abs(x - xs[best])) best = i;
      });
      if (Math.abs(x - xs[best]) < lw) shoot(best);
    };
    host.on(cv.canvas, 'pointerdown', pd);
    const KEYS = {
      ArrowLeft: 0,
      KeyA: 0,
      Digit1: 0,
      ArrowUp: 1,
      ArrowDown: 1,
      KeyW: 1,
      KeyS: 1,
      Space: 1,
      Digit2: 1,
      ArrowRight: 2,
      KeyD: 2,
      Digit3: 2,
    };
    const key = (e) => {
      if (e.code in KEYS) {
        e.preventDefault();
        shoot(KEYS[e.code]);
      }
    };
    host.on(window, 'keydown', key);
    // для автотеста: что сейчас в игре (up — кто выглянул и в него можно брызнуть)
    if (DEV)
      cv.canvas.__splash = () => ({
        t,
        over,
        hits,
        pops,
        backs,
        cool,
        up: lanes.map((l) => l.on && l.up > 0.35 && !l.wet),
      });
    cv.canvas.classList.add('sp-canvas');
  },
};

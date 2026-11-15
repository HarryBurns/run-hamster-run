// Мини-игра «Спуск на санках» (гора, П.9; запускает инструктор Вершинкин — features/mountain.js).
// Вид сверху: санки с хомячком несутся вниз по склону (склон бежит навстречу). Рули влево-вправо — пальцем или
// мышью (санки едут туда, где палец), или стрелками ← →. Собирай снежинки и флажки, объезжай ёлки и камни.
// Проигрыша нет: врезалась — кувырок в сугроб, санки на миг притормозят и поедут дальше. 45 секунд; звёзды — по тому,
// сколько собрано. Награду (монеты) даёт занятие по звёздам.
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';

const TIME = 45;
const OUT = '#4a3728';
// что лежит на склоне: good — собрать, r — радиус попадания (доля ширины санок)
const KINDS = {
  flake: { good: true, pts: 1, r: 18 },
  flag: { good: true, pts: 2, r: 20 },
  fir: { good: false, r: 22 },
  rock: { good: false, r: 20 },
};
/** Сколько собрать на 2★ и 3★. */
export const SLED_STARS = [18, 32];

/** Ёлка в снегу: (x, y) — низ ствола, s — масштаб. */
function drawFir(ctx, x, y, s) {
  ell(ctx, x + 4 * s, y + 2 * s, 20 * s, 6 * s, 'rgba(70,90,140,.18)');
  ctx.fillStyle = '#8d5524';
  ctx.fillRect(x - 3 * s, y - 10 * s, 6 * s, 12 * s);
  for (let i = 0; i < 3; i++) {
    const w = (22 - i * 5) * s,
      by = y - 8 * s - i * 14 * s;
    poly(ctx, [x - w, by, x, by - 22 * s, x + w, by], '#2b8a3e', OUT, 1.8);
    poly(ctx, [x - w * 0.55, by - 9 * s, x, by - 22 * s, x + w * 0.5, by - 10 * s], '#ffffff');
  }
}
/** Камень в снегу. */
function drawRock(ctx, x, y, s) {
  ell(ctx, x + 3 * s, y + 3 * s, 20 * s, 6 * s, 'rgba(70,90,140,.18)');
  poly(ctx, [x - 18 * s, y + 2 * s, x - 14 * s, y - 12 * s, x - 2 * s, y - 20 * s, x + 14 * s, y - 14 * s, x + 18 * s, y + 2 * s], '#adb5bd', OUT, 2);
  poly(ctx, [x + 2 * s, y - 19 * s, x + 14 * s, y - 14 * s, x + 18 * s, y + 2 * s, x + 4 * s, y + 2 * s], '#868e96');
  ell(ctx, x - 4 * s, y - 17 * s, 10 * s, 3.5 * s, '#ffffff');
}
/** Флажок (собрать). */
function drawFlag(ctx, x, y, s, t) {
  line(ctx, x, y + 2 * s, x, y - 34 * s, OUT, 3 * s);
  const w = Math.sin(t * 8 + x) * 2 * s;
  poly(ctx, [x + 1, y - 34 * s, x + 20 * s, y - 28 * s + w, x + 1, y - 21 * s], '#ff6b9d', OUT, 1.6);
  ell(ctx, x, y + 2 * s, 5 * s, 2 * s, 'rgba(70,90,140,.25)');
}
/** Снежинка (собрать): шесть лучиков с бликом. */
function drawFlake(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y - 12 * s);
  ctx.rotate(t * 1.5);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    line(ctx, 0, 0, 0, -12 * s, '#4dabf7', 4 * s);
    line(ctx, 0, 0, 0, -12 * s, '#e7f5ff', 2 * s);
    line(ctx, 0, -7 * s, 4 * s, -10 * s, '#4dabf7', 2 * s);
  }
  ell(ctx, 0, 0, 3.5 * s, 3.5 * s, '#ffffff', '#4dabf7', 1.2);
  ctx.restore();
}
/** Санки (вид сверху-сзади): деревянные дощечки на полозьях. */
function drawSled(ctx, x, y, s) {
  ell(ctx, x + 3 * s, y + 6 * s, 30 * s, 9 * s, 'rgba(70,90,140,.22)');
  for (const dx of [-16, 16]) {
    line(ctx, x + dx * s, y - 30 * s, x + dx * s, y + 6 * s, OUT, 5 * s);
    line(ctx, x + dx * s, y - 30 * s, x + dx * s, y + 6 * s, '#adb5bd', 2.6 * s);
  }
  fillRR(ctx, x - 22 * s, y - 26 * s, 44 * s, 30 * s, 6 * s, '#e8590c', OUT, 2);
  for (let i = 1; i < 4; i++) line(ctx, x - 20 * s, y - 26 * s + i * 7.5 * s, x + 20 * s, y - 26 * s + i * 7.5 * s, 'rgba(74,55,40,.35)', 1.2);
  // загнутый нос полозьев
  for (const dx of [-16, 16]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + 9 * s, 4 * s, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3 * s;
    ctx.stroke();
  }
}

/** Маленькая картинка для правил (data: URL — заставка правил собирается строкой HTML). */
function pic(draw, size = 46) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.lineJoin = 'round';
  draw(x, size / 2, size - 8, size / 50);
  return `<img src="${c.toDataURL()}" width="${size}" height="${size}" alt="">`;
}

const CSS = `
.sl-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.sl-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #8ce99a;text-align:center}
.sl-col.no{border-color:#ffa8a8}
.sl-col.how{border-color:#74c0fc}
.sl-col b{display:block;font-size:16px}
.sl-col .row{display:flex;gap:4px;justify-content:center;align-items:center;font-size:26px;font-weight:900}
.sl-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.sl-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.sl-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'sled',
  title: 'Спуск на санках',
  icon: '🛷',
  get howTo() {
    return `<style>${CSS}</style>Санки несутся с горы! <b>Рули влево и вправо</b> — пальцем, мышкой или стрелками.
      <div class="sl-rules">
        <div class="sl-col how"><b>🛷 Рули</b><div class="row">◀ ${pic((c, x, y, s) => drawSled(c, x, y - 4, s * 0.9))} ▶</div><small>пальцем, мышкой<br>или стрелками ← →</small></div>
        <div class="sl-col"><b>✅ Собирай</b><div class="row">${pic((c, x, y, s) => drawFlake(c, x, y - 6, s * 1.4, 0))}${pic((c, x, y, s) => drawFlag(c, x - 6, y, s * 1.1, 0))}</div><small>снежинки и флажки<br>(флажок — за два!)</small></div>
        <div class="sl-col no"><b>⛔ Объезжай</b><div class="row">${pic((c, x, y, s) => drawFir(c, x, y, s * 0.85))}${pic((c, x, y, s) => drawRock(c, x, y - 4, s * 1.1))}</div><small>ёлки и камни —<br>врежешься — кувырок!</small></div>
      </div>
      За ${TIME} секунд собери побольше!`;
  },
  start(host) {
    const root = host.root;
    const style = el('style', '', CSS);
    const top = el('div', 'sl-top');
    const tTime = el('div', 'sl-chip'),
      tGot = el('div', 'sl-chip'),
      tBump = el('div', 'sl-chip');
    top.append(tTime, tGot, tBump);
    root.append(style, top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    let t = 0,
      last = performance.now(),
      raf = 0,
      stopped = false,
      over = false,
      got = 0,
      bumps = 0,
      dist = 0,
      spawnGood = 0.3,
      spawnBad = 1.2,
      tumble = 0, // > 0 — кувыркаемся (секунды)
      slow = 1; // множитель скорости после кувырка (поднимается обратно до 1)
    const items = []; // { kind, x (0..1), y (px), hit }
    const pops = [];
    const puffs = []; // снежная пыль
    const sled = { x: 0.5, to: 0.5 };
    // трасса — полоса посередине (на широком экране по бокам — ельник): LW — её ширина, X0 — левый край
    const LW = () => Math.min(cv.w, Math.max(320, cv.h * 0.85), 640),
      X0 = () => (cv.w - LW()) / 2,
      PX = (fx) => X0() + fx * LW(); // доля ширины трассы → пиксели
    const S = () => clamp(LW() / 400, 0.85, 1.45); // масштаб рисунков
    const sledY = () => cv.h * 0.72;
    const speed = () => cv.h * (0.42 + Math.min(t / TIME, 1) * 0.28 + level * 0.02) * slow; // px/с

    // ---------- управление ----------
    const toX = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      sled.to = clamp((((e.clientX - r.left) / r.width) * cv.w - X0()) / LW(), 0.08, 0.92);
    };
    let pressed = false;
    const down = (e) => {
      pressed = true;
      toX(e);
    };
    const move = (e) => {
      if (pressed || e.pointerType === 'mouse') toX(e);
    };
    const up = () => (pressed = false);
    cv.canvas.addEventListener('pointerdown', down);
    cv.canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    const keys = new Set();
    const kd = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        keys.add(e.code);
        e.preventDefault();
      }
    };
    const ku = (e) => keys.delete(e.code);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    // для автотеста (dev/smoke_mountain.js): где санки и что впереди (x — доля ширины, y — пиксели)
    cv.canvas.__sled = () => ({
      x: sled.x,
      y: sledY(),
      w: cv.w,
      x0: X0(),
      lw: LW(),
      items: items.filter((q) => !q.hit).map((q) => ({ good: KINDS[q.kind].good, x: q.x, y: q.y })),
    });

    function spawn(good) {
      const list = good ? (Math.random() < 0.3 ? 'flag' : 'flake') : Math.random() < 0.6 ? 'fir' : 'rock';
      let x = 0.1 + Math.random() * 0.8;
      // хорошее не кладём прямо на плохое
      for (let k = 0; k < 4 && items.some((q) => q.y < 60 && Math.abs(q.x - x) < 0.12); k++) x = 0.1 + Math.random() * 0.8;
      items.push({ kind: list, x, y: -40, hit: false });
    }

    function update(dt) {
      t += dt;
      // руль: стрелки двигают цель, санки плавно едут к ней
      const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (kx) sled.to = clamp(sled.to + kx * dt * 0.9, 0.08, 0.92);
      if (tumble <= 0) sled.x += (sled.to - sled.x) * Math.min(1, dt * 7);
      const v = speed();
      dist += v * dt;
      if (tumble > 0) tumble -= dt;
      slow = Math.min(1, slow + dt * 0.5);
      spawnGood -= dt;
      spawnBad -= dt;
      if (spawnGood <= 0) {
        spawn(true);
        spawnGood = 0.62 + Math.random() * 0.3;
      }
      if (spawnBad <= 0) {
        spawn(false);
        spawnBad = clamp(1.25 - t / 60 - level * 0.05, 0.6, 1.3) + Math.random() * 0.35;
      }
      const sy = sledY(),
        s = S();
      for (const q of items) {
        q.y += v * dt;
        if (q.hit || tumble > 0) continue;
        const dx = (q.x - sled.x) * LW(),
          dy = q.y - (sy - 12 * s),
          r = (KINDS[q.kind].r + 16) * s;
        if (dx * dx + dy * dy > r * r) continue;
        q.hit = true;
        if (KINDS[q.kind].good) {
          got += KINDS[q.kind].pts;
          host.sfx('pop');
          pops.push({ text: '+' + KINDS[q.kind].pts, col: '#1c7ed6', x: PX(q.x), y: q.y - 30, t: 0 });
        } else {
          bumps++;
          tumble = 0.9;
          slow = 0.35;
          host.sfx('bad');
          pops.push({ text: 'Ой! Кувырок!', col: '#e03131', x: PX(sled.x), y: sy - 70 * s, t: 0 });
          for (let i = 0; i < 10; i++)
            puffs.push({ x: PX(sled.x), y: sy - 10, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 140, t: 0 });
        }
      }
      for (let i = items.length - 1; i >= 0; i--) if (items[i].y > cv.h + 60) items.splice(i, 1);
      for (const p of pops) p.t += dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1) pops.splice(i, 1);
      for (const p of puffs) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
      }
      for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t > 0.8) puffs.splice(i, 1);
      if (t >= TIME) finish();
    }

    function draw() {
      const W = cv.w,
        H = cv.h,
        s = S();
      // склон: снег, тени-волны и следы, бегут навстречу
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#e7f1fa');
      g.addColorStop(1, '#fbfdff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(160,195,225,.35)';
      for (let i = 0; i < 9; i++) {
        const y = ((i * 97 + dist * 0.6) % (H + 80)) - 40;
        ell(ctx, ((i * 173) % W) + 20, y, 46, 9, 'rgba(160,195,225,.3)');
      }
      // колеи санок позади
      ctx.strokeStyle = 'rgba(140,180,215,.5)';
      ctx.lineWidth = 3;
      for (const dx of [-16, 16]) {
        ctx.beginPath();
        ctx.moveTo(PX(sled.x) + dx * s, sledY());
        ctx.lineTo(PX(sled.to * 0.3 + sled.x * 0.7) + dx * s, H + 10);
        ctx.stroke();
      }
      // ельник по краям трассы (на широком экране — гуще, во всю ширину обочины)
      const x0 = X0(),
        lw = LW();
      for (let side = 0; side < 2; side++) {
        const cols = Math.max(1, Math.ceil(x0 / (34 * s)));
        for (let c = 0; c < cols; c++)
          for (let i = 0; i < 8; i++) {
            const y = ((i * (H / 7) + dist + c * 37 + side * 40) % (H + 120)) - 60,
              off = 14 + c * 34 * s + ((i + c) % 2) * 10;
            drawFir(ctx, side ? x0 + lw + off - 14 : x0 - off + 14, y, s * 0.9);
          }
      }
      // всё на склоне — от дальнего к ближнему
      for (const q of items) {
        if (q.hit && KINDS[q.kind].good) continue;
        const x = PX(q.x);
        ctx.globalAlpha = q.hit ? 0.5 : 1;
        if (q.kind === 'fir') drawFir(ctx, x, q.y, s);
        else if (q.kind === 'rock') drawRock(ctx, x, q.y, s);
        else if (q.kind === 'flag') drawFlag(ctx, x, q.y, s, t);
        else drawFlake(ctx, x, q.y, s, t);
        ctx.globalAlpha = 1;
      }
      // санки с хомячком (кувырок — крутится)
      const x = PX(sled.x),
        y = sledY();
      ctx.save();
      ctx.translate(x, y);
      if (tumble > 0) ctx.rotate((0.9 - tumble) * Math.PI * 2.2);
      else ctx.rotate((sled.to - sled.x) * 0.9);
      drawSled(ctx, 0, 0, s);
      host.drawHamster(ctx, 0, -6 * s, 0.72 * s, host.look, {
        time: t,
        clipBelow: -20,
        happy: tumble <= 0,
        blink: t % 3.1 < 0.12,
      });
      ctx.restore();
      // снежная пыль
      for (const p of puffs) {
        ctx.globalAlpha = 1 - p.t / 0.8;
        ell(ctx, p.x, p.y, 7, 6, '#ffffff', 'rgba(140,180,215,.8)', 1.2);
      }
      ctx.globalAlpha = 1;
      // надписи
      ctx.textAlign = 'center';
      ctx.font = '900 20px ui-rounded, "Trebuchet MS", sans-serif';
      for (const p of pops) {
        ctx.globalAlpha = Math.max(0, 1 - p.t);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(p.text, p.x, p.y - p.t * 30);
        ctx.fillStyle = p.col;
        ctx.fillText(p.text, p.x, p.y - p.t * 30);
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!over) update(dt);
      tTime.textContent = `⏱️ ${Math.max(0, Math.ceil(TIME - t))}`;
      tGot.textContent = `❄️ ${got}`;
      tBump.textContent = `💥 ${bumps}`;
      draw();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      over = true;
      const stars = got >= SLED_STARS[1] ? 3 : got >= SLED_STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `На счету ${got} ❄️ — снежинки и флажки${bumps ? `, кувырков — ${bumps}.` : ', и ни одного кувырка!'}${stars === 3 ? ' Настоящий чемпион трассы!' : ''}`,
        extra: { got, bumps },
      });
    }
    raf = requestAnimationFrame(frame);
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        cv.canvas.removeEventListener('pointerdown', down);
        cv.canvas.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        if (cv.destroy) cv.destroy();
        style.remove();
        top.remove();
      },
    };
  },
};

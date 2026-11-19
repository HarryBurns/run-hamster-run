// Мини-игра «Кокосовый боулинг» (удалённый остров, П.9; запускает Вождь Кокос и дорожка у тотемов — features/island.js).
// Катишь кокос по дорожке в шесть кеглей-тотемчиков. Два нажатия: первое — когда качающаяся стрелка смотрит
// на кегли (направление), второе — когда полоска силы почти полная (сила). Или одним жестом: проведи пальцем
// (мышкой) от кокоса вверх — куда и как сильно, так и покатится. Три раунда, в каждом — два кокоса: первым сбить
// сколько получится, вторым — то, что осталось. Сбила все шесть первым кокосом — «Страйк!». Слабый бросок — кокос
// просто не докатился («Чуть-чуть!»), от бортиков он мягко отскакивает. Проигрыша нет: звёзды — по сбитым кеглям.
// Монеты по звёздам выдаёт занятие (features/island.js).
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';
import { pic as kitPic } from './kit.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
const ROUNDS = 3,
  THROWS = 2;
/** Сколько сбитых кеглей (из 18) на 2★ и 3★. */
export const BOWL_STARS = [11, 16];
// мир игры — 360 × 560 единиц: дорожка снизу вверх
const LW = 360,
  LH = 560,
  LX0 = 96,
  LX1 = 264,
  BALL = { x: 180, y: 486, r: 15 },
  PIN_R = 11,
  PINS = [
    [180, 172],
    [164, 142],
    [196, 142],
    [148, 112],
    [180, 112],
    [212, 112],
  ];

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 110, h = 70) => kitPic(draw, w, h, { cap: true });
function coconut(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ell(ctx, 0, 0, r, r, '#8d5524', OUT, 1.8);
  ell(ctx, -r * 0.35, -r * 0.35, r * 0.35, r * 0.25, 'rgba(255,220,170,.45)');
  for (const [px, py] of [
    [-r * 0.25, -r * 0.05],
    [r * 0.2, -r * 0.1],
    [0, r * 0.3],
  ])
    ell(ctx, px, py, r * 0.12, r * 0.12, '#3b2412');
  ctx.restore();
}
/** Кегля-тотемчик (стоит или лежит: fall 0..1). */
function pin(ctx, x, y, s = 1, fall = 0, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot * fall);
  ctx.globalAlpha = 1 - fall * 0.35;
  ell(ctx, 3, 4, 10 * s, 4 * s, 'rgba(52,38,70,.2)');
  fillRR(ctx, -7 * s, -26 * s, 14 * s, 28 * s, 5 * s, '#c98b5a', OUT, 1.6);
  ell(ctx, -3 * s, -18 * s, 2 * s, 2 * s, '#fff');
  ell(ctx, 3 * s, -18 * s, 2 * s, 2 * s, '#fff');
  line(ctx, -3 * s, -10 * s, 3 * s, -10 * s, OUT, 1.4);
  ell(ctx, 0, -28 * s, 6 * s, 3.5 * s, '#ff922b', OUT, 1.2);
  ctx.restore();
}
function arrow(ctx, x, y, a, len, col) {
  const ex = x + Math.sin(a) * len,
    ey = y - Math.cos(a) * len;
  line(ctx, x, y, ex, ey, OUT, 8);
  line(ctx, x, y, ex, ey, col, 5);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  poly(ctx, [0, -14, -10, 4, 10, 4], col, OUT, 1.8);
  ctx.restore();
}

const CSS = `
.bw-rules{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.bw-col{background:#fff;border-radius:14px;padding:4px 8px;border:3px solid #8ce99a;text-align:center;max-width:132px}
.bw-col.gold{border-color:#ffd43b}
.bw-col.blue{border-color:#74c0fc}
.bw-col b{display:block;font-size:15px}
.bw-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.bw-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.bw-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'bowling',
  title: 'Кокосовый боулинг',
  icon: '🥥',
  css: CSS,
  get howTo() {
    return `Скати кокос по дорожке и сбей кегли-тотемчики!
      <div class="bw-rules">
        <div class="bw-col"><b>1 · Куда</b>${pic((c, w, h) => {
          pin(c, w / 2, 22, 0.7);
          coconut(c, w / 2, 58, 8);
          arrow(c, w / 2, 50, 0.12, 22, '#69db7c');
        })}<small>нажми, когда стрелка смотрит на кегли</small></div>
        <div class="bw-col gold"><b>2 · Сила</b>${pic((c, w, h) => {
          fillRR(c, 20, 26, 70, 16, 8, '#fff', OUT, 1.8);
          fillRR(c, 22, 28, 58, 12, 6, '#ff922b');
          c.font = '20px sans-serif';
          c.fillText('💪', 46, 64);
        })}<small>нажми, когда полоска почти полная</small></div>
        <div class="bw-col blue"><b>или жестом</b>${pic((c, w, h) => {
          coconut(c, w / 2, 58, 8);
          c.setLineDash([4, 4]);
          line(c, w / 2, 48, w / 2 + 8, 12, '#4dabf7', 3);
          c.setLineDash([]);
          c.font = '18px sans-serif';
          c.fillText('👆', w / 2 + 12, 30);
        })}<small>проведи пальцем от кокоса вверх</small></div>
      </div>
      ${ROUNDS} раунда, в каждом — ${THROWS} кокоса. Пробел или Enter — тоже нажатие. Сбей все шесть — «Страйк!» 🗿`;
  },
  start(host) {
    const top = el('div', 'bw-top');
    const tRound = el('div', 'bw-chip'),
      tPins = el('div', 'bw-chip'),
      tSay = el('div', 'bw-chip');
    top.append(tRound, tPins, tSay);
    host.root.append(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    let t = 0,
      over = false,
      phase = 'aim', // aim → power → roll → (wait) → aim …
      round = 0,
      throwN = 0,
      score = 0,
      strikes = 0,
      angle = 0,
      power = 0,
      phaseT = 0,
      waitT = 0,
      say = '',
      sayT = 0;
    const ball = { x: BALL.x, y: BALL.y, vx: 0, vy: 0, rot: 0 };
    let pins = [];
    const resetPins = () =>
      (pins = PINS.map(([x, y]) => ({ x, y, down: false, fall: 0, vx: 0, vy: 0, rot: 0, move: 0 })));
    resetPins();
    const standing = () => pins.filter((p) => !p.down).length;
    let downBefore = 0;
    const K = () => Math.min(cv.w / LW, (cv.h - 40) / LH);
    const OX = () => (cv.w - LW * K()) / 2;
    const OY = () => Math.max(40, (cv.h - LH * K()) / 2 + 16);
    const toGame = (sx, sy) => ({ x: (sx - OX()) / K(), y: (sy - OY()) / K() });

    function chips() {
      tRound.textContent = `Раунд ${Math.min(round + 1, ROUNDS)}/${ROUNDS} · 🥥 ${Math.min(throwN + 1, THROWS)}/${THROWS}`;
      tPins.textContent = `🗿 ${score}`;
      tSay.textContent = say || (phase === 'aim' ? '👉 Куда?' : phase === 'power' ? '💪 Сила!' : '🥥 Катится…');
    }
    function shout(text) {
      say = text;
      sayT = 1.6;
    }
    function roll(a, p) {
      if (over || (phase !== 'aim' && phase !== 'power')) return;
      const sp = 240 + clamp(p, 0, 1) * 560;
      ball.x = BALL.x;
      ball.y = BALL.y;
      ball.vx = Math.sin(a) * sp;
      ball.vy = -Math.cos(a) * sp;
      downBefore = 6 - standing();
      phase = 'roll';
      phaseT = 0;
      host.sfx('wheel');
    }
    function tap() {
      if (over) return;
      if (phase === 'aim') {
        phase = 'power';
        phaseT = 0;
        host.sfx('tap');
      } else if (phase === 'power') roll(angle, power);
    }
    function knock(p, dx, dy, sp) {
      if (p.down) return;
      const d = Math.hypot(dx, dy) || 1;
      p.down = true;
      p.vx = (dx / d) * sp;
      p.vy = (dy / d) * sp;
      p.rot = dx >= 0 ? 1.4 : -1.4;
      p.move = 0.4;
      host.sfx('thud');
    }
    function endThrow() {
      const now = 6 - standing(),
        got = now - downBefore;
      score += got;
      if (now === 6 && throwN === 0) {
        strikes++;
        shout('🎉 Страйк!');
        host.sfx('win');
      } else if (now === 6) shout('✨ Все сбиты!');
      else if (got === 0) shout(ball.y > 200 ? '🙂 Чуть-чуть не докатился!' : '🙂 Мимо! Ещё попытка');
      else shout(`🗿 +${got}`);
      throwN++;
      if (now === 6 || throwN >= THROWS) {
        round++;
        throwN = 0;
        if (round >= ROUNDS) {
          finish();
          return;
        }
        resetPins();
      }
      ball.x = BALL.x;
      ball.y = BALL.y;
      ball.vx = ball.vy = 0;
      phase = 'aim';
      phaseT = 0;
    }
    function finish() {
      over = true;
      phase = 'done';
      const stars = score >= BOWL_STARS[1] || strikes >= 2 ? 3 : score >= BOWL_STARS[0] ? 2 : 1;
      host.later(
        () =>
          host.finish({
            stars,
            text: `Сбито кеглей: <b>${score}</b> из ${ROUNDS * 6}${strikes ? ` · страйков: <b>${strikes}</b>` : ''}. ${stars === 3 ? 'Настоящая чемпионка острова!' : stars === 2 ? 'Отличная игра!' : 'Хорошая игра — в следующий раз будет ещё больше!'}`,
            extra: { score, strikes },
          }),
        700,
      );
    }

    function update(dt) {
      t += dt;
      phaseT += dt;
      if (sayT > 0) {
        sayT -= dt;
        if (sayT <= 0) say = '';
      }
      if (phase === 'aim') angle = 0.42 * Math.sin(phaseT * 1.7);
      else if (phase === 'power') power = 0.5 - 0.5 * Math.cos(phaseT * 3.4);
      for (const p of pins) {
        if (!p.down) continue;
        p.fall = Math.min(1, p.fall + dt * 3);
        if (p.move > 0) {
          p.move -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          // падающая кегля сбивает соседей
          for (const q of pins)
            if (!q.down && Math.hypot(q.x - p.x, q.y - p.y) < PIN_R * 2)
              knock(q, q.x - p.x + p.vx * 0.02, q.y - p.y + p.vy * 0.02, Math.hypot(p.vx, p.vy) * 0.8);
        }
      }
      if (phase === 'roll') {
        const sp = Math.hypot(ball.vx, ball.vy);
        const dec = Math.max(0, sp - 240 * dt) / (sp || 1);
        ball.vx *= dec;
        ball.vy *= dec;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.rot += (sp / BALL.r) * dt;
        // мягкий отскок от бортиков
        if (ball.x < LX0 + BALL.r && ball.vx < 0) ((ball.x = LX0 + BALL.r), (ball.vx = -ball.vx * 0.6));
        if (ball.x > LX1 - BALL.r && ball.vx > 0) ((ball.x = LX1 - BALL.r), (ball.vx = -ball.vx * 0.6));
        for (const p of pins)
          if (!p.down && Math.hypot(p.x - ball.x, p.y - ball.y) < BALL.r + PIN_R) {
            knock(p, p.x - ball.x + ball.vx * 0.03, p.y - ball.y + ball.vy * 0.03, Math.max(260, sp * 0.7));
            ball.vx *= 0.88;
            ball.vy *= 0.88;
          }
        if (Math.hypot(ball.vx, ball.vy) < 18 || ball.y < 40) {
          phase = 'wait';
          waitT = 0.7;
        }
      } else if (phase === 'wait') {
        waitT -= dt;
        if (waitT <= 0 && !pins.some((p) => p.move > 0)) endThrow();
      }
    }

    function drawScene() {
      const k = K(),
        ox = OX(),
        oy = OY(),
        w = cv.w,
        h = cv.h;
      // пляж и трава вокруг
      ctx.fillStyle = '#f3e2b5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#86c95a';
      ctx.fillRect(0, 0, w, oy + 60 * k);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // пальмы по бокам
      for (const [x, y, s] of [
        [40, 120, 1],
        [322, 200, 0.9],
        [30, 380, 0.85],
        [330, 450, 1],
      ]) {
        line(ctx, x, y + 40 * s, x + 8 * s, y - 20 * s, OUT, 7 * s);
        line(ctx, x, y + 40 * s, x + 8 * s, y - 20 * s, '#a8703f', 4.4 * s);
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.62 + Math.sin(t + x) * 0.04;
          ell(
            ctx,
            x + 8 * s + Math.cos(a) * 20 * s,
            y - 20 * s + Math.sin(a) * 9 * s + 4,
            22 * s,
            6 * s,
            i % 2 ? '#40c057' : '#2f9e44',
            OUT,
            1.2,
            a,
          );
        }
      }
      // дорожка
      fillRR(ctx, LX0 - 10, 50, LX1 - LX0 + 20, LH - 40, 12, '#a0662d', OUT, 2.4);
      fillRR(ctx, LX0, 56, LX1 - LX0, LH - 52, 8, '#f6e6bd', null);
      for (let y = 70; y < LH; y += 26) line(ctx, LX0 + 4, y, LX1 - 4, y + 2, 'rgba(160,110,50,.16)', 1.2);
      for (let i = 0; i < 5; i++)
        poly(ctx, [140 + i * 20, 330, 134 + i * 20, 344, 146 + i * 20, 344], 'rgba(224,49,49,.35)');
      line(ctx, LX0 + 4, 440, LX1 - 4, 440, 'rgba(224,49,49,.55)', 3);
      // тотем у кеглей
      fillRR(ctx, 168, 44, 24, 30, 6, '#8d6e63', OUT, 1.6);
      ell(ctx, 175, 56, 2.5, 2.5, '#fff');
      ell(ctx, 185, 56, 2.5, 2.5, '#fff');
      // кегли: сначала лежащие, потом стоящие (дальние раньше)
      const order = pins.slice().sort((a, b) => (a.down !== b.down ? (a.down ? -1 : 1) : a.y - b.y));
      for (const p of order) pin(ctx, p.x, p.y, 1, p.fall, p.rot);
      // прицел
      if (phase === 'aim' || phase === 'power') {
        ctx.setLineDash([6, 8]);
        line(
          ctx,
          BALL.x,
          BALL.y - 20,
          BALL.x + Math.sin(angle) * 300,
          BALL.y - 20 - Math.cos(angle) * 300,
          'rgba(74,55,40,.25)',
          2,
        );
        ctx.setLineDash([]);
        arrow(ctx, BALL.x, BALL.y - 18, angle, 64, phase === 'aim' ? '#69db7c' : '#adb5bd');
      }
      coconut(ctx, ball.x, ball.y, BALL.r, ball.rot);
      // хомячок у начала дорожки
      host.drawHamster(ctx, 236, 540, 0.85, host.look, {
        time: t,
        dir: -1,
        happy: phase === 'roll' && ball.y < 300,
        armsUp: phase === 'roll',
      });
      ctx.restore();
      // полоска силы
      if (phase === 'power') {
        const bw = Math.min(260, w - 40),
          bx = (w - bw) / 2,
          by = h - 46;
        fillRR(ctx, bx, by, bw, 24, 12, '#fff', OUT, 2);
        fillRR(ctx, bx + 3, by + 3, Math.max(8, (bw - 6) * power), 18, 9, power > 0.75 ? '#ff922b' : '#ffd43b');
        ctx.font = '900 14px ui-rounded, "Trebuchet MS", sans-serif';
        ctx.fillStyle = OUT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💪 Сила', w / 2, by - 12);
      }
    }

    host.loop((dt) => {
      if (!over) update(dt);
      else for (const p of pins) p.fall = Math.min(1, p.fall + dt * 3);
      drawScene();
      chips();
    });

    // ввод: нажатие — шаг прицела; жест вверх от кокоса — сразу бросок
    let down = null;
    const pd = (e) => {
      e.preventDefault();
      down = { x: e.clientX, y: e.clientY };
      try {
        cv.canvas.setPointerCapture(e.pointerId);
      } catch (er) {
        /* нет захвата — не страшно */
      }
    };
    const pu = (e) => {
      if (!down) return;
      const r = cv.canvas.getBoundingClientRect(),
        a = toGame(down.x - r.left, down.y - r.top),
        b = toGame(e.clientX - r.left, e.clientY - r.top),
        dx = b.x - a.x,
        dy = b.y - a.y;
      down = null;
      if (-dy > 30 && Math.hypot(dx, dy) > 34 && (phase === 'aim' || phase === 'power')) {
        roll(clamp(Math.atan2(dx, -dy), -0.6, 0.6), clamp(Math.hypot(dx, dy) / 240, 0.15, 1));
        return;
      }
      tap();
    };
    host.on(cv.canvas, 'pointerdown', pd);
    host.on(cv.canvas, 'pointerup', pu);
    const key = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        tap();
      }
    };
    host.on(window, 'keydown', key);
    // для автотеста: что сейчас в игре
    if (DEV)
      cv.canvas.__bowling = () => ({
        phase,
        round,
        throwN,
        score,
        strikes,
        angle,
        power,
        standing: standing(),
        over,
        ball: { x: ball.x, y: ball.y },
      });
    cv.canvas.classList.add('bw-canvas');
  },
};

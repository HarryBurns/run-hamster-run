// Мини-игра «Танец у костра» (удалённый остров, О8; запускает костёр на празднике огней — features/island.js).
// Слева у костра барабанщик Бум стучит в большой барабан — ровно, на каждый счёт. По дорожке внизу к кругу у барабана
// подлетают кокосы-«шаги»: нажми (палец, мышь, пробел, Enter, стрелки), когда кокос в круге, — хомячок делает
// танцевальное движение, островитяне хлопают. Точно в круг — «Отлично!» (2 очка), почти — «Хорошо!» (1), не успела —
// кокос улетает дальше, без наказания; лишние нажатия не считаются ошибкой. Песня — SONG тактов (около 30 секунд).
// Звёзды — по доле очков (STARS). Наклейку и шаг задания Вождя даёт занятие.
import { el, clamp, TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { pic as kitPic } from './kit.js';

const OUT = '#4a3728';
/** Такты песни: восьмые доли (1 — кокос-«шаг»). */
const BARS = {
  A: [1, 0, 1, 0, 1, 0, 1, 0],
  B: [1, 0, 1, 0, 1, 1, 1, 0],
  C: [1, 0, 0, 1, 1, 0, 1, 0],
  D: [1, 1, 1, 0, 1, 0, 1, 0],
  E: [1, 0, 1, 1, 0, 1, 1, 0],
};
export const SONG = 'AABACBDBCEDA';
/** Темп (ударов в минуту) — на старших уровнях чуть быстрее. */
const BPM = 92;
/** Сколько секунд кокос летит по дорожке; окна попадания (секунды от удара): «Отлично!» и «Хорошо!». */
const TRAVEL = 2.2,
  PERFECT = 0.09,
  GOOD = 0.18;
/** Доля очков на ⭐⭐ и ⭐⭐⭐. */
export const STARS = [0.4, 0.7];

const CSS = `
.dr-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.dr-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #ffa94d;text-align:center;max-width:150px}
.dr-col.ok{border-color:#8ce99a}
.dr-col b{display:block;font-size:15px}
.dr-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.dr-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.dr-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;
/** Кокос-«шаг» на дорожке. */
function coco(ctx, x, y, r, gold) {
  ell(ctx, x, y, r, r, gold ? '#ffd43b' : '#8d5524', OUT, 2);
  ell(ctx, x - r * 0.3, y - r * 0.32, r * 0.3, r * 0.22, 'rgba(255,255,255,.45)');
  for (let i = 0; i < 3; i++) ell(ctx, x + Math.cos(i * 2.1 + 0.6) * r * 0.36, y + Math.sin(i * 2.1 + 0.6) * r * 0.36, r * 0.12, r * 0.12, gold ? '#f08c00' : '#5c3a1a');
}
/** Барабан Бума: (x, y) — низ, s — масштаб, hit — 0..1 удар. */
function drum(ctx, x, y, s, hit) {
  fillRR(ctx, x - 26 * s, y - 52 * s, 52 * s, 52 * s, 8 * s, '#c0703a', OUT, 2.2);
  for (let i = 0; i < 5; i++) line(ctx, x - 24 * s + i * 12 * s, y - 50 * s, x - 18 * s + i * 12 * s, y - 2 * s, 'rgba(74,55,40,.45)', 1.6);
  fillRR(ctx, x - 26 * s, y - 14 * s, 52 * s, 6 * s, 2, '#e03131', OUT, 1.2);
  ell(ctx, x, y - 52 * s, 28 * s, 8 * s, '#fff4e6', OUT, 2);
  if (hit > 0) ell(ctx, x, y - 52 * s, 28 * s * (1 + hit * 0.4), 8 * s * (1 + hit * 0.4), null, `rgba(255,212,59,${hit.toFixed(2)})`, 3);
}
const pic = (draw, w = 120, h = 64) => kitPic(draw, w, h, { cap: true });

export default {
  id: 'drum',
  title: 'Танец у костра',
  icon: '🥁',
  css: CSS,
  get howTo() {
    return `Бум стучит в барабан — танцуй в ритм! К кругу у барабана летят кокосы.
      <div class="dr-rules">
        <div class="dr-col"><b>🥥 Летят</b>${pic((c, w, h) => {
          line(c, 10, h / 2, w - 6, h / 2, 'rgba(74,55,40,.25)', 10);
          ell(c, 26, h / 2, 16, 16, null, '#ffd43b', 3);
          coco(c, 64, h / 2, 10, false);
          coco(c, 98, h / 2, 10, false);
          c.font = '16px sans-serif';
          c.fillText('⬅', 74, 16);
        })}<small>кокосы летят к кругу</small></div>
        <div class="dr-col ok"><b>👆 Жми!</b>${pic((c, w, h) => {
          ell(c, w / 2, h / 2, 20, 20, 'rgba(255,212,59,.5)', '#ffd43b', 3);
          coco(c, w / 2, h / 2, 12, false);
          c.font = '18px sans-serif';
          c.fillText('👆', w / 2 + 18, h - 4);
        })}<small>когда кокос в кругу —<br>хомячок танцует!</small></div>
      </div>
      Нажимай пальцем, мышкой, пробелом или стрелкой. Не успела — ничего страшного, будет следующий!`;
  },
  start(host) {
    const top = el('div', 'dr-top');
    const tScore = el('div', 'dr-chip'),
      tCombo = el('div', 'dr-chip');
    top.append(tScore, tCombo);
    host.add(top);
    const cv = host.canvas();
    cv.canvas.classList.add('dr-canvas');
    const ctx = cv.ctx;
    const level = host.level || 0;
    const beat = 60 / (BPM + Math.min(4, level) * 3),
      eighth = beat / 2,
      lead = 2 * 4 * beat; // два такта Бум играет один — «раз-два-три-четыре»
    // кокосы: at — когда долетает до круга
    const notes = [];
    [...SONG].forEach((b, bar) =>
      BARS[b].forEach((on, i) => {
        if (on) notes.push({ at: lead + (bar * 8 + i) * eighth, res: null, gold: i % 2 === 1 });
      }),
    );
    const songEnd = lead + SONG.length * 8 * eighth + beat * 2;
    const looks = (host.info && host.info.dancers) || (host.friends || []).slice(0, 2).map((f) => f.look),
      bum = (host.info && host.info.drummer) || (host.friends[2] && host.friends[2].look) || host.look;
    let t = -0.6,
      over = false,
      pts = 0,
      combo = 0,
      best = 0,
      perfect = 0,
      good = 0,
      lastBeat = -1,
      bumHit = 0,
      move = 0, // анимация танцевального движения 0..1
      moveN = 0;
    const pops = host.pops({ life: 0.9 });
    const sparks = [];

    const L = () => {
      const W = cv.w,
        H = cv.h,
        tall = H > W * 1.1,
        s = tall ? clamp(W / 430, 0.55, 1.3) : clamp(Math.min(W / 760, H / 520), 0.55, 1.5),
        laneY = H - Math.max(46 * s, H * 0.1),
        ground = tall ? H * 0.62 : Math.min(H * 0.6, laneY - 150 * s),
        tx = Math.max(150 * s, W * 0.22), // круг попадания (справа от барабана Бума)
        r = 26 * s;
      return { W, H, tall, ground, laneY, s, tx, r };
    };
    const xOf = (n, g) => g.tx + ((n.at - t) / TRAVEL) * (g.W + 40 - g.tx);

    function tap() {
      if (over || t < 0) return;
      // ближайший ещё не сыгранный кокос
      let n = null,
        d = 1e9;
      for (const q of notes) {
        if (q.res) continue;
        const e = Math.abs(q.at - t);
        if (e < d) {
          d = e;
          n = q;
        }
        if (q.at > t + 1) break;
      }
      if (!n || d > GOOD) return; // лишнее нажатие — не ошибка
      const g = L();
      const ok = d <= PERFECT;
      n.res = ok ? 'perfect' : 'good';
      pts += ok ? 2 : 1;
      if (ok) perfect++;
      else good++;
      combo++;
      best = Math.max(best, combo);
      move = 1;
      moveN++;
      host.sfx(ok ? 'clink' : 'pop');
      pops.add(ok ? 'Отлично!' : 'Хорошо!', g.tx + g.r * 0.6, g.laneY - g.r * 2.4, ok ? '#f59f00' : '#40c057');
      for (let i = 0; i < (ok ? 10 : 5); i++) sparks.push({ x: g.tx, y: g.laneY, vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 160, t: 0 });
      if (combo && combo % 8 === 0) pops.add(`🔥 ${combo} подряд!`, g.W / 2, g.H * 0.25, '#e8590c');
    }
    const pd = (e) => {
      e.preventDefault();
      tap();
    };
    host.on(cv.canvas, 'pointerdown', pd);
    const kd = (e) => {
      if (['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) tap();
      }
    };
    host.on(window, 'keydown', kd);
    // для автотеста (dev/smoke_games.js): время песни, сколько до ближайшего кокоса, очки
    cv.canvas.__drum = () => {
      const n = notes.find((q) => !q.res && q.at > t - GOOD);
      return { t, next: n ? n.at - t : null, total: notes.length, pts, perfect, good, missed: notes.filter((q) => q.res === 'miss').length, best, over };
    };
    cv.canvas.__drumSkip = () => {
      // автотест: пропустить песню почти до конца (оставшиеся кокосы — мимо)
      t = Math.max(t, songEnd - 1.5);
    };

    function update(dt) {
      t += dt;
      // Бум стучит на каждый счёт
      const b = Math.floor(t / beat);
      if (t >= 0 && t < songEnd - beat && b !== lastBeat) {
        lastBeat = b;
        bumHit = 1;
        host.sfx('thud');
      }
      bumHit = Math.max(0, bumHit - dt * 4);
      move = Math.max(0, move - dt * 3);
      for (const q of notes)
        if (!q.res && t - q.at > GOOD) {
          q.res = 'miss';
          combo = 0;
        }
      pops.step(dt);
      for (const p of sparks) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 380 * dt;
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > 0.7) sparks.splice(i, 1);
      if (t >= songEnd) finish();
    }

    function draw() {
      const g = L(),
        { W, H, s } = g;
      // ночное небо, звёзды, вулкан, гирлянда
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1b1f4a');
      sky.addColorStop(0.6, '#5b3a6e');
      sky.addColorStop(1, '#a8543a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) star(ctx, ((i * 0.37) % 1) * W, ((i * 0.61) % 0.5) * H, 1.2 + (i % 3) * 0.6, `rgba(255,255,255,${(0.4 + 0.4 * Math.sin(t * 2 + i)).toFixed(2)})`);
      poly(ctx, [W * 0.55, g.ground, W * 0.72, H * 0.24, W * 0.79, H * 0.24, W * 0.98, g.ground], '#3a2b3a', OUT, 2);
      ell(ctx, W * 0.755, H * 0.24, W * 0.035, H * 0.012, '#ff6b35');
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.13);
      ctx.quadraticCurveTo(W / 2, H * 0.3, W, H * 0.13);
      ctx.stroke();
      for (let i = 1; i < 16; i++) {
        const q = i / 16,
          on = (i + lastBeat) % 2 === 0;
        ell(ctx, q * W, H * 0.13 + Math.sin(q * Math.PI) * H * 0.085 + 4, 4, 5, on ? ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5] : '#6c5f7a', OUT, 1);
      }
      // земля
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(0, g.ground, W, H - g.ground);
      // костёр посередине
      const fx = W * 0.6,
        fy = g.ground + (g.laneY - g.ground) * 0.38;
      const glow = ctx.createRadialGradient(fx, fy - 20, 0, fx, fy - 20, H * 0.5);
      glow.addColorStop(0, `rgba(255,190,90,${(0.45 + bumHit * 0.15).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      for (const a of [-0.5, 0.5]) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(a);
        fillRR(ctx, -28 * s, -5 * s, 56 * s, 10 * s, 5 * s, '#8d5524', OUT, 1.6);
        ctx.restore();
      }
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 9 + i * 2) * 4 * s;
        poly(ctx, [fx - 18 * s + i * 10 * s, fy - 4 * s, fx - 10 * s + i * 10 * s + f, fy - (44 + (i % 2) * 14) * s, fx - 2 * s + i * 10 * s, fy - 4 * s], ['#ff922b', '#ffd43b', '#ff6b35'][i], OUT, 1.2);
      }
      // танцоры: хомячок впереди, островитяне хлопают
      const hop = (k) => Math.abs(Math.sin((t / beat) * Math.PI + k)) * 6 * s;
      looks.slice(0, 2).forEach((lk, i) => {
        const x = i ? fx + 125 * s : fx - 125 * s;
        host.drawHamster(ctx, x, fy - 6 * s - hop(i), 0.85 * s, lk, { time: t, dir: i ? -1 : 1, happy: true, armsUp: Math.sin((t / beat) * Math.PI * 2 + i) > 0.3 });
      });
      const mv = move > 0 ? moveN % 4 : -1,
        jump = mv === 1 ? Math.sin(move * Math.PI) * 26 * s : mv === 3 ? Math.sin(move * Math.PI) * 12 * s : 0;
      ctx.save();
      const hx = fx + 60 * s,
        hy = g.laneY - g.r * 1.25;
      ctx.translate(hx, hy - jump);
      if (mv === 2) ctx.rotate(Math.sin(move * Math.PI) * 0.35);
      if (mv === 0) ctx.rotate(-Math.sin(move * Math.PI) * 0.35);
      host.drawHamster(ctx, 0, 0, 1.05 * s, host.look, { time: t, dir: mv === 0 ? -1 : mv === 2 ? 1 : 0, happy: true, armsUp: move > 0.2 });
      ctx.restore();
      // Бум с барабаном у круга
      const bx = g.tx - g.r * 1.2 - 34 * s,
        by = g.laneY + g.r * 0.9;
      host.drawHamster(ctx, bx - 40 * s, by - 14 * s - bumHit * 4 * s, 0.85 * s, bum, { time: t, dir: 1, happy: true, armsUp: bumHit > 0.5 });
      drum(ctx, bx, by, 0.85 * s, bumHit);
      // дорожка и круг
      fillRR(ctx, g.tx - g.r * 1.2, g.laneY - g.r * 0.95, W - g.tx + g.r * 1.4, g.r * 1.9, g.r, 'rgba(40,20,10,.35)', 'rgba(255,212,59,.35)', 2);
      for (let k = 0; k < 12; k++) {
        const x = g.tx + ((k * beat - (t % beat) + beat) / TRAVEL) * (W + 40 - g.tx);
        if (x > g.tx + g.r && x < W) line(ctx, x, g.laneY - g.r * 0.5, x, g.laneY + g.r * 0.5, 'rgba(255,255,255,.12)', 2);
      }
      ell(ctx, g.tx, g.laneY, g.r * 1.18, g.r * 1.18, `rgba(255,212,59,${(0.18 + bumHit * 0.25).toFixed(2)})`, '#ffd43b', 3);
      // кокосы
      for (const n of notes) {
        if (n.res === 'perfect' || n.res === 'good') continue;
        const x = xOf(n, g);
        if (x > W + 40 || x < -40) continue;
        ctx.globalAlpha = n.res === 'miss' ? 0.4 : 1;
        coco(ctx, x, g.laneY, g.r * 0.72, n.gold);
        ctx.globalAlpha = 1;
      }
      if (t < lead - 0.3) {
        // «раз-два-три-четыре» до первого кокоса
        const cnt = Math.floor(t / beat) % 4;
        ctx.font = `900 ${Math.round(30 * s)}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        const word = t < 0 ? 'Приготовься!' : ['Раз!', 'Два!', 'Три!', 'Четыре!'][cnt];
        ctx.strokeText(word, W / 2, H * 0.36);
        ctx.fillStyle = '#fff3bf';
        ctx.fillText(word, W / 2, H * 0.36);
        ctx.font = `800 ${Math.round(16 * s + 2)}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.fillText('Жми, когда кокос в кругу! 👆', W / 2, H * 0.36 + 34 * s);
      }
      for (const p of sparks) {
        ctx.globalAlpha = 1 - p.t / 0.7;
        star(ctx, p.x, p.y, 4 * s, '#ffd43b');
      }
      ctx.globalAlpha = 1;
      pops.draw(ctx, Math.round(18 * s + 4));
      // мигающие огоньки вокруг круга на «серии»
      if (combo >= 4)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t * 3;
          ell(ctx, g.tx + Math.cos(a) * g.r * 1.5, g.laneY + Math.sin(a) * g.r * 1.5, 2.5, 2.5, '#fff3bf');
        }
    }
    host.loop((dt) => {
      if (!over) update(dt);
      tScore.textContent = `🥁 ${pts}`;
      tCombo.textContent = combo >= 2 ? `🔥 ${combo} подряд` : `🥥 ${notes.filter((q) => q.res).length} из ${notes.length}`;
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      const k = pts / (notes.length * 2),
        stars = k >= STARS[1] ? 3 : k >= STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `Танец окончен! «Отлично!» — <b>${perfect}</b>, «Хорошо!» — <b>${good}</b> из ${notes.length} шагов${best >= 4 ? `, лучшая серия — ${best} подряд` : ''}. ${
          stars === 3 ? 'Бум в восторге: «Ты чувствуешь ритм, как настоящая островитянка!»' : stars === 2 ? 'Островитяне хлопают: «Здорово танцуешь!»' : 'Главное — было весело! Завтра потанцуем снова.'
        }`,
        extra: { pts, perfect, good, best },
      });
    }
  },
};

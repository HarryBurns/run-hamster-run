// Мини-игра «Перетягивание каната» (Масленица, П.13; запускает канат на ярмарке — features/holidays_winter.js).
// Слева — команда хомячка (она и двое друзей), справа — другая команда. Посередине каната — красная ленточка; кто
// перетянет её за свою черту, тот выиграл раунд. Тянуть надо в ритм: кружок внизу наполняется — нажми, когда он
// полный («Тяни!»), это сильный рывок. Нажала раньше — рывок слабенький, и кружок начинается заново (так что
// «барабанить» без ритма не выгодно). Другая команда тянет понемногу всё время, в каждом раунде чуть сильнее.
// Три раунда; раунд кончается, когда ленточка за чертой, или через ROUND секунд (тогда выигрывает та сторона, где
// ленточка). Проигрыша нет: проиграли раунд — все весело падают в снег, игра идёт дальше; звёзды — по выигранным
// раундам (0–1 — ⭐, 2 — ⭐⭐, 3 — ⭐⭐⭐). Управление: нажатие пальцем или мышью в любом месте, пробел, Enter
// или стрелка влево. Монеты по звёздам выдаёт занятие (features/holidays_winter.js).
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line, star } from '../core/draw.js';

const OUT = '#4a3728';
const ROUNDS = 3;
/** Сколько секунд длится раунд самое большее. */
export const ROUND = 16;
/** Кружок наполняется за столько секунд; «Тяни!» — с FULL; полный кружок ждёт HOLD секунд, потом начинается заново. */
const BEAT = 0.75,
  FULL = 0.8,
  HOLD = 0.4;
/** Рывок: сильный (в ритм) и слабый (раньше времени); как сильно тянет другая команда в каждом раунде (за секунду). */
export const PULL = { strong: 0.16, weak: 0.015, cool: 0.2, them: [0.07, 0.095, 0.11] };

/** Маленькая картинка для правил (data: URL). */
function pic(draw, w = 110, h = 70) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  draw(x, w, h);
  return `<img src="${c.toDataURL()}" width="${w}" height="${h}" alt="">`;
}
/** Кружок ритма: k — насколько наполнен (0..1), full — «Тяни!». */
function meter(ctx, x, y, r, k, full) {
  ell(ctx, x, y, r, r, '#fff', OUT, 2.4);
  if (k > 0) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = full ? '#ff922b' : '#ffd43b';
    ctx.fill();
  }
  if (full) star(ctx, x, y, r * 0.42, '#fff', OUT, 1.4);
}
function rope(ctx, x0, x1, y, ribbon) {
  line(ctx, x0, y, x1, y, OUT, 7);
  line(ctx, x0, y, x1, y, '#d9a066', 4.4);
  for (let x = x0 + 4; x < x1; x += 9) line(ctx, x, y - 2, x + 4, y + 2, 'rgba(140,90,40,.6)', 1);
  ell(ctx, ribbon - 6, y - 2, 7, 4.5, '#e03131', OUT, 1.2, -0.5);
  ell(ctx, ribbon + 6, y - 2, 7, 4.5, '#e03131', OUT, 1.2, 0.5);
  poly(ctx, [ribbon - 3, y, ribbon - 7, y + 14, ribbon, y + 9, ribbon + 7, y + 14, ribbon + 3, y], '#c92a2a', OUT, 1);
}

const CSS = `
.tg-rules{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.tg-col{background:#fff;border-radius:14px;padding:4px 8px;border:3px solid #ffd43b;text-align:center;max-width:132px}
.tg-col.red{border-color:#ff8787}
.tg-col.blue{border-color:#74c0fc}
.tg-col b{display:block;font-size:15px}
.tg-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.tg-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.tg-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'tug',
  title: 'Перетягивание каната',
  icon: '🪢',
  get howTo() {
    return `<style>${CSS}</style>Масленичная забава! Перетяни ленточку на свою сторону.
      <div class="tg-rules">
        <div class="tg-col"><b>1 · Жди</b>${pic((c, w, h) => {
          meter(c, w / 2, h / 2, 24, 0.55, false);
          c.font = '18px sans-serif';
          c.fillText('⏳', w / 2 + 26, 22);
        })}<small>кружок наполняется</small></div>
        <div class="tg-col red"><b>2 · Тяни!</b>${pic((c, w, h) => {
          meter(c, w / 2, h / 2, 24, 1, true);
          c.font = '18px sans-serif';
          c.fillText('👆', w / 2 + 22, h - 6);
        })}<small>нажми, когда он полный — сильный рывок</small></div>
        <div class="tg-col blue"><b>3 · Ленточка</b>${pic((c, w, h) => {
          line(c, 26, 10, 26, h - 10, 'rgba(77,171,247,.8)', 3);
          rope(c, 6, w - 6, h / 2, 40);
          c.font = '16px sans-serif';
          c.fillText('⬅️', 46, 20);
        })}<small>перетяни её за свою черту</small></div>
      </div>
      ${ROUNDS} раунда. Нажимай пальцем, мышкой, пробелом или стрелкой ⬅️. Проиграть не страшно — все просто упадут в снег! ⛄`;
  },
  start(host) {
    const root = host.root;
    const style = el('style', '', CSS);
    const top = el('div', 'tg-top');
    const tRound = el('div', 'tg-chip'),
      tScore = el('div', 'tg-chip'),
      tSay = el('div', 'tg-chip');
    top.append(tRound, tScore, tSay);
    root.append(style, top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = Math.min(1, (host.level || 0) * 0.25);
    let t = 0,
      last = performance.now(),
      raf = 0,
      stopped = false,
      over = false,
      round = 0,
      phase = 'go', // go → fall (раунд окончен: кто-то в снегу) → go …
      phaseT = 0,
      p = 0, // ленточка: −1 — у нашей черты (выиграли), 1 — у их черты
      fill = 0, // кружок ритма 0..1
      held = 0, // сколько кружок уже полный
      cool = 0,
      yank = 0, // анимация рывка 0..1
      wins = 0,
      lost = 0,
      winner = 0, // −1 — мы, 1 — они (кто выиграл раунд)
      say = '',
      sayT = 0,
      strong = 0,
      taps = 0;
    const ours = [host.look, ...(host.friends || []).slice(0, 2).map((f) => f.look)];
    const theirs = (host.friends || []).slice(2, 5).map((f) => f.look);
    function shout(text, d = 1.2) {
      say = text;
      sayT = d;
    }
    function chips() {
      tRound.textContent = `Раунд ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`;
      tScore.textContent = `🏆 ${wins} : ${lost}`;
      tSay.textContent = say || (phase === 'go' ? (fill >= FULL ? '💪 Тяни!' : '⏳ Жди…') : '⛄');
    }
    function tap() {
      if (over || phase !== 'go' || cool > 0) return;
      cool = PULL.cool;
      taps++;
      if (fill >= FULL) {
        p -= PULL.strong;
        strong++;
        yank = 1;
        host.sfx('thud');
        shout(['💪 Раз!', '💪 Два!', '💪 Взяли!', '💪 Ещё!'][strong % 4], 0.6);
      } else {
        p -= PULL.weak;
        yank = 0.35;
        host.sfx('tap');
        shout('🙂 Рано! Дождись кружка', 0.8);
      }
      fill = 0;
      held = 0;
    }
    function endRound(w) {
      winner = w;
      phase = 'fall';
      phaseT = 0;
      if (w < 0) {
        wins++;
        host.sfx('win');
        shout('🎉 Раунд наш!', 1.6);
      } else {
        lost++;
        host.sfx('splash');
        shout('😄 Ой! Все упали в снег!', 1.6);
      }
    }
    function nextRound() {
      round++;
      if (round >= ROUNDS) {
        over = true;
        const stars = wins >= 3 ? 3 : wins >= 2 ? 2 : 1;
        setTimeout(
          () =>
            !stopped &&
            host.finish({
              stars,
              text: `Выиграно раундов: <b>${wins}</b> из ${ROUNDS}. ${stars === 3 ? 'Самая сильная команда на ярмарке!' : stars === 2 ? 'Отличная команда!' : 'Было весело — и все в снегу! В следующий раз получится ещё лучше.'}`,
              extra: { wins, strong, taps },
            }),
          500,
        );
        return;
      }
      p = 0;
      fill = 0;
      held = 0;
      phase = 'go';
      phaseT = 0;
      shout(`Раунд ${round + 1}!`, 1);
    }
    function update(dt) {
      t += dt;
      phaseT += dt;
      cool = Math.max(0, cool - dt);
      yank = Math.max(0, yank - dt * 3);
      if (sayT > 0) {
        sayT -= dt;
        if (sayT <= 0) say = '';
      }
      if (phase === 'go') {
        if (phaseT < 0.8) return; // «На старт!»
        if (fill < 1) fill = Math.min(1, fill + dt / BEAT);
        else {
          held += dt;
          if (held > HOLD) {
            fill = 0;
            held = 0;
          }
        }
        p += (PULL.them[round] * (1 + level * 0.25) + Math.sin(t * 2.3) * 0.02) * dt;
        if (p <= -1) endRound(-1);
        else if (p >= 1) endRound(1);
        else if (phaseT > ROUND + 0.8) endRound(p <= 0 ? -1 : 1);
      } else if (phase === 'fall' && phaseT > 1.8) nextRound();
    }
    /** Команда: хомячки в ряд, отклонились назад и тянут; упавшие — лежат в снегу. */
    function team(list, x0, step, y, s, dir, fallen, pull) {
      list.forEach((look, i) => {
        const x = x0 + step * i;
        ctx.save();
        ctx.translate(x, y);
        const lean = fallen ? dir * -1.2 * Math.min(1, phaseT * 3) : dir * -(0.18 + pull * 0.14) + Math.sin(t * 7 + i) * 0.03;
        ctx.rotate(lean);
        host.drawHamster(ctx, 0, 0, s, look, { time: t, dir, happy: !fallen || winner === dir, armsUp: false });
        ctx.restore();
        if (fallen) for (let k = 0; k < 4; k++) ell(ctx, x + Math.cos(k * 1.7 + i) * 26 * s, y - 6 - Math.abs(Math.sin(k + phaseT * 4)) * 14 * s, 4, 4, '#fff', 'rgba(150,180,220,.8)', 1);
      });
    }
    function draw() {
      const w = cv.w,
        h = cv.h;
      // небо, ёлочки, снег
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#a5d8ff');
      g.addColorStop(0.55, '#e7f5ff');
      g.addColorStop(0.56, '#ffffff');
      g.addColorStop(1, '#eef4fb');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const x = ((i * 0.17 + 0.05) % 1) * w,
          y = h * 0.56;
        poly(ctx, [x - 18, y, x, y - 44 - (i % 3) * 8, x + 18, y], '#2f9e44', OUT, 1.6);
        poly(ctx, [x - 9, y - 26, x, y - 46 - (i % 3) * 8, x + 9, y - 26], '#fff');
      }
      // флажки над полем
      ctx.strokeStyle = 'rgba(74,55,40,.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.12);
      ctx.quadraticCurveTo(w / 2, h * 0.24, w, h * 0.12);
      ctx.stroke();
      for (let i = 1; i < 12; i++) {
        const q = i / 12,
          x = q * w,
          y = h * 0.12 + Math.sin(q * Math.PI) * h * 0.06;
        poly(ctx, [x - 7, y, x + 7, y, x, y + 14], ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5], OUT, 1);
      }
      const cy = h * 0.66,
        mid = w / 2,
        span = Math.min(w * 0.18, 130),
        s = Math.max(0.5, Math.min(1.3, Math.min(w / 700, h / 420) * 1.15 + 0.15)); // на телефоне команды помельче
      // черты
      line(ctx, mid - span, cy - 46, mid - span, cy + 46, 'rgba(77,171,247,.85)', 4);
      line(ctx, mid + span, cy - 46, mid + span, cy + 46, 'rgba(255,146,43,.85)', 4);
      line(ctx, mid, cy - 30, mid, cy + 30, 'rgba(224,49,49,.35)', 2);
      const rib = mid + clamp(p, -1.2, 1.2) * span - yank * 6;
      const shift = (rib - mid) * 0.4; // команды и канат отъезжают за ленточкой, но не уходят с экрана
      const fallUs = phase === 'fall' && winner > 0,
        fallThem = phase === 'fall' && winner < 0;
      rope(ctx, mid - span * 2.4 + shift, mid + span * 2.4 + shift, cy - 26 * s, rib);
      const gap = 42 * s;
      team(ours.slice().reverse(), mid - span * 1.35 + shift - (ours.length - 1) * gap, gap, cy + 10 * s, 0.9 * s, 1, fallUs, yank);
      team(theirs, mid + span * 1.35 + shift, gap, cy + 10 * s, 0.9 * s, -1, fallThem, 0.5);
      // кружок ритма
      if (phase === 'go' && !over) {
        const r = Math.min(46, h * 0.08),
          mx = w / 2,
          my = h - r - 18;
        meter(ctx, mx, my, r, fill, fill >= FULL);
        ctx.font = '900 15px ui-rounded, "Trebuchet MS", sans-serif';
        ctx.fillStyle = OUT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(phaseT < 0.8 ? 'На старт!' : fill >= FULL ? 'ТЯНИ!' : '', mx, my - r - 12);
      }
    }

    const loop = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!over) update(dt);
      else phaseT += dt;
      draw();
      chips();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const pd = (e) => {
      e.preventDefault();
      tap();
    };
    cv.canvas.addEventListener('pointerdown', pd);
    const key = (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowLeft') {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', key);
    // для автотеста: что сейчас в игре
    cv.canvas.__tug = () => ({ round, phase, p, fill, full: fill >= FULL, wins, lost, over, strong, taps });
    cv.canvas.classList.add('tg-canvas');
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', key);
        cv.destroy();
      },
    };
  },
};

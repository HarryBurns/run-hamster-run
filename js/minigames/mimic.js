// Мини-игра «Повтори движение» (курортный отель, От9; запускает аниматор Хлопушка — features/hotel.js: утром это
// зарядка, вечером — дискотека, info.kind = 'morning' | 'evening').
// Как «Саймон»: Хлопушка показывает несколько движений подряд (хлопок, прыжок, руки вверх, шаг влево, шаг вправо,
// кружение) — кнопка движения внизу подсвечивается. Потом твоя очередь: нажми кнопки в том же порядке — хомячок
// повторяет. Получилось — к танцу добавляется ещё одно движение. Ошиблась — Хлопушка покажет ещё раз; не вышло и во
// второй раз — ничего страшного, следующий раунд с тем же числом движений. ROUNDS раундов; звёзды — по удачным раундам.
// Управление: мышь и касание (кнопки), клавиатура — цифры 1–6.
import { el, clamp, TAU, pick, plural } from '../core/util.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
export const MOVES = [
  { id: 'clap', e: '👏', name: 'Хлопок', col: '#ffd43b' },
  { id: 'jump', e: '🦘', name: 'Прыжок', col: '#8ce99a' },
  { id: 'up', e: '🙌', name: 'Руки вверх', col: '#74c0fc' },
  { id: 'left', e: '⬅️', name: 'Шаг влево', col: '#ffa8a8' },
  { id: 'right', e: '➡️', name: 'Шаг вправо', col: '#b197fc' },
  { id: 'spin', e: '🌀', name: 'Кружись', col: '#ffc078' },
];
const BY_ID = Object.fromEntries(MOVES.map((m) => [m.id, m]));
/** Раундов; длина первого танца; на ⭐⭐ и ⭐⭐⭐ — столько удачных раундов. */
export const ROUNDS = 6,
  FIRST = 2,
  STARS = [3, 5];
/** Сколько секунд Хлопушка показывает одно движение (на старших уровнях быстрее). */
const SHOW = 0.85;

const CSS = `
.mm-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.mm-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.mm-pad{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(6,minmax(0,112px));gap:8px;justify-content:center;padding:8px 8px calc(10px + env(safe-area-inset-bottom));z-index:2}
.mm-pad button{border:3px solid #4a3728;border-radius:18px;padding:4px 2px;font:inherit;font-weight:900;font-size:13px;color:#4a3728;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:0;touch-action:manipulation;box-shadow:0 4px 0 rgba(0,0,0,.25);transition:filter .1s}
.mm-pad button .e{font-size:30px;line-height:1.15}
.mm-pad button:disabled{cursor:default;filter:saturate(.45) brightness(.92)}
.mm-pad button.lit{filter:none;transform:translateY(-4px) scale(1.06);box-shadow:0 0 0 4px #fff,0 0 18px 6px rgba(255,255,255,.8)}
.mm-pad button.press{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.25)}
@media (max-width:620px){.mm-pad{grid-template-columns:repeat(3,minmax(0,120px));gap:6px}.mm-pad button .e{font-size:26px}}
@media (max-height:460px){.mm-pad{grid-template-columns:repeat(6,minmax(0,96px))}.mm-pad button{font-size:11px}.mm-pad button .e{font-size:22px}}
.mm-rules{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0 4px;font-size:26px}
.mm-rules span{background:#fff;border-radius:12px;border:2px solid #ffd43b;padding:2px 6px}
`;

export default {
  id: 'mimic',
  title: 'Повтори движение',
  icon: '🤸',
  css: CSS,
  get howTo() {
    return `Аниматор Хлопушка показывает танец — <b>смотри внимательно</b>, какие кнопки загораются!
      Потом <b>нажми их в том же порядке</b> — и хомячок повторит.
      <div class="mm-rules">${MOVES.map((m) => `<span title="${m.name}">${m.e}</span>`).join('')}</div>
      Каждый раунд танец длиннее на одно движение. Ошиблась — Хлопушка покажет ещё раз!`;
  },
  start(host) {
    const morning = host.info && host.info.kind === 'morning';
    const top = el('div', 'mm-top');
    const tRound = el('div', 'mm-chip'),
      tSay = el('div', 'mm-chip');
    top.append(tRound, tSay);
    const pad = el('div', 'mm-pad');
    host.add(top, pad);
    const cv = host.canvas();
    cv.canvas.classList.add('mm-canvas');
    const ctx = cv.ctx;
    const level = host.level || 0,
      showT = SHOW - Math.min(4, level) * 0.06;
    const anim = (host.info && host.info.animator) || (host.friends[0] && host.friends[0].look) || host.look;
    let t = 0,
      over = false,
      round = 0,
      wins = 0,
      longest = 0, // самый длинный повторённый танец
      mistakes = 0,
      retry = false, // показ ещё раз после ошибки
      phase = 'intro', // intro → show → input → (good | oops) → … → over
      phaseT = 0,
      pos = 0, // в показе — какое движение; в ответе — сколько уже нажато
      say = '';
    const seq = [];
    const grow = () => {
      // новое движение — не такое же, как последнее (так легче увидеть)
      const lastId = seq.length ? seq[seq.length - 1] : null;
      seq.push(pick(MOVES.filter((m) => m.id !== lastId)).id);
    };
    for (let i = 0; i < FIRST; i++) grow();
    // текущие движения: аниматора и хомячка — { id, t }
    let aMove = null,
      hMove = null;
    const pops = host.pops({ life: 1.2, rise: 24, line: 5 });

    // ---------- кнопки ----------
    const btns = {};
    MOVES.forEach((m, i) => {
      const b = el('button', '', `<span class="e">${m.e}</span><span>${m.name}</span>`);
      b.style.background = m.col;
      b.dataset.move = m.id;
      b.title = `${m.name} (${i + 1})`;
      b.onclick = () => press(m.id);
      pad.appendChild(b);
      btns[m.id] = b;
    });
    const lock = (on) => Object.values(btns).forEach((b) => (b.disabled = on));
    const lit = (id) => Object.entries(btns).forEach(([k, b]) => b.classList.toggle('lit', k === id));
    lock(true);

    function setPhase(p, text) {
      phase = p;
      phaseT = 0;
      if (text !== undefined) say = text;
    }
    function press(id) {
      if (phase !== 'input' || over) return;
      const b = btns[id];
      b.classList.add('press');
      host.later(() => b.classList.remove('press'), 140);
      hMove = { id, t: 0 };
      if (id === seq[pos]) {
        pos++;
        host.sfx(id === 'clap' ? 'clink' : 'pop');
        if (pos >= seq.length) {
          wins++;
          longest = Math.max(longest, seq.length);
          host.sfx('win');
          pops.add(pick(['Супер!', 'Ура!', 'Здорово!', 'Точь-в-точь!']), 0, 0, '#2f9e44');
          lock(true);
          setPhase('good', '🎉 Получилось!');
        }
      } else {
        mistakes++;
        host.sfx('bad');
        lock(true);
        pops.add(`Ой! Было: ${BY_ID[seq[pos]].e}`, 0, 0, '#e8590c');
        setPhase('oops', retry ? '🙂 Ничего! Дальше — новый танец' : '🙂 Ой! Хлопушка покажет ещё раз');
      }
    }
    const kd = (e) => {
      const n = /^(Digit|Numpad)([1-6])$/.exec(e.code);
      if (!n) return;
      e.preventDefault();
      press(MOVES[+n[2] - 1].id);
    };
    host.on(window, 'keydown', kd);
    // для автотеста (dev/smoke_games.js)
    if (DEV) cv.canvas.__mimic = () => ({ phase, seq: seq.slice(), pos, round, wins, mistakes, over });
    if (DEV) cv.canvas.__mimicSkip = () => (round = ROUNDS - 1); // автотест: сразу последний раунд

    function nextRound() {
      round++;
      if (round >= ROUNDS) return finish();
      retry = false;
      startShow();
    }
    function startShow() {
      pos = 0;
      lock(true);
      setPhase('show', `👀 Смотри! Движений: ${seq.length}`);
    }
    function update(dt) {
      t += dt;
      phaseT += dt;
      if (aMove) aMove.t += dt;
      if (hMove) hMove.t += dt;
      pops.step(dt);
      if (phase === 'intro' && phaseT > 1) startShow();
      else if (phase === 'show') {
        // пауза 0.5 с, потом движения по одному
        const k = Math.floor((phaseT - 0.5) / showT);
        if (phaseT >= 0.5 && k < seq.length && (!aMove || aMove.k !== k)) {
          aMove = { id: seq[k], t: 0, k };
          lit(seq[k]);
          host.sfx(seq[k] === 'clap' ? 'clink' : seq[k] === 'jump' ? 'thud' : 'tap');
        }
        if (aMove && aMove.t > showT * 0.75) lit(null);
        if (phaseT >= 0.5 + seq.length * showT + 0.2) {
          lit(null);
          aMove = null;
          pos = 0;
          lock(false);
          setPhase('input', '👉 Твоя очередь! Повтори');
        }
      } else if (phase === 'good' && phaseT > 1.1) {
        grow();
        nextRound();
      } else if (phase === 'oops' && phaseT > 1.4) {
        if (!retry) {
          retry = true;
          startShow();
        } else nextRound();
      }
    }

    // ---------- рисование ----------
    /** Хомячок, который делает движение m (k — 0..1 его время). */
    function dancer(x, y, s, look, m, dir) {
      let dx = 0,
        dy = 0,
        rot = 0,
        up = false,
        d = dir;
      if (m) {
        const k = clamp(m.t / showT, 0, 1),
          w = Math.sin(k * Math.PI);
        if (m.id === 'jump') dy = -w * 40 * s;
        else if (m.id === 'up') up = true;
        else if (m.id === 'left') {
          dx = -w * 30 * s;
          rot = -w * 0.25;
          d = -1;
        } else if (m.id === 'right') {
          dx = w * 30 * s;
          rot = w * 0.25;
          d = 1;
        } else if (m.id === 'spin') d = Math.floor(k * 6) % 2 ? 1 : -1;
        else if (m.id === 'clap') up = Math.floor(k * 6) % 2 === 0;
        if (k < 1 && m.id === 'clap') {
          ctx.font = `${Math.round(22 * s)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('👏', x, y - 120 * s - w * 10 * s);
        }
        if (k < 1 && m.id === 'spin') {
          ctx.strokeStyle = 'rgba(255,255,255,.7)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, y - 4 * s, 46 * s, 12 * s, 0, k * TAU, k * TAU + 4);
          ctx.stroke();
        }
      }
      ell(ctx, x + dx, y + 4 * s, 34 * s, 9 * s, 'rgba(0,0,0,.18)');
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(rot);
      host.drawHamster(ctx, 0, 0, s, look, { time: t, dir: d, happy: true, armsUp: up });
      ctx.restore();
    }
    function draw() {
      const W = cv.w,
        H = cv.h,
        padH = pad.getBoundingClientRect().height || 90,
        tall = H > W * 1.1,
        s0 = clamp(Math.min(tall ? W / 400 : W / 700, (H - padH - 100) / 300), 0.55, 1.5),
        floor = H - padH - 16 - 26 * s0,
        s = s0;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, morning ? '#74c0fc' : '#2b2440');
      g.addColorStop(1, morning ? '#d0ebff' : '#5f3dc4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (morning) {
        ell(ctx, W * 0.84, H * 0.18, 30 * s, 30 * s, '#ffe066');
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + t * 0.5;
          line(
            ctx,
            W * 0.84 + Math.cos(a) * 40 * s,
            H * 0.18 + Math.sin(a) * 40 * s,
            W * 0.84 + Math.cos(a) * 52 * s,
            H * 0.18 + Math.sin(a) * 52 * s,
            '#ffd43b',
            3 * s,
          );
        }
        for (let i = 0; i < 2; i++) {
          const cx = ((t * 12 + i * W * 0.55) % (W + 160)) - 80;
          ell(ctx, cx, H * (0.12 + i * 0.1), 34, 12, 'rgba(255,255,255,.9)');
          ell(ctx, cx + 18, H * (0.12 + i * 0.1) - 8, 20, 12, 'rgba(255,255,255,.9)');
        }
      } else {
        line(ctx, W / 2, 0, W / 2, H * 0.08, '#dee2e6', 2);
        ell(ctx, W / 2, H * 0.08 + 18 * s, 20 * s, 20 * s, '#dee2e6', OUT, 2);
        for (let i = 0; i < 6; i++) {
          const a = t * 1.6 + (i * TAU) / 6;
          ctx.globalAlpha = 0.22;
          poly(
            ctx,
            [
              W / 2,
              H * 0.08 + 18 * s,
              W / 2 + Math.cos(a) * W * 0.6 - 30,
              floor,
              W / 2 + Math.cos(a) * W * 0.6 + 30,
              floor,
            ],
            ['#ff6b9d', '#ffd43b', '#63e6be', '#74c0fc', '#b197fc', '#ff922b'][i],
          );
          ctx.globalAlpha = 1;
        }
      }
      // бассейн и палуба
      fillRR(ctx, -10, floor - 10 * s, W + 20, H, 0, morning ? '#ffe8cc' : '#495057');
      fillRR(ctx, -10, floor + 18 * s, W + 20, H, 0, morning ? '#4dabf7' : '#3b5bdb');
      for (let i = 0; i < 8; i++)
        line(
          ctx,
          ((i * 0.13 + t * 0.02) % 1) * W,
          floor + 30 * s + (i % 3) * 8,
          ((i * 0.13 + t * 0.02) % 1) * W + 26,
          floor + 30 * s + (i % 3) * 8,
          'rgba(255,255,255,.4)',
          2,
        );
      // Хлопушка слева, хомячок справа; над ними — облачко «что делать»
      const ax = W * 0.3,
        hx = W * 0.7,
        fy = floor - 8 * s;
      dancer(ax, fy, 1.15 * s, anim, aMove, 1);
      dancer(hx, fy, 1.15 * s, host.look, hMove, -1);
      ctx.font = `800 ${Math.round(12 + 3 * s)}px ui-rounded, "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = morning ? OUT : '#fff';
      ctx.fillText('Хлопушка', ax, fy + 26 * s);
      ctx.fillText(host.name || 'Я', hx, fy + 26 * s);
      // в показе — полоска «какое по счёту движение»; в ответе — сколько уже повторено
      const n = seq.length,
        bw = Math.min(W * 0.8, n * 44 * s),
        by = fy - 175 * s;
      for (let i = 0; i < n; i++) {
        const x = W / 2 - bw / 2 + (i + 0.5) * (bw / n),
          done =
            phase === 'input' || phase === 'good' || phase === 'oops'
              ? i < pos
              : phase === 'show' && aMove && i <= aMove.k;
        ell(ctx, x, by, 13 * s, 13 * s, done ? '#ffd43b' : 'rgba(255,255,255,.55)', OUT, 1.6);
        if (done && phase !== 'show') star(ctx, x, by, 7 * s, '#fff');
        else if (phase === 'show' && aMove && i === aMove.k) {
          ctx.font = `${Math.round(15 * s)}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(BY_ID[seq[i]].e, x, by + 1);
          ctx.textBaseline = 'alphabetic';
        }
      }
      pops.draw(ctx, Math.round(18 * s + 6), () => [W / 2, by - 30 * s]); // надписи — над Хлопушкой
    }
    host.loop((dt) => {
      if (!over) update(dt);
      tRound.textContent = `${morning ? '🤸' : '🪩'} Раунд ${Math.min(round + 1, ROUNDS)}/${ROUNDS} · ⭐ ${wins}`;
      tSay.textContent = say || '👀 Смотри на Хлопушку!';
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      lock(true);
      const stars = wins >= STARS[1] ? 3 : wins >= STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `${morning ? 'Зарядка окончена' : 'Дискотека удалась'}! Повторено танцев: <b>${wins}</b> из ${ROUNDS}${longest ? `, самый длинный — ${longest} ${plural(longest, 'движение', 'движения', 'движений')}` : ''}. ${
          stars === 3
            ? 'Хлопушка хлопает: «Повторяешь точь-в-точь — хоть сама веди дискотеку!»'
            : stars === 2
              ? 'Хлопушка: «Здорово! Ещё чуть-чуть — и будешь как я!»'
              : 'Хлопушка: «Главное — весело! Приходи ещё!»'
        }`,
        extra: { wins, mistakes, longest },
      });
    }
  },
};

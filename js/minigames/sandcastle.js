// Мини-игра «Замок из песка» (секретный пляж, П.9; запускает русалочка Жемчужинка и песочные куличики —
// features/cove.js).
// Сверху — образец Жемчужинки (маленькая картинка замка), посередине — песчаный холмик с местами для деталей
// (пунктирные рамки), внизу — детали: башня, стена и ворота (их ставят внизу), флажок, ракушка и звёздочка (их ставят
// наверх, на то, что стоит под ними). Выбери деталь — нажми на место. «Готово!» — Жемчужинка сверяет с образцом:
// не так — место подсвечивается, можно поправить (это ошибка, но проигрыша нет). Два замка по образцу (поменьше
// и побольше), третий — свой, как хочется (его не проверяют). Звёзды — по ошибкам. Приз выдаёт занятие.
// Пальцем и мышкой; на телефоне — всё крупно, в столбик.
import { el } from '../core/util.js';
import { ell, poly, fillRR, line, star } from '../core/draw.js';

const OUT = '#4a3728',
  SAND = '#f2d48a',
  SAND_D = '#c99a4e',
  SAND_L = '#fbe7b5';
/** Сколько ошибок можно на 3★ и 2★. */
export const CASTLE_STARS = [0, 2];
// детали: row — куда ставят (base — внизу, top — наверх), h — высота детали (для того, что встанет сверху)
const PIECES = [
  { id: 'tower', name: 'Башня', row: 'base', h: 92 },
  { id: 'wall', name: 'Стена', row: 'base', h: 46 },
  { id: 'gate', name: 'Ворота', row: 'base', h: 62 },
  { id: 'flag', name: 'Флажок', row: 'top' },
  { id: 'shell', name: 'Ракушка', row: 'top' },
  { id: 'star', name: 'Звёздочка', row: 'top' },
];
const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p]));
// места: внизу — пять (0–4), наверху — над каждым из нижних (5–9: над 0–4)
const BASE_X = [70, 135, 200, 265, 330],
  GROUND = 196, // где низ деталей (картинка замка 400 × 250)
  CW = 400,
  CH = 250;
// раунды: какие места есть; free — свой замок, не проверяется
const ROUNDS = [
  { base: [1, 2, 3], top: [2] },
  { base: [0, 1, 2, 3, 4], top: [0, 2, 4] },
  { base: [0, 1, 2, 3, 4], top: [0, 2, 4], free: true },
];

// ---------- рисунки ----------
/** Деталь замка: (x — середина, y — низ). */
function drawPiece(ctx, id, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const crenel = (w, top) => {
    for (let i = 0; i < 3; i++) fillRR(ctx, -w / 2 + (i * w * 0.78) / 2, top - 10, w * 0.22, 12, 2, SAND, OUT, 1.8);
  };
  if (id === 'tower') {
    fillRR(ctx, -22, -92, 44, 92, 4, SAND, OUT, 2.2);
    crenel(44, -92);
    fillRR(ctx, -7, -66, 14, 18, 7, '#7a5a22', OUT, 1.6);
    for (let i = 0; i < 4; i++) ell(ctx, -12 + i * 8, -20 - (i % 2) * 16, 2, 1.6, SAND_D);
    line(ctx, -18, -86, -18, -6, SAND_L, 3);
  } else if (id === 'wall') {
    fillRR(ctx, -32, -46, 64, 46, 3, SAND, OUT, 2.2);
    crenel(64, -46);
    line(ctx, -30, -24, 30, -24, SAND_D, 1.4);
    line(ctx, -28, -42, -28, -4, SAND_L, 3);
  } else if (id === 'gate') {
    fillRR(ctx, -30, -62, 60, 62, 3, SAND, OUT, 2.2);
    crenel(60, -62);
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-14, -24);
    ctx.quadraticCurveTo(0, -46, 14, -24);
    ctx.lineTo(14, 0);
    ctx.closePath();
    ctx.fillStyle = '#7a5a22';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    line(ctx, 0, -38, 0, 0, 'rgba(0,0,0,.25)', 1.4);
    line(ctx, -26, -56, -26, -4, SAND_L, 3);
  } else if (id === 'flag') {
    line(ctx, 0, 0, 0, -40, OUT, 3);
    line(ctx, 0, 0, 0, -40, '#a8703f', 1.6);
    poly(ctx, [1, -40, 24, -33, 1, -25], '#fa5252', OUT, 1.6);
  } else if (id === 'shell') {
    ctx.beginPath();
    ctx.moveTo(0, -2);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.lineTo(Math.cos(a) * 14, -6 + Math.sin(a) * 14);
    }
    ctx.closePath();
    ctx.fillStyle = '#ff8fab';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      line(ctx, 0, -3, Math.cos(a) * 11, -6 + Math.sin(a) * 11, '#e64980', 1.2);
    }
  } else if (id === 'star') {
    star(ctx, 0, -14, 14, '#ffa94d', OUT, 1.8);
    ell(ctx, -3, -17, 3, 2, 'rgba(255,255,255,.6)');
  }
  ctx.restore();
}
/** Песчаный холмик, море и небо (фон замка). */
function drawBack(ctx, w, h) {
  const k = w / CW;
  ctx.save();
  ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#a5e9f5');
  g.addColorStop(0.55, '#e3fafc');
  g.addColorStop(0.56, '#3bc9db');
  g.addColorStop(0.68, '#66d9e8');
  g.addColorStop(0.69, SAND_L);
  g.addColorStop(1, '#f7e3ad');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  ell(ctx, 340, 34, 18, 18, '#ffe066');
  ell(ctx, 200, GROUND + 10, 180, 22, '#ead08c', 'rgba(150,105,40,.4)', 1.5);
  ctx.restore();
}
/** Замок целиком: детали по местам (cells — id детали или null), пустые места — пунктиром (marks — подсветка). */
function drawCastle(ctx, w, h, round, cells, opts = {}) {
  drawBack(ctx, w, h);
  const k = w / CW;
  ctx.save();
  ctx.scale(k, k);
  const R = ROUNDS[round];
  for (const i of R.base) {
    const id = cells[i];
    if (id) drawPiece(ctx, id, BASE_X[i], GROUND);
    else if (opts.slots) slotBox(ctx, i, 'base', opts);
  }
  for (const i of R.top) {
    const id = cells[5 + i];
    const y = topY(cells, i);
    if (id) drawPiece(ctx, id, BASE_X[i], y);
    else if (opts.slots) slotBox(ctx, i, 'top', opts, y);
  }
  if (opts.slots) {
    // выбранное место и ошибки
    for (const j of opts.bad || []) {
      const bx = BASE_X[j % 5],
        by = j < 5 ? GROUND - 46 : topY(cells, j - 5) - 18;
      ctx.strokeStyle = '#fa5252';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(bx, by, 36, j < 5 ? 54 : 26, 0, 0, 6.2832);
      ctx.stroke();
    }
  }
  ctx.restore();
}
/** Где низ верхней детали над местом i: на верхушке того, что стоит внизу (пусто — как на стене). */
const topY = (cells, i) => GROUND - (cells[i] ? PIECE[cells[i]].h + 10 : 56);
function slotBox(ctx, i, row, opts, y) {
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = 'rgba(74,55,40,.55)';
  ctx.lineWidth = 2.4;
  if (row === 'base') fillRR(ctx, BASE_X[i] - 28, GROUND - 74, 56, 74, 10, 'rgba(255,255,255,.35)', 'rgba(74,55,40,.55)', 2.4);
  else {
    ctx.beginPath();
    ctx.arc(BASE_X[i], y - 18, 20, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
const cache = {};
/** Картинка детали для кнопки (data: URL). */
function pieceImg(id) {
  if (cache[id]) return cache[id];
  const c = document.createElement('canvas');
  c.width = c.height = 120;
  const x = c.getContext('2d');
  const p = PIECE[id];
  x.scale(1.1, 1.1);
  drawPiece(x, id, 54, p.row === 'top' ? 76 : 102, p.row === 'top' ? 1.9 : id === 'tower' ? 0.95 : 1.2);
  return (cache[id] = c.toDataURL());
}
/** Маленький замок-образец для правил (data: URL). */
function ruleImg() {
  if (cache.rule) return cache.rule;
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 125;
  drawCastle(c.getContext('2d'), 200, 125, 0, [null, 'tower', 'gate', 'tower', null, null, null, 'flag', null, null]);
  return (cache.rule = c.toDataURL());
}

const CSS = `
.sc-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.sc-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #ffd43b;text-align:center;max-width:150px}
.sc-col.ok{border-color:#8ce99a}
.sc-col.no{border-color:#74c0fc}
.sc-col b{display:block;font-size:16px}
.sc-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.sc-col img{width:44px;height:44px;margin:2px}
.sc-col img.big{width:110px;height:auto}
.sc-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  background:linear-gradient(#c5f6fa,#fff4d6);padding:58px 8px 12px;box-sizing:border-box;overflow:hidden}
.sc-top{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
.sc-sample{background:#fff;border:3px solid ${OUT};border-radius:14px;padding:3px 6px 0;text-align:center;font-weight:900;font-size:13px}
.sc-sample canvas{display:block;width:min(36vw,170px);height:auto;border-radius:8px}
.sc-say{background:#fffbe6;border:3px solid ${OUT};border-radius:14px;padding:4px 12px;font-weight:900;font-size:17px;max-width:min(90vw,320px);text-align:center}
.sc-castle{width:min(94vw,560px,calc((100vh - 450px) * 1.6));height:auto;border-radius:16px;border:3px solid ${OUT};touch-action:manipulation;cursor:pointer;background:#fff}
.sc-pal{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;width:min(94vw,560px)}
.sc-piece{border:3px solid ${OUT};border-radius:14px;background:#fff;padding:2px 0 0;cursor:pointer;touch-action:manipulation;font-weight:900;font-size:12px}
.sc-piece img{width:100%;max-width:64px;height:auto;display:block;margin:0 auto}
.sc-piece.on{background:#ffe066;transform:translateY(-3px);box-shadow:0 4px 0 rgba(74,55,40,.3)}
.sc-done{font-size:18px}
.sc-chips{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.sc-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
@media (max-width:520px){.sc-pal{grid-template-columns:repeat(3,1fr)}.sc-piece img{max-width:54px}}
/* телефон лёжа: по вертикали места мало — образец и подсказка слева, замок справа, детали и «Готово!» внизу */
@media (max-height:520px) and (orientation:landscape){
  .sc-wrap{display:grid;grid-template-columns:auto auto;grid-template-rows:minmax(0,1fr) auto;justify-content:center;
    align-items:center;justify-items:center;gap:6px 14px;padding:46px 10px 8px}
  .sc-top{grid-column:1;grid-row:1;flex-direction:column;gap:6px}
  .sc-sample canvas{width:min(24vw,150px,calc((100vh - 230px) * 1.25))}
  .sc-say{font-size:14px;max-width:min(30vw,220px);padding:3px 8px}
  .sc-castle{grid-column:2;grid-row:1;width:auto;height:min(calc(100vh - 210px),300px);max-width:60vw}
  .sc-pal{grid-column:2;grid-row:2;width:min(60vw,460px);gap:4px}
  .sc-piece{font-size:11px}.sc-piece img{max-width:36px}
  .sc-done{grid-column:1;grid-row:2;font-size:16px;padding:8px 14px;min-height:44px}
}
`;

export default {
  id: 'sandcastle',
  title: 'Замок из песка',
  icon: '🏰',
  get howTo() {
    const im = (id) => `<img src="${pieceImg(id)}" alt="">`;
    return `<style>${CSS}</style>Построй замок, как на образце Жемчужинки!
      <div class="sc-rules">
        <div class="sc-col"><b>👀 Образец</b><img class="big" src="${ruleImg()}" alt=""><small>посмотри, что где стоит</small></div>
        <div class="sc-col ok"><b>👆 Выбери и поставь</b>${im('tower')}${im('flag')}<small>деталь — потом место</small></div>
        <div class="sc-col no"><b>✅ Готово!</b>${im('shell')}<small>не так — поправь</small></div>
      </div>
      Два замка — по образцу, третий — какой хочешь! Меньше ошибок — больше звёзд.`;
  },
  start(host) {
    const root = host.root;
    const style = el('style', '', CSS);
    const wrap = el('div', 'sc-wrap');
    const top = el('div', 'sc-top');
    const sample = el('div', 'sc-sample', 'Образец');
    const sCv = document.createElement('canvas');
    sCv.width = 340;
    sCv.height = 212;
    sample.appendChild(sCv);
    const say = el('div', 'sc-say', 'Выбери деталь внизу!');
    top.append(sample, say);
    const cv = document.createElement('canvas');
    cv.className = 'sc-castle';
    const DPR = 2;
    cv.width = CW * DPR;
    cv.height = CH * DPR;
    const pal = el('div', 'sc-pal');
    const done = el('button', 'btn big green sc-done', '✅ Готово!');
    wrap.append(top, cv, pal, done);
    const chips = el('div', 'sc-chips');
    const tRound = el('div', 'sc-chip'),
      tMiss = el('div', 'sc-chip');
    chips.append(tRound, tMiss);
    root.append(style, wrap, chips);
    let round = 0,
      cells = Array(10).fill(null),
      pattern = null,
      sel = 'tower',
      miss = 0,
      bad = [],
      phase = 'play', // play — строим; wait — Жемчужинка смотрит; done — всё
      stopped = false;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => !stopped && fn(), ms));
    const btns = PIECES.map((p) => {
      const b = el('button', 'sc-piece', `<img src="${pieceImg(p.id)}" alt="">${p.name}`);
      b.onclick = () => {
        sel = p.id;
        host.sfx('tap');
        btns.forEach((q, i) => q.classList.toggle('on', PIECES[i].id === sel));
      };
      pal.appendChild(b);
      return b;
    });
    btns[0].classList.add('on');
    const slotsOf = (r) => [...ROUNDS[r].base, ...ROUNDS[r].top.map((i) => 5 + i)];
    /** Образец: по бокам башни, в середине ворота или башня, между — стены; наверху — что-нибудь весёлое. */
    function makePattern() {
      const R = ROUNDS[round],
        p = Array(10).fill(null),
        pick = (l) => l[Math.floor(Math.random() * l.length)];
      for (const i of R.base) {
        const edge = i === R.base[0] || i === R.base[R.base.length - 1];
        p[i] = edge ? pick(['tower', 'tower', 'wall']) : i === 2 ? pick(['gate', 'tower']) : pick(['wall', 'tower']);
      }
      for (const i of R.top) p[5 + i] = pick(['flag', 'shell', 'star']);
      return p;
    }
    function paint() {
      const c = cv.getContext('2d');
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawCastle(c, CW, CH, round, cells, { slots: true, bad });
      const s = sCv.getContext('2d');
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, sCv.width, sCv.height);
      if (pattern) drawCastle(s, sCv.width, sCv.height, round, pattern, {});
      else {
        drawBack(s, sCv.width, sCv.height);
        s.fillStyle = OUT;
        s.font = '900 60px ui-rounded, sans-serif';
        s.textAlign = 'center';
        s.textBaseline = 'middle';
        s.fillText('✨', sCv.width / 2, sCv.height / 2);
      }
      sample.firstChild.textContent = pattern ? 'Образец' : 'Свой замок';
      tRound.textContent = `🏰 Замок ${round + 1} из ${ROUNDS.length}`;
      tMiss.textContent = `🔄 Ошибки: ${miss}`;
    }
    /** Место под точкой картинки (единицы замка 400 × 250) или -1. */
    function slotAt(x, y) {
      let best = -1,
        bd = 1e9;
      for (const j of slotsOf(round)) {
        const bx = BASE_X[j % 5],
          by = j < 5 ? GROUND - 40 : topY(cells, j - 5) - 18,
          d = Math.hypot(x - bx, (y - by) * (j < 5 ? 0.6 : 1));
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      return bd < 44 ? best : -1;
    }
    function place(j) {
      if (phase !== 'play' || j < 0) return;
      const row = j < 5 ? 'base' : 'top',
        p = PIECE[sel];
      if (p.row !== row) {
        host.sfx('thud');
        say.textContent = row === 'top' ? '☝️ Наверх ставят флажок, ракушку или звёздочку!' : '👇 Внизу — башня, стена или ворота!';
        return;
      }
      cells[j] = sel;
      // нижнюю деталь сняли — верхняя падает? Нет: она просто встанет на новую высоту
      bad = bad.filter((b) => b !== j);
      host.sfx('pop');
      say.textContent = ['🏗️ Так-так…', '✨ Красиво!', '👍 Отлично стоит!'][Math.floor(Math.random() * 3)];
      paint();
    }
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      place(slotAt(((e.clientX - r.left) / r.width) * CW, ((e.clientY - r.top) / r.height) * CH));
    });
    done.onclick = () => {
      if (phase !== 'play') return;
      const slots = slotsOf(round);
      if (slots.some((j) => !cells[j])) {
        host.sfx('tap');
        say.textContent = '🙂 Ещё не все места заняты — смотри на пунктир!';
        return;
      }
      if (!ROUNDS[round].free) {
        const wrong = slots.filter((j) => cells[j] !== pattern[j]);
        if (wrong.length) {
          miss += wrong.length;
          bad = wrong;
          host.sfx('thud');
          say.textContent = '🧐 Почти! Красным — то, что не как на образце. Поправь!';
          paint();
          return;
        }
      }
      bad = [];
      phase = 'wait';
      host.sfx('ok');
      say.textContent = ROUNDS[round].free ? '😍 Какой чудесный замок!' : ['🎉 Точь-в-точь как образец!', '🌟 Здорово получилось!'][round] || '🎉 Ура!';
      paint();
      round++;
      if (round >= ROUNDS.length) {
        phase = 'done';
        host.sfx('win');
        later(finish, 900);
        return;
      }
      later(next, 1100);
    };
    function next() {
      cells = Array(10).fill(null);
      pattern = ROUNDS[round].free ? null : makePattern();
      phase = 'play';
      say.textContent = ROUNDS[round].free ? '✨ А теперь — свой замок! Ставь что хочешь.' : '👀 Новый образец! Построй такой же.';
      paint();
    }
    // для автотеста (dev/smoke_sbeach.js): образец, что стоит, и где на экране каждое место
    cv.__castle = () => {
      const r = cv.getBoundingClientRect(),
        at = (j) => ({
          x: r.left + (BASE_X[j % 5] / CW) * r.width,
          y: r.top + ((j < 5 ? GROUND - 40 : topY(cells, j - 5) - 18) / CH) * r.height,
        });
      return { round, phase, miss, pattern: pattern && [...pattern], cells: [...cells], slots: slotsOf(round).map((j) => ({ j, ...at(j) })) };
    };
    pattern = makePattern();
    paint();
    function finish() {
      const stars = miss <= CASTLE_STARS[0] ? 3 : miss <= CASTLE_STARS[1] ? 2 : 1;
      host.finish({
        stars,
        text: `Три замка готовы${miss ? `, ошибок — ${miss}` : ' — и все как на образце'}!${stars === 3 ? ' Жемчужинка хлопает хвостом по воде — брызги до неба! 🧜‍♀️' : ' Жемчужинке очень понравилось — попробуй ещё, без ошибок!'}`,
        extra: { miss },
      });
    }
    return {
      stop() {
        stopped = true;
        for (const tm of timers) clearTimeout(tm);
        style.remove();
        wrap.remove();
        chips.remove();
      },
    };
  },
};

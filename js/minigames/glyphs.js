// Мини-игра «Узор храма» (джунгли, П.9; руины храма — features/jungle.js).
// На стене храма — четыре камня со знаками: солнце, гора, волна и листик. Каменная маска показывает узор: камни
// по очереди загораются и звенят. Повтори узор — нажми на камни в том же порядке. Три узора: из трёх, четырёх
// и пяти знаков. Ошиблась — маска покажет узор ещё раз, и можно повторить (проигрыша нет). Звёзды — по ошибкам.
// Сокровище (монеты раз в день) выдаёт занятие.
import { el } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
const ROUNDS = [3, 4, 5];
/** Сколько ошибок можно на 3★ и 2★. */
export const GLYPH_STARS = [0, 2];
const GLYPHS = [
  { id: 'sun', name: 'Солнце', col: '#ffd43b', note: 523 },
  { id: 'hill', name: 'Гора', col: '#69db7c', note: 659 },
  { id: 'wave', name: 'Волна', col: '#74c0fc', note: 784 },
  { id: 'leaf', name: 'Листик', col: '#ff8fab', note: 988 },
];

/** Камень со знаком (в квадрате s × s); lit — горит. */
function stone(ctx, id, s, lit) {
  const c = s / 2;
  fillRR(ctx, s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.14, lit ? '#fff3bf' : '#b9b39a', OUT, 3);
  fillRR(ctx, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.1, lit ? '#ffe8a1' : '#a9a389');
  ell(ctx, s * 0.24, s * 0.82, s * 0.12, s * 0.05, '#6aa84f');
  const g = GLYPHS.find((q) => q.id === id),
    ink = lit ? g.col : '#5b5644',
    w = s * 0.07;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (id === 'sun') {
    ell(ctx, c, c, s * 0.15, s * 0.15, lit ? g.col : null, ink === g.col ? OUT : ink, w * 0.8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      line(
        ctx,
        c + Math.cos(a) * s * 0.22,
        c + Math.sin(a) * s * 0.22,
        c + Math.cos(a) * s * 0.32,
        c + Math.sin(a) * s * 0.32,
        lit ? OUT : ink,
        w * 0.7,
      );
    }
  } else if (id === 'hill') {
    poly(
      ctx,
      [s * 0.18, s * 0.72, s * 0.42, s * 0.3, s * 0.56, s * 0.52, s * 0.66, s * 0.4, s * 0.82, s * 0.72],
      lit ? g.col : null,
      lit ? OUT : ink,
      w * 0.8,
    );
  } else if (id === 'wave') {
    ctx.strokeStyle = lit ? OUT : ink;
    ctx.lineWidth = w;
    for (const dy of [-0.12, 0.08]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.18, c + dy * s);
      ctx.bezierCurveTo(s * 0.32, c + (dy - 0.12) * s, s * 0.42, c + (dy + 0.12) * s, s * 0.52, c + dy * s);
      ctx.bezierCurveTo(s * 0.62, c + (dy - 0.12) * s, s * 0.72, c + (dy + 0.12) * s, s * 0.84, c + dy * s);
      ctx.stroke();
    }
    if (lit) line(ctx, s * 0.2, c + 0.2 * s, s * 0.8, c + 0.2 * s, g.col, w * 0.6);
  } else {
    ctx.beginPath();
    ctx.moveTo(s * 0.26, s * 0.74);
    ctx.quadraticCurveTo(s * 0.22, s * 0.3, s * 0.74, s * 0.24);
    ctx.quadraticCurveTo(s * 0.76, s * 0.7, s * 0.26, s * 0.74);
    ctx.closePath();
    if (lit) {
      ctx.fillStyle = g.col;
      ctx.fill();
    }
    ctx.strokeStyle = lit ? OUT : ink;
    ctx.lineWidth = w * 0.8;
    ctx.stroke();
    line(ctx, s * 0.3, s * 0.7, s * 0.62, s * 0.36, lit ? OUT : ink, w * 0.5);
  }
  ctx.restore();
}
const cache = {};
/** Картинка камня (data: URL), один раз на знак и «горит / не горит». */
function stoneImg(id, lit) {
  const key = id + (lit ? 1 : 0);
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const x = c.getContext('2d');
  stone(x, id, 160, lit);
  return (cache[key] = c.toDataURL());
}
/** Каменная маска (для правил и для игры): глаза светятся, когда показывает узор. */
function maskImg(on) {
  const key = 'mask' + (on ? 1 : 0);
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 150;
  const x = c.getContext('2d');
  x.lineJoin = 'round';
  fillRR(x, 30, 10, 140, 130, 30, '#b9b39a', OUT, 4);
  fillRR(x, 30, 10, 140, 30, 16, '#8f8a72', OUT, 3);
  for (const s of [-1, 1]) {
    ell(x, 100 + s * 34, 66, 16, 10, '#2e2a22', OUT, 3);
    ell(x, 100 + s * 34, 66, 7, 7, on ? '#69db7c' : '#4a4535');
  }
  poly(x, [90, 76, 110, 76, 114, 104, 86, 104], '#a9a389', OUT, 3);
  x.beginPath();
  x.arc(100, 106, 22, 0.15 * Math.PI, 0.85 * Math.PI);
  x.strokeStyle = OUT;
  x.lineWidth = 4;
  x.stroke();
  ell(x, 54, 130, 22, 8, '#6aa84f');
  return (cache[key] = c.toDataURL());
}

const CSS = `
.gl-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.gl-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #ffd43b;text-align:center}
.gl-col.ok{border-color:#8ce99a}
.gl-col.no{border-color:#74c0fc}
.gl-col b{display:block;font-size:16px}
.gl-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.gl-col img{width:46px;height:46px;margin:2px}
.gl-col img.mk{width:62px;height:46px}
.gl-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  background:linear-gradient(#2d6a4f,#1b4332);padding:52px 10px 14px;box-sizing:border-box}
.gl-wrap::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,.08) 0 40px,transparent 40px 80px);pointer-events:none}
.gl-mask{width:min(46vw,190px);height:auto;position:relative}
.gl-say{position:relative;background:#fffbe6;border:3px solid ${OUT};border-radius:14px;padding:4px 14px;font-weight:900;font-size:18px}
.gl-grid{position:relative;display:grid;grid-template-columns:repeat(2,min(34vw,24vh,150px));gap:12px}
.gl-stone{border:none;padding:0;background:none;cursor:pointer;touch-action:manipulation;border-radius:18px;transition:transform .08s}
.gl-stone img{width:100%;height:auto;display:block}
.gl-stone:active,.gl-stone.lit{transform:scale(.94)}
.gl-stone.lit{filter:drop-shadow(0 0 12px #ffe066)}
.gl-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.gl-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
/* телефон лёжа: маска и подсказка слева, камни справа — иначе нижний ряд камней уходит за край экрана */
@media (max-height:520px) and (orientation:landscape){
  .gl-wrap{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;align-content:center;justify-content:center;
    gap:8px 28px;padding:46px 10px 10px}
  .gl-mask{grid-column:1;grid-row:1;width:min(26vw,150px,calc((100vh - 160px) * 1.33));justify-self:center;align-self:end}
  .gl-say{grid-column:1;grid-row:2;justify-self:center;align-self:start;font-size:16px}
  .gl-grid{grid-column:2;grid-row:1 / span 2;grid-template-columns:repeat(2,min(calc((100vh - 140px) / 2),130px))}
}
`;

export default {
  id: 'glyphs',
  title: 'Узор храма',
  icon: '🗿',
  css: CSS,
  get howTo() {
    const im = (id, lit) => `<img src="${stoneImg(id, lit)}" alt="">`;
    return `Каменная маска покажет узор — камни загорятся по очереди. <b>Повтори узор!</b>
      <div class="gl-rules">
        <div class="gl-col"><b>👀 Смотри</b><img class="mk" src="${maskImg(true)}" alt="">${im('sun', true)}<small>какой камень горит</small></div>
        <div class="gl-col ok"><b>👆 Повтори</b>${im('sun', true)}${im('wave', true)}<small>нажми в том же порядке</small></div>
        <div class="gl-col no"><b>🔄 Ошиблась?</b>${im('hill', false)}<small>маска покажет ещё раз</small></div>
      </div>
      Три узора: из 3, 4 и 5 знаков. Меньше ошибок — больше звёзд!`;
  },
  start(host) {
    const wrap = el('div', 'gl-wrap');
    const mask = el('img', 'gl-mask');
    mask.src = maskImg(false);
    const say = el('div', 'gl-say', 'Смотри…');
    const grid = el('div', 'gl-grid');
    wrap.append(mask, say, grid);
    const top = el('div', 'gl-top');
    const tRound = el('div', 'gl-chip'),
      tMiss = el('div', 'gl-chip');
    top.append(tRound, tMiss);
    host.add(wrap, top);
    let round = 0,
      seq = [],
      input = 0,
      miss = 0,
      phase = 'show'; // show — маска показывает; input — повторяем; done — всё
    const later = host.later;
    const btns = GLYPHS.map((g, i) => {
      const b = el('button', 'gl-stone', `<img src="${stoneImg(g.id, false)}" alt="${g.name}">`);
      b.onclick = () => press(i);
      grid.appendChild(b);
      return b;
    });
    const light = (i, on) => {
      btns[i].classList.toggle('lit', on);
      btns[i].querySelector('img').src = stoneImg(GLYPHS[i].id, on);
    };
    const chime = (i) => host.sfx('note', GLYPHS[i].note);
    const show = () => {
      tRound.textContent = `🗿 Узор ${Math.min(round + 1, ROUNDS.length)} из ${ROUNDS.length}`;
      tMiss.textContent = `🔄 Ошибки: ${miss}`;
    };
    /** Новый узор: длина ROUNDS[round]; соседние знаки не повторяются (так легче запомнить). */
    function newSeq() {
      const n = ROUNDS[round];
      seq = [];
      while (seq.length < n) {
        const k = Math.floor(Math.random() * GLYPHS.length);
        if (k !== seq[seq.length - 1]) seq.push(k);
      }
    }
    /** Маска показывает узор: камни загораются по очереди. */
    function play() {
      phase = 'show';
      input = 0;
      say.textContent = '👀 Смотри…';
      mask.src = maskImg(true);
      const step = 720;
      seq.forEach((k, j) => {
        later(
          () => {
            light(k, true);
            chime(k);
          },
          500 + j * step,
        );
        later(() => light(k, false), 500 + j * step + 460);
      });
      later(
        () => {
          phase = 'input';
          mask.src = maskImg(false);
          say.textContent = '👆 Повтори!';
        },
        500 + seq.length * step,
      );
    }
    function press(i) {
      if (phase !== 'input') return;
      light(i, true);
      later(() => light(i, false), 220);
      if (seq[input] === i) {
        chime(i);
        input++;
        if (input < seq.length) return;
        // узор повторён
        phase = 'show';
        host.sfx('ok');
        say.textContent = ['✨ Верно!', '🌟 Здорово!', '🎉 Отлично!'][round] || '✨ Верно!';
        round++;
        show();
        if (round >= ROUNDS.length) {
          phase = 'done';
          host.sfx('win');
          mask.src = maskImg(true);
          later(finish, 900);
          return;
        }
        later(() => {
          newSeq();
          play();
        }, 900);
        return;
      }
      // ошибка: маска покажет тот же узор ещё раз
      miss++;
      host.sfx('thud');
      phase = 'show';
      say.textContent = '🔄 Ой! Смотри ещё раз';
      show();
      later(play, 900);
    }
    // для автотеста (dev/smoke_jungle.js): какой узор и что сейчас происходит
    if (DEV) grid.__glyphs = () => ({ seq: [...seq], phase, round, input, miss });
    newSeq();
    show();
    later(play, 300);
    function finish() {
      const stars = miss <= GLYPH_STARS[0] ? 3 : miss <= GLYPH_STARS[1] ? 2 : 1;
      host.finish({
        stars,
        text: `Все три узора повторены${miss ? `, ошибок — ${miss}` : ' без единой ошибки'}!${stars === 3 ? ' Каменная маска улыбается — тайна храма твоя 🗿' : ' Маска довольна — попробуй ещё, без ошибок!'}`,
        extra: { miss },
      });
    }
  },
};

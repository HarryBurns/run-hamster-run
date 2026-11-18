// Мини-игра «Пары» (пустыня, П.9; загадка пирамиды — features/desert.js).
// На стене пирамиды — 12 каменных табличек рубашкой вверх. Нажми на две: одинаковые картинки (пирамида, верблюд,
// жук-скарабей, солнце, кошка, пальма, кувшин, лотос — шесть из восьми, каждый раз другие) остаются открытыми,
// разные — снова закрываются. Открой все пары! Звёзды — по ошибкам: чем меньше промахов, тем больше звёзд.
// Проигрыша нет. Сокровище (монеты раз в день) выдаёт занятие.
import { el, shuffle } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';

const OUT = '#4a3728';
const PAIRS = 6;
/** Сколько ошибок можно на 3★ и 2★. */
export const PAIR_STARS = [3, 7];
const SYMBOLS = ['pyramid', 'camel', 'scarab', 'sun', 'cat', 'palm', 'jug', 'lotus'];

/** Картинка таблички: символ на песчанике (в квадрате s × s). */
function symbol(ctx, id, s) {
  const c = s / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'pyramid':
      poly(ctx, [s * 0.14, s * 0.8, c, s * 0.18, s * 0.86, s * 0.8], '#ffd43b', OUT, 3);
      poly(ctx, [c, s * 0.18, s * 0.86, s * 0.8, c + s * 0.08, s * 0.8], '#f59f00');
      for (let i = 1; i < 4; i++) line(ctx, c - i * s * 0.08, s * 0.18 + i * s * 0.155, c + i * s * 0.08, s * 0.18 + i * s * 0.155, 'rgba(120,70,30,.4)', 1.5);
      poly(ctx, [s * 0.14, s * 0.8, c, s * 0.18, s * 0.86, s * 0.8], null, OUT, 3);
      break;
    case 'camel':
      ell(ctx, c - s * 0.04, s * 0.52, s * 0.26, s * 0.14, '#d9a066', OUT, 3);
      ell(ctx, c - s * 0.06, s * 0.42, s * 0.13, s * 0.13, '#d9a066', OUT, 3);
      for (const x of [-0.2, -0.08, 0.08, 0.16]) line(ctx, c + x * s, s * 0.6, c + x * s, s * 0.82, OUT, 4);
      line(ctx, c + s * 0.18, s * 0.48, c + s * 0.3, s * 0.26, OUT, 7);
      line(ctx, c + s * 0.18, s * 0.48, c + s * 0.3, s * 0.26, '#d9a066', 4);
      ell(ctx, c + s * 0.33, s * 0.24, s * 0.08, s * 0.055, '#d9a066', OUT, 2.5);
      ell(ctx, c + s * 0.33, s * 0.22, 1.6, 1.6, OUT);
      break;
    case 'scarab':
      ell(ctx, c, s * 0.56, s * 0.2, s * 0.24, '#4dabf7', OUT, 3);
      line(ctx, c, s * 0.34, c, s * 0.8, OUT, 2);
      ell(ctx, c, s * 0.3, s * 0.1, s * 0.08, '#1c7ed6', OUT, 2.5);
      for (const sx of [-1, 1])
        for (let i = 0; i < 3; i++) line(ctx, c + sx * s * 0.18, s * (0.48 + i * 0.12), c + sx * s * 0.32, s * (0.42 + i * 0.16), OUT, 2.5);
      ell(ctx, c, s * 0.15, s * 0.1, s * 0.1, '#ffd43b', OUT, 2);
      break;
    case 'sun':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        line(ctx, c + Math.cos(a) * s * 0.22, c + Math.sin(a) * s * 0.22, c + Math.cos(a) * s * 0.36, c + Math.sin(a) * s * 0.36, '#f59f00', 4);
      }
      ell(ctx, c, c, s * 0.2, s * 0.2, '#ffd43b', OUT, 3);
      ell(ctx, c - s * 0.07, c - s * 0.03, 2, 2, OUT);
      ell(ctx, c + s * 0.07, c - s * 0.03, 2, 2, OUT);
      ctx.beginPath();
      ctx.arc(c, c + s * 0.03, s * 0.08, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case 'cat':
      ell(ctx, c, s * 0.64, s * 0.17, s * 0.2, '#343a40', OUT, 2.5);
      ell(ctx, c, s * 0.34, s * 0.13, s * 0.12, '#343a40', OUT, 2.5);
      poly(ctx, [c - s * 0.12, s * 0.28, c - s * 0.1, s * 0.12, c - s * 0.02, s * 0.24], '#343a40', OUT, 2);
      poly(ctx, [c + s * 0.12, s * 0.28, c + s * 0.1, s * 0.12, c + s * 0.02, s * 0.24], '#343a40', OUT, 2);
      ell(ctx, c - s * 0.05, s * 0.33, 2.4, 2.4, '#ffd43b');
      ell(ctx, c + s * 0.05, s * 0.33, 2.4, 2.4, '#ffd43b');
      ctx.beginPath();
      ctx.moveTo(c + s * 0.15, s * 0.78);
      ctx.quadraticCurveTo(c + s * 0.34, s * 0.78, c + s * 0.3, s * 0.56);
      ctx.strokeStyle = '#343a40';
      ctx.lineWidth = 4;
      ctx.stroke();
      fillRR(ctx, c - s * 0.1, s * 0.44, s * 0.2, s * 0.05, 2, '#ffd43b', OUT, 1);
      break;
    case 'palm':
      ctx.beginPath();
      ctx.moveTo(c - s * 0.04, s * 0.86);
      ctx.quadraticCurveTo(c + s * 0.06, s * 0.55, c, s * 0.3);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = '#a8703f';
      ctx.lineWidth = 5;
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        ell(ctx, c + Math.cos(a) * s * 0.2, s * 0.3 + Math.sin(a) * s * 0.1 + s * 0.06, s * 0.2, s * 0.06, '#40c057', OUT, 2, a);
      }
      ell(ctx, c - s * 0.05, s * 0.36, s * 0.04, s * 0.04, '#8d5524', OUT, 1.5);
      ell(ctx, c + s * 0.04, s * 0.37, s * 0.04, s * 0.04, '#8d5524', OUT, 1.5);
      break;
    case 'jug':
      ctx.beginPath();
      ctx.moveTo(c - s * 0.1, s * 0.22);
      ctx.lineTo(c + s * 0.1, s * 0.22);
      ctx.quadraticCurveTo(c + s * 0.06, s * 0.34, c + s * 0.22, s * 0.5);
      ctx.quadraticCurveTo(c + s * 0.3, s * 0.76, c, s * 0.84);
      ctx.quadraticCurveTo(c - s * 0.3, s * 0.76, c - s * 0.22, s * 0.5);
      ctx.quadraticCurveTo(c - s * 0.06, s * 0.34, c - s * 0.1, s * 0.22);
      ctx.fillStyle = '#e8590c';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3;
      ctx.stroke();
      line(ctx, c - s * 0.22, s * 0.58, c + s * 0.22, s * 0.58, '#ffd43b', 3);
      line(ctx, c - s * 0.2, s * 0.66, c + s * 0.2, s * 0.66, '#4dabf7', 2.5);
      fillRR(ctx, c - s * 0.12, s * 0.18, s * 0.24, s * 0.06, 2, '#c2410c', OUT, 2);
      break;
    default:
      // лотос
      for (const [a, col] of [
        [-0.9, '#f783ac'],
        [0.9, '#f783ac'],
        [-0.45, '#faa2c1'],
        [0.45, '#faa2c1'],
        [0, '#fcc2d7'],
      ])
        ell(ctx, c + Math.sin(a) * s * 0.14, s * 0.48 - Math.cos(a) * s * 0.08, s * 0.08, s * 0.2, col, OUT, 2.5, a);
      ell(ctx, c, s * 0.66, s * 0.3, s * 0.07, '#40c057', OUT, 2.5);
      line(ctx, c, s * 0.72, c, s * 0.88, '#2f9e44', 3);
  }
  ctx.restore();
}
/** Рубашка таблички: песчаник с глазом-иероглифом. */
function back(ctx, s) {
  const c = s / 2;
  ctx.strokeStyle = 'rgba(110,60,25,.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c - s * 0.22, c);
  ctx.quadraticCurveTo(c, c - s * 0.18, c + s * 0.22, c);
  ctx.quadraticCurveTo(c, c + s * 0.14, c - s * 0.22, c);
  ctx.stroke();
  ell(ctx, c, c, s * 0.06, s * 0.06, 'rgba(110,60,25,.6)');
  ctx.beginPath();
  ctx.moveTo(c - s * 0.02, c + s * 0.1);
  ctx.quadraticCurveTo(c - s * 0.05, c + s * 0.26, c - s * 0.16, c + s * 0.24);
  ctx.stroke();
}
const imgCache = {};
/** Картинка таблички (data: URL), один раз на символ. */
function faceImg(id) {
  if (imgCache[id]) return imgCache[id];
  const S = 120,
    c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  if (id === 'back') back(x, S);
  else symbol(x, id, S);
  return (imgCache[id] = c.toDataURL());
}

const CSS = `
.pr-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 10px 14px;box-sizing:border-box;background:linear-gradient(#f0c987,#d29a5c)}
.pr-wall{position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(120,70,30,.18) 0 2px,transparent 2px 46px),repeating-linear-gradient(90deg,rgba(120,70,30,.12) 0 2px,transparent 2px 92px);pointer-events:none}
.pr-grid{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:min(94vw,520px,calc((100vh - 170px) * 1.33))}
.pr-card{position:relative;aspect-ratio:1;border:3px solid #4a3728;border-radius:14px;background:#e9c58a;box-shadow:0 4px 0 rgba(74,55,40,.35);padding:0;cursor:pointer;transition:transform .18s;overflow:hidden}
.pr-card img{position:absolute;inset:6%;width:88%;height:88%;pointer-events:none}
.pr-card .face{opacity:0;transition:opacity .15s}
.pr-card.open{background:#fff9db;transform:translateY(-3px)}
.pr-card.open .face{opacity:1}
.pr-card.open .bk{opacity:0}
.pr-card.done{background:#d3f9d8;border-color:#2b8a3e;cursor:default}
.pr-card.miss{animation:prshake .35s}
@keyframes prshake{0%,100%{transform:translateX(0)}30%{transform:translateX(-5px)}70%{transform:translateX(5px)}}
.pr-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.pr-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.pr-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.pr-col{background:#fff;border-radius:14px;padding:6px 10px;border:3px solid #ffc078;text-align:center;min-width:120px}
.pr-col.ok{border-color:#8ce99a}
.pr-col.no{border-color:#ffa8a8}
.pr-col b{display:block;font-size:15px}
.pr-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.pr-col img{width:44px;height:44px;margin:4px 2px;border:2px solid #4a3728;border-radius:8px;background:#fff9db}
.pr-col img.bk{background:#e9c58a}
`;

export default {
  id: 'pairs',
  title: 'Загадка пирамиды',
  icon: '🔺',
  css: CSS,
  get howTo() {
    const im = (id) => `<img class="${id === 'back' ? 'bk' : ''}" src="${faceImg(id)}" alt="">`;
    return `На стене пирамиды — каменные таблички. <b>Найди пары одинаковых картинок!</b>
      <div class="pr-rules">
        <div class="pr-col"><b>👆 Открой две</b>${im('back')}${im('back')}<small>нажми на таблички</small></div>
        <div class="pr-col ok"><b>✅ Одинаковые</b>${im('camel')}${im('camel')}<small>остаются открытыми</small></div>
        <div class="pr-col no"><b>🔄 Разные</b>${im('sun')}${im('cat')}<small>закроются — запомни их!</small></div>
      </div>
      Открой все ${PAIRS} пар. Меньше промахов — больше звёзд!`;
  },
  start(host) {
    const wrap = el('div', 'pr-wrap');
    wrap.appendChild(el('div', 'pr-wall'));
    const top = el('div', 'pr-top');
    const tPairs = el('div', 'pr-chip'),
      tMiss = el('div', 'pr-chip');
    top.append(tPairs, tMiss);
    const grid = el('div', 'pr-grid');
    wrap.appendChild(grid);
    host.add(wrap, top);
    const ids = shuffle(SYMBOLS).slice(0, PAIRS);
    const deck = shuffle([...ids, ...ids]);
    const open = [],
      done = new Set();
    let miss = 0,
      busy = false,
      over = false;
    const later = host.later;
    const show = () => {
      tPairs.textContent = `🔺 Пары: ${done.size / 2} из ${PAIRS}`;
      tMiss.textContent = `🔄 Промахи: ${miss}`;
    };
    const cards = deck.map((id, i) => {
      const b = el('button', 'pr-card', `<img class="bk" src="${faceImg('back')}" alt=""><img class="face" src="${faceImg(id)}" alt="">`);
      b.dataset.i = i;
      b.onclick = () => flip(i);
      grid.appendChild(b);
      return b;
    });
    function flip(i) {
      if (over || busy || done.has(i) || open.includes(i)) return;
      host.sfx('tap');
      open.push(i);
      cards[i].classList.add('open');
      if (open.length < 2) return;
      const [a, b] = open;
      if (deck[a] === deck[b]) {
        done.add(a);
        done.add(b);
        open.length = 0;
        host.sfx('ok');
        for (const k of [a, b]) cards[k].classList.add('done');
        show();
        if (done.size === deck.length) {
          over = true;
          host.sfx('win');
          later(finish, 900);
        }
        return;
      }
      miss++;
      busy = true;
      show();
      later(() => {
        for (const k of [a, b]) {
          cards[k].classList.remove('open');
          cards[k].classList.add('miss');
        }
        host.sfx('thud');
        later(() => {
          for (const k of [a, b]) cards[k].classList.remove('miss');
        }, 360);
        open.length = 0;
        busy = false;
      }, 800);
    }
    // для автотеста (dev/smoke_desert.js): что на табличках и что уже открыто
    grid.__pairs = () => ({ deck: [...deck], done: [...done], open: [...open], miss, busy, over });
    show();
    function finish() {
      const stars = miss <= PAIR_STARS[0] ? 3 : miss <= PAIR_STARS[1] ? 2 : 1;
      host.finish({
        stars,
        text: `Все пары найдены${miss ? `, промахов — ${miss}` : ' без единого промаха'}!${stars === 3 ? ' Пирамида открыла тебе свою тайну 🔺' : ' Таблички довольны — попробуй ещё, с меньшим числом промахов!'}`,
        extra: { miss },
      });
    }
  },
};

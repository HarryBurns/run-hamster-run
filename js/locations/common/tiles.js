// ОБЩИЕ ВИДЫ КЛЕТОК земли — для любых локаций «вид сверху» (как описывать вид — engine/topdown/kinds.js).
//
//   g  трава (зимой — снег)        r  дорога, плитка           y  утоптанная дорожка
//   s  песок                       p  плитка у бассейна        i  доски (пирс, мостик)
//   I  снег и лёд (ледяной остров) h  мелководье: можно зайти  w  глубокая вода: можно плыть
//   O  открытое море: пешком и вплавь нельзя                   o  бассейн
//   d  пруд: летом вода (не зайти), зимой лёд — каток          k  брусчатка площади
//
// Свою клетку локация добавляет у себя: defineTiles({ имя: { … } }).
import { cal } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { clamp } from '../../core/util.js';
import { ell, line, mix } from '../../core/draw.js';
import { T, defineTiles, hash } from '../../engine/topdown/kinds.js';

/** Цвета земли по сезонам: трава (две клетки в шашечку), дорога, песок, листва. */
export const PAL = {
  winter: { g1: '#f6fbff', g2: '#eaf4fb', r1: '#e8e6e0', r2: '#dcd9d2', s: '#f3ead2', leaf: '#ffffff' },
  spring: { g1: '#a8e67a', g2: '#9be06c', r1: '#f0e0c0', r2: '#e6d4b0', s: '#ffe9a8', leaf: '#63c94d' },
  summer: { g1: '#86db5c', g2: '#7ad24f', r1: '#f0e0c0', r2: '#e6d4b0', s: '#ffe9a8', leaf: '#2f9e44' },
  autumn: { g1: '#cdd36a', g2: '#c2c85c', r1: '#ecd9b8', r2: '#e0cca6', s: '#f7dfa0', leaf: '#f08c00' },
};
const isWinter = () => cal().season === 'winter';

// чем дальше от берега (описание.water.shoreY), тем темнее вода
const DEEP = {};
function deepCol(ty, season, shoreY) {
  const k = season + ty + ':' + shoreY;
  if (!DEEP[k])
    DEEP[k] = mix(
      season === 'winter' ? '#5aa9cf' : '#3fb0ea',
      season === 'winter' ? '#2f6f9c' : '#1c6fc4',
      clamp((ty - shoreY) / 14, 0, 1),
    );
  return DEEP[k];
}
/** Вода: мелкая (shallow) или глубокая, с бегущей волной; у кромки берега (water.foamY) — пена. */
const sea = (shallow) => (ctx, x, y, tx, ty, env) => {
  const season = env.season,
    wt = env.map.water,
    t = env.t;
  ctx.fillStyle = shallow ? (season === 'winter' ? '#9fd8ee' : '#7fdcf7') : deepCol(ty, season, wt.shoreY || 0);
  ctx.fillRect(x, y, T + 1, T + 1);
  const ph = t * 1.2 + tx * 0.9 + ty * 1.7;
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const wx = x + 8 + Math.sin(ph) * 6,
    wy = y + 16 + hash(tx, ty) * 20;
  ctx.moveTo(wx, wy);
  ctx.quadraticCurveTo(wx + 8, wy - 5, wx + 16, wy);
  ctx.quadraticCurveTo(wx + 24, wy + 5, wx + 30, wy);
  ctx.stroke();
  if (shallow && ty === wt.foamY) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillRect(x, y + Math.sin(t * 1.5 + tx) * 3 - 1, T + 1, 5);
  }
};

defineTiles({
  g: {
    map: (env) => PAL[env.season].g1,
    step: () => (isWinter() ? 'stepSnow' : 'step'),
    draw(ctx, x, y, tx, ty, env) {
      const pal = PAL[env.season];
      ctx.fillStyle = (tx + ty) % 2 ? pal.g1 : pal.g2;
      ctx.fillRect(x, y, T + 1, T + 1);
      const hsh = hash(tx, ty);
      if (hsh < 0.3) {
        ctx.fillStyle = env.season === 'winter' ? 'rgba(180,210,235,.5)' : 'rgba(0,0,0,.06)';
        ctx.fillRect(x + hsh * 90, y + 12 + hsh * 60, 9, 3);
        ctx.fillRect(x + 30 - hsh * 40, y + 34, 7, 3);
      }
    },
  },
  r: {
    map: '#eadcc0',
    draw(ctx, x, y, tx, ty, env) {
      const pal = PAL[env.season];
      ctx.fillStyle = (tx + ty) % 2 ? pal.r1 : pal.r2;
      ctx.fillRect(x, y, T + 1, T + 1);
      ctx.fillStyle = 'rgba(0,0,0,.05)';
      ctx.fillRect(x, y, T, 2);
      ctx.fillRect(x, y, 2, T);
    },
  },
  k: {
    map: '#e3d3c3',
    draw(ctx, x, y, tx, ty, env) {
      ctx.fillStyle =
        env.season === 'winter' ? ((tx + ty) % 2 ? '#ece8e4' : '#e2ddd8') : (tx + ty) % 2 ? '#ecdccb' : '#e2cfbb';
      ctx.fillRect(x, y, T + 1, T + 1);
      ctx.fillStyle = 'rgba(0,0,0,.06)';
      ctx.fillRect(x, y + T / 2, T, 1.5);
      ctx.fillRect(x + T / 2, y, 1.5, T);
    },
  },
  y: {
    map: '#ead9b5',
    draw(ctx, x, y, tx, ty, env) {
      ctx.fillStyle = env.season === 'winter' ? '#e4e0d8' : '#ead9b5';
      ctx.fillRect(x, y, T + 1, T + 1);
      ell(ctx, x + 13, y + 14, 9, 7, 'rgba(0,0,0,.07)');
      ell(ctx, x + 34, y + 30, 10, 8, 'rgba(0,0,0,.07)');
      ell(ctx, x + 12, y + 37, 6, 5, 'rgba(0,0,0,.06)');
    },
  },
  p: {
    map: '#f1f3f5',
    draw(ctx, x, y, tx, ty) {
      ctx.fillStyle = (tx + ty) % 2 ? '#f8f9fa' : '#e9f2f7';
      ctx.fillRect(x, y, T + 1, T + 1);
    },
  },
  s: {
    map: (env) => PAL[env.season].s,
    step: 'stepSand',
    draw(ctx, x, y, tx, ty, env) {
      ctx.fillStyle = PAL[env.season].s;
      ctx.fillRect(x, y, T + 1, T + 1);
      if (hash(tx, ty) < 0.5) {
        ctx.fillStyle = 'rgba(190,140,60,.25)';
        ctx.fillRect(x + hash(ty, tx) * 40, y + hash(tx + 3, ty) * 40, 3, 3);
        ctx.fillRect(x + hash(ty + 5, tx) * 40, y + hash(tx, ty + 9) * 40, 3, 3);
      }
    },
  },
  I: {
    map: '#eef8ff',
    step: 'stepSnow',
    draw(ctx, x, y, tx, ty) {
      ctx.fillStyle = (tx + ty) % 2 ? '#f4fbff' : '#e6f4fd';
      ctx.fillRect(x, y, T + 1, T + 1);
      if (hash(tx, ty) < 0.4) {
        line(ctx, x + 10, y + 14, x + 24, y + 20, 'rgba(160,205,235,.8)', 2);
        line(ctx, x + 28, y + 34, x + 40, y + 30, 'rgba(160,205,235,.8)', 2);
      }
    },
  },
  h: {
    map: '#7fdcf7',
    wet: true,
    swim: { clip: -30, where: 'sea' },
    speed: 140,
    step: 'paddle',
    stepEvery: 0.5,
    draw: sea(true),
  },
  w: {
    map: '#3fb0ea',
    wet: true,
    swim: { clip: -38, where: 'sea' },
    speed: 170,
    step: 'paddle',
    stepEvery: 0.5,
    draw: sea(false),
  },
  O: { map: '#1c6fc4', walk: false, step: 'paddle', stepEvery: 0.5, draw: sea(false) },
  o: {
    map: '#58c6f2',
    wet: true,
    swim: { clip: -30, where: 'pool' },
    speed: 140,
    step: 'paddle',
    stepEvery: 0.5,
    draw(ctx, x, y, tx, ty, env) {
      ctx.fillStyle = (tx + ty) % 2 ? '#62cdf7' : '#58c6f2';
      ctx.fillRect(x, y, T + 1, T + 1);
      const ph = env.t * 1.6 + tx * 1.3 + ty * 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6 + Math.sin(ph) * 4, y + 14);
      ctx.quadraticCurveTo(x + 20, y + 8 + Math.cos(ph) * 4, x + 38 + Math.sin(ph) * 4, y + 16);
      ctx.moveTo(x + 10 - Math.sin(ph) * 4, y + 36);
      ctx.quadraticCurveTo(x + 26, y + 30 + Math.sin(ph) * 4, x + 42, y + 38);
      ctx.stroke();
    },
  },
  d: {
    map: (env) => (env.season === 'winter' ? '#d9f1ff' : '#5db6dc'),
    wet: true,
    walk: isWinter,
    slide: true,
    speed: 270,
    step: 'skate',
    stepEvery: 0.45,
    onEnter: () => emit('skate'),
    draw(ctx, x, y, tx, ty, env) {
      if (env.season === 'winter') {
        ctx.fillStyle = (tx + ty) % 2 ? '#d9f1ff' : '#cdeafc';
        ctx.fillRect(x, y, T + 1, T + 1);
        line(ctx, x + 8, y + 12, x + 26, y + 20, 'rgba(255,255,255,.9)', 2);
        line(ctx, x + 22, y + 34, x + 40, y + 30, 'rgba(255,255,255,.9)', 2);
      } else {
        ctx.fillStyle = '#5db6dc';
        ctx.fillRect(x, y, T + 1, T + 1);
        if (hash(tx, ty) < 0.35) {
          ell(ctx, x + 24, y + 24, 11, 8, '#51cf66', '#2f9e44', 1.5);
          if (hash(ty, tx) < 0.5) ell(ctx, x + 26, y + 22, 4, 4, '#ff8fab');
        }
      }
    },
  },
  i: {
    map: '#c98b5a',
    step: 'stepWood',
    draw(ctx, x, y) {
      ctx.fillStyle = '#c98b5a';
      ctx.fillRect(x, y, T + 1, T + 1);
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.fillRect(x, y + 15, T, 2);
      ctx.fillRect(x, y + 31, T, 2);
      ctx.fillRect(x, y + 47, T, 2);
    },
  },
});

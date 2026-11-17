// ПРЕДМЕТЫ ДЛЯ ДВОРА (этап 17б) — то, чем хозяйка украшает двор виллы и дворик бунгало (features/yard.js).
//
//   yardBush       стриженый кустик-шарик                       yardLantern    садовый фонарик (ночью светит)
//   yardGarland    гирлянда на двух колышках (ночью светит)     yardPool       бассейн-лягушатник (в нём можно посидеть)
//   yardGnome      садовый гномик                               yardFlamingo   розовый фламинго
//   yardBirdbath   купальня для птичек
// Клумбы, скамейка и качели двора — общие виды (flowerbed, bench, swing). Что из этого продаётся и почём —
// YARD_ITEMS в data/buddy.js. Всё неподвижное — спрайты (art); сезон и «горит свет» — параметры put().
import { TAU } from '../../core/util.js';
import { ell, fillRR, line, poly } from '../../core/draw.js';
import { OUT, put, defineObjects } from '../../engine/topdown/kinds.js';
import { seat } from './seats.js';
import { shadow, snowCap, leafTones, puff, STONE, STONE_D, LIT } from './paint.js';

const W = (sea) => (sea === 'winter' ? 1 : 0);
const BULBS = ['#ff6b9d', '#ffd43b', '#63e6be', '#74c0fc', '#b197fc'];

defineObjects({
  yardBush: {
    solid: true,
    art: {
      yardBush: [
        [-24, -52, 26, 20],
        (ctx, sea) => {
          shadow(ctx, 0, 13, 16, 5);
          line(ctx, 0, 12, 0, -8, OUT, 6);
          line(ctx, 0, 12, 0, -8, '#a8703f', 3.4);
          const tones = leafTones(sea, 1);
          puff(ctx, 0, -24, 19, 19, tones);
          if (sea === 'winter') snowCap(ctx, 0, -38, 26, 7);
          else if (sea === 'spring')
            for (const [dx, dy] of [
              [-8, -30],
              [7, -20],
              [2, -36],
              [-4, -16],
            ])
              ell(ctx, dx, dy, 2.4, 2.4, '#ffd6e7');
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardBush', o.x, o.y, env.season);
    },
  },
  yardLantern: {
    solid: true,
    light: [0, -24, 86],
    art: {
      yardLantern: [
        [-16, -56, 16, 20],
        (ctx, lit, snow) => {
          shadow(ctx, 0, 13, 9, 3.5);
          line(ctx, 0, 13, 0, -18, OUT, 5);
          line(ctx, 0, 13, 0, -18, '#5b6676', 2.6);
          if (lit) ell(ctx, 0, -29, 15, 15, 'rgba(255,228,138,.35)');
          fillRR(ctx, -7, -40, 14, 21, 4, lit ? LIT : '#e7f5ff', OUT, 1.8);
          line(ctx, 0, -39, 0, -20, 'rgba(74,55,40,.45)', 1);
          line(ctx, -6, -30, 6, -30, 'rgba(74,55,40,.45)', 1);
          if (lit) ell(ctx, 0, -29, 3, 5, '#fff8dc');
          poly(ctx, [-10, -40, 0, -49, 10, -40], '#ff8fab', OUT, 1.8);
          ell(ctx, 0, -50, 2, 2, '#ffd43b', OUT, 1.2);
          if (snow) snowCap(ctx, 0, -45, 18, 5);
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardLantern', o.x, o.y, env.dark > 0.3 ? 1 : 0, W(env.season));
    },
  },
  yardGarland: {
    solid: true,
    light: [0, -34, 96],
    art: {
      yardGarland: [
        [-28, -64, 28, 20],
        (ctx, lit, snow) => {
          shadow(ctx, 0, 13, 22, 4);
          for (const sx of [-1, 1]) {
            line(ctx, sx * 20, 13, sx * 20, -50, OUT, 5);
            line(ctx, sx * 20, 13, sx * 20, -50, '#c98b5a', 2.8);
            ell(ctx, sx * 20, -52, 3, 3, '#ffd43b', OUT, 1.4);
          }
          // провод провисает между колышками, на нём цветные лампочки
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-20, -48);
          ctx.quadraticCurveTo(0, -30, 20, -48);
          ctx.stroke();
          for (let i = 0; i < 5; i++) {
            const k = (i + 0.5) / 5,
              x = -20 + 40 * k,
              yy = -45 + 36 * k * (1 - k); // точка на проводе — чуть ниже него
            if (lit) ell(ctx, x, yy + 2, 7, 7, 'rgba(255,240,180,.4)');
            ell(ctx, x, yy + 2, 3.2, 4.2, BULBS[i], OUT, 1.2);
            if (lit) ell(ctx, x - 0.8, yy + 1, 1.1, 1.6, '#fff');
          }
          if (snow) for (const sx of [-1, 1]) snowCap(ctx, sx * 20, -54, 9, 4);
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardGarland', o.x, o.y, env.dark > 0.3 ? 1 : 0, W(env.season));
    },
  },
  yardPool: {
    solid: true,
    ...seat('sit', [[0, 8, 0, 34]], { dx: 26, up: 24, down: 20 }),
    art: {
      yardPool: [
        [-28, -22, 29, 22],
        (ctx, snow) => {
          shadow(ctx, 0, 9, 26, 9);
          // надувной бортик в полоску
          ell(ctx, 0, 2, 25, 15, '#74c0fc', OUT, 2);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 2, 25, 15, 0, 0, TAU);
          ctx.clip();
          ctx.fillStyle = '#fff';
          for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 9 - 2, -16);
            ctx.lineTo(i * 9 + 2, -16);
            ctx.lineTo(i * 12 + 3, 20);
            ctx.lineTo(i * 12 - 3, 20);
            ctx.fill();
          }
          ctx.restore();
          ell(ctx, 0, 2, 25, 15, null, OUT, 2);
          // вода (зимой — лёд)
          ell(ctx, 0, 0, 18, 9.5, snow ? '#e3f4ff' : '#4dd4f0', OUT, 1.6);
          if (snow) {
            line(ctx, -8, -2, 2, 3, 'rgba(255,255,255,.9)', 1.4);
            line(ctx, 4, -4, 10, 0, 'rgba(255,255,255,.9)', 1.4);
          } else {
            ctx.strokeStyle = 'rgba(255,255,255,.8)';
            ctx.lineWidth = 1.4;
            for (const [x, y, r] of [
              [-7, -2, 5],
              [6, 2, 4],
            ]) {
              ctx.beginPath();
              ctx.ellipse(x, y, r, r * 0.45, 0, Math.PI, TAU);
              ctx.stroke();
            }
            // уточка
            ell(ctx, 9, -3, 4.2, 3, '#ffd43b', OUT, 1.2);
            ell(ctx, 12, -6.5, 2.6, 2.6, '#ffd43b', OUT, 1.2);
            poly(ctx, [14, -6.5, 17, -5.6, 14, -5], '#ff922b', OUT, 0.8);
            ell(ctx, 12.6, -7.1, 0.6, 0.6, OUT);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardPool', o.x, o.y, W(env.season));
    },
  },
  yardGnome: {
    solid: true,
    art: {
      yardGnome: [
        [-16, -46, 17, 20],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 11, 4);
          // сапожки, кафтан, борода, нос, колпак
          ell(ctx, -5, 12, 5, 3, '#6b4a2f', OUT, 1.4);
          ell(ctx, 5, 12, 5, 3, '#6b4a2f', OUT, 1.4);
          fillRR(ctx, -9, -8, 18, 20, 7, '#4dabf7', OUT, 1.8);
          line(ctx, -9, 3, 9, 3, '#6b4a2f', 2.4);
          ell(ctx, 0, 3, 2, 2, '#ffd43b', OUT, 1);
          ell(ctx, 0, -14, 8.5, 7.5, '#ffe0c2', OUT, 1.6);
          poly(ctx, [-8, -12, 0, 4, 8, -12, 4, -9, 0, -11, -4, -9], '#fff', OUT, 1.4);
          ell(ctx, 0, -13, 2.6, 2.2, '#ffb3a1', OUT, 1);
          ell(ctx, -3.6, -16, 0.9, 1.1, OUT);
          ell(ctx, 3.6, -16, 0.9, 1.1, OUT);
          poly(ctx, [-10, -19, 0, -42, 10, -19], '#fa5252', OUT, 1.8);
          if (snow) ell(ctx, 0, -40, 4, 3, '#fff', '#cfe3f0', 1);
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardGnome', o.x, o.y, W(env.season));
    },
  },
  yardFlamingo: {
    solid: true,
    art: {
      yardFlamingo: [
        [-20, -60, 20, 20],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 10, 3.5);
          line(ctx, 1, 13, 1, -18, '#f783ac', 2);
          line(ctx, 1, 0, -5, -12, '#f783ac', 2); // поджатая нога
          ell(ctx, 0, -24, 12, 9, '#ff8fab', OUT, 1.8, -0.15);
          ell(ctx, -5, -23, 7, 5, '#ffa8c5', null, 0, 0.3);
          // шея буквой S и голова
          ctx.lineCap = 'round';
          for (const [col, lw] of [
            [OUT, 7.4],
            ['#ff8fab', 4.6],
          ]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(8, -28);
            ctx.bezierCurveTo(18, -36, 2, -42, 8, -51);
            ctx.stroke();
          }
          ctx.lineCap = 'butt';
          ell(ctx, 9, -52, 5, 4.6, '#ff8fab', OUT, 1.6);
          poly(ctx, [13, -53, 19, -50, 14, -47], '#fff3bf', OUT, 1.2);
          poly(ctx, [16.5, -50.6, 19, -50, 15.5, -48], OUT);
          ell(ctx, 9.6, -53, 0.9, 0.9, OUT);
          if (snow) ell(ctx, -1, -32, 8, 2.6, '#fff', '#cfe3f0', 1);
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardFlamingo', o.x, o.y, W(env.season));
    },
  },
  yardBirdbath: {
    solid: true,
    art: {
      yardBirdbath: [
        [-22, -50, 23, 20],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 14, 4.5);
          ell(ctx, 0, 11, 11, 4.5, STONE, OUT, 1.8);
          fillRR(ctx, -4, -16, 8, 28, 3, STONE, OUT, 1.8);
          line(ctx, 2, -14, 2, 9, STONE_D, 1.6);
          ell(ctx, 0, -20, 19, 7, STONE, OUT, 2);
          ell(ctx, 0, -21, 15, 4.6, snow ? '#fff' : '#74d4f5', OUT, 1.2);
          if (!snow) {
            line(ctx, -8, -21.5, -2, -21.5, 'rgba(255,255,255,.85)', 1.2);
            // птичка на краю
            ell(ctx, 11, -29, 5, 4, '#ffa94d', OUT, 1.3);
            ell(ctx, 14.5, -32.5, 3, 3, '#ffa94d', OUT, 1.3);
            poly(ctx, [17, -32.6, 20.4, -31.6, 17, -30.8], '#ffd43b', OUT, 0.8);
            ell(ctx, 15.2, -33.2, 0.6, 0.6, OUT);
            poly(ctx, [7, -30, 2, -33, 8, -27], '#e8590c', OUT, 1);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('yardBirdbath', o.x, o.y, W(env.season));
    },
  },
});

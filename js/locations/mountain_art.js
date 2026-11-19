// ГОРА (П.9): рисунки клеток, предметов и зданий, которые есть только на горе. Где что стоит — locations/mountain.js.
// Всё неподвижное — в кэше спрайтов (art + put), сезон и «снег» — параметрами put; шевелится (водопад, флаг, пар
// над источником, коровы) — сдвигом готового спрайта или линиями поверх. Стиль — как у города и леса
// (common/paint.js): контур OUT, объём в 2–3 тона, свет слева сверху, мягкая тень на земле.
//
// Клетки:  snowCap — вечный снег на вершине (в любой сезон), snowPath — тропинка в снегу, skiRun — накатанная
//          трасса для санок, hotSpring — горячий источник (не зайти: окунаются через особое место).
//          Горный ручей — та же клетка brook, что в лесу (forest_art.js).
// Предметы: alpineFir (ель; у вершины — всегда в снегу), mtRock (валун), crag (скала), alpFlowers (горные цветы
//          по сезону), edelweiss (эдельвейс — виден, пока его можно сорвать), caveRock (скала со входом в пещеры
//          и замочком), fallRock (уступ с водопадом), flagPole (флаг на вершине), viewer (подзорная труба),
//          skiFlag (флажок трассы), snowman (снеговик по шагам), cow (корова — рисует крюк things).
// Здание:  cableway (станция канатной дороги — из forest_art.js; на горе трос уходит вниз), дорисовка шале
//          инструктора Вершинкина — chaletArt (здание house).
import { TAU } from '../core/util.js';
import { G } from '../core/state.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { T, OUT, SP, put, hash, defineTiles, defineObjects, defineArt } from '../engine/topdown/index.js';
import { shadow, flower, WOOD, WOOD_D, WOOD_L, STONE, STONE_D, SNOW_D } from './common/paint.js';
import { treeDot } from './common/objects.js';
import './forest_art.js'; // ель (spruce), ручей (brook) и станция канатной дороги (cableway)

// ---------- клетки ----------
/** Сугробы, искорки и редкие следы на вечном снегу. */
function snowDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.45) {
    const cx = x + 8 + r(2) * 30,
      cy = y + 10 + r(3) * 26,
      w = 10 + r(4) * 10;
    ell(ctx, cx, cy + 2, w, 4.5, '#d3e5f3');
    ell(ctx, cx - 1, cy, w, 4.5, '#ffffff');
  }
  if (r(5) < 0.5) {
    ctx.fillStyle = 'rgba(160,200,235,.7)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + r(6 + i) * T, y + r(9 + i) * T, 1.6, 1.6);
  }
  if (r(12) < 0.06)
    for (let i = 0; i < 3; i++) {
      // следы зайчика-беляка
      ell(ctx, x + 10 + i * 12, y + 30 - i * 7, 2.4, 3.2, 'rgba(140,175,210,.5)');
      ell(ctx, x + 14 + i * 12, y + 26 - i * 7, 2, 2.6, 'rgba(140,175,210,.5)');
    }
}
/** Тропинка в снегу: утоптанная, с цепочкой следов. */
function snowPathDeco(ctx, x, y, tx, ty, env, r) {
  ctx.fillStyle = 'rgba(150,180,210,.35)';
  for (let i = 0; i < 2; i++) ell(ctx, x + 14 + r(i) * 20, y + 10 + i * 22, 3, 4, 'rgba(150,180,210,.35)');
}
/** Трасса для санок: две колеи и искорки. */
function runDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(150,185,215,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const dx of [16, 30]) {
    const wob = Math.sin(ty * 0.9 + dx) * 3;
    ctx.moveTo(x + dx + wob, y);
    ctx.lineTo(x + dx + Math.sin((ty + 1) * 0.9 + dx) * 3, y + T);
  }
  ctx.stroke();
  if (r(3) < 0.4) ell(ctx, x + r(4) * T, y + r(5) * T, 1.2, 1.2, '#ffffff');
}
/** Горячий источник: голубая вода с пузырьками (пар рисует крюк things локации). */
function springDeco(ctx, x, y, tx, ty, env, r) {
  ell(ctx, x + r(1) * T, y + r(2) * T, 10 + r(3) * 8, 5, 'rgba(255,255,255,.18)');
}
function springLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T;
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.7 + hash(cells[i] + k, cells[i + 1]) * 5) % 1,
        bx = x + 8 + hash(cells[i + 1] * 3, cells[i] + k) * 32,
        by = y + T - 8 - ph * 30,
        br = 1.5 + ph * 2;
      ctx.moveTo(bx + br, by);
      ctx.arc(bx, by, br, 0, TAU);
    }
  }
  ctx.fill();
}
// ---------- горный ручей (Г5): быстрая холодная вода с камнями и пеной, без кувшинок; зимой — лёд ----------
const isWinterEnv = (env) => env.season === 'winter';
/** Камни в ручье и пена вокруг них (неподвижное — в кэше земли). */
function mtBrookDeco(ctx, x, y, tx, ty, env, r) {
  const n = r(1) < 0.55 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const cx = x + 10 + r(2 + i) * 28,
      cy = y + 10 + r(5 + i) * 28,
      rr = 5 + r(8 + i) * 5;
    if (!isWinterEnv(env)) ell(ctx, cx, cy + 2, rr + 5, rr * 0.6 + 3, 'rgba(255,255,255,.7)');
    ell(ctx, cx, cy, rr, rr * 0.7, '#9aa3ad', 'rgba(74,55,40,.55)', 1.2);
    ell(ctx, cx - rr * 0.3, cy - rr * 0.25, rr * 0.4, rr * 0.22, '#cfd5db');
  }
  if (isWinterEnv(env)) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + r(11) * T, y + 4);
    ctx.lineTo(x + r(12) * T, y + T - 4);
    ctx.stroke();
  }
}
/** Быстрое течение: белые струйки бегут вниз втрое быстрее, чем в лесном ручье, и пенные барашки. */
function mtBrookLive(ctx, cells, n, env) {
  if (isWinterEnv(env)) return;
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T;
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.9 + hash(cells[i] + k, cells[i + 1]) * 3) % 1,
        cx = x + 6 + hash(cells[i + 1], cells[i] + k * 7) * 36,
        cy = y + ph * T;
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + Math.sin(t * 4 + k) * 1.5, cy + 6);
    }
  }
  ctx.stroke();
}
defineTiles({
  mtBrook: {
    like: 'brook',
    z: 10.05, // своя заливка (у одинакового z она общая с прудом и лесным ручьём)
    map: (env) => (isWinterEnv(env) ? '#d9f1ff' : '#3f97c9'),
    fill: (env) => (isWinterEnv(env) ? '#d3edfb' : '#4aa2d0'),
    edge: {
      wob: 6,
      out: [
        [(env) => (isWinterEnv(env) ? '#c5d9e8' : '#8a929c'), 9], // каменистый берег
        [(env) => (isWinterEnv(env) ? '#e4eff7' : '#b3bac2'), 4],
      ],
      in: [
        [(env) => (isWinterEnv(env) ? 'rgba(140,190,225,.5)' : 'rgba(10,60,110,.3)'), 12],
        ['rgba(255,255,255,.55)', 3],
      ],
    },
    deco: mtBrookDeco,
    live: mtBrookLive,
  },
});
defineTiles({
  snowCap: {
    map: '#f4f9fd',
    step: 'stepSnow',
    z: 4.6, // поверх травы и лесной подстилки, под тропинкой
    fill: '#f4f9fd',
    edge: {
      wob: 9,
      out: [['rgba(120,160,200,.2)', 12]],
      in: [
        ['#e2eef8', 9],
        ['#ffffff', 3],
      ],
    },
    deco: snowDeco,
  },
  snowPath: {
    like: 'y',
    z: 5.05, // свой слой (у слоя одна заливка на всех с тем же z) — над земляной тропинкой
    map: '#c9d8e6',
    step: 'stepSnow',
    fill: '#e1ebf3',
    edge: { wob: 5, out: [['rgba(160,190,215,.5)', 5]], in: [['rgba(170,195,220,.5)', 6]] },
    deco: snowPathDeco,
  },
  skiRun: {
    map: '#e9f3fb',
    step: 'stepSnow',
    z: 4.8,
    fill: '#eef6fc',
    edge: {
      wob: 6,
      out: [['rgba(110,150,190,.22)', 10]],
      in: [['#ffffff', 5]],
    },
    deco: runDeco,
  },
  hotSpring: {
    map: '#63e6be',
    walk: false,
    wet: true,
    z: 9.5,
    fill: '#5fd8c8',
    // бортик из камней, у воды — тёплая кромка
    edge: {
      wob: 6,
      out: [
        ['#4a3728', 13],
        [STONE_D, 10],
        [STONE, 5],
      ],
      in: [
        ['rgba(20,110,120,.25)', 12],
        ['rgba(255,255,255,.5)', 3],
      ],
    },
    deco: springDeco,
    live: springLive,
  },
});

// ---------- камни и скалы ----------
/** Валун: серый камень гранями; snow — снежная шапка. */
function paintRock(ctx, v, snow) {
  shadow(ctx, 0, 12, 24, 7);
  const big = v % 3;
  const pts =
    big === 0
      ? [-22, 12, -20, -6, -8, -22, 8, -20, 22, -6, 20, 12]
      : big === 1
        ? [-16, 12, -15, -4, -4, -14, 10, -11, 17, 1, 15, 12]
        : [-24, 12, -18, -10, -2, -16, 14, -14, 24, 0, 22, 12];
  poly(ctx, pts, STONE, OUT, 2.2);
  poly(ctx, [pts[6], pts[7], pts[8], pts[9], pts[10], pts[11], 4, 12, 2, -2], STONE_D);
  line(ctx, pts[4], pts[5], 2, -2, 'rgba(74,55,40,.35)', 1.3);
  poly(ctx, pts, null, OUT, 2.2);
  ell(ctx, pts[4] + 4, pts[5] + 5, 5, 2.4, 'rgba(255,255,255,.45)');
  if (snow) ell(ctx, (pts[4] + pts[6]) / 2, (pts[5] + pts[7]) / 2 + 2, 14, 5, '#ffffff', SNOW_D, 1.2);
}
/** Скала: две-три остроконечные глыбы, в тени — синеватые; snow — снег на уступах. */
function paintCrag(ctx, v, snow) {
  shadow(ctx, 2, 14, 40, 10);
  const spires =
    v % 2
      ? [
          [-22, 14, -30, -40, -10, -70, 6, -36, 0, 14],
          [-2, 14, 2, -50, 18, -86, 34, -44, 30, 14],
        ]
      : [
          [-34, 14, -36, -26, -18, -58, -4, -30, -6, 14],
          [-12, 14, -8, -56, 8, -92, 22, -54, 24, 14],
          [14, 14, 22, -30, 34, -46, 40, -14, 36, 14],
        ];
  for (const pts of spires) {
    poly(ctx, pts, '#b8c0cc', OUT, 2.4);
    // тёмная грань справа от вершины
    poly(ctx, [pts[4], pts[5], pts[6], pts[7], pts[8], pts[9], (pts[4] + pts[8]) / 2, 14], '#8e98a8');
    ell(ctx, pts[4] - 5, pts[5] + 18, 4, 9, 'rgba(255,255,255,.35)', null, 1, 0.3);
    poly(ctx, pts, null, OUT, 2.4);
    if (snow)
      poly(
        ctx,
        [pts[4] - 7, pts[5] + 14, pts[4], pts[5], pts[4] + 8, pts[5] + 15, pts[4], pts[5] + 10],
        '#ffffff',
        SNOW_D,
        1.2,
      );
  }
}
/** Горные цветы по сезону: весной — крокусы, летом — колокольчики, горечавка, лютики; осенью — сухая трава. */
function paintAlpFlowers(ctx, sea, v) {
  if (sea === 'winter') return;
  if (sea === 'autumn') {
    ctx.strokeStyle = '#b08a3c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = -12 + i * 8;
      ctx.moveTo(x, 6);
      ctx.lineTo(x - 2, -4 - (i % 2) * 3);
      ctx.moveTo(x, 6);
      ctx.lineTo(x + 3, -2);
    }
    ctx.stroke();
    return;
  }
  const cols =
    sea === 'spring'
      ? [
          ['#b197fc', '#ffd43b'],
          ['#ffffff', '#ffd43b'],
          ['#d0bfff', '#ff922b'],
        ]
      : [
          ['#4dabf7', '#fff3bf'],
          ['#ffd43b', '#f08c00'],
          ['#f783ac', '#ffe066'],
        ];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4 + v,
      x = Math.cos(a) * (6 + (i % 3) * 5),
      y = Math.sin(a) * 5 + 2;
    line(ctx, x, y + 4, x, y, '#2f9e44', 1.4);
    const [c, mid] = cols[(i + v) % 3];
    flower(ctx, x, y - 1, 2.8, c, mid);
  }
}
/** Эдельвейс: звёздочка из пушистых белых лепестков с жёлтой серединкой. */
function paintEdelweiss(ctx) {
  ctx.scale(1.3, 1.3);
  ell(ctx, 1, 6, 10, 3.5, 'rgba(52,38,70,.15)');
  line(ctx, 0, 6, 0, -4, '#5c940d', 2);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU - Math.PI / 2;
    ell(ctx, Math.cos(a) * 6.5, -6 + Math.sin(a) * 6.5, 4.8, 2.4, '#f8f9fa', '#adb5bd', 1, a);
  }
  ell(ctx, 0, -6, 3.6, 3.6, '#ffe066', '#e0a800', 1);
  ell(ctx, -1, -7, 1.2, 1.2, '#fff9db');
}

// ---------- вход в пещеры ----------
/** Скала со входом в пещеры: тёмная арка, доски крест-накрест, табличка с замочком. */
function paintCaveRock(ctx, snow, open) {
  shadow(ctx, 0, 16, 84, 12);
  poly(ctx, [-84, 16, -78, -40, -52, -86, -16, -108, 22, -100, 56, -78, 82, -36, 86, 16], '#aeb6c2', OUT, 2.6);
  poly(ctx, [22, -100, 56, -78, 82, -36, 86, 16, 40, 16, 34, -50], '#8e98a8');
  poly(ctx, [-52, -86, -16, -108, -20, -74, -50, -52], 'rgba(255,255,255,.25)');
  poly(ctx, [-84, 16, -78, -40, -52, -86, -16, -108, 22, -100, 56, -78, 82, -36, 86, 16], null, OUT, 2.6);
  // трещинки
  line(ctx, -60, -30, -44, -10, 'rgba(74,55,40,.4)', 1.4);
  line(ctx, 52, -40, 62, -14, 'rgba(74,55,40,.4)', 1.4);
  // арка входа
  ctx.beginPath();
  ctx.moveTo(-26, 16);
  ctx.lineTo(-26, -24);
  ctx.quadraticCurveTo(0, -60, 26, -24);
  ctx.lineTo(26, 16);
  ctx.closePath();
  ctx.fillStyle = '#1f1a24';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ell(ctx, 0, 4, 18, 8, 'rgba(70,60,90,.6)');
  if (open) {
    // пещеры открыты (задание Профессора Орешкина): досок нет, в глубине — тёплый отсвет фонаря Камушкина
    ell(ctx, 0, -6, 14, 18, 'rgba(255,212,120,.28)');
    ell(ctx, 0, -2, 7, 9, 'rgba(255,230,160,.4)');
    line(ctx, -26, 16, -40, -6, OUT, 4);
    line(ctx, -26, 16, -40, -6, WOOD, 2.4);
    fillRR(ctx, -48, -14, 14, 12, 3, '#ffe066', OUT, 1.6);
  } else
    // доски крест-накрест
    for (const [ax, ay, bx, by] of [
      [-24, -24, 24, 6],
      [24, -24, -24, 6],
    ]) {
      line(ctx, ax, ay, bx, by, OUT, 8);
      line(ctx, ax, ay, bx, by, WOOD, 5);
    }
  // табличка: закрыто — замочек, открыто — самоцвет
  fillRR(ctx, -20, -76, 40, 20, 5, WOOD_L, OUT, 2);
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? '💎' : '🔒', 0, -66);
  if (snow) {
    poly(ctx, [-60, -76, -52, -86, -16, -108, 22, -100, 50, -80, 30, -86, 0, -96, -30, -84], '#ffffff', SNOW_D, 1.2);
    ell(ctx, 66, -24, 14, 4, '#ffffff', SNOW_D, 1.1);
    ell(ctx, -70, -20, 12, 4, '#ffffff', SNOW_D, 1.1);
  }
}

// ---------- водопад ----------
/** Уступ, с которого падает водопад (сама вода — линиями поверх, drawFall). */
function paintFallRock(ctx, snow) {
  shadow(ctx, 24, 16, 60, 11);
  poly(ctx, [-36, 16, -32, -50, -8, -92, 30, -104, 64, -86, 84, -40, 82, 16], '#aeb6c2', OUT, 2.6);
  poly(ctx, [30, -104, 64, -86, 84, -40, 82, 16, 52, 16, 48, -60], '#8e98a8');
  poly(ctx, [-36, 16, -32, -50, -8, -92, 30, -104, 64, -86, 84, -40, 82, 16], null, OUT, 2.6);
  // жёлоб, по которому течёт вода
  fillRR(ctx, 10, -88, 28, 104, 12, '#5fa8d3', OUT, 2);
  // омут у подножия
  ell(ctx, 24, 12, 30, 9, '#74c0fc', OUT, 2);
  if (snow) {
    poly(ctx, [-20, -78, -8, -92, 30, -104, 64, -86, 50, -84, 28, -94, 0, -86], '#ffffff', SNOW_D, 1.2);
  }
}
/** Вода водопада: светлые струи бегут вниз, у подножия — пена (каждый кадр, в координатах мира). */
export function drawFall(ctx, x, y, t, frozen, rainbow = 0) {
  if (frozen) {
    // зимой водопад застыл сосульками
    for (let i = 0; i < 5; i++) {
      const sx = x + 13 + i * 5;
      poly(ctx, [sx - 3, y - 86, sx + 3, y - 86, sx, y - 30 - ((i * 13) % 22)], '#e7f5ff', '#a5d8ff', 1);
    }
    return;
  }
  // своя вода горы (Г5): струя шире жёлоба, белые пряди бегут быстро, внизу пена и водяная пыль, днём — радуга
  ctx.fillStyle = 'rgba(160,215,245,.85)';
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 88);
  ctx.lineTo(x + 38, y - 88);
  ctx.lineTo(x + 42, y + 6);
  ctx.lineTo(x + 6, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const sx = x + 12 + i * 5,
      ph = (t * 2.2 + i * 0.29) % 1,
      y0 = y - 88 + ph * 94;
    ctx.moveTo(sx + (i - 2.5) * ph * 0.8, y0);
    ctx.lineTo(sx + (i - 2.5) * (ph + 0.2) * 0.8, Math.min(y + 6, y0 + 18 + (i % 3) * 6));
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = t * 3.4 + i * 0.8,
      fx = x + 24 + Math.cos(a) * (12 + (i % 3) * 6),
      fy = y + 10 + Math.sin(a * 1.3) * 4,
      r = 3.4 + Math.sin(t * 6 + i) * 1.4;
    ctx.moveTo(fx + r, fy);
    ctx.arc(fx, fy, r, 0, TAU);
  }
  ctx.fill();
  // водяная пыль поднимается от омута
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i / 3) % 1;
    ctx.globalAlpha = 0.35 * (1 - ph);
    ell(ctx, x + 24 + (i - 1) * 16, y + 4 - ph * 40, 12 + ph * 14, 7 + ph * 6, '#ffffff');
  }
  ctx.globalAlpha = 1;
  if (rainbow > 0) {
    ctx.globalAlpha = 0.32 * rainbow;
    ctx.lineWidth = 3;
    ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(x + 24, y + 14, 44 - i * 3, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
}

// ---------- флаг, подзорная труба, флажки трассы ----------
function paintFlagPole(ctx) {
  shadow(ctx, 0, 6, 12, 4);
  ell(ctx, 0, 4, 9, 4, STONE_D, OUT, 1.6);
  line(ctx, 0, 4, 0, -104, OUT, 5);
  line(ctx, 0, 4, 0, -104, '#dee2e6', 2.6);
  ell(ctx, 0, -106, 4, 4, '#ffd43b', OUT, 1.4);
}
/** Флаг на вершине: полотнище волнами (каждый кадр). */
export function drawFlag(ctx, x, y, t) {
  const top = y - 100;
  ctx.beginPath();
  ctx.moveTo(x + 2, top);
  for (let i = 0; i <= 6; i++) {
    const fx = x + 2 + i * 7,
      w = Math.sin(t * 5 - i * 0.8) * (1 + i * 0.6);
    ctx.lineTo(fx, top + w);
  }
  for (let i = 6; i >= 0; i--) {
    const fx = x + 2 + i * 7,
      w = Math.sin(t * 5 - i * 0.8) * (1 + i * 0.6);
    ctx.lineTo(fx, top + 26 + w);
  }
  ctx.closePath();
  ctx.fillStyle = '#ff6b9d';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // звёздочка на флаге
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐', x + 22, top + 13 + Math.sin(t * 5 - 3) * 2);
}
function paintViewer(ctx, snow) {
  shadow(ctx, 0, 8, 14, 4);
  line(ctx, -8, 8, 0, -22, OUT, 3);
  line(ctx, 8, 8, 0, -22, OUT, 3);
  line(ctx, 0, 8, 0, -22, OUT, 3);
  fillRR(ctx, -16, -36, 32, 14, 6, '#4dabf7', OUT, 2);
  ell(ctx, -16, -29, 4, 7, '#1c7ed6', OUT, 1.6);
  ell(ctx, 16, -29, 5, 8, '#a5d8ff', OUT, 1.6);
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillRect(-10, -34, 18, 3);
  if (snow) ell(ctx, 0, -37, 12, 3, '#ffffff', SNOW_D, 1);
}
function paintSkiFlag(ctx, v) {
  line(ctx, 0, 6, 0, -34, OUT, 3);
  line(ctx, 0, 6, 0, -34, '#f1f3f5', 1.6);
  poly(ctx, [1, -34, 15, -28, 1, -21], v % 2 ? '#4dabf7' : '#fa5252', OUT, 1.4);
  ell(ctx, 0, 6, 4, 1.6, 'rgba(52,38,70,.2)');
}

// ---------- снеговик (по шагам) и корова ----------
/**
 * Снеговик: stage — сколько уже сделано (0 — ничего, 1–3 — комы, 4 — ведро, 5 — морковка, глазки и ручки-веточки).
 * Комы растут по шагам: size — доля текущего кома (0..1).
 */
function paintSnowman(ctx, stage, grow) {
  if (!stage && !grow) return;
  const balls = [
    [0, -14, 22],
    [0, -44, 16],
    [0, -68, 11],
  ];
  shadow(ctx, 2, 6, 26, 7);
  for (let i = 0; i < 3; i++) {
    let r = balls[i][2];
    if (i >= stage) {
      if (i > stage || !grow) break;
      r *= 0.35 + 0.65 * (grow / 4);
    }
    const [bx, by] = balls[i],
      cy = i < stage ? by : 6 - r; // растущий ком лежит на земле рядом
    const cx = i < stage ? bx : i === 0 ? 0 : 34;
    ell(ctx, cx, cy, r, r * 0.95, '#ffffff', OUT, 2.2);
    ell(ctx, cx + r * 0.3, cy + r * 0.35, r * 0.75, r * 0.5, '#e1edf7');
    ell(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.22, '#ffffff');
  }
  if (stage >= 3) {
    // глазки и пуговки
    ell(ctx, -4, -70, 1.8, 2, OUT);
    ell(ctx, 4, -70, 1.8, 2, OUT);
    for (const y of [-48, -38]) ell(ctx, 0, y, 2.2, 2.2, OUT);
    // ручки-веточки
    line(ctx, -14, -46, -30, -58, '#8d5524', 2.4);
    line(ctx, 14, -46, 30, -56, '#8d5524', 2.4);
    line(ctx, -26, -55, -30, -50, '#8d5524', 1.8);
    line(ctx, 26, -53, 31, -49, '#8d5524', 1.8);
    // улыбка из угольков
    for (let i = 0; i < 5; i++) ell(ctx, -5 + i * 2.5, -63 + Math.sin((i / 4) * Math.PI) * 2, 1, 1, OUT);
  }
  if (stage >= 4) {
    // ведро-шапка
    poly(ctx, [-9, -78, 9, -78, 7, -94, -7, -94], '#74c0fc', OUT, 1.8);
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.fillRect(2, -93, 5, 14);
    line(ctx, -10, -78, 10, -78, OUT, 2.6);
  }
  if (stage >= 5) poly(ctx, [1, -67, 14, -65, 1, -63], '#ff922b', OUT, 1.2);
}
/** Корова: пятнистая, с колокольчиком; dir — куда смотрит, leg — шаг (0/1), eat — опустила голову. */
function paintCow(ctx, dir, leg) {
  ctx.save();
  ctx.scale(dir, 1);
  shadow(ctx, 0, 8, 30, 7);
  // ноги
  for (const [x, k] of [
    [-16, 0],
    [-8, 1],
    [10, 0],
    [17, 1],
  ])
    fillRR(ctx, x - 3, -10 + (leg && k ? -2 : 0), 6, 18, 2, '#f1f3f5', OUT, 1.6);
  // тело
  fillRR(ctx, -26, -34, 50, 28, 13, '#ffffff', OUT, 2.2);
  ell(ctx, -10, -26, 9, 7, '#495057');
  ell(ctx, 10, -18, 7, 5, '#495057');
  ell(ctx, -18, -14, 5, 4, '#495057');
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-22, -14, 44, 6);
  // хвост
  line(ctx, -25, -28, -32, -12, OUT, 1.8);
  ell(ctx, -32, -11, 2.6, 3.4, '#495057');
  // голова
  fillRR(ctx, 20, -42, 20, 20, 8, '#ffffff', OUT, 2);
  ell(ctx, 34, -26, 8, 6, '#ffc9c9', OUT, 1.6);
  ell(ctx, 32, -27, 1.2, 1.2, OUT);
  ell(ctx, 36, -27, 1.2, 1.2, OUT);
  ell(ctx, 27, -36, 1.8, 2, OUT);
  poly(ctx, [20, -42, 16, -48, 23, -44], '#ffe8a1', OUT, 1.2);
  poly(ctx, [34, -42, 38, -48, 31, -44], '#ffe8a1', OUT, 1.2);
  // колокольчик на шее
  line(ctx, 22, -22, 28, -20, '#e03131', 2);
  poly(ctx, [22, -20, 28, -20, 30, -12, 20, -12], '#ffd43b', OUT, 1.4);
  ctx.restore();
}

defineObjects({
  alpineFir: {
    solid: true,
    map: (env) => treeDot(env),
    draw(ctx, o, env) {
      put('spruce', o.x, o.y, o.snow ? 'winter' : env.season, (o.v || 0) % 3);
    },
  },
  mtRock: {
    solid: true,
    art: { mtRock: [[-30, -30, 32, 20], paintRock] },
    draw: (ctx, o, env) => put('mtRock', o.x, o.y, (o.v || 0) % 3, o.snow || env.season === 'winter' ? 1 : 0),
  },
  crag: {
    solid: true,
    map: () => '#9aa3b0',
    art: { crag: [[-46, -100, 50, 26], paintCrag] },
    draw: (ctx, o, env) => put('crag', o.x, o.y, (o.v || 0) % 2, o.snow || env.season === 'winter' ? 1 : 0),
  },
  alpFlowers: {
    flat: true,
    art: { alpFlowers: [[-26, -16, 26, 14], paintAlpFlowers] },
    draw(ctx, o, env) {
      if (env.season !== 'winter') put('alpFlowers', o.x, o.y, env.season, (o.v || 0) % 3);
    },
  },
  // эдельвейс виден, только пока его можно сорвать (o.on() — особое место в locations/mountain.js)
  edelweiss: {
    flat: true,
    art: { edelweiss: [[-20, -24, 20, 14], paintEdelweiss] },
    draw(ctx, o) {
      if (!o.on || o.on()) put('edelweiss', o.x, o.y);
    },
  },
  caveRock: {
    solid: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    map: () => '#7d8796',
    art: { caveRock: [[-98, -122, 98, 34], paintCaveRock] },
    draw: (ctx, o) => put('caveRock', o.x, o.y, 1, o.open && o.open() ? 1 : 0),
  },
  fallRock: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    map: () => '#7d8796',
    art: { fallRock: [[-46, -118, 96, 34], paintFallRock] },
    draw(ctx, o, env) {
      put('fallRock', o.x, o.y, o.snow ? 1 : 0);
      SP.world();
      // днём в ясную погоду над омутом — радуга в брызгах
      drawFall(
        ctx,
        o.x,
        o.y,
        env.t,
        env.season === 'winter',
        env.dark < 0.2 && G.state && G.state.weather === 'sun' ? 1 : 0,
      );
    },
  },
  flagPole: {
    solid: true,
    art: { flagPole: [[-14, -112, 14, 12], paintFlagPole] },
    draw(ctx, o, env) {
      put('flagPole', o.x, o.y);
      SP.world();
      drawFlag(ctx, o.x, o.y, env.t);
    },
  },
  viewer: {
    solid: true,
    art: { viewer: [[-24, -42, 24, 12], paintViewer] },
    draw: (ctx, o) => put('viewer', o.x, o.y, 1),
  },
  skiFlag: {
    art: { skiFlag: [[-6, -38, 18, 10], paintSkiFlag] },
    draw: (ctx, o, env) => put('skiFlag', o.x + Math.round(Math.sin(env.t * 2 + o.x) * 0.8), o.y, (o.v || 0) % 2),
  },
});

/** Варежка Вершинкина: синяя, вязаная, со снежинкой; tilt — покачивается на ветру (шагами). */
function paintMitten(ctx, tilt) {
  ell(ctx, 2, 8, 14, 4, 'rgba(70,90,140,.22)');
  ctx.rotate(tilt * 0.06);
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(-10, -10);
  ctx.quadraticCurveTo(-10, -22, 0, -22);
  ctx.quadraticCurveTo(10, -22, 10, -10);
  ctx.lineTo(9, 6);
  ctx.closePath();
  ctx.fillStyle = '#4dabf7';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ell(ctx, -12, -6, 5, 7, '#4dabf7', OUT, 1.8, -0.5); // большой палец
  fillRR(ctx, -11, 2, 22, 7, 3, '#ffffff', OUT, 1.6); // манжета
  for (let i = 0; i < 3; i++) line(ctx, 0, -12, Math.cos(i * 1.05) * 5, -12 + Math.sin(i * 1.05) * 5, '#ffffff', 1.4);
  for (let i = 0; i < 3; i++) line(ctx, 0, -12, -Math.cos(i * 1.05) * 5, -12 - Math.sin(i * 1.05) * 5, '#ffffff', 1.4);
}
// снеговик и корова — спрайты для крюка things (стоят не на клетке, а там, где их поставила локация)
defineArt({
  snowman: [[-36, -100, 52, 14], paintSnowman],
  cow: [[-46, -60, 50, 18], paintCow],
  mitten: [[-22, -30, 20, 16], paintMitten],
});

// ---------- шале инструктора Вершинкина: дорисовка поверх домика (поле art у здания house) ----------
/** Резной балкон под крышей, лыжи и палки у стены, санки у крыльца. */
export function chaletArt(ctx, g, snow) {
  // балкон с резными перилами
  const by = g.wallTop + 4;
  fillRR(ctx, g.wx - 10, by, g.ww + 20, 8, 3, WOOD_D, OUT, 2);
  for (let x = g.wx - 6; x <= g.wx + g.ww + 6; x += 9) fillRR(ctx, x - 2, by - 16, 4, 16, 2, WOOD_L, OUT, 1.2);
  line(ctx, g.wx - 10, by - 16, g.wx + g.ww + 10, by - 16, OUT, 3.4);
  line(ctx, g.wx - 10, by - 16, g.wx + g.ww + 10, by - 16, WOOD, 1.8);
  if (snow) ell(ctx, g.cx, by - 18, g.ww / 2 + 6, 3, '#ffffff', SNOW_D, 1);
  // лыжи и палки у левой стены
  const lx = g.wx - 4;
  for (const [dx, col] of [
    [0, '#fa5252'],
    [8, '#fa5252'],
  ]) {
    ctx.save();
    ctx.translate(lx + dx, g.bot);
    ctx.rotate(-0.12);
    fillRR(ctx, -2.5, -62, 5, 62, 2.5, col, OUT, 1.4);
    ell(ctx, 0, -62, 3, 4, col, OUT, 1.2);
    ctx.restore();
  }
  line(ctx, lx + 18, g.bot, lx + 13, g.bot - 50, OUT, 2);
  line(ctx, lx + 22, g.bot, lx + 19, g.bot - 50, OUT, 2);
  ell(ctx, lx + 15, g.bot - 8, 4, 1.6, null, OUT, 1.2);
  // санки у крыльца
  const sx = g.cx + 40,
    sy = g.bot + 6;
  line(ctx, sx - 16, sy, sx + 16, sy, OUT, 3);
  ctx.beginPath();
  ctx.arc(sx + 16, sy - 5, 5, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  fillRR(ctx, sx - 15, sy - 14, 28, 8, 2, '#e8590c', OUT, 1.6);
  line(ctx, sx - 10, sy - 6, sx - 10, sy, OUT, 1.6);
  line(ctx, sx + 8, sy - 6, sx + 8, sy, OUT, 1.6);
  if (snow) ell(ctx, sx - 1, sy - 15, 13, 2.6, '#ffffff', SNOW_D, 1);
}

/** Облако с объёмом (для слоя неба и панорамы): rx × ry, a — прозрачность. */
export function cloudPuff(ctx, x, y, rx, ry, a = 1, col = '#ffffff') {
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.moveTo(x - rx * 0.1 + rx * 0.6, y - ry * 0.45);
  ctx.ellipse(x - rx * 0.1, y - ry * 0.45, rx * 0.6, ry * 0.7, 0, 0, TAU);
  ctx.moveTo(x + rx * 0.45 + rx * 0.45, y - ry * 0.25);
  ctx.ellipse(x + rx * 0.45, y - ry * 0.25, rx * 0.45, ry * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

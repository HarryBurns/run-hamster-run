// КАРТИНКИ В ОКНАХ ЗАНЯТИЙ — рисунки без логики: карта сокровищ Зефирки (cove.js), звёздное небо желаний
// (desert.js), вид с вершины и снеговик (mountain.js), спа отеля (hotel.js), вид с домика на дереве (forest.js),
// рисунки на стене пещеры (caves.js). Что и когда показывать, решают сами занятия. Лежит в features/, а не в art/:
// берёт рисунки мест, движка и вида с башни.
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { drawHamster } from '../art/hamster.js';
import { ART } from '../engine/topdown/index.js';
import { VIEW_LAYERS, viewEnv, renderViewLayer } from '../interiors/tower_view.js';
import { npcLook, PIECES } from '../data/index.js';

const OUT = '#4a3728';

// ════════ из cove.js ════════
// ---------- карта сокровищ Зефирки ----------
/** Карта сокровищ (картинка кодом): три кусочка; ненайденные — пунктиром со знаком вопроса. */
export function paintTreasureMap(ctx, w, h, have) {
  ctx.clearRect(0, 0, w, h);
  const k = w / 340;
  ctx.save();
  ctx.scale(k, k);
  const W = 340,
    H = (h / w) * 340;
  // три кусочка: левый, правый верхний, правый нижний (рваные края — ломаной)
  const PARTS = {
    tower: [10, 10, 150, 10, 140, 70, 158, 130, 136, H - 10, 10, H - 10],
    ship: [150, 10, W - 10, 10, W - 10, 120, 250, 112, 210, 126, 158, 130, 140, 70],
    isle: [158, 130, 210, 126, 250, 112, W - 10, 120, W - 10, H - 10, 136, H - 10],
  };
  const path = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  };
  for (const id of PIECES) {
    const ok = have.includes(id);
    path(PARTS[id]);
    ctx.fillStyle = ok ? '#f3e2b5' : 'rgba(243,226,181,.25)';
    ctx.fill();
    ctx.setLineDash(ok ? [] : [6, 5]);
    ctx.strokeStyle = ok ? '#8d5524' : 'rgba(141,85,36,.6)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // рисунок на карте — только на найденных кусочках
  ctx.save();
  ctx.beginPath();
  for (const id of PIECES) {
    if (!have.includes(id)) continue;
    const pts = PARTS[id];
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }
  ctx.clip();
  // море
  ctx.fillStyle = 'rgba(116,192,252,.45)';
  ctx.fillRect(0, 60, W, H);
  ctx.strokeStyle = 'rgba(28,126,214,.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let y = 80; y < H; y += 26)
    for (let x = 20 + (y % 52); x < W; x += 52) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 4, x + 12, y);
    }
  ctx.stroke();
  // берег города и башня (левый кусочек)
  poly(ctx, [0, 10, 150, 10, 140, 60, 0, 66], '#ffe8a8', OUT, 1.5);
  fillRR(ctx, 40, 20, 10, 34, 2, '#74c0fc', OUT, 1.4);
  ell(ctx, 45, 18, 7, 4, '#ff8fab', OUT, 1);
  for (const x of [70, 96, 118]) fillRR(ctx, x, 36, 16, 18, 2, '#ffd8a8', OUT, 1.2);
  // Звёздный остров с флажком и пальмой (левый низ)
  ell(ctx, 64, 150, 34, 14, '#ffe8a8', OUT, 1.5);
  line(ctx, 54, 148, 58, 120, '#a8703f', 3);
  for (const a of [-2.4, -1.6, -0.8]) ell(ctx, 58 + Math.cos(a) * 10, 120 + Math.sin(a) * 6, 10, 3, '#40c057', OUT, 1, a + 1.6);
  star(ctx, 80, 146, 5, '#ff922b');
  // затонувший корабль (правый верх): мачта из воды
  line(ctx, 230, 96, 236, 58, OUT, 2.4);
  poly(ctx, [236, 60, 262, 84, 236, 86], '#fff3bf', OUT, 1.2);
  ctx.fillStyle = OUT;
  ctx.font = '900 12px ui-rounded, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('~ корабль ~', 240, 108);
  // скалы на востоке, буёк-ракушка и грот → бухта с крестиком (правый низ)
  for (const [x, y, r] of [
    [272, 150, 20],
    [300, 140, 24],
    [318, 170, 18],
  ])
    ell(ctx, x, y, r, r * 0.7, '#b39c86', OUT, 1.5);
  ell(ctx, 252, 168, 6, 6, '#22b8cf', OUT, 1.2);
  ctx.strokeStyle = 'rgba(28,126,214,.8)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(252, 176);
  ctx.quadraticCurveTo(262, 206, 292, 202);
  ctx.stroke();
  ctx.setLineDash([]);
  ell(ctx, 296, 204, 26, 14, '#fff8e6', OUT, 1.5);
  ctx.lineCap = 'round';
  for (const [c, lw] of [
    [OUT, 6],
    ['#e03131', 3.4],
  ]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(288, 198);
    ctx.lineTo(304, 210);
    ctx.moveTo(304, 198);
    ctx.lineTo(288, 210);
    ctx.stroke();
  }
  // роза ветров
  ell(ctx, 200, 40, 14, 14, 'rgba(255,255,255,.4)', 'rgba(141,85,36,.7)', 1.4);
  poly(ctx, [200, 24, 204, 40, 200, 56, 196, 40], '#e03131', OUT, 1);
  ctx.restore();
  // знак вопроса на ненайденных
  ctx.fillStyle = 'rgba(141,85,36,.7)';
  ctx.font = '900 34px ui-rounded, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const CENTER = { tower: [74, H / 2], ship: [250, 64], isle: [250, (130 + H) / 2] };
  for (const id of PIECES) if (!have.includes(id)) ctx.fillText('?', ...CENTER[id]);
  ctx.restore();
}

// ════════ из desert.js ════════
/** Ночное небо над барханами: звёзды и падающие звёзды (t — время, для мерцания). */
export function paintStarSky(ctx, w, h, t, look) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1340');
  g.addColorStop(0.7, '#2b2a6e');
  g.addColorStop(1, '#5a3d7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = ((i * 0.618) % 1) * w,
      y = ((i * 0.377) % 1) * h * 0.72,
      r = 0.6 + ((i * 7) % 5) * 0.35,
      a = 0.5 + Math.sin(t * 2 + i) * 0.4;
    ctx.globalAlpha = Math.max(0.15, a);
    ell(ctx, x, y, r, r, '#ffffff');
  }
  ctx.globalAlpha = 1;
  ell(ctx, w * 0.82, h * 0.16, 16, 16, '#fff3bf');
  ell(ctx, w * 0.82 + 6, h * 0.16 - 4, 13, 13, '#1a1f5a');
  // падающие звёзды
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.45 + i / 3) % 1,
      sx = w * (0.1 + i * 0.28),
      sy = h * (0.04 + (i % 2) * 0.1),
      x = sx + k * w * 0.3,
      y = sy + k * h * 0.3;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    line(ctx, x - 40, y - 40 * (h / w), x, y, 'rgba(255,250,210,.9)', 2.4);
    ell(ctx, x, y, 3, 3, '#ffffff');
  }
  ctx.globalAlpha = 1;
  // барханы и хомячок на гребне
  poly(ctx, [0, h, 0, h * 0.8, w * 0.3, h * 0.72, w * 0.6, h * 0.8, w, h * 0.74, w, h], '#6b4f7a');
  poly(ctx, [0, h, 0, h * 0.9, w * 0.4, h * 0.84, w * 0.75, h * 0.92, w, h * 0.88, w, h], '#4f3b62');
  drawHamster(ctx, w * 0.32, h * 0.76, 0.55, look, { time: t, dir: 0, happy: true, armsUp: Math.sin(t * 3) > 0.6, shadow: false });
}

// ════════ из mountain.js ════════
// ---------- смотровая площадка ----------
/**
 * Вид с вершины на юг: вдали — город и море слоями вида с башни (interiors/tower_view.js — те же небо, море
 * с островами, пляж и кварталы, только мельче: гора дальше от города, чем башня), над ними — Хомяк-Тауэр, ближе —
 * лес под горой, облака ниже вершины и снежный край вершины с флагом.
 */
export function paintSummitView(ctx, w, h, season, dark) {
  const env = viewEnv(season, dark),
    dpr = Math.min(window.devicePixelRatio || 1, 2.5),
    cityBot = h * 0.6,
    k = cityBot / VIEW_LAYERS.find((l) => l.id === 'mid').y1, // пикселей на единицу панорамы
    L = w / k;
  for (const l of VIEW_LAYERS) {
    if (l.id === 'near') continue; // крыши у самой башни отсюда не видно
    const r = renderViewLayer(l, L, env, k * dpr);
    ctx.drawImage(r.c, 0, r.top / dpr, r.c.width / dpr, r.c.height / dpr);
  }
  // Хомяк-Тауэр посреди города (с башни её не видно — мы на ней стояли)
  const tx = w * 0.5,
    tb = cityBot - 18,
    th = h * 0.27;
  fillRR(ctx, tx - 8, tb - th, 16, th, 4, env.c('#a5d8ff', 0.5), env.out, 1.6);
  for (let y = tb - th + 8; y < tb - 6; y += 9) {
    ctx.fillStyle = env.lit ? '#ffe066' : 'rgba(255,255,255,.7)';
    ctx.fillRect(tx - 4.5, y, 3, 4);
    ctx.fillRect(tx + 1.5, y, 3, 4);
  }
  poly(ctx, [tx - 9, tb - th, tx, tb - th - 15, tx + 9, tb - th], env.c('#ffd43b', 0.5), env.out, 1.4);
  ell(ctx, tx, tb - th - 17, 3, 3, '#ff6b6b');
  // лес под горой: ряды крон и ёлок, ближние крупнее
  const leaf = env.leaf;
  for (let row = 0; row < 4; row++) {
    const y = h * (0.6 + row * 0.07),
      sc = 0.6 + row * 0.18;
    for (let i = 0, x = -10 + row * 9; x < w + 30; i++, x += 24 * sc) {
      const yy = y + ((i * 13) % 7);
      if ((i + row) % 3 === 0) {
        poly(ctx, [x - 14 * sc, yy + 14 * sc, x, yy - 28 * sc, x + 14 * sc, yy + 14 * sc], env.fir, env.out, 1.2);
        if (env.snow) poly(ctx, [x - 6 * sc, yy - 14 * sc, x, yy - 28 * sc, x + 6 * sc, yy - 14 * sc], '#ffffff');
      } else {
        ell(ctx, x, yy, 16 * sc, 12 * sc, leaf[(i + row) % leaf.length], env.out, 1.2);
        ell(ctx, x - 5 * sc, yy - 4 * sc, 6 * sc, 3.5 * sc, 'rgba(255,255,255,.3)');
      }
    }
  }
  // облака ниже вершины
  for (let i = 0; i < 6; i++) {
    const x = ((i * 0.23 + 0.05) % 1) * w,
      y = h * (0.6 + (i % 3) * 0.06);
    ctx.globalAlpha = env.d > 0.5 ? 0.45 : 0.85;
    for (const [dx, dy, r] of [
      [0, 0, 34],
      [30, -10, 26],
      [58, 2, 30],
    ])
      ell(ctx, x + dx, y + dy, r, r * 0.55, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // край вершины в снегу и флаг
  const snowTop = [0, h * 0.88, w * 0.18, h * 0.84, w * 0.36, h * 0.86, w * 0.55, h * 0.82, w * 0.78, h * 0.85, w, h * 0.83];
  poly(ctx, [0, h, ...snowTop, w, h], '#ffffff', OUT, 2);
  poly(ctx, [w * 0.55, h * 0.82, w * 0.78, h * 0.85, w, h * 0.83, w, h, w * 0.62, h], '#e3eef8');
  for (let i = 0; i < 6; i++) ell(ctx, w * (0.1 + i * 0.15), h * 0.93 + (i % 2) * 6, 14, 4, '#e7f1f9');
  line(ctx, w * 0.84, h * 0.86, w * 0.84, h * 0.56, OUT, 4);
  line(ctx, w * 0.84, h * 0.86, w * 0.84, h * 0.56, '#dee2e6', 2);
  poly(ctx, [w * 0.84, h * 0.56, w * 0.95, h * 0.59, w * 0.84, h * 0.635], '#ff6b9d', OUT, 1.6);
  if (env.d > 0.3) {
    // вечером и ночью — темнее (слои города уже тёмные)
    ctx.fillStyle = `rgba(27,31,74,${(env.d * 0.35).toFixed(2)})`;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }
}

// ---------- снеговик-строитель ----------
/** Нарисовать снеговик в окне (stage, roll — как в мире). */
export function paintSnowmanPic(ctx, w, h, sm) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d0ebff');
  g.addColorStop(1, '#f8fbff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w / 2, h - 10, w * 0.6, 26, '#ffffff', '#cfe3f0', 2);
  ctx.save();
  ctx.translate(w / 2 - 20, h - 18);
  ctx.scale(1.5, 1.5);
  ART.snowman[1](ctx, sm.stage, sm.stage < 3 ? sm.roll : 0); // тот же рисунок, что в мире (mountain_art.js)
  ctx.restore();
  // ведёрко ждёт рядом, пока его не надели
  if (sm.stage < 4) {
    poly(ctx, [w - 70, h - 22, w - 46, h - 22, w - 49, h - 46, w - 67, h - 46], '#74c0fc', OUT, 2);
    line(ctx, w - 72, h - 22, w - 44, h - 22, OUT, 3);
  }
}

// ════════ из hotel.js ════════
// ---------- сценки: спа и танцы ----------
/** Спа: хомячок лежит на массажном столе; маска — кружочки огурцов и пена, массаж — лапки Пенки. */
export function paintSpa(what) {
  return (ctx, w, h, k, look, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e6fcf5');
    g.addColorStop(1, '#c3fae8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const s = Math.min(w / 560, h / 320);
    // волны на стене, свечи, полотенца
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 3 * s;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * (0.18 + r * 0.12) + Math.sin(x * 0.03 + t * 1.5 + r) * 5 * s);
      ctx.stroke();
    }
    for (const cx of [w * 0.12, w * 0.18]) {
      fillRR(ctx, cx - 6 * s, h * 0.62, 12 * s, 24 * s, 3, '#fff', OUT, 1.5);
      poly(ctx, [cx - 4 * s, h * 0.62, cx + Math.sin(t * 7 + cx) * 2 * s, h * 0.62 - 14 * s, cx + 4 * s, h * 0.62], '#ffa94d');
    }
    // стол
    const tx = w * 0.55,
      ty = h * 0.78;
    fillRR(ctx, tx - 150 * s, ty, 300 * s, 22 * s, 10 * s, '#fff', OUT, 2);
    for (const dx of [-130, 130]) line(ctx, tx + dx * s, ty + 22 * s, tx + dx * s, h, OUT, 5 * s);
    // хомячок «лёжа»: повёрнут на бок
    ctx.save();
    ctx.translate(tx - 10 * s, ty);
    ctx.rotate(-Math.PI / 2);
    drawHamster(ctx, 0, 0, 1.05 * s, look, { time: t, dir: 0, happy: true, blink: 1, shadow: false });
    ctx.restore();
    if (what === 'mask') {
      // огурчики на глазах и пена
      for (const dy of [-16, 10]) {
        ell(ctx, tx - 92 * s, ty - 34 * s + dy * s, 10 * s, 10 * s, '#b2f2bb', '#2f9e44', 2);
        ell(ctx, tx - 92 * s, ty - 34 * s + dy * s, 4 * s, 4 * s, '#d3f9d8');
      }
      for (let i = 0; i < 8; i++) {
        const ph = (t * 0.6 + i / 8) % 1;
        ctx.globalAlpha = 1 - ph;
        ell(ctx, tx - 40 * s + i * 22 * s, ty - 50 * s - ph * h * 0.3, 7 * s, 7 * s, 'rgba(255,255,255,.9)', '#a5d8ff', 1.2);
      }
      ctx.globalAlpha = 1;
    } else {
      // массаж: Пенка разминает спинку — лапки двигаются
      drawHamster(ctx, tx + 40 * s, ty - 4 * s, 0.95 * s, npcLook('penka'), { time: t, dir: -1, armsUp: Math.sin(t * 8) > 0, happy: true });
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.7 + i / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        star(ctx, tx - 20 * s + i * 30 * s, ty - 60 * s - ph * 50 * s, 6 * s, '#ffd43b');
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = Math.min(1, k * 5);
  };
}

// ════════ из forest.js ════════
// ---------- домик на дереве ----------
/** Нарисовать вид с домика на дереве: верхушки леса, ручей, вдали гора с канатной дорогой (закрыта). */
export function paintTreeView(ctx, w, h, season, dark) {
  const night = dark > 0.6,
    eve = !night && dark > 0.25;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, night ? '#1b1f4a' : eve ? '#f08c69' : season === 'winter' ? '#b8dcf2' : '#8fd3ff');
  sky.addColorStop(1, night ? '#3b3f7a' : eve ? '#ffd8a8' : '#e7f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // солнце или луна и звёзды
  if (night) {
    ell(ctx, w * 0.8, h * 0.16, 16, 16, '#fff3bf');
    ell(ctx, w * 0.8 + 6, h * 0.16 - 4, 13, 13, '#3b3f7a');
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.45), 2, 2);
  } else ell(ctx, w * 0.82, h * 0.18, 20, 20, eve ? '#ff922b' : '#ffe066', '#fcc419', 2);
  // гора вдали: снежная шапка круглый год, к ней тянется трос канатной дороги
  const mx = w * 0.3,
    my = h * 0.12;
  poly(ctx, [mx - 150, h * 0.62, mx, my, mx + 160, h * 0.62], night ? '#4c5a8a' : '#9aa9c9', '#4a3728', 2);
  poly(
    ctx,
    [mx - 44, my + 40, mx, my, mx + 46, my + 42, mx + 22, my + 34, mx + 6, my + 46, mx - 16, my + 36],
    '#ffffff',
  );
  line(ctx, w * 0.62, h * 0.66, mx + 10, my + 50, '#4a3728', 1.5);
  ell(ctx, mx + 10, my + 52, 6, 5, '#fa5252', '#4a3728', 1.2);
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔒', mx + 30, my + 34);
  // ряды верхушек леса: дальние мельче и в дымке, ближние крупнее; ели вперемешку с лиственными
  const leaf =
    season === 'winter'
      ? ['#dbe9f4', '#f1f7fc', '#e6f0f7']
      : season === 'autumn'
        ? ['#e8590c', '#fcc419', '#f59f00', '#2b8a3e']
        : season === 'spring'
          ? ['#74d680', '#b2f2bb', '#8ce99a', '#37a34a']
          : ['#2f9e44', '#51cf66', '#40c057', '#2b8a3e'];
  const haze = night ? 'rgba(27,31,74,' : eve ? 'rgba(255,216,168,' : 'rgba(231,246,255,';
  for (let row = 0; row < 5; row++) {
    const y = h * (0.56 + row * 0.11),
      sc = 0.55 + row * 0.18,
      step = 40 * sc;
    for (let i = 0, x = -10 + ((row * 17) % 23); x < w + 40; i++, x += step * (0.8 + ((i * 7 + row * 3) % 5) * 0.1)) {
      const k = (i * 5 + row * 3) % 7,
        pine = k < 2,
        col = pine ? (season === 'winter' ? '#cfe3f0' : '#2b8a3e') : leaf[k % leaf.length],
        yy = y + ((i * 13) % 9) - 4;
      if (pine) {
        poly(ctx, [x - 20 * sc, yy + 18 * sc, x, yy - 40 * sc, x + 20 * sc, yy + 18 * sc], col, '#4a3728', 1.4);
        if (season === 'winter')
          poly(ctx, [x - 8 * sc, yy - 22 * sc, x, yy - 40 * sc, x + 8 * sc, yy - 22 * sc], '#ffffff');
      } else {
        ell(ctx, x, yy, 26 * sc, 20 * sc, col, '#4a3728', 1.4);
        ell(ctx, x - 8 * sc, yy - 7 * sc, 10 * sc, 6 * sc, 'rgba(255,255,255,.28)');
      }
    }
    // дымка на дальних рядах
    ctx.fillStyle = haze + (0.35 - row * 0.08).toFixed(2) + ')';
    if (row < 4) ctx.fillRect(0, y - 46 * sc, w, h);
  }
  // ручей блестит между деревьями
  ctx.strokeStyle = season === 'winter' ? '#d3edfb' : '#4fb0dc';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.6);
  ctx.quadraticCurveTo(w * 0.7, h * 0.8, w * 0.6, h);
  ctx.stroke();
  // светлячки летней ночью
  if (night && season === 'summer') {
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 18; i++) ell(ctx, (i * 131) % w, h * 0.6 + ((i * 71) % (h * 0.4)), 2.2, 2.2, '#ffe066');
  }
}

// ════════ из caves.js ════════
// ---------- древние рисунки ----------
/** Нарисовать стену с рисунками крупно (те же куски, что в мире: ART.paintWall — caves_art.js). */
export function paintWallPic(ctx, w, h) {
  ctx.fillStyle = '#2e2734';
  ctx.fillRect(0, 0, w, h);
  const k = Math.min(w / (5 * 56), h / 70);
  ctx.save();
  ctx.translate(w / 2 - 2.5 * 48 * k + 24 * k, (h - 64 * k) / 2);
  ctx.scale(k, k);
  for (let p = 0; p < 5; p++) {
    ART.paintWall[1](ctx, p);
    ctx.translate(48, 0);
  }
  ctx.restore();
  // тёплый свет фонарика по краям темнее
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, 'rgba(255,214,140,.12)');
  g.addColorStop(1, 'rgba(10,8,26,.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

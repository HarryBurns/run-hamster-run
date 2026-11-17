// «Движок домов», часть 6: свет в доме вечером и ночью (От10). Один общий механизм для всех домов:
// поверх кадра — лёгкое затемнение (тем сильнее, чем позже), а у ламп — тёплые пятна света.
//
// Откуда свет:
//   - у каждой комнаты — тёплый свет с потолка (широкой комнате — несколько пятен); комнате без него — lamp: false; терраса (paper: 'open') светится только гирляндой и своими лампами;
//   - мебель, которая светит сама: торшер, камин, ночник, гирлянда, неон (у своей мебели — где её поставили);
//   - desc.lamps: [{ f, x, h, r, c }] — свои лампы дома (факелы пирамиды, очаг шатра): x — где, h — на какой высоте
//     над полом, r — радиус пятна, c — цвет 'r,g,b'.
// Поля описания: dim — темно и днём (0..1: грот, пирамида); night — насколько темнеет ночью (по умолчанию 1).
// Темнота — маской в маленькой канве (у ламп в ней «дырки» — свет снимает темноту, а не прибавляется, светлые стены
// не выгорают), сверху — лёгкий тёплый оттенок. Рисуется только видимое (sc.view), градиенты кэшируются.
import { darkness } from '../../core/state.js';
import { FURN_BY_ID } from '../../data/index.js';

/** Мебель, которая светит: вид → высота огонька над полом (доля высоты предмета) и радиус. */
const GLOW = {
  lamp: [0.85, 230],
  fireplace: [0.45, 260],
  shroomlamp: [0.6, 160],
  garland: [0.5, 200],
  neon: [0.5, 190],
  samovar: [0.6, 120],
};
const WARM = '255,196,120';
const grads = new Map(); // «r|c» → градиент с центром в 0,0 (переносим translate'ом)

function glowGrad(ctx, r, c) {
  const key = r + '|' + c;
  let g = grads.get(key);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${c},.62)`);
    g.addColorStop(0.4, `rgba(${c},.3)`);
    g.addColorStop(1, `rgba(${c},0)`);
    grads.set(key, g);
  }
  return g;
}

/** Насколько темно в доме сейчас (0 — светло). */
export function houseDark(desc) {
  const n = desc.night === undefined ? 1 : desc.night;
  return Math.max(darkness() * n, desc.dim || 0);
}

/** Свет и затемнение поверх дома (камера уже включена; view — что на экране, в единицах дома). */
export function drawLight(ctx, sc, view) {
  const desc = sc.desc,
    geo = sc.geo,
    dk = houseDark(desc);
  if (dk < 0.03) return;
  const { RH, fy } = geo;
  const lights = [];
  const seen = (x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
  for (const r of desc.rooms) {
    if (r.lamp === false || r.paper === 'open') continue;
    const w = r.x1 - r.x0,
      n = Math.max(1, Math.round(w / 520));
    for (let i = 0; i < n; i++)
      lights.push({ x: r.x0 + (w * (i + 0.5)) / n, y: fy(r.f) - RH * 0.62, r: Math.min(400, Math.max(240, w / n / 1.4)), c: WARM });
  }
  for (const l of desc.lamps || []) lights.push({ x: l.x, y: fy(l.f || 0) - (l.h || 150), r: l.r || 240, c: l.c || WARM });
  for (const it of sc.items()) {
    const d = FURN_BY_ID[it.id],
      g = d && GLOW[d.kind];
    if (!g) continue;
    lights.push({ x: it.x, y: fy(it.floor) - (it.y || 0) - d.h * g[0], r: g[1], c: WARM });
  }
  const vis = lights.filter((l) => seen(l.x, l.y, l.r));
  const roomsPath = (c) => {
    c.beginPath();
    for (const r of desc.rooms) c.rect(r.x0, fy(r.f) - RH, r.x1 - r.x0, RH + geo.SLAB);
  };
  // 1) маска темноты — в маленькой канве (в 4 раза мельче экрана: градиенты плавные, мелкость не видна):
  //    тёмная заливка, а у ламп — «дырки» (свет не прибавляется к картинке, а снимает темноту — светлые стены
  //    не выгорают добела, сколько бы ламп ни было рядом)
  const m = ctx.getTransform(),
    cw = ctx.canvas.width,
    ch = ctx.canvas.height,
    q = 4,
    mw = Math.ceil(cw / q),
    mh = Math.ceil(ch / q);
  if (!mask) mask = document.createElement('canvas');
  if (mask.width !== mw || mask.height !== mh) {
    mask.width = mw;
    mask.height = mh;
  }
  const mc = mask.getContext('2d');
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.globalCompositeOperation = 'source-over';
  mc.clearRect(0, 0, mw, mh);
  mc.fillStyle = `rgba(14,16,48,${(0.6 * dk).toFixed(3)})`;
  mc.fillRect(0, 0, mw, mh);
  mc.setTransform(m.a / q, m.b / q, m.c / q, m.d / q, m.e / q, m.f / q);
  mc.save();
  roomsPath(mc);
  mc.clip(); // свет — только внутри комнат (на улицу через стены не льётся)
  mc.globalCompositeOperation = 'destination-out';
  for (const l of vis) {
    mc.translate(l.x, l.y);
    mc.fillStyle = holeGrad(mc, l.r);
    mc.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
    mc.translate(-l.x, -l.y);
  }
  mc.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mask, 0, 0, mw * q, mh * q);
  ctx.restore();
  // 2) тёплый оттенок у ламп — чуть-чуть, поверх
  ctx.save();
  roomsPath(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, dk) * 0.32;
  for (const l of vis) {
    ctx.translate(l.x, l.y);
    ctx.fillStyle = glowGrad(ctx, l.r, l.c);
    ctx.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
    ctx.translate(-l.x, -l.y);
  }
  ctx.restore();
}
let mask = null;
const holes = new Map();
function holeGrad(c, r) {
  let g = holes.get(r);
  if (!g) {
    g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,.42)');
    g.addColorStop(0.5, 'rgba(0,0,0,.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    holes.set(r, g);
  }
  return g;
}

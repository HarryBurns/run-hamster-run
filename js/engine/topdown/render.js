// «Движок локаций»: РИСОВАНИЕ кадра — земля, предметы и здания из кэша спрайтов, сортировка по глубине,
// герой, погода, ночь, указатель цели — и мини-карта.
//
// Правило кэша (core/sprites.js): спрайт ложится 1:1 на целые пиксели устройства. Оно держится на cam.k
// (целое чётное число пикселей на клетку — Camera.setTileZoom) и cam.pixelOrigin(): не менять.
//
// Порядок кадра: фон → земля (куски из кэша, вода, прибой, лужи) → «поверх земли» (крюк ground) → всё, что стоит,
// от дальнего к ближнему (предметы, здания, жители, «своё» из крюка things, предметы задания, находки, герой) →
// падающие значки → крюк over → бабочки → звёздочка цели → время суток и ночь со светом → светлячки → погода →
// крюк overlay → стрелка к цели за экраном.
//
// СВЕТ. Ночью (темнота > 0,3) у предметов с полем light: [dx, dy, радиус] и у зданий, чей вид отдаёт
// lights(b) → [[x, y, rx, ry?, сила?], …], появляются пятна света: темнота в этих местах «прорезана» (drawNight).
import { G, playerLook, cal } from '../../core/state.js';
import { clamp, rnd, dist } from '../../core/util.js';
import { ell, fillRR, line, poly, star, emoji } from '../../core/draw.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { NPC_BY_ID, TASK_BY_ID } from '../../data/index.js';
import { T, OUT, PS, SP, TILES, OBJECTS, BUILDING_KINDS, tileOf, label, hash } from './kinds.js';
import { drawResident } from './actors.js';
import { drawGround, buildShore, CH } from './ground.js';

// ---------- погода ----------
export function initWeather(sc) {
  sc.weather = [];
  const kind = G.state.weather;
  if (kind === 'sun') return;
  const n = kind === 'rain' ? 70 : kind === 'snow' ? 60 : 22;
  for (let i = 0; i < n; i++) sc.weather.push({ x: Math.random(), y: Math.random(), s: rnd(0.6, 1.3), ph: rnd(0, 6) });
  sc.weatherKind = kind;
}
export function updateWeather(sc, dt) {
  if (sc.weatherKind !== G.state.weather) initWeather(sc);
  const k = G.state.weather,
    v = k === 'rain' ? 1.4 : k === 'snow' ? 0.16 : 0.1;
  for (const q of sc.weather) {
    q.y += v * q.s * dt;
    q.x += (k === 'rain' ? -0.15 : Math.sin(G.time + q.ph) * 0.03) * dt;
    if (q.y > 1.05) {
      q.y = -0.05;
      q.x = Math.random();
    }
    if (q.x < -0.05) q.x = 1.05;
  }
}
/** Осадки — в экранных координатах, по одному пути на цвет. */
function drawWeather(ctx, sc, w, h) {
  const k = G.state.weather,
    list = sc.weather,
    t = G.time;
  if (!list.length) return;
  if (k === 'rain') {
    // косые струи: дальние — тоньше и бледнее
    for (const far of [1, 0]) {
      ctx.strokeStyle = far ? 'rgba(150,190,255,.4)' : 'rgba(130,175,255,.75)';
      ctx.lineWidth = far ? 1.3 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = far; i < list.length; i += 2) {
        const q = list[i],
          x = q.x * w,
          y = q.y * h,
          len = (far ? 10 : 16) * q.s;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.3, y + len);
      }
      ctx.stroke();
    }
  } else if (k === 'snow') {
    // снежинки двух размеров, покачиваются
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath();
    for (const q of list) {
      const r = (q.ph > 4 ? 4.2 : q.ph > 2 ? 3 : 2) * q.s,
        x = q.x * w + Math.sin(t * 1.3 + q.ph * 3) * 6,
        y = q.y * h;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 6.2832);
    }
    ctx.fill();
  } else {
    // лепестки и листья: кружатся, по цвету — отдельный путь
    const cols =
      k === 'petals' ? ['rgba(255,170,200,.95)', 'rgba(255,205,225,.95)', '#fff'] : ['#f08c00', '#e8590c', '#ffd43b'];
    cols.forEach((col, ci) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = ci; i < list.length; i += 3) {
        const q = list[i],
          x = q.x * w + Math.sin(t * 0.9 + q.ph * 2) * 14,
          y = q.y * h,
          rot = t * (1.2 + q.s) + q.ph,
          fl = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + q.ph * 5)); // лист поворачивается ребром
        ctx.moveTo(x + Math.cos(rot) * 7 * q.s, y + Math.sin(rot) * 7 * q.s);
        ctx.ellipse(x, y, 7 * q.s, 4 * q.s * fl, rot, 0, 6.2832);
      }
      ctx.fill();
    });
  }
}
/** Дождь на земле: лужицы на мостовой и расходящиеся круги — в координатах мира, под всем, что стоит. */
function drawRainOnGround(ctx, m, t, x0, y0, x1, y1) {
  ctx.fillStyle = 'rgba(160,205,240,.42)';
  ctx.beginPath();
  const rings = [];
  for (let ty = y0; ty <= y1; ty++) {
    const row = m.kinds[ty];
    for (let tx = x0; tx <= x1; tx++) {
      const hs = hash(tx * 7 + 3, ty * 11 + 5),
        kind = row[tx];
      if (hs < 0.1 && kind.z >= 5 && kind.z <= 8 && !kind.wet) {
        // лужица
        const cx = (tx + 0.3 + hs * 4) * T,
          cy = (ty + 0.5) * T;
        ctx.moveTo(cx + 15, cy);
        ctx.ellipse(cx, cy, 15, 7, 0, 0, 6.2832);
        ctx.moveTo(cx + 19, cy + 5);
        ctx.ellipse(cx + 11, cy + 5, 8, 4, 0, 0, 6.2832);
      }
      if (hs > 0.72) rings.push(tx, ty, hs);
    }
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < rings.length; i += 3) {
    const hs = rings[i + 2],
      ph = (t * 1.4 + hs * 37) % 1,
      cx = (rings[i] + ((hs * 17) % 1)) * T,
      cy = (rings[i + 1] + ((hs * 29) % 1)) * T,
      r = 2 + ph * 9;
    if (ph > 0.8) continue;
    ctx.moveTo(cx + r, cy);
    ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, 6.2832);
  }
  ctx.stroke();
}

// ---------- свет: время суток, ночь, пятна света ----------
/**
 * Цвет неба поверх кадра: [r, g, b, a] или null. Утром — розоватая дымка, к закату — тёплый свет, в сумерках —
 * синева, ночью — тёмно-синяя темнота (dark — 0..1 из sc.darkness()). В дождь — серо-голубая пелена.
 */
function skyTint(dark) {
  const m = G.state.minutes,
    rain = G.state.weather === 'rain';
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  const add = (cr, cg, cb, ca) => {
    if (ca <= 0) return;
    r += cr * ca;
    g += cg * ca;
    b += cb * ca;
    a += ca;
  };
  if (m >= 300 && m < 480) add(255, 176, 150, 0.15 * (1 - (m - 300) / 180)); // рассвет
  const warm = clamp((m - 16.5 * 60) / 90, 0, 1) * (1 - clamp(dark * 1.5, 0, 1));
  add(255, 138, 60, 0.2 * warm); // закат
  add(110, 70, 160, 0.16 * Math.sin(clamp(dark, 0, 1) * Math.PI)); // сумерки
  add(18, 22, 78, 0.6 * dark); // ночь
  if (rain) add(70, 95, 130, 0.14);
  if (a < 0.01) return null;
  return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.min(0.72, a)];
}
let glowImg = null; // мягкое круглое пятно: им «прорезают» темноту
function glowSprite() {
  if (glowImg) return glowImg;
  glowImg = document.createElement('canvas');
  glowImg.width = glowImg.height = 64;
  const c = glowImg.getContext('2d'),
    g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return glowImg;
}
let skyEl = null,
  skyCtx = null,
  skyOn = false;
/** Убрать слой неба (сцена ушла или небо сейчас чистое). */
export function hideSky() {
  if (skyEl && skyOn) {
    skyEl.style.display = 'none';
    skyOn = false;
  }
}
/**
 * СЛОЙ НЕБА — отдельная маленькая канва поверх игры (в ~8 раз мельче экрана), растянутая на весь экран средствами
 * страницы: растягивает её видеокарта, а не наш кадр, поэтому цвет времени суток, ночная темнота с мягкими пятнами
 * света и тени облаков почти ничего не стоят. В ней: заливка цветом неба tint → «прорезанные» пятна света
 * (lights — [x, y, rx, ry, сила] в единицах мира) с тёплым оттенком → тени облаков → огоньки светлячков.
 * Возвращает контекст слоя и перевод «мир → точки слоя» (для светлячков) или null, если слой не нужен.
 */
function drawSky(sc, tint, lights, n, clouds, k, ox, oy, w, h, dpr) {
  if (!tint && !clouds) {
    hideSky();
    return null;
  }
  const S = Math.max(4, Math.round((w * dpr) / 170)), // пикселей устройства в одной точке слоя
    lw = Math.ceil((w * dpr) / S) + 1,
    lh = Math.ceil((h * dpr) / S) + 1;
  if (!skyEl) {
    skyEl = document.createElement('canvas');
    skyEl.id = 'sky';
    skyEl.style.cssText = 'position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:none';
    document.body.appendChild(skyEl);
    skyCtx = skyEl.getContext('2d');
  }
  if (skyEl.width !== lw || skyEl.height !== lh) {
    skyEl.width = lw;
    skyEl.height = lh;
  }
  const cssW = (lw * S) / dpr + 'px',
    cssH = (lh * S) / dpr + 'px';
  if (skyEl.style.width !== cssW) skyEl.style.width = cssW;
  if (skyEl.style.height !== cssH) skyEl.style.height = cssH;
  if (!skyOn) {
    skyEl.style.display = 'block';
    skyOn = true;
  }
  const c = skyCtx;
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, lw, lh);
  if (tint) {
    c.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`;
    c.fillRect(0, 0, lw, lh);
    if (n) {
      const glow = glowSprite();
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < n; i += 5) {
        const rx = (lights[i + 2] * k) / S,
          ry = (lights[i + 3] * k) / S;
        c.globalAlpha = lights[i + 4];
        c.drawImage(glow, (lights[i] * k - ox) / S - rx, (lights[i + 1] * k - oy) / S - ry, rx * 2, ry * 2);
      }
      // тёплый оттенок там, где темнота прорезана
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = `rgba(255,186,96,${(tint[3] * 0.3).toFixed(3)})`;
      c.fillRect(0, 0, lw, lh);
      c.globalCompositeOperation = 'source-over';
    }
  }
  if (clouds) {
    // тени облаков плывут над картой с запада на восток
    const m = sc.map,
      span = m.w * T + 1200,
      t = G.time;
    c.fillStyle = 'rgba(40,60,120,.1)';
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const cx = ((i * 733 + t * 9) % span) - 600,
        cy = hash(i * 5 + 1, 3) * m.h * T,
        rx = 260 + hash(i, 9) * 200,
        ry = 120 + hash(9, i) * 90;
      const sx = (cx * k - ox) / S,
        sy = (cy * k - oy) / S,
        srx = (rx * k) / S,
        sry = (ry * k) / S;
      if (sx + srx < 0 || sx - srx > lw || sy + sry < 0 || sy - sry > lh) continue;
      c.moveTo(sx + srx, sy);
      c.ellipse(sx, sy, srx, sry, 0, 0, 6.2832);
      c.moveTo(sx + srx * 0.4 + srx * 0.6, sy - sry * 0.5);
      c.ellipse(sx + srx * 0.4, sy - sry * 0.5, srx * 0.6, sry * 0.6, 0, 0, 6.2832);
    }
    c.fill();
  }
  return { c, S };
}

// ---------- живность: бабочки днём, светлячки ночью ----------
const WINGS = ['#ffd43b', '#ff8fab', '#ffffff', '#74c0fc'];
/** Клетки травы, над которыми кто-то летает: редкие, выбраны «случайным» числом клетки. */
function critterCells(m, x0, y0, x1, y1, out) {
  let n = 0;
  for (let ty = y0; ty <= y1; ty++) {
    const row = m.kinds[ty];
    for (let tx = x0; tx <= x1; tx++) {
      const hs = hash(tx * 13 + 7, ty * 29 + 3);
      if (hs < 0.016 && row[tx].id === 'g') {
        out[n++] = tx;
        out[n++] = ty;
        out[n++] = hs * 62;
      }
    }
  }
  return n;
}
const critters = [];
/** Бабочки: в координатах мира, поверх всего, что стоит. */
function drawButterflies(ctx, m, t, x0, y0, x1, y1) {
  const n = critterCells(m, x0 - 1, Math.max(0, y0 - 1), x1 + 1, y1, critters);
  for (let ci = 0; ci < WINGS.length; ci++) {
    ctx.fillStyle = WINGS[ci];
    ctx.strokeStyle = 'rgba(74,55,40,.75)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    let any = false;
    for (let i = 0; i < n; i += 3) {
      const hs = critters[i + 2];
      if (Math.floor(hs * 97) % WINGS.length !== ci) continue;
      any = true;
      const x = (critters[i] + 0.5) * T + Math.sin(t * 0.7 + hs * 40) * 42 + Math.sin(t * 1.9 + hs * 17) * 12,
        y = (critters[i + 1] + 0.5) * T + Math.cos(t * 0.9 + hs * 31) * 26 - 26 + Math.sin(t * 6 + hs) * 3,
        fl = Math.abs(Math.sin(t * 13 + hs * 50));
      for (const sx of [-1, 1]) {
        ctx.moveTo(x + sx * (1 + 5.5 * fl), y - 2);
        ctx.ellipse(x + sx * (1 + 2.6 * fl), y - 2, 0.6 + 3 * fl, 4.2, sx * 0.3, 0, 6.2832);
        ctx.moveTo(x + sx * (1 + 4 * fl), y + 2.6);
        ctx.ellipse(x + sx * (1 + 1.8 * fl), y + 2.6, 0.5 + 2.2 * fl, 2.8, -sx * 0.3, 0, 6.2832);
      }
    }
    if (any) {
      ctx.fill();
      ctx.stroke();
    }
  }
}
/** Светлячки: огоньки в слое неба (поверх темноты). c — контекст слоя, S — пикселей устройства в его точке. */
function drawFireflies(c, m, t, x0, y0, x1, y1, k, ox, oy, S) {
  const n = critterCells(m, x0 - 1, Math.max(0, y0 - 1), x1 + 1, y1, critters);
  c.fillStyle = 'rgba(255,246,150,.9)';
  c.beginPath();
  for (let i = 0; i < n; i += 3) {
    const hs = critters[i + 2];
    for (let j = 0; j < 2; j++) {
      if (Math.sin(t * (1.1 + j * 0.4) + hs * 9 + j * 2) < -0.2) continue; // мерцают
      const x = (critters[i] + 0.5) * T + Math.sin(t * 0.5 + hs * 40 + j * 3) * 34,
        y = (critters[i + 1] + 0.5) * T + Math.cos(t * 0.6 + hs * 31 + j) * 20 - 18,
        sx = (x * k - ox) / S,
        sy = (y * k - oy) / S;
      c.moveTo(sx + 0.55, sy);
      c.arc(sx, sy, 0.55, 0, 6.2832);
    }
  }
  c.fill();
}

// ---------- прибой ----------
/**
 * Линия прибоя вдоль берега моря (клетки с surf: true): пена у кромки «дышит», а волна раз за разом набегает
 * из глубины и тает. Точки берега считаются один раз на карту (ground.js, buildShore); в кадре — два пути.
 */
function drawSurf(ctx, sc, env, x0, y0, x1, y1) {
  const m = sc.map;
  if (m.shore === undefined) {
    const any = m.kinds.some((row) => row.some((k) => k.surf));
    m.shore = any
      ? buildShore(
          m,
          (k) => !k.surf && !k.bridge,
          (k) => !!k.surf,
        )
      : null;
  }
  if (!m.shore) return;
  const t = env.t,
    ice = env.season === 'winter';
  const run = (off, amp, speed, wave) => {
    ctx.beginPath();
    for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++)
      for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) {
        const pieces = m.shore.get(cx + ',' + cy);
        if (!pieces) continue;
        for (const p of pieces) {
          let px = 0,
            py = 0;
          for (let i = 0; i < p.length; i += 5) {
            const d = off + amp * Math.sin(t * speed + p[i + 4] * wave),
              x = p[i] + p[i + 2] * d,
              y = p[i + 1] + p[i + 3] * d;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
            px = x;
            py = y;
          }
          ctx.lineTo(px, py);
        }
      }
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // пена у самой кромки
  ctx.strokeStyle = ice ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.8)';
  ctx.lineWidth = 3.5;
  run(5, 3.2, 1.3, 0.021);
  // набегающая волна: издалека к берегу, у берега тает
  const ph = (t * 0.22) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${(Math.sin(ph * Math.PI) * (ice ? 0.3 : 0.5)).toFixed(3)})`;
  ctx.lineWidth = 2.6;
  run(34 - ph * 24, 2.5, 0.9, 0.034);
}

// ---------- герой ----------
/** Игрок: рисуется линиями каждый кадр — у него много поз (вода, лёд, «верхом») и любая одежда. */
function drawHero(ctx, sc, look, ent, t) {
  if (ent.ride) {
    ent.ride.draw(ctx, sc, ent, t, look);
    return;
  }
  const kind = TILES[ent.surf] || {},
    swim = kind.swim;
  const pose = { time: t, dir: ent.dir, walk: ent.moving ? ent.walkT : null, blink: blinkAt(t, 0) };
  if (swim) {
    pose.clipBelow = swim.clip;
    pose.walk = ent.walkT;
    ell(ctx, ent.x, ent.y - 20, 26, 9, 'rgba(255,255,255,.55)');
  }
  if (kind.slide) pose.walk = null;
  drawHamster(ctx, ent.x, ent.y + (swim ? 4 : 10), PS, look, pose);
  if (swim) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(ent.x, ent.y - 19, 24 + Math.sin(t * 4) * 3, 7, 0, 0, Math.PI);
    ctx.stroke();
  }
}

// ---------- здания ----------
/** Здание из кэша спрайтов. От времени зависят только снег на крыше и свет в окнах — они входят в ключ. */
function drawBuilding(ctx, m, b, season, dark, env) {
  const kind = BUILDING_KINDS[b.kind],
    snow = season === 'winter' ? 1 : 0,
    lit = dark > 0.35 ? 1 : 0,
    key = `b:${m.id}:${b.id}:${snow}:${lit}`;
  let s = SP.find(key);
  if (!s) {
    // рамка — вокруг левого верхнего угла «пятна» здания
    s = SP.get(key, kind.box ? kind.box(b) : [-44, -50, b.w * T + 44, b.h * T + 12], (c) => {
      c.translate(-b.x * T, -b.y * T);
      kind.paint(c, b, !!snow, !!lit);
    });
  }
  SP.draw(s, b.x * T, b.y * T);
  if (kind.live) kind.live(ctx, b, G.time, env);
}

// виды записей в списке «от дальнего к ближнему»; z — кто ближе при равной глубине
const K_OBJ = 0,
  K_BUILDING = 1,
  K_NPC = 2,
  K_THING = 3,
  K_ITEM = 4,
  K_PICKUP = 5,
  K_HERO = 6;

/** Нарисовать кадр сцены sc (createTopDownScene). */
export function drawFrame(ctx, sc) {
  const m = sc.map,
    cam = sc.cam,
    p = sc.p,
    desc = sc.desc;
  const { w, h } = G.view,
    dpr = G.view.dpr || 1,
    t = G.time,
    z = cam.zoom,
    k = cam.k,
    season = desc.season || cal().season,
    dark = sc.darkness();
  const cw = ctx.canvas.width,
    chh = ctx.canvas.height;
  // фон нужен, только если карта меньше экрана: иначе землю целиком закрывают её куски
  if (m.w * T * k < cw || m.h * T * k < chh) {
    ctx.fillStyle = desc.bg || '#3fb0ea';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  // Сдвиг камеры — целое число пикселей устройства: земля и спрайты из кэша двигаются вместе, без дрожания.
  const { ox, oy } = cam.pixelOrigin(cw, chh);
  SP.begin(ctx, k, ox, oy);
  ctx.lineJoin = 'round';
  const env = sc.env;
  env.t = t;
  env.season = season;
  env.dark = dark;
  const x0 = Math.max(0, tileOf(ox / k)),
    x1 = Math.min(m.w - 1, tileOf((ox + cw) / k));
  const y0 = Math.max(0, tileOf(oy / k)),
    y1 = Math.min(m.h - 1, tileOf((oy + chh) / k));
  drawGround(ctx, sc, env, k, ox, oy, cw, chh); // земля: куски из кэша и «живое» поверх (вода, грядки)
  drawSurf(ctx, sc, env, x0, y0, x1, y1);
  const sky = desc.sky !== false,
    weather = sky ? G.state.weather : 'sun';
  if (weather === 'rain') drawRainOnGround(ctx, m, t, x0, y0, x1, y1);
  sc.call('ground', ctx, sc, env); // разметка — то, что лежит прямо на земле и меняется
  // свет: ночью собираем пятна света от фонарей, окон и дверей
  const lit = sky && dark > 0.3,
    lights = sc.lights || (sc.lights = []);
  let nl = 0;
  const light = (x, y, rx, ry, a) => {
    lights[nl++] = x;
    lights[nl++] = y;
    lights[nl++] = rx;
    lights[nl++] = ry === undefined ? rx : ry;
    lights[nl++] = a === undefined ? 1 : a;
  };

  // всё, что стоит на земле, — по порядку «дальше → ближе»
  const list = [];
  const mx0 = (x0 - 3) * T,
    mx1 = (x1 + 4) * T,
    my0 = (y0 - 2) * T,
    my1 = (y1 + 12) * T;
  for (const o of m.objs)
    if (o.x > mx0 && o.x < mx1 && o.y > my0 && o.y < my1) list.push({ y: o.sy, z: 0, k: K_OBJ, v: o, f: null });
  for (const b of m.buildings)
    if ((b.x + b.w) * T > mx0 - 100 && b.x * T < mx1 + 100 && b.y * T < my1 && (b.y + b.h) * T > my0 - 100)
      list.push({ y: (b.y + b.h) * T, z: 1, k: K_BUILDING, v: b, f: null });
  for (const n of sc.npcs)
    if (!n.hidden && n.x > mx0 && n.x < mx1 && n.y > my0 && n.y < my1)
      list.push({ y: n.y + 10, z: 2, k: K_NPC, v: n, f: null });
  // «своё» локации: add(глубина y, fn(ctx, v, t, sc), v, late) — late: при равной глубине рисовать после героя
  const view = { x0: mx0, y0: my0, x1: mx1, y1: my1 };
  const add = (y, f, v, late) => list.push({ y, z: late ? 7 : 3, k: K_THING, v, f });
  sc.call('things', sc, add, view);
  const mail = G.state.mail,
    items = sc.taskItems();
  for (const it of items) if (!it.got) list.push({ y: (it.y + 0.5) * T, z: 4, k: K_ITEM, v: it, f: null });
  for (const pk of sc.pickups) if (sc.pickupThere(pk)) list.push({ y: pk.y, z: 5, k: K_PICKUP, v: pk, f: null });
  list.push({ y: p.y + 10, z: 6, k: K_HERO, v: p, f: null });
  list.sort((a, b2) => a.y - b2.y || a.z - b2.z);
  for (const e of list) {
    const v = e.v;
    switch (e.k) {
      case K_OBJ: {
        const kind = OBJECTS[v.type];
        kind.draw(ctx, v, env);
        if (lit && kind.light) light(v.x + kind.light[0], v.y + kind.light[1], kind.light[2]);
        break;
      }
      case K_BUILDING: {
        drawBuilding(ctx, m, v, season, dark, env);
        const kind = BUILDING_KINDS[v.kind];
        if (lit && kind.lights) for (const q of kind.lights(v)) light(q[0], q[1], q[2], q[3], q[4]);
        break;
      }
      case K_NPC: {
        const nd = NPC_BY_ID[v.id];
        drawResident(v, t);
        if (dist(v.x, v.y, p.x, p.y) < T * 3.2) {
          SP.world();
          label(ctx, nd.name, v.x, v.y - 66 * (nd.small ? 0.82 : 1), 200, 12, 'rgba(255,255,255,.92)');
        }
        break;
      }
      case K_THING:
        SP.world(); // остальное рисуется линиями, в координатах мира
        e.f(ctx, v, t, sc);
        break;
      case K_ITEM: {
        SP.world();
        const ic = (TASK_BY_ID[mail.task] || {}).sticker || '⭐';
        drawFind(ctx, ic, (v.x + 0.5) * T, (v.y + 0.5) * T, t, v.x);
        break;
      }
      case K_PICKUP:
        SP.world();
        drawFind(ctx, v.icon, v.x, v.y, t, v.tx);
        break;
      default:
        SP.world();
        drawHero(ctx, sc, playerLook(), p, t);
    }
  }
  SP.world();
  // падающие значки (кокос с пальмы и т. п.)
  for (const q of sc.drops) {
    const kk = Math.min(1, q.t / 0.45);
    emoji(ctx, q.e, q.x, q.y + kk * kk * 62, 22);
  }
  sc.call('over', ctx, sc, t);
  const warmSeason = season === 'spring' || season === 'summer',
    fine = weather === 'sun' || weather === 'petals';
  if (sky && warmSeason && fine && dark < 0.25) drawButterflies(ctx, m, t, x0, y0, x1, y1);
  // звёздочка-цель
  const tg = sc.target();
  if (tg) {
    const by = tg.y - 78 + Math.sin(t * 4) * 6;
    if (tg.icon === '⭐') {
      star(ctx, tg.x, by, 15, '#ffd43b', OUT, 2.5);
    }
  }
  SP.end(dpr);
  ctx.restore();

  if (sky) {
    drawWeather(ctx, sc, w, h);
    // небо: цвет времени суток, ночью — темнота с пятнами света, днём — тени облаков (отдельный слой, см. drawSky)
    const tint = skyTint(dark);
    if (lit) {
      light(p.x, p.y - 24, 70, 70, 0.4); // хомячка видно и в темноте
      if (tg) light(tg.x, tg.y - 70, 46, 46, 0.7); // и звёздочку цели
    }
    const clouds = !window.__noClouds && dark < 0.5 && (weather === 'sun' || weather === 'petals' || weather === 'leaves');
    const layer = drawSky(sc, tint, lights, lit ? nl : 0, clouds, k, ox, oy, w, h, dpr);
    if (layer && warmSeason && fine && dark > 0.55) drawFireflies(layer.c, m, t, x0, y0, x1, y1, k, ox, oy, layer.S);
  } else hideSky();
  sc.call('overlay', ctx, sc, w, h); // свой слой поверх всего, в экранных координатах (темнота пещеры и т. п.)
  // стрелка к цели, если она за экраном
  if (tg) {
    const sx = (tg.x - cam.x) * z + w / 2,
      sy = (tg.y - 40 - cam.y) * z + h / 2;
    const pad = 56;
    if (sx < pad || sx > w - pad || sy < pad + 50 || sy > h - pad) {
      const ax = clamp(sx, pad, w - pad),
        ay = clamp(sy, pad + 60, h - pad - 10),
        a = Math.atan2(sy - ay, sx - ax);
      ctx.save();
      ctx.translate(ax, ay);
      ell(ctx, 0, 0, 24, 24, '#fff', OUT, 2.5);
      ctx.rotate(a);
      poly(ctx, [24, -9, 38, 0, 24, 9], '#ff6b9d', OUT, 2);
      ctx.rotate(-a);
      emoji(ctx, tg.icon, 0, 0, 24);
      ctx.restore();
    }
  }
}
/**
 * Темнота с кругом света — для крюка overlay тёмных локаций (пещера с фонариком):
 *   overlay(ctx, sc, w, h) { const s = sc.cam.toScreen(sc.p.x, sc.p.y - 30); spotlight(ctx, w, h, s.x, s.y, 170); }
 * (sx, sy) — центр света на экране, r — радиус, alpha — насколько темно вокруг.
 */
export function spotlight(ctx, w, h, sx, sy, r, alpha = 0.88, rgb = '12,10,34') {
  const g = ctx.createRadialGradient(sx, sy, r * 0.35, sx, sy, r);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
/** Находка на земле: значок покачивается над тенью. seed — чтобы соседние качались вразнобой. */
function drawFind(ctx, icon, x, y, t, seed) {
  const yy = y + Math.sin(t * 4 + seed) * 4;
  ell(ctx, x, y + 12, 12, 4, 'rgba(0,0,0,.15)');
  ell(ctx, x, yy - 4, 20, 20, 'rgba(255,255,255,.45)');
  emoji(ctx, icon, x, yy - 4, 26);
}

// ---------- мини-карта ----------
/** Неподвижная часть карты (земля, деревья, здания, значки мест, цель): рисуется один раз, когда карту открывают. */
export function drawMiniMapBase(ctx, sc, k) {
  const m = sc.map,
    env = sc.env;
  env.t = G.time;
  env.season = sc.desc.season || cal().season;
  env.dark = sc.darkness();
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const c = m.kinds[y][x].map;
      ctx.fillStyle = (typeof c === 'function' ? c(env) : c) || '#000';
      ctx.fillRect(x * k, y * k, k + 0.6, k + 0.6);
    }
  for (const o of m.objs) {
    const kind = OBJECTS[o.type];
    if (kind.map) ell(ctx, (o.tx + 0.5) * k, (o.ty + 0.5) * k, k * 0.42, k * 0.42, kind.map(env));
  }
  for (const b of m.buildings) {
    const kind = BUILDING_KINDS[b.kind];
    fillRR(ctx, b.x * k, b.y * k, b.w * k, b.h * k, k * 0.5, b.wall, OUT, 1.2);
    if (kind.mapDraw) kind.mapDraw(ctx, b, k);
    else emoji(ctx, b.icon || kind.icon, (b.x + b.w / 2) * k, (b.y + b.h / 2) * k, Math.max(11, k * 2.3));
  }
  for (const pl of sc.places)
    if (pl.map && pl.map.icon) emoji(ctx, pl.map.icon, pl.map.at[0] * k, pl.map.at[1] * k, Math.max(10, k * 2));
  sc.call('miniMap', ctx, sc, k);
  const tg = sc.target();
  if (tg) star(ctx, (tg.x / T) * k, (tg.y / T) * k, k * 1.3 + 2, '#ffd43b', OUT, 1.5);
}
/** Мигающая точка игрока поверх карты — единственное, что на карте меняется. */
export function drawMiniMapPlayer(ctx, sc, k) {
  const pr = k * 0.9 + 3 + Math.sin(G.time * 5) * 1.2;
  ell(ctx, (sc.p.x / T) * k, (sc.p.y / T) * k, pr, pr, '#ff3d7f', '#fff', 2.5);
}

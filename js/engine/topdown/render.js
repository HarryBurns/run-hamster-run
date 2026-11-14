// «Движок локаций»: РИСОВАНИЕ кадра — земля, предметы и здания из кэша спрайтов, сортировка по глубине,
// герой, погода, ночь, указатель цели — и мини-карта.
//
// Правило кэша (core/sprites.js): спрайт ложится 1:1 на целые пиксели устройства. Оно держится на cam.k
// (целое чётное число пикселей на клетку — Camera.setTileZoom) и cam.pixelOrigin(): не менять.
//
// Порядок кадра: фон → клетки земли → «поверх земли» (крюк ground) → всё, что стоит, от дальнего к ближнему
// (предметы, здания, жители, «своё» из крюка things, предметы задания, находки, герой) → падающие значки →
// крюк over → звёздочка цели → ночь → погода → крюк overlay → стрелка к цели за экраном.
import { G, playerLook, cal } from '../../core/state.js';
import { clamp, rnd, dist } from '../../core/util.js';
import { ell, fillRR, line, poly, star, emoji } from '../../core/draw.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { NPC_BY_ID, TASK_BY_ID } from '../../data/index.js';
import { T, OUT, PS, SP, TILES, OBJECTS, BUILDING_KINDS, tileOf, label } from './kinds.js';
import { drawResident } from './actors.js';

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
function drawWeather(ctx, sc, w, h) {
  const k = G.state.weather;
  for (const q of sc.weather) {
    const x = q.x * w,
      y = q.y * h;
    if (k === 'rain') line(ctx, x, y, x - 4, y + 14 * q.s, 'rgba(120,170,255,.7)', 2);
    else if (k === 'snow') ell(ctx, x, y, 3 * q.s, 3 * q.s, 'rgba(255,255,255,.95)');
    else
      ell(
        ctx,
        x,
        y,
        6 * q.s,
        3.5 * q.s,
        k === 'petals' ? 'rgba(255,170,200,.9)' : ['#f08c00', '#e8590c', '#ffd43b'][Math.floor(q.ph) % 3],
        null,
        1,
        G.time * 2 + q.ph,
      );
  }
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
function drawBuilding(ctx, m, b, season, dark) {
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
  if (kind.live) kind.live(ctx, b, G.time);
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
    season = cal().season,
    dark = sc.darkness();
  ctx.fillStyle = desc.bg || '#3fb0ea';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  // Сдвиг камеры — целое число пикселей устройства: земля и спрайты из кэша двигаются вместе, без дрожания.
  const cw = ctx.canvas.width,
    chh = ctx.canvas.height;
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
  for (let ty = y0; ty <= y1; ty++) {
    const row = m.kinds[ty];
    for (let tx = x0; tx <= x1; tx++) row[tx].draw(ctx, tx * T, ty * T, tx, ty, env);
  }
  sc.call('ground', ctx, sc, env); // бортики, разметка — то, что лежит прямо на земле

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
      case K_OBJ:
        OBJECTS[v.type].draw(ctx, v, env);
        break;
      case K_BUILDING:
        drawBuilding(ctx, m, v, season, dark);
        break;
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

  if (desc.sky !== false) {
    if (dark > 0) {
      ctx.fillStyle = `rgba(24,24,72,${dark * 0.42})`;
      ctx.fillRect(0, 0, w, h);
    }
    drawWeather(ctx, sc, w, h);
  }
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
  env.season = cal().season;
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

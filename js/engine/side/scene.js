// «Движок домов»: сцена «вид сбоку, как кукольный домик» по описанию дома.
//
//   const villa = createSideScene(описание);  registerScene(villa.name, villa);
//
// ОПИСАНИЕ ДОМА (interiors/*.js) — обычный объект:
//   id            имя сцены
//   floors        число этажей;  width — ширина жилой части;  lift: true — справа шахта лифта
//                 (без лифта дом может быть только одноэтажным)
//   rooms         [{ id, f, x0, x1, name, wall, floor: 'wood' | 'tile' | 'check', win: x | null,
//                    paper: 'planks' | 'tile' | 'stripes', glass: true, main: true }]
//                 main — «своя спальня»: там хомячок просыпается
//   built         встроенные предметы: [{ type, f, x, … }] — см. fixtures.js
//   furniture     чья мебель:
//                   { key, editable, keepOneBed, start }  своя: лежит в сохранении под ключом key
//                        ('villa' — вилла, остальные — state.homes[key]); editable — есть режим «Обустроить»;
//                        start — [[id, этаж, x, y?], …] — что стоит в начале
//                   { fixed: [[id, этаж, x, y?], …], noUse: ['sleep', …] }  чужая: стоит как в описании,
//                        переставить нельзя; noUse — чем нельзя пользоваться (по умолчанию кровать, шкаф, холодильник)
//   door          { f, x } — где стоит хомячок, войдя с улицы
//   exit          действие из реестра для двери ('scene:world', 'home-exit'); без него — назад, откуда пришли
//   persist       true — сцена кладёт в сохранение свою позицию (в ней можно начать игру после перезагрузки)
//                 и место снаружи, откуда в дом вошли (поле out); иначе в сохранении остаётся место снаружи, у двери
//   owner         чей это дом (id жителя) — для занятий: реплики хозяина, «изюминки» дома
//   guests        { f, enterX, gap, first, roam } — сюда приходят приглашённые друзья (см. actors.js)
//   actors        [{ npc, f, x, roam, act }] — кто здесь живёт или работает
//   shell         { wall, roof, chimneyX, bushes, flat, ground, trees } — дом снаружи (см. rooms.js)
//   maxZoom       не приближать сильнее (для маленьких домов);  music — дневная музыка ('villa' | 'town')
//   art           { back(ctx, sc, t), front(ctx, sc, t) } — свой рисунок позади и поверх хомячка (если нужен)
//
// Сцена умеет: ходьбу по нажатию и стрелками, лифт, «дойти и сделать», мебель и встроенные предметы,
// гостей и жильцов, режим «Обустроить» с кладовкой, сон (событие wake), HUD и звук.
import { G, playerLook, houseItems } from '../../core/state.js';
import { initHouse } from '../../core/actions.js';
import { emit, scope } from '../../core/events.js';
import { run } from '../../core/registry.js';
import { go } from '../../core/loop.js';
import { keys, axisX } from '../../core/input.js';
import { Camera } from '../../core/camera.js';
import { clamp, lerp, rnd, TAU } from '../../core/util.js';
import { ell, heart } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { FURN_BY_ID } from '../../data/index.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { geometry, drawSky, drawHouse, drawLift, HS } from './rooms.js';
import { buildFixtures } from './fixtures.js';
import { hitItem, useItem, drawItems, isParty, SEAT_H } from './items.js';
import { makeResidents, syncGuests, actorHappy, hitActor, updateActors, drawActors } from './actors.js';
import { setDecor, decorDown, decorMove, decorUp } from './decor.js';

export function createSideScene(desc) {
  const geo = geometry(desc);
  const { FH, W, WTOT, EX, floors, fy } = geo;
  if (floors > 1 && !geo.lift) throw new Error(`Дом «${desc.id}»: больше одного этажа — нужен лифт (lift: true)`);
  const { fixtures, zones, drawOrder } = buildFixtures(desc.built);
  const furn = desc.furniture || {};
  const owned = !!furn.key; // мебель своя и лежит в сохранении
  const fixed = owned
    ? null
    : (furn.fixed || []).map(([id, floor, x, y], i) => ({ uid: -1 - i, id, floor, x, y: y || 0 }));
  const noUse = new Set(furn.noUse || (owned ? [] : ['sleep', 'wardrobe', 'fridge']));
  const door = desc.door || { f: 0, x: 100 };
  // как рисовать хомячка в ванне, сауне и т. п. — берём у встроенных предметов, которые есть в доме
  const poses = {};
  for (const b of fixtures) if (b.def.state && b.def.pose) poses[b.def.state] = b.def.pose;
  const sub = scope(); // подписки на события, пока сцена — текущая

  const sc = {
    name: desc.id,
    desc,
    geo,
    owned,
    editable: owned && furn.editable !== false,
    houseKey: furn.key || null,
    cam: new Camera(),
    // хомячок: x, этаж f; path — куда идём; state — idle | sit | wheel | состояние встроенного предмета
    p: {
      x: door.x,
      f: door.f,
      dir: 1,
      path: [],
      walkT: 0,
      state: 'idle',
      item: null,
      fix: null,
      lift: null,
      pending: null,
      happy: 0,
    },
    actors: makeResidents(desc),
    parts: [], // частицы: сердечки, пузырьки, пар
    liftY: 0,
    stateT: 0,
    down: null,
    back: null, // позиция снаружи, откуда пришли
    decor: { on: false, sel: null, drag: null, pan: null, tray: null },
    // Временное состояние мебели (крутится колесо, качнулась игрушка) живёт в сцене, а не в сохранении:
    live: new WeakMap(), // предмет → { on, t: сколько секунд осталось (0 — пока не выключат) }

    /** Мебель этого дома. */
    items: () => (owned ? houseItems(furn.key) : fixed),
    /** Можно ли пользоваться предметом с таким описанием. */
    canUse: (d) => !!d.act && d.act !== 'none' && !noUse.has(d.act),
    burst(x, y, kind, n = 6) {
      for (let i = 0; i < n; i++)
        sc.parts.push({
          x: x + rnd(-24, 24),
          y: y + rnd(-10, 10),
          vx: rnd(-30, 30),
          vy: rnd(-70, -30),
          life: rnd(0.8, 1.5),
          t: 0,
          kind,
          r: rnd(4, 9),
        });
    },
    /** Хомячок устроился во встроенном предмете (ванна, сауна…): состояние, сам предмет, где сидит. */
    settle(state, b, x) {
      sc.p.state = state;
      sc.p.fix = b.fix || b;
      sc.p.x = x;
    },
    /** Сидит ли хомячок сейчас в этом встроенном предмете. */
    using: (b) => sc.p.fix === b && sc.p.state === b.def.state,
    standUp() {
      const p = sc.p;
      if (p.item && p.state === 'wheel') sc.live.delete(p.item);
      p.state = 'idle';
      p.item = null;
      p.fix = null;
    },
    playerHappy() {
      sc.p.happy = 2;
      sc.burst(sc.p.x, fy(sc.p.f) - 130, 'heart', 5);
    },
    /** Выйти из дома через дверь. */
    exit() {
      if (desc.exit) run(desc.exit, { scene: sc });
      else if (sc.back) go(sc.back.scene, { pos: sc.back });
    },

    // ---------- интерфейс сцены ----------
    enter(from, params = {}) {
      if (owned) initHouse(furn.key, furn.start);
      // откуда пришли. Если нас возвращают на сохранённое место (params.pos), «откуда» не меняется:
      // иначе два своих дома, между которыми перешли через окно «Мои дома», вели бы дверями друг в друга.
      if (params.back && !params.pos) sc.back = params.back;
      resetPlayer();
      if (params.wake) toBed();
      else if (!params.pos || !sc.restorePos(params.pos)) {
        // вошли с улицы — стоим у входной двери
        sc.p.f = door.f;
        sc.p.x = door.x;
        sc.p.dir = 1;
      }
      sc.liftY = fy(sc.p.f);
      syncGuests(sc);
      setDecor(sc, false);
      snapCam();
      sub.off();
      sub.on('guests', () => syncGuests(sc));
      sub.on('guestHappy', ({ id }) => actorHappy(sc, id));
      sub.on('happy', sc.playerHappy);
      sub.on('wake', wake);
    },
    leave() {
      setDecor(sc, false);
      sub.off();
    },
    savePos() {
      const here = { scene: sc.name, floor: sc.p.f, x: sc.p.x };
      // свой дом без постоянного выхода помнит, куда ведёт дверь, и после перезагрузки страницы
      if (desc.persist && sc.back && sc.back.scene !== sc.name) here.out = sc.back;
      return desc.persist ? here : sc.back || here;
    },
    restorePos(pos) {
      if (!pos || !Number.isFinite(pos.x) || !Number.isInteger(pos.floor) || pos.floor < 0 || pos.floor >= floors)
        return false;
      sc.p.f = pos.floor;
      sc.p.x = pos.x;
      if (pos.out && typeof pos.out.scene === 'string') sc.back = pos.out;
      return true;
    },
    update,
    draw,
    pointerDown(sx, sy) {
      if (sc.decor.on) decorDown(sc, sx, sy);
      else sc.down = { sx, sy };
    },
    pointerMove(sx, sy) {
      if (sc.decor.on) decorMove(sc, sx, sy);
    },
    pointerUp,
    interact,
    hud() {
      if (!sc.editable) return {};
      const on = sc.decor.on;
      return { main: { icon: '🔨', label: 'Обустроить', on, fn: () => setDecor(sc, !on) }, cls: on ? 'decor' : '' };
    },
    sound: () => ({ force: isParty(sc) ? 'party' : null, day: desc.music || 'villa', sea: 0, rain: 0.3 }),
    /** Можно ли сейчас впустить гостя, который пришёл сам. */
    canHostGuests: () => !!desc.guests && !sc.decor.on,

    // ---------- для HUD, занятий и тестов ----------
    setDecor: (on) => setDecor(sc, on),
    isDecor: () => sc.decor.on,
    syncGuests: () => syncGuests(sc),
    /** Для тестов: где на экране точка дома. */
    debugScreen: (wx, wy) => sc.cam.toScreen(wx, wy),
  };

  // ---------- вход, сон ----------
  function resetPlayer() {
    const p = sc.p;
    p.path = [];
    p.state = 'idle';
    p.item = null;
    p.fix = null;
    p.pending = null;
    p.lift = null;
  }
  /** Поставить хомячка у кровати: сначала ищем её в «своей спальне» (комната с main: true). */
  function toBed() {
    const beds = sc.items().filter((i) => FURN_BY_ID[i.id] && FURN_BY_ID[i.id].act === 'sleep');
    const room = desc.rooms.find((r) => r.main);
    const bed = (room && beds.find((b) => b.floor === room.f && b.x >= room.x0 && b.x < room.x1)) || beds[0] || null;
    if (bed) {
      sc.p.f = bed.floor;
      sc.p.x = bed.x + 30;
    }
  }
  /** Утро (событие wake после сна): хомячок просыпается у своей кровати. */
  function wake() {
    resetPlayer();
    toBed();
    sc.liftY = fy(sc.p.f);
    syncGuests(sc);
    setDecor(sc, false);
    snapCam();
  }

  // ---------- камера ----------
  function layout() {
    const { w, h } = G.view;
    const fit = Math.min(w / (WTOT + 90), h / (floors * FH + 230));
    // дом целиком помещается на экран — показываем целиком; иначе крупно и следим за хомячком
    let z = fit >= 0.66 ? fit : clamp(Math.min(w, h) / 470, 0.62, 1.05);
    if (sc.decor.on && fit < 0.66) z = Math.max(fit, z * 0.72); // в режиме обустройства видно побольше
    if (desc.maxZoom) z = Math.min(z, desc.maxZoom);
    sc.cam.setZoom(z);
    // в режиме обустройства камеру можно увести ниже — под домом лежит панель кладовки
    sc.cam.setBounds(-60, -(floors * FH) - 190, WTOT + 60, 90 + (sc.decor.on ? 150 / z : 0), { centerDy: -20 });
  }
  const camTarget = () => ({ x: sc.p.x, y: (sc.p.lift ? sc.liftY : fy(sc.p.f)) - 110 });
  function snapCam() {
    layout();
    const t = camTarget();
    sc.cam.snap(t.x, t.y);
  }

  // ---------- движение и действия ----------
  /** Идти в точку x на этаже f (если этаж другой — через лифт); pending — что сделать, когда дойдём. */
  function goTo(x, f, pending) {
    const p = sc.p;
    sc.standUp();
    if (!geo.lift) f = p.f;
    p.pending = pending || null;
    x = clamp(x, 34, f === p.f ? WTOT - 40 : W - 34);
    p.path = [];
    if (f !== p.f) p.path.push({ t: 'walk', x: EX }, { t: 'lift', f });
    p.path.push({ t: 'walk', x });
  }
  function arrive() {
    const p = sc.p,
      pd = p.pending;
    p.pending = null;
    if (!pd) return;
    if (pd.actor) run(pd.actor.act, { scene: sc, actor: pd.actor });
    else if (pd.zone) useZone(pd.zone);
    else if (pd.item) useItem(sc, pd.item);
  }
  /** Встроенный предмет: либо действие из реестра, либо своё поведение предмета. */
  function useZone(z) {
    if (z.act) run(z.act, { scene: sc, fixture: z.fix });
    else if (z.use) z.use(sc, z);
  }
  function hitZone(wx, wy) {
    for (const b of zones) {
      const y = fy(b.f);
      if (wx >= b.x - b.w / 2 && wx <= b.x + b.w / 2 && wy >= y - b.h && wy <= y + 6) return b;
    }
    return null;
  }

  // ---------- ввод ----------
  function pointerUp(sx, sy) {
    if (sc.decor.on) {
      decorUp(sc);
      return;
    }
    if (!sc.down) return;
    const moved = Math.hypot(sx - sc.down.sx, sy - sc.down.sy) > 14;
    sc.down = null;
    if (moved) return;
    const w = sc.cam.toWorld(sx, sy),
      p = sc.p;
    if (geo.lift && w.x > W && w.x < WTOT + 20) {
      // лифт
      goTo(EX, geo.floorAt(w.y));
      sfx('tap');
      return;
    }
    const f = geo.floorAt(w.y, 12);
    const g = hitActor(sc, w.x, w.y);
    if (g) {
      goTo(g.x + (p.x < g.x ? -70 : 70), g.f, { actor: g });
      sfx('tap');
      return;
    }
    const it = hitItem(sc, w.x, w.y, false);
    if (it) {
      goTo(it.x, it.floor, { item: it });
      sfx('tap');
      return;
    }
    const b = hitZone(w.x, w.y);
    if (b) {
      goTo(b.x, b.f, { zone: b });
      sfx('tap');
      return;
    }
    goTo(w.x, f);
    sfx('step');
  }
  /** Клавиша E: потрогать то, что ближе всего на этом этаже. */
  function interact() {
    const p = sc.p;
    let best = null,
      bd = 90;
    for (const it of sc.items()) {
      const d = FURN_BY_ID[it.id];
      if (!d || !sc.canUse(d) || it.floor !== p.f) continue;
      const dd = Math.abs(it.x - p.x);
      if (dd < bd) {
        bd = dd;
        best = { item: it };
      }
    }
    for (const b of zones) {
      if (b.f !== p.f) continue;
      const dd = Math.abs(b.x - p.x) - (b.w > 300 ? b.w / 2 - 60 : 0);
      if (dd < bd) {
        bd = dd;
        best = { zone: b };
      }
    }
    for (const g of sc.actors) {
      if (g.f !== p.f) continue;
      const dd = Math.abs(g.x - p.x);
      if (dd < bd + 20) {
        bd = dd;
        best = { actor: g };
      }
    }
    if (best) {
      p.pending = best;
      p.path = [];
      arrive();
    }
  }

  // ---------- обновление ----------
  function update(dt) {
    const p = sc.p;
    sc.stateT += dt;
    if (!sc.decor.on) {
      const kx = axisX();
      if (kx && !p.lift) {
        if (p.state !== 'idle' && p.state !== 'swim') sc.standUp();
        p.path = [];
        p.pending = null;
        p.x = clamp(p.x + kx * 320 * dt, 34, WTOT - 40);
        p.dir = kx;
        p.walkT += dt * 2.6;
        p.moving = true;
      } else if (!p.path.length) p.moving = false;
      if (geo.lift) {
        if ((keys.has('ArrowUp') || keys.has('KeyW')) && !p.path.length && !p.lift && p.f < floors - 1)
          goTo(p.x > W ? EX : p.x, p.f + 1);
        if ((keys.has('ArrowDown') || keys.has('KeyS')) && !p.path.length && !p.lift && p.f > 0)
          goTo(p.x > W ? EX : p.x, p.f - 1);
      }
    }
    // путь: идём по этажу или едем в лифте
    if (p.path.length) {
      const st = p.path[0];
      if (st.t === 'walk') {
        const dx = st.x - p.x,
          step = 340 * dt;
        p.moving = true;
        p.walkT += dt * 2.6;
        if (Math.abs(dx) <= step) {
          p.x = st.x;
          p.path.shift();
          if (!p.path.length) {
            p.moving = false;
            arrive();
          }
        } else {
          p.x += Math.sign(dx) * step;
          p.dir = Math.sign(dx);
        }
      } else if (st.t === 'lift') {
        p.moving = false;
        if (!p.lift) {
          p.lift = { to: st.f };
          sfx('door');
          sfx('lift');
        }
        const ty = fy(st.f),
          dy = ty - sc.liftY,
          step = 460 * dt;
        if (Math.abs(dy) <= step) {
          sc.liftY = ty;
          p.f = st.f;
          p.lift = null;
          p.path.shift();
          sfx('ding');
        } else sc.liftY += Math.sign(dy) * step;
      }
    } else if (!p.lift) sc.liftY = lerp(sc.liftY, fy(p.f), Math.min(1, dt * 8));
    if (p.happy > 0) p.happy -= dt;
    // звуки шагов и колеса
    p.stepT = (p.stepT || 0) + dt;
    if (p.state === 'wheel') {
      if (p.stepT > 0.22) {
        p.stepT = 0;
        sfx('wheel');
      }
    } else if (p.moving && !p.lift && p.stepT > 0.3) {
      p.stepT = 0;
      sfx(p.state === 'swim' ? 'paddle' : 'stepWood');
    }
    if (p.state === 'wheel') {
      p.walkT += dt * 4;
      if (sc.stateT > 2.5 && !p.wheelDone) {
        p.wheelDone = true;
        emit('wheel');
      }
    } else p.wheelDone = false;
    // встроенные предметы: сначала тот, в котором сидит хомячок, потом всё, что живёт само (джакузи бурлит)
    if (p.fix && p.fix.def.whileUsed && p.state === p.fix.def.state) p.fix.def.whileUsed(sc, p.fix, dt);
    for (const b of fixtures) if (b.def.ambient) b.def.ambient(sc, b, dt);
    // предметы с таймером
    for (const it of sc.items()) {
      const lv = sc.live.get(it);
      if (lv && lv.t > 0) {
        lv.t -= dt;
        if (lv.t <= 0) sc.live.delete(it);
      }
    }
    updateActors(sc, dt);
    // частицы
    for (const q of sc.parts) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    sc.parts = sc.parts.filter((q) => q.t < q.life);
    // камера
    layout();
    if (!sc.decor.on) {
      const t = camTarget();
      sc.cam.follow(t.x, t.y, dt, 5);
    } else sc.cam.clamp();
  }

  // ---------- рисование ----------
  function drawPlayer(ctx, t) {
    const p = sc.p,
      look = playerLook();
    const base = {
      time: t,
      dir: p.dir,
      blink: blinkAt(t),
      happy: p.happy > 0,
      armsUp: p.happy > 0 && Math.sin(t * 10) > 0,
    };
    let y = fy(p.f),
      pose = { ...base, walk: p.moving ? p.walkT : null };
    if (p.lift) y = sc.liftY;
    if (p.state === 'sit') {
      y -= SEAT_H[FURN_BY_ID[p.item.id].kind] || 34;
      pose = { ...base, sit: true, shadow: false };
    } else if (p.state === 'wheel') {
      const d = FURN_BY_ID[p.item.id];
      drawHamster(ctx, p.x, y - d.h * 0.52 + d.w * 0.46 - 12, 1.02, look, {
        ...base,
        walk: p.walkT,
        shadow: false,
        dir: 1,
      });
      return;
    } else if (poses[p.state]) {
      const q = poses[p.state](base, p, t);
      y += q.dy;
      pose = q.pose;
    }
    drawHamster(ctx, p.x, y, HS, look, pose);
  }
  function drawParts(ctx) {
    for (const q of sc.parts) {
      const k = 1 - q.t / q.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (q.kind === 'heart') heart(ctx, q.x, q.y, q.r, '#ff5c8a');
      else if (q.kind === 'bubble') ell(ctx, q.x, q.y, q.r, q.r, 'rgba(255,255,255,.7)', '#a5d8ff', 1.2);
      else if (q.kind === 'steam') ell(ctx, q.x, q.y, q.r, q.r * 0.8, 'rgba(255,255,255,.5)');
      else if (q.kind === 'note') {
        ctx.fillStyle = '#845ef7';
        ctx.font = '800 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♪', q.x, q.y);
      } else {
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  function draw(ctx) {
    const { w, h } = G.view,
      t = G.time;
    drawSky(ctx, w, h);
    ctx.save();
    sc.cam.apply(ctx);
    ctx.lineJoin = 'round';
    drawHouse(ctx, desc, geo);
    if (geo.lift) drawLift(ctx, geo, sc.liftY);
    if (desc.art && desc.art.back) desc.art.back(ctx, sc, t);
    for (const b of drawOrder) if (b.def.back) b.def.back(ctx, b.x - (b.def.ref || 0), fy(b.f), t, sc, b);
    drawItems(ctx, sc, t);
    drawActors(ctx, sc, t);
    drawPlayer(ctx, t);
    for (const b of drawOrder) if (b.def.front) b.def.front(ctx, b.x - (b.def.ref || 0), fy(b.f), t, sc, b);
    if (desc.art && desc.art.front) desc.art.front(ctx, sc, t);
    drawParts(ctx);
    ctx.restore();
  }

  return sc;
}

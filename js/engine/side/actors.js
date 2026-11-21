// «Движок домов», часть 4: хомячки в доме, кроме игрока, — гости (приглашённые друзья, список в сохранении)
// и «жильцы» из описания дома (хозяин в своём домике, продавец в зале).
//
// В описании дома:
//   guests: { f, enterX, gap, first: [x0, x1], roam: [x0, x1] }   дом принимает гостей; где они появляются и гуляют
//   actors: [{ npc, f, x, roam: [x0, x1] | null, act, spot }]    жильцы: кто, где стоит, где бродит,
//                                                                 act — действие из реестра по нажатию,
//                                                                 spot — имя точки из расписания жителя (по умолчанию
//                                                                 'in' — «у себя дома»): жилец здесь тогда и только
//                                                                 тогда, когда его место сейчас (npcNow, core/npc.js) —
//                                                                 эта сцена и эта точка; free: true — всегда здесь
//                                                                 (пробный дом)
// У гостя действие всегда 'guest:<житель>'.
// Гость может нести что-то в лапках: g.carry = { c, c2, give } — коробочка с лентой (подарок на «Год в городе»,
// рассада во вводном задании). give = { x, y, a } — коробочку вручают: она летит дугой к точке (x, y), a — 0…1
// (двигает тот, кто вручает: features/holidays_bday.js, features/welcome.js).
import { G, questBadge, npcDress, npcNow } from '../../core/state.js';
import { rnd } from '../../core/util.js';
import { fillRR, ell } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { NPC_BY_ID, npcLook } from '../../data/index.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { OUT, HS } from './rooms.js';

/** Жильцы из описания дома — создаются один раз. */
export function makeResidents(desc) {
  return (desc.actors || []).map((a, i) => ({
    id: a.npc,
    act: a.act || 'npc:' + a.npc,
    ph: 1 + i * 2.3,
    x: a.x,
    f: a.f || 0,
    tx: a.x,
    wait: 1,
    dir: 1,
    walkT: 0,
    happy: 0,
    roam: a.roam || null,
    scene: desc.id,
    spot: a.spot || 'in',
    free: !!a.free,
  }));
}
/** Пора ли жильцу быть здесь: его место сейчас (npcNow) — эта сцена и эта точка, и его видно. */
function due(g) {
  if (g.guest || g.free) return true;
  const p = npcNow(g.id);
  return !p || (p.scene === g.scene && p.spot === g.spot && p.visible);
}
/** Здесь ли сейчас жилец (g.hide — едет в лифте, его не видно). */
export const actorHere = (g) => !g.hide && due(g);

/**
 * Привести гостей в соответствие со списком в сохранении: ушедших убрать, новых впустить.
 * Гости сидят в одном из своих домов — в том, куда их позвали (state.guestsAt).
 */
export function syncGuests(sc) {
  const cfg = sc.desc.guests;
  if (!cfg) return;
  const ids = (G.state.guestsAt || 'villa') === sc.houseKey ? G.state.guests : [];
  sc.actors = sc.actors.filter((g) => !g.guest || ids.includes(g.id));
  const count = () => sc.actors.filter((g) => g.guest).length;
  for (const id of ids) {
    if (!sc.actors.find((g) => g.guest && g.id === id))
      sc.actors.push({
        guest: true,
        id,
        act: 'guest:' + id,
        ph: 1 + count() * 2.3,
        x: cfg.enterX + count() * cfg.gap,
        f: cfg.f,
        tx: rnd(cfg.first[0], cfg.first[1]),
        wait: 1,
        dir: 1,
        walkT: 0,
        happy: 0,
        roam: cfg.roam,
      });
  }
}

/** Гость (или жилец) радуется: сердечки. */
export function actorHappy(sc, id) {
  // у жильца может быть несколько мест по времени (аниматор отеля: терраса или холл) — сначала тот, кто сейчас здесь
  const g = sc.actors.find((q) => q.id === id && actorHere(q)) || sc.actors.find((q) => q.id === id);
  if (!g) return;
  sfx('heart');
  g.happy = 2.5;
  sc.burst(g.x, sc.geo.fy(g.f) - 130, 'heart', 6);
}

export function hitActor(sc, wx, wy) {
  for (const g of sc.actors) {
    if (!actorHere(g)) continue;
    const y = sc.geo.fy(g.f);
    if (Math.abs(wx - g.x) < 42 && wy > y - 130 && wy < y + 8) return g;
  }
  return null;
}

/** Хомячки бродят по своему этажу: постоят — и идут в новую точку. */
export function updateActors(sc, dt) {
  for (const g of sc.actors) {
    if (g.happy > 0) g.happy -= dt;
    if (!g.roam || !actorHere(g)) continue;
    if (g.wait > 0) {
      g.wait -= dt;
      continue;
    }
    const dx = g.tx - g.x,
      step = 120 * dt;
    if (Math.abs(dx) <= step) {
      g.x = g.tx;
      g.wait = rnd(2, 6);
      g.tx = rnd(g.roam[0], g.roam[1]);
      g.moving = false;
    } else {
      g.x += Math.sign(dx) * step;
      g.dir = Math.sign(dx);
      g.walkT += dt * 2;
      g.moving = true;
    }
  }
}

/** Коробочка с лентой и бантиком: центр (x, y), k — размер; b.c — коробка, b.c2 — лента; b.kind 'pot' — рассада в горшочке. */
export function paintGiftBox(ctx, x, y, k, b) {
  if (b.kind === 'pot') {
    // горшочек с рассадой: три листика
    for (const [dx, r] of [
      [-6, -0.5],
      [0, 0],
      [6, 0.5],
    ])
      ell(ctx, x + dx * k, y - 13 * k, 4 * k, 8 * k, '#51cf66', OUT, 1.4, r);
    fillRR(ctx, x - 11 * k, y - 8 * k, 22 * k, 5 * k, 2, b.c2 || '#e8590c', OUT, 1.5);
    fillRR(ctx, x - 9 * k, y - 4 * k, 18 * k, 13 * k, 3, b.c || '#d9773c', OUT, 1.5);
    return;
  }
  fillRR(ctx, x - 12 * k, y - 9 * k, 24 * k, 19 * k, 3, b.c || '#ff8fab', OUT, 1.6);
  ctx.fillStyle = b.c2 || '#fff';
  ctx.fillRect(x - 2.5 * k, y - 8 * k, 5 * k, 17 * k);
  ctx.fillRect(x - 11 * k, y - 1.5 * k, 22 * k, 4 * k);
  ell(ctx, x - 5 * k, y - 12 * k, 5 * k, 3.5 * k, b.c2 || '#fff', OUT, 1.3, -0.5);
  ell(ctx, x + 5 * k, y - 12 * k, 5 * k, 3.5 * k, b.c2 || '#fff', OUT, 1.3, 0.5);
  ell(ctx, x, y - 10 * k, 2.6 * k, 2.6 * k, b.c2 || '#fff', OUT, 1.2);
}

// Житель — из кэша кадров (От12, как жители локаций — engine/topdown/actors.js): 8 кадров шага или 4 кадра
// «дыхания», глаза открыты или закрыты, смотрит влево или вправо. Радуется (руки вверх) — рисуется линиями.
const WALK_FRAMES = 8,
  IDLE_FRAMES = 4;
export function drawActors(ctx, sc, t) {
  const fest = npcDress(); // в праздник жители — в праздничных нарядах (этап 15)
  for (const g of sc.actors) {
    const n = NPC_BY_ID[g.id];
    if (!n || !actorHere(g)) continue;
    const y = sc.geo.fy(g.f),
      s = HS * (n.small ? 0.78 : 1);
    if (g.happy > 0 || !sc.sprite) {
      drawHamster(ctx, g.x, y, s, npcLook(g.id, fest), {
        time: t + g.ph,
        dir: g.dir,
        walk: g.moving ? g.walkT : null,
        happy: g.happy > 0,
        armsUp: g.happy > 0 && Math.sin(t * 10) > 0,
        blink: blinkAt(t, g.ph),
      });
    } else {
      const shut = blinkAt(t, g.ph) > 0.5 ? 1 : 0;
      const fr = g.moving
        ? Math.floor((((g.walkT % 1) + 1) % 1) * WALK_FRAMES)
        : WALK_FRAMES + Math.min(IDLE_FRAMES - 1, Math.floor(((Math.sin((t + g.ph) * 2.2) + 1) / 2) * IDLE_FRAMES));
      const i = fr - WALK_FRAMES,
        time = i < 0 ? 0 : Math.asin((((i + 0.5) / IDLE_FRAMES) * 2 - 1) * 0.9) / 2.2;
      const dir = g.dir === -1 ? -1 : 1;
      sc.sprite(
        `actor:${g.id}:${fest || ''}:${dir}:${fr}:${shut}`,
        [-62 * s, -128 * s, 62 * s, 12 * s],
        (c) =>
          drawHamster(c, 0, 0, s, npcLook(g.id, fest), {
            time,
            dir,
            walk: i < 0 ? (fr + 0.5) / WALK_FRAMES : null,
            blink: shut,
          }),
        g.x,
        y,
      );
    }
    if (g.carry) {
      // коробочка в лапках (перед грудью, чуть впереди по ходу) или в полёте к тому, кому её дарят
      const k = s * 0.8,
        hx = g.x + (g.dir === -1 ? -1 : 1) * 15 * s,
        hy = y - 27 * s + (g.moving ? Math.sin(g.walkT * Math.PI * 4) * 1.5 : 0),
        gv = g.carry.give;
      if (gv) {
        const a = Math.min(1, Math.max(0, gv.a));
        paintGiftBox(
          ctx,
          hx + (gv.x - hx) * a,
          hy + (gv.y - hy) * a - Math.sin(a * Math.PI) * 70,
          k * (1 + Math.sin(a * Math.PI) * 0.25),
          g.carry,
        );
      } else {
        paintGiftBox(ctx, hx, hy, k, g.carry);
        // лапки держат коробочку с боков
        const fur = npcLook(g.id, fest).fur || '#f0c27b';
        ell(ctx, hx - 14 * k, hy + 2 * k, 5 * k, 4.5 * k, fur, OUT, 1.5);
        ell(ctx, hx + 14 * k, hy + 2 * k, 5 * k, 4.5 * k, fur, OUT, 1.5);
      }
    }
    // табличка с именем; дом показан мелко (планшет стоя, В12) — табличка крупнее, чтобы имя читалось
    const tk = Math.max(1, 0.66 / (sc.cam.zoom || 1)),
      ty = y - 142 * (n.small ? 0.8 : 1);
    ctx.font = `800 ${Math.round(15 * tk)}px ui-rounded, "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(n.name).width + 14 * tk;
    fillRR(ctx, g.x - tw / 2, ty - (n.small ? 8 : 10) * tk, tw, 20 * tk, 10 * tk, 'rgba(255,255,255,.9)');
    ctx.fillStyle = OUT;
    ctx.fillText(n.name, g.x, ty + (n.small ? 2 : 0));
    // журнал заданий: «!» — у жителя есть задание, «?» — к нему пора с заданием (и у себя дома, и в гостях)
    const mark = questBadge(g.id);
    if (mark) {
      const by = y - 178 * (n.small ? 0.8 : 1) - 10 * (tk - 1) + Math.round(Math.sin(t * 3 + g.ph) * 3);
      ell(ctx, g.x, by + 2, 16, 16, 'rgba(60,40,30,.28)');
      ell(ctx, g.x, by, 16, 16, mark === '!' ? '#ffd43b' : '#8ce99a', OUT, 2.5);
      ctx.font = '900 23px ui-rounded, "Trebuchet MS", sans-serif';
      ctx.fillStyle = OUT;
      ctx.fillText(mark, g.x, by + 1.5);
    }
  }
}

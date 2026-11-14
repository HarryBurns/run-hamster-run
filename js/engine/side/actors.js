// «Движок домов», часть 4: хомячки в доме, кроме игрока, — гости (приглашённые друзья, список в сохранении)
// и «жильцы» из описания дома (хозяин в своём домике, продавец в зале).
//
// В описании дома:
//   guests: { f, enterX, gap, first: [x0, x1], roam: [x0, x1] }   дом принимает гостей; где они появляются и гуляют
//   actors: [{ npc, f, x, roam: [x0, x1] | null, act }]          жильцы: кто, где стоит, где бродит,
//                                                                 act — действие из реестра по нажатию
// У гостя действие всегда 'guest:<житель>'.
import { G } from '../../core/state.js';
import { rnd } from '../../core/util.js';
import { fillRR } from '../../core/draw.js';
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
  }));
}

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
  const g = sc.actors.find((q) => q.id === id);
  if (!g) return;
  sfx('heart');
  g.happy = 2.5;
  sc.burst(g.x, sc.geo.fy(g.f) - 130, 'heart', 6);
}

export function hitActor(sc, wx, wy) {
  for (const g of sc.actors) {
    const y = sc.geo.fy(g.f);
    if (Math.abs(wx - g.x) < 42 && wy > y - 130 && wy < y + 8) return g;
  }
  return null;
}

/** Хомячки бродят по своему этажу: постоят — и идут в новую точку. */
export function updateActors(sc, dt) {
  for (const g of sc.actors) {
    if (g.happy > 0) g.happy -= dt;
    if (!g.roam) continue;
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

export function drawActors(ctx, sc, t) {
  for (const g of sc.actors) {
    const n = NPC_BY_ID[g.id];
    if (!n) continue;
    const y = sc.geo.fy(g.f);
    drawHamster(ctx, g.x, y, HS * (n.small ? 0.78 : 1), npcLook(g.id), {
      time: t + g.ph,
      dir: g.dir,
      walk: g.moving ? g.walkT : null,
      happy: g.happy > 0,
      armsUp: g.happy > 0 && Math.sin(t * 10) > 0,
      blink: blinkAt(t, g.ph),
    });
    // табличка с именем
    ctx.font = '800 15px ui-rounded, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(n.name).width + 14;
    fillRR(ctx, g.x - tw / 2, y - 152 * (n.small ? 0.8 : 1), tw, 20, 10, 'rgba(255,255,255,.9)');
    ctx.fillStyle = OUT;
    ctx.fillText(n.name, g.x, y - 142 * (n.small ? 0.8 : 1) + (n.small ? 2 : 0));
  }
}

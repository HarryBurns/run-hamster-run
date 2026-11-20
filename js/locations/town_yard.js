// Двор виллы растёт вместе с домом («Вилла растёт», docs/DESIGN.md): пруд, бассейн с лежаками, ещё грядки и теплица
// появляются, когда их построили (state.villaUp — data/estate.js).
//
// Карту города town_map.js строит один раз и целиком — «как было»: с прудом, бассейном и восемью грядками (так зелень
// города растёт на тех же местах в любой игре). syncVillaYard(sc) приводит двор к тому, что построено сейчас: меняет
// виды клеток (m.retile), ставит и убирает лежаки, камыши, теплицу и просит землю перерисоваться (resetGround).
// Зовётся, когда карта построена, при входе в город и когда строители закончили (событие villaUp). Что двор сейчас
// показывает, помнит сама карта (m.villaYard), поэтому вызов без перемен ничего не делает.
// Предметы двора, которые хозяйка поставила сама (features/yard.js), сверяются после: что оказалось в воде или на
// грядке — возвращается в сарайчик (событие yard).
import { emit, on } from '../core/events.js';
import { fillRR, line, poly } from '../core/draw.js';
import { G } from '../core/state.js';
import { T, OUT, put, defineObjects } from '../engine/topdown/kinds.js';
import { resetGround } from '../engine/topdown/ground.js';
import { getLocation } from '../engine/topdown/scene.js';
import { BED_CELLS } from './town_map.js';

/** Двор, каким его строит town_map.js. */
const BUILT = { pool: 1, pond: 1, beds: 1, green: 0 };
const POOL = { tiles: [5, 15, 14, 23], water: [6, 16, 13, 22] };
const POND = [22.5, 19.5, 3.2, 2.6]; // как в town_map.js (ground)
/** Теплица: левая клетка ряда грядок; вокруг (GREEN_CLEAR) убирается зелень — к грядкам можно подойти. */
const GREEN_AT = BED_CELLS[10],
  GREEN_CLEAR = [23, 5, 26, 9];
/** Что стоит у бассейна и у пруда: [вид, x, y, поля]. */
const THINGS = {
  pool: [
    ['lounger', 7, 14],
    ['lounger', 9, 14],
    ['lounger', 11, 14],
    ['umbrella', 13, 14, { solid: true }],
  ],
  pond: [
    ['icehole', 22, 19],
    ['reeds', 19, 18],
    ['reeds', 26, 20, { v: 1 }],
  ],
};

defineObjects({
  // теплица: стеклянный домик над четырьмя грядками (клетки грядок — вид «bg» в town.js; o — левая клетка ряда)
  greenhouse: {
    art: {
      greenhouse: [
        [-34, -92, 178, 30],
        (ctx, snow) => {
          const x0 = -28,
            x1 = 172,
            w = x1 - x0;
          // стекло: стенки и двускатная крыша
          ctx.fillStyle = 'rgba(208,240,255,.26)';
          ctx.fillRect(x0, -44, w, 68);
          poly(
            ctx,
            [x0 - 4, -44, x0 + 26, -84, x1 - 26, -84, x1 + 4, -44],
            snow ? 'rgba(255,255,255,.8)' : 'rgba(190,232,255,.42)',
            OUT,
            2.2,
          );
          // блики
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          for (let x = x0 + 14; x < x1 - 20; x += 50)
            poly(ctx, [x, -40, x + 12, -40, x + 2, -6, x - 10, -6], 'rgba(255,255,255,.3)');
          // белый каркас
          const bar = (ax, ay, bx, by, lw = 3.2) => {
            line(ctx, ax, ay, bx, by, OUT, lw + 2);
            line(ctx, ax, ay, bx, by, '#fff', lw);
          };
          for (let i = 0; i <= 4; i++) bar(x0 + (w * i) / 4, -44, x0 + (w * i) / 4, 22);
          for (let i = 1; i < 4; i++) bar(x0 + (w * i) / 4, -44, x0 + 26 + ((w - 52) * i) / 4, -84, 2.4);
          bar(x0, -44, x1, -44);
          fillRR(ctx, x0 - 4, 18, w + 8, 8, 3, '#f1e0c5', OUT, 2);
          // флюгер-листик
          line(ctx, x0 + w / 2, -84, x0 + w / 2, -90, OUT, 2);
        },
      ],
    },
    draw(ctx, o, env) {
      put('greenhouse', o.x, o.y, env.season === 'winter' ? 1 : 0);
    },
  },
});

const pondCell = (x, y) => ((x + 0.5 - POND[0]) / POND[2]) ** 2 + ((y + 0.5 - POND[1]) / POND[3]) ** 2 <= 1;
/** Поставить (on) или убрать вещи из списка THINGS. */
function things(m, list, on) {
  for (const [type, x, y, o] of list) {
    for (const ob of m.objs.filter((q) => q.tx === x && q.ty === y && (on || q.type === type))) m.remove(ob);
    if (on) m.add(type, x, y, o || {});
  }
}
/** Убрать с клетки всё, что на ней стоит (зелень, предметы двора), и сменить её вид. */
function tile(m, x, y, kind) {
  m.clear(x, y);
  m.retile(x, y, kind);
}
const APPLY = {
  pool(m, on) {
    const [x0, y0, x1, y1] = POOL.tiles,
      [wx0, wy0, wx1, wy1] = POOL.water;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        tile(m, x, y, !on ? 'g' : x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1 ? 'o' : 'p');
    things(m, THINGS.pool, on);
  },
  pond(m, on) {
    for (let y = 16; y <= 22; y++) for (let x = 19; x <= 26; x++) if (pondCell(x, y)) tile(m, x, y, on ? 'd' : 'g');
    things(m, THINGS.pond, on);
  },
  beds(m, level) {
    [
      [3, 7],
      [8, 9],
    ].forEach((ids, i) => {
      for (const id of ids) tile(m, ...BED_CELLS[id], level > i ? 'b' : 'g');
    });
  },
  green(m, on) {
    const [x0, y0, x1, y1] = GREEN_CLEAR;
    if (on) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.clear(x, y);
    for (const ob of m.objs.filter((q) => q.type === 'greenhouse')) m.remove(ob);
    for (const [x, y] of BED_CELLS.slice(10)) tile(m, x, y, on ? 'bg' : 'g');
    if (on) m.add('greenhouse', GREEN_AT[0], GREEN_AT[1], {});
  },
};

/** Привести двор виллы на карте города к тому, что построено сейчас. true — двор изменился. */
export function syncVillaYard(sc) {
  const u = G.state && G.state.villaUp;
  if (!sc || !sc.built || !sc.map || !u) return false;
  const m = sc.map,
    was = m.villaYard || (m.villaYard = { ...BUILT });
  let changed = false;
  for (const k of Object.keys(APPLY)) {
    const want = u[k] || 0;
    if (was[k] === want) continue;
    APPLY[k](m, want);
    was[k] = want;
    changed = true;
  }
  if (!changed) return false;
  resetGround(m);
  // хомячок оказался в новой грядке или в заборе клеток — встаёт у двери виллы
  const p = sc.p,
    tx = Math.floor(p.x / T),
    ty = Math.floor(p.y / T);
  if (m.solid[ty] && m.solid[ty][tx]) {
    const d = m.doorPx(m.bById.villa);
    p.x = d.x;
    p.y = d.y;
    p.path = [];
  }
  emit('yard', { what: 'land' }); // предметы двора (features/yard.js) сверяются с новой землёй
  return true;
}
on('villaUp', ({ what }) => {
  if (what !== 'order') syncVillaYard(getLocation('world'));
});

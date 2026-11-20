// Шаги автотеста мелких доработок «Баги от заказчика, 19 ноября» (BACKLOG, З-пункты), где меняется поведение:
//   З18 — подсказки сверху не ложатся на плашки HUD (на телефоне они в два-три ряда, письмо — во втором);
//   З20 — указатели в пещерах чуть светятся без фонарика; табличка «Парк» — сбоку дорожки, проход свободен.
// Заставка (З17, З22, З24) — в dev/smoke_title.js.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:З-доработки"
const lib = require('./lib.js');

module.exports = async function pol(ctx) {
  const { step, ev, expect, fresh, go, frames } = lib(ctx);

  await step('З-доработки З18: подсказки сверху — под плашками HUD, не на плашке письма', async () => {
    await fresh();
    await go('world');
    const r = await ev(async () => {
      const d = window.__dev;
      d.ui.toast('Подсказка: нажми на плашку письма, чтобы прочитать его ещё раз');
      d.ui.toast('Ещё одна подсказка');
      await new Promise((ok) => setTimeout(ok, 350)); // подсказки выехали (анимация появления)
      const chips = [...document.querySelectorAll('#hud .hud-top > *')]
          .filter((c) => !c.hidden && c.getBoundingClientRect().height)
          .map((c) => ({ cls: c.className, ...c.getBoundingClientRect().toJSON() })),
        toasts = [...document.querySelectorAll('#toasts .toast')].map((t) => t.getBoundingClientRect().toJSON());
      const hit = [];
      for (const t of toasts)
        for (const c of chips)
          if (t.top < c.bottom && t.bottom > c.top && t.left < c.right && t.right > c.left) hit.push(c.cls);
      document.querySelector('#toasts').innerHTML = '';
      return { hit, chips: chips.length, rows: new Set(chips.map((c) => Math.round(c.top))).size, n: toasts.length };
    });
    expect(r.n === 2 && r.chips >= 3, 'подсказок или плашек нет', r);
    expect(!r.hit.length, 'подсказка легла на плашку HUD', r);
  });

  await step(
    'З-доработки З20: указатели в пещерах светятся без фонарика; «Парк» сбоку дорожки — проход свободен',
    async () => {
      await fresh();
      const r = await ev(async () => {
        const d = window.__dev;
        if (!d.QuestState.landOpen('caves')) d.actions.openLand('caves');
        d.go('caves');
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const sc = d.locations.caves,
          g = sc.desc.gloom(sc),
          signs = sc.map.objs.filter((o) => o.type === 'signpost'),
          // у каждого указателя — слабое пятно света на досках (не ярче фонаря: темнота остаётся)
          glow = signs.map((o) =>
            g.lights.some((q) => Math.hypot(q[0] - o.x, q[1] - (o.y - 47)) < 24 && q[4] > 0.2 && q[4] < 0.7),
          );
        // город: табличка «Парк» — не на дорожке, клетки дорожки у входа в парк проходимы
        d.go('world');
        const m = d.locations.world.map,
          park = m.objs.find((o) => o.type === 'signpost' && o.text === '🌳 Парк'),
          P = await import('/js/locations/common/props.js'),
          w = P.nameplateLayout(document.createElement('canvas').getContext('2d'), park.text, '').w,
          path = m.at(40, 30), // дорожка в парк
          posts = [park.x - (w / 2 - 12), park.x + (w / 2 - 12)].map((x) => m.at(Math.floor(x / 48), park.ty)),
          blocked = [];
        for (let y = park.ty - 2; y <= park.ty + 2; y++)
          for (let x = park.tx - 3; x <= park.tx + 3; x++)
            if (m.at(x, y) === path && m.solid[y][x]) blocked.push([x, y]);
        return { signs: signs.length, glow, hero: g.hero, onPath: posts.includes(path), blocked, gap: m.solid[29][41] };
      });
      expect(r.signs >= 2 && r.glow.every(Boolean), 'указатели в пещере не светятся', r);
      expect(r.hero[0] < 150, 'в пещере горит фонарик — проверка не годится', r.hero);
      expect(!r.onPath && !r.blocked.length && !r.gap, 'табличка «Парк» мешает пройти по дорожке', r);
      await go('villa');
      await frames(1);
    },
  );
};

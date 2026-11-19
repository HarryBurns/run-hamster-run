// Шаги автотеста мелких исправлений «Замечено в третьем обновлении» (BACKLOG, Т-пункты) и ревью, где меняется поведение:
//   Т7 — звёздочка писем «Беги, хомячок» и «Маленький концерт» ведёт в дом, где стоит колесо / пианино;
//   Т8 — на iPad лёжа вилла видна целиком, отель — все этажи по высоте (а не масштаб 1,05, как на телефоне).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:исправления"
const lib = require('./lib.js');

module.exports = async function tfix(ctx) {
  const { page, step, ev, wait, closeAll, expect, fresh: newGame, frames, go } = lib(ctx);
  const fresh = () => newGame({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true }); // июль, полдень

  await step('исправления Т7: колесо и пианино в квартире — письмо и звёздочка ведут в квартиру, а не к вилле', async () => {
    await fresh();
    await go('world');
    await closeAll();
    for (const [task, thing] of [
      ['wheel', 'wheel'],
      ['piano', 'piano'],
    ]) {
      const r = await ev(
        ([task, thing]) => {
          const d = window.__dev;
          d.actions.mutate((s) => {
            if (!s.homesOwned.includes('flat')) s.homesOwned.push('flat');
            s.villa = s.villa.filter((i) => i.id !== thing);
            s.homes.flat = [...(s.homes.flat || []).filter((i) => i.id !== thing), { uid: 90000 + thing.length, id: thing, floor: 0, x: 300, y: 0 }];
          });
          d.actions.setMail(task);
          d.actions.readMail();
          const W = d.World,
            t = W.target(),
            flat = W.doorOf('home_apartment'),
            villa = W.doorOf('villa');
          return { t, flat, villa };
        },
        [task, thing],
      );
      expect(!!r.t, `«${task}»: звёздочки нет`, r);
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - (b.y - 48));
      expect(dist(r.t, r.flat) < 10, `«${task}»: звёздочка не у двери квартиры`, r);
      expect(dist(r.t, r.villa) > 100, `«${task}»: звёздочка всё ещё у виллы`, r);
    }
    // в письме — «Куда идти: Квартира в городе»
    await ev(() => window.__dev.run('mailbox'));
    await frames(2);
    const txt = await ev(() => (document.querySelector('.letter') || {}).textContent || '');
    expect(/Квартира/.test(txt) && !/Куда идти: Вилла/.test(txt), 'в письме «Куда идти» — не квартира', txt);
    await closeAll();
  });

  await step('исправления Т8: на iPad лёжа вилла видна целиком, в отеле — все этажи, камера видит хомячка', async () => {
    const size = page.viewportSize();
    await fresh();
    try {
      for (const [w, h] of [
        [1024, 768],
        [1180, 820],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await wait(300);
        for (const id of ['villa', 'hotel']) {
          await ev((id) => {
            const d = window.__dev,
              W = d.scenes[id].geo.W;
            d.go(id, { pos: { scene: id, floor: 2, x: W - 60 } });
          }, id);
          await wait(900);
          const r = await ev(() => {
            const s = window.__dev.scene,
              v = s.cam.visible(0),
              p = s.p,
              q = s.cam.toScreen(p.x, s.geo.fy(p.f) - 60),
              top = s.cam.toScreen(0, s.geo.fy(s.geo.floors - 1) - s.geo.FH),
              bot = s.cam.toScreen(0, s.geo.fy(0)),
              vw = window.__dev.G.view;
            return {
              name: s.name,
              z: +s.cam.zoom.toFixed(3),
              x0: Math.round(v.x0),
              x1: Math.round(v.x1),
              W: s.geo.WTOT,
              hx: Math.round(q.x),
              hy: Math.round(q.y),
              top: Math.round(top.y),
              bot: Math.round(bot.y),
              w: vw.w,
              h: vw.h,
            };
          });
          const tag = `${w}×${h} ${id}`;
          expect(r.name === id, `${tag}: не та сцена (проверка не годится)`, r);
          expect(r.hx > 60 && r.hx < r.w - 60 && r.hy > 60 && r.hy < r.h - 60, `${tag}: хомячок не на экране`, r);
          expect(r.top >= -4 && r.bot <= r.h + 4, `${tag}: видны не все этажи`, r);
          if (id === 'villa') expect(r.x0 <= 0 && r.x1 >= r.W, `${tag}: вилла видна не целиком`, r);
          else expect(r.z < 0.85 && r.x1 - r.x0 > r.W * 0.6, `${tag}: отель крупный, как на телефоне`, r);
        }
      }
      // компьютер 16:9 — как было: отель крупно (1,05), камера следит
      await page.setViewportSize({ width: 1280, height: 720 });
      await wait(300);
      await ev(() => window.__dev.go('hotel', { pos: { scene: 'hotel', floor: 1, x: 600 } }));
      await wait(600);
      const z = await ev(() => +window.__dev.scene.cam.zoom.toFixed(2));
      expect(z === 1.05, 'на компьютере масштаб отеля изменился', z);
    } finally {
      await page.setViewportSize(size);
      await wait(300);
    }
  });
};

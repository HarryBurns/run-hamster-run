// Шаги автотеста мелких исправлений «Замечено в третьем обновлении» (BACKLOG, Т-пункты) и ревью, где меняется поведение:
//   Т7 — звёздочка писем «Беги, хомячок» и «Маленький концерт» ведёт в дом, где стоит колесо / пианино.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:исправления"
const lib = require('./lib.js');

module.exports = async function tfix(ctx) {
  const { step, ev, closeAll, expect, fresh: newGame, frames, go } = lib(ctx);
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
};

// Шаги автотеста «Мелочи» (пачка 20 ноября): полезный компас (О5) — стрелка к цели задания журнала, к дороге
// в другое место, на кораблике без цели — на юг, к острову, без цели — на север.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:мелочи
const lib = require('./lib.js');

module.exports = async function trifles(ctx) {
  const L = lib(ctx);
  const { step, ev, wait, closeAll, norm, expect, untilPanel, frames } = L;
  const ALL = ['forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island'];
  /** Полдень тёплого дня, места открыты, компас в рюкзаке. */
  const setup = () =>
    ev((ids) => {
      const d = window.__dev;
      for (const id of ids) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
      d.actions.mutate((s) => {
        s.day = 18;
        s.minutes = 12 * 60;
        s.weather = 'sun';
        s.dayFlags = {};
        if (s.mail) s.mail.read = s.mail.done = true; // письмо дня сделано — звёздочка ему не нужна
      });
      d.actions.addItem('finds', 'compass', 1);
    }, ALL);
  /** Нажать на компас в рюкзаке: что сказал компас, и куда должна смотреть стрелка (сторона света от хомячка к звёздочке). */
  const compass = async () => {
    await closeAll();
    await ev(() => {
      window.__dev.F.openBackpack();
    });
    await untilPanel();
    await ev(() =>
      [...document.querySelectorAll('.overlay .tabs button')].find((b) => /Находки/.test(b.textContent)).click(),
    );
    await frames(2);
    expect(await ev(() => !!document.querySelector('.overlay .compass-card')), 'компас в рюкзаке не нажимается');
    await ev(() => document.querySelector('.overlay .compass-card').click());
    await L.until(() => !!document.querySelector('.overlay .compass-text'));
    const r = await ev(() => {
      const d = window.__dev,
        loc = d.locations[d.sceneName] || d.locations.world,
        tg = loc.target(),
        p = loc.p;
      const sides = [
        'севере',
        'северо-востоке',
        'востоке',
        'юго-востоке',
        'юге',
        'юго-западе',
        'западе',
        'северо-западе',
      ];
      const side = tg ? sides[(Math.round(Math.atan2(tg.x - p.x, -(tg.y - p.y)) / (Math.PI / 4)) + 8) % 8] : null;
      return { text: document.querySelector('.overlay .compass-text').textContent, side };
    });
    r.text = norm(r.text);
    await closeAll();
    return r;
  };

  await step(
    'мелочи: компас в рюкзаке — к цели задания, к дороге в другое место, на кораблике — на юг, без цели — на север',
    async () => {
      await L.fresh();
      await setup();
      await L.go('world');
      // заданий нет — компас смотрит на север
      let r = await compass();
      expect(/смотрит на север/.test(r.text), 'без задания — не «на север»', r);
      // задание на горе: из города — к тропе в лес («сначала»), сторона — та, где звёздочка
      await ev(() => {
        window.__dev.actions.takeQuest('lost_mitten');
      });
      r = await compass();
      expect(
        /Цель — в горах/.test(r.text) &&
          /сначала по тропе в лес/.test(r.text) &&
          r.side &&
          r.text.includes('на ' + r.side),
        'задание на горе из города',
        r,
      );
      expect((await ev(() => window.__dev.F.starScene())) === 'mountain', 'компас не показал задание звёздочкой');
      // на горе: к самой варежке; хомячок к западу от неё — «на востоке», к востоку — «на западе»
      await L.go('mountain');
      const at = await ev(() => {
        const sc = window.__dev.locations.mountain,
          tg = sc.target();
        return { tx: Math.floor(tg.x / 48), ty: Math.floor(tg.y / 48), w: sc.map ? sc.map.w : 0 };
      });
      let ok = false;
      for (const dx of [-6, -7, -8, -5, -9, -4]) {
        const moved = await ev(
          ([x, y]) => {
            const sc = window.__dev.locations.mountain;
            sc.debugTeleport(x, y);
            return Math.floor(sc.p.x / 48) === x && Math.floor(sc.p.y / 48) === y;
          },
          [at.tx + dx, at.ty],
        );
        if (!moved) continue;
        await wait(60);
        r = await compass();
        expect(/в горах/.test(r.text) && r.text.includes('на ' + r.side), 'на горе — сторона к варежке', r);
        ok = true;
        break;
      }
      expect(ok, 'на горе не нашлось клетки западнее варежки', at);
      // на кораблике без задания — на юг, к острову
      await L.fresh();
      await setup();
      await L.go('world');
      await ev(() => {
        const d = window.__dev;
        d.actions.patchState('boat', { x: 66 * 48, y: 95 * 48, on: true });
        d.go('world', { pos: { scene: 'world', x: 66 * 48, y: 95 * 48 } });
      });
      await wait(200);
      expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике');
      r = await compass();
      expect(/на юг — к острову/.test(r.text), 'на кораблике без цели — не «на юг»', r);
    },
  );
};

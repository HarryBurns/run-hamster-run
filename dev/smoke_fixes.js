// Шаги автотеста мелких доработок «Замечено во втором обновлении» (BACKLOG, В-пункты), где меняется поведение:
//   В2 — в фото-режиме стрелка к цели у края экрана (значок письма) не рисуется;
//   В7 — транспорт с клавиатуры упирается в воду — подсказка «слезь»;
//   В15 — вода у острова тёплая круглый год (на острове всегда лето).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:доработки"
module.exports = async function fixes({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0));
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
    await mutate('s.minutes = 12 * 60; s.day = 18; s.weather = "sun"; s.dayFlags = {};');
  };

  await step('доработки В2: в фото-режиме стрелки к письму у края экрана нет, после выхода — снова есть', async () => {
    await fresh();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // письмо не прочитано, хомячок далеко от ящика — у края экрана стрелка с ✉️
    await ev(() => {
      const d = window.__dev;
      if (d.G.state.mail) d.actions.mutate((s) => (s.mail.read = false));
      d.World.debugTeleport(40, 52);
    });
    await wait(500);
    expect(await ev(() => window.__dev.World.edgeArrow === true), 'нет стрелки к письму у края экрана (проверка не годится)');
    await closeAll();
    await page.click('#hud button:has-text("Фото")');
    await page.waitForSelector('#photo', { timeout: 4000 });
    await wait(400);
    expect(await ev(() => window.__dev.World.edgeArrow === false), 'в фото-режиме стрелка к письму всё ещё видна');
    await page.click('#photo .ph-x >> nth=-1');
    await wait(500);
    expect(await ev(() => !document.getElementById('photo') && window.__dev.World.edgeArrow === true), 'после фото-режима стрелка не вернулась');
  });

  await step('доработки В7: на самокате с клавиатуры упёрлась в воду — слезает сама и подсказывает, дальше идёт пешком', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      d.actions.addWheels('scooter');
      d.actions.useWheels('scooter');
      d.go('world');
      d.World.debugTeleport(40, 56);
    });
    await wait(300);
    await closeAll();
    await clearToasts();
    expect(await ev(() => window.__dev.F.mountWheels()), 'не села на самокат');
    expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'не едет на самокате');
    // вниз, к морю: стрелкой с клавиатуры
    await page.keyboard.down('ArrowDown');
    for (let i = 0; i < 40 && (await ev(() => window.__dev.F.ridingWheels())); i++) await wait(100);
    await page.keyboard.up('ArrowDown');
    expect(!(await ev(() => window.__dev.F.ridingWheels())), 'упёрлась в воду и так и стоит на самокате');
    expect(/Дальше вода/.test(await toasts()), 'нет подсказки, почему слезла', await toasts());
    expect((await ev(() => window.__dev.state.wheels.own)).includes('scooter'), 'самокат пропал');
  });

  await step('доработки В15: в январе у острова вода тёплая и вне лагуны — не «ледяное море»; в море города — ледяная', async () => {
    await fresh();
    // январь (холодный месяц), остров открыт; хомячок здорова и раньше не простывала
    const swimAt = async (scene, tx, ty, wx, wy) => {
      await clearToasts();
      return ev(
        async ([scene, tx, ty, wx, wy]) => {
          const d = window.__dev;
          if (!d.QuestState.landOpen('island')) d.actions.openLand('island');
          d.actions.mutate((s) => {
            s.day = 0;
            s.minutes = 12 * 60;
            s.weather = 'sun';
            s.sick = 0;
            s.immuneUntil = 0;
            s.dayFlags = {};
            s.flags.islandHint = 1;
          });
          d.go(scene);
          const sc = d.locations[scene];
          sc.debugTeleport(tx, ty);
          await new Promise((q) => setTimeout(q, 300));
          sc.walkTo((wx + 0.5) * 48, (wy + 0.5) * 48, true);
          for (let i = 0; i < 40 && !(sc.map.kindAt(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)) || {}).swim; i++)
            await new Promise((q) => setTimeout(q, 150));
          await new Promise((q) => setTimeout(q, 300));
          const k = sc.map.kindAt(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)) || {};
          return { water: k.swim && k.swim.where, tile: sc.map.at(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)), care: (d.G.state.dayFlags.careless || {}).sea || 0 };
        },
        [scene, tx, ty, wx, wy],
      );
    };
    // остров: пляж восточнее причала, в море прямо вниз (лагуна — у западного пляжа)
    const isl = await swimAt('island', 30, 28, 30, 31);
    expect(isl.water === 'sea', 'у острова не вошла в море (проверка не годится)', isl);
    expect(!isl.care, 'у острова в январе вода «ледяная» — неосторожность', isl);
    expect(!/ледян/i.test(await toasts()), 'у острова подсказка про ледяную воду', await toasts());
    // город: то же море в январе — ледяное (как было)
    const town = await swimAt('world', 40, 56, 40, 60);
    expect(town.water === 'sea' && town.care === 1, 'в море города в январе вода не ледяная', town);
  });
};

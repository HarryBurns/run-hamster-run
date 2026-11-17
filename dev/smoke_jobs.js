// Шаги автотеста этапа 17в «Профессии, фото-режим, нижний ярус пещер»:
//   профессии — «Парикмахер» (кнопка в окне салона красоты), «Спасатель» (вышка на пляже, спасатель Волна),
//   «Садовник» (садовая тележка Мяты в парке): работа открывается там, где сказано, играется через dev-хук канвы
//   до звёзд, платит зарплату по JOBS; общий предел оплачиваемых смен за день — PAID_DAY.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:17в:"
module.exports = async function jobs({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
  const mgText = async () => norm(await ev(() => (document.querySelector('#mg') || { textContent: '' }).textContent));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog') || {}).textContent || ''));
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
    await mutate('s.minutes = 12 * 60; s.day = 18; s.weather = "sun"; s.flags.hotelHint = 1; s.dayFlags = {};');
  };
  const hook = (name, ...a) =>
    ev(
      ([name, a]) => {
        const c = [...document.querySelectorAll('#mg canvas')].find((q) => q[name]);
        return c ? c[name](...a) : null;
      },
      [name, a],
    );
  const start = async () => {
    await page.waitForSelector('#mg .btn.green', { timeout: 8000 });
    await page.click('#mg .btn.green');
    await wait(900);
  };
  const ura = async () => {
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 30000 });
    const t = await mgText();
    await page.click('#mg >> text=Ура!');
    await wait(500);
    await closeAll();
    return t;
  };
  /** Подойти к месту города и нажать на него (точка мира в клетках). */
  const tapTown = async (stand, at) => {
    await ev(() => window.__dev.go('world'));
    await wait(500);
    await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), stand);
    await wait(500);
    const k = await ev(([x, y]) => window.__dev.World.debugScreen(x * 48, y * 48), at);
    await page.mouse.click(k.x, k.y);
  };
  const played = async () => (await state()).dayFlags.shifts || {};

  await step('17в: парикмахер — кнопка в окне салона, гости-жители по картинке, добрая подсказка, зарплата', async () => {
    await fresh();
    const m0 = (await state()).money;
    await ev(() => window.__dev.enterBuilding('salon'));
    await page.waitForSelector('text=Поработать парикмахером', { timeout: 6000 });
    await page.click('text=Поработать парикмахером');
    await page.waitForSelector('#mg', { timeout: 6000 });
    const intro = await mgText();
    expect(/Парикмахер/.test(intro) && /Зарплата/.test(intro), 'заставка без зарплаты', intro);
    await start();
    let hinted = false;
    for (let i = 0; i < 60; i++) {
      const s = await hook('__hair');
      if (!s) break;
      if (s.phase === 'wait') {
        await hook('__hairSolve', !hinted);
        if (!hinted) {
          hinted = true;
          await wait(200);
          const t = await mgText();
          expect(/Сравни|Подсказка/.test(t), 'нет доброй подсказки', t);
        }
      }
      await wait(400);
    }
    const t = await ura();
    expect(/Все 5 гостей/.test(t) && /Подсказок: 1/.test(t), 'итог парикмахера', t);
    const s = await state();
    expect(s.money > m0 && (s.dayFlags.shifts || {}).hairdresser === 1, 'зарплату не заплатили', { m0, m: s.money, sh: s.dayFlags.shifts });
  });

  await step('17в: спасатель — вышка на пляже, Волна зовёт на смену, круг и «доплыть за мячиком», зарплата', async () => {
    await fresh();
    const spot = await ev(async () => (await import('/js/locations/town.js')).JOB_SPOTS.lifeguard);
    await tapTown([spot[0] + 1, spot[1] + 2], [spot[0] + 0.5, spot[1] + 0.2]);
    await page.waitForSelector('.dialog >> text=На вышку', { timeout: 8000 });
    const d = await dialogText();
    expect(/Волна/.test(d) && /Зарплата/.test(d) && !/Купить заведение/.test(d), 'диалог у вышки', d);
    await page.click('.dialog >> text=На вышку');
    await start();
    const kinds = new Set();
    for (let i = 0; i < 300; i++) {
      const s = await hook('__guard');
      if (!s || s.over) break;
      const a = s.active[0];
      if (a) {
        kinds.add(a.item ? 'item' : 'ring');
        await hook('__guardTap', a.item ? a.item.x : a.x, a.item ? a.item.y : a.y - 12);
      }
      await wait(200);
    }
    const t = await ura();
    expect(/Ты помогла/.test(t), 'итог спасателя', t);
    expect((await played()).lifeguard === 1, 'смену спасателя не засчитали', await played());
  });

  await step('17в: садовник — тележка Мяты в парке, полить, подстричь куст по шаблону, клумба по схеме', async () => {
    await fresh();
    const spot = await ev(async () => (await import('/js/locations/town.js')).JOB_SPOTS.garden);
    await tapTown([spot[0] - 1, spot[1] + 1], [spot[0] + 0.5, spot[1] + 0.2]);
    await page.waitForSelector('.dialog >> text=Помочь в парке', { timeout: 8000 });
    const d = await dialogText();
    expect(/Мята/.test(d) && /Зарплата/.test(d), 'диалог у тележки', d);
    await page.click('.dialog >> text=Помочь в парке');
    await start();
    const stages = new Set();
    // одна ошибка — уже политый цветок: подсказка, не наказание
    for (let i = 0; i < 400; i++) {
      const s = await hook('__garden');
      if (!s || s.over) break;
      stages.add(s.stage);
      if (!s.busy) await hook('__gardenDo');
      await wait(s.stage === 'water' ? 1000 : 120);
    }
    expect(stages.size === 3, 'не все три дела садовника', [...stages]);
    const t = await ura();
    expect(/клумба/.test(t), 'итог садовника', t);
    expect((await played()).gardener === 1, 'смену садовника не засчитали', await played());
  });

  await step('17в: общий предел оплачиваемых смен за день — дальше «для удовольствия», без монет', async () => {
    await fresh();
    const lim = await ev(async () => (await import('/js/data/economy.js')).PAID_DAY);
    // наработалась: все смены дня уже оплачены на других работах
    await mutate(`s.dayFlags.shifts = { swim: 2, teacher: 2, doctor: 2, chef: 2, fashion: 2, barista: 2, porter: ${lim - 12} };`);
    const m0 = (await state()).money;
    await ev(() => window.__dev.run('minigame:gardener'));
    await page.waitForSelector('#mg', { timeout: 6000 });
    const intro = await mgText();
    expect(new RegExp(`уже отработала ${lim} смен`).test(intro), 'нет слов про общий предел', intro);
    await page.click('#mg .xbtn');
    await wait(400);
    await closeAll();
    expect((await state()).money === m0, 'монеты изменились без игры');
  });
};

// Шаги автотеста этапа 17в «Профессии, фото-режим, нижний ярус пещер»:
//   профессии — «Парикмахер» (кнопка в окне салона красоты), «Спасатель» (вышка на пляже, спасатель Волна),
//   «Садовник» (садовая тележка Мяты в парке): работа открывается там, где сказано, играется через dev-хук канвы
//   до звёзд, платит зарплату по JOBS; общий предел оплачиваемых смен за день — PAID_DAY.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:17в:"
const lib = require('./lib.js');

module.exports = async function jobs(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    norm,
    expect,
    state,
    mutate,
    fresh: newGame,
    until,
    untilScene,
    untilIdle,
    go,
    teleport,
    frames,
    drain,
    mgStart,
    sel,
  } = lib(ctx);
  const mgText = async () => norm(await ev(() => (document.querySelector('#mg') || { textContent: '' }).textContent));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog') || {}).textContent || ''));
  // июль, полдень, солнце
  const fresh = () => newGame({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true, flags: { hotelHint: 1 } });
  const hook = (name, ...a) =>
    ev(
      ([name, a]) => {
        const c = [...document.querySelectorAll('#mg canvas')].find((q) => q[name]);
        return c ? c[name](...a) : null;
      },
      [name, a],
    );
  /** «Начать!» и дождаться, пока у холста игры появится тестовый крюк hookName. */
  const start = async (hookName) => {
    await mgStart();
    await until((n) => [...document.querySelectorAll('#mg canvas')].some((q) => q[n]), hookName, {
      timeout: 4000,
    }).catch(() => {});
  };
  const ura = async () => {
    await page.waitForSelector(sel('done', '#mg'), { timeout: 30000 });
    const t = await mgText();
    await page.click(sel('done', '#mg'));
    await until(() => !document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
    await drain(3000); // окна зарплаты и наклеек из очереди
    return t;
  };
  /** Подойти к месту города и нажать на него (точка мира в клетках). */
  const tapTown = async (stand, at) => {
    await go('world');
    await teleport(...stand);
    const k = await ev(([x, y]) => window.__dev.World.debugScreen(x * 48, y * 48), at);
    await page.mouse.click(k.x, k.y);
  };
  const played = async () => (await state()).dayFlags.shifts || {};
  /** Что на экране, если ждали окно, а его нет (для сообщения об ошибке). */
  const why = () =>
    ev(() => {
      const d = window.__dev,
        sc = d.locations[d.sceneName];
      return {
        scene: d.sceneName,
        modal: d.G.modal,
        p: sc ? [+(sc.p.x / 48).toFixed(1), +(sc.p.y / 48).toFixed(1), sc.p.path.length, !!sc.p.pending] : null,
        ui: [...document.querySelectorAll('.overlay .panel, .dialog, #mg')].map((e) => e.textContent.slice(0, 80)),
      };
    });
  const waitDialog = async (text) => {
    const ok = await page.waitForSelector(`.dialog >> text=${text}`, { timeout: 8000 }).catch(() => null);
    if (!ok) throw new Error(`нет окна «${text}»: ${JSON.stringify(await why())}`);
  };

  await step(
    '17в: парикмахер — кнопка в окне салона, гости-жители по картинке, добрая подсказка, зарплата',
    async () => {
      await fresh();
      const m0 = (await state()).money;
      await ev(() => window.__dev.enterBuilding('salon'));
      await page.waitForSelector('text=Поработать парикмахером', { timeout: 6000 });
      await page.click('text=Поработать парикмахером');
      await page.waitForSelector('#mg', { timeout: 6000 });
      const intro = await mgText();
      expect(/Парикмахер/.test(intro) && /Зарплата/.test(intro), 'заставка без зарплаты', intro);
      await start('__hair');
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
      expect(s.money > m0 && (s.dayFlags.shifts || {}).hairdresser === 1, 'зарплату не заплатили', {
        m0,
        m: s.money,
        sh: s.dayFlags.shifts,
      });
    },
  );

  await step(
    '17в: спасатель — вышка на пляже, Волна зовёт на смену, круг и «доплыть за мячиком», зарплата',
    async () => {
      await fresh();
      const spot = await ev(async () => (await import('/js/locations/town.js')).JOB_SPOTS.lifeguard);
      await tapTown([spot[0] + 1, spot[1] + 2], [spot[0] + 0.5, spot[1] + 0.2]);
      // нажатием можно попасть в жителя или лежак рядом — тогда просто дойти до вышки
      if (!(await page.waitForSelector('.dialog >> text=На вышку', { timeout: 4000 }).catch(() => null))) {
        await closeAll();
        await ev(() => window.__dev.World.walkToPlace('lifeguard'));
        await waitDialog('На вышку');
      }
      const d = await dialogText();
      expect(/Волна/.test(d) && /Зарплата/.test(d) && !/Купить заведение/.test(d), 'диалог у вышки', d);
      await wait(380); // кнопки диалога принимают нажатия не сразу (TAP_GUARD)
      await page.click('.dialog >> text=На вышку');
      await start('__guard');
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
    },
  );

  await step('17в: садовник — тележка Мяты в парке, полить, подстричь куст по шаблону, клумба по схеме', async () => {
    await fresh();
    const spot = await ev(async () => (await import('/js/locations/town.js')).JOB_SPOTS.garden);
    // дойти до тележки (нажатием можно попасть в Мяту — она гуляет рядом)
    await go('world');
    await teleport(spot[0] - 1, spot[1] + 1);
    await ev(() => window.__dev.World.walkToPlace('gardencart'));
    await waitDialog('Помочь в парке');
    const d = await dialogText();
    expect(/Мята/.test(d) && /Зарплата/.test(d), 'диалог у тележки', d);
    await wait(380); // кнопки диалога оживают не сразу (TAP_GUARD)
    await page.click('.dialog >> text=Помочь в парке');
    await start('__garden');
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
    await mutate(
      `s.dayFlags.shifts = { swim: 2, teacher: 2, doctor: 2, chef: 2, fashion: 2, barista: 2, porter: ${lim - 12} };`,
    );
    const m0 = (await state()).money;
    await ev(() => {
      window.__dev.run('minigame:gardener'); // не ждём: обещание игры исполнится, только когда её закроют
    });
    await page.waitForSelector('#mg', { timeout: 6000 });
    const intro = await mgText();
    expect(new RegExp(`уже отработала ${lim} смен`).test(intro), 'нет слов про общий предел', intro);
    await page.click('#mg .xbtn');
    await until(() => !document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
    await closeAll();
    expect((await state()).money === m0, 'монеты изменились без игры');
  });

  await step(
    '17в: фото-режим — кнопка 📷, интерфейс спрятан, кадр двигается, рамка, наклейки, подпись, снимок в фотоальбом',
    async () => {
      await fresh();
      await go('world');
      await teleport(40, 52);
      await closeAll();
      await page.click('#hud button:has-text("Фото")');
      await page.waitForSelector('#photo', { timeout: 4000 });
      const hidden = await ev(() => getComputedStyle(document.getElementById('hud')).visibility);
      expect(hidden === 'hidden', 'интерфейс не спрятан', hidden);
      // двигать кадр: камера сдвигается, хомячок стоит
      const c0 = await ev(() => ({
        x: window.__dev.World.cam.x,
        y: window.__dev.World.cam.y,
        px: window.__dev.World.p.x,
      }));
      const vw = await ev(() => [innerWidth, innerHeight]);
      await page.mouse.move(vw[0] / 2, vw[1] / 3);
      await page.mouse.down();
      await page.mouse.move(vw[0] / 2 - 120, vw[1] / 3 - 40, { steps: 4 });
      await page.mouse.up();
      const c1 = await ev(() => ({
        x: window.__dev.World.cam.x,
        y: window.__dev.World.cam.y,
        px: window.__dev.World.p.x,
      }));
      expect(c1.x > c0.x + 20 && c1.px === c0.px, 'кадр не сдвинулся', { c0, c1 });
      await ev(() => {
        const m = window.__dev.F.photoMode();
        m.setFrame('polaroid');
        m.addDecor('🌈', 0.3, 0.3);
        m.setCaption('Мой день у моря');
      });
      await page.click('#photo >> text=Снять');
      await page.waitForSelector('.overlay >> text=В фотоальбом', { timeout: 4000 });
      await page.click('.overlay >> text=В фотоальбом');
      await until(async () => (await (await import('/js/core/photos.js')).loadPhotos()).length > 0, undefined, {
        timeout: 3000,
      }).catch(() => {});
      const info = await ev(async () => {
        const m = await import('/js/core/photos.js');
        const list = await m.loadPhotos();
        return {
          n: list.length,
          size: await m.photosSize(),
          cap: list[0] && list[0].caption,
          save: localStorage.getItem('rhr-save-v1').length,
        };
      });
      expect(info.n === 1 && info.cap === 'Мой день у моря', 'снимок не в альбоме', info);
      expect(info.size < 60000, 'снимок слишком большой', info);
      expect(!/data:image/.test(await ev(() => localStorage.getItem('rhr-save-v1'))), 'снимок попал в сохранение');
      expect((await state()).stickers.includes('x_photo'), 'нет наклейки «Первый снимок»');
      await page.click('#photo .ph-x >> nth=-1');
      await until(() => !document.getElementById('photo'), undefined, { timeout: 3000 }).catch(() => {});
      expect(
        await ev(
          () =>
            !document.getElementById('photo') &&
            getComputedStyle(document.getElementById('hud')).visibility !== 'hidden',
        ),
        'фото-режим не закрылся',
      );
      // фотоальбом: вкладка альбома, удалить снимок
      await ev(() => window.__dev.F.openAlbum('ph'));
      await page.waitForSelector('.ph-card', { timeout: 4000 });
      await page.click('.ph-card');
      await page.click('.overlay button:has-text("🗑️ Удалить")');
      await wait(300);
      await page.click('.overlay button:text-is("Удалить")');
      await wait(500);
      expect(
        (await ev(async () => (await (await import('/js/core/photos.js')).loadPhotos()).length)) === 0,
        'снимок не удалился',
      );
      await closeAll();
    },
  );

  await step(
    '17в: нижний ярус пещер — люк закрыт до «Счастливой кирки», лестница вниз, лодочка по реке, находки, наклейка, наверх',
    async () => {
      await fresh();
      await ev(() => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain', 'caves']) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.flags.cavesHint = 1;
          s.finds.flashlight = 1;
        });
        d.go('caves');
      });
      await untilScene('caves');
      // старое сохранение: «Счастливая кирка» сдана раньше — нижний ярус открывается сам (repair)
      const mig = await ev(async () => {
        const st = await import('/js/core/state.js');
        const s = JSON.parse(JSON.stringify(window.__dev.G.state));
        s.quests.lucky_pick = { day: 3, done: 5, n: {}, got: {} };
        delete s.lands.deep;
        st.repair(s);
        return s.lands.deep;
      });
      expect(mig === 5, 'сданная «Счастливая кирка» не открыла нижний ярус', mig);
      const hole = await ev(async () => (await import('/js/locations/caves.js')).AT.hole);
      await ev(([x, y]) => window.__dev.locations.caves.debugTeleport(x - 2, y), hole);
      await frames(3);
      let k;
      await ev(() => window.__dev.locations.caves.walkToPlace('ladder'));
      await page.waitForSelector('.overlay >> text=Подземная река', { timeout: 6000 });
      expect(await ev(() => window.__dev.sceneName === 'caves'), 'закрытый люк пустил вниз');
      await closeAll();
      await ev(() => window.__dev.actions.openLand('deep'));
      await ev(([x, y]) => window.__dev.locations.caves.debugTeleport(x - 3, y), hole);
      await frames(3);
      await ev(() => window.__dev.locations.caves.walkToPlace('ladder'));
      await page.waitForFunction(() => window.__dev.sceneName === 'deep', null, { timeout: 8000 });
      await wait(800);
      // карта мира: из подземной реки в город — через пещеры
      const r = await ev(() => window.__dev.locations.deep.wayTo('world'));
      expect(r && r.next === 'caves', 'звёздочка из подземной реки не ведёт к лестнице', r);
      // лодочка
      await ev(() => window.__dev.locations.deep.debugTeleport(6, 10));
      await frames(3);
      k = await ev(() => window.__dev.locations.deep.debugScreen(5.2 * 48, 13 * 48));
      await page.mouse.click(k.x, k.y);
      const deepMod = () => ev(async () => (await import('/js/locations/deep.js')).boatWhere());
      for (let i = 0; i < 20 && (await deepMod()) !== 'ride'; i++) await wait(400); // дошла до мостков и села
      for (let i = 0; i < 60 && (await deepMod()) === 'ride'; i++) await wait(500);
      const dbg = () =>
        ev(() => ({
          scene: window.__dev.sceneName,
          modal: window.__dev.G.modal,
          x: window.__dev.locations.deep.p.x / 48,
          y: window.__dev.locations.deep.p.y / 48,
        }));
      expect((await deepMod()) === 'east', 'лодочка не доплыла', [await deepMod(), await dbg()]);
      expect((await state()).stickers.includes('x_river'), 'нет наклейки «Подземная река»');
      for (const [x, y] of [
        [27.5, 21.5],
        [33.5, 22.5],
      ]) {
        await ev(([x, y]) => window.__dev.locations.deep.walkTo(x * 48, y * 48, true), [x, y]);
        await untilIdle();
        await wait(300);
      }
      const f = (await state()).finds;
      expect(f.cave_pearl === 1 && f.glow_pebble === 1, 'находки грота', f);
      expect(!(await ev(() => window.__dev.locations.deep.debugSprites().clipped.length)), 'спрайты не помещаются');
      // обратно на лодочке и наверх по лестнице
      await ev(() => window.__dev.locations.deep.debugTeleport(32, 15));
      await frames(3);
      k = await ev(() => window.__dev.locations.deep.debugScreen(33 * 48, 13 * 48));
      await page.mouse.click(k.x, k.y);
      for (let i = 0; i < 20 && (await deepMod()) !== 'ride'; i++) await wait(400); // дошла до мостков и села
      for (let i = 0; i < 60 && (await deepMod()) === 'ride'; i++) await wait(500);
      expect((await deepMod()) === 'west', 'лодочка не вернулась', await deepMod());
      await ev(() => window.__dev.locations.deep.walkToPlace('ladder'));
      await page.waitForFunction(() => window.__dev.sceneName === 'caves', null, { timeout: 12000 });
    },
  );
};

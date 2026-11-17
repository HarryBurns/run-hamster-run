// Шаги автотеста этапа 17б «Питомец, транспорт, двор»: самокат, велосипед и кабриолет (покупка, быстрее по дороге,
// сам слезает у двери и у воды, быстрый переход по карте), питомец из приюта (взять, имя, погладить, покормить,
// поиграть, идёт следом, живёт дома, «Лучший друг»), двор (купить, поставить, переставить, убрать, сохранение).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:17б
module.exports = async function buddy({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchBuddy = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchBuddy());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  /** Встать в городе на клетку (полдень, лето, солнце). */
  const toTown = async (tx, ty) => {
    await closeAll();
    await ev(
      ([tx, ty]) => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.minutes = 12 * 60;
          s.weather = 'sun';
        });
        if (d.sceneName !== 'world') d.go('world');
        d.World.debugTeleport(tx, ty);
      },
      [tx, ty],
    );
    await wait(300);
  };
  /** Подождать, пока условие в игре не станет правдой. */
  const until = async (fn, arg, ms = 12000, what = 'условие') => {
    const t0 = Date.now();
    for (;;) {
      if (await ev(fn, arg)) return;
      if (Date.now() - t0 > ms) throw new Error('не дождались: ' + what);
      await wait(100);
    }
  };
  const hudBtn = (label) =>
    ev((label) => {
      const b = [...document.querySelectorAll('.hud-btns.left .rbtn, .hud-btns.left button')].find((x) => x.textContent.includes(label));
      if (!b) return false;
      b.click();
      return true;
    }, label);

  await step('17б транспорт: купить в ТЦ «Колёса», кнопка «Поехали!» — по дороге быстрее, по траве как пешком; у воды и у двери слезает сама, из дома — снова едет; быстрый переход по карте работает', async () => {
    await fresh();
    await toTown(40, 14);
    expect(!(await hudBtn('Поехали!')), 'кнопка «Поехали!» есть без транспорта');
    await ev(() => window.__dev.actions.earn(30000));
    await watch();
    await ev(() => window.__dev.run('home-mall'));
    await wait(300);
    await page.click('.tabs >> text=Колёса');
    await wait(200);
    const money0 = await ev(() => window.__dev.state.money);
    await page.click('.ride-scooter .btn');
    await wait(200);
    await page.click('.ride-bike .btn');
    await wait(200);
    const st = await ev(() => ({ w: window.__dev.state.wheels, money: window.__dev.state.money }));
    expect(st.w.own.join() === 'scooter,bike' && st.w.use === 'bike', 'покупка: что куплено и на чём ездит', st.w);
    expect(money0 - st.money === 1200 + 3500, 'покупка: списано не то', money0 - st.money);
    // «Ездить на этом» — выбрать самокат
    await page.click('.ride-scooter .btn');
    await wait(200);
    expect((await ev(() => window.__dev.state.wheels.use)) === 'scooter', '«Ездить на этом» не выбрало самокат');
    await closeAll();
    // пешком: сколько пройдём за 1,5 с по Северной улице
    const run = async () => {
      const x0 = await ev(() => {
        const W = window.__dev.World;
        W.debugTeleport(36, 14);
        W.walkTo(60 * 48, 14.5 * 48, true);
        return W.p.x;
      });
      await wait(1500);
      return (await ev(() => window.__dev.World.p.x)) - x0;
    };
    const foot = await run();
    await toTown(36, 14);
    expect(await hudBtn('Поехали!'), 'нет кнопки «Поехали!»');
    await wait(100);
    expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'не села на самокат');
    expect(await ev(() => window.__dev.state.stickers.includes('x_wheels')), 'нет наклейки «С ветерком»');
    const ride = await run();
    expect(ride > foot * 1.25, 'на самокате по дороге не быстрее', { foot, ride });
    // по траве — как пешком
    const sp = await ev(() => {
      const d = window.__dev;
      d.World.debugTeleport(36, 16);
      return d.World.map.at(36, 16);
    });
    await wait(200);
    const dbg = await ev(() => window.__dev.F.wheelsDebug());
    expect(sp === 'g' && dbg.speed <= 226, 'по траве транспорт едет быстро', { sp, dbg });
    // в воду — слезает сама
    await toTown(40, 56);
    expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'после переноса слезла');
    const pt = await ev(() => window.__dev.World.debugScreen(40.5 * 48, 60.5 * 48));
    await page.mouse.click(pt.x, pt.y);
    await wait(300);
    expect(!(await ev(() => window.__dev.F.ridingWheels())), 'нажали на воду — не слезла');
    await until(() => window.__dev.World.map.kindAt(Math.floor(window.__dev.World.p.x / 48), Math.floor(window.__dev.World.p.y / 48)).swim, null, 9000, 'хомячок вошла в воду пешком');
    // у двери — слезает, из магазина — снова едет
    await toTown(55, 14);
    await hudBtn('Поехали!');
    await ev(() => window.__dev.World.walkToPlace('salon'));
    await until(() => document.querySelector('.overlay, .dialog'), null, 15000, 'вошли в салон');
    await closeAll();
    await wait(300);
    expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'после окна салона (сцена не менялась) слезла');
    await ev(() => window.__dev.World.walkToPlace('villa'));
    await ev(() => window.__dev.World.skipAlong()); // быстрый переход по карте (Ф4) — последние шаги сама
    await until(() => window.__dev.sceneName === 'villa', null, 15000, 'вошла на виллу');
    expect(!(await ev(() => window.__dev.World.p.ride)), 'в доме: транспорт остался у героя города');
    await ev(() => window.__dev.go('world'));
    await wait(400);
    expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'вышла из дома — не поехала дальше');
    expect(await hudBtn('Слезть'), 'нет кнопки «Слезть»');
    await wait(100);
    expect(!(await ev(() => window.__dev.F.ridingWheels())), '«Слезть» не сработало');
    await ev(() => window.__dev.go('villa'));
    await wait(300);
    await ev(() => window.__dev.go('world'));
    await wait(300);
    expect(!(await ev(() => window.__dev.F.ridingWheels())), 'слезла сама — а после дома снова едет');
    // в лесу дорог нет — кнопки нет
    await ev(() => {
      window.__dev.actions.openLand('forest');
      window.__dev.go('forest');
    });
    await wait(400);
    expect(!(await hudBtn('Поехали!')), 'в лесу есть кнопка «Поехали!»');
    await unwatch();
  });

  await step('17б двор: «Для двора» в ТЦ, кнопка «Мой двор» во дворе виллы, поставить из сарайчика, перетащить по клеткам, убрать; не на дорожку; скамейка двора — сесть; сохраняется; дворик бунгало — после покупки', async () => {
    await fresh();
    await toTown(40, 14);
    expect(!(await hudBtn('Мой двор')), 'кнопка «Мой двор» есть на улице');
    await ev(() => window.__dev.actions.earn(20000));
    await watch();
    await ev(() => window.__dev.run('home-mall'));
    await wait(300);
    await page.click('.tabs >> text=Для двора');
    await wait(200);
    const money0 = await ev(() => window.__dev.state.money);
    for (const id of ['y_bench', 'y_lantern', 'y_bed_pink', 'y_bed_pink']) {
      await page.click(`.card.yard-${id} .btn`);
      await wait(120);
    }
    const st0 = await ev(() => ({ y: window.__dev.state.yard, money: window.__dev.state.money }));
    expect(st0.y.store.y_bench === 1 && st0.y.store.y_bed_pink === 2 && st0.y.store.y_lantern === 1, 'покупка: сарайчик', st0.y);
    expect(money0 - st0.money === 600 + 400 + 250 + 250, 'покупка: списано не то', money0 - st0.money);
    await closeAll();
    // во двор виллы: кнопка, режим, панель
    await toTown(18, 12);
    await wait(200);
    expect(await hudBtn('Мой двор'), 'во дворе виллы нет кнопки «Мой двор»');
    await wait(300);
    expect((await ev(() => window.__dev.F.yardDebug().mode)) === 'villa', 'режим двора не включился');
    expect(await ev(() => !!document.querySelector('.yard-tray') && document.querySelectorAll('.yard-tray .tray-item').length === 3), 'панель: три вида в сарайчике');
    // в режиме хомячок стоит: нажатие по земле её не ведёт
    const p0 = await ev(() => ({ ...window.__dev.World.playerPos() }));
    await page.click('.yard-tray .tray-item.yard-y_bench');
    await wait(200);
    const b1 = await ev(() => {
      const d = window.__dev,
        it = d.state.yard.at.villa[0],
        o = d.World.map.objs.find((q) => q.yard === 'villa');
      return { it, type: o && o.type, solid: d.World.map.solid[it.y][it.x], sel: d.F.yardDebug().sel, sticker: d.state.stickers.includes('x_yard') };
    });
    expect(b1.it.id === 'y_bench' && b1.type === 'bench' && b1.solid && b1.sel && b1.sticker, 'скамейка не встала во двор', b1);
    // перетащить на свободную клетку подальше
    const free = await ev(([x, y]) => {
      const d = window.__dev;
      for (let r = 2; r < 6; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [r, r], [-r, r]]) if (d.F.yardCanPlace('villa', x + dx, y + dy)) return [x + dx, y + dy];
      return null;
    }, [b1.it.x, b1.it.y]);
    expect(free, 'рядом нет свободной клетки');
    const a = await ev(([x, y]) => window.__dev.World.debugScreen((x + 0.5) * 48, (y + 0.5) * 48 - 6), [b1.it.x, b1.it.y]);
    const z = await ev(([x, y]) => window.__dev.World.debugScreen((x + 0.5) * 48, (y + 0.5) * 48 - 6), free);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 4 });
    await page.mouse.move(z.x, z.y, { steps: 4 });
    await page.mouse.up();
    await wait(200);
    const b2 = await ev(() => {
      const d = window.__dev,
        it = d.state.yard.at.villa[0];
      return { it, objs: d.World.map.objs.filter((q) => q.yard).map((q) => [q.tx, q.ty]), p: d.World.playerPos() };
    });
    expect(b2.it.x === free[0] && b2.it.y === free[1], 'перетаскивание: скамейка не на новой клетке', { b2, free });
    expect(b2.objs.length === 1 && b2.objs[0][0] === free[0] && b2.objs[0][1] === free[1], 'перетаскивание: предмет карты не там', b2.objs);
    expect(!(await ev(([x, y]) => window.__dev.World.map.solid[y][x], [b1.it.x, b1.it.y])), 'старая клетка осталась занятой');
    expect(Math.hypot(b2.p.x - p0.x, b2.p.y - p0.y) < 2, 'в режиме двора хомячок пошла', { p0, p: b2.p });
    // на дорожку и на грядку нельзя
    const no = await ev(() => [window.__dev.F.yardCanPlace('villa', 15, 12), window.__dev.F.yardCanPlace('villa', 20, 10), window.__dev.F.yardCanPlace('villa', 40, 14)]);
    expect(!no[0] && !no[1] && !no[2], 'можно поставить на дорожку, грядку или на улицу', no);
    // фонарик и клумба; одну клумбу убрать обратно
    await page.click('.yard-tray .tray-item.yard-y_lantern');
    await wait(150);
    await page.click('.yard-tray .tray-item.yard-y_bed_pink');
    await wait(150);
    await page.click('.yard-tray >> text=Убрать');
    await wait(150);
    const b3 = await ev(() => window.__dev.state.yard);
    expect(b3.at.villa.length === 2 && b3.store.y_bed_pink === 2 && !b3.store.y_lantern, 'убрать в сарайчик', b3);
    await page.click('.yard-tray >> text=Готово');
    await wait(300);
    expect(!(await ev(() => window.__dev.F.yardDebug().mode)) && !(await ev(() => document.querySelector('.yard-tray'))), 'режим не выключился');
    // на скамейку двора можно сесть (этап 17а)
    const bench = await ev(() => {
      const o = window.__dev.World.map.objs.find((q) => q.yard && q.type === 'bench');
      return window.__dev.World.debugScreen(o.x, o.y - 10);
    });
    await page.mouse.click(bench.x, bench.y);
    await until(() => window.__dev.World.p.ride && window.__dev.World.p.ride.relax, null, 10000, 'села на скамейку во дворе');
    await unwatch();
    // сохранение: после перезагрузки двор на месте
    await ev(() => window.__dev.go('villa'));
    await wait(300);
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(600);
    await closeAll();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    const b4 = await ev(() => ({ y: window.__dev.state.yard, objs: window.__dev.World.map.objs.filter((q) => q.yard).map((q) => q.type).sort() }));
    expect(b4.y.at.villa.length === 2 && b4.objs.join() === 'bench,yardLantern', 'после перезагрузки двор не тот', b4);
    // дворик бунгало: пока не куплено — кнопки нет; купили — есть, ставится на песок
    await toTown(8, 54);
    await wait(200);
    expect(!(await hudBtn('Мой двор')), 'у чужого бунгало есть кнопка «Мой двор»');
    await ev(() => window.__dev.actions.addHome('bungalow'));
    await toTown(9, 55);
    await wait(300);
    expect(await hudBtn('Мой двор'), 'у своего бунгало нет кнопки «Мой двор»');
    await wait(200);
    await page.click('.yard-tray .tray-item.yard-y_bed_pink');
    await wait(200);
    const b5 = await ev(() => {
      const d = window.__dev,
        it = (d.state.yard.at.bungalow || [])[0];
      return it ? { it, tile: d.World.map.at(it.x, it.y) } : null;
    });
    expect(b5 && b5.tile === 's', 'клумба у бунгало не встала на песок', b5);
    await page.click('.yard-tray >> text=Готово');
    await wait(200);
    // старое сохранение без поля yard открывается: двор пуст
    const old = await ev(() => {
      const d = window.__dev,
        s = JSON.parse(JSON.stringify(d.state));
      delete s.yard;
      delete s.pet;
      delete s.wheels;
      d.G.state = null;
      localStorage.clear();
      localStorage.setItem('rhr-save-v1', JSON.stringify(s));
      return true;
    });
    expect(old, 'не подложили сохранение');
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(600);
    await closeAll();
    const b6 = await ev(() => ({ y: window.__dev.state.yard, pet: window.__dev.state.pet, w: window.__dev.state.wheels }));
    expect(b6.y && !Object.keys(b6.y.store).length && b6.pet === null && b6.w.own.length === 0 && b6.w.use === '', 'старое сохранение: поля по умолчанию', b6);
  });
};

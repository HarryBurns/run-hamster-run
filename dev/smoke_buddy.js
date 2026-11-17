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
};

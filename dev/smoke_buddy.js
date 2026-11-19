// Шаги автотеста этапа 17б «Питомец, транспорт, двор»: самокат, велосипед и кабриолет (покупка, быстрее по дороге,
// сам слезает у двери и у воды, быстрый переход по карте), питомец из приюта (взять, имя, погладить, покормить,
// поиграть, идёт следом, живёт дома, «Лучший друг»), двор (купить, поставить, переставить, убрать, сохранение).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:17б
const lib = require('./lib.js');

module.exports = async function buddy(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, closeAll, untilScene, untilPanel, untilDialog, frames, go, watch, unwatch } = L;
  const expect = (ok, msg, data) => {
    if (process.env.SMOKE_TRACE) console.log('   · ' + msg);
    L.expect(ok, msg, data);
  };
  const fresh = () => L.fresh(); // 1 июня, без вводной цепочки
  /** Окно (оверлей) открыто — подождать его и кадр. */
  const untilWin = async (s = '.overlay') => {
    await page.waitForSelector(s);
    await frames(2);
  };
  /** Питомец в городе закончил заботу (погладить, покормить, поиграть). */
  const untilFxDone = () =>
    L.until(
      () => {
        const p = window.__dev.F.petDebug();
        return !(p.world && p.world.fx) && !(p.home && p.home.fx);
      },
      undefined,
      { timeout: 5000, msg: 'питомец доиграл' },
    );
  /** «Продолжить» после перезагрузки страницы. */
  const reopen = async () => {
    await page.reload();
    await page.waitForSelector(L.sel('continue'));
    await L.cont();
    await L.drain();
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
    await untilScene('world');
    await frames(2);
  };
  /** Подождать, пока условие в игре не станет правдой. */
  const until = (fn, arg, ms = 12000, what = 'условие') => L.until(fn, arg, { timeout: ms, msg: what, poll: 60 });
  const hudBtn = (label) =>
    ev((label) => {
      const b = [...document.querySelectorAll('.hud-btns.left .rbtn, .hud-btns.left button')].find((x) =>
        x.textContent.includes(label),
      );
      if (!b) return false;
      b.click();
      return true;
    }, label);

  await step(
    '17б транспорт: купить в ТЦ «Колёса», кнопка «Поехали!» — по дороге быстрее, по траве как пешком; у воды и у двери слезает сама, из дома — снова едет; быстрый переход по карте работает',
    async () => {
      await fresh();
      await toTown(40, 14);
      expect(!(await hudBtn('Поехали!')), 'кнопка «Поехали!» есть без транспорта');
      await ev(() => window.__dev.actions.earn(30000));
      await watch();
      await ev(() => window.__dev.run('home-mall'));
      await untilWin();
      await page.click('.tabs >> text=Колёса');
      await untilWin('.ride-scooter .btn');
      const money0 = await ev(() => window.__dev.state.money);
      await page.click('.ride-scooter .btn');
      await until(() => window.__dev.state.wheels.own.includes('scooter'), null, 3000, 'куплен самокат');
      await page.click('.ride-bike .btn');
      await until(() => window.__dev.state.wheels.own.includes('bike'), null, 3000, 'куплен велосипед');
      const st = await ev(() => ({ w: window.__dev.state.wheels, money: window.__dev.state.money }));
      expect(st.w.own.join() === 'scooter,bike' && st.w.use === 'bike', 'покупка: что куплено и на чём ездит', st.w);
      expect(money0 - st.money === 1200 + 3500, 'покупка: списано не то', money0 - st.money);
      // «Ездить на этом» — выбрать самокат
      await page.click('.ride-scooter .btn');
      await until(() => window.__dev.state.wheels.use === 'scooter', null, 3000).catch(() => {});
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
      await frames(2);
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
      await frames(4);
      const dbg = await ev(() => window.__dev.F.wheelsDebug());
      expect(sp === 'g' && dbg.speed <= 226, 'по траве транспорт едет быстро', { sp, dbg });
      // в воду — слезает сама
      await toTown(40, 56);
      expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'после переноса слезла');
      const pt = await ev(() => window.__dev.World.debugScreen(40.5 * 48, 60.5 * 48));
      await page.mouse.click(pt.x, pt.y);
      await until(() => !window.__dev.F.ridingWheels(), null, 3000).catch(() => {});
      expect(!(await ev(() => window.__dev.F.ridingWheels())), 'нажали на воду — не слезла');
      await until(
        () =>
          window.__dev.World.map.kindAt(
            Math.floor(window.__dev.World.p.x / 48),
            Math.floor(window.__dev.World.p.y / 48),
          ).swim,
        null,
        9000,
        'хомячок вошла в воду пешком',
      );
      // у двери — слезает, из магазина — снова едет
      await toTown(55, 14);
      await hudBtn('Поехали!');
      await ev(() => window.__dev.World.walkToPlace('salon'));
      await until(() => document.querySelector('.overlay, .dialog'), null, 15000, 'вошли в салон');
      await closeAll();
      await L.untilNoWindows().catch(() => {});
      await frames(2);
      expect(
        (await ev(() => window.__dev.F.ridingWheels())) === 'scooter',
        'после окна салона (сцена не менялась) слезла',
      );
      await ev(() => window.__dev.World.walkToPlace('villa'));
      await ev(() => window.__dev.World.skipAlong()); // быстрый переход по карте (Ф4) — последние шаги сама
      await until(() => window.__dev.sceneName === 'villa', null, 15000, 'вошла на виллу');
      expect(!(await ev(() => window.__dev.World.p.ride)), 'в доме: транспорт остался у героя города');
      await go('world');
      expect((await ev(() => window.__dev.F.ridingWheels())) === 'scooter', 'вышла из дома — не поехала дальше');
      expect(await hudBtn('Слезть'), 'нет кнопки «Слезть»');
      await frames(2);
      expect(!(await ev(() => window.__dev.F.ridingWheels())), '«Слезть» не сработало');
      await go('villa');
      await go('world');
      expect(!(await ev(() => window.__dev.F.ridingWheels())), 'слезла сама — а после дома снова едет');
      // в лесу дорог нет — кнопки нет
      await L.toPlace('forest');
      expect(!(await hudBtn('Поехали!')), 'в лесу есть кнопка «Поехали!»');
      await unwatch();
    },
  );

  await step(
    '17б двор: «Для двора» в ТЦ, кнопка «Мой двор» во дворе виллы, поставить из сарайчика, перетащить по клеткам, убрать; не на дорожку; скамейка двора — сесть; сохраняется; дворик бунгало — после покупки',
    async () => {
      await fresh();
      await toTown(40, 14);
      expect(!(await hudBtn('Мой двор')), 'кнопка «Мой двор» есть на улице');
      await ev(() => window.__dev.actions.earn(20000));
      await watch();
      await ev(() => window.__dev.run('home-mall'));
      await untilWin();
      await page.click('.tabs >> text=Для двора');
      await untilWin('.card.yard-y_bench .btn');
      const money0 = await ev(() => window.__dev.state.money);
      for (const id of ['y_bench', 'y_lantern', 'y_bed_pink', 'y_bed_pink']) {
        await page.click(`.card.yard-${id} .btn`);
        await frames(1);
      }
      const st0 = await ev(() => ({ y: window.__dev.state.yard, money: window.__dev.state.money }));
      expect(
        st0.y.store.y_bench === 1 && st0.y.store.y_bed_pink === 2 && st0.y.store.y_lantern === 1,
        'покупка: сарайчик',
        st0.y,
      );
      expect(money0 - st0.money === 600 + 400 + 250 + 250, 'покупка: списано не то', money0 - st0.money);
      await closeAll();
      // во двор виллы: кнопка, режим, панель
      await toTown(18, 12);
      await until(
        () =>
          [...document.querySelectorAll('.hud-btns.left .rbtn, .hud-btns.left button')].some((x) =>
            x.textContent.includes('Мой двор'),
          ),
        null,
        3000,
      ).catch(() => {});
      expect(await hudBtn('Мой двор'), 'во дворе виллы нет кнопки «Мой двор»');
      await until(
        () => window.__dev.F.yardDebug().mode && document.querySelectorAll('.yard-tray .tray-item').length,
        null,
        3000,
      ).catch(() => {});
      expect((await ev(() => window.__dev.F.yardDebug().mode)) === 'villa', 'режим двора не включился');
      expect(
        await ev(
          () =>
            !!document.querySelector('.yard-tray') && document.querySelectorAll('.yard-tray .tray-item').length === 3,
        ),
        'панель: три вида в сарайчике',
      );
      // в режиме хомячок стоит: нажатие по земле её не ведёт
      const p0 = await ev(() => ({ ...window.__dev.World.playerPos() }));
      await page.click('.yard-tray .tray-item.yard-y_bench');
      await until(() => (window.__dev.state.yard.at.villa || []).length === 1, null, 3000).catch(() => {});
      const b1 = await ev(() => {
        const d = window.__dev,
          it = d.state.yard.at.villa[0],
          o = d.World.map.objs.find((q) => q.yard === 'villa');
        return {
          it,
          type: o && o.type,
          solid: d.World.map.solid[it.y][it.x],
          sel: d.F.yardDebug().sel,
          sticker: d.state.stickers.includes('x_yard'),
        };
      });
      expect(
        b1.it.id === 'y_bench' && b1.type === 'bench' && b1.solid && b1.sel && b1.sticker,
        'скамейка не встала во двор',
        b1,
      );
      // перетащить на свободную клетку подальше
      const free = await ev(
        ([x, y]) => {
          const d = window.__dev;
          for (let r = 2; r < 6; r++)
            for (const [dx, dy] of [
              [r, 0],
              [-r, 0],
              [0, r],
              [r, r],
              [-r, r],
            ])
              if (d.F.yardCanPlace('villa', x + dx, y + dy)) return [x + dx, y + dy];
          return null;
        },
        [b1.it.x, b1.it.y],
      );
      expect(free, 'рядом нет свободной клетки');
      const a = await ev(
        ([x, y]) => window.__dev.World.debugScreen((x + 0.5) * 48, (y + 0.5) * 48 - 6),
        [b1.it.x, b1.it.y],
      );
      const z = await ev(([x, y]) => window.__dev.World.debugScreen((x + 0.5) * 48, (y + 0.5) * 48 - 6), free);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 4 });
      await page.mouse.move(z.x, z.y, { steps: 4 });
      await page.mouse.up();
      await frames(2);
      const b2 = await ev(() => {
        const d = window.__dev,
          it = d.state.yard.at.villa[0];
        return { it, objs: d.World.map.objs.filter((q) => q.yard).map((q) => [q.tx, q.ty]), p: d.World.playerPos() };
      });
      expect(b2.it.x === free[0] && b2.it.y === free[1], 'перетаскивание: скамейка не на новой клетке', { b2, free });
      expect(
        b2.objs.length === 1 && b2.objs[0][0] === free[0] && b2.objs[0][1] === free[1],
        'перетаскивание: предмет карты не там',
        b2.objs,
      );
      expect(
        !(await ev(([x, y]) => window.__dev.World.map.solid[y][x], [b1.it.x, b1.it.y])),
        'старая клетка осталась занятой',
      );
      expect(Math.hypot(b2.p.x - p0.x, b2.p.y - p0.y) < 2, 'в режиме двора хомячок пошла', { p0, p: b2.p });
      // на дорожку и на грядку нельзя
      const no = await ev(() => [
        window.__dev.F.yardCanPlace('villa', 15, 12),
        window.__dev.F.yardCanPlace('villa', 20, 10),
        window.__dev.F.yardCanPlace('villa', 40, 14),
      ]);
      expect(!no[0] && !no[1] && !no[2], 'можно поставить на дорожку, грядку или на улицу', no);
      // фонарик и клумба; одну клумбу убрать обратно
      await page.click('.yard-tray .tray-item.yard-y_lantern');
      await until(() => window.__dev.state.yard.at.villa.length === 2, null, 3000).catch(() => {});
      await page.click('.yard-tray .tray-item.yard-y_bed_pink');
      await until(() => window.__dev.state.yard.at.villa.length === 3, null, 3000).catch(() => {});
      await page.click('.yard-tray >> text=Убрать');
      await until(() => window.__dev.state.yard.at.villa.length === 2, null, 3000).catch(() => {});
      const b3 = await ev(() => window.__dev.state.yard);
      expect(b3.at.villa.length === 2 && b3.store.y_bed_pink === 2 && !b3.store.y_lantern, 'убрать в сарайчик', b3);
      await page.click('.yard-tray >> text=Готово');
      await until(() => !window.__dev.F.yardDebug().mode && !document.querySelector('.yard-tray'), null, 3000).catch(
        () => {},
      );
      expect(
        !(await ev(() => window.__dev.F.yardDebug().mode)) && !(await ev(() => document.querySelector('.yard-tray'))),
        'режим не выключился',
      );
      // на скамейку двора можно сесть (этап 17а)
      const bench = await ev(() => {
        const o = window.__dev.World.map.objs.find((q) => q.yard && q.type === 'bench');
        return window.__dev.World.debugScreen(o.x, o.y - 10);
      });
      await page.mouse.click(bench.x, bench.y);
      await until(
        () => window.__dev.World.p.ride && window.__dev.World.p.ride.relax,
        null,
        10000,
        'села на скамейку во дворе',
      );
      await unwatch();
      // сохранение: после перезагрузки двор на месте
      await go('villa');
      await reopen();
      await go('world');
      const b4 = await ev(() => ({
        y: window.__dev.state.yard,
        objs: window.__dev.World.map.objs
          .filter((q) => q.yard)
          .map((q) => q.type)
          .sort(),
      }));
      expect(
        b4.y.at.villa.length === 2 && b4.objs.join() === 'bench,yardLantern',
        'после перезагрузки двор не тот',
        b4,
      );
      // дворик бунгало: пока не куплено — кнопки нет; купили — есть, ставится на песок
      await toTown(8, 54);
      expect(!(await hudBtn('Мой двор')), 'у чужого бунгало есть кнопка «Мой двор»');
      await ev(() => window.__dev.actions.addHome('bungalow'));
      await toTown(9, 55);
      await until(
        () =>
          [...document.querySelectorAll('.hud-btns.left .rbtn, .hud-btns.left button')].some((x) =>
            x.textContent.includes('Мой двор'),
          ),
        null,
        3000,
      ).catch(() => {});
      expect(await hudBtn('Мой двор'), 'у своего бунгало нет кнопки «Мой двор»');
      await page.waitForSelector('.yard-tray .tray-item.yard-y_bed_pink');
      await page.click('.yard-tray .tray-item.yard-y_bed_pink');
      await until(() => (window.__dev.state.yard.at.bungalow || []).length > 0, null, 3000).catch(() => {});
      const b5 = await ev(() => {
        const d = window.__dev,
          it = (d.state.yard.at.bungalow || [])[0];
        return it ? { it, tile: d.World.map.at(it.x, it.y) } : null;
      });
      expect(b5 && b5.tile === 's', 'клумба у бунгало не встала на песок', b5);
      await page.click('.yard-tray >> text=Готово');
      await until(() => !document.querySelector('.yard-tray'), null, 3000).catch(() => {});
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
      await reopen();
      const b6 = await ev(() => ({
        y: window.__dev.state.yard,
        pet: window.__dev.state.pet,
        w: window.__dev.state.wheels,
      }));
      expect(
        b6.y && !Object.keys(b6.y.store).length && b6.pet === null && b6.w.own.length === 0 && b6.w.use === '',
        'старое сохранение: поля по умолчанию',
        b6,
      );
    },
  );

  await step(
    '17б питомец: приют «Тёплые лапки» — выбрать друга, имя, взнос; идёт следом по городу и не застревает, ждёт у воды, прибегает после переноса; окно: погладить, покормить, поиграть (мячик из приюта), имя; сердечки растут раз в день и не убывают, «Лучший друг»; голодный просит; живёт дома, «Подожди дома»; сохраняется',
    async () => {
      await fresh();
      await toTown(90, 23);
      expect(
        (await ev(() => window.__dev.state.pet)) === null && !(await ev(() => window.__dev.F.petDebug().world)),
        'питомец есть в новой игре',
      );
      await ev(() => window.__dev.actions.earn(3000));
      await watch();
      const money0 = await ev(() => window.__dev.state.money);
      // к двери приюта — пешком
      await ev(() => window.__dev.World.walkToPlace('shelter'));
      await untilDialog(9000);
      await page.click('.dialog >> text=Посмотреть зверят');
      await untilWin('.pet-shop .card');
      expect((await ev(() => document.querySelectorAll('.pet-shop .card').length)) === 4, 'в приюте не четыре зверька');
      await page.click('.card.pet-bunny');
      await until(() => document.querySelector('.pet-name input').value === 'Снежок', null, 3000).catch(() => {});
      expect(
        (await ev(() => document.querySelector('.pet-name input').value)) === 'Снежок',
        'имя по умолчанию для крольчонка',
      );
      await page.fill('.pet-name input', 'Пушок');
      await page.click('.pet-take');
      await until(() => !!window.__dev.state.pet, null, 3000).catch(() => {});
      const a1 = await ev(() => ({
        pet: window.__dev.state.pet,
        money: window.__dev.state.money,
        st: window.__dev.state.stickers.includes('x_pet'),
      }));
      expect(
        a1.pet && a1.pet.kind === 'bunny' && a1.pet.name === 'Пушок' && a1.pet.food === 2 && a1.pet.love === 0,
        'питомец не тот',
        a1.pet,
      );
      expect(money0 - a1.money === 500, 'взнос приюту', money0 - a1.money);
      await closeAll();
      // наклейка — с задержкой (award delay 900), окном из очереди
      await until(() => window.__dev.state.stickers.includes('x_pet'), null, 4000).catch(() => {});
      await L.drain();
      expect(await ev(() => window.__dev.state.stickers.includes('x_pet')), 'нет наклейки «Друг из приюта»');
      // рядом с хомячком, на суше
      const near = () =>
        ev(() => {
          const d = window.__dev,
            w = d.F.petDebug().world,
            p = d.World.playerPos();
          return w
            ? {
                d: Math.hypot(w.x - p.x, w.y - p.y),
                dry: d.World.map.dry(Math.floor(w.x / 48), Math.floor(w.y / 48)),
                away: w.away,
                moving: w.moving,
              }
            : null;
        });
      let n = await near();
      expect(n && n.d < 48 * 2 && n.dry, 'питомец не рядом после приюта', n);
      // идёт следом: через полгорода по улицам (углы, фонари, скамейки) — не отстаёт и не застревает
      await ev(() => window.__dev.World.walkTo(64.5 * 48, 30.5 * 48, true));
      let worst = 0;
      for (let i = 0; i < 60; i++) {
        await wait(200);
        n = await near();
        worst = Math.max(worst, n.d);
        expect(n.dry, 'питомец зашёл туда, где не ходят', n);
        if (await ev(() => !window.__dev.World.p.path.length && !window.__dev.World.p.moving)) break;
      }
      // догоняет: рядом и стоит
      await until(
        () => {
          const d = window.__dev,
            w = d.F.petDebug().world,
            p = d.World.playerPos();
          return w && !w.moving && Math.hypot(w.x - p.x, w.y - p.y) < 48 * 1.6;
        },
        null,
        3000,
      ).catch(() => {});
      n = await near();
      expect(n.d < 48 * 1.6 && worst < 48 * 4, 'питомец отстал', { n, worst });
      // быстрый переход по карте: прибегает
      await ev(() => window.__dev.World.debugTeleport(40, 14));
      await until(
        () => {
          const d = window.__dev,
            w = d.F.petDebug().world,
            p = d.World.playerPos();
          return w && Math.hypot(w.x - p.x, w.y - p.y) < 48 * 2;
        },
        null,
        3000,
      ).catch(() => {});
      n = await near();
      expect(n.d < 48 * 2 && n.dry, 'после переноса питомец не прибежал', n);
      // в воду не идёт: ждёт на берегу, потом прибегает
      await ev(() => window.__dev.World.debugTeleport(40, 56));
      await frames(3);
      await ev(() => window.__dev.World.walkTo(40.5 * 48, 61.5 * 48, true));
      await until(
        () =>
          window.__dev.World.map.kindAt(
            Math.floor(window.__dev.World.p.x / 48),
            Math.floor(window.__dev.World.p.y / 48),
          ).swim,
        null,
        9000,
        'хомячок в воде',
      );
      await wait(1500);
      n = await near();
      expect(n.dry && n.away, 'питомец пошёл в воду', n);
      await ev(() => window.__dev.World.walkTo(40.5 * 48, 55.5 * 48, true));
      await until(
        () => !window.__dev.World.p.path.length && !window.__dev.World.p.moving,
        null,
        9000,
        'хомячок вышла на берег',
      );
      await until(
        () => {
          const d = window.__dev,
            w = d.F.petDebug().world,
            p = d.World.playerPos();
          return w && !w.away && Math.hypot(w.x - p.x, w.y - p.y) < 48 * 2;
        },
        null,
        3000,
      ).catch(() => {});
      n = await near();
      expect(n.d < 48 * 2 && n.dry && !n.away, 'питомец не прибежал на берег', n);
      // окно питомца: нажать на него (когда добежал и стоит)
      await until(
        () => {
          const w = window.__dev.F.petDebug().world;
          return w && !w.moving;
        },
        null,
        3000,
      ).catch(() => {});
      await frames(2);
      const sp = await ev(() => window.__dev.F.petDebug().screen);
      await page.mouse.click(sp.x, sp.y);
      await until(() => document.querySelector('.pet-win'), null, 7000, 'окно питомца');
      await wait(380); // защита кнопок окна
      await page.click('.pet-win .act-feed');
      await until(() => window.__dev.state.pet.food === 1, null, 3000).catch(() => {});
      let pt = await ev(() => window.__dev.state.pet);
      const day = await ev(() => window.__dev.state.day);
      expect(pt.food === 1 && pt.love === 8 && pt.fed === day, 'покормить', pt);
      expect((await ev(() => window.__dev.F.petDebug().world.fx)) === 'feed', 'не видно, как ест');
      await untilFxDone();
      // второй раз за день — корм тратится, очков нет
      expect(await ev(() => window.__dev.F.careForPet('feed')), 'второй раз не покормить');
      pt = await ev(() => window.__dev.state.pet);
      expect(pt.food === 0 && pt.love === 8, 'второе кормление дало очки', pt);
      await untilFxDone();
      expect((await ev(() => window.__dev.F.careForPet('feed'))) === false, 'покормили без корма');
      expect((await ev(() => window.__dev.F.careForPet('play'))) === false, 'поиграли без мячика');
      expect(await ev(() => window.__dev.F.careForPet('pet')), 'не погладить');
      pt = await ev(() => window.__dev.state.pet);
      expect(pt.love === 11, 'погладить: +3', pt);
      await untilFxDone();
      // корм и мячик — в приюте
      await ev(() => void window.__dev.run('shelter'));
      await untilDialog(5000);
      await page.click('.dialog >> text=Корм и игрушки');
      await untilWin('.pet-good-food .btn');
      const m1 = await ev(() => window.__dev.state.money);
      await page.click('.pet-good-food .btn');
      await until(() => window.__dev.state.pet.food === 1, null, 3000).catch(() => {});
      await page.click('.pet-good-ball .btn');
      await until(
        () => window.__dev.state.pet.ball && !document.querySelector('.pet-good-ball .btn'),
        null,
        3000,
      ).catch(() => {});
      pt = await ev(() => window.__dev.state.pet);
      expect(
        pt.food === 1 && pt.ball && m1 - (await ev(() => window.__dev.state.money)) === 230,
        'покупка корма и мячика',
        pt,
      );
      expect(await ev(() => !document.querySelector('.pet-good-ball .btn')), 'мячик продаётся второй раз');
      await closeAll();
      expect(await ev(() => window.__dev.F.careForPet('play')), 'не поиграть');
      await frames(3);
      expect((await ev(() => window.__dev.F.petDebug().world.fx)) === 'play', 'не видно игры с мячиком');
      for (let i = 0; i < 12; i++) {
        await wait(250);
        n = await near();
        expect(n.dry, 'за мячиком забежал куда нельзя', n);
      }
      pt = await ev(() => window.__dev.state.pet);
      expect(pt.love === 16, 'поиграть: +5', pt);
      // голодный: грустит и просит, очки не убывают; покормили — весёлый
      await unwatch();
      await ev(() =>
        window.__dev.actions.mutate((s) => {
          s.pet.fed = s.day - 2;
        }),
      );
      await watch();
      let dbg = await ev(() => window.__dev.F.petDebug());
      expect(dbg.hungry && (await ev(() => window.__dev.state.pet.love)) === 16, 'голодный питомец', dbg);
      await ev(() => window.__dev.F.careForPet('feed'));
      await frames(2);
      dbg = await ev(() => window.__dev.F.petDebug());
      expect(!dbg.hungry, 'покормили — всё ещё грустит', dbg);
      await untilFxDone();
      // пять сердечек — «Лучший друг»
      await unwatch();
      await ev(() =>
        window.__dev.actions.mutate((s) => {
          s.pet.love = 98;
          s.pet.pet = -1;
        }),
      );
      await watch();
      await ev(() => window.__dev.F.careForPet('pet'));
      // наклейка «Лучший друг» — с задержкой (award delay 1800)
      await until(() => window.__dev.state.stickers.includes('x_pet_best'), null, 4000).catch(() => {});
      await untilFxDone().catch(() => {});
      dbg = await ev(() => ({
        h: window.__dev.F.petDebug().hearts,
        love: window.__dev.state.pet.love,
        st: window.__dev.state.stickers.includes('x_pet_best'),
      }));
      expect(dbg.h === 5 && dbg.love === 100 && dbg.st, '«Лучший друг»', dbg);
      // другое имя
      await L.drain(); // окно наклейки
      await ev(() => void window.__dev.run('pet'));
      await untilWin('.pet-win input');
      await page.fill('.pet-win input', 'Облачко');
      await page.keyboard.press('Enter');
      await until(() => window.__dev.state.pet.name === 'Облачко', null, 3000).catch(() => {});
      expect((await ev(() => window.__dev.state.pet.name)) === 'Облачко', 'имя не поменялось');
      await closeAll();
      // дома — рядом; в чужом месте (отель) его нет; в лесу — идёт с хомячком
      await go('villa');
      await until(() => !!window.__dev.F.petDebug().home && !!window.__dev.F.petDebug().screen, null, 3000).catch(
        () => {},
      );
      await frames(3);
      dbg = await ev(() => window.__dev.F.petDebug());
      expect(
        dbg.home && dbg.home.scene === 'villa' && dbg.home.f === (await ev(() => window.__dev.scene.p.f)),
        'дома питомца нет',
        dbg,
      );
      await page.mouse.click(dbg.screen.x, dbg.screen.y);
      await until(() => document.querySelector('.pet-win'), null, 5000, 'окно питомца дома');
      await wait(380); // защита кнопок окна
      await page.click('.pet-win .act-pet');
      await until(() => window.__dev.F.petDebug().home.fx === 'pet', null, 3000).catch(() => {});
      expect((await ev(() => window.__dev.F.petDebug().home.fx)) === 'pet', 'дома не видно, как гладят');
      await untilFxDone();
      await closeAll();
      await go('hotel');
      expect(!(await ev(() => window.__dev.F.petDebug().home)), 'питомец зашёл в отель');
      await L.toPlace('forest');
      await until(() => (window.__dev.F.petDebug().world || {}).scene === 'forest', null, 3000).catch(() => {});
      dbg = await ev(() => window.__dev.F.petDebug());
      expect(dbg.world && dbg.world.scene === 'forest', 'в лесу питомца нет', dbg);
      // «Подожди дома»: в городе его нет, дома — есть
      await ev(() => void window.__dev.run('pet'));
      await untilWin('.act-stay');
      await page.click('.act-stay');
      await until(() => window.__dev.state.pet.stay === true, null, 3000).catch(() => {});
      await frames(2);
      expect(
        (await ev(() => window.__dev.state.pet.stay)) === true && !(await ev(() => window.__dev.F.petDebug().world)),
        '«Подожди дома» не сработало',
      );
      await go('world');
      await frames(3);
      expect(!(await ev(() => window.__dev.F.petDebug().world)), 'ждёт дома — а гуляет по городу');
      await go('villa');
      await until(() => !!window.__dev.F.petDebug().home, null, 3000).catch(() => {});
      expect(await ev(() => !!window.__dev.F.petDebug().home), 'ждёт дома — а дома его нет');
      await ev(() => void window.__dev.run('pet'));
      await untilWin('.act-walk');
      await page.click('.act-walk');
      await until(() => !window.__dev.state.pet.stay, null, 3000).catch(() => {});
      await unwatch();
      // сохранение
      await reopen();
      pt = await ev(() => window.__dev.state.pet);
      expect(
        pt && pt.kind === 'bunny' && pt.name === 'Облачко' && pt.love === 100 && pt.ball && !pt.stay,
        'после перезагрузки питомец не тот',
        pt,
      );
      await go('world');
      await until(
        () => {
          const d = window.__dev,
            w = d.F.petDebug().world,
            p = d.World.playerPos();
          return w && Math.hypot(w.x - p.x, w.y - p.y) < 48 * 2;
        },
        null,
        3000,
      ).catch(() => {});
      n = await near();
      expect(n && n.d < 48 * 2, 'после перезагрузки питомец не рядом', n);
    },
  );
};

// Шаги автотеста про удалённый остров (П.9): задание Лифтёра Этажкина «Остров на горизонте» от взятия до сдачи
// (отметка «Далеко на юг» закрыта, остров в подзорной трубе башни, компас у Капитана Боба, плавание на юг картинкой);
// всё важное достижимо пешком, карта острова, спрайты днём и ночью; вулкан, вулканическое стекло, цветы для леи, лея
// и маленький тотем у Вождя, рынок; праздник огней (танцоры, гирлянда, танец у костра); «Кокосовый боулинг» до конца
// с призом (и жестом пальцем); задание Вождя Кокоса «Праздник огней»; ночёвка в хижине для гостей (утро на острове),
// сохранение и загрузка на острове, кораблик обратно в город, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:удалённый остров"
// (просто «остров» не годится: так называется и шаг секретного пляжа про кусочек карты на Звёздном острове).
const lib = require('./lib.js');

module.exports = async function island(ctx) {
  const L = lib(ctx);
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    until,
    untilScene,
    untilPanel,
    frames,
    go,
    act,
    sel,
    T,
    norm,
    expect,
    near,
    state,
    dialogText,
    panelText,
    toasts,
    clearToasts,
    where,
    watch,
    unwatch,
    MG_START,
    tap,
    mgGo,
    mgDone,
    mgClose,
  } = L;
  const now = (id) => ev((id) => window.__dev.QuestState.questNow(id), id);
  const badge = (id) => ev((id) => window.__dev.QuestState.questBadge(id), id);
  const fresh = () => L.fresh(); // 1 июня, без вводной цепочки
  /** На остров (открыв лес, джунгли и остров действием openLand); полдень, лето. */
  const toIsland = async (tx = 20, ty = 21, minutes = 12 * 60) => {
    await closeAll();
    await ev(
      ([tx, ty, minutes]) => {
        const d = window.__dev;
        for (const id of ['forest', 'jungle', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          s.flags.islandHint = 1;
        });
        d.go('island');
        d.locations.island.debugTeleport(tx, ty);
      },
      [tx, ty, minutes],
    );
    await untilScene('island');
    await frames(2);
  };
  /** Поговорить с жителем (действие act); если он предлагает задание — «Потом». */
  const talk = async (act) => {
    await L.react(
      (act) => {
        window.__dev.run(act);
      },
      act,
      500,
    );
    if (
      await ev(
        () => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent),
      )
    ) {
      await tap('.dialog .btn >> text=Потом', 450);
    }
  };
  /** В холл Хомяк-Тауэра (позиция «снаружи» — у двери башни). */
  const toTower = async () => {
    await ev(() => {
      const d = window.__dev,
        door = d.World.doorOf('tower');
      d.go('tower', { back: { scene: 'world', x: door.x, y: door.y } });
    });
    await untilScene('tower');
    await frames(2);
  };

  await step(
    'удалённый остров: задание Этажкина — отметка в море закрыта, остров в подзорной трубе, компас у Боба, сдача, плавание на юг',
    async () => {
      await fresh();
      await ev(() => {
        const d = window.__dev;
        d.actions.openLand('forest');
        d.actions.mutate((s) => {
          s.dayFlags = {};
          s.minutes = 12 * 60;
          s.quests.cabin_boy = { day: s.day, n: {}, got: {}, done: s.day }; // задание Боба сдано — он не перебивает
        });
        d.go('world');
      });
      await wait(300);
      // пока джунгли закрыты, задания нет
      expect((await now('far_island')).status === 'locked', 'задание Этажкина до джунглей', await now('far_island'));
      await ev(() => window.__dev.actions.openLand('jungle'));
      await wait(200);
      expect((await badge('etazhkin')) === '!', 'над Этажкиным нет «!»', await badge('etazhkin'));
      // отметка «Далеко на юг» за буйками — окно места: закрыто, про Этажкина
      const far = await ev(() => window.__dev.World.farAt());
      expect(far && far.y / T > 110 && far.y / T < 121, 'отметка «Далеко на юг» не на юге моря', far);
      await L.run('way:island', 500);
      let t = await panelText();
      expect(/Удалённый остров/.test(t) && /Этажкин/.test(t) && /🔒/.test(t), 'окно у закрытой отметки', t);
      await closeAll();
      expect((await where()).scene === 'world', 'закрытая отметка увезла на остров');
      // звёздочка задания (пока его можно взять) — к двери Хомяк-Тауэра
      await ev(() => window.__dev.goal.set('far_island'));
      const door = await ev(() => window.__dev.World.doorOf('tower'));
      let tg = await ev(() => window.__dev.World.target());
      expect(tg && Math.abs(tg.x - door.x) < 60 && Math.abs(tg.y - door.y) < 80, 'звёздочка не ведёт к башне', [
        tg,
        door,
      ]);
      await watch();
      // в холле башни: лифтёр предлагает задание
      await toTower();
      await L.run('liftman', 500);
      expect(
        /вулкан/.test(await dialogText()) && /Боба/.test(await dialogText()),
        'Этажкин не предлагает задание',
        await dialogText(),
      );
      await tap('.dialog .btn.green', 400);
      await tap('.dialog .btn.green', 400);
      let w = await now('far_island');
      expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
      // подзорная труба «море»: у горизонта — остров с вулканом; нажать на него
      await ev(() => window.__dev.Tower.openSeaScope());
      await untilPanel();
      await frames(2);
      expect(/Нажми на остров/.test(await panelText()), 'в трубе не видно острова', await panelText());
      const isle = await ev(() => {
        const c = document.querySelector('.overlay .panel canvas'),
          r = c.getBoundingClientRect(),
          F = window.__dev.Tower.FAR_ISLE;
        return { x: r.left + (F[0] / 320) * r.width, y: r.top + ((F[1] - 8) / 320) * r.height };
      });
      await page.mouse.click(isle.x, isle.y);
      await untilPanel('Остров на горизонте').catch(() => {});
      t = await panelText();
      expect(/Остров на горизонте/.test(t) && /Капитана Боба/.test(t), 'окно «Остров на горизонте»', t);
      await closeAll();
      w = await now('far_island');
      expect(w.i === 1 && (await badge('bob')) === '?', 'остров не засчитан или над Бобом нет «?»', w);
      // остров больше не мигает в трубе
      await ev(() => window.__dev.Tower.openSeaScope());
      await untilPanel();
      await frames(2);
      expect(!/Нажми на остров/.test(await panelText()), 'остров в трубе всё ещё ждёт');
      await closeAll();
      // Боб дарит компас (шаг «поговорить» в середине цепочки)
      await go('world');
      await L.run('npc:bob', 600);
      expect(/компас/.test(await dialogText()), 'Боб не говорит про компас', await dialogText());
      await tap('.dialog .btn.green', 500);
      await closeAll();
      let s = await state();
      w = await now('far_island');
      expect(
        s.finds.compass === 1 && w.i === 2 && (await badge('etazhkin')) === '?',
        'компас не подарен или над Этажкиным нет «?»',
        [s.finds, w],
      );
      expect(/Компас/.test(await toasts()), 'нет подсказки про компас в рюкзаке', await toasts());
      // в рюкзаке компас — инструмент, рынок его не берёт
      const sellCompass = await ev(() => window.__dev.F.sellable().some((g) => g.id === 'compass'));
      expect(!sellCompass, 'компас можно продать');
      // сдать задание Этажкину
      const s0 = await state();
      await toTower();
      await L.run('liftman', 500);
      await tap('.dialog .btn.green', 500);
      await tap('.dialog .btn.green', 1500);
      t = await panelText();
      expect(
        /Задание выполнено/.test(t) && /Дальняя путешественница/.test(t) && /Удалённый остров открыт/.test(t),
        'праздничное окно',
        t,
      );
      await closeAll();
      await unwatch();
      s = await state();
      expect(
        s.quests.far_island.done === s.day &&
          Number.isFinite(s.lands.island) &&
          s.money === s0.money + 800 &&
          s.stickers.includes('q_island') &&
          s.finds.compass === 1,
        'награда за задание Этажкина (компас остаётся)',
        [s.quests.far_island, s.lands, s.money - s0.money, s.finds],
      );
      // отметка открыта: кораблик подплыл — долгое плавание картинкой, потом — причал острова
      await ev(() => {
        const d = window.__dev,
          f = d.World.farAt(),
          x = f.x,
          y = f.y - 5 * 48;
        d.actions.patchState('boat', { x, y, on: true });
        d.go('world', { pos: { scene: 'world', x, y } }); // заново в город — кораблик берётся из сохранения (on: true)
      });
      await until(() => window.__dev.sceneName === 'world' && window.__dev.World.isBoating(), undefined, {
        timeout: 3000,
      }).catch(() => {});
      expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике');
      await ev(() => {
        const W = window.__dev.World,
          f = W.farAt();
        W.walkTo(f.x, f.y + 30, false);
      });
      await until(() => !!document.querySelector('.faraway-ride canvas'), undefined, { timeout: 8000 }).catch(() => {});
      expect(await ev(() => !!document.querySelector('.faraway-ride canvas')), 'нет картинки долгого плавания');
      await L.untilArrive('island', 12000).catch(() => {});
      await frames(2);
      const r = await where();
      const dock = await ev(() => {
        const sc = window.__dev.locations.island;
        return sc.map.doorPx(sc.map.bById.dock);
      });
      expect(r.scene === 'island' && near(r, dock, 30), 'приплыли не к причалу острова', [r, dock]);
      s = await state();
      expect(
        s.pos.scene === 'island' && !s.boat.on && s.stickers.includes('x_far_voyage'),
        'позиция после плавания, кораблик у пирса, наклейка',
        [s.pos, s.boat],
      );
    },
  );

  await step(
    'удалённый остров: всё важное достижимо пешком, карта острова, спрайты днём и ночью, погода и звук',
    async () => {
      await toIsland();
      const r = await ev(async () => {
        const d = window.__dev,
          sc = d.locations.island,
          m = sc.map,
          P = d.Plants,
          out = [];
        const I = await import('/js/locations/island.js');
        const from = [19, 27];
        const reach = (tx, ty) => m.foot(tx, ty) && !!m.path(m.foot, from[0], from[1], tx, ty);
        const reachNear = (tx, ty) =>
          [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => reach(tx + dx, ty + dy));
        for (const pl of sc.places)
          if (pl.stand && !reach(Math.floor(pl.stand[0]), Math.floor(pl.stand[1]))) out.push('место ' + pl.id);
        for (const n of sc.npcs) if (!reachNear(Math.floor(n.x / 48), Math.floor(n.y / 48))) out.push('житель ' + n.id);
        for (const id of ['plaza', 'beach']) {
          const p = sc.spot(id);
          if (!reachNear(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('точка ' + id);
        }
        for (const b of m.buildings) {
          const p = m.doorPx(b);
          if (!reach(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('дверь ' + b.id);
          if (!b.act) out.push('без действия: ' + b.id);
        }
        for (const [x, y] of I.FLOWER_SPOTS) if (!reach(x, y)) out.push(`место цветка (${x}, ${y})`);
        if (m.objs.some((o) => P.PLANTS[o.type]))
          out.push('на острове растёт что-то съедобное — сбор не посчитан в балансе');
        for (let y = 0; y < m.h; y++)
          for (let x = 0; x < m.w; x++)
            if ((x === 0 || y === 0 || x === m.w - 1) && m.foot(x, y)) out.push(`край карты проходим (${x}, ${y})`);
        // вулкан не пройти насквозь; к смотровой у кратера — тропинка
        if (m.foot(20, 7) || m.foot(20, 6)) out.push('сквозь вулкан можно пройти');
        return out;
      });
      expect(!r.length, 'на острове не всё достижимо', r);
      await ev(() => {
        window.__dev.F.openMap();
      });
      await untilPanel();
      const t = await panelText();
      expect(
        /Карта острова/.test(t) &&
          /Вулкан/.test(t) &&
          /Вулканическое стекло/.test(t) &&
          /Костёр/.test(t) &&
          /Боулинг/.test(t) &&
          /Хижина вождя/.test(t) &&
          /Хижина для гостей/.test(t) &&
          /Кораблик в город/.test(t) &&
          /Площадь/.test(t) &&
          /Пляж/.test(t),
        'карта острова',
        t,
      );
      await tap('.overlay .opt >> text=Боулинг', 400);
      expect(await ev(() => window.__dev.locations.island.p.path.length > 0), 'по кнопке карты не пошли');
      await closeAll();
      for (const minutes of [12 * 60, 6 * 60, 20 * 60, 23.5 * 60])
        for (const [x, y] of [
          [19, 27],
          [20, 19],
          [24, 3],
          [26, 9],
          [12, 15],
          [28, 21],
          [30, 24],
          [9, 22],
          [10, 28],
          [33, 17],
        ]) {
          await ev(
            ([x, y, minutes]) => {
              window.__dev.actions.mutate((s) => (s.minutes = minutes));
              window.__dev.locations.island.debugTeleport(x, y);
            },
            [x, y, minutes],
          );
          await wait(80);
        }
      const clipped = await ev(() => window.__dev.locations.island.debugSprites().clipped);
      expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
      const g = await ev(() => window.__dev.locations.island.debugGround());
      expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
      // городской дождь и снег на остров не попадают; всегда тепло; своя музыка
      const wx = await ev(() => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.weather = 'snow';
          s.day = 0;
          s.minutes = 12 * 60;
        });
        const sc = d.locations.island,
          out = { dry: sc.dry(), layer: (sc.weather || []).length, cold: sc.cold(), sound: sc.sound() };
        d.actions.mutate((s) => {
          s.weather = 'sun';
          s.day = 18;
        });
        return out;
      });
      expect(
        wx.dry && !wx.layer && wx.cold === false && wx.sound.day === 'island' && wx.sound.birds,
        'погода и звук на острове',
        wx,
      );
    },
  );

  await step(
    'удалённый остров: вулкан, вулканическое стекло, цветы для леи, лея и тотем у Вождя, рынок — только действия',
    async () => {
      await toIsland(24, 4);
      await watch();
      await clearToasts();
      await ev(() => window.__dev.actions.mutate((s) => (s.stickers = s.stickers.filter((id) => id !== 'x_volcano'))));
      await L.run('island:volcano', 1200);
      let s = await state();
      expect(s.stickers.includes('x_volcano') && /вулкан/i.test(await toasts()), 'наклейка «У подножия вулкана»', [
        s.stickers,
        await toasts(),
      ]);
      // стекло: раз в день
      const o0 = s.finds.obsidian || 0;
      await ev(() => {
        window.__dev.run('island:obsidian');
      });
      await L.run('island:obsidian', 300);
      s = await state();
      expect(
        s.finds.obsidian === o0 + 1 && s.dayFlags.island.obsidian === 1 && /уже взяла/.test(await toasts()),
        'вулканическое стекло — раз в день',
        [s.finds, s.dayFlags],
      );
      // цветок для леи: один в день, лежит на тропинке (подбирается на ходу); на другой день — другой вид
      const fl = await ev(async () => {
        const I = await import('/js/locations/island.js'),
          sc = window.__dev.locations.island;
        return {
          today: I.flowerToday(),
          spot: I.FLOWER_SPOTS[I.flowerToday().i],
          pickups: sc.pickups.map((p) => p.key),
        };
      });
      expect(fl.pickups.length === 1, 'цветов на острове не один', fl);
      await ev((spot) => {
        const sc = window.__dev.locations.island;
        sc.debugTeleport(spot[0], spot[1] + 1);
        sc.walkTo((spot[0] + 0.5) * 48, (spot[1] + 0.5) * 48, true);
      }, fl.spot);
      await until(
        (id) => window.__dev.G.state.finds[id] === 1 && /лею/.test(document.querySelector('#toasts').textContent),
        fl.today.id,
        { timeout: 5000 },
      ).catch(() => {});
      s = await state();
      expect(s.finds[fl.today.id] === 1 && /лею/.test(await toasts()), 'цветок не подобран', [s.finds, await toasts()]);
      const next = await ev(async () => {
        const I = await import('/js/locations/island.js');
        window.__dev.actions.mutate((st) => (st.day += 1));
        const f = I.flowerToday();
        window.__dev.actions.mutate((st) => (st.day -= 1));
        return f;
      });
      expect(next.id !== fl.today.id, 'на другой день распустился тот же цветок', [next, fl.today]);
      // лея: из трёх разных цветов — у Вождя (одна на всю игру)
      await ev(() => {
        const a = window.__dev.actions;
        for (const id of ['flower_plumeria', 'flower_hibiscus', 'flower_orchid'])
          if (!window.__dev.G.state.finds[id]) a.addItem('finds', id, 1);
        a.addItem('finds', 'flower_orchid', 1);
        a.mutate((st) => (st.clothes = st.clothes.filter((id) => id !== 'lei_island')));
        window.__dev.locations.island.debugTeleport(18, 19);
      });
      await talk('chief');
      await tap('.dialog .btn >> text=Сплети лею', 500);
      await closeAll();
      s = await state();
      expect(
        s.clothes.includes('lei_island') &&
          !s.finds.flower_plumeria &&
          !s.finds.flower_hibiscus &&
          s.finds.flower_orchid === 1 &&
          s.stickers.includes('x_lei'),
        'лея из цветов',
        [s.clothes.includes('lei_island'), s.finds],
      );
      await ev(() => window.__dev.actions.wear('acc', 'lei_island'));
      expect((await state()).look.outfit.acc === 'lei_island', 'лея не надевается');
      // маленький тотем: из трёх кусочков стекла
      await ev(() => window.__dev.actions.addItem('finds', 'obsidian', 3 - (window.__dev.G.state.finds.obsidian || 0)));
      await talk('chief');
      await tap('.dialog .btn >> text=Вырежи маленький тотем', 500);
      await closeAll();
      s = await state();
      expect(s.storage.mini_totem === 1 && !s.finds.obsidian && s.stickers.includes('x_totem'), 'маленький тотем', [
        s.storage,
        s.finds,
      ]);
      // находки берёт рынок (кошелёк торговца — общий)
      await ev(() => {
        window.__dev.actions.addItem('finds', 'obsidian', 2);
      });
      const sold = await ev(() => {
        const F = window.__dev.F,
          g = F.sellable().find((q) => q.id === 'obsidian'),
          f = F.sellable().find((q) => q.id === 'flower_orchid');
        if (!g || !f) return null;
        const m0 = window.__dev.G.state.money;
        F.sellGoods(g, 2);
        F.sellGoods(f, 1);
        return {
          sell: g.sell,
          fsell: f.sell,
          got: window.__dev.G.state.money - m0,
          left: window.__dev.G.state.finds.obsidian || 0,
        };
      });
      expect(
        sold && sold.sell === 35 && sold.fsell === 15 && sold.got === 85 && !sold.left,
        'находки острова на рынке',
        sold,
      );
      await unwatch();
    },
  );

  await step(
    'удалённый остров: праздник огней — днём подсказка, вечером танцоры и гирлянда, танец у костра, поздно — закончился',
    async () => {
      await toIsland(20, 19);
      await clearToasts();
      let f = await ev(async () => (await import('/js/locations/island.js')).debugFest());
      expect(!f.fest && !f.garland && f.bulbs > 20, 'днём праздник', f);
      await L.run('island:fire', 300);
      expect(/19:00/.test(await toasts()), 'днём у костра нет подсказки про праздник', await toasts());
      await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 20 * 60)));
      await wait(200);
      f = await ev(async () => (await import('/js/locations/island.js')).debugFest());
      expect(f.fest && f.garland && f.dancers.length === 4, 'вечером нет праздника', f);
      // танцоры — вокруг костра
      const fire = { x: 20.5 * T, y: 16.5 * T };
      expect(
        f.dancers.every((p) => Math.hypot(p.x - fire.x, p.y - fire.y) < 140),
        'танцоры не у костра',
        f.dancers,
      );
      await ev(() => window.__dev.actions.mutate((s) => (s.stickers = s.stickers.filter((id) => id !== 'x_fest'))));
      await watch();
      await clearToasts();
      await L.run('island:fire', 900);
      // танец — ритм-игра «Танец у костра» под барабан Бума (этап 14, О8): до конца через dev-хук
      expect(
        await ev(() => /Танец у костра/.test((document.querySelector('#mg') || {}).textContent || '')),
        'нет игры «Танец у костра»',
      );
      await mgGo();
      await ev(() => document.querySelector('#mg .dr-canvas').__drumSkip());
      await page.waitForSelector('#mg >> text=Ура!', { timeout: 6000 });
      await mgDone();
      let s = await state();
      expect(
        s.stickers.includes('x_fest') &&
          /праздник/i.test(await toasts()) &&
          !(await ev(() => !!document.querySelector('#mg'))),
        'после танца — наклейка',
        [s.stickers, await toasts()],
      );
      await unwatch();
      await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 22 * 60 + 30)));
      await clearToasts();
      await L.run('island:fire', 300);
      expect(/закончился/.test(await toasts()), 'поздно вечером праздник не закончился', await toasts());
    },
  );

  await step(
    'удалённый остров: «Кокосовый боулинг» — до конца с призом, правило картинкой, жест пальцем, третья игра — для удовольствия',
    async () => {
      await toIsland(29, 24);
      const s0 = await state();
      await L.run('island:bowling', 1200);
      const intro = norm(await ev(() => document.querySelector('#mg').textContent));
      expect(
        (await ev(() => document.querySelectorAll('#mg .bw-col img').length)) === 3 &&
          /Приз Вождя/.test(intro) &&
          /кегли/.test(intro),
        'правило картинкой',
        intro,
      );
      await mgGo();
      const box = await ev(() => {
        const r = document.querySelector('#mg canvas').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      // бот: направление — когда стрелка смотрит прямо, сила — когда полоска почти полная
      for (let k = 0; k < 1500; k++) {
        const q = await ev(
          () =>
            document.querySelector('#mg canvas.bw-canvas') &&
            document.querySelector('#mg canvas.bw-canvas').__bowling(),
        );
        if (!q || q.over) break;
        if (q.phase === 'aim' && Math.abs(q.angle) < 0.04) await page.mouse.click(box.x, box.y);
        else if (q.phase === 'power' && q.power > 0.85) await page.mouse.click(box.x, box.y);
        await wait(20);
      }
      await page.waitForSelector('#mg >> text=Ура!', { timeout: 20000 });
      const end = norm(await ev(() => document.querySelector('#mg').textContent));
      expect(/Сбито кеглей/.test(end) && /⭐/.test(end), 'итог игры', end);
      await mgDone();
      const s1 = await state();
      const stars = s1.best.bowling;
      expect(
        s1.plays.bowling === 1 && stars === 3 && s1.dayFlags.island.bowls === 1 && s1.stickers.includes('x_bowling'),
        'игра записана',
        [s1.plays, s1.best, s1.dayFlags.island],
      );
      expect(s1.money === s0.money + [40, 80, 120][stars - 1], 'приз Вождя', s1.money - s0.money);
      // вторая — с призом; жест пальцем от кокоса вверх — кокос сразу катится; закрыли крестиком — ничего
      await ev(() => {
        window.__dev.F.bowlingGame();
      });
      await page.waitForSelector(MG_START);
      expect(
        /ещё 1 игра/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
        'на заставке — сколько игр с призом',
      );
      await mgGo();
      const ball = await ev(() => {
        const c = document.querySelector('#mg canvas.bw-canvas'),
          r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.8 };
      });
      await page.mouse.move(ball.x, ball.y);
      await page.mouse.down();
      await page.mouse.move(ball.x + 10, ball.y - 160, { steps: 6 });
      await page.mouse.up();
      await wait(150);
      const q = await ev(() => document.querySelector('#mg canvas.bw-canvas').__bowling());
      expect(q.phase === 'roll' || q.phase === 'wait', 'жест не покатил кокос', q);
      await mgClose();
      expect((await state()).money === s1.money, 'закрыли игру — а приз пришёл');
      // две игры уже были — третья для удовольствия
      await ev(() => window.__dev.actions.setDayFlag('bowls', 2, 'island'));
      await ev(() => {
        window.__dev.F.bowlingGame();
      });
      await page.waitForSelector(MG_START);
      expect(
        /для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
        'третья игра — без приза',
      );
      await mgClose();
      await closeAll();
    },
  );

  await step(
    'удалённый остров: задание Вождя Кокоса «Праздник огней» — стекло, танец, сдача, юбочка из травы, «уже танцевала»',
    async () => {
      await toIsland(18, 19, 12 * 60);
      await ev(() =>
        window.__dev.actions.mutate((s) => {
          delete s.quests.chief_fest;
          s.clothes = s.clothes.filter((id) => id !== 'grass_skirt');
          s.stickers = s.stickers.filter((id) => id !== 'x_fest');
          s.finds.obsidian = 0;
        }),
      );
      await watch();
      expect((await badge('kokos')) === '!', 'над Вождём нет «!»', await badge('kokos'));
      await L.run('chief', 500);
      expect(
        /стекла/.test(await dialogText()) && /потанцуй/.test(await dialogText()),
        'Вождь не предлагает задание',
        await dialogText(),
      );
      await tap('.dialog .btn.green', 400);
      await tap('.dialog .btn.green', 400);
      let w = await now('chief_fest');
      expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
      const tg = await ev(() => window.__dev.locations.island.target());
      expect(tg && Math.abs(tg.x - 25.5 * T) < 40 && Math.abs(tg.y - 9.6 * T) < 60, 'звёздочка не ведёт к стеклу', tg);
      await L.run('island:obsidian', 300);
      w = await now('chief_fest');
      expect(w.i === 1, 'стекло не засчитано', w);
      // танец на празднике (событие — как после сценки, сама сценка проверена шагом выше)
      await ev(() => window.__dev.emit('island', { what: 'dance' }));
      await frames(2);
      w = await now('chief_fest');
      expect(w.i === 2 && (await badge('kokos')) === '?', 'после танца — к Вождю «?»', w);
      const s0 = await state();
      await L.run('chief', 500);
      await tap('.dialog .btn.green', 500);
      await tap('.dialog .btn.green', 1500);
      const t = await panelText();
      expect(
        /Задание выполнено/.test(t) && /Подружка островитян/.test(t) && /Юбочка из травы/.test(t),
        'праздничное окно',
        t,
      );
      await closeAll();
      await unwatch();
      let s = await state();
      expect(
        s.quests.chief_fest.done === s.day &&
          s.money === s0.money + 600 &&
          s.stickers.includes('q_chief') &&
          s.clothes.includes('grass_skirt') &&
          !s.finds.obsidian,
        'награда за задание Вождя (и стекло отдано)',
        [s.quests.chief_fest, s.money - s0.money, s.finds],
      );
      await ev(() => window.__dev.actions.wear('legs', 'grass_skirt'));
      expect((await state()).look.outfit.legs === 'grass_skirt', 'юбочка не надевается');
      // уже танцевала на празднике — шаг засчитан сразу, как взяли задание (поле already)
      await ev(() =>
        window.__dev.actions.mutate((st) => {
          delete st.quests.chief_fest;
          if (!st.stickers.includes('x_fest')) st.stickers.push('x_fest');
        }),
      );
      await L.run('chief', 500);
      await tap('.dialog .btn.green', 400);
      await closeAll();
      w = await now('chief_fest');
      expect(w.status === 'active' && w.steps[1].ok, 'танец «уже был» — не засчитан сразу', w);
    },
  );

  await step(
    'удалённый остров: ночёвка в хижине для гостей — утро на острове, сохранение и загрузка, кораблик в город, «Домой»',
    async () => {
      await fresh(); // своя новая игра: не опираться на дом и место, оставленные прошлыми шагами
      await toIsland(28, 21, 21 * 60 + 30);
      await ev(() =>
        window.__dev.actions.mutate((s) => (s.stickers = s.stickers.filter((id) => id !== 'x_island_night'))),
      );
      const day0 = (await state()).day;
      await ev(() => {
        const sc = window.__dev.locations.island;
        sc.enterBuilding(sc.map.bById.guest);
      });
      await untilScene('hut_guest').catch(() => {});
      await frames(2);
      // этап 13: дверь ведёт внутрь хижины, спать — на циновке (её действие — island:sleep)
      expect(
        (await ev(() => window.__dev.sceneName)) === 'hut_guest',
        'дверь хижины не ведёт внутрь',
        await ev(() => window.__dev.sceneName),
      );
      await L.run('island:sleep', 600);
      expect(/Пора спать/.test(await panelText()), 'хижина для гостей не предлагает поспать', await panelText());
      await L.confirmSleep(); // «Спать» — и до утра, утренние окна закрыты
      let s = await state();
      expect(
        (await ev(() => window.__dev.sceneName)) === 'hut_guest',
        'утро не в хижине',
        await ev(() => window.__dev.sceneName),
      );
      await ev(() => window.__dev.scene.exit()); // выйти из хижины — к её двери на острове
      await untilScene('island').catch(() => {});
      await frames(2);
      const r0 = await where();
      const gd = await ev(() => {
        const sc = window.__dev.locations.island;
        return sc.map.doorPx(sc.map.bById.guest);
      });
      expect(
        s.day === day0 + 1 && s.minutes < 9 * 60 && r0.scene === 'island' && near(r0, gd, 30),
        'утро не на острове у хижины',
        [s.day, s.minutes, r0, gd],
      );
      expect(s.stickers.includes('x_island_night'), 'нет наклейки «Ночь на острове»', s.stickers);
      // новый день — новый цветок (pickups обновились)
      const fl = await ev(async () => {
        const I = await import('/js/locations/island.js');
        return { want: 'island:f' + I.flowerToday().i, have: window.__dev.locations.island.pickups.map((p) => p.key) };
      });
      expect(fl.have.length === 1 && fl.have[0] === fl.want, 'утром цветок не на сегодняшнем месте', fl);
      // сохранение и загрузка на острове
      await ev(() => window.__dev.locations.island.debugTeleport(20, 22));
      await frames(3);
      const raw = await ev(() => {
        window.dispatchEvent(new Event('pagehide'));
        return localStorage.getItem('rhr-save-v1');
      });
      const pos = JSON.parse(raw).pos;
      expect(pos.scene === 'island', 'позиция в сохранении', pos);
      await ev((raw) => {
        window.__dev.G.state = null;
        localStorage.setItem('rhr-save-v1', raw);
      }, raw);
      await page.reload();
      await page.waitForSelector(sel('continue'));
      await L.cont();
      await closeAll();
      let r = await where();
      expect(r.scene === 'island' && near(r, pos, 30), 'после загрузки — на острове на том же месте', [r, pos]);
      // в город — с причала (дверь хижины dock): долгое плавание обратно
      await ev(() => {
        const sc = window.__dev.locations.island;
        sc.enterBuilding(sc.map.bById.dock);
      });
      await L.until(() => !!document.querySelector('.faraway-ride'), undefined, { timeout: 3000 }).catch(() => {});
      expect(await ev(() => !!document.querySelector('.faraway-ride')), 'нет картинки плавания в город');
      await L.untilArrive('world', 12000).catch(() => {});
      await frames(2);
      r = await where();
      s = await state();
      expect(
        r.scene === 'world' && near(r, { x: 63.5 * T, y: 60.6 * T }, 40) && !s.boat.on,
        'кораблик привёз не к пирсу города',
        [r, s.boat],
      );
      // «Домой» с острова — на виллу
      await toIsland(20, 22);
      await page.click('.hud-btns.left .rbtn:last-child');
      await page.click('.panel-foot .btn.green');
      await untilScene('villa').catch(() => {});
      expect(
        (await ev(() => window.__dev.sceneName)) === 'villa',
        'кнопка «Домой» с острова',
        await ev(() => window.__dev.sceneName),
      );
    },
  );
};

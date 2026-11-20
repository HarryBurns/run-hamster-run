// Шаги автотеста про пустыню (П.9): задание Буси «Звезда подиума» от взятия до сдачи (показ мод на 3★, шляпа от
// солнца в ТЦ «Модный», «уже было» — засчитано сразу), остановка каравана в городе закрыта / открыта (табличка
// с замочком, переезд картинкой); всё важное достижимо пешком, карта пустыни, спрайты, сбор плодов кактуса по сезону;
// оазис, колодец, мираж, звездопад, жара без шляпы, коллекция окаменелостей, окаменелости на рынке; «Раскопки» и
// «Пары» до конца с призом; катание на верблюде; задание Бархана «Бубенчик верблюда»; сохранение и загрузка
// в пустыне, караван обратно в город и за шлагбаум, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:пустыня
const lib = require('./lib.js');

module.exports = async function desert(ctx) {
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
    untilArrive,
    frames,
    go,
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
  const fresh = () => L.fresh(); // 1 июня, без вводной цепочки
  /** В пустыню (открыв лес и пустыню действием openLand); полдень, лето. */
  const toDesert = async (tx = 21, ty = 30, minutes = 12 * 60) => {
    await closeAll();
    await ev(
      ([tx, ty, minutes]) => {
        const d = window.__dev;
        for (const id of ['forest', 'desert']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          s.flags.desertHint = 1;
        });
        d.go('desert');
        d.locations.desert.debugTeleport(tx, ty);
      },
      [tx, ty, minutes],
    );
    await untilScene('desert');
    await frames(2);
  };
  /** Поговорить с Барханом; если он предлагает задание — «Потом». */
  const talkB = async () => {
    await L.run('nomad', 500);
    if (
      await ev(
        () => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent),
      )
    ) {
      await tap('.dialog .btn >> text=Потом', 450);
    }
  };
  const SUN_HATS = [
    'sunhat',
    'sunhat_blue',
    'sunhat_daisy',
    'sunhat_wide',
    'panama_green',
    'panama_white',
    'panama_pink',
    'hat_pith',
    'hat_cowboy',
    'scarf_nomad',
  ];

  await step(
    'пустыня: задание Буси «Звезда подиума» — остановка закрыта, показ мод, шляпа от солнца, сдача, караван в пустыню',
    async () => {
      await fresh();
      // лес открыт, пустыня — нет: у остановки окно про Бусю; на указателе — одна доска (про Бусю говорит остановка)
      await ev((hats) => {
        const d = window.__dev;
        d.actions.openLand('forest');
        d.actions.mutate((s) => {
          s.dayFlags = {};
          s.minutes = 12 * 60;
          s.best.fashion = 0;
          s.clothes = s.clothes.filter((id) => !hats.includes(id));
          s.money = 5000;
        });
        d.go('world');
        d.World.debugTeleport(91, 26);
      }, SUN_HATS);
      await wait(300);
      const sign = await ev(() => {
        const o = window.__dev.World.map.objs.find((q) => q.type === 'signpost' && q.tx === 92 && q.ty === 25);
        return o ? [o.text, o.text2 || null] : null;
      });
      expect(sign && sign[0] === '🐪 В пустыню' && !sign[1], 'табличка у закрытой остановки — одна доска', sign);
      await L.run('way:desert', 500);
      expect(
        /Пустыня/.test(await panelText()) && /Буся/.test(await panelText()),
        'окно у закрытой остановки',
        await panelText(),
      );
      await closeAll();
      expect((await where()).scene === 'world', 'закрытая остановка увезла в пустыню');
      await watch();
      const now = () => ev(() => window.__dev.QuestState.questNow('runway_star'));
      expect((await ev(() => window.__dev.QuestState.questBadge('busya'))) === '!', 'над Бусей нет «!»');
      await L.run('npc:busya', 500);
      expect(
        /пустын/.test(await dialogText()) && /шляп/.test(await dialogText()),
        'Буся не предлагает задание',
        await dialogText(),
      );
      await tap('.dialog .btn.green', 400);
      await tap('.dialog .btn.green', 400);
      let w = await now();
      expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
      // звёздочка — к Дому моды
      const tg = await ev(() => {
        const d = window.__dev;
        return { t: d.World.target(), door: d.World.doorOf('fashion') };
      });
      expect(tg.t && Math.abs(tg.t.x - tg.door.x) < 3, 'звёздочка не у Дома моды', tg);
      // показ мод: две звезды не считаются, три — да (событие мини-игры — как после настоящего показа)
      await ev(() => window.__dev.emit('minigame', { id: 'fashion', stars: 2 }));
      await frames(2);
      expect((await now()).i === 0, 'показ на 2★ засчитан', await now());
      await ev(() => window.__dev.emit('minigame', { id: 'fashion', stars: 3 }));
      await frames(2);
      w = await now();
      expect(w.i === 1, 'показ на 3★ не засчитан', w);
      // шляпа от солнца — в ТЦ «Модный», отдел «Голова»
      const m0 = (await state()).money;
      await ev(() => {
        window.__dev.run({ do: 'clothes-shop', vendor: 'mall', shops: ['mall'] });
      });
      await untilPanel();
      await tap('.overlay .tabs >> text=Голова', 400);
      expect(/Шляпа от солнца/.test(await panelText()), 'нет шляпы от солнца в ТЦ «Модный»', await panelText());
      await tap('.overlay .card:has-text("Шляпа от солнца") .btn', 500);
      let s = await state();
      expect(s.clothes.includes('sunhat_wide') && s.money === m0 - 350, 'шляпа не куплена', [m0 - s.money]);
      await closeAll();
      w = await now();
      expect(
        w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('busya'))) === '?',
        'после шляпы — к Бусе «?»',
        w,
      );
      const s0 = await state();
      await L.run('npc:busya', 500);
      await tap('.dialog .btn.green', 500);
      await tap('.dialog .btn.green', 1500);
      const t = await panelText();
      expect(
        /Задание выполнено/.test(t) && /Королева песков/.test(t) && /Пустыня открыта/.test(t),
        'праздничное окно',
        t,
      );
      await closeAll();
      await unwatch();
      s = await state();
      expect(
        s.quests.runway_star.done === s.day &&
          Number.isFinite(s.lands.desert) &&
          s.money === s0.money + 700 &&
          s.stickers.includes('q_desert'),
        'награда за задание Буси',
        [s.quests.runway_star, s.lands, s.money - s0.money],
      );
      // показ уже был на 3★ и шляпа уже есть — оба шага засчитываются сразу, как взяли задание (поле already)
      await ev(() =>
        window.__dev.actions.mutate((st) => {
          delete st.quests.runway_star;
          st.best.fashion = 3;
        }),
      );
      await L.run('npc:busya', 500);
      await tap('.dialog .btn.green', 400);
      await closeAll();
      expect((await now()).i === 2, 'показ и шляпа «уже были» — не засчитаны сразу', await now());
      // остановка открыта: за шлагбаумом — действие caravan:go; way:desert везёт картинкой
      const open = await ev(() => {
        const e = window.__dev.World.exit('desert');
        return { act: e.act, open: !e.off && e.when() };
      });
      expect(open.act === 'caravan:go' && open.open, 'открытая остановка', open);
      await L.run('way:desert', 700);
      expect(await ev(() => !!document.querySelector('.caravan-ride canvas')), 'нет картинки переезда');
      await untilArrive('desert').catch(() => {});
      await frames(2);
      const r = await where();
      const door = await ev(() => {
        const sc = window.__dev.locations.desert;
        return sc.map.doorPx(sc.map.bById.stop);
      });
      expect(r.scene === 'desert' && near(r, door, 30), 'приехали не к остановке в пустыне', [r, door]);
      const saved = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).pos);
      expect(saved.scene === 'desert', 'позиция в сохранении после переезда', saved);
    },
  );

  await step('пустыня: всё важное достижимо пешком, карта пустыни, спрайты, плоды кактуса по сезону', async () => {
    await toDesert();
    const r = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.desert,
        m = sc.map,
        P = d.Plants,
        out = [];
      const D = await import('/js/data/index.js');
      const from = [21, 37];
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
      for (const id of ['cacti', 'ring']) {
        const p = sc.spot(id);
        if (!reachNear(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('точка ' + id);
      }
      for (const b of m.buildings) {
        const p = m.doorPx(b);
        if (!reach(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('дверь ' + b.id);
        if (!b.act) out.push('без действия: ' + b.id);
      }
      const plants = m.objs.filter((o) => P.PLANTS[o.type]);
      for (const o of plants) if (!reachNear(o.tx, o.ty + 1)) out.push(`растение ${o.type} (${o.tx}, ${o.ty})`);
      if (plants.length !== D.DESERT_GATHER.cactus_fruit.max)
        out.push(`опунций ${plants.length}, в таблице ${D.DESERT_GATHER.cactus_fruit.max}`);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const k = m.at(x, y);
          if (k === 'oasisWater' && m.foot(x, y)) out.push(`в оазис можно зайти (${x}, ${y})`);
          if ((x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1) && m.foot(x, y))
            out.push(`край карты проходим (${x}, ${y})`);
        }
      // плоды кактуса: не в сезон — ничего; в сезон — по плоду, второй раз — ничего, наутро — снова
      const o = plants[0],
        inM = [...Array(12).keys()].find((mo) => D.pickIn('cactus_fruit', mo)),
        offM = [...Array(12).keys()].find((mo) => !D.pickIn('cactus_fruit', mo)),
        s = d.G.state;
      d.actions.mutate((st) => {
        st.day = offM * 3;
        st.dayFlags = {};
      });
      const a0 = s.ing.cactus_fruit || 0;
      if (P.hasFruit(o) || P.gather(sc, o) || (s.ing.cactus_fruit || 0) !== a0) out.push('плод кактуса не в сезон');
      d.actions.mutate((st) => {
        st.day = inM * 3;
        st.dayFlags = {};
      });
      if (!P.hasFruit(o)) out.push('в сезон нет плодов кактуса');
      P.gather(sc, o);
      if ((s.ing.cactus_fruit || 0) !== a0 + 1) out.push('плод кактуса не собран');
      if (P.gather(sc, o) || (s.ing.cactus_fruit || 0) !== a0 + 1) out.push('плод кактуса — дважды за день');
      if (!s.dayFlags.plants || !s.dayFlags.plants[`desert:${o.tx}_${o.ty}`]) out.push('отметка дня без имени пустыни');
      d.actions.nextDay();
      if (!P.hasFruit(o)) out.push('плод кактуса наутро не вырос');
      d.actions.mutate((st) => {
        st.day = 18;
        st.minutes = 12 * 60;
      });
      return out;
    });
    expect(!r.length, 'в пустыне не всё достижимо или сбор не так', r);
    await ev(() => {
      window.__dev.F.openMap();
    });
    await untilPanel();
    const t = await panelText();
    expect(
      /Карта пустыни/.test(t) &&
        /Раскопки/.test(t) &&
        /Верблюд Финик/.test(t) &&
        /Звёздный бархан/.test(t) &&
        /Оазис/.test(t) &&
        /Пирамида/.test(t) &&
        /Шатёр Бархана/.test(t) &&
        /Караван в город/.test(t),
      'карта пустыни',
      t,
    );
    await tap('.overlay .opt >> text=Оазис', 400);
    expect(await ev(() => window.__dev.locations.desert.p.path.length > 0), 'по кнопке карты не пошли');
    await closeAll();
    for (const minutes of [12 * 60, 23 * 60])
      for (const [x, y] of [
        [21, 30],
        [22, 22],
        [27, 21],
        [8, 12],
        [34, 12],
        [6, 24],
        [10, 33],
        [32, 30],
        [21, 7],
        [36, 22],
      ]) {
        await ev(
          ([x, y, minutes]) => {
            window.__dev.actions.mutate((s) => (s.minutes = minutes));
            window.__dev.locations.desert.debugTeleport(x, y);
          },
          [x, y, minutes],
        );
        await wait(80);
      }
    const clipped = await ev(() => window.__dev.locations.desert.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    const g = await ev(() => window.__dev.locations.desert.debugGround());
    expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
    // погоды нет: дождь в городе — в пустыне сухо (слой неба без дождя, промокнуть нельзя)
    const dry = await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => (s.weather = 'rain'));
      const sc = d.locations.desert;
      return { dry: sc.dry(), weather: (sc.weather || []).length };
    });
    expect(dry.dry && dry.weather === 0, 'в пустыне идёт дождь', dry);
    await ev(() => window.__dev.actions.mutate((s) => (s.weather = 'sun')));
  });

  await step(
    'пустыня: оазис, колодец, мираж, звездопад, жара без шляпы, коллекция окаменелостей, рынок — только действия',
    async () => {
      await toDesert(31, 30);
      await watch();
      await clearToasts();
      await ev(() => {
        window.__dev.run('desert:oasis');
        window.__dev.run('desert:well');
      });
      await wait(200);
      expect(/оазиса/.test(await toasts()) && /колодец/.test(await toasts()), 'оазис и колодец', await toasts());
      // мираж: вдали виден, подошла — растаял, наклейка
      await wait(300);
      const far = await ev(async () =>
        (await import('/js/locations/desert.js')).mirageAlpha(window.__dev.locations.desert),
      );
      expect(far > 0.3, 'миража вдали не видно', far);
      await clearToasts();
      await ev(() => window.__dev.locations.desert.debugTeleport(37, 30));
      await until(() => /мираж/.test(document.querySelector('#toasts').textContent), undefined, {
        timeout: 3000,
      }).catch(() => {});
      await frames(3);
      const nearA = await ev(async () =>
        (await import('/js/locations/desert.js')).mirageAlpha(window.__dev.locations.desert),
      );
      expect(nearA < 0.05 && /мираж/.test(await toasts()), 'мираж не растаял', [nearA, await toasts()]);
      // звездопад: днём — подсказка, ночью — окно и желание
      await clearToasts();
      await L.run('desert:stars', 200);
      expect(
        /ночью/.test(await toasts()) && !(await ev(() => !!document.querySelector('.overlay'))),
        'звездопад днём',
        await toasts(),
      );
      await ev(() => {
        window.__dev.actions.mutate((s) => (s.minutes = 23 * 60));
        window.__dev.run('desert:stars');
      });
      await untilPanel('Звездопад').catch(() => {});
      expect(
        /Звездопад/.test(await panelText()) && (await ev(() => !!document.querySelector('.overlay canvas'))),
        'окно звездопада',
      );
      await tap('.overlay .wish >> nth=0', 400);
      expect(/Желание загадано/.test(await panelText()), 'желание не загадано', await panelText());
      await closeAll();
      let s = await state();
      expect(s.stickers.includes('x_mirage') && s.stickers.includes('x_wish'), 'наклейки миража и желания', s.stickers);
      // жара: днём без шляпы — добрая подсказка (раз в день); в шляпе — нет
      await clearToasts();
      await ev(() => {
        const d = window.__dev;
        d.actions.mutate((st) => {
          st.minutes = 12 * 60;
          st.dayFlags = {};
        });
        d.actions.wear('head', null);
        d.locations.desert.debugTeleport(21, 30);
      });
      // жара копится 15 игровых минут (DESERT.heat, минута — 0,6 с)
      await until(
        () =>
          (window.__dev.G.state.dayFlags.desert || {}).heat === 1 &&
          /шляпу/.test(document.querySelector('#toasts').textContent),
        undefined,
        { timeout: 14000 },
      ).catch(() => {});
      s = await state();
      expect((s.dayFlags.desert || {}).heat === 1 && /шляпу/.test(await toasts()), 'нет подсказки про жару', [
        s.dayFlags,
        await toasts(),
      ]);
      await ev(() => {
        const d = window.__dev;
        d.actions.mutate((st) => (st.dayFlags = {}));
        if (!d.G.state.clothes.includes('sunhat_wide')) d.actions.addClothes('sunhat_wide');
        d.actions.wear('head', 'sunhat_wide');
      });
      // жара уже накоплена (тот же день): без шляпы подсказка пришла бы в первый же кадр — хватит короткой паузы
      await wait(1000);
      expect(!((await state()).dayFlags.desert || {}).heat, 'подсказка про жару в шляпе');
      // коллекция окаменелостей: по одной каждого вида
      await ev(() => {
        const a = window.__dev.actions;
        for (const id of ['fossil_shell', 'fossil_leaf', 'fossil_tooth', 'fossil_bone']) a.addItem('finds', id, 1);
        a.addItem('finds', 'fossil_bone', 2);
        window.__dev.locations.desert.debugTeleport(27, 20);
      });
      await talkB();
      await tap('.dialog .btn >> text=Коллекция окаменелостей', 400);
      await closeAll();
      s = await state();
      expect(
        s.storage.fossil_box === 1 &&
          !s.finds.fossil_shell &&
          s.finds.fossil_bone === 2 &&
          s.stickers.includes('x_fossils'),
        'коллекция окаменелостей',
        [s.storage, s.finds],
      );
      // окаменелости берёт рынок (кошелёк торговца — общий)
      const sold = await ev(() => {
        const F = window.__dev.F,
          g = F.sellable().find((q) => q.id === 'fossil_bone');
        if (!g) return null;
        const m0 = window.__dev.G.state.money;
        F.sellGoods(g, 2);
        return {
          sell: g.sell,
          got: window.__dev.G.state.money - m0,
          left: window.__dev.G.state.finds.fossil_bone || 0,
        };
      });
      expect(sold && sold.sell === 75 && sold.got === 150 && !sold.left, 'косточки на рынке', sold);
      await unwatch();
    },
  );

  await step('пустыня: «Раскопки» у Бархана — до конца, находка и приз за первые две игры дня', async () => {
    await toDesert(27, 20);
    await ev(() =>
      window.__dev.actions.mutate((s) => (s.quests.camel_bell = { day: s.day, n: {}, got: {}, done: s.day })),
    );
    const s0 = await state();
    await talkB();
    await tap('.dialog .btn >> text=Раскопки', 1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /Води/.test(intro) &&
        /Найди/.test(intro) &&
        (await ev(() => document.querySelectorAll('#mg .dg-col img').length)) === 3 &&
        /Приз Бархана/.test(intro),
      'правило картинкой',
      intro,
    );
    await mgGo();
    // бот водит «мышкой» с зажатой кнопкой по клеткам окаменелости
    const info = await ev(() => {
      const c = document.querySelector('#mg canvas'),
        r = c.getBoundingClientRect(),
        q = c.__dig();
      return { left: r.left, top: r.top, cells: q.cells, fossil: q.fossil, box: q.box };
    });
    expect(info.cells.length > 20, 'окаменелость не нарисована', info.cells.length);
    const xs = info.cells.map((c) => c[0]),
      ys = info.cells.map((c) => c[1]);
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    for (let pass = 0; pass < 3; pass++) {
      if (await ev(() => document.querySelector('#mg canvas') && document.querySelector('#mg canvas').__dig().found))
        break;
      await page.mouse.move(info.left + x0, info.top + y0);
      await page.mouse.down();
      for (let y = y0 + pass * 4; y <= y1 + 4; y += 12) {
        await page.mouse.move(info.left + x1, info.top + y, { steps: 6 });
        await page.mouse.move(info.left + x0, info.top + y + 6, { steps: 6 });
      }
      await page.mouse.up();
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 40000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/нашла/.test(end) && /⭐/.test(end), 'итог игры', end);
    await mgDone();
    const s1 = await state();
    const got = ['fossil_shell', 'fossil_leaf', 'fossil_tooth', 'fossil_bone'].reduce(
      (a, id) => a + (s1.finds[id] || 0) - (s0.finds[id] || 0),
      0,
    );
    const stars = s1.best.dig;
    expect(
      s1.plays.dig === 1 &&
        stars >= 2 &&
        s1.dayFlags.desert.digs === 1 &&
        got === 1 &&
        (s1.finds[info.fossil] || 0) === (s0.finds[info.fossil] || 0) + 1,
      'игра записана, находка выдана',
      [s1.plays, s1.best, s1.dayFlags.desert, got, info.fossil],
    );
    expect(s1.money === s0.money + [40, 80, 120][stars - 1], 'приз Бархана', s1.money - s0.money);
    // вторая — с призом (на заставке «ещё 1 раскопка»); закрыли крестиком сразу — ничего
    await ev(() => {
      window.__dev.F.digGame();
    });
    await page.waitForSelector(MG_START);
    expect(
      /ещё 1 раскопка/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'на заставке — сколько раскопок с призом',
    );
    await mgClose();
    expect((await state()).money === s1.money, 'закрыли игру — а приз пришёл');
    // две раскопки уже были — третья для удовольствия
    await ev(() => window.__dev.actions.setDayFlag('digs', 2, 'desert'));
    await ev(() => {
      window.__dev.F.digGame();
    });
    await page.waitForSelector(MG_START);
    expect(
      /для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'третья раскопка — без находки',
    );
    await mgClose();
    await closeAll();
  });

  await step('пустыня: загадка пирамиды «Пары» — до конца, сокровище раз в день, наклейка', async () => {
    await toDesert(8, 11);
    const s0 = await state();
    await L.run('desert:pairs', 1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /пары/.test(intro) &&
        (await ev(() => document.querySelectorAll('#mg .pr-col').length)) === 3 &&
        /Сокровище пирамиды/.test(intro),
      'правило картинкой',
      intro,
    );
    await mgGo();
    // бот знает, где какая табличка, и открывает пары без промахов
    const deck = await ev(() => document.querySelector('#mg .pr-grid').__pairs().deck);
    expect(deck.length === 12, 'табличек не 12', deck);
    // на узком телефоне — 3 × 4 (карточки крупнее), на компьютере и iPad — 4 × 3
    const lay = await ev(() => ({
      w: innerWidth,
      cols: getComputedStyle(document.querySelector('#mg .pr-grid')).gridTemplateColumns.split(' ').length,
      card: document.querySelector('#mg .pr-card').getBoundingClientRect().width,
    }));
    expect(lay.cols === (lay.w <= 560 ? 3 : 4) && lay.card >= 90, 'сетка табличек', lay);
    const seen = new Set();
    for (let i = 0; i < deck.length; i++) {
      if (seen.has(i)) continue;
      const j = deck.findIndex((v, k) => k !== i && v === deck[i]);
      seen.add(i);
      seen.add(j);
      await page.click(`#mg .pr-card >> nth=${i}`);
      await wait(120);
      await page.click(`#mg .pr-card >> nth=${j}`);
      await wait(250);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 10000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Все пары найдены/.test(end) && /без единого промаха/.test(end), 'итог загадки', end);
    await mgDone();
    let s = await state();
    expect(
      s.plays.pairs === 1 &&
        s.best.pairs === 3 &&
        s.money === s0.money + 150 &&
        s.dayFlags.desert.pairs === 1 &&
        s.stickers.includes('x_pyramid'),
      'сокровище и наклейка',
      [s.plays, s.best, s.money - s0.money, s.dayFlags.desert],
    );
    // промах: две разные таблички закрываются снова
    await ev(() => {
      window.__dev.F.pairsGame();
    });
    await page.waitForSelector(MG_START);
    expect(
      /для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'второй раз за день — без сокровища',
    );
    await mgGo();
    const d2 = await ev(() => document.querySelector('#mg .pr-grid').__pairs().deck);
    const j = d2.findIndex((v) => v !== d2[0]);
    await page.click('#mg .pr-card >> nth=0');
    await wait(100);
    await page.click(`#mg .pr-card >> nth=${j}`);
    await until(
      () => {
        const q = document.querySelector('#mg .pr-grid').__pairs();
        return q.miss === 1 && !q.open.length && !document.querySelectorAll('#mg .pr-card.open').length;
      },
      undefined,
      { timeout: 4000 },
    ).catch(() => {});
    const q = await ev(() => ({
      ...document.querySelector('#mg .pr-grid').__pairs(),
      shown: document.querySelectorAll('#mg .pr-card.open').length,
    }));
    expect(q.miss === 1 && !q.open.length && !q.done.length && !q.shown, 'промах не закрылся', q);
    await mgClose();
    s = await state();
    expect(s.money === s0.money + 150, 'второй раз — снова сокровище');
    await closeAll();
  });

  await step('пустыня: верблюд Финик — прогулка по кругу, наклейка, «Слезть»', async () => {
    await toDesert(29, 20);
    await watch();
    await L.run('desert:camel', 400);
    // сначала Бархан спрашивает, куда ехать (этап 16, Д10) — «По кругу»
    await tap('.dialog .btn >> text=По кругу', 400);
    const r = await ev(() => {
      const sc = window.__dev.locations.desert,
        camel = sc.map.objs.find((o) => o.type === 'camel');
      return {
        ride: !!(sc.p.ride && sc.p.ride.camel),
        away: camel.away(),
        hud: document.querySelector('#hud').textContent,
      };
    });
    expect(r.ride && r.away && /Слезть/.test(r.hud), 'не сели на верблюда', r);
    const p0 = await where();
    await wait(1200);
    const p1 = await where();
    expect(!near(p0, p1, 10), 'верблюд стоит на месте', [p0, p1]);
    // круг до конца: слезла, наклейка
    await until(
      () => !window.__dev.locations.desert.p.ride && window.__dev.G.state.stickers.includes('x_camel'),
      undefined,
      { timeout: 15000 },
    ).catch(() => {});
    await frames(2);
    const s = await state();
    const after = await ev(() => {
      const sc = window.__dev.locations.desert;
      return { ride: !!sc.p.ride, x: sc.p.x, y: sc.p.y };
    });
    expect(
      !after.ride && s.stickers.includes('x_camel') && near(after, { x: 29.5 * T, y: 19.6 * T }, 30),
      'прогулка не закончилась',
      [after, s.stickers],
    );
    // ещё раз — и слезть кнопкой
    await ev(() => {
      window.__dev.run({ do: 'desert', arg: 'camel', to: 'ring' });
    });
    await page.click('.hud-btns.left .rbtn >> text=Слезть');
    await until(() => !window.__dev.locations.desert.p.ride, undefined, { timeout: 2000 }).catch(() => {});
    expect(!(await ev(() => !!window.__dev.locations.desert.p.ride)), 'не слезли с верблюда');
    await unwatch();
  });

  await step('пустыня: задание Бархана «Бубенчик верблюда» — от взятия до сдачи, только действия', async () => {
    await toDesert(27, 20);
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        delete s.quests.camel_bell;
        s.clothes = s.clothes.filter((id) => id !== 'scarf_nomad');
      }),
    );
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('camel_bell'));
    expect((await ev(() => window.__dev.QuestState.questBadge('barkhan'))) === '!', 'над Барханом нет «!»');
    await L.run('nomad', 500);
    expect(/бубенчик/.test(await dialogText()), 'Бархан не предлагает задание', await dialogText());
    await tap('.dialog .btn.green', 400);
    await tap('.dialog .btn.green', 400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    const tg = await ev(() => window.__dev.locations.desert.target());
    expect(tg && Math.abs(tg.x - 11.5 * 48) < 30, 'звёздочка не ведёт к бубенчику', tg);
    // нажатие на бубенчик у колодца
    await ev(() => window.__dev.locations.desert.debugTeleport(13, 33));
    await frames(3);
    const k = await ev(() => window.__dev.locations.desert.debugScreen(11.5 * 48, 32.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Бубенчик нашёлся', { timeout: 6000 });
    await closeAll();
    w = await now();
    expect(w.i === 1, 'бубенчик не найден', w);
    // прокатиться на Финике (событие прогулки — сама прогулка проверена шагом выше)
    await ev(() => window.__dev.emit('desert', { what: 'ride' }));
    await frames(2);
    w = await now();
    expect(
      w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('barkhan'))) === '?',
      'после прогулки — к Бархану «?»',
      w,
    );
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.desert.debugTeleport(27, 20);
      window.__dev.run('nomad');
    });
    await L.untilDialog();
    await tap('.dialog .btn.green', 500);
    await tap('.dialog .btn.green', 1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Друг каравана/.test(t) && /Платок кочевника/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.camel_bell.done === s.day &&
        s.money === s0.money + 600 &&
        s.stickers.includes('q_nomad') &&
        s.clothes.includes('scarf_nomad'),
      'награда за задание Бархана',
      [s.quests.camel_bell, s.money - s0.money],
    );
    await ev(() => window.__dev.actions.wear('head', 'scarf_nomad'));
    expect((await state()).look.outfit.head === 'scarf_nomad', 'платок не надевается');
  });

  await step(
    'пустыня: сохранение и загрузка в пустыне; караван в город и за шлагбаум; «Домой» из пустыни',
    async () => {
      await fresh(); // своя новая игра: не опираться на дом и место, оставленные прошлыми шагами
      await toDesert(22, 28);
      await wait(300);
      const raw = await ev(() => {
        window.dispatchEvent(new Event('pagehide'));
        return localStorage.getItem('rhr-save-v1');
      });
      const pos = JSON.parse(raw).pos;
      expect(pos.scene === 'desert', 'позиция в сохранении', pos);
      await ev((raw) => {
        window.__dev.G.state = null;
        localStorage.setItem('rhr-save-v1', raw);
      }, raw);
      await page.reload();
      await page.waitForSelector(sel('continue'));
      await L.cont();
      await closeAll();
      let r = await where();
      expect(r.scene === 'desert' && near(r, pos, 30), 'после загрузки — в пустыне на том же месте', [r, pos]);
      // в город — с остановки каравана (дверь здания stop)
      await ev(() => {
        const sc = window.__dev.locations.desert;
        sc.enterBuilding(sc.map.bById.stop);
      });
      await L.until(() => window.__dev.sceneName === 'world' && !document.querySelector('.fade'), undefined, {
        timeout: 9000,
      }).catch(() => {});
      await frames(2);
      r = await where();
      expect(
        r.scene === 'world' && near(r, { x: 91.5 * T, y: 26.4 * T }, 40),
        'караван привёз не к остановке в городе',
        r,
      );
      // за открытый шлагбаум пешком — тоже караван
      await ev(() => window.__dev.World.walkTo(95.5 * 48, 26.5 * 48, true));
      await until(() => !!document.querySelector('.caravan-ride'), undefined, { timeout: 5000 }).catch(() => {});
      expect(await ev(() => !!document.querySelector('.caravan-ride')), 'за шлагбаумом нет каравана');
      await untilArrive('desert').catch(() => {});
      expect((await where()).scene === 'desert', 'за шлагбаумом — не пустыня', await where());
      // «Домой» — на виллу
      await page.click('.hud-btns.left .rbtn:last-child');
      await page.click('.panel-foot .btn.green');
      await untilScene('villa').catch(() => {});
      expect(
        (await ev(() => window.__dev.sceneName)) === 'villa',
        'кнопка «Домой» из пустыни',
        await ev(() => window.__dev.sceneName),
      );
    },
  );
};

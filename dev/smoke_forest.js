// Шаги автотеста про лес (П.9): закрытый лес — окно Мяты, открытый — вход через ворота и выход обратно; карта леса,
// всё важное достижимо пешком от ворот; сбор раз в день и по сезону (растения, шишки, еловые веточки); улей, белка,
// костёр, домик на дереве, венок; «Грибная охота» до конца с наградой; задание Шишкина «Потерянный бельчонок»
// от взятия до сдачи; сохранение и загрузка в лесу; «Домой» из леса. Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:лес
const lib = require('./lib.js');

module.exports = async function forest(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, closeAll, until, untilScene, untilPanel, frames, go, sel, T, norm, expect, near, state, dialogText, panelText, toasts, clearToasts, where, watch, unwatch, MG_START, tap, mgDone, mgClose } = L;
  /** Новая игра с чистого листа. */
  const fresh = () => L.fresh(); // 1 июня, без вводной цепочки
  /** День (номер — месяц × 3), полдень, солнце; в лес (открыв его действием openLand). */
  const toForest = (day = 18, minutes = 12 * 60, tx = 10, ty = 36) =>
    ev(
      ([day, minutes, tx, ty]) => {
        const d = window.__dev;
        if (!d.QuestState.landOpen('forest')) d.actions.openLand('forest');
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
        });
        d.go('forest');
        d.locations.forest.debugTeleport(tx, ty);
      },
      [day, minutes, tx, ty],
    );
  /** Поговорить с Шишкиным; если он предлагает задание — «Потом» (дальше обычный разговор). */
  const talkShishkin = async () => {
    await L.run('forester', 500);
    if (
      await ev(
        () => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent),
      )
    ) {
      await tap('.dialog >> text=Потом', 500);
    }
  };
  await step('лес: закрыт — окно Мяты; открыт — через ворота в лес и по тропе обратно в город', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.World.debugTeleport(2, 4);
      d.World.walkTo(1.5 * 48, 0.5 * 48, true);
    });
    await L.untilIdle(4000).catch(() => {}); // дошла до ворот (закрыты — стоит у них)
    let r = await where();
    expect(r.scene === 'world' && r.y > 3 * T, 'закрытый лес: прошли за ворота', r);
    // окно у ворот (нажатие на сами ворота проверяет шаг «переход между локациями»; на телефоне их закрывает HUD)
    await L.run('way:forest', 900);
    expect(
      /Тропа в лес заросла/.test(await panelText()) && /Мята/.test(await panelText()),
      'окно у закрытых ворот',
      await panelText(),
    );
    await closeAll();
    // открыли (так его откроет задание Мяты) — ворота открыты, тропа ведёт в лес, ко входу gate
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.World.debugTeleport(2, 4);
      d.World.walkTo(1.5 * 48, 0.5 * 48, true);
    });
    await L.untilArrive('forest', 5000).catch(() => {});
    await frames(2);
    r = await where();
    expect(r.scene === 'forest' && near(r, { x: 10.5 * T, y: 37.5 * T }), 'вход в лес через ворота', r);
    const saved = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).pos);
    expect(saved.scene === 'forest', 'позиция в сохранении после входа', saved);
    // нажатие на ворота (действие way:forest) — тоже в лес
    await go('world');
    await L.run('way:forest', 400);
    expect((await where()).scene === 'forest', 'way:forest у открытого леса');
    // на клетке выхода в момент входа выход не срабатывает
    await ev(() => window.__dev.go('forest', { at: [10.5, 39.5] }));
    await untilScene('forest');
    await wait(300); // выход не сработал — проверяем, что сцена не сменилась
    expect((await where()).scene === 'forest', 'выход сработал сразу при входе на его клетку');
    // обратно — по тропе к южной кромке: в город, за ворота виллы
    await ev(() => {
      const sc = window.__dev.locations.forest;
      sc.debugTeleport(10, 36);
      sc.walkTo(10.5 * 48, 39.5 * 48, true);
    });
    await L.untilArrive('world', 5000).catch(() => {});
    await frames(2);
    r = await where();
    expect(r.scene === 'world' && near(r, { x: 2 * T, y: 1.5 * T }), 'выход из леса в город', r);
    await wait(300); // не затянуло обратно — проверяем, что сцена не сменилась
    expect((await where()).scene === 'world', 'после возвращения затянуло обратно в лес');
    // карта города: лес без замочка; кнопка ведёт к тропе
    await ev(() => {
      window.__dev.F.openMap();
    });
    await untilPanel();
    const lands = await ev(() =>
      [...document.querySelectorAll('.overlay .land')].map((b) => [b.textContent, b.classList.contains('open')]),
    );
    expect(lands[0][1] && !lands[0][0].includes('🔒'), 'лес на карте города всё ещё с замочком', lands);
    await closeAll();
  });

  await step(
    'лес: всё важное достижимо пешком, растения как в FOREST_GATHER, карта, спрайты во все сезоны',
    async () => {
      await toForest();
      const r = await ev(async () => {
        const d = window.__dev,
          sc = d.locations.forest,
          m = sc.map,
          P = d.Plants,
          out = [];
        const D = await import('/js/data/index.js');
        const from = [10, 37];
        const reach = (tx, ty) => m.foot(tx, ty) && !!m.path(m.foot, from[0], from[1], tx, ty);
        const reachNear = (tx, ty) =>
          [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ].some(([dx, dy]) => reach(tx + dx, ty + dy));
        // особые места, здания, житель, находки, растения, выход
        for (const pl of sc.places)
          if (pl.stand && !reach(Math.floor(pl.stand[0]), Math.floor(pl.stand[1]))) out.push('место ' + pl.id);
        for (const b of m.buildings) {
          const dp = m.doorPx(b);
          if (!reach(Math.floor(dp.x / 48), Math.floor(dp.y / 48))) out.push('дверь ' + b.id);
          if (!b.act) out.push('без действия: ' + b.id);
        }
        for (const n of sc.npcs) if (!reachNear(Math.floor(n.x / 48), Math.floor(n.y / 48))) out.push('житель ' + n.id);
        for (const pk of sc.pickups) if (!reach(pk.tx, pk.ty)) out.push('находка ' + pk.id);
        const plants = m.objs.filter((o) => P.PLANTS[o.type]);
        const cnt = {};
        for (const o of plants) {
          const id = P.PLANTS[o.type].gives;
          cnt[id] = (cnt[id] || 0) + 1;
          if (!reachNear(o.tx, o.ty)) out.push(`растение ${o.type} (${o.tx}, ${o.ty})`);
        }
        for (const [id, q] of Object.entries(D.FOREST_GATHER))
          if (cnt[id] !== q.max) out.push(`${id}: в лесу ${cnt[id]}, в таблице ${q.max}`);
        if (!reach(10, 39)) out.push('выход');
        // ручей: пешком не зайти, по мостику — можно
        const brook = [];
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.at(x, y) === 'brook') brook.push([x, y]);
        if (!brook.length || brook.some(([x, y]) => m.foot(x, y))) out.push('в ручей можно зайти');
        if (!reach(37, 22)) out.push('за мостик не пройти');
        return { out, pickups: sc.pickups.length, mapPlaces: sc.mapPlaces().map((q) => q[1]) };
      });
      expect(!r.out.length, 'в лесу не всё достижимо', r.out);
      expect(r.pickups === 6, 'шишек летом должно быть 6', r.pickups);
      // кусты замедляют, как в городе
      const slow = await ev(() => {
        const m = window.__dev.locations.forest.map;
        return (
          m.objs.some((o) => o.type === 'bush') && m.objs.some((o) => o.type === 'hazelBush' && m.slowAt(o.x, o.y))
        );
      });
      expect(slow, 'кусты в лесу не замедляют');
      // окно карты: «Карта леса» и кнопки «дойти»; по кнопке — идём
      await ev(() => {
        window.__dev.F.openMap();
      });
      await untilPanel();
      const t = await panelText();
      expect(
        /Карта леса/.test(t) &&
          /Улей/.test(t) &&
          /Белка/.test(t) &&
          /Тропа в город/.test(t) &&
          /Избушка лесника/.test(t),
        'карта леса',
        t,
      );
      await tap('.overlay .opt >> text=Костёр', 400);
      expect(await ev(() => window.__dev.locations.forest.p.path.length > 0), 'по кнопке карты не пошли');
      // спрайты во все сезоны, днём и ночью: всё помещается в рамки
      for (const day of [0, 9, 18, 27])
        for (const min of [720, 1380]) {
          await ev(
            ([day, min]) => {
              const d = window.__dev;
              d.actions.mutate((s) => {
                s.day = day;
                s.minutes = min;
              });
              for (const [x, y] of [
                [10, 33],
                [24, 22],
                [42, 16],
                [43, 28],
                [13, 12],
                [44, 7],
                [28, 7],
                [34, 22],
              ])
                d.locations.forest.debugTeleport(x, y);
            },
            [day, min],
          );
          for (const [x, y] of [
            [10, 33],
            [24, 22],
            [42, 16],
            [43, 28],
            [13, 12],
            [44, 7],
            [28, 7],
            [34, 22],
            [40, 33],
          ]) {
            await ev(([x, y]) => window.__dev.locations.forest.debugTeleport(x, y), [x, y]);
            await wait(60);
          }
        }
      const clipped = await ev(() => window.__dev.locations.forest.debugSprites().clipped);
      expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    },
  );

  await step('лес: сбор раз в день и по сезону — растения, шишки, зимой еловые веточки', async () => {
    await toForest(18);
    await watch();
    const r = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.forest,
        P = d.Plants,
        s = d.G.state,
        out = [];
      const D = await import('/js/data/index.js');
      const plants = sc.map.objs.filter((o) => P.PLANTS[o.type]);
      const types = [...new Set(plants.map((o) => o.type))];
      for (const type of types) {
        const o = plants.find((q) => q.type === type),
          id = P.PLANTS[type].gives,
          n = D.FOREST_GATHER[id].n;
        const inM = [...Array(12).keys()].find((mo) => D.pickIn(id, mo)),
          offM = [...Array(12).keys()].find((mo) => !D.pickIn(id, mo));
        // не в сезон — ничего
        d.actions.mutate((st) => {
          st.day = offM * 3;
          st.dayFlags = {};
        });
        const a0 = s.ing[id] || 0;
        if (P.hasFruit(o) || P.gather(sc, o) || (s.ing[id] || 0) !== a0) out.push(type + ': собрали не в сезон');
        // в сезон — n штук, второй раз — ничего, завтра — снова
        d.actions.mutate((st) => {
          st.day = inM * 3;
          st.dayFlags = {};
        });
        if (!P.hasFruit(o)) out.push(type + ': в сезон нет плодов');
        P.gather(sc, o);
        if ((s.ing[id] || 0) !== a0 + n) out.push(`${type}: собрано ${(s.ing[id] || 0) - a0}, а должно ${n}`);
        if (P.gather(sc, o) || (s.ing[id] || 0) !== a0 + n) out.push(type + ': дважды за день');
        if (!s.dayFlags.plants || !s.dayFlags.plants[`forest:${o.tx}_${o.ty}`])
          out.push(type + ': отметка дня без имени леса');
        d.actions.nextDay();
        if (!P.hasFruit(o)) out.push(type + ': наутро не выросло');
      }
      // ещё: грибов осенью больше, чем летом (летом — только белые)
      const ripeCount = (mo) =>
        plants.filter((o) => D.ripeIn(P.PLANTS[o.type].gives, mo)).filter((o) => /mush|porc/.test(o.type)).length;
      if (!(ripeCount(9) > ripeCount(6) && ripeCount(6) > 0))
        out.push(`грибов летом ${ripeCount(6)}, осенью ${ripeCount(9)}`);
      return { out, types };
    });
    expect(!r.out.length, 'сбор в лесу', r.out);
    expect(r.types.length === 6, 'в лесу шесть видов растений (с яблоней)', r.types);
    // шишки: подбираются на ходу, раз в день; зимой — ещё еловые веточки
    await toForest(18, 720, 13, 31);
    await ev(() => window.__dev.locations.forest.walkTo(13.5 * 48, 30.5 * 48, true));
    await until(() => window.__dev.G.state.finds.cone === 1, undefined, { timeout: 3000 }).catch(() => {});
    let s = await state();
    expect(s.finds.cone === 1, 'шишка не подобралась', s.finds);
    await ev(() => {
      const sc = window.__dev.locations.forest;
      sc.debugTeleport(13, 31);
      sc.walkTo(13.5 * 48, 30.5 * 48, true);
    });
    await L.untilIdle(3000).catch(() => {}); // прошла по месту шишки ещё раз
    expect((await state()).finds.cone === 1, 'шишка дважды за день');
    await toForest(0, 720, 16, 31);
    const tw = await ev(() => window.__dev.locations.forest.pickups.map((p) => p.id));
    expect(tw.length === 10 && tw.includes('twig0'), 'зимой — 6 шишек и 4 еловые веточки', tw);
    await ev(() => window.__dev.locations.forest.walkTo(16.5 * 48, 30.5 * 48, true));
    await wait(900);
    s = await state();
    expect(s.finds.fir_twig === 1, 'еловая веточка не подобралась', s.finds);
    await unwatch();
  });

  await step('лес: улей, белка, костёр, домик на дереве, венок — только действия', async () => {
    await toForest(3, 720, 42, 16); // зима: пчёлы спят
    await watch();
    await clearToasts();
    const h0 = (await state()).ing.honey || 0;
    await L.run('forest:hive', 300);
    expect(/спят/.test(await toasts()) && ((await state()).ing.honey || 0) === h0, 'улей зимой', await toasts());
    await toForest(18, 720, 42, 16); // лето
    await L.run('forest:hive', 300);
    await L.run('forest:hive', 300);
    let s = await state();
    expect(s.ing.honey === h0 + 1 && /уже собран/.test(await toasts()), 'улей летом — баночка раз в день', [
      s.ing.honey,
      await toasts(),
    ]);
    // белка: 3 орешка → золотая шишка (раз в день), 4 шишки → орешек
    const b0 = await state();
    await ev(() => {
      const a = window.__dev.actions;
      a.addItem('ing', 'nuts', 6);
      a.addItem('finds', 'cone', 4);
      window.__dev.locations.forest.debugTeleport(43, 28);
      window.__dev.run('forest:squirrel');
    });
    await untilPanel();
    expect(/Рыжик/.test(await panelText()), 'окно белки', await panelText());
    await tap('.overlay .panel-foot .btn >> text=Золотая шишка', 500);
    await tap('.overlay .panel-foot .btn >> text=Золотая шишка', 500);
    await tap('.overlay .panel-foot .btn >> text=Орешек', 500);
    s = await state();
    expect(
      (s.storage.golden_cone || 0) === (b0.storage.golden_cone || 0) + 1 &&
        s.ing.nuts === (b0.ing.nuts || 0) + 6 - 3 + 1 &&
        (s.finds.cone || 0) === (b0.finds.cone || 0) &&
        s.stickers.includes('x_squirrel'),
      'обмен у белки',
      [s.storage, s.ing.nuts, s.finds],
    );
    await closeAll();
    // костёр: днём не горит, вечером — зефир → жареный зефир
    await ev(() => {
      window.__dev.actions.addItem('ing', 'marshmallow', 2);
      window.__dev.locations.forest.debugTeleport(24, 23);
    });
    await clearToasts();
    await L.run('forest:fire', 300);
    const m0 = (await state()).ing.marshmallow;
    expect(/вечером/.test(await toasts()) && m0 >= 2, 'костёр днём', await toasts());
    await ev(() => window.__dev.actions.mutate((st) => (st.minutes = 20 * 60)));
    await L.run('forest:fire', 500);
    await tap('.overlay .panel-foot .btn >> text=В рюкзак', 300);
    s = await state();
    expect(
      s.ing.marshmallow === m0 - 1 && s.dishes.toasted_marshmallow >= 1 && s.stickers.includes('x_marshmallow'),
      'зефир у костра',
      [s.ing, s.dishes],
    );
    // домик на дереве: окно с видом (нарисован холст)
    await L.run('forest:treehouse', 500);
    expect(
      /Домик на дереве/.test(await panelText()) && (await ev(() => !!document.querySelector('.overlay canvas'))),
      'домик на дереве',
      await panelText(),
    );
    await closeAll();
    // нажатие на улей в мире: хомячок подходит, действие срабатывает (уже собрано — подсказка)
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((st) => (st.minutes = 12 * 60));
      d.locations.forest.debugTeleport(40, 16);
    });
    await frames(3);
    await clearToasts();
    const h = await ev(() => window.__dev.locations.forest.debugScreen(42.5 * 48, 14.5 * 48 - 20));
    await page.mouse.click(h.x, h.y);
    await until(() => /мёд уже собран/.test(document.querySelector('#toasts').textContent), undefined, { timeout: 5000 }).catch(() => {});
    expect(/мёд уже собран/.test(await toasts()), 'нажатие на улей', await toasts());
    // венок у Шишкина из 4 еловых веточек
    await ev(() => {
      window.__dev.actions.addItem('finds', 'fir_twig', 4);
    });
    await talkShishkin();
    await tap('.dialog >> text=Сплести венок', 400);
    s = await state();
    expect(s.storage.fir_wreath >= 1 && (s.finds.fir_twig || 0) < 4, 'венок', [s.storage, s.finds]);
    await closeAll();
    await unwatch();
  });

  await step('лес: «Грибная охота» у Шишкина — до конца, награда за первые две игры дня', async () => {
    await toForest(18, 720, 9, 33);
    const s0 = await state();
    await talkShishkin();
    await tap('.dialog >> text=Грибная охота', 1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /Можно/.test(intro) &&
        /Нельзя/.test(intro) &&
        (await ev(() => document.querySelectorAll('#mg .mh-col img').length)) === 5,
      'правило «можно / нельзя»',
      intro,
    );
    await ev(() => window.__dev.fastGames(true)); // Т3: те же 40 с охоты — вчетверо быстрее (core/dev.js)
    await page.click(MG_START);
    const t0 = Date.now();
    let clicks = 0;
    while (Date.now() - t0 < 44000) {
      const list = await ev(() => {
        const c = document.querySelector('#mg canvas');
        return c && c.__mh ? c.__mh() : null;
      });
      if (!list) break;
      const g = list.find((q) => q.good);
      if (g) {
        const r = await ev(() => {
          const b = document.querySelector('#mg canvas').getBoundingClientRect();
          return { x: b.left, y: b.top };
        });
        await page.mouse.click(r.x + g.x, r.y + g.y);
        clicks++;
      }
      if (await ev(() => /Ура!/.test(document.querySelector('#mg').textContent))) break;
      await wait(55);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 8000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/В корзинке/.test(end) && /Награда/.test(end), 'итог охоты', end);
    await mgDone();
    await ev(() => window.__dev.fastGames(false));
    const s1 = await state();
    expect(clicks > 5 && s1.plays.mushrooms === 1 && s1.dayFlags.forest.hunts === 1, 'охота записана', [
      clicks,
      s1.plays,
      s1.dayFlags.forest,
    ]);
    expect(
      s1.money > s0.money &&
        (s1.ing.mushroom || 0) > (s0.ing.mushroom || 0) &&
        (s1.ing.porcini || 0) > (s0.ing.porcini || 0),
      'награда за охоту',
      [s1.money - s0.money, s1.ing],
    );
    // вторая и третья игра: за вторую — награда, третья — для удовольствия (закрыли крестиком сразу — ничего)
    await ev(() => {
      window.__dev.F.mushroomHunt();
    });
    await page.waitForSelector(MG_START);
    expect(
      /ещё 1 охота/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'на заставке — сколько охот с наградой осталось',
    );
    await mgClose();
    expect((await state()).money === s1.money, 'закрыли игру — а награда пришла');
    await closeAll();
  });

  await step('лес: задание Шишкина «Потерянный бельчонок» — от взятия до сдачи, только действия', async () => {
    await fresh();
    await toForest(27, 720, 9, 33);
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('squirrel_kit'));
    expect((await ev(() => window.__dev.QuestState.questBadge('shishkin'))) === '!', 'над Шишкиным нет «!»');
    await L.run('forester', 500);
    expect(/бельчонок/.test(await dialogText()), 'Шишкин не предлагает задание', await dialogText());
    await tap('.dialog .btn.green', 400);
    await tap('.dialog .btn.green', 400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    // журнал: «найди его в лесу» не нужно (взято), шаги видны; звёздочка — к бельчонку
    const tg = await ev(() => window.__dev.locations.forest.target());
    expect(tg && Math.abs(tg.x - 29.5 * 48) < 30, 'звёздочка не ведёт к бельчонку', tg);
    // нашли бельчонка: нажатие на него в траве
    await ev(() => window.__dev.locations.forest.debugTeleport(29, 8));
    await frames(3);
    const k = await ev(() => window.__dev.locations.forest.debugScreen(29.5 * 48, 5.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Бельчонок нашёлся', { timeout: 6000 });
    await closeAll();
    w = await now();
    expect(w.i === 1, 'бельчонок не найден', w);
    // маме-белке
    await ev(() => {
      window.__dev.locations.forest.debugTeleport(43, 28);
      window.__dev.run('forest:squirrel');
    });
    await untilPanel();
    await tap('.overlay .panel-foot .btn >> text=Вернуть бельчонка', 500);
    await closeAll();
    w = await now();
    expect(w.i === 2, 'бельчонок не дома', w);
    // орешки — с лещины (осень)
    await ev(() => {
      const d = window.__dev,
        sc = d.locations.forest;
      for (const o of sc.map.objs.filter((q) => q.type === 'hazelBush').slice(0, 2)) d.Plants.gather(sc, o);
    });
    await frames(2);
    w = await now();
    expect(
      w.i === 3 && (await ev(() => window.__dev.QuestState.questBadge('shishkin'))) === '?',
      'после орешков — к Шишкину «?»',
      w,
    );
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.forest.debugTeleport(9, 33);
      window.__dev.run('forester');
    });
    await L.untilDialog();
    await tap('.dialog .btn.green', 500);
    await tap('.dialog .btn.green', 1500);
    const t = await panelText();
    expect(
      /Задание выполнено/.test(t) && /Друг леса/.test(t) && /Лесной пирог/.test(t) && /Сени/.test(t),
      'праздничное окно',
      t,
    );
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.squirrel_kit.done === s.day &&
        s.money === s0.money + 600 &&
        s.stickers.includes('q_forest') &&
        s.recipes.includes('forest_pie') &&
        (s.ing.nuts || 0) === (s0.ing.nuts || 0) - 3,
      'награда за задание',
      [s.quests.squirrel_kit, s.money - s0.money, s.ing.nuts],
    );
    // станция канатной дороги — окно горы с замочком и подсказкой про Сеню
    await L.run('way:mountain', 400);
    expect(
      /Канатная дорога/.test(await panelText()) && /Сеня/.test(await panelText()),
      'станция канатной дороги',
      await panelText(),
    );
    await closeAll();
  });

  await step('лес: сохранение и загрузка в лесу; «Домой» из леса', async () => {
    await fresh(); // своя новая игра: не опираться на дом и место, оставленные прошлыми шагами
    await toForest(18, 720, 24, 24);
    await untilScene('forest');
    await frames(2);
    // уходим со страницы — игра записывает позицию (как при закрытии вкладки)
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const pos = JSON.parse(raw).pos;
    expect(pos.scene === 'forest' && near(pos, { x: 24.5 * T, y: 24.5 * T }), 'позиция в сохранении', pos);
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await page.waitForSelector(sel('continue'));
    await L.cont();
    await closeAll();
    const r = await where();
    expect(
      r.scene === 'forest' && near(r, { x: 24.5 * T, y: 24.5 * T }, 30),
      'после загрузки — в лесу на том же месте',
      r,
    );
    // «Домой» — на виллу
    await page.click('.hud-btns.left .rbtn:last-child');
    await page.click('.panel-foot .btn.green');
    await untilScene('villa').catch(() => {});
    expect(
      (await ev(() => window.__dev.sceneName)) === 'villa',
      'кнопка «Домой» из леса',
      await ev(() => window.__dev.sceneName),
    );
  });
};

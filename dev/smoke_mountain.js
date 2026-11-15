// Шаги автотеста про гору (П.9): задание Сени «На вершину!» от взятия до сдачи (и без тёплых вещей — шапка
// в подарок назавтра; тёплое в продаже есть в любой день года), канатная дорога закрыта / открыта, вход и выход;
// всё важное достижимо пешком, карта горы, спрайты во все сезоны; горячий источник, эдельвейсы, смотровая
// площадка, снеговик, рамка с эдельвейсами, вход в пещеры; «Спуск на санках» до конца с призом; задание
// Вершинкина «Потерянная варежка»; сохранение и загрузка на горе, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:гора
module.exports = async function mountain({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const toasts = async () =>
    norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const where = () =>
    ev(() => {
      const d = window.__dev,
        sc = d.locations[d.sceneName];
      return { scene: d.sceneName, x: sc ? sc.p.x : null, y: sc ? sc.p.y : null };
    });
  const near = (a, b, r = 20) => Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
  /** Новая игра с чистого листа. */
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  /** День (номер — месяц × 3), полдень, солнце; на гору (открыв лес и гору действием openLand). */
  const toMountain = async (day = 18, minutes = 12 * 60, tx = 20, ty = 38) => {
    await closeAll();
    await ev(
      ([day, minutes, tx, ty]) => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
        });
        d.go('mountain');
        d.locations.mountain.debugTeleport(tx, ty);
      },
      [day, minutes, tx, ty],
    );
  };
  /** Поговорить с Вершинкиным; если он предлагает задание — «Потом» (дальше обычный разговор). */
  const talkV = async () => {
    await ev(() => {
      window.__dev.run('instructor');
    });
    await wait(500);
    if (await ev(() => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent))) {
      await page.click('.dialog .btn >> text=Потом');
      await wait(450);
    }
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchMountain = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchMountain());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };

  await step('гора: задание Сени «На вершину!» — канатная дорога закрыта, без тёплых вещей, сдача, гора открыта', async () => {
    await fresh();
    // тёплое в продаже есть в любой день двух игровых лет (кофты в ТЦ «Модный» — круглый год)
    const noWarm = await ev(async () => {
      const D = await import('/js/data/index.js');
      const out = [];
      for (let day = 0; day < 72; day++)
        if (!D.CLOTHES.some((c) => D.isWarmItem(c) && ['mall', 'boutique'].includes(c.shop) && D.wareOn(c, day)))
          out.push(day);
      return out;
    });
    expect(!noWarm.length, 'есть дни, когда тёплого в магазинах нет', noWarm);
    // лес открыт, гора — нет: станция с замочком, окно — про Сеню
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.actions.mutate((s) => (s.dayFlags = {}));
      d.go('forest');
      d.locations.forest.debugTeleport(44, 6);
    });
    await wait(300);
    expect(
      (await ev(() => window.__dev.locations.forest.map.bById.station.signText())) === '🔒 На гору',
      'табличка станции закрытой горы',
    );
    await ev(() => {
      window.__dev.run('way:mountain');
    });
    await wait(500);
    expect(/Канатная дорога/.test(await panelText()) && /Сеня/.test(await panelText()), 'окно у закрытой станции', await panelText());
    await closeAll();
    expect((await where()).scene === 'forest', 'закрытая станция увезла на гору');
    // без тёплых вещей в шкафу (так бывает в старых сохранениях)
    await watch();
    await ev(async () => {
      const D = await import('/js/data/index.js'),
        d = window.__dev;
      const warm = D.CLOTHES.filter((c) => D.isWarmItem(c)).map((c) => c.id);
      d.actions.mutate((s) => {
        s.clothes = s.clothes.filter((id) => !warm.includes(id));
        for (const k of Object.keys(s.look.outfit)) if (warm.includes(s.look.outfit[k])) s.look.outfit[k] = null;
        s.best.swim = 0;
      });
      d.go('world');
    });
    await wait(300);
    expect(!(await ev(() => window.__dev.F.ownsWarm())), 'тёплые вещи не убраны');
    const now = () => ev(() => window.__dev.QuestState.questNow('summit'));
    expect((await ev(() => window.__dev.QuestState.questBadge('senya'))) === '!', 'над Сеней нет «!»');
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await wait(500);
    expect(/канатная дорога/.test(await dialogText()), 'Сеня не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0 && !w.steps[1].ok, 'задание не взято', w);
    // звёздочка — к бассейну
    const tg = await ev(() => {
      const d = window.__dev;
      return { t: d.World.target(), door: d.World.doorOf('pool') };
    });
    expect(tg.t && Math.abs(tg.t.x - tg.door.x) < 3, 'звёздочка не у бассейна', tg);
    // заплыв на 3★ (событие мини-игры — как после настоящего заплыва)
    await ev(() => window.__dev.emit('minigame', { id: 'swim', stars: 3 }));
    await wait(300);
    w = await now();
    expect(w.i === 1, 'золото в бассейне не засчитано', w);
    // как дела? — тёплого нет: где купить; в тот же день — та же подсказка, назавтра — шапка в подарок
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await wait(500);
    expect(/ТЦ «Модный»/.test(await dialogText()), 'Сеня не подсказал, где купить тёплое', await dialogText());
    await closeAll();
    await ev(() => window.__dev.actions.nextDay());
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 12 * 60)));
    await clearToasts();
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await wait(500);
    expect(/запасную шапку/.test(await dialogText()), 'Сеня не подарил шапку', await dialogText());
    await closeAll();
    let s = await state();
    expect(s.clothes.includes('beanie_blue'), 'шапки нет в шкафу', s.clothes);
    // надели — «?» над Сеней; сдаём
    await ev(() => window.__dev.actions.wear('head', 'beanie_blue'));
    await wait(300);
    w = await now();
    expect(w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('senya'))) === '?', 'надела шапку — а «?» нет', w);
    const s0 = await state();
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Покоритель вершин/.test(t) && /Гора открыт/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    s = await state();
    expect(
      s.quests.summit.done === s.day && Number.isFinite(s.lands.mountain) && s.money === s0.money + 700 && s.stickers.includes('q_summit'),
      'награда за задание Сени',
      [s.quests.summit, s.lands, s.money - s0.money],
    );
    // рекорд в бассейне уже был — первый шаг засчитывается сразу, как взяли задание (поле already)
    await ev(() => window.__dev.actions.mutate((st) => (st.best.swim = 3)));
    await ev(() => window.__dev.actions.mutate((st) => delete st.quests.summit));
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(400);
    await closeAll();
    expect((await now()).i >= 1, 'рекорд 3★ не засчитан сразу', await now());
    // станция в лесу открыта: вагончик везёт на гору, ко входу station
    await ev(() => {
      const d = window.__dev;
      d.go('forest');
      d.locations.forest.debugTeleport(44, 6);
    });
    await wait(300);
    expect((await ev(() => window.__dev.locations.forest.map.bById.station.signText())) === '🚡 На гору', 'табличка открытой станции');
    await ev(() => {
      window.__dev.run('way:mountain');
    });
    await wait(900);
    expect(await ev(() => !!document.querySelector('.cable-ride canvas')), 'нет картинки переезда');
    await wait(2600);
    const r = await where();
    const door = await ev(() => window.__dev.locations.mountain.doorOf('station'));
    expect(r.scene === 'mountain' && near(r, door, 30), 'приехали не на станцию горы', [r, door]);
    const saved = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).pos);
    expect(saved.scene === 'mountain', 'позиция в сохранении после переезда', saved);
  });

  await step('гора: всё важное достижимо пешком, карта горы, спрайты и земля во все сезоны', async () => {
    await toMountain();
    const r = await ev(() => {
      const d = window.__dev,
        sc = d.locations.mountain,
        m = sc.map,
        out = [];
      const from = [20, 42];
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
      for (const pl of sc.places)
        if (pl.stand && !reach(Math.floor(pl.stand[0]), Math.floor(pl.stand[1]))) out.push('место ' + pl.id);
      for (const b of m.buildings) {
        const dp = m.doorPx(b);
        if (!reach(Math.floor(dp.x / 48), Math.floor(dp.y / 48))) out.push('дверь ' + b.id);
        if (!b.act) out.push('без действия: ' + b.id);
      }
      for (const n of sc.npcs) if (!reachNear(Math.floor(n.x / 48), Math.floor(n.y / 48))) out.push('житель ' + n.id);
      for (const id of ['pasture', 'waterfall']) {
        const p = sc.spot(id);
        if (!reachNear(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('точка ' + id);
      }
      // ручей — пешком не зайти, источник — тоже (в него окунаются через особое место)
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) if (['brook', 'hotSpring'].includes(m.at(x, y)) && m.foot(x, y)) out.push(`вода (${x}, ${y})`);
      // на вершине снег в любой сезон; ниже — трава
      if (m.at(20, 6) !== 'snowCap' && m.at(20, 6) !== 'snowPath') out.push('на вершине нет снега: ' + m.at(20, 6));
      if (m.at(8, 36) !== 'g') out.push('на лугах не трава: ' + m.at(8, 36));
      return { out, mapPlaces: sc.mapPlaces().map((q) => q[1]) };
    });
    expect(!r.out.length, 'на горе не всё достижимо', r.out);
    await ev(() => {
      window.__dev.F.openMap();
    });
    await wait(500);
    const t = await panelText();
    expect(
      /Карта горы/.test(t) && /Горячий источник/.test(t) && /Смотровая площадка/.test(t) && /Шале Вершинкина/.test(t) && /Вход в пещеры/.test(t),
      'карта горы',
      t,
    );
    await page.click('.overlay .opt >> text=Горячий источник');
    await wait(400);
    expect(await ev(() => window.__dev.locations.mountain.p.path.length > 0), 'по кнопке карты не пошли');
    await closeAll();
    const spots = [
      [20, 38],
      [12, 33],
      [5, 29],
      [29, 33],
      [27, 22],
      [31, 15],
      [15, 18],
      [9, 10],
      [20, 5],
      [29, 7],
    ];
    for (const day of [0, 9, 18, 27])
      for (const min of [720, 1380])
        for (const [x, y] of spots) {
          await ev(
            ([day, min, x, y]) => {
              const d = window.__dev;
              d.actions.mutate((s) => {
                s.day = day;
                s.minutes = min;
              });
              d.locations.mountain.debugTeleport(x, y);
            },
            [day, min, x, y],
          );
          await wait(50);
        }
    const clipped = await ev(() => window.__dev.locations.mountain.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    const g = await ev(() => window.__dev.locations.mountain.debugGround());
    expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
  });

  await step('гора: источник, эдельвейсы, смотровая площадка, снеговик, рамка, пещеры, мороз — только действия', async () => {
    await toMountain(3, 720, 7, 29); // зима
    await watch();
    // горячий источник: снимает «мороз» за день, хомячок сидит в воде; нажатие — вылезти
    await ev(() => window.__dev.actions.setDayFlag('cold', 1, 'careless'));
    await clearToasts();
    await ev(() => {
      window.__dev.run('mountain:spring', { scene: window.__dev.locations.mountain });
    });
    await wait(400);
    let s = await state();
    expect(
      !s.dayFlags.careless.cold && s.stickers.includes('x_spring') && (await ev(() => !!window.__dev.locations.mountain.p.ride)),
      'источник: мороз не снят или хомячок не в воде',
      [s.dayFlags, s.stickers],
    );
    expect(/согрелись|мороза как не бывало/.test(await toasts()), 'источник: подсказка', await toasts());
    const hud = await ev(() => document.querySelector('#hud').textContent);
    expect(/Вылезти/.test(hud), 'нет кнопки «Вылезти»', hud);
    await page.mouse.click(300, 300);
    await wait(300);
    expect(await ev(() => !window.__dev.locations.mountain.p.ride), 'нажатие не вытащило из источника');
    // простуженная: источник не лечит — добрая фраза
    await ev(() => window.__dev.actions.fallSick('cold'));
    await clearToasts();
    await ev(() => {
      window.__dev.run('mountain:spring', { scene: window.__dev.locations.mountain });
    });
    await wait(300);
    expect(/не лечит/.test(await toasts()) && (await state()).sick, 'источник у простуженной', await toasts());
    await ev(() => {
      window.__dev.actions.recoverSick('doctor');
      window.__dev.locations.mountain.interact();
    });
    // на вершине мороз круглый год, на летнем лугу — нет
    const cold = await ev(() => {
      const d = window.__dev,
        sc = d.locations.mountain;
      d.actions.mutate((st) => (st.day = 18));
      sc.debugTeleport(20, 6);
      const top = sc.cold();
      sc.debugTeleport(14, 33);
      return [top, sc.cold()];
    });
    expect(cold[0] === true && cold[1] === false, 'мороз на вершине летом', cold);
    // эдельвейсы: зимой — нет, летом — один в день
    await ev(() => window.__dev.actions.mutate((st) => (st.day = 3)));
    await clearToasts();
    await ev(() => {
      window.__dev.run('mountain:edelweiss');
    });
    await wait(200);
    expect(!(await state()).finds.edelweiss && /летом/.test(await toasts()), 'эдельвейс зимой', await toasts());
    await ev(() => window.__dev.actions.mutate((st) => (st.day = 18)));
    expect(await ev(() => window.__dev.locations.mountain.places.find((p) => p.id === 'edelweiss0').when()), 'летом эдельвейса нет');
    await ev(() => {
      window.__dev.run('mountain:edelweiss');
      window.__dev.run('mountain:edelweiss');
    });
    await wait(200);
    s = await state();
    expect(s.finds.edelweiss === 1, 'эдельвейс — один в день', s.finds);
    expect(!(await ev(() => window.__dev.locations.mountain.places.find((p) => p.id === 'edelweiss0').when())), 'сорванный эдельвейс всё ещё виден');
    // рамка у Вершинкина из трёх эдельвейсов
    await ev(() => window.__dev.actions.addItem('finds', 'edelweiss', 2));
    await ev(() => window.__dev.locations.mountain.debugTeleport(27, 22));
    await talkV();
    await page.click('.dialog .btn >> text=Эдельвейсы в рамке');
    await wait(400);
    s = await state();
    expect(s.storage.edelweiss_frame === 1 && !s.finds.edelweiss && s.stickers.includes('x_edelweiss'), 'рамка с эдельвейсами', [s.storage, s.finds]);
    await closeAll();
    // смотровая площадка: окно с видом, наклейка
    await ev(() => {
      window.__dev.run('mountain:view');
    });
    await wait(500);
    expect(/Смотровая площадка/.test(await panelText()) && (await ev(() => !!document.querySelector('.overlay canvas'))), 'смотровая площадка');
    await closeAll();
    expect((await state()).stickers.includes('x_summit'), 'наклейка «На вершине мира»');
    // снеговик: 3 кома × 4 раза, ведро, морковка из рюкзака (нет — морковка у Вершинкина)
    await ev(() => {
      const d = window.__dev;
      d.actions.addItem('ing', 'carrot', -(d.G.state.ing.carrot || 0));
      d.locations.mountain.debugTeleport(8, 11);
      d.run('mountain:snowman');
    });
    await wait(400);
    for (let i = 0; i < 13; i++) {
      await page.click('.overlay .snow-step');
      await wait(60);
    }
    s = await state();
    expect(s.dayFlags.mountain.snowman === 4, 'снеговик: комы и ведро', s.dayFlags.mountain);
    await page.click('.overlay .snow-step');
    await wait(300);
    expect((await state()).dayFlags.mountain.snowman === 4 && /Вершинкин/.test(await toasts()), 'нос без морковки', await toasts());
    await closeAll();
    await talkV();
    await page.click('.dialog .btn >> text=Морковку для снеговика');
    await wait(300);
    await closeAll();
    expect((await state()).ing.carrot === 1, 'Вершинкин не дал морковку');
    await ev(() => {
      window.__dev.run('mountain:snowman');
    });
    await wait(400);
    await page.click('.overlay .snow-step');
    await wait(300);
    s = await state();
    expect(s.dayFlags.mountain.snowman === 5 && !s.ing.carrot && s.stickers.includes('x_snowman'), 'снеговик готов', [s.dayFlags.mountain, s.ing.carrot]);
    await closeAll();
    // вход в пещеры: окно с замочком и Профессором Орешкиным
    await ev(() => {
      window.__dev.run('way:caves');
    });
    await wait(400);
    expect(/Пещеры/.test(await panelText()) && /Орешкин/.test(await panelText()), 'вход в пещеры', await panelText());
    await closeAll();
    await unwatch();
    // назавтра снеговика нет
    await ev(() => window.__dev.actions.nextDay());
    expect(!(await state()).dayFlags.mountain, 'снеговик остался на завтра');
  });

  await step('гора: «Спуск на санках» у Вершинкина — до конца, приз за первые две игры дня', async () => {
    await toMountain(18, 720, 27, 22);
    const s0 = await state();
    await talkV();
    await page.click('.dialog .btn >> text=Спуск на санках');
    await wait(1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /Собирай/.test(intro) && /Объезжай/.test(intro) && (await ev(() => document.querySelectorAll('#mg .sl-col img').length)) === 5 && /Приз Вершинкина/.test(intro),
      'правило картинкой',
      intro,
    );
    await page.click('#mg >> text=Начать!');
    const t0 = Date.now();
    let moves = 0;
    while (Date.now() - t0 < 52000) {
      const st = await ev(() => {
        const c = document.querySelector('#mg canvas');
        return c && c.__sled ? c.__sled() : null;
      });
      if (!st) break;
      const ahead = st.items.filter((q) => q.y < st.y && q.y > st.y - 360);
      const good = ahead.filter((q) => q.good).sort((a, b) => b.y - a.y)[0];
      let target = good ? good.x : st.x;
      const bad = ahead.filter((q) => !q.good && q.y > st.y - 200 && Math.abs(q.x - target) < 0.12);
      if (bad.length) target = bad[0].x > 0.5 ? bad[0].x - 0.2 : bad[0].x + 0.2;
      const r = await ev(() => {
        const b = document.querySelector('#mg canvas').getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      });
      await page.mouse.move(r.x + (st.x0 + target * st.lw) * (r.w / st.w), r.y + r.h * 0.8);
      moves++;
      if (await ev(() => /Ура!/.test(document.querySelector('#mg').textContent))) break;
      await wait(90);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 8000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/На счету/.test(end) && /Приз/.test(end), 'итог спуска', end);
    await page.click('#mg >> text=Ура!');
    await wait(500);
    const s1 = await state();
    expect(moves > 10 && s1.plays.sled === 1 && s1.dayFlags.mountain.sleds === 1 && s1.money > s0.money, 'спуск записан, приз выдан', [
      moves,
      s1.plays,
      s1.dayFlags.mountain,
      s1.money - s0.money,
    ]);
    // вторая игра — с призом (на заставке «ещё 1 спуск»); закрыли крестиком сразу — ничего
    await ev(() => {
      window.__dev.F.sledRide();
    });
    await wait(900);
    expect(/ещё 1 спуск/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'на заставке — сколько спусков с призом');
    await page.click('#mg .xbtn');
    await wait(400);
    expect((await state()).money === s1.money, 'закрыли игру — а приз пришёл');
    await closeAll();
  });

  await step('гора: задание Вершинкина «Потерянная варежка» — от взятия до сдачи, только действия', async () => {
    await toMountain(18, 720, 27, 22);
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        delete s.quests.lost_mitten;
        s.clothes = s.clothes.filter((id) => id !== 'goggles_ski');
      }),
    );
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('lost_mitten'));
    expect((await ev(() => window.__dev.QuestState.questBadge('vershinkin'))) === '!', 'над Вершинкиным нет «!»');
    await ev(() => {
      window.__dev.run('instructor');
    });
    await wait(500);
    expect(/варежку/.test(await dialogText()), 'Вершинкин не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    const tg = await ev(() => window.__dev.locations.mountain.target());
    expect(tg && Math.abs(tg.x - 23.5 * 48) < 30, 'звёздочка не ведёт к варежке', tg);
    // нажатие на варежку на вершине
    await ev(() => window.__dev.locations.mountain.debugTeleport(23, 6));
    await wait(500);
    const k = await ev(() => window.__dev.locations.mountain.debugScreen(23.5 * 48, 4.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Варежка нашлась', { timeout: 6000 });
    await closeAll();
    w = await now();
    expect(w.i === 1, 'варежка не найдена', w);
    // спуск на санках (событие мини-игры — сама игра проверена шагом выше)
    await ev(() => window.__dev.emit('minigame', { id: 'sled', stars: 1 }));
    await wait(300);
    w = await now();
    expect(w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('vershinkin'))) === '?', 'после спуска — к Вершинкину «?»', w);
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.mountain.debugTeleport(27, 22);
      window.__dev.run('instructor');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Друг гор/.test(t) && /Лыжные очки/.test(t) && /Орешкин/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.lost_mitten.done === s.day && s.money === s0.money + 600 && s.stickers.includes('q_mountain') && s.clothes.includes('goggles_ski'),
      'награда за задание Вершинкина',
      [s.quests.lost_mitten, s.money - s0.money],
    );
    // лыжные очки надеваются (аксессуар на лбу)
    await ev(() => window.__dev.actions.wear('acc', 'goggles_ski'));
    expect((await state()).look.outfit.acc === 'goggles_ski', 'лыжные очки не надеваются');
  });

  await step('гора: сохранение и загрузка на горе; канатная дорога вниз; «Домой» с горы', async () => {
    await toMountain(18, 720, 20, 30);
    await wait(300);
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const pos = JSON.parse(raw).pos;
    expect(pos.scene === 'mountain', 'позиция в сохранении', pos);
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(800);
    await closeAll();
    let r = await where();
    expect(r.scene === 'mountain' && near(r, pos, 30), 'после загрузки — на горе на том же месте', [r, pos]);
    // вниз: дверь станции — вагончик в лес, к станции
    await ev(() => window.__dev.locations.mountain.walkToPlace('station'));
    await wait(9000);
    r = await where();
    const door = await ev(() => window.__dev.locations.forest.doorOf('station'));
    expect(r.scene === 'forest' && near(r, door, 30), 'вниз на канатной дороге — к станции в лесу', [r, door]);
    // «Домой» — на виллу
    await ev(() => window.__dev.go('mountain'));
    await wait(400);
    await page.click('.hud-btns.left .rbtn:last-child');
    await wait(450);
    await page.click('.panel-foot .btn.green');
    await wait(800);
    expect((await ev(() => window.__dev.sceneName)) === 'villa', 'кнопка «Домой» с горы', await ev(() => window.__dev.sceneName));
  });
};

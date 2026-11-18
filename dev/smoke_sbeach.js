// Шаги автотеста про секретный пляж (П.9): задание Зефирки «Карта сокровищ Зефирки» от взятия до сдачи (подводный
// грот закрыт — окно про Зефирку; чайка в подзорной трубе на башне, сундучок у затонувшего корабля на дне, бутылка на
// Звёздном острове — три кусочка и собранная карта), заплыв через грот туда и обратно; всё достижимо пешком, карта
// пляжа, спрайты, тёплая вода, вода светится ночью; Жемчужинка, ракушки (сколько в день, рамка, рынок), черепашата
// вечером, клад; «Замок из песка» до конца с призом; задание Жемчужинки «Замок для русалочки»; сохранение и загрузка
// на пляже, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:секретный пляж"
const { MG_START } = require('./selectors.js'); // кнопка «Начать!» мини-игры — по метке, а не по тексту
module.exports = async function sbeach({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
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
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.oldStart()); // как до этапа 10: 1 января, без вводной цепочки (начало игры — dev/smoke_start.js)
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  /** На секретный пляж (открыв лес и пляж действием openLand); день 18 — лето. */
  const toCove = async (tx = 14, ty = 12, minutes = 12 * 60, day = 18) => {
    await closeAll();
    await ev(
      ([tx, ty, minutes, day]) => {
        const d = window.__dev;
        for (const id of ['forest', 'cove']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          s.flags.coveHint = 1;
        });
        d.go('cove');
        d.locations.cove.debugTeleport(tx, ty);
      },
      [tx, ty, minutes, day],
    );
    await wait(300);
  };
  /** Поговорить с Жемчужинкой; если она предлагает задание — «Потом». */
  const talkP = async () => {
    await ev(() => {
      window.__dev.run('mermaid');
    });
    await wait(500);
    if (await ev(() => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent))) {
      await page.click('.dialog .btn >> text=Потом');
      await wait(450);
    }
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchCove = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchCove());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  const now = (id) => ev((id) => window.__dev.QuestState.questNow(id), id);

  await step('секретный пляж: задание Зефирки — грот закрыт, три кусочка карты (труба, дно, остров), сдача, заплыв через грот', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.actions.mutate((s) => {
        s.dayFlags = {};
        s.minutes = 12 * 60;
        s.day = 18;
      });
      d.go('world');
      d.World.debugTeleport(89, 76);
    });
    await wait(400);
    // буёк-ракушка: нырнуть — окно с замочком про Зефирку; хомячок остался в городе
    expect(/Зефирка/.test(await toasts()), 'у буйка нет подсказки', await toasts());
    await ev(() => window.__dev.World.dive());
    await wait(500);
    let t = await panelText();
    expect(/Секретный пляж/.test(t) && /Зефирк/.test(t), 'окно у закрытого грота', t);
    await closeAll();
    expect((await where()).scene === 'world', 'закрытый грот увёл с моря');
    await watch();
    expect((await ev(() => window.__dev.QuestState.questBadge('zefirka'))) === '!', 'над Зефиркой нет «!»');
    await ev(() => {
      window.__dev.run('npc:zefirka');
    });
    await wait(500);
    expect(/карт/.test(await dialogText()), 'Зефирка не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now('treasure_map');
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    // звёздочка — к Хомяк-Тауэру
    const tg = await ev(() => window.__dev.World.target());
    const door = await ev(() => window.__dev.World.doorOf('tower'));
    expect(tg && Math.abs(tg.x - door.x) < 40, 'звёздочка не у башни', [tg, door]);
    // (а) подзорная труба на море: чайка с кусочком — нажать
    await ev(() => {
      window.__dev.go('tower');
      window.__dev.Tower.openSeaScope();
    });
    await wait(600);
    expect(/чайка/.test(await panelText()), 'в трубе нет чайки', await panelText());
    const gull = await ev(() => {
      const c = document.querySelector('.overlay .panel canvas'),
        r = c.getBoundingClientRect(),
        G = window.__dev.Tower.GULL;
      return { x: r.left + ((G[0] + 6) / 320) * r.width, y: r.top + ((G[1] - 10) / 320) * r.height };
    });
    await page.mouse.click(gull.x, gull.y);
    await wait(700);
    t = await panelText();
    expect(/Кусочек карты/.test(t) && /1 из 3/.test(t) && (await ev(() => !!document.querySelector('img.treasure-map'))), 'кусочек у чайки', t);
    await closeAll();
    w = await now('treasure_map');
    expect(w.steps[0].ok, 'кусочек у чайки не засчитан', w);
    // в трубе чайки больше нет
    await ev(() => window.__dev.Tower.openSeaScope());
    await wait(400);
    expect(!/чайка/.test(await panelText()), 'чайка не улетела');
    await closeAll();
    // (б) нырнуть — сундучок у затонувшего корабля
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.World.debugTeleport(29, 63);
      d.World.dive();
    });
    await wait(600);
    const chest = await ev(() => window.__dev.scenes.dive.debugMapChest());
    expect((await ev(() => window.__dev.sceneName)) === 'dive' && chest.on, 'на дне нет сундучка', chest);
    await ev((c) => window.__dev.scenes.dive.debugSwim(c.x + 30, c.y - 30), chest);
    await wait(800);
    t = await panelText();
    expect(/Кусочек карты/.test(t) && /2 из 3/.test(t), 'кусочек в сундучке', t);
    await closeAll();
    expect(!(await ev(() => window.__dev.scenes.dive.debugMapChest().on)), 'сундучок не пропал');
    // (в) бутылка под пальмой на Звёздном острове
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.World.debugTeleport(12, 80);
    });
    await wait(500);
    const k = await ev(() => window.__dev.World.debugScreen(11.5 * 48, 78.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Карта сложилась', { timeout: 6000 });
    t = await panelText();
    expect(/Все три кусочка/.test(t), 'карта не сложилась', t);
    await closeAll();
    w = await now('treasure_map');
    expect(w.i === 3 && (await ev(() => window.__dev.QuestState.questBadge('zefirka'))) === '?', 'после трёх кусочков — к Зефирке «?»', w);
    // сдать
    const s0 = await state();
    await ev(() => {
      window.__dev.run('npc:zefirka');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    t = await panelText();
    expect(/Задание выполнено/.test(t) && /Охотница за сокровищами/.test(t) && /Секретный пляж открыт/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    let s = await state();
    expect(
      s.quests.treasure_map.done === s.day && Number.isFinite(s.lands.cove) && s.money === s0.money + 700 && s.stickers.includes('q_cove'),
      'награда за задание Зефирки',
      [s.quests.treasure_map, s.lands, s.money - s0.money],
    );
    // грот открыт: у буйка нырнуть — заплыв картинкой на секретный пляж (на кораблике — кораблик ждёт у буйка)
    await ev(() => {
      const d = window.__dev,
        g = d.World.grottoAt();
      d.actions.patchState('boat', { x: g.x - 30, y: g.y + 20, on: true });
      d.go('world', { pos: { scene: 'world', x: g.x - 30, y: g.y + 20 } });
    });
    await wait(400);
    expect(await ev(() => window.__dev.World.isBoating()), 'не на кораблике');
    await ev(() => window.__dev.World.dive());
    await wait(1200);
    expect(await ev(() => !!document.querySelector('.grotto-ride canvas')), 'нет картинки заплыва');
    await wait(2600);
    const r = await where();
    expect(r.scene === 'cove' && near(r, { x: 6.5 * T, y: 5.7 * T }, 30), 'приплыли не к гроту на пляже', r);
    s = await state();
    expect(s.pos.scene === 'cove' && !s.boat.on && s.stickers.includes('x_grotto'), 'позиция, кораблик у буйка, наклейка грота', [s.pos, s.boat, s.stickers.slice(-3)]);
  });

  await step('секретный пляж: всё достижимо пешком, карта, спрайты, тёплая вода, ночью вода светится', async () => {
    await toCove();
    const r = await ev(() => {
      const d = window.__dev,
        sc = d.locations.cove,
        m = sc.map,
        out = [];
      const from = [6, 5];
      const reach = (tx, ty) => m.foot(tx, ty) && !!m.path(m.foot, from[0], from[1], tx, ty);
      const reachNear = (tx, ty) =>
        [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => reach(tx + dx, ty + dy));
      for (const pl of sc.places) if (pl.stand && !reach(Math.floor(pl.stand[0]), Math.floor(pl.stand[1]))) out.push('место ' + pl.id);
      for (const n of sc.npcs) if (!reachNear(Math.floor(n.x / 48), Math.floor(n.y / 48))) out.push('житель ' + n.id);
      const rock = sc.spot('rock');
      if (!reachNear(Math.floor(rock.x / 48), Math.floor(rock.y / 48))) out.push('камень Жемчужинки');
      for (const pk of sc.pickups) if (!reach(pk.tx, pk.ty)) out.push('ракушка ' + pk.id);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const k = m.at(x, y);
          if ((k === 'crock' || k === 'copen' || k === 'cgrotto') && m.foot(x, y)) out.push(`${k} проходим (${x}, ${y})`);
          if ((x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1) && m.foot(x, y)) out.push(`край карты проходим (${x}, ${y})`);
        }
      // житель на камне не гуляет
      const n = sc.npcs[0];
      return { out, pearl: [n.x, n.y] };
    });
    expect(!r.out.length, 'на пляже не всё достижимо', r.out);
    await wait(3000);
    const p2 = await ev(() => [window.__dev.locations.cove.npcs[0].x, window.__dev.locations.cove.npcs[0].y]);
    expect(p2[0] === r.pearl[0] && p2[1] === r.pearl[1], 'Жемчужинка ушла с камня', [r.pearl, p2]);
    await ev(() => {
      window.__dev.F.openMap();
    });
    await wait(500);
    const t = await panelText();
    expect(
      /Карта секретного пляжа/.test(t) && /Грот/.test(t) && /Замок из песка/.test(t) && /Гнездо черепашат/.test(t) && /Клад/.test(t) && /Камень Жемчужинки/.test(t),
      'карта пляжа',
      t,
    );
    await page.click('.overlay .opt >> text=Замок из песка');
    await wait(400);
    expect(await ev(() => window.__dev.locations.cove.p.path.length > 0), 'по кнопке карты не пошли');
    await closeAll();
    for (const minutes of [12 * 60, 6 * 60, 23 * 60])
      for (const [x, y] of [
        [6, 6],
        [14, 12],
        [22, 10],
        [19, 15],
        [9, 18],
        [24, 19],
        [5, 15],
      ]) {
        await ev(
          ([x, y, minutes]) => {
            window.__dev.actions.mutate((s) => (s.minutes = minutes));
            window.__dev.locations.cove.debugTeleport(x, y);
          },
          [x, y, minutes],
        );
        await wait(80);
      }
    const clipped = await ev(() => window.__dev.locations.cove.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    const g = await ev(() => window.__dev.locations.cove.debugGround());
    expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
    // зимой в бухте тепло: плавать — не «ледяное море»; сухо в городской дождь
    await clearToasts();
    const wx = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.cove;
      d.actions.mutate((s) => {
        s.day = 0;
        s.minutes = 12 * 60;
        s.weather = 'rain';
        s.dayFlags = {};
        s.sick = null;
        s.immuneUntil = 0;
      });
      return { dry: sc.dry(), cold: sc.cold(), layer: (sc.weather || []).length };
    });
    await wait(800);
    await closeAll(); // новый сезон — окно «Пришла зима»
    await ev(() => {
      const sc = window.__dev.locations.cove;
      sc.debugTeleport(9, 15);
      sc.walkTo(9.5 * 48, 19.5 * 48, true);
    });
    await wait(2500);
    let s = await state();
    expect(await ev(() => ['clag', 'cdeep'].includes(window.__dev.locations.cove.p.surf)), 'зимой не зашли в воду');
    expect(wx.dry && wx.cold === false && !wx.layer && !(s.dayFlags.careless && s.dayFlags.careless.sea), 'тёплая вода и погода в бухте', [wx, s.dayFlags]);
    // ночью: вошла в воду — светится (наклейка)
    await ev(() =>
      window.__dev.actions.mutate((st) => {
        st.day = 18;
        st.minutes = 23 * 60;
      }),
    );
    await wait(800);
    await closeAll(); // снова лето — окно смены сезона
    await ev(() => {
      const d = window.__dev,
        sc = d.locations.cove;
      d.actions.mutate((st) => {
        st.day = 18;
        st.minutes = 23 * 60;
        st.weather = 'sun';
        st.stickers = st.stickers.filter((id) => id !== 'x_glow');
      });
      sc.debugTeleport(14, 15);
      window.__glowWalk = [sc.walkTo(14.5 * 48, 19.5 * 48, true), d.G.modal];
    });
    await wait(3500);
    s = await state();
    const dbg = await ev(async () => {
      const sc = window.__dev.locations.cove,
        st = await import('/js/core/state.js');
      return [sc.p.x / 48, sc.p.y / 48, sc.p.surf, st.darkness(), window.__dev.sceneName, !!document.querySelector('.overlay'), window.__glowWalk];
    });
    expect(s.stickers.includes('x_glow') && /Светящееся море|светится/.test(await toasts()), 'вода не засветилась', [s.stickers.slice(-3), await toasts(), dbg]);
  });

  await step('секретный пляж: Жемчужинка, ракушки (сколько в день, рамка, рынок), черепашата вечером, клад — только действия', async () => {
    await toCove(19, 15);
    await watch();
    expect((await ev(() => window.__dev.QuestState.questBadge('pearl'))) === '!', 'над Жемчужинкой нет «!»');
    await talkP();
    expect((await dialogText()).length > 5, 'Жемчужинка молчит', await dialogText());
    await closeAll();
    // ракушки: летом две, осенью одна; подобрать — в рюкзак, второй раз за день — нет
    const per = await ev(async () => {
      const C = await import('/js/locations/cove.js'),
        d = window.__dev;
      const summer = C.shellsToday().length;
      d.actions.mutate((s) => (s.day = 30));
      const autumn = C.shellsToday().length;
      d.actions.mutate((s) => (s.day = 18));
      return { summer, autumn, here: d.locations.cove.pickups.map((p) => [p.tx, p.ty, p.give[1]]) };
    });
    expect(per.summer === 2 && per.autumn === 1 && per.here.length === 2, 'ракушек в день', per);
    for (const [x, y] of per.here) {
      await ev(([x, y]) => window.__dev.locations.cove.debugTeleport(x, y), [x, y]);
      await wait(350);
    }
    let s = await state();
    const got = per.here.map((q) => q[2]);
    expect(got.every((id) => s.finds[id] >= 1) && Object.keys(s.dayFlags.finds || {}).length === 2, 'ракушки не подобраны', [s.finds, s.dayFlags.finds]);
    await ev(() => window.__dev.locations.cove.debugTeleport(14, 12));
    await wait(200);
    await ev(([x, y]) => window.__dev.locations.cove.debugTeleport(x, y), per.here[0]);
    await wait(350);
    const s2 = await state();
    expect(s2.finds[got[0]] === s.finds[got[0]], 'ракушку подобрали дважды за день');
    // ракушки в рамке у Жемчужинки — по одной каждого вида
    await ev(() => {
      const a = window.__dev.actions;
      for (const id of ['shell_pink', 'shell_spiral', 'shell_sun']) a.addItem('finds', id, 1);
      a.addItem('finds', 'shell_sun', 1);
      window.__dev.locations.cove.debugTeleport(19, 15);
    });
    await talkP();
    await page.click('.dialog .btn >> text=Ракушки в рамке');
    await wait(400);
    await closeAll();
    s = await state();
    expect(s.storage.shell_frame === 1 && s.stickers.includes('x_shells') && s.finds.shell_sun >= 1, 'ракушки в рамке', [s.storage, s.finds]);
    // рынок берёт ракушки
    const sold = await ev(() => {
      const F = window.__dev.F,
        g = F.sellable().find((q) => q.id === 'shell_sun');
      if (!g) return null;
      const m0 = window.__dev.G.state.money,
        n = window.__dev.G.state.finds.shell_sun;
      F.sellGoods(g, n);
      return { sell: g.sell, got: window.__dev.G.state.money - m0, n, left: window.__dev.G.state.finds.shell_sun || 0 };
    });
    expect(sold && sold.sell === 35 && sold.got === 35 * sold.n && !sold.left, 'ракушки на рынке', sold);
    // черепашата: днём спят; вечером вылупляются и ползут за хомячком в воду
    await clearToasts();
    await ev(() => {
      window.__dev.locations.cove.debugTeleport(9, 13);
      window.__dev.run('cove:nest');
    });
    await wait(300);
    expect(/спят/.test(await toasts()) && !(await ev(async () => (await import('/js/locations/cove.js')).debugTurtles().on)), 'днём черепашата вылупились', await toasts());
    await ev(() => {
      window.__dev.actions.mutate((st) => {
        st.minutes = 18 * 60;
        st.stickers = st.stickers.filter((id) => id !== 'x_turtles');
      });
      window.__dev.run('cove:nest');
    });
    await wait(300);
    const tu = await ev(async () => (await import('/js/locations/cove.js')).debugTurtles());
    expect(tu.on && tu.list.length === 5, 'черепашата не вылупились', tu);
    await ev(() => window.__dev.locations.cove.walkTo(9.5 * 48, 19.5 * 48, true));
    await wait(9000);
    s = await state();
    const tu2 = await ev(async () => (await import('/js/locations/cove.js')).debugTurtles());
    expect(!tu2.on && s.dayFlags.cove.turtles === 1 && s.stickers.includes('x_turtles'), 'черепашата не доплыли', [tu2, s.dayFlags.cove]);
    await clearToasts();
    await ev(() => window.__dev.run('cove:nest'));
    await wait(300);
    expect(/уже плавают/.test(await toasts()), 'второй раз за день', await toasts());
    // клад под крестиком — раз за игру
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.cove.debugTeleport(22, 10);
      window.__dev.run('cove:dig');
    });
    await page.waitForSelector('text=Клад секретного пляжа', { timeout: 5000 });
    await closeAll();
    s = await state();
    expect(
      s.flags.coveTreasure && s.storage.treasure_chest === 1 && s.money === s0.money + 800 && s.stickers.includes('x_cove_treasure'),
      'клад',
      [s.flags.coveTreasure, s.storage.treasure_chest, s.money - s0.money],
    );
    await ev(() => window.__dev.run('cove:dig'));
    await wait(400);
    expect((await state()).money === s.money && !(await ev(() => window.__dev.locations.cove.places.find((p) => p.id === 'treasure').when())), 'клад выкопали дважды');
    await unwatch();
  });

  await step('секретный пляж: «Замок из песка» — до конца, приз за первые две игры дня, правило картинкой', async () => {
    await toCove(15, 15);
    await ev(() => window.__dev.actions.mutate((s) => (s.quests.pearl_castle = { day: s.day, n: {}, got: {}, done: s.day })));
    const s0 = await state();
    await talkP();
    await page.click('.dialog .btn >> text=Построить замок');
    await wait(1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/образц/.test(intro) && (await ev(() => document.querySelectorAll('#mg .sc-col').length)) === 3 && /Приз Жемчужинки/.test(intro), 'правило картинкой', intro);
    await page.click(MG_START);
    await wait(400);
    const NAMES = { tower: 'Башня', wall: 'Стена', gate: 'Ворота', flag: 'Флажок', shell: 'Ракушка', star: 'Звёздочка' };
    // бот: ставит детали как на образце (свой замок — башни и флажки), сначала нижние, потом верхние
    for (let k = 0; k < 40; k++) {
      const q = await ev(() => document.querySelector('#mg canvas.sc-castle') && document.querySelector('#mg canvas.sc-castle').__castle());
      if (!q || q.phase === 'done') break;
      if (q.phase !== 'play') {
        await wait(300);
        continue;
      }
      for (const row of ['base', 'top']) {
        const c = await ev(() => document.querySelector('#mg canvas.sc-castle').__castle());
        for (const sl of c.slots) {
          if ((sl.j < 5) !== (row === 'base')) continue;
          const want = c.pattern ? c.pattern[sl.j] : sl.j < 5 ? 'tower' : 'flag';
          await page.click(`#mg .sc-piece >> text=${NAMES[want]}`);
          await page.mouse.click(sl.x, sl.y);
          await wait(60);
        }
      }
      await page.click('#mg .sc-done');
      await wait(1500);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 15000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Три замка готовы/.test(end) && /как на образце/.test(end), 'итог игры', end);
    await page.click('#mg >> text=Ура!');
    await wait(1500);
    const s1 = await state();
    expect(
      s1.plays.sandcastle === 1 && s1.best.sandcastle === 3 && s1.dayFlags.cove.castles === 1 && s1.stickers.includes('x_castle') && s1.money === s0.money + 120,
      'замок записан, приз',
      [s1.plays, s1.best, s1.dayFlags.cove, s1.money - s0.money],
    );
    // вторая — с призом; не та деталь — подсветка и ошибка; закрыли крестиком — ничего
    await ev(() => {
      window.__dev.F.castleGame();
    });
    await wait(900);
    expect(/ещё 1 замок/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'на заставке — сколько замков с призом');
    await page.click(MG_START);
    await wait(300);
    let c = await ev(() => document.querySelector('#mg canvas.sc-castle').__castle());
    for (const { j } of c.slots) {
      c = await ev(() => document.querySelector('#mg canvas.sc-castle').__castle()); // верхние места — над тем, что внизу
      const sl = c.slots.find((q) => q.j === j),
        want = c.pattern[sl.j],
        wrong = sl.j < 5 ? (want === 'wall' ? 'gate' : 'wall') : want === 'flag' ? 'star' : 'flag';
      await page.click(`#mg .sc-piece >> text=${NAMES[wrong]}`);
      await page.mouse.click(sl.x, sl.y);
      await wait(60);
    }
    // флажок вниз не встаёт
    await page.click('#mg .sc-piece >> text=Флажок');
    await page.mouse.click(c.slots[0].x, c.slots[0].y);
    await page.click('#mg .sc-done');
    await wait(400);
    const q = await ev(() => document.querySelector('#mg canvas.sc-castle').__castle());
    expect(q.miss === c.slots.length && q.round === 0 && q.phase === 'play', 'ошибки не засчитаны', q);
    await page.click('#mg .xbtn');
    await wait(400);
    expect((await state()).money === s1.money, 'закрыли игру — а приз пришёл');
    await ev(() => window.__dev.actions.setDayFlag('castles', 2, 'cove'));
    await ev(() => {
      window.__dev.F.castleGame();
    });
    await wait(900);
    expect(/для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'третья игра — без приза');
    await page.click('#mg .xbtn');
    await wait(300);
    await closeAll();
  });

  await step('секретный пляж: задание Жемчужинки «Замок для русалочки» — от взятия до сдачи, только действия', async () => {
    await toCove(19, 15);
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        delete s.quests.pearl_castle;
        s.clothes = s.clothes.filter((id) => id !== 'clip_shell');
        s.stickers = s.stickers.filter((id) => id !== 'x_turtles');
      }),
    );
    await watch();
    expect((await ev(() => window.__dev.QuestState.questBadge('pearl'))) === '!', 'над Жемчужинкой нет «!»');
    await ev(() => {
      window.__dev.run('mermaid');
    });
    await wait(500);
    expect(/черепаш/.test(await dialogText()), 'Жемчужинка не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now('pearl_castle');
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    const tg = await ev(() => window.__dev.locations.cove.target());
    expect(tg && Math.abs(tg.x - 9.5 * 48) < 40, 'звёздочка не ведёт к гнезду', tg);
    await ev(() => window.__dev.emit('cove', { what: 'turtles' }));
    await wait(300);
    w = await now('pearl_castle');
    expect(w.i === 1, 'черепашата не засчитаны', w);
    await ev(() => window.__dev.emit('minigame', { id: 'sandcastle', stars: 2 }));
    await wait(300);
    w = await now('pearl_castle');
    expect(w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('pearl'))) === '?', 'после замка — к Жемчужинке «?»', w);
    const s0 = await state();
    await ev(() => {
      window.__dev.run('mermaid');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Подружка русалочки/.test(t) && /Заколка-ракушка/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.pearl_castle.done === s.day && s.money === s0.money + 600 && s.stickers.includes('q_mermaid') && s.clothes.includes('clip_shell'),
      'награда за задание Жемчужинки',
      [s.quests.pearl_castle, s.money - s0.money],
    );
    await ev(() => window.__dev.actions.wear('head', 'clip_shell'));
    expect((await state()).look.outfit.head === 'clip_shell', 'заколка не надевается');
    // уже провожала черепашат — шаг засчитан сразу
    await ev(() => window.__dev.actions.mutate((st) => delete st.quests.pearl_castle));
    await ev(() => {
      window.__dev.run('mermaid');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(400);
    await closeAll();
    expect((await now('pearl_castle')).i === 1, 'черепашата «уже были» — не засчитаны сразу', await now('pearl_castle'));
  });

  await step('секретный пляж: сохранение и загрузка на пляже; грот обратно в город; «Домой»', async () => {
    await toCove(14, 12);
    await wait(300);
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const pos = JSON.parse(raw).pos;
    expect(pos.scene === 'cove', 'позиция в сохранении', pos);
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
    expect(r.scene === 'cove' && near(r, pos, 30), 'после загрузки — на пляже на том же месте', [r, pos]);
    // в город — войти в грот (нажатие на воду у арки, этап 13) и нырнуть в озерцо внутри
    await ev(() => window.__dev.locations.cove.debugTeleport(6, 6));
    await wait(400);
    const k = await ev(() => window.__dev.locations.cove.debugScreen(6.5 * 48, 4.5 * 48));
    await page.mouse.click(k.x, k.y);
    await wait(1800);
    expect((await ev(() => window.__dev.sceneName)) === 'grotto_cave', 'вода у арки не ведёт в грот', await ev(() => window.__dev.sceneName));
    await ev(() => window.__dev.run('grotto:back'));
    await wait(1200);
    expect(await ev(() => !!document.querySelector('.grotto-ride')), 'нет картинки заплыва в город');
    await wait(2600);
    r = await where();
    const g = await ev(() => window.__dev.World.grottoAt());
    expect(r.scene === 'world' && near(r, { x: g.x - 0.6 * T, y: g.y + 1.4 * T }, 40), 'грот вывел не к буйку', [r, g]);
    // «Домой» с пляжа — на виллу
    await toCove(14, 12);
    await page.click('.hud-btns.left .rbtn:last-child');
    await wait(450);
    await page.click('.panel-foot .btn.green');
    await wait(800);
    expect((await ev(() => window.__dev.sceneName)) === 'villa', 'кнопка «Домой» с пляжа', await ev(() => window.__dev.sceneName));
  });
};

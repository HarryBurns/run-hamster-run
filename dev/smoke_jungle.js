// Шаги автотеста про джунгли (П.9): задание Капитана Боба «Юнга» от взятия до сдачи (кораблик, три рыбки, «уже было» —
// засчитано сразу), причал за буйками закрыт / открыт (табличка с замочком, кораблик подплыл — переезд картинкой);
// всё важное достижимо пешком, карта джунглей, спрайты, сбор бананов, манго, ананасов и кокоса по сезону, тёплый
// дождик и сухо в городской дождь; водопад, попугаи (фразы, имя, перья), подвесной мост, перья в рамке и на рынке;
// «Лианы» и «Узор храма» до конца с призом; задание Лианы «Дневник исследовательницы»; сохранение и загрузка
// в джунглях, кораблик обратно в город, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:джунгли
module.exports = async function jungle({ page, step, ev, wait, closeAll }) {
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
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  /** В джунгли (открыв лес и джунгли действием openLand); полдень, лето. */
  const toJungle = async (tx = 22, ty = 30, minutes = 12 * 60) => {
    await closeAll();
    await ev(
      ([tx, ty, minutes]) => {
        const d = window.__dev;
        for (const id of ['forest', 'jungle']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          s.flags.jungleHint = 1;
        });
        d.go('jungle');
        d.locations.jungle.debugTeleport(tx, ty);
      },
      [tx, ty, minutes],
    );
    await wait(300);
  };
  /** Поговорить с Лианой; если она предлагает задание — «Потом». */
  const talkL = async () => {
    await ev(() => {
      window.__dev.run('explorer');
    });
    await wait(500);
    if (await ev(() => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent))) {
      await page.click('.dialog .btn >> text=Потом');
      await wait(450);
    }
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchJungle = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchJungle());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  /** Табличка на острове причала за буйками (вторая строка — функция). */
  const portSign = () =>
    ev(() => {
      const o = window.__dev.World.map.objs.find((q) => q.type === 'signpost' && q.tx === 67 && q.ty === 110);
      return o ? [o.text, o.text2()] : null;
    });
  /** Кораблик с хомячком — в открытом море в нескольких клетках к северу от причала; потом плывём к нему. */
  const sailToPort = async () => {
    await ev(() => {
      const d = window.__dev,
        port = d.World.portAt(),
        x = port.x,
        y = port.y - 6 * 48;
      d.actions.patchState('boat', { x, y, on: true });
      d.go('world', { pos: { scene: 'world', x, y } }); // заново в город — кораблик берётся из сохранения (on: true)
    });
    await wait(300);
    expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике');
    await ev(() => {
      const W = window.__dev.World,
        port = W.portAt();
      W.walkTo(port.x, port.y, false);
    });
  };

  await step('джунгли: задание Боба «Юнга» — причал закрыт, кораблик, три рыбки, сдача, кораблик в джунгли', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.actions.mutate((s) => {
        s.dayFlags = {};
        s.minutes = 12 * 60;
        s.stickers = s.stickers.filter((id) => id !== 'x_boat');
        s.ing.fish = 0;
      });
      d.go('world');
      d.World.debugTeleport(63, 59);
    });
    await wait(300);
    // табличка на острове за буйками — с замочком; окно места — про Боба
    let sign = await portSign();
    expect(sign && /Джунгли/.test(sign[0]) && /Боба/.test(sign[1]) && /🔒/.test(sign[1]), 'табличка у закрытого причала', sign);
    await ev(() => {
      window.__dev.run('way:jungle');
    });
    await wait(500);
    expect(/Джунгли/.test(await panelText()) && /Боб/.test(await panelText()), 'окно у закрытого причала', await panelText());
    await closeAll();
    expect((await where()).scene === 'world', 'закрытый причал увёз в джунгли');
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('cabin_boy'));
    expect((await ev(() => window.__dev.QuestState.questBadge('bob'))) === '!', 'над Бобом нет «!»');
    await ev(() => {
      window.__dev.run('npc:bob');
    });
    await wait(500);
    expect(/юнг/.test(await dialogText()) && /рыб/.test(await dialogText()), 'Боб не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    // звёздочка — к пирсу
    const tg = await ev(() => window.__dev.World.target());
    expect(tg && Math.abs(tg.x - 64 * T) < 60 && Math.abs(tg.y - 61.5 * T) < 60, 'звёздочка не у пирса', tg);
    // сели на кораблик (событие boat — как после настоящей посадки)
    await ev(() => window.__dev.emit('boat'));
    await wait(300);
    w = await now();
    expect(w.i === 1, 'кораблик не засчитан', w);
    // три рыбки: две — ещё нет, три — да (рыбу только ловят: в рюкзак её кладёт рыбалка)
    await ev(() => window.__dev.actions.addItem('ing', 'fish', 2));
    await wait(200);
    expect((await now()).i === 1, 'двух рыбок хватило', await now());
    await ev(() => window.__dev.actions.addItem('ing', 'fish', 1));
    await wait(300);
    w = await now();
    expect(w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('bob'))) === '?', 'после рыбы — к Бобу «?»', w);
    const s0 = await state();
    await ev(() => {
      window.__dev.run('npc:bob');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Морской волк/.test(t) && /Джунгли открыты/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    let s = await state();
    expect(
      s.quests.cabin_boy.done === s.day && Number.isFinite(s.lands.jungle) && s.money === s0.money + 700 && s.stickers.includes('q_jungle') && !s.ing.fish,
      'награда за задание Боба (и рыба отдана)',
      [s.quests.cabin_boy, s.lands, s.money - s0.money, s.ing.fish],
    );
    // уже каталась на кораблике — шаг засчитан сразу, как взяли задание (поле already)
    await ev(() =>
      window.__dev.actions.mutate((st) => {
        delete st.quests.cabin_boy;
        if (!st.stickers.includes('x_boat')) st.stickers.push('x_boat');
      }),
    );
    await ev(() => {
      window.__dev.run('npc:bob');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(400);
    await closeAll();
    expect((await now()).i === 1, 'кораблик «уже был» — не засчитан сразу', await now());
    // причал открыт: на табличке — причал; кораблик подплыл к причалу — переезд картинкой
    sign = await portSign();
    expect(/Причал/.test(sign[1]), 'табличка у открытого причала', sign);
    await sailToPort();
    await wait(2500);
    expect(await ev(() => !!document.querySelector('.voyage-ride canvas')), 'нет картинки переезда');
    await wait(2800);
    const r = await where();
    const door = await ev(() => {
      const sc = window.__dev.locations.jungle;
      return sc.map.doorPx(sc.map.bById.dock);
    });
    expect(r.scene === 'jungle' && near(r, door, 30), 'приплыли не к причалу в джунглях', [r, door]);
    s = await state();
    expect(s.pos.scene === 'jungle' && !s.boat.on, 'позиция в сохранении после переезда, кораблик у пирса', [s.pos, s.boat]);
  });

  await step('джунгли: всё важное достижимо пешком, карта джунглей, спрайты, сбор по сезону, дождик и туман', async () => {
    await toJungle();
    const r = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.jungle,
        m = sc.map,
        P = d.Plants,
        out = [];
      const D = await import('/js/data/index.js');
      const from = [20, 37];
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
      for (const id of ['grove', 'bridge']) {
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
      const byIng = {};
      for (const o of plants) byIng[P.PLANTS[o.type].gives] = (byIng[P.PLANTS[o.type].gives] || 0) + 1;
      for (const [id, g] of Object.entries(D.JUNGLE_GATHER)) if (byIng[id] !== g.max) out.push(`${id}: растений ${byIng[id]}, в таблице ${g.max}`);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const k = m.at(x, y);
          if ((k === 'jriver' || k === 'jpool') && m.foot(x, y)) out.push(`в реку можно зайти (${x}, ${y})`);
          if ((x === 0 || y === 0 || x === m.w - 1) && m.foot(x, y)) out.push(`край карты проходим (${x}, ${y})`);
        }
      // за реку — только по мосту
      if (!reach(19, 9) || !reach(32, 7) || !reach(9, 9)) out.push('за рекой не всё достижимо');
      const s = d.G.state;
      // сбор: не в сезон — ничего; в сезон — сколько в таблице, второй раз — ничего, наутро — снова
      for (const [id, g] of Object.entries(D.JUNGLE_GATHER)) {
        const o = plants.find((q) => P.PLANTS[q.type].gives === id),
          inM = [...Array(12).keys()].find((mo) => D.pickIn(id, mo)),
          offM = [...Array(12).keys()].find((mo) => !D.pickIn(id, mo));
        d.actions.mutate((st) => {
          st.day = offM * 3;
          st.dayFlags = {};
        });
        const a0 = s.ing[id] || 0;
        if (P.hasFruit(o) || P.gather(sc, o) || (s.ing[id] || 0) !== a0) out.push(id + ' не в сезон');
        d.actions.mutate((st) => {
          st.day = inM * 3;
          st.dayFlags = {};
        });
        if (!P.hasFruit(o)) out.push('в сезон нет: ' + id);
        P.gather(sc, o);
        if ((s.ing[id] || 0) !== a0 + g.n) out.push(id + ' не собран');
        if (P.gather(sc, o) || (s.ing[id] || 0) !== a0 + g.n) out.push(id + ' — дважды за день');
        if (!s.dayFlags.plants || !s.dayFlags.plants[`jungle:${o.tx}_${o.ty}`]) out.push('отметка дня без имени джунглей');
        d.actions.nextDay();
        if (!P.hasFruit(o)) out.push(id + ' наутро не вырос');
      }
      d.actions.mutate((st) => {
        st.day = 18;
        st.minutes = 12 * 60;
        st.dayFlags = {};
      });
      return out;
    });
    expect(!r.length, 'в джунглях не всё достижимо или сбор не так', r);
    await ev(() => {
      window.__dev.F.openMap();
    });
    await wait(500);
    const t = await panelText();
    expect(
      /Карта джунглей/.test(t) &&
        /Лианы/.test(t) &&
        /Водопад/.test(t) &&
        /Попугай Кеша/.test(t) &&
        /Лагерь Лианы/.test(t) &&
        /Руины храма/.test(t) &&
        /Кораблик в город/.test(t) &&
        /Банановая роща/.test(t) &&
        /Подвесной мост/.test(t),
      'карта джунглей',
      t,
    );
    await page.click('.overlay .opt >> text=Водопад');
    await wait(400);
    expect(await ev(() => window.__dev.locations.jungle.p.path.length > 0), 'по кнопке карты не пошли');
    await closeAll();
    for (const minutes of [12 * 60, 6 * 60, 23 * 60])
      for (const [x, y] of [
        [22, 33],
        [26, 26],
        [21, 15],
        [19, 9],
        [33, 8],
        [9, 10],
        [12, 29],
        [14, 19],
        [30, 30],
        [38, 20],
      ]) {
        await ev(
          ([x, y, minutes]) => {
            window.__dev.actions.mutate((s) => (s.minutes = minutes));
            window.__dev.locations.jungle.debugTeleport(x, y);
          },
          [x, y, minutes],
        );
        await wait(80);
      }
    const clipped = await ev(() => window.__dev.locations.jungle.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    const g = await ev(() => window.__dev.locations.jungle.debugGround());
    expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
    // городской дождь и снег в джунгли не попадают; свой тёплый дождик — после обеда в некоторые дни; утром — туман
    const wx = await ev(async () => {
      const d = window.__dev,
        J = await import('/js/locations/jungle.js'),
        D = await import('/js/data/index.js');
      d.actions.mutate((s) => (s.weather = 'rain'));
      const sc = d.locations.jungle,
        dry = sc.dry(),
        layer = (sc.weather || []).length;
      let rainDay = 0;
      while (D.dayRoll(rainDay, 'jungle:drizzle') >= D.JUNGLE.drizzle) rainDay++;
      d.actions.mutate((s) => {
        s.weather = 'sun';
        s.day = rainDay;
        s.minutes = 14 * 60 + 30;
      });
      const drizzle = J.drizzleNow(),
        sound = sc.sound();
      d.actions.mutate((s) => (s.minutes = 11 * 60));
      const noon = J.drizzleNow();
      d.actions.mutate((s) => (s.minutes = 6 * 60));
      const mist = J.mistNow();
      d.actions.mutate((s) => {
        s.day = 18;
        s.minutes = 12 * 60;
      });
      return { dry, layer, drizzle, rain: sound.rain, noon, mist, cold: sc.cold() };
    });
    expect(wx.dry && !wx.layer && wx.drizzle && wx.rain > 0 && !wx.noon && wx.mist > 0.5 && wx.cold === false, 'погода в джунглях', wx);
  });

  await step('джунгли: водопад, попугаи (фразы, имя, перья), подвесной мост, перья в рамке, рынок — только действия', async () => {
    await toJungle(32, 8);
    await watch();
    await clearToasts();
    // искупаться под водопадом: хомячок в воде, кнопка «Вылезти»
    await ev(() => {
      window.__dev.run('jungle:fall');
    });
    await wait(400);
    let r = await ev(() => {
      const sc = window.__dev.locations.jungle;
      return { bath: !!(sc.p.ride && sc.p.ride.bath), hud: document.querySelector('#hud').textContent };
    });
    expect(r.bath && /Вылезти/.test(r.hud) && /водопад/i.test(await toasts()), 'не искупались', [r, await toasts()]);
    await page.click('.hud-btns.left .rbtn >> text=Вылезти');
    await wait(300);
    expect(!(await ev(() => !!window.__dev.locations.jungle.p.ride)), 'не вылезли из заводи');
    let s = await state();
    expect(s.stickers.includes('x_fall'), 'наклейка водопада', s.stickers);
    // попугай: подошла — говорит фразу (облачко), наклейка
    await clearToasts();
    await ev(() => window.__dev.locations.jungle.debugTeleport(25, 23));
    await wait(2200);
    const p = await ev(async () => (await import('/js/locations/jungle.js')).debugParrots());
    expect(p[0].on && p[0].text.length > 2, 'попугай молчит', p);
    s = await state();
    expect(s.stickers.includes('x_parrot') && /Попугай/.test(await toasts()), 'наклейка попугая', [s.stickers, await toasts()]);
    // попугай повторяет имя
    const named = await ev(async () => (await import('/js/locations/jungle.js')).parrotSay(1, 'Пр-р-ривет, {name}!'));
    expect(named.includes(s.name), 'попугай не сказал имя', named);
    // поболтать: раз в день — перо; второй раз — без пера
    for (const i of [0, 1, 2])
      await ev((i) => {
        window.__dev.run({ do: 'jungle', arg: 'parrot', i });
      }, i);
    await ev(() => {
      window.__dev.run({ do: 'jungle', arg: 'parrot', i: 1 });
    });
    await wait(600);
    s = await state();
    expect(s.finds.feather_red === 1 && s.finds.feather_blue === 1 && s.finds.feather_yellow === 1, 'перья попугаев', s.finds);
    // подвесной мост: ступила — наклейка
    await clearToasts();
    await ev(() => {
      const sc = window.__dev.locations.jungle;
      sc.debugTeleport(21, 18);
      sc.walkTo(21.5 * 48, 12.5 * 48, true);
    });
    await wait(2500);
    s = await state();
    expect(s.stickers.includes('x_bridge') && /мост/.test(await toasts()), 'наклейка моста', [s.stickers, await toasts()]);
    // перья в рамке: по одному каждого цвета
    await ev(() => {
      window.__dev.actions.addItem('finds', 'feather_yellow', 2);
      window.__dev.locations.jungle.debugTeleport(30, 26);
    });
    await talkL();
    await page.click('.dialog .btn >> text=Перья в рамке');
    await wait(400);
    await closeAll();
    s = await state();
    expect(
      s.storage.feather_frame === 1 && !s.finds.feather_red && !s.finds.feather_blue && s.finds.feather_yellow === 2 && s.stickers.includes('x_feathers'),
      'перья в рамке',
      [s.storage, s.finds],
    );
    // перья берёт рынок (кошелёк торговца — общий)
    const sold = await ev(() => {
      const F = window.__dev.F,
        g = F.sellable().find((q) => q.id === 'feather_yellow');
      if (!g) return null;
      const m0 = window.__dev.G.state.money;
      F.sellGoods(g, 2);
      return { sell: g.sell, got: window.__dev.G.state.money - m0, left: window.__dev.G.state.finds.feather_yellow || 0 };
    });
    expect(sold && sold.sell === 30 && sold.got === 60 && !sold.left, 'перья на рынке', sold);
    await unwatch();
  });

  await step('джунгли: «Лианы» у Лианы — до конца, приз за первые две игры дня, правило картинкой', async () => {
    await toJungle(30, 26);
    await ev(() => window.__dev.actions.mutate((s) => (s.quests.lost_notebook = { day: s.day, n: {}, got: {}, done: s.day })));
    const s0 = await state();
    await talkL();
    await page.click('.dialog .btn >> text=Покачаться на лианах');
    await wait(1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /вперёд/.test(intro) && (await ev(() => document.querySelectorAll('#mg .vn-col img').length)) === 3 && /Приз Лианы/.test(intro),
      'правило картинкой',
      intro,
    );
    await page.click('#mg >> text=Начать!');
    await wait(400);
    // бот нажимает, когда лиана летит вперёд и почти на самом дальнем качу
    const box = await ev(() => {
      const r = document.querySelector('#mg canvas').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    for (let k = 0; k < 400; k++) {
      const q = await ev(() => document.querySelector('#mg canvas') && document.querySelector('#mg canvas').__vines());
      if (!q || q.over || q.at >= q.n) break;
      if (!q.flying && q.forward && q.q > 0.8) await page.mouse.click(box.x, box.y);
      await wait(30);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 20000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/долетела/.test(end) && /⭐/.test(end), 'итог игры', end);
    await page.click('#mg >> text=Ура!');
    await wait(1500);
    const s1 = await state();
    const stars = s1.best.vines;
    expect(s1.plays.vines === 1 && stars === 3 && s1.dayFlags.jungle.vines === 1 && s1.stickers.includes('x_vines'), 'игра записана', [
      s1.plays,
      s1.best,
      s1.dayFlags.jungle,
    ]);
    expect(s1.money === s0.money + [40, 80, 120][stars - 1], 'приз Лианы', s1.money - s0.money);
    // вторая — с призом; нажала, когда лиана летит назад, — «Подожди!», висим дальше; закрыли крестиком — ничего
    await ev(() => {
      window.__dev.F.vinesGame();
    });
    await wait(900);
    expect(/ещё 1 полёт/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'на заставке — сколько полётов с призом');
    await page.click('#mg >> text=Начать!');
    await wait(300);
    for (let k = 0; k < 200; k++) {
      const q = await ev(() => document.querySelector('#mg canvas').__vines());
      if (!q.forward && q.q < 0.3) {
        await page.mouse.click(box.x, box.y);
        break;
      }
      await wait(30);
    }
    await wait(200);
    const q = await ev(() => document.querySelector('#mg canvas').__vines());
    expect(q.miss === 1 && q.at === 0 && !q.flying, 'прыжок назад засчитан', q);
    await page.click('#mg .xbtn');
    await wait(400);
    expect((await state()).money === s1.money, 'закрыли игру — а приз пришёл');
    // две игры уже были — третья для удовольствия
    await ev(() => window.__dev.actions.setDayFlag('vines', 2, 'jungle'));
    await ev(() => {
      window.__dev.F.vinesGame();
    });
    await wait(900);
    expect(/для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'третья игра — без приза');
    await page.click('#mg .xbtn');
    await wait(300);
    await closeAll();
  });

  await step('джунгли: «Узор храма» — до конца, сокровище раз в день, ошибка — маска показывает снова', async () => {
    await toJungle(9, 10);
    const s0 = await state();
    await ev(() => {
      window.__dev.run('jungle:temple');
    });
    await wait(1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Повтори/.test(intro) && (await ev(() => document.querySelectorAll('#mg .gl-col').length)) === 3 && /Сокровище храма/.test(intro), 'правило картинкой', intro);
    await page.click('#mg >> text=Начать!');
    // бот смотрит узор и повторяет его
    for (let k = 0; k < 300; k++) {
      const g = await ev(() => document.querySelector('#mg .gl-grid') && document.querySelector('#mg .gl-grid').__glyphs());
      if (!g || g.phase === 'done') break;
      if (g.phase === 'input') {
        for (let i = g.input; i < g.seq.length; i++) {
          await page.click(`#mg .gl-stone >> nth=${g.seq[i]}`);
          await wait(120);
        }
      }
      await wait(150);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 15000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/без единой ошибки/.test(end), 'итог узора', end);
    await page.click('#mg >> text=Ура!');
    await wait(1600);
    let s = await state();
    expect(
      s.plays.glyphs === 1 && s.best.glyphs === 3 && s.money === s0.money + 150 && s.dayFlags.jungle.glyphs === 1 && s.stickers.includes('x_temple'),
      'сокровище и наклейка',
      [s.plays, s.best, s.money - s0.money, s.dayFlags.jungle],
    );
    // второй раз за день — для удовольствия; ошибка — маска показывает узор снова
    await ev(() => {
      window.__dev.F.glyphsGame();
    });
    await wait(900);
    expect(/для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))), 'второй раз за день — без сокровища');
    await page.click('#mg >> text=Начать!');
    for (let k = 0; k < 60; k++) {
      if ((await ev(() => document.querySelector('#mg .gl-grid').__glyphs().phase)) === 'input') break;
      await wait(100);
    }
    const g0 = await ev(() => document.querySelector('#mg .gl-grid').__glyphs());
    await page.click(`#mg .gl-stone >> nth=${(g0.seq[0] + 1) % 4}`);
    await wait(200);
    const g1 = await ev(() => document.querySelector('#mg .gl-grid').__glyphs());
    expect(g1.miss === 1 && g1.phase === 'show' && g1.round === 0, 'ошибка не показала узор снова', g1);
    await page.click('#mg .xbtn');
    await wait(400);
    s = await state();
    expect(s.money === s0.money + 150, 'второй раз — снова сокровище');
    await closeAll();
  });

  await step('джунгли: задание Лианы «Дневник исследовательницы» — от взятия до сдачи, только действия', async () => {
    await toJungle(30, 26);
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        delete s.quests.lost_notebook;
        s.clothes = s.clothes.filter((id) => id !== 'panama_explorer');
      }),
    );
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('lost_notebook'));
    expect((await ev(() => window.__dev.QuestState.questBadge('liana'))) === '!', 'над Лианой нет «!»');
    await ev(() => {
      window.__dev.run('explorer');
    });
    await wait(500);
    expect(/дневник/.test(await dialogText()), 'Лиана не предлагает задание', await dialogText());
    await page.click('.dialog .btn.green');
    await wait(400);
    await page.click('.dialog .btn.green');
    await wait(400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    const tg = await ev(() => window.__dev.locations.jungle.target());
    expect(tg && Math.abs(tg.x - 32.5 * 48) < 30, 'звёздочка не ведёт к дневнику', tg);
    // нажатие на дневник у водопада
    await ev(() => window.__dev.locations.jungle.debugTeleport(30, 9));
    await wait(500);
    const k = await ev(() => window.__dev.locations.jungle.debugScreen(32.5 * 48, 6.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Дневник нашёлся', { timeout: 6000 });
    await closeAll();
    w = await now();
    expect(w.i === 1, 'дневник не найден', w);
    // узор храма (событие мини-игры — сама игра проверена шагом выше)
    await ev(() => window.__dev.emit('minigame', { id: 'glyphs', stars: 2 }));
    await wait(300);
    w = await now();
    expect(w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('liana'))) === '?', 'после узора — к Лиане «?»', w);
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.jungle.debugTeleport(30, 26);
      window.__dev.run('explorer');
    });
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(500);
    await page.click('.dialog .btn.green');
    await wait(1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Юная исследовательница/.test(t) && /Панама исследовательницы/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.lost_notebook.done === s.day && s.money === s0.money + 600 && s.stickers.includes('q_explorer') && s.clothes.includes('panama_explorer'),
      'награда за задание Лианы',
      [s.quests.lost_notebook, s.money - s0.money],
    );
    await ev(() => window.__dev.actions.wear('head', 'panama_explorer'));
    expect((await state()).look.outfit.head === 'panama_explorer', 'панама не надевается');
  });

  await step('джунгли: сохранение и загрузка в джунглях; кораблик в город; «Домой» из джунглей', async () => {
    await toJungle(24, 28);
    await wait(300);
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const pos = JSON.parse(raw).pos;
    expect(pos.scene === 'jungle', 'позиция в сохранении', pos);
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
    expect(r.scene === 'jungle' && near(r, pos, 30), 'после загрузки — в джунглях на том же месте', [r, pos]);
    // в город — с причала (дверь хижины dock)
    await ev(() => {
      const sc = window.__dev.locations.jungle;
      sc.enterBuilding(sc.map.bById.dock);
    });
    await wait(700);
    expect(await ev(() => !!document.querySelector('.voyage-ride')), 'нет картинки переезда в город');
    await wait(2800);
    r = await where();
    const s = await state();
    expect(r.scene === 'world' && near(r, { x: 63.5 * T, y: 60.6 * T }, 40) && !s.boat.on, 'кораблик привёз не к пирсу города', [r, s.boat]);
    // «Домой» из джунглей — на виллу
    await toJungle(24, 28);
    await page.click('.hud-btns.left .rbtn:last-child');
    await wait(450);
    await page.click('.panel-foot .btn.green');
    await wait(800);
    expect((await ev(() => window.__dev.sceneName)) === 'villa', 'кнопка «Домой» из джунглей', await ev(() => window.__dev.sceneName));
  });
};

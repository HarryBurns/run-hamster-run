// Шаги автотеста про праздники (П.13, часть 1): Новый год, Рождество, Китайский Новый год, Масленица.
// Таблица и календарь (даты, канун, значок в HUD, праздничный календарь), объявление утром (канун — подсказка,
// праздник — окно, наутро после Нового года — поздравление), украшения (накануне и в праздник стоят, потом пропадают;
// клетки под ними закрыты; спрайты в рамке; ночью фейерверк), каждое занятие до конца (ёлка, подарки друзьям, вертеп,
// колядки, фонарики, конверты, блины, «Перетягивание каната»), подарок раз в год (и снова на следующий год),
// сохранение и загрузка посреди праздника, реплики жителей. Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:праздники
module.exports = async function holidays({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const hol = () => ev(() => window.__dev.holiday.state());
  const decor = () => ev(() => window.__dev.holiday.decor());
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const mutate = (src) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), src);
  const run = async (act, ms = 450) => {
    await ev((act) => {
      window.__dev.run(act);
    }, act);
    await wait(ms);
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchHol = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchHol());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
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
    await mutate('s.money = 20000; s.flags.questsEarly = 0;');
  };
  /** Перейти к празднику (when: eve | day | after; год), в город. */
  const toHoliday = async (id, when = 'day', year = 1, minutes = 600) => {
    await closeAll();
    await ev(
      ([id, when, year, minutes]) => {
        const d = window.__dev;
        d.holiday.to(id, when, year, minutes);
        if (d.sceneName !== 'world') d.go('world');
      },
      [id, when, year, minutes],
    );
    await wait(400);
    await closeAll();
  };
  const sleep = async () => {
    await ev(() => {
      window.__dev.go('villa');
      window.__dev.F.askSleep();
    });
    await wait(400);
    await page.click('.panel-foot .btn.green');
    await wait(3700);
  };
  /** Пройти сценку с кнопкой (ёлка, фонарики): нажать кнопку n раз, потом «Ура!». */
  const tapScene = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.click('.hol-scene-panel .panel-body .btn');
      await wait(160);
    }
    await page.click('.hol-scene-panel .panel-body .btn:has-text("Ура")');
    await wait(400);
  };

  await step('праздники: таблица и календарь — даты, канун, украшения по дням, значок в HUD, праздничный календарь', async () => {
    await fresh();
    const r = await ev(async () => {
      const D = await import('./js/data/index.js');
      const on = (d) => (D.holidayOn(d) || {}).id || null;
      return {
        ids: D.HOLIDAYS.map((h) => h.id),
        days: { 35: on(35), 1: on(1), 3: on(3), 5: on(5), 71: on(71), 37: on(37), 2: on(2), 10: on(10) },
        decor: [34, 35, 36, 37, 0, 1, 2, 3, 4, 5, 6].map((d) => D.decorsOn(d).map(({ h, k }) => h.id + k).join(',')),
        gifts: D.HOLIDAYS.map((h) => h.gift),
        prices: [D.CLOTHES_BY_ID.hat_santa, D.CLOTHES_BY_ID.dress_qipao, D.FURN_BY_ID.samovar].map((q) => [q.shop, q.price]),
        secret: D.SECRET_RECIPES.includes('gingerbread'),
        recipe: !!D.DISH_BY_ID.gingerbread,
      };
    });
    expect(r.ids.join() === 'newyear,xmas,cny,maslenitsa', 'праздники в таблице', r.ids);
    expect(r.days[35] === 'newyear' && r.days[71] === 'newyear' && r.days[1] === 'xmas' && r.days[37] === 'xmas', 'Новый год 3 декабря, Рождество 2 января', r.days);
    expect(r.days[3] === 'cny' && r.days[5] === 'maslenitsa' && !r.days[2] && !r.days[10], 'Китайский Новый год 1 февраля, Масленица 3 февраля', r.days);
    expect(r.decor.join('|') === 'newyear-1|newyear0|newyear1,xmas-1|xmas0|newyear1,xmas-1|xmas0|cny-1|cny0|maslenitsa-1|maslenitsa0|', 'украшения по дням', r.decor);
    expect(r.prices.every(([shop, price]) => shop === 'holiday' && !price), 'подарки праздников — без цены, shop: holiday', r.prices);
    expect(r.recipe && !r.secret, 'рецепт пряников — только подарок Рождества', r);
    // значок праздника на плашке даты: канун — бледный, праздник — яркий; по нажатию — календарь
    await toHoliday('newyear', 'eve');
    let chip = await ev(() => document.querySelector('.chip.date').innerHTML);
    expect(/hol-badge eve/.test(chip) && chip.includes('🎄'), 'значок кануна на дате', chip);
    await toHoliday('newyear', 'day');
    await ev(() => window.__dev.emit('hud'));
    chip = await ev(() => document.querySelector('.chip.date').innerHTML);
    expect(/hol-badge"/.test(chip) && chip.includes('🎄'), 'значок праздника на дате', chip);
    const q = norm(await ev(() => document.querySelector('.chip.quest').textContent));
    expect(q.includes('Новый год') && q.includes('0/2'), 'плашка праздника', q);
    await page.click('.chip.date');
    await wait(400);
    const cal = await panelText();
    expect(['Праздники', 'Новый год', 'Рождество', 'Китайский Новый год', 'Масленица', 'Наряди большую ёлку', 'Новогодний колпак'].every((w) => cal.includes(w)), 'праздничный календарь', cal.slice(0, 300));
    await closeAll();
    // журнал: карточка праздника сверху
    await ev(() => { window.__dev.F.openAlbum('quests'); });
    await wait(400);
    const j = await panelText();
    expect(j.includes('Сегодня — Новый год!') && j.includes('Подари новогодние подарки') && j.includes('0/3'), 'праздник в журнале', j.slice(0, 300));
    await closeAll();
  });

  await step('праздники: объявление утром — канун (подсказка), праздник (окно), наутро после Нового года (поздравление)', async () => {
    await fresh();
    await mutate('s.day = 33; s.dayFlags = {};');
    await clearToasts();
    await sleep(); // → 2 декабря, канун Нового года
    await wait(2600);
    let t = await toasts();
    expect(t.includes('Завтра — Новый год'), 'подсказка накануне', t);
    await closeAll();
    await sleep(); // → 3 декабря, Новый год
    await wait(1500);
    const p = await panelText();
    expect(p.includes('Новый год!') && p.includes('Наряди большую ёлку') && p.includes('Новогодний колпак'), 'окно праздника утром', p.slice(0, 300));
    await closeAll();
    // один раз за день: после перезагрузки окно не повторяется
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(2500);
    expect(!(await panelText()).includes('Наряди большую ёлку'), 'объявление повторилось после перезагрузки');
    await closeAll();
    await clearToasts();
    await sleep(); // → 1 января года 2
    await wait(2800);
    t = await toasts();
    expect(t.includes('С Новым годом') && (await state()).day === 36, 'поздравление наутро', t);
    await closeAll();
  });

  await step('праздники: украшения — накануне и в праздник стоят, после пропадают; клетки под ними закрыты; спрайты в рамке; ночью фейерверк', async () => {
    await fresh();
    const plan = [
      ['newyear', 'eve', ['newyear'], true],
      ['newyear', 'day', ['newyear'], true],
      ['newyear', 'after', ['newyear', 'xmas'], true], // 1 января: ёлка ещё стоит, к Рождеству уже украшено
      ['xmas', 'day', ['xmas'], true],
      ['xmas', 'after', ['cny'], true], // 3 января — канун Китайского Нового года
      ['cny', 'day', ['cny'], true],
      ['maslenitsa', 'eve', ['maslenitsa'], true],
      ['maslenitsa', 'day', ['maslenitsa'], true],
      ['maslenitsa', 'after', [], false],
    ];
    for (const [id, when, want] of plan) {
      await toHoliday(id, when);
      for (const [x, y] of [
        [45, 22],
        [53, 22],
        [60, 23],
        [34, 32],
        [11, 12],
      ])
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [x, y]);
      await wait(250);
      const d = await decor();
      expect(d.active.join() === want.join(), `украшения ${id}/${when}`, d.active);
      const blockedIds = [...new Set(d.blocked.map((b) => b.split(':')[1]))].sort().join();
      expect(blockedIds === want.slice().sort().join() && !d.stuck.length, `закрытые клетки ${id}/${when}`, d);
    }
    // на десятый день года — ничего
    await mutate('s.day = 10;');
    await wait(200);
    let d = await decor();
    expect(!d.active.length && !d.blocked.length && !d.stuck.length, 'украшения в обычный день', d);
    // спрайты украшений помещаются в рамку
    const clipped = await ev(() => window.__dev.topdown.SP.stats().clipped.filter((k) => /^h[A-Z]|^hstr/.test(k)));
    expect(!clipped.length, 'спрайты украшений не помещаются в рамку', clipped);
    // фейерверк: в новогоднюю ночь — да, накануне ночью и днём — нет
    await toHoliday('newyear', 'day', 1, 22 * 60);
    await wait(800);
    d = await decor();
    expect(d.fireworks && d.bursts > 0, 'фейерверк в новогоднюю ночь', d);
    await toHoliday('newyear', 'eve', 1, 22 * 60);
    d = await decor();
    expect(!d.fireworks, 'фейерверк накануне', d);
    await toHoliday('newyear', 'day', 1, 12 * 60);
    d = await decor();
    expect(!d.fireworks, 'фейерверк днём', d);
    // небесные фонарики вечером Китайского Нового года
    await toHoliday('cny', 'day', 1, 21 * 60);
    d = await decor();
    expect(d.skyLanterns, 'небесные фонарики вечером', d);
    // от двери виллы можно дойти до мест праздника (место «стоять» — свободно)
    const bad = await ev(() => {
      const W = window.__dev.World,
        m = W.map,
        T = 48,
        door = m.doorPx(m.bById.villa),
        s = [Math.floor(door.x / T), Math.floor(door.y / T)];
      return W.places
        .filter((pl) => /^(nytree|crib|skylanterns|dragon|carousel|effigy|blini|tug)$/.test(pl.id))
        .filter((pl) => !m.path(m.foot, s[0], s[1], Math.floor(pl.stand[0]), Math.floor(pl.stand[1])))
        .map((pl) => pl.id);
    });
    expect(!bad.length, 'до места праздника не дойти', bad);
  });

  await step('праздники: Новый год — нарядить ёлку (сценка до конца), подарки трём друзьям, колпак, наклейка, монеты', async () => {
    await fresh();
    await toHoliday('newyear', 'day');
    await watch();
    const s0 = await state();
    await run('holiday:tree');
    expect((await panelText()).includes('Нарядим ёлку'), 'сценка «Нарядим ёлку» не открылась');
    await tapScene(9);
    let h = await hol();
    expect(h.steps[0] === 'tree:1/1', 'ёлка не наряжена', h);
    await run('holiday:tree');
    expect(!(await panelText()).includes('Нарядим ёлку'), 'ёлку нарядили второй раз');
    // подарки трём друзьям — в разговоре
    for (const npc of ['plusha', 'ponchik', 'bob']) {
      await ev((npc) => { window.__dev.F.npcDialog(npc); }, npc);
      await wait(500);
      if (await page.locator('.dialog .btn:has-text("Подарить")').count()) await page.click('.dialog .btn:has-text("Подарить")');
      else throw new Error('нет «Подарить» у ' + npc + ': ' + (await dialogText()));
      await wait(500);
      await page.click('.dialog .btn:has-text("С Новым годом")');
      await wait(400);
    }
    await wait(1200);
    const fin = await panelText();
    expect(fin.includes('Все праздничные занятия сделаны') && fin.includes('Новогодний колпак'), 'праздничное окно', fin.slice(0, 200));
    await closeAll();
    // второй раз тому же другу подарок не предлагают
    await ev(() => { window.__dev.F.npcDialog('plusha'); });
    await wait(500);
    expect(!(await page.locator('.dialog .btn:has-text("Подарить")').count()), 'подарок второй раз тому же другу');
    await closeAll();
    h = await hol();
    const s1 = await state();
    expect(h.done && h.rewarded, 'праздник не завершён', h);
    expect(s1.clothes.includes('hat_santa') && s1.stickers.includes('x_hol_newyear'), 'колпак и наклейка', s1.stickers.slice(-3));
    expect(s1.money - s0.money === 400 && s1.flags['hol:newyear'] === 1, 'монеты за праздник и отметка года', [s1.money - s0.money, s1.flags]);
    expect(s1.friends.plusha.pts > s0.friends.plusha.pts, 'дружба от подарка не выросла');
    await unwatch();
  });

  await step('праздники: Рождество — вертеп, колядки у трёх домиков (угощение), рецепт пряников', async () => {
    await fresh();
    await toHoliday('xmas', 'day');
    await watch();
    await run('holiday:crib');
    expect((await panelText()).includes('Домик-вертеп'), 'вертеп');
    await closeAll();
    const d0 = (await state()).dishes;
    for (const npc of ['myata', 'busya', 'senya']) {
      await ev((npc) => { window.__dev.run('home-of:' + npc, {}); }, npc);
      await wait(500);
      expect((await panelText()).includes('Колядки'), 'нет колядок у двери ' + npc);
      await page.click('.overlay .btn:has-text("Колядовать")');
      await wait(3400);
      const say = await dialogText();
      expect(say.includes('колядки') || say.includes('Колядки') || say.includes('С Рождеством'), 'хозяин не ответил', say);
      await page.click('.dialog .btn:has-text("Спасибо")');
      await wait(400);
    }
    // у того же домика второй раз не поют — обычная дверь
    await clearToasts();
    await ev(() => { window.__dev.run('home-of:myata', {}); });
    await wait(500);
    expect(!(await panelText()).includes('Колядки'), 'колядки второй раз у того же домика');
    await closeAll();
    await wait(900);
    const s1 = await state(),
      h = await hol();
    const treats = Object.values(s1.dishes).reduce((a, b) => a + b, 0) - Object.values(d0).reduce((a, b) => a + b, 0);
    expect(h.done && treats === 3, 'колядки: три угощения', [h, treats]);
    expect(s1.recipes.includes('gingerbread') && s1.stickers.includes('x_hol_xmas'), 'рецепт пряников и наклейка', s1.recipes.slice(-3));
    await closeAll();
    // пряники готовятся на кухне
    const known = await ev(() => {
      window.__dev.F.openCooking();
      return document.querySelector('.overlay .panel').textContent;
    });
    expect(known.includes('Медовые пряники'), 'пряников нет на плите');
    await closeAll();
    await unwatch();
  });

  await step('праздники: Китайский Новый год — небесные фонарики, пять конвертов с монетками, красный наряд', async () => {
    await fresh();
    await toHoliday('cny', 'eve');
    await run('holiday:lanterns');
    expect(!(await panelText()).includes('Небесные фонарики'), 'фонарики накануне');
    expect((await decor()).envelopes === 0, 'конверты накануне');
    await toHoliday('cny', 'day');
    await watch();
    await run('holiday:dragon');
    await run('holiday:lanterns');
    expect((await panelText()).includes('Небесные фонарики'), 'сценка фонариков');
    await tapScene(3);
    let h = await hol();
    expect(h.steps[0] === 'lanterns:1/1', 'фонарики', h);
    const m0 = (await state()).money;
    const env = await ev(() => window.__dev.World.pickups.filter((p) => p.id.startsWith('env')).map((p) => [p.tx, p.ty]));
    expect(env.length === 5, 'конвертов не пять', env);
    for (const [x, y] of env) {
      await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [x, y]);
      await wait(300);
    }
    await wait(900);
    const s1 = await state();
    h = await hol();
    expect((await decor()).envelopes === 0 && h.done, 'конверты не собраны', [h, await decor()]);
    expect(s1.money - m0 === 5 * 20 + 300, 'монеты: конверты и праздник', s1.money - m0);
    expect(s1.clothes.includes('dress_qipao') && s1.stickers.includes('x_hol_cny'), 'красный наряд и наклейка');
    await closeAll();
    // наряд надевается и рисуется
    await ev(() => window.__dev.actions.wear('body', 'dress_qipao'));
    await wait(300);
    await unwatch();
  });

  await step('праздники: Масленица — набор для блинов, испечь, угостить трёх друзей, «Перетягивание каната» до конца, самовар', async () => {
    await fresh();
    await toHoliday('maslenitsa', 'day');
    await mutate('s.ing = {}; s.dishes = {};');
    await watch();
    await run('holiday:blini');
    let s = await state();
    expect(s.ing.flour === 1 && s.ing.egg === 1 && s.ing.milk === 1, 'набор для блинов', s.ing);
    await run('holiday:blini');
    expect((await state()).ing.flour === 1, 'набор второй раз за день');
    await run('holiday:carousel', 3600);
    await run('holiday:effigy');
    // испечь блинчики: плита, «Снять с плиты» в зелёной зоне
    await ev(() => { window.__dev.F.openCooking(); });
    await wait(400);
    await page.click('.overlay .list-item:has-text("Блинчики") .btn');
    await wait(300);
    for (let i = 0; i < 60; i++) {
      const pos = await ev(() => parseFloat(document.querySelector('.cookbar .mark').style.left));
      if (pos > 45 && pos < 55) break;
      await wait(20);
    }
    await page.click('.panel-foot .btn:has-text("Снять с плиты")');
    await wait(400);
    await closeAll();
    let h = await hol();
    expect(h.steps[0] === 'cook:1/1', 'блины испечены', h);
    await mutate('s.dishes.pancakes = 3;');
    for (const npc of ['plusha', 'ponchik', 'prof']) {
      await ev((npc) => { window.__dev.F.npcDialog(npc); }, npc);
      await wait(500);
      await page.click('.dialog .btn:has-text("Угостить")');
      await wait(400);
      await page.click('.overlay .card:has-text("Блинчики") .btn');
      await wait(400);
      await closeAll();
    }
    h = await hol();
    expect(h.steps[1] === 'treat:3/3', 'угостить блинами трёх друзей', h);
    // «Перетягивание каната»: заставка с правилом картинками, игра в ритм до конца
    const m0 = (await state()).money;
    await ev(() => { window.__dev.run('holiday:tug'); });
    await wait(800);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(intro.includes('Тяни') && intro.includes('Приз ярмарки') && (await ev(() => document.querySelectorAll('#mg .tg-col img').length)) === 3, 'правило картинками', intro.slice(0, 200));
    await page.click('#mg >> text=Начать!');
    await wait(300);
    for (let i = 0; i < 1400; i++) {
      const g = await ev(() => {
        const c = document.querySelector('#mg .tg-canvas');
        return c ? c.__tug() : { over: true };
      });
      if (g.over) break;
      if (g.full && g.phase === 'go') await page.keyboard.press('Space');
      await wait(40);
    }
    await wait(1200);
    const res = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Выиграно раундов: 3/.test(res) && res.includes('+120'), 'в ритм — три звезды', res.slice(0, 200));
    await page.click('#mg >> text=Ура!');
    await wait(1200);
    await closeAll();
    s = await state();
    h = await hol();
    expect(h.done && s.money - m0 === 120 + 400, 'монеты за канат и праздник', [s.money - m0, h]);
    expect(s.storage.samovar === 1 && s.stickers.includes('x_hol_maslenitsa') && s.stickers.includes('x_tug'), 'самовар в кладовке и наклейки', s.storage);
    await unwatch();
    // без нажатий проиграть нельзя: игра доходит до конца, одна звезда
    await ev(() => { window.__dev.run('holiday:tug'); });
    await wait(800);
    await page.click('#mg >> text=Начать!');
    for (let i = 0; i < 80; i++) {
      const over = await ev(() => {
        const c = document.querySelector('#mg .tg-canvas');
        return !c || c.__tug().over;
      });
      if (over) break;
      await wait(1000);
    }
    await wait(1200);
    const res2 = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Выиграно раундов: 0/.test(res2) && res2.includes('Хорошо'), 'без нажатий — одна звезда, без наказания', res2.slice(0, 200));
    await page.click('#mg >> text=Ура!');
    await wait(600);
    await closeAll();
  });

  await step('праздники: подарок раз в год — второй раз в тот же год нет, на следующий год снова', async () => {
    await fresh();
    const finish = async () => {
      await run('holiday:lanterns');
      await tapScene(3);
      await mutate("s.dayFlags.holiday.envelopes = ['env0', 'env1', 'env2', 'env3'];");
      const env = await ev(() => window.__dev.World.pickups.find((p) => p.id === 'env4'));
      await ev(() => window.__dev.World.debugTeleport(51, 25)); // находку подбирают на ходу: сначала — в сторону
      await wait(200);
      await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [env.tx, env.ty]);
      await wait(1200);
      await closeAll();
      await ev(() => window.__dev.World.debugTeleport(51, 25)); // уйти с места конверта: завтра он ляжет там же
      await wait(200);
    };
    await toHoliday('cny', 'day', 1);
    let m0 = (await state()).money;
    await finish();
    let s = await state();
    expect(s.clothes.includes('dress_qipao') && s.flags['hol:cny'] === 1 && s.money - m0 === 320, 'первый год: наряд', [s.money - m0, s.flags]);
    // тот же год, тот же день ещё раз (отметки дня сброшены отладкой) — подарка и монет нет
    await toHoliday('cny', 'day', 1);
    m0 = (await state()).money;
    await finish();
    s = await state();
    expect(s.money - m0 === 20 && s.clothes.filter((c) => c === 'dress_qipao').length === 1, 'второй раз в тот же год', s.money - m0);
    // на следующий год — снова подарок: наряд уже есть, вместо него — мешочек монет
    await toHoliday('cny', 'day', 2);
    m0 = (await state()).money;
    await finish();
    s = await state();
    expect(s.flags['hol:cny'] === 2 && s.money - m0 === 20 + 300 + 300, 'второй год: монеты вместо наряда', [s.money - m0, s.flags]);
    await closeAll();
  });

  await step('праздники: сохранение и загрузка посреди праздника; жители радуются празднику', async () => {
    await fresh();
    await toHoliday('newyear', 'day');
    await run('holiday:tree');
    await tapScene(9);
    await ev(() => { window.__dev.F.npcDialog('plusha'); });
    await wait(500);
    await page.click('.dialog .btn:has-text("Подарить")');
    await wait(500);
    await closeAll();
    const h0 = await hol();
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(900);
    await closeAll();
    const h1 = await hol();
    expect(h1.today === 'newyear' && h1.steps.join() === h0.steps.join() && h1.steps.join() === 'tree:1/1,gifts:1/3', 'ход праздника после загрузки', [h0, h1]);
    expect(!h1.rewarded, 'подарок выдан раньше времени');
    // доделать после загрузки — подарок
    for (const npc of ['ponchik', 'bob']) {
      await ev((npc) => { window.__dev.F.npcDialog(npc); }, npc);
      await wait(500);
      await page.click('.dialog .btn:has-text("Подарить")');
      await wait(500);
      await closeAll();
    }
    await wait(800);
    expect((await hol()).rewarded && (await state()).clothes.includes('hat_santa'), 'подарок после загрузки');
    await closeAll();
    // реплики жителей: накануне, в праздник, наутро
    const line = (id) => ev((id) => window.__dev.F.holidayLineFor(id), id);
    await toHoliday('maslenitsa', 'eve');
    let l = await line('senya');
    expect(/Масленица|карусель|муку/.test(l), 'реплика накануне', l);
    await toHoliday('newyear', 'day');
    l = await line('zefirka');
    expect(/Новым годом|фейерверк|Ёлка/.test(l), 'реплика в праздник', l);
    await mutate('s.day = 10;');
    expect((await line('zefirka')) === null, 'реплика в обычный день');
  });
};

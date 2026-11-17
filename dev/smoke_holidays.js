// Шаги автотеста про праздники (П.13): часть 1 — Новый год, Рождество, Китайский Новый год, Масленица; часть 2 — 1 Мая,
// Иван Купала («Водяная битва»), Хеллоуин, день рождения хомячка; новогодний салют, первый день новой игры.
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
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
    await wait(500);
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
  /** Нарядить ёлку (мини-игра «Нарядим ёлку!», этап 14): шесть игрушек на ветки, звезда, «Ура!». */
  const trim = async () => {
    await page.waitForSelector('#mg >> text=Начать!', { timeout: 5000 });
    await page.click('#mg >> text=Начать!');
    await wait(300);
    const st = await ev(() => document.querySelector('#mg .tr-canvas').__tree());
    const r = await ev(() => {
      const b = document.querySelector('#mg .tr-canvas').getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    });
    for (let i = 0; i < 6; i++) {
      await page.click(`#mg .tr-tray button[data-kind="${['ball', 'star', 'bell', 'bow', 'ball', 'candy'][i]}"]`);
      const p = st.spots[i * 2];
      await page.mouse.click(r.x + p.x * (r.w / st.w), r.y + (p.y + 8) * (r.h / st.h));
      await wait(80);
    }
    await page.click('#mg .tr-tray button[data-kind="top"]');
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 6000 });
    await page.click('#mg >> text=Ура!');
    await wait(500);
  };
  /** Пройти сценку с кнопкой (фонарики, венок…): нажать кнопку n раз, потом «Ура!». */
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
        prices: [D.CLOTHES_BY_ID.hat_santa, D.CLOTHES_BY_ID.dress_qipao, D.FURN_BY_ID.samovar, ...['wreath_may', 'water_pistol', 'hat_witch', 'cape_violet'].map((id) => D.CLOTHES_BY_ID[id])].map((q) => [q.shop, q.price]),
        more: { 12: on(12), 18: on(18), 29: on(29), 0: on(0), 36: on(36), 72: on(72), 37: on(37) },
        // «Год в городе» (этап 10): 1 июня, через год после начала игры (новая — день 15, старая — день 0)
        town: [D.holidayOn(15, 15), D.holidayOn(51, 15), D.holidayOn(87, 15), D.holidayOn(15, 0), D.holidayOn(51, 0), D.holidayOn(50, 15), D.holidayOn(52, 15)].map((h) => (h ? h.id : null)),
        start: [D.START_DAY, window.__dev.state.day, window.__dev.state.startDay, D.decorsOn(15, 15).length, D.decorsOn(16, 15).length],
        gifts3: D.HOLIDAYS.map((h) => D.holidayGifts(h).length),
        decor2: [11, 12, 13, 17, 18, 19, 28, 29, 30, 36].map((d) => D.decorsOn(d).map(({ h, k }) => h.id + k).join(',')),
        secret: D.SECRET_RECIPES.includes('gingerbread'),
        recipe: !!D.DISH_BY_ID.gingerbread,
      };
    });
    expect(r.ids.join() === 'newyear,xmas,cny,maslenitsa,mayday,kupala,halloween,birthday', 'праздники в таблице', r.ids);
    expect(r.days[35] === 'newyear' && r.days[71] === 'newyear' && r.days[1] === 'xmas' && r.days[37] === 'xmas', 'Новый год 3 декабря, Рождество 2 января', r.days);
    expect(r.days[3] === 'cny' && r.days[5] === 'maslenitsa' && !r.days[2] && !r.days[10], 'Китайский Новый год 1 февраля, Масленица 3 февраля', r.days);
    expect(r.decor.join('|') === 'newyear-1|newyear0|newyear1,xmas-1|xmas0|newyear1,xmas-1|xmas0|cny-1|cny0|maslenitsa-1|maslenitsa0|', 'украшения по дням', r.decor);
    expect(r.prices.every(([shop, price]) => shop === 'holiday' && !price), 'подарки праздников — без цены, shop: holiday', r.prices);
    expect(r.more[12] === 'mayday' && r.more[18] === 'kupala' && r.more[29] === 'halloween' && r.more[36] === null && r.more[72] === null && r.more[37] === 'xmas', '1 Мая, Купала, Хеллоуин; 1 января праздника нет', r.more);
    expect(r.town.join() === ',birthday,birthday,,birthday,,', '«Год в городе» — 1 июня через год после начала игры (и у старых игр), в первый год его нет', r.town);
    expect(r.start.join() === '15,15,15,0,0', 'новая игра начинается 1 июня, первые дни — без праздников и украшений', r.start);
    expect(r.gifts3.every((n) => n === 3), 'у каждого праздника — три подарка по годам', r.gifts3);
    expect(r.decor2.join('|') === 'mayday-1|mayday0||kupala-1|kupala0||halloween-1|halloween0||newyear1,xmas-1', 'украшения части 2 по дням', r.decor2);
    expect(r.recipe && !r.secret, 'рецепт пряников — только подарок Рождества', r);
    // значок праздника на плашке даты: канун — бледный, праздник — яркий; по нажатию — календарь
    await toHoliday('newyear', 'eve');
    let chip = await ev(() => document.querySelector('.chip.date').innerHTML);
    expect(/hol-badge eve/.test(chip) && chip.includes('🎄'), 'значок кануна на дате', chip);
    await toHoliday('newyear', 'day');
    await ev(() => window.__dev.emit('hud'));
    chip = await ev(() => document.querySelector('.chip.date').innerHTML);
    expect(/hol-badge"/.test(chip) && chip.includes('🎄 0/2'), 'значок и ход праздника на дате', chip);
    // плашка журнала: есть «!» у Мяты — она про Мяту; заданий нет — про праздник
    let q = norm(await ev(() => document.querySelector('.chip.quest').textContent));
    expect(q.includes('Мята'), 'плашка журнала при задании', q);
    await mutate("s.quests.herbarium = { day: 0, n: {}, got: {}, done: 1 };");
    await ev(() => window.__dev.emit('hud'));
    q = norm(await ev(() => document.querySelector('.chip.quest').textContent));
    expect(q.includes('Новый год') && q.includes('0/2'), 'плашка праздника, когда заданий нет', q);
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
    await sleep(); // → 1 января года 2: поздравление с Новым годом и «завтра — Рождество» — подсказкой, без окна
    await wait(3200);
    t = await toasts();
    expect(t.includes('С Новым годом') && t.includes('Завтра — Рождество') && (await state()).day === 36, 'поздравление наутро после Нового года', t);
    expect(!(await panelText()).includes('Год в городе'), '1 января — окно «Год в городе»');
    await closeAll();
  });

  await step('праздники: украшения — накануне и в праздник стоят, после пропадают; клетки под ними закрыты; спрайты в рамке; ночью фейерверк', async () => {
    await fresh();
    const plan = [
      ['newyear', 'eve', ['newyear'], true],
      ['newyear', 'day', ['newyear'], true],
      ['newyear', 'after', ['newyear', 'xmas'], true], // 1 января (год 2): ёлка ещё стоит, к Рождеству уже украшено
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
      expect(blockedIds === want.filter((q) => q !== 'birthday').sort().join() && !d.stuck.length, `закрытые клетки ${id}/${when}`, d); // у дня рождения в городе только шарики
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

  await step('праздники: Новый год — нарядить ёлку (мини-игра до конца), подарки трём друзьям, колпак, наклейка, монеты', async () => {
    await fresh();
    await toHoliday('newyear', 'day');
    await watch();
    const s0 = await state();
    await run('holiday:tree', 800);
    expect(await ev(() => /Нарядим ёлку/.test((document.querySelector('#mg') || {}).textContent || '')), 'игра «Нарядим ёлку» не открылась');
    await trim();
    let h = await hol();
    expect(h.steps[0] === 'tree:1/1', 'ёлка не наряжена', h);
    // игрушки, что повесила, остаются на большой ёлке до конца праздника (этап 15): наряд — в отметках дня
    const toys = (await state()).dayFlags.holiday.treeToys || '';
    expect(toys.length === 28 && (toys.match(/\d\d/g) || []).length === 6, 'наряд ёлки из мини-игры — на большой ёлке', toys);
    await run('holiday:tree');
    expect(!(await ev(() => !!document.querySelector('#mg'))), 'ёлку нарядили второй раз');
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
    await toHoliday('xmas', 'day'); // днём (10:00) у двери — обычный визит, колядки — вечером
    await ev(() => { window.__dev.run('home-of:myata', {}); });
    await wait(500);
    expect(!(await panelText()).includes('Колядки'), 'колядки днём');
    await closeAll();
    await toHoliday('xmas', 'day', 1, 17 * 60);
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
    // этап 12 (Пр9): у прилавка рассказывают масленичные рецепты и можно печь прямо на ярмарке
    expect(s.recipes.includes('blini_jam') && s.recipes.includes('blini_honey'), 'масленичные рецепты у прилавка', s.recipes);
    let pt = await panelText();
    expect(/блины с вареньем/.test(pt) && /блины с мёдом и маслом/.test(pt), 'окно прилавка называет рецепты', pt);
    expect((await ev(() => document.querySelectorAll('.overlay .panel img.ico').length)) >= 2, 'в окне прилавка — рисованные значки блинов');
    await closeAll();
    await run('holiday:blini');
    expect((await state()).ing.flour === 1, 'набор второй раз за день');
    pt = await panelText();
    expect(/Ярмарочная печка/.test(pt) && /Блинчики/.test(pt) && /Блины с вареньем/.test(pt) && !/Пицца/.test(pt), 'ярмарочная печка: только блины', pt);
    // печём блины с мёдом и маслом прямо на ярмарке — шаг праздника засчитывается
    await mutate('s.ing.honey = 1; s.ing.butter = 1;');
    await closeAll();
    await run('holiday:blini');
    await page.click('.overlay .list-item:has-text("Блины с мёдом и маслом") .btn');
    await wait(300);
    await page.click('.panel-foot .btn:has-text("Снять с плиты")');
    await wait(400);
    await closeAll();
    s = await state();
    expect(s.dishes.blini_honey >= 1 && !s.ing.honey, 'блины с мёдом испечены на ярмарке', { dishes: s.dishes, ing: s.ing });
    expect((await hol()).steps[0] === 'cook:1/1', 'масленичные блины засчитаны празднику', await hol());
    // обычные блинчики на кухне — как раньше (набор выдаём ещё раз вручную)
    await mutate('s.ing.flour = 1; s.ing.egg = 1; s.ing.milk = 1;');
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
    await mutate('s.dishes = { pancakes: 2, blini_jam: 1 };');
    for (const npc of ['plusha', 'ponchik', 'prof']) {
      await ev((npc) => { window.__dev.F.npcDialog(npc); }, npc);
      await wait(500);
      await page.click('.dialog .btn:has-text("Угостить")');
      await wait(400);
      // одного друга угощаем масленичными блинами с вареньем — тоже считается
      await page.click(`.overlay .card:has-text("${npc === 'prof' ? 'Блины с вареньем' : 'Блинчики'}") .btn`);
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
    // годовые подарки по кругу (этап 10, Пр6): на второй год — новая вещь (веер), на третий — ещё одна (шапочка
    // дракона), на четвёртый все вещи праздника уже есть — мешочек монет
    await toHoliday('cny', 'day', 2);
    m0 = (await state()).money;
    await finish();
    s = await state();
    expect(s.flags['hol:cny'] === 2 && s.money - m0 === 20 + 300 && s.clothes.includes('fan_red') && !s.clothes.includes('hat_dragon'), 'второй год: новая вещь — веер', [s.money - m0, s.flags]);
    await toHoliday('cny', 'day', 3);
    m0 = (await state()).money;
    let lbl = await ev(() => window.__dev.F.giftLabel(window.__dev.F.holidayToday()));
    expect(lbl === 'Шапочка дракона', 'подарок третьего года в календаре', lbl);
    await finish();
    s = await state();
    expect(s.flags['hol:cny'] === 3 && s.money - m0 === 20 + 300 && s.clothes.includes('hat_dragon'), 'третий год: шапочка дракона', [s.money - m0, s.flags]);
    await toHoliday('cny', 'day', 4);
    m0 = (await state()).money;
    lbl = await ev(() => window.__dev.F.giftLabel(window.__dev.F.holidayToday()));
    expect(lbl.includes('мешочек монет'), 'всё собрано — в календаре мешочек монет', lbl);
    await finish();
    s = await state();
    expect(s.flags['hol:cny'] === 4 && s.money - m0 === 20 + 300 + 300, 'четвёртый год: все вещи есть — мешочек монет', [s.money - m0, s.flags]);
    await closeAll();
  });

  await step('праздники: сохранение и загрузка посреди праздника; жители радуются празднику', async () => {
    await fresh();
    await toHoliday('newyear', 'day');
    await run('holiday:tree', 800);
    await trim();
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

  // ==================== часть 2 ====================
  /** Пройти сценку с кнопкой до конца: нажимать кнопку, пока не станет «Ура!». */
  const tapThrough = async () => {
    for (let i = 0; i < 12; i++) {
      const t = await ev(() => (document.querySelector('.hol-scene-panel .panel-body .btn') || {}).textContent || '');
      if (!t) throw new Error('сценка не открылась');
      if (t.includes('Ура')) break;
      await page.click('.hol-scene-panel .panel-body .btn');
      await wait(160);
    }
    await page.click('.hol-scene-panel .panel-body .btn:has-text("Ура")');
    await wait(400);
  };

  await step('праздники: первый день новой игры (1 июня) не перегружен — ни праздника, ни кануна, ни праздничного окна', async () => {
    await fresh();
    await wait(2800);
    const s = await state(),
      h = await hol();
    expect(s.day === 15 && s.startDay === 15 && h.today === null && h.tomorrow === null && !h.decor.length, 'первый день (1 июня): ни праздника, ни кануна, ни украшений', h);
    const p = await panelText();
    expect(!/Год в городе|Ура! 🎉|Все праздничные/.test(p), 'в первый день — праздничное окно', p.slice(0, 200));
    const chip = await ev(() => document.querySelector('.chip.date').innerHTML);
    expect(!/hol-badge"/.test(chip), 'на дате — значок праздника в первый день', chip);
    // в календаре «Год в городе» — «впервые — через год после приезда»
    await page.click('.chip.date');
    await wait(400);
    const cal = await panelText();
    expect(cal.includes('Год в городе') && cal.includes('впервые — через год после твоего приезда') && cal.includes('Иван Купала') && cal.includes('Хеллоуин') && cal.includes('1 Мая'), 'праздничный календарь части 2', cal.slice(0, 400));
    await closeAll();
  });

  await step('праздники: украшения части 2 — 1 Мая, Купала, Хеллоуин (накануне, в праздник, после); клетки, спрайты, свет ночью', async () => {
    await fresh();
    const plan = [
      ['mayday', 'eve', ['mayday']],
      ['mayday', 'day', ['mayday']],
      ['mayday', 'after', []],
      ['kupala', 'eve', ['kupala']],
      ['kupala', 'day', ['kupala']],
      ['kupala', 'after', []],
      ['halloween', 'eve', ['halloween']],
      ['halloween', 'day', ['halloween']],
      ['halloween', 'after', []],
    ];
    for (const [id, when, want] of plan) {
      await toHoliday(id, when);
      for (const [x, y] of [
        [51, 23],
        [42, 33],
        [39, 26],
        [50, 54],
        [41, 35],
        [12, 37],
      ])
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [x, y]);
      await wait(250);
      const d = await decor();
      expect(d.active.join() === want.join(), `украшения ${id}/${when}`, d.active);
      const blockedIds = [...new Set(d.blocked.map((b) => b.split(':')[1]))].sort().join();
      expect(blockedIds === want.join() && !d.stuck.length, `закрытые клетки ${id}/${when}`, d);
    }
    // день рождения: шарики у двери виллы (в городе) — во второй год
    await toHoliday('birthday', 'day', 2);
    await ev(() => window.__dev.World.debugTeleport(16, 11));
    await wait(300);
    let d = await decor();
    expect(d.active.includes('birthday') && d.bday, 'шарики у двери дома на день рождения', d);
    const clipped = await ev(() => window.__dev.topdown.SP.stats().clipped.filter((k) => /^h[A-Z]|^hstr/.test(k)));
    expect(!clipped.length, 'спрайты украшений не помещаются в рамку', clipped);
    // ночью светятся купальский костёр и тыквы
    await toHoliday('kupala', 'day', 1, 22 * 60);
    await ev(() => window.__dev.World.debugTeleport(50, 54));
    await wait(400);
    d = await decor();
    expect(d.glow.includes('hBonfire'), 'костёр светит ночью', d.glow);
    await toHoliday('halloween', 'day', 1, 22 * 60);
    await ev(() => window.__dev.World.debugTeleport(51, 23));
    await wait(400);
    d = await decor();
    expect(d.glow.includes('hJack'), 'тыквы светят ночью', d.glow);
    // до мест праздника можно дойти от двери виллы
    const bad = await ev(() => {
      const W = window.__dev.World,
        m = W.map,
        T = 48,
        door = m.doorPx(m.bById.villa),
        s = [Math.floor(door.x / T), Math.floor(door.y / T)];
      return W.places
        .filter((pl) => /^(balloons|maybed\d|bonfire|splash|wreathfloat|pumpkins|ghost)$/.test(pl.id))
        .filter((pl) => !m.path(m.foot, s[0], s[1], Math.floor(pl.stand[0]), Math.floor(pl.stand[1])))
        .map((pl) => pl.id);
    });
    expect(!bad.length, 'до места праздника не дойти', bad);
  });

  await step('праздники: новогодний салют — залпы в верхней части экрана, искры-чёрточки', async () => {
    await fresh();
    await toHoliday('newyear', 'day', 1, 22 * 60);
    await ev(() => window.__dev.World.debugTeleport(51, 24));
    await wait(1500);
    const fw = await ev(() => window.__dev.holiday.fireworks());
    expect(fw.length > 0, 'залпов нет', fw);
    expect(fw.every((b) => b.top < 0.42), 'залп раскрывается не в верхней части экрана', fw);
    expect(new Set(fw.map((b) => Math.round(b.left * 4))).size >= Math.min(2, fw.length), 'залпы — в одном месте', fw);
    const keys = await ev(() => [...window.__dev.topdown.SP.map.keys()].filter((k) => k.includes('hStreak')).length);
    expect(keys > 4, 'искры-чёрточки не рисуются', keys);
  });

  await step('праздники: 1 Мая — субботник на трёх клумбах (сценка), парад с шариками, майский венок', async () => {
    await fresh();
    await toHoliday('mayday', 'eve');
    await run({ do: 'holiday', arg: 'plant', bed: 0 });
    expect(!(await panelText()).includes('Субботник'), 'субботник накануне');
    await toHoliday('mayday', 'day');
    await watch();
    const m0 = (await state()).money;
    for (const bed of [0, 1, 2]) {
      await run({ do: 'holiday', arg: 'plant', bed });
      expect((await panelText()).includes('Субботник'), 'сценка субботника не открылась: ' + bed);
      await tapThrough();
    }
    let h = await hol();
    expect(h.steps[0] === 'plant:3/3', 'три клумбы', h);
    await run({ do: 'holiday', arg: 'plant', bed: 1 });
    expect(!(await panelText()).includes('Субботник'), 'та же клумба второй раз');
    await run('holiday:parade', 4200);
    await wait(1200);
    const fin = await panelText();
    expect(fin.includes('Все праздничные занятия сделаны') && fin.includes('Майский венок'), 'праздничное окно 1 Мая', fin.slice(0, 200));
    await closeAll();
    const s = await state();
    h = await hol();
    expect(h.done && h.rewarded && s.clothes.includes('wreath_may') && s.stickers.includes('x_hol_mayday') && s.money - m0 === 300, '1 Мая: венок, наклейка, монеты', [s.money - m0, h]);
    await ev(() => window.__dev.actions.wear('head', 'wreath_may'));
    await unwatch();
  });

  /** Сыграть в «Водяную битву»: aim — брызгать в того, кто выглянул; иначе — без нажатий. */
  const splashGame = async (aim) => {
    await page.click('#mg >> text=Начать!');
    await wait(200);
    const KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
    for (let i = 0; i < 2000; i++) {
      const g = await ev(() => {
        const c = document.querySelector('#mg .sp-canvas');
        return c ? c.__splash() : { over: true };
      });
      if (g.over) break;
      if (aim && g.cool <= 0) {
        const lane = g.up.findIndex(Boolean);
        if (lane >= 0) await page.keyboard.press(KEYS[lane]);
      }
      await wait(aim ? 40 : 1000);
    }
    await wait(1200);
    return norm(await ev(() => document.querySelector('#mg').textContent));
  };

  await step('праздники: Иван Купала — венок по воде (сценка), «Водяная битва» (3★ и без нажатий 1★, приз за две игры), водяной пистолет', async () => {
    await fresh();
    await toHoliday('kupala', 'day');
    await watch();
    const m0 = (await state()).money;
    await run('holiday:bonfire');
    await run('holiday:wreath');
    expect((await panelText()).includes('Купальский венок'), 'сценка венка');
    await tapThrough();
    let h = await hol();
    expect(h.steps[0] === 'wreath:1/1', 'венок по воде', h);
    await ev(() => { window.__dev.run('holiday:splash'); });
    await wait(800);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(intro.includes('Брызни') && intro.includes('Приз Купалы') && (await ev(() => document.querySelectorAll('#mg .sp-col img').length)) === 3, 'правило картинками', intro.slice(0, 200));
    const res = await splashGame(true);
    expect(res.includes('⭐') && /Брызг: \d+/.test(res) && res.includes('+120'), 'меткая игра — три звезды', res.slice(0, 200));
    await page.click('#mg >> text=Ура!');
    await wait(1400);
    const fin = await panelText();
    expect(fin.includes('Все праздничные занятия сделаны') && fin.includes('Водяной пистолет'), 'праздничное окно Купалы', fin.slice(0, 200));
    await closeAll();
    expect((await decor()).wet, 'после «Водяной битвы» все мокрые — капельки и лужицы (этап 15, Пр18)');
    let s = await state();
    h = await hol();
    expect(h.done && s.clothes.includes('water_pistol') && s.stickers.includes('x_hol_kupala') && s.stickers.includes('x_splash') && s.money - m0 === 120 + 300, 'Купала: пистолет, наклейки, монеты', [s.money - m0, h]);
    await ev(() => window.__dev.actions.wear('acc', 'water_pistol'));
    await unwatch();
    // без нажатий: игра доходит до конца, одна звезда, вторая призовая игра
    const m1 = (await state()).money;
    await ev(() => { window.__dev.run('holiday:splash'); });
    await wait(800);
    const res2 = await splashGame(false);
    expect(/Брызг: 0/.test(res2) && res2.includes('Хорошо') && res2.includes('+40'), 'без нажатий — одна звезда, без наказания', res2.slice(0, 200));
    await page.click('#mg >> text=Ура!');
    await wait(600);
    await closeAll();
    expect((await state()).money - m1 === 40, 'вторая призовая игра', (await state()).money - m1);
    // третья — для удовольствия
    await ev(() => { window.__dev.run('holiday:splash'); });
    await wait(800);
    expect(norm(await ev(() => document.querySelector('#mg').textContent)).includes('для удовольствия'), 'третья игра — без приза');
    await ev(() => document.querySelector('#mg .xbtn').click());
    await wait(400);
  });

  await step('праздники: Хеллоуин — вырезать тыкву (сценка), «сладость или гадость» у трёх домиков вечером, шляпа и мантия', async () => {
    await fresh();
    await toHoliday('halloween', 'day'); // днём у двери — обычный визит
    await ev(() => { window.__dev.run('home-of:myata', {}); });
    await wait(500);
    expect(!(await panelText()).includes('Сладость или гадость'), '«сладость или гадость» днём');
    await closeAll();
    await toHoliday('halloween', 'day', 1, 17 * 60);
    await watch();
    const m0 = (await state()).money;
    await run('holiday:ghost');
    await run('holiday:pumpkins');
    expect((await panelText()).includes('Тыква-фонарик'), 'сценка тыквы');
    await tapThrough();
    const d0 = (await state()).dishes;
    for (const npc of ['myata', 'busya', 'senya']) {
      await ev((npc) => { window.__dev.run('home-of:' + npc, {}); }, npc);
      await wait(500);
      expect((await panelText()).includes('Сладость или гадость'), 'нет «сладость или гадость» у ' + npc);
      await page.click('.overlay .btn:has-text("Сладость или гадость!")');
      await wait(3400);
      expect((await dialogText()).includes('С Хеллоуином'), 'хозяин не угостил', await dialogText());
      await page.click('.dialog .btn:has-text("Спасибо")');
      await wait(400);
    }
    await wait(1200);
    const fin = await panelText();
    expect(fin.includes('Все праздничные занятия сделаны') && fin.includes('Шляпа волшебницы') && fin.includes('мантия'), 'праздничное окно Хеллоуина', fin.slice(0, 200));
    await closeAll();
    const s = await state(),
      h = await hol();
    const treats = Object.values(s.dishes).reduce((a, b) => a + b, 0) - Object.values(d0).reduce((a, b) => a + b, 0);
    expect(h.done && treats === 3 && s.clothes.includes('hat_witch') && s.clothes.includes('cape_violet') && s.stickers.includes('x_hol_halloween') && s.money - m0 === 300, 'Хеллоуин: угощения, шляпа, мантия', [treats, s.money - m0, h]);
    await ev(() => { window.__dev.actions.wear('head', 'hat_witch'); window.__dev.actions.wear('acc', 'cape_violet'); });
    await unwatch();
    // на следующий год шляпа и мантия уже есть — новая вещь праздника: шапка-тыковка
    await toHoliday('halloween', 'day', 2, 17 * 60);
    const m1 = (await state()).money;
    await run('holiday:pumpkins');
    await tapThrough();
    for (const npc of ['myata', 'busya', 'senya']) {
      await ev((npc) => { window.__dev.run('home-of:' + npc, {}); }, npc);
      await wait(500);
      await page.click('.overlay .btn:has-text("Сладость или гадость!")');
      await wait(3400);
      await page.click('.dialog .btn:has-text("Спасибо")');
      await wait(400);
    }
    await wait(1200);
    await closeAll();
    expect((await state()).money - m1 === 300 && (await state()).flags['hol:halloween'] === 2 && (await state()).clothes.includes('hat_pumpkin'), 'второй год: новая вещь — шапка-тыковка', (await state()).money - m1);
  });

  await step('праздники: «Год в городе» — через год после приезда, гости несут подарки в лапках, торт (задуть свечи), сохранение посреди праздника', async () => {
    await fresh();
    await mutate("s.quests.herbarium = { day: 0, n: {}, got: {}, done: 1 };");
    // 1 июня первого года (день начала игры) праздника нет; через год — есть
    await toHoliday('birthday', 'day', 1, 10 * 60 + 30);
    let h = await hol();
    expect(h.today === null && (await state()).day === 15, 'в первый год «Года в городе» нет', h);
    await toHoliday('birthday', 'day', 2, 10 * 60 + 30);
    h = await hol();
    expect(h.today === 'birthday' && (await state()).day === 51 && h.steps.join() === 'guests:0/3,cake:0/1', '«Год в городе» — через год', h);
    await watch();
    // в городе гости не приходят; дома до 11:00 — тоже
    await ev(() => window.__dev.go('villa'));
    await wait(1500);
    await closeAll();
    expect((await state()).guests.length === 0, 'гости пришли раньше 11:00');
    const s0 = await state();
    await mutate('s.minutes = 11 * 60;');
    let boxes = 0; // сколько раз видели гостя с коробочкой в лапках (Пр15)
    for (let i = 0; i < 60 && (await hol()).steps[0] !== 'guests:3/3'; i++) {
      await wait(500);
      if (await ev(() => window.__dev.scene.actors.some((g) => g.guest && g.carry))) boxes++;
      if (i % 4 === 3) await mutate('s.minutes += 20;'); // время в игре идёт быстрее
      // сохранение и загрузка посреди праздника: ход не теряется
      if (i === 1) {
        const before = (await hol()).day.guests || [];
        await ev(() => window.dispatchEvent(new Event('pagehide')));
        await page.reload();
        await wait(500);
        await page.click('text=Продолжить');
        await wait(1200);
        await closeAll();
        const after = (await hol()).day.guests || []; // после загрузки гости могут прийти дальше — но никто не пропал
        expect(before.length > 0 && before.every((g) => after.includes(g)), 'ход дня рождения после загрузки', [before, after]);
        await ev(() => { window.__stopWatchHol = window.__dev.watchState(); });
      }
    }
    h = await hol();
    let s = await state();
    expect(h.steps[0] === 'guests:3/3' && s.guests.length === 3, 'три гостя', [h, s.guests]);
    expect(boxes > 0, 'гости несут подарки в лапках', boxes);
    expect(s.money > s0.money || Object.values(s.dishes).reduce((a, b) => a + b, 0) > Object.values(s0.dishes).reduce((a, b) => a + b, 0), 'подарки от друзей', s.dishes);
    await wait(1500);
    if ((await panelText()).includes('Все гости в сборе')) await page.click('.overlay .btn:has-text("Задуть свечи")');
    else {
      // окно уже закрыли — торт предлагает гость
      expect((await hol()).day.asked === 1, 'окна «Все гости в сборе» не было');
      await ev((id) => { window.__dev.run('guest:' + id); }, s.guests[0]);
      await wait(600);
      await page.click('.dialog .btn:has-text("Задуть свечи")');
    }
    await wait(500);
    await tapThrough();
    await wait(1200);
    const fin = await panelText();
    expect(fin.includes('Год в городе') && fin.includes('Все праздничные занятия сделаны') && fin.includes('подарки от друзей') && fin.includes('Значок «Ореховая Гавань»'), 'праздничное окно «Года в городе»', fin.slice(0, 300));
    await closeAll();
    s = await state();
    h = await hol();
    expect(h.done && h.rewarded && s.stickers.includes('x_hol_birthday') && s.flags['hol:birthday'] === 2 && s.clothes.includes('badge_nut'), '«Год в городе» сделан, значок в шкафу', h);
    await unwatch();
  });

  await step('праздники: реплики жителей на 1 Мая, Купалу, Хеллоуин и «Год в городе»', async () => {
    const line = (id) => ev((id) => window.__dev.F.holidayLineFor(id), id);
    for (const [id, when, re] of [
      ['mayday', 'eve', /1 Мая|шарик|флажк/],
      ['mayday', 'day', /весны|цветы|шарики|субботник/i],
      ['kupala', 'day', /Купал|обрызгаю|Костёр|венок/i],
      ['halloween', 'eve', /Хеллоуин|привидени|конфеты|тыковкой/i],
      ['halloween', 'day', /Сладость|тыква|конфетами/i],
      ['birthday', 'day', /Ореховой Гавани|подарок|чемоданом/i],
    ]) {
      await toHoliday(id, when, id === 'birthday' ? 2 : 1);
      const l = await line('plusha');
      expect(re.test(l || ''), `реплика ${id}/${when}`, l);
    }
  });
};

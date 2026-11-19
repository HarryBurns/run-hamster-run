// Шаги автотеста про этап 15 «Праздники шире площади»: жители в праздничных нарядах и празднуют вместе (каток,
// хоровод у ёлки, танцы у дракона, парад в парке, хоровод у костра, хозяева у дверей вечером — колядки и «сладость
// или гадость» из разговора), праздник в разных местах города (звёздочка ведёт в парк и на пляж, каток), украшения
// в других местах и в домах, салют с башни, праздничная полка в ТЦ «Уютный дом», клумбы субботника на следующий день
// и до конца лета, игрушки на большой ёлке. Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:праздники 15"
const lib = require('./lib.js');

module.exports = async function holidaysWide(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    norm,
    expect,
    state,
    panelText,
    watch,
    unwatch,
    fresh: newGame,
    go,
    untilPanel,
  } = lib(ctx);
  const hol = () => ev(() => window.__dev.holiday.state());
  const decor = () => ev(() => window.__dev.holiday.decor());
  const fresh = () => newGame({ money: 20000, flags: { questsEarly: 0 } }); // 1 июня
  /** К празднику (when: eve | day | after), в сцену scene (по умолчанию город), время — минуты. */
  const toHoliday = async (id, when = 'day', minutes = 600, scene = 'world') => {
    await closeAll();
    await ev(
      ([id, when, minutes, scene]) => {
        const d = window.__dev;
        d.holiday.to(id, when, 1, minutes);
        d.go(scene);
      },
      [id, when, minutes, scene],
    );
    await wait(700);
    await closeAll();
  };
  /** Жители, что празднуют, — все ли в области [x0, y0, x1, y1] (клетки). */
  const crewIn = (crew, [x0, y0, x1, y1]) => crew.every((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1);

  await step(
    'праздники 15: жители в праздничных нарядах и празднуют вместе — каток и хоровод у ёлки, танцы у дракона, парад в парке, хоровод у костра, хозяева у дверей',
    async () => {
      await fresh();
      // обычный день — обычная одежда; в праздник — праздничная (и в разговоре)
      expect(
        (await ev(() => window.__dev.holiday.dress('plusha'))).head !== 'hat_santa',
        'в обычный день — без колпака',
      );
      await toHoliday('newyear', 'day', 12 * 60);
      expect((await ev(() => window.__dev.holiday.dress('plusha'))).head === 'hat_santa', 'на Новый год — колпак');
      expect(
        (await ev(() => window.__dev.holiday.dress('busya'))).head === 'earmuffs_snow',
        'у Буси — наушники-снежки',
      );
      await wait(1500);
      let c = (await decor()).crowd;
      expect(
        c.kind === 'skate' && c.crew.length >= 4 && crewIn(c.crew, [35.5, 35.5, 45.5, 41.5]),
        'днём — каток на пруду в парке',
        c,
      );
      // вечером — идут к ёлке (пешком: от катка до площади несколько секунд)
      await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 18 * 60 + 30)));
      await wait(1500);
      c = (await decor()).crowd;
      expect(c.kind === 'ring' && c.crew.length >= 4, 'вечером — хоровод у ёлки', c);
      // пришла в город, когда хоровод уже идёт, — все уже у ёлки
      await toHoliday('newyear', 'day', 18 * 60 + 40);
      await wait(1500);
      c = (await decor()).crowd;
      expect(
        crewIn(
          c.crew.filter((q) => Math.abs(q.x - 44.5) < 5),
          [41.5, 21.5, 47.5, 25],
        ) && c.crew.filter((q) => Math.abs(q.x - 44.5) < 3.2 && Math.abs(q.y - 23.2) < 1.6).length >= 3,
        'хоровод — вокруг ёлки',
        c,
      );
      // Китайский Новый год — танцоры у дракона, красное
      await toHoliday('cny', 'day', 13 * 60);
      c = (await decor()).crowd;
      expect(c.kind === 'dance' && crewIn(c.crew, [41, 21, 51, 26.5]), 'танцуют у дракона', c);
      expect((await ev(() => window.__dev.holiday.dress('plusha'))).body === 'dress_qipao', 'красный наряд у Плюши');
      // 1 Мая — парад вокруг пруда в парке
      await toHoliday('mayday', 'day', 11 * 60);
      c = (await decor()).crowd;
      expect(c.kind === 'parade' && crewIn(c.crew, [33.5, 32.5, 47.5, 44.5]), 'парад — вокруг пруда в парке', c);
      // Купала — хоровод у костра на пляже
      await toHoliday('kupala', 'day', 19 * 60);
      c = (await decor()).crowd;
      expect(c.kind === 'ring' && crewIn(c.crew, [46, 51.5, 53, 55]), 'хоровод у костра', c);
      // Хеллоуин вечером — хозяева в костюмах у своих дверей; «сладость или гадость» — из разговора (Пр5)
      await toHoliday('halloween', 'day', 17 * 60);
      c = (await decor()).crowd;
      const homes = await ev(() =>
        Object.fromEntries(window.__dev.topdown.getLocation('world').npcs.map((n) => [n.id, n.home])),
      );
      expect(
        c.kind === 'doors' &&
          c.crew.length >= 4 &&
          c.crew.every((q) => homes[q.id] && q.tx === homes[q.id][0] && q.ty === homes[q.id][1]),
        'вечером хозяева — у своих дверей',
        [c, homes],
      );
      expect((await ev(() => window.__dev.holiday.dress('ponchik'))).head === 'hat_pumpkin', 'Пончик — тыковка');
      await watch();
      await ev(() => {
        window.__dev.run('npc:plusha');
      });
      await page.waitForSelector('.dialog .btn:has-text("Сладость")', { timeout: 4000 });
      await wait(380); // кнопки диалога принимают нажатия не сразу (ui/dialog.js, TAP_GUARD)
      await page.click('.dialog .btn:has-text("Сладость")');
      // сценка у двери, потом хозяйка угощает — она ждала у двери, а не «забежала домой за угощением»
      const said = await page
        .waitForSelector('.dialog >> text=/жду у двери/', { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      expect(
        said,
        'хозяйка угощает у двери — не «забежала домой»',
        norm(await ev(() => (document.querySelector('.dialog') || {}).textContent || '')),
      );
      await closeAll();
      const h = await hol();
      expect(h.steps[1] === 'treats:1/3', '«сладость или гадость» из разговора засчитана', h);
      await unwatch();
      // в доме жителя — тоже в костюме
      await go('home_plusha');
      expect((await ev(() => window.__dev.holiday.dress('plusha'))).acc === 'cape_violet', 'Плюша в мантии и дома');
      // наутро после праздника — обычная одежда, никто никуда не собирается
      await toHoliday('halloween', 'after', 17 * 60);
      expect(
        (await ev(() => window.__dev.holiday.dress('ponchik'))).head !== 'hat_pumpkin' && !(await decor()).crowd.kind,
        'после праздника — как обычно',
      );
    },
  );

  await step(
    'праздники 15: праздник в разных местах города — каток в парке, фонарики на пляже, парад и тыквы в парке; звёздочка ведёт туда',
    async () => {
      await fresh();
      const at = (id) =>
        ev((id) => {
          const p = window.__dev.topdown.getLocation('world').whereIs(id);
          return p ? { x: p.x / 48, y: p.y / 48 } : null;
        }, id);
      const PARK = (p) => p && p.x > 32 && p.x < 49 && p.y > 29 && p.y < 46,
        BEACH = (p) => p && p.y > 49.5 && p.y < 57;
      await toHoliday('newyear', 'day', 12 * 60);
      expect(PARK(await at('rink')), 'каток — в парке', await at('rink'));
      await ev(() => {
        window.__dev.run('holiday:rink');
      });
      await wait(3900);
      await toHoliday('cny', 'day');
      expect(BEACH(await at('skylanterns')), 'небесные фонарики — с пляжа', await at('skylanterns'));
      expect((await hol()).steps[0] === 'lanterns:0/1', 'шаг фонариков');
      await toHoliday('halloween', 'day');
      expect(PARK(await at('pumpkins')), 'тыквы — в парке', await at('pumpkins'));
      await toHoliday('mayday', 'day');
      expect(PARK(await at('balloons')), 'тележка с шариками — в парке', await at('balloons'));
      // звёздочка: клумбы посажены — ведёт к тележке в парке
      await ev(() => window.__dev.actions.setDayFlag('plant', [0, 1, 2], 'holiday'));
      await ev(() => window.__dev.F.showHolidayOnMap());
      await wait(400);
      await closeAll();
      const t = await ev(() => {
        const p = window.__dev.topdown.getLocation('world').target();
        return p ? { x: p.x / 48, y: p.y / 48 } : null;
      });
      expect(PARK(t), 'звёздочка парада — в парке', t);
      expect(
        norm(await ev(() => window.__dev.G.state && JSON.stringify(window.__dev.holiday.state().steps))).includes(
          'parade:0/1',
        ),
        'шаг парада',
      );
      // из леса звёздочка ведёт к дороге в город («карта мира»)
      await go('forest');
      const ft = await ev(() => window.__dev.topdown.getLocation('forest').target());
      expect(!!ft, 'из леса — звёздочка к дороге в город', ft);
    },
  );

  await step('праздники 15: украшения в лесу, на горе, на острове, в домах и в отеле; салют с башни', async () => {
    await fresh();
    await toHoliday('newyear', 'eve', 12 * 60, 'forest');
    expect((await ev(() => window.__dev.holiday.lands('forest'))).includes('hFirMini'), 'в лесу — ёлочка');
    await toHoliday('cny', 'day', 12 * 60, 'mountain');
    expect(
      (await ev(() => window.__dev.holiday.lands('mountain'))).includes('hLanternPost'),
      'на горе — красные фонарики',
    );
    await toHoliday('halloween', 'day', 12 * 60, 'island');
    expect((await ev(() => window.__dev.holiday.lands('island'))).includes('hJack'), 'на острове — тыквы');
    await toHoliday('kupala', 'day', 12 * 60, 'island');
    expect(
      (await ev(() => window.__dev.holiday.lands('island'))).includes('hFlowerBasket'),
      'на острове на Купалу — корзинка с венками',
    );
    expect(!(await ev(() => window.__dev.holiday.lands('island'))).includes('hJack'), 'тыквы убрали');
    // в обычный день — ничего
    await ev(() => window.__dev.actions.mutate((s) => (s.day = 15)));
    expect(!(await ev(() => window.__dev.holiday.lands('island'))).length, '1 июня на острове без украшений');
    for (const [hol, scene] of [
      ['newyear', 'villa'],
      ['halloween', 'home_plusha'],
      ['cny', 'hotel'],
    ]) {
      await toHoliday(hol, 'day', 12 * 60, scene);
      await wait(400);
      const r = await ev(() => window.__dev.holiday.rooms());
      expect(r.holiday === hol && r.rooms >= 1, `в доме ${scene} — украшения ${hol}`, r);
    }
    // салют: в новогоднюю ночь — и с площадки башни
    await toHoliday('newyear', 'day', 21 * 60 + 30, 'tower');
    expect(await ev(() => window.__dev.holiday.towerFireworks()), 'с башни виден салют');
    await toHoliday('newyear', 'day', 12 * 60, 'tower');
    expect(!(await ev(() => window.__dev.holiday.towerFireworks())), 'днём салюта нет');
  });

  await step('праздники 15: праздничная полка в ТЦ, клумбы субботника на следующий день и до конца лета', async () => {
    await fresh();
    // обычный день — полки нет
    await ev(() => {
      window.__dev.run('home-mall');
    });
    await untilPanel();
    expect(!(await panelText()).includes('К празднику'), '1 июня полки «К празднику» нет');
    await closeAll();
    await toHoliday('newyear', 'eve');
    await watch();
    await ev(() => {
      window.__dev.run('home-mall');
    });
    await untilPanel();
    expect(
      (await panelText()).includes('Скоро Новый год') &&
        (await ev(() => !!document.querySelector('.card.fest-fest_fir'))),
      'полка к Новому году — ёлочка',
    );
    await page.click('.card.fest-fest_fir .btn');
    await wait(300);
    await closeAll();
    expect(((await state()).storage.fest_fir || 0) === 1, 'ёлочка — в кладовке');
    await unwatch();
    await toHoliday('halloween', 'day');
    await ev(() => {
      window.__dev.run('home-mall');
    });
    await untilPanel();
    expect(await ev(() => !!document.querySelector('.card.fest-fest_jack')), 'полка к Хеллоуину — тыква-фонарик');
    await closeAll();
    // клумбы субботника: посадила на 1 Мая — цветут и назавтра (поле mayBeds), клетка занята; осенью — нет
    await toHoliday('mayday', 'day');
    await watch();
    await ev(() => {
      window.__dev.run({ do: 'holiday', arg: 'plant', bed: 0 });
    });
    await page.waitForSelector('.hol-scene-panel .panel-body .btn');
    for (let i = 0; i < 3; i++) {
      await page.click('.hol-scene-panel .panel-body .btn');
      await wait(160);
    }
    await page.click('.hol-scene-panel .panel-body .btn:has-text("Ура")');
    await wait(400);
    await unwatch();
    const s = await state();
    expect(s.mayBeds.y === 1 && s.mayBeds.b.includes(0), 'клумба — в сохранении', s.mayBeds);
    await toHoliday('mayday', 'after');
    let d = await decor();
    expect(d.beds.includes(0) && !d.active.includes('mayday') && !d.stuck.length, 'на следующий день клумба цветёт', d);
    expect(!(await ev(() => window.__dev.topdown.getLocation('world').map.foot(44, 22))), 'на клумбу не наступить');
    await ev(() => window.__dev.actions.mutate((s) => (s.day = 23)));
    expect((await decor()).beds.includes(0), 'в конце лета — ещё цветёт');
    await ev(() => window.__dev.actions.mutate((s) => (s.day = 24)));
    d = await decor();
    expect(
      !d.beds.length && (await ev(() => window.__dev.topdown.getLocation('world').map.foot(44, 22))),
      'осенью клумбы нет, клетка свободна',
      d,
    );
  });
};

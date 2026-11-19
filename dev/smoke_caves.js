// Шаги автотеста про пещеры (П.9): задание Профессора Орешкина «Свет под горой» от взятия до сдачи (урок, фонарик
// в ТЦ «Уютный дом», «уже было» — засчитано сразу), вход на горе закрыт / открыт; всё важное достижимо пешком,
// карта пещер, спрайты, темнота и фонарик; светящиеся грибы, древние рисунки, озеро, летучие мыши, шкатулка
// самоцветов и грибной ночник, самоцветы на рынке; «Кристаллы» до конца с добычей; задание Камушкина
// «Счастливая кирка»; сохранение и загрузка в пещерах, выход на гору, «Домой». Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:пещеры
const lib = require('./lib.js');

module.exports = async function caves(ctx) {
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
  /** В пещеры (открыв лес, гору и пещеры действием openLand), с фонариком; полдень. */
  const toCaves = async (tx = 17, ty = 20, lamp = true) => {
    await closeAll();
    await ev(
      ([tx, ty, lamp]) => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain', 'caves']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = 12 * 60;
          s.weather = 'sun';
          s.dayFlags = {};
          s.flags.cavesHint = 1;
          if (lamp) s.finds.flashlight = 1;
          else delete s.finds.flashlight;
        });
        d.go('caves');
        d.locations.caves.debugTeleport(tx, ty);
      },
      [tx, ty, lamp],
    );
    await untilScene('caves');
    await frames(2);
  };
  /** Поговорить с Камушкиным; если он предлагает задание — «Потом». */
  const talkK = async () => {
    await L.run('miner', 500);
    if (
      await ev(
        () => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent),
      )
    ) {
      await tap('.dialog .btn >> text=Потом', 450);
    }
  };
  await step(
    'пещеры: задание Профессора Орешкина «Свет под горой» — вход закрыт, урок, фонарик, сдача, пещеры открыты',
    async () => {
      await fresh();
      // гора открыта, пещеры — нет: на горе вход с досками, окно — про Профессора
      await ev(() => {
        const d = window.__dev;
        d.actions.openLand('forest');
        d.actions.openLand('mountain');
        d.actions.mutate((s) => {
          s.dayFlags = {};
          s.minutes = 12 * 60;
          s.plays.teacher = 0;
          delete s.finds.flashlight;
        });
        d.go('mountain');
        d.locations.mountain.debugTeleport(29, 7);
      });
      await untilScene('mountain');
      await frames(2);
      await L.run('way:caves', 500);
      expect(
        /Пещеры/.test(await panelText()) && /Орешкин/.test(await panelText()),
        'окно у закрытого входа',
        await panelText(),
      );
      await closeAll();
      expect((await where()).scene === 'mountain', 'закрытый вход пустил в пещеры');
      await watch();
      await go('world');
      const now = () => ev(() => window.__dev.QuestState.questNow('cave_light'));
      expect((await ev(() => window.__dev.QuestState.questBadge('prof'))) === '!', 'над Профессором нет «!»');
      await L.run('npc:prof', 500);
      expect(
        /пещеры/.test(await dialogText()) && /фонарик/.test(await dialogText()),
        'Профессор не предлагает задание',
        await dialogText(),
      );
      await tap('.dialog .btn.green', 400);
      await tap('.dialog .btn.green', 400);
      let w = await now();
      expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
      // звёздочка — к школе
      const tg = await ev(() => {
        const d = window.__dev;
        return { t: d.World.target(), door: d.World.doorOf('school') };
      });
      expect(tg.t && Math.abs(tg.t.x - tg.door.x) < 3, 'звёздочка не у школы', tg);
      // урок в школе (событие мини-игры — как после настоящего урока)
      await ev(() => window.__dev.emit('minigame', { id: 'teacher', stars: 2 }));
      await frames(2);
      w = await now();
      expect(w.i === 1, 'урок не засчитан', w);
      // фонарик — в ТЦ «Уютный дом», вкладка «Для походов»
      const m0 = (await state()).money;
      await L.run('home-mall', 500);
      await tap('.overlay .tabs >> text=Для походов', 300);
      expect(/Фонарик/.test(await panelText()), 'нет фонарика на вкладке', await panelText());
      await tap('.overlay .card.tool-flashlight .btn', 400);
      let s = await state();
      expect(s.finds.flashlight === 1 && s.money === m0 - 300, 'фонарик не куплен', [s.finds, m0 - s.money]);
      expect(
        /Уже в рюкзаке/.test(await panelText()) &&
          !(await ev(() => !!document.querySelector('.overlay .card.tool-flashlight .btn'))),
        'второй фонарик продают',
      );
      await closeAll();
      w = await now();
      expect(
        w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('prof'))) === '?',
        'после фонарика — к Профессору «?»',
        w,
      );
      const s0 = await state();
      await L.run('npc:prof', 500);
      await tap('.dialog .btn.green', 500);
      await tap('.dialog .btn.green', 1500);
      const t = await panelText();
      expect(
        /Задание выполнено/.test(t) && /Юный спелеолог/.test(t) && /Пещеры открыты/.test(t),
        'праздничное окно',
        t,
      );
      await closeAll();
      await unwatch();
      s = await state();
      expect(
        s.quests.cave_light.done === s.day &&
          Number.isFinite(s.lands.caves) &&
          s.money === s0.money + 700 &&
          s.stickers.includes('q_caves'),
        'награда за задание Профессора',
        [s.quests.cave_light, s.lands, s.money - s0.money],
      );
      // урок уже был и фонарик уже есть — оба шага засчитываются сразу, как взяли задание (поле already)
      await ev(() =>
        window.__dev.actions.mutate((st) => {
          delete st.quests.cave_light;
          st.plays.teacher = 1;
        }),
      );
      await L.run('npc:prof', 500);
      await tap('.dialog .btn.green', 400);
      await closeAll();
      expect((await now()).i === 2, 'урок и фонарик «уже были» — не засчитаны сразу', await now());
      // вход на горе открыт: досок нет, way:caves ведёт в пещеры, ко входу gate
      await ev(() => {
        const d = window.__dev;
        d.go('mountain');
        d.locations.mountain.debugTeleport(29, 7);
      });
      await untilScene('mountain');
      await frames(2);
      expect(
        await ev(() => window.__dev.locations.mountain.map.objs.find((o) => o.type === 'caveRock').open()),
        'скала у входа нарисована с досками',
      );
      await L.run('way:caves', 600);
      const r = await where();
      expect(r.scene === 'caves' && near(r, { x: 17.5 * T, y: 27.6 * T }, 30), 'вошли не ко входу пещер', r);
      const saved = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).pos);
      expect(saved.scene === 'caves', 'позиция в сохранении после входа', saved);
    },
  );

  await step('пещеры: всё важное достижимо пешком, карта пещер, спрайты, темнота и фонарик', async () => {
    await toCaves();
    const r = await ev(() => {
      const d = window.__dev,
        sc = d.locations.caves,
        m = sc.map,
        out = [];
      const from = [17, 28];
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
      for (const id of ['grotto', 'hall']) {
        const p = sc.spot(id);
        if (!reachNear(Math.floor(p.x / 48), Math.floor(p.y / 48))) out.push('точка ' + id);
      }
      for (let x = 16; x <= 19; x++) if (!reach(x, 29)) out.push('выход ' + x);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const k = m.at(x, y);
          if ((k === 'caveLake' || k === 'caveWall') && m.foot(x, y)) out.push(`${k} проходима (${x}, ${y})`);
          if ((x === 0 || x === m.w - 1 || y === 0) && k !== 'caveWall') out.push(`край карты не скала (${x}, ${y})`);
        }
      // у пола под каждой скалой — «лицо» стены
      const faces = m.objs.filter((o) => o.type === 'caveFace' || o.type === 'paintWall').length;
      if (faces < 40) out.push('мало стен «лицом»: ' + faces);
      return out;
    });
    expect(!r.length, 'в пещерах не всё достижимо', r);
    await ev(() => {
      window.__dev.F.openMap();
    });
    await untilPanel();
    const t = await panelText();
    expect(
      /Карта пещер/.test(t) &&
        /Древние рисунки/.test(t) &&
        /Кристальная жила/.test(t) &&
        /Подземное озеро/.test(t) &&
        /светящихся грибов/.test(t),
      'карта пещер',
      t,
    );
    await tap('.overlay .opt >> text=Подземное озеро', 400);
    expect(await ev(() => window.__dev.locations.caves.p.path.length > 0), 'по кнопке карты не пошли');
    await closeAll();
    for (const [x, y] of [
      [17, 26],
      [17, 17],
      [8, 15],
      [8, 6],
      [24, 4],
      [29, 17],
      [12, 20],
      [31, 21],
    ]) {
      await ev(([x, y]) => window.__dev.locations.caves.debugTeleport(x, y), [x, y]);
      await wait(80);
    }
    const clipped = await ev(() => window.__dev.locations.caves.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    const g = await ev(() => window.__dev.locations.caves.debugGround());
    expect(g.count > 0 && g.pixels < 12e6, 'кэш земли', g);
    // темнота: слой виден; с фонариком круг большой, выключили — маленький; кнопка 🔦 в HUD
    await ev(() => window.__dev.locations.caves.debugTeleport(17, 20));
    await frames(3);
    const lit = await ev(() => {
      const sc = window.__dev.locations.caves,
        sky = document.getElementById('sky');
      return { sky: !!sky && sky.style.display === 'block', r: sc.desc.gloom(sc).hero[0] };
    });
    expect(lit.sky && lit.r > 200, 'темнота и большой круг света с фонариком', lit);
    expect(/Фонарик/.test(await ev(() => document.querySelector('#hud').textContent)), 'нет кнопки фонарика');
    await page.click('.hud-btns.left .rbtn >> text=Фонарик');
    await until(() => /Включить/.test(document.querySelector('#hud').textContent), undefined, { timeout: 2000 }).catch(
      () => {},
    );
    const off = await ev(() => {
      const sc = window.__dev.locations.caves;
      return { r: sc.desc.gloom(sc).hero[0], hud: document.querySelector('#hud').textContent };
    });
    expect(off.r < 150 && /Включить/.test(off.hud), 'фонарик не выключился', off);
    await page.click('.hud-btns.left .rbtn >> text=Включить');
    await wait(200);
    // без фонарика (старое сохранение) — маленький круг и кнопки нет
    await toCaves(17, 20, false);
    const no = await ev(() => {
      const sc = window.__dev.locations.caves;
      return { r: sc.desc.gloom(sc).hero[0], hud: document.querySelector('#hud').textContent };
    });
    expect(no.r < 150 && !/Фонарик/.test(no.hud), 'без фонарика', no);
    // вышли из пещер — слоя темноты нет
    await go('world');
    // в городе днём слой неба может быть (тени облаков), но не тёмный
    const a = await ev(() => {
      const c = document.getElementById('sky');
      if (!c || c.style.display !== 'block') return 0;
      return c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data[3];
    });
    expect(a < 120, 'темнота осталась в городе', a);
  });

  await step(
    'пещеры: светящиеся грибы, рисунки, озеро, летучие мыши, шкатулка и ночник, самоцветы на рынке — только действия',
    async () => {
      await toCaves(8, 7);
      await watch();
      // светящиеся грибы: сегодня CAVES.shrooms мест; каждый — один раз
      const today = await ev(async () => (await import('/js/locations/caves.js')).shroomsToday());
      expect(today.length === 2, 'сегодня не два гриба', today);
      for (const i of today)
        await ev((i) => {
          window.__dev.run('caves:shroom:' + i);
          window.__dev.run('caves:shroom:' + i);
        }, i);
      await wait(200);
      let s = await state();
      expect(s.finds.glow_shroom === 2, 'светящиеся грибы: по одному с места', s.finds);
      expect(
        !(await ev(
          (today) => window.__dev.locations.caves.places.filter((p) => /^shroom/.test(p.id) && p.when()).length,
          today,
        )),
        'сорванный гриб всё ещё виден',
      );
      // древние рисунки: окно с картинкой, наклейка
      await L.run('caves:paint', 500);
      expect(
        /Древние рисунки/.test(await panelText()) && (await ev(() => !!document.querySelector('.overlay canvas'))),
        'окно рисунков',
      );
      await closeAll();
      // озеро
      await clearToasts();
      await L.run('caves:lake', 200);
      expect(/Подземное озеро/.test(await toasts()), 'озеро', await toasts());
      // летучие мыши: подошли под свод галереи — вспорхнули, наклейка
      await ev(() => window.__dev.locations.caves.debugTeleport(19, 4));
      await frames(3);
      s = await state();
      expect(
        s.stickers.includes('x_cavepaint') && s.stickers.includes('x_bats'),
        'наклейки рисунков и летучих мышей',
        s.stickers,
      );
      // шкатулка самоцветов: один каждого вида; ночник — из трёх грибов
      await ev(() => {
        const a = window.__dev.actions;
        for (const id of ['gem_crystal', 'gem_topaz', 'gem_sapphire', 'gem_ruby']) a.addItem('finds', id, 1);
        a.addItem('finds', 'gem_ruby', 2);
        a.addItem('finds', 'glow_shroom', 1);
        window.__dev.locations.caves.debugTeleport(28, 19);
      });
      await talkK();
      await tap('.dialog .btn >> text=Шкатулка самоцветов', 400);
      await tap('.dialog .btn >> text=Грибной ночник', 400);
      await closeAll();
      s = await state();
      expect(
        s.storage.gem_geode === 1 &&
          s.storage.shroom_lamp === 1 &&
          !s.finds.gem_crystal &&
          s.finds.gem_ruby === 2 &&
          !s.finds.glow_shroom &&
          s.stickers.includes('x_gems'),
        'шкатулка и ночник',
        [s.storage, s.finds],
      );
      // самоцветы берёт рынок (кошелёк торговца — общий)
      const sold = await ev(() => {
        const F = window.__dev.F,
          g = F.sellable().find((q) => q.id === 'gem_ruby');
        if (!g) return null;
        const m0 = window.__dev.G.state.money;
        F.sellGoods(g, 2);
        return { sell: g.sell, got: window.__dev.G.state.money - m0, left: window.__dev.G.state.finds.gem_ruby || 0 };
      });
      expect(sold && sold.sell === 70 && sold.got === 140 && !sold.left, 'рубины на рынке', sold);
      expect(
        !(await ev(() => window.__dev.F.sellable().some((q) => q.id === 'flashlight'))),
        'фонарик продаётся на рынке',
      );
      await unwatch();
    },
  );

  await step('пещеры: «Кристаллы» у Камушкина — до конца, добыча за первые две игры дня', async () => {
    await toCaves(28, 19);
    await ev(() =>
      window.__dev.actions.mutate((s) => (s.quests.lucky_pick = { day: s.day, n: {}, got: {}, done: s.day })),
    );
    const s0 = await state();
    await talkK();
    await tap('.dialog .btn >> text=Добывать кристаллы', 1200);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(
      /Зелёное/.test(intro) &&
        /Серединка/.test(intro) &&
        (await ev(() => document.querySelectorAll('#mg .cr-col img').length)) === 3 &&
        /Добыча Камушкина/.test(intro),
      'правило картинкой',
      intro,
    );
    await mgGo();
    // «стучать в ритм»: бот на странице жмёт пробел, когда кирка над золотой серединкой
    await ev(() => {
      const loop = () => {
        const c = document.querySelector('#mg canvas');
        if (!c || !c.__crystals) return;
        const q = c.__crystals();
        if (q.left <= 0) return;
        const mid = (q.g0 + q.g1) / 2;
        if (q.ready && Math.abs(q.pos - mid) < (q.g1 - q.g0) * 0.35)
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 60000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Добыто кристаллов/.test(end) && /⭐/.test(end), 'итог игры', end);
    await mgDone();
    const s1 = await state();
    const gems = ['gem_crystal', 'gem_topaz', 'gem_sapphire', 'gem_ruby'].reduce(
      (a, id) => a + (s1.finds[id] || 0) - (s0.finds[id] || 0),
      0,
    );
    expect(
      s1.plays.crystals === 1 &&
        s1.best.crystals === 3 &&
        s1.dayFlags.caves.digs === 1 &&
        gems === 3 &&
        s1.money === s0.money + 120,
      'игра записана, добыча на 3★ выдана',
      [s1.plays, s1.best, s1.dayFlags.caves, gems, s1.money - s0.money],
    );
    // вторая — с добычей (на заставке «ещё 1 игра»); закрыли крестиком сразу — ничего
    await ev(() => {
      window.__dev.F.crystalDig();
    });
    await page.waitForSelector(MG_START);
    expect(
      /ещё 1 игра/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'на заставке — сколько игр с добычей',
    );
    await mgClose();
    expect((await state()).money === s1.money, 'закрыли игру — а добыча пришла');
    // две игры уже были — третья для удовольствия
    await ev(() => window.__dev.actions.setDayFlag('digs', 2, 'caves'));
    await ev(() => {
      window.__dev.F.crystalDig();
    });
    await page.waitForSelector(MG_START);
    expect(
      /для удовольствия/.test(norm(await ev(() => document.querySelector('#mg').textContent))),
      'третья игра — без добычи',
    );
    await mgClose();
    await closeAll();
  });

  await step('пещеры: задание Камушкина «Счастливая кирка» — от взятия до сдачи, только действия', async () => {
    await toCaves(28, 19);
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        delete s.quests.lucky_pick;
        s.clothes = s.clothes.filter((id) => id !== 'helmet_lamp');
      }),
    );
    await watch();
    const now = () => ev(() => window.__dev.QuestState.questNow('lucky_pick'));
    expect((await ev(() => window.__dev.QuestState.questBadge('kamushkin'))) === '!', 'над Камушкиным нет «!»');
    await L.run('miner', 500);
    expect(/кирка/.test(await dialogText()), 'Камушкин не предлагает задание', await dialogText());
    await tap('.dialog .btn.green', 400);
    await tap('.dialog .btn.green', 400);
    let w = await now();
    expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
    const tg = await ev(() => window.__dev.locations.caves.target());
    expect(tg && Math.abs(tg.x - 4.5 * 48) < 30, 'звёздочка не ведёт к кирке', tg);
    // нажатие на кирку у озера
    await ev(() => window.__dev.locations.caves.debugTeleport(5, 15));
    await frames(3);
    const k = await ev(() => window.__dev.locations.caves.debugScreen(4.5 * 48, 14.5 * 48));
    await page.mouse.click(k.x, k.y);
    await page.waitForSelector('text=Кирка нашлась', { timeout: 6000 });
    await closeAll();
    w = await now();
    expect(w.i === 1, 'кирка не найдена', w);
    // добыть кристаллы (событие мини-игры — сама игра проверена шагом выше)
    await ev(() => window.__dev.emit('minigame', { id: 'crystals', stars: 1 }));
    await frames(2);
    w = await now();
    expect(
      w.i === 2 && (await ev(() => window.__dev.QuestState.questBadge('kamushkin'))) === '?',
      'после «Кристаллов» — к Камушкину «?»',
      w,
    );
    const s0 = await state();
    await ev(() => {
      window.__dev.locations.caves.debugTeleport(28, 19);
      window.__dev.run('miner');
    });
    await L.untilDialog();
    await tap('.dialog .btn.green', 500);
    await tap('.dialog .btn.green', 1500);
    const t = await panelText();
    expect(/Задание выполнено/.test(t) && /Друг шахтёра/.test(t) && /Каска с фонариком/.test(t), 'праздничное окно', t);
    await closeAll();
    await unwatch();
    const s = await state();
    expect(
      s.quests.lucky_pick.done === s.day &&
        s.money === s0.money + 600 &&
        s.stickers.includes('q_miner') &&
        s.clothes.includes('helmet_lamp'),
      'награда за задание Камушкина',
      [s.quests.lucky_pick, s.money - s0.money],
    );
    await ev(() => window.__dev.actions.wear('head', 'helmet_lamp'));
    expect((await state()).look.outfit.head === 'helmet_lamp', 'каска не надевается');
  });

  await step('пещеры: сохранение и загрузка в пещерах; выход на гору; «Домой» из пещер', async () => {
    await fresh(); // своя новая игра: не опираться на дом и место, оставленные прошлыми шагами
    await toCaves(17, 17);
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const pos = JSON.parse(raw).pos;
    expect(pos.scene === 'caves', 'позиция в сохранении', pos);
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await page.waitForSelector(sel('continue'));
    await L.cont();
    await closeAll();
    let r = await where();
    expect(r.scene === 'caves' && near(r, pos, 30), 'после загрузки — в пещерах на том же месте', [r, pos]);
    expect(await ev(() => document.getElementById('sky').style.display === 'block'), 'после загрузки нет темноты');
    // к свету: выход внизу — на гору, к скале со входом
    await ev(() => window.__dev.locations.caves.walkTo(17.5 * 48, 29.6 * 48, true));
    await L.untilArrive('mountain', 8000).catch(() => {});
    await frames(2);
    r = await where();
    expect(r.scene === 'mountain' && near(r, { x: 29.5 * 48, y: 7.3 * 48 }, 40), 'вышли не на гору к пещерам', r);
    // «Домой» — на виллу
    await go('caves');
    await page.click('.hud-btns.left .rbtn:last-child');
    await page.click('.panel-foot .btn.green');
    await untilScene('villa').catch(() => {});
    expect(
      (await ev(() => window.__dev.sceneName)) === 'villa',
      'кнопка «Домой» из пещер',
      await ev(() => window.__dev.sceneName),
    );
  });
};

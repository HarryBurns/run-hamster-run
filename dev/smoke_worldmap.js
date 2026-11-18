// Шаги автотеста этапа 11 «Карта мира и жители»: звёздочка задания, праздника и письма из любого места ведёт к выходу
// или транспорту в нужную сторону (граф ROUTES в data/places.js), окно «Карта» показывает, в каком месте цель, и
// ведёт туда по кнопке; жители вспоминают открытые места — только после открытия; Профессор слушает про древние
// рисунки; попугай запоминает слово. Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:мир:
const lib = require('./lib.js');

module.exports = async function worldmap(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, closeAll, norm, expect, state, toasts, clearToasts, dialogText, watch, unwatch, until, untilPanel, untilScene, untilDialog, frames } = L;
  const dialogOpts = () => ev(() => [...document.querySelectorAll('.dialog .opts button, .dialog button')].map((b) => b.textContent));
  /** Нажать вариант разговора и дождаться ответа: реплика сменилась (или разговор закрылся), кнопки снова принимают нажатия. */
  const pressOpt = async (text) => {
    const said0 = await ev(() => (document.querySelector('.dialog .say') || {}).textContent || '');
    const ok = await ev((text) => {
      const b = [...document.querySelectorAll('.dialog button')].find((q) => q.textContent.includes(text));
      if (b) b.click();
      return !!b;
    }, text);
    expect(ok, `в разговоре нет кнопки «${text}»`, await dialogOpts());
    await until((b) => !document.querySelector('.dialog .btn') || document.querySelector('.dialog .say').textContent !== b, said0, { timeout: 2000 }).catch(() => {});
    if (await ev(() => !!document.querySelector('.dialog .btn'))) await wait(380);
  };
  const fresh = () => L.fresh(); // 1 июня; день и погоду ставит setup
  /** Полдень тёплого дня, солнце; открыть места ids. */
  const setup = (ids = [], day = 18) =>
    ev(
      ([ids, day]) => {
        const d = window.__dev;
        for (const id of ids) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = 12 * 60;
          s.weather = 'sun';
          s.dayFlags = {};
        });
      },
      [ids, day],
    );
  /** Перейти в сцену и спросить у неё звёздочку: { x, y, to, next, via } | null, а ещё где точка via. */
  const starIn = (scene, via) =>
    ev(
      ([scene, via]) => {
        const d = window.__dev;
        if (d.sceneName !== scene) d.go(scene);
        const sc = d.locations[scene],
          tg = sc.target(),
          at = via ? sc.whereIs(via) : null;
        return { tg: tg && { x: tg.x, y: tg.y, to: tg.to || null, next: tg.next || null, via: tg.via || null }, at };
      },
      [scene, via],
    );
  const ALL = ['forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island'];
  const near = (a, b, r = 6) => !!a && !!b && Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
  /** Звёздочка в месте scene стоит у точки via и ведёт в место next. */
  const leads = async (scene, via, next, what) => {
    const r = await starIn(scene, via);
    expect(r.tg && r.at && near(r.tg, r.at) && r.tg.next === next && r.tg.via === via && r.tg.to, `${what}: звёздочка в «${scene}» не у «${via}» → ${next}`, r);
    await wait(120);
  };

  await step('мир: звёздочка задания из любого места ведёт к выходу или транспорту в нужную сторону, в месте цели — к цели', async () => {
    await fresh();
    await setup(ALL);
    await watch();
    // задание на горе («Потерянная варежка» Вершинкина): город → тропа в лес → канатная дорога → гора
    await ev(() => {
      const d = window.__dev;
      d.actions.takeQuest('lost_mitten');
      d.F.trackQuest('lost_mitten');
    });
    expect((await ev(() => window.__dev.F.starScene())) === 'mountain', 'цель задания — не на горе');
    await leads('world', 'forest', 'forest', 'задание на горе');
    await leads('forest', 'station', 'mountain', 'задание на горе');
    await leads('caves', 'exit:mountain', 'mountain', 'задание на горе');
    await leads('desert', 'stop', 'world', 'задание на горе');
    await leads('jungle', 'dock', 'world', 'задание на горе');
    await leads('cove', 'grotto', 'world', 'задание на горе');
    await leads('island', 'dock', 'world', 'задание на горе');
    // на самой горе — к варежке, без значка «дорога в…»
    const m = await starIn('mountain', 'mitten');
    expect(m.tg && !m.tg.to && near(m.tg, m.at, 80), 'на горе звёздочка не у варежки', m);
    // задание в джунглях: в городе — к кораблику, на кораблике — к причалу за буйками
    await ev(() => {
      const d = window.__dev;
      d.actions.takeQuest('lost_notebook');
      d.F.trackQuest('lost_notebook');
      d.go('world');
    });
    const s = await state();
    let r = await starIn('world');
    expect(r.tg && r.tg.via === 'sea:jungle' && near(r.tg, { x: s.boat.x, y: s.boat.y + 20 }), 'в городе звёздочка не у кораблика', [r, s.boat]);
    await ev(() => {
      const d = window.__dev;
      d.actions.patchState('boat', { x: 66 * 48, y: 95 * 48, on: true });
      d.go('world', { pos: { scene: 'world', x: 66 * 48, y: 95 * 48 } });
    });
    await wait(200);
    expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике');
    r = await starIn('world');
    const port = await ev(() => window.__dev.World.portAt());
    expect(r.tg && near(r.tg, { x: port.x, y: port.y + 30 }) && r.tg.next === 'jungle', 'на кораблике звёздочка не у причала джунглей', [r, port]);
    await unwatch();
    // закрытое место: дороги нет — звёздочки нет (и игра не падает)
    await fresh();
    await setup([]);
    await ev(() => {
      const d = window.__dev;
      d.actions.takeQuest('squirrel_kit');
      d.F.trackQuest('squirrel_kit');
    });
    r = await starIn('world');
    expect(!r.tg || !r.tg.next, 'звёздочка ведёт в закрытый лес', r);
  });

  await step('мир: звёздочка праздника из других мест ведёт в город; окно «Карта» показывает место цели и ведёт туда', async () => {
    await fresh();
    await setup(ALL);
    // праздник (Новый год — ёлка на площади): из леса — к тропе в город, из пещер — к выходу на гору
    await ev(() => {
      const d = window.__dev;
      d.holiday.to('newyear');
      d.F.trackQuest(null);
      d.F.trackHoliday(true);
    });
    await closeAll();
    expect((await ev(() => window.__dev.F.starScene())) === 'world', 'цель праздника — не в городе');
    await leads('forest', 'exit:town', 'world', 'праздник');
    await leads('caves', 'exit:mountain', 'mountain', 'праздник');
    await leads('jungle', 'dock', 'world', 'праздник');
    const r = await starIn('world');
    expect(r.tg && !r.tg.to, 'в городе звёздочка праздника не у цели', r);
    // «Показать на карте» из леса: подсказка с дорогой, окно карты с отметкой ⭐ у города
    await ev(() => window.__dev.go('forest'));
    await closeAll();
    await clearToasts();
    await ev(() => window.__dev.F.showHolidayOnMap());
    await untilPanel();
    expect(/Праздник — в городе.*по тропе в город/.test(await toasts()), 'нет подсказки с дорогой в город', await toasts());
    let row = await ev(() => [...document.querySelectorAll('.overlay .lands-row button')].map((b) => [b.textContent, b.className]));
    // мест восемь и больше (этап 17в добавил «Подземную реку»)
    expect(row.length >= 8 && /Город.*⭐/.test(row[0][0]) && row[0][1].includes('goal'), 'у города на карте мира нет ⭐', row);
    expect(row.some((b) => /Лес.*📍/.test(b[0]) && b[1].includes('here')), 'лес не отмечен «ты здесь»', row);
    await closeAll();
    // задание на горе — на карте леса ⭐ у горы; кнопка ведёт к станции канатной дороги
    await ev(() => {
      const d = window.__dev;
      d.F.trackHoliday(false);
      d.actions.takeQuest('lost_mitten');
      d.locations.forest.debugTeleport(10, 36);
    });
    await clearToasts();
    await ev(() => window.__dev.F.showQuestOnMap('lost_mitten'));
    await untilPanel();
    expect(/в горах.*по канатной дороге/.test(await toasts()), 'нет подсказки с дорогой на гору', await toasts());
    row = await ev(() => [...document.querySelectorAll('.overlay .lands-row button')].map((b) => [b.textContent, b.className]));
    expect(row.some((b) => /Гора.*⭐/.test(b[0]) && b[1].includes('goal')), 'у горы на карте мира нет ⭐', row);
    expect(/Звёздочка ведёт в другое место/.test(await ev(() => document.querySelector('.overlay .lands').textContent)), 'нет строки про место цели');
    await ev(() => [...document.querySelectorAll('.overlay .lands-row button')].find((b) => b.textContent.includes('Гора')).click());
    await wait(300);
    const go = await ev(() => {
      const p = window.__dev.locations.forest.p;
      return { path: p.path.length, b: p.pending && p.pending.b && p.pending.b.id, open: !!document.querySelector('.overlay .lands') };
    });
    expect(go.b === 'station' && !go.open, 'кнопка «Гора» не ведёт к станции канатной дороги', go);
    // из города: кнопка «Гора» ведёт к тропе в лес и говорит дорогу
    await ev(() => {
      const d = window.__dev,
        p = d.locations.forest.p;
      p.path = [];
      p.pending = null;
      d.go('world', { at: 'villa' });
    });
    await untilScene('world');
    await frames(3);
    await clearToasts();
    await ev(() => window.__dev.F.openMap());
    await untilPanel();
    row = await ev(() => [...document.querySelectorAll('.overlay .land')].map((b) => [b.textContent, b.className]));
    expect(row.length >= 7 && /Гора.*⭐/.test(row[2][0]) && !row.some((b, i) => i !== 2 && /⭐/.test(b[0])), 'в городе у горы нет ⭐', row);
    await ev(() => [...document.querySelectorAll('.overlay .land')].find((b) => b.textContent.includes('Гора')).click());
    await wait(300);
    const g2 = await ev(() => {
      const p = window.__dev.locations.world.p;
      return { path: p.path.length, place: p.pending && p.pending.place && p.pending.place.id };
    });
    expect(g2.place === 'forest' && /Лес → .*Гора/.test(await toasts()), 'из города кнопка «Гора» не ведёт к тропе в лес', [g2, await toasts()]);
    await wait(900);
    await ev(() => {
      const p = window.__dev.locations.world.p;
      p.path = [];
      p.pending = null;
    });
    await closeAll();
  });

  await step('мир: жители вспоминают место только после его открытия; Профессор слушает рассказ про древние рисунки', async () => {
    await fresh();
    await setup([], 16);
    await watch(); // день 16 — не праздник: в праздник «Поболтать» — поздравление
    // задания-открытия не мешают разговору: считаем их сделанными (места при этом закрыты)
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        for (const id of ['runway_star', 'cave_light']) s.quests[id] = { day: 1, n: {}, got: {}, done: 1 };
      });
      Math.random = () => 0; // «Поболтать» вспоминает открытое место всегда, если есть что вспомнить
    });
    const talkTable = await ev(async () => (await import('/js/data/index.js')).PLACE_TALK);
    // ни одно место не открыто — ни у кого нет реплик про места
    const before = await ev((ids) => ids.filter((id) => window.__dev.F.placeLines(id).length || window.__dev.F.placeLine(id, true)), Object.keys(talkTable));
    expect(!before.length, 'реплики про закрытые места', before);
    const desert = talkTable.busya.find((e) => e.land === 'desert').lines,
      bell = talkTable.busya.find((e) => e.quest === 'camel_bell').lines;
    // Буся: знакомство, «Поболтать» — про пустыню ни слова
    await ev(() => {
      window.__dev.F.npcDialog('busya');
    });
    await untilDialog();
    await pressOpt('Поболтать');
    let t = await dialogText();
    expect(t.length > 5 && !desert.includes(t) && !/пустын|бархан|караван/i.test(t), 'Буся говорит про закрытую пустыню', t);
    // пустыня открылась — вспоминает барханы; про бубенчик — только после задания Бархана
    await ev(() => window.__dev.actions.openLand('desert'));
    await pressOpt('Поболтать');
    t = await dialogText();
    expect(desert.includes(t), 'Буся не вспоминает открытую пустыню', t);
    let lines = await ev(() => window.__dev.F.placeLines('busya').map((l) => l.text));
    expect(lines.length === desert.length && !lines.some((l) => bell.includes(l)), 'реплика про задание до задания', lines);
    await ev(() => window.__dev.actions.mutate((s) => (s.quests.camel_bell = { day: 1, n: {}, got: {}, done: 1 })));
    lines = await ev(() => window.__dev.F.placeLines('busya').map((l) => l.text));
    expect(bell.every((l) => lines.includes(l)), 'нет реплики про сделанное задание', lines);
    await pressOpt('Пока!');
    // другие жители тоже вспоминают пустыню, а про закрытые джунгли молчат
    const others = await ev(() => ({
      prof: window.__dev.F.placeLines('prof').map((l) => l.text),
      bob: window.__dev.F.placeLines('bob').map((l) => l.text),
      barkhan: window.__dev.F.placeLines('barkhan').length,
    }));
    expect(others.prof.length && others.prof.every((l) => /пустын|ящер/i.test(l)) && others.bob.length === 1 && !others.barkhan, 'кто что вспоминает после открытия пустыни', others);
    // Профессор: пока рисунков не видела — не расспрашивает
    expect(!(await ev(() => window.__dev.F.taleFor('prof'))), 'Профессор расспрашивает про рисунки заранее');
    await ev(() => {
      window.__dev.F.npcDialog('prof');
    });
    await untilDialog();
    expect(!/рисунк/.test(await dialogText()), 'Профессор расспрашивает про рисунки заранее', await dialogText());
    await pressOpt('Пока!');
    // увидела рисунки (наклейка) — Профессор расспрашивает; «потом» — сегодня больше не спрашивает
    await ev(() => {
      window.__dev.actions.award('x_cavepaint', { quiet: true });
    });
    await closeAll();
    const pts0 = (await state()).friends.prof.pts;
    await ev(() => {
      window.__dev.F.npcDialog('prof');
    });
    await untilDialog();
    expect(/древние рисунки/.test(await dialogText()) && (await dialogOpts()).length === 4, 'Профессор не расспрашивает про рисунки', [await dialogText(), await dialogOpts()]);
    await pressOpt('Расскажу потом');
    expect(/любопытства/.test(await dialogText()), 'нет ответа на «потом»', await dialogText());
    await pressOpt('Пока!');
    await ev(() => {
      window.__dev.F.npcDialog('prof');
    });
    await untilDialog();
    expect(!/что там нарисовано/.test(await dialogText()), 'Профессор переспрашивает в тот же день', await dialogText());
    await pressOpt('Пока!');
    // на другой день — рассказываем всё, в любом порядке
    await ev(() => window.__dev.actions.mutate((s) => (s.day += 1)));
    await ev(() => {
      window.__dev.F.npcDialog('prof');
    });
    await untilDialog();
    expect(/что там нарисовано/.test(await dialogText()), 'на другой день Профессор не расспрашивает', await dialogText());
    await pressOpt('колесе');
    expect(/Колесо\?!/.test(await dialogText()) && (await dialogOpts()).length === 2, 'ответ на «хомячок в колесе»', [await dialogText(), await dialogOpts()]);
    await pressOpt('костра');
    await pressOpt('семечкой');
    t = await dialogText();
    expect(/школьную книгу/.test(t) && /исследовательница/.test(t), 'нет благодарности Профессора', t);
    await pressOpt('Рада помочь');
    const s = await state();
    expect(s.flags['tale:cave_paint'] && s.friends.prof.pts === pts0 + 3, 'рассказ не записан или дружба не выросла', [s.flags, s.friends.prof.pts, pts0]);
    // больше не расспрашивает, а в болтовне вспоминает рассказ
    lines = await ev(() => window.__dev.F.placeLines('prof').map((l) => l.text));
    expect(lines.some((l) => /древние рисунки/.test(l)), 'Профессор не вспоминает рассказ', lines);
    await ev(() => {
      window.__dev.F.npcDialog('prof');
    });
    await untilDialog();
    expect(!/что там нарисовано/.test(await dialogText()), 'Профессор расспрашивает второй раз', await dialogText());
    await pressOpt('Пока!');
    await unwatch();
    await closeAll();
  });

  await step('мир: попугай запоминает слово — выбор фразы в разговоре, у каждого попугая свои слова, память на три, сохранение', async () => {
    await fresh();
    await setup(['jungle']);
    await ev(() => {
      const d = window.__dev;
      d.go('jungle');
      d.locations.jungle.debugTeleport(24, 28);
    });
    await untilScene('jungle');
    await frames(3);
    await closeAll();
    await watch();
    const J = () => ev(async () => (await import('/js/locations/jungle.js')).debugParrots());
    const words = await ev(async () => (await import('/js/data/index.js')).PARROT_WORDS);
    const name = (await state()).name;
    const text = (id) => words.find((w) => w.id === id).text.replace(/\{name\}/g, name);
    /** Поболтать с попугаем i и научить его слову id. */
    const teach = async (i, id) => {
      await ev((i) => {
        window.__dev.run({ do: 'jungle', arg: 'parrot', i });
      }, i);
      await untilPanel();
      const ok = await ev(() => {
        const b = [...document.querySelectorAll('.overlay .panel button')].find((q) => q.textContent.includes('Научить слову'));
        if (b) b.click();
        return !!b;
      });
      expect(ok, 'в разговоре с попугаем нет кнопки «Научить слову»');
      await page.waitForSelector('.overlay .parrot-words button');
      const n = await ev(() => document.querySelectorAll('.overlay .parrot-words button').length);
      expect(n === words.length, 'в окне не все фразы', n);
      await ev((t) => [...document.querySelectorAll('.overlay .parrot-words button')].find((b) => b.textContent.includes(t)).click(), text(id));
      await wait(400);
    };
    expect(JSON.stringify((await state()).parrots) === '{}', 'попугаи что-то знают в новой игре', (await state()).parrots);
    await clearToasts();
    await teach(0, 'seed');
    let s = await state();
    expect(JSON.stringify(s.parrots) === '{"0":["seed"]}' && /запомнил/.test(await toasts()), 'попугай не запомнил слово', [s.parrots, await toasts()]);
    expect((await J())[0].text === text('seed') && (await J())[0].on, 'попугай не повторил слово сразу', await J());
    // сам повторяет: из двух фраз подряд одна — выученная; чужих слов не говорит
    const said = await ev(async () => {
      const m = await import('/js/locations/jungle.js');
      return [m.parrotSay(0), m.parrotSay(0), m.parrotSay(1), m.parrotSay(1)];
    });
    expect(said.slice(0, 2).includes(text('seed')) && !said.slice(2).includes(text('seed')), 'попугай не повторяет выученное (или повторяет чужое)', said);
    await closeAll();
    // второй попугай — свои слова (с именем хомячка); память — три последних
    await teach(1, 'friend');
    expect((await J())[1].text.includes(name), 'в слове попугая нет имени хомячка', await J());
    await closeAll();
    for (const id of ['good', 'tickle', 'song']) {
      await teach(0, id);
      await closeAll();
    }
    s = await state();
    expect(JSON.stringify(s.parrots) === '{"0":["good","tickle","song"],"1":["friend"]}', 'память попугаев', s.parrots);
    await unwatch();
    // сохранение и загрузка: слова на месте, незнакомые слова из сохранения выбрасываются
    const raw = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    const sv = JSON.parse(raw);
    expect(sv.parrots && sv.parrots[0].length === 3, 'слова не попали в сохранение', sv.parrots);
    sv.parrots[2] = ['nope', 'seed'];
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
    }, JSON.stringify(sv));
    await page.reload();
    await page.waitForSelector(L.sel('continue'));
    await L.cont();
    await closeAll();
    s = await state();
    expect(JSON.stringify(s.parrots) === '{"0":["good","tickle","song"],"1":["friend"],"2":["seed"]}', 'слова после загрузки', s.parrots);
    // старое сохранение без поля — попугаи просто ничего не знают
    delete sv.parrots;
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
    }, JSON.stringify(sv));
    await page.reload();
    await page.waitForSelector(L.sel('continue'));
    await L.cont();
    await closeAll();
    expect(JSON.stringify((await state()).parrots) === '{}', 'старое сохранение без слов попугаев', (await state()).parrots);
  });
};

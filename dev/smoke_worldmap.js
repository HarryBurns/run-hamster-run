// Шаги автотеста этапа 11 «Карта мира и жители»: звёздочка задания, праздника и письма из любого места ведёт к выходу
// или транспорту в нужную сторону (граф ROUTES в data/places.js), окно «Карта» показывает, в каком месте цель, и
// ведёт туда по кнопке; жители вспоминают открытые места — только после открытия; Профессор слушает про древние
// рисунки; попугай запоминает слово. Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:мир:
module.exports = async function worldmap({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const dialogOpts = () => ev(() => [...document.querySelectorAll('.dialog .opts button, .dialog button')].map((b) => b.textContent));
  const pressOpt = async (text) => {
    const ok = await ev((text) => {
      const b = [...document.querySelectorAll('.dialog button')].find((q) => q.textContent.includes(text));
      if (b) b.click();
      return !!b;
    }, text);
    expect(ok, `в разговоре нет кнопки «${text}»`, await dialogOpts());
    await wait(450);
  };
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
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
  const watch = () =>
    ev(() => {
      window.__stopWatchWorld = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchWorld());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
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
    await wait(500);
    expect(/Праздник — в городе.*по тропе в город/.test(await toasts()), 'нет подсказки с дорогой в город', await toasts());
    let row = await ev(() => [...document.querySelectorAll('.overlay .lands-row button')].map((b) => [b.textContent, b.className]));
    expect(row.length === 8 && /Город.*⭐/.test(row[0][0]) && row[0][1].includes('goal'), 'у города на карте мира нет ⭐', row);
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
    await wait(500);
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
    await wait(900);
    await clearToasts();
    await ev(() => window.__dev.F.openMap());
    await wait(500);
    row = await ev(() => [...document.querySelectorAll('.overlay .land')].map((b) => [b.textContent, b.className]));
    expect(row.length === 7 && /Гора.*⭐/.test(row[2][0]), 'в городе у горы нет ⭐', row);
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

  // ШАГИ_ЖИТЕЛИ
};

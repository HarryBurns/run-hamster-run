// Шаги автотеста этапа 14 «Мини-игры вместо сценок»: каждая новая или изменённая игра открывается, играется через
// свой dev-хук (canvas.__<игра>) до итога со звёздами:
//   «Горка» — четыре трассы с разным рисунком поворотов (От5);  «Носильщица» — кнопки этажей в лифте (От6);
//   «Спуск» — выбор «лыжи», ворота-флажки (Г4);  «Перетягивание каната» — друзья с сердечками помогают (Пр12);
//   «Нарядим ёлку» — сама выбираешь игрушку и место, звезда на макушку (Пр8);  «Танец у костра» — ритм под барабан
//   Бума (О8);  «Повтори движение» — аниматор Хлопушка в отеле (От9).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:игры 14:"
module.exports = async function games({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
  const mgText = async () => norm(await ev(() => (document.querySelector('#mg') || { textContent: '' }).textContent));
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
    await mutate('s.minutes = 12 * 60; s.day = 18; s.weather = "sun"; s.flags.hotelHint = 1;');
  };
  /** Состояние игры из dev-хука канвы (name — имя хука: __slide, __porter…). */
  const hook = (name) =>
    ev((name) => {
      const c = [...document.querySelectorAll('#mg canvas')].find((q) => q[name]);
      return c ? c[name]() : null;
    }, name);
  /** Прямоугольник канвы игры на экране (для кликов по CSS-пикселям канвы). */
  const box = () =>
    ev(() => {
      const c = [...document.querySelectorAll('#mg canvas')].pop();
      const b = c.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    });
  const tapAt = async (x, y, w, h) => {
    const r = await box();
    await page.mouse.click(r.x + x * (r.w / w), r.y + y * (r.h / h));
  };
  const start = async () => {
    await page.click('#mg .btn.green');
    await wait(300);
  };
  const ura = async () => {
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 15000 });
    const t = await mgText();
    await page.click('#mg >> text=Ура!');
    await wait(500);
    await closeAll();
    return t;
  };

  await step('игры 14: «Горка» — четыре трассы с разным рисунком поворотов, выбор картинкой, спуск до итога', async () => {
    await fresh();
    // рисунки поворотов разные: центры трубы в одних и тех же точках у трасс не совпадают
    const prof = await ev(async () => {
      const m = await import('/js/minigames/slide.js');
      return m.TRACKS.map((q) => ({ id: q.id, c: [0.7, 2.1, 3.5, 6, 9.4, 14, 20].map((u) => +q.c(u).toFixed(3)) }));
    });
    expect(prof.length === 4, 'трасс не четыре', prof);
    for (let i = 0; i < prof.length; i++)
      for (let j = i + 1; j < prof.length; j++) {
        const diff = prof[i].c.reduce((a, v, k) => a + Math.abs(v - prof[j].c[k]), 0);
        expect(diff > 0.3, `трассы ${prof[i].id} и ${prof[j].id} почти одинаковые`, [prof[i], prof[j]]);
      }
    expect(prof.every((q) => q.c.every((v) => v > 0.22 && v < 0.78)), 'труба уходит за край', prof);
    const s0 = await state();
    await ev(() => {
      window.__dev.run('hotel:slide');
    });
    await wait(800);
    expect(/Детская/.test(await mgText()) && /Тайфун/.test(await mgText()), 'на заставке не названы горки', await mgText());
    await start();
    let st = await hook('__slide');
    expect(st && st.picking && st.t === 0, 'нет выбора трассы', st);
    await wait(500);
    expect((await hook('__slide')).t === 0, 'игра идёт до выбора трассы');
    await page.click('#mg .sd-pick button[data-track="zigzag"]');
    await wait(300);
    st = await hook('__slide');
    expect(st.track === 'zigzag' && !st.picking && !(await ev(() => !!document.querySelector('#mg .sd-pick'))), 'трасса не выбрана', st);
    await wait(800);
    st = await hook('__slide');
    expect(st.t > 0.3, 'после выбора игра не пошла', st);
    await ev(() => [...document.querySelectorAll('#mg canvas')].find((q) => q.__slideSkip).__slideSkip(1.5));
    const end = await ura();
    expect(/Зигзаг/.test(end) && /бассейн/.test(end), 'итог без названия трассы', end);
    const s1 = await state();
    expect(s1.plays.slide === 1 && s1.money > s0.money, 'спуск не записан', [s1.plays, s1.money - s0.money]);
  });

  await step('игры 14: «Носильщица» — на опытной смене кнопки этажей в лифте: не тот этаж — подсказка, итог', async () => {
    await fresh();
    // новичку лифт возит сам
    await mutate('s.plays.porter = 0;');
    await ev(() => {
      window.__dev.F.playMinigame('porter');
    });
    await wait(700);
    await start();
    let st = await hook('__porter');
    expect(st && !st.lift && !st.buttons.length, 'у новичка кнопки лифта', st);
    await page.click('#mg .xbtn');
    await wait(400);
    await closeAll();
    // опытная смена (сыграно 4 → уровень 2): этаж — кнопкой
    const s0 = await state();
    await mutate('s.plays.porter = 4;');
    await ev(() => {
      window.__dev.F.playMinigame('porter');
    });
    await wait(700);
    expect(/Лифт/.test(await mgText()), 'на заставке нет правила про лифт', await mgText());
    await start();
    st = await hook('__porter');
    expect(st.lift && st.buttons.length === 3 && st.at === 1, 'нет кнопок лифта на опытной смене', st);
    // дверь из холла — подсказка «сначала в лифт», не ошибка
    const d0 = st.doors.find((q) => q.n === st.tag);
    await tapAt(d0.x, d0.y, st.w, st.h);
    await wait(300);
    st = await hook('__porter');
    expect(st.at === 1 && st.mistakes === 0 && !st.busy, 'дверь из холла сработала', st);
    let wrongFloor = false;
    for (let k = 0; k < 120; k++) {
      st = await hook('__porter');
      if (!st || !st.tag) break;
      if (!st.busy) {
        const want = Math.floor(st.tag / 100);
        if (st.at !== want) {
          const b = !wrongFloor ? st.buttons.find((q) => q.f !== want && q.f !== 1 && q.f !== st.at) : st.buttons.find((q) => q.f === want);
          wrongFloor = true;
          await tapAt(b.x, b.y, st.w, st.h);
        } else {
          const d = st.doors.find((q) => q.n === st.tag);
          await tapAt(d.x, d.y, st.w, st.h);
        }
      }
      if (/Ура!/.test(await mgText())) break;
      await wait(200);
    }
    const end = await ura();
    expect(/чемоданов на месте/.test(end) && /этажом в лифте — 1/.test(end) && /ошибок дверью — 0/.test(end), 'итог смены с лифтом', end);
    const s1 = await state();
    expect(s1.plays.porter === 5 && s1.money > s0.money, 'смена не записана', [s1.plays.porter, s1.money - s0.money]);
  });

  await step('игры 14: «Спуск» на горе — выбор «санки или лыжи», на лыжах ворота-флажки, итог по воротам', async () => {
    await fresh();
    await mutate('s.mail = null;');
    const s0 = await state();
    await ev(() => {
      window.__dev.F.sledRide();
    });
    await wait(800);
    expect(/лыжах/.test(await mgText()), 'на заставке нет лыж', await mgText());
    await start();
    let st = await hook('__sled');
    expect(st && st.picking && !st.ride, 'нет выбора «санки или лыжи»', st);
    expect((await ev(() => document.querySelectorAll('#mg .sl-pick button img').length)) === 2, 'у выбора нет картинок');
    await page.click('#mg .sl-pick button[data-ride="ski"]');
    // едем к воротам: держим лыжи посередине ближайших ворот
    const t0 = Date.now();
    while (Date.now() - t0 < 14000) {
      st = await hook('__sled');
      const gate = st.gates.filter((g) => g.y < st.y + 5).sort((a, b) => b.y - a.y)[0];
      const target = gate ? gate.x : 0.5;
      const r = await box();
      await page.mouse.move(r.x + (st.x0 + target * st.lw) * (r.w / st.w), r.y + r.h * 0.8);
      await wait(90);
    }
    st = await hook('__sled');
    expect(st.ride === 'ski' && st.gatesAll >= 6 && st.gatesOk >= 4 && st.got >= st.gatesOk * 2, 'ворота не проходятся', st);
    await ev(() => [...document.querySelectorAll('#mg canvas')].find((q) => q.__sledSkip).__sledSkip(1));
    const end = await ura();
    expect(/На лыжах/.test(end) && /ворот пройдено/.test(end) && /Приз/.test(end), 'итог лыж', end);
    const s1 = await state();
    expect(s1.plays.sled === 1 && s1.dayFlags.mountain.sleds === 1 && s1.money > s0.money, 'спуск на лыжах не записан', [s1.plays, s1.money - s0.money]);
  });

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
  /** Канат: дождаться полного кружка, рывок пробелом; вернуть, насколько сдвинулась ленточка. */
  const tugPull = async () => {
    for (let i = 0; i < 80; i++) {
      const g = await hook('__tug');
      if (g.full && g.phase === 'go') break;
      await wait(30);
    }
    const a = await hook('__tug');
    await page.keyboard.press('Space');
    await wait(60);
    const b = await hook('__tug');
    return a.p - b.p;
  };

  await step('игры 14: «Перетягивание каната» — в команде друзья с сердечками, рывок сильнее, без нажатий всё равно не выиграть', async () => {
    await fresh();
    await toHoliday('maslenitsa', 'day');
    // без дружбы: в команде трое без сердечек, рывок обычный
    await ev(() => {
      window.__dev.run('holiday:tug');
    });
    await wait(800);
    let t = await mgText();
    expect(/В твоей команде/.test(t) && /Подружись/.test(t), 'на заставке нет команды', t);
    await start();
    await wait(900);
    let g = await hook('__tug');
    expect(g.help === 0 && g.team.length === 3 && g.team.every((h) => h === 0), 'без дружбы — помощь', g);
    const d0 = await tugPull();
    await page.click('#mg .xbtn');
    await wait(400);
    await closeAll();
    // лучшие друзья: по 5 сердечек у троих — рывок заметно сильнее (+35%), на заставке — сердечки
    await mutate("for (const id of ['plusha', 'ponchik', 'bob']) { s.friends[id].met = true; s.friends[id].pts = 20; }");
    await ev(() => {
      window.__dev.run('holiday:tug');
    });
    await wait(800);
    t = await mgText();
    expect(/Плюша/.test(t) && /❤️❤️❤️❤️❤️/.test(t) && /35%/.test(t), 'на заставке нет друзей с сердечками', t);
    await start();
    await wait(900);
    g = await hook('__tug');
    expect(Math.abs(g.help - 0.35) < 1e-6 && g.team.every((h) => h === 5), 'друзья не помогают', g);
    const d1 = await tugPull();
    expect(d0 > 0.12 && d1 > d0 * 1.2 && d1 < d0 * 1.5, 'рывок с друзьями не сильнее', [d0, d1]);
    // без нажатий не выиграть даже с друзьями: первый раунд уходит другой команде
    for (let i = 0; i < 40; i++) {
      g = await hook('__tug');
      if (g.lost || g.wins) break;
      await wait(500);
    }
    expect(g.lost === 1 && g.wins === 0, 'без нажатий раунд выигран', g);
    await page.click('#mg .xbtn');
    await wait(400);
    await closeAll();
  });
};

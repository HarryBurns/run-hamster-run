// Шаги автотеста про курортный отель «Морская звезда» (П.17): здание на набережной (дверь, карта, указатели, спрайты
// во все сезоны и ночью), сцена отеля (этажи, лифт, работники), ресепшен и номер на ночь (сон в номере — утро в отеле,
// сохранение и загрузка), шведский стол (скидка раз в день, завтрак после ночи), спа (сценка, наклейка, простуда не
// лечится), аниматор по расписанию (зарядка, дискотека), двери номеров, «Горка» до конца с призом, работа носильщицей
// («Носильщица» до конца, зарплата, задание из письма), номер-люкс (покупка, золотая дверь, «Домой»), житель у бассейна
// отеля (в городе его в это время нет). Состояние меняют только действия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:отель
module.exports = async function hotel({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const scene = () => ev(() => window.__dev.sceneName);
  const run = async (act, ms = 450) => {
    await ev((act) => {
      window.__dev.run(act);
    }, act);
    await wait(ms);
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
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
  /** В отель через его дверь в городе (этаж f, x — куда поставить хомячка). */
  const toHotel = async (f = 0, x = 170) => {
    await closeAll();
    await ev(
      ([f, x]) => {
        const d = window.__dev;
        if (d.sceneName !== 'world') d.go('world');
        d.enterBuilding('hotel');
        const sc = d.scene;
        sc.p.f = f;
        sc.p.x = x;
        sc.p.path = [];
        sc.standUp();
      },
      [f, x],
    );
    await wait(350);
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchHotel = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchHotel());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  /** Ответить в диалоге кнопкой с таким текстом. */
  const answer = async (text, ms = 450) => {
    await page.click(`.dialog .btn:has-text("${text}")`);
    await wait(ms);
  };
  const sleep = async () => {
    await page.click('.panel-foot .btn.green');
    await wait(3700);
  };

  await step('отель: здание на набережной — дверь, путь от виллы, карта, указатели, спрайты во все сезоны и ночью', async () => {
    await fresh();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    const r = await ev(() => {
      const W = window.__dev.World,
        m = W.map,
        b = m.bById.hotel,
        door = m.doorPx(b),
        villa = m.doorPx(m.bById.villa),
        cell = (v) => Math.floor(v / 48);
      const signs = m.objs.filter((o) => o.type === 'signpost' && /Отель/.test(String(o.text))).map((o) => [o.tx, o.ty]);
      return {
        act: b.act,
        name: b.name,
        way: !!m.path(m.foot, cell(villa.x), cell(villa.y), cell(door.x), cell(door.y)),
        signs,
        palms: m.objs.filter((o) => o.type === 'palm' && o.tx === 82 && o.ty >= 40 && o.ty <= 46).length,
      };
    });
    expect(r.act === 'scene:hotel' && /Морская звезда/.test(r.name), 'дверь отеля', r);
    expect(r.way, 'от двери виллы не дойти до двери отеля', r);
    expect(r.signs.length >= 2 && r.palms === 2, 'указатели к отелю и пальмы у здания', r);
    // окно карты: отель среди мест, куда можно дойти
    await ev(() => {
      window.__dev.F.openMap();
    });
    await wait(400);
    expect(/Морская звезда/.test(await panelText()), 'на карте города нет отеля');
    await closeAll();
    // спрайт здания помещается в рамку во все сезоны, днём и ночью (горят окна)
    for (const [day, minutes, weather] of [
      [0, 720, 'snow'],
      [9, 720, 'sun'],
      [18, 720, 'sun'],
      [27, 720, 'rain'],
      [18, 22 * 60, 'sun'],
      [0, 22 * 60, 'snow'],
    ]) {
      await ev(
        ([day, minutes, weather]) => {
          window.__dev.actions.mutate((s) => {
            s.day = day;
            s.minutes = minutes;
            s.weather = weather;
          });
          window.__dev.World.debugTeleport(88, 50);
        },
        [day, minutes, weather],
      );
      await wait(150);
    }
    const clipped = await ev(() => window.__dev.World.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
    // в отель — через дверь: первая подсказка и наклейка, сцена с тремя этажами и лифтом
    await mutate('s.flags.hotelHint = 0; s.day = 18; s.minutes = 12 * 60; s.weather = "sun";');
    await clearToasts();
    await ev(() => window.__dev.enterBuilding('hotel'));
    await wait(1400);
    const h = await ev(() => {
      const sc = window.__dev.scene;
      return { name: sc.name, floors: sc.geo.floors, lift: sc.geo.lift, f: sc.p.f, x: sc.p.x, stickers: window.__dev.G.state.stickers, pos: window.__dev.G.state.pos };
    });
    expect(h.name === 'hotel' && h.floors === 3 && h.lift && h.f === 0, 'сцена отеля', h);
    expect(h.stickers.includes('x_hotel') && /Добро пожаловать в отель/.test(await toasts()), 'первый вход: наклейка и подсказка', h.stickers);
    expect(h.pos.scene === 'hotel' && h.pos.out && h.pos.out.scene === 'world', 'позиция в отеле и дверь наружу', h.pos);
    // лифт: стрелка вверх — хомячок заходит в лифт (справа) и едет на второй этаж
    await ev(() => {
      window.__dev.scene.p.x = 1960;
    });
    await page.keyboard.down('ArrowUp');
    await wait(150);
    await page.keyboard.up('ArrowUp');
    await wait(1600);
    expect((await ev(() => window.__dev.scene.p.f)) === 1, 'лифт не привёз на второй этаж');
    // дверь отеля выводит к двери здания на набережной
    await toHotel(0, 100);
    await page.keyboard.press('KeyE');
    await wait(450);
    const out = await ev(() => ({ scene: window.__dev.sceneName, p: window.__dev.World.playerPos(), door: window.__dev.World.doorOf('hotel') }));
    expect(out.scene === 'world' && Math.abs(out.p.x - out.door.x) < 2 && Math.abs(out.p.y - out.door.y) < 2, 'дверь отеля изнутри', out);
  });

  await step('отель: ресепшен — номер на ночь, кровать, сон в номере, утро в отеле, сохранение и загрузка', async () => {
    await fresh();
    // номер не снят: кровать — подсказка, спать нельзя
    await toHotel(1, 1640);
    await clearToasts();
    await run('hotel:bed');
    expect(/свободен/.test(await toasts()) && !(await ev(() => document.querySelectorAll('.overlay').length)), 'кровать в несданном номере', await toasts());
    // Звёздочка: знакомство, «что есть», снять номер
    await toHotel(0, 400);
    await watch();
    await run('hotel:reception');
    expect(/администратор Звёздочка/.test(await dialogText()) && /шведский стол/.test(await dialogText()), 'знакомство на ресепшене', await dialogText());
    const s0 = await state();
    await answer('Снять номер');
    let s = await state();
    expect(s.money === s0.money - 350 && s.dayFlags.hotel.room === 1, 'номер снят', [s0.money, s.money, s.dayFlags.hotel]);
    expect(/ключ/.test(await dialogText()) && (await ev(() => document.querySelector('.dialog').textContent)).includes('Мой номер'), 'ответ про ключ', await dialogText());
    await answer('Пока');
    await unwatch();
    // ложимся: обычное окно «Пора спать?», утро — в номере, у кровати
    await toHotel(1, 1500);
    await run('hotel:bed', 500);
    expect(/Пора спать/.test(await panelText()), 'окно сна', await panelText());
    await sleep();
    await closeAll();
    s = await state();
    const r = await ev(() => ({ scene: window.__dev.sceneName, f: window.__dev.scene.p.f, x: window.__dev.scene.p.x }));
    expect(r.scene === 'hotel' && r.f === 1 && Math.abs(r.x - 1670) < 2 && s.day === s0.day + 1, 'утро в номере отеля', [r, s.day]);
    expect(s.stickers.includes('x_hotel_night') && s.dayFlags.hotel && s.dayFlags.hotel.slept === 1 && !s.dayFlags.hotel.room, 'ночь в отеле', [s.stickers, s.dayFlags.hotel]);
    // перезагрузка: игра продолжается в отеле, дверь по-прежнему ведёт на набережную
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(700);
    await closeAll();
    expect((await scene()) === 'hotel', 'после перезагрузки не в отеле', await scene());
    await toHotel(0, 100);
    await ev(() => window.__dev.go('hotel', { pos: { scene: 'hotel', floor: 0, x: 100 } }));
    await wait(300);
    await page.keyboard.press('KeyE');
    await wait(450);
    const out = await ev(() => ({ scene: window.__dev.sceneName, p: window.__dev.World.playerPos(), door: window.__dev.World.doorOf('hotel') }));
    expect(out.scene === 'world' && Math.abs(out.p.y - out.door.y) < 2, 'дверь отеля после перезагрузки', out);
  });

  await step('отель: шведский стол, спа, аниматор по расписанию, двери номеров — только действия', async () => {
    await fresh();
    await toHotel(0, 1050);
    await watch();
    // шведский стол: первое блюдо за полцены, второе — по обычной цене
    await run('hotel:buffet');
    let t = await panelText();
    expect(/Шведский стол/.test(t) && /полцены/.test(t) && /Круассан/.test(t), 'окно шведского стола', t);
    let s0 = await state();
    await page.click('.overlay .card:has-text("Круассан") .btn');
    await wait(300);
    let s = await state();
    expect(s.money === s0.money - 35 && s.dayFlags.hotel.ate === 1 && s.stickers.includes('x_buffet'), 'круассан за полцены', [s0.money, s.money]);
    await page.click('.overlay .card:has-text("Круассан") .btn');
    await wait(300);
    expect((await state()).money === s.money - 70, 'второй круассан — по обычной цене');
    await closeAll();
    // спа: массаж — сценка, наклейка, плата; событие spa (задание «Спа-день»)
    await mutate('s.mail = null;');
    await run('hotel:spa');
    expect(/Массаж/.test(await ev(() => document.querySelector('.dialog').textContent)), 'Пенка предлагает массаж');
    s0 = await state();
    await answer('Массаж', 300);
    expect(await ev(() => !!document.querySelector('.fade.spa-scene')), 'нет сценки спа');
    await wait(4400);
    s = await state();
    expect(s.money === s0.money - 150 && s.stickers.includes('x_spa'), 'спа: плата и наклейка', [s0.money, s.money]);
    // простуженной спа можно, но добрые слова: простуду лечит доктор
    await ev(() => window.__dev.actions.fallSick('none'));
    await run('hotel:spa');
    expect(/доктор/.test(await dialogText()), 'спа простуженной: подсказка про доктора', await dialogText());
    await answer('Пока');
    await ev(() => window.__dev.actions.recoverSick('doctor'));
    // аниматор: днём его нет — подсказка с расписанием; утром — зарядка, вечером — дискотека
    const here = () => ev(() => window.__dev.scenes.hotel.actors.filter((a) => a.id === 'hlopushka' && (!a.when || a.when())).length);
    await toHotel(2, 1600);
    expect((await here()) === 0, 'аниматор днём у бассейна');
    await clearToasts();
    await run('hotel:schedule');
    expect(/зарядка/.test(await toasts()) && /дискотека/.test(await toasts()), 'доска с расписанием', await toasts());
    for (const [min, btn, st] of [
      [8.5 * 60, 'Делать зарядку', 'x_zaryadka'],
      [19.5 * 60, 'Танцевать', 'x_disco'],
    ]) {
      await mutate(`s.minutes = ${min};`);
      await wait(100);
      expect((await here()) === 1, 'аниматора нет по расписанию ' + min);
      await run('hotel:animator');
      await answer(btn, 300);
      expect(await ev(() => !!document.querySelector('.fade.dance-hotel')), 'нет сценки танца');
      await wait(4800);
      expect((await state()).stickers.includes(st), 'наклейка ' + st);
    }
    // двери номеров: тук-тук
    await clearToasts();
    await run('hotel:knock:203');
    expect(/203/.test(await toasts()) && /Тук-тук/.test(await toasts()), 'стук в дверь номера', await toasts());
    await unwatch();
  });

  await step('отель: «Горка» — правило картинкой, спуск до конца с призом, простуженной нельзя', async () => {
    await fresh();
    await toHotel(2, 1200);
    const s0 = await state();
    await clearToasts();
    await run('hotel:slide', 800);
    let t = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Горка/.test(t) && /Рули/.test(t) && /Приз отеля/.test(t) && (await ev(() => document.querySelectorAll('#mg .sd-rules img').length)) >= 4, 'заставка «Горки»', t);
    await page.click('#mg .btn.green');
    await wait(400);
    let moves = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 50000) {
      const st = await ev(() => {
        const c = document.querySelector('#mg canvas');
        return c && c.__slide ? c.__slide() : null;
      });
      if (!st) break;
      const ahead = st.items.filter((q) => q.y < st.y && q.y > st.y - 240).sort((a, b) => b.y - a.y)[0];
      const target = ahead ? ahead.x : st.tube;
      const r = await ev(() => {
        const b = document.querySelector('#mg canvas').getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      });
      await page.mouse.move(r.x + (st.x0 + target * st.lw) * (r.w / st.w), r.y + r.h * 0.8);
      moves++;
      if (await ev(() => /Ура!/.test(document.querySelector('#mg').textContent))) break;
      await wait(80);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 8000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/бассейн/.test(end) && /\+/.test(end), 'итог спуска', end);
    await page.click('#mg >> text=Ура!');
    await wait(500);
    const s1 = await state();
    expect(moves > 10 && s1.plays.slide === 1 && s1.dayFlags.hotel.slides === 1 && s1.money > s0.money && s1.stickers.includes('x_slide'), 'спуск записан, приз выдан', [moves, s1.plays, s1.dayFlags.hotel, s1.money - s0.money]);
    // простуженной на горку нельзя — добрая подсказка
    await ev(() => window.__dev.actions.fallSick('none'));
    await clearToasts();
    await run('hotel:slide', 500);
    expect(!(await ev(() => !!document.querySelector('#mg'))) && /Простуд|простуд|выздоров|купа|нос/.test(await toasts()), 'горка простуженной', await toasts());
    await ev(() => window.__dev.actions.recoverSick('doctor'));
  });

  await step('отель: работа носильщицей — Тележкин, «Носильщица» до конца, зарплата, задание из письма', async () => {
    await fresh();
    await mutate('s.mail = null;');
    await ev(() => {
      window.__dev.actions.setMail('porter');
      window.__dev.actions.readMail();
    });
    await toHotel(0, 600);
    const s0 = await state();
    await run('hotel:porter');
    expect(/Тележкин/.test(await ev(() => document.querySelector('.dialog').textContent)), 'Тележкин');
    await answer('Развезти чемоданы', 800);
    const intro = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/Носильщица/.test(intro) && /Зарплата/.test(intro) && /бирк/.test(intro), 'заставка «Носильщицы»', intro);
    await page.click('#mg .btn.green');
    await wait(400);
    let wrong = false;
    for (let k = 0; k < 80; k++) {
      const st = await ev(() => {
        const c = document.querySelector('#mg canvas');
        return c && c.__porter ? c.__porter() : null;
      });
      if (!st || !st.tag) break;
      if (!st.busy) {
        const d = !wrong ? st.doors.find((q) => q.n !== st.tag) : st.doors.find((q) => q.n === st.tag);
        wrong = true;
        const r = await ev(() => {
          const b = document.querySelector('#mg canvas').getBoundingClientRect();
          return { x: b.left, y: b.top, w: b.width, h: b.height };
        });
        await page.mouse.click(r.x + d.x * (r.w / st.w), r.y + d.y * (r.h / st.h));
      }
      if (await ev(() => /Ура!/.test(document.querySelector('#mg').textContent))) break;
      await wait(250);
    }
    await page.waitForSelector('#mg >> text=Ура!', { timeout: 8000 });
    const end = norm(await ev(() => document.querySelector('#mg').textContent));
    expect(/чемоданов на месте/.test(end) && /Зарплата/.test(end) && /ошибок дверью — 1/.test(end), 'итог смены', end);
    await page.click('#mg >> text=Ура!');
    await wait(1500);
    await closeAll();
    const s1 = await state();
    expect(s1.plays.porter === 1 && s1.dayFlags.shifts.porter === 1 && s1.money >= s0.money + 400 && s1.stickers.includes('x_porter'), 'смена записана, зарплата', [s1.plays, s1.dayFlags.shifts, s1.money - s0.money]);
    expect(s1.mail.done, 'задание «Носильщица на день» не засчитано', s1.mail);
  });

  await step('отель: номер-люкс — у риелтора продаётся, покупка, золотая дверь, обратно в коридор, «Домой»', async () => {
    await fresh();
    await mutate('s.money = 100000;');
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // золотая дверь некупленного люкса — окно риелтора
    await toHotel(1, 1190);
    await clearToasts();
    await run('hotel:suite');
    expect((await scene()) === 'hotel' && /Недвижимость/.test(await panelText()) && /продаётся/.test(await toasts()), 'дверь некупленного люкса', await toasts());
    const card = '.overlay .home-card:has(.ttl:has-text("люкс"))';
    expect((await page.locator(card + '.soon').count()) === 0 && (await page.locator(card + ' .btn').count()) === 1, 'люкс продаётся');
    await page.click(card + ' .btn');
    await wait(400);
    await page.locator('.overlay').last().locator('.panel-foot .btn.green').click();
    await wait(700);
    let s = await state();
    expect(s.homesOwned.includes('suite') && s.money === 20000, 'люкс куплен', [s.homesOwned, s.money]);
    await closeAll();
    // золотая дверь ведёт в люкс; в люксе своя мебель, «Обустроить»; дверь люкса — обратно в коридор
    await toHotel(1, 1190);
    await run('hotel:suite');
    expect((await scene()) === 'suite', 'золотая дверь не ведёт в люкс', await scene());
    s = await state();
    expect(s.homes.suite.some((i) => i.id.startsWith('bed_')) && s.homes.suite.some((i) => i.id.startsWith('wardrobe')), 'мебель люкса', s.homes.suite);
    expect((await ev(() => document.querySelector('.hud-btns.left').textContent)).includes('Обустроить'), 'нет «Обустроить» в люксе');
    await ev(() => {
      const sc = window.__dev.scene;
      sc.p.x = 100;
      sc.p.path = [];
    });
    await page.keyboard.press('KeyE');
    await wait(450);
    const r = await ev(() => ({ scene: window.__dev.sceneName, f: window.__dev.scene.p.f, x: window.__dev.scene.p.x }));
    expect(r.scene === 'hotel' && r.f === 1 && Math.abs(r.x - 1190) < 2, 'дверь люкса — в коридор отеля', r);
    // люкс — основной дом: «Домой» ведёт в люкс, его дверь — к двери отеля на набережной (пришли не через коридор)
    await ev(() => window.__dev.actions.setMainHome('suite'));
    await ev(() => window.__dev.go('world'));
    await wait(300);
    await ev(() => {
      window.__dev.F.askGoHome();
    });
    await wait(400);
    await page.click('.overlay .panel-foot .btn.green');
    await wait(500);
    expect((await scene()) === 'suite', '«Домой» не в люкс', await scene());
    await ev(() => {
      const sc = window.__dev.scene;
      sc.p.x = 100;
      sc.p.path = [];
    });
    await page.keyboard.press('KeyE');
    await wait(450);
    const out = await ev(() => ({ scene: window.__dev.sceneName, p: window.__dev.World.playerPos(), door: window.__dev.World.doorOf('hotel') }));
    expect(out.scene === 'world' && Math.abs(out.p.x - out.door.x) < 2 && Math.abs(out.p.y - out.door.y) < 2, 'дверь люкса после «Домой»', out);
  });

  await step('отель: житель у бассейна (в городе его в это время нет), бассейн на крыше, звёздочка задания к отелю', async () => {
    await fresh();
    // день, когда у бассейна отеля кто-то отдыхает
    const pick = await ev(async () => {
      const D = await import('/js/data/index.js');
      for (let d = 0; d < 72; d++) {
        const id = D.poolGuestOn(d, 15 * 60);
        if (id) return { day: d, id };
      }
      return null;
    });
    expect(!!pick, 'житель у бассейна не бывает никогда');
    await mutate(`s.day = ${pick.day}; s.minutes = 15 * 60; s.mail = null; s.guests = [];`);
    await ev(() => window.__dev.go('world'));
    await wait(300);
    let r = await ev((id) => {
      const W = window.__dev.World;
      return { hidden: W.npcs.find((n) => n.id === id).hidden, others: W.npcs.filter((n) => n.id !== id && n.hidden).map((n) => n.id) };
    }, pick.id);
    expect(r.hidden && !r.others.length, 'житель у бассейна отеля гуляет и по городу', [pick, r]);
    await toHotel(2, 1300);
    r = await ev((id) => window.__dev.scene.actors.filter((a) => !a.when || a.when()).map((a) => a.id), pick.id);
    expect(r.includes(pick.id) && !r.includes('hlopushka'), 'у бассейна отеля нет жителя', [pick, r]);
    // вечером житель снова в городе
    await mutate('s.minutes = 18 * 60;');
    await ev(() => window.__dev.go('world'));
    await wait(300);
    expect(!(await ev((id) => window.__dev.World.npcs.find((n) => n.id === id).hidden, pick.id)), 'житель не вернулся в город');
    // бассейн на крыше: можно поплавать
    await toHotel(2, 640);
    await ev(() => {
      const sc = window.__dev.scene,
        z = sc.desc.built.find((b) => b.id === 'pool');
      sc.p.x = z.x;
    });
    await page.keyboard.press('KeyE');
    await wait(300);
    expect((await ev(() => window.__dev.scene.p.state)) === 'swim', 'в бассейне на крыше не плавается');
    // задание из письма «Носильщица на день»: звёздочка — к двери отеля
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.actions.setMail('porter');
      d.actions.readMail();
    });
    await wait(300);
    const tg = await ev(() => ({ t: window.__dev.World.target(), door: window.__dev.World.doorOf('hotel') }));
    expect(tg.t && Math.abs(tg.t.x - tg.door.x) < 60, 'звёздочка задания не ведёт к отелю', tg);
  });
};

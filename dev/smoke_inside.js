// Шаги автотеста «Войти внутрь» (этап 13): в каждый дом тайных мест — избушка лесника, шале, пирамида, шатёр, храм,
// палатка, хижины острова, подводный грот — входят через дверь снаружи, внутри хозяин (разговор — его прежнее действие),
// предметы можно потрогать (реплика), особые входы изнутри (загадки «Пары» и «Узор храма», сон в хижине для гостей,
// заплыв из грота в город), дверь изнутри возвращает к двери снаружи; наклейка за все дома; ночью внутри темнеет и
// горят лампы. Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:внутри
module.exports = async function inside({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const sceneName = () => ev(() => window.__dev.sceneName);
  /** В локацию loc (открыв место land), днём (или в minutes), к клетке [tx, ty]. */
  const toLoc = (loc, land, tx, ty, minutes = 12 * 60) =>
    ev(
      ([loc, land, tx, ty, minutes]) => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain', land]) if (id && !d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          for (const k of ['desertHint', 'jungleHint', 'coveHint', 'islandHint', 'hutHint']) s.flags[k] = 1;
        });
        d.go(loc);
        d.locations[loc].debugTeleport(tx, ty);
      },
      [loc, land, tx, ty, minutes],
    );
  /** Нажать на точку дома (единицы дома) — настоящим нажатием по экрану. */
  const tapHouse = async (wx, wy) => {
    const k = await ev(([wx, wy]) => window.__dev.scene.debugScreen(wx, wy), [wx, wy]);
    await page.mouse.click(k.x, k.y);
  };
  /** Центр зоны встроенного предмета id (по описанию дома). */
  const zoneAt = (id) =>
    ev((id) => {
      const sc = window.__dev.scene,
        b = sc.desc.built.find((q) => q.id === id),
        up = b.up || 0,
        h = b.h || 176;
      return { x: b.x, y: sc.geo.fy(b.f) - up - (h - up) / 2 };
    }, id);
  const tapZone = async (id) => {
    const z = await zoneAt(id);
    await tapHouse(z.x, z.y);
  };

  // дом: где дверь снаружи, хозяин, предмет с репликой, особый вход
  const HOUSES = [
    { name: 'избушка лесника', loc: 'forest', land: null, at: [10, 36], b: 'hut', id: 'hut_shishkin', host: 'shishkin', prop: 'stove' },
    { name: 'шале Вершинкина', loc: 'mountain', land: 'mountain', at: [27, 24], b: 'chalet', id: 'chalet_vershinkin', host: 'vershinkin', prop: 'cocoa' },
    { name: 'шатёр Бархана', loc: 'desert', land: 'desert', at: [21, 30], b: 'tent', id: 'tent_barkhan', host: 'barkhan', prop: 'tea' },
    { name: 'пирамида', loc: 'desert', land: 'desert', at: [21, 30], b: 'pyramid', id: 'pyramid_hall', host: null, prop: 'fresco1' },
    { name: 'палатка Лианы', loc: 'jungle', land: 'jungle', at: [31, 28], b: 'camp', id: 'tent_liana', host: 'liana', prop: 'butterflies' },
    { name: 'храм', loc: 'jungle', land: 'jungle', at: [31, 28], b: 'temple', id: 'temple_hall', host: null, prop: 'idol' },
    { name: 'хижина вождя', loc: 'island', land: 'island', at: [20, 22], b: 'chief', id: 'hut_kokos', host: 'kokos', prop: 'drums' },
    { name: 'хижина для гостей', loc: 'island', land: 'island', at: [20, 22], b: 'guest', id: 'hut_guest', host: null, prop: 'lamp' },
    { name: 'домик Бума', loc: 'island', land: 'island', at: [20, 22], b: 'bumhut', id: 'hut_bum', host: null, prop: 'note' },
    { name: 'домик Лагуны', loc: 'island', land: 'island', at: [20, 22], b: 'laguna', id: 'hut_laguna', host: null, prop: 'basket' },
  ];

  for (const H of HOUSES)
    await step(`внутри: ${H.name} — вход, хозяин, потрогать, выход к двери`, async () => {
      await closeAll();
      await toLoc(H.loc, H.land, H.at[0], H.at[1]);
      await wait(300);
      await ev((H) => {
        const sc = window.__dev.locations[H.loc];
        sc.enterBuilding(sc.map.bById[H.b]);
      }, H);
      await wait(900);
      expect((await sceneName()) === H.id, 'дверь не ведёт внутрь', await sceneName());
      const flag = await ev((id) => window.__dev.G.state.flags['in:' + id], H.id);
      expect(flag === 1, 'нет отметки «был внутри»', flag);
      // хозяин внутри: нажать на него — его прежний разговор
      if (H.host) {
        await clearToasts();
        const a = await ev((host) => {
          const sc = window.__dev.scene,
            g = sc.actors.find((q) => q.id === host);
          return g && { x: g.x, y: sc.geo.fy(g.f) - 60 };
        }, H.host);
        expect(!!a, 'хозяина нет внутри', H.host);
        await tapHouse(a.x, a.y);
        await wait(2600);
        const dlg = norm(await ev(() => (document.querySelector('.dialog') || { textContent: '' }).textContent));
        expect(dlg.length > 0, 'нажатие на хозяина не открыло разговор', dlg);
        await closeAll();
      }
      // потрогать предмет: реплика
      await clearToasts();
      await tapZone(H.prop);
      await wait(2600);
      const say = await ev(
        ([id, prop]) => [].concat(window.__dev.scene.desc.built.find((q) => q.id === prop).say).map((x) => x.slice(0, 18)),
        [H.id, H.prop],
      );
      const tt = await toasts();
      expect(say.some((x) => tt.includes(norm(x))), 'предмет не ответил репликой', [tt, say]);
      // выйти: дверь — к двери снаружи (хомячок идёт к двери через весь дом — ждём, пока выйдет)
      await tapZone('door');
      for (let i = 0; i < 25 && (await sceneName()) === H.id; i++) await wait(250);
      await wait(300);
      const r = await ev((H) => {
        const d = window.__dev,
          sc = d.locations[H.loc];
        return { scene: d.sceneName, p: sc.p && { x: sc.p.x, y: sc.p.y }, door: sc.map.doorPx(sc.map.bById[H.b]) };
      }, H);
      expect(r.scene === H.loc && Math.hypot(r.p.x - r.door.x, r.p.y - r.door.y) < T, 'дверь изнутри не вывела к двери снаружи', r);
    });

  await step('внутри: пирамида — каменная дверь открывает «Пары», храм — стена со знаками открывает «Узор храма»', async () => {
    for (const [loc, land, at, b, zone] of [
      ['desert', 'desert', [21, 30], 'pyramid', 'pairs'],
      ['jungle', 'jungle', [31, 28], 'temple', 'glyphs'],
    ]) {
      await closeAll();
      await toLoc(loc, land, at[0], at[1]);
      await wait(300);
      await ev(([loc, b]) => {
        const sc = window.__dev.locations[loc];
        sc.enterBuilding(sc.map.bById[b]);
      }, [loc, b]);
      await wait(900);
      await tapZone(zone);
      await wait(3600);
      const mg = await ev(() => !!document.querySelector('#mg'));
      expect(mg, `${zone}: мини-игра не открылась`);
      await closeAll();
      await wait(400);
      await closeAll();
    }
  });

  await step('внутри: хижина для гостей — сон у циновки, утро в хижине, наклейка; выход к двери', async () => {
    await closeAll();
    await toLoc('island', 'island', 20, 22, 21 * 60 + 30);
    await ev(() => window.__dev.actions.mutate((s) => (s.stickers = s.stickers.filter((id) => id !== 'x_island_night'))));
    const day0 = await ev(() => window.__dev.G.state.day);
    await ev(() => {
      const sc = window.__dev.locations.island;
      sc.enterBuilding(sc.map.bById.guest);
    });
    await wait(900);
    await tapZone('bed');
    await wait(2600);
    const pt = norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
    expect(/Пора спать/.test(pt), 'циновка не предлагает поспать', pt);
    await page.click('.panel-foot .btn >> text=Спать');
    await wait(4500);
    await closeAll();
    const s = await ev(() => ({ day: window.__dev.G.state.day, min: window.__dev.G.state.minutes, st: window.__dev.G.state.stickers }));
    expect(s.day === day0 + 1 && s.min < 9 * 60 && (await sceneName()) === 'hut_guest', 'утро не в хижине', [s.day, day0, s.min, await sceneName()]);
    expect(s.st.includes('x_island_night'), 'нет наклейки «Ночь на острове»', s.st.slice(-4));
    // после ночи в хижине позиция в сохранении — у двери хижины снаружи (дом не сохраняет своё место)
    const pos = await ev(() => window.__dev.scene.savePos());
    expect(pos.scene === 'island', 'сохранение не у двери хижины', pos);
    await closeAll();
    await tapZone('door');
    for (let i = 0; i < 25 && (await sceneName()) === 'hut_guest'; i++) await wait(250);
    expect((await sceneName()) === 'island', 'из хижины не вышли на остров', await sceneName());
  });

  await step('внутри: подводный грот — вход с воды у арки, сундучок, выход на пляж и заплыв из озерца в город', async () => {
    await closeAll();
    await toLoc('cove', 'cove', 6, 6);
    await wait(400);
    let k = await ev(() => window.__dev.locations.cove.debugScreen(6.5 * 48, 4.5 * 48));
    await page.mouse.click(k.x, k.y);
    await wait(2200);
    expect((await sceneName()) === 'grotto_cave', 'вода у арки не ведёт в грот', await sceneName());
    await clearToasts();
    await tapZone('chest');
    await wait(2400);
    expect(/Жемчужинк/.test(await toasts()), 'сундучок молчит', await toasts());
    // выход на пляж
    await tapZone('door');
    for (let i = 0; i < 25 && (await sceneName()) === 'grotto_cave'; i++) await wait(250);
    expect((await sceneName()) === 'cove', 'из грота не вышли на пляж', await sceneName());
    // снова в грот — и нырнуть в озерцо: заплыв в город, как раньше
    k = await ev(() => window.__dev.locations.cove.debugScreen(6.5 * 48, 4.5 * 48));
    await page.mouse.click(k.x, k.y);
    await wait(2200);
    expect((await sceneName()) === 'grotto_cave', 'второй раз в грот не вошли', await sceneName());
    await tapZone('pool');
    await wait(2600);
    expect(await ev(() => !!document.querySelector('.grotto-ride')), 'нет картинки заплыва в город');
    await wait(2600);
    const r = await ev(() => {
      const d = window.__dev,
        sc = d.locations.world;
      return { scene: d.sceneName, x: sc.p.x, y: sc.p.y, g: d.World.grottoAt() };
    });
    expect(r.scene === 'world' && Math.hypot(r.x - (r.g.x - 0.6 * T), r.y - (r.g.y + 1.4 * T)) < 40, 'грот вывел не к буйку', r);
  });

  // ---------- отель: номера разных классов, в гости в номер 203, ночь внутри ----------
  const toHotel = async (f, x, minutes = 12 * 60, day = 18) => {
    await closeAll();
    await ev(
      ([f, x, minutes, day]) => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = minutes;
          s.weather = 'sun';
          s.flags.hotelHint = 1;
          s.flags.metZvezdochka = 1;
        });
        if (d.sceneName !== 'world') d.go('world');
        d.enterBuilding('hotel');
        const sc = d.scene;
        sc.p.f = f;
        sc.p.x = x;
        sc.p.path = [];
        sc.standUp();
      },
      [f, x, minutes, day],
    );
    await wait(500);
  };
  const dlgText = async () => norm(await ev(() => (document.querySelector('.dialog') || { textContent: '' }).textContent));
  const answer = async (text, ms = 450) => {
    await page.click(`.dialog .btn:has-text("${text}")`);
    await wait(ms);
  };

  await step('внутри: отель — номера трёх классов (эконом, стандарт, с балконом): цена, дверь открывается, кровать, утро в номере', async () => {
    for (const [cls, no, btn, flag] of [
      ['eco', 201, 'Эконом', 'eco'],
      ['balcony', 202, 'С балконом', 'balcony'],
    ]) {
      await toHotel(0, 400);
      const price = await ev(async (cls) => (await import('/js/data/index.js')).HOTEL_ROOMS.find((r) => r.id === cls).price, cls);
      await ev(() => window.__dev.actions.mutate((s) => (s.dayFlags = {})));
      // закрытая дверь, пока номер не снят: просто стук
      await clearToasts();
      await ev((no) => {
        window.__dev.run('hotel:knock:' + no);
      }, no);
      await wait(300);
      expect((await sceneName()) === 'hotel' && /Тук-тук/.test(await toasts()), `${no}: дверь до аренды`, [await sceneName(), await toasts()]);
      const m0 = await ev(() => window.__dev.G.state.money);
      await ev(() => {
      window.__dev.run('hotel:reception');
    });
      await wait(500);
      await answer('Снять номер');
      expect(/Эконом/.test(await dlgText()) && /балкон/.test(await dlgText()), 'выбор номера', await dlgText());
      await answer(btn);
      const s = await ev(() => ({ money: window.__dev.G.state.money, room: (window.__dev.G.state.dayFlags.hotel || {}).room }));
      expect(s.room === flag && s.money === m0 - price, `${btn}: цена и отметка`, [s, m0, price]);
      expect((await dlgText()).includes('Мой номер ' + no), 'ресепшен помнит номер', await dlgText());
      await closeAll();
      // кровать стандарта 207 — не наша
      await clearToasts();
      await ev(() => {
      window.__dev.run('hotel:bed');
    });
      await wait(300);
      expect(new RegExp('Твой номер сегодня — ' + no).test(await toasts()), 'кровать 207 при другом номере', await toasts());
      // дверь номера — внутрь
      await ev((no) => {
        window.__dev.run('hotel:knock:' + no);
      }, no);
      await wait(700);
      expect((await sceneName()) === 'hotel_' + no, `дверь ${no} не ведёт в номер`, await sceneName());
      // кровать номера — сон, утро здесь же
      const day0 = await ev(() => window.__dev.G.state.day);
      await tapZone('bed');
      await wait(2600);
      const pt = norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
      expect(/Пора спать/.test(pt), `${no}: кровать не предлагает поспать`, pt);
      await page.click('.panel-foot .btn.green');
      await wait(3900);
      await closeAll();
      const r = await ev(() => ({ scene: window.__dev.sceneName, day: window.__dev.G.state.day, slept: (window.__dev.G.state.dayFlags.hotel || {}).slept }));
      expect(r.scene === 'hotel_' + no && r.day === day0 + 1 && r.slept === 1, `${no}: утро не в номере`, r);
      // дверь номера — в коридор, к своей двери
      await tapZone('door');
      for (let i = 0; i < 20 && (await sceneName()) !== 'hotel'; i++) await wait(250);
      const p = await ev(() => ({ scene: window.__dev.sceneName, f: window.__dev.scene.p.f, x: window.__dev.scene.p.x }));
      expect(p.scene === 'hotel' && p.f === 1 && Math.abs(p.x - (150 + (no - 201) * 210)) < 2, `${no}: дверь номера не вывела в коридор`, p);
    }
  });

  await step('внутри: отель — в номере 203 гостит житель: дверь открыта, житель внутри, в городе его нет; без гостя — стук', async () => {
    // день, когда в 203 кто-то гостит (жребий по дню; не тот, у кого «!» задания), и час из HOTEL.roomGuest
    await toHotel(1, 600);
    const g = await ev(async () => {
      const D = await import('/js/data/index.js'),
        St = await import('/js/core/state.js'),
        d = window.__dev,
        min = D.HOTEL.roomGuest.from * 60 + 30;
      d.actions.mutate((s) => (s.guests = []));
      for (let day = 0; day < 72; day++) {
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = min;
        });
        if (St.hotelRoomGuest()) return { day, id: St.hotelRoomGuest() };
      }
      return null;
    });
    expect(!!g, 'в 203 никто не гостит за два года');
    const who = g.id;
    await clearToasts();
    await ev(() => {
      window.__dev.run('hotel:knock:203');
    });
    await wait(700);
    const here = await ev(() => {
      const sc = window.__dev.scene;
      return { scene: window.__dev.sceneName, guests: sc.actors.filter((a) => !a.when || a.when()).map((a) => a.id) };
    });
    expect(here.scene === 'hotel_203' && here.guests.length === 1, 'номер 203: житель внутри', [here, who]);
    expect(/Заходи/.test(await toasts()), 'приглашение войти', await toasts());
    // в городе его нет (away), пока он в отеле
    const away = await ev(async (id) => (await import('/js/core/state.js')).hotelRoomGuest() === id, here.guests[0]);
    expect(away, 'житель не считается гостем отеля');
    await clearToasts();
    await tapZone('suitcase');
    await wait(2200);
    expect(/чемодан|Чемодан|шляпа/.test(await toasts()), 'чемодан молчит', await toasts());
    await tapZone('door');
    for (let i = 0; i < 20 && (await sceneName()) !== 'hotel'; i++) await wait(250);
    expect((await sceneName()) === 'hotel', 'из 203 не вышли в коридор', await sceneName());
    // вечером гость уехал — опять стук
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 20 * 60)));
    await clearToasts();
    await ev(() => {
      window.__dev.run('hotel:knock:203');
    });
    await wait(400);
    expect((await sceneName()) === 'hotel' && /Тук-тук/.test(await toasts()), '203 без гостя — стук', [await sceneName(), await toasts()]);
  });

  await step('внутри: отель ночью — внутри темнее, горят люстра, бра и гирлянда; днём — как раньше', async () => {
    await toHotel(0, 300, 12 * 60);
    const lum = () =>
      ev(() => {
        const c = document.querySelector('canvas'),
          d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 40) s += d[i] + d[i + 1] + d[i + 2];
        return s / (d.length / 40) / 3;
      });
    const day = await lum();
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
    await wait(500);
    const night = await lum();
    expect(night < day - 25, 'ночью в отеле не темнее', [day, night]);
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 12 * 60)));
  });

  await step('внутри: наклейка «В гостях у тайных мест» за все дома; ночью внутри темнеет, лампы светят', async () => {
    await closeAll();
    // наклейка: отметок всех домов, кроме одного, — и войти в последний
    const ids = await ev(async () => {
      const H = await import('/js/interiors/houses.js');
      return H.LAND_HOUSES.map((h) => h.id);
    });
    await ev((ids) => {
      window.__dev.actions.mutate((s) => {
        for (const id of ids) s.flags['in:' + id] = 1;
        delete s.flags['in:hut_shishkin'];
        s.stickers = s.stickers.filter((x) => x !== 'x_inside');
      });
    }, ids);
    await toLoc('forest', null, 10, 36);
    await wait(300);
    await ev(() => {
      const sc = window.__dev.locations.forest;
      sc.enterBuilding(sc.map.bById.hut);
    });
    await wait(3200);
    await closeAll();
    expect(await ev(() => window.__dev.G.state.stickers.includes('x_inside')), 'нет наклейки за все дома');
    // ночь: средняя яркость кадра в избушке ниже, чем днём, а у печки (лампа) — светлее, чем в тёмном углу
    const lum = () =>
      ev(() => {
        const c = document.querySelector('canvas'),
          g = c.getContext('2d'),
          d = g.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 40) s += d[i] + d[i + 1] + d[i + 2];
        return s / (d.length / 40) / 3;
      });
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 12 * 60)));
    await wait(500);
    const day = await lum();
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
    await wait(500);
    const night = await lum();
    expect(night < day - 25, 'ночью в избушке не темнее', [day, night]);
    const dk = await ev(async () => {
      const L = await import('/js/engine/side/light.js'),
        d = window.__dev,
        night = L.houseDark(d.scene.desc);
      d.actions.mutate((s) => (s.minutes = 12 * 60));
      return [night, L.houseDark(d.scene.desc), L.houseDark({ dim: 0.5 })];
    });
    expect(dk[0] > 0.9 && dk[1] === 0 && dk[2] === 0.5, 'расчёт темноты: ночь, день, грот днём', dk);
  });
};

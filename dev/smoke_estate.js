// Шаги автотеста про этап 4: в гости к жителям, покупное жильё, свой бизнес, мини-игра «Бариста»,
// перенос сохранения v2 → v3. Подключается из dev/smoke.js (там же — запуск и общие помощники).
const fs = require('fs');
const path = require('path');
const SAVE_V2 = fs.readFileSync(path.join(__dirname, 'saves', 'v2.json'), 'utf8'); // до жилья и бизнеса (этап 3)
const SAVE_V3 = fs.readFileSync(path.join(__dirname, 'saves', 'v3.json'), 'utf8'); // с домами и заведениями (этап 4)

module.exports = async function estate({ page, step, ev, wait, closeAll }) {
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const text = async (sel) => norm(await page.locator(sel).first().innerText());
  const toasts = async () =>
    norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const scene = () => ev(() => window.__dev.sceneName);
  const setTime = (h) => ev((m) => window.__dev.actions.mutate((s) => (s.minutes = m)), Math.round(h * 60));
  const setMoney = (n) => ev((n) => window.__dev.actions.mutate((s) => (s.money = n)), n);
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const enter = async (id) => {
    await ev((id) => {
      window.__dev.enterBuilding(id);
    }, id);
    await wait(450);
  };
  const run = async (act) => {
    await ev((act) => {
      window.__dev.run(act);
    }, act);
    await wait(450);
  };
  const lastOv = () => page.locator('.overlay').last();
  /** Место у двери здания в городе (туда выводит дверь дома, в который вошли через это здание). */
  const doorOf = (id) => ev((id) => window.__dev.World.doorOf(id), id);
  /** Встать в городе у двери здания (на клетку ниже) — как если бы хомячок туда дошёл. */
  const standAt = async (id) => {
    await ev((id) => {
      const d = window.__dev;
      if (d.sceneName !== 'world') d.go('world');
      const p = d.World.doorOf(id);
      d.World.p.path = [];
      d.World.p.pending = null;
      d.World.p.x = p.x;
      d.World.p.y = p.y + 30;
    }, id);
    await wait(250);
  };
  /** Выйти из дома через его дверь (хозяина, если он есть, отодвинуть). */
  const leaveByDoor = async () => {
    await ev(() => {
      const sc = window.__dev.scene,
        door = sc.desc.door || { f: 0, x: 100 };
      for (const a of sc.actors) {
        a.x = a.tx = door.x > 600 ? 220 : 1000;
        a.wait = 99;
      }
      sc.standUp();
      sc.p.path = [];
      sc.p.f = door.f;
      sc.p.x = door.x;
    });
    await page.keyboard.press('KeyE');
    await wait(450);
  };
  const outAt = async (id, msg) => {
    const at = await doorOf(id),
      out = await ev(() => ({ scene: window.__dev.sceneName, ...window.__dev.World.playerPos() }));
    expect(out.scene === 'world' && Math.abs(out.x - at.x) < 2 && Math.abs(out.y - at.y) < 2, msg, [out, at]);
  };
  const putSave = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-save-backup');
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await wait(500);
  };
  const newGame = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
  };
  /** Лечь спать по-настоящему (кровать → вопрос → ночь → утро). */
  const sleep = async () => {
    await ev(() => {
      window.__dev.F.askSleep();
    });
    await wait(400);
    await page.click('.panel-foot .btn.green');
    await wait(3600);
  };
  /** Поставить хомячка в доме (этаж, x), хозяина отодвинуть в угол и нажать E — «потрогать то, что рядом». */
  const touch = async (itemId, n = 0) => {
    const ok = await ev(
      ([itemId, n]) => {
        const sc = window.__dev.scene;
        const it = sc.items().filter((i) => i.id === itemId)[n];
        if (!it) return false;
        for (const a of sc.actors) {
          if (a.f === it.floor && Math.abs(a.x - it.x) < 140) a.x = a.tx = it.x > 600 ? 220 : 900;
          a.wait = 99;
        }
        sc.standUp();
        sc.p.path = [];
        sc.p.f = it.floor;
        sc.p.x = it.x;
        return true;
      },
      [itemId, n],
    );
    if (!ok) throw new Error('в доме нет предмета ' + itemId);
    await page.keyboard.press('KeyE');
    await wait(350);
  };

  const NPC = [
    ['plusha', 'house0'],
    ['ponchik', 'house1'],
    ['senya', 'house2'],
    ['busya', 'house3'],
    ['prof', 'house4'],
    ['myata', 'house5'],
    ['bob', 'house6'],
    ['zefirka', 'house7'],
  ];

  // ---------- A. в гости ----------
  await step('гости: дверь домика — днём закрыто, ночью спит, утром и вечером открыто, приглашение', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    await wait(400);
    // день: хозяйки нет дома, мы ещё не знакомы
    await setTime(12);
    await clearToasts();
    await enter('house0');
    let t = await toasts();
    expect(
      (await scene()) === 'world' && t.includes('Плюша') && t.includes('гуляет в парке'),
      'днём дверь должна быть закрыта',
      t,
    );
    // ночь: спит
    await setTime(22.5);
    await clearToasts();
    await enter('house0');
    t = await toasts();
    expect((await scene()) === 'world' && /спит/.test(t), 'ночью хозяйка спит', t);
    // утро: дома; незнакомые знакомятся на пороге
    await setTime(8);
    await enter('house0');
    expect((await text('.dialog .say')).includes('Я Плюша'), 'знакомство на пороге');
    await page.click('.dialog .btn');
    await wait(700);
    let s = await state();
    expect((await scene()) === 'home_plusha', 'не вошли в дом Плюши', await scene());
    expect(
      s.friends.plusha.met && s.visits.plusha === 1 && s.stickers.includes('x_visit'),
      'визит не засчитан',
      s.visits,
    );
    const saved = JSON.parse(await ev(() => localStorage.getItem('rhr-save-v1'))).pos;
    expect(saved.scene === 'world' && Number.isFinite(saved.y), 'в сохранении должно остаться место у двери', saved);
    expect(!Object.keys(s.homes).length, 'мебель чужого дома попала в сохранение');
    const left = await ev(() => document.querySelector('.hud-btns.left').textContent);
    expect(left.includes('Домой') && !left.includes('Обустроить'), 'HUD чужого дома', left);
    // выход через дверь — к двери домика
    const back = await ev(() => window.__dev.scene.back);
    await ev(() => {
      const sc = window.__dev.scene;
      sc.actors[0].x = sc.actors[0].tx = 1000;
      sc.actors[0].wait = 99;
      sc.p.x = 110;
    });
    await page.keyboard.press('KeyE');
    await wait(450);
    const out = await ev(() => ({ scene: window.__dev.sceneName, ...window.__dev.World.playerPos() }));
    expect(
      out.scene === 'world' && Math.abs(out.x - back.x) < 2 && Math.abs(out.y - back.y) < 2,
      'дверь вывела не туда',
      [out, back],
    );
    // день, но хозяйка позвала: «Заходи ко мне сегодня!» — дверь открыта весь день
    await setTime(13);
    await enter('house0');
    expect((await scene()) === 'world', 'днём без приглашения вошли');
    const line = await ev(() => window.__dev.F.inviteLine('plusha'));
    expect(line.includes('Заходи ко мне сегодня'), 'приглашение', line);
    expect((await ev(() => window.__dev.F.inviteLine('plusha'))) === '', 'второе приглашение за день');
    await enter('house0');
    await wait(300);
    expect((await scene()) === 'home_plusha', 'по приглашению не вошли');
    // вечер: другой житель дома без приглашения
    await ev(() => window.__dev.go('world'));
    await setTime(19.5);
    await enter('house6');
    await page.click('.dialog .btn');
    await wait(700);
    expect((await scene()) === 'home_bob', 'вечером не вошли к Бобу');
    // житель сидит в гостях у героини — дома его нет
    await ev(() => {
      window.__dev.go('world');
      window.__dev.actions.inviteGuest('bob', 'villa');
    });
    await clearToasts();
    await enter('house6');
    expect((await scene()) === 'world' && (await toasts()).includes('в гостях'), 'хозяин в гостях у героини');
    await ev(() => window.__dev.actions.removeGuest('bob'));
  });
  // что потрогать в каждом доме и что должно получиться: [предмет, проверка]
  const THINGS = {
    plusha: [
      ['oven', async () => expect(/пирог/i.test(await toasts()), 'духовка')],
      ['rocking_chair', async () => expect((await ev(() => window.__dev.scene.p.state)) === 'sit', 'кресло-качалка')],
      ['tea_table', async () => expect(/Чайник|мятой/.test(await toasts()), 'чайный столик')],
    ],
    ponchik: [
      [
        'fridge_giant',
        async () => {
          expect((await text('.overlay .panel-body')).includes('пончик'), 'холодильник Пончика');
          expect((await state()).dishes.donut === 1, 'пончик из холодильника');
          await closeAll();
          await touch('fridge_giant');
          expect((await state()).dishes.donut === 1, 'второй пончик за день');
          await closeAll();
        },
      ],
      ['oven', async () => expect(/пирог/i.test(await toasts()), 'духовка')],
    ],
    senya: [
      ['barbell', async () => expect(/лапки|чемпионка/.test(await toasts()), 'штанга')],
      ['punchbag', async () => {}],
      ['trophy_shelf', async () => expect(/Кубк|кубк/.test(await toasts()), 'кубки'), 1],
      ['wheel', async () => expect((await ev(() => window.__dev.scene.p.state)) === 'wheel', 'колесо')],
    ],
    busya: [
      ['vanity', async () => expect(/зеркальце|наряд/.test(await toasts()), 'туалетный столик')],
      ['mannequin', async () => {}],
      ['clothes_rack', async () => expect(/Платья|наряды/.test(await toasts()), 'вешалка')],
      // чужим шкафом пользоваться нельзя
      ['wardrobe', async () => expect((await page.locator('.overlay').count()) === 0, 'чужой шкаф открылся')],
    ],
    prof: [
      ['globe', async () => expect(/Глобус|Вжух/.test(await toasts()), 'глобус')],
      ['blackboard', async () => expect(/доске|печенья/.test(await toasts()), 'доска')],
      [
        'telescope',
        async () => {
          // вечером — звёзды; днём — подсказка
          expect(await page.locator('text=Звёзды в телескоп').count(), 'вечером в телескоп должно быть видно звёзды');
          await closeAll();
          await setTime(12);
          await clearToasts();
          await touch('telescope');
          expect(/стемнеет/.test(await toasts()) && !(await page.locator('.overlay').count()), 'телескоп днём');
        },
      ],
    ],
    myata: [
      ['watering_can', async () => expect(/Цветы напились/.test(await toasts()), 'лейка')],
      ['seedling_shelf', async () => {}],
    ],
    bob: [
      [
        'ship_wheel',
        async () => {
          expect(/руля|Курс/.test(await toasts()), 'штурвал');
          const on = await ev(() => {
            const sc = window.__dev.scene;
            return !!sc.live.get(sc.items().find((i) => i.id === 'ship_wheel'));
          });
          expect(on, 'штурвал не крутится');
        },
      ],
      ['seamap', async () => expect(/карте|Пунктир/.test(await toasts()), 'карта')],
      ['hammock', async () => expect((await ev(() => window.__dev.scene.p.state)) === 'sit', 'гамак')],
      ['aquarium', async () => expect(/рыбок/.test(await toasts()), 'аквариум')],
    ],
    zefirka: [
      ['toybox', async () => {}],
      ['dollhouse', async () => {}],
      ['rocking_horse', async () => {}],
      // чужая кровать: лечь спать нельзя
      ['bed_pink', async () => expect((await page.locator('.overlay').count()) === 0, 'чужая кровать')],
    ],
  };
  await step('гости: все 8 домов — хозяин внутри, чай, угощение, изюминки, наклейки', async () => {
    await newGame();
    await ev(() => {
      const d = window.__dev;
      d.actions.addItem('dishes', 'pancakes', 3);
      d.go('world');
    });
    let n = 0;
    for (const [id, house] of NPC) {
      // в разное время суток: утро, вечер, день по приглашению
      const mode = n % 3;
      if (mode === 2) await ev((id) => window.__dev.actions.inviteHome(id), id);
      await setTime(id === 'prof' ? 20.5 : mode === 0 ? 8.2 : mode === 1 ? 19.6 : 13);
      n++;
      await ev(() => window.__dev.go('world'));
      await enter(house);
      await page.click('.dialog .btn'); // знакомство на пороге
      await wait(700);
      expect((await scene()) === 'home_' + id, 'не вошли в дом', id);
      const host = await ev(() => window.__dev.scene.actors.map((a) => a.id + ':' + a.act).join());
      expect(host === `${id}:host:${id}`, 'хозяин дома', host);
      // разговор с хозяином: нажимаем на него, пьём чай, болтаем, угощаем
      const pts0 = (await state()).friends[id].pts;
      await ev(() => {
        const sc = window.__dev.scene,
          a = sc.actors[0];
        a.wait = 99;
        a.tx = a.x;
        sc.standUp();
        sc.p.path = [];
        sc.p.f = a.f;
        sc.p.x = a.x;
      });
      await page.keyboard.press('KeyE');
      await wait(500);
      expect(await page.locator('.dialog').count(), 'хозяин не заговорил', id);
      await page.click('.dialog .opts .btn:nth-child(2)'); // «Попьём чаю?»
      await wait(600);
      expect((await text('.overlay .panel-head')).includes('В гостях'), 'чаепитие не началось', id);
      await page.click('.overlay .panel-foot .btn');
      await wait(500);
      let s = await state();
      expect(s.friends[id].tea === s.day && s.friends[id].pts >= pts0 + 3, 'чай не засчитан', s.friends[id]);
      await page.click('.dialog .opts .btn:nth-child(2)'); // второй раз за день — уже пили
      await wait(400);
      expect((await text('.dialog .say')).includes('уже'), 'чай второй раз за день');
      expect((await state()).friends[id].pts === s.friends[id].pts, 'дружба выросла за второй чай');
      await page.click('.dialog .btn.blue'); // поболтать: реплика про дом
      await wait(400);
      if (id === 'plusha') {
        await page.click('.dialog .btn.yellow'); // угостить
        await wait(400);
        await page.click('.overlay .card .btn');
        await wait(400);
        s = await state();
        const left = Object.values(s.dishes).reduce((a, b) => a + b, 0);
        expect(left === 5 && s.friends.plusha.gift === s.day, 'угощение в гостях', s.dishes);
      }
      await closeAll();
      // изюминки дома
      for (const [item, check, nth] of THINGS[id]) {
        await clearToasts();
        await touch(item, nth || 0);
        await check();
        await closeAll();
      }
    }
    const s = await state();
    expect(Object.keys(s.visits).length === 8, 'визиты', s.visits);
    for (const st of ['x_visit', 'x_visit_all', 'x_tea']) expect(s.stickers.includes(st), 'нет наклейки ' + st);
    await ev(() => window.__dev.go('world'));
    await wait(300);
  });
  await step(
    'гости: задания «В гости к соседям», «Чаепитие», «Звёзды в телескоп», приглашение в разговоре',
    async () => {
      // сюжетные задания жителей города (Сеня — «На вершину!», как только открыт лес) здесь не мешают: они сданы,
      // иначе в гостях житель сначала заговорит о задании (так и должно быть в игре)
      await ev(async () => {
        const D = await import('/js/data/index.js'),
          d = window.__dev;
        d.actions.mutate((s) => {
          for (const q of D.QUESTS)
            if (D.NPCS.some((n) => n.id === q.npc) && !(s.quests[q.id] && s.quests[q.id].done !== null))
              s.quests[q.id] = { day: s.day, n: {}, got: {}, done: s.day };
        });
      });
      const task = async (id) => {
        await ev((id) => {
          const d = window.__dev;
          d.actions.nextDay();
          d.actions.setMail(id);
          d.actions.readMail();
          d.go('world');
        }, id);
        await setTime(13); // день: без «дня гостей» двери были бы закрыты
      };
      const reward = async (name) => {
        await page.waitForSelector('text=Задание выполнено!');
        await wait(300);
        await closeAll();
        await wait(400);
        await closeAll();
        expect((await state()).mail.done, 'задание не выполнено: ' + name);
      };
      // «день гостей» (З2): письмо называет трёх хозяев дня — их двери открыты, у остальных днём закрыто
      const hostsNow = () =>
        ev(async () => {
          const D = await import('/js/data/index.js'),
            s = window.__dev.G.state,
            t = D.TASK_BY_ID[s.mail.task],
            hosts = D.guestHosts(t, s.day);
          return {
            hosts,
            houses: hosts.map((id) => D.NPC_HOME[id].building),
            names: hosts.map((id) => D.NPC_BY_ID[id].name),
            other: D.NPCS.map((n) => n.id).filter((id) => !hosts.includes(id)),
          };
        });
      await task('guesting');
      let hs = await hostsNow();
      expect(hs.hosts.length === 3, '«день гостей»: хозяев должно быть трое', hs);
      await ev(() => window.__dev.F.showLetter());
      await wait(300);
      const letter = await text('.overlay .letter');
      expect(
        hs.names.every((n) => letter.includes(n)) && /Сегодня дома ждут/.test(letter),
        'в письме нет хозяев дня',
        letter,
      );
      await closeAll();
      const busy = hs.other[0],
        busyHouse = await ev(async (id) => (await import('/js/data/index.js')).NPC_HOME[id].building, busy);
      await enter(busyHouse);
      expect((await scene()) === 'world', '«день гостей»: открыта дверь того, кто не ждёт гостей', busy);
      await enter(hs.houses[0]);
      await wait(400);
      expect((await scene()) === 'home_' + hs.hosts[0], '«день гостей»: дверь хозяина дня закрыта', hs.hosts[0]);
      await reward('В гости к соседям');
      await task('teatime');
      hs = await hostsNow();
      await enter(hs.houses[0]);
      await wait(400);
      await ev((id) => {
        window.__dev.F.hostDialog(id, { scene: window.__dev.scene });
      }, hs.hosts[0]);
      await wait(400);
      await page.click('.dialog .opts .btn:nth-child(2)');
      await wait(600);
      await page.click('.overlay .panel-foot .btn');
      await wait(400);
      await closeAll();
      await reward('Чаепитие');
      // «Звёзды в телескоп»: зовёт только Профессор, остальные днём по-прежнему гуляют
      await task('stargaze');
      await enter('house2');
      expect((await scene()) === 'world', 'письмо Профессора открыло чужую дверь');
      await enter('house4');
      await wait(400);
      expect((await scene()) === 'home_prof', 'Профессор звал, а дверь закрыта');
      await setTime(20.5);
      await touch('telescope');
      await closeAll();
      await reward('Звёзды в телескоп');
      // новые задания знает почта: подпись на плашке и письмо открываются
      for (const id of ['captain', 'guesting']) {
        await ev((id) => {
          const d = window.__dev;
          d.actions.setMail(id);
          d.actions.readMail();
          d.F.showLetter();
        }, id);
        await wait(300);
        expect((await text('.overlay .letter')).length > 40, 'письмо ' + id);
        await closeAll();
      }
    },
  );

  await step('гости: кто ждёт дома — не гуляет по городу; утром и вечером жители у своих дверей', async () => {
    // где житель: [id, клеток до двери своего дома, клеток до дневного места, спрятан, «зашёл домой»]
    const where = (id) =>
      ev((id) => {
        const n = window.__dev.World.npcs.find((q) => q.id === id),
          T = 48,
          far = (c) => Math.round(Math.hypot(n.x / T - c[0] - 0.5, n.y / T - c[1] - 0.5));
        return { home: far(n.home), hang: far(n.hang), hidden: n.hidden, inside: n.inside };
      }, id);
    const reenter = async (h) => {
      await ev(() => window.__dev.go('villa'));
      await setTime(h);
      await ev(() => window.__dev.go('world'));
      await wait(300);
    };
    await newGame();
    // первое письмо — не «день гостей» (иначе дома сидели бы все); Плюша позвала в гости: её на улице нет
    await ev(() => {
      window.__dev.actions.setMail('cook');
      window.__dev.actions.inviteHome('plusha');
    });
    await reenter(13);
    let r = await where('plusha');
    expect(r.hidden && r.inside, 'позвала в гости, а гуляет по городу', r);
    // остальные днём — у своих мест, утром и вечером — у своих дверей
    r = await where('myata');
    expect(!r.hidden && r.hang <= 4, 'днём жительница не у своего места', r);
    for (const h of [8, 19.5]) {
      await reenter(h);
      r = await where('myata');
      expect(!r.hidden && r.home <= 4, h + ':00 — жительница далеко от дома', r);
    }
    // позвали прямо на улице: житель идёт к своей двери и «заходит»
    await reenter(13);
    await ev(() => window.__dev.actions.inviteHome('ponchik'));
    await wait(1500);
    r = await where('ponchik');
    expect(!r.hidden || r.inside, 'позвал в гости и сразу пропал посреди улицы', r);
    await ev(() => {
      const n = window.__dev.World.npcs.find((q) => q.id === 'ponchik');
      n.path = [];
      n.x = (n.home[0] + 0.5) * 48;
      n.y = (n.home[1] + 0.5) * 48;
    });
    await wait(300);
    r = await where('ponchik');
    expect(r.hidden && r.inside, 'дошёл до двери, но остался на улице', r);
    // ночью на улице никого; наутро (новый день) приглашения нет — все снова на улице
    await setTime(23);
    await wait(200);
    expect(await ev(() => window.__dev.World.npcs.every((n) => n.hidden)), 'ночью жители на улице');
    await ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.actions.setMail('cook');
    });
    await closeAll();
    await reenter(12);
    await closeAll();
    const hidden = await ev(() => window.__dev.World.npcs.filter((n) => n.hidden).map((n) => n.id));
    expect(!hidden.length, 'наутро без приглашения жители не вышли на улицу', hidden);
    // письмо «день гостей» (З2): пока оно не прочитано — все гуляют; прочитали — трое хозяев дня ждут дома
    // (и утром, и днём), остальные гуляют как обычно — на улицах кто-то есть
    await ev(() => window.__dev.actions.setMail('guesting'));
    const streets = () =>
      ev(async () => {
        const D = await import('/js/data/index.js'),
          s = window.__dev.G.state,
          hosts = D.guestHosts(D.TASK_BY_ID[s.mail.task], s.day),
          npcs = window.__dev.World.npcs;
        return {
          hosts,
          waiting: npcs.filter((n) => hosts.includes(n.id)).every((n) => n.hidden && n.inside),
          out: npcs.filter((n) => !n.hidden).map((n) => n.id),
        };
      });
    for (const h of [8.3, 12]) {
      await reenter(h);
      const r = await streets();
      expect(r.out.length === 8, `«день гостей», ${h}:00, письмо не прочитано — кто-то уже сидит дома`, r);
    }
    await ev(() => window.__dev.actions.readMail());
    for (const h of [8.3, 12]) {
      await reenter(h);
      const r = await streets();
      expect(r.hosts.length === 3 && r.waiting, `«день гостей», ${h}:00: хозяева дня не ждут дома`, r);
      expect(
        r.out.length === 5 && r.out.every((id) => !r.hosts.includes(id)),
        `«день гостей», ${h}:00: на улицах должны гулять остальные пятеро`,
        r,
      );
    }
    // прочитали письмо прямо на улице: хозяева сами идут домой (звёздочка ведёт к ближайшему)
    await ev(() => {
      const d = window.__dev;
      d.actions.nextDay();
      d.actions.setMail('teatime');
    });
    await closeAll();
    await reenter(12);
    expect((await streets()).out.length === 8, '«Чаепитие» не прочитано, а кто-то дома');
    await ev(() => window.__dev.actions.readMail());
    await wait(200);
    const tg = await ev(() => {
      const W = window.__dev.World,
        t = W.target();
      return t && { x: Math.round(t.x / 48), y: Math.round(t.y / 48) };
    });
    expect(!!tg, '«Чаепитие»: звёздочка не показывает домик хозяина', tg);
  });

  // ---------- B. жильё ----------
  // [жильё, цена, название на карточке, здание в городе, через дверь которого туда входят]
  const HOMES = [
    ['flat', 25000, 'Квартира', 'home_apartment'],
    ['bungalow', 60000, 'бунгало', 'home_bungalow'],
    ['suite', 80000, 'люкс', 'hotel'],
    ['penthouse', 150000, 'Пентхаус', 'tower'],
  ];
  /**
   * Войти в своё жильё так, как это делает игрок: дверь здания; пентхаус — лифт Хомяк-Тауэра, «100 — мой пентхаус»;
   * номер-люкс — дверь отеля, потом золотая дверь «Люкс» в коридоре второго этажа (П.17).
   */
  const enterHome = async (id) => {
    const building = HOMES.find((h) => h[0] === id)[3];
    await ev(() => {
      if (window.__dev.sceneName !== 'world') window.__dev.go('world');
    });
    await enter(building);
    if (id === 'penthouse') {
      await ev(() => window.__dev.Tower.debugAt(940));
      await page.keyboard.press('KeyE');
      await wait(450);
      expect((await text('.dialog .say')).includes('пентхаус'), 'лифт не спросил этаж');
      await page.click('.dialog .btn.green');
      await wait(500);
    }
    if (id === 'suite') {
      expect((await scene()) === 'hotel', 'дверь отеля не ведёт в отель', await scene());
      await run('hotel:suite');
    }
    expect((await scene()) === id, 'через дверь не вошли в своё жильё ' + id, await scene());
  };
  /** Дверь люкса ведёт в коридор отеля, к золотой двери; дальше — дверь отеля на набережную. */
  const leaveSuite = async () => {
    const r = await ev(() => ({ scene: window.__dev.sceneName, f: window.__dev.scene.p.f, x: window.__dev.scene.p.x }));
    expect(r.scene === 'hotel' && r.f === 1 && Math.abs(r.x - 1190) < 2, 'дверь люкса ведёт не в коридор отеля', r);
    await leaveByDoor();
  };
  await step('жильё: риелтор — нехватка монет, покупка каждого дома, мебель, сон, обустройство, дверь', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // риелтор — в своём агентстве; в банке кнопки «Недвижимость» больше нет
    await enter('bank');
    expect(
      (await page.locator('.overlay .panel-foot >> text=Недвижимость').count()) === 0,
      'в банке осталась «Недвижимость»',
    );
    await closeAll();
    // денег мало: видно «накопить ещё», покупка не проходит
    await enter('realtor');
    expect((await text('.overlay .panel-head .title')) === 'Недвижимость', 'окно риелтора');
    expect((await page.locator('.overlay .home-card').count()) === 5, 'карточки жилья');
    expect((await page.locator('.overlay .home-card canvas.home-plan').count()) === 5, 'картинки-планы');
    expect((await text('.overlay .home-card .lack')).includes('накопить ещё 22 000'), 'сколько накопить');
    expect((await page.locator('.overlay .home-card.soon .btn').count()) === 0, '«скоро» нельзя купить');
    await clearToasts();
    await page.click('.overlay .home-card .btn');
    await wait(300);
    let s = await state();
    expect(/не хватает 22 000/.test(await toasts()) && s.money === 3000 && !s.homesOwned.length, 'покупка без монет');
    await closeAll();
    // дверь некупленного жилья открывает окно риелтора
    for (const b of ['home_apartment', 'home_bungalow']) {
      await clearToasts();
      await enter(b);
      expect(
        (await scene()) === 'world' &&
          (await page.locator('.overlay .home-card').count()) === 5 &&
          (await toasts()).includes('продаётся'),
        'дверь некупленного жилья ' + b,
        await toasts(),
      );
      await closeAll();
    }
    await setMoney(400000);
    let money = 400000;
    for (const [id, price, name, building] of HOMES) {
      // покупаем у риелтора; квартиру — прямо у её двери (тогда «Идём туда!» сразу приводит в дом)
      await standAt(id === 'flat' ? building : 'realtor');
      await enter(id === 'flat' ? building : 'realtor');
      const card = `.overlay .home-card:has(.ttl:has-text("${name}"))`;
      await page.click(card + ' .btn');
      await wait(400);
      expect(
        norm(await lastOv().locator('.panel-body').innerText()).includes(String(price / 1000)),
        'подтверждение покупки',
        id,
      );
      await lastOv().locator('.panel-foot .btn.green').click();
      await wait(700);
      expect(await page.locator('text=С новосельем!').count(), 'нет поздравления', id);
      expect((await page.locator('.overlay >> text=Перейти домой').count()) === 0, 'осталась кнопка «Перейти домой»');
      money -= price;
      s = await state();
      expect(s.money === money && s.homesOwned.includes(id) && s.ledger.today.out >= price, 'покупка', [
        s.money,
        s.homesOwned,
      ]);
      expect((await scene()) === 'world', 'после покупки сразу оказались в доме', await scene());
      if (id === 'flat') {
        // «Идём туда!» — хомячок сам идёт к двери и входит
        await lastOv().locator('.panel-foot .btn.green').click();
        for (let i = 0; i < 20 && (await scene()) !== id; i++) await wait(250);
        expect((await scene()) === id, '«Идём туда!» не привело в новый дом', await scene());
      } else {
        await lastOv().locator('.panel-foot .btn.ghost').click(); // «Потом»
        await wait(300);
        await enterHome(id); // через дверь здания (пентхаус — из лифта башни)
      }
      s = await state();
      const ids = s.homes[id].map((i) => i.id);
      expect(
        ids.some((q) => q.startsWith('bed_')) && ids.some((q) => q.startsWith('wardrobe')),
        'нет кровати или шкафа',
        ids,
      );
      expect(s.pos.scene === id, 'позиция в новом доме', s.pos);
      const hud = await ev(() => document.querySelector('.hud-btns.left').textContent);
      expect(hud.includes('Обустроить'), 'нет «Обустроить»', hud);
      // шкаф открывается, кровать — своя: сон, утро в этом же доме у кровати
      await touch(ids.find((q) => q.startsWith('wardrobe')));
      expect((await text('.overlay .panel-head .title')) === 'Мой шкаф', 'шкаф в новом доме');
      await closeAll();
      const day = s.day;
      await sleep();
      await closeAll();
      const r = await ev((id) => {
        const d = window.__dev,
          bed = d.houseItems(id).find((i) => i.id.startsWith('bed_'));
        return { scene: d.sceneName, day: d.G.state.day, x: d.scene.p.x, f: d.scene.p.f, bed };
      }, id);
      expect(
        r.scene === id && r.day === day + 1 && Math.abs(r.x - (r.bed.x + 30)) < 1 && r.f === r.bed.floor,
        'сон в новом доме',
        r,
      );
      // обустройство: убрать предмет в кладовку и поставить обратно; последнюю кровать убрать нельзя
      await page.click('.hud-btns.left .rbtn:last-child');
      await wait(300);
      expect(await ev(() => window.__dev.scene.isDecor()), 'режим обустройства');
      // берём предмет рядом с хомячком (на телефоне дом целиком на экран не помещается)
      const lamp = await ev(async (id) => {
        const d = window.__dev,
          F = (await import('./js/data/index.js')).FURN_BY_ID,
          p = d.scene.p;
        const it = d
          .houseItems(id)
          .filter((i) => i.floor === p.f && !F[i.id].wall && F[i.id].layer !== 0 && F[i.id].act !== 'sleep')
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        return { id: it.id, ...d.scene.debugScreen(it.x, d.scene.geo.fy(it.floor) - 30) };
      }, id);
      const had = (await state()).storage[lamp.id] || 0; // такой же предмет мог остаться в кладовке от прошлого дома
      await page.mouse.click(lamp.x, lamp.y);
      await wait(250);
      await page.click('text=Убрать в кладовку');
      await wait(300);
      s = await state();
      expect(
        s.storage[lamp.id] === had + 1 && s.homes[id].length === ids.length - 1,
        'предмет не убрался в кладовку',
        [id, lamp.id, had, s.storage[lamp.id]],
      );
      await page.click(`.decor-tray .tray-item`);
      await wait(300);
      s = await state();
      expect(s.homes[id].length === ids.length, 'предмет из кладовки не встал', Object.keys(s.storage));
      await page.click('text=Готово');
      await wait(300);
      // дверь ведёт к двери здания, через которое вошли (пентхаус — к дверям башни)
      await leaveByDoor();
      if (id === 'suite') await leaveSuite();
      await outAt(building, 'дверь нового дома ' + id);
    }
    s = await state();
    for (const st of ['x_home2', 'x_homes_all']) expect(s.stickers.includes(st), 'нет наклейки ' + st);
    expect(s.villa.length > 20 && Object.keys(s.homes).length === 4, 'мебель домов', Object.keys(s.homes));
  });
  await step('жильё: «Мои дома», основной дом, «Домой», пентхаус из лифта башни, гости, перезагрузка', async () => {
    // «Мои дома» — из меню
    await ev(() => {
      window.__dev.F.openSettings();
    });
    await wait(350);
    await page.click('.overlay >> text=Мои дома');
    await wait(450);
    expect((await page.locator('.overlay .home-card').count()) === 5, 'мои дома');
    expect((await text('.overlay .panel-head .title')) === 'Мои дома', 'заголовок окна «Мои дома»');
    // из меню — только список и выбор основного дома: ни вкладки «Купить», ни мгновенного перехода
    expect((await page.locator('.overlay .tab').count()) === 0, 'в «Моих домах» из меню есть вкладки');
    expect(
      (await page.locator('.overlay .home-card .btn:has-text("Перейти")').count()) === 0,
      'остался «Перейти домой»',
    );
    expect((await text('.overlay .home-card .tag')).includes('основной'), 'основной дом по умолчанию — вилла');
    await page.click('.overlay .home-card:has(.ttl:has-text("Квартира")) >> text=Сделать основным');
    await wait(300);
    expect((await state()).homeMain === 'flat', 'основной дом не выбран');
    await closeAll();
    // «Домой» (с пляжа, далеко от дома) ведёт в основной дом; его дверь выводит к двери жилого дома
    await standAt('beachcafe');
    await page.click('.hud-btns.left .rbtn:last-child');
    await wait(400);
    expect((await text('.overlay .panel-body')).includes('Квартира'), 'вопрос «Домой?»');
    expect(await page.locator('.overlay .panel-foot >> text=основной дом').count(), 'нет кнопки выбора основного дома');
    await page.click('.overlay .panel-foot .btn.green');
    await wait(500);
    expect((await scene()) === 'flat', '«Домой» ведёт не в основной дом', await scene());
    await leaveByDoor();
    await outAt('home_apartment', 'дверь квартиры после «Домой»');
    // «Мои дома» в своём доме: «ты здесь», перейти в другой дом отсюда нельзя — только через его дверь
    await enterHome('flat');
    await run('realtor:mine');
    expect(
      (await text('.overlay .home-card:has(.ttl:has-text("Квартира"))')).includes('Ты сейчас здесь'),
      '«Ты здесь»',
    );
    expect(
      (await page.locator('.overlay .home-card .btn:has-text("Перейти")').count()) === 0,
      'остался «Перейти домой»',
    );
    await closeAll();
    await leaveByDoor();
    await enterHome('bungalow');
    await leaveByDoor();
    await outAt('home_bungalow', 'дверь бунгало ведёт не к бунгало');
    // таблички «мой дом» на зданиях купленного жилья
    const signs = await ev(() => {
      const W = window.__dev.World,
        ids = [];
      W.desc.things(W, (y, f, b) => ids.push(b.id), { x0: 0, y0: 0, x1: 1e6, y1: 1e6 });
      return ids.sort().join();
    });
    expect(signs === 'home_apartment,home_bungalow,hotel', 'таблички «мой дом» (и «мой люкс» на отеле)', signs);
    // пентхаус: лифт Хомяк-Тауэра спрашивает этаж
    await enterHome('penthouse');
    // гости приходят в тот дом, где героиня; телефон предлагает выбрать
    await ev(() => {
      const d = window.__dev;
      d.actions.meetFriend('bob');
      d.F.openPhone();
    });
    await wait(350);
    expect((await page.locator('.overlay .opt').count()) === 5, 'телефон: выбор дома');
    expect((await text('.overlay .opt.sel')).includes('Пентхаус'), 'телефон: по умолчанию — где героиня');
    await page.click('.overlay .list-item .btn.green');
    await wait(400);
    await closeAll();
    let r = await ev(() => ({
      at: window.__dev.G.state.guestsAt,
      here: window.__dev.scene.actors.map((a) => a.id),
      villa: window.__dev.scenes.villa.actors.length,
    }));
    expect(r.at === 'penthouse' && r.here.includes('bob'), 'гость не пришёл в пентхаус', r);
    await ev(() => window.__dev.go('flat', { back: { scene: 'world' } }));
    await wait(300);
    expect((await ev(() => window.__dev.scene.actors.length)) === 0, 'гость оказался не в том доме');
    // перезагрузка: игра открывается в своём доме, дверь помнит, куда ведёт
    await enterHome('bungalow');
    const at = await doorOf('home_bungalow');
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(700);
    expect((await scene()) === 'bungalow', 'после перезагрузки не в своём доме', await scene());
    await ev(() => {
      window.__dev.scene.p.x = 100;
    });
    await page.keyboard.press('KeyE');
    await wait(450);
    r = await ev(() => ({ scene: window.__dev.sceneName, ...window.__dev.World.playerPos() }));
    expect(r.scene === 'world' && Math.abs(r.x - at.x) < 2 && Math.abs(r.y - at.y) < 2, 'дверь после перезагрузки', [
      r,
      at,
    ]);
  });

  // ---------- C. бизнес ----------
  const BIZ = [
    ['cafe', 'cafe', 40000, 1500],
    ['beachcafe', 'beachcafe', 55000, 2000],
    ['salon', 'salon', 60000, 2200],
    ['boutique', 'boutique', 70000, 2500],
    ['rest', 'rest', 90000, 3500],
  ];
  /** Зайти в заведение через дверь и открыть его «кабинет» (кнопка в окне или вариант в диалоге). */
  const office = async (building) => {
    await enter(building);
    if (await page.locator('.dialog').count()) await page.click('.dialog .btn:has-text("заведение")');
    else await page.click('.overlay .panel-foot .btn:has-text("заведение")');
    await wait(450);
  };
  await step('жильё: лесной домик — продаётся, когда лес открыт; покупка, дверь в лесу, «мой дом», «Домой»', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    const card = '.overlay .home-card:has(.ttl:has-text("Лесной домик"))';
    // лес закрыт: в агентстве домик «скоро» — дорогу покажет Мята, купить нельзя
    await setMoney(100000);
    await enter('realtor');
    expect(
      (await page.locator(card + '.soon').count()) === 1 && (await text(card)).includes('Мята'),
      'лесной домик до открытия леса',
      await text(card),
    );
    expect((await page.locator(card + ' .btn').count()) === 0, 'лесной домик можно купить, пока лес закрыт');
    await closeAll();
    // лес открыт: дверь домика в лесу — окно риелтора с подсказкой «…продаётся!»
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.go('forest');
    });
    await wait(300);
    const enterCabin = () =>
      ev(() => {
        const sc = window.__dev.locations.forest;
        sc.enterBuilding(sc.map.bById.cabin);
      });
    await clearToasts();
    await enterCabin();
    await wait(450);
    expect(
      (await scene()) === 'forest' &&
        (await toasts()).includes('Лесной домик продаётся') &&
        (await page.locator(card + ' .btn').count()) === 1,
      'дверь некупленного лесного домика',
      await toasts(),
    );
    await ev(() => {
      window.__stopWatchCabin = window.__dev.watchState();
    });
    await page.click(card + ' .btn');
    await wait(400);
    await lastOv().locator('.panel-foot .btn.green').click();
    await wait(700);
    expect(await page.locator('text=С новосельем!').count(), 'нет поздравления (лесной домик)');
    let s = await state();
    expect(s.homesOwned.includes('cabin') && s.money === 55000, 'покупка лесного домика', [s.homesOwned, s.money]);
    await closeAll();
    // через дверь в лесу — внутрь: три бревенчатые комнаты, кровать и шкаф на месте
    await enterCabin();
    await wait(500);
    expect((await scene()) === 'cabin', 'через дверь в лесу не вошли в домик', await scene());
    const inside = await ev(() => {
      const sc = window.__dev.scene;
      return { rooms: sc.desc.rooms.map((r) => r.paper), items: window.__dev.houseItems('cabin').map((i) => i.id) };
    });
    expect(
      inside.rooms.length === 3 &&
        inside.rooms.every((p) => p === 'logs') &&
        inside.items.some((q) => q.startsWith('bed_')) &&
        inside.items.includes('wardrobe') &&
        inside.items.includes('fireplace'),
      'внутри лесного домика',
      inside,
    );
    // дверь изнутри — обратно в лес, к двери домика; на домике — табличка «мой дом»
    await leaveByDoor();
    const out = await ev(() => {
      const d = window.__dev,
        sc = d.locations.forest,
        door = sc.doorOf('cabin'),
        n = [];
      sc.desc.things(sc, (y, f) => n.push(f), { x0: 0, y0: 0, x1: 1e6, y1: 1e6 });
      return { scene: d.sceneName, dx: Math.abs(sc.p.x - door.x), dy: Math.abs(sc.p.y - door.y), plates: n.length };
    });
    expect(out.scene === 'forest' && out.dx < 2 && out.dy < 2 && out.plates >= 1, 'выход из лесного домика', out);
    const bad = await ev(() => window.__stopWatchCabin());
    expect(!bad.length, 'лесной домик: запись в состояние мимо действий', bad.slice(0, 3));
    // основной дом — лесной домик: «Домой» из города ведёт в него, его дверь — в лес
    await ev(() => {
      const d = window.__dev;
      d.actions.setMainHome('cabin');
      d.go('world');
    });
    await wait(300);
    await ev(() => {
      window.__dev.F.askGoHome();
    });
    await wait(400);
    await page.click('.overlay .panel-foot .btn.green');
    await wait(500);
    expect((await scene()) === 'cabin', '«Домой» не привело в лесной домик', await scene());
    await leaveByDoor();
    expect((await scene()) === 'forest', 'дверь лесного домика после «Домой» ведёт не в лес', await scene());
    await ev(() => window.__dev.actions.setMainHome('villa'));
  });
  await step('бизнес: покупка каждого заведения у хозяина, вывеска, наклейки', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // монет мало: предложение видно, купить нельзя
    await office('cafe');
    let body = await text('.overlay .panel-body');
    expect(
      body.includes('40 000') && body.includes('накопить ещё 37 000') && body.includes('1 500 в день'),
      'предложение',
      body,
    );
    await clearToasts();
    await page.click('.overlay .biz-buy .btn');
    await wait(300);
    let s = await state();
    expect(
      /не хватает 37 000/.test(await toasts()) && s.money === 3000 && !Object.keys(s.biz).length,
      'покупка без монет',
    );
    await closeAll();
    await setMoney(400000);
    let money = 400000;
    for (const [id, building, price] of BIZ) {
      await office(building);
      await page.click('.overlay .biz-buy .btn');
      await wait(400);
      await lastOv().locator('.panel-foot .btn.green').click(); // «Да, покупаю!»
      await wait(700);
      expect(await page.locator('text=Теперь ты хозяйка!').count(), 'нет поздравления', id);
      await page.click('.overlay .panel-foot .btn');
      await wait(600);
      money -= price;
      s = await state();
      expect(s.money === money && s.biz[id] && s.biz[id].till === 0 && s.biz[id].day === s.day, 'покупка заведения', [
        id,
        s.money,
      ]);
      // после покупки открыт кабинет: вывеска с именем хозяйки, касса пуста
      expect((await text('.overlay .biz-sign')).includes('хозяйка — ' + s.name), 'вывеска в кабинете', id);
      expect(await page.locator('.overlay .biz-till .btn[disabled]').count(), 'касса должна быть пустой', id);
      await closeAll();
      // у двери: бывший хозяин на месте, табличка «Хозяйка — …» и кнопка «Моё заведение»
      await enter(building);
      if (await page.locator('.dialog').count()) {
        expect((await text('.dialog .say')).includes('хозяйка пришла'), 'диалог у двери своего заведения', id);
        expect(await page.locator('.dialog .btn:has-text("Моё заведение")').count(), 'нет «Моё заведение»', id);
      } else {
        expect((await text('.overlay .biz-sign')).includes('хозяйка — '), 'нет таблички в окне заведения', id);
        expect(
          await page.locator('.overlay .panel-foot .btn:has-text("Моё заведение")').count(),
          'нет «Моё заведение»',
          id,
        );
      }
      await closeAll();
    }
    s = await state();
    for (const st of ['x_biz', 'x_biz_chain', 'x_biz_all']) expect(s.stickers.includes(st), 'нет наклейки ' + st);
    expect(s.ledger.today.out === 315000, 'траты на заведения', s.ledger.today.out);
    // своё название и цвет вывески
    await run('biz:cafe');
    await page.fill('.overlay .biz-signedit input', 'Кафе «Пуговка»');
    await page.press('.overlay .biz-signedit input', 'Enter');
    await wait(300);
    await page.click('.overlay .biz-signedit .opt:nth-child(4)');
    await wait(300);
    s = await state();
    expect(s.biz.cafe.title === 'Кафе «Пуговка»' && /^#/.test(s.biz.cafe.sign), 'вывеска', s.biz.cafe);
    await closeAll();
    await enter('cafe');
    expect((await text('.overlay .biz-sign')).includes('Кафе «Пуговка»'), 'своё название на табличке');
    await closeAll();
    // в городе у каждого своего заведения висит табличка «моё» (рисуется поверх здания, в цвете вывески)
    const signs = await ev(() => {
      const W = window.__dev.World,
        ids = [];
      W.desc.things(W, (y, f, b) => ids.push(b.id), { x0: 0, y0: 0, x1: 1e6, y1: 1e6 });
      return ids.sort().join();
    });
    expect(
      signs ===
        BIZ.map((b) => b[1])
          .sort()
          .join(),
      'таблички «моё» на зданиях',
      signs,
    );
    await standAt('cafe');
    await wait(300); // кадр с табличкой рисуется без ошибок (их ловит общий обработчик автотеста)
    // своё название — и на большой вывеске здания (З1): оно в ключе спрайта; переименовали — новая картинка
    const signKeys = (title) =>
      ev((title) => {
        const d = window.__dev,
          b = d.World.map.bById.cafe,
          SP = d.topdown.SP;
        const keys = [0, 1].flatMap((snow) => [0, 1].map((lit) => `b:world:cafe:${snow}:${lit}:${title}`));
        return { text: b.signText(), drawn: keys.some((k) => SP.find(k)) };
      }, title);
    let sk = await signKeys('Кафе «Пуговка»');
    expect(sk.text === 'Кафе «Пуговка»' && sk.drawn, 'своё название не на вывеске здания', sk);
    await run('biz:cafe');
    await page.fill('.overlay .biz-signedit input', 'Вкусное кафе у Пуговки');
    await page.press('.overlay .biz-signedit input', 'Enter');
    await wait(300);
    await closeAll();
    await wait(300);
    sk = await signKeys('Вкусное кафе у Пуговки');
    expect(sk.text === 'Вкусное кафе у Пуговки' && sk.drawn, 'вывеска не обновилась после переименования', sk);
    // название как было — на вывеске снова прежнее (своего названия нет)
    await ev(() => window.__dev.actions.setBizOpt('cafe', 'title', null));
    expect((await ev(() => window.__dev.World.map.bById.cafe.signText())) === null, 'вывеска без своего названия');
    await ev(() => window.__dev.actions.setBizOpt('cafe', 'title', 'Кафе «Пуговка»'));
  });
  await step('бизнес: выручка на следующий день, утреннее напоминание, касса, «Мои заведения», банк', async () => {
    await ev(() => window.__dev.go('villa'));
    const day = (await state()).day;
    await clearToasts();
    await sleep();
    await page.waitForFunction(
      () => /ждёт выручка/.test((document.querySelector('#toasts') || {}).textContent || ''),
      null,
      {
        timeout: 7000,
      },
    );
    expect(norm(await toasts()).includes('11 700'), 'утреннее напоминание', await toasts());
    await closeAll();
    let s = await state();
    expect(s.day === day + 1, 'день не сменился');
    for (const [id, , , income] of BIZ)
      expect(s.biz[id].till === income && s.biz[id].last === income, 'выручка ' + id, s.biz[id]);
    const m0 = s.money;
    // «Мои заведения» — из банка: всё видно, но забрать можно только в заведении
    await ev(() => window.__dev.go('world'));
    await enter('bank');
    await page.click('.overlay .panel-foot >> text=Мои заведения');
    await wait(450);
    const my = await text('.overlay .panel-body');
    expect(
      my.includes('Заведений: 5 из 5') && my.includes('11 700') && my.includes('Кафе «Пуговка»'),
      'мои заведения',
      my.slice(0, 160),
    );
    expect(
      (await page.locator('.overlay .biz-row.mine').count()) === 5 &&
        !(await page.locator('.overlay .biz-row .btn').count()),
      'список заведений',
    );
    await closeAll();
    // касса — в самом заведении
    await office('rest');
    expect((await text('.overlay .biz-till .big')).includes('3 500'), 'касса ресторана');
    await page.click('.overlay .biz-till .btn');
    await wait(300);
    s = await state();
    expect(s.money === m0 + 3500 && s.biz.rest.till === 0 && s.biz.rest.total === 3500, 'выручка не забрана', [
      s.money - m0,
      s.biz.rest,
    ]);
    expect(s.ledger.today.in.business === 3500 && s.earned >= 3500, 'доход от бизнеса не учтён', s.ledger.today);
    expect(await page.locator('.money-fly.plus').count(), 'нет отклика «+3 500»');
    await closeAll();
    await enter('bank');
    expect((await text('.overlay .bank-day')).includes('Свой бизнес'), 'банк не показывает доход от бизнеса');
    await closeAll();
    // касса не резиновая: в ней помещается выручка за три дня
    await ev(() => {
      for (let i = 0; i < 6; i++) window.__dev.actions.nextDay();
      window.__dev.F.newDayMail();
    });
    s = await state();
    expect(s.biz.cafe.till === 4500 && s.biz.rest.till === 10500 && s.biz.cafe.last === 0, 'предел кассы', [
      s.biz.cafe,
      s.biz.rest,
    ]);
    await office('cafe');
    expect((await text('.overlay .biz-till')).includes('Касса полная'), 'нет подсказки о полной кассе');
    await page.click('.overlay .biz-till .btn');
    await wait(300);
    expect((await state()).biz.cafe.till === 0, 'касса кафе');
    await closeAll();
  });
  await step('бизнес: работа хозяйки — шеф-повар в своём ресторане, блюдо дня, выручка больше', async () => {
    // «Шеф-повар» заканчивается сам на три звезды (подменяем только ход игры)
    await ev(async () => {
      const mod = (await import('./js/minigames/chef.js')).default;
      window.__chefStart = mod.start;
      mod.start = (host) => {
        const t = setTimeout(() => host.finish({ stars: 3, text: 'проверка' }), 60);
        return { stop: () => clearTimeout(t) };
      };
    });
    await ev(() => window.__dev.go('world'));
    // блюдо дня: выбрать в кабинете ресторана (заодно забрать выручку — касса полная)
    await office('rest');
    await page.click('.overlay .biz-till .btn');
    await wait(300);
    await page.click('.overlay .biz-work >> text=Выбрать');
    await wait(400);
    await page.click('.overlay .card.tap');
    await wait(500);
    let s = await state();
    expect(s.biz.rest.special && (await text('.overlay .panel-body')).includes('Блюдо дня:'), 'блюдо дня', s.biz.rest);
    await closeAll();
    const m0 = s.money;
    await enter('rest');
    const say = await text('.dialog .say');
    expect(say.includes('975') && say.includes('Ты здесь хозяйка'), 'диалог перед работой хозяйки', say);
    await page.click('.dialog .btn.green');
    await wait(600);
    expect((await text('#mg .mg-card')).includes('Ты здесь хозяйка'), 'заставка мини-игры для хозяйки');
    await page.click('#mg >> text=Начать!');
    await wait(450);
    const res = await text('#mg .mg-card');
    expect(res.includes('+975') && res.includes('+50%'), 'результат смены хозяйки', res);
    await page.click('#mg >> text=Ура!');
    await wait(450);
    s = await state();
    expect(
      s.money === m0 + 975 && s.dayFlags.bizWork.rest === 3 && s.stickers.includes('x_biz_work'),
      'работа хозяйки',
      [s.money - m0, s.dayFlags],
    );
    const want = 3500 + 1750 + 350; // выручка + половина за три звезды + блюдо дня (обычный рецепт)
    await run('biz:rest');
    expect(
      (await text('.overlay .biz-facts')).includes('5 600'),
      'кабинет: выручка за сегодня',
      await text('.overlay .biz-facts'),
    );
    await closeAll();
    const till0 = s.biz.rest.till;
    await ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.F.newDayMail();
    });
    s = await state();
    expect(
      s.biz.rest.last === Math.min(want, 10500 - till0) && !s.dayFlags.bizWork,
      'выручка после работы хозяйки',
      s.biz.rest,
    );
    await ev(async () => {
      (await import('./js/minigames/chef.js')).default.start = window.__chefStart;
    });
  });
  await step('«Бариста»: за стойкой чужого кафе и своего, игра до конца', async () => {
    /** Пройти «Бариста» по-настоящему: читать заказ и нажимать нужное на полках. wrong — ошибиться в первом заказе. */
    const play = async (wrong) => {
      await page.click('#mg >> text=Начать!');
      await wait(500);
      for (let order = 0; order < 6; order++) {
        await page.waitForFunction(
          (n) => document.querySelector('#mg .brs-count').textContent.includes(`Заказ ${n} `),
          order + 1,
        );
        await wait(250);
        if (wrong && order === 0) {
          // нажать то, чего в заказе нет: игра не заканчивается, заказ остаётся
          await ev(() => {
            const want = [...document.querySelectorAll('#mg .brs-want .brs-it')].map((e) => e.textContent);
            [...document.querySelectorAll('#mg .brs-b')]
              .find((b) => !want.includes(b.querySelector('.em').textContent))
              .click();
          });
          await wait(200);
          expect((await text('#mg .brs-msg')).includes('нет'), 'ошибка в заказе');
        }
        for (let i = 0; i < 5; i++) {
          const left = await ev(() => {
            const it = document.querySelector('#mg .brs-want .brs-it:not(.done)');
            if (!it) return 0;
            [...document.querySelectorAll('#mg .brs-b')]
              .find((b) => b.querySelector('.em').textContent === it.textContent)
              .click();
            return document.querySelectorAll('#mg .brs-want .brs-it:not(.done)').length;
          });
          await wait(120);
          if (!left) break;
        }
      }
      await page.waitForSelector('#mg .mg-card .stars');
      await wait(300);
      const res = await text('#mg .mg-card');
      const stars = await page.locator('#mg .mg-card .stars span:not(.off)').count();
      await page.click('#mg >> text=Ура!');
      await wait(450);
      return { res, stars };
    };
    // чужое кафе: бариста — обычная работа с зарплатой
    await newGame();
    await ev(() => window.__dev.go('world'));
    await enter('cafe');
    await page.click('.overlay .panel-foot >> text=Помочь за стойкой');
    await wait(700);
    expect(
      (await text('#mg .mg-card')).includes('Зарплата') && !(await text('#mg .mg-card')).includes('хозяйка'),
      'заставка «Бариста»',
    );
    let r = await play(true);
    let s = await state();
    expect(r.stars === 3 && r.res.includes('+550'), 'итог «Бариста»', r);
    expect(
      s.money === 3550 && s.plays.barista === 1 && s.dayFlags.shifts.barista === 1 && !s.dayFlags.bizWork,
      'зарплата бариста',
      [s.money, s.dayFlags],
    );
    // пляжное кафе: своё меню
    await enter('beachcafe');
    await page.click('.dialog .btn.green');
    await wait(450);
    await page.click('.overlay .panel-foot >> text=Помочь за стойкой');
    await wait(700);
    await page.click('#mg >> text=Начать!');
    await wait(500);
    expect((await text('#mg .brs-shelves')).includes('Лимонад'), 'пляжное меню');
    await page.click('#mg .xbtn');
    await wait(400);
    // своё кафе: хозяйке платят больше, выручка дня растёт
    await ev(() => window.__dev.actions.addBiz('beachcafe'));
    await enter('beachcafe');
    await page.click('.dialog .btn.green');
    await wait(450);
    await page.click('.overlay .panel-foot >> text=Встать за стойку');
    await wait(700);
    expect((await text('#mg .mg-card')).includes('Ты здесь хозяйка'), 'заставка для хозяйки кафе');
    r = await play(false);
    s = await state();
    expect(r.res.includes('+825') && s.money === 3550 + 825 && s.dayFlags.bizWork.beachcafe === 3, 'бариста-хозяйка', [
      r,
      s.dayFlags,
    ]);
    expect(s.dayFlags.shifts.barista === 2, 'смены бариста — общие на оба кафе', s.dayFlags.shifts);
    await ev(() => {
      window.__dev.F.openAlbum();
    });
    await wait(300);
    await page.click('.overlay .tab:has-text("Рекорды")'); // вкладки альбома: журнал, наклейки, друзья, рекорды
    await wait(300);
    expect((await text('.overlay .panel-body')).includes('Бариста'), 'рекорды: нет «Бариста»');
    await closeAll();
  });
  await step('«Стилист» и «Витрина»: работа хозяйки в своём салоне и бутике, игра до конца', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    // в чужом салоне и бутике работы нет — только «Купить заведение»
    for (const b of ['salon', 'boutique']) {
      await enter(b);
      expect((await page.locator('.overlay .panel-foot .btn').count()) === 1, 'в чужом заведении есть работа', b);
      await closeAll();
    }
    await ev(() => {
      window.__dev.actions.addBiz('salon');
      window.__dev.actions.addBiz('boutique');
    });
    for (const [b, game, btn, word] of [
      ['salon', 'stylist', 'Сделать причёску', 'Гостья'],
      ['boutique', 'window', 'Оформить витрину', 'Эскиз'],
    ]) {
      const m0 = (await state()).money;
      await enter(b);
      await page.click(`.overlay .panel-foot >> text=${btn}`);
      await wait(700);
      const intro = await text('#mg .mg-card');
      expect(intro.includes('Ты здесь хозяйка') && !intro.includes('Зарплата'), 'заставка работы хозяйки', intro);
      await page.click('#mg >> text=Начать!');
      await wait(500);
      expect((await page.locator('#mg canvas.brs-pic').count()) === 2, 'нет картинок «как надо» и «что получается»', b);
      for (let order = 0; order < 6; order++) {
        await page.waitForFunction(
          ([w, n]) => document.querySelector('#mg .brs-count').textContent.includes(`${w} ${n} `),
          [word, order + 1],
        );
        await wait(250);
        // нажимаем всё подряд: лишнее — просто «ой», заказ всё равно собирается (проиграть нельзя)
        await ev(() => document.querySelectorAll('#mg .brs-b').forEach((q) => q.click()));
      }
      await page.waitForSelector('#mg .mg-card .stars');
      await wait(300);
      const res = await text('#mg .mg-card');
      expect(res.includes('Выручка заведения сегодня') && res.includes('+20%'), 'итог работы хозяйки', res);
      await page.click('#mg >> text=Ура!');
      await wait(450);
      const s = await state();
      expect(s.money === m0 && s.plays[game] === 1 && s.dayFlags.bizWork[b] === 1, 'работа хозяйки', [
        s.plays,
        s.dayFlags,
      ]);
    }
    await closeAll();
  });
  await step('жильё и бизнес: состояние меняют только действия', async () => {
    await newGame();
    await ev(async () => {
      const d = window.__dev;
      const mod = (await import('./js/minigames/chef.js')).default;
      window.__chefStart = mod.start;
      mod.start = (host) => {
        const t = setTimeout(() => host.finish({ stars: 2, text: 'проверка' }), 60);
        return { stop: () => clearTimeout(t) };
      };
      d.actions.mutate((s) => (s.money = 200000));
      d.actions.meetFriend('myata');
      d.go('world');
      window.__stopWatch = d.watchState();
    });
    // в гости, чай, лейка
    await setTime(8);
    await enter('house5');
    await wait(400);
    await ev(() => {
      window.__dev.F.hostDialog('myata', { scene: window.__dev.scene });
    });
    await wait(400);
    await page.click('.dialog .opts .btn:nth-child(2)');
    await wait(600);
    await page.click('.overlay .panel-foot .btn');
    await wait(400);
    await closeAll();
    await touch('watering_can');
    // купить квартиру, перейти, переставить, основной дом
    await run('realtor');
    await page.click('.overlay .home-card .btn');
    await wait(400);
    await lastOv().locator('.panel-foot .btn.green').click();
    await wait(700);
    await page.click('.overlay .panel-foot .btn.green');
    await wait(600);
    await run('realtor:mine');
    await page.click('.overlay >> text=Сделать основным');
    await wait(300);
    await closeAll();
    // купить ресторан, поработать, ночь, забрать выручку
    await ev(() => window.__dev.go('world'));
    await office('rest');
    await page.click('.overlay .biz-buy .btn');
    await wait(400);
    await lastOv().locator('.panel-foot .btn.green').click();
    await wait(700);
    await page.click('.overlay .panel-foot .btn');
    await wait(600);
    await closeAll();
    await enter('rest');
    await page.click('.dialog .btn.green');
    await wait(600);
    await page.click('#mg >> text=Начать!');
    await wait(450);
    await page.click('#mg >> text=Ура!');
    await wait(450);
    await ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.F.newDayMail();
    });
    await run('biz:rest');
    await page.click('.overlay .biz-till .btn');
    await wait(300);
    await closeAll();
    const r = await ev(async () => {
      const bad = window.__stopWatch();
      (await import('./js/minigames/chef.js')).default.start = window.__chefStart;
      const s = window.__dev.G.state;
      return { bad, biz: s.biz.rest, homes: s.homesOwned, main: s.homeMain, tea: s.friends.myata.tea };
    });
    expect(!r.bad.length, `запись в состояние мимо действий (${r.bad.length})`, [...new Set(r.bad)].slice(0, 6));
    expect(r.biz.total === 3500 + 1225 && r.homes.join() === 'flat' && r.main === 'flat' && r.tea >= 0, 'итог', r);
  });

  // ---------- сохранения ----------
  await step('перенос сохранения v2 → v3: новые поля, деньги и вещи на месте, копия', async () => {
    const old = JSON.parse(SAVE_V2);
    await putSave(SAVE_V2);
    await page.click('text=Продолжить');
    await wait(900);
    const s = await state();
    expect(s.v === 5 && s.money === old.money && s.earned === old.earned, 'версия и деньги', [s.v, s.money]);
    expect(
      Array.isArray(s.homesOwned) && !s.homesOwned.length && s.homeMain === 'villa' && s.guestsAt === 'villa',
      'жильё',
      [s.homesOwned, s.homeMain],
    );
    expect(JSON.stringify(s.biz) === '{}' && JSON.stringify(s.visits) === '{}', 'заведения и визиты', [
      s.biz,
      s.visits,
    ]);
    for (const k of ['name', 'storage', 'stickers', 'day', 'ledger'])
      expect(JSON.stringify(s[k]) === JSON.stringify(old[k]), `после переноса изменилось «${k}»`);
    // вещи: всё, что было, и шлёпанцы в подарок (У2)
    expect(JSON.stringify(s.clothes) === JSON.stringify([...old.clothes, 'flip_pink']), 'после переноса изменилось «clothes»');
    // рецепты: всё, что было, на месте; в конец дописаны только новые рецепты «с начала игры» (repair)
    expect(
      JSON.stringify(s.recipes.slice(0, old.recipes.length)) === JSON.stringify(old.recipes) &&
        s.recipes.slice(old.recipes.length).every((r) => ['mushroom_soup', 'blueberry_muffin', 'lettuce_wrap', 'honey_tea'].includes(r)),
      'после переноса изменилось «recipes»',
    );
    expect(s.villa.length === old.villa.length, 'мебель виллы');
    const backup = JSON.parse(await ev(() => localStorage.getItem('rhr-save-backup')));
    expect(backup.v === 2 && backup.money === old.money, 'нет копии сохранения v2', backup.v);
    for (const act of ['realtor', 'realtor:mine', 'my-biz', 'biz:cafe']) {
      await run(act);
      await closeAll();
    }
    // дом и заведение в перенесённой игре работают
    await ev(() => {
      const d = window.__dev;
      d.actions.addHome('flat');
      d.actions.addBiz('salon');
      d.actions.nextDay();
      d.F.goToHome('flat');
    });
    await wait(400);
    expect((await scene()) === 'flat' && (await state()).biz.salon.till === 2200, 'дом и заведение после переноса');
    await ev(() => window.__dev.go('villa'));
  });
  await step('образец: сохранение v3', async () => {
    const want = JSON.parse(SAVE_V3);
    await putSave(SAVE_V3);
    await page.click('text=Продолжить');
    await wait(900);
    const s = await state();
    expect(s.v === 5 && s.name === want.name && s.money === want.money, 'образец v3', [s.v, s.money]);
    for (const k of ['homesOwned', 'homeMain', 'guestsAt', 'biz', 'visits', 'homes'])
      expect(JSON.stringify(s[k]) === JSON.stringify(want[k]), `образец v3: поле «${k}»`, s[k]);
    expect((await scene()) === want.pos.scene, 'образец v3 открылся не там', await scene());
    for (const act of ['realtor:mine', 'my-biz', 'biz:cafe', 'bank']) {
      await run(act);
      await closeAll();
    }
    // образец сделан на старом городе: дверь квартиры помнит место, где теперь стоит вилла, —
    // в новом городе хомячок выходит на свободную клетку, от которой можно дойти до двери виллы
    await leaveByDoor();
    const pos = await ev(() => {
      const d = window.__dev,
        W = d.World,
        m = W.map,
        T = 48,
        tx = Math.floor(W.p.x / T),
        ty = Math.floor(W.p.y / T),
        door = m.doorPx(m.bById.villa),
        dx = Math.floor(door.x / T),
        dy = Math.floor(door.y / T);
      const way = (tx === dx && ty === dy) || !!m.path(m.foot, tx, ty, dx, dy);
      return { scene: d.sceneName, free: W.pass()(tx, ty), way, tx, ty };
    });
    expect(pos.scene === 'world' && pos.free && pos.way, 'образец v3: выход из квартиры в новом городе', pos);
    // а войти обратно — через дверь жилого дома
    await enter('home_apartment');
    expect((await scene()) === 'flat', 'образец v3: в свою квартиру через дверь жилого дома', await scene());
    // неизвестные id в новых полях тихо убираются
    const bad = JSON.parse(SAVE_V3);
    bad.homesOwned.push('castle', 'flat');
    bad.homeMain = 'castle';
    bad.biz.zoo = { day: 1, till: 5, total: 5 };
    bad.biz.cafe.till = 'много';
    bad.visits.nobody = 3;
    await putSave(JSON.stringify(bad));
    await page.click('text=Продолжить');
    await wait(900);
    const q = await state();
    expect(
      !q.homesOwned.includes('castle') &&
        q.homesOwned.filter((h) => h === 'flat').length === 1 &&
        q.homeMain === 'villa',
      'жильё не почищено',
      [q.homesOwned, q.homeMain],
    );
    expect(!q.biz.zoo && q.biz.cafe.till === 0 && !q.visits.nobody, 'заведения не почищены', [q.biz, q.visits]);
    await ev(() => window.__dev.go('villa'));
    await wait(300);
  });
};

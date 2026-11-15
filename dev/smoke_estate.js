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
      await task('guesting');
      await enter('house3');
      await wait(400);
      expect((await scene()) === 'home_busya', '«день гостей»: дверь закрыта');
      await reward('В гости к соседям');
      await task('teatime');
      await enter('house1');
      await wait(400);
      await ev(() => {
        window.__dev.F.hostDialog('ponchik', { scene: window.__dev.scene });
      });
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

  // ---------- B. жильё ----------
  const HOMES = [
    ['flat', 25000, 'Квартира'],
    ['bungalow', 60000, 'бунгало'],
    ['penthouse', 150000, 'Пентхаус'],
  ];
  await step('жильё: риелтор — нехватка монет, покупка каждого дома, мебель, сон, обустройство, дверь', async () => {
    await newGame();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // вход к риелтору — из банка; денег мало: видно «накопить ещё», покупка не проходит
    await enter('bank');
    await page.click('.overlay .panel-foot >> text=Недвижимость');
    await wait(450);
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
    // дверь некупленного жилья (так её вызовет здание в городе) открывает окно риелтора
    await run('home:flat');
    expect(
      (await scene()) === 'world' && (await page.locator('.overlay .home-card').count()) === 5,
      'дверь некупленного жилья',
    );
    await closeAll();
    await setMoney(400000);
    let money = 400000;
    for (const [id, price, name] of HOMES) {
      await ev(() => window.__dev.go('world'));
      const at = await ev(() => window.__dev.World.playerPos());
      await run('realtor');
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
      await page.click('.overlay .panel-foot .btn.green'); // «Перейти домой»
      await wait(700);
      money -= price;
      s = await state();
      expect(s.money === money && s.homesOwned.includes(id) && s.ledger.today.out >= price, 'покупка', [
        s.money,
        s.homesOwned,
      ]);
      expect((await scene()) === id, 'не перешли в новый дом', await scene());
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
      await page.mouse.click(lamp.x, lamp.y);
      await wait(250);
      await page.click('text=Убрать в кладовку');
      await wait(300);
      s = await state();
      expect(
        s.storage[lamp.id] === 1 && s.homes[id].length === ids.length - 1,
        'предмет не убрался в кладовку',
        lamp.id,
      );
      await page.click(`.decor-tray .tray-item`);
      await wait(300);
      s = await state();
      expect(s.homes[id].length === ids.length, 'предмет из кладовки не встал', Object.keys(s.storage));
      await page.click('text=Готово');
      await wait(300);
      // дверь ведёт туда, откуда пришли
      await ev(() => {
        const sc = window.__dev.scene;
        sc.standUp();
        sc.p.path = [];
        sc.p.f = 0;
        sc.p.x = 100;
      });
      await page.keyboard.press('KeyE');
      await wait(450);
      const out = await ev(() => ({ scene: window.__dev.sceneName, ...window.__dev.World.playerPos() }));
      expect(out.scene === 'world' && Math.abs(out.x - at.x) < 2 && Math.abs(out.y - at.y) < 2, 'дверь нового дома', [
        out,
        at,
      ]);
    }
    s = await state();
    for (const st of ['x_home2', 'x_homes_all']) expect(s.stickers.includes(st), 'нет наклейки ' + st);
    expect(s.villa.length > 20 && Object.keys(s.homes).length === 3, 'мебель домов', Object.keys(s.homes));
  });
  await step('жильё: «Мои дома», основной дом, «Домой», пентхаус из лифта башни, гости, перезагрузка', async () => {
    // «Мои дома» — из меню
    await ev(() => {
      window.__dev.F.openSettings();
    });
    await wait(350);
    await page.click('.overlay >> text=Мои дома');
    await wait(450);
    expect((await page.locator('.overlay .home-card').count()) === 4, 'мои дома');
    expect((await text('.overlay .home-card .tag')).includes('основной'), 'основной дом по умолчанию — вилла');
    await page.click('.overlay .home-card:has(.ttl:has-text("Квартира")) >> text=Сделать основным');
    await wait(300);
    expect((await state()).homeMain === 'flat', 'основной дом не выбран');
    await closeAll();
    // «Домой» из города ведёт в основной дом; есть и «В другой дом»
    await page.click('.hud-btns.left .rbtn:last-child');
    await wait(400);
    expect((await text('.overlay .panel-body')).includes('Квартира'), 'вопрос «Домой?»');
    expect(await page.locator('.overlay .panel-foot >> text=В другой дом').count(), 'нет кнопки «В другой дом»');
    await page.click('.overlay .panel-foot .btn.green');
    await wait(500);
    expect((await scene()) === 'flat', '«Домой» ведёт не в основной дом', await scene());
    // из одного своего дома в другой — через «Мои дома»; дверь второго ведёт на улицу, а не в первый
    await run('realtor:mine');
    expect((await text('.overlay .home-card:has(.ttl:has-text("Квартира")) .btn')).includes('Ты здесь'), '«Ты здесь»');
    await page.click('.overlay .home-card:has(.ttl:has-text("бунгало")) >> text=Перейти домой');
    await wait(500);
    expect((await scene()) === 'bungalow', 'переход в бунгало');
    await ev(() => {
      window.__dev.scene.p.x = 100;
    });
    await page.keyboard.press('KeyE');
    await wait(450);
    expect((await scene()) === 'world', 'дверь бунгало ведёт не на улицу', await scene());
    // пентхаус: лифт Хомяк-Тауэра спрашивает этаж
    await enter('tower');
    await ev(() => window.__dev.Tower.debugAt(940));
    await page.keyboard.press('KeyE');
    await wait(450);
    expect((await text('.dialog .say')).includes('пентхаус'), 'лифт не спросил этаж');
    await page.click('.dialog .btn.green');
    await wait(500);
    expect((await scene()) === 'penthouse', 'пентхаус');
    // гости приходят в тот дом, где героиня; телефон предлагает выбрать
    await ev(() => {
      const d = window.__dev;
      d.actions.meetFriend('bob');
      d.F.openPhone();
    });
    await wait(350);
    expect((await page.locator('.overlay .opt').count()) === 4, 'телефон: выбор дома');
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
    await ev(() => window.__dev.go('world'));
    const at = await ev(() => window.__dev.World.playerPos());
    await ev(() => {
      window.__dev.F.goToHome('bungalow');
    });
    await wait(400);
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
    await page.click('.overlay .tab:nth-child(3)');
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
    expect(s.v === 3 && s.money === old.money && s.earned === old.earned, 'версия и деньги', [s.v, s.money]);
    expect(
      Array.isArray(s.homesOwned) && !s.homesOwned.length && s.homeMain === 'villa' && s.guestsAt === 'villa',
      'жильё',
      [s.homesOwned, s.homeMain],
    );
    expect(JSON.stringify(s.biz) === '{}' && JSON.stringify(s.visits) === '{}', 'заведения и визиты', [
      s.biz,
      s.visits,
    ]);
    for (const k of ['name', 'clothes', 'storage', 'recipes', 'stickers', 'day', 'ledger'])
      expect(JSON.stringify(s[k]) === JSON.stringify(old[k]), `после переноса изменилось «${k}»`);
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
    expect(s.v === 3 && s.name === want.name && s.money === want.money, 'образец v3', [s.v, s.money]);
    for (const k of ['homesOwned', 'homeMain', 'guestsAt', 'biz', 'visits', 'homes'])
      expect(JSON.stringify(s[k]) === JSON.stringify(want[k]), `образец v3: поле «${k}»`, s[k]);
    expect((await scene()) === want.pos.scene, 'образец v3 открылся не там', await scene());
    for (const act of ['realtor:mine', 'my-biz', 'biz:cafe', 'bank']) {
      await run(act);
      await closeAll();
    }
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

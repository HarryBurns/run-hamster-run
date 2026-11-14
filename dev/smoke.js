// Автотест-«дымовуха»: проходит по основным местам игры и проверяет, что нет ошибок в консоли,
// что главный цикл жив после каждого шага и что сохранения-образцы (dev/saves) загружаются.
// Запуск:  python3 -m http.server 8765 &   затем   node dev/smoke.js [http://localhost:8765]
// Нужен Playwright с Chromium. Код возврата 0 — всё хорошо, 1 — есть ошибки.
// Третий аргумент «extra» — только экономика и проверки сохранений, цикла и окон (быстро):  node dev/smoke.js <url> extra
// Скорость проверяется отдельно:  node dev/bench.js [url] --spots=forest --sizes=desktop --max-forest=45
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SAVE_V1 = fs.readFileSync(path.join(__dirname, 'saves', 'v1.json'), 'utf8'); // сделано кодом до миграций (коммит dc1d500)
const SAVE_V2 = fs.readFileSync(path.join(__dirname, 'saves', 'v2.json'), 'utf8'); // сделано кодом с новой экономикой (этап 3)

const BASE = process.argv[2] || 'http://localhost:8765';
const ONLY_EXTRA = process.argv[3] === 'extra';
const SIZES = ONLY_EXTRA
  ? [[1280, 720, 'desktop']]
  : [
      [1280, 720, 'desktop'],
      [390, 844, 'phone'],
    ];

// ---------- сохранения-образцы, живучесть цикла, очередь окон (один раз, на настольном размере) ----------
async function extra({ page, step, ev, wait, closeAll, hold }) {
  // подложить сохранение и перезагрузить страницу (state = null — чтобы уходящая страница его не перезаписала)
  const putSave = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-save-backup');
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await wait(500);
  };
  const cont = async () => {
    await page.click('text=Продолжить');
    await wait(600);
    // образец v1 переносится в новую экономику, и банк один раз присылает письмо: дождаться и закрыть,
    // чтобы оно не всплыло посреди следующей проверки
    if (await ev(() => window.__dev.G.state.flags.bankLetter === 1)) {
      await page.waitForSelector('text=Письмо из Хомяк-Банка');
      await wait(400);
      await page.click('.overlay .panel-foot .btn');
      await wait(350);
    }
  };
  const stored = () =>
    ev(() => ({ save: localStorage.getItem('rhr-save-v1'), backup: localStorage.getItem('rhr-save-backup') }));
  const edit = (fn) => {
    const s = JSON.parse(SAVE_V1);
    fn(s);
    return JSON.stringify(s);
  };

  await step('образец: сохранение v1', async () => {
    await putSave(SAVE_V1);
    await cont();
    const r = await ev(async () => {
      const g = await import('./js/core/state.js'),
        s = window.__dev.G.state;
      return {
        name: s.name,
        clothes: s.clothes.length,
        scene: window.__dev.sceneName,
        v: s.v,
        ver: g.saveVersion(),
        wheel: s.villa.find((i) => i.id === 'wheel').on,
      };
    });
    if (r.name !== 'Пуговка' || r.clothes < 13 || r.scene !== 'world' || r.v !== r.ver)
      throw new Error('образец загрузился не так: ' + JSON.stringify(r));
    if (r.wheel !== undefined) throw new Error('колесо осталось «включённым» после загрузки');
    for (const f of ['openWardrobe', 'openBackpack', 'openAlbum', 'openPhone', 'showLetter']) {
      await ev((f) => {
        window.__dev.F[f]();
      }, f);
      await wait(300);
      await closeAll();
    }
    await ev(() => {
      window.__dev.go('villa');
    });
    await wait(400);
  });
  await step('образец: неизвестные id', async () => {
    await putSave(
      edit((s) => {
        s.mail = { task: 'нет_такого', read: true, done: false, n: 0, got: {}, items: null };
        s.lastTasks.push('нет_такого');
        s.garden[1] = { seed: 'seed_gone', age: 1 };
        s.guests = ['nobody', 'plusha'];
        s.visitor = 'ghost';
        s.villa.push({ uid: 999, id: 'gone_furn', floor: 0, x: 500, y: 0 });
        s.storage.gone = 2;
        s.ing.gone = 1;
        s.dishes.gone = 1;
        s.seeds.gone = 1;
        s.clothes.push('gone_dress');
        s.look.outfit.body = 'gone_dress';
        s.recipes.push('gone_dish');
      }),
    );
    await cont();
    const r = await ev(() => {
      const s = window.__dev.G.state;
      return {
        task: s.mail && s.mail.task,
        seed: s.garden[1].seed,
        guests: s.guests.join(),
        furn: s.villa.some((i) => i.id === 'gone_furn'),
        body: s.look.outfit.body,
        bags: [s.storage.gone, s.ing.gone, s.dishes.gone, s.seeds.gone].join(),
      };
    });
    if (r.task === 'нет_такого' || !r.task || r.seed || r.guests !== 'plusha' || r.furn || r.body || r.bags !== ',,,')
      throw new Error('сохранение не почищено: ' + JSON.stringify(r));
    await hold('ArrowLeft', 300);
    for (const f of [
      'openWardrobe',
      'openBackpack',
      'openCooking',
      'openFridge',
      'openAlbum',
      'openPhone',
      'openMailbox',
    ]) {
      await ev((f) => {
        window.__dev.F[f]();
      }, f);
      await wait(300);
      await closeAll();
    }
    await ev(() => {
      window.__dev.go('villa');
    });
    await wait(400);
    await hold('ArrowRight', 300);
  });
  await step('образец: вкладка умерла сразу после выхода из виллы', async () => {
    // так выглядела позиция до исправления B2: сцена «город», а координаты — от виллы
    await putSave(
      edit((s) => {
        s.pos = { scene: 'world', floor: 1, x: 300 };
      }),
    );
    await cont();
    await ev(() => {
      if (window.__dev.sceneName !== 'world') window.__dev.go('world');
    });
    await wait(300);
    const a = await ev(() => window.__dev.World.playerPos());
    await hold('ArrowDown', 400);
    const b = await ev(() => window.__dev.World.playerPos());
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !(b.y > a.y))
      throw new Error('хомячок не двигается: ' + JSON.stringify([a, b]));
    // а теперь по-настоящему: выйти из виллы и сразу посмотреть, что лежит в хранилище
    await ev(() => {
      window.__dev.go('villa');
      window.__dev.go('world');
    });
    const pos = JSON.parse((await stored()).save).pos;
    if (pos.scene !== 'world' || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || 'floor' in pos)
      throw new Error('позиция после выхода из виллы: ' + JSON.stringify(pos));
  });
  await step('образец: позиция в доме, которого нет, и мебель в других домах', async () => {
    await putSave(
      edit((s) => {
        s.pos = { scene: 'нет_такого_дома', floor: 0, x: 300 };
        s.homes = {
          flat: [
            { uid: 500, id: 'bed_green', floor: 0, x: 300, y: 0 },
            { uid: 501, id: 'gone_furn', floor: 0, x: 400, y: 0 },
          ],
        };
      }),
    );
    await cont();
    const r = await ev(() => {
      const d = window.__dev;
      return { scene: d.sceneName, flat: d.G.state.homes.flat.map((i) => i.id).join(), uid: d.G.state.uid };
    });
    if (r.scene !== 'villa') throw new Error('игра открылась не дома: ' + r.scene);
    if (r.flat !== 'bed_green' || !(r.uid > 500))
      throw new Error('мебель других домов не почищена: ' + JSON.stringify(r));
    await hold('ArrowRight', 300);
  });
  await step('образец: нечитаемое сохранение', async () => {
    const raw = SAVE_V1.slice(0, 300);
    await putSave(raw);
    const st = await stored();
    if (st.backup !== raw) throw new Error('нет резервной копии');
    if (await page.locator('text=Продолжить').count()) throw new Error('битое сохранение предложено продолжить');
    await page.click('text=Играть!');
    await wait(400);
    await page.click('text=Поехали!');
    await wait(400);
    if ((await stored()).backup !== raw) throw new Error('резервная копия пропала после новой игры');
  });
  await step('образец: сохранение от более новой версии игры', async () => {
    const raw = edit((s) => {
      s.v = 99;
    });
    await putSave(raw);
    if (!(await page.locator('text=Обновить').count())) throw new Error('нет предложения обновить страницу');
    await page.reload();
    await wait(500);
    if ((await stored()).save !== raw) throw new Error('сохранение новой версии перезаписано');
  });
  await step('миграция сохранения и копия перед ней', async () => {
    await putSave(SAVE_V1);
    const r = await ev(async () => {
      const g = await import('./js/core/state.js');
      g.MIGRATIONS[g.saveVersion()] = (s) => {
        s.money = Math.min(s.money, 20000);
      }; // пробная миграция «миллиард → 20 000»
      const ok = g.load(),
        s = g.G.state || {};
      const out = {
        ok,
        v: s.v,
        ver: g.saveVersion(),
        money: s.money,
        backup: JSON.parse(localStorage.getItem('rhr-save-backup') || '{}').money,
      };
      delete g.MIGRATIONS[g.saveVersion() - 1];
      g.G.state = null;
      return out;
    });
    if (!r.ok || r.v !== r.ver || r.money !== 20000 || !(r.backup > 20000))
      throw new Error('миграция не сработала: ' + JSON.stringify(r));
    await page.reload();
    await wait(500);
    await cont();
  });
  await step(
    'ошибка в кадре не останавливает игру',
    async () => {
      await ev(() => {
        window.__dev.go('world');
      });
      await wait(300);
      await ev(() => {
        const sc = window.__dev.scenes.world;
        sc._draw = sc.draw;
        sc.draw = () => {
          throw new Error('проверка: сломанный кадр');
        };
      });
      await wait(1200);
      await ev(() => {
        const sc = window.__dev.scenes.world;
        sc.draw = sc._draw;
        delete sc._draw;
      });
      if (!(await page.locator('text=Что-то сломалось').count())) throw new Error('нет окна «Что-то сломалось»');
      await page.click('text=Домой 🏡');
      await wait(500);
      if ((await ev(() => window.__dev.sceneName)) !== 'villa') throw new Error('кнопка «Домой» не привела на виллу');
    },
    { expectErrors: 'сломанный кадр' },
  );
  await step('подарок ждёт, пока закроют диалог', async () => {
    await ev(() => {
      const s = window.__dev.G.state;
      s.friends.plusha.pts = 19;
      s.friends.plusha.met = true;
      s.friends.plusha.gift = -1;
      s.dishes.cookies = 3;
      window.__dev.F.npcDialog('plusha');
    });
    await wait(500);
    await page.click('text=Угостить');
    await wait(500);
    await page.click('.overlay .card .btn');
    await wait(2000);
    let d = await ev(() => ({
      dialog: document.querySelectorAll('.dialog').length,
      overlay: document.querySelectorAll('.overlay').length,
    }));
    if (d.dialog !== 1 || d.overlay !== 0)
      throw new Error('окно открылось поверх или под диалогом: ' + JSON.stringify(d));
    await page.mouse.click(30, 30);
    await wait(300); // нажатие мимо диалога с выбором его не закрывает
    if (!(await page.locator('.dialog').count())) throw new Error('диалог закрылся от нажатия мимо');
    await page.click('.dialog .btn:last-child');
    await wait(900);
    d = await ev(() => ({
      dialog: document.querySelectorAll('.dialog').length,
      overlay: document.querySelectorAll('.overlay').length,
    }));
    if (d.dialog !== 0 || d.overlay !== 1) throw new Error('подарок не показан после диалога: ' + JSON.stringify(d));
    await closeAll();
  });
  await step('кэш спрайтов: все сезоны, ночь, смена размера окна', async () => {
    await ev(() => {
      window.__dev.go('world');
    });
    await wait(300);
    for (const day of [0, 6, 18, 24])
      for (const minutes of [12 * 60, 21.5 * 60]) {
        for (const [tx, ty] of [
          [30, 4],
          [15, 28],
          [43, 15],
          [60, 13],
          [14, 10],
          [40, 40],
          [51, 45],
          [47, 56],
          [33, 68],
          [36, 89],
          [12, 92],
          [61, 87],
        ]) {
          await ev(
            ([day, minutes, tx, ty]) => {
              const s = window.__dev.G.state;
              s.day = day;
              s.minutes = minutes;
              s.weather = 'sun';
              window.__dev.World.debugTeleport(tx, ty);
            },
            [day, minutes, tx, ty],
          );
          await wait(70);
        }
      }
    const a = await ev(() => window.__dev.World.debugSprites());
    if (a.count < 50) throw new Error('в кэше подозрительно мало спрайтов: ' + a.count);
    if (a.clipped.length) throw new Error('спрайты не поместились в рамку: ' + a.clipped.join(', '));
    await page.setViewportSize({ width: 600, height: 900 });
    await wait(400);
    await hold('ArrowLeft', 300);
    const b = await ev(() => window.__dev.World.debugSprites());
    if (b.k === a.k || b.count >= a.count)
      throw new Error('кэш не сброшен при смене масштаба: ' + JSON.stringify([a.k, a.count, b.k, b.count]));
    if (b.clipped.length > a.clipped.length) throw new Error('спрайты не поместились в рамку: ' + b.clipped.join(', '));
    await page.setViewportSize({ width: 1280, height: 720 });
    await wait(300);
  });
  await step('очередь окон: по одному и только когда экран свободен', async () => {
    const st = () =>
      ev(() => ({
        dialogs: document.querySelectorAll('.dialog').length,
        titles: [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent),
        queued: window.__dev.ui.queued(),
      }));
    await ev(() => {
      window.__dev.F.npcDialog('plusha');
    });
    await wait(450);
    await ev(() => {
      const u = window.__dev.ui;
      u.enqueue(() => u.message({ title: 'Первое', html: '<p>1</p>' }));
      u.enqueue(() => u.message({ title: 'Второе', html: '<p>2</p>' }), { delay: 200 });
    });
    await wait(900);
    let r = await st();
    if (r.dialogs !== 1 || r.titles.length || r.queued !== 2)
      throw new Error('окно не дождалось диалога: ' + JSON.stringify(r));
    await page.click('.dialog .btn:last-child');
    await wait(120);
    r = await st();
    if (r.titles.length) throw new Error('окно открылось сразу, без паузы после диалога: ' + JSON.stringify(r));
    await wait(500);
    r = await st();
    if (r.titles.join() !== 'Первое' || r.queued !== 1)
      throw new Error('ожидалось одно окно «Первое»: ' + JSON.stringify(r));
    await wait(700);
    r = await st();
    if (r.titles.join() !== 'Первое')
      throw new Error('второе окно не дождалось закрытия первого: ' + JSON.stringify(r));
    await page.click('.overlay .xbtn');
    await wait(600);
    r = await st();
    if (r.titles.join() !== 'Второе' || r.queued !== 0)
      throw new Error('ожидалось окно «Второе»: ' + JSON.stringify(r));
    await closeAll();
    // на свободном экране окно из очереди тоже появляется не мгновенно, а после короткой паузы
    await ev(() => {
      const u = window.__dev.ui;
      u.enqueue(() => u.message({ title: 'Третье', html: '<p>3</p>' }));
    });
    r = await st();
    if (r.titles.length) throw new Error('окно из очереди открылось без паузы');
    await wait(500);
    r = await st();
    if (r.titles.join() !== 'Третье') throw new Error('окно из очереди не открылось: ' + JSON.stringify(r));
    await closeAll();
    const m = await ev(() => window.__dev.G.modal);
    if (m !== 0) throw new Error('счётчик открытых окон не сошёлся: ' + m);
  });
  // ---------- каркас: сцены, события, действия ----------
  await step('переход между сценами — между кадрами', async () => {
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // go() изнутри update(): сцена меняется только после того, как старая сцена закончила свой шаг
    await ev(() => {
      const d = window.__dev,
        sc = d.scenes.world,
        u = sc.update,
        log = (window.__log = {});
      sc.update = function (dt) {
        sc.update = u;
        d.go('villa');
        log.during = d.sceneName;
        u.call(this, dt);
        log.after = d.sceneName;
      };
    });
    await wait(300);
    const r = await ev(() => ({ ...window.__log, now: window.__dev.sceneName }));
    if (r.during !== 'world' || r.after !== 'world' || r.now !== 'villa')
      throw new Error('переход выполнен посреди шага: ' + JSON.stringify(r));
    // вне кадра (кнопка в окне, тест) — сразу, вместе с позицией в сохранении
    const s = await ev(() => {
      window.__dev.go('world');
      return { name: window.__dev.sceneName, pos: JSON.parse(localStorage.getItem('rhr-save-v1')).pos };
    });
    if (s.name !== 'world' || s.pos.scene !== 'world')
      throw new Error('переход вне кадра не выполнен сразу: ' + JSON.stringify(s));
  });
  await step('сцена: общий интерфейс и подписки', async () => {
    const r = await ev(() => {
      const d = window.__dev,
        need = ['enter', 'update', 'draw', 'pointerDown', 'pointerMove', 'pointerUp', 'interact', 'savePos'],
        out = { missing: [] };
      for (const [name, sc] of Object.entries(d.scenes))
        for (const m of need) if (typeof sc[m] !== 'function') out.missing.push(name + '.' + m);
      d.go('villa');
      out.inVilla = d.events.listenerCount('guests');
      d.go('world');
      out.inWorld = d.events.listenerCount('guests');
      return out;
    });
    if (r.missing.length) throw new Error('у сцен нет методов: ' + r.missing.join(', '));
    if (r.inVilla < 1 || r.inWorld !== 0)
      throw new Error('сцена не сняла подписки при выходе: ' + JSON.stringify([r.inVilla, r.inWorld]));
    // неизвестное событие — ошибка сразу, а не тихо не работающая подписка
    const bad = await ev(() => {
      try {
        window.__dev.events.on('нет_такого', () => {});
        return false;
      } catch (e) {
        return true;
      }
    });
    if (!bad) throw new Error('подписка на неизвестное событие не дала ошибку');
  });
  await step('состояние меняют только действия (core/actions.js)', async () => {
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      window.__stopWatch = d.watchState();
    });
    const click = async (sel) => {
      await page.click(sel);
      await wait(350);
    };
    // покупки, салон, готовка, еда
    await ev(() => {
      window.__dev.enterBuilding('mall_food');
    });
    await wait(400);
    await click('.overlay .card .btn');
    await closeAll();
    await ev(() => {
      window.__dev.enterBuilding('mall_fashion');
    });
    await wait(400);
    await click('.overlay .card .btn');
    await click('.overlay .card');
    await closeAll();
    await ev(() => {
      window.__dev.enterBuilding('mall_home');
    });
    await wait(400);
    await click('.overlay .card .btn');
    await closeAll();
    await ev(() => {
      window.__dev.enterBuilding('salon');
    });
    await wait(400);
    await click('.overlay .opt:not(.sel)');
    await closeAll();
    await ev(() => {
      window.__dev.F.openCooking();
    });
    await wait(400);
    await click('.overlay .btn.green');
    await wait(400);
    await click('text=Снять с плиты');
    await closeAll();
    await ev(() => {
      window.__dev.F.openFridge();
    });
    await wait(400);
    await click('.overlay .card .btn');
    await closeAll();
    // друзья, почта, сад
    await ev(() => {
      window.__dev.F.npcDialog('ponchik');
    });
    await wait(500);
    await click('text=Поболтать');
    await wait(300);
    await click('text=Угостить');
    await click('.overlay .card .btn');
    await wait(400);
    await click('text=Позвать в гости');
    await wait(400);
    await closeAll();
    await ev(() => {
      window.__dev.F.openMailbox();
    });
    await wait(400);
    await closeAll();
    await ev(() => {
      window.__dev.F.gardenBed(2);
    });
    await wait(400);
    await click('.overlay .card');
    await closeAll();
    // город: ходьба, кораблик, ныряние
    await hold('ArrowDown', 400);
    await ev(() => window.__dev.World.debugTeleport(51, 45));
    await wait(300);
    const bs = await ev(() => window.__dev.World.debugScreen(52.5 * 48, 46.2 * 48));
    await page.mouse.click(bs.x, bs.y);
    await wait(2200);
    await closeAll();
    await hold('ArrowDown', 1200);
    await ev(() => {
      window.__dev.World.dive();
    });
    await wait(600);
    await hold('ArrowDown', 500);
    await ev(() => {
      window.__dev.back();
    });
    await wait(500);
    await ev(() => {
      window.__dev.World.leaveBoat();
    });
    await wait(300);
    // башня
    await ev(() => {
      window.__dev.enterBuilding('tower');
    });
    await wait(400);
    await ev(() => {
      window.__dev.back();
    });
    await wait(300);
    // вилла: предметы, обустройство
    await ev(() => {
      window.__dev.villaAt(0, 800);
    });
    await wait(400);
    await page.keyboard.press('KeyE'); // телевизор
    await wait(300);
    await ev(() => {
      window.__dev.Villa.setDecor(true);
    });
    await wait(300);
    if (await page.locator('.decor-tray .tray-item').count()) await click('.decor-tray .tray-item');
    if (await page.locator('text=Убрать в кладовку').count()) await click('text=Убрать в кладовку');
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.mouse.move(700, 310, { steps: 3 });
    await page.mouse.up();
    await ev(() => {
      window.__dev.Villa.setDecor(false);
    });
    // сон
    await ev(() => {
      window.__dev.F.askSleep();
    });
    await wait(400);
    await click('.panel-foot .btn.green');
    await wait(3600);
    await closeAll();
    const bad = await ev(() => window.__stopWatch());
    if (bad.length)
      throw new Error(
        `запись в состояние мимо действий (${bad.length}): ` + [...new Set(bad)].slice(0, 6).join(' ;; '),
      );
  });
}

// ---------- экономика: деньги, цены, зарплата, рынок, банк, перенос сохранений (на обоих размерах) ----------
async function economy({ page, step, ev, wait, closeAll }) {
  const state = () =>
    ev(() => {
      const s = window.__dev.G.state;
      return JSON.parse(JSON.stringify(s));
    });
  const titles = () =>
    ev(() => [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent).join());
  const putSave = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-save-backup');
      localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await wait(500);
  };
  // числа в игре пишутся с узким неразрывным пробелом («3 000»): для сравнения заменяем его обычным
  const norm = (t) => t.replace(/[\u202f\u00a0]/g, ' ');
  const text = async (sel) => norm(await page.locator(sel).first().innerText());
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };

  await step('баланс: node dev/balance.js', async () => {
    try {
      require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'balance.js')], { stdio: 'pipe' });
    } catch (e) {
      throw new Error(
        'баланс нарушен: ' +
          String(e.stdout || e.message)
            .split('БАЛАНС НАРУШЕН:')
            .pop()
            .trim(),
      );
    }
  });
  await step('экономика: новая игра — 3 000 монет, в приветствии нет миллиарда', async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await wait(400);
    const hello = await text('.overlay .panel-body');
    expect(!/миллиард/i.test(hello) && hello.includes('3 000') && /заработ/i.test(hello), 'приветствие', hello);
    await page.click('text=Поехали!');
    await wait(500);
    const s = await state();
    const chip = norm(await ev(() => document.querySelector('.chip.money').textContent));
    expect(s.money === 3000 && s.earned === 0 && s.spent === 0 && s.v === 2, 'новая игра', [s.money, s.earned, s.v]);
    expect(s.ledger && s.ledger.today.out === 0 && s.ledger.yesterday, 'нет учёта денег', s.ledger);
    expect(chip.includes('3 000'), 'плашка монет', chip);
    // все цены по карману или хотя бы разумны: ничего дешевле 10 и ничего «за миллион»
    const prices = await ev(async () => {
      const d = await import('./js/data/index.js');
      const all = [
        ...d.CLOTHES.filter((c) => !['start', 'gift'].includes(c.shop)),
        ...d.FURNITURE.filter((f) => f.shop !== 'gift'),
        ...d.INGREDIENTS.filter((i) => i.src === 'shop'),
        ...d.SEEDS,
        ...d.DISHES.filter((q) => q.cafe),
        ...Object.values(d.BEAUTY),
      ].map((q) => q.price);
      return { min: Math.min(...all), max: Math.max(...all), bad: all.filter((p) => !(p > 0)).length };
    });
    expect(prices.bad === 0 && prices.min >= 10 && prices.max <= 100000, 'цены', prices);
  });
  await step('экономика: покупка, нехватка монет', async () => {
    await ev(() => window.__dev.go('world'));
    await wait(400);
    await ev(() => window.__dev.enterBuilding('mall_fashion'));
    await wait(450);
    const s0 = await state();
    await page.click('.overlay .card .btn.green');
    await wait(300);
    const s1 = await state();
    const cost = s0.money - s1.money;
    expect(cost >= 100 && cost <= 2000, 'цена обновки', cost);
    expect(s1.spent === cost && s1.ledger.today.out === cost, 'трата не учтена', [s1.spent, s1.ledger.today]);
    expect(s1.clothes.length === s0.clothes.length + 1, 'вещь не куплена');
    const fly = await page.locator('.money-fly.minus').count();
    expect(fly > 0, 'нет отклика на покупку рядом с числом монет');
    await closeAll();
    // бутик: дорогое видно, но не по карману — монеты не уходят, подсказка говорит, сколько не хватает
    await ev(() => window.__dev.enterBuilding('boutique'));
    await wait(450);
    expect((await page.locator('.overlay .card .pr.far .lack').count()) > 0, 'недоступные по цене вещи не отмечены');
    await page.click('.overlay .card .btn.ghost');
    await wait(300);
    const toast = norm(await ev(() => document.querySelector('#toasts').textContent));
    const s2 = await state();
    expect(/не хватает [\d ]+ монет/.test(toast) && !toast.includes('как так'), 'подсказка о нехватке', toast);
    expect(s2.money === s1.money && s2.clothes.length === s1.clothes.length, 'покупка без монет прошла');
    await closeAll();
  });
  await step('экономика: диалог перед работой, зарплата по звёздам, две оплачиваемые смены, новый день', async () => {
    // мини-игра «Учительница» заканчивается сама на две звезды (подменяем только её ход, рамка и расчёт настоящие)
    await ev(async () => {
      const mod = (await import('./js/minigames/teacher.js')).default;
      window.__teacherStart = mod.start;
      mod.start = (host) => {
        const t = setTimeout(() => host.finish({ stars: 2, text: 'проверка' }), 60);
        return { stop: () => clearTimeout(t) };
      };
    });
    const pay = await ev(async () => (await import('./js/data/index.js')).JOBS.teacher.pay[1]);
    const payText = '+' + String(pay).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // пройти игру от заставки до экрана результата; вернуть текст заставки и результата
    const play = async (close) => {
      const intro = await text('#mg .mg-card');
      await page.click('#mg >> text=Начать!');
      await wait(450);
      const result = await text('#mg .mg-card');
      await page.click(close === 'x' ? '#mg .xbtn' : '#mg >> text=Ура!');
      await wait(450);
      return { intro, result };
    };
    const viaDoor = async () => {
      await ev(() => window.__dev.enterBuilding('school'));
      await wait(450);
      const say = await text('.dialog .say');
      await page.click('.dialog .btn.green');
      await wait(600);
      return say;
    };
    const m0 = (await state()).money;
    // 1-я смена: через дверь школы
    let say = await viaDoor();
    expect(
      say.includes('Зарплата') && say.includes('ещё за 2 смены') && say.includes(String(pay)),
      'диалог перед работой',
      say,
    );
    let r = await play();
    expect(r.intro.includes('Зарплата') && r.result.includes(payText), 'заставка и результат 1-й смены', r);
    let s = await state();
    expect(s.money === m0 + pay && s.dayFlags.shifts.teacher === 1, '1-я смена не оплачена', [s.money, s.dayFlags]);
    // 2-я смена: окно результата закрыто крестиком — зарплата всё равно выдана
    await ev(() => {
      window.__dev.F.playMinigame('teacher');
    });
    await wait(600);
    r = await play('x');
    s = await state();
    expect(r.result.includes(payText) && r.result.includes('последняя оплачиваемая'), 'результат 2-й смены', r.result);
    expect(s.money === m0 + 2 * pay && s.dayFlags.shifts.teacher === 2, '2-я смена не оплачена', s.money - m0);
    // 3-я смена: «для удовольствия» — об этом сказано и до игры, и после
    say = await viaDoor();
    expect(say.includes('для удовольствия') && !say.includes('ещё за'), 'диалог после двух смен', say);
    r = await play();
    s = await state();
    expect(r.intro.includes('для удовольствия') && r.result.includes('для удовольствия'), 'третья смена', r);
    expect(s.money === m0 + 2 * pay && s.plays.teacher === 3, '3-я смена оплачена или не записана', s.money - m0);
    expect(s.ledger.today.in.work === 2 * pay && s.earned >= 2 * pay, 'доход не учтён', s.ledger.today);
    expect(s.stickers.includes('x_wage'), 'нет наклейки «Первая зарплата»');
    // на другом месте смены свои
    expect(
      await ev(() => window.__dev.F.jobToday('doctor').left === 2 && window.__dev.F.jobToday('fishing') === null),
      'смены',
    );
    // новый день: смены снова оплачиваются, вчерашний доход — во «вчера»
    await closeAll();
    await ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.F.newDayMail();
    });
    s = await state();
    expect(
      !s.dayFlags.shifts && s.ledger.yesterday.in.work === 2 * pay && !s.ledger.today.in.work,
      'новый день',
      s.ledger,
    );
    await ev(() => {
      window.__dev.F.playMinigame('teacher');
    });
    await wait(600);
    r = await play();
    s = await state();
    expect(s.money === m0 + 3 * pay && s.dayFlags.shifts.teacher === 1, 'после сна смена не оплачена', s.money - m0);
    await ev(async () => {
      (await import('./js/minigames/teacher.js')).default.start = window.__teacherStart;
    });
    await closeAll();
  });
  await step('экономика: награда за задание', async () => {
    await ev(() => {
      const a = window.__dev.actions;
      a.setMail('cafe');
      a.readMail();
      window.__dev.F.showLetter();
    });
    await wait(400);
    const letter = await text('.overlay .panel-body');
    expect(/Награда:.*300/.test(letter), 'в письме нет награды монетами', letter);
    await closeAll();
    const s0 = await state();
    await ev(() => window.__dev.emit('buy', { cat: 'dish', id: 'donut' }));
    const s1 = await state();
    expect(
      s1.money === s0.money + 300 && s1.ledger.today.in.task === 300 && s1.mail.done,
      'награда',
      s1.money - s0.money,
    );
    await page.waitForSelector('text=Задание выполнено!');
    const done = await text('.overlay .panel-body');
    expect(done.includes('+300'), 'в окне «Задание выполнено» нет монет', done);
    await page.click('.overlay .panel-foot .btn');
    await wait(500);
    await closeAll();
    // у каждого задания есть награда в пределах 300–600
    const bad = await ev(async () => {
      const d = await import('./js/data/index.js');
      return d.TASKS.map((t) => [t.id, window.__dev.F.taskCoins(t.id)]).filter(([, c]) => !(c >= 300 && c <= 600));
    });
    expect(!bad.length, 'награды вне 300–600', bad);
  });
  await step('экономика: рынок — продать одну и все, кошелёк торговца, редкости, входы', async () => {
    await ev(() => {
      const a = window.__dev.actions,
        s = window.__dev.G.state;
      for (const id of Object.keys(s.ing)) a.addItem('ing', id, -s.ing[id]);
      for (const id of Object.keys(s.dishes)) a.addItem('dishes', id, -s.dishes[id]);
      a.addItem('ing', 'carrot', 5);
      window.__dev.run('market');
    });
    await wait(450);
    expect((await titles()) === 'Рынок', 'рынок не открылся', await titles());
    const s0 = await state();
    const card = await text('.overlay .card');
    expect(card.includes('Морковка') && card.includes('40') && card.includes('+200'), 'карточка товара', card);
    await page.click('.overlay .card .btn.green'); // продать 1
    await wait(250);
    let s = await state();
    expect(s.money === s0.money + 40 && s.ing.carrot === 4, 'продать 1', [s.money - s0.money, s.ing]);
    await page.click('.overlay .card .btn.yellow'); // продать все
    await wait(250);
    s = await state();
    expect(s.money === s0.money + 200 && !s.ing.carrot, 'продать все', [s.money - s0.money, s.ing]);
    expect(s.dayFlags.marketPaid === 200 && s.ledger.today.in.market === 200, 'учёт рынка', [
      s.dayFlags,
      s.ledger.today,
    ]);
    expect(s.stickers.includes('x_market'), 'нет наклейки за первую продажу');
    expect((await page.locator('.money-fly.plus').count()) > 0, 'нет отклика на продажу рядом с числом монет');
    await closeAll();
    // кошелёк торговца: больше, чем у него есть, за день не продать — это и закрывает «вечный двигатель»
    const r = await ev(async () => {
      const d = window.__dev,
        { MARKET, ING_BY_ID } = await import('./js/data/index.js');
      d.actions.addItem('ing', 'fish', 40);
      d.actions.addPearls(3);
      const fish = () => d.F.sellable().find((g) => g.id === 'fish');
      const m0 = d.G.state.money,
        left0 = d.F.purseLeft();
      const sold = d.F.sellGoods(fish(), 40);
      const again = d.F.sellGoods(fish(), 1);
      const pearl = d.F.sellGoods(
        d.F.sellable().find((g) => g.id === 'pearl'),
        1,
      );
      return {
        purse: MARKET.purse,
        left0,
        sold,
        again,
        pearl,
        got: d.G.state.money - m0,
        price: ING_BY_ID.fish.sell,
        left: d.F.purseLeft(),
        pearls: d.F.pearlsLeft(),
      };
    });
    expect(r.left0 === r.purse - 200 && r.sold === Math.floor(r.left0 / r.price), 'кошелёк торговца', r);
    expect(r.got === r.sold * r.price && r.again === 0 && r.pearl === 0 && r.pearls === 3, 'продано сверх кошелька', r);
    await ev(() => window.__dev.run('market'));
    await wait(400);
    const dis = await ev(() => [...document.querySelectorAll('.overlay .card .btn')].every((b) => b.disabled));
    expect(
      dis && (await page.locator('.overlay .purse.empty').count()) === 1,
      'при пустом кошельке кнопки продажи активны',
    );
    await closeAll();
    // утром у торговца снова полный кошелёк; жемчужина продаётся и больше не числится в рюкзаке
    const p = await ev(() => {
      const d = window.__dev;
      d.actions.nextDay();
      d.F.newDayMail();
      const m0 = d.G.state.money;
      const n = d.F.sellGoods(
        d.F.sellable().find((g) => g.id === 'pearl'),
        1,
      );
      return { n, got: d.G.state.money - m0, pearls: d.F.pearlsLeft(), found: d.G.state.pearls, left: d.F.purseLeft() };
    });
    expect(p.n === 1 && p.got === 400 && p.pearls === 2 && p.found === 3 && p.left === 1600, 'жемчуг', p);
    // редкости: вещицы дня и фрукты не по сезону
    await ev(() => window.__dev.run('market:buy'));
    await wait(450);
    const s2 = await state();
    const cards = await page.locator('.overlay .card').count();
    expect(cards >= 4, 'мало редкостей', cards);
    await page.click('.overlay .grid:last-child .card .btn');
    await wait(250);
    s = await state();
    const fruit = Object.keys(s.ing).find((id) => !s2.ing[id]);
    expect(fruit && s.money < s2.money, 'фрукт не по сезону не куплен', s.ing);
    await closeAll();
    // в ТЦ «Вкусный» этого фрукта сейчас нет, зато есть кнопка «Продать на рынке»; такая же — в рюкзаке
    await ev(() => window.__dev.enterBuilding('mall_food'));
    await wait(450);
    expect((await page.locator('.overlay .card.away').count()) > 0, 'в ТЦ «Вкусный» нет отметки «не сезон»');
    await page.click('.overlay .panel-foot .btn');
    await wait(450);
    expect((await titles()) === 'Рынок', 'из ТЦ «Вкусный» рынок не открылся', await titles());
    await closeAll();
    await ev(() => window.__dev.F.openBackpack());
    await wait(400);
    await page.click('.overlay .panel-foot .btn');
    await wait(450);
    expect((await titles()) === 'Рынок', 'из рюкзака рынок не открылся', await titles());
    await closeAll();
    // блюдо на рынке дешевле кафе, а купленное в магазине — дешевле магазина (перепродажа не окупается)
    const arb = await ev(async () => {
      const d = await import('./js/data/index.js');
      return [
        ...d.INGREDIENTS.filter((i) => i.src === 'shop' && i.sell >= i.price).map((i) => i.id),
        ...d.DISHES.filter((q) => q.cafe && q.sell >= q.price).map((q) => q.id),
      ];
    });
    expect(!arb.length, 'перепродажа с прибылью', arb);
  });
  await step('экономика: Хомяк-Банк — счёт и доход по источникам', async () => {
    await ev(() => {
      window.__dev.actions.earn(350, 'work');
      window.__dev.enterBuilding('bank');
    });
    await wait(450);
    const t = await text('.overlay .panel-body');
    for (const w of ['На твоём счету', 'Сегодня', 'Вчера', 'Работа', 'Рынок', 'Потрачено', 'заработано'])
      expect(t.includes(w), `в банке нет «${w}»`, t);
    expect(!/миллиард|миллион/i.test(t), 'в банке остался миллиард', t);
    await closeAll();
    // наклейки: «Заработала 10 000» и «Накопила 50 000»
    const st = await ev(() => {
      const d = window.__dev;
      d.actions.earn(60000, 'other');
      return d.G.state.stickers.filter((q) => ['x_10k', 'x_50k', 'x_rich'].includes(q)).join();
    });
    expect(st === 'x_10k,x_50k', 'наклейки за заработок', st);
    const chip = norm(await ev(() => document.querySelector('.chip.money').textContent));
    expect(/\d\d \d{3}/.test(chip), 'плашка монет с большим числом', chip);
    await wait(1400);
    await closeAll();
  });
  await step('экономика: перенос сохранения v1 → v2, письмо банка один раз', async () => {
    const old = JSON.parse(SAVE_V1);
    old.stickers.push('x_rich'); // наклейка прежней игры остаётся у тех, у кого она была
    old.pearls = 4;
    await putSave(JSON.stringify(old));
    await page.click('text=Продолжить');
    await page.waitForSelector('text=Письмо из Хомяк-Банка');
    await wait(400);
    const letter = await text('.overlay .panel-body');
    expect(letter.includes('20 000') && letter.includes(old.name) && /стройк/i.test(letter), 'письмо банка', letter);
    let s = await state();
    expect(s.v === 2 && s.money === 20000 && s.spent === 0 && s.earned === 0, 'деньги после переноса', [s.v, s.money]);
    expect(s.flags.bankLetter === 2 && s.ledger && s.pearlsSold === 0, 'новые поля', [s.flags, s.ledger, s.pearlsSold]);
    const same = (k) => JSON.stringify(s[k]) === JSON.stringify(old[k]);
    for (const k of ['name', 'clothes', 'storage', 'dishes', 'seeds', 'recipes', 'stickers', 'day', 'pearls'])
      expect(same(k), `после переноса изменилось «${k}»`, [s[k], old[k]]);
    expect(s.villa.length === old.villa.length && s.friends.plusha.pts === old.friends.plusha.pts, 'мебель или друзья');
    expect(JSON.stringify(s.look.outfit) === JSON.stringify(old.look.outfit), 'наряд изменился');
    const backup = JSON.parse(await ev(() => localStorage.getItem('rhr-save-backup')));
    expect(backup.v === 1 && backup.money > 20000, 'нет копии старого сохранения', backup.money);
    await page.click('.overlay .panel-foot .btn');
    await wait(400);
    // альбом: прежняя наклейка «Потратила миллион» видна, счёт сходится
    await ev(() => window.__dev.F.openAlbum());
    await wait(350);
    const album = await text('.overlay .panel-body');
    expect(
      album.includes('Потратила миллион') && album.includes(`Собрано ${s.stickers.length} из`),
      'альбом',
      album.slice(0, 80),
    );
    await closeAll();
    // второй вход: письма больше нет, деньги те же
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(2200);
    s = await state();
    expect((await page.locator('text=Письмо из Хомяк-Банка').count()) === 0, 'письмо банка показано второй раз');
    expect(s.money === 20000 && s.v === 2 && s.flags.bankLetter === 2, 'после второго входа', [s.money, s.flags]);
    await closeAll();
  });
  await step('образец: сохранение v2', async () => {
    const want = JSON.parse(SAVE_V2);
    await putSave(SAVE_V2);
    await page.click('text=Продолжить');
    await wait(2200);
    const s = await state();
    expect((await page.locator('text=Письмо из Хомяк-Банка').count()) === 0, 'письмо банка в новой игре');
    expect(s.v === 2 && s.name === want.name && s.money === want.money && s.earned === want.earned, 'образец v2', [
      s.v,
      s.money,
    ]);
    expect(
      JSON.stringify(s.ledger) === JSON.stringify(want.ledger) && s.pearlsSold === want.pearlsSold,
      'учёт денег',
      s.ledger,
    );
    expect(JSON.stringify(s.clothes) === JSON.stringify(want.clothes), 'вещи');
    for (const f of ['openBackpack', 'openAlbum', 'openMarket', 'openBank', 'showLetter']) {
      await ev((f) => {
        window.__dev.F[f]();
      }, f);
      await wait(300);
      await closeAll();
    }
    // в новой игре альбом не показывает наклейку прежней игры
    await ev(() => window.__dev.F.openAlbum());
    await wait(300);
    expect(!(await text('.overlay .panel-body')).includes('Потратила миллион'), 'старая наклейка в альбоме');
    await closeAll();
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, tag] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: tag === 'phone' });
    page.setDefaultTimeout(8000);
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${tag}] exception: ${e.message}`));
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
    // главный цикл жив: время игры идёт
    const alive = async () => {
      const t0 = await ev(() => window.__dev && window.__dev.G.time);
      await wait(150);
      if (!((await ev(() => window.__dev && window.__dev.G.time)) > t0)) throw new Error('главный цикл остановился');
    };
    const step = async (name, fn, o = {}) => {
      if (ONLY_EXTRA && !o.extra && name !== 'новая игра') return;
      const before = errors.length;
      try {
        await fn();
        await alive();
      } catch (e) {
        errors.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`);
      }
      if (o.expectErrors)
        errors.splice(
          before,
          errors.length - before,
          ...errors.slice(before).filter((q) => !q.includes(o.expectErrors)),
        );
      console.log(`${errors.length === before ? 'ok  ' : 'FAIL'} [${tag}] ${name}`);
    };
    // закрыть все окна и диалоги
    const closeAll = async () => {
      for (let i = 0; i < 5; i++) {
        const n = await ev(() => {
          const els = [
            ...document.querySelectorAll('.dialog .btn:last-child, .overlay .xbtn, #mg .xbtn, #piano .xbtn'),
          ];
          els.forEach((x) => x.click());
          return els.length;
        });
        await wait(200);
        if (!n) break;
      }
    };
    const hold = async (key, ms) => {
      await page.keyboard.down(key);
      await wait(ms);
      await page.keyboard.up(key);
    };

    await step('новая игра', async () => {
      await page.goto(BASE + '/index.html');
      await wait(300);
      await ev(() => localStorage.clear());
      await page.reload();
      await wait(400);
      await page.click('text=Играть!');
      await wait(400);
      await page.click('text=Поехали!');
      await wait(500);
      if ((await ev(() => window.__dev.sceneName)) !== 'villa') throw new Error('ожидалась вилла');
    });
    for (const fn of [
      'openWardrobe',
      'openCooking',
      'openFridge',
      'openPhone',
      'openAlbum',
      'openBackpack',
      'openMap',
      'openMailbox',
      'showLetter',
    ]) {
      await step('окно ' + fn, async () => {
        await ev((f) => {
          window.__dev.F[f]();
        }, fn);
        await wait(350);
        await closeAll();
      });
    }
    await step('карта: из виллы идём к месту в городе', async () => {
      await ev(() => {
        window.__dev.F.openMap();
      });
      await wait(350);
      await page.click('.overlay .opt:nth-child(4)');
      await wait(500);
      const r = await ev(() => ({ scene: window.__dev.sceneName, open: document.querySelectorAll('.overlay').length }));
      if (r.scene !== 'world' || r.open) throw new Error('карта не отправила хомячка в город: ' + JSON.stringify(r));
      await ev(() => {
        window.__dev.go('villa');
      });
      await wait(300);
    });
    await step('вилла: ходьба и режим обустройства', async () => {
      await hold('ArrowRight', 500);
      await hold('ArrowDown', 200);
      await wait(2500);
      await ev(() => {
        window.__dev.Villa.setDecor(true);
      });
      await wait(300);
      await ev(() => {
        window.__dev.Villa.setDecor(false);
      });
    });
    await step('вилла: мебель и встроенные предметы зовут занятия через реестр действий', async () => {
      const open = () =>
        ev(() => [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent).join());
      for (const [floor, x, title] of [
        [1, 82, 'Мой шкаф'],
        [0, 978, 'Холодильник'],
        [0, 1120, 'Плита'],
        [1, 270, 'Пора спать?'],
      ]) {
        await ev(([floor, x]) => window.__dev.villaAt(floor, x), [floor, x]);
        await wait(250);
        await page.keyboard.press('KeyE');
        await wait(450);
        const t = await open();
        if (t !== title) throw new Error(`ожидалось окно «${title}», открыто: «${t}»`);
        await page.click('.overlay .panel-foot .btn:last-child, .overlay .xbtn');
        await wait(300);
        await closeAll();
      }
    });
    await step('гость приходит сам', async () => {
      await ev(() => {
        const d = window.__dev;
        d.villaAt(0, 600);
        d.actions.meetFriend('bob');
        d.actions.mutate((s) => {
          s.visitor = 'bob';
          s.minutes = 11 * 60 + 5;
        });
      });
      await wait(500);
      const r = await ev(() => ({
        guests: window.__dev.G.state.guests.join(),
        actors: window.__dev.Villa.actors.map((a) => a.id).join(),
        visitor: window.__dev.G.state.visitor,
      }));
      if (r.guests !== 'bob' || r.actors !== 'bob' || r.visitor)
        throw new Error('гость не пришёл: ' + JSON.stringify(r));
      await ev(() => {
        const d = window.__dev;
        d.actions.removeGuest('bob');
        d.actions.mutate((s) => {
          s.minutes = 8 * 60;
        });
      });
    });
    await step('город: ходьба', async () => {
      await ev(() => {
        window.__dev.go('world');
      });
      await wait(500);
      await hold('ArrowDown', 900);
      await hold('ArrowRight', 900);
      for (const [x, y] of [
        [30, 12],
        [44, 14],
        [60, 13],
        [40, 36],
        [15, 27],
      ]) {
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [x, y]);
        await hold('ArrowLeft', 300);
      }
    });
    for (const id of [
      'mall_fashion',
      'boutique',
      'mall_home',
      'mall_food',
      'salon',
      'cafe',
      'rest',
      'beachcafe',
      'pool',
      'school',
      'hospital',
      'fashion',
      'bank',
      'house0',
    ]) {
      await step('здание ' + id, async () => {
        await ev((b) => {
          window.__dev.enterBuilding(b);
        }, id);
        await wait(400);
        await closeAll();
      });
    }
    for (const g of ['swim', 'fishing', 'teacher', 'doctor', 'chef', 'fashion']) {
      await step('мини-игра ' + g, async () => {
        await ev((g) => {
          window.__dev.F.playMinigame(g, { spot: 'pier' });
        }, g);
        await wait(700);
        await page.click('#mg >> text=Начать!');
        await wait(1500);
        await page.click('#mg .xbtn');
        await wait(400);
        await closeAll();
      });
    }
    await step('друзья: разговор', async () => {
      await ev(() => {
        window.__dev.F.npcDialog('plusha');
      });
      await wait(400);
      await page.click('text=Поболтать');
      await wait(400);
      await closeAll();
    });
    await step('башня: холл и площадка', async () => {
      await ev(() => {
        window.__dev.go('tower');
      });
      await wait(400);
      await hold('ArrowRight', 500);
      await ev(() => window.__dev.Tower.debugDeck());
      await wait(400);
      await hold('ArrowRight', 600);
      await ev(() => {
        window.__dev.go('world');
      });
      await wait(400);
    });
    await step('башня: вход через дверь здания и выход обратно к двери', async () => {
      await ev(() => {
        window.__dev.enterBuilding('tower');
      });
      await wait(400);
      await hold('ArrowLeft', 500); // к двери «Выход»
      await page.keyboard.press('KeyE');
      await wait(400);
      const r = await ev(() => {
        const d = window.__dev,
          door = d.World.doorOf('tower'),
          p = d.World.playerPos();
        return { scene: d.sceneName, dx: Math.abs(p.x - door.x), dy: Math.abs(p.y - door.y) };
      });
      if (r.scene !== 'world' || r.dx > 2 || r.dy > 2) throw new Error('выход из башни: ' + JSON.stringify(r));
    });
    await step('HUD: «Домой» из города', async () => {
      await page.click('.hud-btns.left .rbtn:last-child');
      await wait(450);
      await page.click('.panel-foot .btn.green');
      await wait(400);
      if ((await ev(() => window.__dev.sceneName)) !== 'villa') throw new Error('кнопка «Домой» не привела на виллу');
      await ev(() => {
        window.__dev.go('world');
      });
      await wait(300);
    });
    await step('море: плавание и ныряние', async () => {
      await ev(() => window.__dev.World.debugTeleport(40, 50));
      await wait(400);
      await hold('ArrowDown', 600);
      await ev(() => {
        window.__dev.go('dive');
      });
      await wait(600);
      await hold('ArrowDown', 1200);
      await hold('ArrowRight', 600);
      await page.click('text=Всплыть');
      await wait(600);
      if ((await ev(() => window.__dev.sceneName)) !== 'world') throw new Error('не всплыли');
    });
    await step('кораблик', async () => {
      await ev(() => window.__dev.World.debugTeleport(51, 45));
      await wait(400);
      const s = await ev(() => window.__dev.World.debugScreen(52.5 * 48, 46.2 * 48));
      await page.mouse.click(s.x, s.y);
      await wait(2200);
      await closeAll();
      if (!(await ev(() => window.__dev.World.isBoating()))) throw new Error('не сели на кораблик');
      await hold('ArrowDown', 1500);
      await ev(() => {
        window.__dev.World.leaveBoat();
      });
      await wait(300);
    });
    await step('пианино', async () => {
      await ev(() => window.__dev.openPiano());
      await wait(400);
      await page.keyboard.press('KeyA');
      await wait(200);
      await closeAll();
    });
    // ---------- «движок домов»: пробный дом (interiors/demo_house.js) ----------
    await step('пробный дом: дом жителя — мебель из описания, хозяйка внутри, выход назад', async () => {
      await ev(() => {
        const d = window.__dev;
        d.go('world');
        d.World.debugTeleport(44, 14);
        // так же, как вошёл бы хомячок через дверь здания с act: 'scene:demo_house'
        d.run('scene:demo_house', { back: { scene: 'world', x: 44.5 * 48, y: 14.5 * 48 } });
      });
      await wait(500);
      const house = () =>
        ev(() => {
          const d = window.__dev,
            sc = d.scenes.demo_house;
          return {
            scene: d.sceneName,
            x: sc.p.x,
            state: sc.p.state,
            decor: sc.isDecor(),
            saved: JSON.parse(localStorage.getItem('rhr-save-v1')).pos,
            homes: Object.keys(d.G.state.homes),
            left: document.querySelector('.hud-btns.left').textContent,
            open: document.querySelectorAll('.overlay, .dialog').length,
          };
        });
      let r = await house();
      if (r.scene !== 'demo_house') throw new Error('не вошли в пробный дом');
      if (r.saved.scene !== 'world' || !Number.isFinite(r.saved.y))
        throw new Error('в сохранении должно остаться место снаружи: ' + JSON.stringify(r.saved));
      if (r.homes.length) throw new Error('мебель дома-описания попала в сохранение: ' + r.homes);
      if (!r.left.includes('Домой') || r.left.includes('Обустроить')) throw new Error('HUD чужого дома: ' + r.left);
      await hold('ArrowRight', 400);
      const x1 = (await house()).x;
      if (!(x1 > r.x + 60)) throw new Error('хомячок не идёт: ' + JSON.stringify([r.x, x1]));
      // хозяйку отодвигаем в угол, чтобы не мешала проверять мебель
      const at = (x) =>
        ev((x) => {
          const sc = window.__dev.scenes.demo_house;
          sc.actors[0].x = sc.actors[0].tx = 1040;
          sc.actors[0].wait = 99;
          sc.standUp();
          sc.p.path = [];
          sc.p.x = x;
        }, x);
      await at(300);
      await page.keyboard.press('KeyE'); // диван
      await wait(200);
      if ((await house()).state !== 'sit') throw new Error('не села на диван');
      await at(535);
      await page.keyboard.press('KeyE'); // чужая кровать: ничего не происходит
      await wait(300);
      r = await house();
      if (r.open || r.state !== 'idle') throw new Error('чужой кроватью можно пользоваться: ' + JSON.stringify(r));
      await at(730);
      await page.keyboard.press('KeyE'); // раковина
      await wait(200);
      if (!(await page.locator('text=Лапки чистые').count())) throw new Error('раковина не работает');
      await ev(() => window.__dev.scenes.demo_house.setDecor(true));
      if ((await house()).decor) throw new Error('в чужом доме включился режим обустройства');
      // нажимаем на хозяйку: хомячок подходит, открывается диалог
      await at(880);
      await wait(900); // камера догоняет
      const s = await ev(() => {
        const sc = window.__dev.scenes.demo_house,
          a = sc.actors[0];
        return sc.debugScreen(a.x, -60);
      });
      await page.mouse.click(s.x, s.y);
      await wait(2200);
      if (!(await page.locator('.dialog .name:has-text("Плюша")').count())) throw new Error('хозяйка не заговорила');
      await closeAll();
      // выход через дверь — туда, откуда пришли
      await at(110);
      await page.keyboard.press('KeyE');
      await wait(400);
      const out = await ev(() => ({ scene: window.__dev.sceneName, ...window.__dev.World.playerPos() }));
      if (out.scene !== 'world' || Math.abs(out.x - 44.5 * 48) > 2 || Math.abs(out.y - 14.5 * 48) > 2)
        throw new Error('дверь вывела не туда: ' + JSON.stringify(out));
    });
    await step('пробный дом: своё жильё — мебель в сохранении, «Обустроить», гости, сон', async () => {
      const before = await ev(() => {
        const d = window.__dev;
        if (!d.scenes.demo_flat) d.registerScene('demo_flat', d.createSideScene(d.demoOwn));
        d.go('demo_flat');
        return { villa: d.G.state.villa.length, day: d.G.state.day };
      });
      await wait(500);
      const flat = () =>
        ev(() => {
          const d = window.__dev,
            sc = d.scenes.demo_flat,
            s = d.G.state;
          return {
            scene: d.sceneName,
            items: (s.homes.demo_flat || []).map((i) => i.id),
            villa: s.villa.length,
            piano: s.storage.piano || 0,
            decor: sc.isDecor(),
            tray: document.querySelectorAll('.decor-tray').length,
            left: document.querySelector('.hud-btns.left').textContent,
            guests: sc.actors.map((a) => a.id),
            x: sc.p.x,
            day: s.day,
            saved: JSON.parse(localStorage.getItem('rhr-save-v1')).pos,
          };
        });
      let r = await flat();
      if (r.scene !== 'demo_flat' || r.items.join() !== 'bed_green,lamp,table')
        throw new Error('стартовая мебель: ' + JSON.stringify(r));
      if (r.saved.scene !== 'demo_flat')
        throw new Error('своё жильё должно сохранять позицию: ' + JSON.stringify(r.saved));
      if (!r.left.includes('Обустроить')) throw new Error('нет кнопки «Обустроить»: ' + r.left);
      // обустройство: пианино из кладовки, перетаскивание, обратно в кладовку
      await page.click('.hud-btns.left .rbtn:last-child');
      await wait(300);
      r = await flat();
      if (!r.decor || !r.tray) throw new Error('режим обустройства не включился');
      if (r.piano) {
        await page.click('.decor-tray .tray-item');
        await wait(300);
        r = await flat();
        if (r.items.length !== 4 || r.piano) throw new Error('предмет из кладовки не встал: ' + JSON.stringify(r));
        const spot = await ev(() => {
          const d = window.__dev,
            it = d.G.state.homes.demo_flat.find((i) => i.id === 'piano');
          return { ...d.scenes.demo_flat.debugScreen(it.x, -40), x0: it.x };
        });
        await page.mouse.move(spot.x, spot.y);
        await page.mouse.down();
        await page.mouse.move(spot.x + 60, spot.y, { steps: 4 });
        await page.mouse.up();
        const moved = await ev(() => window.__dev.G.state.homes.demo_flat.find((i) => i.id === 'piano').x);
        if (!(moved > spot.x0 + 20)) throw new Error('мебель не перетаскивается: ' + JSON.stringify([spot.x0, moved]));
        await page.click('text=Убрать в кладовку');
        await wait(300);
        r = await flat();
        if (r.items.length !== 3 || !r.piano) throw new Error('предмет не убрался в кладовку: ' + JSON.stringify(r));
      }
      // последнюю кровать убрать нельзя
      const bed = await ev(() => {
        const d = window.__dev,
          it = d.G.state.homes.demo_flat.find((i) => i.id === 'bed_green');
        return d.scenes.demo_flat.debugScreen(it.x, -40);
      });
      await page.mouse.click(bed.x, bed.y);
      await wait(200);
      await page.click('text=Убрать в кладовку');
      await wait(300);
      r = await flat();
      if (!r.items.includes('bed_green')) throw new Error('последнюю кровать убрали в кладовку');
      await page.click('text=Готово');
      await wait(300);
      if ((await flat()).decor) throw new Error('режим обустройства не выключился');
      // гости приходят и сюда
      await ev(() => {
        const d = window.__dev;
        d.actions.meetFriend('bob');
        d.actions.inviteGuest('bob');
      });
      await wait(300);
      r = await flat();
      if (!r.guests.includes('bob')) throw new Error('гость не пришёл: ' + JSON.stringify(r.guests));
      // сон: просыпаемся здесь же, у своей кровати
      await ev(() => {
        window.__dev.F.askSleep();
      });
      await wait(400);
      await page.click('.panel-foot .btn.green');
      await wait(3600);
      await closeAll();
      r = await flat();
      const bedX = await ev(() => window.__dev.G.state.homes.demo_flat.find((i) => i.id === 'bed_green').x);
      if (r.scene !== 'demo_flat' || r.day !== before.day + 1 || Math.abs(r.x - (bedX + 30)) > 1)
        throw new Error('после сна: ' + JSON.stringify({ scene: r.scene, day: r.day, x: r.x, bedX }));
      if (r.villa !== before.villa)
        throw new Error('мебель виллы изменилась: ' + JSON.stringify([before.villa, r.villa]));
      await ev(() => {
        window.__dev.go('villa');
      });
      await wait(300);
    });
    await step('сон и новый день', async () => {
      const day0 = await ev(() => window.__dev.G.state.day);
      await ev(() => {
        window.__dev.go('villa');
        window.__dev.F.askSleep();
      });
      await wait(400);
      await page.click('.panel-foot .btn.green');
      await wait(3600);
      await closeAll();
      if ((await ev(() => window.__dev.G.state.day)) !== day0 + 1) throw new Error('день не сменился');
    });
    await step('сохранение и продолжение', async () => {
      const day0 = await ev(() => window.__dev.G.state.day);
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await page.reload();
      await wait(500);
      await page.click('text=Продолжить');
      await wait(600);
      if ((await ev(() => window.__dev.G.state.day)) !== day0) throw new Error('сохранение не загрузилось');
    });
    await economy({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    if (tag === 'desktop')
      await extra({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll, hold });
    await page.close();
  }
  await browser.close();
  if (errors.length) {
    console.log('\nОШИБКИ:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('\nВСЁ ХОРОШО');
})();

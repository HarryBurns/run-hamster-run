// Автотест-«дымовуха»: проходит по основным местам игры и проверяет, что нет ошибок в консоли,
// что главный цикл жив после каждого шага и что сохранения-образцы (dev/saves) загружаются.
// Запуск:  python3 -m http.server 8765 &   затем   node dev/smoke.js [http://localhost:8765]
// Нужен Playwright с Chromium. Код возврата 0 — всё хорошо, 1 — есть ошибки.
// Третий аргумент «extra» — только проверки сохранений, цикла и окон (быстро):  node dev/smoke.js <url> extra
// Скорость проверяется отдельно:  node dev/bench.js [url] --spots=forest --sizes=desktop --max-forest=45
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SAVE_V1 = fs.readFileSync(path.join(__dirname, 'saves', 'v1.json'), 'utf8'); // сделано кодом до миграций (коммит dc1d500)

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
    await step('сон и новый день', async () => {
      await ev(() => {
        window.__dev.go('villa');
        window.__dev.F.askSleep();
      });
      await wait(400);
      await page.click('.panel-foot .btn.green');
      await wait(3600);
      await closeAll();
      if ((await ev(() => window.__dev.G.state.day)) !== 1) throw new Error('день не сменился');
    });
    await step('сохранение и продолжение', async () => {
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await page.reload();
      await wait(500);
      await page.click('text=Продолжить');
      await wait(600);
      if ((await ev(() => window.__dev.G.state.day)) !== 1) throw new Error('сохранение не загрузилось');
    });
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

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
const SIZES = ONLY_EXTRA ? [[1280, 720, 'desktop']] : [[1280, 720, 'desktop'], [390, 844, 'phone']];

// ---------- сохранения-образцы, живучесть цикла, очередь окон (один раз, на настольном размере) ----------
async function extra({ page, step, ev, wait, closeAll, hold }) {
  // подложить сохранение и перезагрузить страницу (state = null — чтобы уходящая страница его не перезаписала)
  const putSave = async (raw) => {
    await ev((raw) => { window.__G.state = null; localStorage.removeItem('rhr-save-backup'); localStorage.setItem('rhr-save-v1', raw); }, raw);
    await page.reload(); await wait(500);
  };
  const cont = async () => { await page.click('text=Продолжить'); await wait(600); };
  const stored = () => ev(() => ({ save: localStorage.getItem('rhr-save-v1'), backup: localStorage.getItem('rhr-save-backup') }));
  const edit = (fn) => { const s = JSON.parse(SAVE_V1); fn(s); return JSON.stringify(s); };

  await step('образец: сохранение v1', async () => {
    await putSave(SAVE_V1); await cont();
    const r = await ev(async () => { const g = await import('./js/game.js'), s = window.__G.state; return { name: s.name, clothes: s.clothes.length, scene: window.__G.sceneName, v: s.v, ver: g.saveVersion(), wheel: s.villa.find((i) => i.id === 'wheel').on }; });
    if (r.name !== 'Пуговка' || r.clothes < 13 || r.scene !== 'world' || r.v !== r.ver) throw new Error('образец загрузился не так: ' + JSON.stringify(r));
    if (r.wheel !== undefined) throw new Error('колесо осталось «включённым» после загрузки');
    for (const f of ['openWardrobe', 'openBackpack', 'openAlbum', 'openPhone', 'showLetter']) { await ev((f) => { window.__F[f](); }, f); await wait(300); await closeAll(); }
    await ev(() => { window.__G.go('villa', 'world'); }); await wait(400);
  });
  await step('образец: неизвестные id', async () => {
    await putSave(edit((s) => {
      s.mail = { task: 'нет_такого', read: true, done: false, n: 0, got: {}, items: null }; s.lastTasks.push('нет_такого');
      s.garden[1] = { seed: 'seed_gone', age: 1 }; s.guests = ['nobody', 'plusha']; s.visitor = 'ghost';
      s.villa.push({ uid: 999, id: 'gone_furn', floor: 0, x: 500, y: 0 }); s.storage.gone = 2; s.ing.gone = 1; s.dishes.gone = 1; s.seeds.gone = 1;
      s.clothes.push('gone_dress'); s.look.outfit.body = 'gone_dress'; s.recipes.push('gone_dish');
    }));
    await cont();
    const r = await ev(() => { const s = window.__G.state; return { task: s.mail && s.mail.task, seed: s.garden[1].seed, guests: s.guests.join(), furn: s.villa.some((i) => i.id === 'gone_furn'), body: s.look.outfit.body, bags: [s.storage.gone, s.ing.gone, s.dishes.gone, s.seeds.gone].join() }; });
    if (r.task === 'нет_такого' || !r.task || r.seed || r.guests !== 'plusha' || r.furn || r.body || r.bags !== ',,,') throw new Error('сохранение не почищено: ' + JSON.stringify(r));
    await hold('ArrowLeft', 300);
    for (const f of ['openWardrobe', 'openBackpack', 'openCooking', 'openFridge', 'openAlbum', 'openPhone', 'openMailbox']) { await ev((f) => { window.__F[f](); }, f); await wait(300); await closeAll(); }
    await ev(() => { window.__G.go('villa', 'world'); }); await wait(400); await hold('ArrowRight', 300);
  });
  await step('образец: вкладка умерла сразу после выхода из виллы', async () => {
    // так выглядела позиция до исправления B2: сцена «город», а координаты — от виллы
    await putSave(edit((s) => { s.pos = { scene: 'world', floor: 1, x: 300 }; })); await cont();
    await ev(() => { if (window.__G.sceneName !== 'world') window.__G.go('world', 'villa'); }); await wait(300);
    const a = await ev(() => window.__World.playerPos()); await hold('ArrowDown', 400); const b = await ev(() => window.__World.playerPos());
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !(b.y > a.y)) throw new Error('хомячок не двигается: ' + JSON.stringify([a, b]));
    // а теперь по-настоящему: выйти из виллы и сразу посмотреть, что лежит в хранилище
    await ev(() => { window.__G.go('villa', 'world'); window.__G.go('world', 'villa'); });
    const pos = JSON.parse((await stored()).save).pos;
    if (pos.scene !== 'world' || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || 'floor' in pos) throw new Error('позиция после выхода из виллы: ' + JSON.stringify(pos));
  });
  await step('образец: нечитаемое сохранение', async () => {
    const raw = SAVE_V1.slice(0, 300);
    await putSave(raw);
    const st = await stored();
    if (st.backup !== raw) throw new Error('нет резервной копии');
    if (await page.locator('text=Продолжить').count()) throw new Error('битое сохранение предложено продолжить');
    await page.click('text=Играть!'); await wait(400); await page.click('text=Поехали!'); await wait(400);
    if ((await stored()).backup !== raw) throw new Error('резервная копия пропала после новой игры');
  });
  await step('образец: сохранение от более новой версии игры', async () => {
    const raw = edit((s) => { s.v = 99; });
    await putSave(raw);
    if (!(await page.locator('text=Обновить').count())) throw new Error('нет предложения обновить страницу');
    await page.reload(); await wait(500);
    if ((await stored()).save !== raw) throw new Error('сохранение новой версии перезаписано');
  });
  await step('миграция сохранения и копия перед ней', async () => {
    await putSave(SAVE_V1);
    const r = await ev(async () => {
      const g = await import('./js/game.js');
      g.MIGRATIONS[g.saveVersion()] = (s) => { s.money = Math.min(s.money, 20000); }; // пробная миграция «миллиард → 20 000»
      const ok = g.load(), s = g.G.state || {};
      const out = { ok, v: s.v, ver: g.saveVersion(), money: s.money, backup: JSON.parse(localStorage.getItem('rhr-save-backup') || '{}').money };
      delete g.MIGRATIONS[g.saveVersion() - 1]; g.G.state = null;
      return out;
    });
    if (!r.ok || r.v !== r.ver || r.money !== 20000 || !(r.backup > 20000)) throw new Error('миграция не сработала: ' + JSON.stringify(r));
    await page.reload(); await wait(500); await cont();
  });
  await step('ошибка в кадре не останавливает игру', async () => {
    await ev(() => { window.__G.go('world', 'villa'); }); await wait(300);
    await ev(() => { const sc = window.__G.scenes.world; sc._draw = sc.draw; sc.draw = () => { throw new Error('проверка: сломанный кадр'); }; });
    await wait(1200);
    await ev(() => { const sc = window.__G.scenes.world; sc.draw = sc._draw; delete sc._draw; });
    if (!(await page.locator('text=Что-то сломалось').count())) throw new Error('нет окна «Что-то сломалось»');
    await page.click('text=Домой 🏡'); await wait(500);
    if ((await ev(() => window.__G.sceneName)) !== 'villa') throw new Error('кнопка «Домой» не привела на виллу');
  }, { expectErrors: 'сломанный кадр' });
  await step('подарок ждёт, пока закроют диалог', async () => {
    await ev(() => { const s = window.__G.state; s.friends.plusha.pts = 19; s.friends.plusha.met = true; s.friends.plusha.gift = -1; s.dishes.cookies = 3; window.__F.npcDialog('plusha'); });
    await wait(500); await page.click('text=Угостить'); await wait(500); await page.click('.overlay .card .btn'); await wait(2000);
    let d = await ev(() => ({ dialog: document.querySelectorAll('.dialog').length, overlay: document.querySelectorAll('.overlay').length }));
    if (d.dialog !== 1 || d.overlay !== 0) throw new Error('окно открылось поверх или под диалогом: ' + JSON.stringify(d));
    await page.mouse.click(30, 30); await wait(300); // нажатие мимо диалога с выбором его не закрывает
    if (!(await page.locator('.dialog').count())) throw new Error('диалог закрылся от нажатия мимо');
    await page.click('.dialog .btn:last-child'); await wait(900);
    d = await ev(() => ({ dialog: document.querySelectorAll('.dialog').length, overlay: document.querySelectorAll('.overlay').length }));
    if (d.dialog !== 0 || d.overlay !== 1) throw new Error('подарок не показан после диалога: ' + JSON.stringify(d));
    await closeAll();
  });
  await step('кэш спрайтов: все сезоны, ночь, смена размера окна', async () => {
    await ev(() => { window.__G.go('world', 'villa'); }); await wait(300);
    for (const day of [0, 6, 18, 24]) for (const minutes of [12 * 60, 21.5 * 60]) {
      for (const [tx, ty] of [[30, 4], [15, 28], [43, 15], [60, 13], [14, 10], [40, 40], [51, 45], [47, 56], [33, 68], [36, 89], [12, 92], [61, 87]]) {
        await ev(([day, minutes, tx, ty]) => { const s = window.__G.state; s.day = day; s.minutes = minutes; s.weather = 'sun'; window.__World.debugTeleport(tx, ty); }, [day, minutes, tx, ty]);
        await wait(70);
      }
    }
    const a = await ev(() => window.__World.debugSprites());
    if (a.count < 50) throw new Error('в кэше подозрительно мало спрайтов: ' + a.count);
    if (a.clipped.length) throw new Error('спрайты не поместились в рамку: ' + a.clipped.join(', '));
    await page.setViewportSize({ width: 600, height: 900 }); await wait(400); await hold('ArrowLeft', 300);
    const b = await ev(() => window.__World.debugSprites());
    if (b.k === a.k || b.count >= a.count) throw new Error('кэш не сброшен при смене масштаба: ' + JSON.stringify([a.k, a.count, b.k, b.count]));
    if (b.clipped.length > a.clipped.length) throw new Error('спрайты не поместились в рамку: ' + b.clipped.join(', '));
    await page.setViewportSize({ width: 1280, height: 720 }); await wait(300);
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, tag] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: tag === 'phone' });
    page.setDefaultTimeout(8000);
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] exception: ${e.message}`));
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
    // главный цикл жив: время игры идёт
    const alive = async () => {
      const t0 = await ev(() => window.__G && window.__G.time); await wait(150);
      if (!((await ev(() => window.__G && window.__G.time)) > t0)) throw new Error('главный цикл остановился');
    };
    const step = async (name, fn, o = {}) => {
      if (ONLY_EXTRA && !o.extra && name !== 'новая игра') return;
      const before = errors.length;
      try { await fn(); await alive(); } catch (e) { errors.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`); }
      if (o.expectErrors) errors.splice(before, errors.length - before, ...errors.slice(before).filter((q) => !q.includes(o.expectErrors)));
      console.log(`${errors.length === before ? 'ok  ' : 'FAIL'} [${tag}] ${name}`);
    };
    // закрыть все окна и диалоги
    const closeAll = async () => {
      for (let i = 0; i < 5; i++) {
        const n = await ev(() => {
          const els = [...document.querySelectorAll('.dialog .btn:last-child, .overlay .xbtn, #mg .xbtn, #piano .xbtn')];
          els.forEach((x) => x.click()); return els.length;
        });
        await wait(200); if (!n) break;
      }
    };
    const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };

    await step('новая игра', async () => {
      await page.goto(BASE + '/index.html'); await wait(300);
      await ev(() => localStorage.clear()); await page.reload(); await wait(400);
      await page.click('text=Играть!'); await wait(400);
      await page.click('text=Поехали!'); await wait(500);
      if ((await ev(() => window.__G.sceneName)) !== 'villa') throw new Error('ожидалась вилла');
    });
    for (const fn of ['openWardrobe', 'openCooking', 'openFridge', 'openPhone', 'openAlbum', 'openBackpack', 'openMap', 'openMailbox', 'showLetter']) {
      await step('окно ' + fn, async () => { await ev((f) => { window.__F[f](); }, fn); await wait(350); await closeAll(); });
    }
    await step('вилла: ходьба и режим обустройства', async () => {
      await hold('ArrowRight', 500); await hold('ArrowDown', 200); await wait(2500);
      await ev(() => window.__Villa.setDecor(true)); await wait(300); await ev(() => window.__Villa.setDecor(false));
    });
    await step('город: ходьба', async () => {
      await ev(() => { window.__G.go('world', 'villa'); }); await wait(500);
      await hold('ArrowDown', 900); await hold('ArrowRight', 900);
      for (const [x, y] of [[30, 12], [44, 14], [60, 13], [40, 36], [15, 27]]) { await ev(([x, y]) => window.__World.debugTeleport(x, y), [x, y]); await hold('ArrowLeft', 300); }
    });
    for (const id of ['mall_fashion', 'boutique', 'mall_home', 'mall_food', 'salon', 'cafe', 'rest', 'beachcafe', 'pool', 'school', 'hospital', 'fashion', 'bank', 'house0']) {
      await step('здание ' + id, async () => { await ev((b) => { window.__F.enterBuilding(b); }, id); await wait(400); await closeAll(); });
    }
    for (const g of ['swim', 'fishing', 'teacher', 'doctor', 'chef', 'fashion']) {
      await step('мини-игра ' + g, async () => {
        await ev((g) => { window.__F.playMinigame(g, { spot: 'pier' }); }, g); await wait(700);
        await page.click('#mg >> text=Начать!'); await wait(1500);
        await page.click('#mg .xbtn'); await wait(400); await closeAll();
      });
    }
    await step('друзья: разговор', async () => { await ev(() => { window.__F.npcDialog('plusha'); }); await wait(400); await page.click('text=Поболтать'); await wait(400); await closeAll(); });
    await step('башня: холл и площадка', async () => {
      await ev(() => { window.__G.go('tower', 'world'); }); await wait(400); await hold('ArrowRight', 500);
      await ev(() => window.__Tower.debugDeck()); await wait(400); await hold('ArrowRight', 600);
      await ev(() => { window.__G.go('world', 'tower'); }); await wait(400);
    });
    await step('море: плавание и ныряние', async () => {
      await ev(() => window.__World.debugTeleport(40, 50)); await wait(400); await hold('ArrowDown', 600);
      await ev(() => { window.__G.go('dive', 'world'); }); await wait(600); await hold('ArrowDown', 1200); await hold('ArrowRight', 600);
      await page.click('text=Всплыть'); await wait(600);
      if ((await ev(() => window.__G.sceneName)) !== 'world') throw new Error('не всплыли');
    });
    await step('кораблик', async () => {
      await ev(() => window.__World.debugTeleport(51, 45)); await wait(400);
      const s = await ev(() => window.__World.debugScreen(52.5 * 48, 46.2 * 48));
      await page.mouse.click(s.x, s.y); await wait(2200); await closeAll();
      if (!(await ev(() => window.__World.isBoating()))) throw new Error('не сели на кораблик');
      await hold('ArrowDown', 1500);
      await ev(() => window.__World.leaveBoat()); await wait(300);
    });
    await step('пианино', async () => { await ev(() => import('./js/piano.js').then((m) => m.openPiano())); await wait(400); await page.keyboard.press('KeyA'); await wait(200); await closeAll(); });
    await step('сон и новый день', async () => {
      await ev(() => { window.__G.go('villa', 'world'); window.__F.askSleep(); }); await wait(400);
      await page.click('.panel-foot .btn.green'); await wait(3600); await closeAll();
      if ((await ev(() => window.__G.state.day)) !== 1) throw new Error('день не сменился');
    });
    await step('сохранение и продолжение', async () => {
      await ev(() => window.dispatchEvent(new Event('pagehide'))); await page.reload(); await wait(500);
      await page.click('text=Продолжить'); await wait(600);
      if ((await ev(() => window.__G.state.day)) !== 1) throw new Error('сохранение не загрузилось');
    });
    if (tag === 'desktop') await extra({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll, hold });
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('\nОШИБКИ:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nВСЁ ХОРОШО');
})();

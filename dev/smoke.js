// Автотест-«дымовуха»: проходит по основным местам игры и проверяет, что нет ошибок в консоли.
// Запуск:  python3 -m http.server 8765 &   затем   node dev/smoke.js [http://localhost:8765]
// Нужен Playwright с Chromium. Код возврата 0 — всё хорошо, 1 — есть ошибки.
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8765';
const SIZES = [[1280, 720, 'desktop'], [390, 844, 'phone']];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, tag] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: tag === 'phone' });
    page.setDefaultTimeout(8000);
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] exception: ${e.message}`));
    const step = async (name, fn) => {
      const before = errors.length;
      try { await fn(); } catch (e) { errors.push(`[${tag}] ${name}: ${e.message.split('\n')[0]}`); }
      console.log(`${errors.length === before ? 'ok  ' : 'FAIL'} [${tag}] ${name}`);
    };
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
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
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('\nОШИБКИ:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nВСЁ ХОРОШО');
})();

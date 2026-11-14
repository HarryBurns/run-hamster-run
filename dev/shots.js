// Снимки игры для сравнения «до/после» любой правки, которая не должна менять картинку.
// Время и случайные числа подменены (свои часы и генератор), звук выключен — поэтому два прогона одного
// и того же кода дают одинаковые снимки пиксель в пиксель (кроме 2–3 снимков с разницей в пару пикселей).
//
// Как пользоваться:
//   python3 -m http.server 8765 &
//   node dev/shots.js http://localhost:8765 /tmp/shots-before      # до правки (например, из git worktree)
//   node dev/shots.js http://localhost:8765 /tmp/shots-after       # после
//   node dev/compare.js /tmp/shots-before /tmp/shots-after /tmp/shots-diff
// Ключи:  --only=villa,decor,guests,tower,dive,city,windows,minigames,sleep,title,demo,meadow   --sizes=desktop,phone
// Группы независимы: каждая начинает новую игру в своём окне браузера.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const BASE = args[0] || 'http://localhost:8765';
const OUT = args[1] || 'shots';
const opt = (name, def) => {
  const a = args.find((q) => q.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const ONLY = opt('only', '').split(',').filter(Boolean);
const SIZES = { desktop: [1280, 720], phone: [390, 844] };
const sizes = opt('sizes', 'desktop,phone').split(',');
fs.mkdirSync(OUT, { recursive: true });

// Подмена Math.random на детерминированный генератор — до загрузки страницы.
const SEED = `window.AudioContext = window.webkitAudioContext = undefined; (() => { let s = 12345; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
// Своё виртуальное время: кадры и таймеры идут только по команде window.__run(мс), всегда с нуля и с шагом 1/60 с.
const CLOCK = `(() => {
  let now = 0, id = 1, frame = 0, rafs = [];
  const timers = new Map();
  performance.now = () => now;
  Date.now = () => 1735725600000 + Math.floor(now);
  window.setTimeout = (fn, ms = 0, ...a) => { const i = id++; timers.set(i, { at: now + Math.max(0, +ms || 0), fn, a }); return i; };
  window.setInterval = (fn, ms = 0, ...a) => { const i = id++; const every = Math.max(1, +ms || 0); timers.set(i, { at: now + every, fn, a, every }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.requestAnimationFrame = (fn) => { const i = id++; rafs.push({ i, fn }); return i; };
  window.cancelAnimationFrame = (i) => { rafs = rafs.filter((r) => r.i !== i); };
  const call = (fn, ...a) => { try { fn(...a); } catch (e) { console.error(e); } };
  window.__run = (ms) => {
    const end = now + ms;
    for (;;) {
      const nextFrame = (frame + 1) * (1000 / 60), lim = Math.min(nextFrame, end);
      for (;;) { // таймеры, которым пора, — по порядку
        let best = null, bi = 0;
        for (const [i, t] of timers) if (t.at <= lim && (!best || t.at < best.at || (t.at === best.at && i < bi))) { best = t; bi = i; }
        if (!best) break;
        now = Math.max(now, best.at);
        if (best.every) best.at += best.every; else timers.delete(bi);
        call(best.fn, ...best.a);
      }
      if (nextFrame > end) { now = end; break; }
      now = nextFrame; frame++;
      const list = rafs; rafs = [];
      for (const r of list) call(r.fn, now);
    }
  };
})();`;
// Короткое имя для отладочных хуков игры (js/devhooks.js).
const HOOKS = `window.__T = () => window.__dev;`;

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const size of sizes) {
    const [w, h] = SIZES[size];
    let page = null;
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const real = (ms) => page.waitForTimeout(ms); // настоящее ожидание: подгрузка модулей, раскладка
    const run = async (ms) => {
      await real(30);
      await ev((ms) => window.__run(ms), ms);
    };
    // нажатие мышью по элементу: по селектору или по тексту кнопки; ищем в самом верхнем слое
    const click = async (sel) => {
      const pt = await ev((sel) => {
        const vis = (e) => e.getClientRects().length > 0;
        let el = null;
        if (sel.startsWith('text=')) {
          const t = sel.slice(5),
            ov = [...document.querySelectorAll('.overlay')];
          for (const root of [
            document.querySelector('.dialog'),
            ov[ov.length - 1],
            document.querySelector('#mg'),
            document.querySelector('#piano'),
            document.querySelector('.decor-tray'),
            document.body,
          ]) {
            if (!root) continue;
            el = [...root.querySelectorAll('button')].filter((e) => vis(e) && e.textContent.includes(t))[0];
            if (el) break;
          }
        } else el = [...document.querySelectorAll(sel)].filter(vis)[0];
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, sel);
      if (!pt) throw new Error('нет элемента: ' + sel);
      await page.mouse.click(pt.x, pt.y);
    };
    const shot = async (name) => {
      await real(60);
      await page.screenshot({ path: path.join(OUT, `${size}_${name}.png`), animations: 'disabled' });
    };
    const hold = async (key, ms) => {
      await page.keyboard.down(key);
      await run(ms);
      await page.keyboard.up(key);
    };
    const press = async (key) => {
      await page.keyboard.press(key);
    };
    const closeAll = async () => {
      for (let i = 0; i < 5; i++) {
        const n = await ev(() => {
          const els = [
            ...document.querySelectorAll('.dialog .btn:last-child, .overlay .xbtn, #mg .xbtn, #piano .xbtn'),
          ];
          els.forEach((x) => x.click());
          return els.length;
        });
        await run(300);
        if (!n) break;
      }
    };
    const fresh = async () => {
      await ev(() => {
        localStorage.clear();
      });
      await page.reload();
      await run(500);
      await click('text=Играть!');
      await run(400);
    };
    const start = async () => {
      await fresh();
      await click('text=Поехали!');
      await run(8000);
    }; // 8 с: подсказки и камера успокоились
    const villaAt = async (floor, x, ms = 600) => {
      await ev(
        ([floor, x]) => {
          window.__T().villaAt(floor, x);
        },
        [floor, x],
      );
      await run(ms);
    };
    const F = async (name, ...a) => {
      await ev(
        ([name, a]) => {
          window.__T().F[name](...a);
        },
        [name, a],
      );
    };
    // каждая группа снимков — в своём окне с нуля: группы не влияют друг на друга
    const group = async (name, fn) => {
      if (ONLY.length && !ONLY.includes(name)) return;
      const t0 = Date.now();
      const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: size === 'phone' });
      await context.addInitScript(SEED + CLOCK + HOOKS);
      page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', (e) => problems.push(`[${size}] ${name}: exception: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`[${size}] ${name}: console: ${m.text()}`);
      });
      await page.goto(BASE + '/index.html');
      try {
        await fn();
      } catch (e) {
        problems.push(`[${size}] ${name}: ${e.message.split('\n')[0]}`);
      }
      await context.close();
      console.log(`[${size}] ${name} — ${((Date.now() - t0) / 1000).toFixed(1)} с`);
    };

    await group('title', async () => {
      await ev(() => {
        localStorage.clear();
      });
      await page.reload();
      await run(700);
      await shot('title');
      await click('text=Играть!');
      await run(400);
      await shot('welcome');
      await click('text=Как играть');
      await run(400);
      await shot('help');
    });

    await group('villa', async () => {
      await start();
      await shot('villa_start');
      const rooms = [
        ['wc', 0, 120],
        ['living', 0, 560],
        ['kitchen', 0, 1250],
        ['bed1', 1, 270],
        ['bed2', 1, 720],
        ['bed3', 1, 1120],
        ['bath', 1, 1450],
        ['sauna', 2, 160],
        ['jacuzzi', 2, 530],
        ['pool', 2, 1150],
        ['lift', 0, 1660],
      ];
      for (const [id, f, x] of rooms) {
        await villaAt(f, x);
        await shot('villa_room_' + id);
      }
      // действия со встроенными предметами и мебелью (E — «потрогать то, что рядом»)
      for (const [id, f, x, ms] of [
        ['bath', 1, 1490, 1500],
        ['sauna', 2, 190, 1500],
        ['jacuzzi', 2, 520, 1500],
        ['pool', 2, 1150, 2000],
        ['sofa', 0, 500, 500],
        ['wheel', 1, 838, 3000],
        ['tv', 0, 800, 500],
        ['lamp', 0, 372, 500],
        ['toilet', 0, 62, 400],
        ['sink', 0, 160, 400],
        ['teddy', 1, 1150, 400],
        ['mirror', 1, 470, 400],
        ['book', 1, 1240, 400],
      ]) {
        await villaAt(f, x);
        await press('KeyE');
        await run(ms);
        await shot('villa_act_' + id);
      }
      // лифт: едем с первого этажа на второй
      await villaAt(0, 1500);
      await page.keyboard.down('ArrowUp');
      await run(100);
      await page.keyboard.up('ArrowUp');
      await run(900);
      await shot('villa_lift_ride');
      await run(2500);
      await shot('villa_lift_done');
      // нажатие мышью: идём к плите
      await villaAt(0, 560);
      await ev(() => {
        window.__T().F.openCooking();
      });
      await run(300);
      await closeAll();
      // ночь и лето
      await ev(() => {
        window.__T().G.state.minutes = 21.5 * 60;
      });
      await villaAt(0, 560, 1200);
      await shot('villa_night');
      await ev(() => {
        const s = window.__T().G.state;
        s.minutes = 12 * 60;
        s.day = 18;
        s.weather = 'sun';
      });
      await villaAt(1, 270, 1200);
      await shot('villa_summer');
      await ev(() => {
        const s = window.__T().G.state;
        s.day = 27;
      });
      await villaAt(2, 700, 1200);
      await shot('villa_autumn');
    });

    await group('decor', async () => {
      await start();
      await villaAt(1, 270);
      await ev(() => window.__T().Villa.setDecor(true));
      await run(500);
      await shot('decor_on');
      // где на экране кровать: пробуем точки сеткой и смотрим, что написано в шапке кладовки
      const spot = await ev(() => {
        const V = window.__T().Villa,
          hits = [];
        for (let y = 20; y < innerHeight - 150; y += 12)
          for (let x = 10; x < innerWidth; x += 12) {
            V.pointerDown(x, y);
            V.pointerUp(x, y);
            const b = document.querySelector('.decor-tray .tray-head b');
            if (b && /Кровать розовая/.test(b.textContent)) hits.push([x, y]);
          }
        V.pointerDown(2, 2);
        V.pointerUp(2, 2);
        if (!hits.length) return null;
        const xs = hits.map((q) => q[0]),
          ys = hits.map((q) => q[1]);
        return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
      });
      if (!spot) throw new Error('не нашли кровать на экране');
      await page.mouse.move(spot.x, spot.y);
      await page.mouse.down();
      await run(100);
      await shot('decor_selected');
      await page.mouse.move(spot.x + 40, spot.y, { steps: 4 });
      await page.mouse.move(spot.x + 90, spot.y - 6, { steps: 4 });
      await run(100);
      await shot('decor_drag');
      await page.mouse.up();
      await run(200);
      await shot('decor_dropped');
      // пианино из кладовки → поставить → убрать обратно
      await click('.decor-tray .tray-item');
      await run(300);
      await shot('decor_from_storage');
      await click('text=Убрать в кладовку');
      await run(300);
      await shot('decor_stashed');
      // сдвиг камеры пустым местом
      await page.mouse.move(w / 2, 40);
      await page.mouse.down();
      await page.mouse.move(w / 2 - 80, 90, { steps: 4 });
      await page.mouse.up();
      await run(200);
      await shot('decor_pan');
      await click('text=Готово');
      await run(800);
      await shot('decor_off');
    });

    await group('guests', async () => {
      await start();
      await villaAt(0, 560);
      await ev(() => {
        const t = window.__T(),
          s = t.G.state;
        s.guests = ['plusha', 'bob', 'zefirka'].filter((id) => s.friends[id]);
        if (s.guests.length < 2) s.guests = Object.keys(s.friends).slice(0, 3);
        for (const id of s.guests) s.friends[id].met = true;
        t.Villa.syncGuests();
      });
      await run(3000);
      await shot('guests_walk');
      await run(4000);
      await shot('guests_walk2');
      const id = await ev(() => window.__T().G.state.guests[0]);
      await F('guestDialog', id);
      await run(500);
      await shot('guests_dialog');
      await click('text=Угостить');
      await run(400);
      await shot('guests_pick_dish');
      await click('.overlay .card .btn');
      await run(700);
      await shot('guests_treated');
      await closeAll();
      await run(1500);
      await shot('guests_after');
    });

    await group('tower', async () => {
      await start();
      await ev(() => window.__T().go('world'));
      await run(500);
      await ev(() => {
        window.__T().enterBuilding('tower');
      });
      await run(800);
      await shot('tower_lobby');
      await hold('ArrowRight', 450);
      await press('KeyE');
      await run(500);
      await shot('tower_lobby_sofa');
      await hold('ArrowRight', 850);
      await run(200);
      await press('KeyE');
      await run(500);
      await shot('tower_clerk');
      await closeAll();
      await hold('ArrowRight', 1100);
      await run(200);
      await press('KeyE');
      await run(300);
      await shot('tower_ride_start');
      await run(2000);
      await shot('tower_ride_mid');
      await run(4500);
      await shot('tower_deck_arrive');
      await ev(() => window.__T().Tower.debugDeck());
      await run(9000);
      await shot('tower_deck');
      await hold('ArrowRight', 750);
      await run(100);
      await press('KeyE');
      await run(4000);
      await shot('tower_aim_ready');
      await page.mouse.move(w * 0.7, h * 0.3);
      await page.mouse.down();
      await page.mouse.move(w * 0.78, h * 0.22, { steps: 5 });
      await run(200);
      await shot('tower_aim');
      await page.mouse.up();
      await run(500);
      await shot('tower_plane');
      await run(2500);
      await shot('tower_plane2');
      await ev(() => {
        window.__T().F.openPanorama();
      });
      await run(300);
      await shot('tower_panorama');
      await closeAll();
      await ev(() => window.__T().Tower.debugDeck());
      await hold('ArrowLeft', 400);
      await run(300);
      await shot('tower_deck_left');
      await ev(() => window.__T().back());
      await run(600);
      await shot('tower_exit_world');
    });

    await group('dive', async () => {
      await start();
      await ev(() => window.__T().go('world'));
      await run(400);
      await ev(() => window.__T().World.debugTeleport(40, 65));
      await run(600);
      await shot('sea_swim');
      await ev(() => window.__T().World.dive());
      await run(1500);
      await shot('dive_in');
      await hold('ArrowDown', 2500);
      await run(300);
      await shot('dive_mid');
      await hold('ArrowDown', 3500);
      await run(600);
      await shot('dive_bottom');
      await hold('ArrowRight', 1500);
      await run(300);
      await shot('dive_right');
      await page.mouse.move(w * 0.3, h * 0.3);
      await page.mouse.down();
      await run(600);
      await page.mouse.up();
      await run(300);
      await shot('dive_pointer');
      await click('text=Всплыть');
      await run(900);
      await shot('dive_surface');
    });

    await group('city', async () => {
      await start();
      await ev(() => window.__T().go('world'));
      await run(800);
      await shot('city_door');
      const spots = [
        ['yard', 30, 14],
        ['square', 50, 21],
        ['east', 73, 14],
        ['forest', 36, 5],
        ['beach', 40, 49],
        ['palms', 15, 39],
        ['park', 40, 34],
        ['pool', 70, 36],
        ['hotel', 88, 48],
        ['sea', 40, 65],
        ['pier', 63, 60],
      ];
      for (const [id, x, y] of spots) {
        await ev(([x, y]) => window.__T().World.debugTeleport(x, y), [x, y]);
        await run(500);
        await shot('city_winter_' + id);
      }
      await ev(() => {
        const s = window.__T().G.state;
        s.day = 18;
        s.weather = 'sun';
      });
      for (const [id, x, y] of spots) {
        await ev(([x, y]) => window.__T().World.debugTeleport(x, y), [x, y]);
        await run(500);
        await shot('city_summer_' + id);
      }
      await ev(() => {
        const s = window.__T().G.state;
        s.minutes = 21.5 * 60;
        s.weather = 'rain';
      });
      for (const [id, x, y] of spots.slice(0, 3)) {
        await ev(([x, y]) => window.__T().World.debugTeleport(x, y), [x, y]);
        await run(500);
        await shot('city_night_' + id);
      }
      await ev(() => {
        const s = window.__T().G.state;
        s.minutes = 12 * 60;
        s.weather = 'sun';
        window.__T().World.debugTeleport(50, 21);
      });
      await run(300);
      await hold('ArrowDown', 700);
      await hold('ArrowRight', 700);
      await shot('city_walk');
      await page.mouse.click(w * 0.3, h * 0.6);
      await run(1500);
      await shot('city_tap_walk');
      // кораблик
      await ev(() => window.__T().World.debugTeleport(63, 60));
      await run(400);
      const s = await ev(() => window.__T().World.debugScreen(65.5 * 48, 61.2 * 48));
      await page.mouse.click(s.x, s.y);
      await run(2500);
      await closeAll();
      await shot('city_boat');
      await hold('ArrowDown', 1500);
      await shot('city_boat_sea');
      await ev(() => window.__T().World.leaveBoat());
      await run(500);
      await shot('city_boat_left');
    });

    await group('windows', async () => {
      await start();
      await ev(() => window.__T().go('world'));
      await run(500);
      const win = async (name, open, after) => {
        await open();
        await run(500);
        await shot('win_' + name);
        if (after) await after();
        await closeAll();
      };
      const B = (id) => () =>
        ev((id) => {
          window.__T().enterBuilding(id);
        }, id);
      await win('mall_fashion', B('mall_fashion'), async () => {
        await click('.overlay .card');
        await run(300);
        await shot('win_mall_fashion_tryon');
        await click('.overlay .tab:nth-child(2)');
        await run(300);
        await shot('win_mall_fashion_tab2');
        await click('.overlay .card .btn');
        await run(300);
        await shot('win_mall_fashion_bought');
      });
      await win('boutique', B('boutique'));
      await win('mall_home', B('mall_home'), async () => {
        await click('.overlay .tab:nth-child(4)');
        await run(300);
        await shot('win_mall_home_tab4');
        await click('.overlay .tab:last-child');
        await run(300);
        await shot('win_mall_home_seeds');
      });
      await win('mall_food', B('mall_food'));
      await win('salon', B('salon'), async () => {
        await click('.overlay .opt:not(.sel)');
        await run(300);
        await shot('win_salon_changed');
      });
      await win('cafe', B('cafe'));
      await win('rest', B('rest'), async () => {
        await click('text=Меню');
        await run(400);
        await shot('win_rest_menu');
      });
      await win('beachcafe', B('beachcafe'));
      await win('pool', B('pool'));
      await win('school', B('school'));
      await win('hospital', B('hospital'));
      await win('fashion', B('fashion'));
      await win('bank', B('bank'));
      await B('house0')();
      await run(400);
      await shot('win_house0');
      await run(3500);
      await win(
        'wardrobe',
        () => F('openWardrobe'),
        async () => {
          await click('.overlay .tab:nth-child(2)');
          await run(300);
          await click('.overlay .card');
          await run(300);
          await shot('win_wardrobe_tab2');
        },
      );
      await win(
        'cooking',
        () => F('openCooking'),
        async () => {
          await click('.overlay .btn.green');
          await run(700);
          await shot('win_cook_step');
          await click('text=Снять с плиты');
          await run(500);
          await shot('win_cook_done');
        },
      );
      await win(
        'fridge',
        () => F('openFridge'),
        async () => {
          await click('.overlay .tab:nth-child(2)');
          await run(300);
          await shot('win_fridge_ing');
        },
      );
      await win(
        'backpack',
        () => F('openBackpack'),
        async () => {
          for (const i of [2, 3, 4]) {
            await click(`.overlay .tab:nth-child(${i})`);
            await run(300);
            await shot('win_backpack_tab' + i);
          }
        },
      );
      await win(
        'album',
        () => F('openAlbum'),
        async () => {
          for (const i of [2, 3]) {
            await click(`.overlay .tab:nth-child(${i})`);
            await run(300);
            await shot('win_album_tab' + i);
          }
        },
      );
      await win('phone', () => F('openPhone'));
      await win('map', () => F('openMap'));
      await win('mailbox', () => F('openMailbox'));
      await win('letter', () => F('showLetter'));
      await win(
        'npc',
        () => F('npcDialog', 'plusha'),
        async () => {
          await click('text=Поболтать');
          await run(500);
          await shot('win_npc_chat');
        },
      );
      await win(
        'npc2',
        () => F('npcDialog', 'plusha'),
        async () => {
          await click('text=Угостить');
          await run(500);
          await shot('win_npc_gift_pick');
          await click('.overlay .card .btn');
          await run(600);
          await shot('win_npc_gift');
        },
      );
      await win(
        'garden',
        () => F('gardenBed', 0),
        async () => {
          await click('.overlay .card');
          await run(400);
          await shot('win_garden_planted');
        },
      );
      await click('.hud-btns .rbtn:nth-child(4)');
      await run(400);
      await shot('win_settings');
      await closeAll();
      await run(4000);
      await shot('win_hud_world');
      await win(
        'npc3',
        () => F('npcDialog', 'plusha'),
        async () => {
          await click('text=Позвать в гости');
          await run(500);
          await shot('win_npc_invite');
        },
      );
    });

    await group('minigames', async () => {
      await start();
      for (const g of ['swim', 'fishing', 'teacher', 'doctor', 'chef', 'fashion']) {
        await ev((g) => {
          window.__T().F.playMinigame(g, { spot: 'pier' });
        }, g);
        await real(300);
        await run(900);
        await shot('mg_' + g + '_card');
        await click('text=Начать!');
        await run(1500);
        await shot('mg_' + g + '_play');
        await run(1500);
        await shot('mg_' + g + '_play2');
        await click('#mg .xbtn');
        await run(400);
        await closeAll();
      }
      await ev(() => window.__T().openPiano());
      await real(300);
      await run(600);
      await shot('piano');
      await press('KeyA');
      await run(200);
      await press('KeyD');
      await run(150);
      await shot('piano_keys');
      await closeAll();
    });

    await group('demo', async () => {
      await start();
      await ev(() => {
        const t = window.__T();
        t.go('world');
        t.World.debugTeleport(50, 21);
        t.go('demo_house');
      });
      await run(1200);
      await shot('demo_house');
      await hold('ArrowRight', 900);
      await run(300);
      await shot('demo_house_walk');
      await ev(() => {
        const t = window.__T();
        if (!t.scenes.demo_flat) t.registerScene('demo_flat', t.createSideScene(t.demoOwn));
        t.go('demo_flat');
      });
      await run(900);
      await shot('demo_flat');
      await ev(() => window.__T().scenes.demo_flat.setDecor(true));
      await run(500);
      await shot('demo_flat_decor');
    });

    await group('sleep', async () => {
      await start();
      await villaAt(1, 270);
      await F('askSleep');
      await run(400);
      await shot('sleep_ask');
      await click('.panel-foot .btn.green');
      await run(1000);
      await shot('sleep_fade');
      await run(3000);
      await shot('sleep_morning');
      await closeAll();
      await run(4000);
      await shot('sleep_after');
      // «задание выполнено» и подарок — через очередь окон
      await F('openMailbox');
      await run(300);
      await closeAll();
      await ev(() => {
        window.__T().emit('minigame', { id: 'swim', stars: 2 });
      });
      await run(1500);
      await shot('task_done');
      await click('.panel-foot .btn');
      await run(600);
      await shot('task_surprise');
      await closeAll();
    });

    // пробная локация «движка локаций» (js/locations/demo_meadow.js): зима, лето и карта
    await group('meadow', async () => {
      await start();
      await ev(() => window.__T().go('demo_meadow'));
      await run(900);
      await shot('meadow_winter');
      await ev(() => {
        const t = window.__T();
        t.G.state.day = 18;
        t.G.state.weather = 'sun';
        t.locations.demo_meadow.debugTeleport(14, 5);
      });
      await run(900);
      await shot('meadow_summer');
      await F('openMap');
      await real(300);
      await run(400);
      await shot('meadow_map');
      await closeAll();
    });
  }
  await browser.close();
  if (problems.length) {
    console.log('\nПРОБЛЕМЫ:\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log('\nСнимки готовы: ' + OUT);
})();

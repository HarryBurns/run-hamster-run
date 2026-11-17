// Автотест-«дымовуха»: проходит по основным местам игры и проверяет, что нет ошибок в консоли,
// что главный цикл жив после каждого шага и что сохранения-образцы (dev/saves) загружаются.
// Запуск:  python3 -m http.server 8765 &   затем   node dev/smoke.js [http://localhost:8765]
// Нужен Playwright с Chromium. Код возврата 0 — всё хорошо, 1 — есть ошибки.
// Третий аргумент «extra» — только экономика и проверки сохранений, цикла и окон (быстро):  node dev/smoke.js <url> extra
// Третий аргумент «estate» — только гости, жильё и бизнес (dev/smoke_estate.js):  node dev/smoke.js <url> estate
// Третий аргумент «step:<часть названия>» — только шаги с таким текстом в названии:  node dev/smoke.js <url> step:растёт
// (сезонность продуктов, Э1 — dev/smoke_seasons.js:  node dev/smoke.js <url> step:сезонность;
//  сезонные вещи и «привоз», Э1 — dev/smoke_wares.js:  node dev/smoke.js <url> "step:витрина дня";
//  болезнь, Ф1 — dev/smoke_health.js:  node dev/smoke.js <url> step:болезнь;
//  журнал сюжетных заданий, этап 5 — dev/smoke_quests.js:  node dev/smoke.js <url> step:журнал;
//  лес, П.9 — dev/smoke_forest.js:  node dev/smoke.js <url> step:лес;
//  гора, П.9 — dev/smoke_mountain.js:  node dev/smoke.js <url> step:гора;
//  пещеры, П.9 — dev/smoke_caves.js:  node dev/smoke.js <url> step:пещеры;
//  пустыня, П.9 — dev/smoke_desert.js:  node dev/smoke.js <url> step:пустыня;
//  джунгли, П.9 — dev/smoke_jungle.js:  node dev/smoke.js <url> step:джунгли;
//  секретный пляж, П.9 — dev/smoke_sbeach.js:  node dev/smoke.js <url> "step:секретный пляж";
//  удалённый остров, П.9 — dev/smoke_island.js:  node dev/smoke.js <url> "step:удалённый остров";
//  курортный отель, П.17 — dev/smoke_hotel.js:  node dev/smoke.js <url> step:отель;
//  войти внутрь, этап 13 — dev/smoke_inside.js:  node dev/smoke.js <url> step:внутри;
//  праздники, П.13 — dev/smoke_holidays.js:  node dev/smoke.js <url> step:праздники;
//  вещи, рецепты, значки, этап 12 — dev/smoke_items.js:  node dev/smoke.js <url> step:вещи;
//  природа, море и оживление мест, этап 16 — dev/smoke_nature.js:  node dev/smoke.js <url> step:природа;
//  начало игры в Ореховой Гавани, этап 10 — dev/smoke_start.js:  node dev/smoke.js <url> "step:начало игры";
//  музыка и звуки, этап 9б — dev/smoke_audio.js:  node dev/smoke.js <url> step:звук:;
//  мини-игры вместо сценок, этап 14 — dev/smoke_games.js:  node dev/smoke.js <url> "step:игры 14:")
// Скорость проверяется отдельно:  node dev/bench.js [url] --spots=forest --sizes=desktop --max-forest=45
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SAVE_V1 = fs.readFileSync(path.join(__dirname, 'saves', 'v1.json'), 'utf8'); // сделано кодом до миграций (коммит dc1d500)
const SAVE_V2 = fs.readFileSync(path.join(__dirname, 'saves', 'v2.json'), 'utf8'); // сделано кодом с новой экономикой (этап 3)
const estate = require('./smoke_estate.js'); // этап 4: в гости, жильё, бизнес, «Бариста», перенос v2 → v3
const seasons = require('./smoke_seasons.js'); // Э1: сезонность продуктов, ассортимент дня, огород по сезонам
const wares = require('./smoke_wares.js'); // Э1: сезонные вещи и «привоз» — витрины одежды, мебели, рынок
const health = require('./smoke_health.js'); // Ф1: болезнь — причины, эффекты, доктор, иммунитет, перенос v3 → v4
const quests = require('./smoke_quests.js'); // этап 5: журнал сюжетных заданий, гербарий Мяты, тайные места, v4 → v5
const forest = require('./smoke_forest.js'); // П.9: лес — вход, сбор, улей, белка, костёр, «Грибная охота», задание Шишкина
const mountain = require('./smoke_mountain.js'); // П.9: гора — задание Сени, канатная дорога, источник, снеговик, санки, Вершинкин
const caves = require('./smoke_caves.js'); // П.9: пещеры — задание Орешкина, фонарик, темнота, «Кристаллы», Камушкин
const desert = require('./smoke_desert.js'); // П.9: пустыня — задание Буси, караван, «Раскопки», «Пары», верблюд, Бархан
const jungle = require('./smoke_jungle.js'); // П.9: джунгли — задание Боба, причал, «Лианы», «Узор храма», попугаи, Лиана
const sbeach = require('./smoke_sbeach.js'); // П.9: секретный пляж — задание Зефирки, грот, черепашата, «Замок из песка», Жемчужинка
const island = require('./smoke_island.js'); // П.9: удалённый остров — задание Этажкина, плавание на юг, Вождь Кокос, боулинг, праздник огней
const hotel = require('./smoke_hotel.js'); // П.17: курортный отель — номер на ночь, шведский стол, спа, аниматор, «Горка», носильщица, люкс
const title = require('./smoke_title.js'); // этап 9а: заставка, несколько игр, удаление нарочно, живая сцена
const audio = require('./smoke_audio.js'); // этап 9б: файлы музыки и звуков, музыка по месту, выключение, «Авторы»
const start = require('./smoke_start.js'); // этап 10: новая игра 1 июня, вступительная сценка, вводная цепочка заданий, Ореховая Гавань
const items = require('./smoke_items.js'); // этап 12: рисованные значки вещей, маракуйя, рецепты из леса, венок и гирлянда, карта сокровищ в рюкзаке
const nature = require('./smoke_nature.js'); // этап 16: природа и море — скалы и плотик, дельфины, лагуна, извержение, пирога, гора, пустыня, пляж, отель
const inside = require('./smoke_inside.js'); // этап 13: войти внутрь — дома тайных мест, хозяева, предметы, выход, ночь
const worldmap = require('./smoke_worldmap.js'); // этап 11: «карта мира» — звёздочка к выходу в нужное место, жители вспоминают открытые места, попугай учит слова
const games = require('./smoke_games.js'); // этап 14: мини-игры вместо сценок — трассы «Горки», лифт носильщицы, лыжи, канат с друзьями, ёлка, танец, «Повтори движение»
const holidays = require('./smoke_holidays.js'); // П.13: праздники — Новый год, Рождество, Китайский Новый год, Масленица

// Размер (этап 8): переменная SMOKE_SIZE=desktop|phone или аргумент size:desktop / size:phone — только этот размер
// (полный прогон частями: SMOKE_SIZE=desktop node dev/smoke.js <url>, затем SMOKE_SIZE=phone node dev/smoke.js <url>).
// SMOKE_SIZE=parallel (или size:parallel) — оба размера сразу, двумя процессами в двух браузерах; строки помечены
// [desktop]/[phone], итог общий. Без размера — как раньше: сначала компьютер, потом телефон в одном браузере.
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('size:'));
const SIZE_ARG = process.argv.slice(2).find((a) => a.startsWith('size:'));
const ONLY_SIZE = (SIZE_ARG ? SIZE_ARG.slice(5) : process.env.SMOKE_SIZE || '').trim();
const BASE = ARGS[0] || 'http://localhost:8765';
const ONLY_ESTATE = ARGS[1] === 'estate';
const ONLY_EXTRA = ARGS[1] === 'extra' || ONLY_ESTATE;
const ONLY_STEP = (ARGS[1] || '').startsWith('step:') ? ARGS[1].slice(5) : '';
const ALL_SIZES = ONLY_EXTRA
  ? [[1280, 720, 'desktop']]
  : [
      [1280, 720, 'desktop'],
      [390, 844, 'phone'],
    ];
if (ONLY_SIZE && !['desktop', 'phone', 'parallel'].includes(ONLY_SIZE)) {
  console.log('SMOKE_SIZE: ожидалось desktop, phone или parallel, а не «' + ONLY_SIZE + '»');
  process.exit(2);
}
const SIZES = ONLY_SIZE && ONLY_SIZE !== 'parallel' ? ALL_SIZES.filter((s) => s[2] === ONLY_SIZE) : ALL_SIZES;

// Хомячок в городе стоит на свободной клетке, от неё можно дойти до двери виллы, кораблик — на воде
// (после перепланировки города позиции из старых сохранений попадают «куда придётся» — движок их чинит).
const townOk = () => {
  const d = window.__dev,
    W = d.World,
    m = W.map,
    T = 48,
    p = W.p,
    tx = Math.floor(p.x / T),
    ty = Math.floor(p.y / T),
    door = m.doorPx(m.bById.villa),
    bt = d.G.state.boat || { x: 65.5 * T, y: 61.5 * T };
  const sea = ['h', 'w', 'O'].includes(m.at(Math.floor(bt.x / T), Math.floor(bt.y / T)));
  const free = W.pass()(tx, ty);
  const way = p.ride
    ? true
    : (tx === Math.floor(door.x / T) && ty === Math.floor(door.y / T)) ||
      !!m.path(m.foot, tx, ty, Math.floor(door.x / T), Math.floor(door.y / T));
  return { ok: free && way && sea, free, way, sea, tx, ty };
};

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
    // город с тех пор перепланировали: хомячок не в стене и не в кармане, кораблик на воде
    const pos = await ev(townOk);
    if (!pos.ok) throw new Error('позиция из старого сохранения в новом городе: ' + JSON.stringify(pos));
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
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
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
  await step('хомячок: пятна и бантик не «перебегают» при смене направления, поворот виден по мордочке', async () => {
    // рисуем хомячка на маленьком холсте во всех направлениях и считаем точки по цветам
    const r = await ev(async () => {
      const { drawHamster } = await import(new URL('js/art/hamster.js', location.href).href);
      const look = {
        fur: '#ffffff',
        spots: '#2f2a2a',
        ear: '#ffb3c1',
        outfit: {},
        beauty: { blush: null, bow: '#ff5c8a' },
      };
      const W = 120,
        OX = 60,
        OY = 104;
      const out = [];
      for (const dir of [1, -1, undefined])
        for (const walk of [null, 0.25]) {
          const c = document.createElement('canvas');
          c.width = c.height = W;
          const x = c.getContext('2d', { willReadFrequently: true });
          drawHamster(x, OX, OY, 1, look, { dir, walk, time: 1, shadow: false });
          const d = x.getImageData(0, 0, W, W).data;
          const near = (i, r, g, b) => Math.abs(d[i] - r) < 8 && Math.abs(d[i + 1] - g) < 8 && Math.abs(d[i + 2] - b) < 8;
          const q = { dir, walk, earL: 0, earR: 0, bodyL: 0, bodyR: 0, bowN: 0, bowX: 0, eyeN: 0, eyeX: 0 };
          for (let py = 0; py < W; py++)
            for (let px = 0; px < W; px++) {
              const i = (py * W + px) * 4,
                hx = px - OX,
                hy = py - OY;
              if (near(i, 0x2f, 0x2a, 0x2a)) {
                if (hy < -73) hx < 0 ? q.earL++ : q.earR++; // выше макушки — только уши
                else if (hy > -26) hx < 0 ? q.bodyL++ : q.bodyR++; // ниже подбородка — пятна на боках
              } else if (near(i, 0xff, 0x5c, 0x8a)) {
                q.bowN++;
                q.bowX += hx;
              } else if (near(i, 0x1d, 0x1b, 0x1b) && hy > -64 && hy < -46) {
                q.eyeN++;
                q.eyeX += hx;
              }
            }
          q.bowX /= q.bowN || 1;
          q.eyeX /= q.eyeN || 1;
          out.push(q);
        }
      return out;
    });
    const bad = r.filter(
      (q) => !(q.earR > 20 && q.earL === 0 && q.bodyL > q.bodyR * 1.3 && q.bodyR > 10 && q.bowN > 40 && q.bowX < -8),
    );
    if (bad.length) throw new Error('пятно или бантик сменили сторону: ' + JSON.stringify(bad));
    const eye = (dir) => r.find((q) => q.dir === dir && q.walk === null).eyeX;
    if (!(eye(1) - eye(undefined) > 2 && eye(undefined) - eye(-1) > 2))
      throw new Error('направление не видно по мордочке: ' + JSON.stringify([eye(-1), eye(undefined), eye(1)]));
  });
  await step('кэш спрайтов: все сезоны, ночь, смена размера окна', async () => {
    await ev(() => {
      window.__dev.go('world');
    });
    await wait(300);
    for (const day of [0, 6, 18, 24])
      for (const minutes of [12 * 60, 21.5 * 60]) {
        for (const [tx, ty] of [
          [36, 5],
          [15, 39],
          [50, 21],
          [73, 14],
          [17, 12],
          [40, 36],
          [70, 36],
          [88, 48],
          [40, 53],
          [63, 60],
          [62, 72],
          [44, 83],
          [48, 104],
          [16, 107],
          [81, 102],
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
    // земля — кэш кусками: в памяти только куски вокруг экрана, старые сезоны и места вытеснены
    const g = await ev(() => window.__dev.World.debugGround());
    if (!(g.count > 0) || g.pixels > 12e6 || g.count > 90) throw new Error('кэш земли: ' + JSON.stringify(g));
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
    await click('.overlay .card .btn.green'); // первой может стоять дорогая вещь из привоза — берём ту, что по карману
    await closeAll();
    await ev(() => {
      window.__dev.enterBuilding('salon');
    });
    await wait(400);
    await click('.overlay .opt:not(.sel)'); // примерка (Ф1) — бесплатно, «Сделать за» — по-настоящему
    await click('.overlay .salon-pay .btn');
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
    await ev(() => window.__dev.World.debugTeleport(63, 60));
    await wait(300);
    const bs = await ev(() => window.__dev.World.debugScreen(65.5 * 48, 61.2 * 48));
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

  // ---------- «движок локаций»: пробная локация, переходы, сохранение позиции ----------
  const T = 48;
  const near = (a, b, eps = 2) => Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
  const where = () =>
    ev(() => {
      const d = window.__dev,
        sc = d.scene;
      return { scene: d.sceneName, ...(sc.playerPos ? sc.playerPos() : {}) };
    });
  await step('старое сохранение { scene: "world", x, y }: хомячок там же, формат позиции прежний', async () => {
    await putSave(SAVE_V1);
    await cont();
    const want = JSON.parse(SAVE_V1).pos,
      r = await where();
    if (r.scene !== 'world' || !near(r, want)) throw new Error('позиция из старого сохранения: ' + JSON.stringify(r));
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    const pos = JSON.parse((await stored()).save).pos;
    if (Object.keys(pos).join() !== 'scene,x,y' || pos.scene !== 'world' || !near(pos, want))
      throw new Error('формат позиции города изменился: ' + JSON.stringify(pos));
    const cur = await ev(() => [window.__dev.topdown.currentLocation().name, window.__dev.topdown.homeLocation().name]);
    if (cur.join() !== 'world,world') throw new Error('текущая и главная локации: ' + cur);
  });
  await step('пробная локация: карта из описания, свои клетка и предмет, житель, место, находка', async () => {
    await ev(() => {
      const d = window.__dev;
      d.G.state.minutes = 12 * 60; // днём жители на улице
      d.G.state.dayFlags = {};
      d.go('demo_meadow');
      window.__stopWatch = d.watchState();
    });
    await wait(500);
    const loc = (fn, arg) =>
      ev(
        ([fn, arg]) => new Function('sc', 'd', 'a', fn)(window.__dev.locations.demo_meadow, window.__dev, arg),
        [fn, arg],
      );
    const info = await loc(`const m = sc.map; return {
      scene: d.sceneName, cur: d.topdown.currentLocation().name, w: m.w, h: m.h, own: m.at(5, 1), path: m.at(10, 12),
      boulders: m.objs.filter((o) => o.type === 'boulder').length, trees: m.objs.filter((o) => o.type === 'tree').length,
      solid: !m.foot(16, 2) && !m.foot(0, 0) && m.foot(10, 12), slow: !!m.slowAt(3.5 * 48, 2.5 * 48),
      npcs: sc.npcs.map((n) => n.id).join(), pos: sc.savePos(), saved: JSON.parse(localStorage.getItem('rhr-save-v1')).pos,
      way: !!m.path(m.foot, 11, 11, 16, 3), noWay: m.path(m.foot, 11, 11, 16, 2) };`);
    if (info.scene !== 'demo_meadow' || info.cur !== 'demo_meadow')
      throw new Error('не вошли: ' + JSON.stringify(info));
    if (
      info.w !== 20 ||
      info.h !== 14 ||
      info.own !== 'clover' ||
      info.path !== 'y' ||
      info.boulders !== 1 ||
      !info.trees
    )
      throw new Error('карта собрана не по описанию: ' + JSON.stringify(info));
    if (!info.solid || !info.slow || !info.way || info.noWay !== null)
      throw new Error('препятствия, кусты или поиск пути: ' + JSON.stringify(info));
    if (info.npcs !== 'myata') throw new Error('жители: ' + info.npcs);
    if (
      info.pos.scene !== 'demo_meadow' ||
      info.saved.scene !== 'demo_meadow' ||
      !near(info.pos, { x: 11 * T, y: 11.5 * T })
    )
      throw new Error('позиция и точка входа: ' + JSON.stringify([info.pos, info.saved]));
    // ходьба стрелками и по нажатию
    await hold('ArrowUp', 400);
    const up = await where();
    if (!(up.y < info.pos.y - 40)) throw new Error('хомячок не идёт стрелками: ' + JSON.stringify(up));
    // особое место: нажимаем на валун — хомячок подходит, реестр действий открывает окно
    await loc('sc.debugTeleport(13, 5)');
    await wait(400); // камера встаёт на место
    let pt = await loc('return sc.debugScreen(16.5 * 48, 2.2 * 48)');
    await page.mouse.click(pt.x, pt.y);
    await wait(1800);
    if (!(await page.locator('.overlay:has-text("Подзорная труба")').count()))
      throw new Error('особое место не выполнило действие из реестра');
    if (!near(await where(), { x: 16.5 * T, y: 3.5 * T }))
      throw new Error('хомячок встал не туда: ' + JSON.stringify(await where()));
    await closeAll();
    // свой слой поверх кадра (так пещера рисует темноту со светом от фонарика): крюк overlay зовётся каждый кадр
    await loc(`window.__ov = 0; sc.desc.overlay = (ctx, s, w, h) => { window.__ov++;
      const q = s.cam.toScreen(s.p.x, s.p.y - 30); d.topdown.spotlight(ctx, w, h, q.x, q.y, 170); };`);
    await wait(300);
    const ov = await loc('delete sc.desc.overlay; return window.__ov');
    if (!(ov > 3)) throw new Error('крюк overlay не вызывается: ' + ov);
    const sp = await loc('return sc.debugSprites()');
    if (sp.clipped.length) throw new Error('спрайты не поместились в рамку: ' + sp.clipped.join(', '));
    // находка: подбирается на ходу один раз в день
    const berries = () => ev(() => window.__dev.G.state.ing.strawberry || 0);
    const b0 = await berries();
    await loc('sc.debugTeleport(15, 8)');
    await hold('ArrowRight', 350);
    const got = await loc(
      'return { there: sc.pickupThere(sc.pickups[0]), flag: (d.G.state.dayFlags.finds || {})["demo_meadow:berry"] }',
    );
    if ((await berries()) !== b0 + 1 || got.there || got.flag !== 1)
      throw new Error('находка не подобрана: ' + JSON.stringify(got));
    await hold('ArrowLeft', 300);
    await hold('ArrowRight', 300);
    if ((await berries()) !== b0 + 1) throw new Error('находка подобрана дважды за день');
    // житель: нажимаем — хомячок подходит и заговаривает
    await loc('const n = sc.npcs[0]; n.x = 6.5 * 48; n.y = 5.5 * 48; n.path = []; n.wait = 99; sc.debugTeleport(8, 6)');
    await wait(400);
    pt = await loc('return sc.debugScreen(6.5 * 48, 5.5 * 48 - 30)');
    await page.mouse.click(pt.x, pt.y);
    await wait(1500);
    if (!(await page.locator('.dialog .name:has-text("Мята")').count())) throw new Error('житель не заговорил');
    await closeAll();
    // окно карты показывает эту локацию и ведёт к её месту
    await ev(() => window.__dev.F.openMap());
    await wait(350);
    if (!(await page.locator('.overlay:has-text("Полянка")').count()))
      throw new Error('карта показывает не эту локацию');
    await page.click('.overlay .opt:has-text("Валун")');
    await wait(3200); // идти через всю полянку
    if (!(await page.locator('.overlay:has-text("Подзорная труба")').count()))
      throw new Error('карта не довела до особого места');
    await closeAll();
    const bad = await ev(() => window.__stopWatch());
    if (bad.length) throw new Error('запись в состояние мимо действий: ' + [...new Set(bad)].slice(0, 4).join(' ;; '));
  });
  await step('пробная локация: позиция сохраняется с именем локации и загружается', async () => {
    await ev(() => {
      const d = window.__dev;
      d.go('demo_meadow');
      d.locations.demo_meadow.debugTeleport(5, 9);
    });
    await wait(200);
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    const pos = JSON.parse((await stored()).save).pos,
      want = { x: 5.5 * T, y: 9.5 * T };
    if (pos.scene !== 'demo_meadow' || !near(pos, want)) throw new Error('в сохранении: ' + JSON.stringify(pos));
    await page.reload();
    await wait(500);
    await cont();
    const r = await where();
    if (r.scene !== 'demo_meadow' || !near(r, want)) throw new Error('после загрузки: ' + JSON.stringify(r));
    // позиция в стене (карту локации потом перерисовали): встаём рядом, а не падаем
    await ev(() => {
      const d = window.__dev;
      d.go('villa');
      d.go('demo_meadow', { pos: { scene: 'demo_meadow', x: 0.5 * 48, y: 0.5 * 48 } });
    });
    const fix = await ev(() => {
      const sc = window.__dev.locations.demo_meadow;
      return { ok: sc.map.foot(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)), ...sc.playerPos() };
    });
    if (!fix.ok || !near(fix, { x: 1.5 * T, y: 1.5 * T }))
      throw new Error('позиция в стене не исправлена: ' + JSON.stringify(fix));
  });
  await step('предметы задания «собери» — в локации задания, а не в городе', async () => {
    // заданию про снежинки на время теста назначаем пробную локацию (как будут делать задания новых мест)
    await ev(async () => {
      const d = window.__dev,
        t = (await import('./js/data/index.js')).TASK_BY_ID.snow;
      t.loc = 'demo_meadow';
      t.zone = 'glade';
      d.go('world');
      d.actions.setMail('snow');
      d.F.openMailbox();
    });
    await wait(300);
    await closeAll();
    const loc = (fn) => ev((fn) => new Function('sc', 'd', fn)(window.__dev.locations.demo_meadow, window.__dev), fn);
    const items = await ev(() => window.__dev.G.state.mail.items);
    const inZone = await loc(
      'return d.G.state.mail.items.every((it) => sc.map.foot(it.x, it.y) && it.x >= 1 && it.x <= 18)',
    );
    if (!items || items.length < 6 || !items.every((it) => it.loc === 'demo_meadow') || !inZone)
      throw new Error('предметы разложены не в локации задания: ' + JSON.stringify(items));
    // в городе этих предметов нет: звёздочка на них не показывает, с земли они не подбираются
    const town = await ev((it) => {
      const d = window.__dev;
      d.World.debugTeleport(it.x, it.y);
      return { here: d.World.itemHere(it), target: d.World.target() };
    }, items[0]);
    await wait(250);
    if (town.here || (town.target && town.target.icon === '❄️') || (await ev(() => window.__dev.G.state.mail.n)) !== 0)
      throw new Error('предмет другой локации виден в городе: ' + JSON.stringify(town));
    // а в своей локации — показывает и подбирается
    await ev((it) => {
      const d = window.__dev;
      d.go('demo_meadow');
      d.locations.demo_meadow.debugTeleport(it.x, it.y);
    }, items[0]);
    await wait(300);
    const r = await loc('const m = d.G.state.mail; return { n: m.n, got: m.items[0].got, target: sc.target() }');
    if (r.n !== 1 || !r.got || !r.target || r.target.icon !== '❄️')
      throw new Error('предмет задания в своей локации: ' + JSON.stringify(r));
    // находки можно менять на ходу (каждый день в новых местах): места даёт та же зона
    const pk =
      await loc(`const s = sc.randomSpots('glade', 3, 7), same = JSON.stringify(s) === JSON.stringify(sc.randomSpots('glade', 3, 7));
      const old = sc.desc.pickups;
      sc.setPickups(s.map((q, i) => ({ id: 'x' + i, at: [q.x, q.y], icon: '🍄' })));
      const out = { n: sc.pickups.length, same, there: sc.pickups.every((q) => sc.pickupThere(q)) };
      sc.setPickups(old);
      return out;`);
    if (pk.n !== 3 || !pk.same || !pk.there) throw new Error('setPickups / randomSpots: ' + JSON.stringify(pk));
    await ev(async () => {
      const t = (await import('./js/data/index.js')).TASK_BY_ID.snow;
      delete t.loc;
      delete t.zone;
      window.__dev.actions.setMail('snow');
    });
  });
  await step('переход между локациями: город → лес → город', async () => {
    const send = (name, x, y) =>
      ev(([name, x, y]) => window.__dev.locations[name].walkTo(x * 48, y * 48, true), [name, x, y]);
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.World.debugTeleport(2, 4);
    });
    // пока лес закрыт, тропа перекрыта воротами: за них не пройти — остались в городе, перед воротами
    const wasOpen = await ev(() => window.__dev.QuestState.landOpen('forest'));
    if (wasOpen) await ev(() => window.__dev.actions.mutate((s) => delete s.lands.forest));
    await send('world', 1.5, 0.5);
    await wait(900);
    let r = await where();
    if (r.scene !== 'world' || r.y < 3 * T) throw new Error('закрытый выход сработал: ' + JSON.stringify(r));
    // нажатие на ворота: окно тайного места «Тропа в лес заросла…» (журнал заданий, features/quests.js)
    {
      const g = await ev(() => window.__dev.World.debugScreen(2 * 48, 2.2 * 48));
      await page.mouse.click(g.x, g.y);
      await wait(900);
      const t = await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' '));
      if (!t.includes('Тропа в лес заросла') || !t.includes('Мята'))
        throw new Error('у ворот в лес нет окна «Тропа в лес заросла»: ' + t);
      await closeAll();
    }
    // лес открыт (так его открывает задание Мяты — действие openLand): ворота распахнуты, тропа ведёт в лес
    await ev(() => {
      const d = window.__dev;
      d.actions.openLand('forest');
      d.World.debugTeleport(2, 4);
    });
    await wait(100);
    await send('world', 1.5, 0.5);
    await wait(1200);
    r = await where();
    if (r.scene !== 'forest' || !near(r, { x: 10.5 * T, y: 37.5 * T }))
      throw new Error('переход в лес: ' + JSON.stringify(r));
    const saved = JSON.parse((await stored()).save).pos;
    if (saved.scene !== 'forest') throw new Error('позиция после перехода: ' + JSON.stringify(saved));
    // обратно: по тропе до южной кромки леса
    await send('forest', 10.5, 39.5);
    await wait(1200);
    r = await where();
    if (r.scene !== 'world' || !near(r, { x: 2 * T, y: 1.5 * T }))
      throw new Error('переход обратно в город: ' + JSON.stringify(r));
    await wait(400);
    r = await where();
    if (r.scene !== 'world') throw new Error('после возвращения хомячка затянуло обратно');
    // стоим на клетке выхода в момент входа — он не срабатывает, пока не сойдём с неё и не вернёмся
    await ev(() => window.__dev.go('forest', { at: [10.5, 39.5] }));
    await wait(400);
    r = await where();
    if (r.scene !== 'forest') throw new Error('выход сработал сразу при входе на его клетку');
    // пробная полянка по-прежнему ведёт в город, к тропе
    await ev(() => window.__dev.go('demo_meadow', { at: [10.5, 12.5] }));
    await wait(200);
    await send('demo_meadow', 10.5, 13.5);
    await wait(1200);
    r = await where();
    if (r.scene !== 'world') throw new Error('из пробной полянки — не в город: ' + JSON.stringify(r));
    await ev((wasOpen) => {
      const d = window.__dev;
      if (!wasOpen) d.actions.mutate((s) => delete s.lands.forest);
      d.go('world');
    }, wasOpen);
    await wait(200);
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
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
    await wait(400);
    const hello = await text('.overlay .panel-body');
    expect(!/миллиард/i.test(hello) && hello.includes('3 000') && /заработ/i.test(hello), 'приветствие', hello);
    await page.click('text=Поехали!');
    await wait(500);
    const s = await state();
    const chip = norm(await ev(() => document.querySelector('.chip.money').textContent));
    expect(s.money === 3000 && s.earned === 0 && s.spent === 0 && s.v === 5, 'новая игра', [s.money, s.earned, s.v]);
    expect(s.ledger && s.ledger.today.out === 0 && s.ledger.yesterday, 'нет учёта денег', s.ledger);
    expect(chip.includes('3 000'), 'плашка монет', chip);
    // все цены по карману или хотя бы разумны: ничего дешевле 10 и ничего «за миллион»
    const prices = await ev(async () => {
      const d = await import('./js/data/index.js');
      const all = [
        ...d.CLOTHES.filter((c) => !['start', 'gift', 'holiday'].includes(c.shop)), // holiday — подарки праздников (П.13), без цены
        ...d.FURNITURE.filter((f) => !['gift', 'holiday', 'forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island'].includes(f.shop)), // подарки, праздники и украшения тайных мест — без цены
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
    // цена — по сезону (сейчас зима: морковка не в сезон, за неё дают больше, чем летом)
    const cp = await ev(async () => {
      const D = await import('./js/data/index.js'),
        G = await import('./js/core/state.js');
      return { now: D.sellPrice(D.ING_BY_ID.carrot, G.cal().month), inSeason: D.ING_BY_ID.carrot.sell };
    });
    const all = 5 * cp.now;
    const card = await text('.overlay .card');
    expect(cp.now > cp.inSeason, 'морковка зимой должна стоить на рынке дороже, чем в сезон', cp);
    expect(card.includes('Морковка') && card.includes(`${cp.now} за штуку`) && card.includes('+' + all), 'карточка товара', card);
    await page.click('.overlay .card .btn.green'); // продать 1
    await wait(250);
    let s = await state();
    expect(s.money === s0.money + cp.now && s.ing.carrot === 4, 'продать 1', [s.money - s0.money, s.ing]);
    await page.click('.overlay .card .btn.yellow'); // продать все
    await wait(250);
    s = await state();
    expect(s.money === s0.money + all && !s.ing.carrot, 'продать все', [s.money - s0.money, s.ing]);
    expect(s.dayFlags.marketPaid === all && s.ledger.today.in.market === all, 'учёт рынка', [
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
    expect(r.left0 === r.purse - all && r.sold === Math.floor(r.left0 / r.price), 'кошелёк торговца', r);
    expect(r.got === r.sold * r.price && r.again === 0 && r.pearl === 0 && r.pearls === 3, 'продано сверх кошелька', r);
    // в кошельке осталось меньше цены рыбки и жемчужины — кнопки продажи выключены; монеты кончились совсем —
    // кошелёк показан пустым
    const allOff = () => ev(() => [...document.querySelectorAll('.overlay .card .btn')].every((b) => b.disabled));
    await ev(() => window.__dev.run('market'));
    await wait(400);
    expect(r.left < r.price && (await allOff()), 'торговцу не хватает монет, а кнопки продажи активны', r.left);
    await closeAll();
    await ev((purse) => window.__dev.actions.setDayFlag('marketPaid', purse), r.purse);
    await ev(() => window.__dev.run('market'));
    await wait(400);
    expect(
      (await allOff()) && (await page.locator('.overlay .purse.empty').count()) === 1,
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
    // редкости: вещицы дня; под ними — раздел «Не по сезону» (что в нём бывает — шаги «сезонность», smoke_seasons.js)
    await ev(() => window.__dev.run('market:buy'));
    await wait(450);
    const cards = await page.locator('.overlay .card').count();
    expect(cards >= 3, 'мало редкостей', cards);
    expect((await text('.overlay .panel-body')).includes('Не по сезону'), 'на рынке нет раздела «Не по сезону»');
    await closeAll();
    // в ТЦ «Вкусный» зимой часть продуктов не привезли — карточки серые, но на месте; рынок — только у прилавков
    // на площади (кнопок в ТЦ и в рюкзаке нет)
    await ev(() => window.__dev.enterBuilding('mall_food'));
    await wait(450);
    expect((await page.locator('.overlay .card.away').count()) > 0, 'в ТЦ «Вкусный» нет серых карточек «сегодня нет»');
    expect((await page.locator('.overlay .panel-foot .btn').count()) === 0, 'в ТЦ «Вкусный» осталась кнопка рынка');
    await closeAll();
    await ev(() => window.__dev.enterBuilding('market'));
    await wait(450);
    expect((await titles()) === 'Рынок', 'у прилавков на площади рынок не открылся', await titles());
    await closeAll();
    await ev(() => window.__dev.F.openBackpack());
    await wait(400);
    expect((await titles()) === 'Рюкзак', 'рюкзак не открылся', await titles());
    expect((await page.locator('.overlay .panel-foot .btn').count()) === 0, 'в рюкзаке осталась кнопка «Продать»');
    await closeAll();
    // блюдо на рынке дешевле кафе, а купленное в магазине — дешевле магазина в любом месяце (перепродажа не окупается)
    const arb = await ev(async () => {
      const d = await import('./js/data/index.js');
      const loss = (i) => d.MONTHS.every((_, m) => d.sellPrice(i, m) < d.buyPrice(i, m));
      return [
        ...d.INGREDIENTS.filter((i) => i.price && !loss(i)).map((i) => i.id),
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
  await step('экономика: состояние меняют только действия', async () => {
    await ev(async () => {
      const d = window.__dev;
      const mod = (await import('./js/minigames/teacher.js')).default;
      window.__teacherStart = mod.start;
      mod.start = (host) => {
        const t = setTimeout(() => host.finish({ stars: 3, text: 'проверка' }), 60);
        return { stop: () => clearTimeout(t) };
      };
      d.actions.nextDay();
      d.F.newDayMail();
      d.actions.addItem('ing', 'carrot', 3);
      d.actions.addItem('dishes', 'fish_soup', 2);
      d.actions.setMail('market');
      d.actions.readMail();
      window.__stopWatch = d.watchState();
    });
    // продажа (и задание «Базарный день» с наградой), покупка редкости, зарплата, банк, ночь
    await ev(() => window.__dev.run('market'));
    await wait(400);
    await page.click('.overlay .card .btn.green');
    await wait(250);
    await page.click('.overlay .card .btn.yellow');
    await wait(250);
    await page.click('.overlay .tab:nth-child(2)');
    await wait(300);
    await page.click('.overlay .card .btn');
    await wait(250);
    await closeAll();
    await page.waitForSelector('text=Задание выполнено!');
    await page.click('.overlay .panel-foot .btn');
    await wait(500);
    await closeAll();
    await ev(() => window.__dev.enterBuilding('school'));
    await wait(450);
    await page.click('.dialog .btn.green');
    await wait(600);
    await page.click('#mg >> text=Начать!');
    await wait(450);
    await page.click('#mg >> text=Ура!');
    await wait(450);
    await ev(() => window.__dev.enterBuilding('bank'));
    await wait(400);
    await closeAll();
    await ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.F.newDayMail();
    });
    await wait(1700);
    await closeAll();
    const r = await ev(async () => {
      const bad = window.__stopWatch();
      (await import('./js/minigames/teacher.js')).default.start = window.__teacherStart;
      const s = window.__dev.G.state;
      return {
        bad,
        done: s.stickers.includes('market'),
        work: s.ledger.yesterday.in.work,
        market: s.ledger.yesterday.in.market,
      };
    });
    expect(!r.bad.length, `запись в состояние мимо действий (${r.bad.length})`, [...new Set(r.bad)].slice(0, 6));
    expect(r.done && r.work === 500 && r.market > 0, 'задание «Базарный день» или учёт', r);
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
    expect(s.v === 5 && s.money === 20000 && s.spent === 0 && s.earned === 0, 'деньги после переноса', [s.v, s.money]);
    expect(s.flags.bankLetter === 2 && s.ledger && s.pearlsSold === 0, 'новые поля', [s.flags, s.ledger, s.pearlsSold]);
    const same = (k) => JSON.stringify(s[k]) === JSON.stringify(old[k]);
    for (const k of ['name', 'storage', 'dishes', 'seeds', 'stickers', 'day', 'pearls'])
      expect(same(k), `после переноса изменилось «${k}»`, [s[k], old[k]]);
    // вещи: всё, что было, и шлёпанцы в подарок (У2)
    expect(JSON.stringify(s.clothes) === JSON.stringify([...old.clothes, 'flip_pink']), 'вещи после переноса', s.clothes);
    // рецепты: всё, что было, на месте; в конец дописаны только новые рецепты «с начала игры» (repair)
    expect(
      JSON.stringify(s.recipes.slice(0, old.recipes.length)) === JSON.stringify(old.recipes) &&
        s.recipes.slice(old.recipes.length).every((r) => ['mushroom_soup', 'blueberry_muffin', 'lettuce_wrap', 'honey_tea'].includes(r)),
      'после переноса изменилось «recipes»',
      [s.recipes, old.recipes],
    );
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
    expect(s.money === 20000 && s.v === 5 && s.flags.bankLetter === 2, 'после второго входа', [s.money, s.flags]);
    expect(s.clothes.filter((id) => id === 'flip_pink').length === 1, 'шлёпанцы подарены второй раз', s.clothes);
    await closeAll();
  });
  await step('образец: сохранение v2', async () => {
    const want = JSON.parse(SAVE_V2);
    await putSave(SAVE_V2);
    await page.click('text=Продолжить');
    await wait(2200);
    const s = await state();
    expect((await page.locator('text=Письмо из Хомяк-Банка').count()) === 0, 'письмо банка в новой игре');
    expect(s.v === 5 && s.name === want.name && s.money === want.money && s.earned === want.earned, 'образец v2', [
      s.v,
      s.money,
    ]);
    expect(
      JSON.stringify(s.ledger) === JSON.stringify(want.ledger) && s.pearlsSold === want.pearlsSold,
      'учёт денег',
      s.ledger,
    );
    expect(JSON.stringify(s.clothes) === JSON.stringify([...want.clothes, 'flip_pink']), 'вещи (и шлёпанцы в подарок)');
    if ((await ev(() => window.__dev.sceneName)) === 'world') {
      const pos = await ev(townOk);
      expect(pos.ok, 'позиция из сохранения v2 в новом городе', pos);
    }
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

// Оба размера сразу: два дочерних процесса (у каждого свой браузер), вывод — построчно, итог — общий.
const runParallel = () => {
  const { spawn } = require('child_process');
  const t0 = Date.now();
  const kids = SIZES.map(
    ([, , tag]) =>
      new Promise((resolve) => {
        const ch = spawn(process.execPath, [__filename, ...ARGS], { env: { ...process.env, SMOKE_SIZE: tag } });
        let out = '',
          buf = '';
        const onData = (d) => {
          buf += d;
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const l of lines) {
            out += l + '\n';
            if (l.startsWith('ok  ') || l.startsWith('FAIL') || l.startsWith('     ')) console.log(l);
          }
        };
        ch.stdout.on('data', onData);
        ch.stderr.on('data', onData);
        ch.on('close', (code) => resolve({ tag, code, out: out + buf }));
      }),
  );
  Promise.all(kids).then((res) => {
    const bad = res.filter((r) => r.code !== 0);
    const min = Math.round((Date.now() - t0) / 6000) / 10;
    for (const r of bad) {
      const i = r.out.indexOf('ОШИБКИ:');
      console.log('\n[' + r.tag + '] код ' + r.code + (i >= 0 ? '\n' + r.out.slice(i) : '\n' + r.out.slice(-2000)));
    }
    if (bad.length) process.exit(1);
    console.log('\nВСЁ ХОРОШО (оба размера, ' + min + ' мин)');
  });
};

(async () => {
  if (ONLY_SIZE === 'parallel') return runParallel();
  if (!SIZES.length) {
    console.log('для «' + (ARGS[1] || '') + '» нет размера ' + ONLY_SIZE + ' — шаги только на компьютере');
    return;
  }
  const t0 = Date.now();
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
      if (ONLY_ESTATE && !o.estate && name !== 'новая игра') return;
      if (ONLY_STEP && !name.includes(ONLY_STEP) && name !== 'новая игра') return;
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
      if (errors.length > before && process.env.SMOKE_VERBOSE) console.log('     ' + errors.slice(before).join('\n     '));
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
      await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
      await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
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
        [30, 14],
        [50, 21],
        [73, 14],
        [40, 49],
        [15, 26],
        [40, 36],
        [88, 48],
      ]) {
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), [x, y]);
        await hold('ArrowLeft', 300);
      }
    });
    await step('город: поворот хомячка — вбок повёрнута, вверх-вниз мордочкой прямо (З6)', async () => {
      await ev(() => {
        const d = window.__dev;
        if (d.sceneName !== 'world') d.go('world');
        d.World.debugTeleport(40, 36); // парк: есть место во все стороны
      });
      await wait(300);
      const face = () => ev(() => ({ dir: window.__dev.World.p.dir, vert: !!window.__dev.World.p.vert }));
      await hold('ArrowRight', 300);
      let f = await face();
      if (f.dir !== 1 || f.vert) throw new Error('шаг вправо: ' + JSON.stringify(f));
      await hold('ArrowUp', 300);
      f = await face();
      if (!f.vert) throw new Error('шаг вверх — не прямо: ' + JSON.stringify(f));
      await hold('ArrowLeft', 300);
      f = await face();
      if (f.dir !== -1 || f.vert) throw new Error('шаг влево: ' + JSON.stringify(f));
      // по нажатию (путь): вниз — прямо, вбок — повёрнута
      await ev(() => {
        const W = window.__dev.World;
        W.walkTo(W.p.x, W.p.y + 48 * 3, true);
      });
      await wait(500);
      f = await face();
      if (!f.vert) throw new Error('путь вниз — не прямо: ' + JSON.stringify(f));
      await ev(() => {
        const W = window.__dev.World;
        W.walkTo(W.p.x + 48 * 3, W.p.y, true);
      });
      await wait(500);
      f = await face();
      if (f.dir !== 1 || f.vert) throw new Error('путь вправо: ' + JSON.stringify(f));
      // мордочка заметно сдвинута: глаза у повёрнутой — на 5+ точек в сторону взгляда (в масштабе города)
      const r = await ev(async () => {
        const { drawHamster } = await import(new URL('js/art/hamster.js', location.href).href);
        const look = { fur: '#ffffff', ear: '#ffb3c1', outfit: {}, beauty: { blush: null } };
        const eyeX = (dir) => {
          const c = document.createElement('canvas');
          c.width = c.height = 100;
          const x = c.getContext('2d', { willReadFrequently: true });
          drawHamster(x, 50, 90, 0.78, look, { dir, time: 1, shadow: false });
          const d = x.getImageData(0, 0, 100, 100).data;
          let n = 0,
            sx = 0;
          for (let i = 0; i < d.length; i += 4)
            if (Math.abs(d[i] - 0x1d) < 8 && Math.abs(d[i + 1] - 0x1b) < 8 && Math.abs(d[i + 2] - 0x1b) < 8) {
              n++;
              sx += (i / 4) % 100;
            }
          return sx / (n || 1);
        };
        return [eyeX(-1), eyeX(0), eyeX(1)];
      });
      if (!(r[2] - r[1] >= 5 && r[1] - r[0] >= 5)) throw new Error('поворот мордочки слабый: ' + JSON.stringify(r));
    });
    await step('город: от двери виллы можно дойти до каждой двери, особого места, жителя и выезда', async () => {
      const bad = await ev(() => {
        const W = window.__dev.World,
          m = W.map,
          T = 48,
          out = [];
        const d = m.doorPx(m.bById.villa),
          s = [Math.floor(d.x / T), Math.floor(d.y / T)];
        const reach = (x, y, name) => {
          const tx = Math.floor(x),
            ty = Math.floor(y);
          if (!m.foot(tx, ty)) out.push(name + ': клетка занята (' + tx + ', ' + ty + ')');
          else if (!(tx === s[0] && ty === s[1]) && !m.path(m.foot, s[0], s[1], tx, ty))
            out.push(name + ': нет пути (' + tx + ', ' + ty + ')');
        };
        for (const b of m.buildings) {
          const p = m.doorPx(b);
          reach(p.x / T, p.y / T, 'дверь ' + b.id);
          reach((p.x - 12) / T, p.y / T, 'дверь ' + b.id + ' (слева)'); // у двери помещается хомячок целиком
        }
        for (const pl of W.places) if (pl.stand) reach(pl.stand[0], pl.stand[1], 'место ' + pl.id);
        for (const [id, sp] of Object.entries(W.desc.spots)) reach(sp.at[0], sp.at[1], 'точка ' + id);
        for (const a of W.desc.actors) reach(a.at[0], a.at[1], 'житель ' + a.npc);
        for (const n of W.npcs) if (n.home) reach(n.home[0], n.home[1], 'дом жителя ' + n.id);
        // выезды закрыты: до ворот дойти можно, за ворота — нет (лес закрыт, пока его не откроет задание Мяты: when)
        for (const id of ['forest', 'desert']) {
          const e = W.exit(id);
          if (!e || !(e.off || (e.when && !e.when()))) out.push('выезд ' + id + ' должен быть закрыт');
          else if (m.path(m.foot, s[0], s[1], e.area[0], e.area[1]))
            out.push('выезд ' + id + ': за закрытые ворота можно пройти');
        }
        // предметы заданий раскладываются там, куда можно дойти
        for (const zone of ['town', 'beach'])
          for (const it of W.randomSpots(zone, 8, 7)) reach(it.x, it.y, 'предмет задания (' + zone + ')');
        return out;
      });
      if (bad.length) throw new Error(bad.join('; '));
    });
    await step('город: что растёт и когда плодоносит — кокосы на четырёх пальмах, сбор только в сезон (У3)', async () => {
      await ev(() => window.__dev.go('world'));
      await wait(400);
      await closeAll();
      // шаг меняет день и собирает плоды: в конце возвращаем всё как было, чтобы не мешать следующим шагам
      await ev(() => {
        const s = window.__dev.G.state;
        window.__plantsKeep = JSON.stringify(
          Object.fromEntries(
            ['day', 'minutes', 'weather', 'guests', 'visitor', 'dayFlags', 'ledger', 'garden', 'ing'].map((k) => [k, s[k]]),
          ),
        );
      });
      // день месяца, в котором у продукта сезон (и в котором — нет): по общей таблице сезонов
      const info = await ev(async () => {
        const d = window.__dev,
          W = d.World,
          m = W.map,
          P = d.Plants,
          T = 48,
          out = [];
        const D = await import('/js/data/index.js');
        const plants = m.objs.filter((o) => P.PLANTS[o.type]);
        const n = {};
        for (const o of plants) n[P.PLANTS[o.type].gives] = (n[P.PLANTS[o.type].gives] || 0) + 1;
        // сколько чего растёт: не больше, чем положено по таблице сбора; кокосовых пальм — не больше четырёх
        for (const [id, q] of Object.entries(D.GATHER)) {
          if (!n[id]) out.push('на карте нет растений: ' + id);
          if (n[id] > q.max) out.push(`${id}: на карте ${n[id]}, а положено не больше ${q.max}`);
        }
        if (!(n.coconut >= 3 && n.coconut <= 4)) out.push('кокосовых пальм должно быть 3–4, а их ' + n.coconut);
        // обычная пальма — без плодов и без действия
        if (m.tappable.some((o) => o.type === 'palm')) out.push('обычную пальму можно потрясти');
        if (!(m.objs.filter((o) => o.type === 'palm').length > 20)) out.push('куда-то делись обычные пальмы');
        // в каждом месяце года: плоды есть ровно у тех растений, у чьего продукта сезон, и хоть что-то собрать можно;
        // кокосовых пальм с плодами — не больше четырёх
        const s = d.G.state,
          day0 = s.day,
          flags0 = s.dayFlags;
        s.dayFlags = {};
        const when = {};
        for (let month = 0; month < 12; month++) {
          s.day = month * D.DAYS_PER_MONTH;
          let any = 0;
          for (const o of plants) {
            const id = P.PLANTS[o.type].gives,
              ripe = D.pickIn(id, month); // сезон урожая или, у яблок, сезон сбора
            if (P.hasFruit(o) !== ripe) out.push(`${o.type} (${o.tx}, ${o.ty}): месяц ${month}, плоды не по сезону`);
            if (ripe) {
              any++;
              when[id] = when[id] === undefined ? month : when[id];
            } else if (when['-' + id] === undefined) when['-' + id] = month;
          }
          if (!any) out.push('в месяце ' + month + ' нечего собрать');
          // значки на карте (З9): ровно то, что сейчас в сезоне
          const part = W.desc.parts.find((q) => q.ripeIcons),
            icons = part.ripeIcons().sort().join(''),
            should = [...new Set(plants.filter((o) => D.pickIn(P.PLANTS[o.type].gives, month)).map((o) => D.ING_BY_ID[P.PLANTS[o.type].gives].e))]
              .sort()
              .join('');
          if (icons !== should) out.push(`месяц ${month}: на карте ${icons}, а в сезоне ${should}`);
          if (plants.filter((o) => o.type === 'cocoPalm' && P.hasFruit(o)).length > 4)
            out.push('кокосовых пальм с плодами больше четырёх');
        }
        s.day = day0;
        s.dayFlags = flags0;
        // до каждого растения на суше можно дойти от двери виллы (встать на соседнюю клетку)
        const door = m.doorPx(m.bById.villa),
          from = [Math.floor(door.x / T), Math.floor(door.y / T)];
        const spots = [];
        for (const o of plants) {
          if (o.ty >= 57) continue; // острова: вплавь или на кораблике
          let near = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]])
            if (!near && m.foot(o.tx + dx, o.ty + dy) && m.path(m.foot, from[0], from[1], o.tx + dx, o.ty + dy))
              near = [o.tx + dx, o.ty + dy];
          if (!near) out.push(`${o.type} (${o.tx}, ${o.ty}): не подойти`);
          else if (!spots.some((q) => q.type === o.type)) spots.push({ type: o.type, tx: o.tx, ty: o.ty, near });
        }
        return { out, spots, when, n, give: Object.fromEntries(Object.entries(D.GATHER).map(([id, q]) => [id, q.n])) };
      });
      if (info.out.length) throw new Error(info.out.join('; '));
      if (info.spots.length !== 6) throw new Error('не все виды растений есть на суше: ' + JSON.stringify(info.spots));
      const have = (id) => ev((id) => window.__dev.G.state.ing[id] || 0, id);
      const setDay = (month, flags) =>
        ev(([month, flags]) => {
          const s = window.__dev.G.state;
          s.day = month * 3;
          s.minutes = 12 * 60;
          s.weather = 'sun';
          if (flags) s.dayFlags = {};
        }, [month, flags]);
      const tapPlant = async (sp) => {
        const pt = await ev(
          ([x, y, up]) => window.__dev.World.debugScreen((x + 0.5) * 48, (y + 0.5) * 48 - up),
          [sp.tx, sp.ty, sp.type === 'berryBush' || sp.type === 'mushrooms' ? 2 : 30],
        );
        await page.mouse.click(pt.x, pt.y);
        await wait(1300);
      };
      const btn = () =>
        ev(() => [...document.querySelectorAll('.hud-btns.left .rbtn')].map((e) => e.textContent).join(' | '));
      let way = 0;
      for (const sp of info.spots) {
        const id = await ev((t) => window.__dev.Plants.PLANTS[t].gives, sp.type),
          give = info.give[id],
          name = `${sp.type} (${sp.tx}, ${sp.ty})`;
        // не в сезон: плодов нет, кнопки нет, нажатие ничего не даёт (у дерева — подсказка, когда поспеет)
        await setDay(info.when['-' + id], true);
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), sp.near);
        await wait(350);
        const n0 = await have(id);
        if (/Сорвать|Стрясти|Собрать/.test(await btn())) throw new Error(name + ': не в сезон есть кнопка сбора');
        await ev(() => document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()));
        await tapPlant(sp);
        if ((await have(id)) !== n0) throw new Error(name + ': плод сорван не в сезон');
        const hint = await ev(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
        if (sp.type !== 'mushrooms' && !/(поспеют|поспеет) (в конце лета|зимой|весной|летом|осенью)/.test(hint))
          throw new Error(name + ': не в сезон нет подсказки, когда поспеет: ' + hint);
        if (sp.type === 'mushrooms' && hint) throw new Error(name + ': грибов нет, а нажатие сработало: ' + hint);
        // в сезон: рядом с растением — кнопка; сорвали (нажатием на растение, кнопкой или клавишей E) — в рюкзаке
        await setDay(info.when[id], true);
        await ev(([x, y]) => window.__dev.World.debugTeleport(x, y), sp.near);
        await wait(350);
        const b = await btn();
        if (!/Сорвать|Стрясти|Собрать/.test(b)) throw new Error(name + ': в сезон нет кнопки сбора: ' + b);
        if (way % 3 === 0) await tapPlant(sp);
        else if (way % 3 === 1) {
          await page.click('.hud-btns.left .rbtn.on');
          await wait(900);
        } else {
          await page.keyboard.press('KeyE');
          await wait(900);
        }
        way++;
        const n1 = await have(id);
        if (n1 !== n0 + give) throw new Error(`${name}: в рюкзаке ${n1}, а должно стать ${n0 + give}`);
        if (/Сорвать|Стрясти|Собрать/.test(await btn())) throw new Error(name + ': плоды собраны, а кнопка осталась');
        // второй раз за день с того же растения — ничего; наутро плод вырастает снова
        await tapPlant(sp);
        if ((await have(id)) !== n1) throw new Error(name + ': с одного растения собрано дважды за день');
        const again = await ev(([x, y, month]) => {
          const d = window.__dev,
            o = d.World.map.objs.find((q) => q.tx === x && q.ty === y),
            was = d.Plants.hasFruit(o);
          d.G.state.day = month * 3; // первый день месяца: завтра — тот же месяц
          d.actions.nextDay();
          return { was, now: d.Plants.hasFruit(o) };
        }, [sp.tx, sp.ty, info.when[id]]);
        if (again.was || !again.now) throw new Error(name + ': плод не отрастает наутро: ' + JSON.stringify(again));
      }
      // всё, что собрали, — еда: лежит в рюкзаке, чернику и банан можно съесть, всё продаётся на рынке
      const food = await ev(async () => {
        const d = window.__dev,
          D = await import('/js/data/index.js'),
          s = d.G.state;
        return {
          sell: Object.keys(D.GATHER).filter((id) => !(D.ING_BY_ID[id].sell > 0)),
          stickers: ['x_gather', 'x_gather_all'].filter((q) => !s.stickers.includes(q)),
          clipped: d.World.debugSprites().clipped,
        };
      });
      if (food.sell.length) throw new Error('собранное не продать на рынке: ' + food.sell);
      if (food.stickers.length) throw new Error('нет наклеек за сбор: ' + food.stickers);
      if (food.clipped.length) throw new Error('спрайты не поместились в рамку: ' + food.clipped.join(', '));
      const b0 = await have('blueberry');
      await ev(() => window.__dev.F.openBackpack());
      await wait(300);
      await page.click('.overlay .tabs >> text=Продукты');
      await wait(250);
      await page.click('.overlay .card:has-text("Черника") .btn');
      await wait(300);
      if ((await have('blueberry')) !== b0 - 1) throw new Error('чернику из рюкзака не съесть');
      await closeAll();
      await ev(() => {
        Object.assign(window.__dev.G.state, JSON.parse(window.__plantsKeep));
        window.__dev.emit('guests');
        window.__dev.emit('hud');
      });
      await wait(200);
    });
    await step('город: карта — кнопка «дойти» работает для каждого места', async () => {
      const r = await ev(() => {
        const W = window.__dev.World,
          bad = [],
          names = W.mapPlaces();
        for (const [id, name] of names) {
          W.debugTeleport(16, 10);
          if (!W.walkToPlace(id) || !(W.p.path.length > 0)) bad.push(name);
        }
        W.debugTeleport(16, 10);
        W.p.pending = null;
        return { bad, n: names.length, ids: names.map((q) => q[0]) };
      });
      if (r.bad.length) throw new Error('не дойти: ' + r.bad.join(', '));
      for (const id of [
        'market',
        'realtor',
        'home_apartment',
        'home_bungalow',
        'hotel',
        'forest',
        'desert',
        'pier',
        'beach',
      ])
        if (!r.ids.includes(id)) throw new Error('на карте нет места ' + id);
    });
    await step('город: карта — быстрый переход к месту, где уже была; где не была — пешком (Ф4)', async () => {
      await closeAll();
      const at = () => ev(() => ({ scene: window.__dev.sceneName, fade: !!document.querySelector('.fade') }));
      const fromVillaArea = () =>
        ev(() => {
          const d = window.__dev;
          if (d.sceneName !== 'world') d.go('world');
          d.World.debugTeleport(16, 10);
          d.World.p.pending = null;
          d.actions.mutate((s) => {
            s.visited = {};
          });
        });
      await fromVillaArea();
      await ev(() => window.__dev.F.openMap());
      await wait(400);
      if (await page.locator('.overlay .opt.been').count()) throw new Error('в новой игре на карте есть «уже была» ⚡');
      await page.click('.overlay .opt >> text=Морская звезда');
      await wait(1200);
      let r = await at();
      const walking = await ev(() => window.__dev.World.p.path.length > 0);
      if (r.scene !== 'world' || r.fade || !walking) throw new Error('к месту, где не была, — не пешком: ' + JSON.stringify(r));
      // дошла (пешком) — отель «посещён»
      await ev(() => {
        const W = window.__dev.World,
          d = W.doorOf('hotel');
        W.debugTeleport(Math.floor(d.x / 48), Math.floor(d.y / 48) + 2);
        W.walkToPlace('hotel');
      });
      for (let i = 0; i < 30 && (await at()).scene !== 'hotel'; i++) await wait(200);
      if ((await at()).scene !== 'hotel') throw new Error('не дошла до отеля');
      if (!(await ev(() => window.__dev.G.state.visited.world.hotel))) throw new Error('отель не отмечен «уже была»');
      await closeAll();
      // снова с другого конца города: быстро — затемнение, и уже в отеле
      await ev(() => {
        const d = window.__dev;
        d.go('world');
        d.World.debugTeleport(16, 10);
        d.go('villa');
      });
      await wait(300);
      await ev(() => window.__dev.F.openMap());
      await wait(400);
      const btn = page.locator('.overlay .opt.been');
      if ((await btn.count()) !== 1 || !(await btn.innerText()).includes('⚡')) throw new Error('на кнопке отеля нет ⚡');
      const t0 = Date.now();
      await btn.click();
      await wait(250);
      if (!(await at()).fade) throw new Error('быстрый переход без затемнения');
      for (let i = 0; i < 40 && (await at()).scene !== 'hotel'; i++) await wait(100);
      const sec = (Date.now() - t0) / 1000;
      if ((await at()).scene !== 'hotel' || sec > 3) throw new Error('быстрый переход: ' + sec + ' с, сцена ' + (await at()).scene);
      await closeAll();
      // рядом (меньше 8 клеток) — пешком, даже если уже была
      await ev(() => {
        const d = window.__dev,
          W = d.World,
          door = W.doorOf('hotel');
        d.go('world');
        W.debugTeleport(Math.floor(door.x / 48) - 3, Math.floor(door.y / 48) + 1);
      });
      await ev(() => window.__dev.F.openMap());
      await wait(400);
      await page.click('.overlay .opt.been');
      await wait(250);
      if ((await at()).fade) throw new Error('быстрый переход на короткой дороге');
      await wait(2500);
      await closeAll();
      await ev(() => window.__dev.go('world'));
    });
    await step('город: ночь — слой неба со светом фонарей; в доме и днём без осадков его нет', async () => {
      const sky = () =>
        ev(() => {
          const e = document.querySelector('#sky');
          return { on: !!e && e.style.display !== 'none', w: e ? e.width : 0 };
        });
      await ev(() => {
        const d = window.__dev;
        d.go('world');
        d.G.state.minutes = 22 * 60;
        d.G.state.weather = 'sun';
        d.World.debugTeleport(13, 38);
      });
      await wait(300);
      const night = await sky();
      const lights = await ev(() => window.__dev.World.lights.length);
      if (!night.on || night.w < 50 || night.w > 400) throw new Error('ночью нет слоя неба: ' + JSON.stringify(night));
      if (!(lights >= 10)) throw new Error('ночью нет пятен света от фонарей и окон: ' + lights);
      await ev(() => window.__dev.go('villa'));
      await wait(300);
      if ((await sky()).on) throw new Error('слой неба остался поверх виллы');
      await ev(() => {
        const d = window.__dev;
        d.G.state.minutes = 12 * 60;
        d.G.state.weather = 'snow';
        d.go('world');
      });
      await wait(300);
      if ((await sky()).on) throw new Error('слой неба виден днём в снегопад (ни света, ни облаков быть не должно)');
      await ev(() => {
        window.__dev.G.state.weather = 'sun';
      });
    });
    await step(
      'город: от двери виллы пешком можно дойти до двери каждого здания, у каждого есть действие',
      async () => {
        const r = await ev(async () => {
          const d = window.__dev,
            W = d.World,
            m = W.map,
            T = 48,
            bad = [];
          const { NPC_HOME } = await import('./js/data/index.js');
          const v = m.doorPx(m.bById.villa),
            s = [Math.floor(v.x / T), Math.floor(v.y / T)];
          const acts = new Set(d.listActions().map((a) => a.name));
          for (const b of m.buildings) {
            const p = m.doorPx(b),
              tx = Math.floor(p.x / T),
              ty = Math.floor(p.y / T);
            if (b.id !== 'villa' && !m.path(m.foot, s[0], s[1], tx, ty))
              bad.push(b.id + ': от виллы не дойти до двери');
            const name = !b.act ? '' : typeof b.act === 'string' ? b.act.split(':')[0] : b.act.do;
            if (!name) bad.push(b.id + ': у двери нет действия');
            else if (!acts.has(name)) bad.push(b.id + ': действия «' + name + '» нет в реестре');
            // домик жителя ведёт в дом именно этого жителя
            if (b.npc) {
              if (b.act !== 'home-of:' + b.npc) bad.push(b.id + ': действие ' + JSON.stringify(b.act));
              if (!NPC_HOME[b.npc] || NPC_HOME[b.npc].building !== b.id) bad.push(b.id + ': в NPC_HOME другой домик');
              if (!d.scenes['home_' + b.npc]) bad.push(b.id + ': нет сцены home_' + b.npc);
            }
          }
          const act = (id) => {
            const a = (m.bById[id] || {}).act;
            return typeof a === 'string' ? a : JSON.stringify(a);
          };
          return {
            bad,
            ids: m.buildings.map((b) => b.id),
            acts: ['realtor', 'home_apartment', 'home_bungalow', 'market', 'hotel'].map(act),
          };
        });
        if (r.bad.length) throw new Error(r.bad.join('; '));
        const need = [
          'villa',
          'salon',
          'boutique',
          'mall_fashion',
          'mall_home',
          'fashion',
          'tower',
          'bank',
          'realtor',
          'mall_food',
        ];
        need.push(
          'market',
          'cafe',
          'hospital',
          'school',
          'home_apartment',
          'rest',
          'pool',
          'hotel',
          'beachcafe',
          'home_bungalow',
        );
        for (let i = 0; i < 8; i++) need.push('house' + i);
        for (const id of need) if (!r.ids.includes(id)) throw new Error('в городе нет здания ' + id);
        const want = ['realtor', 'home:flat', 'home:bungalow', 'market', 'scene:hotel'];
        if (r.acts.join() !== want.join()) throw new Error('действия новых зданий: ' + r.acts.join(' | '));
      },
    );
    await step('город: новые места — рынок, агентство, двери жилья, «Морская звезда» и тайные места', async () => {
      const title = () => ev(() => (document.querySelector('.overlay .panel-head .title') || {}).textContent || '');
      await ev(() => window.__dev.enterBuilding('market'));
      await wait(450);
      if (!(await title()).includes('Рынок')) throw new Error('у прилавков рынок не открылся: ' + (await title()));
      await closeAll();
      // агентство и двери некупленного жилья открывают окно риелтора
      for (const id of ['realtor', 'home_apartment', 'home_bungalow']) {
        await ev((id) => window.__dev.enterBuilding(id), id);
        await wait(450);
        if ((await title()) !== 'Недвижимость')
          throw new Error(id + ': окно риелтора не открылось: ' + (await title()));
        if ((await ev(() => window.__dev.sceneName)) !== 'world') throw new Error(id + ': ушли из города');
        await closeAll();
      }
      // курортный отель открыт с начала игры (П.17): дверь ведёт в его сцену, заглушки «Скоро открытие!» больше нет
      {
        await ev(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
        await ev(() => window.__dev.enterBuilding('hotel'));
        await wait(300);
        const t = await ev(() => (document.querySelector('#toasts') || {}).textContent || '');
        if (t.includes('Скоро открытие')) throw new Error('отель: подсказка «Скоро открытие!»: ' + t);
        if ((await ev(() => window.__dev.sceneName)) !== 'hotel') throw new Error('дверь отеля не ведёт в отель');
        await ev(() => window.__dev.go('world'));
        await wait(300);
      }
      // выезды в лес и пустыню — не «скоро», а тайные места: доброе окно «кто знает дорогу»
      for (const [key, who] of [
        ['forest', 'Мята'],
        ['desert', 'Буся'],
      ]) {
        await ev((key) => {
          window.__dev.run('way:' + key);
        }, key);
        await wait(400);
        const t = await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' '));
        if (!t.includes(who) || t.includes('Скоро открытие')) throw new Error(key + ': окно тайного места: ' + t);
        await closeAll();
      }
      // задание «Базарный день» ведёт к рынку на площади
      const tg = await ev(() => {
        const d = window.__dev,
          was = d.G.state.mail;
        d.actions.setMail('market');
        d.F.openMailbox();
        document.querySelectorAll('.overlay .xbtn').forEach((x) => x.click());
        const t = d.World.target(),
          door = d.World.doorOf('market');
        return { t, door, was: !!was };
      });
      await wait(300);
      await closeAll();
      if (!tg.t || Math.abs(tg.t.x - tg.door.x) > 2 || tg.t.icon !== '⭐')
        throw new Error('звёздочка задания «Базарный день» не у рынка: ' + JSON.stringify(tg));
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
    await step('салон: примерка бесплатно, «Сделать за» списывает, без покупки — как было (Ф1)', async () => {
      const st = () => ev(() => ({ money: window.__dev.G.state.money, b: { ...window.__dev.G.state.look.beauty } }));
      await ev(() => {
        const d = window.__dev;
        if (d.G.state.money > 3000) d.actions.spend(d.G.state.money - 3000);
        else d.actions.earn(3000 - d.G.state.money);
        d.actions.setBeauty('tuft', 0);
        d.actions.setBeauty('hair', null);
        d.enterBuilding('salon');
      });
      await wait(400);
      const s0 = await st();
      await page.click('.overlay .opt >> text=Кудряшки');
      await page.click('.overlay .opt >> text=Хвостики');
      await page.click('.overlay .opt >> text=Розовый');
      await wait(200);
      let s = await st();
      if (s.money !== s0.money || s.b.tuft !== 0 || s.b.hair !== null)
        throw new Error('примерка списала монеты или поменяла внешность: ' + JSON.stringify(s));
      if ((await page.locator('.overlay .salon-pay .btn').count()) !== 2) throw new Error('нет двух кнопок «Сделать за»');
      if (!(await page.locator('.overlay .salon-pay .btn').first().innerText()).includes('Сделать за'))
        throw new Error('кнопка без «Сделать за»');
      await page.click('.overlay .salon-pay .btn >> nth=0'); // причёска
      await wait(250);
      s = await st();
      if (s.money !== s0.money - 400 || s.b.tuft !== 4 || s.b.hair !== null)
        throw new Error('«Сделать за» причёску: ' + JSON.stringify(s));
      await closeAll();
      s = await st();
      if (s.b.hair !== null || s.money !== s0.money - 400) throw new Error('закрыла без покупки — цвет изменился: ' + JSON.stringify(s));
      // мало монет: кнопка бледная, нажатие — подсказка, монеты и внешность прежние
      await ev(() => {
        const d = window.__dev;
        d.actions.spend(d.G.state.money - 100);
        d.enterBuilding('salon');
      });
      await wait(400);
      await page.click('.overlay .opt >> text=Ирокез');
      await wait(200);
      if (!(await page.locator('.overlay .salon-pay .btn.ghost').count())) throw new Error('при нехватке кнопка не бледная');
      await page.click('.overlay .salon-pay .btn');
      await wait(250);
      s = await st();
      if (s.money !== 100 || s.b.tuft !== 4) throw new Error('при нехватке что-то списалось: ' + JSON.stringify(s));
      if (!(await ev(() => document.getElementById('toasts').innerText)).includes('не хватает'))
        throw new Error('нет подсказки «не хватает»');
      await closeAll();
      await ev(() => window.__dev.actions.earn(3000));
    });
    await step('подсказки при открытом окне — под его шапкой, заголовок и ✕ видны (Ф2)', async () => {
      const box = () =>
        ev(() => {
          const r = (q) => {
            const e = document.querySelector(q);
            return e && e.getBoundingClientRect().toJSON();
          };
          const ts = [...document.querySelectorAll('#toasts .toast')].filter((t) => getComputedStyle(t).display !== 'none');
          return {
            head: r('.overlay .panel-head'),
            x: r('.overlay .xbtn'),
            shown: ts.length,
            top: ts.length ? Math.min(...ts.map((t) => t.getBoundingClientRect().top)) : null,
          };
        });
      await closeAll();
      await ev(() => window.__dev.ui.toast('Подсказка без окна'));
      await wait(300);
      const free = await box();
      if (free.shown !== 1 || free.top > 120) throw new Error('без окна подсказка не сверху: ' + JSON.stringify(free));
      await ev(() => {
        window.__dev.F.openMailbox();
        window.__dev.ui.toast('Доброе утро! В ящике новое письмо — это длинная подсказка в две строки на телефоне.');
        window.__dev.ui.toast('Вторая подсказка');
        window.__dev.ui.toast('Третья подсказка', 'good');
      });
      await wait(400);
      const b = await box();
      if (!b.head || b.top < b.head.bottom - 1)
        throw new Error('подсказка легла на шапку окна: ' + JSON.stringify(b));
      if (b.shown > 2) throw new Error('при открытом окне больше двух подсказок: ' + b.shown);
      // окно открылось, когда подсказка уже висела — подсказка переезжает под шапку
      await closeAll();
      await ev(() => window.__dev.ui.toast('Подсказка перед окном'));
      await ev(() => window.__dev.F.openBackpack());
      await wait(300);
      const c = await box();
      if (!c.head || c.top < c.head.bottom - 1) throw new Error('подсказка не переехала под шапку: ' + JSON.stringify(c));
      await closeAll();
      await wait(100);
      const d = await box();
      if (d.shown && d.top > 120) throw new Error('окно закрыто, а подсказки не вернулись наверх: ' + JSON.stringify(d));
    });
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
    await step('башня: панорама слоями, без пустых краёв, город как на карте (У1)', async () => {
      await ev(() => {
        const d = window.__dev;
        d.go('tower');
        d.Tower.debugDeck();
      });
      await wait(400);
      for (const x of [60, 2050]) {
        await ev((x) => window.__dev.Tower.debugAt(x), x); // левый и правый конец площадки
        await wait(1500);
        const v = await ev(() => window.__dev.Tower.debugView());
        const L = v.layers,
          atEnd = L.every((l) => l.off === (x < 1000 ? 0 : l.maxOff)),
          covered = L.every((l) => l.h > 0 && l.w >= v.screen + l.maxOff), // картинки слоя хватает до края экрана
          speeds = L.every((l, i) => !i || l.maxOff > L[i - 1].maxOff); // чем ближе слой, тем сильнее едет
        if (L.length < 5 || v.todo || !atEnd || !covered || !speeds)
          throw new Error(`слои панорамы (x = ${x}): ` + JSON.stringify(v.layers));
      }
      const diff = await ev(() => {
        const d = window.__dev,
          t = d.Tower.debugView().town,
          B = d.World.BUILDINGS,
          same = (a, b) => a.id === b.id && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
        return [
          ...B.filter((b) => !t.some((q) => same(q, b))).map((b) => b.id),
          ...t.filter((q) => !B.some((b) => b.id === q.id)).map((q) => 'лишнее: ' + q.id),
        ];
      });
      if (diff.length) throw new Error('вид с башни отстал от карты города (VIEW_TOWN): ' + diff.join(', '));
      await ev(() => {
        window.__dev.go('world');
      });
      await wait(400);
    });
    await step('башня: шарики-мишени есть только в режиме прицела (Б2)', async () => {
      const st = () =>
        ev(() => {
          const s = window.__dev.Tower.debugState();
          return { state: s.state, n: s.balloons.length, live: s.balloons.filter((b) => !b.out).length };
        });
      await ev(() => {
        const d = window.__dev;
        d.go('tower');
        d.Tower.debugDeck();
      });
      await wait(3500); // раньше шарики летели всегда: за это время появлялось два-три
      const idle = await st();
      if (idle.n) throw new Error('шарики вне режима прицела: ' + JSON.stringify(idle));
      await ev(() => window.__dev.Tower.debugAt(1300)); // у столика с самолётиками
      await page.keyboard.press('KeyE');
      await wait(2500);
      const aim = await st();
      if (aim.state !== 'aim' || !aim.live) throw new Error('в режиме прицела нет шариков: ' + JSON.stringify(aim));
      await hold('ArrowLeft', 250); // ушла от столика
      await wait(1300);
      const after = await st();
      if (after.state === 'aim' || after.n) throw new Error('шарики остались после прицела: ' + JSON.stringify(after));
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
      await ev(() => window.__dev.World.debugTeleport(40, 65));
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
      await closeAll();
      await ev(() => {
        if (window.__dev.sceneName !== 'world') window.__dev.go('world');
        window.__dev.World.debugTeleport(63, 60);
      });
      await wait(400);
      const s = await ev(() => window.__dev.World.debugScreen(65.5 * 48, 61.2 * 48));
      await page.mouse.click(s.x, s.y);
      await wait(2200);
      await closeAll();
      if (!(await ev(() => window.__dev.World.isBoating()))) throw new Error('не сели на кораблик');
      // этап 8: нажали на пирс прямо у борта — сразу сошли (раньше путь был пустой, и ничего не происходило)
      const pier = await ev(() => window.__dev.World.debugScreen(64.5 * 48, 61.5 * 48));
      await page.mouse.click(pier.x, pier.y);
      await wait(600);
      if (await ev(() => window.__dev.World.isBoating())) throw new Error('нажатие на пирс у борта не сняло с кораблика');
      const s2 = await ev(() => window.__dev.World.debugScreen(65.5 * 48, 61.2 * 48)); // камера ушла за хомячком
      await page.mouse.click(s2.x, s2.y);
      await wait(2200);
      await closeAll();
      if (!(await ev(() => window.__dev.World.isBoating()))) throw new Error('не сели на кораблик второй раз');
      // этап 9 (Ф3): нажали на мокрый песок у кромки (клетка мелководья h у берега) — подплыть и сойти на берег
      const wet = await ev(() => {
        const W = window.__dev.World;
        return { at: W.map.at(67, 57), s: W.debugScreen(67.5 * 48, 57.25 * 48) };
      });
      if (wet.at !== 'h') throw new Error('у пирса нет мокрого песка (h): ' + wet.at);
      await page.mouse.click(wet.s.x, wet.s.y);
      await wait(3200);
      const off = await ev(() => {
        const W = window.__dev.World;
        return { boat: W.isBoating(), y: W.p.y / 48, c: W.map.at(Math.floor(W.p.x / 48), Math.floor(W.p.y / 48)) };
      });
      if (off.boat || off.c === 'h' || off.c === 'w' || off.y > 57)
        throw new Error('нажатие на мокрый песок не высадило на берег: ' + JSON.stringify(off));
      // нажатие на мелководье подальше от берега — по-прежнему «плыть»: сесть снова и нажать на вторую полосу
      const s3 = await ev(() => {
        const b = window.__dev.G.state.boat;
        return window.__dev.World.debugScreen(b.x, b.y - 10);
      });
      await page.mouse.click(s3.x, s3.y);
      await wait(2200);
      await closeAll();
      if (!(await ev(() => window.__dev.World.isBoating()))) throw new Error('не сели на кораблик у берега');
      const far = await ev(() => window.__dev.World.debugScreen(70.5 * 48, 58.7 * 48));
      await page.mouse.click(far.x, far.y);
      await wait(1500);
      if (!(await ev(() => window.__dev.World.isBoating()))) throw new Error('нажатие на дальнюю полосу мелководья высадило');
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
        d.World.debugTeleport(50, 21);
        // так же, как вошёл бы хомячок через дверь здания с act: 'scene:demo_house'
        d.run('scene:demo_house', { back: { scene: 'world', x: 50.5 * 48, y: 21.5 * 48 } });
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
      if (out.scene !== 'world' || Math.abs(out.x - 50.5 * 48) > 2 || Math.abs(out.y - 21.5 * 48) > 2)
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
        d.actions.inviteGuest('bob', 'demo_flat');
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
    await seasons({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await wares({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await health({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await quests({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await forest({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await mountain({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await caves({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await desert({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await jungle({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await sbeach({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await island({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await hotel({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await inside({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await holidays({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await title({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await audio({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await items({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await nature({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await start({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await worldmap({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await games({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll });
    await estate({ page, step: (n, f, o) => step(n, f, { ...o, extra: true, estate: true }), ev, wait, closeAll });
    if (tag === 'desktop')
      await extra({ page, step: (n, f, o) => step(n, f, { ...o, extra: true }), ev, wait, closeAll, hold });
    await page.close();
  }
  await browser.close();
  if (errors.length) {
    console.log('\nОШИБКИ:\n' + errors.join('\n'));
    process.exit(1);
  }
  const min = Math.round((Date.now() - t0) / 6000) / 10;
  console.log('\nВСЁ ХОРОШО' + (ONLY_SIZE ? ' (' + ONLY_SIZE + ', ' + min + ' мин)' : ' (' + min + ' мин)'));
})();

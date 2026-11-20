// Шаги автотеста про заставку и несколько игр (этап 9а): единственное старое сохранение становится первой игрой,
// вторая игра не трогает первую, «Продолжить» и «Мои игры», удаление только нарочно (⋯ → окно с именем → подержать
// кнопку), предел числа игр, «Выйти на заставку» из меню; живая заставка — время суток и погода последней игры,
// сцена не заходит под кнопки, взаимодействия мышью (хомячок, танец, кокос, краб, чайка, ракушка, рыбка, волна,
// рисунок на песке, облако, кораблик, пальма), самолётик и русалочка (бабочка не перехватывает нажатие), ошибок в
// консоли нет.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:заставка
const fs = require('fs');
const path = require('path');
const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8');

const lib = require('./lib.js');

module.exports = async function title(ctx) {
  const { page, step, ev, wait, closeAll, expect, act, sel, until, untilPanel, untilScene, cont } = lib(ctx);
  const menuReady = () => page.waitForSelector('#title .t-menu button');
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  const onCon = (m) => {
    if (m.type() === 'error') errors.push(m.text());
  };
  page.on('pageerror', onErr);
  page.on('console', onCon);
  const noErrors = () => {
    const e = errors.splice(0);
    expect(!e.length, 'ошибки в консоли', e.slice(0, 3));
  };
  /** Перезагрузить страницу (уходящая страница ничего не записывает поверх подложенного). */
  const reload = async (keep) => {
    if (!keep) await ev(() => (window.__dev.G.state = null));
    await page.reload();
    await menuReady();
  };
  const put = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.clear();
      if (raw) localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await menuReady();
  };
  const store = () =>
    ev(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('rhr-')) o[k] = localStorage.getItem(k);
      }
      return o;
    });
  const index = async () => JSON.parse((await store())['rhr-games'] || '{"games":[]}');
  const names = async () => (await index()).games.map((g) => g.name).sort();
  const saveNow = () => ev(() => window.dispatchEvent(new Event('pagehide')));
  const dbg = () => ev(() => window.__dev.title.debug());
  const sample = (fn) => {
    const s = JSON.parse(SAVE_V5);
    if (fn) fn(s);
    return JSON.stringify(s);
  };

  await step(
    'заставка и игры: единственное старое сохранение становится первой игрой, название «Пушистая жизнь»',
    async () => {
      const raw = sample();
      await put(raw);
      expect((await page.title()).startsWith('Пушистая жизнь'), 'заголовок вкладки', await page.title());
      expect((await page.locator('#title h1').innerText()) === 'Пушистая жизнь', 'название на заставке');
      expect(await page.locator('text=Продолжить').count(), 'нет «Продолжить»');
      const st = await store(),
        idx = await index();
      expect(st['rhr-save-v1'] === raw, 'старое сохранение изменилось при первом запуске');
      expect(idx.games.length === 1 && idx.active === idx.games[0].id, 'в списке не одна игра', idx);
      expect(
        idx.games[0].name === JSON.parse(raw).name && idx.games[0].money === JSON.parse(raw).money,
        'карточка игры',
        idx.games[0],
      );
      await cont();
      const s = await ev(() => ({
        name: window.__dev.G.state.name,
        gid: window.__dev.G.state.gid,
        money: window.__dev.G.state.money,
      }));
      expect(
        s.name === JSON.parse(raw).name && s.money === JSON.parse(raw).money && s.gid === idx.active,
        'игра открылась не та',
        s,
      );
      await closeAll();
      noErrors();
    },
  );

  await step('заставка и игры: вторая игра создаётся рядом, первая цела; «Продолжить» — последняя', async () => {
    const raw = sample();
    await put(raw);
    await act('new');
    await page.fill('#title input', 'Булочка');
    await act('play');
    await act('skip'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
    await act('go');
    await untilScene('villa');
    await closeAll();
    const idx = await index(),
      st = await store();
    expect(idx.games.length === 2, 'игр не две', idx);
    const first = idx.games.find((g) => g.name !== 'Булочка');
    expect(st['rhr-game-' + first.id] === raw, 'первая игра на полке изменилась');
    expect((await ev(() => window.__dev.G.state.name)) === 'Булочка', 'играем не в новую игру');
    expect(
      JSON.parse(st['rhr-save-v1']).gid === idx.active && idx.active !== first.id,
      'живое сохранение не новой игры',
    );
    await ev(() => window.__dev.actions.earn(77, 'gift'));
    await saveNow();
    await reload(true);
    expect((await page.locator('#title .t-menu').innerText()).includes('Булочка'), 'заставка зовёт не последнюю игру');
    await cont();
    const s = await ev(() => ({ name: window.__dev.G.state.name, money: window.__dev.G.state.money }));
    expect(s.name === 'Булочка' && s.money === 3077, '«Продолжить» открыло не последнюю игру', s);
    await closeAll();
    // «Мои игры» → открыть первую: она как была, а новая ложится на полку с последними изменениями
    await saveNow();
    await reload(true);
    await act('games');
    await page.waitForSelector('.g-card');
    expect((await page.locator('.g-card').count()) === 2, 'в «Моих играх» не две карточки');
    const cardText = await page.locator(`.g-card[data-id="${first.id}"]`).innerText();
    expect(cardText.includes(first.name) && /год/.test(cardText) && cardText.includes('🪙'), 'карточка игры', cardText);
    await page.click(`.g-card[data-id="${first.id}"] .g-play`);
    await until(() => !document.querySelector('#title') && window.__dev.G.state, undefined, 'первая игра открылась');
    await wait(100);
    const s2 = await ev(() => ({
      name: window.__dev.G.state.name,
      money: window.__dev.G.state.money,
      day: window.__dev.G.state.day,
    }));
    const orig = JSON.parse(raw);
    expect(
      s2.name === orig.name && s2.money === orig.money && s2.day === orig.day,
      'первая игра открылась с потерями',
      s2,
    );
    const st2 = await store(),
      idx2 = await index();
    expect(idx2.active === first.id, 'активная игра не сменилась', idx2.active);
    expect(
      JSON.parse(st2['rhr-game-' + idx.active]).money === 3077,
      'вторая игра легла на полку без последних изменений',
    );
    await closeAll();
    noErrors();
  });

  await step(
    'заставка и игры: удалить игру можно только нарочно — ⋯, окно с именем, кнопку нужно подержать',
    async () => {
      // две игры: «Ириска» (из образца, в неё играли последней) и «Булочка» — без опоры на прошлые шаги
      await put(sample());
      await ev(() => {
        const g = window.__dev.games,
          first = g.activeGame();
        g.createGame('Булочка');
        g.switchGame(first);
      });
      await reload();
      await act('games');
      await page.waitForSelector('.g-card');
      expect(!(await page.locator('.g-del').count()), 'кнопка удаления видна сразу');
      const idx = await index();
      const victim = idx.games.find((g) => g.name === 'Булочка');
      await page.click(`.g-card[data-id="${victim.id}"] .g-more`);
      await page.click('.g-del');
      await page.waitForSelector('.g-hold');
      const ask = await page.locator('.overlay').last().innerText();
      expect(ask.includes('Булочка') && ask.includes('Нет, оставить'), 'окно подтверждения без имени', ask);
      // короткое нажатие не удаляет
      await page.click('.g-hold');
      await wait(300);
      expect((await index()).games.length === 2, 'игра удалилась от короткого нажатия');
      // «Нет, оставить» — игра цела
      await page.click('text=Нет, оставить');
      await until(() => !document.querySelector('.g-hold'), undefined, { timeout: 2000 }).catch(() => {});
      expect(
        (await index()).games.length === 2 && (await page.locator('.g-card').count()) === 2,
        'игра пропала после «Нет»',
      );
      // подержать — удаляется именно эта игра, вторая цела
      await page.click('.g-del');
      await page.waitForSelector('.g-hold');
      await wait(350); // окно ещё «выезжает» — кнопку держим, когда встала на место
      const box = await page.locator('.g-hold').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await wait(1700);
      await page.mouse.up();
      await until(() => JSON.parse(localStorage.getItem('rhr-games')).games.length === 1, undefined, {
        timeout: 3000,
      }).catch(() => {});
      const idx2 = await index(),
        st = await store();
      expect(idx2.games.length === 1 && idx2.games[0].name !== 'Булочка', 'удалилась не та игра', idx2);
      expect(!st['rhr-game-' + victim.id], 'полка удалённой игры осталась');
      expect(JSON.parse(st['rhr-game-trash']).meta.name === 'Булочка', 'удалённая игра не отложена про запас');
      await closeAll();
      await cont();
      expect((await ev(() => window.__dev.G.state.name)) === idx2.games[0].name, 'оставшаяся игра не открылась');
      await closeAll();
      // удалили активную игру — «Продолжить» ведёт в ту, в которую играли перед ней
      await saveNow();
      await reload(true);
      await ev(() => window.__dev.games.createGame('Плюшка'));
      await reload();
      expect((await page.locator('#title .t-menu').innerText()).includes('Плюшка'), 'новая игра не стала последней');
      await ev(() => window.__dev.games.deleteGame(window.__dev.games.activeGame()));
      await reload();
      expect(
        (await page.locator('#title .t-menu').innerText()).includes(idx2.games[0].name),
        'после удаления активной нет прежней игры',
      );
      noErrors();
    },
  );

  await step(
    'заставка и игры: мест нет — «Новая игра» просит сначала удалить одну; автотест не копит игры',
    async () => {
      await put(sample());
      const max = await ev(() => window.__dev.games.MAX_GAMES);
      expect(max >= 4 && max <= 8, 'предел числа игр', max);
      const made = await ev((max) => {
        const out = [];
        for (let i = 2; i <= max + 1; i++) out.push(window.__dev.games.createGame('Игра ' + i));
        return out;
      }, max);
      expect(
        made.slice(0, max - 1).every((r) => r === null) && made[max - 1] === 'full',
        'создание игр до предела',
        made,
      );
      await reload();
      expect((await index()).games.length === max, 'игр не ровно предел');
      await act('new');
      await untilPanel().catch(() => {});
      const box = await page.locator('.overlay').last().innerText();
      expect(/удали/i.test(box) && box.includes(String(max)), 'нет объяснения, что мест нет', box);
      expect(!(await page.locator('#title input').count()), 'форма новой игры открылась, хотя мест нет');
      await closeAll();
      expect((await names()).includes('Ириска'), 'первая игра пропала', await names());
      // подложенное сохранение без отметки игры (так делают остальные шаги автотеста) не заводит новую игру
      const before = (await index()).games.length;
      await ev(
        (raw) => {
          window.__dev.G.state = null;
          localStorage.setItem('rhr-save-v1', raw);
        },
        sample((s) => (s.name = 'Подложили')),
      );
      await page.reload();
      await menuReady();
      const idx = await index();
      expect(
        idx.games.length === before && idx.games.find((g) => g.id === idx.active).name === 'Подложили',
        'подложенное сохранение завело лишнюю игру',
        idx,
      );
      await put(null);
      expect(
        !(await index()).games.length && (await page.locator('text=Играть!').count()),
        'после очистки не пустая заставка',
      );
      noErrors();
    },
  );

  await step(
    'заставка и игры: живое сохранение пропало — игра достаётся с полки; переключение не теряет игру',
    async () => {
      await put(sample());
      await ev(() => window.__dev.games.createGame('Вторая'));
      const idx = await index();
      const first = idx.games.find((g) => g.name === 'Ириска');
      // живого сохранения нет (стёрли руками): активная игра пропала, зато первая — на полке
      await ev(() => {
        window.__dev.G.state = null;
        localStorage.removeItem('rhr-save-v1');
      });
      await page.reload();
      await menuReady();
      const idx2 = await index();
      expect(idx2.games.length === 1 && idx2.active === first.id, 'игра с полки не стала активной', idx2);
      expect(JSON.parse((await store())['rhr-save-v1']).name === 'Ириска', 'живое сохранение не восстановлено с полки');
      // живое сохранение записано другой игрой из списка (вкладку закрыли посреди переключения): верим отметке gid
      await ev(() => window.__dev.games.createGame('Третья'));
      const idx3 = await index();
      await ev((id) => {
        window.__dev.G.state = null;
        localStorage.setItem('rhr-game-' + window.__dev.games.activeGame(), localStorage.getItem('rhr-save-v1')); // «Третья» уже легла на полку
        localStorage.setItem('rhr-save-v1', localStorage.getItem('rhr-game-' + id));
        const s = JSON.parse(localStorage.getItem('rhr-save-v1'));
        s.gid = id;
        localStorage.setItem('rhr-save-v1', JSON.stringify(s));
      }, first.id);
      await page.reload();
      await menuReady();
      const idx4 = await index();
      expect(
        idx4.active === first.id && idx4.games.length === idx3.games.length,
        'активной стала не та игра, что в живом сохранении',
        idx4,
      );
      expect((await page.locator('#title .t-menu').innerText()).includes('Ириска'), 'заставка зовёт не ту игру');
      await put(null);
      noErrors();
    },
  );

  await step('заставка и игры: в меню игры нет «Начать заново», есть «Выйти на заставку» — игра цела', async () => {
    await put(sample());
    await cont();
    await closeAll();
    await ev(() => window.__dev.actions.earn(5, 'gift'));
    await ev(() => window.__dev.F.openSettings());
    await untilPanel();
    const menu = await page.locator('.overlay').last().innerText();
    expect(!/заново|стереть/i.test(menu), 'в меню остался лёгкий путь стереть игру', menu);
    await page.click('text=Выйти на заставку');
    await menuReady();
    expect(await page.locator('#title').count(), 'заставка не открылась');
    expect((await index()).games.length === 1, 'после выхода игр не одна');
    await cont();
    expect(
      (await ev(() => window.__dev.G.state.money)) === JSON.parse(SAVE_V5).money + 5,
      'после выхода на заставку игра не сохранилась',
    );
    await closeAll();
    noErrors();
  });

  await step('заставка: время суток и погода — как в последней игре; без игр — солнечный летний день', async () => {
    await put(null);
    let d = await dbg();
    expect(d.env.weather === 'sun' && d.env.season === 'summer' && !d.env.night, 'без игр не летний день', d.env);
    for (const [minutes, weather, day, want, more] of [
      [22 * 60 + 30, 'sun', 16, { night: true, rain: false, winter: false }],
      [13 * 60, 'rain', 28, { night: false, rain: true, winter: false }],
      [10 * 60, 'snow', 1, { night: false, snow: true, winter: true }],
      [12 * 60, 'petals', 10, { night: false, windy: true, winter: false }],
      // гроза и метель последней игры («Погода по всему миру»: wxStrong — сильная погода)
      [15 * 60, 'rain', 16, { rain: true, storm: true, hard: true, force: 3 }, { wxStrong: 'rain3' }],
      [11 * 60, 'snow', 1, { snow: true, hard: true, storm: false, force: 2 }, { wxStrong: 'snow2' }],
      [11 * 60, 'rain', 16, { rain: true, hard: false, storm: false, force: 1 }, { wxStrong: 'snow2' }],
    ]) {
      await put(sample((s) => Object.assign(s, { minutes, weather, day, wxStrong: '' }, more)));
      await wait(500);
      d = await dbg();
      expect(d.env.minutes === minutes && d.env.weather === weather, 'сцена не по последней игре', d.env);
      for (const k of Object.keys(want)) expect(d.env[k] === want[k], 'сцена: ' + k, d.env);
      await wait(700);
      const d2 = await dbg();
      expect(
        d2.env.minutes === minutes && d2.env.weather === weather,
        'время или погода на заставке поменялись сами',
        d2.env,
      );
    }
    noErrors();
  });

  await step(
    'заставка: сцена не заходит под заголовок и кнопки, высокая шляпа не упирается в подзаголовок',
    async () => {
      for (const head of ['hat_witch', 'hat_chef', 'tophat', 'hat_santa', 'hat_party']) {
        await put(sample((s) => Object.assign(s.look.outfit, { head })));
        const d = await dbg();
        const r = await ev(() => {
          const q = (s) => {
            const b = document.querySelector(s).getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, b: b.bottom };
          };
          return { sub: q('#title .t-head .sub'), menu: q('#title .t-menu'), w: innerWidth, h: innerHeight };
        });
        expect(d.ham.top > r.sub.b + 4, head + ': шляпа под подзаголовком', { top: d.ham.top, sub: r.sub.b });
        const inMenu = (p) => p.x > r.menu.l && p.x < r.menu.r && p.y > r.menu.t && p.y < r.menu.b;
        for (const k of ['ham', 'palm', 'crab', 'gull', 'shell', 'sea', 'shore', 'sand', 'ship'])
          expect(
            !inMenu(d[k]) && d[k].x > 0 && d[k].x < r.w && d[k].y > 0 && d[k].y < r.h,
            head + ': «' + k + '» под кнопками или за экраном',
            d[k],
          );
        expect(inMenu({ x: (r.menu.l + r.menu.r) / 2, y: (r.menu.t + r.menu.b) / 2 }), 'кнопки вне экрана');
      }
      noErrors();
    },
  );

  await step(
    'заставка: взаимодействия — хомячок, танец, кокос, краб, чайка, ракушка, рыбка, волна, рисунок, облако, кораблик, пальма',
    async () => {
      await put(null);
      await ev(() => window.__dev.title.guests(false)); // самолётик и русалочка — в своём шаге
      await wait(400);
      const has = async (name) => (await dbg()).log.includes(name);
      const tap = async (p) => {
        await page.mouse.click(p.x, p.y);
        await wait(120);
      };
      // бабочка летает над пляжем: нажатие рядом с ней достаётся тому, кто под пальцем, а точно по ней — ей.
      // Перед нажатием ждём, пока она не над целью и не летит садиться на хомячка (тогда она быстрая)
      const away = async (key) => {
        await until(
          (key) => {
            const d = window.__dev.title.debug();
            const R = 30 * Math.max(d.k, 0.7);
            return d.fly.st !== 'go' && Math.hypot(d.fly.x - d[key].x, d.fly.y - d[key].y) > R * 2;
          },
          key,
          { timeout: 15000, msg: 'бабочка улетела от «' + key + '»' },
        );
        return (await dbg())[key];
      };
      let d = await dbg();
      await tap(await away('ham'));
      expect(await has('jump'), 'хомячок не прыгнул');
      await wait(1300);
      d.ham = await away('ham');
      await page.mouse.move(d.ham.x, d.ham.y);
      await page.mouse.down();
      await wait(800);
      expect((await dbg()).ham.st === 'dance', 'долгое нажатие — не танец', (await dbg()).ham.st);
      await page.mouse.up();
      await tap(d.palm);
      d = await dbg();
      expect(
        d.log.includes('coconut') && d.nuts.length === 1 && d.palm.nuts.filter(Boolean).length === 2,
        'кокос не упал',
        d.palm,
      );
      await wait(2600);
      d = await dbg();
      expect(d.nuts[0].y > d.palm.y + 60, 'кокос не долетел до песка', d.nuts[0]);
      await tap(await away('crab'));
      expect(await has('crab'), 'краб не побежал');
      await wait(1500);
      expect((await dbg()).crab.st === 'in', 'краб не спрятался в норку', (await dbg()).crab.st);
      await tap(await away('gull'));
      d = await dbg();
      expect(
        d.log.includes('gull') && d.gull.st === 'away' && d.gull.feathers === 1,
        'чайка не улетела или не уронила пёрышко',
        d.gull,
      );
      await tap(await away('shell'));
      await wait(900);
      d = await dbg();
      expect(d.log.includes('shell') && d.ham.st === 'listen', 'хомячок не слушает ракушку', d.ham.st);
      await tap(d.sea);
      d = await dbg();
      expect(d.log.includes('fish') && d.jumps >= 1, 'рыбка не выпрыгнула', d.jumps);
      // рыбки разные: каждый раз другой вид (клоун, синяя, жёлтая полосатая, стайка, летучая)
      await tap(d.sea);
      d = await dbg();
      const kinds = d.log.filter((x) => /^fish-/.test(x));
      expect(kinds.length >= 2 && kinds.at(-1) !== kinds.at(-2), 'выпрыгнула рыбка того же вида', kinds);
      await tap(d.cloud);
      expect((await dbg()).cloud.shape === 'bunny', 'облако не стало зайчиком', (await dbg()).cloud);
      await tap(d.ship);
      expect(await has('ship'), 'кораблик не загудел');
      // рисунок на песке и волна, которая его смывает
      await wait(2500);
      d = await dbg();
      await page.mouse.move(d.sand.x, d.sand.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(d.sand.x + i * 9, d.sand.y + Math.sin(i) * 8);
      await page.mouse.up();
      const drawn = (await dbg()).drawn;
      expect(drawn >= 5, 'рисунок на песке не остался', drawn);
      await tap(d.shore);
      expect(await has('wave'), 'волна не набежала');
      await wait(1300);
      d = await dbg();
      expect(d.ham.st === 'hop' || d.log.includes('wave'), 'хомячок не отпрыгнул от волны', d.ham.st);
      await wait(9000); // рисунок полежал — приходит волна
      expect((await dbg()).drawn === 0, 'волна не смыла рисунок', (await dbg()).drawn);
      // пальму можно качнуть перетаскиванием
      d = await dbg();
      await page.mouse.move(d.trunk.x, d.trunk.y);
      await page.mouse.down();
      await page.mouse.move(d.trunk.x + 40, d.trunk.y, { steps: 4 });
      const bent = (await dbg()).palm.bend;
      await page.mouse.up();
      expect(bent > 0.1 && (await has('palm-swing')), 'пальма не качнулась', bent);
      // кнопки заставки работают и после игры со сценой
      expect(await page.locator('text=Играть!').count(), 'кнопка «Играть!» пропала');
      noErrors();
    },
  );

  await step(
    'заставка: облака и кораблик плывут каждый своим ходом; ветер гонит облака, а кораблик — нет',
    async () => {
      // скорость за 2 с в пикселях в секунду (облако, которое ушло за край и вернулось слева, не считаем)
      const speeds = async () => {
        const a = await dbg();
        await wait(2000);
        const b = await dbg();
        const v = (x0, x1) => (x1 >= x0 ? (x1 - x0) / 2 : null);
        return { clouds: a.clouds.map((x, i) => v(x, b.clouds[i])), ship: v(a.shipX, b.shipX), k: a.k };
      };
      await put(null);
      const calm = await speeds();
      const cs = calm.clouds.filter((v) => v !== null);
      expect(calm.ship > 0 && cs.length >= 2, 'облака или кораблик стоят', calm);
      expect(Math.min(...cs) > calm.ship * 1.5, 'кораблик плывёт почти как облака', calm);
      expect(Math.max(...cs) > Math.min(...cs) * 1.3, 'все облака плывут одинаково', calm);
      expect(Math.max(...cs) < 16 * calm.k, 'облака несутся слишком быстро', calm);
      await put(sample((s) => Object.assign(s, { weather: 'leaves', minutes: 12 * 60 })));
      const wind = await speeds();
      expect((await dbg()).env.windy, 'нет ветра', (await dbg()).env);
      const ws = wind.clouds.filter((v) => v !== null);
      expect(Math.min(...ws) > Math.max(...cs) * (wind.k / calm.k) * 0.9, 'ветер не гонит облака', { calm, wind });
      expect(Math.abs(wind.ship / wind.k - calm.ship / calm.k) < 0.6, 'ветер гонит кораблик', { calm, wind });
      await put(null);
      noErrors();
    },
  );

  await step(
    'заставка: быстрый росчерк по песку — сплошная линия мышью и пальцем; с воды обрывается, на песке продолжается',
    async () => {
      await put(null);
      await wait(400);
      let d = await dbg();
      const s = d.sand,
        w = d.free.w,
        amp = Math.min(40 * d.k, (s.y - d.shore.y) * 0.45);
      // зигзаг большими шагами: одно событие на шаг, как когда ребёнок дёргает мышку. Начало — там, где на песке
      // никого нет (точка sand)
      const zigFrom = (s) => [s].concat([1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: s.x - w * 0.2 + i * w * 0.04, y: s.y + (i % 2 ? -amp : amp) }))); // prettier-ignore
      let zig = zigFrom(s);
      const last = (st) => (st.ink.length ? st.ink[st.ink.length - 1] : {});
      await page.mouse.move(zig[0].x, zig[0].y);
      await page.mouse.down();
      for (const p of zig.slice(1)) await page.mouse.move(p.x, p.y, { steps: 1 });
      d = await dbg();
      const len = zig.reduce((n, p, i) => n + (i ? Math.hypot(p.x - zig[i - 1].x, p.y - zig[i - 1].y) : 0), 0);
      expect(last(d).pieces === 1 && last(d).gap <= 9, 'быстрый зигзаг мышью порвался', last(d));
      expect(d.drawn > len / 10, 'в быстром зигзаге мало точек', { drawn: d.drawn, len });
      // в море — линия обрывается; обратно на песок — тот же штрих продолжается
      await page.mouse.move(d.sea.x, d.sea.y, { steps: 1 });
      await page.mouse.move(s.x + w * 0.15, s.y, { steps: 1 });
      await page.mouse.move(s.x + w * 0.2, s.y + amp, { steps: 1 });
      await page.mouse.up();
      d = await dbg();
      expect(d.ink.length === 1 && last(d).pieces === 2 && last(d).gap <= 9, 'с воды на песок — не так', d.ink);
      // пальцем: те же быстрые рывки событиями касания
      zig = zigFrom((await dbg()).sand);
      await ev((zig) => {
        const c = document.querySelector('#title .t-scene');
        const o = (p) => ({ pointerId: 5, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true, buttons: 1 }); // prettier-ignore
        c.dispatchEvent(new PointerEvent('pointerdown', o(zig[0])));
        for (const p of zig.slice(1)) c.dispatchEvent(new PointerEvent('pointermove', o(p)));
        c.dispatchEvent(new PointerEvent('pointerup', o(zig[zig.length - 1])));
      }, zig);
      d = await dbg();
      expect(d.ink.length === 2 && last(d).pieces === 1 && last(d).gap <= 9, 'быстрый зигзаг пальцем порвался', d.ink);
      // рисунок полежал — волна смывает и его
      await until(() => window.__dev.title.debug().drawn === 0, null, { timeout: 14000, msg: 'волна смыла рисунок' });
      noErrors();
    },
  );

  await step(
    'заставка: самолётик и русалочка — прилетают и выглядывают, нажатие мышью и пальцем, бабочка не перехватывает',
    async () => {
      // нажать пальцем в точку p, а бабочку (светлячков) поставить рядом — ближе, чем она ловит нажатие «рядом»
      const touchNearFly = (key) =>
        ev((key) => {
          const t = window.__dev.title,
            d = t.debug(),
            p = d[key],
            R = 30 * Math.max(d.k, 0.7);
          t.flyAt(p.x + R * 0.9, p.y);
          const c = document.querySelector('#title .t-scene');
          const o = { pointerId: 9, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true };
          c.dispatchEvent(new PointerEvent('pointerdown', o));
          c.dispatchEvent(new PointerEvent('pointerup', o));
          return t.debug().log;
        }, key);
      const count = (log, re) => log.filter((x) => re.test(x)).length;
      for (const [minutes, night] of [
        [12 * 60, false],
        [22 * 60 + 30, true],
      ]) {
        await put(sample((s) => Object.assign(s, { minutes, weather: 'sun', day: 16 })));
        await ev(() => window.__dev.title.guests(false));
        let d = await dbg();
        expect(d.env.night === night && !d.plane.on && d.mermaid.st === 'off', 'гости уже здесь', d);
        // самолётик: летит по небу над морем, не под заголовком и не под кнопками
        await ev(() => window.__dev.title.callPlane());
        // жмём, когда до пальм не меньше пальца (clear): у самой кроны нажатие заберёт качнувшаяся пальма — она ближе
        await until(
          () => {
            const p = window.__dev.title.debug().plane;
            return p.x > innerWidth * 0.2 && p.x < innerWidth * 0.8 && p.clear;
          },
          null,
          { timeout: 14000, msg: 'самолётик долетел до середины, не у пальмы' },
        );
        d = await dbg();
        const r = await ev(() => {
          const q = (s) => document.querySelector(s).getBoundingClientRect();
          return { head: q('#title .t-head').bottom, menu: q('#title .t-menu').toJSON() };
        });
        const inMenu = (p) => p.x > r.menu.left && p.x < r.menu.right && p.y > r.menu.top && p.y < r.menu.bottom;
        expect(d.plane.on && d.plane.y > r.head && d.plane.y < d.ship.y && !inMenu(d.plane), 'самолётик не там', { plane: d.plane, r, ship: d.ship }); // prettier-ignore
        await page.mouse.click(d.plane.x, d.plane.y);
        await wait(150);
        d = await dbg();
        expect(count(d.log, /^plane-/) === 1 && d.plane.trick && d.plane.hearts === 1, 'самолётик не ответил на нажатие', d.plane); // prettier-ignore
        // трюк закончился — можно снова, пальцем, с бабочкой рядом
        await until(
          () => {
            const p = window.__dev.title.debug().plane;
            return !p.trick && p.clear;
          },
          null,
          { timeout: 9000, msg: 'трюк закончился, самолётик не у пальмы' },
        );
        let log = await touchNearFly('plane');
        expect(count(log, /^plane-/) === 2 && !log.includes('butterfly') && !log.includes('fireflies'), 'нажатие по самолётику забрала бабочка', log); // prettier-ignore
        // русалочка: выглядывает из моря в свободном месте; пока она здесь, дельфин не прыгает
        await ev(() => {
          window.__dev.title.callMermaid();
          window.__dev.title.callDolphin();
        });
        await wait(600);
        d = await dbg();
        expect(d.mermaid.st === 'look' && d.mermaid.y < d.mermaid.water && d.mermaid.y > d.ship.y && !inMenu(d.mermaid), 'русалочка не там', d.mermaid); // prettier-ignore
        expect(!d.dolphin.on, 'дельфин прыгает вместе с русалочкой');
        log = await touchNearFly('mermaid');
        expect(log.includes('mermaid') && !log.includes('butterfly') && !log.includes('fireflies'), 'нажатие по русалочке забрала бабочка', log); // prettier-ignore
        expect((await dbg()).mermaid.st === 'wave', 'русалочка не машет в ответ', (await dbg()).mermaid);
        await until(() => window.__dev.title.debug().mermaid.st === 'off', null, { timeout: 6000, msg: 'русалочка нырнула' }); // prettier-ignore
        await page.mouse.click(d.mermaid.x, d.mermaid.y); // под водой её уже нет: нажатие — рыбке
        await wait(100);
        expect(count((await dbg()).log, /^mermaid$/) === 1, 'нажатие по нырнувшей русалочке', (await dbg()).log);
      }
      await put(null);
      noErrors();
    },
  );

  await step('заставка: вдали остров с вулканом и маяк — нажатие: дымок «пых» и луч маяка по морю', async () => {
    for (const minutes of [12 * 60, 22 * 60 + 30]) {
      await put(sample((s) => Object.assign(s, { minutes, weather: 'sun', day: 16 })));
      await ev(() => window.__dev.title.guests(false));
      const r = await ev(() => {
        const q = (s) => document.querySelector(s).getBoundingClientRect();
        return { head: q('#title .t-head').bottom, menu: q('#title .t-menu').toJSON() };
      });
      const inMenu = (p) => p.x > r.menu.left && p.x < r.menu.right && p.y > r.menu.top && p.y < r.menu.bottom;
      for (const [key, name, flag] of [
        ['tower', 'lighthouse', 'beam'],
        ['isle', 'volcano', 'puff'],
      ]) {
        // корабли ближе и забрали бы нажатие — убираем их; облако ставим прямо за целью: облака проплывают позади
        // острова и маяка и нажатие у них не забирают (раньше облако закрывало маяк ~25 с)
        await ev(() => window.__dev.title.clearHorizon());
        let d = await dbg();
        await ev((p) => window.__dev.title.cloudAt(1, p.x - 6, p.y - 4), d[key]);
        await wait(50);
        d = await dbg();
        expect(d[key].clear, key + ': закрыт кораблём', d);
        // не за кроной пальмы (на телефоне остров был наполовину за левой кроной)
        expect(!d[key].palm, key + ': за пальмой', d[key]);
        expect(d[key].y > r.head && !inMenu(d[key]) && d[key].y < d.sea.y, key + ': не на горизонте', d[key]);
        await page.mouse.click(d[key].x, d[key].y);
        await wait(150);
        const d2 = await dbg();
        expect(d2.log.includes(name) && d2[key][flag], key + ': нажатие не сработало', {
          log: d2.log,
          [key]: d2[key],
        });
        expect(!d2.log.some((x) => x.startsWith('cloud-')), key + ': нажатие забрало облако', d2.log);
        // вулкан дымит заметно и долго: клубы ещё идут через 3 с
        if (key === 'isle' && minutes === 12 * 60) {
          await wait(3000);
          expect((await dbg()).isle.smoke, 'вулкан перестал дымить слишком быстро', (await dbg()).isle);
        }
      }
    }
    noErrors();
  });

  await step(
    'заставка: корабли — лайнер, рыбаки, яхта, кораблик; у каждого свой гудок, три нажатия — флажки; батискаф',
    async () => {
      await put(null);
      await ev(() => window.__dev.title.guests(false));
      let d = await dbg();
      expect(d.fleet.length >= 1 && d.fleet.length <= 2, 'кораблей на экране не 1–2', d.fleet);
      for (const type of ['liner', 'boat', 'trawler', 'yacht']) {
        await ev((t) => window.__dev.title.callShip(t), type);
        await wait(100);
        d = await dbg();
        const sh = d.fleet.find((s) => s.type === type);
        expect(sh && d.fleet.length <= 2, type + ': корабля нет или их больше двух', d.fleet);
        await page.mouse.click(sh.x, sh.y);
        await wait(80);
        expect((await dbg()).log.includes('ship-' + type), type + ': не загудел', (await dbg()).log.slice(-4));
        // ещё два быстрых нажатия (всего три подряд) — сигнальные флажки
        for (let i = 0; i < 2; i++) {
          const p = (await dbg()).fleet.find((s) => s.type === type);
          await page.mouse.click(p.x, p.y);
          await wait(60);
        }
        d = await dbg();
        expect(d.fleet.find((s) => s.type === type).flags && d.log.includes('ship-flags'), type + ': флажков нет', d.log.slice(-6)); // prettier-ignore
      }
      const flags = (await dbg()).log.filter((x) => x === 'ship-flags').length;
      expect(flags === 4, 'флажки поднялись не у всех', flags);
      // батискаф: всплывает, нажатие — «буль-буль», погружается; ближняя полоса в это время свободна
      await ev(() => window.__dev.title.callSub());
      await until(() => window.__dev.title.debug().sub.up > 0.6, null, { timeout: 5000, msg: 'батискаф всплыл' });
      d = await dbg();
      expect(!d.fleet.some((s) => s.lane === 'near'), 'батискаф и корабль на одной полосе', d.fleet);
      // бабочку — подальше: нажатие точно по ней забирает она, а летает она где придётся
      await ev((p) => window.__dev.title.flyAt(p.x > innerWidth / 2 ? 20 : innerWidth - 20, p.y + 120), d.sub);
      d = await dbg();
      await page.mouse.click(d.sub.x, d.sub.y); // всплывает не за пальмой (subGo) — нажатие не достанется её стволу
      await wait(100);
      expect((await dbg()).log.includes('sub'), 'батискаф не ответил', { log: (await dbg()).log.slice(-3), sub: d.sub, trunk: d.trunk, palm: d.palm }); // prettier-ignore
      await until(() => !window.__dev.title.debug().sub.on, null, { timeout: 6000, msg: 'батискаф погрузился' });
      // кадры кораблей и батискафа — в общем учёте памяти кэшей картинок (core/pixcache.js)
      const px = await ev(() => window.__dev.pix());
      expect(px.title > 0 && px.total >= px.title, 'кадры заставки не в общем учёте памяти', px);
      noErrors();
    },
  );

  await step(
    'заставка: волна выносит морскую звезду (щекотно — уползает к воде); черепашка прячется в панцирь и ползёт дальше',
    async () => {
      await put(null);
      await ev(() => window.__dev.title.guests(false));
      await ev(() => window.__dev.title.callStarfish());
      await until(() => window.__dev.title.debug().starfish.shown, null, { timeout: 6000, msg: 'звезду вынесло на песок' }); // prettier-ignore
      let d = await dbg();
      expect(d.log.length === 0 || !d.log.includes('starfish'), 'звезда уже потрогана');
      // волна выносит её не к чайке: чайка стоит на песке на той же высоте и забрала бы нажатие (так шаг однажды упал)
      const R = 30 * Math.max(d.k, 0.7);
      expect(Math.abs(d.starfish.x - d.gull.x) > R * 2.2, 'звезда рядом с чайкой', {
        starfish: d.starfish,
        gull: d.gull,
      });
      // пальцем, бабочка рядом — нажатие всё равно звезде
      const touch = (key) =>
        ev((key) => {
          const t = window.__dev.title,
            p = t.debug()[key],
            R = 30 * Math.max(t.debug().k, 0.7);
          t.flyAt(p.x + R * 0.9, p.y);
          const c = document.querySelector('#title .t-scene');
          const o = { pointerId: 11, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true };
          c.dispatchEvent(new PointerEvent('pointerdown', o));
          c.dispatchEvent(new PointerEvent('pointerup', o));
          return t.debug().log;
        }, key);
      let log = await touch('starfish');
      expect(log.includes('starfish') && !log.includes('butterfly'), 'звезда не ответила на касание', log);
      await until(() => window.__dev.title.debug().starfish.st === 'off', null, { timeout: 15000, msg: 'звезда уползла в море' }); // prettier-ignore
      // черепашка
      await ev(() => window.__dev.title.callTurtle());
      await wait(200);
      d = await dbg();
      expect(d.turtle.st === 'walk' && d.turtle.in, 'черепашки нет на песке', d.turtle);
      await page.mouse.click(d.turtle.x, d.turtle.y);
      await wait(100);
      d = await dbg();
      expect(d.log.includes('turtle') && d.turtle.st === 'hide', 'черепашка не спряталась', d.turtle);
      await until(() => window.__dev.title.debug().turtle.st === 'walk', null, { timeout: 5000, msg: 'черепашка ползёт дальше' }); // prettier-ignore
      const x0 = (await dbg()).turtle;
      await wait(1000);
      const x1 = (await dbg()).turtle;
      expect(Math.hypot(x1.x - x0.x, x1.y - x0.y) > 3, 'черепашка стоит', { x0, x1 });
      noErrors();
    },
  );

  await step(
    'заставка: хомячок сам по себе — лепит куличик (до волны), дремлет; нажатие будит; в дождь — лапками, зимой — снежок',
    async () => {
      await put(null);
      await ev(() => window.__dev.title.guests(false));
      let d = await dbg();
      expect(d.ham.st === 'idle' && !d.ham.act, 'хомячок уже занят', d.ham);
      await ev(() => window.__dev.title.idleNow('castle'));
      d = await dbg();
      expect(d.ham.st === 'busy' && d.ham.act === 'castle' && d.log.includes('busy-castle'), 'не лепит куличик', d.ham);
      await until(() => window.__dev.title.debug().ham.st === 'idle', null, { timeout: 6000, msg: 'куличик готов' });
      expect((await dbg()).ham.castles === 1, 'куличика нет на песке', (await dbg()).ham);
      d = await dbg(); // свежая точка: бабочка за это время улетела в другое место и могла оказаться над старой
      await page.mouse.click(d.shore.x, d.shore.y); // волна смывает куличик
      await until(() => window.__dev.title.debug().ham.castles === 0, null, { timeout: 4000, msg: 'волна смыла куличик' }); // prettier-ignore
      // дремлет; любое нажатие (по небу) — просыпается
      await wait(3500);
      await ev(() => window.__dev.title.idleNow('doze'));
      expect((await dbg()).ham.act === 'doze', 'не дремлет', (await dbg()).ham);
      await page.mouse.click(d.sky.x, d.sky.y);
      await wait(100);
      d = await dbg();
      expect(d.ham.st === 'idle' && d.log.includes('wake'), 'не проснулся', { ham: d.ham, log: d.log.slice(-3) });
      // в дождь — только перебирает лапками под зонтиком; зимой — снежок, не куличик
      await put(sample((s) => Object.assign(s, { minutes: 12 * 60, weather: 'rain', day: 16 })));
      for (let i = 0; i < 3; i++) await ev(() => window.__dev.title.idleNow());
      d = await dbg();
      expect(d.ham.act === 'paws' && !d.log.some((x) => /busy-(doze|castle|sea)/.test(x)), 'в дождь не так', d.log);
      await put(sample((s) => Object.assign(s, { minutes: 12 * 60, weather: 'snow', day: 1 })));
      for (let i = 0; i < 4; i++) await ev(() => window.__dev.title.idleNow());
      d = await dbg();
      expect(d.env.winter && !d.log.includes('busy-castle'), 'зимой лепит куличик', d.log);
      await ev(() => window.__dev.title.idleNow('snowball'));
      expect((await dbg()).ham.act === 'snowball', 'зимой не лепит снежок', (await dbg()).ham);
      await put(null);
      noErrors();
    },
  );

  await step('заставка: ночью — одна падающая звезда за запуск; касание пальцем работает как мышь', async () => {
    await put(sample((s) => Object.assign(s, { minutes: 22 * 60 + 30, weather: 'sun', day: 16 })));
    await wait(400);
    let d = await dbg();
    expect(!d.star, 'звезда уже была');
    await page.mouse.click(d.sky.x, d.sky.y);
    await wait(200);
    d = await dbg();
    expect(d.star && d.log.filter((x) => x === 'star').length === 1, 'звезда не упала', d.log);
    await wait(4200);
    await page.mouse.click(d.sky.x, d.sky.y);
    await wait(200);
    expect((await dbg()).log.filter((x) => x === 'star').length === 1, 'вторая звезда за запуск');
    // касание: те же события указателя, что и у мыши. Светлячки кружат прямо над хомячком — касание всё равно
    // ему (рой из огоньков не забирает нажатие у того, кто под пальцем), а над морем — светлячкам
    const touch = (p, id) =>
      ev(
        ([p, id]) => {
          window.__dev.title.flyAt(p.x, p.y);
          const c = document.querySelector('#title .t-scene');
          const o = { pointerId: id, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true };
          c.dispatchEvent(new PointerEvent('pointerdown', o));
          c.dispatchEvent(new PointerEvent('pointerup', o));
        },
        [p, id],
      );
    d = await dbg();
    await touch(d.ham, 7);
    await wait(200);
    d = await dbg();
    expect(
      (d.log.includes('yawn') || d.log.includes('jump')) && !d.log.includes('fireflies'),
      'касание хомячка не сработало',
      d.log,
    );
    await touch(d.sea, 8);
    await wait(100);
    d = await dbg();
    expect(d.log.includes('fireflies') && !d.log.includes('fish'), 'светлячки над морем не ответили', d.log);
    await put(null);
    noErrors();
  });

  page.off('pageerror', onErr);
  page.off('console', onCon);
};

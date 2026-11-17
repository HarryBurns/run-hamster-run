// Шаги автотеста про заставку и несколько игр (этап 9а): единственное старое сохранение становится первой игрой,
// вторая игра не трогает первую, «Продолжить» и «Мои игры», удаление только нарочно (⋯ → окно с именем → подержать
// кнопку), предел числа игр, «Выйти на заставку» из меню; живая заставка — время суток и погода последней игры,
// сцена не заходит под кнопки, взаимодействия мышью (хомячок, танец, кокос, краб, чайка, ракушка, рыбка, волна,
// рисунок на песке, облако, кораблик, пальма), ошибок в консоли нет.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:заставка
const fs = require('fs');
const path = require('path');
const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8');

module.exports = async function title({ page, step, ev, wait, closeAll }) {
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
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
    await wait(500);
  };
  const put = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.clear();
      if (raw) localStorage.setItem('rhr-save-v1', raw);
    }, raw);
    await page.reload();
    await wait(500);
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
      await page.click('text=Продолжить');
      await wait(600);
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
    await page.click('text=Новая игра');
    await wait(300);
    await page.fill('#title input', 'Булочка');
    await page.click('text=Играть!');
    await wait(400);
    await page.click('text=Поехали!');
    await wait(400);
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
    await page.click('text=Продолжить');
    await wait(600);
    const s = await ev(() => ({ name: window.__dev.G.state.name, money: window.__dev.G.state.money }));
    expect(s.name === 'Булочка' && s.money === 3077, '«Продолжить» открыло не последнюю игру', s);
    await closeAll();
    // «Мои игры» → открыть первую: она как была, а новая ложится на полку с последними изменениями
    await saveNow();
    await reload(true);
    await page.click('text=Мои игры');
    await wait(350);
    expect((await page.locator('.g-card').count()) === 2, 'в «Моих играх» не две карточки');
    const cardText = await page.locator(`.g-card[data-id="${first.id}"]`).innerText();
    expect(cardText.includes(first.name) && /год/.test(cardText) && cardText.includes('🪙'), 'карточка игры', cardText);
    await page.click(`.g-card[data-id="${first.id}"] .g-play`);
    await wait(700);
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
      await saveNow();
      await reload(true);
      await page.click('text=Мои игры');
      await wait(350);
      expect(!(await page.locator('.g-del').count()), 'кнопка удаления видна сразу');
      const idx = await index();
      const victim = idx.games.find((g) => g.name === 'Булочка');
      await page.click(`.g-card[data-id="${victim.id}"] .g-more`);
      await wait(200);
      await page.click('.g-del');
      await wait(350);
      const ask = await page.locator('.overlay').last().innerText();
      expect(ask.includes('Булочка') && ask.includes('Нет, оставить'), 'окно подтверждения без имени', ask);
      // короткое нажатие не удаляет
      await page.click('.g-hold');
      await wait(300);
      expect((await index()).games.length === 2, 'игра удалилась от короткого нажатия');
      // «Нет, оставить» — игра цела
      await page.click('text=Нет, оставить');
      await wait(300);
      expect(
        (await index()).games.length === 2 && (await page.locator('.g-card').count()) === 2,
        'игра пропала после «Нет»',
      );
      // подержать — удаляется именно эта игра, вторая цела
      await page.click('.g-del');
      await wait(350);
      const box = await page.locator('.g-hold').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await wait(1700);
      await page.mouse.up();
      await wait(400);
      const idx2 = await index(),
        st = await store();
      expect(idx2.games.length === 1 && idx2.games[0].name !== 'Булочка', 'удалилась не та игра', idx2);
      expect(!st['rhr-game-' + victim.id], 'полка удалённой игры осталась');
      expect(JSON.parse(st['rhr-game-trash']).meta.name === 'Булочка', 'удалённая игра не отложена про запас');
      await closeAll();
      await page.click('text=Продолжить');
      await wait(600);
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
      await page.click('text=Новая игра');
      await wait(350);
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
      await wait(500);
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
      await wait(500);
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
      await wait(500);
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
    await page.click('text=Продолжить');
    await wait(600);
    await closeAll();
    await ev(() => window.__dev.actions.earn(5, 'gift'));
    await ev(() => window.__dev.F.openSettings());
    await wait(350);
    const menu = await page.locator('.overlay').last().innerText();
    expect(!/заново|стереть/i.test(menu), 'в меню остался лёгкий путь стереть игру', menu);
    await page.click('text=Выйти на заставку');
    await wait(900);
    expect(await page.locator('#title').count(), 'заставка не открылась');
    expect((await index()).games.length === 1, 'после выхода игр не одна');
    await page.click('text=Продолжить');
    await wait(600);
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
    for (const [minutes, weather, day, want] of [
      [22 * 60 + 30, 'sun', 16, { night: true, rain: false, winter: false }],
      [13 * 60, 'rain', 28, { night: false, rain: true, winter: false }],
      [10 * 60, 'snow', 1, { night: false, snow: true, winter: true }],
      [12 * 60, 'petals', 10, { night: false, windy: true, winter: false }],
    ]) {
      await put(sample((s) => Object.assign(s, { minutes, weather, day })));
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
      await wait(400);
      const has = async (name) => (await dbg()).log.includes(name);
      const tap = async (p) => {
        await page.mouse.click(p.x, p.y);
        await wait(120);
      };
      let d = await dbg();
      await tap(d.ham);
      expect(await has('jump'), 'хомячок не прыгнул');
      await wait(1300);
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
      await tap(d.crab);
      expect(await has('crab'), 'краб не побежал');
      await wait(1500);
      expect((await dbg()).crab.st === 'in', 'краб не спрятался в норку', (await dbg()).crab.st);
      await tap(d.gull);
      d = await dbg();
      expect(
        d.log.includes('gull') && d.gull.st === 'away' && d.gull.feathers === 1,
        'чайка не улетела или не уронила пёрышко',
        d.gull,
      );
      await tap(d.shell);
      await wait(900);
      d = await dbg();
      expect(d.log.includes('shell') && d.ham.st === 'listen', 'хомячок не слушает ракушку', d.ham.st);
      await tap(d.sea);
      d = await dbg();
      expect(d.log.includes('fish') && d.jumps >= 1, 'рыбка не выпрыгнула', d.jumps);
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
    // касание: те же события указателя, что и у мыши
    d = await dbg();
    await ev((p) => {
      const c = document.querySelector('#title .t-scene');
      const o = { pointerId: 7, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    }, d.ham);
    await wait(200);
    d = await dbg();
    expect(d.log.includes('yawn') || d.log.includes('jump'), 'касание хомячка не сработало', d.log);
    await put(null);
    noErrors();
  });

  page.off('pageerror', onErr);
  page.off('console', onCon);
};

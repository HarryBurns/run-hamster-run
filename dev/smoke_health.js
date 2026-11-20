// Шаги автотеста про болезнь (Ф1): заболеть при смене дня по причине, эффекты (медленнее, не работает, не купается
// и не ныряет, тёплый чай), лечение у доктора (за монеты и бесплатно), выздоровление само, иммунитет, первые дни
// новой игры, перезагрузка не меняет решение, перенос сохранения v3 → v4. Подключается из dev/smoke.js.
// Только эти шаги:  node dev/smoke.js <url> step:болезнь
const fs = require('fs');
const path = require('path');
const SAVE_V3 = fs.readFileSync(path.join(__dirname, 'saves', 'v3.json'), 'utf8'); // до болезни (этап 4)
const SAVE_V4 = fs.readFileSync(path.join(__dirname, 'saves', 'v4.json'), 'utf8'); // простуженная Ириска (Ф1)

const lib = require('./lib.js');

module.exports = async function health(ctx) {
  const L = lib(ctx);
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    until,
    untilScene,
    untilPanel,
    frames,
    go,
    T,
    expect,
    state,
    dialogText,
    panelText,
    toasts,
    clearToasts,
    scene,
    tap,
    mgClose,
  } = L;
  const dialogBtns = () => ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent));
  /** Войти в здание города; ждём отклика (диалог, окно, сцена), но не дольше 500 мс. */
  const enter = (id) => L.enter(id, 500);
  /**
   * Новая игра с чистого листа. Шаги про болезнь написаны для игры, которая началась 1 января (холод, ледяное море,
   * первые дни 0–2): january — перевести календарь на 1 января, как у игр до этапа 10 (новая игра начинается 1 июня).
   */
  const fresh = (january = true) =>
    L.fresh(january ? { set: 's.day = 0; s.startDay = 0; s.immuneUntil = 3; s.weather = "snow";' } : {});
  /** Подложить сохранение и открыть его («Продолжить»). */
  const openSave = async (raw) => {
    await L.putSave(raw);
    await L.cont();
  };
  /** День, отметки дня (неосторожности), деньги — разом. */
  const setDay = (day, careless = null, money = null) =>
    ev(
      ([day, careless, money]) =>
        window.__dev.actions.mutate((s) => {
          s.day = day;
          s.dayFlags = careless ? { careless } : {};
          s.minutes = 20 * 60;
          if (money !== null) s.money = money;
        }),
      [day, careless, money],
    );
  /** Лечь спать по-настоящему (кровать → вопрос → ночь → утро) на вилле. */
  const sleep = () => L.sleep({ keep: true }); // утренние окна не закрывать: их проверяют
  /** Какой день (≥ from) с такими неосторожностями заболеет ночью, а без них — нет. */
  const findDay = (careless, from = 3) =>
    ev(
      async ([careless, from]) => {
        const D = await import('./js/data/index.js');
        const s = window.__dev.G.state;
        for (let d = from; d < from + 200; d++) {
          const q = (c) => D.nightHealth({ day: d + 1, sick: null, immuneUntil: 0, careless: c, key: s.name });
          if (q(careless).fall && !q({}).fall) return d;
        }
        return -1;
      },
      [careless, from],
    );
  const ALL = { cold: 1, sea: 1, rain: 1 };

  await step('болезнь: в первые 3 дня новой игры не болеет', async () => {
    await fresh(false); // как у игрока: игра началась 1 июня (день 15)
    const s = await state();
    expect(s.v === 5 && s.sick === null && s.day === 15 && s.immuneUntil === 18, 'новая игра', [
      s.v,
      s.sick,
      s.day,
      s.immuneUntil,
    ]);
    // со всеми неосторожностями в ночи на 1-й и 2-й день — ничего; по-настоящему спим две ночи
    for (const d of [15, 16]) {
      await setDay(d, ALL);
      expect(JSON.stringify(await ev(() => window.__dev.F.planNight())) === '{}', `ночь на день ${d - 14}`);
    }
    await setDay(15, ALL);
    await sleep();
    await closeAll();
    await ev(() => window.__dev.actions.mutate((s) => (s.dayFlags.careless = { cold: 1, sea: 1, rain: 1 })));
    await sleep();
    await closeAll();
    const s2 = await state();
    expect(s2.day === 17 && !s2.sick, 'заболела в первые дни', [s2.day, s2.sick]);
    // а с третьего дня — уже может: шанс со всеми неосторожностями почти половина
    const p = await ev(async () => {
      const D = await import('./js/data/index.js');
      return D.sickChance({ cold: 1, sea: 1, rain: 1 });
    });
    expect(p > 0.4 && p < 0.5, 'шанс со всеми неосторожностями', p);
  });

  await step('болезнь: неосторожность днём — подсказка, отметка; ледяное море', async () => {
    await fresh();
    // февраль, гуляем по городу без тёплых вещей: сначала подсказка, потом — неосторожность «холод»
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.day = 4;
        s.dayFlags = {};
        s.minutes = 10 * 60;
        s.weather = 'sun';
      });
      for (const slot of ['head', 'body', 'acc']) d.actions.wear(slot, null);
      d.actions.wear('body', 'tee_white');
      d.go('world');
    });
    await clearToasts();
    await untilScene('world');
    await L.ff(14.5); // 20 игровых минут = 12 с — промотать время игры
    await frames(2);
    expect(/холодно/.test(await toasts()), 'нет подсказки про холод', await toasts());
    await L.ff(24.5); // ещё 40 минут — неосторожность
    let s = await state();
    expect(s.dayFlags.careless && s.dayFlags.careless.cold === 1, 'холод не отмечен', s.dayFlags);
    // тёплая шапка — и на холоде уже не считается (новый день)
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => (s.dayFlags = {}));
      d.actions.wear('head', 'beanie_red');
    });
    await L.ff(4);
    s = await state();
    expect(!s.dayFlags.careless && !(s.dayFlags.warn || {}).cold, 'в шапке холод всё равно считается', s.dayFlags);
    // купание в море зимой — неосторожность сразу (с подсказкой), летом — нет
    await clearToasts();
    await ev(() => window.__dev.emit('swim', { where: 'sea' }));
    await frames(2);
    s = await state();
    expect(s.dayFlags.careless.sea === 1 && /ледяная/.test(await toasts()), 'ледяное море', s.dayFlags);
    await ev(() => {
      window.__dev.actions.mutate((s) => {
        s.day = 20;
        s.dayFlags = {};
      });
      window.__dev.emit('swim', { where: 'sea' });
      window.__dev.emit('dive');
    });
    expect(!(await state()).dayFlags.careless, 'летом море считается неосторожностью');
    // дождь без куртки: подсказка и отметка; в дождевике — нет
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.day = 27; // октябрь
        s.dayFlags = {};
        s.weather = 'rain';
      });
      d.actions.wear('head', null);
    });
    await clearToasts();
    await L.ff(14.5);
    await frames(2);
    expect(/дожд/.test(await toasts()), 'нет подсказки про дождь', await toasts());
    await ev(() => window.__dev.actions.wear('body', 'ja_yellow'));
    await L.ff(25);
    s = await state();
    expect(!s.dayFlags.careless, 'в дождевике дождь считается', s.dayFlags);
    await ev(() => window.__dev.go('villa'));
  });

  await step('болезнь: заболела при смене дня по причине; перезагрузка не меняет решение', async () => {
    await fresh();
    const d = await findDay({ cold: 1 });
    expect(d >= 3, 'не нашлось дня', d);
    // тот же день без неосторожности — здорова
    await setDay(d, null);
    // сохранить сейчас: игра пишет сохранение не на каждое действие, а в localStorage мог остаться ещё июнь
    // новой игры (без перевода на январь, иммунитет до 18-го дня) — тогда ночью «не простыла»
    const before = await ev(() => {
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('rhr-save-v1');
    });
    await sleep();
    await closeAll();
    expect(!(await state()).sick, 'заболела без причины');
    // тот же день, но гуляла на морозе без тёплых вещей — простыла; состояние меняют только действия
    await openSave(before);
    await setDay(d, { cold: 1 });
    const saved = await ev(() => {
      window.__dev.actions.touchState();
      window.__dev.G.state.dayFlags.careless; // прочитать — можно
      return JSON.stringify(window.__dev.G.state);
    });
    await ev(() => {
      window.__stopWatchHealth = window.__dev.watchState();
    });
    await sleep();
    await untilPanel().catch(() => {}); // утреннее «Апчхи!»
    const bad = await ev(() => window.__stopWatchHealth());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
    let s = await state();
    expect(s.sick && s.sick.cause === 'cold' && s.sick.since === d + 1, 'не простыла', s.sick);
    const text = await panelText();
    expect(/Апчхи/.test(text) && /простыла/.test(text) && /морозе/.test(text), 'утреннее сообщение', text);
    expect(
      await ev(() => {
        const c = document.querySelector('.chip.sick');
        return !!c && !c.hidden && c.offsetWidth > 0;
      }),
      'нет значка 🤒',
    );
    await closeAll();
    // значок: по нажатию — что делать
    await page.click('.chip.sick');
    await untilPanel().catch(() => {});
    expect(/больниц/.test(await panelText()), 'окно «что делать»', await panelText());
    await closeAll();
    // письмо дня — не работа, не купание и не ныряние
    const tasks = await ev(async () => {
      const D = await import('./js/data/index.js');
      const out = [];
      for (let i = 0; i < 30; i++) {
        window.__dev.F.newDayMail();
        const t = D.TASK_BY_ID[window.__dev.G.state.mail.task];
        if (D.taskNeedsHealth(t, D.JOBS)) out.push(t.id);
      }
      return out;
    });
    expect(!tasks.length, 'простуженной пришло письмо про работу или купание', tasks);
    // перезагрузка: та же ночь даёт то же решение
    for (let i = 0; i < 2; i++) {
      await openSave(saved);
      await sleep();
      await closeAll();
      s = await state();
      expect(
        s.sick && s.sick.cause === 'cold' && s.sick.since === d + 1,
        'после перезагрузки — другое решение',
        s.sick,
      );
    }
  });

  await step('болезнь: эффекты — медленнее, не работает, не купается и не ныряет, тёплый чай', async () => {
    await fresh();
    await setDay(10, null);
    // шаг здоровой и простуженной: на вилле, стрелкой вправо
    const walk = async () => {
      await go('villa', { pos: { scene: 'villa', floor: 0, x: 300 } });
      await frames(3);
      const x0 = await ev(() => window.__dev.Villa.p.x);
      await page.keyboard.down('ArrowRight');
      await wait(700);
      await page.keyboard.up('ArrowRight');
      return (await ev(() => window.__dev.Villa.p.x)) - x0;
    };
    const fast = await walk();
    await ev(() => window.__dev.actions.fallSick('rain'));
    const k = await ev(async () => (await import('./js/core/state.js')).walkK());
    const slow = await walk();
    expect(k === 0.7 && slow / fast > 0.5 && slow / fast < 0.88, 'простуженная не медленнее', { k, fast, slow });
    // работа: в школе и больнице вежливый отказ (в больнице — сразу к доктору), в бассейне — «нельзя купаться»
    await go('world');
    await enter('school');
    expect(/Сначала выздоровей/.test(await dialogText()), 'школа: нет отказа', await dialogText());
    expect(!(await dialogBtns()).some((b) => /урок/.test(b)), 'школа: кнопка работы осталась', await dialogBtns());
    await closeAll();
    await enter('pool');
    expect(/бассейн сегодня нельзя/.test(await dialogText()), 'бассейн: нет отказа', await dialogText());
    await closeAll();
    await enter('rest');
    expect(
      /Сначала выздоровей/.test(await dialogText()) && (await dialogBtns()).some((b) => /Меню/.test(b)),
      'ресторан: отказ, но меню есть',
      await dialogBtns(),
    );
    await closeAll();
    // мини-игра-работа напрямую — тоже отказ; рыбалка — можно
    await ev(() => {
      window.__dev.F.playMinigame('chef');
    });
    await untilPanel().catch(() => {});
    expect(
      /Сначала выздоровей/.test(await panelText()) && !(await ev(() => !!document.querySelector('#mg'))),
      'шеф-повар: нет отказа',
    );
    await closeAll();
    await ev(() => {
      window.__dev.F.playMinigame('fishing', { spot: 'pier' });
    });
    await until(() => !!document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
    expect(await ev(() => !!document.querySelector('#mg')), 'рыбалка не открылась');
    await mgClose();
    await closeAll();
    // у воды: дальше песка не идёт, подсказка
    await ev(() => window.__dev.World.debugTeleport(40, 53));
    await frames(3);
    await clearToasts();
    await page.keyboard.down('ArrowDown');
    await wait(2500);
    await page.keyboard.up('ArrowDown');
    const w = await ev(() => ({ surf: window.__dev.World.p.surf }));
    expect(w.surf === 's' && /купаться нельзя/.test(await toasts()), 'простуженная зашла в воду', [w, await toasts()]);
    // нажали на воду — дойдёт только до берега
    const end = await ev(() => {
      const W = window.__dev.World,
        T = 48;
      W.walkTo(40.5 * T, 60.5 * T, true);
      const q = W.p.path[W.p.path.length - 1];
      return q ? W.map.at(Math.floor(q.x / T), Math.floor(q.y / T)) : W.p.surf;
    });
    expect(end === 's', 'путь в воду проложен', end);
    // нырнуть: из воды (оказалась там до болезни) — нельзя, подсказка
    const deep = await ev(() => {
      const W = window.__dev.World;
      for (let ty = 58; ty < 72; ty++)
        for (let tx = 30; tx < 60; tx++) {
          W.debugTeleport(tx, ty);
          if (W.canDive()) return [tx, ty];
        }
      return null;
    });
    expect(deep, 'нет глубокой воды');
    await clearToasts();
    await ev(() => window.__dev.World.dive());
    await until(() => /купаться нельзя/.test(document.querySelector('#toasts').textContent), undefined, {
      timeout: 2000,
    }).catch(() => {});
    expect((await scene()) === 'world' && /купаться нельзя/.test(await toasts()), 'нырнула простуженной');
    // домашний бассейн на вилле — нельзя, ванна — можно
    await go('villa');
    await clearToasts();
    const pool = await ev(async () => {
      const { FIXTURES } = await import('./js/engine/side/fixtures.js');
      const sc = window.__dev.Villa;
      FIXTURES.pool.use(sc, { x: 1150, w: 770, h: 90, f: 0 });
      return sc.p.state;
    });
    await frames(2);
    expect(pool !== 'swim' && /купаться нельзя/.test(await toasts()), 'домашний бассейн', pool);
    // тёплый чай с мёдом: обычный шаг на сегодня, но всё ещё простыла
    await ev(() => {
      const d = window.__dev;
      d.actions.addItem('dishes', 'honey_tea', 1);
      d.F.eat('honey_tea');
    });
    await until(
      () => window.__dev.G.state.dayFlags.sickTea && /полегче/.test(document.querySelector('#toasts').textContent),
      undefined,
      { timeout: 3000 },
    ).catch(() => {});
    const s = await state();
    const k2 = await ev(async () => (await import('./js/core/state.js')).walkK());
    expect(s.sick && s.dayFlags.sickTea && k2 === 1, 'чай не помог', [s.sick, s.dayFlags, k2]);
    expect(/полегче/.test(await toasts()), 'нет подсказки про чай', await toasts());
  });

  await step('болезнь: лечение у доктора — за монеты и бесплатно, наклейка', async () => {
    await fresh();
    await setDay(12, null, 3000);
    await ev(() => {
      window.__dev.actions.fallSick('sea');
      window.__dev.go('world');
    });
    await untilScene('world');
    await frames(2);
    await enter('hospital');
    expect(/Витаминкин/.test(await ev(() => document.querySelector('.dialog .name').textContent)), 'не доктор');
    expect(/150/.test(await dialogText()), 'нет цены приёма', await dialogText());
    await tap('.dialog .btn.green', 700);
    expect(/Приём у доктора/.test(await panelText()) && /градусник/.test(await panelText()), 'нет приёма');
    expect((await state()).sick, 'вылечилась до конца приёма');
    await tap('.overlay .panel-foot .btn.green', 400);
    expect(/А-а-а/.test(await panelText()), 'нет «скажи а-а-а»');
    await tap('.overlay .panel-foot .btn.green', 400);
    expect(/витаминка/.test(await panelText()), 'нет витаминки');
    await tap('.overlay .panel-foot .btn.green', 1600);
    let s = await state();
    expect(!s.sick && s.money === 2850 && s.immuneUntil === 12 + 4, 'после приёма', [s.sick, s.money, s.immuneUntil]);
    expect(s.stickers.includes('x_healthy') && s.ledger.today.out === 150, 'наклейка или учёт трат', s.stickers);
    await closeAll();
    // здоровой — больница снова зовёт работать, есть «Как не простыть?»
    await enter('hospital');
    expect(/Лечить/.test((await dialogBtns()).join()) && /не простыть/.test((await dialogBtns()).join()), 'больница');
    await tap('.dialog >> text=Как не простыть?', 500);
    expect(/шапку/.test(await panelText()), 'советы доктора', await panelText());
    await closeAll();
    // монет нет — лечит «за улыбку»; закрыть окно посреди приёма — всё равно здорова
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => (s.money = 40));
      d.actions.fallSick('none');
    });
    await enter('hospital');
    expect(/за улыбку/.test(await dialogText()), 'бесплатно — не сказано', await dialogText());
    await tap('.dialog .btn.green', 700);
    await tap('.overlay .xbtn', 600);
    s = await state();
    expect(!s.sick && s.money === 40, 'бесплатный приём', [s.sick, s.money]);
    expect(await ev(() => document.querySelector('.chip.sick').hidden), 'значок 🤒 остался');
  });

  await step('болезнь: выздоровление само через 2 дня, иммунитет', async () => {
    await fresh();
    await setDay(20, null);
    await ev(() => window.__dev.actions.fallSick('rain'));
    await sleep(); // день 21 — ещё болеет
    await closeAll();
    let s = await state();
    expect(s.sick && s.day === 21, 'выздоровела слишком рано', [s.day, s.sick]);
    await clearToasts();
    await sleep(); // день 22 — здорова сама
    await until(() => /выздоровела/.test(document.querySelector('#toasts').textContent), undefined, {
      timeout: 3000,
    }).catch(() => {});
    s = await state();
    expect(!s.sick && s.day === 22 && s.immuneUntil === 26, 'не выздоровела сама', [s.day, s.sick, s.immuneUntil]);
    expect(/выздоровела/.test(await toasts()), 'нет подсказки о выздоровлении', await toasts());
    await closeAll();
    // иммунитет: ночи на 23–25-й день — не болеет даже со всеми неосторожностями; с 26-го — может
    for (const d of [22, 23, 24]) {
      await setDay(d, ALL);
      expect(JSON.stringify(await ev(() => window.__dev.F.planNight())) === '{}', `иммунитет: ночь на ${d + 1}`);
    }
    const after = await ev(async () => {
      const D = await import('./js/data/index.js');
      const s = window.__dev.G.state,
        all = { cold: 1, sea: 1, rain: 1 };
      let first = -1;
      for (let d = 22; d < 300 && first < 0; d++)
        if (D.nightHealth({ day: d + 1, sick: null, immuneUntil: s.immuneUntil, careless: all, key: s.name }).fall)
          first = d + 1;
      return first;
    });
    expect(after >= 26, 'заболела во время иммунитета', after);
  });

  await step('болезнь: перенос сохранения v3 → v4 и образец v4', async () => {
    const old = JSON.parse(SAVE_V3);
    await openSave(SAVE_V3);
    let s = await state();
    expect(s.v === 5 && s.sick === null && s.immuneUntil === old.day + 3, 'перенос', [s.v, s.sick, s.immuneUntil]);
    for (const k of ['name', 'money', 'stickers', 'day', 'biz', 'homesOwned', 'homes'])
      expect(JSON.stringify(s[k]) === JSON.stringify(old[k]), `после переноса изменилось «${k}»`);
    // часы виллы на старом месте repair переносит с окна (З8) — их не сравниваем
    const noClock = (v) => JSON.stringify((v || []).filter((i) => i.id !== 'clock'));
    expect(noClock(s.villa) === noClock(old.villa), 'после переноса изменилось «villa» (кроме часов)');
    // вещи: всё, что было, и шлёпанцы в подарок (У2)
    expect(JSON.stringify(s.clothes) === JSON.stringify([...old.clothes, 'flip_pink']), 'вещи после переноса');
    const backup = JSON.parse(await ev(() => localStorage.getItem('rhr-save-backup')));
    expect(backup.v === 3 && backup.money === old.money, 'нет копии сохранения v3', backup.v);
    // образец v4: простуженная Ириска — значок есть, доктор лечит
    const want = JSON.parse(SAVE_V4);
    await openSave(SAVE_V4);
    s = await state();
    expect(s.v === 5 && s.name === want.name && JSON.stringify(s.sick) === JSON.stringify(want.sick), 'образец v4', [
      s.v,
      s.sick,
    ]);
    expect(await ev(() => !document.querySelector('.chip.sick').hidden), 'образец v4: нет значка 🤒');
    await go('world');
    await enter('hospital');
    await tap('.dialog .btn.green', 600);
    await tap('.overlay .xbtn', 500);
    s = await state();
    expect(!s.sick && s.money === want.money - 150, 'образец v4: приём', [s.sick, s.money]);
    // испорченное поле болезни чинится, а не ломает игру
    const broken = JSON.parse(SAVE_V4);
    broken.sick = { since: 'вчера' };
    broken.immuneUntil = 'никогда';
    await openSave(JSON.stringify(broken));
    s = await state();
    expect(s.sick === null && s.immuneUntil === 0, 'испорченное поле болезни', [s.sick, s.immuneUntil]);
    await ev(() => window.__dev.go('villa'));
  });
};

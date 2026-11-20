// Шаги автотеста про журнал сюжетных заданий (этап 5): задание Мяты недоступно в первый день и доступно потом,
// значки «!» / «?», разговор (взять, как дела, сдать), ход по событиям (сбор для гербария, урожай), перезагрузка
// посреди задания, журнал в альбоме, плашка в HUD (и на телефоне), звёздочка, тайные места и замочки, перенос
// сохранения v4 → v5 и образец v5. Состояние меняют только действия. Подключается из dev/smoke.js.
// Только эти шаги:  node dev/smoke.js <url> step:журнал
const fs = require('fs');
const path = require('path');
const SAVE_V4 = fs.readFileSync(path.join(__dirname, 'saves', 'v4.json'), 'utf8'); // простуженная Ириска (Ф1)
const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8'); // Ириска собирает гербарий

const lib = require('./lib.js');

module.exports = async function quests(ctx) {
  const L = lib(ctx);
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    untilPanel,
    untilScene,
    frames,
    norm,
    expect,
    state,
    toasts,
    clearToasts,
    panelText,
    dialogText,
  } = L;
  const badge = (id) => ev((id) => window.__dev.state && window.__dev.QuestState.questBadge(id), id);
  const now = () => ev(() => window.__dev.QuestState.questNow('herbarium'));
  const status = async () => (await now()).status;
  const chip = () =>
    ev(() => {
      const c = document.querySelector('.chip.quest');
      if (!c || c.hidden) return null;
      const r = c.getBoundingClientRect();
      return { text: c.textContent, right: r.right, bottom: r.bottom, vw: innerWidth };
    });
  /** Новая игра с чистого листа. */
  const fresh = () => L.fresh(); // 1 июня, без вводной цепочки
  const putSave = async (raw) => {
    await L.putSave(raw);
    await L.cont();
    await closeAll();
  };
  /** Следующий диалог (если будет) — с защитой кнопок от случайного нажатия. */
  const nextDialog = () => L.untilDialog(1500).catch(() => {});
  /** Полдень в городе (Мята гуляет в парке). */
  const noon = () =>
    ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.minutes = 12 * 60;
        s.weather = 'sun';
      });
      d.go('world');
    }).then(() => untilScene('world'));
  /** Поговорить с Мятой в городе (как будто подошли) — диалог открыт. */
  const talkMyata = async () => {
    await ev(() => {
      window.__dev.run('npc:myata');
    });
    await L.untilDialog();
  };
  /** Места для гербария в городе и что с них сорвать. */
  const herbs = () =>
    ev(() => {
      const W = window.__dev.World,
        P = W.desc.parts.find((p) => p.herbSpots);
      return P.herbSpots().map((h) => ({ tx: h.tx, ty: h.ty, type: h.type, id: P.herbOf(W, h) }));
    });
  const pick = (tx, ty) =>
    ev(
      ([tx, ty]) => {
        const W = window.__dev.World,
          P = W.desc.parts.find((p) => p.herbSpots);
        return P.pickHerb(
          W,
          P.herbSpots().find((h) => h.tx === tx && h.ty === ty),
        );
      },
      [tx, ty],
    );
  /** Сорвать со всех мест города всё, что можно; вернуть, сколько сорвано. */
  const pickAll = async () => {
    let n = 0;
    for (const h of await herbs()) {
      if (!(await ev(() => window.__dev.QuestState.findsWanted('herb')))) break;
      if (await pick(h.tx, h.ty)) n++;
    }
    return n;
  };
  const nextDay = () =>
    ev(() => {
      window.__dev.actions.nextDay();
      window.__dev.actions.mutate((s) => {
        s.minutes = 12 * 60;
      });
    });

  await step(
    'журнал: задания Мяты нет, пока не подошла к заросшей тропе; у ворот — «!» у Мяты, плашка, звёздочка',
    async () => {
      await fresh();
      await noon();
      await frames(2);
      expect((await status()) === 'locked', 'задание можно взять, не побывав у ворот', await status());
      expect((await badge('myata')) === null, 'над Мятой значок', await badge('myata'));
      expect((await chip()) === null, 'плашка задания', await chip());
      // сбора для гербария нет, пока задание не взято
      expect(!(await ev(() => window.__dev.QuestState.findsWanted('herb'))), 'находки нужны без задания');
      expect(!(await pick(33, 33)), 'сорвали для гербария без задания');
      // разговор с Мятой — обычный
      await talkMyata();
      expect(!(await dialogText()).includes('гербарий'), 'Мята предлагает задание до ворот', await dialogText());
      await closeAll();
      // и на второй день — тоже нет: задание ждёт, когда хомячок наткнётся на тропу в лес
      await nextDay();
      await noon();
      await frames(2);
      expect((await status()) === 'locked', 'на второй день задание без ворот', await status());
      // подошла к воротам леса (не нажимая) — подсказка «поговори с Мятой» и звёздочка к ней
      await clearToasts();
      await ev(() => window.__dev.World.debugTeleport(3, 4));
      await L.until(() => window.__dev.QuestState.questNow('herbarium').status === 'ready', undefined, {
        timeout: 3000,
      }).catch(() => {});
      await wait(300);
      expect((await status()) === 'ready', 'у ворот задание не появилось', await status());
      expect(/поговори с ней/.test(await toasts()), 'нет подсказки «поговори с Мятой»', await toasts());
      const star = await ev(() => {
        const W = window.__dev.World,
          t = W.target(),
          n = W.npcs.find((q) => q.id === 'myata');
        return t && n ? { d: Math.hypot(t.x - n.x, t.y + 62 - n.y) } : null; // звёздочка — над её головой
      });
      expect(star && star.d < 60, 'звёздочка не к Мяте', star);
      // ворота: «поговори с Мятой»
      await ev(() => {
        window.__dev.run('way:forest');
      });
      await untilPanel();
      expect(
        /Тропа в лес заросла/.test(await panelText()) && /поговори с ней/.test(await panelText()),
        'ворота: «поговори»',
        await panelText(),
      );
      await closeAll();
      await noon();
      await frames(2);
      expect((await badge('myata')) === '!', 'нет «!» над Мятой', await badge('myata'));
      expect((await badge('plusha')) === null, '«!» над другим жителем');
      const c = await chip();
      expect(c && c.text.includes('Мята'), 'плашка «Мята просит о помощи»', c);
      expect(c.right <= c.vw + 1, 'плашка задания вылезла за экран', c);
      // журнал: «Новое задание!»
      await ev(() => document.querySelector('.chip.quest').click()); // плашка покачивается — жмём из страницы
      await untilPanel();
      expect(
        /Новое задание/.test(await panelText()) && /Мята/.test(await panelText()),
        'журнал: новое задание',
        await panelText(),
      );
      await closeAll();
      // значок нарисован из кэша спрайтов и помещается в свою рамку
      await ev(() => {
        const W = window.__dev.World,
          n = W.npcs.find((q) => q.id === 'myata');
        W.debugTeleport(Math.floor(n.x / 48), Math.floor(n.y / 48) + 2);
      });
      await wait(700);
      const sp = await ev(() => ({
        has: [...window.__dev.topdown.SP.map.keys()].some((k) => k.startsWith('badge:!')),
        clipped: window.__dev.World.debugSprites().clipped,
      }));
      expect(sp.has && !sp.clipped.length, 'значок «!» не из кэша спрайтов или обрезан', sp);
    },
  );

  await step(
    'журнал: взять задание, гербарий по дням, урожай, перезагрузка, сдать — лес открыт; только действия',
    async () => {
      await fresh();
      await nextDay();
      await ev(() => window.__dev.actions.setFlag('door:forest', 1)); // была у заросшей тропы
      await noon();
      await frames(2);
      await ev(() => {
        window.__stopWatchQuests = window.__dev.watchState();
      });
      // взять
      await talkMyata();
      expect(/гербарий/.test(await dialogText()), 'Мята не предлагает задание', await dialogText());
      await page.click('.dialog .btn.green');
      await nextDialog();
      await page.click('.dialog .btn.green'); // «Хорошо!»
      await L.until(() => !document.querySelector('.dialog'), undefined, { timeout: 2000 }).catch(() => {});
      let w = await now();
      expect(w.status === 'active' && w.i === 0, 'задание не взято', w);
      expect((await badge('myata')) === null, 'после взятия над Мятой остался значок', await badge('myata'));
      expect(/0\/5/.test((await chip()).text), 'плашка: 0/5', await chip());
      expect(await ev(() => !!window.__dev.World.target()), 'звёздочка не показывает к гербарию');
      // разговор «как дела»
      await talkMyata();
      expect(/0 из 5/.test(await dialogText()), 'Мята не говорит, сколько собрано', await dialogText());
      await closeAll();
      // день 1: три разные находки (по одной с каждого вида мест); второй раз с того же места — нельзя
      await clearToasts();
      let got = await pickAll();
      let s = await state();
      expect(got === 3 && Object.keys(s.finds).length === 3, 'за день — три разные находки', [got, s.finds]);
      expect(!(await pick(33, 33)), 'с одного места дважды в день');
      await wait(600);
      expect(/для гербария/.test(await toasts()), 'нет подсказки «для гербария»', await toasts());
      expect((await now()).steps[0].have === 3, 'шаг 1: 3 из 5', (await now()).steps[0]);
      // находки — не еда: в рюкзаке на своей вкладке, у торговца на рынке их нет
      expect(!Object.keys(s.finds).some((id) => s.ing[id]), 'находка попала в продукты');
      // перезагрузка посреди задания: всё на месте
      await ev(() => window.__stopWatchQuests());
      const raw = await ev(() => {
        window.__dev.actions.touchState();
        return JSON.stringify(window.__dev.G.state);
      });
      await putSave(raw);
      s = await state();
      expect(
        s.quests.herbarium && s.quests.herbarium.done === null && Object.keys(s.finds).length === 3,
        'после перезагрузки',
        [s.quests, s.finds],
      );
      await noon();
      await frames(2);
      expect(/3\/5/.test((await chip()).text), 'плашка после перезагрузки: 3/5', await chip());
      expect(!(await pick(33, 33)), 'после перезагрузки снова сорвали с того же места');
      await ev(() => {
        window.__stopWatchQuests = window.__dev.watchState();
      });
      // день 2: ещё две — и сбор останавливается
      await nextDay();
      await clearToasts();
      got = await pickAll();
      await wait(600);
      w = await now();
      expect(got === 2 && w.steps[0].ok && w.i === 1, 'на второй день — 5 из 5, дальше урожай', [got, w]);
      expect(/Дальше/.test(await toasts()), 'нет подсказки «Дальше: …»', await toasts());
      expect(!(await ev(() => window.__dev.QuestState.findsWanted('herb'))), 'находки нужны и после 5 из 5');
      // журнал: шаг 1 сделан, текущий — урожай
      await ev(() => window.__dev.F.openAlbum('quests'));
      await untilPanel();
      expect(
        (await ev(() => document.querySelectorAll('.q-steps li.ok').length)) === 1 &&
          /урожай/.test(await ev(() => document.querySelector('.q-steps li.cur').textContent)),
        'журнал: шаги',
        await panelText(),
      );
      await closeAll();
      // урожай
      await ev(() => {
        const d = window.__dev;
        d.F.plantOn(0, 'seed_carrot'); // новая игра — в июне: сажают морковку
        d.actions.nextDay();
        d.F.gardenBed(0);
      });
      await wait(300);
      w = await now();
      expect(w.i === 2 && (await badge('myata')) === '?', 'после урожая — «?» над Мятой', [w.i, await badge('myata')]);
      expect(/Мят/.test((await chip()).text), 'плашка «Отнеси находки Мяте»', await chip());
      // сдать
      await noon();
      await frames(2);
      const money = (await state()).money;
      await talkMyata();
      await page.click('.dialog .btn.green'); // «Отдать находки»
      await nextDialog();
      expect(/открыта/.test(await dialogText()), 'Мята не благодарит', await dialogText());
      await page.click('.dialog .btn.green');
      await untilPanel('Задание выполнено', 4000).catch(() => {});
      const text = await panelText();
      expect(
        /Задание выполнено/.test(text) && /Лес открыт/.test(text) && /Юный ботаник/.test(text),
        'праздничное окно',
        text,
      );
      expect((await ev(() => document.querySelectorAll('.overlay .confetti i').length)) > 10, 'нет конфетти');
      await closeAll();
      const bad = await ev(() => window.__stopWatchQuests());
      expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
      s = await state();
      expect(s.quests.herbarium.done === s.day && Number.isFinite(s.lands.forest), 'задание и лес', [
        s.quests,
        s.lands,
      ]);
      expect(s.stickers.includes('q_herbarium') && s.clothes.includes('bag_straw'), 'наклейка и корзинка', s.stickers);
      expect(s.money === money + 500, 'монеты за задание', s.money - money);
      expect(!Object.keys(s.finds).length, 'находки не отданы', s.finds);
      // плашка теперь зовёт к следующему заданию — лесника Шишкина в открывшемся лесу
      const ch = await chip();
      expect(
        (await badge('myata')) === null && (!ch || /Шишкин/.test(ch.text)),
        'после задания — значок или плашка',
        ch,
      );
      // журнал: выполнено; тропа в лес — «Лес открыт!»
      await ev(() => window.__dev.F.openAlbum('quests'));
      await untilPanel();
      expect(
        /Выполнено/.test(await panelText()) && /Лес/.test(await panelText()),
        'журнал: выполнено',
        await panelText(),
      );
      await closeAll();
      await ev(() => {
        window.__dev.run('way:forest');
      });
      await untilScene('forest').catch(() => {});
      // лес готов (П.9): тропа ведёт в сцену леса, а там — лесник Шишкин с заданием «!»
      expect(
        (await ev(() => window.__dev.sceneName)) === 'forest',
        'тропа в лес после задания ведёт не в лес',
        await ev(() => window.__dev.sceneName),
      );
      expect((await badge('shishkin')) === '!', 'в лесу у Шишкина нет задания «!»', await badge('shishkin'));
      await closeAll();
      await noon();
      await frames(2);
      // карта: лес без замочка, остальные — с замочком
      await ev(() => window.__dev.F.openMap());
      await untilPanel();
      const lands = await ev(() =>
        [...document.querySelectorAll('.overlay .land')].map((b) => [b.textContent, b.classList.contains('open')]),
      );
      expect(
        lands.length > 1 && lands[0][1] && lands.slice(1).every((l) => !l[1] && l[0].includes('🔒')),
        'тайные места на карте',
        lands,
      );
      await closeAll();
      // повторно задание не берётся, Мята говорит как обычно
      await talkMyata();
      expect(!/гербарий/.test(await dialogText()), 'Мята снова предлагает задание', await dialogText());
      await closeAll();
    },
  );

  await step('журнал: перенос сохранения v4 → v5 и образец v5', async () => {
    const old = JSON.parse(SAVE_V4);
    await putSave(SAVE_V4);
    let s = await state();
    expect(
      s.v === 5 &&
        JSON.stringify(s.quests) === '{}' &&
        JSON.stringify(s.lands) === '{}' &&
        JSON.stringify(s.finds) === '{}',
      'перенос',
      [s.v, s.quests],
    );
    for (const k of ['name', 'money', 'stickers', 'day', 'biz', 'homesOwned', 'sick'])
      expect(JSON.stringify(s[k]) === JSON.stringify(old[k]), `после переноса изменилось «${k}»`);
    // часы виллы на старом месте repair переносит с окна (З8) — их не сравниваем
    const noClock = (v) => JSON.stringify((v || []).filter((i) => i.id !== 'clock'));
    expect(noClock(s.villa) === noClock(old.villa), 'после переноса изменилось «villa» (кроме часов)');
    expect(s.flags.questsEarly === 1 && (await status()) === 'ready', 'в старом сохранении задание Мяты — сразу', [
      s.flags,
      await status(),
    ]);
    const backup = JSON.parse(await ev(() => localStorage.getItem('rhr-save-backup')));
    expect(backup.v === 4, 'нет копии сохранения v4', backup.v);
    // образец v5: гербарий в работе — две находки, лес закрыт
    const want = JSON.parse(SAVE_V5);
    await putSave(SAVE_V5);
    s = await state();
    expect(s.v === 5 && s.name === want.name && JSON.stringify(s.finds) === JSON.stringify(want.finds), 'образец v5', [
      s.v,
      s.finds,
    ]);
    expect((await status()) === 'active' && (await now()).steps[0].have === 2, 'образец v5: 2 из 5', await now());
    expect(!Number.isFinite(s.lands.forest), 'образец v5: лес открыт');
    // испорченное — чинится
    const broken = JSON.parse(SAVE_V5);
    broken.quests = { herbarium: 'да', nope: {} };
    broken.lands = { forest: 'вчера', moon: 3 };
    broken.finds = { herb_fir: 2, rocket: 1 };
    await putSave(JSON.stringify(broken));
    s = await state();
    expect(
      JSON.stringify(s.quests) === '{}' &&
        JSON.stringify(s.lands) === '{}' &&
        JSON.stringify(s.finds) === '{"herb_fir":2}',
      'испорченные поля журнала',
      [s.quests, s.lands, s.finds],
    );
    await ev(() => window.__dev.go('villa'));
  });
};

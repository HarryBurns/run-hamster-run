// Шаги автотеста этапа 10 «Начало игры в Ореховой Гавани»: новая игра 1 июня, вступительная сценка (листается и
// пропускается), вводная цепочка заданий (соседи заходят в гости на виллу), «Я уже всё умею», старые игры без цепочки,
// ореховые скалы и доска с названием в городе. («Год в городе» и подарки праздников по годам — dev/smoke_holidays.js.)
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:начало игры"
const lib = require('./lib.js');

module.exports = async function start(ctx) {
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
    untilDialog,
    frames,
    act,
    expect,
    state,
    panelText,
    blank,
    go,
  } = L;
  const dialogText = async () =>
    L.norm(await ev(() => (document.querySelector('.dialog') || { textContent: '' }).textContent));
  const welcome = () => ev(() => window.__dev.F.debugWelcome());
  const intro = () => ev(() => window.__dev.F.introDebug());
  /** Новая игра как у игрока: сценку пропустить, приветствие закрыть; вводная цепочка включена. */
  const fresh = () => L.fresh({ start: 'intro' });
  /** Ответить первой кнопкой диалога; дождаться следующей реплики (с защитой её кнопок) — или конца разговора с соседом. */
  const reply = async (sel = '.dialog .btn') => {
    await page.click(sel); // старый диалог убирается сразу по нажатию
    await until(
      () => !!document.querySelector('.dialog .btn') || !window.__dev.F.debugWelcome().visit,
      undefined,
      'следующая реплика',
    );
    if (await ev(() => !!document.querySelector('.dialog'))) await wait(380);
  };
  /** Разговор с соседом кончился: диалога нет, визит закончен. */
  const untilVisitEnd = () =>
    until(
      () => !document.querySelector('.dialog') && !window.__dev.F.debugWelcome().visit,
      undefined,
      'сосед договорил',
    );
  /**
   * Хомячок на вилле; дождаться, пока сосед зайдёт и заговорит; вернуть текст его реплики. boxes — сколько раз видели
   * гостинец в лапках (смотрит сама страница, пока ждём).
   */
  const waitVisit = async (id) => {
    await ev(() => {
      window.__boxes = 0;
      window.__dev.villaAt(0, 700);
    });
    await until(
      () => {
        if (window.__dev.scene.actors.some((g) => g.guest && g.carry)) window.__boxes++;
        return !!document.querySelector('.dialog .say');
      },
      undefined,
      { timeout: 15000, poll: 100, msg: 'сосед заговорил' },
    ).catch(() => {});
    await wait(380); // окно разговора не принимает нажатия в первые мгновения
    const w = await welcome(),
      text = await dialogText(),
      boxes = await ev(() => window.__boxes);
    expect(text && w.visit && w.visit.id === id, `сосед не зашёл (${id})`, [w, text.slice(0, 80)]);
    return { text, boxes };
  };
  /** Сдать задание жителю в городе: разговор → кнопка → «Спасибо» → праздничное окно. */
  const handIn = async (npc) => {
    await go('world');
    await ev((npc) => {
      window.__dev.run('npc:' + npc);
    }, npc);
    await untilDialog();
    await page.click('.dialog .btn');
    await untilDialog();
    await page.click('.dialog .btn');
    await until(
      () => [...document.querySelectorAll('.overlay .panel')].some((p) => p.textContent.includes('Задание выполнено')),
      undefined,
      { timeout: 4000 },
    ).catch(() => {});
    const p = await panelText();
    await L.drain();
    return p;
  };
  const emit = (name, data) => ev(([name, data]) => window.__dev.emit(name, data), [name, data || {}]);

  await step('начало игры: новая игра — 1 июня, лето; вступительная сценка листается кадр за кадром', async () => {
    await blank();
    await act('play');
    await until(() => !!window.__dev.F.introDebug(), undefined, 'сценка');
    let f = await intro();
    expect(f && f.i === 0 && f.id === 'city' && f.n === 4, 'сценка не началась с города', f);
    const cap = L.norm(await ev(() => document.querySelector('#intro .i-text').textContent));
    expect(cap.includes('Хомка') && cap.includes('домике у моря'), 'подпись первого кадра', cap);
    expect((await ev(() => window.__dev.sceneName)) !== 'villa', 'игра началась до конца сценки');
    const ids = [];
    for (let i = 0; i < 3; i++) {
      // листается кнопкой, нажатием на картинку и пробелом
      if (i === 0) await page.click('#intro .i-next');
      else if (i === 1) await page.mouse.click(200, 200);
      else await page.keyboard.press('Space');
      await until((i) => (window.__dev.F.introDebug() || { i: -1 }).i === i, i + 1, { timeout: 3000 }).catch(() => {});
      f = await intro();
      ids.push(f && f.id);
    }
    expect(ids.join() === 'train,town,villa', 'кадры по порядку', ids);
    const last = L.norm(await ev(() => document.querySelector('#intro').textContent));
    expect(last.includes('Приехали') && last.includes('Пропустить'), 'последний кадр: «Приехали!»', last);
    const town = await ev(() => {
      // картинка не пустая: на кадре много разных цветов
      const cv = document.querySelector('#intro canvas'),
        d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data,
        seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 997) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
      return seen.size;
    });
    expect(town > 12, 'кадр сценки пустой', town);
    await page.click('#intro .i-next');
    await until(() => !window.__dev.F.introDebug() && !document.getElementById('intro'), undefined, {
      timeout: 3000,
    }).catch(() => {});
    await untilPanel('Добро пожаловать').catch(() => {});
    expect((await intro()) === null && !(await ev(() => !!document.getElementById('intro'))), 'сценка не закрылась');
    const hello = await panelText();
    // продолжение истории: домик куплен на сбережения, на счету — настоящее число монет; без подсказок про почту и работу
    const left = L.norm(await ev(async () => (await import('./js/core/util.js')).fmtMoney(window.__dev.G.state.money)));
    expect(
      hello.includes('Ореховую Гавань') &&
        hello.includes('июнь') &&
        hello.includes('домик на холме') &&
        hello.includes(`осталось 🪙 ${left} монет`) &&
        !/почтов|достроить|заработа/.test(hello),
      'приветствие',
      hello.slice(0, 300),
    );
    const head = await ev(() => {
      const t = document.querySelector('.panel.wrap-title .panel-head .title');
      return t ? { sw: t.scrollWidth, cw: t.clientWidth, sh: t.scrollHeight, ch: t.clientHeight } : null;
    });
    expect(head && head.sw <= head.cw + 1 && head.sh <= head.ch + 1, 'заголовок приветствия обрезан', head);
    await act('go');
    await untilScene('villa');
    const s = await state();
    const c = await ev(async () => (await import('./js/core/state.js')).cal());
    expect(
      s.day === 15 && s.startDay === 15 && c.month === 5 && c.dom === 1 && c.season === 'summer' && c.year === 1,
      'новая игра — 1 июня',
      [s.day, s.startDay, c],
    );
    expect(
      s.weather === 'sun' && s.look.outfit.body === 'tee_heart' && !s.look.outfit.head && s.seeds.seed_carrot === 2,
      'лето: солнце, майка, морковка в семенах',
      [s.weather, s.look.outfit, s.seeds],
    );
    expect(
      s.flags.intro === 1 && s.mail && s.mail.task === 'shells',
      'первое письмо — «Ракушки» (не повторяет вводное задание), цепочка включена',
      [s.flags, s.mail],
    );
    // шкаф новой игры — только то, что надето (майка, шорты, кеды); шлёпанцы в подарок — только старым играм
    expect(
      [...s.clothes].sort().join() === Object.values(s.look.outfit).filter(Boolean).sort().join() &&
        s.flags.flipflopsGift === 1,
      'шкаф новой игры',
      [s.clothes, s.look.outfit],
    );
    expect(s.immuneUntil === 18, 'первые дни не болеет', s.immuneUntil);
    // первое письмо здоровается с новой соседкой
    await ev(() => window.__dev.F.openMailbox());
    await untilPanel();
    const letter = await panelText();
    expect(
      letter.includes('С приездом в Ореховую Гавань') && letter.includes('Ракушки'),
      'первое письмо',
      letter.slice(0, 200),
    );
    await closeAll();
    const dateChip = L.norm(await ev(() => document.querySelector('.chip.date').textContent));
    expect(dateChip.includes('Июнь') && !/🎄|🌟|🎉/.test(dateChip), 'на дате — июнь, без значка праздника', dateChip);
  });

  await step('начало игры: сценку можно пропустить; сама листается; при продолжении игры её нет', async () => {
    await blank();
    await act('play');
    await until(() => !!window.__dev.F.introDebug(), undefined, 'сценка').catch(() => {});
    expect(((await intro()) || {}).i === 0, 'сценка не началась');
    await act('skip');
    await until(() => !document.getElementById('intro'), undefined, { timeout: 3000 }).catch(() => {});
    await untilPanel('Добро пожаловать').catch(() => {});
    expect((await intro()) === null && !(await ev(() => !!document.getElementById('intro'))), 'сценка не пропустилась');
    expect((await panelText()).includes('Добро пожаловать'), 'после сценки — приветствие');
    await act('go');
    await untilScene('villa').catch(() => {});
    expect((await ev(() => window.__dev.sceneName)) === 'villa', 'игра не началась на вилле');
    await L.reload(); // записать, перезагрузить, «Продолжить»
    expect(
      (await intro()) === null && (await ev(() => window.__dev.sceneName)) === 'villa',
      'сценка при продолжении игры',
    );
    // сама листается: кадр стоит frameTime секунд (в игре — 11, здесь — 1) и сменяется следующим, после последнего — конец
    await closeAll();
    await ev(() => {
      window.__introDone = false;
      window.__dev.F.playIntro({ name: 'Тест', frameTime: 1 }).then(() => (window.__introDone = true));
    });
    await until(() => (window.__dev.F.introDebug() || { i: 0 }).i >= 1, undefined, { timeout: 3000 }).catch(() => {});
    const f = await intro();
    expect(f && f.i >= 1 && !(await ev(() => window.__introDone)), 'сценка не листается сама', f);
    await until(() => window.__introDone, undefined, { timeout: 6000 }).catch(() => {});
    expect(await ev(() => window.__introDone), 'сценка сама не закончилась');
    await until(() => !document.getElementById('intro'), undefined, { timeout: 2000 }).catch(() => {});
  });

  await step(
    'начало игры: «Как играть» — только основы, для пальца и для мыши с клавиатурой, с картинками',
    async () => {
      await fresh();
      const help = async (touch) => {
        await ev((touch) => void window.__dev.F.showHelp({ touch }), touch);
        await untilPanel('Как играть');
        const r = await ev(() => ({
          pics: [...document.querySelectorAll('.howto-card')].map((c) => c.dataset.pic),
          svgs: document.querySelectorAll('.howto-card svg').length,
        }));
        r.text = await panelText();
        await closeAll();
        return r;
      };
      const t = await help(true),
        k = await help(false);
      const common = ['coins', 'map', 'decor', 'grow'];
      expect(
        t.pics.join() === ['tapGo', 'tapThing', ...common].join() && t.svgs === t.pics.length,
        'справка для пальца',
        t.pics,
      );
      expect(
        t.text.includes('Нажми на место') && !/WASD|W A S D|клавиатур|мышк/.test(t.text),
        'для пальца — без клавиш и мыши',
        t.text.slice(0, 300),
      );
      expect(
        k.pics.slice(0, 4).join() === 'keys,keyE,mouse,esc' && common.every((p) => k.pics.includes(p)),
        'справка для компьютера',
        k.pics,
      );
      expect(
        k.text.includes('W A S D') && k.text.includes('мышкой'),
        'для компьютера — клавиши и мышь',
        k.text.slice(0, 300),
      );
      // только основы: ни тайных мест, ни праздников, ни работы
      expect(
        ![t.text, k.text].some((x) => /лес|пещер|пустын|джунгл|праздник|школ|больниц/i.test(x)),
        'в справке лишнее',
        k.text,
      );
    },
  );

  await step(
    'начало игры: сюрпризы по смыслу — за обычное задание мелочи, кубок — за соревнование, золото — в кладе',
    async () => {
      await fresh();
      const pools = await ev(() => {
        const F = window.__dev.F;
        return { small: F.surprisePool('small'), win: F.surprisePool('win'), treasure: F.surprisePool('treasure') };
      });
      const trophies = ['cup', 'statue', 'throne', 'medal'],
        elsewhere = [
          'hat_pirate',
          'panama_explorer',
          'helmet_lamp',
          'scarf_nomad',
          'clip_shell',
          'lei_island',
          'wreath_lei',
        ];
      expect(
        pools.small.length > 5 && !pools.small.some((id) => trophies.includes(id) || elsewhere.includes(id)),
        'за обычное задание — кубок, золото или чужая награда',
        pools.small,
      );
      expect(pools.win.join() === 'cup', 'за соревнование — кубок', pools.win);
      expect(pools.treasure.sort().join() === 'statue,throne', 'в кладе — золотой хомяк и трон', pools.treasure);
      // письма: первое задание дня (рыбалка) — мелочь, а не кубок; соревнование (заплыв) — кубок чемпиона
      const mail = async (task, game) => {
        await ev(
          ([task, game]) => {
            const d = window.__dev;
            d.actions.setMail(task);
            d.actions.readMail();
            d.emit('minigame', { id: game, stars: 1 });
          },
          [task, game],
        );
        await untilPanel('Задание выполнено').catch(() => {});
        await L.drain();
        return state();
      };
      let s = await mail('fish', 'fishing');
      expect(
        s.mail.done && !trophies.some((id) => s.flags['gift_' + id] || s.clothes.includes(id)),
        'за рыбалку — кубок',
        s.flags,
      );
      s = await mail('swim', 'swim');
      expect(s.mail.done && s.flags.gift_cup, 'за заплыв — не кубок', s.flags);
    },
  );

  await step(
    'начало игры: вводная цепочка — четыре соседа заходят в гости, шаги по событиям, награды, наклейка «Новосёл»',
    async () => {
      await fresh();
      let w = await welcome();
      expect(
        w.on &&
          w.next === 'intro_home' &&
          w.quests.join() === 'intro_home:ready:0,intro_garden:locked:0,intro_work:locked:0,intro_sea:locked:0',
        'цепочка в начале',
        w,
      );
      // наткнулась на тропу в лес в первый же день — задание Мяты всё равно ждёт конца вводной цепочки
      await ev(() => window.__dev.actions.setFlag('door:forest', 1));
      const herb = () => ev(() => window.__dev.QuestState.questNow('herbarium').status);
      expect((await herb()) === 'locked', 'гербарий Мяты во время вводной цепочки', await herb());
      // «!» над Плюшей на улице нет: вводное задание она приносит сама
      expect((await ev(() => window.__dev.QuestState.questBadge('plusha'))) === null, 'у Плюши «!» на улице');
      let s0 = await state();
      // 1. Плюша с печеньем
      let v = await waitVisit('intro_home');
      expect(
        v.text.includes('Плюша') &&
          v.text.includes('Ореховую Гавань') &&
          v.text.includes('Я уже всё умею') &&
          v.boxes > 0,
        'Плюша пришла с коробочкой',
        v,
      );
      await reply();
      // вторая реплика — мягкая просьба: каталог «Модного», снимок в обновке; задание ещё не в журнале
      expect(
        (await dialogText()).includes('каталог') && !(await state()).quests.intro_home,
        'Плюша: про каталог',
        await dialogText(),
      );
      await reply();
      expect((await dialogText()).includes('журнал'), 'Плюша: «записала в журнал»', await dialogText());
      await page.click('.dialog .btn');
      await untilVisitEnd();
      let s = await state();
      expect(
        s.quests.intro_home &&
          s.quests.intro_home.done === null &&
          s.dishes.cookies === s0.dishes.cookies + 2 &&
          s.guests.includes('plusha') &&
          s.friends.plusha.met,
        'задание взято, печенье в рюкзаке, Плюша в гостях',
        [s.quests, s.dishes, s.guests],
      );
      expect(!(await ev(() => window.__dev.scene.actors.some((g) => g.carry))), 'коробочка осталась в лапках');
      await ev(() => window.__dev.F.openAlbum('quests'));
      await untilPanel();
      const j = await panelText();
      expect(
        j.includes('Снимок для каталога') &&
          j.includes('каталог') &&
          j.includes('Попробуй печенье') &&
          j.includes('Выбери обновку') &&
          !j.includes('Своя грядка'),
        'журнал: одно вводное задание',
        j.slice(0, 300),
      );
      await closeAll();
      // шаги: съесть печенье (по-настоящему, из рюкзака), купить и надеть обновку
      await L.react(() => {
        window.__dev.F.eat('cookies');
      });
      await closeAll();
      w = await welcome();
      expect(w.quests[0] === 'intro_home:active:1', 'шаг «печенье»', w.quests);
      await emit('buy', { cat: 'food', id: 'flour' });
      expect((await welcome()).quests[0] === 'intro_home:active:1', 'покупка еды засчиталась как обновка');
      await emit('buy', { cat: 'clothes', id: 'tee_sun' });
      await ev(() => window.__dev.actions.wear('head', null));
      expect(
        (await welcome()).quests[0] === 'intro_home:active:3',
        'шаги «купить» и «надеть»',
        (await welcome()).quests,
      );
      expect((await ev(() => window.__dev.QuestState.questBadge('plusha'))) === '?', 'у Плюши «?»');
      let fin = await handIn('plusha');
      s = await state();
      expect(
        fin.includes('Задание выполнено') &&
          fin.includes('Снимок для каталога') &&
          fin.includes('Соломенная шляпка с бантиком') &&
          s.clothes.includes('sunhat_bow') &&
          s.quests.intro_home.done === 15 &&
          s.money === s0.money + 100,
        'снимок для каталога сдан: плата +100 и шляпка',
        [fin.slice(0, 160), s.money - s0.money],
      );
      // 2. Мята с рассадой
      s0 = s;
      v = await waitVisit('intro_garden');
      expect(
        v.text.includes('Мята') && v.text.includes('рассаду') && !v.text.includes('Я уже всё умею') && v.boxes > 0,
        'Мята пришла с рассадой',
        v,
      );
      await reply();
      await page.click('.dialog .btn');
      await untilVisitEnd();
      s = await state();
      expect(
        s.quests.intro_garden && s.seeds.seed_carrot === s0.seeds.seed_carrot + 2 && s.guests.includes('myata'),
        'рассада в рюкзаке',
        [s.seeds, s.guests],
      );
      await emit('plant');
      await emit('harvest');
      await emit('cook', { dish: 'fish_soup', perfect: false });
      expect((await welcome()).quests[1] === 'intro_garden:active:3', 'шаги огорода и кухни', (await welcome()).quests);
      fin = await handIn('myata');
      s = await state();
      expect(
        fin.includes('Своя грядка') &&
          fin.includes('Семена помидоров') &&
          s.seeds.seed_tomato === 2 &&
          s.seeds.seed_strawberry === 2 &&
          s.money === s0.money + 100,
        'Своя грядка сдана: семена и +100',
        [fin.slice(0, 160), s.seeds],
      );
      // 3. Профессор — без гостинца, рассказывает про работу и рынок
      s0 = s;
      v = await waitVisit('intro_work');
      expect(v.text.includes('Профессор') && v.text.includes('рынке'), 'Профессор зашёл', v);
      await reply();
      await page.click('.dialog .btn');
      await untilVisitEnd();
      await emit('minigame', { id: 'tug', stars: 3 });
      expect((await welcome()).quests[2] === 'intro_work:active:0', 'не работа засчиталась как работа');
      await emit('minigame', { id: 'teacher', stars: 1 });
      await emit('sell', { id: 'carrot', n: 1, sum: 10 });
      expect(
        (await welcome()).quests[2] === 'intro_work:active:2',
        'шаги «работа» и «рынок»',
        (await welcome()).quests,
      );
      fin = await handIn('prof');
      s = await state();
      expect(
        fin.includes('Первая зарплата') && s.money === s0.money + 150,
        'Первая зарплата сдана: +150',
        s.money - s0.money,
      );
      // 4. Капитан Боб. Соседи, что заходили сами, ушли вместе с хомячком, когда она вышла из дома (features/guests.js)
      s0 = s;
      expect(s.guests.length === 0, 'соседи вводной цепочки остались сидеть в доме', s.guests);
      v = await waitVisit('intro_sea');
      expect(
        v.text.includes('Капитан Боб') && v.text.includes('цвета лесного ореха'),
        'Боб рассказал про ореховые скалы',
        v,
      );
      await reply();
      await page.click('.dialog .btn');
      await untilVisitEnd();
      s = await state();
      expect(s.ing.fish === (s0.ing.fish || 0) + 1 && s.quests.intro_sea, 'рыбка от Боба', s.ing);
      for (const id of ['plusha', 'plusha', 'senya', 'busya']) await emit('talk', { id });
      expect((await welcome()).quests[3] === 'intro_sea:active:0', 'один и тот же житель считается один раз');
      await emit('talk', { id: 'zefirka' });
      await emit('invite', { id: 'senya' });
      await emit('swim', { where: 'pool' });
      expect((await welcome()).quests[3] === 'intro_sea:active:2', 'бассейн — не море', (await welcome()).quests);
      await emit('swim', { where: 'sea' });
      fin = await handIn('bob');
      s = await state();
      expect(
        fin.includes('Морской привет') && fin.includes('Новосёл') && fin.includes('Пиратская треуголка'),
        'окно последнего задания',
        fin.slice(0, 200),
      );
      expect(
        s.stickers.includes('q_newcomer') && s.clothes.includes('hat_pirate') && s.money === s0.money + 150,
        'наклейка «Новосёл», треуголка, +150',
        [s.stickers, s.money - s0.money],
      );
      w = await welcome();
      expect(w.next === null && w.quests.every((q) => q.includes(':done:')), 'цепочка пройдена', w);
      expect((await herb()) === 'ready', 'гербарий Мяты после вводной цепочки', await herb());
      // дома больше никто не стучит
      await ev(() => window.__dev.villaAt(0, 700));
      await wait(2400); // сосед стучит, побыв дома 1,6 с (features/welcome.js, WAIT) — проверяем, что никто не пришёл
      expect(!(await dialogText()) && (await welcome()).visit === null, 'после цепочки снова кто-то пришёл');
    },
  );

  await step(
    'начало игры: телефон — «позвать в гости» считается шагом; «Я уже всё умею» выключает цепочку; у старой игры её нет',
    async () => {
      await fresh();
      await ev(() => {
        window.__dev.__ev = [];
        window.__dev.events.on('invite', (d) => window.__dev.__ev.push(d.id));
        window.__dev.actions.meetFriend('senya');
        window.__dev.go('world');
        window.__dev.F.openPhone();
      });
      await untilPanel();
      await page.click('.overlay .btn.small.green');
      await until(() => window.__dev.__ev.length > 0, undefined, { timeout: 3000 }).catch(() => {});
      expect(
        (await ev(() => window.__dev.__ev.join())) === (await state()).guests.join() &&
          (await state()).guests.length === 1,
        'событие «позвали в гости»',
        await ev(() => window.__dev.__ev),
      );
      await closeAll();
      // Плюша приходит — отвечаем «Я уже всё умею»
      await ev(() => window.__dev.villaAt(0, 700));
      await untilDialog(15000).catch(() => {});
      expect((await dialogText()).includes('Я уже всё умею'), 'первая встреча', await dialogText());
      await reply('.dialog .btn:has-text("Я уже всё умею")');
      expect((await dialogText()).includes('журнал'), 'ответ Плюши', await dialogText());
      await page.click('.dialog .btn');
      await untilVisitEnd();
      let s = await state(),
        w = await welcome();
      expect(
        s.flags.intro === 2 && !w.on && !s.quests.intro_home && w.quests[0] === 'intro_home:locked:0',
        'цепочка выключена',
        [s.flags, w],
      );
      await ev(() => window.__dev.F.openAlbum('quests'));
      await untilPanel();
      expect(!(await panelText()).includes('Новоселье'), 'вводное задание в журнале после «Я уже всё умею»');
      await closeAll();
      await ev(() => window.__dev.villaAt(0, 700));
      await wait(2400); // сосед стучит, побыв дома 1,6 с — проверяем, что не пришёл
      expect(!(await dialogText()), 'сосед пришёл снова', await dialogText());
      // цепочка пропущена: задание Мяты (гербарий) — когда хомячок наткнётся на заросшую тропу в лес
      const herb = () => ev(() => window.__dev.QuestState.questNow('herbarium').status);
      await ev(() => window.__dev.actions.mutate((st) => (st.day += 1)));
      expect((await herb()) === 'locked', 'гербарий Мяты до ворот леса', await herb());
      await ev(() => window.__dev.actions.setFlag('door:forest', 1));
      expect((await herb()) === 'ready', 'гербарий Мяты после ворот леса', await herb());
      // старая игра (до этапа 10): нет ни startDay, ни отметки цепочки — началась 1 января, соседи не приходят
      const old = await ev(async () => {
        const St = await import('./js/core/state.js');
        const copy = JSON.parse(JSON.stringify(window.__dev.G.state));
        delete copy.startDay;
        delete copy.flags.intro;
        copy.day = 40;
        St.repair(copy);
        const D = await import('./js/data/index.js');
        return {
          start: copy.startDay,
          intro: copy.flags.intro,
          when: D.QUEST_BY_ID.intro_home.when(copy),
          town: [D.holidayOn(51, copy.startDay), D.holidayOn(15, copy.startDay)].map((h) => (h ? h.id : null)),
        };
      });
      expect(
        old.start === 0 && old.intro === undefined && old.when === false && old.town.join() === 'birthday,',
        'старая игра: начало — 1 января, цепочки нет, «Год в городе» — 1 июня второго года',
        old,
      );
    },
  );

  await step(
    'начало игры: Ореховая Гавань — скалы по краям пляжа, доска с названием, карта, реплики жителей',
    async () => {
      await L.fresh({ scene: 'world' }); // без вводной цепочки
      const r = await ev(async () => {
        const d = window.__dev,
          W = d.World,
          m = W.map,
          D = await import('./js/data/index.js');
        const count = (t) => m.objs.filter((o) => o.type === t).length;
        const door = m.doorPx(m.bById.villa),
          way = (x, y) => !!m.path(m.foot, Math.floor(door.x / 48), Math.floor(door.y / 48), x, y);
        return {
          cliffs: count('nutcliff'),
          rocks: count('nutrock'),
          sign: count('townsign'),
          solid: [m.solid[54][1], m.solid[55][94], m.solid[47][60], m.solid[47][61]],
          ways: [way(63, 56), way(5, 54), way(90, 55), way(61, 48), way(30, 56)], // пирс, у западных и восточных скал, у доски, пляж
          place: !!W.whereIs('townsign'),
          title: W.desc.title,
          lines: D.NPCS.filter((n) => n.lines.some((l) => /орехов/i.test(l))).map((n) => n.id),
        };
      });
      expect(
        r.cliffs === 4 && r.rocks >= 8 && r.sign === 1 && r.solid.every(Boolean),
        'скалы и доска на месте, сквозь них не пройти',
        r,
      );
      expect(r.ways.every(Boolean), 'пляж, пирс и набережная проходимы', r.ways);
      expect(r.place && r.title.includes('Ореховая Гавань'), 'доска — место на карте; название в заголовке карты', r);
      expect(
        ['plusha', 'prof', 'bob', 'myata'].every((id) => r.lines.includes(id)),
        'жители говорят про название',
        r.lines,
      );
      // доска рассказывает, почему городок так зовут
      await ev(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
      await ev(() => window.__dev.World.walkToPlace('townsign'));
      await until(
        () => {
          if ([...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Ореховая Гавань')))
            return true;
          if (window.__dev.World.skipAlong) window.__dev.World.skipAlong();
          return false;
        },
        undefined,
        { timeout: 10000, poll: 150 },
      ).catch(() => {});
      const t = L.norm(await ev(() => [...document.querySelectorAll('.toast')].map((x) => x.textContent).join(' | ')));
      expect(t.includes('Ореховая Гавань') && /орех/.test(t), 'подсказка у доски', t);
      await ev(() => window.__dev.F.openMap());
      await untilPanel();
      expect((await panelText()).includes('Ореховая Гавань'), 'название на карте');
      await closeAll();
    },
  );

  await step(
    'начало игры: хомячок в спальне на втором этаже — сосед едет к ней на лифте и вручает гостинец',
    async () => {
      await fresh();
      let sc = await ev(() => ({ f: window.__dev.scene.p.f, name: window.__dev.sceneName }));
      expect(sc.name === 'villa' && sc.f === 1, 'новая игра — в спальне на втором этаже', sc);
      // страница сама смотрит, пока ждём: ехала ли Плюша в лифте, вышла ли на втором этаже, вручала ли гостинец
      await ev(() => (window.__seen = { hide: 0, up: 0, give: 0 }));
      await until(
        () => {
          const g = window.__dev.scene.actors.find((a) => a.guest && a.id === 'plusha'),
            seen = window.__seen;
          if (g) {
            if (g.hide) seen.hide++;
            if (g.f === 1 && !g.hide) seen.up++;
            if (g.carry && g.carry.give) seen.give++;
          }
          return !!document.querySelector('.dialog .say');
        },
        undefined,
        { timeout: 25000, poll: 100 },
      ).catch(() => {});
      await wait(380); // защита кнопок диалога
      const seen = await ev(() => window.__seen);
      const text = await dialogText();
      expect(text.includes('Я уже всё умею'), 'Плюша не дошла и не заговорила', [seen, text.slice(0, 80)]);
      expect(
        seen.hide > 0 && seen.up > 0 && seen.give > 0,
        'не ехала в лифте / не вышла на втором этаже / не вручила',
        seen,
      );
      expect((await ev(() => window.__dev.scene.p.f)) === 1, 'хомячка увезли с этажа');
      await reply();
      await closeAll();
    },
  );
};

// Общие помощники шагов автотеста (этап 21): то, что раньше каждый dev/smoke_*.js заводил у себя заново
// (expect, norm, fresh, state, toasts, watch …), — в одном месте. Подключение в файле шагов:
//   const lib = require('./lib.js');
//   module.exports = async function x(ctx) {
//     const { page, step, ev, wait, expect, fresh, until, act, closeAll } = lib(ctx);
//     ...
//   };
// ctx — то, что dev/smoke.js передаёт шагам ({ page, step, ev, wait, closeAll }); lib(ctx) возвращает его же
// вместе с помощниками. closeAll из lib — быстрее старого: ждёт, только если было что закрывать.
//
// Ожидания вместо пауз: until(() => условие в странице) ждёт, пока условие станет истинным (опрашивает каждые
// 40 мс), и падает с понятным текстом, если не дождалась. Готовые: untilScene, untilPanel, untilNoWindows,
// untilIdle (хомячок дошёл), untilDialog. Паузу wait(мс) оставляй там, где неясно, чего ждать (идёт время игры).
//
// Нажатия по смыслу, а не по тексту: act('ok') — кнопка с меткой data-act="ok" (метки ставит игра: js/ui/panel.js,
// dialog.js, features/title.js, intro.js, main.js, minigames/host.js). Метки:
//   play — «Играть!» на заставке;  continue — «Продолжить»;  games — «Мои игры»;  new — «Новая игра»;
//   skip / next — «Пропустить» / «Дальше» во вступительной сценке;  go — «Поехали!» в окне «Добро пожаловать»;
//   ok — первая (главная) кнопка простого окна (message: «Ура!», «Хорошо», «Да», «Спать»…), no — последняя из
//   нескольких («Нет», «Потом»);  close — ✕ окна;  start / done — «Начать!» / «Ура!» мини-игры.
const { MG_START } = require('./selectors.js');

const T = 48; // клетка локаций, px

/** Сообщение без неразрывных и узких пробелов — чтобы сравнивать с обычным текстом. */
const norm = (t) => String(t == null ? '' : t).replace(/[   ]/g, ' ');
const expect = (ok, msg, data) => {
  if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
};
const near = (a, b, r = 20) => !!a && !!b && Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
/** Селектор кнопки с меткой data-act (внутри scope, если дан). */
const sel = (name, scope = '') => (scope ? scope + ' ' : '') + `[data-act="${name}"]`;
/**
 * Условие в странице (для until): открыт диалог с кнопками (с кнопкой txt, если дан), и с его появления прошло больше
 * TAP_GUARD. Время появления диалогов отмечает MutationObserver, который условие само ставит при первом вызове.
 */
function dialogReady(txt) {
  if (!window.__dlgBorn) {
    const born = (window.__dlgBorn = new WeakMap());
    const mark = () =>
      document.querySelectorAll('.dialog').forEach((d) => born.has(d) || born.set(d, performance.now()));
    new MutationObserver(mark).observe(document, { childList: true, subtree: true });
    mark();
  }
  const d = document.querySelector('.dialog');
  if (!d || ![...d.querySelectorAll('.btn')].some((b) => !txt || b.textContent.includes(txt))) return false;
  if (!window.__dlgBorn.has(d)) window.__dlgBorn.set(d, performance.now());
  return performance.now() - window.__dlgBorn.get(d) > 370;
}

function lib(ctx) {
  const { page } = ctx;
  const ev = ctx.ev || ((fn, arg) => page.evaluate(fn, arg));
  const wait = ctx.wait || ((ms) => page.waitForTimeout(ms));

  /**
   * Ждать, пока fn(arg) в странице не вернёт истину; вернуть это значение. o: { timeout (мс, 6000), msg, poll }.
   * Не дождалась — ошибка «не дождалась: msg».
   */
  const until = async (fn, arg, o = {}) => {
    if (typeof o === 'string') o = { msg: o };
    try {
      // ошибка внутри условия (окна ещё нет и т. п.) — «пока нет», а не исключение на странице
      const h = await page.waitForFunction(
        ([src, a]) => {
          try {
            const c = (window.__libFn = window.__libFn || {});
            return (c[src] || (c[src] = new Function('return (' + src + ')')()))(a);
          } catch (e) {
            return false;
          }
        },
        [String(fn), arg === undefined ? null : arg],
        { timeout: o.timeout || 6000, polling: o.poll || 40 },
      );
      return await h.jsonValue();
    } catch (e) {
      if (!/Timeout/i.test(e.message)) throw e;
      throw new Error('не дождалась: ' + (o.msg || String(fn).slice(0, 120)));
    }
  };
  /** n кадров игры (requestAnimationFrame) — «дать нарисоваться», вместо коротких пауз. */
  const frames = (n = 2) =>
    ev(
      (n) =>
        new Promise((r) => {
          const f = () => (--n <= 0 ? r() : requestAnimationFrame(f));
          requestAnimationFrame(f);
        }),
      n,
    );
  const untilScene = (name, timeout) =>
    until((n) => window.__dev && window.__dev.sceneName === n, name, { timeout, msg: 'сцена ' + name });
  /** Открыто окно, в заголовке которого есть title (строка), или любое окно (без title). */
  const untilPanel = (title, timeout) =>
    until(
      (t) => [...document.querySelectorAll('.overlay .panel-head .title')].some((e) => !t || e.textContent.includes(t)),
      title || '',
      { timeout, msg: 'окно ' + (title || '') },
    );
  /**
   * Открыт диалог с кнопками (с текстом txt, если дан), и он уже принимает нажатия: первые TAP_GUARD (350 мс) кнопки
   * диалога нажатий не принимают (ui/dialog.js). Когда появился диалог, запоминает сама страница (MutationObserver,
   * ставится при первой проверке; диалог, что был открыт ещё до неё, считается появившимся сейчас).
   */
  const untilDialog = (timeout, txt) =>
    until(dialogReady, txt || '', { timeout, msg: 'диалог' + (txt ? ' с кнопкой ' + txt : '') });
  /** Ответить в диалоге кнопкой с этим текстом (дождавшись, пока диалог примет нажатие). */
  const answer = async (txt, timeout) => {
    await untilDialog(timeout, txt);
    await page.click(`.dialog .btn:has-text("${txt}")`);
  };
  /**
   * Ответить кнопкой txt (как answer) и дождаться отклика: следующий диалог готов к нажатию, открылось окно, сменилась
   * сцена или появилась подсказка — но не дольше ms (тогда молча дальше).
   */
  const reply = async (txt, ms = 1500) => {
    await answer(txt);
    await settle(await snapshot(), ms);
  };
  /** Приехали: сцена name (если дана), затемнения и картинки поездки (.fade: караван, кораблик, канатка) уже нет. */
  const untilArrive = (name, timeout = 9000) =>
    until((n) => (!n || window.__dev.sceneName === n) && !document.querySelector('.fade'), name || '', {
      timeout,
      msg: 'приехали ' + (name || ''),
    });
  const untilNoWindows = (timeout) =>
    until(() => !document.querySelector('.overlay, .dialog, #mg, .fade'), undefined, {
      timeout,
      msg: 'все окна закрыты',
    });
  /** Хомячок в локации дошёл, куда шла (путь пуст, отложенного дела нет). */
  const untilIdle = (timeout = 8000) =>
    until(
      () => {
        const d = window.__dev,
          sc = d && d.locations[d.sceneName];
        return !sc || !sc.p || (!(sc.p.path && sc.p.path.length) && !sc.p.pending);
      },
      undefined,
      { timeout, msg: 'хомячок дошёл' },
    );

  /** Снимок «что на экране»: сцена, число окон/диалогов/мини-игр, число подсказок — для settle. */
  const snapshot = () =>
    ev(() => ({
      scene: window.__dev.sceneName,
      ui: document.querySelectorAll('.overlay, .dialog, #mg').length,
      t: (document.querySelector('#toasts') || { children: [] }).children.length,
    }));
  /**
   * Дождаться отклика игры после снимка b: сменилась сцена, открылось или закрылось окно (диалог, мини-игра),
   * появилась подсказка — или прошло timeout мс (тогда молча дальше). Если на экране диалог — ещё ждёт, пока он
   * начнёт принимать нажатия (untilDialog).
   */
  const settle = async (b, timeout = 1500) => {
    await until(
      (b) =>
        window.__dev.sceneName !== b.scene ||
        document.querySelectorAll('.overlay, .dialog, #mg').length !== b.ui ||
        (document.querySelector('#toasts') || { children: [] }).children.length > b.t,
      b,
      { timeout },
    ).catch(() => {});
    await frames(2);
    if (await ev(() => !!document.querySelector('.dialog .btn'))) await untilDialog(1500).catch(() => {});
  };
  /** Выполнить fn(arg) в странице и дождаться отклика (settle). Возвращает то, что вернула fn. */
  const react = async (fn, arg, timeout) => {
    const b = await snapshot();
    const r = await ev(fn, arg);
    await settle(b, timeout);
    return r;
  };
  /** Нажать клавишу (по умолчанию E) и дождаться отклика. */
  const press = async (key = 'KeyE', timeout) => {
    const b = await snapshot();
    await page.keyboard.press(key);
    await settle(b, timeout);
  };

  /** Нажать кнопку с меткой data-act (по умолчанию ждёт её появления). */
  const act = async (name, scope) => {
    // «Играть!» новой игры ждёт выбора «Я — хомячок / Я — хомячка»: шаги, которым пол не важен, играют за хомячку
    // (как было до выбора пола); кому важен — fresh({ gender: 'm' }) или act('gender-m') заранее
    if (name === 'play')
      await ev(() => {
        const f = document.querySelector('#title [data-act="gender-f"]');
        if (f && !document.querySelector('#title .t-who-btn.on')) f.click();
      });
    return page.click(sel(name, scope));
  };
  const hasAct = (name, scope) => ev((s) => !!document.querySelector(s), sel(name, scope));

  /** Закрыть все окна и диалоги: ✕ окон и мини-игр, последний вариант диалога («Пока!»). Ждёт, только если было что закрывать. */
  const closeAll = async () => {
    for (let i = 0; i < 8; i++) {
      const n = await ev(() => {
        const els = [...document.querySelectorAll('.dialog .btn:last-child, .overlay .xbtn, #mg .xbtn, #piano .xbtn')];
        els.forEach((x) => x.click());
        return els.length;
      });
      if (!n) return;
      await wait(i ? 120 : 60); // у диалога защита от случайного нажатия сразу после открытия — нажмём ещё раз
    }
  };

  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  /** Изменить состояние через действие mutate: строкой ('s.money = 5') или функцией ((s) => { … }) — она выполняется в странице. */
  const mutate = (fn) =>
    ev((src) => window.__dev.actions.mutate(new Function('s', src)), typeof fn === 'function' ? `(${fn})(s)` : fn);
  const scene = () => ev(() => window.__dev.sceneName);
  /** Где хомячок: сцена и x, y в локации (в доме x, y — null). */
  const where = () =>
    ev(() => {
      const d = window.__dev,
        sc = d.locations[d.sceneName];
      return { scene: d.sceneName, x: sc ? sc.p.x : null, y: sc ? sc.p.y : null };
    });

  // тексты с экрана
  const toasts = async () =>
    norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const panelTitles = () =>
    ev(() => [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent).join('|'));
  const dialogText = async () => norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
  const text = async (s) => norm(await page.locator(s).first().innerText());

  /** Слежка «состояние меняют только действия»: watch() … await unwatch() (падает, если были записи мимо). */
  const watch = () =>
    ev(() => {
      window.__libStopWatch = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => (window.__libStopWatch ? window.__libStopWatch() : []));
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };

  /** Чистая страница: всё стёрто, заставка с кнопкой «Играть!». */
  const blank = async () => {
    await ev(() => {
      if (window.__dev) window.__dev.G.state = null; // уходящая страница не перезапишет стёртое
      localStorage.clear();
    });
    await page.reload();
    await page.waitForSelector(sel('play'));
  };

  /**
   * Новая игра. o:
   *   start: 'june' (по умолчанию: настоящее начало — 1 июня, без вводной цепочки заданий) | 'old' (__dev.oldStart():
   *          1 января, снег, тёплый наряд — для шагов про зиму) | 'intro' (как у ребёнка: с вводной цепочкой);
   *   name — имя хомячка; gender: 'm' | 'f' — пол героя (по умолчанию хомячка); day, minutes, weather — сразу поставить; dayFlags: true — очистить отметки дня;
   *   money; flags — { имя: значение } в s.flags; set — ещё строка/функция для mutate; scene — перейти туда;
   *   villa: 'small' — как в настоящей новой игре: маленький домик («Вилла растёт»); по умолчанию — вилла целиком
   *          (__dev.villaFull(): три этажа, пруд, бассейн, прежняя мебель) — на неё рассчитаны прежние шаги.
   * Хомячок после этого на вилле (или в scene), окна закрыты.
   */
  const fresh = async (o = {}) => {
    await blank();
    if (o.name) await page.fill('#title input', o.name);
    if (o.gender) await page.click(sel('gender-' + o.gender));
    await act('play');
    await act('skip'); // вступительная сценка новой игры (этап 10)
    if (o.start === 'old') await ev(() => window.__dev.oldStart());
    else if (o.start !== 'intro') await ev(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка — в своих шагах (smoke_start.js)
    await act('go'); // «Добро пожаловать!» — «Поехали!»
    await untilScene('villa');
    await closeAll();
    if (o.villa !== 'small') {
      await ev(() => window.__dev.villaFull());
      await frames(2);
    }
    const parts = [];
    if (o.day != null) parts.push(`s.day = ${+o.day};`);
    if (o.minutes != null) parts.push(`s.minutes = ${+o.minutes};`);
    if (o.weather) parts.push(`s.weather = ${JSON.stringify(o.weather)};`);
    if (o.dayFlags) parts.push('s.dayFlags = {};');
    if (o.money != null) parts.push(`s.money = ${+o.money};`);
    for (const [k, v] of Object.entries(o.flags || {}))
      parts.push(`s.flags[${JSON.stringify(k)}] = ${JSON.stringify(v)};`);
    if (parts.length) await mutate(parts.join(' '));
    if (o.set) await mutate(o.set);
    if (o.scene) await go(o.scene);
  };

  /** Перейти в сцену (как __dev.go) и дождаться её. */
  const go = async (name, params) => {
    await ev(([n, p]) => window.__dev.go(n, p), [name, params || null]);
    await untilScene(name);
    await frames(2);
  };
  const toCity = (params) => go('world', params);
  /** В локацию (тайное место открывается, если ещё закрыто): toPlace('forest'). */
  const toPlace = async (name, params) => {
    await ev((n) => {
      const d = window.__dev;
      if (d.QuestState.landOpen && !d.QuestState.landOpen(n) && d.actions.openLand) {
        try {
          d.actions.openLand(n);
        } catch (e) {
          /* не тайное место */
        }
      }
    }, name);
    await go(name, params);
  };
  /** Встать в локации на клетку (tx, ty) — debugTeleport текущей сцены. */
  const teleport = async (tx, ty) => {
    await ev(
      ([tx, ty]) => {
        const d = window.__dev;
        (d.locations[d.sceneName] || d.World).debugTeleport(tx, ty);
      },
      [tx, ty],
    );
    await frames(2);
  };
  /** Войти в здание города по id (enterBuilding) и дождаться отклика: сцена дома, окно, диалог или подсказка. */
  const enter = (id, timeout) => react((id) => window.__dev.enterBuilding(id), id, timeout);
  /** Выполнить действие из реестра (__dev.run) и дождаться отклика. Само действие не ждём (окно ждёт ответа). */
  const run = (a, timeout) =>
    react(
      (a) => {
        window.__runRes = 'ждём';
        Promise.resolve(window.__dev.run(a)).then((r) => (window.__runRes = r));
      },
      a,
      timeout,
    );

  /**
   * Промотать время игры на sec секунд (игровая минута — 0,6 с): шаги логики (событие step, как в главном цикле) по
   * 0,5 с — часы, подсказки и отметки дня (холод, дождь, жара) идут так же, как если бы столько прошло. Окна должны
   * быть закрыты: на паузе цикл шагов не делает, а здесь — сделает.
   */
  const ff = (sec) =>
    ev((sec) => {
      for (let t = 0; t < sec - 1e-9; t += 0.5) window.__dev.emit('step', { dt: Math.min(0.5, sec - t) });
    }, sec);
  /** Вечер (__dev.evening): часы не раньше m (по умолчанию 19:00 — можно спать). */
  const evening = (m) => ev((m) => window.__dev.evening(m === null ? undefined : m), m === undefined ? null : m);
  /**
   * Закрывать окна, пока они идут из очереди (ui/modals.js: подарок, письмо, праздник, наклейка), — до тишины:
   * ничего не открыто, очередь пуста, затемнения нет. Не дольше timeout мс.
   */
  const drain = async (timeout = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const st = await ev(() => ({
        m: window.__dev.G.modal,
        q: window.__dev.ui.queued(),
        f: !!document.querySelector('.fade'),
      }));
      if (!st.m && !st.q && !st.f) return;
      if (st.m && !st.f) await closeAll();
      else await wait(80);
    }
  };
  /**
   * Окно «Пора спать?» открыто (или вот-вот откроется): нажать «Спать» и дождаться утра — день сменился, затемнение
   * снято, утренние окна закрыты (o.keep — не закрывать). Возвращает новый день.
   */
  const confirmSleep = async (o = {}) => {
    const day0 = await ev(() => window.__dev.G.state.day);
    await untilPanel('Пора спать');
    await act('ok', '.overlay .panel-foot');
    await until((d) => window.__dev.G.state.day === d + 1 && !document.querySelector('.fade'), day0, {
      timeout: 8000,
      msg: 'новый день после сна',
    });
    if (!o.keep) await drain();
    return day0 + 1;
  };
  /** Лечь спать вечером (на вилле, если не { home: false }) и проснуться. Возвращает новый день. */
  const sleep = async (o = {}) => {
    await ev((home) => {
      if (home) window.__dev.go('villa');
      window.__dev.evening();
      window.__dev.F.askSleep();
    }, o.home !== false);
    return confirmSleep(o);
  };

  // сохранения
  /** Подложить живое сохранение и перезагрузить страницу (до заставки). */
  const putSave = async (raw) => {
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', raw);
      localStorage.removeItem('rhr-save-backup');
    }, raw);
    await page.reload();
    await page.waitForSelector(sel('continue') + ',' + sel('play') + ',' + sel('reload'));
  };
  /** На заставке — «Продолжить» и дождаться сцены игры. */
  const cont = async () => {
    await act('continue');
    await until(
      () => window.__dev && window.__dev.G.state && !document.querySelector('#title'),
      undefined,
      'игра открылась',
    );
    await frames(2);
  };
  /** Записать игру (как при уходе со страницы), перезагрузить и продолжить. */
  const reload = async () => {
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await page.waitForSelector(sel('continue'));
    await cont();
  };

  /** Мини-игра: дождаться заставки и нажать «Начать!». */
  const mgStart = async () => {
    await page.waitForSelector(MG_START);
    await page.click(MG_START);
  };
  /** Мини-игра: «Начать!» и дождаться, пока заставка уйдёт (игра пошла). */
  const mgGo = async () => {
    await mgStart();
    await until((s) => !document.querySelector(s), MG_START, { timeout: 3000 }).catch(() => {});
    await frames(2);
  };
  /** Мини-игра кончилась: «Ура!» (метка done) — и дождаться, пока окно игры закроется. */
  const mgDone = async () => {
    await page.click(sel('done', '#mg'));
    await until(() => !document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
    await frames(2);
  };
  /** Закрыть мини-игру крестиком и дождаться, пока окно закроется. */
  const mgClose = async () => {
    await page.click('#mg .xbtn');
    await until(() => !document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
    await frames(2);
  };
  /**
   * Нажать на s (кнопка диалога — когда диалог уже принимает нажатия) и дождаться нового отклика игры: другой диалог,
   * больше окон, мини-игра, сменилась сцена, новая подсказка — но не дольше ms (тогда молча дальше: нажатие просто
   * закрыло окно). Замена связке «page.click(s); wait(ms)».
   * want — ждать только этот отклик (подсказка, что пришла раньше, не считается): 'panel' — новое окно, 'dialog' —
   * другой диалог, 'mg' — мини-игра, 'scene' — другая сцена, 'toast' — подсказка; можно несколько через «|»
   * ('panel|dialog'). С want не дождалась за ms — ошибка (а не молча дальше): tap(s, 1500, 'panel').
   */
  const tap = async (s, ms = 1500, want) => {
    if (/\.dialog/.test(s)) await until(dialogReady, '', { timeout: 6000, msg: 'диалог для ' + s });
    const b = await ev(() => {
      window.__tapDlg = document.querySelector('.dialog');
      return {
        scene: window.__dev.sceneName,
        ov: document.querySelectorAll('.overlay').length,
        mg: !!document.querySelector('#mg'),
        t: (document.querySelector('#toasts') || { children: [] }).children.length,
      };
    });
    b.want = want ? String(want).split('|') : null;
    await page.click(s);
    const got = until(
      (b) => {
        const d = document.querySelector('.dialog');
        const has = {
          scene: window.__dev.sceneName !== b.scene,
          dialog: !!d && d !== window.__tapDlg,
          panel: document.querySelectorAll('.overlay').length > b.ov,
          mg: !b.mg && !!document.querySelector('#mg'),
          toast: (document.querySelector('#toasts') || { children: [] }).children.length > b.t,
        };
        return (b.want || Object.keys(has)).some((k) => has[k]);
      },
      b,
      { timeout: ms, msg: 'после нажатия ' + s + ' — ' + (want || 'отклик') },
    );
    if (want) await got;
    else await got.catch(() => {});
    await frames(2);
    if (await ev(() => !!document.querySelector('.dialog .btn'))) await untilDialog(1500).catch(() => {});
  };

  return {
    ...ctx,
    ev,
    wait,
    T,
    norm,
    expect,
    near,
    sel,
    until,
    frames,
    untilScene,
    untilPanel,
    untilDialog,
    reply,
    answer,
    untilNoWindows,
    untilArrive,
    untilIdle,
    snapshot,
    settle,
    react,
    press,
    act,
    hasAct,
    closeAll,
    drain,
    state,
    mutate,
    scene,
    where,
    toasts,
    clearToasts,
    panelText,
    panelTitles,
    dialogText,
    text,
    watch,
    unwatch,
    blank,
    fresh,
    go,
    toCity,
    toPlace,
    teleport,
    enter,
    run,
    evening,
    ff,
    sleep,
    confirmSleep,
    putSave,
    cont,
    reload,
    mgStart,
    mgGo,
    mgDone,
    mgClose,
    tap,
    MG_START,
  };
}

lib.T = T;
lib.norm = norm;
lib.expect = expect;
lib.near = near;
lib.sel = sel;
module.exports = lib;

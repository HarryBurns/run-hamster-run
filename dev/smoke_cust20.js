// Шаги автотеста «баги заказчика 20 ноября»: гости уходят (сами пришедшие — вместе с хомячком на улицу, по телефону —
// не сидят в пустом доме, перед сном расходятся), житель не пропадает посреди разговора, пауза, когда ребёнок
// отвлёкся, Esc — меню, без солнышка на лежаке, «Горка» без колошматинья, мягкий шелест кустов, звезда «Садовника».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик 20:"
const lib = require('./lib.js');

module.exports = async function cust20(ctx) {
  const L = lib(ctx);
  const { step, ev, expect } = L;

  await step('заказчик 20: на лежаке нет солнышка над загорающей', async () => {
    const n = await ev(async () => {
      const A = await import('/js/features/relax_art.js');
      let calls = 0;
      const c = document.createElement('canvas').getContext('2d');
      const rec = new Proxy(c, {
        get(t, k) {
          const v = t[k];
          if (typeof v !== 'function') return v;
          return (...a) => {
            if (/^(fill|stroke|draw)/.test(String(k))) calls++;
            return v.apply(t, a);
          };
        },
        set(t, k, v) {
          t[k] = v;
          return true;
        },
      });
      // лежит на лежаке первую секунду, без реплики (прежний вызов: …, t, ct, sunny = true — рисовал солнышко)
      A.drawRestExtras(rec, 'lie', 100, 100, 1, 0, true);
      return calls;
    });
    expect(n === 0, 'над загорающей на лежаке что-то рисуется (солнышко)', n);
  });

  await step('заказчик 20: «Садовник» — «сделай из куста звёздочку», звезда узнаваемая (пять лучей)', async () => {
    const { SHAPES } = await ev(async () => {
      const g = await import('/js/minigames/gardener.js');
      return { SHAPES: g.SHAPES };
    });
    const star = SHAPES.star.rows;
    // кончики лучей: лист, у которого рядом (по сторонам) ровно один лист
    const at = (x, y) => !!star[y] && star[y][x] === 'X';
    let tips = 0;
    star.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch === 'X' && at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) === 1) tips++;
      }),
    );
    const sym = star.every((r) => r === [...r].reverse().join(''));
    expect(tips === 5 && sym && star.length >= 8 && star[0].length >= 9, 'звезда не похожа на звезду', star);
    expect(SHAPES.star.acc === 'звёздочку' && SHAPES.bunny.acc === 'зайчика', 'падеж фигуры в подсказке', SHAPES);
    // сама игра: фигура «звёздочка», после полива — подсказка с правильным словом
    await L.closeAll();
    await ev(async () => {
      const h = await import('/js/minigames/host.js');
      window.__gdDone = h.runMinigame('gardener', { look: window.__dev.G.state.look, shape: 'star' });
    });
    await L.mgStart();
    const hook = (name) =>
      ev((name) => {
        const c = [...document.querySelectorAll('#mg canvas')].find((q) => q[name]);
        return c ? c[name]() : null;
      }, name);
    await L.until(() => [...document.querySelectorAll('#mg canvas')].some((q) => q.__garden), undefined, {
      timeout: 4000,
    });
    for (let i = 0; i < 40; i++) {
      const s = await hook('__garden');
      if (!s || s.stage !== 'water') break;
      if (!s.busy) await hook('__gardenDo');
      await ctx.wait(700);
    }
    const s = await hook('__garden');
    const say = await ev(() => [...document.querySelectorAll('#mg .gd-chip')].map((q) => q.textContent).join(' | '));
    expect(s && s.stage === 'trim' && s.shape === 'star', 'не дошли до стрижки звёздочки', s);
    expect(/звёздочку/.test(say), 'подсказка стрижки', say);
    await ev(() => document.querySelector('#mg .xbtn').click());
  });

  await step('заказчик 20: сквозь куст — мягкий шелест листвы, а не бумага', async () => {
    await L.closeAll();
    await L.go('world');
    // куст в городе, к которому можно подойти слева или справа
    const r = await ev(() => {
      const d = window.__dev,
        W = d.World,
        m = W.map,
        pass = W.pass();
      const o = m.objs.find(
        (q) =>
          q.type === 'bush' &&
          (pass(q.tx - 1, q.ty) || pass(q.tx + 1, q.ty)) &&
          m.slowAt((q.tx + 0.5) * 48, (q.ty + 0.5) * 48),
      );
      if (!o) return null;
      const from = pass(o.tx - 1, o.ty) ? o.tx - 1 : o.tx + 1;
      W.debugTeleport(from, o.ty);
      return { from, tx: o.tx, ty: o.ty };
    });
    expect(!!r, 'нет куста в городе');
    await L.frames(2);
    const before = (await ev(() => window.__dev.Audio.debugHeard())).length;
    const key = r.from < r.tx ? 'ArrowRight' : 'ArrowLeft';
    await ctx.page.keyboard.down(key);
    await ctx.wait(450);
    await ctx.page.keyboard.up(key);
    const heard = (await ev(() => window.__dev.Audio.debugHeard())).slice(before > 30 ? 0 : before);
    expect(heard.includes('leaves') && !heard.includes('paper'), 'звук куста', heard);
    // и у всех «шуршащих» клеток (кусты, ягодник, орешник, цветы острова, монстера) — листва
    const rustles = await ev(async () => {
      const { OBJECTS } = await import('/js/engine/topdown/kinds.js');
      return [
        ...new Set(
          Object.values(OBJECTS)
            .map((o) => o.rustle)
            .filter(Boolean),
        ),
      ];
    });
    expect(rustles.length && rustles.every((s) => s === 'leaves'), 'звуки шуршащих клеток', rustles);
  });

  await step('заказчик 20: «Горка» — у бортика не колошматит, руль с инерцией, приз 10–20 монет', async () => {
    await L.closeAll();
    const coins = await ev(() => window.__dev.G && import('/js/data/economy.js').then((m) => m.HOTEL.slide.coins));
    expect(coins[0] >= 10 && coins[2] <= 20, 'приз за горку', coins);
    await ev(async () => {
      window.__dev.fastGames(false);
      const h = await import('/js/minigames/host.js');
      h.runMinigame('slide', { look: window.__dev.G.state.look, track: 'kid' });
    });
    await L.mgStart();
    await L.until(() => [...document.querySelectorAll('#mg canvas')].some((q) => q.__slide), undefined, {
      timeout: 4000,
    });
    await ctx.wait(300);
    // палец держат далеко за правым бортиком 2 секунды: круг прижимается и скользит, а не дёргается туда-сюда каждый
    // кадр (раньше — разворот почти в каждом кадре); потом палец чуть левее середины — круг разгоняется плавно
    const r = await ev(
      () =>
        new Promise((done) => {
          const c = [...document.querySelectorAll('#mg canvas')].find((q) => q.__slide),
            b = c.getBoundingClientRect();
          const move = (fx) => {
            const st = c.__slide();
            c.dispatchEvent(
              new PointerEvent('pointermove', {
                clientX: b.left + (st.x0 + fx * st.lw) * (b.width / st.w),
                clientY: b.top + b.height * 0.8,
                pointerType: 'mouse',
                bubbles: true,
              }),
            );
          };
          move(0.95);
          const xs = [];
          let t0 = performance.now(),
            phase = 0,
            from = 0,
            moved = null;
          const f = () => {
            const s = c.__slide(),
              now = performance.now();
            if (phase === 0) {
              xs.push(s.x);
              if (now - t0 > 2000) {
                phase = 1;
                t0 = now;
                from = s.x;
                move(Math.max(0.3, s.tube - 0.12));
              }
            } else if (now - t0 >= 100) {
              moved = Math.abs(s.x - from) / Math.max(0.01, Math.abs(c.__slide().tube - 0.12 - from));
              let rev = 0,
                last = 0;
              for (let i = 1; i < xs.length; i++) {
                const d = Math.sign(Math.round((xs[i] - xs[i - 1]) * 1e5));
                if (d && last && d !== last) rev++;
                if (d) last = d;
              }
              return done({ frames: xs.length, rev, bumps: s.bumps, moved });
            }
            requestAnimationFrame(f);
          };
          requestAnimationFrame(f);
        }),
    );
    expect(r.frames > 30 && r.rev <= 6, 'у бортика круг дёргается туда-сюда', r);
    expect(r.moved < 0.3, 'руль без инерции: за 0,1 с круг почти доехал до пальца', r);
    await ev(() => document.querySelector('#mg .xbtn').click());
  });

  await step('заказчик 20: пауза — долго без касаний, окно без фокуса, вкладка спрятана; нажатие снимает', async () => {
    await L.closeAll();
    await L.go('world');
    const mins = () => ev(() => window.__dev.G.state.minutes);
    const info = () => ev(() => window.__dev.F.pauseInfo());
    await ev(() => window.__dev.F.pauseAuto(true));
    // 1) долго без касаний — мягкая пауза: плашка, часы стоят, музыка тише
    await ev(() => window.__dev.F.pauseIdleFor(1000));
    await L.until(() => window.__dev.F.pauseInfo().on, undefined, { timeout: 3000 });
    let m0 = await mins();
    await ctx.wait(1300);
    expect((await mins()) === m0, 'на паузе часы идут', [m0, await mins()]);
    expect(
      (await info()).why === 'idle' &&
        (await ev(() => !!document.querySelector('.pause-chip'))) &&
        (await ev(() => window.__dev.Audio.musicDucked())) &&
        !(await ev(() => !!document.querySelector('.overlay'))),
      'мягкая пауза: плашка без окна, музыка тише',
      await info(),
    );
    await ctx.page.click('.pause-chip', { force: true }); // плашка покачивается — без ожидания «замерла»
    await ctx.wait(400);
    m0 = await mins();
    await ctx.wait(1300);
    expect(
      !(await info()).on && (await mins()) > m0 && !(await ev(() => window.__dev.Audio.musicDucked())),
      'нажатие не сняло паузу',
      await info(),
    );
    // 2) окно браузера потеряло фокус — пауза; клавиша снимает (и до игры не доходит)
    await ev(() => window.dispatchEvent(new Event('blur')));
    expect((await info()).on && (await info()).why === 'blur', 'окно без фокуса — нет паузы', await info());
    await ctx.page.keyboard.press('KeyE');
    expect(!(await info()).on, 'клавиша не сняла паузу', await info());
    // 3) вкладку спрятали — пауза
    await ev(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    expect((await info()).on && (await info()).why === 'hidden', 'спрятанная вкладка — нет паузы', await info());
    await ctx.page.mouse.click(640, 400);
    expect(!(await info()).on, 'касание не сняло паузу', await info());
    // 4) под окном мир и так стоит — плашки нет
    await ev(() => window.__dev.F.openSettings());
    await L.untilPanel('Меню');
    await ev(() => window.dispatchEvent(new Event('blur')));
    expect(!(await info()).on && !(await ev(() => !!document.querySelector('.pause-chip'))), 'плашка поверх окна');
    await L.closeAll();
    await ev(() => window.__dev.F.pauseAuto(false));
  });

  await step('заказчик 20: Esc — открытое окно закрывает, без окна — ⚙️ меню', async () => {
    await L.closeAll();
    await L.go('world');
    const titles = () => L.panelTitles();
    await ctx.page.keyboard.press('Escape');
    await L.untilPanel('Меню', 2000);
    await ctx.page.keyboard.press('Escape');
    await L.until(() => !document.querySelector('.overlay'), undefined, { timeout: 2000 });
    expect(!(await titles()), 'Esc не закрыл меню', await titles());
    await ev(() => window.__dev.F.openBackpack());
    await L.untilPanel();
    await ctx.page.keyboard.press('Escape');
    await L.until(() => !document.querySelector('.overlay'), undefined, { timeout: 2000 });
    expect(!(await titles()), 'Esc закрыл рюкзак и открыл меню сразу', await titles());
    // в мини-игре Esc ничего не делает (там свои клавиши)
    await ev(async () => {
      const h = await import('/js/minigames/host.js');
      h.runMinigame('slide', { look: window.__dev.G.state.look, track: 'kid' });
    });
    await L.mgStart();
    await ctx.page.keyboard.press('Escape');
    await ctx.wait(300);
    expect((await ev(() => !!document.querySelector('#mg'))) && !(await titles()), 'Esc в мини-игре', await titles());
    await ev(() => document.querySelector('#mg .xbtn').click());
  });

  /** Полдень хорошего дня, гостей нет, хомячок на вилле. */
  const noon = async (set = '') => {
    await L.closeAll();
    await L.mutate(`s.minutes = 12 * 60; s.weather = 'sun'; s.wxStrong = ''; s.dayFlags = {}; s.guests = []; ${set}`);
    await L.go('villa');
  };

  await step('заказчик 20: житель не пропадает посреди разговора (Сеня у бассейна отеля зовёт к себе)', async () => {
    // день и час, когда Сеня у бассейна
    const at = await ev(async () => {
      const H = await import('/js/data/hotel.js');
      for (let day = 2; day < 60; day++)
        for (let m = 9 * 60; m < 19 * 60; m += 30) if (H.poolGuestsOn(day, m).includes('senya')) return { day, m };
      return null;
    });
    expect(!!at, 'нет дня, когда Сеня у бассейна');
    await noon(`s.day = ${at.day}; s.minutes = ${at.m + 5}; s.mail = null;`);
    await L.mutate('s.friends.senya.met = true; s.friends.senya.chat = -1;');
    const pool = () =>
      ev(async () => {
        const Q = await import('/js/core/state.js');
        return { pool: Q.hotelPoolGuests().includes('senya'), at: Q.npcPlace('senya').at };
      });
    expect((await pool()).pool, 'Сеня не у бассейна', await pool());
    await ev(() => {
      window.__dev.run('npc:senya');
    });
    await L.untilDialog();
    // посреди разговора Сеня позвал к себе («Заходи ко мне сегодня!») — раньше он тут же уходил домой
    await ev(() => window.__dev.actions.inviteHome('senya'));
    expect((await pool()).pool && (await pool()).at === 'pool', 'Сеня пропал посреди разговора', await pool());
    await L.closeAll();
    await ctx.wait(300);
    expect((await pool()).pool, 'Сеня пропал сразу после разговора', await pool());
    // через полчаса игры — пошёл домой, как звал
    await L.mutate('s.minutes += 40;');
    expect((await pool()).at === 'home', 'Сеня так и не пошёл домой', await pool());
  });
};

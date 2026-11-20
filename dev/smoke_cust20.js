// Шаги автотеста «баги заказчика 20 ноября»: гости уходят (сами пришедшие — вместе с хомячком на улицу, по телефону —
// не сидят в пустом доме, перед сном расходятся), житель не пропадает посреди разговора, тихая пауза, когда ребёнок
// отвлёкся (стоят часы), Esc — меню, без солнышка на лежаке, «Горка» без колошматинья, мягкий шелест кустов, звезда «Садовника».
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

  await step('заказчик 20: тихая пауза — 30 с без касаний стоят часы, без фокуса и на спрятанной вкладке — и мир', async () => {
    await L.closeAll();
    await L.go('world');
    const mins = () => ev(() => window.__dev.G.state.minutes);
    const info = () => ev(() => window.__dev.F.pauseInfo());
    await ev(() => window.__dev.F.pauseAuto(true));
    // 1) долго без касаний — стоят только часы: без плашки, мир идёт (слоя паузы нет), первое нажатие доходит до игры
    await ev(() => window.__dev.F.pauseIdleFor(31));
    await L.until(() => window.__dev.F.pauseInfo().on, undefined, { timeout: 3000 });
    let m0 = await mins();
    await ctx.wait(1300);
    expect((await mins()) === m0, 'без касаний часы идут', [m0, await mins()]);
    let st = await info();
    expect(st.why === 'idle' && !st.world && (await ev(() => window.__dev.G.modal === 0)), 'мир встал без касаний', st);
    expect(!(await ev(() => !!document.querySelector('.pause-chip, .overlay'))), 'на паузе плашка или окно');
    await ctx.page.keyboard.press('Escape'); // первое нажатие не «съедается»: Esc сразу открывает ⚙️ меню
    await L.untilPanel('Меню');
    expect(!(await info()).on, 'клавиша не пустила часы', await info());
    await L.closeAll();
    m0 = await mins();
    await ctx.wait(1300);
    expect((await mins()) > m0, 'после нажатия часы стоят', [m0, await mins()]);
    // 29 с без касаний — часы ещё идут
    await ev(() => window.__dev.F.pauseIdleFor(29));
    await ctx.wait(1200);
    expect(!(await info()).on, 'часы встали раньше 30 с', await info());
    // 2) окно браузера потеряло фокус — стоят часы и мир, без плашки; клавиша снимает и доходит до игры
    await ev(() => window.dispatchEvent(new Event('blur')));
    st = await info();
    expect(st.on && st.world && st.why === 'blur', 'окно без фокуса — мир идёт', st);
    expect(!(await ev(() => !!document.querySelector('.pause-chip, .overlay'))), 'без фокуса — плашка или окно');
    m0 = await mins();
    await ctx.wait(800);
    expect((await mins()) === m0, 'без фокуса часы идут', [m0, await mins()]);
    await ctx.page.keyboard.press('Escape');
    await L.untilPanel('Меню');
    expect(!(await info()).on, 'клавиша не сняла паузу', await info());
    await L.closeAll();
    // фокус вернулся — мир идёт сам
    await ev(() => window.dispatchEvent(new Event('blur')));
    await ev(() => window.dispatchEvent(new Event('focus')));
    expect(!(await info()).on, 'фокус вернулся, а мир стоит', await info());
    // 3) вкладку спрятали — стоят часы и мир; касание снимает
    await ev(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    st = await info();
    expect(st.on && st.world && st.why === 'hidden', 'спрятанная вкладка — мир идёт', st);
    await ctx.page.mouse.click(640, 400);
    expect(!(await info()).on && (await ev(() => window.__dev.G.modal === 0)), 'касание не сняло паузу', await info());
    // 4) под окном мир и так стоит — паузы нет, окно не трогаем
    await ev(() => window.__dev.F.openSettings());
    await L.untilPanel('Меню');
    await ev(() => window.dispatchEvent(new Event('blur')));
    await ev(() => window.__dev.F.pauseIdleFor(100));
    await ctx.wait(1200);
    expect(!(await info()).on, 'пауза поверх окна', await info());
    await L.closeAll();
    await ev(() => window.__dev.F.pauseAuto(false));
    expect(!(await info()).on, 'после выключения пауза осталась', await info());
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
  const guests = () => ev(() => window.__dev.G.state.guests.slice());

  await step('заказчик 20: гость, пришедший сам, выходит вместе с хомячком; Плюша идёт к ТЦ из задания', async () => {
    // вводная цепочка: Плюша заходит сама (как features/welcome.js — inviteGuest с how 'self'), задание взято
    await noon(`s.flags.intro = 1; delete s.quests.intro_home;`);
    await ev(() => window.__dev.actions.inviteGuest('plusha', 'villa', 'self'));
    expect(
      (await ev(() => window.__dev.F.guestHow('plusha'))) === 'self',
      'соседка вводной цепочки не отмечена «пришла сама»',
    );
    await ev(() => window.__dev.F.startQuest('intro_home'));
    await L.closeAll();
    expect((await guests()).includes('plusha'), 'Плюша не в гостях');
    // вышла из дома — Плюша рядом на улице и идёт к ТЦ «Модный» (место шага «купи обновку»)
    await L.go('world');
    const r = await ev(() => {
      const W = window.__dev.World,
        n = W.npcs.find((q) => q.id === 'plusha'),
        p = W.p,
        mall = W.whereIs('mall_fashion');
      return {
        guests: window.__dev.G.state.guests,
        hidden: n.hidden,
        near: Math.hypot(n.x - p.x, n.y - p.y),
        lead: n.lead,
        mall,
        d0: Math.hypot(n.x - mall.x, n.y - mall.y),
      };
    });
    expect(!r.guests.includes('plusha'), 'Плюша осталась сидеть в пустом доме', r);
    expect(!r.hidden && r.near < 80, 'Плюша не вышла вместе с хомячком', r);
    expect(r.lead && Math.hypot(r.lead.x - r.mall.x, r.lead.y - r.mall.y) < 10, 'Плюша идёт не к ТЦ', r);
    await ctx.wait(3000);
    const d1 = await ev(() => {
      const W = window.__dev.World,
        n = W.npcs.find((q) => q.id === 'plusha'),
        mall = W.whereIs('mall_fashion');
      return Math.hypot(n.x - mall.x, n.y - mall.y);
    });
    expect(d1 < r.d0 - 60, 'Плюша не идёт к ТЦ', [r.d0, d1]);
    await L.mutate('s.flags.intro = 0;');
  });

  await step('заказчик 20: позванные гости не ждут вечно, в 22:00 и перед сном расходятся', async () => {
    // позвали по телефону — хомячок ушла: гость ждёт, но через 2 часа игры уходит
    await noon();
    await ev(() => window.__dev.actions.inviteGuest('myata', 'villa', 'call'));
    await L.go('world');
    expect((await guests()).includes('myata'), 'позванная Мята ушла сразу');
    await L.mutate('s.minutes += 130;');
    await ctx.wait(1400);
    expect(!(await guests()).length, 'позванная Мята ждёт в пустом доме больше двух часов', await guests());
    // вернулась вовремя — ждут дальше
    await noon();
    await ev(() => window.__dev.actions.inviteGuest('myata', 'villa', 'call'));
    await L.go('world');
    await L.mutate('s.minutes += 60;');
    await L.go('villa');
    await L.mutate('s.minutes += 100;');
    await ctx.wait(1400);
    expect((await guests()).includes('myata'), 'хомячок дома, а Мята ушла', await guests());
    // поздно — все по домам
    await L.mutate('s.minutes = 22 * 60 + 1;');
    await ctx.wait(1400);
    expect(!(await guests()).length, 'в 22:00 гости остались', await guests());
    // легла спать — гости прощаются до «Спокойной ночи»
    await noon('s.minutes = 20 * 60;');
    await ev(() => window.__dev.actions.inviteGuest('bob', 'villa', 'call'));
    await L.clearToasts();
    await ev(() => {
      window.__dev.run('sleep');
    });
    await L.untilPanel('Пора спать');
    await ctx.page.click('.overlay [data-act=ok]');
    await L.until(() => /по домам/.test(document.body.textContent), undefined, { timeout: 3000 });
    expect(!(await guests()).length, 'после сна гости в доме', await guests());
    await ctx.wait(2500);
    await L.closeAll();
  });

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

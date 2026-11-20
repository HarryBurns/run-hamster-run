// Шаги автотеста «Телевизор дома» (пачка 20 ноября): окно с передачами — каналы переключаются ◀ ▶ и списком,
// экран мебели показывает канал; прогноз погоды совпадает с настоящей погодой; «У плиты» — раз в 3–4 дня, досмотрела —
// рецепт один раз; «В мире животных» — факт; новости о событиях игры; старая игра без поля tv; цена телевизора.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:телевизор
const lib = require('./lib.js');

module.exports = async function tv(ctx) {
  const L = lib(ctx);
  const { page, step, ev, expect, until, untilPanel, closeAll, mutate } = L;

  /** Открыть окно телевизора нажатием на телевизор в доме (хомячок дойдёт и включит). */
  const tapTv = async () => {
    await closeAll();
    // хомячок — рядом с телевизором: на узком экране камера смотрит туда же
    await ev(() => {
      const it = window.__dev.houseItems('villa').find((i) => i.id === 'tv');
      if (it) window.__dev.villaAt(it.floor, it.x - 140);
    });
    await L.frames(3);
    const pt = await ev(() => {
      const d = window.__dev,
        sc = d.Villa,
        it = d.houseItems('villa').find((i) => i.id === 'tv');
      return it && sc.debugScreen(it.x, sc.geo.fy(it.floor) - 80);
    });
    expect(pt, 'на вилле нет телевизора');
    await page.mouse.click(pt.x, pt.y);
    await until(() => !!document.querySelector('.tv-screen'), null, { timeout: 12000, msg: 'окно телевизора' });
  };
  /** Открыть окно без мебели (маленький домик без телевизора, сразу на канал ch). */
  const openTv = async (ch) => {
    await closeAll();
    await ev(() => window.__dev.run('tv'));
    await untilPanel();
    if (ch) await page.click(`[data-act="tv-ch-${ch}"]`);
  };
  const tvCh = () => ev(() => window.__dev.G.state.tv.ch);

  await step(
    'телевизор: нажатие открывает окно, каналы переключаются ◀ ▶ и списком, экран в доме — тот же канал',
    async () => {
      await L.fresh({ day: 22, minutes: 11 * 60 });
      await ev(() => window.__dev.villaAt(0, 300));
      await tapTv();
      const r0 = await ev(() => {
        const it = window.__dev.houseItems('villa').find((i) => i.id === 'tv'),
          t = window.__dev.F.tvDebug();
        return {
          on: it.on,
          ch: window.__dev.G.state.tv.ch,
          title: document.querySelector('.panel-head .title').textContent,
          open: !!t,
        };
      });
      expect(
        r0.on === true && r0.open && r0.title === 'Телевизор' && r0.ch === 'weather',
        'телевизор не включился или окно не то',
        r0,
      );
      await page.click('[data-act="tv-next"]');
      expect((await tvCh()) === 'cook', '▶ не переключил на «У плиты»', await tvCh());
      await page.click('[data-act="tv-ch-news"]');
      expect((await tvCh()) === 'news', 'кнопка канала не переключила на новости', await tvCh());
      await page.click('[data-act="tv-prev"]');
      expect((await tvCh()) === 'animals', '◀ не переключил на животных', await tvCh());
      await page.click('[data-act="tv-ch-weather"]');
      await page.click('[data-act="tv-prev"]');
      expect((await tvCh()) === 'toons', '◀ с первого канала — не на последний (мультики)', await tvCh());
      const on = await ev(() => document.querySelector('.tv-chip.on').dataset.ch);
      expect(on === 'toons', 'в списке каналов подсвечен не тот', on);
      // ✕ закрывает окно, телевизор остаётся включённым на этом канале; «Выключить» — выключает
      await page.click('.panel-head [data-act="close"]');
      await until(() => !document.querySelector('.tv-screen') && !window.__dev.F.tvDebug());
      const r1 = await ev(() => ({
        on: window.__dev.houseItems('villa').find((i) => i.id === 'tv').on,
        ch: window.__dev.G.state.tv.ch,
        modal: window.__dev.G.modal,
      }));
      expect(
        r1.on === true && r1.ch === 'toons' && r1.modal === 0,
        'после ✕ телевизор не на мультиках или окно не закрылось',
        r1,
      );
      await tapTv();
      await page.click('[data-act="tv-off"]');
      await until(() => !document.querySelector('.tv-screen'));
      expect(
        (await ev(() => window.__dev.houseItems('villa').find((i) => i.id === 'tv').on)) === false,
        '«Выключить» не выключил телевизор',
      );
    },
  );

  await step('телевизор: прогноз погоды на сегодня и завтра — как настоящая погода', async () => {
    await L.fresh({ minutes: 9 * 60 });
    // день, где завтра гроза (погода меняется по частям дня)
    const day = await ev(() => {
      const d = window.__dev;
      for (let k = 40; k < 200; k++) if (d.Weather.forecast(k + 1).force === 3) return k;
      return 40;
    });
    await mutate(`s.day = ${day}; s.minutes = 9 * 60;`);
    await ev(() => window.__dev.weather());
    await openTv('weather');
    const r = await ev(async () => {
      const d = window.__dev,
        s = d.G.state,
        D = await import('/js/data/index.js'),
        f0 = d.Weather.forecast(s.day),
        f1 = d.Weather.forecast(s.day + 1),
        now = d.Weather.now(),
        i = d.F.tvDebug().info(),
        txt = (q) => document.querySelector(q).textContent;
      return {
        today: txt('.tv-wx-today'),
        tomorrow: txt('.tv-wx-tomorrow'),
        now: txt('.tv-wx-now'),
        p0: f0.parts.map((p) => p.name),
        p1: f1.parts.map((p) => [p.name, p.from, p.to]),
        nowName: D.weatherName(now.kind, now.force),
        same: i.today.day === s.day && i.tomorrow.day === s.day + 1 && i.tomorrow.force === f1.force,
      };
    });
    expect(r.same, 'на экране прогноз не на сегодня и завтра', r);
    expect(r.now.includes(r.nowName), '«Сейчас» не как погода', r);
    for (const n of r.p0) expect(r.today.includes(n), `сегодня: нет «${n}»`, r);
    for (const [n] of r.p1) expect(r.tomorrow.includes(n), `завтра: нет «${n}»`, r);
    expect(r.p1.length === 3 && /13:00|14:00|15:00/.test(r.tomorrow), 'гроза завтра — не по частям дня', r);
    await closeAll();
    // наступило завтра: погода — как в прогнозе на каждую часть дня
    await ev(() => window.__dev.actions.nextDay());
    for (const [, from, to] of r.p1) {
      const m = Math.min(1439, Math.max(from + 30, 7 * 60));
      if (m >= to) continue;
      await mutate(`s.minutes = ${m};`);
      const ok = await ev(
        ([from, to]) => {
          const d = window.__dev;
          d.weather();
          const f = d.Weather.forecast(),
            p = f.parts.find((q) => q.from === from && q.to === to),
            n = d.Weather.now();
          return !!p && n.kind === p.kind && n.force === p.force;
        },
        [from, to],
      );
      expect(ok, `часть ${from}–${to}: погода не как в прогнозе`);
    }
  });

  await step('телевизор: «У плиты» — раз в 3–4 дня по программе, досмотрела — рецепт один раз', async () => {
    await L.fresh({ villa: 'small' });
    const sch = await ev(async () => {
      const D = await import('/js/data/index.js'),
        days = [];
      for (let d = 15; d < 120; d++) if (D.cookShowOn(d)) days.push(d);
      const gaps = days.slice(1).map((d, i) => d - days[i]);
      return { gaps: [...new Set(gaps)].sort(), list: D.COOK_SHOW, secret: D.SECRET_RECIPES };
    });
    expect(sch.gaps.join() === '3,4', 'шоу не раз в 3–4 дня', sch.gaps);
    expect(
      sch.list.every((id) => sch.secret.includes(id)) && !sch.list.includes('forest_pie'),
      'в шоу не те рецепты',
      sch.list,
    );
    // не день шоу: в программе — когда следующий выпуск
    const off = await ev(async () => {
      const D = await import('/js/data/index.js');
      let d = 30;
      while (D.cookShowOn(d)) d++;
      return { d, next: D.nextCookShow(d) };
    });
    await mutate(`s.day = ${off.d};`);
    await openTv('cook');
    const t0 = await L.text('.tv-cap');
    expect(
      /Следующий выпуск/.test(t0) && /(завтра|послезавтра|через \d)/.test(t0),
      'не сказано, когда следующий выпуск',
      t0,
    );
    expect(/«У плиты»/.test(await L.text('.tv-prog')), 'в программе передач нет «У плиты»');
    expect(!(await ev(() => window.__dev.G.state.tv.show)), 'выпуск записан в день без шоу');
    await closeAll();
    // день шоу: блюдо — секретное и ещё не известное; досмотрела — рецепт
    await mutate(`s.day = ${off.next};`);
    await openTv('cook');
    const show = await ev(() => window.__dev.G.state.tv.show);
    const before = await ev(() => window.__dev.G.state.recipes.length);
    expect(show && show.day === off.next && !show.done, 'выпуск дня не начался', show);
    expect(
      !(await ev((id) => window.__dev.G.state.recipes.includes(id), show.dish)),
      'шеф готовит то, что уже знаешь',
      show,
    );
    expect(/Досмотри до конца/.test(await L.text('.tv-cap')), 'не сказано «досмотри до конца»');
    // переключила канал посреди выпуска — выпуск начнётся сначала
    await ev(() => window.__dev.F.tvDebug().skip(0.5));
    await page.click('[data-act="tv-next"]');
    await page.click('[data-act="tv-prev"]');
    expect((await ev(() => window.__dev.F.tvDebug().st.prog)) < 0.2, 'после переключения выпуск не начался сначала');
    await L.clearToasts();
    await ev(() => window.__dev.F.tvDebug().skip(0.01));
    await until((id) => window.__dev.G.state.recipes.includes(id), show.dish, { msg: 'рецепт после выпуска' });
    const r = await ev(() => ({
      n: window.__dev.G.state.recipes.length,
      show: window.__dev.G.state.tv.show,
      news: window.__dev.G.state.tv.news,
    }));
    expect(r.n === before + 1 && r.show.done, 'рецепт не добавился или выпуск не отмечен', r);
    expect(/Новый рецепт/.test(await L.toasts()), 'нет подсказки «Новый рецепт»');
    expect(
      r.news.some((n) => n.k === 'recipe' && n.id === show.dish),
      'нет новости о рецепте',
      r.news,
    );
    // посмотрела ещё раз — рецепт тот же, второй раз не даётся
    await L.clearToasts();
    await page.click('[data-act="tv-again"]');
    await ev(() => window.__dev.F.tvDebug().skip(0.01));
    await until(() => window.__dev.F.tvDebug().st.prog >= 1);
    await L.wait(300);
    const r2 = await ev(() => ({ n: window.__dev.G.state.recipes.length, dish: window.__dev.G.state.tv.show.dish }));
    expect(r2.n === before + 1 && r2.dish === show.dish, 'второй просмотр дал ещё рецепт', r2);
    expect(!/Новый рецепт/.test(await L.toasts()), 'второй просмотр — снова «Новый рецепт»');
    await closeAll();
  });

  await step('телевизор: «В мире животных» показывает факт о животном, «Ещё факт» — другой', async () => {
    await L.fresh({ villa: 'small' });
    const n = await ev(async () => (await import('/js/data/index.js')).ANIMAL_FACTS.length);
    expect(n >= 20 && n <= 40, 'фактов не 20–40', n);
    await openTv('animals');
    const f0 = await L.text('.tv-fact');
    const ok = await ev(async (t) => (await import('/js/data/index.js')).ANIMAL_FACTS.some((f) => f.text === t), f0);
    expect(f0.length > 20 && ok, 'факт не из списка', f0);
    expect(!!(await L.text('.tv-animal')), 'не сказано, что за животное');
    await page.click('[data-act="tv-fact"]');
    const f1 = await L.text('.tv-fact');
    expect(f1 && f1 !== f0, '«Ещё факт» не сменил факт', [f0, f1]);
    await closeAll();
  });

  await step(
    'телевизор: новости — события игры (место, стройка, карта сокровищ), без новостей — городские мелочи',
    async () => {
      await L.fresh({ villa: 'small', day: 22 });
      await mutate('s.tv.news = [];');
      await openTv('news');
      let t = await L.text('.tv-news');
      expect(t.length > 20, 'без новостей — пусто', t);
      await closeAll();
      await ev(() => {
        const d = window.__dev;
        d.actions.openLand('desert');
        d.villaUp('house1');
        d.emit('cove', { what: 'piece', id: 'tower' });
      });
      await openTv('news');
      t = await L.text('.tv-news');
      expect(/пустыня/.test(t), 'нет новости о пустыне', t);
      expect(/Пристройка/.test(t), 'нет новости о стройке', t);
      expect(/карты сокровищ/.test(t), 'нет новости о карте сокровищ', t);
      expect((await ev(() => document.querySelectorAll('.tv-news li').length)) <= 5, 'новостей больше пяти');
      await closeAll();
    },
  );

  await step('телевизор: старая игра без телевизионного поля открывается, цена телевизора выше прежней', async () => {
    const r = await ev(async () => {
      const R = await import('/js/core/repair.js'),
        D = await import('/js/data/index.js'),
        s = JSON.parse(JSON.stringify(window.__dev.G.state));
      delete s.tv;
      R.repair(s);
      const bad = JSON.parse(JSON.stringify(window.__dev.G.state));
      bad.tv = { ch: 'nope', news: [{ k: 1 }, { k: 'land', id: 'forest', d: 3 }], show: { day: 1, dish: 'xx' } };
      R.repair(bad);
      return { tv: s.tv, bad: bad.tv, price: D.FURN_BY_ID.tv.price };
    });
    expect(
      r.tv && r.tv.ch === 'weather' && Array.isArray(r.tv.news) && r.tv.show === null,
      'старая игра — нет поля tv',
      r.tv,
    );
    expect(r.bad.ch === 'weather' && r.bad.news.length === 1 && r.bad.show === null, 'repair не почистил tv', r.bad);
    expect(r.price > 3000, 'цена телевизора не поднята', r.price);
  });
};

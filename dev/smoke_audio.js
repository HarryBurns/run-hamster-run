// Шаги автотеста этапа 9б «Музыка и звуки»: все файлы музыки и звуков на месте (нет 404), после первого нажатия
// записи звуков загружаются, музыка играет из файла по месту и времени суток, выключение музыки и звуков в меню,
// окно «Авторы» (каждый трек и набор звуков — автор и лицензия), нет файла — играет сочинённая мелодия.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:звук:  (с двоеточием — иначе зацепит и шаг острова «… погода и звук»)
module.exports = async function audio({ page, step, ev, wait, closeAll }) {
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const A = () =>
    ev(() => {
      const a = window.__dev.Audio;
      return { lvl: a.debugLevel(), dbg: a.debugAudio(), muted: a.isMuted(), on: a.isMusicOn() };
    });
  /** Ждать, пока cond(состояние звука) не станет правдой (до ms). */
  const until = async (cond, ms = 9000) => {
    const t0 = Date.now();
    let a = await A();
    while (!cond(a) && Date.now() - t0 < ms) {
      await wait(250);
      a = await A();
    }
    return a;
  };
  const tapCanvas = async () => {
    const box = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
  };
  /**
   * Открыта игра (шаг может идти сразу после шагов заставки — там страница стоит на заставке без игры): «Продолжить»
   * или новая игра (сценку пропустить, как до этапа 10 — без вводной цепочки).
   */
  const ensureGame = async () => {
    await closeAll();
    if (await ev(() => !!(window.__dev && window.__dev.G.state && window.__dev.sceneName))) return;
    const cont = await page.$('text=Продолжить');
    if (cont) await cont.click();
    else {
      await page.click('text=Играть!');
      await page.click('text=Пропустить');
      await ev(() => window.__dev.oldStart());
      await wait(400);
      await page.click('text=Поехали!');
    }
    await wait(700);
    await closeAll();
  };
  const toWorld = (minutes) =>
    ev((m) => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.minutes = m;
        s.weather = 'sun';
      });
      if (d.sceneName !== 'world') d.go('world');
    }, minutes);

  await step('звук: файлы музыки и звуков на месте (нет 404), у каждого трека — автор', async () => {
    await closeAll();
    const { files } = (await A()).dbg;
    const music = [...new Set(Object.values(files.music).flat())];
    const urls = [...files.sfx, ...music.map((f) => 'assets/audio/music/' + f + '.mp3')];
    const bad = await ev(async (urls) => {
      const out = [];
      for (const u of urls) {
        const r = await fetch(u, { method: 'HEAD' });
        if (!r.ok) out.push(r.status + ' ' + u);
      }
      return out;
    }, urls);
    expect(urls.length > 60 && !bad.length, 'файлы звука не загружаются', bad);
    const credits = await ev(async () => (await import('./js/data/credits.js')).MUSIC_CREDITS.map((c) => c.file));
    const noCredit = music.filter((f) => !credits.includes(f)),
      unused = credits.filter((f) => !music.includes(f));
    expect(!noCredit.length && !unused.length, 'треки и «Авторы» не совпадают', { noCredit, unused });
  });

  await step('звук: после нажатия записи загружаются, музыка — из файла по месту и времени суток', async () => {
    await ensureGame();
    await ev(() => window.__dev.Audio.setMusicOn(true));
    await tapCanvas();
    let a = await until((a) => a.dbg.unlocked && a.dbg.sfxLoaded >= a.dbg.sfxNames - 1);
    expect(a.dbg.unlocked, 'звук не разрешился нажатием');
    expect(a.dbg.sfxLoaded >= a.dbg.sfxNames - 1 && !a.dbg.sfxFailed.length, 'записи звуков не загрузились', a.dbg);
    // город днём — трек сезона из файла
    await toWorld(12 * 60);
    const season = await ev(async () => (await import('./js/core/state.js')).cal().season);
    a = await until((a) => a.lvl && a.lvl.track && a.lvl.track.startsWith('town_') && a.lvl.file);
    expect(a.lvl.track.startsWith('town_') && a.lvl.file && !a.lvl.synth, 'в городе не играет музыка из файла', a.lvl);
    expect(a.lvl.track === 'town_' + season, 'музыка не того сезона', { season, lvl: a.lvl });
    expect(a.dbg.files.music[a.lvl.track].includes(a.lvl.file), 'файл не из списка трека', a.lvl);
    // ночью — ночная, и плавно: старый проигрыватель затихает, а не обрывается
    await toWorld(23 * 60);
    a = await until((a) => a.lvl.track === 'night' && a.lvl.file);
    expect(a.lvl.track === 'night' && a.lvl.file, 'ночью не ночная музыка', a.lvl);
    await wait(2200);
    a = await A();
    expect(
      a.dbg.decks.filter((d) => d.busy && !d.paused).length === 1,
      'после перехода играет не один трек',
      a.dbg.decks,
    );
    expect(!a.dbg.musicFailed.length, 'какие-то треки не загрузились', a.dbg.musicFailed);
    // звуки играют записью (без ошибок) — и шаги по траве
    await ev(() =>
      ['tap', 'pop', 'coin', 'ok', 'win', 'step', 'stepSand', 'door', 'drip'].forEach((n) => window.__dev.Audio.sfx(n)),
    );
    await toWorld(12 * 60);
  });

  await step('звук: выключить музыку и звуки в меню — и включить обратно', async () => {
    await ensureGame();
    await ev(() => window.__dev.F.openSettings());
    await wait(300);
    await page.click('.overlay .panel button:has-text("Музыка включена")');
    let a = await until((a) => !a.lvl.track && a.dbg.decks.every((d) => d.paused || !d.busy), 4000);
    expect(!a.on && !a.lvl.track, 'музыка не выключилась', a.lvl);
    expect(
      a.dbg.decks.every((d) => d.paused || !d.busy),
      'проигрыватель музыки не остановился',
      a.dbg.decks,
    );
    await page.click('.overlay .panel button:has-text("Музыка выключена")');
    a = await until((a) => a.lvl.track && a.lvl.file, 5000);
    expect(a.on && a.lvl.track && a.lvl.file, 'музыка не включилась обратно', a.lvl);
    await page.click('.overlay .panel button:has-text("Звуки включены")');
    a = await A();
    expect(a.muted, 'звуки не выключились');
    await ev(() => window.__dev.Audio.sfx('tap'));
    await page.click('.overlay .panel button:has-text("Звуки выключены")');
    a = await A();
    expect(!a.muted, 'звуки не включились обратно');
    await closeAll();
  });

  await step('звук: меню «Авторы» — все треки и наборы звуков с автором и лицензией', async () => {
    await ensureGame();
    await ev(() => window.__dev.F.openSettings());
    await wait(300);
    await page.click('.overlay .panel button:has-text("Авторы")');
    await wait(300);
    const r = await ev(async () => {
      const c = await import('./js/data/credits.js');
      const p = document.querySelector('.overlay .panel.credits');
      const t = p ? p.textContent : '';
      return {
        open: !!p,
        missing: [...c.MUSIC_CREDITS, ...c.SFX_CREDITS].map((x) => x.title).filter((n) => !t.includes(n)),
        lic: t.includes('CC BY 4.0') && t.includes('CC0') && t.includes('Kevin MacLeod') && t.includes('Kenney'),
        wide: p ? p.scrollWidth > p.clientWidth + 2 : false,
      };
    });
    expect(r.open, 'окно «Авторы» не открылось');
    expect(!r.missing.length && r.lic, 'в «Авторах» не всё', r);
    expect(!r.wide, 'окно «Авторы» шире экрана');
    await closeAll();
  });

  await step(
    'звук: нет файла музыки — играет сочинённая мелодия, без поломок',
    async () => {
      await ensureGame();
      await page.route('**/assets/audio/music/*.mp3', (route) => route.fulfill({ status: 404, body: '' }));
      try {
        // тот же трек с начала: «забыть» уже открытые файлы — перезагрузить страницу
        await page.reload();
        await wait(600);
        const cont = await page.$('text=Продолжить');
        if (cont) await cont.click();
        await wait(600);
        await closeAll();
        await tapCanvas();
        await toWorld(12 * 60);
        const a = await until((a) => a.lvl && a.lvl.track && a.lvl.synth, 9000);
        expect(a.lvl && a.lvl.track && a.lvl.synth && !a.lvl.file, 'без файла не заиграла сочинённая мелодия', a.lvl);
        expect(a.dbg.musicFailed.length > 0, 'ошибка загрузки не замечена', a.dbg);
      } finally {
        // файлы музыки — снова на месте, даже если шаг упал (иначе следующие шаги ловят ошибки 404)
        await page.unroute('**/assets/audio/music/*.mp3');
      }
      await page.reload();
      await wait(600);
      const c2 = await page.$('text=Продолжить');
      if (c2) await c2.click();
      await wait(600);
      await closeAll();
    },
    { expectErrors: '404' },
  );
};

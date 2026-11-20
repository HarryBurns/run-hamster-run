// Шаги автотеста: «Погода по всему миру» — погода дня одна на мир и известна заранее (data/weather.js), места
// откликаются на погоду города по смыслу, гроза, ливень и метель, жители в плохую погоду сидят по домам, а в дождик
// гуляют с зонтиками и в дождевиках. Заставка с грозой последней игры — dev/smoke_title.js.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:погода:"
const lib = require('./lib.js');

module.exports = async function weather(ctx) {
  const { step, ev, expect, fresh, frames, mutate, go, toasts, clearToasts, until, toPlace } = lib(ctx);

  /** День без праздника (и не накануне), начиная с from. */
  const plainDay = (from = 20) =>
    ev(async (from) => {
      const D = await import('/js/data/index.js'),
        s = window.__dev.G.state;
      for (let d = from; d < from + 60; d++)
        if (!D.holidayOn(d, s.startDay || 0) && !D.holidayOn(d + 1, s.startDay || 0)) return d;
      return from;
    }, from);
  /** Погода города сейчас: weather('rain', 3); без вида — по расписанию дня. */
  const setWx = (kind, force = 1) => ev(([k, f]) => window.__dev.weather(k, f), [kind, force]);
  const at = (place) => ev((p) => window.__dev.Weather.at(p), place);
  /** Жители города: кого видно на улице, кто дома по общему правилу. */
  const town = () =>
    ev(async () => {
      const Q = await import('/js/core/state.js'),
        D = await import('/js/data/index.js'),
        sc = window.__dev.locations.world,
        out = {};
      for (const n of sc.npcs)
        if (D.NPC_HOME[n.id])
          out[n.id] = { at: Q.npcPlace(n.id).at, street: !n.hidden && !n.inside, rain: Q.npcRain(n.id) };
      return out;
    });

  await step('погода: прогноз на завтра совпадает с погодой следующего дня', async () => {
    await fresh({ dayFlags: true });
    const r = await ev(async () => {
      const d = window.__dev,
        W = d.Weather,
        bad = [],
        seen = new Set();
      let storm = null;
      for (let day = 40; day < 120; day++) {
        d.actions.mutate((s) => {
          s.day = day;
        });
        const f = W.forecast(day + 1); // прогноз, каким его показали бы сегодня
        const cover = f.parts[0].from === 0 && f.parts[f.parts.length - 1].to === 1440;
        if (!cover || f.parts.some((p, i) => i && p.from !== f.parts[i - 1].to))
          bad.push(`день ${day + 1}: части не покрывают сутки`);
        d.actions.nextDay();
        const now = W.now(),
          p = f.parts.find((q) => d.G.state.minutes < q.to);
        if (now.kind !== p.kind || now.force !== p.force)
          bad.push(`день ${day + 1}: прогноз ${p.name}, а на деле ${now.kind} ${now.force}`);
        seen.add(f.name);
        if (f.force === 3 && !storm) storm = f;
      }
      return { bad, seen: [...seen], storm };
    });
    expect(!r.bad.length, 'прогноз не сбылся', r.bad);
    for (const name of ['гроза', 'ливень', 'метель', 'дождик', 'снег', 'ясно'])
      expect(r.seen.includes(name), `за 80 дней ни разу не было: ${name}`, r.seen);
    // день грозы: до обеда ясно, гроза начинается в свой час (когда время доходит до него), потом — дождик
    const st = r.storm,
      mid = st.parts[1];
    expect(st.parts.length === 3 && mid.force === 3 && st.parts[0].force === 0, 'у дня грозы не три части', st.parts);
    await mutate(`s.day = ${st.day}; s.minutes = ${mid.from - 2};`);
    await setWx();
    expect((await ev(() => window.__dev.Weather.now())).force === 0, 'до грозы уже идёт дождь');
    await ev(() => window.__dev.actions.passTime(3)); // 5 игровых минут
    const now = await ev(() => window.__dev.Weather.now());
    expect(now.kind === 'rain' && now.force === 3, 'гроза не началась в свой час', now);
    await ev((m) => window.__dev.actions.spendMinutes(m), mid.to - mid.from);
    const after = await ev(() => window.__dev.Weather.now());
    expect(after.kind === 'rain' && after.force === 1, 'после грозы — не дождик', after);
    // первые дни игры — без сильной погоды
    const calm = await ev(async () => {
      const D = await import('/js/data/index.js');
      for (let start = 0; start < 400; start++)
        for (let i = 0; i < D.WEATHER_CALM_DAYS; i++) if (D.weatherOfDay(start + i, start).force >= 2) return start;
      return -1;
    });
    expect(calm < 0, 'в первые дни игры бывает ливень, гроза или метель', calm);
    await setWx('sun');
  });

  await step('погода: места откликаются на погоду города по смыслу', async () => {
    await fresh({ dayFlags: true });
    const day = await plainDay(60); // осень: ни зимы, ни праздника
    await mutate(`s.day = ${day}; s.minutes = 12 * 60;`);
    // дождь в городе → в джунглях тёплый дождик и туман, в лесу и на горе — дождь; остров, бухта, пустыня — без дождя
    await setWx('rain', 1);
    let j = await at('jungle');
    expect(j.kind === 'rain' && j.warm && j.mist > 0.2, 'городской дождь: в джунглях нет дождика с туманом', j);
    expect(
      (await at('forest')).kind === 'rain' && (await at('mountain')).kind === 'rain',
      'в лесу и на горе нет дождя',
    );
    expect(
      (await at('island')).kind === 'sun' && (await at('cove')).kind === 'sun',
      'дождик дошёл до острова или бухты',
    );
    expect((await at('desert')).kind === 'cloudy' && (await at('desert')).force === 0, 'в пустыне не пасмурно');
    // гроза → на острове и в бухте облачно и тёплый дождик, в пустыне — пыльный ветер, в джунглях туман гуще
    await setWx('rain', 3);
    const mist1 = j.mist;
    j = await at('jungle');
    expect(j.kind === 'rain' && j.force === 1 && j.mist > mist1, 'гроза: в джунглях туман не гуще', j);
    for (const p of ['island', 'cove']) {
      const w = await at(p);
      expect(w.kind === 'rain' && w.force === 1 && w.warm && w.cloud > 0, `гроза: ${p} — не облачно с дождиком`, w);
    }
    expect((await at('desert')).kind === 'dust', 'гроза: в пустыне нет пыльного ветра');
    expect((await at('forest')).force === 3 && (await at('world')).force === 3, 'гроза не дошла до леса');
    // снег → в джунглях пасмурно, снега нет; на горе снег; метель → на горе метель, на острове облачно
    await setWx('snow', 1);
    j = await at('jungle');
    expect(j.kind === 'cloudy' && j.force === 0 && j.cloud > 0, 'городской снег: в джунглях не пасмурно', j);
    expect(
      (await at('mountain')).kind === 'snow' && (await at('forest')).kind === 'snow',
      'на горе или в лесу нет снега',
    );
    expect((await at('island')).kind === 'sun', 'снежок дошёл до острова');
    await setWx('snow', 2);
    expect((await at('mountain')).force === 2, 'метель не дошла до горы');
    expect((await at('island')).kind === 'cloudy' && (await at('desert')).kind === 'dust', 'метель: остров и пустыня');
    // ясно: в джунглях туман только утром, в лесу — утренний туман
    await setWx('sun');
    expect((await at('jungle')).mist === 0 && (await at('forest')).mist === 0, 'днём в ясный день туман');
    await mutate('s.minutes = 6 * 60 + 30;');
    expect((await at('jungle')).mist > 0.5 && (await at('forest')).mist > 0.2, 'утром нет тумана');
    // в самих местах: джунгли после городского дождя — капли и туман рисует движок, промокнуть нельзя
    await mutate('s.minutes = 12 * 60;');
    await setWx('rain', 2);
    await toPlace('jungle');
    await frames(3);
    const inJ = await ev(async () => {
      const J = await import('/js/locations/jungle.js'),
        sc = window.__dev.scene;
      return {
        drizzle: J.drizzleNow(),
        mist: J.mistNow(),
        drops: sc.weather.length,
        dry: sc.dry(),
        sound: sc.sound().rain,
      };
    });
    expect(
      inJ.drizzle && inJ.mist > 0.3 && inJ.drops > 20 && inJ.dry && inJ.sound > 0,
      'джунгли в городской ливень',
      inJ,
    );
    await setWx('snow', 2);
    await toPlace('mountain');
    await frames(3);
    const inM = await ev(() => ({ n: window.__dev.scene.weather.length, wx: window.__dev.scene.wx() }));
    expect(inM.n >= 120 && inM.wx.kind === 'snow', 'на горе нет метели', inM);
    await toPlace('desert');
    await frames(3);
    const inD = await ev(() => ({ n: window.__dev.scene.weather.length, wx: window.__dev.scene.wx().kind }));
    expect(inD.n > 10 && inD.wx === 'dust', 'в пустыне нет пыльного ветра', inD);
    await setWx('sun');
  });

  await step('погода: гроза — тёмное небо, ливень, вспышки и тихий гром; подсказка один раз', async () => {
    await fresh({ dayFlags: true });
    const day = await plainDay(60);
    await mutate(`s.day = ${day}; s.minutes = 14 * 60;`);
    await setWx('rain', 3);
    await clearToasts();
    await go('world');
    await frames(4);
    const r = await ev(async () => {
      const R = await import('/js/engine/topdown/render.js'),
        d = window.__dev,
        sc = d.scene;
      let max = 0,
        lit = 0;
      for (let t = 0; t < 140; t += 0.02) {
        const k = R.lightning(t);
        max = Math.max(max, k);
        if (k > 0.02) lit += 0.02;
      }
      const sky = document.getElementById('sky');
      return {
        drops: sc.weather.length,
        wx: sc.wx(),
        max,
        lit,
        sky: !!sky && sky.style.display !== 'none',
        rain: sc.sound().rain,
      };
    });
    expect(r.wx.force === 3 && r.drops >= 150, 'в грозу не ливень', r);
    expect(r.sky, 'в грозу нет тёмной пелены неба');
    expect(r.max > 0.8 && r.max <= 1 && r.lit > 4 && r.lit < 12, 'вспышки: слишком редко или слишком часто', r);
    await until(() => /Гроза/.test(document.querySelector('#toasts').textContent), null, 'нет подсказки про грозу');
    expect(/по домам/.test(await toasts()), 'подсказка не про жителей', await toasts());
    // гром: после очередной вспышки — тихий раскат
    await until(() => window.__dev.Audio.debugHeard().includes('thunder'), null, {
      msg: 'грома не слышно',
      timeout: 25000,
    });
    await clearToasts();
    await go('villa');
    await go('world');
    await frames(5);
    expect(!/Гроза/.test(await toasts()), 'подсказка про грозу показана второй раз');
    // в доме слышно погоду места, где он стоит: в хижине на острове городской грозы нет (там тёплый дождик),
    // в отеле в городе — гроза; на вилле (без места снаружи) — погода города
    const heard = () => ev(async () => (await import('/js/features/soundscape.js')).soundWx(window.__dev.scene));
    await toPlace('island');
    await go('hut_guest');
    let h = await heard();
    expect(h.force < 3, 'в хижине на острове слышно городскую грозу', h);
    await go('world');
    await ev(() => window.__dev.enterBuilding('hotel'));
    await until(() => window.__dev.sceneName && window.__dev.scene.name === 'hotel', null, 'не вошли в отель');
    h = await heard();
    expect(h.force === 3, 'в отеле в городе не слышно городской грозы', h);
    await go('villa');
    h = await heard();
    expect(h.force === 3, 'на вилле не слышно городской грозы', h);
    await go('world');
    // простуда: гроза — тот же дождь, промокнуть можно; в джунглях — нет
    const wet = await ev(() => window.__dev.scene.wx().kind === 'rain' && !window.__dev.scene.dry());
    expect(wet, 'в грозу в городе не промокнуть');
    await setWx('sun');
  });

  await step('погода: метель видна и на белом снегу — серая мгла, белые порывы, хлопья с тенью', async () => {
    await fresh({ start: 'old', dayFlags: true });
    await mutate('s.minutes = 12 * 60;');
    await setWx('snow', 2);
    await go('world');
    await frames(6);
    const r = await ev(async () => {
      const sky = document.getElementById('sky'),
        c = sky.getContext('2d'),
        px = c.getImageData(0, 0, sky.width, sky.height).data;
      let minR = 255,
        maxA = 0,
        minA = 255;
      for (let i = 0; i < px.length; i += 4) {
        minA = Math.min(minA, px[i + 3]);
        maxA = Math.max(maxA, px[i + 3]);
        if (px[i + 3] > 40) minR = Math.min(minR, px[i]);
      }
      return {
        on: sky.style.display !== 'none',
        minR: Math.round(minR),
        minA,
        maxA,
        n: window.__dev.scene.weather.length,
      };
    });
    // мгла — холодная серая (не белая: на белой белых хлопьев не видно), поверх — светлые порывы (слой неровный)
    expect(r.on && r.n >= 150, 'в метель нет слоя неба или мало хлопьев', r);
    expect(r.minR < 200, 'мгла метели слишком белая', r);
    expect(r.maxA - r.minA > 20, 'в метель нет порывов снега', r);
    await setWx('sun');
  });

  await step(
    'погода: в ливень, грозу и метель жители сидят по домам, в дождик гуляют — с зонтиками и в дождевиках',
    async () => {
      await fresh({ dayFlags: true });
      const day = await plainDay(60);
      await mutate(`s.day = ${day}; s.minutes = 12 * 60;`);
      // дождик: планы не меняются — все на улице, у каждого зонтик или дождевик с сапожками
      await setWx('rain', 1);
      await go('world');
      await frames(4);
      let t = await town();
      const ids = Object.keys(t);
      expect(ids.length >= 8, 'жителей города меньше восьми', ids);
      // (кто по расписанию в отеле — тот в отеле: планы в дождик не меняются)
      const hotel = (q) => q.at === 'pool' || q.at === 'room';
      expect(
        ids.every((id) => hotel(t[id]) || (t[id].at === 'out' && t[id].street)),
        'в дождик кто-то не на улице',
        t,
      );
      expect(
        ids.every((id) => t[id].rain && (t[id].rain.umbrella || (t[id].rain.coat && t[id].rain.boots))),
        'кто-то без зонтика и без дождевика',
        t,
      );
      expect(ids.some((id) => t[id].rain.umbrella) && ids.some((id) => t[id].rain.coat), 'у всех одно и то же', t);
      // рисунок: кадры жителей — «дождевые» (зонтик — в том же кадре спрайта)
      for (const id of ['plusha', 'ponchik', 'myata']) {
        await ev((id) => {
          const d = window.__dev,
            n = d.scene.npcs.find((q) => q.id === id);
          d.scene.debugTeleport((n.x + 40) / 48, (n.y + 30) / 48);
        }, id);
        await frames(4);
      }
      const keys = await ev(() => {
        const SP = window.__dev.topdown.SP,
          sc = window.__dev.scene,
          out = {};
        for (const n of sc.npcs) {
          let rain = 0,
            plain = 0;
          for (const dir of [-1, 0, 1])
            for (let fr = 0; fr < 12; fr++)
              for (const shut of [0, 1]) {
                if (SP.find(`npc:${n.id}::rain:${dir}:${fr}:${shut}`)) rain++;
                if (SP.find(`npc:${n.id}::${dir}:${fr}:${shut}`)) plain++;
              }
          out[n.id] = [rain, plain];
        }
        return out;
      });
      expect(
        ids.filter((id) => keys[id] && keys[id][0] > 0).length >= 3,
        'жителей под дождём не рисуют с зонтиками',
        keys,
      );
      // имя над жителем под зонтиком — над куполом, не на нём (верх купола — 160 единиц рисунка над лапами)
      const lift = await ev(async () => {
        const A = await import('/js/engine/topdown/actors.js'),
          K = await import('/js/engine/topdown/kinds.js'),
          Q = await import('/js/core/state.js'),
          n = window.__dev.scene.npcs.find((q) => q.home && (Q.npcRain(q.id) || {}).umbrella);
        const labelBottom = -(66 + A.umbrellaLift(n)) + 9,
          dome = 10 - 160 * K.PS;
        return { id: n.id, labelBottom, dome };
      });
      expect(lift.labelBottom < lift.dome - 2, 'имя жителя лежит на куполе зонтика', lift);
      // бассейн отеля — на открытой террасе: в любой дождь у него никого (по расписанию пришли бы — гуляют в городе)
      const poolRain = await ev(async () => {
        const D = await import('/js/data/index.js'),
          Q = await import('/js/core/state.js'),
          d = window.__dev,
          s = d.G.state;
        for (let day = s.day; day < s.day + 30; day++)
          for (let h = 8; h < 20; h++)
            if (D.poolGuestsOn(day, h * 60).length && !D.holidayOn(day, s.startDay || 0)) {
              s.day = day;
              s.minutes = h * 60 + 10;
              d.weather('rain', 1);
              const rain = Q.hotelPoolGuests().length,
                id = D.poolGuestsOn(day, s.minutes)[0],
                at = Q.npcPlace(id).at;
              d.weather('sun');
              return { day, h, rain, at, sun: Q.hotelPoolGuests().length };
            }
        return null;
      });
      expect(poolRain && poolRain.sun > 0, 'не нашлось дня с гостями у бассейна', poolRain);
      expect(poolRain.rain === 0 && poolRain.at === 'out', 'в дождик кто-то у открытого бассейна', poolRain);
      await mutate(`s.day = ${day}; s.minutes = 12 * 60;`);
      await setWx('rain', 1);
      // без дождя — ни зонтиков, ни дождевиков
      await setWx('leaves');
      t = await town();
      expect(
        ids.every((id) => !t[id].rain),
        'дождя нет, а зонтики остались',
        t,
      );
      // ливень, гроза, метель: все дома (на улице никого), дверь открыта — можно в гости
      for (const [kind, force] of [
        ['rain', 2],
        ['rain', 3],
        ['snow', 2],
      ]) {
        await setWx(kind, force);
        await go('villa');
        await go('world');
        await frames(4);
        t = await town();
        expect(
          ids.every((id) => t[id].at === 'home' && !t[id].street),
          `${kind} ${force}: кто-то не дома`,
          t,
        );
      }
      const pool = await ev(async () => (await import('/js/core/state.js')).hotelPoolGuests().length);
      expect(pool === 0, 'в метель кто-то у бассейна отеля');
      // погода наладилась — выходят
      await setWx('snow', 1);
      await go('villa');
      await go('world');
      await frames(4);
      t = await town();
      expect(
        ids.every((id) => hotel(t[id]) || (t[id].at === 'out' && t[id].street)),
        'снежок: кто-то не вышел',
        t,
      );
      // праздник проходит и под ливнем: жители на празднике, с зонтиками и в дождевиках
      const fest = await ev(async () => {
        const D = await import('/js/data/index.js'),
          Q = await import('/js/core/state.js'),
          d = window.__dev;
        for (const h of D.HOLIDAYS) {
          const g = (D.HOLIDAY_GATHER[h.id] || []).find((q) => q.kind !== 'doors');
          if (!g) continue;
          d.holiday.to(h.id, 'day', 2, Math.round(((g.from + g.to) / 2) * 60));
          if (!D.gatherOn(h.id, d.G.state.minutes)) continue;
          d.weather('rain', 2);
          const at = Object.keys(D.NPC_HOME).map((id) => Q.npcPlace(id).at);
          return { id: h.id, at, rain: !!Q.npcRain('plusha') };
        }
        return null;
      });
      if (fest)
        expect(fest.at.every((a) => a === 'fest') && fest.rain, 'праздник под ливнем: жители не на празднике', fest);
      await setWx('sun');
    },
  );
};

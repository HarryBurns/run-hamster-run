// Шаги автотеста: одно правило «где житель сейчас» (npcPlace в core/queries.js) — житель в каждый момент ровно в одном
// месте: на улице (в городе или в своём тайном месте), в своём доме, в гостях у хомячка, в отеле (у бассейна, в номере
// 203). Проверяется, что показывают сами сцены: кого видно на улице (engine/topdown/actors.js — n.hidden), кто внутри
// его дома (жилец с when — interiors/), гости (state.guests), отель (жильцы отеля с when).
// Баги заказчика: «зашла к Бархану — он дома, вышла — он на улице»; «вечером житель у меня в гостях, а у его двери
// написано, что он спит».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:где житель"
const lib = require('./lib.js');

module.exports = async function where(ctx) {
  const { step, ev, expect, fresh, frames, closeAll, mutate, go, toasts, clearToasts, until } = lib(ctx);

  /** Тайные места и их хозяева с домами: где дом (здание в локации) и сцена дома. */
  const LANDS = ['forest', 'mountain', 'desert', 'jungle', 'island'];
  /** Открыть все тайные места. */
  const openLands = () =>
    ev((lands) => {
      const d = window.__dev;
      for (const id of lands) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
    }, LANDS);
  /** День без праздника (и не накануне — чтобы праздники не мешали проверке часов). */
  const plainDay = () =>
    ev(async () => {
      const D = await import('/js/data/index.js'),
        s = window.__dev.G.state;
      for (let d = 20; d < 60; d++)
        if (!D.holidayOn(d, s.startDay || 0) && !D.holidayOn(d + 1, s.startDay || 0)) return d;
      return 20;
    });

  /**
   * Где сейчас каждый житель (город и хозяева тайных мест) — по тому, что показывают сцены. Хомячок по очереди заходит
   * в город и каждое тайное место (на улице — кого видно после того, как все встали по местам), а дома и отель — по
   * их жильцам (when). Возвращает { id: { street, house, guest, pool, room, asleep, at } }.
   */
  const census = async () => {
    const out = {};
    for (const loc of ['world', ...LANDS]) {
      await go(loc);
      await frames(3);
      const r = await ev(async (loc) => {
        const d = window.__dev,
          H = await import('/js/interiors/houses.js'),
          Q = await import('/js/core/state.js'),
          s = d.G.state,
          sc = d.locations[loc],
          hotel = H.HOUSE_BY_ID.hotel,
          room = H.HOUSE_BY_ID.hotel_203,
          res = {};
        for (const n of sc.npcs) {
          const p = Q.npcPlace(n.id);
          if (!p) continue; // без дома и расписания (Камушкин, Жемчужинка) — всегда на своём месте
          const inHouse = (desc) => {
            const a = desc && (desc.actors || []).find((q) => q.npc === n.id);
            return !!a && (!a.when || !!a.when());
          };
          res[n.id] = {
            at: p.at,
            street: !n.hidden,
            house: inHouse(H.HOUSE_BY_ID[p.house]),
            asleep: p.at === 'asleep', // спит у себя дома: внутри его не видно, дверь говорит «спит»
            guest: s.guests.includes(n.id),
            pool: inHouse(hotel),
            room: inHouse(room),
          };
        }
        return res;
      }, loc);
      Object.assign(out, r);
    }
    return out;
  };
  /** Жители, которые не ровно в одном месте: [{ id, где }]. */
  const notOne = (c) =>
    Object.entries(c)
      .map(([id, r]) => ({
        id,
        at: r.at,
        places: ['street', 'house', 'asleep', 'guest', 'pool', 'room'].filter((k) => r[k]),
      }))
      .filter((r) => r.places.length !== 1);

  await step(
    'где житель: каждый житель (город и тайные места) в разное время суток — ровно в одном месте',
    async () => {
      await fresh({ weather: 'sun', dayFlags: true });
      await openLands();
      const day = await plainDay();
      await mutate(`s.day = ${day}; s.dayFlags = {}; s.guests = []; s.guestsAt = 'villa';`);
      await ev(() => window.__dev.actions.setMail('cook')); // не «день гостей»
      const seen = {};
      for (const h of [8, 11, 13.5, 15.5, 17.5, 20, 23]) {
        await mutate(`s.minutes = ${Math.round(h * 60)};`);
        const c = await census();
        const bad = notOne(c);
        expect(!bad.length, `${h}:00 — житель не ровно в одном месте`, bad);
        expect(Object.keys(c).length >= 15, `${h}:00 — переписали не всех жителей`, Object.keys(c));
        for (const [id, r] of Object.entries(c)) (seen[id] = seen[id] || new Set()).add(r.at);
      }
      // за день каждый побывал и на улице, и дома (у городских — ещё и спит)
      for (const [id, set] of Object.entries(seen))
        expect(set.has('out') && (set.has('home') || set.has('asleep')), `${id}: за день не был и дома, и на улице`, [
          ...set,
        ]);
      // гости, «позвал к себе», отель и праздник — тоже ровно одно место
      await mutate('s.minutes = 20 * 60;');
      await ev(() => window.__dev.actions.inviteGuest('plusha', 'villa'));
      await ev(() => window.__dev.actions.inviteHome('bob'));
      let c = await census();
      expect(!notOne(c).length, '20:00, Плюша в гостях — не ровно в одном месте', notOne(c));
      expect(c.plusha.guest && !c.plusha.house && !c.plusha.street, 'Плюша в гостях, а видна ещё где-то', c.plusha);
      await mutate('s.minutes = 12 * 60;');
      c = await census();
      expect(c.bob.house && !c.bob.street, 'Боб позвал к себе, а гуляет по улице', c.bob);
      // день, когда у бассейна отеля кто-то отдыхает (не тот, у кого дело по журналу, — тот остаётся в городе)
      const pool = await ev(async () => {
        const D = await import('/js/data/index.js'),
          Q = await import('/js/core/state.js'),
          a = window.__dev.actions;
        // все задания сделаны — ни у кого нет «!» / «?» (с делом по журналу житель в отель не уходит)
        a.mutate((s) => {
          for (const q of D.QUESTS) s.quests[q.id] = { day: 1, n: {}, got: {}, done: 1 };
        });
        for (let d = 20; d < 120; d++) {
          if (D.holidayOn(d, window.__dev.G.state.startDay || 0)) continue;
          a.mutate((s) => {
            s.day = d;
            s.minutes = 15 * 60;
            s.dayFlags = {};
            s.guests = [];
          });
          const ids = Q.hotelPoolGuests();
          if (ids.length) return { d, ids };
        }
        return null;
      });
      expect(!!pool, 'нет дня с гостем у бассейна (проверка не годится)');
      c = await census();
      expect(!notOne(c).length, 'у бассейна — не ровно в одном месте', notOne(c));
      expect(
        pool.ids.every((id) => c[id].pool && !c[id].street),
        'житель у бассейна гуляет и по городу',
        pool.ids.map((id) => [id, c[id]]),
      );
      // праздник: Иван Купала (день 18) вечером — хоровод у костра, дома никого
      await mutate('s.day = 18; s.minutes = 20 * 60; s.dayFlags = {}; s.guests = [];');
      c = await census();
      expect(!notOne(c).length, 'Купала, 20:00 — не ровно в одном месте', notOne(c));
      expect(
        c.myata.at === 'fest' && c.myata.street && !c.myata.house,
        'Купала вечером: Мята не на празднике',
        c.myata,
      );
    },
  );

  /** Хомячок в локации loc у здания b; вошла в дом (как через дверь), потом вышла (dev-переход назад). */
  const enterHouse = async (loc, b, id) => {
    await go(loc);
    await ev(
      ([loc, b]) => window.__dev.locations[loc].enterBuilding(window.__dev.locations[loc].map.bById[b]),
      [loc, b],
    );
    await until((id) => window.__dev.sceneName === id, id, { timeout: 8000 });
    await frames(3);
  };
  /** Внутри ли (виден) хозяин в доме, где сейчас хомячок. */
  const hostInside = (id) =>
    ev((id) => {
      const g = window.__dev.scene.actors.find((q) => q.id === id);
      return !!g && (!g.when || !!g.when());
    }, id);
  /** Виден ли житель id на улице локации loc (после выхода туда). */
  const onStreet = async (loc, id) => {
    await go(loc);
    await frames(3);
    return ev(([loc, id]) => !window.__dev.locations[loc].npcs.find((n) => n.id === id).hidden, [loc, id]);
  };

  await step(
    'где житель: Бархан — дома в шатре, вышла — его нет на улице; днём — наоборот; при тебе не уходит',
    async () => {
      await fresh({ weather: 'sun', dayFlags: true });
      await openLands();
      const day = await plainDay();
      await mutate(`s.day = ${day}; s.minutes = 20 * 60;`);
      // вечер: Бархан у себя в шатре
      await enterHouse('desert', 'tent', 'tent_barkhan');
      expect(await hostInside('barkhan'), 'вечером Бархана нет в шатре');
      expect(!(await onStreet('desert', 'barkhan')), 'вышла из шатра — а Бархан и на улице');
      // днём: на улице у своего дела, в шатре пусто
      await mutate('s.minutes = 12 * 60;');
      expect(await onStreet('desert', 'barkhan'), 'днём Бархана нет на улице');
      await enterHouse('desert', 'tent', 'tent_barkhan');
      expect(!(await hostInside('barkhan')), 'днём Бархан и на улице, и в шатре');
      // зашла утром, пока он дома, засиделась до 9:30 — он при тебе не уходит; вышла — он уже на улице
      await mutate('s.minutes = 8 * 60 + 50;');
      await go('desert');
      await enterHouse('desert', 'tent', 'tent_barkhan');
      expect(await hostInside('barkhan'), 'утром Бархана нет в шатре');
      await mutate('s.minutes = 9 * 60 + 30;');
      await frames(3);
      expect(await hostInside('barkhan'), 'Бархан исчез из шатра посреди визита');
      expect(await onStreet('desert', 'barkhan'), 'вышла из шатра в 9:30 — Бархана нет на улице');
      // звёздочка задания Бархана вечером ведёт к двери шатра, днём — к нему самому
      await ev(() => window.__dev.goal.set('camel_bell'));
      await mutate('s.minutes = 20 * 60;');
      await go('desert');
      await frames(3);
      const st = await ev(() => {
        const sc = window.__dev.locations.desert;
        return { t: sc.target(), door: sc.doorOf('tent') };
      });
      expect(
        !!st.t && Math.abs(st.t.x - st.door.x) < 30 && Math.abs(st.t.y - st.door.y) < 100,
        'вечером звёздочка задания Бархана не у двери шатра',
        st,
      );
      // в шатре — тот же разговор и задание
      await enterHouse('desert', 'tent', 'tent_barkhan');
      await ev(() => void window.__dev.run('nomad')); // разговор ждёт ответа — не ждём его здесь
      await until(() => !!document.querySelector('.dialog'), undefined, { timeout: 6000 }).catch(() => {});
      const dlg = await ev(() => (document.querySelector('.dialog') || { textContent: '' }).textContent);
      expect(/бубенчик/i.test(dlg), 'в шатре Бархан не даёт задание «Бубенчик верблюда»', dlg.slice(0, 200));
      await closeAll();
    },
  );

  await step(
    'где житель: городской житель — вечером дома, вышла — его нет на улице; утром выходит гулять',
    async () => {
      await fresh({ weather: 'sun', dayFlags: true });
      const day = await plainDay();
      await mutate(`s.day = ${day}; s.minutes = 20 * 60; s.guests = [];`);
      await ev(() => window.__dev.actions.setMail('cook'));
      await go('world');
      await clearToasts();
      await ev(() => {
        window.__dev.G.state.friends.senya.met = true; // знакомы — без разговора на пороге
        void window.__dev.run('home-of:senya');
      });
      await until(() => window.__dev.sceneName === 'home_senya', undefined, { timeout: 8000 });
      await frames(3);
      expect(await hostInside('senya'), 'вечером Сени нет дома');
      expect(!(await onStreet('world', 'senya')), 'вышла от Сени — а он и на улице');
      await mutate('s.minutes = 12 * 60;');
      expect(await onStreet('world', 'senya'), 'днём Сени нет на улице');
    },
  );

  await step(
    'где житель: у двери домика — «в гостях», а не «спит»; спит — только дома ночью; на празднике',
    async () => {
      await fresh({ weather: 'sun', dayFlags: true });
      const day = await plainDay();
      await mutate(`s.day = ${day}; s.guests = [];`);
      await ev(() => window.__dev.actions.setMail('cook'));
      await go('world');
      const knock = async (id) => {
        await clearToasts();
        await ev((id) => void window.__dev.run('home-of:' + id), id);
        await frames(4);
        return toasts();
      };
      for (const h of [20, 22.5]) {
        await mutate(`s.minutes = ${Math.round(h * 60)};`);
        await ev(() => window.__dev.actions.inviteGuest('zefirka', 'villa'));
        const t = await knock('zefirka');
        expect(/в гостях/.test(t) && !/спит/.test(t), `${h}:00, Зефирка у нас в гостях — у её двери не «в гостях»`, t);
        expect((await ev(() => window.__dev.sceneName)) === 'world', 'вошла в дом, хотя хозяйка у нас в гостях');
      }
      await ev(() => window.__dev.actions.removeGuest('zefirka'));
      const t = await knock('zefirka');
      expect(/спит/.test(t), '22:30, Зефирка дома — у двери не «спит»', t);
      // Купала вечером: дома никого — все на празднике
      await mutate('s.day = 18; s.minutes = 20 * 60; s.dayFlags = {};');
      const f = await knock('prof');
      expect(/на празднике/.test(f) && !/спит/.test(f), 'Купала, 20:00 — у двери не «на празднике»', f);
      await closeAll();
    },
  );
};

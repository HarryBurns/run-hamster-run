// Шаги автотеста «правки заказчика вдогонку 20 ноября»: шляпка из каталога (подарок Плюши — не шляпа от солнца),
// Вершинкин на горе не стоит за ёлкой, гриб в пещерах без лишнего плюсика, питомцы не заходят в воду.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик 20б:"
const lib = require('./lib.js');

module.exports = async function small3(ctx) {
  const L = lib(ctx);
  const { step, ev, expect } = L;

  await step('заказчик 20б: подарок Плюши — шляпка из каталога за 0, не от солнца; соломенная с бантиком — в ТЦ', async () => {
    const r = await ev(async () => {
      const D = await import('/js/data/index.js');
      const hat = D.CLOTHES_BY_ID.hat_catalog,
        bow = D.CLOTHES_BY_ID.sunhat_bow,
        intro = D.QUEST_BY_ID.intro_home,
        busya = D.QUESTS.find((q) => q.steps.some((st) => st.if && st.if.sun)),
        sunStep = busya.steps.find((st) => st.if && st.if.sun);
      // новая игра после задания Плюши: в шкафу стартовые вещи и шляпка из каталога
      const s = { clothes: [...D.START_CLOTHES, 'hat_catalog'] };
      return {
        hat: hat && { price: hat.price, shop: hat.shop, slot: hat.slot, sun: D.isSunHat(hat) },
        reward: intro.reward.clothes,
        doneSays: intro.lines.done.includes('шляпка из каталога'),
        already: sunStep.already(s),
        bow: bow && { shop: bow.shop, price: bow.price, sun: D.isSunHat(bow) },
      };
    });
    expect(r.hat && r.hat.price === 0 && r.hat.shop === 'quest' && r.hat.slot === 'head', 'шляпка из каталога', r);
    expect(!r.hat.sun, 'шляпка из каталога считается шляпой от солнца', r);
    expect(r.reward === 'hat_catalog' && r.doneSays, 'Плюша дарит не шляпку из каталога', r);
    expect(!r.already, 'шаг Буси «купи шляпу от солнца» засчитан подарком Плюши', r);
    expect(r.bow && r.bow.shop === 'mall' && r.bow.price > 0 && r.bow.sun, 'соломенная шляпка с бантиком — не в ТЦ', r);
  });

  await step('заказчик 20б: Вершинкин на горе — ни ёлка, ни скала его не закрывают, до него можно дойти', async () => {
    await L.fresh();
    for (const day of [0, 9, 18, 27]) {
      await L.closeAll();
      await ev((day) => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = 12 * 60;
          s.weather = 'sun';
        });
        d.go('mountain');
      }, day);
      await L.untilScene('mountain');
      await L.frames(2);
      const r = await ev(async () => {
        const K = await import('/js/engine/topdown/kinds.js');
        const sc = window.__dev.locations.mountain,
          m = sc.map,
          T = 48,
          n = sc.npcs.find((q) => q.id === 'vershinkin'),
          out = [];
        if (!n || n.hidden) return { out: ['Вершинкина нет на горе днём'] };
        // где он бывает: клетки, куда он может зайти, гуляя возле своего места (roam — engine/topdown/actors.js)
        const roam = n.def.roam || 3.5,
          hx = (n.hang[0] + 0.5) * T,
          hy = (n.hang[1] + 0.5) * T,
          cells = [];
        for (let ty = Math.floor(n.hang[1] - roam); ty <= n.hang[1] + roam + 1; ty++)
          for (let tx = Math.floor(n.hang[0] - roam); tx <= n.hang[0] + roam + 1; tx++)
            if (Math.hypot((tx + 0.5) * T - hx, (ty + 0.5) * T - hy) <= roam * T && m.foot(tx, ty)) cells.push([tx, ty]);
        cells.push([n.x / T - 0.5, n.y / T - 0.5]); // и где стоит сейчас
        // высокое (ёлки, деревья, скалы): рамка рисунка выше 60 px; ель горы рисуется рисунком spruce
        const frameOf = (o) => {
          const a = K.ART[o.type] || (o.type === 'alpineFir' ? K.ART.spruce : null);
          return a ? a[0] : null;
        };
        for (const [tx, ty] of cells) {
          const nx = (tx + 0.5) * T,
            ny = (ty + 0.5) * T,
            body = [nx - 24, ny - 78, nx + 24, ny]; // хомячок-житель (PS 0.78): ±24 в ширину, 78 в высоту
          for (const o of m.objs) {
            const f = frameOf(o);
            if (!f || f[1] > -60 || o.y <= ny) continue; // низкое или рисуется раньше жителя (выше по экрану)
            const box = [o.x + f[0], o.y + f[1], o.x + f[2], o.y];
            if (box[0] < body[2] && box[2] > body[0] && box[1] < body[3] && box[3] > body[1])
              out.push(`${o.type} (${Math.floor(o.x / T)}, ${Math.floor(o.y / T)}) закрывает его на клетке (${tx}, ${ty})`);
          }
        }
        // дойти: от станции канатной дороги до клетки рядом с ним
        const ntx = Math.floor(n.x / T),
          nty = Math.floor(n.y / T);
        const near = [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => m.foot(ntx + dx, nty + dy) && !!m.path(m.foot, 20, 42, ntx + dx, nty + dy));
        if (!near) out.push('до Вершинкина не дойти');
        return { out, cells: cells.length };
      });
      expect(!r.out.length && r.cells > 4, `день ${day}: Вершинкин за ёлкой`, r);
    }
  });

  await step('заказчик 20б: гриб, который можно сорвать в пещерах, — без плюсика справа вверху', async () => {
    const r = await ev(async () => {
      const K = await import('/js/engine/topdown/kinds.js');
      const k = 4,
        c = document.createElement('canvas');
      c.width = c.height = 100 * k;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.setTransform(k, 0, 0, k, 50 * k, 60 * k); // начало рисунка — (50, 60)
      K.ART.shroomBig[1](x);
      // справа вверху над шляпками (x 10…20, y −34…−20) был белый плюсик «можно сорвать»
      const d = x.getImageData((50 + 10) * k, (60 - 34) * k, 10 * k, 14 * k).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
      return n;
    });
    expect(r === 0, 'над грибом справа вверху что-то нарисовано (плюсик)', r);
  });

  await step('заказчик 20б: питомцы не заходят в воду — бассейн, джакузи, ванна дома; бассейн во дворе', async () => {
    await L.fresh();
    const D = await ev(async () => (await import('/js/data/index.js')).PETS.map((q) => q.id));
    /** Питомец kind (взять заново). */
    const adopt = (kind) =>
      ev((kind) => {
        const d = window.__dev;
        d.actions.mutate((s) => delete s.pet);
        d.actions.adoptPet(kind, 'Пушок');
      }, kind);
    /** Хомячок лезет в fix (с этажа from — питомец «прибегает» с другого этажа); где питомец 1,5 с: сколько раз в воде. */
    const swim = async (fix, from) => {
      await L.go('villa');
      await ev(
        ([fix, from]) => {
          const sc = window.__dev.scene,
            b = sc.fixtures.find((q) => q.id === fix);
          sc.p.f = from == null ? b.f : from;
          sc.p.x = b.x - b.w / 2 - 60;
        },
        [fix, from],
      );
      await ctx.wait(600);
      await ev((fix) => {
        const sc = window.__dev.scene,
          b = sc.fixtures.find((q) => q.id === fix);
        sc.p.f = b.f;
        sc.p.x = b.x;
        b.def.use(sc, b);
      }, fix);
      const bad = [];
      for (let i = 0; i < 8; i++) {
        await ctx.wait(200);
        const r = await ev((fix) => {
          const sc = window.__dev.scene,
            b = sc.fixtures.find((q) => q.id === fix),
            h = window.__dev.F.petDebug().home;
          return { using: sc.using(b), x: h && h.x, f: h && h.f, l: b.x - b.w / 2, r: b.x + b.w / 2, bf: b.f };
        }, fix);
        if (!r.using) bad.push('хомячок вылезла');
        else if (r.f === r.bf && r.x > r.l && r.x < r.r) bad.push(`питомец в воде: x ${Math.round(r.x)}`);
      }
      await ev(() => window.__dev.scene.standUp());
      return bad;
    };
    for (const kind of D) {
      await adopt(kind);
      for (const fix of ['pool', 'jacuzzi', 'bathtub']) {
        const bad = await swim(fix);
        expect(!bad.length, `${kind}: ${fix}`, bad);
      }
    }
    // «прибегает» с другого этажа, когда хомячок уже в воде
    const bad = await swim('pool', 0);
    expect(!bad.length, 'питомец прибежал с другого этажа прямо в бассейн', bad);
    // бассейн во дворе (город): хомячок плывёт — питомец ждёт на суше
    await L.closeAll();
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => (s.villaUp.pool = 1));
      d.go('world');
      d.World.debugTeleport(9, 14);
    });
    await L.untilScene('world');
    await ctx.wait(500);
    await ev(() => window.__dev.scene.walkTo(9.5 * 48, 19.5 * 48, true));
    const wet = [];
    for (let i = 0; i < 12; i++) {
      await ctx.wait(200);
      const r = await ev(() => {
        const sc = window.__dev.scene,
          w = window.__dev.F.petDebug().world;
        return w && { dry: sc.map.dry(Math.floor(w.x / 48), Math.floor(w.y / 48)), x: w.x / 48, y: w.y / 48 };
      });
      if (r && !r.dry) wet.push(r);
    }
    const inPool = await ev(() => {
      const sc = window.__dev.scene;
      return !sc.map.dry(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)); // хомячок в воде
    });
    expect(inPool && !wet.length, 'питомец в бассейне во дворе', { inPool, wet });
  });
};

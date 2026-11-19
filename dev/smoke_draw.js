// Шаги автотеста правок рисунка по замечаниям заказчика (второе обновление):
//   - настенные предметы (часы, картины, зеркала…) в начале игры и в домах жителей не налезают на окна;
//   - земля города: под прудом не лежит плитка у бассейна, под грядкой — пруд (слой лежит только под тем, что на нём
//     стоит: engine/topdown/ground.js, layerMask), а под пирсом песок пляжа остаётся;
//   - хомячок на лежаке загорает поверх полотенца, а не укрыт им; у сахара — рисованный значок «мешочек».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:рисунок:"
const lib = require('./lib.js');

/**
 * В странице: настенные предметы, которые налезают на окно, во всех домах «движка домов» (своя мебель — как в начале
 * игры, мебель жителей — из описания). Окно — рама: x ± (половина стекла + 8), от 104 до 208 над полом
 * (engine/side/rooms.js, windowAt); предмет — прямоугольник w × h с центром на высоте y над полом.
 */
async function wallOverWindows() {
  const d = window.__dev;
  const { FURN_BY_ID } = await import('/js/data/index.js');
  const bad = [];
  let checked = 0;
  for (const sc of Object.values(d.scenes)) {
    const desc = sc && sc.desc;
    if (!desc || !desc.rooms) continue;
    const furn = desc.furniture || {};
    const list =
      furn.key === 'villa'
        ? d.G.state.villa
        : (furn.fixed || furn.start || []).map(([id, floor, x, y]) => ({ id, floor, x, y: y || 0 }));
    for (const it of list) {
      const def = FURN_BY_ID[it.id];
      if (!def || !def.wall) continue;
      checked++;
      const x0 = it.x - def.w / 2,
        x1 = it.x + def.w / 2,
        y0 = it.y - def.h / 2,
        y1 = it.y + def.h / 2;
      for (const r of desc.rooms) {
        if (r.f !== it.floor || !r.win) continue;
        const hw = (r.winW || 88) / 2;
        for (const wx of [].concat(r.win))
          if (x1 > wx - hw - 8 && x0 < wx + hw + 8 && y1 > 104 && y0 < 208)
            bad.push(`${desc.id}: ${it.id} (этаж ${it.floor}, x ${it.x}) на окне x ${wx}`);
      }
    }
  }
  return { bad, checked };
}

module.exports = async function draw(ctx) {
  const { step, ev, expect, fresh: newGame } = lib(ctx);

  await step('рисунок: настенные предметы не налезают на окна — вилла в начале игры и дома жителей', async () => {
    await newGame({ minutes: 12 * 60, weather: 'sun' });
    const r = await ev(wallOverWindows);
    expect(r.checked > 10, 'настенных предметов почти нет — проверка не годится', r);
    expect(!r.bad.length, 'настенный предмет на окне', r.bad);
  });

  await step('рисунок: под прудом двора нет плитки, под грядкой нет воды; песок под пирсом остаётся', async () => {
    await newGame({ minutes: 12 * 60, weather: 'sun', scene: 'world' });
    const r = await ev(() => {
      const W = window.__dev.World;
      return {
        pond: W.debugLayers(22, 18), // середина пруда во дворе виллы
        pondEdge: W.debugLayers(19, 19),
        bed: W.debugLayers(23, 12), // нижняя грядка (рядом в запасе куска — пруд)
        pier: W.debugLayers(63, 56), // пирс над морем
      };
    });
    for (const k of ['pond', 'pondEdge']) {
      expect(r[k].includes(10), `${k}: нет слоя воды — проверка не годится`, r);
      expect(!r[k].includes(8) && !r[k].includes(5), `${k}: под прудом лежит плитка или тропинка`, r);
    }
    expect(r.bed.includes(12) && !r.bed.includes(10), 'под грядкой лежит вода пруда', r);
    expect(r.pier.includes(2), 'под пирсом пропал песок пляжа', r);
  });
};

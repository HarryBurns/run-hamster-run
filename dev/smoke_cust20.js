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
};

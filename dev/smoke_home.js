// Шаги автотеста «Свой дом» — хвосты «Вилла растёт» и правки дома и двора (20 ноября):
//   снаружи дом по ступени (домик → вилла с мансардой), подписи и справка по построенному;
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:свой дом"
const lib = require('./lib.js');

module.exports = async function home(ctx) {
  const { page, step, ev, expect, fresh, go, closeAll, frames, panelText, drain } = lib(ctx);

  /** Дом на карте города: подпись, ключи его спрайтов в кэше, не обрезан ли рисунок. */
  const outside = () =>
    ev(() => {
      const d = window.__dev,
        SP = d.topdown.SP,
        keys = [...SP.map.keys()].filter((k) => k.startsWith('b:world:villa:'));
      return {
        name: d.World.BUILDINGS.find((b) => b.id === 'villa').name,
        keys,
        clipped: SP.stats().clipped.filter((k) => k.startsWith('b:world:villa:')),
      };
    });
  const helpText = async () => {
    await ev(() => void window.__dev.F.showHelp());
    const t = await panelText();
    await closeAll();
    return (t.split('\n').find((l) => l.includes('🏡')) || '').trim(); // строчка про свой дом
  };

  await step(
    'свой дом: снаружи — по ступени (домик, пристройка, два этажа, вилла, мансарда с террасой); «Мой домик» → «Моя вилла»; справка — по построенному',
    async () => {
      await fresh({ villa: 'small' });
      const names = ['Мой домик', 'Мой дом', 'Мой дом', 'Моя вилла', 'Моя вилла'];
      for (let st = 0; st <= 4; st++) {
        if (st) await ev((id) => window.__dev.villaUp(id), 'house' + st);
        await drain();
        await go('world');
        await ev(() => window.__dev.World.debugTeleport(16, 10));
        await frames(3);
        const o = await outside();
        // ступень — в ключе спрайта здания: после стройки дом снаружи перерисовывается сам
        expect(
          o.keys.some((k) => k.endsWith(':' + st)),
          `ступень ${st}: дом снаружи не по ступени`,
          o.keys,
        );
        expect(!o.clipped.length, `ступень ${st}: рисунок дома не помещается в рамку спрайта`, o.clipped);
        expect(o.name === names[st], `ступень ${st}: подпись дома`, o.name);
        const help = await helpText();
        if (st === 0)
          expect(
            help.includes('В домике нажимай') &&
              help.includes('плитку') &&
              !help.includes('сауну') &&
              !help.includes('Лифт'),
            'справка в домике',
            help.slice(0, 600),
          );
        if (st === 4)
          expect(
            help.includes('На вилле нажимай') && help.includes('сауну') && help.includes('Лифт'),
            'справка на вилле',
            help.slice(0, 600),
          );
        await go('villa');
      }
    },
  );
};

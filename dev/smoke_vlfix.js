// Шаги автотеста «мелочи после виллы» (20 ноября):
//   - терраса мансарды (и окна дома): небо по сезону, времени суток и погоде места — в декабрьскую метель серо и без
//     солнца, ночью темно, летом в ясный день солнце (engine/side/rooms.js: terrace, windowAt; sc.wxOut());
//   - «Год в городе»: праздничный торт стоит на столе дома (features/holidays_bday.js).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:после виллы"
const lib = require('./lib.js');

module.exports = async function vlfix(ctx) {
  const L = lib(ctx);
  const { step, ev, expect, fresh, frames, closeAll } = L;

  /**
   * Терраса мансарды при дне, минутах и погоде: что говорит сцена (sc.wxOut) и цвет неба на террасе — там, где днём
   * солнце (несколько точек: облако может закрыть часть круга), и посередине неба.
   */
  const terraceSky = async (day, minutes, kind, force) => {
    await ev(
      ([day, minutes, kind, force]) => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.day = day;
          s.startDay = Math.min(s.startDay, day);
          s.minutes = minutes;
        });
        d.weather(kind, force);
        d.villaAt(3, 1100);
      },
      [day, minutes, kind, force],
    );
    await frames(3);
    return ev(() => {
      const d = window.__dev,
        sc = d.scenes.villa,
        g = sc.geo,
        r = sc.desc.rooms.find((q) => q.id === 'terrace'),
        top = g.fy(r.f) - g.RH,
        cv = document.getElementById('game'),
        k = cv.width / cv.getBoundingClientRect().width,
        x2 = cv.getContext('2d');
      const px = (hx, hy) => {
        const p = sc.debugScreen(hx, hy),
          c = x2.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data;
        return [c[0], c[1], c[2]];
      };
      // «жёлтое» — солнце: красный и зелёный высокие, синий заметно ниже
      const sun = [
        [0, 0],
        [-12, -12],
        [12, -12],
        [-12, 12],
        [12, 12],
      ].some(([dx, dy]) => {
        const [R, G2, B] = px(r.x1 - 70 + dx, top + 56 + dy);
        return R > 200 && G2 > 170 && B < 150;
      });
      const mid = px(r.x0 + 200, top + 30);
      return { wx: sc.wxOut(), sun, mid, light: (mid[0] + mid[1] + mid[2]) / 3, blue: mid[2] - mid[0] };
    });
  };

  await step(
    'после виллы: небо террасы по сезону, времени суток и погоде (метель, ночь, гроза, ясный летний день)',
    async () => {
      await fresh();
      await ev(() => window.__dev.villaUp('house4'));
      await closeAll();
      const july = await terraceSky(19, 11 * 60, 'sun', 0);
      expect(july.wx.kind === 'sun' && july.sun, 'июль, ясно: на террасе солнце', july);
      const blizzard = await terraceSky(34, 12 * 60, 'snow', 2);
      expect(
        blizzard.wx.kind === 'snow' && blizzard.wx.force === 2,
        'над террасой — погода города (метель)',
        blizzard.wx,
      );
      expect(!blizzard.sun, 'декабрь, метель: солнца на террасе нет', blizzard);
      expect(blizzard.blue < july.blue - 25, 'декабрь, метель: небо серее летнего', { july, blizzard });
      const night = await terraceSky(34, 22 * 60 + 30, 'snow', 1);
      expect(!night.sun && night.light < 90, 'декабрь, ночь: небо тёмное, без солнца', night);
      const storm = await terraceSky(19, 15 * 60, 'rain', 3);
      expect(!storm.sun && storm.blue < july.blue - 25, 'летняя гроза: серо и без солнца', { july, storm });
    },
  );
};

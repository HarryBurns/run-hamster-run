// Что звучит: фоновая музыка и окружение (море, дождь, птицы, сверчки) — по сцене, времени суток и погоде.
import { G, cal, darkness, weatherNow } from '../core/state.js';
import { lightningNo } from '../engine/topdown/render.js';
import { scene } from '../core/loop.js';
import { setMusic, setAmbience, sfx } from '../core/audio.js';

// Сцена сама говорит, что в ней слышно: scene.sound() → { force, day, sea, rain, birds, crickets }.
// day: 'town' — музыка города по сезону, 'forest' — лесная (лес, П.9), 'mountain' — горная, 'desert' — пустыни,
// 'jungle' — джунглей (там птицы поют весь год), 'cove' — секретного пляжа, 'island' — удалённого острова (барабаны), иначе — домашняя; drizzle — свой тёплый дождик сцены (джунгли:
// слышен, даже когда в городе сухо);
// wind — ветер (0..1, гора), bells — колокольчики коров (0..1, луг на горе), drips — капли (0..1, пещеры; своя
// музыка пещер — force: 'caves').
// Гроза: за каждой вспышкой молнии (lightningNo — тот же счёт, что у вспышки в render.js) через секунду-другую —
// тихий раскат грома (sfx 'thunder': мягкий низкий гул, без резких частот); под крышей — ещё тише.
let lastBolt = null;
function thunder(storm, vol) {
  const n = lightningNo(G.time);
  if (!storm || document.getElementById('mg')) {
    lastBolt = n;
    return;
  }
  if (lastBolt === null) lastBolt = n; // гроза только началась: ждём первой вспышки
  if (n === lastBolt) return;
  lastBolt = n;
  setTimeout(() => sfx('thunder', vol), 700 + ((n * 37) % 9) * 100);
}
/**
 * Какую погоду слышно в сцене sc: в локации — её (sc.wx), в доме — места, где он стоит (sc.wxOut: хижина на острове
 * не слышит городской грозы, вилла — погода города, под землёй — тихо).
 */
export const soundWx = (sc) => (sc.wx ? sc.wx() : sc.wxOut ? sc.wxOut() : weatherNow());
export function updateSound() {
  const sc = scene();
  const playing = G.state && sc && !document.getElementById('title');
  if (!playing) {
    setMusic('title');
    // на заставке — берег моря (этап 9а): тихий прибой, а дождь и ночь — как в последней игре
    const t = !!document.getElementById('title'),
      s = G.state;
    setAmbience({
      sea: t ? 0.3 : 0,
      rain: t && s && s.weather === 'rain' ? (weatherNow().force >= 2 ? 0.3 : 0.2) : 0,
      birds: false,
      night: !!(t && s && darkness() > 0.75),
      wind: 0,
      bells: 0,
      drips: 0,
    });
    return;
  }
  if (document.getElementById('piano')) {
    setMusic(null);
    setAmbience({ sea: 0, rain: 0, birds: false, night: false, wind: 0, bells: 0, drips: 0 });
    return;
  } // за пианино фоновая музыка молчит
  const mg = !!document.getElementById('mg'),
    c = cal(),
    night = darkness() > 0.75,
    s = (sc.sound && sc.sound()) || {};
  setMusic(
    mg
      ? 'minigame'
      : s.force
        ? s.force
        : night
          ? 'night'
          : s.day === 'town'
            ? 'town_' + c.season
            : ['forest', 'mountain', 'desert', 'jungle', 'cove', 'island'].includes(s.day)
              ? s.day
              : 'villa',
  );
  const wx = soundWx(sc),
    rain = wx.kind === 'rain',
    hard = rain && wx.force >= 2 ? 1.5 : 1;
  // гром: на улице — в полную (тихую) силу, в доме — глуше, под землёй (локация без неба) не слышен
  const under = !!sc.wx && sc.desc && sc.desc.sky === false;
  thunder(rain && wx.force >= 3 && !under, sc.wx ? 1 : 0.45);
  setAmbience({
    sea: mg ? 0 : s.sea || 0,
    rain: rain && !mg ? Math.min(1, (s.rain === undefined ? 0.3 : s.rain) * hard) : 0,
    birds:
      !!s.birds &&
      !mg &&
      !night &&
      (!rain || s.day === 'jungle') &&
      (c.season === 'spring' ||
        c.season === 'summer' ||
        s.day === 'jungle' ||
        s.day === 'island' ||
        (s.day === 'forest' && c.season === 'autumn')),
    night: !!s.crickets && !mg && night && (c.season !== 'winter' || s.day === 'jungle' || s.day === 'island'),
    wind: mg ? 0 : s.wind || 0,
    bells: mg || night ? 0 : s.bells || 0,
    drips: mg ? 0 : s.drips || 0,
  });
}

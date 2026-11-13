// Что звучит: фоновая музыка и окружение (море, дождь, птицы, сверчки) — по сцене, времени суток и погоде.
import { G, cal, darkness } from '../core/state.js';
import { scene } from '../core/loop.js';
import { setMusic, setAmbience } from '../core/audio.js';

// Сцена сама говорит, что в ней слышно: scene.sound() → { force, day, sea, rain, birds, crickets }.
export function updateSound() {
  const sc = scene();
  const playing = G.state && sc && !document.getElementById('title');
  if (!playing) {
    setMusic('title');
    setAmbience({ sea: 0, rain: 0, birds: false, night: false });
    return;
  }
  if (document.getElementById('piano')) {
    setMusic(null);
    setAmbience({ sea: 0, rain: 0, birds: false, night: false });
    return;
  } // за пианино фоновая музыка молчит
  const mg = !!document.getElementById('mg'),
    c = cal(),
    night = darkness() > 0.75,
    s = (sc.sound && sc.sound()) || {};
  setMusic(mg ? 'minigame' : s.force ? s.force : night ? 'night' : s.day === 'town' ? 'town_' + c.season : 'villa');
  const rain = G.state.weather === 'rain';
  setAmbience({
    sea: mg ? 0 : s.sea || 0,
    rain: rain && !mg ? (s.rain === undefined ? 0.3 : s.rain) : 0,
    birds: !!s.birds && !mg && !night && !rain && (c.season === 'spring' || c.season === 'summer'),
    night: !!s.crickets && !mg && night && c.season !== 'winter',
  });
}

// ПОГОДА МИРА: одна погода дня на весь мир, известная заранее, и то, как её «слышат» разные места.
//
// Здесь только чистый расчёт от номера дня (тот же жребий, что у ассортимента дня, — dayRoll): перезагрузка ничего
// не меняет, прогноз на завтра всегда сбывается, автотест считает то же самое.
//
// Погода дня (weatherOfDay) — это погода ГОРОДА: вид (kind) и сила (force).
//   kind:  sun | rain | snow | petals | leaves   (лепестки весной и листья осенью — ясная погода с ветерком)
//   force: 0 — осадков нет; 1 — лёгкая (дождик, снежок); 2 — сильная (ЛИВЕНЬ, МЕТЕЛЬ); 3 — ГРОЗА (только дождь)
// Сильная погода идёт не весь день, а несколько часов (parts — по часам): до и после неё — лёгкая или ясно.
// В сильную погоду жители города сидят по домам (BAD_FORCE; правило — npcPlace в core/queries.js).
//
// Остальные места погоду города не копируют, а откликаются на неё по смыслу (placeWeather): в джунглях в городской
// дождь идёт тёплый дождик и гуще туман, на острове и в бухте вечное лето, но в ненастье облачно, и т. д.
import { SEASON_OF_MONTH, monthOfDay } from './calendar.js';
import { dayRoll } from './stock.js';

/** С какой силы погода «плохая»: жители сидят по домам. */
export const BAD_FORCE = 2;
/** Сила грозы (бывает только у дождя). */
export const STORM_FORCE = 3;
/** Первые дни игры — без ливней, гроз и метелей (пока хомячок знакомится с городом). */
export const WEATHER_CALM_DAYS = 3;

// Доли дней по сезонам (в сумме меньше 1; остальное — «ясно» сезона: fair). Сильная погода — редкая: гроза —
// «летом иногда», метель — несколько раз за зиму.
const ODDS = {
  winter: { fair: 'sun', snow: 0.53, blizzard: 0.12 },
  spring: { fair: 'sun', rain: 0.18, downpour: 0.05, storm: 0.02, wind: ['petals', 0.65] },
  summer: { fair: 'sun', rain: 0.06, downpour: 0.03, storm: 0.06 },
  autumn: { fair: 'leaves', rain: 0.2, downpour: 0.08, storm: 0.02 },
};

/** Как называется погода (для прогноза по телевизору, подсказок и автотеста). */
export function weatherName(kind, force = kind === 'rain' || kind === 'snow' ? 1 : 0) {
  if (kind === 'rain') return force >= STORM_FORCE ? 'гроза' : force >= BAD_FORCE ? 'ливень' : 'дождик';
  if (kind === 'snow') return force >= BAD_FORCE ? 'метель' : 'снег';
  return { sun: 'ясно', petals: 'ясно, летят лепестки', leaves: 'ясно, кружатся листья', cloudy: 'облачно', dust: 'пыльный ветер' }[kind] || 'ясно';
}
/** Значок погоды. */
export function weatherIcon(kind, force = 1) {
  if (kind === 'rain') return force >= STORM_FORCE ? '⛈️' : force >= BAD_FORCE ? '🌧️' : '🌦️';
  if (kind === 'snow') return force >= BAD_FORCE ? '🌨️' : '❄️';
  return { sun: '☀️', petals: '🌸', leaves: '🍂', cloudy: '☁️', dust: '🌬️' }[kind] || '☀️';
}
const norm = (kind, force) => (kind === 'rain' || kind === 'snow' ? Math.max(1, force || 1) : 0);

let memoKey = '',
  memo = null;
/**
 * ПОГОДА ДНЯ day в городе (start — день начала игры: первый день ясный, первые WEATHER_CALM_DAYS дней без сильной
 * погоды):
 * { day, kind, force, name, icon, parts: [{ from, to, kind, force, name, icon }] } — kind и force — «главное за
 * день» (самое сильное), parts — по часам (минуты от полуночи, без пропусков от 0 до 24:00; у ровной погоды — одна
 * часть на весь день). Чистый расчёт: для любого дня, в том числе будущего (прогноз).
 */
export function weatherOfDay(day, start = 0) {
  const key = day + '|' + start;
  if (key === memoKey) return memo;
  const season = SEASON_OF_MONTH[monthOfDay(day)],
    o = ODDS[season],
    r = dayRoll(day, 'weather'),
    calm = day - start < WEATHER_CALM_DAYS;
  let kind = o.fair,
    force = 0,
    acc = 0;
  for (const [k, kd, f] of [
    ['storm', 'rain', 3],
    ['downpour', 'rain', 2],
    ['blizzard', 'snow', 2],
    ['rain', 'rain', 1],
    ['snow', 'snow', 1],
  ]) {
    if (!o[k]) continue;
    acc += o[k];
    if (r < acc) {
      kind = kd;
      force = calm ? 1 : f;
      break;
    }
  }
  if (day === start) {
    // самый первый день игры — всегда ясный
    kind = 'sun';
    force = 0;
  } else if (!force && o.wind && dayRoll(day, 'weather:wind') < o.wind[1]) kind = o.wind[0];
  const part = (from, to, k, f) => ({ from, to, kind: k, force: f, name: weatherName(k, f), icon: weatherIcon(k, f) });
  let parts;
  if (force >= BAD_FORCE) {
    // сильная погода — несколько часов днём; гроза собирается после обеда (до неё ясно и душно), ливень и метель —
    // с утра или с полудня; до и после — лёгкий дождик или снежок
    const storm = force >= STORM_FORCE,
      from = 60 * (storm ? 13 + Math.floor(dayRoll(day, 'weather:from') * 3) : 9 + Math.floor(dayRoll(day, 'weather:from') * 5)),
      to = from + 60 * (storm ? 3 : 4 + Math.floor(dayRoll(day, 'weather:len') * 2));
    parts = [
      storm ? part(0, from, o.fair, 0) : part(0, from, kind, 1),
      part(from, to, kind, force),
      part(to, 1440, kind, 1),
    ];
  } else parts = [part(0, 1440, kind, force)];
  memoKey = key;
  memo = { day, kind, force, name: weatherName(kind, force), icon: weatherIcon(kind, force), parts };
  return memo;
}
/** Часть погоды дня, что идёт в минуту minutes (после полуночи — последняя). */
export function weatherPart(day, minutes, start = 0) {
  const ps = weatherOfDay(day, start).parts;
  for (const p of ps) if (minutes < p.to) return p;
  return ps[ps.length - 1];
}

// ---------- как погоду города слышат разные места ----------
const jungleRoll = (day) => dayRoll(day, 'jungle:drizzle');
/**
 * ПОГОДА В МЕСТЕ place (имя сцены: 'world' — город, 'forest', 'mountain', 'jungle', 'desert', 'island', 'cove';
 * всё остальное — как в городе) при погоде города city { kind, force }, в день day и минуту minutes:
 * { kind, force, cloud, mist, warm, name, icon }
 *   kind  — что идёт здесь: sun | rain | snow | petals | leaves | cloudy (пасмурно, без осадков) | dust (пыльный ветер)
 *   force — сила осадков (0..3), cloud — насколько небо затянуто (0..1: серая пелена), mist — туман (0..1)
 *   warm  — дождик тёплый: промокнуть и простыть нельзя (джунгли, остров, бухта)
 * opts.drizzle — доля дней со своим послеобеденным дождиком джунглей (JUNGLE.drizzle из data/economy.js).
 */
export function placeWeather(place, city, day, minutes, opts = {}) {
  const ck = city.kind,
    cf = norm(ck, city.force),
    rain = ck === 'rain',
    snow = ck === 'snow',
    bad = cf >= BAD_FORCE;
  let kind = ck,
    force = cf,
    cloud = rain ? (cf >= STORM_FORCE ? 1 : cf >= BAD_FORCE ? 0.8 : 0.5) : snow && bad ? 0.5 : 0,
    mist = 0,
    warm = false;
  // утренний туман: 5:00–9:30, гуще всего на рассвете
  const dawn = minutes < 300 || minutes > 570 ? 0 : Math.min(1, Math.max(0, 1 - (minutes - 360) / 210));
  if (place === 'forest') {
    // лес — как город; по утрам (кроме зимы) между деревьями лёгкий туман, в дождь он гуще
    if (!snow && SEASON_OF_MONTH[monthOfDay(day)] !== 'winter') mist = dawn * (rain ? 0.8 : 0.5);
  } else if (place === 'mountain') {
    // гора: городской снег — снег и здесь (метель — метель); дождь — дождь у подножия (выше он сам станет снегом)
  } else if (place === 'jungle') {
    // джунгли: всегда тепло. В городской дождь — тёплый дождик весь день и туман гуще; городской снег — прохладно и
    // пасмурно (снега нет); в сухие дни — свой дождик после обеда (в некоторые дни) и туман по утрам
    warm = true;
    const own = minutes >= 840 && minutes < 930 && jungleRoll(day) < (opts.drizzle === undefined ? 0.34 : opts.drizzle);
    if (rain) {
      kind = 'rain';
      force = 1;
      cloud = bad ? 0.6 : 0.4;
      mist = Math.max(dawn, bad ? 0.55 : 0.35);
    } else if (snow) {
      kind = 'cloudy';
      force = 0;
      cloud = bad ? 0.7 : 0.5;
      mist = Math.max(dawn, 0.2);
    } else {
      kind = own ? 'rain' : 'sun';
      force = own ? 1 : 0;
      cloud = 0;
      mist = dawn;
    }
  } else if (place === 'island' || place === 'cove') {
    // остров и бухта: вечное лето. Лёгкая непогода в городе сюда не доходит совсем, в ненастье (ливень, гроза,
    // метель) — облачно, а в грозу и ливень ещё и тёплый дождик
    warm = true;
    kind = bad ? (rain ? 'rain' : 'cloudy') : 'sun';
    force = bad && rain ? 1 : 0;
    cloud = bad ? (rain ? 0.5 : 0.4) : 0;
  } else if (place === 'desert') {
    // пустыня: солнце; дождя и снега нет никогда. Когда в городе ненастье — сюда долетает пыльный ветер,
    // в обычный дождь или снег — просто пасмурно
    warm = true;
    kind = bad ? 'dust' : rain || snow ? 'cloudy' : 'sun';
    force = 0;
    cloud = bad ? 0.35 : rain || snow ? 0.3 : 0;
  }
  return { kind, force, cloud, mist, warm, name: weatherName(kind, force), icon: weatherIcon(kind, force) };
}

// ---------- жители под дождём ----------
/**
 * Что у жителя города от дождя (на улице и на празднике, пока идёт дождь): у кого зонтик (umbrella — цвет), у кого
 * дождевик и резиновые сапожки (coat, boots — вещи из data/clothes.js). Рисует engine/topdown/actors.js.
 */
export const RAIN_GEAR = {
  plusha: { umbrella: '#f783ac' },
  ponchik: { coat: 'ja_yellow', boots: 'rain_red' },
  senya: { coat: 'js_mint', boots: 'rain_yellow' },
  busya: { umbrella: '#b197fc' },
  prof: { umbrella: '#5c7cfa' },
  myata: { umbrella: '#63e6be' },
  bob: { coat: 'ja_yellow', boots: 'rain_yellow' },
  zefirka: { umbrella: '#ffd43b' },
};

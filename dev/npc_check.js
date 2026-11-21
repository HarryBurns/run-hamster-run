// Проверка движка поведения жителей расчётом (без браузера, секунды): таблицы расписаний и полный перебор года.
// Запуск:  node dev/npc_check.js                       все проверки (код возврата 1 — есть нарушения)
//          node dev/npc_check.js --who plusha --day 12 день жителя строками (--wx rain2 — погода: sun | rain | rain2 |
//                                                      rain3 | snow | snow2; без неё — прогноз дня)
//          node dev/npc_check.js --write               перезаписать снимок dev/saves/npc_golden.json (после
//                                                      ОСОЗНАННОЙ правки расписаний: снимок ловит случайные)
// Что проверяется:
//   1. таблицы: блоки дня без дыр от 0:00 до 24:00, правки внутри суток, слова условий и виды мест существуют,
//      у уточнений свои id, одинаковая важность — только у тех, что не срабатывают разом;
//   2. полный перебор: два игровых года × каждая минута 7:30–23:59 × погода (прогноз и принудительная) × все жители —
//      ответ один, сцена и точка известны;
//   3. вместимость: в номере 203 не больше одного, у бассейна не больше четырёх;
//   4. спокойствие: житель не мечется (не больше 8 мест за день, в одном месте — не меньше 30 минут);
//   5. жизнь: в обычный день каждый житель с домом бывает и дома, и на улице; утром (до 9:00) в городе пусто;
//   6. состояния вперемешку: гость — в доме хомячка, спящего и празднующего не позвать, позвавший к себе — дома;
//   7. снимок: ответы по сетке (день × 15 минут × погода) совпадают с dev/saves/npc_golden.json.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = require('./root.js');
const GOLDEN = path.join(__dirname, 'saves', 'npc_golden.json');

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i < 0 ? null : process.argv[i + 1] || true;
};
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
/** Погода из слова: 'rain2' → { kind: 'rain', force: 2 }. */
const wxOf = (w) => {
  const kind = w.replace(/\d/g, ''),
    f = +w.replace(/\D/g, '');
  return { kind, force: kind === 'rain' || kind === 'snow' ? f || 1 : 0 };
};
const WX = ['sun', 'rain', 'rain2', 'snow'];
const GRID = { days: 72, from: 450, step: 15 };
const CH = { out: 'o', home: 'h', asleep: 'a', pool: 'p', room: 'r', fest: 'f', door: 'd', guest: 'g' };

(async () => {
  const D = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'index.js')).href);
  const { NPC_IDS, NPC_ROUTINE, NPC_RULES, COND, PLACE_KINDS, NPC_SPOTS, NPC_BY_ID, NPC_HOME, LAND_HOME } = D;
  const { resolveNpc, npcDay, hm, test, rulesOf, holidayOn, weatherPart, HOME_BY_ID } = D;
  const problems = [];
  const bad = (msg) => problems.length < 60 && problems.push(msg);
  const TOWN = Object.keys(NPC_HOME),
    HOSTS = [...TOWN, ...Object.keys(LAND_HOME)];
  const base = (o = {}) => ({
    day: 20,
    minutes: 720,
    startDay: 0,
    weather: wxOf('sun'),
    guests: [],
    guestsAt: 'villa',
    invited: {},
    badges: {},
    ...o,
  });
  const forecastAt = (day) => (m) => {
    const w = weatherPart(day, m, 0);
    return { kind: w.kind, force: w.force };
  };

  // ---------- показать день жителя ----------
  if (arg('who')) {
    const id = arg('who'),
      day = +(arg('day') || 20),
      wx = arg('wx');
    if (!NPC_IDS.includes(id)) throw new Error('нет жителя «' + id + '»: ' + NPC_IDS.join(', '));
    const hol = holidayOn(day, 0);
    console.log(`${NPC_BY_ID[id].name}, день ${day}${hol ? ' — ' + hol.name : ''}, погода: ${wx || 'по прогнозу'}`);
    for (const q of npcDay(id, base({ day, weather: wx ? wxOf(wx) : null }), 450, wx ? null : forecastAt(day)))
      console.log(
        `  ${hhmm(q.from).padStart(5)}–${hhmm(q.to).padEnd(5)}  ${(q.place.scene + ' · ' + q.place.spot).padEnd(22)} ${q.place.act.padEnd(6)} (${q.place.rule})${q.place.visible ? '' : ' — не виден'}`,
      );
    return;
  }

  // ---------- 1. таблицы ----------
  const condWords = (c, out = []) => {
    for (const k in c || {}) {
      out.push(k);
      if (k === 'not') condWords(c[k], out);
      if (k === 'any') c[k].forEach((q) => condWords(q, out));
    }
    return out;
  };
  const checkCond = (c, where) => {
    for (const w of condWords(c)) if (!COND[w]) bad(`${where}: нет условия «${w}»`);
  };
  for (const id of NPC_IDS) {
    const r = NPC_ROUTINE[id];
    if (!r) {
      bad(`${id}: нет расписания (NPC_ROUTINE)`);
      continue;
    }
    let prev = 0;
    for (const b of r.blocks) {
      const m = hm(b.to);
      if (!(m > prev)) bad(`${id}: блоки дня идут не по порядку (${b.to})`);
      if (!PLACE_KINDS.includes(b.place)) bad(`${id}: нет вида места «${b.place}»`);
      prev = m;
    }
    if (prev !== 1440) bad(`${id}: день кончается в ${hhmm(prev)}, а не в 24:00 — дыра в расписании`);
    for (const v of r.variants || []) {
      checkCond(v.if, `${id}: правка`);
      for (const b of v.blocks) {
        if (!(hm(b.from) >= 0 && hm(b.to) <= 1440 && hm(b.from) < hm(b.to)))
          bad(`${id}: правка ${b.from}–${b.to} вне суток`);
        if (!PLACE_KINDS.includes(b.place)) bad(`${id}: нет вида места «${b.place}»`);
      }
    }
  }
  for (const id of Object.keys(NPC_ROUTINE))
    if (!NPC_IDS.includes(id)) bad(`расписание для неизвестного жителя «${id}»`);
  const ruleIds = new Set();
  for (const r of NPC_RULES) {
    if (ruleIds.has(r.id)) bad(`уточнение «${r.id}» встречается дважды`);
    ruleIds.add(r.id);
    if (!PLACE_KINDS.includes(r.place)) bad(`уточнение «${r.id}»: нет вида места «${r.place}»`);
    if (r.who !== 'town')
      for (const id of r.who) if (!NPC_IDS.includes(id)) bad(`уточнение «${r.id}»: нет жителя «${id}»`);
    checkCond(r.if, `уточнение «${r.id}»`);
  }
  const SPOTS = new Set(Object.values(NPC_SPOTS).flat());

  // ---------- 2–5. полный перебор ----------
  let calls = 0;
  const sameTie = new Set();
  for (let day = 0; day < 72; day++) {
    const modes = [null, ...['sun', 'rain', 'rain2', 'rain3', 'snow', 'snow2'].map(wxOf)];
    for (const forced of modes) {
      const wAt = forced ? () => forced : forecastAt(day);
      const seen = {},
        runs = {};
      for (let m = 450; m < 1440; m++) {
        const ctx = base({ day, minutes: m, weather: wAt(m) });
        let pool = 0,
          room = 0,
          street = 0;
        for (const id of NPC_IDS) {
          const p = resolveNpc(id, ctx);
          calls++;
          if (!p || !p.scene || !p.spot) {
            bad(`${id}, день ${day}, ${hhmm(m)}: нет места`);
            continue;
          }
          if (!SPOTS.has(p.spot)) bad(`${id}: точка «${p.spot}» не названа в NPC_SPOTS`);
          if (p.scene === 'hotel' && p.spot === 'pool') pool++;
          if (p.scene === 'hotel_203') room++;
          if (TOWN.includes(id) && p.scene === 'world') street++;
          (seen[id] = seen[id] || new Set()).add(p.at);
          const r = (runs[id] = runs[id] || []);
          const key = p.scene + '|' + p.spot;
          if (!r.length || r[r.length - 1].key !== key) r.push({ key, from: m, to: m + 1 });
          else r[r.length - 1].to = m + 1;
          // одинаковая важность — только у уточнений, что не срабатывают разом
          if (m % 30 === 0) {
            const hit = rulesOf(id).filter((q) => test(q.if, id, ctx));
            for (let i = 1; i < hit.length; i++)
              if (hit[i].prio === hit[i - 1].prio)
                sameTie.add(
                  `${hit[i - 1].id} и ${hit[i].id} (важность ${hit[i].prio}): ${id}, день ${day}, ${hhmm(m)}`,
                );
          }
        }
        if (pool > 4) bad(`день ${day}, ${hhmm(m)}: у бассейна ${pool} — больше четырёх`);
        if (room > 1) bad(`день ${day}, ${hhmm(m)}: в номере 203 сразу ${room}`);
        if (m < 540 && street)
          bad(`день ${day}, ${hhmm(m)}: утром в городе уже ${street} жителей (утро должно быть пустым)`);
      }
      for (const id of NPC_IDS) {
        const r = runs[id] || [];
        if (r.length > 8) bad(`${id}, день ${day}: мечется — ${r.length} мест за день`);
        // короткие остановки: кроме начала и конца дня; погода по прогнозу может менять планы — там короче не бывает получаса частей
        for (let i = 1; i < r.length - 1; i++)
          if (r[i].to - r[i].from < 30)
            bad(`${id}, день ${day}: в «${r[i].key}» всего ${r[i].to - r[i].from} мин (${hhmm(r[i].from)})`);
      }
      // жизнь: обычный день (нет праздника, погода не сильная) — каждый с домом бывает и дома, и на улице
      const calm = !holidayOn(day, 0) && (forced ? forced.force < 2 : true);
      if (calm && forced)
        for (const id of HOSTS) {
          const s = seen[id];
          if (!(s.has('out') || s.has('pool') || s.has('room')) || !(s.has('home') || s.has('asleep')))
            bad(`${id}, день ${day}: за день не был и дома, и не дома (${[...s]})`);
        }
    }
  }
  for (const t of sameTie) bad('уточнения с одинаковой важностью сработали разом: ' + t);

  // ---------- 6. состояния вперемешку ----------
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const homes = Object.keys(HOME_BY_ID);
  for (let i = 0; i < 20000; i++) {
    const guests = TOWN.filter(() => rnd() < 0.15).slice(0, 3),
      invited = Object.fromEntries(TOWN.filter(() => rnd() < 0.15).map((id) => [id, true])),
      ctx = base({
        day: Math.floor(rnd() * 72),
        minutes: 450 + Math.floor(rnd() * 990),
        weather: wxOf(['sun', 'rain', 'rain2', 'rain3', 'snow', 'snow2'][Math.floor(rnd() * 6)]),
        guests,
        guestsAt: homes[Math.floor(rnd() * homes.length)],
        invited,
      });
    for (const id of NPC_IDS) {
      const p = resolveNpc(id, ctx),
        at = `${id}, день ${ctx.day}, ${hhmm(ctx.minutes)}`;
      if (guests.includes(id)) {
        if (p.scene !== ctx.guestsAt || p.spot !== 'guest')
          bad(`${at}: гость не в доме хомячка (${p.scene} · ${p.spot})`);
      } else if (p.spot === 'guest') bad(`${at}: не гость, а в доме хомячка`);
      if (
        (p.act === 'sleep' || p.act === 'fest' || p.act === 'greet' || p.act === 'guest' || p.act === 'host') &&
        p.free
      )
        bad(`${at}: ${p.act} — и «можно позвать»`);
      if (invited[id] && !guests.includes(id) && p.act !== 'sleep' && p.scene !== p.house)
        bad(`${at}: позвал к себе, а сам не дома (${p.scene})`);
      if (!p.visible && p.act !== 'sleep' && p.act !== 'rest') bad(`${at}: не виден, хотя не спит (${p.act})`);
    }
  }

  // ---------- 7. снимок ----------
  const snap = () => {
    const rows = [],
      idx = new Map(),
      data = {};
    WX.forEach((w, wi) => {
      for (let d = 0; d < GRID.days; d++)
        data[wi + ':' + d] = HOSTS.map((id) => {
          let s = '';
          for (let m = GRID.from; m < 1440; m += GRID.step)
            s += CH[resolveNpc(id, base({ day: d, minutes: m, weather: wxOf(w) })).at];
          if (!idx.has(s)) idx.set(s, rows.push(s) - 1);
          return idx.get(s);
        });
    });
    return { grid: { ...GRID, wx: WX }, ids: HOSTS, rows, data };
  };
  const now = snap();
  if (arg('write')) {
    fs.writeFileSync(GOLDEN, JSON.stringify(now) + '\n');
    console.log('снимок записан: ' + path.relative(ROOT, GOLDEN));
  } else if (!fs.existsSync(GOLDEN))
    bad('нет снимка dev/saves/npc_golden.json — запиши: node dev/npc_check.js --write');
  else {
    const old = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    let diff = 0;
    for (const key of Object.keys(old.data))
      old.ids.forEach((id, i) => {
        const a = old.rows[old.data[key][i]],
          j = now.ids.indexOf(id),
          b = j < 0 || !now.data[key] ? '' : now.rows[now.data[key][j]];
        if (a === b) return;
        if (diff++ < 6) {
          const [w, d] = key.split(':');
          bad(`снимок: ${id}, день ${d}, погода ${old.grid.wx[w]} — было ${a}, стало ${b}`);
        }
      });
    if (diff)
      bad(`снимок расписаний не совпал в ${diff} строках (если правка осознанная — node dev/npc_check.js --write)`);
  }

  console.log(
    `жителей: ${NPC_IDS.length}, уточнений: ${NPC_RULES.length}, ответов проверено: ${calls.toLocaleString('ru-RU')}`,
  );
  if (problems.length) {
    console.log('НАРУШЕНИЯ:');
    for (const p of problems) console.log('  ✗ ' + p);
    process.exit(1);
  }
  console.log('расписания жителей в порядке');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

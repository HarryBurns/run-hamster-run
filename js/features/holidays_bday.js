// ПРАЗДНИКИ (П.13), часть 2: «ГОД В ГОРОДЕ» (этап 10, Пр14; раньше — день рождения хомячка, id праздника остался
// 'birthday') — годовщина приезда в Ореховую Гавань: 1 июня, впервые через игровой год (data/holidays.js, since).
// Празднуют в основном доме (туда ведёт «Домой», state.homeMain): если хомячок дома и уже 11:00 (HOLIDAY.bday.from),
// друзья приходят сами — по одному раз в HOLIDAY.bday.every игровых минут. Гость входит с коробочкой в лапках
// (Пр15: carry у гостя — engine/side/actors.js), подходит к хомячку и вручает: коробочка летит в лапки, подарок —
// в рюкзак (presents в таблице: блюдо, продукт, семена или монеты). Кто уже сидит в гостях (позвали по телефону) —
// тоже гость праздника и тоже дарит подарок. Три гостя — «Все гости в сборе!»: торт со свечами (сценка — задуть
// свечи), и праздник сделан (монеты, вещь года, наклейка, окно). Если окно с тортом закрыли — «🎂 Задуть свечи!»
// есть в разговоре с гостем (talkHooks.guest). В доме — гирлянда «Год в Ореховой Гавани!» и шарики (addSidePart движка
// домов), на обеденном столе (нет его — на журнальном столике) весь день стоит торт, свечки горят, пока их не задули;
// в городе — шарики у двери дома (locations/holidays.js). Состояние — только отметки дня (ход шагов, asked).
import { addItem, earn, meetFriend, setDayFlag, inviteGuest, MAX_GUESTS } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on } from '../core/events.js';
import { scene } from '../core/loop.js';
import { G } from '../core/state.js';
import {
  HOLIDAY,
  HOLIDAY_BY_ID,
  HOME_BY_ID,
  NPCS,
  NPC_BY_ID,
  DISH_BY_ID,
  ING_BY_ID,
  SEED_BY_ID,
  BLOWS,
  FURN_BY_ID,
} from '../data/index.js';
import { addSidePart } from '../engine/side/scene.js';
import { paintBdayRoom } from '../locations/holidays_art.js';
import { enqueue } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { addPts, talkHooks } from './friends.js';
import { holidayActs, holidayStep, holidayToday, holidayWhere, stepWanted, stepDoneFor } from './holidays.js';
import { tapScene, holidaySay } from './holidays_scenes.js';
import { paintCake, tableCake } from './holidays_scenes_art.js';

const S = () => G.state;
const HF = () => S().dayFlags.holiday || {};
const BDAY = HOLIDAY_BY_ID.birthday;
/** Сегодня «Год в городе». */
const isBday = () => !!S() && holidayToday() === BDAY;
/** Хомячок у себя в основном доме, и дом может принять гостей (не в режиме «Обустроить»). */
const atHome = (sc) => !!sc && !!sc.canHostGuests && sc.canHostGuests() && sc.houseKey === (S().homeMain || 'villa');

// ---------- гости приходят сами ----------
/** Кто придёт: сначала лучшие друзья (больше сердечек), потом остальные жители города. */
function nextGuest() {
  const s = S(),
    came = [...(HF().guests || []), ...carrying.keys()];
  const list = NPCS.filter((n) => !n.land && s.friends[n.id] && !came.includes(n.id) && !s.guests.includes(n.id));
  list.sort(
    (a, b) =>
      (s.friends[b.id].met ? 1 : 0) - (s.friends[a.id].met ? 1 : 0) || s.friends[b.id].pts - s.friends[a.id].pts,
  );
  return list.length ? list[0].id : null;
}
/** Что подарил гость (в рюкзак или монеты) — строка для подсказки: «🥞 Блинчики ×2». */
function givePresent(id) {
  const p = BDAY.presents[id];
  if (!p) return '';
  if (p.money) {
    earn(HOLIDAY.bday.money, 'gift');
    return `🪙 ${HOLIDAY.bday.money}`;
  }
  if (p.dish) {
    addItem('dishes', p.dish, p.n || 1);
    return `${DISH_BY_ID[p.dish].e} ${DISH_BY_ID[p.dish].name} ×${p.n || 1}`;
  }
  if (p.ing) {
    addItem('ing', p.ing, p.n || 1);
    return `${ING_BY_ID[p.ing].e} ${ING_BY_ID[p.ing].name} ×${p.n || 1}`;
  }
  if (p.seed) {
    addItem('seeds', p.seed, p.n || 1);
    const sd = SEED_BY_ID[p.seed];
    return `${(sd && sd.e) || '🌱'} ${(sd && sd.name) || 'семена'} ×${p.n || 1}`;
  }
  return '';
}
/** Гость (уже в доме) поздравил и подарил подарок: в рюкзак, сердечко дружбы, шаг «гости». */
function greet(id) {
  const fr = S().friends[id];
  if (fr && !fr.met) meetFriend(id);
  const got = givePresent(id);
  addPts(id, 1);
  const p = BDAY.presents[id] || {},
    n = NPC_BY_ID[id];
  sfx('bell');
  toast(`🎁 ${n.name}: «С праздником! ${p.say || ''}»${got ? ` +${got}` : ''}`, 'good');
  holidayStep('birthday', 'guests', id);
}
// Гости с коробочками: id → { t — сколько секунд несёт, give — вручает (0…1) }. Живёт, пока открыта сцена дома;
// ушли из дома или закрыли игру с коробочкой в лапках у гостя — подарок вручается сразу (ничего не теряется).
const carrying = new Map();
const GIVE_AFTER = 5, // если гость не дошёл (хомячок на другом этаже) — вручает и так, через столько секунд
  GIVE_TIME = 0.7; // сколько секунд летит коробочка
/** Гость вошёл с коробочкой и идёт к хомячку. */
function arrive(sc, id) {
  const g = sc.actors.find((q) => q.guest && q.id === id),
    p = BDAY.presents[id] || {};
  if (!g) return greet(id);
  const [c, c2] = p.box || ['#ff8fab', '#fff'];
  g.carry = { c, c2, give: null };
  carrying.set(id, { t: 0 });
  sfx('bell');
  toast(`Тук-тук! 🎁 ${NPC_BY_ID[id].name} ${NPC_BY_ID[id].fem ? 'пришла' : 'пришёл'} с подарком!`, 'good');
}
/** Гости несут коробочки к хомячку и вручают. */
function carry(sc, dt) {
  for (const [id, c] of carrying) {
    const g = sc.actors.find((q) => q.guest && q.id === id);
    if (!g || !g.carry) {
      carrying.delete(id);
      if (stepWanted('birthday', 'guests') && !stepDoneFor('birthday', 'guests', id)) greet(id);
      continue;
    }
    c.t += dt;
    const same = sc.p.f === g.f,
      dx = sc.p.x - g.x;
    if (g.carry.give) {
      g.carry.give.a += dt / GIVE_TIME;
      g.carry.give.x = sc.p.x;
      if (g.carry.give.a >= 1) {
        g.carry = null;
        carrying.delete(id);
        greet(id);
        sc.burst(sc.p.x, sc.geo.fy(sc.p.f) - 110, 'heart', 4);
      }
    } else if ((same && Math.abs(dx) < 110) || c.t > GIVE_AFTER) {
      g.dir = Math.sign(dx) || 1;
      g.wait = 2.5; // постоять рядом, пока вручает
      g.moving = false;
      g.tx = g.x;
      g.carry.give = { x: sc.p.x, y: sc.geo.fy(sc.p.f) - 60, a: 0 };
    } else if (same) {
      // идёт к хомячку (не дальше, чем гостям можно ходить)
      const lo = g.roam ? Math.min(g.roam[0], g.x) : g.x,
        hi = g.roam ? Math.max(g.roam[1], g.x) : g.x;
      g.tx = Math.max(lo, Math.min(hi, sc.p.x - Math.sign(dx) * 80));
      g.wait = 0;
    }
  }
}
/** Ушли из дома с невручёнными коробочками — подарки вручаются сразу. */
function giveAll() {
  for (const id of [...carrying.keys()]) {
    carrying.delete(id);
    if (isBday() && stepWanted('birthday', 'guests') && !stepDoneFor('birthday', 'guests', id)) greet(id);
  }
}
let nextAt = 0; // когда (минуты игры) придёт следующий гость — только пока сцена открыта, в сохранение не идёт
function tick({ dt = 0 } = {}) {
  if (!isBday()) return;
  const s = S(),
    sc = scene();
  if (!atHome(sc)) return giveAll();
  carry(sc, dt);
  if (!stepWanted('birthday', 'guests') || s.minutes < HOLIDAY.bday.from * 60) return;
  // кто уже сидит в гостях в этом доме — гость праздника
  if ((s.guestsAt || 'villa') === sc.houseKey)
    for (const id of s.guests)
      if (!carrying.has(id) && !stepDoneFor('birthday', 'guests', id) && stepWanted('birthday', 'guests')) greet(id);
  // гостей с коробочками считаем уже пришедшими: четвёртый не придёт, пока трое несут подарки
  const have = (HF().guests || []).length + carrying.size;
  if (have >= (BDAY.steps[0].n || 3) || s.guests.length >= MAX_GUESTS || s.minutes < nextAt) return;
  const id = nextGuest();
  if (!id) return;
  if (inviteGuest(id, sc.houseKey, 'party')) {
    arrive(sc, id);
    nextAt = s.minutes + HOLIDAY.bday.every;
  }
}
on('step', tick);
on('scene', () => {
  giveAll();
  nextAt = 0; // вошла домой — первый гость сразу (если уже 11:00)
});
// три гостя — пора задувать свечи (один раз за день спросить окном; дальше — в разговоре с гостем)
on('holiday', ({ id, what } = {}) => {
  if (
    id !== 'birthday' ||
    what !== 'guests' ||
    stepWanted('birthday', 'guests') ||
    !stepWanted('birthday', 'cake') ||
    HF().asked
  )
    return;
  setDayFlag('asked', 1, 'holiday');
  enqueue(
    () =>
      message({
        title: 'Все гости в сборе!',
        icon: '🎂',
        html: `<div class="center big-emoji">🎂</div><p class="center">Друзья пришли, подарки подарены — ${
          cakeTable(scene()) ? 'а на столе уже стоит' : 'а вот и'
        } праздничный торт со свечами! Загадаешь желание?</p>`,
        buttons: [{ text: '🎂 Задуть свечи!', cls: 'green' }, { text: 'Чуть позже' }],
      }).then((i) => {
        if (i === 0) return cake();
        toast('🎂 Торт подождёт! Поговори с гостем, когда будешь готов{|а} задуть свечи.');
      }),
    { delay: 900 },
  );
});
talkHooks.guest = async (id) => {
  if (!isBday() || stepWanted('birthday', 'guests') || !stepWanted('birthday', 'cake')) return null;
  const i = await holidaySay(
    id,
    'С праздником! Торт уже ждёт — задуешь свечи? А мы споём!',
    [{ text: '🎂 Задуть свечи!', cls: 'green' }, { text: 'Потом' }],
    true,
  );
  if (i === 0) await cake();
  return { end: true };
};

// ---------- торт ----------
async function cake() {
  if (!isBday()) return void toast('🎂 Торт будет на празднике «Год в городе»!');
  if (stepDoneFor('birthday', 'cake')) return void toast('🎂 Свечи уже задуты, а желание загадано!', 'good');
  if (stepWanted('birthday', 'guests')) return void toast('🎂 Торт ждёт гостей! Будь дома — друзья скоро придут.');
  const ok = await tapScene({
    title: 'Год в Ореховой Гавани!',
    icon: '🎂',
    steps: BLOWS,
    btn: '🌬️ Дуть!',
    lastBtn: '🌬️ Последние свечки!',
    hint: 'Загадай желание и дуй на свечки — нажимай на торт или на кнопку!',
    doneText: '🎉 Все свечки задуты! Друзья кричат: «Ура! Целый год вместе!» Желание обязательно сбудется.',
    paint: paintCake,
  });
  if (ok) holidayStep('birthday', 'cake');
}

// ---------- звёздочка, украшение дома ----------
/** Дверь основного дома (в этой локации) — туда ведёт звёздочка праздника «Год в городе». */
holidayWhere('home', (sc) => {
  const home = HOME_BY_ID[S().homeMain] || HOME_BY_ID.villa,
    b = sc.map.bById[home.building];
  if (!b || (home.loc && home.loc !== sc.name)) return null;
  const d = sc.map.doorPx(b);
  return { x: d.x, y: d.y - 40 };
});
/**
 * Гирлянда и шарики в комнате у входа основного дома (в «Год в городе»). В доме нет кэша спрайтов — рисунок один раз
 * кладётся в свою картинку (на дом и размер комнаты), в кадре — одна её копия.
 */
let roomPic = null;
function drawBdayRoom(ctx, sc) {
  if (!isBday() || sc.houseKey !== (S().homeMain || 'villa')) return;
  const door = sc.desc.door || { f: 0, x: 100 },
    room = (sc.desc.rooms || []).find((r) => r.f === door.f && door.x >= r.x0 && door.x <= r.x1) || {
      x0: 0,
      x1: sc.geo.W,
    };
  const y = sc.geo.fy(door.f),
    top = y - sc.geo.RH,
    x0 = room.x0 + 16,
    x1 = room.x1 - 16,
    key = `${sc.name}:${x0}:${x1}:${top}`;
  if (!roomPic || roomPic.key !== key) {
    const { canvas, ctx: c } = makeCanvas(x1 - x0, y - top + 12);
    c.translate(-x0, -top);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    paintBdayRoom(c, x0, x1, y, top, 0);
    roomPic = { key, canvas };
  }
  ctx.drawImage(roomPic.canvas, x0, top, x1 - x0, y - top + 12);
}

/**
 * Стол, на котором в «Год в городе» стоит торт: обеденный стол основного дома (в начальном домике он есть), если его
 * нет — журнальный столик; { x, f, top } — середина, этаж, высота столешницы над полом. Нет стола — null (тогда и
 * окно «Все гости в сборе!» не говорит про стол).
 */
function cakeTable(sc) {
  if (!sc || !sc.items || sc.houseKey !== (S().homeMain || 'villa')) return null;
  const tables = sc.items().filter((i) => FURN_BY_ID[i.id] && FURN_BY_ID[i.id].kind === 'table');
  const it = tables.find((i) => i.id === 'table') || tables[0];
  return it ? { x: it.x, f: it.floor, top: FURN_BY_ID[it.id].h } : null;
}
/** Торт на столе — весь день праздника; свечки горят, пока их не задули. */
function drawBdayCake(ctx, sc, t) {
  if (!isBday()) return;
  const tb = cakeTable(sc);
  if (!tb) return;
  tableCake(ctx, tb.x, sc.geo.fy(tb.f) - tb.top, 0.48, !stepDoneFor('birthday', 'cake'), t);
}
addSidePart({ back: drawBdayRoom, front: drawBdayCake });

holidayActs({ cake: () => cake() });

// ЛЕС (П.9): что делают в лесу. Сама локация (где что стоит) — locations/forest.js; она называет действия реестра,
// а выполняются они здесь:
//   forester            поговорить с лесником Шишкиным (житель леса и дверь его избушки); у него же — еловый венок
//   forest:hive         улей: летом и осенью — баночка мёда раз в день; весной и зимой пчёлы не дают мёда
//   forest:squirrel     белка на дубе: 3 орешка → золотая шишка (украшение для дома, раз в день); 4 шишки → орешек
//   forest:fire         костёр: вечером и ночью — пожарить зефир (зефир — в ТЦ «Вкусный»)
//   forest:treehouse    домик на дереве: забраться и посмотреть на лес сверху (окно с видом)
//   forest:hunt         мини-игра «Грибная охота» (minigames/mushrooms.js) — её предлагает Шишкин: за первые
//                       FOREST.hunt.paid игр в день он платит монетами и даёт корзинку грибов по звёздам
// Числа — FOREST в data/economy.js, сезоны — WILD_MONTHS в data/seasons.js. Каждое занятие шлёт событие forest
// { what } — по нему считают задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки
// дня (dayFlags.forest), утром сбрасываются сами.
import { setFlag, setDayFlag, addItem, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count, questNow } from '../core/state.js';
import { esc, pick, fmtMoney } from '../core/util.js';
import { makeCanvas, ell, poly, line } from '../core/draw.js';
import { NPC_BY_ID, npcLook, FOREST, ING_BY_ID, DISH_BY_ID, FIND_BY_ID, QUEST_BY_ID, wildIn, DAYS_PER_MONTH } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { questTalk } from './quests.js';
import { eat } from './cooking.js';
import { playMinigame } from './minigames.js';

const S = () => G.state;
const SHISHKIN = 'shishkin';

/** Что сказать лесу под настроение: ночью — про ночь, вечером — про костёр, днём — про сезон. */
export function shishkinLine() {
  const L = NPC_BY_ID[SHISHKIN].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}

const say = (text, options, happy = false) =>
  dialog({ look: npcLook(SHISHKIN), name: NPC_BY_ID[SHISHKIN].name, text, options, happy });

/** Разговор с лесником: сначала задание из журнала (взять, как дела, сдать), потом — болтовня. */
export async function talkShishkin() {
  const s = S();
  let text;
  if (!s.flags.metShishkin) {
    setFlag('metShishkin');
    text = `Здравствуй, ${esc(s.name)}! Я лесник Шишкин. Мята писала, что ты придёшь! В лесу растут грибы и ягоды, у ручья — улей, на старом дубе живёт белка, а вечером у костра можно пожарить зефир. Будь как дома!`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'А, это ты! Здравствуй!', 'Доброго дня, путешественница!']);
  emit('talk', { id: SHISHKIN });
  sfx('tap');
  const qt = await questTalk(SHISHKIN);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const twigs = count('finds', 'fir_twig');
    const opts = [{ text: '🍄 Грибная охота', cls: 'yellow', go: 'hunt' }, { text: '💬 Поболтать', cls: 'blue', go: 'chat' }];
    if (twigs) opts.push({ text: `🎄 Сплести венок (веточек ${twigs} из ${FOREST.wreath})`, cls: 'green', go: 'wreath' });
    opts.push({ text: 'Пока!', go: 'bye' });
    const i = await say(text, opts);
    const go = (opts[i] || {}).go;
    if (go === 'hunt') {
      await mushroomHunt();
      return;
    }
    if (go === 'chat') text = shishkinLine();
    else if (go === 'wreath') {
      if (twigs < FOREST.wreath) {
        text = `Для венка нужно ${FOREST.wreath} еловые веточки, а у тебя ${twigs}. Поищи ещё под ёлками — зимой они там лежат!`;
        continue;
      }
      addItem('finds', 'fir_twig', -FOREST.wreath);
      addItem('storage', 'fir_wreath', 1);
      sfx('win');
      emit('forest', { what: 'wreath' });
      text = 'Вот, держи еловый венок! Повесь дома на стену — будет пахнуть лесом и Новым годом 🎄 Он уже в кладовке: дома нажми 🔨.';
    } else return;
  }
}
register('forester', () => talkShishkin(), 'лесник Шишкин: разговор (житель леса и дверь его избушки)');

// ---------- улей ----------
const S2 = () => S().dayFlags.forest || {};
const monthNow = () => Math.floor(S().day / DAYS_PER_MONTH) % 12;
const done = (what) => !!S2()[what];
/** Улей: раз в день баночка мёда — летом и осенью и только днём. */
export function visitHive() {
  const sea = cal().season;
  sfx('tap');
  if (!wildIn('bees', monthNow())) {
    toast(
      sea === 'winter'
        ? '🐝 Зимой пчёлы спят в тёплом улье. Тсс! Мёд будет летом.'
        : '🐝 Пчёлы только проснулись и собирают первый нектар. Мёд будет летом!',
    );
    return false;
  }
  if (darkness() > 0.6) {
    toast('🐝 Ночью пчёлы спят. Приходи утром!');
    return false;
  }
  if (done('hive')) {
    toast('🍯 Сегодня мёд уже собран. Завтра пчёлки наберут ещё!');
    return false;
  }
  setDayFlag('hive', 1, 'forest');
  addItem('ing', 'honey', FOREST.honey);
  sfx('coin');
  toast(`🐝 Жу-жу! Пчёлы поделились: +${FOREST.honey} ${ING_BY_ID.honey.e} ${ING_BY_ID.honey.name}`, 'good');
  emit('forest', { what: 'hive' });
  emit('gather', { id: 'honey', n: FOREST.honey });
  return true;
}
register('forest', (p) => FOREST_ACTS[p.arg] && FOREST_ACTS[p.arg](), 'лес: forest:hive | squirrel | fire | treehouse | kit');

// ---------- белка ----------
/** Бельчонок из задания Шишкина найден и ещё не дома. */
const kitCarried = () => {
  if (!QUEST_BY_ID.squirrel_kit) return false;
  const w = questNow('squirrel_kit');
  return w.status === 'active' && w.i === 1;
};
/** Белка на дубе: обменять орешки на золотую шишку (раз в день) или шишки на орешек. */
export async function visitSquirrel() {
  const sq = FOREST.squirrel;
  for (;;) {
    const nuts = count('ing', 'nuts'),
      cones = count('finds', 'cone'),
      gold = !done('squirrel');
    const opts = [];
    if (kitCarried()) opts.push({ text: '🐿️ Вернуть бельчонка маме', cls: 'yellow', go: 'kit' });
    opts.push({
      text: `${ING_BY_ID.nuts.e}×${sq.nuts} → ✨ Золотая шишка`,
      cls: gold && nuts >= sq.nuts ? 'green' : 'ghost',
      go: 'gold',
    });
    opts.push({ text: `${FIND_BY_ID.cone.e}×${sq.cones} → ${ING_BY_ID.nuts.e} Орешек`, cls: cones >= sq.cones ? 'blue' : 'ghost', go: 'nut' });
    opts.push({ text: 'Пока!', cls: 'ghost', go: 'bye' });
    const i = await message({
      title: 'Белка Рыжик',
      icon: '🐿️',
      html: `<p class="center big-emoji">🐿️</p><p class="center">Цок-цок! Я белка Рыжик. Обожаю орешки и меняюсь честно:<br><b>${sq.nuts} орешка</b> — на <b>золотую шишку</b> (одну в день — её можно поставить дома!),<br><b>${sq.cones} шишки</b> — на <b>орешек</b>.</p><p class="center muted">У тебя: ${ING_BY_ID.nuts.e} ${nuts} · ${FIND_BY_ID.cone.e} ${cones}</p>`,
      buttons: opts,
    });
    const go = (opts[i] || {}).go;
    if (go === 'kit') {
      emit('forest', { what: 'kitHome' });
      sfx('win');
      await message({
        title: 'Бельчонок дома!',
        icon: '🐿️',
        html: '<p class="center big-emoji">🐿️💛🐿️</p><p class="center">«Мой малыш! Спасибо-спасибо! Он опять убежал за грибами…» — мама-белка обнимает бельчонка хвостом. Расскажи Шишкину, что всё хорошо!</p>',
        buttons: [{ text: 'Ура!' }],
      });
      continue;
    }
    if (go === 'gold') {
      if (!gold) toast('🐿️ Золотую шишку я уже подарила сегодня. Приходи завтра!');
      else if (nuts < sq.nuts) toast(`🐿️ Нужно ${sq.nuts} орешка, а у тебя ${nuts}. Орешки растут на лещине осенью и продаются в ТЦ «Вкусный».`);
      else {
        addItem('ing', 'nuts', -sq.nuts);
        addItem('storage', 'golden_cone', 1);
        setDayFlag('squirrel', 1, 'forest');
        sfx('win');
        toast(`✨ Золотая шишка — в кладовке! Дома нажми 🔨 и поставь её.`, 'good');
        award('x_squirrel', { delay: 1200 });
        emit('forest', { what: 'squirrel' });
      }
      continue;
    }
    if (go === 'nut') {
      if (cones < sq.cones) toast(`🐿️ Нужно ${sq.cones} шишки, а у тебя ${cones}. Шишки лежат под ёлками у тропинок.`);
      else {
        addItem('finds', 'cone', -sq.cones);
        addItem('ing', 'nuts', 1);
        sfx('coin');
        toast(`🐿️ Держи орешек! +1 ${ING_BY_ID.nuts.e}`, 'good');
        emit('forest', { what: 'trade' });
      }
      continue;
    }
    return;
  }
}

// ---------- костёр ----------
const fireOn = () => {
  const m = S().minutes;
  return m >= FOREST.fire[0] || m < FOREST.fire[1];
};
/** Костёр: вечером и ночью пожарить зефир (нужен зефир из ТЦ «Вкусный»). */
export async function visitFire() {
  const z = ING_BY_ID.marshmallow,
    dish = DISH_BY_ID.toasted_marshmallow;
  if (!fireOn()) {
    sfx('tap');
    toast('🔥 Шишкин зажигает костёр вечером, в 6 часов. Приходи вечером с зефиром — пожарим!');
    return false;
  }
  if (!count('ing', 'marshmallow')) {
    sfx('tap');
    toast(`🔥 Костёр горит! А зефира нет 🙁 ${z.e} Зефир продаётся в ТЦ «Вкусный».`);
    return false;
  }
  addItem('ing', 'marshmallow', -1);
  addItem('dishes', dish.id, 1);
  sfx('pop');
  emit('forest', { what: 'fire' });
  award('x_marshmallow', { delay: 1600 });
  const i = await message({
    title: 'Зефир у костра',
    icon: '🔥',
    html: `<p class="center big-emoji">🔥${dish.e}</p><p class="center">Зефир на палочке зарумянился — снаружи хрустит, внутри тянется! Получилось: <b>${dish.name}</b>.</p>`,
    buttons: [{ text: '😋 Съесть сейчас', cls: 'green' }, { text: '🎒 В рюкзак' }],
  });
  if (i === 0) eat(dish.id);
  else toast(`${dish.e} ${dish.name} — в рюкзаке`, 'good');
  return true;
}

// ---------- домик на дереве ----------
/** Нарисовать вид с домика на дереве: верхушки леса, ручей, вдали гора с канатной дорогой (закрыта). */
export function paintTreeView(ctx, w, h, season, dark) {
  const night = dark > 0.6,
    eve = !night && dark > 0.25;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, night ? '#1b1f4a' : eve ? '#f08c69' : season === 'winter' ? '#b8dcf2' : '#8fd3ff');
  sky.addColorStop(1, night ? '#3b3f7a' : eve ? '#ffd8a8' : '#e7f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // солнце или луна и звёзды
  if (night) {
    ell(ctx, w * 0.8, h * 0.16, 16, 16, '#fff3bf');
    ell(ctx, w * 0.8 + 6, h * 0.16 - 4, 13, 13, '#3b3f7a');
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.45), 2, 2);
  } else ell(ctx, w * 0.82, h * 0.18, 20, 20, eve ? '#ff922b' : '#ffe066', '#fcc419', 2);
  // гора вдали: снежная шапка круглый год, к ней тянется трос канатной дороги
  const mx = w * 0.3,
    my = h * 0.12;
  poly(ctx, [mx - 150, h * 0.62, mx, my, mx + 160, h * 0.62], night ? '#4c5a8a' : '#9aa9c9', '#4a3728', 2);
  poly(ctx, [mx - 44, my + 40, mx, my, mx + 46, my + 42, mx + 22, my + 34, mx + 6, my + 46, mx - 16, my + 36], '#ffffff');
  line(ctx, w * 0.62, h * 0.66, mx + 10, my + 50, '#4a3728', 1.5);
  ell(ctx, mx + 10, my + 52, 6, 5, '#fa5252', '#4a3728', 1.2);
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔒', mx + 30, my + 34);
  // ряды верхушек леса: дальние мельче и в дымке, ближние крупнее; ели вперемешку с лиственными
  const leaf =
    season === 'winter'
      ? ['#dbe9f4', '#f1f7fc', '#e6f0f7']
      : season === 'autumn'
        ? ['#e8590c', '#fcc419', '#f59f00', '#2b8a3e']
        : season === 'spring'
          ? ['#74d680', '#b2f2bb', '#8ce99a', '#37a34a']
          : ['#2f9e44', '#51cf66', '#40c057', '#2b8a3e'];
  const haze = night ? 'rgba(27,31,74,' : eve ? 'rgba(255,216,168,' : 'rgba(231,246,255,';
  for (let row = 0; row < 5; row++) {
    const y = h * (0.56 + row * 0.11),
      sc = 0.55 + row * 0.18,
      step = 40 * sc;
    for (let i = 0, x = -10 + ((row * 17) % 23); x < w + 40; i++, x += step * (0.8 + ((i * 7 + row * 3) % 5) * 0.1)) {
      const k = (i * 5 + row * 3) % 7,
        pine = k < 2,
        col = pine ? (season === 'winter' ? '#cfe3f0' : '#2b8a3e') : leaf[k % leaf.length],
        yy = y + ((i * 13) % 9) - 4;
      if (pine) {
        poly(ctx, [x - 20 * sc, yy + 18 * sc, x, yy - 40 * sc, x + 20 * sc, yy + 18 * sc], col, '#4a3728', 1.4);
        if (season === 'winter') poly(ctx, [x - 8 * sc, yy - 22 * sc, x, yy - 40 * sc, x + 8 * sc, yy - 22 * sc], '#ffffff');
      } else {
        ell(ctx, x, yy, 26 * sc, 20 * sc, col, '#4a3728', 1.4);
        ell(ctx, x - 8 * sc, yy - 7 * sc, 10 * sc, 6 * sc, 'rgba(255,255,255,.28)');
      }
    }
    // дымка на дальних рядах
    ctx.fillStyle = haze + (0.35 - row * 0.08).toFixed(2) + ')';
    if (row < 4) ctx.fillRect(0, y - 46 * sc, w, h);
  }
  // ручей блестит между деревьями
  ctx.strokeStyle = season === 'winter' ? '#d3edfb' : '#4fb0dc';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.6);
  ctx.quadraticCurveTo(w * 0.7, h * 0.8, w * 0.6, h);
  ctx.stroke();
  // светлячки летней ночью
  if (night && season === 'summer') {
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 18; i++) ell(ctx, (i * 131) % w, h * 0.6 + ((i * 71) % (h * 0.4)), 2.2, 2.2, '#ffe066');
  }
}
/** Забраться в домик на дереве: окно с видом сверху на лес. */
export function climbTreehouse() {
  sfx('door');
  emit('forest', { what: 'treehouse' });
  emit('visit', { place: 'treehouse' });
  award('x_treehouse', { delay: 1400 });
  const season = cal().season,
    dark = darkness();
  return openPanel({
    title: 'Домик на дереве',
    icon: '🏡',
    cls: 'wide',
    render(body) {
      const W = Math.min(560, window.innerWidth - 60),
        H = Math.round(W * 0.56);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      paintTreeView(ctx, W, H, season, dark);
      body.appendChild(canvas);
      const p = document.createElement('p');
      p.className = 'center';
      p.textContent =
        'Ты забралась в домик на дереве! Отсюда виден весь лес, ручей и далёкая гора. К горе тянется канатная дорога — но она пока закрыта 🔒';
      body.appendChild(p);
    },
    foot: [{ text: 'Спуститься 🪜', cls: 'green', fn: (api) => api.close() }],
  });
}

// ---------- «Грибная охота» ----------
/** Сколько охот сегодня ещё с наградой. */
const huntsLeft = () => Math.max(0, FOREST.hunt.paid - (S2().hunts || 0));
/** Награда за охоту на stars звёзд: монеты и грибы (пополам белые и обычные). */
export const huntReward = (stars) => {
  const n = FOREST.hunt.items[stars - 1],
    porcini = Math.floor(n / 2);
  return { coins: FOREST.hunt.coins[stars - 1], porcini, mushroom: n - porcini };
};
const rewardText = (r) =>
  `🪙 ${fmtMoney(r.coins)} и ${ING_BY_ID.mushroom.e}×${r.mushroom} ${ING_BY_ID.porcini.e}×${r.porcini}`;
/** Сыграть в «Грибную охоту»: за первые игры дня — монеты и грибы в рюкзак. */
export async function mushroomHunt() {
  const left = huntsLeft(),
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('mushrooms', {
    introNote: left
      ? note(
          `🧺 <b>Награда Шишкина:</b> ⭐ 🪙 ${FOREST.hunt.coins[0]} · ⭐⭐ 🪙 ${FOREST.hunt.coins[1]} · ⭐⭐⭐ 🪙 ${FOREST.hunt.coins[2]} — и грибы в корзинку. Сегодня ещё ${left} ${left === 1 ? 'охота' : 'охоты'} с наградой.`,
        )
      : note('💛 Сегодня Шишкин уже наградил тебя. Сыграть можно для удовольствия — завтра награда снова!'),
    resultNote: (stars) =>
      left ? note(`<span class="sum">🧺 Награда: ${rewardText(huntReward(stars))}</span>`) : note('💛 Эта охота была для удовольствия.'),
  });
  if (!res || !left) return res;
  const r = huntReward(res.stars);
  setDayFlag('hunts', (S2().hunts || 0) + 1, 'forest');
  earn(r.coins, 'work');
  addItem('ing', 'mushroom', r.mushroom);
  addItem('ing', 'porcini', r.porcini);
  sfx('coin');
  toast(`Шишкин: «Вот это грибник!» ${rewardText(r)} — в рюкзаке`, 'good');
  return res;
}

const FOREST_ACTS = {
  hunt: mushroomHunt,
  hive: visitHive,
  squirrel: visitSquirrel,
  fire: visitFire,
  treehouse: climbTreehouse,
};

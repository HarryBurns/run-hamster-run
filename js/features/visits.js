// В гости к жителям: дверь домика (открыта или нет), хозяин у себя дома (поболтать, чай, угощение),
// «изюминки» домов — телескоп, гигантский холодильник, духовка.
//
// Когда можно войти (часы — VISIT в data/visits.js, расчёт — npcPlace() в core/queries.js — одно правило «где житель»):
//   утром до 9:00 и вечером после 19:00 хозяин дома; после 22:00 спит; днём гуляет — дверь закрыта;
//   если он сегодня позвал («Заходи ко мне сегодня!» — в разговоре, в ответ на угощение, письмо «день гостей»),
//   дверь открыта весь день.
// Действия реестра: 'home-of:<житель>' — дверь домика в городе; 'host:<житель>' — хозяин внутри;
// 'say' — подсказка у предмета; 'telescope', 'bigfridge', 'oven' — особая мебель (data/furniture.js).
import { addItem, award, countVisit, markFriendToday, meetFriend, setDayFlag, spendMinutes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { emit, on } from '../core/events.js';
import { go } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, darkness, npcPlace, npcWhere, playerLook, guestsWaiting } from '../core/state.js';
import { el, esc, pick } from '../core/util.js';
import { DISH_BY_ID, NPCS, NPC_BY_ID, NPC_HOME, VISIT, npcLook } from '../data/index.js';
import { npcHomeScene, HOUSE_BY_ID } from '../interiors/houses.js';
import { dialog } from '../ui/dialog.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { pickDish } from './cooking.js';
import { addPts, chatToday, meetNow, treatFriend } from './friends.js';
import { npcAwayWords, questTalk } from './quests.js';
import { placeLine } from './tales.js';
import { paintTea, paintStars } from './visits_art.js';

const S = () => G.state;
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const pron = (npc) => (npc.fem ? 'она' : 'он');

/**
 * Крюк двери домика — чтобы праздники (features/holidays_winter.js: колядки на Рождество) могли постучаться по-своему,
 * а гости ничего не знали о праздниках: knock(id, ctx, where) → true — дверь «занята» праздником (обычный визит не
 * нужен), false / null — как обычно. where — где хозяин (npcWhere).
 */
export const doorHooks = { knock: null };

// ---------- дверь домика ----------
/** Подошли к двери домика жителя. back — место у двери снаружи (туда вернёт выход из дома). */
export async function visitHome(id, ctx = {}) {
  const npc = NPC_BY_ID[id],
    home = NPC_HOME[id],
    fr = S().friends[id],
    place = npcPlace(id), // одно правило «где житель сейчас» (core/queries.js)
    where = npcWhere(id);
  if (where === 'guest') {
    toast(`Здесь живёт ${npc.name}. А сейчас ${pron(npc)} ${npcAwayWords(id)}!`);
    return;
  }
  if (where === 'asleep') {
    sfx('pop');
    toast(`Тс-с! ${npc.name} уже спит 😴 Приходи завтра.`);
    return;
  }
  if (doorHooks.knock && (await doorHooks.knock(id, ctx, where))) return;
  if (where === 'out' && place.at === 'fest') {
    sfx('pop');
    toast(`Дома никого: ${npc.name} сейчас ${npcAwayWords(id)} Беги туда — там весело!`);
    return;
  }
  if (where === 'out') {
    sfx('pop');
    // «день гостей»: подсказать, кто сегодня ждёт дома (письмо назвало их по именам)
    const wait = guestsWaiting().map((q) => NPC_BY_ID[q].name);
    // где он днём: на своём месте в городе (home.away) или в отеле — у бассейна, в номере 203 (npcAwayWords)
    const now = npcAwayWords(id) || home.away;
    toast(
      (fr.met
        ? `Дверь закрыта: ${npc.name} сейчас ${now}. Дома ${pron(npc)} утром до ${hhmm(VISIT.morningEnd)} и вечером после ${hhmm(VISIT.eveningStart)} 🚪`
        : `Здесь живёт ${npc.name}. Сейчас ${pron(npc)} ${now} — там и познакомитесь! Дома бывает утром и вечером 🚪`) +
        (wait.length ? ` А в гости сегодня ждут: ${wait.join(', ')}.` : ''),
    );
    return;
  }
  // хозяин дома. Незнакомые сначала знакомятся — прямо на пороге
  sfx('bell');
  if (!fr.met) {
    meetNow(id);
    await dialog({
      look: npcLook(id),
      name: npc.name,
      happy: true,
      text: `Тук-тук? Ой, привет! Я ${npc.name}. А ты, наверное, ${esc(S().name)} из дома на холме? Будем дружить! Заходи, не стой на пороге.`,
      options: [{ text: 'Спасибо!', cls: 'green' }],
    });
  }
  sfx('door');
  go(npcHomeScene(id), ctx.back ? { back: ctx.back } : {});
  const v = countVisit(id);
  award('x_visit', { delay: 1500 });
  if (v.homes >= NPCS.length) award('x_visit_all', { delay: 2600 });
  emit('visit', { place: 'home', npc: id });
  emit('visit', { place: 'home_' + id, npc: id });
  setTimeout(() => toast(`${npc.name}: «${pick(home.hello)}»`), 500);
}

// Хомячок в доме жителя (город или тайное место): пока она там, хозяин дома — не уходит гулять, в отель или спать
// посреди разговора (G.hostVisit — npcPlace в core/queries.js). Только если он был дома, когда она вошла.
on('scene', ({ name }) => {
  const owner = (HOUSE_BY_ID[name] || {}).owner || null;
  G.hostVisit = null;
  if (owner && ['home', 'door'].includes((npcPlace(owner) || {}).at)) G.hostVisit = owner;
});

register(
  'home-of',
  (p, ctx) => visitHome(p.arg, ctx),
  'дверь домика жителя: home-of:<житель>; ctx.back — место у двери',
);

// ---------- хозяин у себя дома ----------
/** Чаепитие: маленькая сценка за столом. Возвращает Promise — когда гостья встала из-за стола. */
function teaScene(id) {
  const npc = NPC_BY_ID[id],
    tea = NPC_HOME[id].tea;
  return new Promise((resolve) => {
    const W = 300,
      H = 170;
    const { canvas, ctx } = makeCanvas(W, H);
    canvas.style.cssText += ';display:block;margin:0 auto;border-radius:18px;background:#fff3d6;max-width:100%';
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      paintTea(ctx, W, H, t, playerLook(), npcLook(id), npc.small, tea.e);
      raf = requestAnimationFrame(loop);
    };
    loop();
    sfx('eat');
    openPanel({
      title: `В гостях: ${tea.name}`,
      icon: '🫖',
      cls: 'narrow',
      render(body) {
        body.appendChild(canvas);
        body.appendChild(el('p', 'center', `<b>${npc.name}:</b> «${tea.text}»`));
        body.appendChild(el('p', 'muted center', 'Вы пьёте чай и болтаете обо всём на свете.'));
      },
      foot: [{ text: 'Спасибо, очень вкусно! 😋', cls: 'green', fn: (p) => p.close() }],
      onClose: () => {
        cancelAnimationFrame(raf);
        resolve();
      },
    });
  });
}

/** Разговор с хозяином у него дома. ctx.scene — сцена дома (чтобы показать радость). */
export async function hostDialog(id, ctx = {}) {
  const npc = NPC_BY_ID[id],
    home = NPC_HOME[id],
    fr = S().friends[id],
    look = npcLook(id),
    tea = home.tea;
  if (!fr.met) meetFriend(id);
  let text = pick([
    `Как хорошо, что ты зашла, ${esc(S().name)}! Чем займёмся?`,
    'Будь как дома! Трогай всё, что хочется.',
    'Садись, рассказывай: что нового в городе?',
  ]);
  const qt = await questTalk(id); // задание из журнала — сначала оно (features/quests.js)
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const hadTea = fr.tea === S().day;
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '💬 Поболтать', cls: 'blue' },
        { text: `${tea.e} ${hadTea ? 'Чай уже пили' : 'Попьём чаю?'}`, cls: hadTea ? 'ghost' : 'green' },
        { text: '🎁 Угостить', cls: 'yellow' },
        { text: 'Пока!' },
      ],
    });
    if (i === 0) {
      text = placeLine(id) || pick(home.lines);
      chatToday(id);
    } else if (i === 1) {
      if (hadTea) {
        text = 'Мы сегодня уже чаёвничали! Приходи завтра — заварю свежий.';
        continue;
      }
      await teaScene(id);
      markFriendToday(id, 'tea');
      spendMinutes(30);
      addPts(id, 3);
      award('x_tea', { delay: 1200 });
      emit('visit', { place: 'tea', npc: id });
      emit('guestHappy', { id }); // хозяин и героиня радуются в комнате
      emit('happy');
      emit('hud');
      text = pick([
        'Как славно посидели! Заходи ещё.',
        'С тобой и чай вкуснее!',
        'Уф, напились чаю. Теперь можно и поиграть!',
      ]);
    } else if (i === 2) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Ничего страшного, в другой раз!';
        continue;
      }
      const fav = treatFriend(id, dish);
      emit('gift', { id, dish });
      emit('guestHappy', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} Это же моё любимое блюдо! И прямо к столу! Спасибо-спасибо!`
        : `${DISH_BY_ID[dish].e} Ой, гостинец! Как вкусно, спасибо тебе!`;
    } else return;
  }
}

register('host', (p, ctx) => hostDialog(p.arg, ctx), 'хозяин у себя дома: host:<житель> — поболтать, чай, угостить');

// ---------- вещи в домах ----------
register('say', (p) => toast(pick([].concat(p.text))), 'подсказка у предмета: { text: строка или список }');

/** Ночное небо в телескоп: созвездия, которых нет ни в одном атласе. */
function openStars() {
  const W = 320,
    H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.cssText +=
    ';display:block;margin:0 auto;border-radius:26px;max-width:100%;height:auto;aspect-ratio:320/220';
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    paintStars(ctx, W, H, t);
    raf = requestAnimationFrame(loop);
  };
  loop();
  sfx('magic');
  openPanel({
    title: 'Звёзды в телескоп',
    icon: '🔭',
    cls: 'narrow',
    render(body) {
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          'Вот <b>Большой Хомяк</b>, а рядом — <b>Семечка</b>. Увидишь падающую звезду — загадай желание! 🌠',
        ),
      );
    },
    foot: [{ text: 'Красота!', cls: 'green', fn: (p) => p.close() }],
    onClose: () => cancelAnimationFrame(raf),
  });
  emit('visit', { place: 'stars' });
}

register(
  'telescope',
  () => {
    if (darkness() > 0.4) openStars();
    else {
      sfx('pop');
      toast('В телескоп видно облака и одну любопытную чайку. А звёзды покажутся, когда стемнеет — приходи вечером 🔭');
    }
  },
  'телескоп: вечером — звёздное небо',
);

register(
  'bigfridge',
  (p, ctx) => {
    const sc = ctx.scene;
    if (!sc || sc.owned) return run('fridge', ctx); // у себя дома это просто большой холодильник
    const npc = NPC_BY_ID[sc.desc.owner] || NPC_BY_ID.ponchik;
    const first = !S().dayFlags.fridgeTreat;
    sfx('door');
    if (first) {
      setDayFlag('fridgeTreat', 1);
      addItem('dishes', 'donut', 1);
    }
    return message({
      title: `Холодильник: ${npc.name}`,
      icon: '🧊',
      html: `<p class="center big-emoji">🍕🍩🧀</p><p class="center">Вот это да! Двенадцать пицц, гора пончиков, сыр, торт и банка огурчиков. На дверце записка: <b>«НЕ ТРОГАТЬ! Ну ладно, один пончик можно»</b>.</p>
        <p class="center">${first ? '<b>+1 🍩 Пончик</b> — он уже в твоём рюкзаке!' : 'Сегодня ты пончик уже брала. Завтра можно ещё один 😉'}</p>`,
      buttons: [{ text: first ? 'Спасибо!' : 'Закрыть дверцу' }],
    });
  },
  'гигантский холодильник: дома — холодильник, в гостях — угощение раз в день',
);

register(
  'oven',
  (p, ctx) => {
    const sc = ctx.scene,
      it = ctx.item;
    sfx('hiss');
    if (sc && it) sc.burst(it.x, sc.geo.fy(it.floor) - 120, 'steam', 5);
    toast(
      pick([
        'М-м-м! Из духовки пахнет пирогом 🥧',
        'Пирог румянится. Ещё пять минуточек… 🥧',
        'Тёплая! Сразу видно: тут любят печь пироги 🥧',
      ]),
    );
    emit('thing', { id: it ? it.id : 'oven', owner: (sc && sc.desc.owner) || null });
  },
  'духовка с пирогом',
);

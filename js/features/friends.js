// Друзья: разговоры с жителями, гости у героини дома, телефон.
// В гости к самим жителям — features/visits.js.
import {
  addItem,
  learnRecipe,
  award,
  meetFriend,
  addFriendPts,
  markFriendToday,
  inviteGuest,
  removeGuest,
  takeVisitor,
  inviteHome,
  MAX_GUESTS,
} from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { scene } from '../core/loop.js';
import { register } from '../core/registry.js';
import {
  G,
  cal,
  friendHearts,
  outfitTags,
  ownsHome,
  ownedHomes,
  invitedToday,
  npcWhere,
  npcLookNow,
  villaStage,
  villaWords,
  yardHas,
} from '../core/state.js';
import { el, esc, pick } from '../core/util.js';
import { drawPortrait } from '../art/hamster.js';
import {
  CLOTHES_BY_ID,
  DISH_BY_ID,
  SECRET_RECIPES,
  NPCS,
  NPC_BY_ID,
  npcLook,
  SEASON_LINES,
  OUTFIT_LINES,
  HOME_BY_ID,
  NPC_HOME,
  INVITE_CHANCE,
} from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { pickDish } from './cooking.js';
import { giveSurprise } from './gifts.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;

/**
 * Крюки разговора — чтобы праздники (features/holidays.js) могли вмешаться в разговор с жителем, а друзья ничего
 * не знали о праздниках (иначе импорты пошли бы по кругу):
 *   greet(id)  → реплика вместо «Привет!» (праздничное поздравление) или null;
 *   chat(id)   → реплика на «Поболтать» или null — обычная болтовня;
 *   talk(id)   → async, свой разговор до обычного: { end: true } — разговор окончен, { text } — дальше с этой репликой,
 *                null — как обычно (новогодний подарок другу);
 *   guest(id)  → async, то же для гостя у себя дома (на дне рождения — «🎂 Задуть свечи!»).
 */
export const talkHooks = { greet: null, chat: null, talk: null, guest: null };

/** В какой из своих домов придут гости: в тот, где героиня сейчас, а если она не дома — в основной. */
export function hostHome() {
  const sc = scene();
  return sc && sc.owned && sc.desc.guests && ownsHome(sc.houseKey) ? sc.houseKey : S().homeMain;
}
/** «в квартиру», «в бунгало» — куда бежит гость; к первому дому — по ступени: «в домик», «домой», «на виллу». */
const HOME_TO = {
  flat: 'в квартиру',
  bungalow: 'в бунгало',
  penthouse: 'в пентхаус',
  cabin: 'в лесной домик',
  suite: 'в номер-люкс',
};
const homeTo = (id) => (id === 'villa' ? villaWords().to : HOME_TO[id] || 'в гости');

/**
 * Житель зовёт к себе: «Заходи ко мне сегодня!» — и весь день ждёт дома (дверь открыта). Возвращает его реплику
 * или '' — если уже звал, спит или сидит в гостях у героини.
 */
export function inviteLine(id) {
  if (invitedToday(id) || npcWhere(id) === 'guest' || npcWhere(id) === 'asleep') return '';
  inviteHome(id);
  return NPC_HOME[id].invite;
}

/** Прибавить очки дружбы (то же, что действие addFriendPts: награды за сердечки — в подписке ниже). */
export const addPts = (id, n) => addFriendPts(id, n);

// ---------- угостить, поболтать, познакомиться (на улице, в гостях у друга, друг в гостях у тебя) ----------
/** Поболтали: первый разговор за день — дружба +1. Событие talk — всегда. */
export function chatToday(id) {
  if (S().friends[id].chat !== S().day) {
    markFriendToday(id, 'chat');
    addPts(id, 1);
  }
  emit('talk', { id });
}
/**
 * Угостили блюдом dish: оно уходит из рюкзака; первое угощение за день (отметка дня kind: gift — на улице и в гостях
 * у друга, treat — друг в гостях у тебя) — дружба pts[0], любимым блюдом — pts[1]. true — блюдо любимое.
 */
export function treatFriend(id, dish, kind = 'gift', pts = [2, 4]) {
  addItem('dishes', dish, -1);
  sfx('eat');
  const fav = dish === NPC_BY_ID[id].fav;
  if (S().friends[id][kind] !== S().day) {
    markFriendToday(id, kind);
    addPts(id, fav ? pts[1] : pts[0]);
  }
  return fav;
}
/** Познакомились: отметка, дружба +1, это и первый разговор за день. */
export function meetNow(id) {
  meetFriend(id);
  markFriendToday(id, 'chat');
  addPts(id, 1);
  emit('talk', { id });
}

// сердечки выросли — откуда бы ни пришли очки (разговор, гость, скамейка, волейбол, рассказ, праздник)
on('friend', ({ id, before, after }) => {
  const npc = NPC_BY_ID[id];
  if (!npc) return;
  toast(`${npc.name}: дружба выросла! ${'❤️'.repeat(after)}`, 'good');
  sfx('heart');
  if (after >= 2 && before < 2) {
    const unknown = SECRET_RECIPES.filter((r) => !S().recipes.includes(r));
    const rec = unknown.includes(npc.fav) ? npc.fav : pick(unknown);
    if (rec) {
      learnRecipe(rec);
      const d = DISH_BY_ID[rec];
      enqueue(
        () =>
          message({
            title: 'Секретный рецепт!',
            icon: '📜',
            html: `<div class="center big-emoji">${d.e}</div><p class="center"><b>${npc.name}</b> ${npc.fem ? 'рассказала' : 'рассказал'} тебе секретный рецепт:<br><b>${d.name}</b>!</p>`,
          }),
        { delay: 500 },
      );
    }
  }
  if (after >= 5 && before < 5) {
    award('x_friend', { delay: 900 });
    giveSurprise(`${npc.name} дарит тебе подарок в знак дружбы!`, 1200);
  }
});

function chatLine(npc) {
  const own = talkHooks.chat && talkHooks.chat(npc.id);
  if (own) return own;
  // вспомнить место, которое хомячок открыла (лес, пустыня, джунгли…) — data/tales.js
  const place = placeLine(npc.id);
  if (place) return place;
  const tags = outfitTags(),
    sea = cal().season,
    r = Math.random();
  const body = S().look.outfit.body,
    kind = body && CLOTHES_BY_ID[body] ? CLOTHES_BY_ID[body].kind : null;
  if (r < 0.35) {
    if (kind === 'swim' && sea === 'winter') return pick(OUTFIT_LINES.cold);
    if (kind === 'swim') return pick(OUTFIT_LINES.swim);
    if (sea === 'winter' && !tags.has('warm')) return pick(OUTFIT_LINES.cold);
    if (sea === 'summer' && kind && kind.startsWith('jacket')) return pick(OUTFIT_LINES.hot);
    if (tags.has('fancy')) return pick(OUTFIT_LINES.fancy);
  }
  if (r < 0.55) return pick(SEASON_LINES[sea]);
  return pick(npc.lines);
}

export async function npcDialog(id) {
  const npc = NPC_BY_ID[id],
    fr = S().friends[id],
    look = npcLookNow(id); // в праздник — в праздничном наряде (этап 15)
  let text;
  if (!fr.met) {
    meetNow(id);
    text = `Привет! Я ${npc.name}. А ты, наверное, ${esc(S().name)} из дома на холме? Будем дружить!`;
  } else
    text =
      (talkHooks.greet && talkHooks.greet(id)) ||
      pick([`Привет, ${esc(S().name)}!`, 'О, привет!', `${esc(S().name)}! Рад${npc.fem ? 'а' : ''} тебя видеть!`]);
  // есть задание из журнала (взять, как дела, сдать) — сначала оно (features/quests.js)
  const qt = await questTalk(id);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  // праздник: свой разговор (подарок другу на Новый год — features/holidays_winter.js)
  const ht = talkHooks.talk && (await talkHooks.talk(id, text));
  if (ht && ht.end) return;
  if (ht && ht.text) text = ht.text;
  for (;;) {
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '💬 Поболтать', cls: 'blue' },
        { text: '🏡 Позвать в гости', cls: 'green' },
        { text: '🎁 Угостить', cls: 'yellow' },
        { text: 'Пока!' },
      ],
    });
    if (i === 0) {
      text = chatLine(npc);
      // первый разговор за день: иногда друг зовёт к себе в гости
      if (fr.chat !== S().day && Math.random() < INVITE_CHANCE) text = inviteLine(id) || text;
      chatToday(id);
    } else if (i === 1) {
      if (S().guests.length >= MAX_GUESTS) text = 'У тебя уже полный дом гостей! Позови меня в другой раз.';
      else {
        const home = hostHome();
        if (!invite(id, home)) text = 'Я уже у тебя в гостях! Беги домой, встретимся там.';
        else {
          await dialog({
            look,
            name: npc.name,
            happy: true,
            text: `Ура! Уже бегу к тебе ${homeTo(home)}. Встретимся там!`,
            options: [{ text: 'До встречи!', cls: 'green' }],
          });
          return;
        }
      }
    } else if (i === 2) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Ничего страшного, в другой раз!';
        continue;
      }
      const fav = treatFriend(id, dish);
      emit('gift', { id, dish });
      text = fav
        ? `${DISH_BY_ID[dish].e} Это же моё любимое блюдо! Спасибо-спасибо-спасибо!`
        : `${DISH_BY_ID[dish].e} Ой, как вкусно! Спасибо тебе большое!`;
      // в ответ на угощение друг зовёт к себе
      const inv = inviteLine(id);
      if (inv) text += ' ' + inv;
    } else return;
  }
}

/** Позвать в гости (в разговоре или по телефону); позвали — событие invite (шаг вводного задания). */
function invite(id, home = hostHome()) {
  const ok = inviteGuest(id, home);
  if (ok) emit('invite', { id });
  return ok;
}

export async function guestDialog(id) {
  const npc = NPC_BY_ID[id],
    look = npcLookNow(id); // в праздник — в праздничном наряде (этап 15)
  const here = S().guestsAt;
  let text = pick(
    here === 'villa'
      ? [
          // свой первый дом растёт («Вилла растёт»): вилла — с третьего этажа, бассейн — там же или во дворе
          villaStage() >= 3 ? 'Какая у тебя красивая вилла!' : 'Какой у тебя славный домик!',
          villaStage() >= 3 || yardHas('pool') ? 'А можно мне потом в бассейн?' : 'Мне у тебя очень нравится!',
          'У тебя так уютно!',
          'Чем это так вкусно пахнет?',
        ]
      : [
          'Как у тебя тут здорово!',
          'У тебя так уютно!',
          'Чем это так вкусно пахнет?',
          here === 'penthouse'
            ? 'Ух, как высоко! Весь город как на ладошке.'
            : 'Отличный дом! Можно я буду приходить почаще?',
          here === 'bungalow' ? 'Слышишь, как шумит море? Красота!' : 'А где ты купила такую мебель?',
        ],
  );
  const ht = talkHooks.guest ? await talkHooks.guest(id) : null; // праздник (торт на день рождения) — сначала он
  if (ht && ht.end) return;
  const qt = await questTalk(id); // задание из журнала — сначала оно
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '🍰 Угостить', cls: 'green' },
        { text: '💬 Поболтать', cls: 'blue' },
        { text: '👋 Проводить домой', cls: 'yellow' },
        { text: 'Закрыть' },
      ],
    });
    if (i === 0) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Я подожду, не торопись!';
        continue;
      }
      const fav = treatFriend(id, dish, 'treat', [3, 5]);
      emit('guestHappy', { id });
      emit('treat', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} ${DISH_BY_ID[dish].name}?! Моё самое любимое! Ты лучшая хозяйка на свете!`
        : `${DISH_BY_ID[dish].e} М-м-м, объедение! Спасибо за угощение!`;
    } else if (i === 1) {
      text = placeLine(id) || pick(npc.lines);
      chatToday(id);
    } else if (i === 2) {
      removeGuest(id);
      toast(`${npc.name}: «Спасибо, было здорово! Пока!»`);
      return;
    } else return;
  }
}

export function openPhone() {
  let where = hostHome(); // куда зовём: если домов несколько, можно выбрать
  openPanel({
    title: 'Телефон: позвать в гости',
    icon: '📱',
    render(body, tab, panel) {
      const night = S().minutes >= 22 * 60;
      const homes = ownedHomes();
      if (homes.length > 1) {
        body.appendChild(el('div', 'muted', 'Куда позвать гостей?'));
        const row = el('div', 'opt-row');
        for (const h of homes) {
          const b = el('button', 'opt' + (h === where ? ' sel' : ''), `${HOME_BY_ID[h].icon} ${HOME_BY_ID[h].name}`);
          b.onclick = () => {
            sfx('tap');
            where = h;
            panel.refresh();
          };
          row.appendChild(b);
        }
        body.appendChild(row);
      }
      // знакомые — первыми: иначе первый друг оказывался под четырьмя «???» за краем экрана телефона
      const met = (n) => !!S().friends[n.id].met;
      for (const n of [...NPCS.filter(met), ...NPCS.filter((n) => !met(n))]) {
        const fr = S().friends[n.id],
          here = S().guests.includes(n.id);
        const li = el('div', 'list-item');
        const { canvas, ctx } = makeCanvas(52, 52);
        canvas.style.cssText += ';border-radius:16px;background:#ffe3ec;flex:none';
        drawPortrait(ctx, 26, 26, 52, npcLook(n.id));
        li.appendChild(canvas);
        const h = friendHearts(n.id);
        li.appendChild(
          el(
            'div',
            'grow',
            `<div class="ttl">${fr.met ? n.name : '???'}</div><div class="sub">${fr.met ? `<span class="hearts">${'❤️'.repeat(h)}${'🤍'.repeat(5 - h)}</span>` : 'Вы ещё не знакомы — найди в городе'}</div>`,
          ),
        );
        if (fr.met) {
          const b = el(
            'button',
            'btn small ' + (here ? 'ghost' : 'green'),
            here ? 'В гостях' : night ? 'Спит' : 'Позвать',
          );
          b.disabled = here || night || S().guests.length >= MAX_GUESTS;
          b.onclick = () => {
            if (invite(n.id, where)) {
              sfx('bell');
              toast(`${n.name} уже бежит к тебе ${homeTo(where)}! ${HOME_BY_ID[where].icon}`, 'good');
              panel.refresh();
            }
          };
          li.appendChild(b);
        }
        body.appendChild(li);
      }
      body.appendChild(el('p', 'muted center', 'В гости можно позвать до трёх друзей сразу.'));
    },
  });
}

register('npc', (p) => npcDialog(p.arg), 'поговорить с жителем в городе: npc:<житель>');

register('guest', (p) => guestDialog(p.arg), 'поговорить с гостем дома: guest:<житель>');

// Гость, который приходит сам: после 11 утра, если хомячок дома и сцена-дом готова принять гостей.
function tickVisitor() {
  const s = S(),
    sc = scene();
  if (s.visitor && s.minutes >= 11 * 60 && sc && sc.canHostGuests && sc.canHostGuests()) {
    const id = takeVisitor();
    if (s.friends[id].met && inviteGuest(id, sc.houseKey)) {
      sfx('bell');
      toast(`Тук-тук! ${NPC_BY_ID[id].name} заглянул${NPC_BY_ID[id].fem ? 'а' : ''} в гости 🚪`, 'good');
    }
  }
}

on('step', tickVisitor);

// Друзья: разговоры с жителями, гости на вилле, телефон.
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
  MAX_GUESTS,
} from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { scene } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, friendHearts, outfitTags } from '../core/state.js';
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
} from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { pickDish } from './cooking.js';
import { giveSurprise } from './gifts.js';

const S = () => G.state;

register(
  'home-of',
  (p) => {
    const n = NPC_BY_ID[p.arg];
    toast(
      `Здесь живёт ${n.name}. ${S().guests.includes(n.id) ? 'Сейчас у тебя в гостях!' : S().minutes >= 22 * 60 ? 'Тс-с, уже спит!' : 'Сейчас гуляет в городе.'}`,
    );
  },
  'домик жителя (пока просто подсказка): home-of:<житель>',
);

function addPts(id, n) {
  const before = friendHearts(id);
  addFriendPts(id, n);
  const after = friendHearts(id),
    npc = NPC_BY_ID[id];
  if (after > before) {
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
  }
}

function chatLine(npc) {
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
    look = npcLook(id);
  let text;
  if (!fr.met) {
    meetFriend(id);
    text = `Привет! Я ${npc.name}. А ты, наверное, ${esc(S().name)} с большой виллы? Будем дружить!`;
    addPts(id, 1);
    markFriendToday(id, 'chat');
    emit('talk', { id });
  } else
    text = pick([`Привет, ${esc(S().name)}!`, 'О, привет!', `${esc(S().name)}! Рад${npc.fem ? 'а' : ''} тебя видеть!`]);
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
      if (fr.chat !== S().day) {
        markFriendToday(id, 'chat');
        addPts(id, 1);
      }
      emit('talk', { id });
    } else if (i === 1) {
      if (S().guests.length >= MAX_GUESTS) text = 'У тебя уже полный дом гостей! Позови меня в другой раз.';
      else {
        invite(id);
        await dialog({
          look,
          name: npc.name,
          happy: true,
          text: 'Ура! Уже бегу к тебе на виллу. Встретимся там!',
          options: [{ text: 'До встречи!', cls: 'green' }],
        });
        return;
      }
    } else if (i === 2) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Ничего страшного, в другой раз!';
        continue;
      }
      addItem('dishes', dish, -1);
      sfx('eat');
      const fav = dish === npc.fav;
      if (fr.gift !== S().day) {
        markFriendToday(id, 'gift');
        addPts(id, fav ? 4 : 2);
      }
      emit('gift', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} Это же моё любимое блюдо! Спасибо-спасибо-спасибо!`
        : `${DISH_BY_ID[dish].e} Ой, как вкусно! Спасибо тебе большое!`;
    } else return;
  }
}

function invite(id) {
  return inviteGuest(id);
}

export async function guestDialog(id) {
  const npc = NPC_BY_ID[id],
    fr = S().friends[id],
    look = npcLook(id);
  let text = pick([
    'Какая у тебя красивая вилла!',
    'А можно мне потом в бассейн?',
    'У тебя так уютно!',
    'Чем это так вкусно пахнет?',
  ]);
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
      addItem('dishes', dish, -1);
      sfx('eat');
      const fav = dish === npc.fav;
      if (fr.treat !== S().day) {
        markFriendToday(id, 'treat');
        addPts(id, fav ? 5 : 3);
      }
      emit('guestHappy', { id });
      emit('treat', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} ${DISH_BY_ID[dish].name}?! Моё самое любимое! Ты лучшая хозяйка на свете!`
        : `${DISH_BY_ID[dish].e} М-м-м, объедение! Спасибо за угощение!`;
    } else if (i === 1) {
      text = pick(npc.lines);
      if (fr.chat !== S().day) {
        markFriendToday(id, 'chat');
        addPts(id, 1);
      }
      emit('talk', { id });
    } else if (i === 2) {
      removeGuest(id);
      toast(`${npc.name}: «Спасибо, было здорово! Пока!»`);
      return;
    } else return;
  }
}

export function openPhone() {
  openPanel({
    title: 'Телефон: позвать в гости',
    icon: '📱',
    render(body, tab, panel) {
      const night = S().minutes >= 22 * 60;
      for (const n of NPCS) {
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
            if (invite(n.id)) {
              sfx('bell');
              toast(`${n.name} уже бежит к тебе на виллу! 🏡`, 'good');
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
    if (s.friends[id].met && inviteGuest(id)) {
      sfx('bell');
      toast(`Тук-тук! ${NPC_BY_ID[id].name} заглянул${NPC_BY_ID[id].fem ? 'а' : ''} в гости 🚪`, 'good');
    }
  }
}

on('step', tickVisitor);

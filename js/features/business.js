// Свой бизнес: купить заведение у хозяина, касса с выручкой, работа хозяйки, «блюдо дня», вывеска,
// окно «Мои заведения».
//
// Заведения — таблица BUSINESSES (data/estate.js), цены и правила — BIZ и BIZ_RULES (data/economy.js).
// Куплено ли и сколько в кассе — state.biz[id] = { day, till, total, last, special?, sign?, title? }.
// Выручка ложится в кассу при смене дня (действие nextDay в core/actions.js); забрать — в самом заведении.
//
// Как заведение попадает в игру, не трогая город: его узнают по продавцу (vendor). Окна и диалоги заведений
// (кафе, ресторан, салон, бутик — features/shops.js, salon.js, wardrobe.js, places.js) спрашивают здесь:
//   bizByVendor(vendor)   какое это заведение (или null);
//   bizFoot(biz, panel)   кнопки для низа окна: «Купить заведение» или «Моё заведение», работа за стойкой;
//   bizSign(biz)          табличка «Хозяйка — <имя>», если заведение своё;
//   bizAskOption(biz)     вариант ответа для диалога у двери.
// Действия реестра: 'biz:<id>' — «кабинет» заведения (покупка или касса), 'my-biz' — окно «Мои заведения».
import { addBiz, award, collectBiz, setBizOpt, bizDayIncome, bizTillCap } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register, run } from '../core/registry.js';
import { G, ownsBiz } from '../core/state.js';
import { el, esc, fmtMoney, plural } from '../core/util.js';
import {
  BUSINESSES,
  BIZ_BY_ID,
  BIZ_RULES,
  DISH_BY_ID,
  SECRET_RECIPES,
  JOBS,
  VENDORS,
  vendorLook,
} from '../data/index.js';
import { openPanel, message, confirmBox } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn, lacking, lackText } from './purchase.js';
import { hasMinigame } from '../minigames/host.js';

const S = () => G.state;
const coins = (n) => `🪙 ${fmtMoney(n)}`;
const pct = (k) => Math.round(k * 100) + '%';
const SIGN_COLORS = ['#ff6b9d', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];

/** Заведение по его продавцу (так его узнают окна магазинов и диалоги у двери). */
export const bizByVendor = (vendor) => BUSINESSES.find((b) => b.vendor === vendor) || null;
/** Как заведение называется сейчас: хозяйка может дать своё название. */
export const bizTitle = (id) => (S().biz[id] && S().biz[id].title) || BIZ_BY_ID[id].name;
/** Сколько дней окупается заведение без работы хозяйки. */
const payback = (b) => Math.ceil(b.price / b.income);

// ---------- кусочки для окон заведений ----------
/** Табличка «Хозяйка — <имя>» (или null, если заведение чужое). */
export function bizSign(biz) {
  if (!biz || !ownsBiz(biz.id)) return null;
  const st = S().biz[biz.id];
  const e = el('div', 'biz-sign', `👑 <b>${esc(bizTitle(biz.id))}</b> · хозяйка — ${esc(S().name)}`);
  e.style.background = st.sign || SIGN_COLORS[0];
  return e;
}
/** Кнопки для низа окна заведения. */
export function bizFoot(biz, { work = true } = {}) {
  if (!biz) return [];
  const own = ownsBiz(biz.id),
    list = [];
  // за стойкой кафе может поработать кто угодно (бариста — обычная работа), остальное — только хозяйка
  if (work && biz.game && hasMinigame(biz.game) && (own || JOBS[biz.game]))
    list.push({
      text: own ? biz.work : '☕ Помочь за стойкой',
      cls: 'blue',
      fn: (panel) => {
        panel.close();
        workAt(biz.id);
      },
    });
  list.push({
    text: own
      ? `👑 Моё заведение${S().biz[biz.id].till ? ' · ' + coins(S().biz[biz.id].till) : ''}`
      : '🏪 Купить заведение',
    cls: own ? 'yellow' : 'ghost',
    fn: (panel) => {
      panel.close();
      openBizOffice(biz.id);
    },
  });
  return list;
}
/** Вариант ответа для диалога у двери заведения. */
export function bizAskOption(biz) {
  if (!biz) return null;
  return ownsBiz(biz.id)
    ? {
        text: `👑 Моё заведение${S().biz[biz.id].till ? ' · ' + coins(S().biz[biz.id].till) : ''}`,
        cls: 'yellow',
        do: 'biz:' + biz.id,
      }
    : { text: '🏪 Купить заведение', cls: 'blue', do: 'biz:' + biz.id };
}
/** Приветствие у двери своего заведения: бывший хозяин узнаёт хозяйку. */
export function bizAskText(biz, text) {
  if (!biz || !ownsBiz(biz.id)) return text;
  return `<span class="boss-hi">О, хозяйка пришла! Здравствуй, ${esc(S().name)}!</span> ${text}`;
}

// ---------- работа хозяйки ----------
/** Поработать в заведении: мини-игра (в своём заведении выручка дня от этого растёт — см. features/minigames.js). */
export function workAt(id) {
  const b = BIZ_BY_ID[id];
  if (!b || !b.game || !hasMinigame(b.game)) return null;
  return run({ do: 'minigame', arg: b.game, biz: id });
}

// ---------- покупка ----------
async function buyBiz(b, panel) {
  if (lacking(b.price)) {
    buy(b.price); // подскажет, сколько не хватает
    return;
  }
  const v = VENDORS[b.vendor];
  const ok = await confirmBox(
    'Покупаем заведение?',
    `<p class="center big-emoji">${b.icon}</p><p class="center"><b>${b.name}</b> за <b>${coins(b.price)}</b>.<br>${v.name} останется здесь работать, а ты станешь хозяйкой. Берём?</p>`,
    'Да, покупаю! 🏪',
    'Ещё подумаю',
  );
  if (!ok || !buy(b.price)) return;
  const n = addBiz(b.id);
  emit('buy', { cat: 'biz', id: b.id });
  award('x_biz', { delay: 1500 });
  if (n >= 3) award('x_biz_chain', { delay: 2600 });
  if (n >= BUSINESSES.length) award('x_biz_all', { delay: 3700 });
  sfx('fanfare');
  if (panel && !panel.closed) panel.close();
  await message({
    title: 'Теперь ты хозяйка!',
    icon: '👑',
    html: `<p class="center big-emoji">${b.icon}🎉</p><p class="center"><b>${b.name}</b> — твоё заведение!</p>
      <p>🪙 Каждый день в кассу ложится выручка: <b>${coins(b.income)}</b>. Забирай её здесь же — кнопка «Моё заведение».</p>
      <p>${b.game && hasMinigame(b.game) ? `⭐ Если в этот день поработаешь тут сама, выручка будет больше — до <b>+${pct(BIZ_RULES.workBonus[2])}</b>.` : '⭐ Дела здесь идут сами: мастера справляются, а выручка ждёт тебя в кассе.'}</p>`,
    buttons: [{ text: 'Ура!' }],
  });
  openBizOffice(b.id);
}

// ---------- «блюдо дня» ----------
function pickSpecial(b) {
  const cur = S().biz[b.id].special || null;
  openPanel({
    title: 'Блюдо дня',
    icon: '⭐',
    render(body, tab, panel) {
      body.appendChild(
        el(
          'p',
          'muted',
          `Выбери блюдо из своих рецептов — гости будут заказывать его чаще. Обычный рецепт: <b>+${pct(BIZ_RULES.special)}</b> к выручке, секретный (его рассказал друг): <b>+${pct(BIZ_RULES.specialSecret)}</b>.`,
        ),
      );
      const grid = el('div', 'grid small');
      for (const id of S().recipes) {
        const d = DISH_BY_ID[id];
        if (!d || !d.needs) continue;
        const secret = SECRET_RECIPES.includes(id);
        const card = el('div', 'card tap' + (id === cur ? ' sel' : ''));
        card.appendChild(el('div', 'e', d.e));
        card.appendChild(el('div', '', d.name));
        card.appendChild(el('div', 'pr', '+' + pct(secret ? BIZ_RULES.specialSecret : BIZ_RULES.special)));
        if (secret) card.appendChild(el('span', 'badge', 'секрет'));
        card.onclick = () => {
          sfx('ok');
          setBizOpt(b.id, 'special', id);
          toast(`Блюдо дня — ${d.e} ${d.name}!`, 'good');
          panel.close();
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
    onClose: () => openBizOffice(b.id),
  });
}

// ---------- «кабинет» заведения ----------
/** Окно заведения: чужое — предложение купить; своё — касса, работа, настройки. */
export function openBizOffice(id) {
  const b = BIZ_BY_ID[id];
  if (!b) return null;
  const v = VENDORS[b.vendor];
  const canWork = !!b.game && hasMinigame(b.game);
  return openPanel({
    title: ownsBiz(id) ? bizTitle(id) : b.name,
    portrait: vendorLook(b.vendor),
    money: true,
    cls: '',
    render(body, tab, panel) {
      const st = S().biz[id];
      if (!st) {
        // --- ещё не куплено
        body.appendChild(
          el(
            'p',
            '',
            `<b>${v.name}:</b> «Хочешь купить ${b.short}? Отличная мысль! Я останусь здесь работать, а ты будешь хозяйкой — и выручка будет твоя».`,
          ),
        );
        const card = el('div', 'biz-offer');
        card.appendChild(el('div', 'big-emoji', b.icon));
        const info = el('div', 'grow', `<div class="ttl">${b.name}</div><div class="sub">${b.about}</div>`);
        info.appendChild(
          el(
            'ul',
            'biz-facts',
            `<li>🪙 Выручка: <b>${coins(b.income)} в день</b> — окупится примерно за ${payback(b)} ${plural(payback(b), 'день', 'дня', 'дней')}.</li>
             <li>⭐ ${canWork ? `Поработаешь сама — в этот день выручка больше (до +${pct(BIZ_RULES.workBonus[2])})${JOBS[b.game] ? ', а за смену хозяйке платят в полтора раза больше' : ''}.` : 'Дела идут сами: работать не обязательно.'}</li>
             <li>🏷️ Можно придумать своё название и цвет вывески${b.id === 'rest' ? ', выбрать «блюдо дня»' : ''}.</li>`,
          ),
        );
        card.appendChild(info);
        body.appendChild(card);
        const row = el('div', 'biz-buy');
        row.appendChild(priceTag(b.price));
        row.appendChild(buyBtn('🏪 Купить заведение', b.price, () => buyBiz(b, panel)));
        body.appendChild(row);
        if (lacking(b.price))
          body.appendChild(el('p', 'muted center', `Пока ${lackText(b.price)}. Копи: работа, задания, рынок!`));
        return;
      }
      // --- своё заведение
      body.appendChild(bizSign(b));
      const today = bizDayIncome(id),
        cap = bizTillCap(id),
        worked = (S().dayFlags.bizWork || {})[id] || 0;
      const till = el('div', 'biz-till');
      till.appendChild(el('div', 'muted', 'В кассе'));
      till.appendChild(el('div', 'big', coins(st.till)));
      const take = el('button', 'btn ' + (st.till ? 'green' : 'ghost'), st.till ? '💰 Забрать выручку' : 'Касса пуста');
      take.disabled = !st.till;
      take.onclick = () => {
        const n = collectBiz(id);
        if (!n) return;
        sfx('coin');
        toast(`Выручка: +${fmtMoney(n)} ${plural(n, 'монета', 'монеты', 'монет')} 🪙`, 'good');
        emit('hud');
        panel.refresh();
      };
      till.appendChild(take);
      if (st.till >= cap)
        till.appendChild(el('div', 'warn', `Касса полная! Больше ${coins(cap)} в неё не помещается — забери выручку.`));
      body.appendChild(till);
      const facts = el('ul', 'biz-facts');
      facts.innerHTML = `<li>📅 За сегодня заведение заработает <b>${coins(today.sum)}</b>${
        today.work || today.special
          ? ` (обычный день ${fmtMoney(today.base)}${today.work ? `, твоя работа +${fmtMoney(today.work)}` : ''}${today.special ? `, блюдо дня +${fmtMoney(today.special)}` : ''})`
          : ''
      }. Выручка придёт в кассу утром.</li>
        <li>🌙 Вчера: <b>${coins(st.last || 0)}</b> · за всё время получено: <b>${coins(st.total)}</b>.</li>
        <li>🧰 В кассе помещается выручка за ${BIZ_RULES.tillDays} дня (${coins(cap)}) — заглядывай почаще!</li>`;
      body.appendChild(facts);
      // работа хозяйки
      const work = el('div', 'biz-work');
      if (canWork) {
        work.appendChild(
          el(
            'div',
            'grow',
            worked
              ? `<b>Сегодня ты уже поработала здесь</b> (${'⭐'.repeat(worked)}): выручка дня больше на ${pct(BIZ_RULES.workBonus[worked - 1])}. Сыграешь лучше — будет ещё больше.`
              : `<b>Поработай сама</b> — и сегодняшняя выручка вырастет: ⭐ +${pct(BIZ_RULES.workBonus[0])} · ⭐⭐ +${pct(BIZ_RULES.workBonus[1])} · ⭐⭐⭐ +${pct(BIZ_RULES.workBonus[2])}.`,
          ),
        );
        const wb = el('button', 'btn small blue', b.work);
        wb.onclick = () => {
          panel.close();
          workAt(id);
        };
        work.appendChild(wb);
      } else
        work.appendChild(
          el(
            'div',
            'grow',
            `<b>Дела идут сами.</b> ${v.name} и помощники справляются — тебе остаётся забирать выручку.`,
          ),
        );
      body.appendChild(work);
      // блюдо дня (ресторан)
      if (b.id === 'rest') {
        const d = st.special && DISH_BY_ID[st.special];
        const row = el('div', 'biz-work');
        row.appendChild(
          el(
            'div',
            'grow',
            d
              ? `<b>Блюдо дня:</b> ${d.e} ${d.name} — +${fmtMoney(today.special)} к выручке каждый день.`
              : '<b>Блюдо дня</b> не выбрано. Поставь в меню своё блюдо — выручка вырастет!',
          ),
        );
        const sb = el('button', 'btn small yellow', d ? 'Поменять' : '⭐ Выбрать');
        sb.onclick = () => {
          panel.close();
          pickSpecial(b);
        };
        row.appendChild(sb);
        body.appendChild(row);
      }
      // вывеска: название и цвет
      const sign = el('div', 'biz-signedit');
      sign.appendChild(el('div', 'muted', 'Вывеска: название и цвет'));
      const inp = el('input');
      inp.maxLength = 22;
      inp.value = bizTitle(id);
      inp.setAttribute('aria-label', 'Название заведения');
      inp.onchange = () => {
        const t = inp.value.trim();
        setBizOpt(id, 'title', t && t !== b.name ? t : null);
        sfx('ok');
        panel.refresh();
      };
      sign.appendChild(inp);
      const dots = el('div', 'opt-row');
      for (const c of SIGN_COLORS) {
        const o = el(
          'button',
          'opt' + ((st.sign || SIGN_COLORS[0]) === c ? ' sel' : ''),
          `<span class="dotc" style="background:${c}"></span>`,
        );
        o.setAttribute('aria-label', 'Цвет вывески');
        o.onclick = () => {
          sfx('tap');
          setBizOpt(id, 'sign', c);
          panel.refresh();
        };
        dots.appendChild(o);
      }
      sign.appendChild(dots);
      body.appendChild(sign);
    },
  });
}

// ---------- «Мои заведения» ----------
export function openMyBiz() {
  return openPanel({
    title: 'Мои заведения',
    icon: '🏪',
    money: true,
    cls: '',
    render(body) {
      const mine = BUSINESSES.filter((b) => ownsBiz(b.id));
      const tills = mine.reduce((s, b) => s + S().biz[b.id].till, 0),
        total = mine.reduce((s, b) => s + S().biz[b.id].total, 0),
        perDay = mine.reduce((s, b) => s + bizDayIncome(b.id).sum, 0);
      body.appendChild(
        el(
          'p',
          'center',
          mine.length
            ? `Заведений: <b>${mine.length}</b> из ${BUSINESSES.length} · в кассах ждёт: <b>${coins(tills)}</b><br>за сегодня заработают: <b>${coins(perDay)}</b> · за всё время получено: <b>${coins(total)}</b>`
            : 'Своих заведений пока нет. Любое кафе, ресторан, салон или бутик можно <b>купить у хозяина</b>: зайди туда и нажми «Купить заведение».',
        ),
      );
      for (const b of BUSINESSES) {
        const st = S().biz[b.id];
        const li = el('div', 'list-item biz-row' + (st ? ' mine' : ''));
        li.appendChild(el('div', 'e', b.icon));
        li.appendChild(
          el(
            'div',
            'grow',
            st
              ? `<div class="ttl">${esc(bizTitle(b.id))}</div><div class="sub">В кассе: <b>${coins(st.till)}</b>${st.till >= bizTillCap(b.id) ? ' — касса полная!' : ''} · вчера ${coins(st.last || 0)} · всего ${coins(st.total)}</div><div class="sub">Выручку забирают в самом заведении — «Моё заведение».</div>`
              : `<div class="ttl">${b.name}</div><div class="sub">${b.about}</div><div class="sub">Выручка ${coins(b.income)} в день · окупится за ${payback(b)} ${plural(payback(b), 'день', 'дня', 'дней')}</div>`,
          ),
        );
        if (st) li.appendChild(el('div', 'own', '👑 твоё'));
        else {
          const pr = el('div', 'card-pr');
          pr.appendChild(priceTag(b.price));
          li.appendChild(pr);
        }
        body.appendChild(li);
      }
      body.appendChild(
        el('p', 'muted center', 'Купить заведение можно в нём самом: зайди и нажми «🏪 Купить заведение».'),
      );
    },
  });
}

register('biz', (p) => openBizOffice(p.arg), '«кабинет» заведения: biz:<id> — купить или касса, работа, вывеска');
register('my-biz', () => openMyBiz(), 'окно «Мои заведения»');
register('work', (p) => workAt(p.arg), 'поработать в заведении: work:<id заведения>');

// Утром — напоминание о выручке в кассах (после приветствия и итога вчерашнего дня из features/sleep.js).
on('wake', () => {
  const s = S();
  const full = BUSINESSES.filter((b) => s.biz[b.id] && s.biz[b.id].till > 0);
  if (!full.length) return;
  const sum = full.reduce((a, b) => a + s.biz[b.id].till, 0);
  setTimeout(
    () =>
      toast(
        `🏪 ${full.length === 1 ? `${bizTitle(full[0].id)}: в кассе` : 'В кассах твоих заведений'} ждёт выручка — ${coins(sum)}. Загляни и забери!`,
        'good',
      ),
    4300,
  );
});

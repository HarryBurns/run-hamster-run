// ГОРА (П.9): что делают на горе и по дороге туда. Сама локация (где что стоит) — locations/mountain.js; она называет
// действия реестра, а выполняются они здесь:
//   задание Сени «На вершину!» (data/quests.js, summit) — своё «как дела» (hintWarm): нет тёплых вещей — где купить,
//                        а если и назавтра нет — Сеня дарит свою шапку (так задание выполнимо в любой сезон)
// Числа — MOUNTAIN в data/economy.js. Каждое занятие шлёт событие mountain { what } — по нему считают задания.
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.mountain).
import { setFlag, addClothes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { G, hasClothes } from '../core/state.js';
import { CLOTHES, CLOTHES_BY_ID, isWarmItem } from '../data/index.js';
import { toast } from '../ui/toast.js';
import { setWaitHook } from './quests.js';

const S = () => G.state;

// ---------- задание Сени: тёплые вещи ----------
/** Шапка, которую Сеня дарит, если у хомячка совсем нет тёплых вещей. */
export const SENYA_HAT = 'beanie_blue';
/** Есть ли в шкафу хоть одна тёплая вещь (шапка, куртка, кофта, шарф…). */
export const ownsWarm = () => CLOTHES.some((c) => isWarmItem(c) && hasClothes(c.id));
/**
 * «Как дела?» у Сени на шаге «оденься тепло»: тёплое в шкафу есть — надень; нет — где купить (отметка дня
 * flags.senyaNoWarm); пришла назавтра и всё ещё нет — Сеня дарит свою шапку.
 */
export function hintWarm(w) {
  if (w.i !== 1) return null;
  const s = S();
  if (ownsWarm())
    return 'Плаваешь ты как чемпион! Теперь оденься потеплее: у тебя в шкафу есть тёплые вещи — надень шапку, куртку, кофту или шарф (шкаф — дома 🏡) и приходи!';
  const asked = s.flags.senyaNoWarm;
  if (Number.isFinite(asked) && s.day > asked && !hasClothes(SENYA_HAT)) {
    addClothes(SENYA_HAT);
    sfx('win');
    toast(`🎁 Подарок от Сени: ${CLOTHES_BY_ID[SENYA_HAT].name} — уже в шкафу!`, 'good');
    return `Не нашла тёплых вещей? Ничего! Держи мою запасную шапку — ${CLOTHES_BY_ID[SENYA_HAT].name.toLowerCase()}. Она уже у тебя в шкафу: надень её дома и приходи!`;
  }
  if (!Number.isFinite(asked)) setFlag('senyaNoWarm', s.day);
  return 'Ой, а у тебя совсем нет тёплых вещей? Кофты продаются в ТЦ «Модный» каждый день, а шапки, куртки и шарфы — осенью и зимой. Не найдёшь — загляни ко мне завтра, что-нибудь придумаем!';
}
setWaitHook('summit', hintWarm);

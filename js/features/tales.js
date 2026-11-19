// ЖИТЕЛИ ВСПОМИНАЮТ ОТКРЫТЫЕ МЕСТА (этап 11): реплики по открытым местам и рассказы жителям.
// Таблицы — data/tales.js (PLACE_TALK, TALES). Здесь — когда что говорить:
//   placeLine(житель)   реплика про открытое место для «Поболтать» или null (тогда — обычная болтовня). Зовут все
//                       разговоры: на улице, в гостях, у жителя дома (friends.js, visits.js) и жители тайных мест
//                       (forest.js, mountain.js…). Пока место закрыто, реплики о нём нет — никаких спойлеров.
//   taleTalk(житель)    рассказ жителю (Профессор слушает про древние рисунки, П5): маленькая сценка в начале
//                       разговора; зовёт questTalk (features/quests.js), когда у жителя нет дел по журналу.
// Состояние: рассказ был — flags['tale:<id>'] (действие setFlag), дружба — addFriendPts. Версия сохранения та же.
import { setFlag, addFriendPts } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { G, landOpen } from '../core/state.js';
import { esc, pick } from '../core/util.js';
import { PLACE_TALK, TALES, NPC_BY_ID, npcLook } from '../data/index.js';
import { dialog } from '../ui/dialog.js';

const S = () => G.state;
const FRESH_DAYS = 2; // столько дней после открытия место — «свежая новость»: о нём говорят чаще
const CHANCE = 0.3, // как часто «Поболтать» вспоминает открытые места
  CHANCE_FRESH = 0.7; // …и свежую новость
const named = (text) => text.replace(/\{name\}/g, esc((S() && S().name) || 'хомячок')); // реплики идут в окно разговора (HTML)

/** Выполнено ли условие записи (PLACE_TALK, TALES): место открыто, задание сделано, наклейка есть, отметка стоит. */
function holds(e) {
  const s = S();
  if (!s) return false;
  if (e.land && !landOpen(e.land)) return false;
  if (e.quest && !(s.quests[e.quest] && s.quests[e.quest].done !== null)) return false;
  if (e.sticker && !s.stickers.includes(e.sticker)) return false;
  if (e.flag && !s.flags[e.flag]) return false;
  return true;
}
/** Свежая ли новость: место записи открыто совсем недавно. */
const fresh = (e) => !!e.land && S().day - S().lands[e.land] <= FRESH_DAYS;

/** Все реплики жителя про открытые места, которые он может сказать сейчас: [{ text, fresh }]. */
export function placeLines(npcId) {
  const out = [];
  for (const e of PLACE_TALK[npcId] || [])
    if (holds(e)) for (const text of e.lines) out.push({ text, fresh: fresh(e) });
  return out;
}
let last = '';
/**
 * Реплика про открытое место для «Поболтать» — или null: тогда житель болтает как обычно. О месте, открытом
 * только что, вспоминают чаще. always — обязательно сказать, если есть что (для тестов).
 */
export function placeLine(npcId, always = false) {
  const all = placeLines(npcId);
  if (!all.length) return null;
  const news = all.filter((l) => l.fresh);
  if (!always && Math.random() >= (news.length ? CHANCE_FRESH : CHANCE)) return null;
  const list = (news.length ? news : all).filter((l) => l.text !== last);
  if (!list.length) return null;
  last = pick(list).text;
  return named(last);
}

// ---------- рассказы жителям ----------
const asked = {}; // «расскажу потом»: рассказ → день, когда отложили (в тот же день житель не переспрашивает)
/** Рассказ, которого ждёт житель (условие выполнено, ещё не рассказано), или null. */
export function taleFor(npcId) {
  const s = S();
  if (!s) return null;
  return TALES.find((t) => t.npc === npcId && !s.flags['tale:' + t.id] && holds(t)) || null;
}
/**
 * Рассказать жителю (в начале разговора): он расспрашивает, хомячок выбирает, о чём рассказать, — по одной
 * кнопке на каждую часть, в любом порядке. null — рассказывать нечего; { end: true } — разговор окончен;
 * { text } — дальше обычный разговор с этой репликой.
 */
export async function taleTalk(npcId) {
  const t = taleFor(npcId);
  if (!t || asked[t.id] === S().day) return null;
  const npc = NPC_BY_ID[npcId],
    say = (text, options, happy = false) =>
      dialog({ look: npcLook(npcId), name: npc.name, text: named(text), options, happy });
  emit('talk', { id: npcId });
  const left = t.parts.slice();
  let text = t.ask,
    first = true;
  while (left.length) {
    const options = left.map((p) => ({ text: p.btn, cls: 'blue' }));
    if (first) options.push({ text: t.later || 'Потом' });
    const i = await say(text, options, !first);
    if (i < 0 || i >= left.length) {
      // «потом» (или окно закрыли на первом вопросе): сегодня больше не спрашивает
      if (first) {
        asked[t.id] = S().day;
        return { text: named(t.laterSay || 'Хорошо, расскажешь потом!') };
      }
      continue;
    }
    first = false;
    text = left[i].say;
    left.splice(i, 1);
    sfx('ok');
  }
  setFlag('tale:' + t.id);
  if (t.pts && S().friends[npcId]) addFriendPts(npcId, t.pts);
  emit('tale', { id: t.id, npc: npcId });
  sfx('win');
  await say(
    `${text.replace(/\s*А (что )?ещё\?$/, '')} ${t.end}`,
    [{ text: t.bye || 'Рада помочь!', cls: 'green' }],
    true,
  );
  return { end: true };
}

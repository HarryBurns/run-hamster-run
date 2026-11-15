// ЛЕС (П.9): что делают в лесу — разговор с лесником Шишкиным, а дальше (по пунктам плана) улей, белка, костёр,
// домик на дереве, «Грибная охота». Сама локация (где что стоит) — locations/forest.js; она называет действия
// реестра, а выполняются они здесь:
//   forester            поговорить с лесником Шишкиным (житель леса и дверь его избушки)
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags), утром сбрасываются.
import { setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, darkness } from '../core/state.js';
import { esc, pick } from '../core/util.js';
import { NPC_BY_ID, npcLook } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { questTalk } from './quests.js';

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
    const i = await say(text, [{ text: '💬 Поболтать', cls: 'blue' }, { text: 'Пока!' }]);
    if (i !== 0) return;
    text = shishkinLine();
  }
}
register('forester', () => talkShishkin(), 'лесник Шишкин: разговор (житель леса и дверь его избушки)');

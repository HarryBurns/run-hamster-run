// Авторы музыки и звуков (этап 9б): что звучит в игре, кто это сделал, по какой лицензии и где взять.
// Показывается в меню (⚙️ → «Авторы»); то же — в CREDITS.md в корне. Файлы — assets/audio/music и assets/audio/sfx.
// Музыку Кевина Маклауда можно брать с указанием автора (CC BY 4.0) — строка `by` и есть это указание.

export const CC_BY = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
export const CC0 = { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };

const KM = 'Kevin MacLeod (incompetech.com)';
const INC = 'https://incompetech.com';
const isrc = (code) => 'https://incompetech.com/music/royalty-free/index.html?isrc=' + code;

/** Музыка: title — название, by — автор, lic — лицензия, url — где взять, where — где звучит в игре, file — файл. */
export const MUSIC_CREDITS = [
  { title: 'Tiki Bar Mixer', by: KM, lic: CC_BY, url: INC, where: 'заставка', file: 'tiki_bar_mixer' },
  { title: 'Easy Lemon', by: KM, lic: CC_BY, url: INC, where: 'вилла и дома', file: 'easy_lemon' },
  { title: 'Somewhere Sunny', by: KM, lic: CC_BY, url: INC, where: 'вилла и дома', file: 'somewhere_sunny' },
  { title: 'Carefree', by: KM, lic: CC_BY, url: INC, where: 'город весной', file: 'carefree' },
  { title: 'Wholesome', by: KM, lic: CC_BY, url: isrc('USUAN1900022'), where: 'город летом', file: 'wholesome' },
  { title: 'Skye Cuillin', by: KM, lic: CC_BY, url: INC, where: 'город осенью', file: 'skye_cuillin' },
  { title: 'Frost Waltz', by: KM, lic: CC_BY, url: INC, where: 'город зимой', file: 'frost_waltz' },
  { title: 'Folk Round', by: KM, lic: CC_BY, url: isrc('USUAN1100357'), where: 'лес', file: 'folk_round' },
  { title: 'Achaidh Cheide', by: KM, lic: CC_BY, url: isrc('USUAN1100340'), where: 'гора', file: 'achaidh_cheide' },
  { title: 'Teller of the Tales', by: KM, lic: CC_BY, url: isrc('USUAN1400020'), where: 'пещеры', file: 'teller_of_the_tales' },
  { title: 'Desert City', by: KM, lic: CC_BY, url: INC, where: 'пустыня', file: 'desert_city' },
  { title: 'Monkeys Spinning Monkeys', by: KM, lic: CC_BY, url: INC, where: 'джунгли', file: 'monkeys_spinning_monkeys' },
  { title: 'Kalimba Relaxation Music', by: 'Kevin MacLeod (freepd.com)', lic: CC0, url: 'https://freepd.com', where: 'секретный пляж и под водой', file: 'kalimba_relaxation' },
  { title: 'Island Meet and Greet', by: KM, lic: CC_BY, url: INC, where: 'удалённый остров', file: 'island_meet_and_greet' },
  { title: 'Gymnopedie No 1', by: KM + ', музыка Эрика Сати', lic: CC_BY, url: INC, where: 'ночь', file: 'gymnopedie_no_1' },
  { title: 'Dreamer', by: KM, lic: CC_BY, url: INC, where: 'ночь', file: 'dreamer' },
  { title: 'Fluffing a Duck', by: KM, lic: CC_BY, url: INC, where: 'мини-игры', file: 'fluffing_a_duck' },
  { title: 'Club Seamus', by: KM, lic: CC_BY, url: INC, where: 'вечеринка дома', file: 'club_seamus' },
];

/** Звуки: наборы Kenney (всё — CC0). */
export const SFX_CREDITS = [
  { title: 'Interface Sounds', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/interface-sounds', what: 'пузырьки, «ой»' },
  { title: 'Impact Sounds', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/impact-sounds', what: 'шаги по траве, песку, снегу, дереву и камню, кнопки, стук, звон стекла и кристаллов' },
  { title: 'RPG Audio', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/rpg-audio', what: 'монетки, двери, страницы' },
  { title: 'Foley Sounds', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/foley-sounds', what: 'капли в пещерах, вода, крылышки' },
  { title: 'Music Jingles', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/music-jingles', what: 'награды, наклейки, письма, утро' },
  { title: 'UI Audio', by: 'Kenney (kenney.nl)', lic: CC0, url: 'https://kenney.nl/assets/ui-audio', what: 'выключатели и щелчки' },
];

/** Что пока синтезируется в самой игре (без файлов). */
export const SYNTH_NOTE =
  'Шум моря, дождь, ветер, птички, сверчки, плеск, пианино и несколько коротких звуков (писк хомячка, колокольчик, ' +
  'фейерверк, волшебство) игра сочиняет сама, тихо и мягко. Если файл музыки не загрузился — тоже играет своя мелодия.';

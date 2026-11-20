// Все занятия. main.js импортирует этот файл: при загрузке каждое занятие регистрирует свои действия в реестре
// (core/registry.js) и подписывается на события — поэтому ниже загружаются ВСЕ занятия, по порядку. Порядок важен
// только для sleep.js и friends.js: часы идут раньше, чем приходит гость.
//
// Снаружи (main.js: кнопки HUD, начало дня, заставка) нужно немногое — это именованные экспорты ниже. Всё остальное
// занятия делают сами через реестр действий и события. devAll() — все функции занятий одним объектом, только для
// отладки и автотестов (window.__dev.F, js/devhooks.js).
import * as purchase from './purchase.js';
import * as wardrobe from './wardrobe.js';
import * as salon from './salon.js';
import * as stock from './stock.js';
import * as pantry from './pantry.js';
import * as wares from './wares.js';
import * as shops from './shops.js';
import * as market from './market.js';
import * as bank from './bank.js';
import * as places from './places.js';
import * as map from './map.js';
import * as panorama from './panorama.js';
import * as minigames from './minigames.js';
import * as cooking from './cooking.js';
import * as gifts from './gifts.js';
import * as health from './health.js';
import * as sleep from './sleep.js';
import * as friends from './friends.js';
import * as visits from './visits.js';
import * as homes from './homes.js';
import * as business from './business.js';
import * as garden from './garden.js';
import * as mail from './mail.js';
import * as quests from './quests.js';
import * as tales from './tales.js';
import * as forest from './forest.js';
import * as mountain from './mountain.js';
import * as caves from './caves.js';
import * as desert from './desert.js';
import * as jungle from './jungle.js';
import * as cove from './cove.js';
import * as island from './island.js';
import * as hotel from './hotel.js';
import * as inside from './inside.js';
import * as relax from './relax.js';
import * as wheels from './wheels.js';
import * as yard from './yard.js';
import * as villaUp from './villa_up.js';
import * as pet from './pet.js';
import * as holidays from './holidays.js';
import * as holidaysScenes from './holidays_scenes.js';
import * as holidaysWinter from './holidays_winter.js';
import * as holidaysSummer from './holidays_summer.js';
import * as holidaysBday from './holidays_bday.js';
import * as intro from './intro.js';
import * as welcome from './welcome.js';
import * as backpack from './backpack.js';
import * as album from './album.js';
import * as photo from './photo.js';
import * as piano from './piano.js';
import * as tv from './tv.js';
import * as settings from './settings.js';
import * as help from './help.js';
import * as soundscape from './soundscape.js';
import * as install from './install.js';

// ---------- что нужно main.js ----------
export { showBankLetter } from './bank.js';
export { openMap } from './map.js';
export { showSickHelp } from './health.js';
export { openPhone } from './friends.js';
export { askGoHome } from './homes.js';
export { taskChip, showLetter, newDayMail, initEvents } from './mail.js';
export { trackQuest, questChip } from './quests.js';
export { showBoostHelp } from './hotel.js';
export { trackHoliday, holidayChip, holidayBadge, openHolidays } from './holidays.js';
export { playIntro } from './intro.js';
export { openBackpack } from './backpack.js';
export { openAlbum } from './album.js';
export { openPhotoMode } from './photo.js';
export { openSettings } from './settings.js';
export { showHelp } from './help.js';
export { updateSound } from './soundscape.js';
export { registerOffline, startInstallHint } from './install.js';

/** Все функции занятий одним объектом (как прежний «export *»; одинаковых имён у занятий нет). */
export const devAll = () =>
  Object.assign(
    {},
    purchase,
    wardrobe,
    salon,
    stock,
    pantry,
    wares,
    shops,
    market,
    bank,
    places,
    map,
    panorama,
    minigames,
    cooking,
    gifts,
    health,
    sleep,
    friends,
    visits,
    homes,
    business,
    garden,
    mail,
    quests,
    tales,
    forest,
    mountain,
    caves,
    desert,
    jungle,
    cove,
    island,
    hotel,
    inside,
    relax,
    wheels,
    yard,
    villaUp,
    pet,
    holidays,
    holidaysScenes,
    holidaysWinter,
    holidaysSummer,
    holidaysBday,
    intro,
    welcome,
    backpack,
    album,
    photo,
    piano,
    tv,
    settings,
    help,
    install,
    soundscape,
  );

// Все занятия разом. main.js импортирует этот файл: при загрузке каждое занятие регистрирует свои действия
// в реестре (core/registry.js) и подписывается на события. Заодно отсюда берут функции занятий HUD и тесты.
// Порядок важен только для sleep.js и friends.js: часы идут раньше, чем приходит гость.
export * from './purchase.js';
export * from './wardrobe.js';
export * from './salon.js';
export * from './shops.js';
export * from './market.js';
export * from './bank.js';
export * from './places.js';
export * from './map.js';
export * from './panorama.js';
export * from './minigames.js';
export * from './cooking.js';
export * from './gifts.js';
export * from './sleep.js';
export * from './friends.js';
export * from './visits.js';
export * from './homes.js';
export * from './business.js';
export * from './garden.js';
export * from './mail.js';
export * from './backpack.js';
export * from './album.js';
export * from './piano.js';
export * from './settings.js';
export * from './soundscape.js';

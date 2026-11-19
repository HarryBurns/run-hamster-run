// Фото-режим (этап 17в, features/photo.js): какие бывают рамки и наклейки-украшения кадра.
/** Рамки: id → { name, icon }; рисует их drawFrame (features/photo_art.js). */
export const PHOTO_FRAMES = [
  { id: 'none', icon: '⬜', name: 'Без рамки' },
  { id: 'polaroid', icon: '🖼️', name: 'Карточка' },
  { id: 'hearts', icon: '💖', name: 'Сердечки' },
  { id: 'stars', icon: '⭐', name: 'Звёзды' },
  { id: 'flowers', icon: '🌸', name: 'Цветы' },
  { id: 'film', icon: '🎞️', name: 'Плёнка' },
];
/** Наклейки-украшения, которые можно поставить на кадр. */
export const PHOTO_DECOR = ['⭐', '💖', '🌸', '🎀', '🌈', '☀️', '🦋', '🐾', '✨', '🍓', '🎈', '👑'];

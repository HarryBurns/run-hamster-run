// ЗДАНИЯ ГОРОДА — у каждого заведения своё лицо и настоящая вывеска. Собраны из «конструктора»
// locations/common/buildings.js (стена, крыша с черепицей, окна, двери, витрины) и вывесок paint.js.
//
// Виды: villa, salon, boutique, cafe, rest, poolhall, beachcafe, mallx (поле theme: fashion | home | food),
// hospital, school, towerFashion, towerHamster, bank, market, realtor, apartment, bungalow, hotel.
// Дома жителей — общий вид house с дорисовкой по характеру хозяина: HOUSE_ART[житель] (якорь Боба, теплица
// и вьюнок Мяты, телескоп Профессора…) и HOUSE_STYLE[житель] (цвет ставней, дымок из трубы).
//
// Рисунки зданий разложены по файлам: магазины и кафе — town_shops.js; больница, школа, высотки и банк —
// town_public.js; жильё и дома жителей — town_homes.js; отель — town_hotel.js; общие мелочи — town_details.js.
// Здесь — список видов (defineBuildings): чем рисовать, рамка спрайта, огни окон вечером.
import { villaStage } from '../core/state.js';
import { T, defineBuildings } from '../engine/topdown/kinds.js';
import { towerBox, beacon, facadeLights } from './common/buildings.js';
import { paintVilla, paintApartment, paintBungalow } from './town_homes.js';
import {
  paintSalon,
  paintBoutique,
  paintCafe,
  paintRest,
  paintPool,
  paintBeachCafe,
  paintMall,
  paintMarket,
  paintRealtor,
} from './town_shops.js';
import { paintHospital, paintSchool, paintTowerFashion, paintTowerHamster, paintBank } from './town_public.js';
import { paintHotel } from './town_hotel.js';
export { DOORMAN } from './town_hotel.js';
export { HOUSE_STYLE, HOUSE_ART } from './town_homes.js';

const doorLight = facadeLights;

const wideBox =
  (up, side = 44) =>
  (b) => [-side, -up, b.w * T + side, b.h * T + 16];

defineBuildings({
  // свой дом растёт по ступеням («Вилла растёт»): ступень — в ключе спрайта (look), от неё же высота и свет
  villa: {
    paint: paintVilla,
    look: () => villaStage(),
    icon: '🏡',
    box: wideBox(126),
    hitUp: () => [12, 12, 40, 60, 96][villaStage()] ?? 60,
    lights: (b) => {
      const st = villaStage();
      if (st >= 2) return doorLight(b, 130, st >= 4 ? 70 : 30);
      const cx = (b.x + b.w / 2) * T,
        bot = (b.y + b.h) * T;
      return [
        [cx, bot + 8, 100, 42, 0.9],
        [cx + (st ? 60 : 0), bot - 70, st ? 220 : 140, 80, 0.72],
      ];
    },
  },
  // doorX — дверь сбоку от витрины (сдвиг от середины фасада): хомячок встаёт именно под ней
  salon: { paint: paintSalon, doorX: 42, box: wideBox(60), lights: (b) => doorLight(b) },
  boutique: { paint: paintBoutique, doorX: 46, box: wideBox(60), lights: (b) => doorLight(b) },
  cafe: { paint: paintCafe, doorX: 40, box: wideBox(76), lights: (b) => doorLight(b) },
  rest: { paint: paintRest, box: wideBox(60), lights: (b) => doorLight(b, 130) },
  poolhall: { paint: paintPool, box: wideBox(112, 50), hitUp: () => 60, lights: (b) => doorLight(b) },
  beachcafe: { paint: paintBeachCafe, box: wideBox(50, 50), lights: (b) => doorLight(b, 100) },
  mallx: { paint: paintMall, box: wideBox(76), lights: (b) => doorLight(b, 130) },
  hospital: { paint: paintHospital, box: wideBox(80), lights: (b) => doorLight(b, 120) },
  school: { paint: paintSchool, box: wideBox(104), hitUp: () => 70, lights: (b) => doorLight(b, 110) },
  towerFashion: {
    paint: paintTowerFashion,
    box: (b) => towerBox(b, 96),
    hitUp: (b) => b.floors * T * 0.62,
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 60),
  },
  towerHamster: {
    paint: paintTowerHamster,
    box: (b) => towerBox(b, 160, 64),
    hitUp: (b) => b.floors * T * 0.62,
    live: (ctx, b, t) => beacon(ctx, b, t, 136),
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 80),
  },
  bank: {
    paint: paintBank,
    box: (b) => towerBox(b, 90),
    hitUp: (b) => b.floors * T * 0.62,
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 60),
  },
  market: { paint: paintMarket, box: wideBox(40), lights: (b) => doorLight(b, 110) },
  realtor: { paint: paintRealtor, doorX: 62, box: wideBox(50), lights: (b) => doorLight(b) },
  apartment: { paint: paintApartment, box: wideBox(150), hitUp: () => 90, lights: (b) => doorLight(b, 100, 84) },
  bungalow: { paint: paintBungalow, box: wideBox(60, 50), lights: (b) => doorLight(b) },
  hotel: { paint: paintHotel, box: wideBox(270, 70), hitUp: () => 150, lights: (b) => doorLight(b, 150, 120) },
});

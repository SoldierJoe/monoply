/**
 * Egypt-themed Monopoly board.
 *
 * 40 tiles, classic Monopoly layout:
 *   - 22 properties across 8 color groups (spanning all of Egypt)
 *   -  4 railroads (Egyptian transit)
 *   -  2 utilities (national companies)
 *   -  4 corners (Go, Jail, Free Parking, Go to Jail)
 *   -  3 Community Chest, 3 Chance (data-only for MVP)
 *   -  2 taxes
 */

export const GROUPS = {
  brown:    { id: 'brown',    label: 'Upper Egypt',        color: '#7a4f2a', houseCost: 50  },
  lightblue:{ id: 'lightblue',label: 'Nile Delta',         color: '#9bd3e8', houseCost: 50  },
  pink:     { id: 'pink',     label: 'Canal Zone',         color: '#d77fa1', houseCost: 100 },
  orange:   { id: 'orange',   label: 'The Oases & South',  color: '#e4933b', houseCost: 100 },
  red:      { id: 'red',      label: 'Red Sea Coast',      color: '#c9352f', houseCost: 150 },
  yellow:   { id: 'yellow',   label: 'Golden Destinations',color: '#e8c547', houseCost: 150 },
  green:    { id: 'green',    label: 'New Egypt',           color: '#4a8b5c', houseCost: 200 },
  darkblue: { id: 'darkblue', label: 'The Elite',           color: '#1f3a5f', houseCost: 200 },
};

const prop = (idx, name, group, price, rent) => ({
  idx, type: 'property', name,
  group: GROUPS[group].id,
  price,
  rent,
  houseCost: GROUPS[group].houseCost,
  mortgageValue: price / 2,
  ownerId: null,
  houses: 0,
  mortgaged: false,
});

const railroad = (idx, name) => ({
  idx, type: 'railroad', name,
  price: 200,
  rent: [25, 50, 100, 200],
  mortgageValue: 100,
  ownerId: null,
  mortgaged: false,
});

const utility = (idx, name) => ({
  idx, type: 'utility', name,
  price: 150,
  mortgageValue: 75,
  ownerId: null,
  mortgaged: false,
});

export const BOARD = [
  { idx: 0,  type: 'go',       name: 'The Pyramids of Giza', passReward: 200 },

  prop(1,  'Qena',             'brown', 60,  [2, 10, 30, 90, 160, 250]),
  { idx: 2,  type: 'cc',       name: 'Community Chest' },
  prop(3,  'Sohag',            'brown', 60,  [4, 20, 60, 180, 320, 450]),

  { idx: 4,  type: 'tax',      name: 'Income Tax', amount: 200 },

  railroad(5, 'Egyptian National Railways'),

  prop(6,  'Damietta',         'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  { idx: 7,  type: 'chance',   name: 'Chance' },
  prop(8,  'Mansoura',         'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  prop(9,  'Tanta',            'lightblue', 120, [8, 40, 100, 300, 450, 600]),

  { idx: 10, type: 'jail',     name: 'Jail / Just Visiting' },

  prop(11, 'Ismailia',         'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility(12, 'Egyptian Electricity'),
  prop(13, 'Suez',             'pink', 140, [10, 50, 150, 450, 625, 750]),
  prop(14, 'Port Said',        'pink', 160, [12, 60, 180, 500, 700, 900]),

  railroad(15, 'Alexandria Tram'),

  prop(16, 'Fayoum',           'orange', 180, [14, 70, 200, 550, 750, 950]),
  { idx: 17, type: 'cc',       name: 'Community Chest' },
  prop(18, 'Siwa Oasis',       'orange', 180, [14, 70, 200, 550, 750, 950]),
  prop(19, 'Aswan',            'orange', 200, [16, 80, 220, 600, 800, 1000]),

  { idx: 20, type: 'free',     name: 'Khan el-Khalili' },

  prop(21, 'Hurghada',         'red', 220, [18, 90, 250, 700, 875, 1050]),
  { idx: 22, type: 'chance',   name: 'Chance' },
  prop(23, 'El Gouna',         'red', 220, [18, 90, 250, 700, 875, 1050]),
  prop(24, 'Marsa Alam',       'red', 240, [20, 100, 300, 750, 925, 1100]),

  railroad(25, 'Cairo Metro'),

  prop(26, 'Sharm El-Sheikh',  'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  prop(27, 'Dahab',            'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility(28, 'Egypt Water'),
  prop(29, 'Luxor',            'yellow', 280, [24, 120, 360, 850, 1025, 1200]),

  { idx: 30, type: 'gotojail', name: 'Go to Jail' },

  prop(31, 'New Capital',         'green', 300, [26, 130, 390, 900, 1100, 1275]),
  prop(32, 'New Alamein',         'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { idx: 33, type: 'cc',         name: 'Community Chest' },
  prop(34, 'Heliopolis',          'green', 320, [28, 150, 450, 1000, 1200, 1400]),

  railroad(35, 'Suez Canal Ferry'),

  { idx: 36, type: 'chance',    name: 'Chance' },
  prop(37, 'Alexandria',         'darkblue', 350, [35, 175, 500, 1100, 1300, 1500]),
  { idx: 38, type: 'tax',        name: 'Luxury Tax', amount: 100 },
  prop(39, 'Zamalek',            'darkblue', 400, [50, 200, 600, 1400, 1700, 2000]),
];

if (BOARD.length !== 40) {
  throw new Error(`Board must have 40 tiles, found ${BOARD.length}`);
}
BOARD.forEach((tile, i) => {
  if (tile.idx !== i) {
    throw new Error(`Tile at position ${i} has idx ${tile.idx}`);
  }
});

export function makeBoard() {
  return BOARD.map(t => ({ ...t }));
}

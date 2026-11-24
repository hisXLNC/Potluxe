// Starter menus and cover themes for the guided setup.
import { id } from './util.js';

export const THEMES = {
  ember: { name: 'Ember', c1: '#ff6a3d', c2: '#c2185b', c3: '#3b0a45', ink: '#fff4ec' },
  dusk: { name: 'Dusk', c1: '#8e7bff', c2: '#3d5afe', c3: '#0b1445', ink: '#f1f0ff' },
  garden: { name: 'Garden', c1: '#b4e33d', c2: '#1f9d6b', c3: '#06302b', ink: '#f3ffe9' },
  tide: { name: 'Tide', c1: '#4fd8eb', c2: '#1673c9', c3: '#071f47', ink: '#eafcff' },
  saffron: { name: 'Saffron', c1: '#ffd23f', c2: '#f0802b', c3: '#5a1a05', ink: '#fffaea' },
  rose: { name: 'Rosé', c1: '#ffb3c7', c2: '#e0457b', c3: '#4a0d2e', ink: '#fff0f5' },
  noir: { name: 'Noir', c1: '#9aa3b5', c2: '#3a4257', c3: '#0b0d14', ink: '#f2f4f8' },
};

export const EMOJI = ['🍔', '🥩', '🌮', '🍕', '🔥', '🍝', '🍣', '🥘', '🍗', '🥗', '🍷', '🎂', '🦞', '🍜', '🧆', '🥂'];

const choices = (list) => list.map(([name, price = 0]) => ({ id: id(), name, price }));
const items = (list) => list.map(([name, price = 0, desc = '']) => ({ id: id(), name, price, desc }));
const bring = (list) => list.map(([name, qty = 1]) => ({ id: id(), name, qty }));

const DONENESS = [['Rare'], ['Medium rare'], ['Medium'], ['Medium well'], ['Well done']];

export const MENU_TEMPLATES = [
  {
    key: 'burger',
    emoji: '🍔',
    theme: 'ember',
    name: 'Burger night',
    hint: 'Patties, doneness and extras',
    build: () => ({
      sections: [
        {
          id: id(),
          name: 'Burgers',
          items: items([['Classic beef burger', 8, '180g patty, lettuce, tomato, pickles'], ['Cheeseburger', 9, 'Double cheddar'], ['Chicken burger', 8, 'Grilled thigh, garlic mayo'], ['Veggie burger', 7, 'Chickpea and halloumi patty']]),
          mods: [
            { id: id(), name: 'Doneness', multi: false, choices: choices([['Medium'], ['Medium well'], ['Well done']]) },
            { id: id(), name: 'Extras', multi: true, choices: choices([['Extra patty', 3], ['Fried egg', 1], ['Jalapeños', 0.5], ['No onion'], ['No bun']]) },
          ],
        },
        { id: id(), name: 'Sides', items: items([['Fries', 2], ['Sweet potato fries', 2.5], ['Corn on the cob', 1.5]]), mods: [] },
      ],
      bring: bring([['Burger buns', 2], ['Salad', 2], ['Soft drinks', 3], ['Ice', 2], ['Dessert', 2], ['Sauces and pickles', 1]]),
    }),
  },
  {
    key: 'steak',
    emoji: '🥩',
    theme: 'noir',
    name: 'Steak night',
    hint: 'Cuts, doneness and sauces',
    build: () => ({
      sections: [
        {
          id: id(),
          name: 'Steaks',
          items: items([['Ribeye 300g', 18], ['Sirloin 250g', 14], ['Fillet 200g', 20], ['T-bone 500g', 22], ['Grilled portobello', 8, 'Vegetarian']]),
          mods: [
            { id: id(), name: 'Doneness', multi: false, choices: choices(DONENESS) },
            { id: id(), name: 'Sauce', multi: false, choices: choices([['No sauce'], ['Pepper sauce', 1], ['Mushroom sauce', 1], ['Garlic butter', 1], ['Chimichurri', 1]]) },
          ],
        },
        { id: id(), name: 'Sides', items: items([['Baked potato', 2], ['Chips', 2], ['Creamed spinach', 2.5], ['Garden salad', 2]]), mods: [] },
      ],
      bring: bring([['Garlic bread', 2], ['Salad', 2], ['Red wine or grape juice', 3], ['Dessert', 2], ['Ice', 1]]),
    }),
  },
  {
    key: 'bbq',
    emoji: '🔥',
    theme: 'saffron',
    name: 'BBQ / braai',
    hint: 'Meats from the fire, sides to share',
    build: () => ({
      sections: [
        {
          id: id(),
          name: 'From the fire',
          items: items([['Lamb chops (3)', 12], ['Chicken quarter', 6], ['Beef sausage', 5], ['Beef short rib', 14], ['Halloumi and veg skewer', 5]]),
          mods: [{ id: id(), name: 'Heat', multi: false, choices: choices([['Mild'], ['Medium'], ['Hot']]) }],
        },
      ],
      bring: bring([['Potato salad', 1], ['Green salad', 2], ['Bread rolls', 2], ['Charcoal', 2], ['Soft drinks', 3], ['Ice', 2], ['Dessert', 2], ['Paper plates and napkins', 1]]),
    }),
  },
  {
    key: 'taco',
    emoji: '🌮',
    theme: 'garden',
    name: 'Taco night',
    hint: 'Fillings and toppings',
    build: () => ({
      sections: [
        {
          id: id(),
          name: 'Tacos (3 per plate)',
          items: items([['Beef barbacoa', 9], ['Chicken tinga', 8], ['Grilled fish', 10], ['Black bean and corn', 7]]),
          mods: [
            { id: id(), name: 'Tortilla', multi: false, choices: choices([['Corn'], ['Flour']]) },
            { id: id(), name: 'Toppings', multi: true, choices: choices([['Guacamole', 1], ['Cheese', 0.5], ['Pickled onion'], ['Hot salsa'], ['No coriander']]) },
          ],
        },
      ],
      bring: bring([['Tortilla chips', 2], ['Salsa', 2], ['Limes', 1], ['Soft drinks', 3], ['Churros or dessert', 1]]),
    }),
  },
  {
    key: 'pizza',
    emoji: '🍕',
    theme: 'rose',
    name: 'Pizza party',
    hint: 'Pick a pizza and a base',
    build: () => ({
      sections: [
        {
          id: id(),
          name: 'Pizzas',
          items: items([['Margherita', 8], ['Pepperoni (beef)', 10], ['Chicken and mushroom', 10], ['Four cheese', 10], ['Roast vegetable', 9]]),
          mods: [
            { id: id(), name: 'Base', multi: false, choices: choices([['Classic'], ['Thin'], ['Gluten free', 2]]) },
            { id: id(), name: 'Extras', multi: true, choices: choices([['Extra cheese', 1], ['Chilli'], ['Rocket']]) },
          ],
        },
      ],
      bring: bring([['Garlic bread', 2], ['Salad', 2], ['Soft drinks', 3], ['Ice cream', 2]]),
    }),
  },
  {
    key: 'blank',
    emoji: '🍽️',
    theme: 'dusk',
    name: 'Start from scratch',
    hint: 'Build your own menu',
    build: () => ({
      sections: [{ id: id(), name: 'Mains', items: [], mods: [] }],
      bring: bring([['Salad', 1], ['Drinks', 2], ['Dessert', 1]]),
    }),
  },
];

export function blankEvent(currency) {
  return {
    v: 1,
    title: '',
    hostName: '',
    blurb: '',
    cover: { theme: 'ember', emoji: '🍔', img: null },
    date: '',
    time: '18:30',
    endTime: '',
    rsvpBy: '',
    place: { name: '', address: '', lat: null, lon: null, notes: '' },
    menu: { enabled: true, template: null, sections: [] },
    bring: { enabled: true, items: [] },
    costs: { currency, shared: [], payNote: '' },
    locked: false,
    paid: {},
    announce: '',
  };
}

import type { Game } from '../core/Game.ts';
import { addItem, removeItem } from './Inventory.ts';
import { healPartyFull } from './Party.ts';

export interface RandomEventChoice {
  text: string;
  action: (game: Game) => void;
  outcomeText: string;
}

export interface RandomEventDef {
  id: string;
  title: string;
  npcRole: string;
  npcVariant?: string;
  introText: string;
  choices: [RandomEventChoice, RandomEventChoice];
}

export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    id: 'injured_merchant',
    title: 'Mercader Herido',
    npcRole: 'merchant',
    npcVariant: 'mateo',
    introText: 'Un mercader itinerante yace junto a su carreta volcada. "¡Forastero! Unos asaltantes me emboscaron. ¿Podrías ayudarme con una venda o apoyo?"',
    choices: [
      {
        text: 'Ayudar y brindar suministros médicos',
        action: (game) => {
          game.saveData.money += 150;
          addItem(game.saveData.bag, 'fragmento_alma', 2);
          addItem(game.saveData.bag, 'musgo_vital', 1);
          game.saveManager.save(game.saveData);
        },
        outcomeText: '"¡Muchas gracias! Toma estas reliquias y monedas como recompensa por tu nobleza." (+150 ◈, +2 Fragmentos de Alma, +1 Musgo Vital)',
      },
      {
        text: 'Ignorar y seguir tu camino',
        action: (_game) => {
          // Neutral
        },
        outcomeText: 'Decides no interferir y continúas tu ruta mientras el mercader se lamenta.',
      },
    ],
  },
  {
    id: 'mysterious_traveler',
    title: 'Viajero Encapuchado',
    npcRole: 'npc',
    npcVariant: 'encapuchado',
    introText: 'Una figura encapuchada te intercepta en el sendero. "¿Buscas un tesoro arcano a cambio de una ofrenda modesta?"',
    choices: [
      {
        text: 'Entregar 1x Baya de Roble por una Gema de Poder',
        action: (game) => {
          removeItem(game.saveData.bag, 'baya_roble', 1);
          addItem(game.saveData.bag, 'gema_poder', 1);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'El viajero toma la baya con reverencia y te entrega una reluciente Gema de Poder. (+1 Gema de Poder)',
      },
      {
        text: 'Rechazar la propuesta y marcharte',
        action: (game) => {
          addItem(game.saveData.bag, 'baya_alba', 1);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'Rechazas el trueque y sigues adelante. En el camino hallaste una Baya Alba oculta entre los matorrales. (+1 Baya Alba)',
      },
    ],
  },
  {
    id: 'ancient_shrine',
    title: 'Santuario Arcano',
    npcRole: 'leader',
    npcVariant: 'santuario',
    introText: 'Has descubierto un monolito antiguo que emite una luz pulsante. Susurros arcanos resuenan en tu mente.',
    choices: [
      {
        text: 'Canalizar energía para sanar a tu equipo',
        action: (game) => {
          healPartyFull(game.saveData.party);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'Una cálida luz ethereal envuelve a tus marionetas. ¡Todo tu equipo ha recuperado su vitalidad completa!',
      },
      {
        text: 'Ofrendar 40 monedas al altar ancestral',
        action: (game) => {
          game.saveData.money = Math.max(0, game.saveData.money - 40);
          addItem(game.saveData.bag, 'cinta_aguante', 1);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'Depositas las monedas en la ofrenda y el monolito responde otorgándote una Cinta de Aguante. (+1 Cinta de Aguante)',
      },
    ],
  },
  {
    id: 'wild_bandit',
    title: 'Emboscada de Bandido',
    npcRole: 'trainer',
    npcVariant: 'bandido',
    introText: '¡Un rufián enmascarado salta de los arbustos! "¡Este sendero exige un peaje si quieres pasar con vida!"',
    choices: [
      {
        text: 'Pagar un tributo de 60 monedas',
        action: (game) => {
          game.saveData.money = Math.max(0, game.saveData.money - 60);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'Entregas las monedas de oro a regañadientes. El bandido te deja cruzar sin más altercados.',
      },
      {
        text: 'Enfrentarte al bandido y defenderte',
        action: (game) => {
          game.saveData.money += 120;
          addItem(game.saveData.bag, 'fragmento_alma', 1);
          game.saveManager.save(game.saveData);
        },
        outcomeText: 'Te pones en posición de combate. El bandido, intimidado por tu temple, huye despavorido dejando su botín. (+120 ◈, +1 Fragmento de Alma)',
      },
    ],
  },
];

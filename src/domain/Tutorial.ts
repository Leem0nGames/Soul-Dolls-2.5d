import type { Direction } from './types.ts';

export type TutorialStepId = 'welcome' | 'movement' | 'combat' | 'capture';

export interface TutorialFact {
  badge: string;
  label: string;
  detail: string;
  tone?: 'gold' | 'cyan' | 'violet' | 'crimson';
}

export interface TutorialStepDef {
  id: TutorialStepId;
  badge: string;
  title: string;
  dialog: string;
  facts: TutorialFact[];
}

export const TUTORIAL_SPEAKER = 'Maestro de Marionetas';

export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
  {
    id: 'welcome',
    badge: 'LECCIÓN 1/4 · DESPERTAR',
    title: 'El Vínculo de las SoulDolls',
    dialog:
      '¡Saludos, viajero! Soy el Maestro de Marionetas. Has cruzado el umbral hacia un mundo donde las almas errantes despiertan dentro de marionetas arcanas para combatir hasta la Arena Cumbre.',
    facts: [
      {
        badge: 'ALMA',
        label: 'Esencia salvaje',
        detail: 'Cada SoulDoll posee un tipo elemental, estadísticas únicas y habilidades pasivas.',
        tone: 'cyan',
      },
      {
        badge: 'CUERPO',
        label: 'Contenedor articulado',
        detail: 'Las almas selladas necesitan un Cuerpo Contenedor para manifestarse en batalla.',
        tone: 'gold',
      },
      {
        badge: 'META',
        label: 'Camino a la Cumbre',
        detail: 'Recorre Villa Origen, supera las rutas y desafía a la Maestra Valeria.',
        tone: 'violet',
      },
    ],
  },
  {
    id: 'movement',
    badge: 'LECCIÓN 2/4 · EXPLORACIÓN',
    title: 'Mecánica de Movimiento',
    dialog:
      'Desplázate paso a paso por el mundo, cruza puertas de edificios como el Laboratorio o el Taller, administra tu Estamina al correr y gira la cámara para explorar cada rincón.',
    facts: [
      {
        badge: 'WASD / ✚',
        label: 'Desplazamiento',
        detail: 'Usa Flechas, WASD o la cruceta táctil para caminar por casillas y entrar a edificios.',
        tone: 'cyan',
      },
      {
        badge: 'SHIFT / B',
        label: 'Correr y Estamina',
        detail: 'Mantén pulsado para esprintar; si la barra de Estamina se agota, recuperarás al caminar.',
        tone: 'gold',
      },
      {
        badge: 'Q / E · L / R',
        label: 'Cámara 3D',
        detail: 'Rota el ángulo orbital en cualquier momento o desliza en modo táctil para mirar alrededor.',
        tone: 'violet',
      },
      {
        badge: 'Z / ENTER · M',
        label: 'Acción y Menú',
        detail: 'Pulsa A (Z/Enter) para hablar o examinar pedestales. Abre el Menú con M o Start.',
        tone: 'gold',
      },
    ],
  },
  {
    id: 'combat',
    badge: 'LECCIÓN 3/4 · COMBATE',
    title: 'Duelos Tácticos y Partes',
    dialog:
      'En combate por turnos no solo cuenta el daño bruto: explota ventajas elementales y fractura las partes del cuerpo de la marioneta rival.',
    facts: [
      {
        badge: 'STAB 1.5×',
        label: 'Afinidad Elemental',
        detail: '8 tipos (Brasa, Marea, Flora, Chispa, Roca, Brisa, Umbra, Común). Afinidad suma +50% daño.',
        tone: 'gold',
      },
      {
        badge: 'FÍS / ESP / EST',
        label: 'Categorías de Ataque',
        detail: 'Físico usa ATQ/DEF, Especial usa ATE/DFE y Estado altera atributos o aplica efectos.',
        tone: 'cyan',
      },
      {
        badge: '4 PARTES',
        label: 'Cabeza · Torso · Brazos · Piernas',
        detail: 'Los golpes dañan extremidades del armazón. Quebrar una parte reduce el rendimiento rival.',
        tone: 'crimson',
      },
    ],
  },
  {
    id: 'capture',
    badge: 'LECCIÓN 4/4 · LABORATORIO Y TALLER',
    title: 'Laboratorio, Cuerpos y Habilidades',
    dialog:
      'En Villa Origen te espera Guía Lía para acompañarte hasta el interior del Laboratorio del Prof. Robledo, donde elegirás tu primera marioneta. Luego forja cuerpos y técnicas en el Taller.',
    facts: [
      {
        badge: 'LABORATORIO',
        label: 'Guía y Pedestales Iniciales',
        detail: 'Sigue a Guía Lía hasta la puerta del Laboratorio para hablar con el Profesor y despertar a tu inicial.',
        tone: 'cyan',
      },
      {
        badge: 'SOULPOT',
        label: 'Sellado en Batalla',
        detail: 'Debilita almas salvajes y lánzales un Soulpot. Si no llevas armazón libre, esperan en Reserva.',
        tone: 'violet',
      },
      {
        badge: 'TALLER / FORJA',
        label: 'Cuerpos, Cartas y Habilidades',
        detail: 'Visita el Taller de Marionetas para crear armazones, engarzar Cartas, forjar técnicas y entrenar EV/IV.',
        tone: 'gold',
      },
    ],
  },
];

export interface WaypointCoord {
  x: number;
  y: number;
}

export interface GridStep {
  x: number;
  y: number;
  dir: Direction;
}

export function expandGridWaypoints(
  startX: number,
  startY: number,
  waypoints: readonly WaypointCoord[]
): GridStep[] {
  const steps: GridStep[] = [];
  let cx = startX;
  let cy = startY;

  for (const wp of waypoints) {
    while (cx !== wp.x) {
      const dx = wp.x > cx ? 1 : -1;
      cx += dx;
      steps.push({ x: cx, y: cy, dir: dx > 0 ? 'right' : 'left' });
    }
    while (cy !== wp.y) {
      const dy = wp.y > cy ? 1 : -1;
      cy += dy;
      steps.push({ x: cx, y: cy, dir: dy > 0 ? 'down' : 'up' });
    }
  }

  return steps;
}

export const VILLA_GUIDE_NPC_ID = 'guia_villa';

export const VILLA_GUIDE_SPAWN = {
  x: 24,
  y: 24,
  dir: 'down' as Direction,
};

export const VILLA_PLAYER_SPAWN = {
  x: 24,
  y: 26,
  dir: 'up' as Direction,
};

// Segment 1: Guide leads player up the central cobble plaza
export const VILLA_TOUR_PLAZA_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 24, y: 22 },
  { x: 23, y: 22 },
];

export const VILLA_TOUR_PLAZA_PLAYER_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 24, y: 22 },
];

// Segment 2: Guide escorts player west & north straight to Prof. Robledo's Lab doorway (19, 19) facing door (19, 18)
export const VILLA_TOUR_LAB_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 23, y: 21 },
  { x: 19, y: 21 },
  { x: 19, y: 19 },
  { x: 20, y: 19 },
];

export const VILLA_TOUR_LAB_PLAYER_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 24, y: 21 },
  { x: 19, y: 21 },
  { x: 19, y: 19 },
];

export const VILLA_GUIDE_REST_BEFORE_STARTER: { x: number; y: number; dir: Direction } = {
  x: 20,
  y: 19,
  dir: 'down',
};

export const VILLA_GUIDE_REST_AFTER_STARTER: { x: number; y: number; dir: Direction } = {
  x: 21,
  y: 20,
  dir: 'down',
};

// Interior Lab Escort (laboratorio_origen): Guía Lía leads player up to Prof. Robledo (6, 4) and then beside pedestals (10, 12, 14; z=4)
export const LAB_GUIDE_NPC_ID = 'guia_lab';

export const LAB_GUIDE_SPAWN = {
  x: 9,
  y: 10,
  dir: 'up' as Direction,
};

export const LAB_PLAYER_SPAWN = {
  x: 8,
  y: 10,
  dir: 'up' as Direction,
};

export const LAB_TOUR_PROF_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 9, y: 6 },
  { x: 7, y: 6 },
  { x: 7, y: 5 },
];

export const LAB_TOUR_PROF_PLAYER_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 8, y: 6 },
  { x: 6, y: 6 },
  { x: 6, y: 5 },
];

export const LAB_TOUR_PEDESTALS_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 9, y: 5 },
];

export const LAB_GUIDE_REST_BEFORE_STARTER: { x: number; y: number; dir: Direction } = {
  x: 9,
  y: 5,
  dir: 'right',
};

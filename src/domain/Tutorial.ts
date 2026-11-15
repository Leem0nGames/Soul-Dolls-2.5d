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
      'Desplázate paso a paso por el mundo, administra tu Estamina al correr y gira la cámara para descubrir senderos, objetos ocultos y entrenadores.',
    facts: [
      {
        badge: 'WASD / ✚',
        label: 'Desplazamiento',
        detail: 'Usa Flechas, WASD o la cruceta táctil para caminar por casillas y cruzar portales.',
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
        detail: 'Rota el ángulo 90° en cualquier momento. La dirección de movimiento se adapta sola.',
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
    badge: 'LECCIÓN 4/4 · TALLER',
    title: 'Soulpots, Cuerpos y Cartas',
    dialog:
      'Debilita a las SoulDolls salvajes para sellarlas en Soulpots, ensambla nuevos Cuerpos Contenedores y engarza Cartas. En Villa Origen te espera una guía para llevarte ante el Profesor.',
    facts: [
      {
        badge: 'SOULPOT',
        label: 'Sellado en Batalla',
        detail: 'Reduce sus PS o aplica estados como Sueño/Parálisis antes de lanzar un Soulpot desde Mochila.',
        tone: 'cyan',
      },
      {
        badge: 'AR / PIEZAS',
        label: 'Cuerpos Contenedores',
        detail: 'Si capturas un alma sin armazón libre, espera en Reserva hasta vincularla en Contenedores.',
        tone: 'violet',
      },
      {
        badge: 'CARTAS',
        label: 'Álbum y Engarce',
        detail: 'Las SoulDolls derrotadas pueden soltar su Carta; engárzala en Datos para potenciar estadísticas.',
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

// Segment 2: Guide escorts player west & north straight to Prof. Robledo's lab entrance (19, 20)
export const VILLA_TOUR_LAB_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 23, y: 21 },
  { x: 19, y: 21 },
  { x: 19, y: 20 },
  { x: 20, y: 20 },
];

export const VILLA_TOUR_LAB_PLAYER_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 24, y: 21 },
  { x: 19, y: 21 },
  { x: 19, y: 20 },
];

// Segment 3: Guide moves beside the 3 starter pedestals (25..27, 19) avoiding lamp_wood at (22, 20)
export const VILLA_TOUR_PEDESTALS_GUIDE_WAYPOINTS: readonly WaypointCoord[] = [
  { x: 20, y: 21 },
  { x: 24, y: 21 },
  { x: 24, y: 20 },
];

export const VILLA_GUIDE_REST_BEFORE_STARTER: { x: number; y: number; dir: Direction } = {
  x: 24,
  y: 20,
  dir: 'right',
};

export const VILLA_GUIDE_REST_AFTER_STARTER: { x: number; y: number; dir: Direction } = {
  x: 21,
  y: 20,
  dir: 'down',
};

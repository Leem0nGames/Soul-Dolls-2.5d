import type { TrainerDef } from '../domain/types.ts';

export const TRAINERS: Record<string, TrainerDef> = {
  ruta1_scout: {
    id: 'ruta1_scout',
    name: 'Lucas',
    title: 'Soultrainer',
    role: 'trainer',
    rewardMoney: 220,
    introText: '¡Eh! ¡Nuestras miradas se cruzaron! ¡Veamos qué tan fuerte es tu equipo de marionetas!',
    defeatText: '¡Vaya ritmo tienes! Sigue así hacia Pueblo Bruma.',
    party: [
      { speciesId: 10, level: 4 },
      { speciesId: 16, level: 4 },
    ],
  },
  rival_1: {
    id: 'rival_1',
    name: 'Damián',
    title: 'Soultrainer Rival',
    role: 'rival',
    isRival: true,
    rewardMoney: 450,
    introText: '¡Al fin te alcanzo! El Prof. Robledo también me dio un Soulpot. ¡Demuéstrame lo que vales!',
    defeatText: 'Grrr... Por esta vez ganaste, pero nos veremos en Cueva Eco.',
    setsFlag: 'rival_1_defeated',
    party: [
      { speciesId: 10, level: 6 },
      { speciesId: 12, level: 7 },
    ],
  },
  ruta2_guarda: {
    id: 'ruta2_guarda',
    name: 'Elena',
    title: 'Soultrainer',
    role: 'trainer',
    rewardMoney: 380,
    introText: 'El Paso Rocoso exige estrategia. ¡Prepárate para un duelo de Soultrainers!',
    defeatText: 'Buena coordinación elemental. Te espera la Cueva Eco.',
    party: [
      { speciesId: 8, level: 11 },
      { speciesId: 11, level: 11 },
    ],
  },
  ruta2_chispero: {
    id: 'ruta2_chispero',
    name: 'Nico',
    title: 'Soultrainer',
    role: 'trainer',
    rewardMoney: 420,
    introText: '¡Mis marionetas eléctricas no fallan nunca!',
    defeatText: '¡Me quedé sin energía espiritual!',
    party: [
      { speciesId: 12, level: 12 },
      { speciesId: 11, level: 12 },
    ],
  },
  cueva_minero: {
    id: 'cueva_minero',
    name: 'Braulio',
    title: 'Soultrainer',
    role: 'trainer',
    rewardMoney: 520,
    introText: '¡Las marionetas de Cueva Eco son duras como el acero!',
    defeatText: '¡Lograste agrietar mi defensa!',
    party: [
      { speciesId: 14, level: 14 },
      { speciesId: 14, level: 15 },
    ],
  },
  rival_2: {
    id: 'rival_2',
    name: 'Damián',
    title: 'Soultrainer Rival',
    role: 'rival',
    isRival: true,
    rewardMoney: 850,
    introText: '¡No esperaba verte tan lejos! Mis marionetas evolucionaron desde la Ruta 1. ¡Ahora sí no perderé!',
    defeatText: 'Increíble... Estás listo para desafiar a la Maestra Valeria en la Arena Cumbre.',
    setsFlag: 'rival_2_defeated',
    party: [
      { speciesId: 11, level: 16 },
      { speciesId: 13, level: 17 },
      { speciesId: 17, level: 17 },
    ],
  },
  arena_discipulo: {
    id: 'arena_discipulo',
    name: 'Sofía',
    title: 'Soultrainer',
    role: 'trainer',
    rewardMoney: 650,
    introText: 'Antes de retar a la Maestra Valeria, debes superar la prueba de la Arena.',
    defeatText: 'Impresionante. La Maestra Valeria te espera al fondo.',
    party: [
      { speciesId: 5, level: 18 },
      { speciesId: 15, level: 19 },
    ],
  },
  leader_valeria: {
    id: 'leader_valeria',
    name: 'Valeria',
    title: 'Maestra Soultrainer',
    role: 'leader',
    isBoss: true,
    rewardMoney: 2500,
    introText: '¡Bienvenido a la Arena Cumbre! Soy Valeria. Muéstrame el vínculo que forjaste con tus marionetas.',
    defeatText: '¡Magistral! Tu dominio espiritual brilla con fuerza propia. ¡Eres el nuevo Campeón!',
    setsFlag: 'arena_cleared',
    party: [
      { speciesId: 11, level: 20 },
      { speciesId: 15, level: 21 },
      { speciesId: 18, level: 23 },
    ],
  },
};

export function getTrainer(id: string): TrainerDef {
  const t = TRAINERS[id];
  if (!t) throw new Error(`Unknown trainer: ${id}`);
  return t;
}

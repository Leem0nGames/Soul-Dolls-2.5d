import type { AbilityDef } from '../domain/types.ts';

export const ABILITIES: Record<string, AbilityDef> = {
  intimidacion: {
    id: 'intimidacion',
    name: 'Presencia Férrea',
    description: 'Al entrar en combate, reduce el Ataque del rival.',
    hooks: {
      onEntry: { enemyStat: { stat: 'atk', delta: -1 } },
    },
  },
  impulso_inicial: {
    id: 'impulso_inicial',
    name: 'Brío Inicial',
    description: 'Aumenta su Velocidad al entrar en combate.',
    hooks: {
      onEntry: { selfStat: { stat: 'spe', delta: 1 } },
    },
  },
  absorbe_marea: {
    id: 'absorbe_marea',
    name: 'Esponja Marina',
    description: 'Es inmune al tipo Marea y recupera 25% PS al recibirlo.',
    hooks: {
      modifyIncomingDamage: { immuneType: 'marea', healRatioOnImmune: 0.25 },
    },
  },
  absorbe_brasa: {
    id: 'absorbe_brasa',
    name: 'Núcleo Térmico',
    description: 'Es inmune al tipo Brasa y recupera 25% PS al recibirlo.',
    hooks: {
      modifyIncomingDamage: { immuneType: 'brasa', healRatioOnImmune: 0.25 },
    },
  },
  absorbe_chispa: {
    id: 'absorbe_chispa',
    name: 'Pararrayos Vivo',
    description: 'Es inmune al tipo Chispa y recupera 25% PS al recibirlo.',
    hooks: {
      modifyIncomingDamage: { immuneType: 'chispa', healRatioOnImmune: 0.25 },
    },
  },
  furia_brasa: {
    id: 'furia_brasa',
    name: 'Ascua Viva',
    description: 'Potencia ataques de tipo Brasa en +50% con menos de 1/3 de PS.',
    hooks: {
      onLowHp: { thresholdRatio: 0.34, boostType: 'brasa', damageMultiplier: 1.5 },
    },
  },
  furia_marea: {
    id: 'furia_marea',
    name: 'Torrente Oculto',
    description: 'Potencia ataques de tipo Marea en +50% con menos de 1/3 de PS.',
    hooks: {
      onLowHp: { thresholdRatio: 0.34, boostType: 'marea', damageMultiplier: 1.5 },
    },
  },
  furia_flora: {
    id: 'furia_flora',
    name: 'Savia Rebelde',
    description: 'Potencia ataques de tipo Flora en +50% con menos de 1/3 de PS.',
    hooks: {
      onLowHp: { thresholdRatio: 0.34, boostType: 'flora', damageMultiplier: 1.5 },
    },
  },
  piel_espinas: {
    id: 'piel_espinas',
    name: 'Piel Espinosa',
    description: 'Hiere al atacante con 1/8 de sus PS al recibir golpes físicos.',
    hooks: {
      onContactHit: { retaliateRatio: 0.125 },
    },
  },
  cuerpo_igneo: {
    id: 'cuerpo_igneo',
    name: 'Cuerpo Ígneo',
    description: 'Puede quemar (30%) al rival si ataca por contacto.',
    hooks: {
      onContactHit: { status: 'burn', statusChance: 30 },
    },
  },
  estatica_viva: {
    id: 'estatica_viva',
    name: 'Carga Estática',
    description: 'Puede paralizar (30%) al rival tras un golpe físico.',
    hooks: {
      onContactHit: { status: 'paralysis', statusChance: 30 },
    },
  },
  mente_clara: {
    id: 'mente_clara',
    name: 'Mente Despejada',
    description: 'Impide quedarse dormido o paralizado.',
    hooks: {
      onStatusAttempt: { immuneStatuses: ['sleep', 'paralysis'] },
    },
  },
  escudo_puro: {
    id: 'escudo_puro',
    name: 'Escudo Inmune',
    description: 'Evita sufrir quemaduras o envenenamiento.',
    hooks: {
      onStatusAttempt: { immuneStatuses: ['burn', 'poison'] },
    },
  },
  regeneracion: {
    id: 'regeneracion',
    name: 'Brote Vital',
    description: 'Recupera 1/12 de sus PS máximos al final de cada turno.',
    hooks: {
      onTurnEnd: { healRatio: 1 / 12 },
    },
  },
  coraza_dura: {
    id: 'coraza_dura',
    name: 'Coraza Mineral',
    description: 'Reduce en un 20% todo el daño muy eficaz recibido.',
    hooks: {
      modifyIncomingDamage: { resistMultiplier: 0.8, superEffectiveOnly: true },
    },
  },
  velo_ligero: {
    id: 'velo_ligero',
    name: 'Pies Ligeros',
    description: 'Aumenta su Velocidad en +35% cuando sufre un estado alterado.',
    hooks: {
      modifyStat: { stat: 'spe', multiplier: 1.35, requiresStatus: true },
    },
  },
  broma_veloz: {
    id: 'broma_veloz',
    name: 'Reflejo Astuto',
    description: 'Los movimientos de estado ganan +1 de prioridad.',
    hooks: {
      priorityBoost: { category: 'status', delta: 1 },
    },
  },
  enfoque_puro: {
    id: 'enfoque_puro',
    name: 'Pulso Preciso',
    description: 'Aumenta en +15% el daño de todos los ataques.',
    hooks: {
      modifyOutgoingDamage: { multiplier: 1.15 },
    },
  },
};

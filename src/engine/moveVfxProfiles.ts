import type { MoveCategory, MoveEffect } from '../domain/types.ts';

export type MoveVfxStyle =
  | 'impact'
  | 'slash'
  | 'pierce'
  | 'bite'
  | 'barrage'
  | 'projectile'
  | 'beam'
  | 'meteor'
  | 'quake'
  | 'cyclone'
  | 'nova'
  | 'lightning'
  | 'void'
  | 'haze'
  | 'drain'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'debuff'
  | 'sonic'
  | 'weather'
  | 'elemental';

export interface MoveImpactProfile {
  shake: number;
  shakeDecay: number;
  hitStop: number;
  flash: number;
  flashMs: number;
  distortion: number;
  shockDuration: number;
  speedLines: number;
  speedDuration: number;
  bloom: number;
  bloomDuration: number;
  dim: number;
  dimDuration: number;
}

const STYLE_IMPACT: Record<MoveVfxStyle, MoveImpactProfile> = {
  impact: {
    shake: 0.26,
    shakeDecay: 8,
    hitStop: 0.05,
    flash: 0.16,
    flashMs: 130,
    distortion: 0.024,
    shockDuration: 0.32,
    speedLines: 0.3,
    speedDuration: 0.28,
    bloom: 0.34,
    bloomDuration: 0.4,
    dim: 0.16,
    dimDuration: 0.44,
  },
  slash: {
    shake: 0.17,
    shakeDecay: 9,
    hitStop: 0.036,
    flash: 0.08,
    flashMs: 90,
    distortion: 0.015,
    shockDuration: 0.24,
    speedLines: 0.38,
    speedDuration: 0.3,
    bloom: 0.24,
    bloomDuration: 0.34,
    dim: 0.1,
    dimDuration: 0.34,
  },
  pierce: {
    shake: 0.13,
    shakeDecay: 10,
    hitStop: 0.03,
    flash: 0.1,
    flashMs: 90,
    distortion: 0.019,
    shockDuration: 0.22,
    speedLines: 0.32,
    speedDuration: 0.26,
    bloom: 0.22,
    bloomDuration: 0.32,
    dim: 0.08,
    dimDuration: 0.3,
  },
  bite: {
    shake: 0.21,
    shakeDecay: 9,
    hitStop: 0.042,
    flash: 0.12,
    flashMs: 110,
    distortion: 0.016,
    shockDuration: 0.26,
    speedLines: 0.16,
    speedDuration: 0.24,
    bloom: 0.24,
    bloomDuration: 0.36,
    dim: 0.12,
    dimDuration: 0.36,
  },
  barrage: {
    shake: 0.15,
    shakeDecay: 10,
    hitStop: 0.026,
    flash: 0.08,
    flashMs: 90,
    distortion: 0.012,
    shockDuration: 0.24,
    speedLines: 0.24,
    speedDuration: 0.3,
    bloom: 0.2,
    bloomDuration: 0.34,
    dim: 0.08,
    dimDuration: 0.3,
  },
  projectile: {
    shake: 0.17,
    shakeDecay: 9,
    hitStop: 0.032,
    flash: 0.1,
    flashMs: 100,
    distortion: 0.015,
    shockDuration: 0.26,
    speedLines: 0.18,
    speedDuration: 0.24,
    bloom: 0.26,
    bloomDuration: 0.36,
    dim: 0.1,
    dimDuration: 0.34,
  },
  beam: {
    shake: 0.21,
    shakeDecay: 8.5,
    hitStop: 0.04,
    flash: 0.15,
    flashMs: 120,
    distortion: 0.023,
    shockDuration: 0.3,
    speedLines: 0.26,
    speedDuration: 0.3,
    bloom: 0.38,
    bloomDuration: 0.44,
    dim: 0.16,
    dimDuration: 0.42,
  },
  meteor: {
    shake: 0.36,
    shakeDecay: 7,
    hitStop: 0.062,
    flash: 0.26,
    flashMs: 170,
    distortion: 0.035,
    shockDuration: 0.36,
    speedLines: 0.18,
    speedDuration: 0.3,
    bloom: 0.56,
    bloomDuration: 0.52,
    dim: 0.22,
    dimDuration: 0.52,
  },
  quake: {
    shake: 0.38,
    shakeDecay: 6.5,
    hitStop: 0.052,
    flash: 0.13,
    flashMs: 130,
    distortion: 0.032,
    shockDuration: 0.4,
    speedLines: 0.08,
    speedDuration: 0.24,
    bloom: 0.4,
    bloomDuration: 0.46,
    dim: 0.2,
    dimDuration: 0.5,
  },
  cyclone: {
    shake: 0.25,
    shakeDecay: 8,
    hitStop: 0.042,
    flash: 0.11,
    flashMs: 110,
    distortion: 0.027,
    shockDuration: 0.32,
    speedLines: 0.46,
    speedDuration: 0.36,
    bloom: 0.32,
    bloomDuration: 0.42,
    dim: 0.14,
    dimDuration: 0.4,
  },
  nova: {
    shake: 0.42,
    shakeDecay: 6.5,
    hitStop: 0.072,
    flash: 0.32,
    flashMs: 190,
    distortion: 0.042,
    shockDuration: 0.42,
    speedLines: 0.2,
    speedDuration: 0.32,
    bloom: 0.68,
    bloomDuration: 0.6,
    dim: 0.26,
    dimDuration: 0.58,
  },
  lightning: {
    shake: 0.32,
    shakeDecay: 8,
    hitStop: 0.05,
    flash: 0.3,
    flashMs: 150,
    distortion: 0.035,
    shockDuration: 0.34,
    speedLines: 0.1,
    speedDuration: 0.24,
    bloom: 0.6,
    bloomDuration: 0.5,
    dim: 0.22,
    dimDuration: 0.46,
  },
  void: {
    shake: 0.29,
    shakeDecay: 7.5,
    hitStop: 0.052,
    flash: 0.18,
    flashMs: 140,
    distortion: 0.034,
    shockDuration: 0.36,
    speedLines: 0.12,
    speedDuration: 0.28,
    bloom: 0.54,
    bloomDuration: 0.5,
    dim: 0.24,
    dimDuration: 0.5,
  },
  haze: {
    shake: 0.09,
    shakeDecay: 9,
    hitStop: 0.022,
    flash: 0.05,
    flashMs: 90,
    distortion: 0.013,
    shockDuration: 0.28,
    speedLines: 0.05,
    speedDuration: 0.2,
    bloom: 0.2,
    bloomDuration: 0.4,
    dim: 0.08,
    dimDuration: 0.42,
  },
  drain: {
    shake: 0.13,
    shakeDecay: 9,
    hitStop: 0.03,
    flash: 0.08,
    flashMs: 100,
    distortion: 0.016,
    shockDuration: 0.28,
    speedLines: 0.08,
    speedDuration: 0.22,
    bloom: 0.26,
    bloomDuration: 0.4,
    dim: 0.1,
    dimDuration: 0.38,
  },
  heal: {
    shake: 0,
    shakeDecay: 9,
    hitStop: 0,
    flash: 0.04,
    flashMs: 90,
    distortion: 0,
    shockDuration: 0.24,
    speedLines: 0,
    speedDuration: 0.2,
    bloom: 0.26,
    bloomDuration: 0.5,
    dim: 0,
    dimDuration: 0.3,
  },
  shield: {
    shake: 0.08,
    shakeDecay: 9,
    hitStop: 0.02,
    flash: 0.08,
    flashMs: 100,
    distortion: 0.01,
    shockDuration: 0.26,
    speedLines: 0.06,
    speedDuration: 0.2,
    bloom: 0.3,
    bloomDuration: 0.42,
    dim: 0.06,
    dimDuration: 0.3,
  },
  buff: {
    shake: 0,
    shakeDecay: 9,
    hitStop: 0,
    flash: 0.03,
    flashMs: 80,
    distortion: 0,
    shockDuration: 0.22,
    speedLines: 0,
    speedDuration: 0.2,
    bloom: 0.22,
    bloomDuration: 0.44,
    dim: 0,
    dimDuration: 0.3,
  },
  debuff: {
    shake: 0.08,
    shakeDecay: 9,
    hitStop: 0.02,
    flash: 0.05,
    flashMs: 90,
    distortion: 0.01,
    shockDuration: 0.24,
    speedLines: 0.04,
    speedDuration: 0.2,
    bloom: 0.2,
    bloomDuration: 0.36,
    dim: 0.06,
    dimDuration: 0.3,
  },
  sonic: {
    shake: 0.19,
    shakeDecay: 8.5,
    hitStop: 0.036,
    flash: 0.08,
    flashMs: 100,
    distortion: 0.025,
    shockDuration: 0.32,
    speedLines: 0.3,
    speedDuration: 0.3,
    bloom: 0.28,
    bloomDuration: 0.4,
    dim: 0.12,
    dimDuration: 0.38,
  },
  weather: {
    shake: 0.23,
    shakeDecay: 7.5,
    hitStop: 0.042,
    flash: 0.12,
    flashMs: 130,
    distortion: 0.027,
    shockDuration: 0.4,
    speedLines: 0.12,
    speedDuration: 0.3,
    bloom: 0.4,
    bloomDuration: 0.58,
    dim: 0.2,
    dimDuration: 0.56,
  },
  elemental: {
    shake: 0.2,
    shakeDecay: 8.5,
    hitStop: 0.038,
    flash: 0.12,
    flashMs: 120,
    distortion: 0.02,
    shockDuration: 0.3,
    speedLines: 0.18,
    speedDuration: 0.26,
    bloom: 0.3,
    bloomDuration: 0.4,
    dim: 0.12,
    dimDuration: 0.38,
  },
};

export function getMoveImpactProfile(
  style: MoveVfxStyle,
  power = 60,
  category: MoveCategory = 'special'
): MoveImpactProfile {
  const base = STYLE_IMPACT[style] ?? STYLE_IMPACT.elemental;
  if (category === 'status') {
    return {
      ...base,
      shake: base.shake * 0.55,
      hitStop: base.hitStop * 0.5,
      flash: base.flash * 0.7,
      speedLines: base.speedLines * 0.6,
      bloom: base.bloom * 0.8,
    };
  }

  const powerT = Math.max(0, Math.min(1, (power - 40) / 80));
  const scale = 0.72 + powerT * 0.55;
  return {
    ...base,
    shake: base.shake * scale,
    hitStop: base.hitStop * (0.8 + powerT * 0.5),
    flash: Math.min(0.65, base.flash * scale),
    distortion: base.distortion * scale,
    speedLines: base.speedLines * scale,
    bloom: Math.min(0.72, base.bloom * scale),
    dim: Math.min(0.26, base.dim * scale),
  };
}

const MOVE_STYLE_OVERRIDES: Record<string, MoveVfxStyle> = {
  // Común
  placaje: 'impact',
  araniazo: 'slash',
  golpe_rapido: 'pierce',
  grunido: 'debuff',
  latigo: 'debuff',
  hipercolmillo: 'bite',
  recuperacion: 'heal',
  derribo: 'impact',
  doble_bofeton: 'barrage',
  barrera_total: 'shield',
  corte_critico: 'slash',
  pulso_eco: 'sonic',
  impacto_fijo: 'impact',

  // Brasa
  ascuas: 'projectile',
  giro_fuego: 'cyclone',
  colmillo_igno: 'bite',
  llamarada: 'meteor',
  llama_vital: 'impact',
  calcinar: 'haze',
  brasa_veloz: 'pierce',
  espira_magma: 'cyclone',
  forja_interna: 'buff',
  garra_incandescente: 'slash',
  ceniza_cegadora: 'haze',
  supernova: 'nova',
  sol_radiante: 'weather',

  // Marea
  burbuja: 'projectile',
  pistola_agua: 'beam',
  pulso_abismo: 'sonic',
  hidrochorro: 'beam',
  danza_lluvia: 'buff',
  acua_impulso: 'impact',
  remolino_mar: 'cyclone',
  cascada_viva: 'impact',
  escarcha_pura: 'haze',
  ventisca_marina: 'nova',
  coraza_coral: 'heal',
  tenaza_abismal: 'bite',
  lluvia_eterna: 'weather',

  // Flora
  latigo_cepa: 'slash',
  absorber: 'drain',
  hoja_filo: 'slash',
  gigadrenado: 'drain',
  espora_sueno: 'haze',
  polvo_veneno: 'haze',
  espora_drenaje: 'drain',
  lluvia_espinas: 'barrage',
  sintesis_luz: 'heal',
  zarpazo_raiz: 'impact',
  aroma_bosque: 'buff',
  tormenta_floral: 'nova',

  // Chispa
  chispazo: 'lightning',
  onda_trueno: 'debuff',
  rayo_veloz: 'pierce',
  descarga_max: 'lightning',
  campo_magnetico: 'buff',
  colmillo_voltio: 'bite',
  arco_prisma: 'beam',
  carga_salvaje: 'impact',
  rayo_orbital: 'nova',
  red_estatica: 'debuff',
  pulso_ion: 'sonic',
  barrera_volt: 'shield',

  // Roca
  pedrada: 'projectile',
  avalancha: 'impact',
  muro_piedra: 'buff',
  terremoto_menor: 'quake',
  rafaga_guijarro: 'barrage',
  joya_prismatica: 'beam',
  tumba_arenisca: 'quake',
  pulimento_mineral: 'buff',
  fisura_antigua: 'quake',
  cristal_protector: 'shield',
  fragmento_fijo: 'impact',
  onda_basalto: 'quake',
  tormenta_arena: 'weather',

  // Brisa
  rafaga: 'barrage',
  ala_cortante: 'slash',
  viento_afilo: 'buff',
  huracan_menor: 'cyclone',
  picotazo_veloz: 'pierce',
  tajo_pluma: 'slash',
  respiro_aire: 'heal',
  torbellino_pluma: 'debuff',
  ciclon_nube: 'cyclone',
  asalto_celeste: 'impact',
  polvo_plata: 'projectile',
  tifon_aurora: 'nova',
  ventisca_albo: 'weather',

  // Umbra
  sombra_vil: 'void',
  mordisco_oscuro: 'bite',
  pesadilla_pulso: 'void',
  toque_toxico: 'impact',
  mirada_abismo: 'debuff',
  sanguijuela_alma: 'drain',
  garra_nocturna: 'slash',
  meditacion_umbra: 'buff',
  eclipse_total: 'nova',
  canto_espectral: 'haze',
  rafaga_sombra: 'barrage',
  sello_sombra: 'shield',
};

export function getMoveVfxStyle(
  moveId?: string,
  category: MoveCategory = 'special',
  effectKind?: MoveEffect['kind'],
  effectTarget?: MoveEffect['target']
): MoveVfxStyle {
  if (moveId && MOVE_STYLE_OVERRIDES[moveId]) {
    return MOVE_STYLE_OVERRIDES[moveId];
  }

  if (effectKind === 'heal') return 'heal';
  if (effectKind === 'protect') return 'shield';
  if (effectKind === 'weather') return 'weather';
  if (effectKind === 'drain' || effectKind === 'leech') return 'drain';
  if (effectKind === 'multi_hit') return 'barrage';

  if (category === 'status') {
    return effectTarget === 'self' ? 'buff' : 'debuff';
  }

  const id = moveId ?? '';
  if (/(colmillo|mordisco|tenaza)/.test(id)) return 'bite';
  if (/(garra|arania|zarpazo|tajo|hoja|ala|filo)/.test(id)) return 'slash';
  if (/(pico|perfor|taladro|aguja)/.test(id)) return 'pierce';
  if (/(rafaga|lluvia|doble|guijarro)/.test(id)) return 'barrage';
  if (/(meteoro|llamarada|supernova|eclipse|piro|fuego)/.test(id)) return 'meteor';
  if (/(rayo|trueno|chispa|volt|descarga|electro)/.test(id)) return 'lightning';
  if (/(tormenta|tifon|ciclon|huracan|viento|vendaval|remolino|torbellino)/.test(id)) {
    return 'cyclone';
  }
  if (/(terremoto|sismic|fisura|avalancha|pedrada|roca|tumba)/.test(id)) return 'quake';
  if (/(hidro|chorro|agua|burbuja|acu|marea)/.test(id)) return 'beam';
  if (/(sombra|umbra|abismo|nocturn|pesadilla|sanguijuela|alma)/.test(id)) return 'void';
  if (/(espora|polvo|veneno|toxico|ceniza|nube|gas|escarcha)/.test(id)) return 'haze';
  if (/(pulso|onda|eco|sonoro|ion)/.test(id)) return 'sonic';
  if (category === 'physical') return 'impact';

  return 'elemental';
}

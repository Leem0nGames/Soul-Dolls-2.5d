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

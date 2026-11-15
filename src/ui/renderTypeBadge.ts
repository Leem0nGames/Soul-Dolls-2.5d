import { TYPE_VISUALS } from '../data/types.ts';
import type { CreatureType } from '../domain/types.ts';
import { ES } from '../i18n/es.ts';

type TypeBadgeVariant = 'chip' | 'sm' | 'smUpper' | 'move' | 'md';

const VARIANT_CLASSES: Record<TypeBadgeVariant, string> = {
  chip: 'px-1 py-[1px] rounded-none text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider border leading-none',
  sm: 'px-1.5 py-0.5 rounded-none border text-[10px] font-bold',
  smUpper: 'px-1.5 py-0.5 rounded-none border text-[10px] font-bold uppercase',
  move: 'px-1.5 py-0.5 rounded-none border text-[11px] font-bold',
  md: 'px-2 py-0.5 rounded-none text-xs font-bold border',
};

export function renderTypeBadge(
  type: CreatureType,
  variant: TypeBadgeVariant = 'md'
): string {
  const v = TYPE_VISUALS[type];
  return `<span class="${VARIANT_CLASSES[variant]}" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[type]}</span>`;
}

export function renderTypeBadges(
  types: readonly CreatureType[],
  variant: TypeBadgeVariant = 'md',
  separator = ' '
): string {
  return types.map((t) => renderTypeBadge(t, variant)).join(separator);
}

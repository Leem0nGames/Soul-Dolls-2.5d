import type { CardRarity } from '../domain/types.ts';

export interface CardRarityStyle {
  border: string;
  unownedBorder: string;
  hoverBorder: string;
  accent: string;
  frameBg: string;
  glow: string;
  fxColor: string;
}

export const CARD_RARITY_STYLES: Record<CardRarity, CardRarityStyle> = {
  comun: {
    border: 'border-cold-stone',
    unownedBorder: 'border-ash-purple',
    hoverBorder: 'hover:border-bone-gray',
    accent: 'text-bone-gray',
    frameBg: 'bg-crypt-ink',
    glow: 'shadow-[2px_2px_0_#050505]',
    fxColor: '#A89BA8',
  },
  rara: {
    border: 'border-ki-cyan',
    unownedBorder: 'border-oceanic-teal',
    hoverBorder: 'hover:border-ice-cyan',
    accent: 'text-ki-cyan',
    frameBg: 'bg-dark-slate',
    glow: 'shadow-[2px_2px_0_#050505]',
    fxColor: '#5FE3D2',
  },
  epica: {
    border: 'border-soul-violet',
    unownedBorder: 'border-royal-purple',
    hoverBorder: 'hover:border-ethereal-orchid',
    accent: 'text-ethereal-orchid',
    frameBg: 'bg-nightshade',
    glow: 'shadow-[3px_3px_0_#050505]',
    fxColor: '#B691FF',
  },
  legendaria: {
    border: 'border-bright-brass',
    unownedBorder: 'border-old-bronze',
    hoverBorder: 'hover:border-pale-gold',
    accent: 'text-bright-brass',
    frameBg: 'bg-dark-oak',
    glow: 'shadow-[3px_3px_0_#050505]',
    fxColor: '#F4D073',
  },
};

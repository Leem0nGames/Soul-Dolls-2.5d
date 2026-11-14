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
    border: 'border-cold-stone/85',
    unownedBorder: 'border-cold-stone/40',
    hoverBorder: 'hover:border-bone-gray',
    accent: 'text-bone-gray',
    frameBg: 'bg-crypt-ink',
    glow: '',
    fxColor: '#A89BA8',
  },
  rara: {
    border: 'border-ki-cyan/85',
    unownedBorder: 'border-ki-cyan/30',
    hoverBorder: 'hover:border-ice-cyan',
    accent: 'text-ki-cyan',
    frameBg: 'bg-gradient-to-b from-deep-abyss/35 via-crypt-ink to-crypt-ink',
    glow: 'shadow-[0_0_12px_rgba(95,227,210,0.18)]',
    fxColor: '#5FE3D2',
  },
  epica: {
    border: 'border-soul-violet',
    unownedBorder: 'border-soul-violet/35',
    hoverBorder: 'hover:border-ethereal-orchid',
    accent: 'text-ethereal-orchid',
    frameBg: 'bg-gradient-to-b from-deep-amethyst/40 via-crypt-ink to-crypt-ink',
    glow: 'shadow-[0_0_14px_rgba(155,107,255,0.26)]',
    fxColor: '#B691FF',
  },
  legendaria: {
    border: 'border-bright-brass',
    unownedBorder: 'border-bright-brass/45',
    hoverBorder: 'hover:border-pale-gold',
    accent: 'text-bright-brass',
    frameBg: 'bg-gradient-to-b from-dark-oak/60 via-crypt-ink to-crypt-ink',
    glow: 'shadow-[0_0_18px_rgba(244,208,115,0.34)]',
    fxColor: '#F4D073',
  },
};

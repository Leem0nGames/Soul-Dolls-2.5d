import type { BattleBiome, BattleWeather, EncounterEntry, TimePhase } from './types.ts';

export const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_WORLD_CLOCK_MINUTES = 9 * 60; // 09:00 Mañana
// ~15 real minutes per full 24h day-night cycle
export const WORLD_MINUTES_PER_REAL_SEC = 1.6;

export function normalizeWorldMinutes(minutes: number | undefined): number {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return DEFAULT_WORLD_CLOCK_MINUTES;
  }
  const m = minutes % MINUTES_PER_DAY;
  return m < 0 ? m + MINUTES_PER_DAY : m;
}

export function advanceWorldClock(minutes: number | undefined, dtSec: number): number {
  const base = normalizeWorldMinutes(minutes);
  if (!Number.isFinite(dtSec) || dtSec <= 0) return base;
  return normalizeWorldMinutes(base + dtSec * WORLD_MINUTES_PER_REAL_SEC);
}

export function getTimePhase(minutes: number | undefined): TimePhase {
  const m = normalizeWorldMinutes(minutes);
  const hour = Math.floor(m / 60);
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

export function getTimePhaseLabel(phase: TimePhase): string {
  switch (phase) {
    case 'morning':
      return 'Mañana';
    case 'day':
      return 'Día';
    case 'dusk':
      return 'Atardecer';
    case 'night':
      return 'Noche';
  }
}

export function formatWorldClock(minutes: number | undefined): string {
  const m = Math.floor(normalizeWorldMinutes(minutes));
  const hh = Math.floor(m / 60)
    .toString()
    .padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function filterEncountersByTime(
  entries: readonly EncounterEntry[],
  phase: TimePhase
): EncounterEntry[] {
  const matching = entries.filter(
    (e) => !e.timeOfDay || e.timeOfDay.length === 0 || e.timeOfDay.includes(phase)
  );
  return matching.length > 0 ? matching : [...entries];
}

export interface TimeLightingProfile {
  hemiIntensityMult: number;
  sunIntensityMult: number;
  sunColorHex: number;
  hemiSkyHex: number;
  fogTintHex: number;
  fogBlend: number;
  glowIntensityMult: number;
}

export function getTimeLightingProfile(
  phase: TimePhase,
  isInterior: boolean,
  isCave: boolean
): TimeLightingProfile {
  if (isInterior || isCave) {
    return {
      hemiIntensityMult: 1.0,
      sunIntensityMult: 1.0,
      sunColorHex: isCave ? 0xffe0b8 : 0xfff5e4,
      hemiSkyHex: isCave ? 0xd9c8ff : 0xfff8eb,
      fogTintHex: 0x000000,
      fogBlend: 0,
      glowIntensityMult: isCave ? 1.15 : 1.0,
    };
  }

  switch (phase) {
    case 'morning':
      return {
        hemiIntensityMult: 0.96,
        sunIntensityMult: 0.95,
        sunColorHex: 0xfff0d4,
        hemiSkyHex: 0xffeef4,
        fogTintHex: 0xf4c8a6,
        fogBlend: 0.14,
        glowIntensityMult: 0.9,
      };
    case 'day':
      return {
        hemiIntensityMult: 1.0,
        sunIntensityMult: 1.0,
        sunColorHex: 0xfff7e6,
        hemiSkyHex: 0xfff8eb,
        fogTintHex: 0xfff7e6,
        fogBlend: 0,
        glowIntensityMult: 0.65,
      };
    case 'dusk':
      return {
        hemiIntensityMult: 0.86,
        sunIntensityMult: 0.92,
        sunColorHex: 0xffb36b,
        hemiSkyHex: 0xf7b2a6,
        fogTintHex: 0x9b5169,
        fogBlend: 0.34,
        glowIntensityMult: 1.35,
      };
    case 'night':
      return {
        hemiIntensityMult: 0.62,
        sunIntensityMult: 0.56,
        sunColorHex: 0x8ea9ff,
        hemiSkyHex: 0x5d67b8,
        fogTintHex: 0x19183b,
        fogBlend: 0.62,
        glowIntensityMult: 1.75,
      };
  }
}

export function getDefaultBiomeWeather(biome?: BattleBiome): BattleWeather {
  if (biome === 'snow') return 'snow';
  return 'none';
}

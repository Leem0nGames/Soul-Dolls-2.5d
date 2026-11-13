export interface MusicNote {
  freq: number;
  dur: number;
  bass?: number;
}

export type TrackId =
  | 'title'
  | 'town'
  | 'route'
  | 'cave'
  | 'battle'
  | 'trainer_battle'
  | 'boss'
  | 'victory'
  | 'none';

const N: Record<string, number> = {
  R: 0,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
};

export const MUSIC_TRACKS: Record<Exclude<TrackId, 'none'>, { tempoMs: number; notes: MusicNote[] }> = {
  title: {
    tempoMs: 220,
    notes: [
      { freq: N.E4, dur: 1, bass: N.C3 },
      { freq: N.G4, dur: 1, bass: N.C3 },
      { freq: N.C5, dur: 2, bass: N.G3 },
      { freq: N.B4, dur: 1, bass: N.G3 },
      { freq: N.G4, dur: 1, bass: N.E3 },
      { freq: N.A4, dur: 2, bass: N.F3 },
      { freq: N.G4, dur: 1, bass: N.C3 },
      { freq: N.E4, dur: 1, bass: N.C3 },
      { freq: N.D4, dur: 2, bass: N.G3 },
      { freq: N.E4, dur: 1, bass: N.A3 },
      { freq: N.F4, dur: 1, bass: N.F3 },
      { freq: N.G4, dur: 2, bass: N.G3 },
    ],
  },
  town: {
    tempoMs: 240,
    notes: [
      { freq: N.C4, dur: 1, bass: N.C3 },
      { freq: N.E4, dur: 1, bass: N.C3 },
      { freq: N.G4, dur: 1, bass: N.G3 },
      { freq: N.E4, dur: 1, bass: N.G3 },
      { freq: N.F4, dur: 1, bass: N.F3 },
      { freq: N.A4, dur: 1, bass: N.F3 },
      { freq: N.G4, dur: 2, bass: N.C3 },
      { freq: N.D4, dur: 1, bass: N.G3 },
      { freq: N.F4, dur: 1, bass: N.G3 },
      { freq: N.E4, dur: 1, bass: N.C3 },
      { freq: N.C4, dur: 1, bass: N.C3 },
      { freq: N.D4, dur: 2, bass: N.G3 },
    ],
  },
  route: {
    tempoMs: 175,
    notes: [
      { freq: N.G4, dur: 1, bass: N.C3 },
      { freq: N.A4, dur: 1, bass: N.C3 },
      { freq: N.B4, dur: 1, bass: N.G3 },
      { freq: N.D5, dur: 1, bass: N.G3 },
      { freq: N.C5, dur: 1, bass: N.A3 },
      { freq: N.B4, dur: 1, bass: N.A3 },
      { freq: N.A4, dur: 2, bass: N.F3 },
      { freq: N.G4, dur: 1, bass: N.E3 },
      { freq: N.B4, dur: 1, bass: N.E3 },
      { freq: N.D5, dur: 1, bass: N.G3 },
      { freq: N.C5, dur: 1, bass: N.G3 },
      { freq: N.G4, dur: 2, bass: N.C3 },
    ],
  },
  cave: {
    tempoMs: 270,
    notes: [
      { freq: N.A3, dur: 1, bass: N.A3 },
      { freq: N.E4, dur: 1, bass: N.A3 },
      { freq: N.C4, dur: 2, bass: N.F3 },
      { freq: N.B3, dur: 1, bass: N.E3 },
      { freq: N.G4, dur: 1, bass: N.E3 },
      { freq: N.E4, dur: 2, bass: N.A3 },
      { freq: N.R, dur: 1, bass: N.D3 },
      { freq: N.F4, dur: 1, bass: N.D3 },
      { freq: N.E4, dur: 2, bass: N.E3 },
    ],
  },
  battle: {
    tempoMs: 135,
    notes: [
      { freq: N.E4, dur: 1, bass: N.E3 },
      { freq: N.E4, dur: 1, bass: N.E3 },
      { freq: N.G4, dur: 1, bass: N.G3 },
      { freq: N.A4, dur: 1, bass: N.A3 },
      { freq: N.B4, dur: 1, bass: N.E3 },
      { freq: N.A4, dur: 1, bass: N.E3 },
      { freq: N.G4, dur: 1, bass: N.D3 },
      { freq: N.F4, dur: 1, bass: N.D3 },
      { freq: N.E4, dur: 1, bass: N.C3 },
      { freq: N.G4, dur: 1, bass: N.D3 },
      { freq: N.C5, dur: 1, bass: N.E3 },
      { freq: N.B4, dur: 1, bass: N.G3 },
    ],
  },
  trainer_battle: {
    tempoMs: 125,
    notes: [
      { freq: N.D4, dur: 1, bass: N.D3 },
      { freq: N.F4, dur: 1, bass: N.D3 },
      { freq: N.A4, dur: 1, bass: N.A3 },
      { freq: N.G4, dur: 1, bass: N.G3 },
      { freq: N.F4, dur: 1, bass: N.D3 },
      { freq: N.A4, dur: 1, bass: N.F3 },
      { freq: N.C5, dur: 2, bass: N.C3 },
      { freq: N.D5, dur: 1, bass: N.D3 },
      { freq: N.C5, dur: 1, bass: N.A3 },
      { freq: N.A4, dur: 1, bass: N.G3 },
      { freq: N.G4, dur: 1, bass: N.E3 },
      { freq: N.E4, dur: 1, bass: N.A3 },
      { freq: N.F4, dur: 1, bass: N.D3 },
    ],
  },
  boss: {
    tempoMs: 115,
    notes: [
      { freq: N.A4, dur: 1, bass: N.A3 },
      { freq: N.E5, dur: 1, bass: N.A3 },
      { freq: N.D5, dur: 1, bass: N.G3 },
      { freq: N.C5, dur: 1, bass: N.F3 },
      { freq: N.B4, dur: 1, bass: N.E3 },
      { freq: N.C5, dur: 1, bass: N.E3 },
      { freq: N.D5, dur: 1, bass: N.G3 },
      { freq: N.E5, dur: 1, bass: N.A3 },
      { freq: N.A5, dur: 2, bass: N.A3 },
      { freq: N.G5, dur: 1, bass: N.G3 },
      { freq: N.E5, dur: 1, bass: N.E3 },
    ],
  },
  victory: {
    tempoMs: 170,
    notes: [
      { freq: N.C5, dur: 1, bass: N.C3 },
      { freq: N.E5, dur: 1, bass: N.C3 },
      { freq: N.G5, dur: 2, bass: N.G3 },
      { freq: N.E5, dur: 1, bass: N.F3 },
      { freq: N.G5, dur: 1, bass: N.G3 },
      { freq: N.A5, dur: 3, bass: N.C3 },
    ],
  },
};

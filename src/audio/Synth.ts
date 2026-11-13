import type { EventMap } from '../core/EventBus.ts';
import { MUSIC_TRACKS, type TrackId } from './music.ts';

export type SfxId = EventMap['audio:sfx']['sfx'];

export class Synth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.6;
  private muted = false;
  private currentTrack: TrackId = 'none';
  private stepIndex = 0;
  private nextNoteAt = 0;
  private timerId: number | null = null;
  private unlocked = false;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyGain();
    }
    this.unlocked = true;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  resumeIfActive(): void {
    if (!this.unlocked || this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  getMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  private applyGain(): void {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0 : this.volume * 0.28,
      this.ctx.currentTime
    );
  }

  playSfx(sfx: SfxId): void {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return;
    }
    const now = this.ctx.currentTime;
    switch (sfx) {
      case 'menu':
        this.tone(660, 0.05, 'square', now, 0.35);
        break;
      case 'confirm':
        this.tone(520, 0.06, 'square', now, 0.4);
        this.tone(780, 0.08, 'square', now + 0.05, 0.4);
        break;
      case 'cancel':
        this.tone(420, 0.06, 'triangle', now, 0.4);
        this.tone(280, 0.08, 'triangle', now + 0.05, 0.35);
        break;
      case 'hit':
        this.tone(180, 0.09, 'sawtooth', now, 0.55);
        this.tone(110, 0.1, 'square', now + 0.04, 0.45);
        break;
      case 'hit_weak':
        this.tone(135, 0.07, 'triangle', now, 0.42);
        this.tone(95, 0.08, 'sine', now + 0.03, 0.35);
        break;
      case 'super':
        this.tone(320, 0.08, 'sawtooth', now, 0.55);
        this.tone(520, 0.08, 'square', now + 0.05, 0.55);
        this.tone(820, 0.14, 'square', now + 0.1, 0.55);
        this.tone(1040, 0.12, 'triangle', now + 0.14, 0.4);
        break;
      case 'crit':
        this.tone(240, 0.06, 'sawtooth', now, 0.6);
        this.tone(680, 0.07, 'square', now + 0.03, 0.6);
        this.tone(980, 0.12, 'square', now + 0.08, 0.55);
        break;
      case 'low_hp':
        this.tone(740, 0.08, 'square', now, 0.25);
        this.tone(587, 0.09, 'square', now + 0.1, 0.22);
        break;
      case 'victory_fanfare':
        this.tone(523, 0.09, 'square', now, 0.45);
        this.tone(659, 0.09, 'square', now + 0.09, 0.45);
        this.tone(784, 0.09, 'square', now + 0.18, 0.48);
        this.tone(1046, 0.28, 'square', now + 0.27, 0.55);
        break;
      case 'rustle':
        this.tone(220, 0.05, 'sawtooth', now, 0.25);
        this.tone(310, 0.06, 'triangle', now + 0.05, 0.28);
        this.tone(260, 0.06, 'sawtooth', now + 0.1, 0.24);
        break;
      case 'throw':
        this.tone(360, 0.06, 'sine', now, 0.35);
        this.tone(580, 0.08, 'triangle', now + 0.05, 0.35);
        break;
      case 'levelup':
        this.tone(440, 0.08, 'square', now, 0.45);
        this.tone(554, 0.08, 'square', now + 0.08, 0.45);
        this.tone(659, 0.08, 'square', now + 0.16, 0.45);
        this.tone(880, 0.22, 'square', now + 0.24, 0.52);
        break;
      case 'capture':
        this.tone(523, 0.09, 'triangle', now, 0.5);
        this.tone(659, 0.09, 'triangle', now + 0.1, 0.5);
        this.tone(784, 0.09, 'triangle', now + 0.2, 0.5);
        this.tone(1046, 0.22, 'square', now + 0.3, 0.55);
        break;
      case 'faint':
        this.tone(380, 0.1, 'sawtooth', now, 0.45);
        this.tone(260, 0.12, 'sawtooth', now + 0.09, 0.45);
        this.tone(150, 0.2, 'triangle', now + 0.19, 0.45);
        break;
      case 'heal':
        this.tone(523, 0.1, 'sine', now, 0.5);
        this.tone(659, 0.1, 'sine', now + 0.1, 0.5);
        this.tone(784, 0.18, 'sine', now + 0.2, 0.55);
        break;
      case 'bump':
        this.tone(130, 0.06, 'triangle', now, 0.4);
        break;
    }
  }

  playCry(speciesId: number): void {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return;
    }
    const now = this.ctx.currentTime;
    const base = 260 + ((speciesId * 73) % 340);
    const wave: OscillatorType =
      speciesId % 3 === 0 ? 'triangle' : speciesId % 2 === 0 ? 'square' : 'sawtooth';
    this.tone(base, 0.09, wave, now, 0.35);
    this.tone(base * 1.32, 0.11, wave, now + 0.08, 0.38);
    this.tone(base * 0.92, 0.14, 'triangle', now + 0.17, 0.32);
  }

  playMusic(track: TrackId): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stepIndex = 0;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (track === 'none') return;

    this.nextNoteAt = this.ctx ? this.ctx.currentTime + 0.05 : 0;
    this.timerId = window.setInterval(() => this.tickMusic(), 60);
  }

  stopMusic(): void {
    this.playMusic('none');
  }

  private tickMusic(): void {
    if (
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      return;
    }
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return;
    }
    if (this.currentTrack === 'none') return;
    const track = MUSIC_TRACKS[this.currentTrack];
    const now = this.ctx.currentTime;
    if (this.nextNoteAt < now) this.nextNoteAt = now;

    while (this.nextNoteAt < now + 0.15) {
      const note = track.notes[this.stepIndex % track.notes.length];
      const durSec = (track.tempoMs * note.dur) / 1000;
      if (note.freq > 0) {
        this.tone(note.freq, durSec * 0.85, 'square', this.nextNoteAt, 0.18);
      }
      if (note.bass && note.bass > 0) {
        this.tone(note.bass, durSec * 0.9, 'triangle', this.nextNoteAt, 0.22);
      }
      this.nextNoteAt += durSec;
      this.stepIndex += 1;
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    startAt: number,
    gainPeak: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.03, dur));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startAt);
    osc.stop(startAt + Math.max(0.04, dur + 0.01));
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

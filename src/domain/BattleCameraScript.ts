export type BattleShotKind =
  | 'intro_crane'
  | 'idle'
  | 'attack_player'
  | 'attack_enemy'
  | 'crit_punch'
  | 'ko_slowmo'
  | 'victory_orbit';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  pos: Vec3Tuple;
  lookAt: Vec3Tuple;
  fov: number;
  timeScale: number;
}

export interface QueuedShot {
  kind: BattleShotKind;
  duration: number;
  cancelable: boolean;
}

export const DEFAULT_BATTLE_POSE: CameraPose = {
  pos: { x: -2.45, y: 1.88, z: 7.65 },
  lookAt: { x: 0.14, y: 0.62, z: -0.25 },
  fov: 52,
  timeScale: 1,
};

export const INTRO_CRANE_START_POSE: CameraPose = {
  pos: { x: 0.4, y: 6.1, z: 8.6 },
  lookAt: { x: 0.2, y: 1.0, z: -0.4 },
  fov: 54,
  timeScale: 1,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k) * (1 - k);
}

export class BattleCameraScript {
  private currentShot: BattleShotKind = 'idle';
  private shotElapsed = 0;
  private shotDuration = 0;
  private currentCancelable = false;
  private queue: QueuedShot[] = [];

  private idleTime = 0;
  private shakeAmp = 0;
  private shakeDecay = 7;
  private hitStopTimer = 0;
  private intensityScale = 1;

  setBossIntensity(isBoss: boolean): void {
    this.intensityScale = isBoss ? 1.3 : 1.0;
  }

  enqueueShot(kind: BattleShotKind, duration: number, cancelable = true): void {
    if (this.currentShot === 'idle' && this.queue.length === 0) {
      this.startShot({ kind, duration, cancelable });
    } else {
      this.queue.push({ kind, duration, cancelable });
    }
  }

  playImmediate(kind: BattleShotKind, duration: number, cancelable = true): void {
    this.queue.length = 0;
    this.startShot({ kind, duration, cancelable });
  }

  private startShot(shot: QueuedShot): void {
    this.currentShot = shot.kind;
    this.shotElapsed = 0;
    this.shotDuration = Math.max(0.05, shot.duration);
    this.currentCancelable = shot.cancelable;
  }

  cancelActive(): boolean {
    if (this.currentShot === 'idle' || !this.currentCancelable) {
      return false;
    }
    const next = this.queue.shift();
    if (next) {
      this.startShot(next);
    } else {
      this.currentShot = 'idle';
      this.shotElapsed = 0;
      this.shotDuration = 0;
      this.currentCancelable = false;
    }
    return true;
  }

  triggerShake(amplitude: number, decay = 7.5): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude * this.intensityScale);
    this.shakeDecay = decay;
  }

  triggerHitStop(seconds: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  isHitStopped(): boolean {
    return this.hitStopTimer > 0;
  }

  getCurrentShot(): BattleShotKind {
    return this.currentShot;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  step(dt: number, outPose: CameraPose): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    }

    this.idleTime += dt;
    if (this.shakeAmp > 0.001) {
      this.shakeAmp = Math.max(0, this.shakeAmp - this.shakeAmp * Math.min(1, this.shakeDecay * dt));
    } else {
      this.shakeAmp = 0;
    }

    if (this.currentShot !== 'idle') {
      this.shotElapsed += dt;
      if (this.currentShot !== 'victory_orbit' && this.shotElapsed >= this.shotDuration) {
        const next = this.queue.shift();
        if (next) {
          this.startShot(next);
        } else {
          this.currentShot = 'idle';
          this.shotElapsed = 0;
          this.shotDuration = 0;
          this.currentCancelable = false;
        }
      }
    }

    this.evaluatePose(outPose);
  }

  private evaluatePose(out: CameraPose): void {
    const def = DEFAULT_BATTLE_POSE;
    const progress =
      this.shotDuration > 0 ? Math.min(1, this.shotElapsed / this.shotDuration) : 0;

    out.timeScale = 1;

    switch (this.currentShot) {
      case 'intro_crane': {
        const k = easeOutCubic(progress);
        out.pos.x = lerp(INTRO_CRANE_START_POSE.pos.x, def.pos.x, k);
        out.pos.y = lerp(INTRO_CRANE_START_POSE.pos.y, def.pos.y, k);
        out.pos.z = lerp(INTRO_CRANE_START_POSE.pos.z, def.pos.z, k);
        out.lookAt.x = lerp(INTRO_CRANE_START_POSE.lookAt.x, def.lookAt.x, k);
        out.lookAt.y = lerp(INTRO_CRANE_START_POSE.lookAt.y, def.lookAt.y, k);
        out.lookAt.z = lerp(INTRO_CRANE_START_POSE.lookAt.z, def.lookAt.z, k);
        out.fov = lerp(INTRO_CRANE_START_POSE.fov, def.fov, k);
        break;
      }

      case 'attack_player': {
        const k = Math.sin(progress * Math.PI);
        out.pos.x = def.pos.x + 1.15 * k * this.intensityScale;
        out.pos.y = def.pos.y - 0.12 * k;
        out.pos.z = def.pos.z - 0.9 * k * this.intensityScale;
        out.lookAt.x = def.lookAt.x + 0.55 * k;
        out.lookAt.y = def.lookAt.y + 0.08 * k;
        out.lookAt.z = def.lookAt.z - 0.35 * k;
        out.fov = def.fov - 3.5 * k;
        break;
      }

      case 'attack_enemy': {
        const k = Math.sin(progress * Math.PI);
        out.pos.x = def.pos.x + 1.75 * k * this.intensityScale;
        out.pos.y = def.pos.y + 0.35 * k;
        out.pos.z = def.pos.z - 1.2 * k * this.intensityScale;
        out.lookAt.x = def.lookAt.x + 0.8 * k;
        out.lookAt.y = def.lookAt.y + 0.1 * k;
        out.lookAt.z = def.lookAt.z - 0.6 * k;
        out.fov = def.fov - 4.0 * k;
        break;
      }

      case 'crit_punch': {
        const k = Math.sin(progress * Math.PI);
        out.pos.x = def.pos.x + 0.6 * k;
        out.pos.y = def.pos.y;
        out.pos.z = def.pos.z - 0.85 * k;
        out.lookAt.x = def.lookAt.x + 0.25 * k;
        out.lookAt.y = def.lookAt.y;
        out.lookAt.z = def.lookAt.z;
        out.fov = def.fov - 9 * k * this.intensityScale;
        break;
      }

      case 'ko_slowmo': {
        const k = easeOutCubic(progress);
        out.pos.x = lerp(def.pos.x, def.pos.x + 1.1, k);
        out.pos.y = lerp(def.pos.y, def.pos.y + 0.25, k);
        out.pos.z = lerp(def.pos.z, def.pos.z - 1.35, k);
        out.lookAt.x = lerp(def.lookAt.x, 0.9, k);
        out.lookAt.y = lerp(def.lookAt.y, 1.35, k);
        out.lookAt.z = lerp(def.lookAt.z, -1.1, k);
        out.fov = lerp(def.fov, 40, k);
        out.timeScale = 0.42;
        break;
      }

      case 'victory_orbit': {
        const angle = this.shotElapsed * 0.65;
        const playerX = -2.15;
        const playerZ = 2.0;
        const radius = 3.8;
        out.pos.x = playerX + Math.sin(angle - 0.45) * radius;
        out.pos.y = 1.65 + Math.sin(this.shotElapsed * 1.1) * 0.15;
        out.pos.z = playerZ + Math.cos(angle - 0.45) * radius;
        out.lookAt.x = playerX;
        out.lookAt.y = 1.05;
        out.lookAt.z = playerZ;
        out.fov = 46;
        break;
      }

      case 'idle':
      default: {
        const swayX = Math.sin(this.idleTime * 0.9) * 0.12;
        const swayY = Math.cos(this.idleTime * 1.3) * 0.05;
        out.pos.x = def.pos.x + swayX;
        out.pos.y = def.pos.y + swayY;
        out.pos.z = def.pos.z;
        out.lookAt.x = def.lookAt.x + swayX * 0.35;
        out.lookAt.y = def.lookAt.y;
        out.lookAt.z = def.lookAt.z;
        out.fov = def.fov;
        break;
      }
    }

    if (this.shakeAmp > 0.001) {
      const sx = Math.sin(this.idleTime * 57) * this.shakeAmp;
      const sy = Math.cos(this.idleTime * 71) * this.shakeAmp * 0.7;
      out.pos.x += sx;
      out.pos.y += sy;
      out.lookAt.x += sx * 0.4;
      out.lookAt.y += sy * 0.4;
    }
  }
}

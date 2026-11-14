import type { TrainerDef } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import type { CharacterRole } from '../domain/types.ts';

export class BattleTransition {
  readonly fxRoot: HTMLDivElement;
  readonly transitionRoot: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private vignetteEl: HTMLDivElement;
  private wipeEl: HTMLDivElement;
  private vsBannerEl: HTMLDivElement;
  private flashTimer: number | null = null;
  private seqTimers: number[] = [];

  constructor(parent: HTMLElement) {
    this.fxRoot = document.createElement('div');
    this.fxRoot.className = 'pointer-events-none fixed inset-0 z-25 overflow-hidden hidden';

    this.vignetteEl = document.createElement('div');
    this.vignetteEl.className =
      'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300';
    this.vignetteEl.style.boxShadow = 'inset 0 0 70px rgba(194, 35, 75, 0.58)';

    this.flashEl = document.createElement('div');
    this.flashEl.className =
      'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150';

    this.fxRoot.appendChild(this.vignetteEl);
    this.fxRoot.appendChild(this.flashEl);

    this.transitionRoot = document.createElement('div');
    this.transitionRoot.className =
      'pointer-events-none fixed inset-0 z-35 overflow-hidden hidden safe-pad';

    this.wipeEl = document.createElement('div');
    this.wipeEl.className =
      'pointer-events-none absolute -inset-y-8 -inset-x-12 hidden bg-gradient-to-r from-crypt-ink via-smoked-wood to-crypt-ink border-x-4 border-resonant-gold';

    this.vsBannerEl = document.createElement('div');
    this.vsBannerEl.className =
      'pointer-events-auto absolute inset-0 hidden flex-col items-center justify-center bg-crypt-ink/75 p-4';

    this.transitionRoot.appendChild(this.wipeEl);
    this.transitionRoot.appendChild(this.vsBannerEl);

    parent.appendChild(this.fxRoot);
    parent.appendChild(this.transitionRoot);
  }

  private clearTimers(): void {
    for (const id of this.seqTimers) {
      window.clearTimeout(id);
    }
    this.seqTimers.length = 0;
  }

  flashScreen(colorCss: string, durationMs = 160): void {
    if (this.flashTimer !== null) {
      window.clearTimeout(this.flashTimer);
    }
    this.flashEl.style.backgroundColor = colorCss;
    this.flashEl.style.opacity = '1';
    this.flashTimer = window.setTimeout(() => {
      this.flashEl.style.opacity = '0';
      this.flashTimer = null;
    }, Math.max(50, durationMs));
  }

  setVignette(active: boolean, colorCss = 'rgba(194, 35, 75, 0.58)'): void {
    this.vignetteEl.style.boxShadow = `inset 0 0 75px ${colorCss}`;
    this.vignetteEl.style.opacity = active ? '1' : '0';
  }

  playPreBattle(
    assets: AssetProvider,
    trainer: TrainerDef | undefined,
    onDone: () => void
  ): void {
    this.clearTimers();
    this.fxRoot.classList.remove('hidden');
    this.transitionRoot.classList.remove('hidden');

    // Double soft flash + diagonal stripe wipe (~0.8s)
    this.flashScreen('rgba(255, 249, 240, 0.52)', 95);
    this.seqTimers.push(
      window.setTimeout(() => {
        this.flashScreen('rgba(255, 249, 240, 0.52)', 95);
      }, 170)
    );

    this.wipeEl.classList.remove('hidden', 'battle-wipe-slash');
    void this.wipeEl.offsetWidth;
    this.wipeEl.classList.add('battle-wipe-slash');

    if (!trainer) {
      this.seqTimers.push(
        window.setTimeout(() => {
          this.wipeEl.classList.add('hidden');
          onDone();
        }, 780)
      );
      return;
    }

    // Trainer / Leader VS splash
    this.seqTimers.push(
      window.setTimeout(() => {
        this.wipeEl.classList.add('hidden');
        this.showVsSplash(assets, trainer, onDone);
      }, 420)
    );
  }

  private showVsSplash(
    assets: AssetProvider,
    trainer: TrainerDef,
    onDone: () => void
  ): void {
    const isBoss = Boolean(trainer.isBoss || trainer.isRival);
    const trainerImg = assets.getCharacterDataUrl(
      trainer.role as CharacterRole,
      'down',
      trainer.id
    );
    const playerImg = assets.getCharacterDataUrl('player', 'down');
    const accent = isBoss
      ? 'border-resonant-gold from-dried-blood/95 to-dark-oak/90'
      : 'border-ki-cyan from-smoked-wood/95 to-nightshade/90';

    this.vsBannerEl.innerHTML = `
      <div class="w-full max-w-xl rounded-2xl border-2 ${accent} bg-gradient-to-r p-4 shadow-2xl battle-slide-left">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <img src="${playerImg}" alt="Jugador" class="pixel-canvas w-12 h-16 object-contain bg-crypt-ink/75 rounded-lg border border-ki-cyan/60 p-1" />
            <div class="text-left">
              <div class="text-[10px] uppercase tracking-wider text-ki-cyan font-bold">Retador</div>
              <div class="text-sm sm:text-base font-black text-warm-white">Tú</div>
            </div>
          </div>

          <div class="px-3 py-1 rounded-xl bg-resonant-gold text-crypt-ink font-black text-xl sm:text-2xl tracking-widest shadow-lg">
            VS
          </div>

          <div class="flex items-center gap-2.5 text-right">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-resonant-gold font-bold">${trainer.title}</div>
              <div class="text-sm sm:text-base font-black text-warm-white">${trainer.name}</div>
            </div>
            <img src="${trainerImg}" alt="${trainer.name}" class="pixel-canvas w-12 h-16 object-contain bg-crypt-ink/75 rounded-lg border border-resonant-gold/60 p-1" />
          </div>
        </div>
      </div>
    `;
    this.vsBannerEl.classList.remove('hidden');
    this.vsBannerEl.classList.add('flex');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.clearTimers();
      this.vsBannerEl.classList.add('hidden');
      this.vsBannerEl.classList.remove('flex');
      onDone();
    };

    this.vsBannerEl.addEventListener('pointerdown', finish, { once: true });
    this.seqTimers.push(window.setTimeout(finish, isBoss ? 1250 : 950));
  }

  hide(): void {
    this.clearTimers();
    this.setVignette(false);
    this.flashEl.style.opacity = '0';
    this.wipeEl.classList.add('hidden');
    this.vsBannerEl.classList.add('hidden');
    this.vsBannerEl.classList.remove('flex');
    this.fxRoot.classList.add('hidden');
    this.transitionRoot.classList.add('hidden');
  }

  dispose(): void {
    this.clearTimers();
    this.fxRoot.remove();
    this.transitionRoot.remove();
  }
}

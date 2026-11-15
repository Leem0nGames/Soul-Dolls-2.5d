import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';
import { bindSoulDollImageUpdates } from '../ui/bindSoulDollImages.ts';

export class GalleryScene implements Scene {
  readonly name = 'gallery';
  private emptyScene = new THREE.Scene();
  private overlay: HTMLDivElement;
  private unbindImages: (() => void) | null = null;

  constructor(private readonly game: Game) {
    this.emptyScene.background = new THREE.Color(hexToNumber(PALETTE.cryptInk));
    this.overlay = document.createElement('div');
    this.overlay.className =
      'pointer-events-auto fixed inset-0 z-30 overflow-y-auto bg-crypt-ink text-porcelain safe-pad p-4';
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: false,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.renderGallery();
    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.overlay, this.game.assets);
    this.game.uiLayer.appendChild(this.overlay);
  }

  private renderGallery(): void {
    const cards = ALL_SPECIES_IDS.map((id) => {
      const s = getSpecies(id);
      const bst =
        s.baseStats.hp +
        s.baseStats.atk +
        s.baseStats.def +
        s.baseStats.spa +
        s.baseStats.spd +
        s.baseStats.spe;
      const frontUrl = this.game.assets.getCreatureDataUrl(id, 'front');
      const backUrl = this.game.assets.getCreatureDataUrl(id, 'back');
      const badges = s.types
        .map((t) => {
          const v = TYPE_VISUALS[t];
          return `<span class="px-1.5 py-0.5 rounded-none border text-[10px] font-bold uppercase" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
        })
        .join(' ');

      return `
        <div class="px-card border-cold-stone bg-smoked-wood p-2.5 flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-bone-gray tabular-nums">#${String(id).padStart(2, '0')}</span>
            <span class="text-resonant-gold truncate">${s.name}</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 bg-crypt-ink border border-ash-purple rounded-none p-1.5">
            <div class="flex flex-col items-center">
              <img src="${frontUrl}" data-souldoll-id="${id}" data-souldoll-view="front" alt="${s.name} ${ES.gallery.front}" class="souldoll-img w-20 h-20 object-contain" />
              <span class="text-[9px] text-bone-gray">${ES.gallery.front}</span>
            </div>
            <div class="flex flex-col items-center">
              <img src="${backUrl}" data-souldoll-id="${id}" data-souldoll-view="back" alt="${s.name} ${ES.gallery.back}" class="souldoll-img w-20 h-20 object-contain" />
              <span class="text-[9px] text-bone-gray">${ES.gallery.back}</span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-1">
            <div class="flex gap-1">${badges}</div>
            <span class="text-[10px] text-bone-gray tabular-nums">${ES.gallery.bst}: ${bst}</span>
          </div>
          <div class="text-[10px] text-bone-gray">${s.archetype} · E${s.stage}</div>
        </div>
      `;
    }).join('');

    this.overlay.innerHTML = `
      <div class="max-w-6xl mx-auto">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4 border-b-2 border-ash-purple pb-3">
          <h1 class="text-base sm:text-lg font-extrabold text-resonant-gold px-text-shadow">${ES.gallery.title}</h1>
          <button data-exit class="px-btn-arcane min-h-[44px] px-4 text-xs font-bold whitespace-nowrap">${ES.gallery.backToTitle}</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-6">
          ${cards}
        </div>
      </div>
    `;

    this.overlay.querySelector('[data-exit]')?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('gallery');
      window.history.replaceState({}, '', url.toString());
      this.game.startTitle();
    });
  }

  fixedUpdate(): void {
    // Static gallery scroll view
  }

  render(): void {
    this.game.renderer.render(this.emptyScene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.unbindImages?.();
    this.unbindImages = null;
    this.overlay.remove();
  }
}

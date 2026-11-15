import type { Rng } from '../core/Rng.ts';
import { getMove } from '../data/moves.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { rollArGacha, SHARDS_PER_CONTAINER, type ArGachaReward } from '../domain/ArGacha.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { replaceCreatureMove } from '../domain/Experience.ts';
import { getItemCount, removeItem } from '../domain/Inventory.ts';
import type { CreatureInstance, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

export class ArGachaModal extends ModalOverlay {
  private stream: MediaStream | null = null;
  private scanTimer: number | null = null;
  private cameraActive = false;
  private cameraStatus = '';
  private lastReward: ArGachaReward | null = null;
  private teachTargetIdx: number | null = null;
  private notice = '';

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(
      parent,
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-abyss-ink p-3 safe-pad'
    );
  }

  open(
    save: SaveData,
    rng: Rng,
    onMutated: () => void,
    onClose: () => void
  ): void {
    this.lastReward = null;
    this.teachTargetIdx = null;
    this.notice = '';
    this.cameraStatus = '';
    this.stopCamera();

    const triggerRoll = (qrText: string) => {
      if (getItemCount(save.bag, 'fragmento_alma') <= 0) {
        this.notice = 'No te quedan Fragmentos de Alma en la mochila.';
        render();
        return;
      }
      removeItem(save.bag, 'fragmento_alma', 1);
      this.stopCamera();
      this.teachTargetIdx = null;
      this.notice = '';
      this.lastReward = rollArGacha(qrText, save, rng);
      onMutated();
      render();
    };

    const startCamera = async () => {
      this.stopCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.cameraStatus = ES.arGacha.noCamera;
        render();
        return;
      }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        this.cameraActive = true;
        this.cameraStatus = 'Escaneando código QR en realidad aumentada...';
        render();

        const video = this.root.querySelector<HTMLVideoElement>('[data-ar-video]');
        if (video) {
          video.srcObject = this.stream;
          await video.play().catch(() => {});

          const DetectorCtor = (
            window as unknown as {
              BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
            }
          ).BarcodeDetector;
          if (DetectorCtor) {
            const detector = new DetectorCtor({ formats: ['qr_code'] });
            this.scanTimer = window.setInterval(async () => {
              if (!this.cameraActive || video.readyState < 2) return;
              try {
                const hits = await detector.detect(video);
                const code = hits[0]?.rawValue?.trim();
                if (code) {
                  triggerRoll(code);
                }
              } catch {
                // Ignore frame decode hiccups
              }
            }, 450);
          } else {
            this.cameraStatus =
              'Cámara AR activa. Tu navegador no soporta auto-QR: pulsa "Invocar con QR" para capturar el haz AR.';
            const statusEl = this.root.querySelector('[data-cam-status]');
            if (statusEl) statusEl.textContent = this.cameraStatus;
          }
        }
      } catch {
        this.cameraActive = false;
        this.cameraStatus = ES.arGacha.noCamera;
        render();
      }
    };

    const renderReward = (reward: ArGachaReward): string => {
      if (reward.kind === 'item') {
        return `
          <div class="px-card border-resonant-gold p-3 flex items-center gap-3">
            <img src="${this.assets.getItemIconDataUrl(reward.itemId)}" class="pixel-canvas w-10 h-10 object-contain shrink-0" alt="" />
            <div class="min-w-0">
              <div class="text-xs font-bold uppercase tracking-wider text-ki-cyan">Objeto Invocado</div>
              <div class="font-bold text-sm text-resonant-gold">${reward.name} <span class="tabular-nums">×${reward.quantity}</span></div>
              <div class="text-xs text-bone-gray">${reward.description}</div>
            </div>
          </div>
        `;
      }

      if (reward.kind === 'body_part') {
        const pct = Math.min(
          100,
          Math.round((reward.currentShards / SHARDS_PER_CONTAINER) * 100)
        );
        return `
          <div class="px-card border-ki-cyan p-3 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-xs font-bold uppercase tracking-wider text-ki-cyan">Parte de Cuerpo Contenedor</div>
                <div class="font-bold text-sm text-porcelain">${reward.containerName} <span class="text-neon-mint tabular-nums">+${reward.shardsAdded} pieza(s)</span></div>
              </div>
              <span class="text-xs font-bold text-resonant-gold tabular-nums">${reward.currentShards}/${SHARDS_PER_CONTAINER}</span>
            </div>
            <div class="h-2.5 w-full rounded-none bg-ui-ink overflow-hidden border border-ash-purple">
              <div class="h-full bg-ki-cyan" style="width:${reward.assembledCount > 0 && reward.currentShards === 0 ? 100 : pct}%"></div>
            </div>
            ${
              reward.assembledCount > 0
                ? `<div class="rounded-none bg-deep-abyss border-2 border-emerald-base px-2.5 py-1.5 text-xs font-bold text-neon-mint">¡Juntaste ${SHARDS_PER_CONTAINER} piezas! Cuerpo completo añadido a Contenedores.</div>`
                : `<div class="text-xs text-bone-gray">Reúne ${SHARDS_PER_CONTAINER} piezas iguales para forjar el Cuerpo Contenedor completo.</div>`
            }
          </div>
        `;
      }

      // kind === 'power'
      const move = getMove(reward.moveId);
      const vis = TYPE_VISUALS[move.type];
      const teachPicker =
        this.teachTargetIdx !== null && save.party[this.teachTargetIdx]
          ? (() => {
              const target = save.party[this.teachTargetIdx]!;
              const slots = target.moves
                .map((s, idx) => {
                  const m = getMove(s.moveId);
                  return `<button data-replace-move="${idx}" class="px-btn-secondary min-h-[44px] w-full hover:bg-blood-moon px-3 py-1.5 text-left flex justify-between items-center text-xs"><span class="font-bold">${m.name}</span><span class="text-bone-gray tabular-nums">${ES.types[m.type]}</span></button>`;
                })
                .join('');
              return `
                <div class="mt-2 rounded-none border-2 border-resonant-gold bg-smoked-wood p-2.5 space-y-1.5">
                  <div class="text-xs font-bold text-resonant-gold">${ES.battle.wantsToLearn(getCreatureDisplayName(target), move.name)}</div>
                  ${slots}
                  <button data-replace-cancel class="px-btn-secondary min-h-[44px] w-full text-xs font-bold">${ES.battle.skipMove}</button>
                </div>
              `;
            })()
          : save.party.length === 0
            ? `<div class="text-xs text-bone-gray mt-2">Necesitas una SoulDoll en tu equipo para enseñar este poder.</div>`
            : `
              <div class="mt-2 space-y-1.5">
                <div class="text-xs font-bold text-porcelain">${ES.arGacha.teachTitle}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  ${save.party
                    .map((doll: CreatureInstance, idx: number) => {
                      const knows = doll.moves.some((m) => m.moveId === move.id);
                      return `
                        <button data-teach="${idx}" ${knows ? 'disabled' : ''} class="px-card min-h-[44px] bg-smoked-wood hover:border-resonant-gold px-2.5 py-1.5 flex items-center gap-2 text-left ${knows ? 'opacity-50 cursor-not-allowed' : ''}">
                          <img src="${this.assets.getCreatureDataUrl(doll.speciesId, 'front')}" data-souldoll-id="${doll.speciesId}" data-souldoll-view="front" class="souldoll-img w-9 h-9 object-contain shrink-0" alt="" />
                          <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold truncate">${getCreatureDisplayName(doll)}</div>
                            <div class="text-[11px] text-bone-gray tabular-nums">${knows ? 'Ya aprendido' : `Nv.${doll.level} · ${doll.moves.length}/4 mov.`}</div>
                          </div>
                        </button>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            `;

      return `
        <div class="px-card border-soul-violet p-3 space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-bold uppercase tracking-wider text-ghost-violet">Poder de Ki Desbloqueado</div>
            <span class="px-2 py-0.5 rounded-none border text-[10px] font-bold" style="background:${vis.bg};color:${vis.color};border-color:${vis.border}">${ES.types[move.type]}</span>
          </div>
          <div class="font-bold text-sm text-resonant-gold">${move.name}</div>
          <div class="text-xs text-bone-gray">${reward.description}</div>
          ${teachPicker}
        </div>
      `;
    };

    const render = () => {
      const remaining = getItemCount(save.bag, 'fragmento_alma');
      this.root.innerHTML = `
        <div class="px-panel-violet w-full max-w-lg max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-3.5 sm:p-4 text-porcelain space-y-3">
          <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2">
            <div>
              <div class="font-bold text-resonant-gold">${ES.arGacha.title}</div>
              <div class="text-xs text-ki-cyan tabular-nums">Fragmentos disponibles: ${remaining}</div>
            </div>
            <button data-close class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.arGacha.close}</button>
          </div>

          <p class="text-xs text-bone-gray">${ES.arGacha.subtitle}</p>

          ${
            this.cameraActive
              ? `<div class="relative rounded-none overflow-hidden border-2 border-ki-cyan bg-abyss-ink aspect-video flex items-center justify-center">
                   <video data-ar-video autoplay playsinline muted class="w-full h-full object-cover"></video>
                   <div class="pointer-events-none absolute inset-6 border-2 border-dashed border-resonant-gold rounded-none"></div>
                 </div>`
              : `<div class="px-card p-3 flex flex-col items-center gap-2 text-center">
                   <div class="text-xs text-ghost-violet font-bold">Visor AR listo para vincular códigos QR del mundo real</div>
                   <button data-start-cam ${remaining <= 0 ? 'disabled' : ''} class="min-h-[44px] px-4 text-xs font-bold whitespace-nowrap ${
                     remaining <= 0
                       ? 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                       : 'px-btn-arcane'
                   }">${ES.arGacha.scanButton}</button>
                 </div>`
          }

          ${
            this.cameraStatus
              ? `<div data-cam-status class="text-xs text-ki-cyan">${this.cameraStatus}</div>`
              : ''
          }
          ${
            this.notice
              ? `<div class="rounded-none bg-deep-abyss border-2 border-ki-cyan px-3 py-2 text-xs font-bold text-frosted-glass">${this.notice}</div>`
              : ''
          }

          <div class="flex flex-col sm:flex-row gap-2">
            <input data-qr-input type="text" placeholder="${ES.arGacha.manualPlaceholder}" class="flex-1 min-h-[44px] rounded-none border-2 border-cold-stone bg-crypt-ink px-3 text-sm text-porcelain placeholder:text-bone-gray" />
            <button data-roll-qr ${remaining <= 0 ? 'disabled' : ''} class="min-h-[44px] px-4 text-xs font-bold shrink-0 whitespace-nowrap ${
              remaining <= 0
                ? 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                : 'rounded-none border-2 border-ethereal-orchid bg-soul-violet hover:bg-royal-purple text-warm-white shadow-[2px_2px_0_#050505]'
            }">${ES.arGacha.rollButton}</button>
          </div>

          <button data-roll-sim ${remaining <= 0 ? 'disabled' : ''} class="min-h-[44px] w-full text-xs font-bold whitespace-nowrap ${
            remaining <= 0
              ? 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
              : 'px-btn-primary'
          }">${ES.arGacha.simButton}</button>

          ${this.lastReward ? renderReward(this.lastReward) : ''}
        </div>
      `;

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelector('[data-start-cam]')?.addEventListener('click', () => {
        void startCamera();
      });

      this.root.querySelector('[data-roll-qr]')?.addEventListener('click', () => {
        const input = this.root.querySelector<HTMLInputElement>('[data-qr-input]');
        const val = input?.value.trim() || `QR-${Date.now()}`;
        triggerRoll(val);
      });

      this.root.querySelector('[data-roll-sim]')?.addEventListener('click', () => {
        triggerRoll(`AR-SIM-${Math.floor(rng.next() * 1e9)}`);
      });

      this.root.querySelectorAll<HTMLElement>('[data-teach]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!this.lastReward || this.lastReward.kind !== 'power') return;
          const idx = Number(btn.dataset.teach);
          const doll = save.party[idx];
          if (!doll) return;
          const move = getMove(this.lastReward.moveId);
          if (doll.moves.some((m) => m.moveId === move.id)) {
            this.notice = ES.arGacha.alreadyKnows(getCreatureDisplayName(doll), move.name);
            render();
            return;
          }
          if (doll.moves.length < 4) {
            doll.moves.push({ moveId: move.id, pp: move.pp, maxPp: move.pp });
            this.notice = ES.arGacha.learnedPower(getCreatureDisplayName(doll), move.name);
            this.lastReward = null;
            onMutated();
            render();
          } else {
            this.teachTargetIdx = idx;
            render();
          }
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-replace-move]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (
            this.teachTargetIdx === null ||
            !this.lastReward ||
            this.lastReward.kind !== 'power'
          ) {
            return;
          }
          const doll = save.party[this.teachTargetIdx];
          if (!doll) return;
          const slotIdx = Number(btn.dataset.replaceMove);
          const move = getMove(this.lastReward.moveId);
          replaceCreatureMove(doll, slotIdx, move.id);
          this.notice = ES.arGacha.learnedPower(getCreatureDisplayName(doll), move.name);
          this.teachTargetIdx = null;
          this.lastReward = null;
          onMutated();
          render();
        });
      });

      this.root.querySelector('[data-replace-cancel]')?.addEventListener('click', () => {
        this.teachTargetIdx = null;
        render();
      });
    };

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }

  protected override onBeforeClose(): void {
    this.stopCamera();
  }

  private stopCamera(): void {
    this.cameraActive = false;
    if (this.scanTimer !== null) {
      window.clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}

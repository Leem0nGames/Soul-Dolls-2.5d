import type { Rng } from '../core/Rng.ts';
import {
  ALL_CONTAINER_IDS,
  getBodyContainer,
  SHARDS_PER_CONTAINER,
} from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import {
  addVessel,
  consumeVessel,
  ensureSaveVesselState,
  rebindCreatureContainer,
} from '../domain/BodyParts.ts';
import { createCreature, getCreatureDisplayName } from '../domain/Creature.ts';
import {
  ALL_BLUEPRINT_IDS,
  craftContainerFromBlueprint,
  ensureSaveSideQuestState,
  getBlueprint,
} from '../domain/SideQuests.ts';
import { addCapturedCreature } from '../domain/Storage.ts';
import type { SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';

type VesselTab = 'reserve' | 'containers' | 'shards';

export class VesselScreen extends ModalOverlay {
  private tab: VesselTab = 'reserve';
  private notice = '';
  private bindingSoulUid: string | null = null;
  private equippingContainerId: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(parent);
  }

  open(
    save: SaveData,
    rng: Rng,
    onMutated: () => void,
    onClose: () => void,
    onCraftSfx?: () => void
  ): void {
    ensureSaveVesselState(save);
    ensureSaveSideQuestState(save);
    this.notice = '';
    this.bindingSoulUid = null;
    this.equippingContainerId = null;

    const render = () => {
      ensureSaveVesselState(save);
      ensureSaveSideQuestState(save);
      const reserve = save.soulReserve ?? [];
      const vessels = save.vessels ?? {};
      const shards = save.bodyPartShards ?? {};
      const ownedBlueprints = (save.blueprints ?? []).filter((id) =>
        ALL_BLUEPRINT_IDS.includes(id)
      );

      const ownedVesselIds = ALL_CONTAINER_IDS.filter((id) => (vessels[id] ?? 0) > 0);
      const shardIds = ALL_CONTAINER_IDS.filter((id) => (shards[id] ?? 0) > 0);

      let bodyHtml = '';

      if (this.bindingSoulUid) {
        const soul = reserve.find((s) => s.uid === this.bindingSoulUid);
        const spec = soul ? getSpecies(soul.speciesId) : null;
        if (!soul || !spec) {
          this.bindingSoulUid = null;
        } else {
          bodyHtml = `
            <div class="px-card border-resonant-gold p-3 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-resonant-gold">Elige Cuerpo Contenedor para ${spec.name} (Nv.${soul.level}):</span>
                <button data-cancel-sub class="px-btn-secondary min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.vessels.back}</button>
              </div>
              ${
                ownedVesselIds.length === 0
                  ? `<div class="text-xs text-bone-gray">${ES.vessels.noContainers}</div>`
                  : `<div class="space-y-1.5">${ownedVesselIds
                      .map((cid) => {
                        const cdef = getBodyContainer(cid);
                        return `
                          <button data-confirm-bind="${cid}" class="px-card w-full min-h-[48px] bg-smoked-wood hover:border-ki-cyan p-2 text-left flex items-center justify-between gap-2">
                            <div>
                              <div class="text-xs font-bold text-porcelain">${cdef.name} <span class="text-resonant-gold tabular-nums">×${vessels[cid]}</span></div>
                              <div class="text-[11px] text-bone-gray tabular-nums">Cab ${cdef.ratios.head}% · Tor ${cdef.ratios.torso}% · Bra ${cdef.ratios.arms}% · Pie ${cdef.ratios.legs}%</div>
                            </div>
                            <span class="px-btn-success px-2.5 py-1 text-xs font-bold shrink-0">Vincular</span>
                          </button>
                        `;
                      })
                      .join('')}</div>`
              }
            </div>
          `;
        }
      } else if (this.equippingContainerId) {
        const cdef = getBodyContainer(this.equippingContainerId);
        bodyHtml = `
          <div class="px-card border-ki-cyan p-3 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-ki-cyan">Equipar ${cdef.name} a una SoulDoll del equipo:</span>
              <button data-cancel-sub class="px-btn-secondary min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.vessels.back}</button>
            </div>
            <div class="space-y-1.5">
              ${save.party
                .map((doll, idx) => {
                  const cur = getBodyContainer(doll.containerId ?? 'cuerpo_aprendiz');
                  return `
                    <button data-confirm-equip="${idx}" class="px-card w-full min-h-[48px] bg-smoked-wood hover:border-resonant-gold p-2 flex items-center gap-2.5 text-left">
                      <img src="${this.assets.getCreatureDataUrl(doll.speciesId, 'front')}" data-souldoll-id="${doll.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="" />
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold truncate">${getCreatureDisplayName(doll)}</div>
                        <div class="text-[11px] text-bone-gray">Actual: ${cur.name}</div>
                      </div>
                      <span class="px-btn-arcane px-2.5 py-1 text-xs font-bold shrink-0">Intercambiar</span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      } else if (this.tab === 'reserve') {
        bodyHtml =
          reserve.length === 0
            ? `<div class="py-8 text-center text-xs text-bone-gray">${ES.vessels.noSouls}</div>`
            : reserve
                .map((soul) => {
                  const spec = getSpecies(soul.speciesId);
                  return `
                    <div class="px-card flex items-center justify-between gap-2 p-2.5">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${this.assets.getCreatureDataUrl(soul.speciesId, 'front')}" data-souldoll-id="${soul.speciesId}" data-souldoll-view="front" class="souldoll-img w-12 h-12 object-contain shrink-0" alt="" />
                        <div class="min-w-0">
                          <div class="text-sm font-bold text-porcelain truncate">Alma de ${spec.name}</div>
                          <div class="text-xs text-bone-gray tabular-nums">${ES.party.lv}${soul.level} · Esperando cuerpo</div>
                        </div>
                      </div>
                      <button data-bind-soul="${soul.uid}" ${ownedVesselIds.length === 0 ? 'disabled' : ''} class="min-h-[44px] px-3 text-xs font-bold shrink-0 whitespace-nowrap ${
                        ownedVesselIds.length > 0
                          ? 'px-btn-success'
                          : 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                      }">${ES.vessels.bindSoul}</button>
                    </div>
                  `;
                })
                .join('');
      } else if (this.tab === 'containers') {
        bodyHtml =
          ownedVesselIds.length === 0
            ? `<div class="py-8 text-center text-xs text-bone-gray">${ES.vessels.noContainers}</div>`
            : ownedVesselIds
                .map((cid) => {
                  const def = getBodyContainer(cid);
                  return `
                    <div class="px-card flex items-center justify-between gap-2 p-2.5">
                      <div class="min-w-0">
                        <div class="text-sm font-bold text-porcelain">${def.name} <span class="text-resonant-gold tabular-nums">×${vessels[cid]}</span></div>
                        <div class="text-xs text-bone-gray">${def.description}</div>
                        <div class="text-[11px] text-ki-cyan tabular-nums mt-0.5">Cab ${def.ratios.head}% · Tor ${def.ratios.torso}% · Bra ${def.ratios.arms}% · Pie ${def.ratios.legs}%</div>
                      </div>
                      <button data-equip-container="${cid}" ${save.party.length === 0 ? 'disabled' : ''} class="min-h-[44px] px-3 text-xs font-bold shrink-0 whitespace-nowrap ${
                        save.party.length === 0
                          ? 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                          : 'px-btn-arcane'
                      }">Equipar</button>
                    </div>
                  `;
                })
                .join('');
      } else {
        const blueprintsHtml =
          ownedBlueprints.length === 0
            ? `<div class="px-card p-3 text-xs text-bone-gray">Aún no tienes Planos de crafteo. Completa misiones secundarias (NPCs con <span class="text-resonant-gold font-bold">!</span>) para conseguirlos.</div>`
            : ownedBlueprints
                .map((bpId) => {
                  const bp = getBlueprint(bpId);
                  const cdef = getBodyContainer(bp.containerId);
                  const canAfford = save.money >= bp.craftGoldCost;
                  return `
                    <div class="px-card border-resonant-gold p-2.5 flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-pale-gold">${bp.name}</div>
                        <div class="text-[11px] text-porcelain">${cdef.name} · Cab ${cdef.ratios.head}% Tor ${cdef.ratios.torso}% Bra ${cdef.ratios.arms}% Pie ${cdef.ratios.legs}%</div>
                        <div class="text-[11px] text-bone-gray">${bp.description}</div>
                      </div>
                      <button data-craft-bp="${bp.id}" ${canAfford ? '' : 'disabled'} class="min-h-[44px] px-3 text-xs font-bold shrink-0 whitespace-nowrap tabular-nums ${
                        canAfford
                          ? 'px-btn-primary'
                          : 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                      }">Forjar (${bp.craftGoldCost} ◈)</button>
                    </div>
                  `;
                })
                .join('');

        const shardsHtml =
          shardIds.length === 0
            ? `<div class="py-4 text-center text-xs text-bone-gray">${ES.vessels.noShards}</div>`
            : shardIds
                .map((cid) => {
                  const def = getBodyContainer(cid);
                  const count = shards[cid] ?? 0;
                  const pct = Math.min(100, Math.round((count / SHARDS_PER_CONTAINER) * 100));
                  return `
                    <div class="px-card p-2.5 space-y-1.5">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-porcelain">${def.name}</span>
                        <span class="font-bold text-resonant-gold tabular-nums">${count} / ${SHARDS_PER_CONTAINER}</span>
                      </div>
                      <div class="h-2.5 w-full rounded-none border border-ash-purple bg-ui-ink overflow-hidden">
                        <div class="h-full bg-ki-cyan" style="width:${pct}%"></div>
                      </div>
                    </div>
                  `;
                })
                .join('');

        bodyHtml = `
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-resonant-gold">
              <span>Planos de crafteo (${ownedBlueprints.length}/${ALL_BLUEPRINT_IDS.length})</span>
              <span class="text-pale-gold tabular-nums">Oro: ${save.money} ◈</span>
            </div>
            ${blueprintsHtml}
            <div class="pt-1 text-[11px] font-bold uppercase tracking-wider text-ki-cyan">
              Piezas de Armazón (${shardIds.length})
            </div>
            ${shardsHtml}
          </div>
        `;
      }

      const tabs: Array<{ id: VesselTab; label: string }> = [
        { id: 'reserve', label: `${ES.vessels.reserveTab} (${reserve.length})` },
        { id: 'containers', label: `${ES.vessels.containersTab} (${ownedVesselIds.length})` },
        { id: 'shards', label: `${ES.vessels.shardsTab} (${shardIds.length + ownedBlueprints.length})` },
      ];

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-xl max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-4 text-porcelain">
          <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3">
            <span class="font-bold text-resonant-gold">${ES.vessels.title}</span>
            <button data-close class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.vessels.back}</button>
          </div>

          <div class="grid grid-cols-3 gap-1.5 mb-3">
            ${tabs
              .map((t) => {
                const active = this.tab === t.id && !this.bindingSoulUid && !this.equippingContainerId;
                return `<button data-vtab="${t.id}" class="min-h-[44px] px-2 text-xs font-bold whitespace-nowrap ${
                  active ? 'px-btn-primary' : 'px-btn-secondary'
                }">${t.label}</button>`;
              })
              .join('')}
          </div>

          ${this.notice ? `<div class="mb-2 rounded-none bg-deep-abyss border-2 border-ki-cyan px-3 py-1.5 text-xs font-bold text-frosted-glass">${this.notice}</div>` : ''}

          <div class="touch-scroll overflow-y-auto space-y-2">${bodyHtml}</div>
        </div>
      `;

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelectorAll<HTMLElement>('[data-vtab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.tab = btn.dataset.vtab as VesselTab;
          this.bindingSoulUid = null;
          this.equippingContainerId = null;
          this.notice = '';
          render();
        });
      });

      this.root.querySelector('[data-cancel-sub]')?.addEventListener('click', () => {
        this.bindingSoulUid = null;
        this.equippingContainerId = null;
        render();
      });

      this.root.querySelectorAll<HTMLElement>('[data-bind-soul]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.bindingSoulUid = btn.dataset.bindSoul!;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-confirm-bind]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.confirmBind!;
          const idx = (save.soulReserve ?? []).findIndex((s) => s.uid === this.bindingSoulUid);
          if (idx === -1 || !consumeVessel(save, cid)) return;
          const soul = save.soulReserve!.splice(idx, 1)[0];
          const doll = createCreature(soul.speciesId, soul.level, rng, cid);
          const dest = addCapturedCreature(save.party, save.storageBoxes, doll);
          if (dest.destination === 'none') {
            // Rollback if party and all storage boxes are full
            save.soulReserve!.splice(idx, 0, soul);
            addVessel(save, cid, 1);
            this.notice = ES.storage.storageFull;
          } else {
            this.notice = ES.vessels.boundSuccess(getCreatureDisplayName(doll), getBodyContainer(cid).name);
            onMutated();
          }
          this.bindingSoulUid = null;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-equip-container]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.equippingContainerId = btn.dataset.equipContainer!;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-confirm-equip]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pIdx = Number(btn.dataset.confirmEquip);
          const doll = save.party[pIdx];
          const newCid = this.equippingContainerId;
          if (!doll || !newCid || !consumeVessel(save, newCid)) return;
          const oldCid = doll.containerId ?? 'cuerpo_aprendiz';
          addVessel(save, oldCid, 1);
          rebindCreatureContainer(doll, newCid);
          this.notice = ES.vessels.reboundSuccess(
            getCreatureDisplayName(doll),
            getBodyContainer(newCid).name
          );
          this.equippingContainerId = null;
          onMutated();
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-craft-bp]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const bpId = btn.dataset.craftBp!;
          const result = craftContainerFromBlueprint(save, bpId);
          if (result.ok && result.containerName) {
            this.notice = `¡Forjaste 1× ${result.containerName}! Disponible en Cuerpos Completos.`;
            onCraftSfx?.();
            onMutated();
          } else if (result.reason === 'no_money') {
            this.notice = ES.shop.noMoney;
          }
          render();
        });
      });
    };

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }
}

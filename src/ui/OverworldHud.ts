import { MAPS } from '../data/maps/index.ts';
import {
  clampQuestIndex,
  computeQuestArrowAngleDeg,
  getActiveQuest,
  MAIN_QUESTS,
  resolveQuestNavTarget,
  type QuestNavTarget,
} from '../domain/Quests.ts';
import { SIDE_QUESTS } from '../domain/SideQuests.ts';
import type { StaminaState } from '../domain/Stamina.ts';
import type { MapDef } from '../domain/types.ts';
import { ES } from '../i18n/es.ts';
import type { UiLayerManager } from './UiLayerManager.ts';

export interface OverworldHudCallbacks {
  onToggleQuest: () => void;
  onOpenJournal: () => void;
}

export class OverworldHud {
  private readonly leftHudStack: HTMLDivElement;
  private readonly hudLocationEl: HTMLDivElement;
  private readonly staminaLabelEl: HTMLSpanElement;
  private readonly staminaFillEl: HTMLDivElement;
  private lastStaminaPct = -1;
  private lastStaminaTone = '';

  private readonly questToggleBtn: HTMLButtonElement;
  private readonly questArrowSvgEl: SVGSVGElement;
  private readonly questStepLabelEl: HTMLDivElement;
  private readonly questTitleEl: HTMLDivElement;
  private readonly questDistHeaderEl: HTMLSpanElement;
  private readonly questChevronEl: HTMLSpanElement;
  private readonly questBodyEl: HTMLDivElement;
  private readonly questObjectiveEl: HTMLDivElement;
  private readonly questTargetEl: HTMLSpanElement;
  private readonly questDistBodyEl: HTMLSpanElement;
  private readonly questJournalBadgeEl: HTMLSpanElement;

  private questCollapsed = false;
  private lastArrowAngle = -999;
  private lastQuestDistance = -1;

  private readonly warpCurtain: HTMLDivElement;
  private readonly zoneBanner: HTMLDivElement;
  private zoneBannerTimer = 0;

  constructor(callbacks: OverworldHudCallbacks) {
    this.leftHudStack = document.createElement('div');
    this.leftHudStack.className =
      'pointer-events-none fixed top-2.5 left-3 z-20 flex flex-col items-start gap-1.5 w-[212px] sm:w-[244px] max-w-[62vw]';
    this.leftHudStack.style.top = 'calc(0.625rem + env(safe-area-inset-top, 0px))';
    this.leftHudStack.style.left = 'calc(0.75rem + env(safe-area-inset-left, 0px))';

    const hudBadge = document.createElement('div');
    hudBadge.className =
      'pointer-events-none w-full rounded-none border-2 border-cold-stone bg-crypt-ink px-2.5 py-1.5 text-xs font-bold text-porcelain shadow-[2px_2px_0_#050505]';

    this.hudLocationEl = document.createElement('div');
    this.hudLocationEl.className = 'truncate';
    hudBadge.appendChild(this.hudLocationEl);

    const staminaWrap = document.createElement('div');
    staminaWrap.className = 'mt-1.5 pt-1 border-t border-ash-purple';

    const staminaHeader = document.createElement('div');
    staminaHeader.className =
      'flex items-center justify-between gap-2 text-[10px] font-bold tracking-wider uppercase mb-1';

    const staminaTitle = document.createElement('span');
    staminaTitle.className = 'text-bone-gray';
    staminaTitle.textContent = 'Estamina';

    this.staminaLabelEl = document.createElement('span');
    this.staminaLabelEl.className = 'text-ki-cyan tabular-nums';
    this.staminaLabelEl.textContent = '100%';

    staminaHeader.appendChild(staminaTitle);
    staminaHeader.appendChild(this.staminaLabelEl);

    const staminaTrack = document.createElement('div');
    staminaTrack.className =
      'w-full h-2.5 rounded-none border border-ash-purple bg-abyss-ink p-[1px]';
    staminaTrack.setAttribute('role', 'progressbar');
    staminaTrack.setAttribute('aria-label', 'Estamina');
    staminaTrack.setAttribute('aria-valuemin', '0');
    staminaTrack.setAttribute('aria-valuemax', '100');

    this.staminaFillEl = document.createElement('div');
    this.staminaFillEl.className = 'h-full bg-ki-cyan';
    this.staminaFillEl.style.width = '100%';

    staminaTrack.appendChild(this.staminaFillEl);
    staminaWrap.appendChild(staminaHeader);
    staminaWrap.appendChild(staminaTrack);
    hudBadge.appendChild(staminaWrap);

    const questPanel = document.createElement('div');
    questPanel.className =
      'pointer-events-auto w-full rounded-none border-2 border-cold-stone bg-crypt-ink text-porcelain shadow-[2px_2px_0_#050505]';

    this.questToggleBtn = document.createElement('button');
    this.questToggleBtn.type = 'button';
    this.questToggleBtn.setAttribute('aria-expanded', 'true');
    this.questToggleBtn.setAttribute('aria-label', 'Alternar panel de misión');
    this.questToggleBtn.className =
      'w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left rounded-none bg-crypt-ink hover:bg-smoked-wood active:bg-ash-purple cursor-pointer select-none';

    const questHeaderLeft = document.createElement('div');
    questHeaderLeft.className = 'flex items-center gap-2 min-w-0 flex-1';

    const questArrowBoxEl = document.createElement('div');
    questArrowBoxEl.className =
      'w-6 h-6 shrink-0 rounded-none border border-ash-purple bg-abyss-ink flex items-center justify-center';

    const svgNs = 'http://www.w3.org/2000/svg';
    this.questArrowSvgEl = document.createElementNS(svgNs, 'svg');
    this.questArrowSvgEl.setAttribute('viewBox', '0 0 16 16');
    this.questArrowSvgEl.setAttribute('width', '16');
    this.questArrowSvgEl.setAttribute('height', '16');
    this.questArrowSvgEl.setAttribute('shape-rendering', 'crispEdges');
    this.questArrowSvgEl.style.display = 'block';
    this.questArrowSvgEl.innerHTML =
      '<polygon points="8,1 14,9 10,9 10,15 6,15 6,9 2,9" fill="#E8B84A" stroke="#050505" stroke-width="1" />';
    questArrowBoxEl.appendChild(this.questArrowSvgEl);

    const questTitleWrap = document.createElement('div');
    questTitleWrap.className = 'min-w-0 flex-1';

    this.questStepLabelEl = document.createElement('div');
    this.questStepLabelEl.className =
      'text-[9px] font-bold tracking-widest uppercase text-resonant-gold leading-none';

    this.questTitleEl = document.createElement('div');
    this.questTitleEl.className =
      'text-[11px] font-bold text-porcelain truncate leading-tight mt-0.5';

    questTitleWrap.appendChild(this.questStepLabelEl);
    questTitleWrap.appendChild(this.questTitleEl);
    questHeaderLeft.appendChild(questArrowBoxEl);
    questHeaderLeft.appendChild(questTitleWrap);

    const questHeaderRight = document.createElement('div');
    questHeaderRight.className = 'flex items-center gap-1.5 shrink-0';

    this.questDistHeaderEl = document.createElement('span');
    this.questDistHeaderEl.className = 'text-[10px] font-bold text-ki-cyan tabular-nums';

    this.questChevronEl = document.createElement('span');
    this.questChevronEl.className = 'text-[10px] font-bold text-bone-gray';
    this.questChevronEl.textContent = '▼';

    questHeaderRight.appendChild(this.questDistHeaderEl);
    questHeaderRight.appendChild(this.questChevronEl);

    this.questToggleBtn.appendChild(questHeaderLeft);
    this.questToggleBtn.appendChild(questHeaderRight);
    this.questToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleQuestCollapsed();
      callbacks.onToggleQuest();
    });

    this.questBodyEl = document.createElement('div');
    this.questBodyEl.className = 'px-2.5 pb-2 pt-1.5 border-t border-ash-purple';

    this.questObjectiveEl = document.createElement('div');
    this.questObjectiveEl.className = 'text-[11px] leading-snug text-porcelain';

    const questMetaRow = document.createElement('div');
    questMetaRow.className =
      'mt-1.5 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider';

    this.questTargetEl = document.createElement('span');
    this.questTargetEl.className = 'text-ice-cyan truncate';

    this.questDistBodyEl = document.createElement('span');
    this.questDistBodyEl.className = 'text-bone-gray tabular-nums shrink-0';

    questMetaRow.appendChild(this.questTargetEl);
    questMetaRow.appendChild(this.questDistBodyEl);
    this.questBodyEl.appendChild(this.questObjectiveEl);
    this.questBodyEl.appendChild(questMetaRow);

    questPanel.appendChild(this.questToggleBtn);
    questPanel.appendChild(this.questBodyEl);

    const questJournalBtn = document.createElement('button');
    questJournalBtn.type = 'button';
    questJournalBtn.setAttribute('aria-label', 'Abrir Diario de Misiones');
    questJournalBtn.className =
      'pointer-events-auto w-full min-h-[38px] px-btn-primary px-2.5 py-1.5 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer select-none';

    const journalLeft = document.createElement('span');
    journalLeft.className = 'flex items-center gap-1.5 truncate';
    journalLeft.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges" class="shrink-0"><rect x="2" y="2" width="11" height="12" fill="#24123B" stroke="#050505" stroke-width="1"/><rect x="4" y="4" width="7" height="2" fill="#E8B84A"/><rect x="4" y="7" width="7" height="1" fill="#FCEDB8"/><rect x="4" y="9" width="5" height="1" fill="#FCEDB8"/></svg><span>Diario de Misiones</span>';

    this.questJournalBadgeEl = document.createElement('span');
    this.questJournalBadgeEl.className =
      'shrink-0 rounded-none border border-abyss-ink bg-crypt-ink px-1.5 py-0.5 text-[10px] font-bold text-pale-gold tabular-nums';
    this.questJournalBadgeEl.textContent = `0/${SIDE_QUESTS.length}`;

    questJournalBtn.appendChild(journalLeft);
    questJournalBtn.appendChild(this.questJournalBadgeEl);
    questJournalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onOpenJournal();
    });

    this.leftHudStack.appendChild(hudBadge);
    this.leftHudStack.appendChild(questPanel);
    this.leftHudStack.appendChild(questJournalBtn);

    this.warpCurtain = document.createElement('div');
    this.warpCurtain.className =
      'pointer-events-none fixed inset-0 z-30 bg-[#0b080e] opacity-0';

    this.zoneBanner = document.createElement('div');
    this.zoneBanner.className =
      'pointer-events-none fixed left-1/2 -translate-x-1/2 z-20 rounded-none border-2 border-resonant-gold bg-crypt-ink px-4 py-1.5 text-center shadow-[3px_3px_0_#050505] opacity-0 transition-opacity duration-200';
    this.zoneBanner.style.top = 'calc(3.1rem + env(safe-area-inset-top, 0px))';
  }

  mount(uiLayer: HTMLElement, uiLayers: UiLayerManager): void {
    uiLayer.appendChild(this.leftHudStack);
    uiLayer.appendChild(this.zoneBanner);
    uiLayer.appendChild(this.warpCurtain);
    uiLayers.register('overworldHud', this.leftHudStack, this.zoneBanner);
  }

  unmount(uiLayers: UiLayerManager): void {
    uiLayers.unregister('overworldHud');
    this.leftHudStack.remove();
    this.zoneBanner.remove();
    this.warpCurtain.remove();
  }

  private toggleQuestCollapsed(): void {
    this.questCollapsed = !this.questCollapsed;
    this.questBodyEl.classList.toggle('hidden', this.questCollapsed);
    this.questChevronEl.textContent = this.questCollapsed ? '▶' : '▼';
    this.questToggleBtn.setAttribute('aria-expanded', String(!this.questCollapsed));
  }

  updateBadge(mapId: string, money: number, repelSteps: number): void {
    const mapLabel = ES.maps[mapId] ?? mapId;
    const repel = repelSteps > 0 ? ` · 🛡️${repelSteps}` : '';
    this.hudLocationEl.textContent = `${mapLabel} · ${money} ◈${repel}`;
  }

  updateStamina(stamina: StaminaState): void {
    const pct = Math.max(
      0,
      Math.min(100, Math.round((stamina.current / stamina.max) * 100))
    );
    const tone = stamina.exhausted
      ? 'exhausted'
      : pct <= 25
        ? 'low'
        : pct <= 55
          ? 'mid'
          : 'high';

    if (pct !== this.lastStaminaPct) {
      this.lastStaminaPct = pct;
      this.staminaFillEl.style.width = `${pct}%`;
      this.staminaFillEl.parentElement?.setAttribute('aria-valuenow', String(pct));
      if (!stamina.exhausted) {
        this.staminaLabelEl.textContent = `${pct}%`;
      }
    }

    if (tone !== this.lastStaminaTone) {
      this.lastStaminaTone = tone;
      if (tone === 'exhausted') {
        this.staminaFillEl.className = 'h-full bg-rift-crimson';
        this.staminaLabelEl.className = 'text-coral-red tabular-nums';
        this.staminaLabelEl.textContent = 'AGOTADA';
      } else if (tone === 'low') {
        this.staminaFillEl.className = 'h-full bg-rift-crimson';
        this.staminaLabelEl.className = 'text-coral-red tabular-nums';
        this.staminaLabelEl.textContent = `${pct}%`;
      } else if (tone === 'mid') {
        this.staminaFillEl.className = 'h-full bg-resonant-gold';
        this.staminaLabelEl.className = 'text-resonant-gold tabular-nums';
        this.staminaLabelEl.textContent = `${pct}%`;
      } else {
        this.staminaFillEl.className = 'h-full bg-ki-cyan';
        this.staminaLabelEl.className = 'text-ki-cyan tabular-nums';
        this.staminaLabelEl.textContent = `${pct}%`;
      }
    }
  }

  refreshQuestTracker(
    questIndex: number | undefined,
    map: MapDef,
    playerX: number,
    playerZ: number,
    yaw: number,
    force = false
  ): void {
    const idx = clampQuestIndex(questIndex ?? 0);
    const active = getActiveQuest(idx);
    if (!active) {
      this.questStepLabelEl.textContent = `MISIONES ${MAIN_QUESTS.length}/${MAIN_QUESTS.length}`;
      this.questStepLabelEl.className =
        'text-[9px] font-bold tracking-widest uppercase text-ki-cyan leading-none';
      this.questTitleEl.textContent = 'Exploración completa';
      this.questObjectiveEl.textContent =
        'Has recorrido todos los enclaves de la región.';
      this.questTargetEl.textContent = 'Arena Cumbre';
      this.questDistHeaderEl.textContent = '✓';
      this.questDistBodyEl.textContent = 'LISTO';
      this.questArrowSvgEl.style.transform = 'rotate(0deg)';
      this.questArrowSvgEl.innerHTML =
        '<polygon points="4,8 7,11 13,4 14,6 7,13 3,9" fill="#5FE3D2" stroke="#050505" stroke-width="1" />';
      this.lastArrowAngle = 0;
      this.lastQuestDistance = 0;
      return;
    }

    this.questStepLabelEl.textContent = `MISIÓN ${idx + 1}/${MAIN_QUESTS.length}`;
    this.questStepLabelEl.className =
      'text-[9px] font-bold tracking-widest uppercase text-resonant-gold leading-none';
    this.questTitleEl.textContent = active.title;
    this.questObjectiveEl.textContent = active.objective;

    const nav = resolveQuestNavTarget(active, map, playerX, playerZ, MAPS);
    const viaLabel = ES.maps[nav.viaMapId] ?? nav.viaMapId;
    this.questTargetEl.textContent = nav.isCrossMap
      ? `Hacia ${viaLabel} (${Math.round(nav.x)}, ${Math.round(nav.y)})`
      : `${viaLabel} (${active.targetX}, ${active.targetY})`;

    if (force) {
      this.questArrowSvgEl.innerHTML =
        '<polygon points="8,1 14,9 10,9 10,15 6,15 6,9 2,9" fill="#E8B84A" stroke="#050505" stroke-width="1" />';
    }
    this.updateQuestArrow(questIndex, map, playerX, playerZ, yaw, force, nav);
  }

  updateQuestArrow(
    questIndex: number | undefined,
    map: MapDef,
    playerX: number,
    playerZ: number,
    yaw: number,
    force = false,
    precomputedNav?: QuestNavTarget
  ): void {
    const idx = clampQuestIndex(questIndex ?? 0);
    const active = getActiveQuest(idx);
    if (!active) return;

    const nav =
      precomputedNav ?? resolveQuestNavTarget(active, map, playerX, playerZ, MAPS);
    const angle = computeQuestArrowAngleDeg(playerX, playerZ, nav.x, nav.y, yaw);
    const distRounded = Math.max(0, Math.round(nav.distance));

    if (force || Math.abs(angle - this.lastArrowAngle) >= 0.5) {
      this.lastArrowAngle = angle;
      this.questArrowSvgEl.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    }
    if (force || distRounded !== this.lastQuestDistance) {
      this.lastQuestDistance = distRounded;
      this.questDistHeaderEl.textContent = `${distRounded}p`;
      this.questDistBodyEl.textContent =
        distRounded === 1 ? '1 paso' : `${distRounded} pasos`;
    }
  }

  updateSideQuestBadge(
    readyCount: number,
    availableCount: number,
    activeCount: number,
    completedCount: number
  ): void {
    if (readyCount > 0) {
      this.questJournalBadgeEl.textContent = `${readyCount}? · ${completedCount}/${SIDE_QUESTS.length}`;
      this.questJournalBadgeEl.className =
        'shrink-0 rounded-none border border-ki-cyan bg-deep-abyss px-1.5 py-0.5 text-[10px] font-bold text-ki-cyan tabular-nums';
    } else if (availableCount > 0) {
      this.questJournalBadgeEl.textContent = `${availableCount}! · ${completedCount}/${SIDE_QUESTS.length}`;
      this.questJournalBadgeEl.className =
        'shrink-0 rounded-none border border-resonant-gold bg-crypt-ink px-1.5 py-0.5 text-[10px] font-bold text-pale-gold tabular-nums';
    } else if (activeCount > 0) {
      this.questJournalBadgeEl.textContent = `${activeCount} act · ${completedCount}/${SIDE_QUESTS.length}`;
      this.questJournalBadgeEl.className =
        'shrink-0 rounded-none border border-abyss-ink bg-crypt-ink px-1.5 py-0.5 text-[10px] font-bold text-ice-cyan tabular-nums';
    } else {
      this.questJournalBadgeEl.textContent = `${completedCount}/${SIDE_QUESTS.length}`;
      this.questJournalBadgeEl.className =
        'shrink-0 rounded-none border border-abyss-ink bg-crypt-ink px-1.5 py-0.5 text-[10px] font-bold text-neon-mint tabular-nums';
    }
  }

  showZoneBanner(mapId: string): void {
    const label = ES.maps[mapId] ?? mapId;
    this.zoneBanner.innerHTML = `<div class="text-[11px] font-bold tracking-widest uppercase text-resonant-gold">${label}</div>`;
    this.zoneBanner.style.opacity = '1';
    this.zoneBannerTimer = 2.2;
  }

  stepZoneBanner(dt: number): void {
    if (this.zoneBannerTimer > 0) {
      this.zoneBannerTimer -= dt;
      if (this.zoneBannerTimer <= 0) {
        this.zoneBanner.style.opacity = '0';
      }
    }
  }

  setWarpAlpha(alpha: number): void {
    this.warpCurtain.style.opacity = alpha <= 0 ? '0' : alpha.toFixed(3);
  }
}

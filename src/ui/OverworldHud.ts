import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OverworldHudView } from '../components/ui/OverworldHudView.tsx';
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
  private reactRoot: Root | null = null;
  private mounted = false;

  private locationLine = '';
  private timeLabel = '';
  private staminaCurrent = 100;
  private staminaMax = 100;
  private staminaExhausted = false;
  private lastStaminaPct = -1;
  private lastStaminaTone = '';

  private questCollapsed = false;
  private questComplete = false;
  private questStepLabel = `MISIÓN 1/${MAIN_QUESTS.length}`;
  private questTitle = '';
  private questObjective = '';
  private questTargetLabel = '';
  private questDistShort = '0p';
  private questDistLong = '0 pasos';
  private arrowAngleDeg = 0;
  private lastArrowAngle = -999;
  private lastQuestDistance = -1;

  private journalBadgeText = `0/${SIDE_QUESTS.length}`;
  private journalBadgeTone: 'ready' | 'available' | 'active' | 'done' = 'done';

  private readonly warpCurtain: HTMLDivElement;
  private readonly zoneBanner: HTMLDivElement;
  private zoneBannerTimer = 0;

  constructor(private readonly callbacks: OverworldHudCallbacks) {
    this.leftHudStack = document.createElement('div');
    this.leftHudStack.className =
      'pointer-events-none fixed top-2.5 left-3 z-20 flex flex-col items-start gap-1.5 w-[212px] sm:w-[244px] max-w-[62vw]';
    this.leftHudStack.style.top = 'calc(0.625rem + env(safe-area-inset-top, 0px))';
    this.leftHudStack.style.left = 'calc(0.75rem + env(safe-area-inset-left, 0px))';

    this.warpCurtain = document.createElement('div');
    this.warpCurtain.className =
      'pointer-events-none fixed inset-0 z-30 bg-abyss-ink opacity-0';

    this.zoneBanner = document.createElement('div');
    this.zoneBanner.className =
      'pointer-events-none fixed left-1/2 -translate-x-1/2 z-20 px-panel px-4 py-1.5 text-center opacity-0 transition-opacity duration-200';
    this.zoneBanner.style.top = 'calc(3.1rem + env(safe-area-inset-top, 0px))';
  }

  private renderView(): void {
    if (!this.mounted) return;
    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.leftHudStack);
    }
    this.reactRoot.render(
      createElement(OverworldHudView, {
        locationLine: this.locationLine,
        timeLabel: this.timeLabel,
        staminaCurrent: this.staminaCurrent,
        staminaMax: this.staminaMax,
        staminaExhausted: this.staminaExhausted,
        questCollapsed: this.questCollapsed,
        questComplete: this.questComplete,
        questStepLabel: this.questStepLabel,
        questTitle: this.questTitle,
        questObjective: this.questObjective,
        questTargetLabel: this.questTargetLabel,
        questDistShort: this.questDistShort,
        questDistLong: this.questDistLong,
        arrowAngleDeg: this.arrowAngleDeg,
        journalBadgeText: this.journalBadgeText,
        journalBadgeTone: this.journalBadgeTone,
        onToggleQuest: () => {
          this.questCollapsed = !this.questCollapsed;
          this.renderView();
          this.callbacks.onToggleQuest();
        },
        onOpenJournal: () => {
          this.callbacks.onOpenJournal();
        },
      })
    );
  }

  mount(uiLayer: HTMLElement, uiLayers: UiLayerManager): void {
    uiLayer.appendChild(this.leftHudStack);
    uiLayer.appendChild(this.zoneBanner);
    uiLayer.appendChild(this.warpCurtain);
    uiLayers.register('overworldHud', this.leftHudStack, this.zoneBanner);
    this.mounted = true;
    this.renderView();
  }

  unmount(uiLayers: UiLayerManager): void {
    this.mounted = false;
    this.reactRoot?.unmount();
    this.reactRoot = null;
    uiLayers.unregister('overworldHud');
    this.leftHudStack.remove();
    this.zoneBanner.remove();
    this.warpCurtain.remove();
  }

  updateBadge(
    mapId: string,
    money: number,
    repelSteps: number,
    timeLabel?: string
  ): void {
    const mapLabel = ES.maps[mapId] ?? mapId;
    const repel = repelSteps > 0 ? ` · 🛡️${repelSteps}` : '';
    const next = `${mapLabel} · ${money} ◈${repel}`;
    const nextTime = timeLabel ?? this.timeLabel;
    if (next !== this.locationLine || nextTime !== this.timeLabel) {
      this.locationLine = next;
      this.timeLabel = nextTime;
      this.renderView();
    }
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

    if (pct !== this.lastStaminaPct || tone !== this.lastStaminaTone) {
      this.lastStaminaPct = pct;
      this.lastStaminaTone = tone;
      this.staminaCurrent = stamina.current;
      this.staminaMax = stamina.max;
      this.staminaExhausted = stamina.exhausted;
      this.renderView();
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
      this.questComplete = true;
      this.questStepLabel = `MISIONES ${MAIN_QUESTS.length}/${MAIN_QUESTS.length}`;
      this.questTitle = 'Exploración completa';
      this.questObjective = 'Has recorrido todos los enclaves de la región.';
      this.questTargetLabel = 'Arena Cumbre';
      this.questDistShort = '✓';
      this.questDistLong = 'LISTO';
      this.arrowAngleDeg = 0;
      this.lastArrowAngle = 0;
      this.lastQuestDistance = 0;
      this.renderView();
      return;
    }

    this.questComplete = false;
    this.questStepLabel = `MISIÓN ${idx + 1}/${MAIN_QUESTS.length}`;
    this.questTitle = active.title;
    this.questObjective = active.objective;

    const nav = resolveQuestNavTarget(active, map, playerX, playerZ, MAPS);
    const viaLabel = ES.maps[nav.viaMapId] ?? nav.viaMapId;
    this.questTargetLabel = nav.isCrossMap
      ? `Hacia ${viaLabel} (${Math.round(nav.x)}, ${Math.round(nav.y)})`
      : `${viaLabel} (${active.targetX}, ${active.targetY})`;

    this.updateQuestArrow(questIndex, map, playerX, playerZ, yaw, force, nav);
    this.renderView();
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

    let dirty = false;
    if (force || Math.abs(angle - this.lastArrowAngle) >= 0.5) {
      this.lastArrowAngle = angle;
      this.arrowAngleDeg = angle;
      dirty = true;
    }
    if (force || distRounded !== this.lastQuestDistance) {
      this.lastQuestDistance = distRounded;
      this.questDistShort = `${distRounded}p`;
      this.questDistLong = distRounded === 1 ? '1 paso' : `${distRounded} pasos`;
      dirty = true;
    }
    if (dirty && !force) {
      this.renderView();
    }
  }

  updateSideQuestBadge(
    readyCount: number,
    availableCount: number,
    activeCount: number,
    completedCount: number
  ): void {
    if (readyCount > 0) {
      this.journalBadgeText = `${readyCount}? · ${completedCount}/${SIDE_QUESTS.length}`;
      this.journalBadgeTone = 'ready';
    } else if (availableCount > 0) {
      this.journalBadgeText = `${availableCount}! · ${completedCount}/${SIDE_QUESTS.length}`;
      this.journalBadgeTone = 'available';
    } else if (activeCount > 0) {
      this.journalBadgeText = `${activeCount} act · ${completedCount}/${SIDE_QUESTS.length}`;
      this.journalBadgeTone = 'active';
    } else {
      this.journalBadgeText = `${completedCount}/${SIDE_QUESTS.length}`;
      this.journalBadgeTone = 'done';
    }
    this.renderView();
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

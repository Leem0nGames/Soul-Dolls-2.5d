import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BattleContainer } from '../components/BattleContainer.tsx';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { getMoveEffectivenessHint } from '../domain/BattleHints.ts';
import { BODY_PART_SHORT } from '../domain/BodyParts.ts';
import { getCreatureDisplayName, xpForLevel } from '../domain/Creature.ts';
import type { BodyPartName, CreatureInstance } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';

export class BattleHud {
  readonly root: HTMLDivElement;
  readonly fxOverlay: HTMLDivElement;
  private enemyBox: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private bottomDock: HTMLDivElement;
  private playerBox: HTMLDivElement;
  private menuBox: HTMLDivElement;
  private replaceModal: HTMLDivElement;

  private assets: AssetProvider | null = null;
  private lastEnemyUid = '';
  private lastPlayerUid = '';
  private lastPlayerXp = -1;
  private lastPlayerLevel = -1;
  private targetPlayerHp = 0;
  private displayedPlayerHp = 0;
  private targetPlayerMaxHp = 1;
  private hpTextEl: HTMLSpanElement | null = null;
  private bannerTimer = 0;

  private enemyPartsRoot: Root | null = null;
  private playerPartsRoot: Root | null = null;
  private lastEnemyCreature: CreatureInstance | null = null;
  private lastPlayerCreature: CreatureInstance | null = null;
  private enemyHit: {
    part: BodyPartName | null;
    tick: number;
    amount?: number;
    crit?: boolean;
    effectiveness?: number;
    broken?: boolean;
  } = { part: null, tick: 0 };
  private playerHit: {
    part: BodyPartName | null;
    tick: number;
    amount?: number;
    crit?: boolean;
    effectiveness?: number;
    broken?: boolean;
  } = { part: null, tick: 0 };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pointer-events-none fixed inset-0 z-22 hidden safe-pad p-2.5 sm:p-3';

    this.fxOverlay = document.createElement('div');
    this.fxOverlay.className = 'pointer-events-none fixed inset-0 z-25 overflow-hidden hidden';

    this.enemyBox = document.createElement('div');
    this.enemyBox.className =
      'pointer-events-none absolute top-[calc(0.375rem+env(safe-area-inset-top,0px))] inset-x-2 mx-auto max-w-[400px] sm:mx-0 sm:max-w-none sm:inset-x-auto sm:left-[calc(0.75rem+env(safe-area-inset-left,0px))] sm:w-[328px] px-hud-box px-2.5 py-1.5 sm:p-2';

    this.bannerEl = document.createElement('div');
    this.bannerEl.className =
      'pointer-events-none absolute hidden max-w-[220px] rounded-none border-2 border-ki-cyan bg-crypt-ink px-2.5 py-1 text-right shadow-[2px_2px_0_#050505] top-[calc(6.4rem+env(safe-area-inset-top,0px))] right-[calc(0.5rem+env(safe-area-inset-right,0px))] sm:top-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:right-[calc(0.75rem+env(safe-area-inset-right,0px))]';

    this.bottomDock = document.createElement('div');
    this.bottomDock.className =
      'pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-stretch gap-2.5 p-2 sm:flex-row-reverse sm:items-end sm:justify-between sm:gap-5 sm:p-4 safe-pad';

    this.playerBox = document.createElement('div');
    this.playerBox.className =
      'pointer-events-none w-full max-w-[400px] mx-auto sm:mx-0 sm:max-w-none sm:w-[328px] sm:shrink-0 sm:ml-auto mb-[76px] sm:mb-24 px-hud-box px-2.5 py-1.5 sm:p-2';

    this.menuBox = document.createElement('div');
    this.menuBox.className =
      'pointer-events-auto w-full max-w-[400px] mx-auto sm:mx-0 sm:flex-1 sm:max-w-[424px] hidden rounded-none border-2 border-resonant-gold bg-crypt-ink p-2 sm:p-3 shadow-[inset_0_2px_0_#8A6A3B,4px_4px_0_#050505]';

    this.replaceModal = document.createElement('div');
    this.replaceModal.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-abyss-ink p-3 safe-pad';

    this.bottomDock.appendChild(this.playerBox);
    this.bottomDock.appendChild(this.menuBox);

    this.root.appendChild(this.enemyBox);
    this.root.appendChild(this.bannerEl);
    this.root.appendChild(this.bottomDock);
    this.root.appendChild(this.replaceModal);
    parent.appendChild(this.fxOverlay);
    parent.appendChild(this.root);
  }

  setAssets(assets: AssetProvider): void {
    this.assets = assets;
  }

  show(): void {
    this.lastEnemyUid = '';
    this.lastPlayerUid = '';
    this.lastPlayerXp = -1;
    this.lastPlayerLevel = -1;
    this.enemyHit = { part: null, tick: 0 };
    this.playerHit = { part: null, tick: 0 };
    this.bannerTimer = 0;
    this.bannerEl.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.fxOverlay.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.fxOverlay.classList.add('hidden');
    this.fxOverlay.innerHTML = '';
    this.bannerEl.classList.add('hidden');
    this.hideMenu();
    this.replaceModal.classList.add('hidden');
    this.replaceModal.classList.remove('flex');
    this.unmountPartRoots();
  }

  private unmountPartRoots(): void {
    this.enemyPartsRoot?.unmount();
    this.enemyPartsRoot = null;
    this.playerPartsRoot?.unmount();
    this.playerPartsRoot = null;
    this.lastEnemyCreature = null;
    this.lastPlayerCreature = null;
  }

  showBanner(title: string, subtitle?: string): void {
    this.bannerEl.innerHTML = `
      <div class="text-[11px] font-extrabold text-resonant-gold leading-tight">${title}</div>
      ${subtitle ? `<div class="text-[10px] text-porcelain leading-tight">${subtitle}</div>` : ''}
    `;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer = 1.9;
  }

  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerEl.classList.add('hidden');
      }
    }
    if (!this.hpTextEl) return;
    if (Math.abs(this.displayedPlayerHp - this.targetPlayerHp) > 0.25) {
      const rate = Math.max(12, Math.abs(this.targetPlayerHp - this.displayedPlayerHp) * 6);
      const step = rate * dt;
      if (this.displayedPlayerHp > this.targetPlayerHp) {
        this.displayedPlayerHp = Math.max(this.targetPlayerHp, this.displayedPlayerHp - step);
      } else {
        this.displayedPlayerHp = Math.min(this.targetPlayerHp, this.displayedPlayerHp + step);
      }
      this.hpTextEl.textContent = `${Math.round(this.displayedPlayerHp)}/${this.targetPlayerMaxHp} ${ES.party.hp}`;
    } else if (this.displayedPlayerHp !== this.targetPlayerHp) {
      this.displayedPlayerHp = this.targetPlayerHp;
      this.hpTextEl.textContent = `${this.targetPlayerHp}/${this.targetPlayerMaxHp} ${ES.party.hp}`;
    }
  }

  updateBars(
    player: CreatureInstance,
    enemy: CreatureInstance,
    isWild: boolean,
    playerParty: readonly CreatureInstance[] = [player],
    enemyParty: readonly CreatureInstance[] = [enemy]
  ): void {
    this.renderEnemyCard(enemy, isWild, enemyParty);
    this.renderPlayerCard(player, playerParty);
  }

  private renderHeldBadge(c: CreatureInstance): string {
    if (!c.heldItemId || !this.assets) return '';
    return `<img src="${this.assets.getItemIconDataUrl(c.heldItemId)}" class="pixel-canvas w-4 h-4 object-contain shrink-0" alt="" />`;
  }

  private renderTypeChips(speciesId: number): string {
    const spec = getSpecies(speciesId);
    return spec.types
      .map((t) => {
        const v = TYPE_VISUALS[t];
        return `<span class="px-1 py-[1px] rounded-none text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider border leading-none" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
      })
      .join('');
  }

  private renderPartyBalls(party: readonly CreatureInstance[]): string {
    return party
      .slice(0, 6)
      .map((c) => {
        const cls =
          c.currentHp <= 0
            ? 'bg-ash-purple border-cold-stone'
            : c.status !== 'none'
              ? 'bg-ui-warning border-pale-gold'
              : 'bg-rift-crimson border-warm-white';
        return `<span class="inline-block w-2.5 h-2.5 rounded-none border ${cls}"></span>`;
      })
      .join('');
  }

  private renderLimbContainer(side: 'player' | 'enemy'): void {
    const root = side === 'player' ? this.playerPartsRoot : this.enemyPartsRoot;
    const creature = side === 'player' ? this.lastPlayerCreature : this.lastEnemyCreature;
    const hit = side === 'player' ? this.playerHit : this.enemyHit;
    if (!root || !creature) return;

    root.render(
      createElement(BattleContainer, {
        creature,
        variant: side,
        damagedPart: hit.part,
        damageTick: hit.tick,
        damageAmount: hit.amount,
        damageCrit: hit.crit,
        damageEffectiveness: hit.effectiveness,
        damageBroken: hit.broken,
        labels: BODY_PART_SHORT,
        statusLabels: { broken: 'ROT' },
      })
    );
  }

  flashBodyPart(
    side: 'player' | 'enemy',
    part: BodyPartName,
    details?: {
      amount?: number;
      crit?: boolean;
      effectiveness?: number;
      broken?: boolean;
    }
  ): void {
    if (side === 'player') {
      this.playerHit = {
        part,
        tick: this.playerHit.tick + 1,
        amount: details?.amount,
        crit: details?.crit,
        effectiveness: details?.effectiveness,
        broken: details?.broken,
      };
    } else {
      this.enemyHit = {
        part,
        tick: this.enemyHit.tick + 1,
        amount: details?.amount,
        crit: details?.crit,
        effectiveness: details?.effectiveness,
        broken: details?.broken,
      };
    }
    this.renderLimbContainer(side);
  }

  private renderEnemyCard(
    c: CreatureInstance,
    isWild: boolean,
    enemyParty: readonly CreatureInstance[]
  ): void {
    const isNew = this.lastEnemyUid !== c.uid;
    this.lastEnemyUid = c.uid;

    const pct = Math.max(0, Math.min(100, Math.round((c.currentHp / Math.max(1, c.stats.hp)) * 100)));
    const barColor = pct > 50 ? 'bg-ui-success' : pct > 20 ? 'bg-ui-warning' : 'bg-ui-danger';
    const isLow = pct > 0 && pct <= 20;
    const statusBadge =
      c.status !== 'none'
        ? `<span class="px-1.5 py-[1px] rounded-none border border-ethereal-orchid bg-royal-purple text-warm-white text-[10px] font-bold">${ES.statusShort[c.status]}</span>`
        : '';

    if (isNew || !this.enemyBox.querySelector('[data-hp-fill]')) {
      this.enemyPartsRoot?.unmount();
      this.enemyPartsRoot = null;
      this.enemyHit = { part: null, tick: 0 };
      this.enemyBox.classList.remove('battle-slide-left');
      void this.enemyBox.offsetWidth;
      this.enemyBox.classList.add('battle-slide-left');
      this.enemyBox.innerHTML = `
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1 min-w-0">
            <span class="font-bold text-xs sm:text-sm truncate" data-name></span>
            <span data-held></span>
            <div class="flex items-center gap-1 shrink-0" data-types></div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <div class="flex items-center gap-0.5" data-balls></div>
            <span data-status>${statusBadge}</span>
            <span class="text-[10px] text-bone-gray whitespace-nowrap" data-tag></span>
            <span class="text-[10px] text-cold-stone" aria-hidden="true">·</span>
            <span class="text-[11px] sm:text-xs font-bold text-resonant-gold tabular-nums" data-lv></span>
          </div>
        </div>
        <div class="relative mt-1 h-[8px] w-full rounded-none bg-abyss-ink border border-cold-stone overflow-hidden">
          <div data-hp-ghost class="absolute inset-y-0 left-0 bg-pale-gold transition-[width] duration-700 ease-out delay-150" style="width:${pct}%"></div>
          <div data-hp-fill class="relative h-full ${barColor} transition-[width] duration-300 ease-out" style="width:${pct}%"></div>
        </div>
        <div data-parts class="mt-1 pt-1 border-t-2 border-ash-purple"></div>
      `;
      const partsSlot = this.enemyBox.querySelector('[data-parts]') as HTMLElement;
      this.enemyPartsRoot = createRoot(partsSlot);
    }

    this.lastEnemyCreature = c;
    (this.enemyBox.querySelector('[data-name]') as HTMLElement).textContent = getCreatureDisplayName(c);
    (this.enemyBox.querySelector('[data-held]') as HTMLElement).innerHTML = this.renderHeldBadge(c);
    (this.enemyBox.querySelector('[data-tag]') as HTMLElement).textContent = isWild
      ? 'Salvaje'
      : 'Soultrainer';
    (this.enemyBox.querySelector('[data-lv]') as HTMLElement).textContent = `${ES.party.lv}${c.level}`;
    (this.enemyBox.querySelector('[data-types]') as HTMLElement).innerHTML = this.renderTypeChips(c.speciesId);
    (this.enemyBox.querySelector('[data-balls]') as HTMLElement).innerHTML = isWild
      ? ''
      : this.renderPartyBalls(enemyParty);
    (this.enemyBox.querySelector('[data-status]') as HTMLElement).innerHTML = statusBadge;
    this.renderLimbContainer('enemy');

    const fill = this.enemyBox.querySelector('[data-hp-fill]') as HTMLElement;
    const ghost = this.enemyBox.querySelector('[data-hp-ghost]') as HTMLElement;
    fill.className = `relative h-full ${barColor} transition-[width] duration-300 ease-out ${isLow ? 'battle-low-hp' : ''}`;
    fill.style.width = `${pct}%`;
    ghost.style.width = `${pct}%`;
  }

  private renderPlayerCard(
    c: CreatureInstance,
    playerParty: readonly CreatureInstance[]
  ): void {
    const spec = getSpecies(c.speciesId);
    const isNew = this.lastPlayerUid !== c.uid;
    const leveledUp = !isNew && this.lastPlayerLevel >= 0 && c.level > this.lastPlayerLevel;
    this.lastPlayerUid = c.uid;
    this.lastPlayerLevel = c.level;

    const pct = Math.max(0, Math.min(100, Math.round((c.currentHp / Math.max(1, c.stats.hp)) * 100)));
    const barColor = pct > 50 ? 'bg-ui-success' : pct > 20 ? 'bg-ui-warning' : 'bg-ui-danger';
    const isLow = pct > 0 && pct <= 20;
    const statusBadge =
      c.status !== 'none'
        ? `<span class="px-1.5 py-[1px] rounded-none border border-ethereal-orchid bg-royal-purple text-warm-white text-[10px] font-bold">${ES.statusShort[c.status]}</span>`
        : '';

    const currXp = xpForLevel(c.level, spec.growthRate);
    const nextXp = c.level >= 100 ? currXp + 1 : xpForLevel(c.level + 1, spec.growthRate);
    const expPct =
      c.level >= 100
        ? 100
        : Math.max(0, Math.min(100, Math.round(((c.xp - currXp) / Math.max(1, nextXp - currXp)) * 100)));

    if (isNew || !this.playerBox.querySelector('[data-hp-fill]')) {
      this.playerPartsRoot?.unmount();
      this.playerPartsRoot = null;
      this.playerHit = { part: null, tick: 0 };
      this.displayedPlayerHp = c.currentHp;
      this.playerBox.classList.remove('battle-slide-right');
      void this.playerBox.offsetWidth;
      this.playerBox.classList.add('battle-slide-right');

      this.playerBox.innerHTML = `
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1 min-w-0">
            <span class="font-bold text-xs sm:text-sm truncate" data-name></span>
            <span data-held></span>
            <div class="flex items-center gap-1 shrink-0" data-types></div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <div class="flex items-center gap-0.5" data-balls></div>
            <span data-status>${statusBadge}</span>
            <span class="text-[11px] sm:text-xs font-bold text-resonant-gold tabular-nums" data-lv></span>
          </div>
        </div>
        <div class="mt-1 flex items-center gap-1.5">
          <div class="relative h-[8px] flex-1 rounded-none bg-abyss-ink border border-cold-stone overflow-hidden">
            <div data-hp-ghost class="absolute inset-y-0 left-0 bg-pale-gold transition-[width] duration-700 ease-out delay-150" style="width:${pct}%"></div>
            <div data-hp-fill class="relative h-full ${barColor} transition-[width] duration-300 ease-out" style="width:${pct}%"></div>
          </div>
          <span data-hp-text class="text-[10px] sm:text-[11px] font-bold text-porcelain tabular-nums shrink-0 leading-none">${c.currentHp}/${c.stats.hp} ${ES.party.hp}</span>
        </div>
        <div data-parts class="mt-1 pt-1 border-t-2 border-ash-purple"></div>
        <div class="mt-1 h-[4px] w-full rounded-none bg-abyss-ink border border-ash-purple overflow-hidden">
          <div data-xp-fill class="h-full bg-ki-cyan transition-[width] duration-500 ease-out" style="width:${expPct}%"></div>
        </div>
      `;
      this.hpTextEl = this.playerBox.querySelector('[data-hp-text]') as HTMLSpanElement;
      const partsSlot = this.playerBox.querySelector('[data-parts]') as HTMLElement;
      this.playerPartsRoot = createRoot(partsSlot);
    }

    this.lastPlayerCreature = c;
    this.targetPlayerHp = c.currentHp;
    this.targetPlayerMaxHp = c.stats.hp;

    (this.playerBox.querySelector('[data-name]') as HTMLElement).textContent = getCreatureDisplayName(c);
    (this.playerBox.querySelector('[data-held]') as HTMLElement).innerHTML = this.renderHeldBadge(c);
    (this.playerBox.querySelector('[data-lv]') as HTMLElement).textContent = `${ES.party.lv}${c.level}`;
    (this.playerBox.querySelector('[data-types]') as HTMLElement).innerHTML = this.renderTypeChips(c.speciesId);
    (this.playerBox.querySelector('[data-balls]') as HTMLElement).innerHTML = this.renderPartyBalls(playerParty);
    (this.playerBox.querySelector('[data-status]') as HTMLElement).innerHTML = statusBadge;
    this.renderLimbContainer('player');

    const fill = this.playerBox.querySelector('[data-hp-fill]') as HTMLElement;
    const ghost = this.playerBox.querySelector('[data-hp-ghost]') as HTMLElement;
    fill.className = `relative h-full ${barColor} transition-[width] duration-300 ease-out ${isLow ? 'battle-low-hp' : ''}`;
    fill.style.width = `${pct}%`;
    ghost.style.width = `${pct}%`;

    const xpFill = this.playerBox.querySelector('[data-xp-fill]') as HTMLElement;
    xpFill.style.width = `${expPct}%`;
    if (leveledUp || (this.lastPlayerXp >= 0 && c.xp > this.lastPlayerXp)) {
      xpFill.classList.remove('battle-xp-burst');
      void xpFill.offsetWidth;
      if (leveledUp) xpFill.classList.add('battle-xp-burst');
    }
    this.lastPlayerXp = c.xp;

    if (isLow) {
      this.playerBox.style.borderColor = '#C2234B';
    } else {
      this.playerBox.style.borderColor = '#A67F46';
    }
  }

  spawnFloatingNumber(
    normX: number,
    normY: number,
    text: string,
    tone: 'normal' | 'super' | 'resist' | 'crit' | 'heal'
  ): void {
    const el = document.createElement('div');
    const colorCls =
      tone === 'crit'
        ? 'text-ui-gold text-lg sm:text-xl'
        : tone === 'super'
          ? 'text-coral-red text-base sm:text-lg'
          : tone === 'heal'
            ? 'text-neon-mint text-base sm:text-lg'
            : tone === 'resist'
              ? 'text-bone-gray text-sm'
              : 'text-warm-white text-base';
    el.className = `pointer-events-none absolute font-black px-text-outline battle-float-num ${colorCls}`;
    el.style.left = `${Math.round(Math.max(12, Math.min(88, normX * 100)))}%`;
    el.style.top = `${Math.round(Math.max(18, Math.min(72, normY * 100)))}%`;
    el.textContent = text;
    this.fxOverlay.appendChild(el);
    window.setTimeout(() => {
      el.remove();
    }, 960);
  }

  showMainMenu(
    creature: CreatureInstance,
    enemy: CreatureInstance,
    isWild: boolean,
    callbacks: {
      onMove: (moveIndex: number) => void;
      onBag: () => void;
      onParty: () => void;
      onRun: () => void;
    }
  ): void {
    this.menuBox.classList.remove('hidden');
    this.playerBox.classList.remove('mb-[76px]', 'sm:mb-24');
    this.playerBox.classList.add('mb-1', 'sm:mb-0');

    const icon = (kind: 'fight' | 'bag' | 'party' | 'run') => {
      if (!this.assets) return '';
      return `<img src="${this.assets.getBattleIconDataUrl(kind)}" alt="" class="pixel-canvas w-4 h-4 sm:w-5 sm:h-5 shrink-0" />`;
    };

    const renderRoot = () => {
      this.menuBox.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="text-xs sm:text-sm font-bold text-porcelain px-0.5 pb-1 border-b-2 border-ash-purple truncate">${ES.battle.whatWillDo(getCreatureDisplayName(creature))}</div>
          <div class="grid grid-cols-2 gap-2">
            <button data-act="fight" class="min-h-[44px] sm:min-h-[48px] px-2.5 px-btn-danger font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5">${icon('fight')}<span>${ES.battle.fight}</span></button>
            <button data-act="bag" class="min-h-[44px] sm:min-h-[48px] px-2.5 px-btn-primary font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5">${icon('bag')}<span>${ES.battle.bag}</span></button>
            <button data-act="party" class="min-h-[44px] sm:min-h-[48px] px-2.5 px-btn-success font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5">${icon('party')}<span>${ES.battle.party}</span></button>
            <button data-act="run" ${isWild ? '' : 'disabled'} class="min-h-[44px] sm:min-h-[48px] px-2.5 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 ${
              isWild
                ? 'px-btn-arcane'
                : 'rounded-none border-2 border-cold-stone bg-ash-purple text-bone-gray cursor-not-allowed'
            }">${icon('run')}<span>${ES.battle.run}</span></button>
          </div>
        </div>
      `;

      this.menuBox.querySelector('[data-act="fight"]')?.addEventListener('click', () => renderMoves());
      this.menuBox.querySelector('[data-act="bag"]')?.addEventListener('click', () => callbacks.onBag());
      this.menuBox.querySelector('[data-act="party"]')?.addEventListener('click', () => callbacks.onParty());
      this.menuBox.querySelector('[data-act="run"]')?.addEventListener('click', () => {
        if (isWild) callbacks.onRun();
      });
    };

    const enemyTypes = getSpecies(enemy.speciesId).types;

    const renderMoves = () => {
      const movesHtml = creature.moves
        .map((slot, idx) => {
          const m = getMove(slot.moveId);
          const v = TYPE_VISUALS[m.type];
          const disabled = slot.pp <= 0;
          const hint = getMoveEffectivenessHint(m.type, m.category, enemyTypes);
          const hintBadge = hint.label
            ? `<span class="px-1 py-[1px] rounded-none text-[9px] font-black border ${
                hint.tone === 'super'
                  ? 'bg-neon-mint border-deep-abyss text-ui-ink'
                  : hint.tone === 'immune'
                    ? 'bg-abyss-ink border-cold-stone text-bone-gray'
                    : 'bg-dried-blood border-rift-crimson text-pale-rose'
              }">${hint.label}</span>`
            : '';

          return `
            <button data-move="${idx}" ${disabled ? 'disabled' : ''} style="border-color:${v.border};background-color:#2A1F2D" class="min-h-[46px] sm:min-h-[50px] rounded-none border-2 p-1.5 sm:p-2 text-left flex flex-col justify-between shadow-[2px_2px_0_#050505] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
              disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-ash-purple'
            }">
              <div class="flex items-center justify-between gap-1">
                <span class="font-bold text-xs sm:text-sm text-warm-white truncate">${m.name}</span>
                <div class="flex items-center gap-1 shrink-0">
                  ${hintBadge}
                  <span class="px-1 py-[1px] rounded-none text-[8px] font-bold border" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[m.type]}</span>
                </div>
              </div>
              <div class="flex justify-between text-[10px] text-porcelain tabular-nums mt-0.5">
                <span>${ES.summary.power}: ${m.power || '—'}</span>
                <span>PP ${slot.pp}/${slot.maxPp}</span>
              </div>
            </button>
          `;
        })
        .join('');

      this.menuBox.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-2 gap-2">${movesHtml}</div>
          <button data-back class="min-h-[40px] sm:min-h-[44px] self-end px-3.5 px-btn-secondary text-xs font-bold">${ES.party.back}</button>
        </div>
      `;

      this.menuBox.querySelectorAll<HTMLElement>('[data-move]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.move);
          callbacks.onMove(i);
        });
      });
      this.menuBox.querySelector('[data-back]')?.addEventListener('click', () => renderRoot());
    };

    renderRoot();
  }

  hideMenu(): void {
    this.menuBox.classList.add('hidden');
    this.playerBox.classList.remove('mb-1', 'sm:mb-0');
    this.playerBox.classList.add('mb-[76px]', 'sm:mb-24');
  }

  showLearnMovePrompt(
    creature: CreatureInstance,
    newMoveId: string,
    onDecision: (replaceIndex: number | null) => void
  ): void {
    const newMove = getMove(newMoveId);
    const slotsHtml = creature.moves
      .map((slot, idx) => {
        const m = getMove(slot.moveId);
        return `
          <button data-slot="${idx}" class="min-h-[44px] w-full rounded-none border-2 border-cold-stone bg-crypt-ink hover:bg-blood-moon hover:border-rift-crimson p-2.5 text-left flex justify-between items-center shadow-[2px_2px_0_#050505]">
            <span class="font-bold text-sm">${m.name}</span>
            <span class="text-xs text-bone-gray tabular-nums">${ES.types[m.type]} · Pot ${m.power || '—'}</span>
          </button>
        `;
      })
      .join('');

    this.replaceModal.innerHTML = `
      <div class="w-full max-w-md max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto px-panel p-4">
        <div class="text-sm font-bold text-resonant-gold mb-2">${ES.battle.wantsToLearn(getCreatureDisplayName(creature), newMove.name)}</div>
        <div class="text-xs text-bone-gray mb-3">${newMove.name} (${ES.types[newMove.type]}, Pot. ${newMove.power || '—'}): ${newMove.description}</div>
        <div class="space-y-2 mb-3">${slotsHtml}</div>
        <button data-skip class="min-h-[44px] w-full px-btn-secondary text-sm font-bold">${ES.battle.skipMove}</button>
      </div>
    `;
    this.replaceModal.classList.remove('hidden');
    this.replaceModal.classList.add('flex');

    this.replaceModal.querySelectorAll<HTMLElement>('[data-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.replaceModal.classList.add('hidden');
        this.replaceModal.classList.remove('flex');
        onDecision(Number(btn.dataset.slot));
      });
    });
    this.replaceModal.querySelector('[data-skip]')?.addEventListener('click', () => {
      this.replaceModal.classList.add('hidden');
      this.replaceModal.classList.remove('flex');
      onDecision(null);
    });
  }

  dispose(): void {
    this.unmountPartRoots();
    this.fxOverlay.remove();
    this.root.remove();
  }
}

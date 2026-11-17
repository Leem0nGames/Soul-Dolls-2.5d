import React, { useMemo, useState } from 'react';
import { getItem } from '../../data/items.ts';
import { getMove } from '../../data/moves.ts';
import { getSpecies } from '../../data/species.ts';
import { getCreatureAbilityDef } from '../../domain/Abilities.ts';
import { BODY_PART_SHORT, computeBodyPartRatios } from '../../domain/BodyParts.ts';
import { ensureSoulDust, getSoulDust } from '../../domain/Cards.ts';
import { getCreatureDisplayName } from '../../domain/Creature.ts';
import {
  ALL_STAT_NAMES,
  craftTmScrollAtWorkshop,
  EV_TRAIN_COST,
  EV_TRAIN_STEP,
  forgeCreatureIvBoost,
  forgeMoveOnCreature,
  getAvailableAbilitiesForCreature,
  getCreatureAffinityTypes,
  getEvTotal,
  getForgeableMovesForCreature,
  getRelearnableMoves,
  getRemainingEvBudget,
  IV_FORGE_COST,
  MAX_EV_PER_STAT,
  MAX_EV_TOTAL,
  MAX_IV,
  RELEARN_MOVE_COST,
  relearnCreatureMove,
  TALLER_CRAFTABLE_TMS,
  trainCreatureAttribute,
  unlockOrSetCreatureAbility,
} from '../../domain/SkillForge.ts';
import type { CreatureInstance, MoveCategory, SaveData, StatName } from '../../domain/types.ts';
import type { AssetProvider } from '../../gfx/AssetProvider.ts';
import { ES } from '../../i18n/es.ts';
import { PxBadge, PxTypeBadge } from './PxBadge.tsx';
import { PxButton } from './PxButton.tsx';
import { PxNotice, type PxNoticeTone } from './PxNotice.tsx';
import { PxPanel, PxPanelHeader } from './PxPanel.tsx';
import { PxProgressBar } from './PxProgressBar.tsx';
import { PxSoulDustCounter } from './PxSoulDustCounter.tsx';
import { PxTabs, type PxTabItem } from './PxTabs.tsx';

export type SkillAcademyTab = 'movimientos' | 'pasivas' | 'atributos' | 'fuentes';

export interface SkillAcademyViewProps {
  save: SaveData;
  assets: AssetProvider;
  initialTab?: SkillAcademyTab;
  onMutated: () => void;
  onCraftSfx?: () => void;
  onOpenShop?: () => void;
  onClose: () => void;
}

const STAT_LABELS: Record<StatName, string> = {
  hp: 'PS',
  atk: ES.stats.atk,
  def: ES.stats.def,
  spa: ES.stats.spa,
  spd: ES.stats.spd,
  spe: ES.stats.spe,
};

const CATEGORY_LABELS: Record<MoveCategory, string> = {
  physical: 'Físico',
  special: 'Especial',
  status: 'Estado',
};

const TIER_BADGE: Record<'basico' | 'avanzado' | 'maestro', { label: string; tone: 'neutral' | 'cyan' | 'gold' }> = {
  basico: { label: 'Básico', tone: 'neutral' },
  avanzado: { label: 'Avanzado', tone: 'cyan' },
  maestro: { label: 'Maestro', tone: 'gold' },
};

export const SkillAcademyView: React.FC<SkillAcademyViewProps> = ({
  save,
  assets,
  initialTab = 'movimientos',
  onMutated,
  onCraftSfx,
  onOpenShop,
  onClose,
}) => {
  ensureSoulDust(save);

  const [tab, setTab] = useState<SkillAcademyTab>(initialTab);
  const [selectedPartyIdx, setSelectedPartyIdx] = useState(0);
  const [moveFilter, setMoveFilter] = useState<'all' | 'affinity' | 'common'>('all');
  const [pendingReplace, setPendingReplace] = useState<{
    mode: 'relearn' | 'forge';
    moveId: string;
    moveName: string;
  } | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: PxNoticeTone } | null>(null);
  const [, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);
  const dust = getSoulDust(save);
  const party = save.party;
  const activeDoll: CreatureInstance | undefined = party[selectedPartyIdx] ?? party[0];

  const tabs: PxTabItem<SkillAcademyTab>[] = [
    { id: 'movimientos', label: 'Técnicas & MT' },
    { id: 'pasivas', label: 'Pasivas' },
    { id: 'atributos', label: 'Atributos EV/IV' },
    { id: 'fuentes', label: '¿Cómo aprender?' },
  ];

  const handleSelectDoll = (idx: number) => {
    setSelectedPartyIdx(idx);
    setPendingReplace(null);
    setNotice(null);
  };

  const relearnable = useMemo(
    () => (activeDoll ? getRelearnableMoves(activeDoll) : []),
    [activeDoll, save.money, activeDoll?.moves.length]
  );

  const forgeableAll = useMemo(
    () => (activeDoll ? getForgeableMovesForCreature(save, activeDoll) : []),
    [activeDoll, save.badges.length, save.cardAlbum, activeDoll?.moves.length, activeDoll?.vesselCalibration]
  );

  const filteredForgeable = useMemo(() => {
    if (moveFilter === 'affinity') return forgeableAll.filter((o) => o.move.type !== 'comun');
    if (moveFilter === 'common') return forgeableAll.filter((o) => o.move.type === 'comun');
    return forgeableAll;
  }, [forgeableAll, moveFilter]);

  const passiveOptions = useMemo(
    () => (activeDoll ? getAvailableAbilitiesForCreature(activeDoll) : []),
    [activeDoll, activeDoll?.abilityId, activeDoll?.unlockedAbilities?.length, activeDoll?.vesselCalibration]
  );

  const handleLearnAction = (mode: 'relearn' | 'forge', moveId: string, replaceSlotIndex?: number) => {
    if (!activeDoll) return;
    const res =
      mode === 'relearn'
        ? relearnCreatureMove(save, activeDoll, moveId, replaceSlotIndex)
        : forgeMoveOnCreature(save, activeDoll, moveId, replaceSlotIndex);

    if (res.ok) {
      setPendingReplace(null);
      onCraftSfx?.();
      onMutated();
      setNotice({
        text: res.replacedMoveName
          ? `¡${getCreatureDisplayName(activeDoll)} olvidó ${res.replacedMoveName} y dominó ${res.moveName}!`
          : `¡${getCreatureDisplayName(activeDoll)} aprendió ${res.moveName}!`,
        tone: 'success',
      });
      refresh();
      return;
    }

    if (res.reason === 'need_slot') {
      const mName = forgeableAll.find((o) => o.move.id === moveId)?.move.name ??
        relearnable.find((m) => m.id === moveId)?.name ??
        moveId;
      setPendingReplace({ mode, moveId, moveName: mName });
      setNotice({
        text: `${getCreatureDisplayName(activeDoll)} ya domina 4 técnicas. Elige cuál reemplazar por ${mName}.`,
        tone: 'info',
      });
      return;
    }

    if (res.reason === 'no_dust') {
      setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
    } else if (res.reason === 'no_money') {
      setNotice({ text: ES.shop.noMoney, tone: 'danger' });
    } else {
      setNotice({ text: 'No se pudo completar el aprendizaje.', tone: 'warning' });
    }
  };

  const renderPartyBar = () => {
    if (party.length === 0) {
      return (
        <PxPanel variant="card" padding="md" className="text-center text-xs text-bone-gray">
          No llevas SoulDolls en tu equipo. Despierta una en el Taller o habla con el Prof. Robledo.
        </PxPanel>
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 mb-3">
        {party.map((doll, idx) => {
          const sp = getSpecies(doll.speciesId);
          const selected = idx === selectedPartyIdx;
          return (
            <button
              key={doll.uid}
              type="button"
              onClick={() => handleSelectDoll(idx)}
              className={`px-panel px-card p-1.5 flex items-center gap-2 text-left min-h-[48px] ${
                selected ? 'border-ki-cyan bg-deep-abyss' : 'border-ash-purple'
              }`}
            >
              <img
                src={assets.getCreatureDataUrl(doll.speciesId, 'front')}
                data-souldoll-id={doll.speciesId}
                data-souldoll-view="front"
                className="souldoll-img w-8 h-8 object-contain shrink-0"
                alt={sp.name}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-warm-white truncate">
                  {getCreatureDisplayName(doll)}
                </div>
                <div className="text-[10px] text-bone-gray tabular-nums">
                  Nv.{doll.level} · {doll.moves.length}/4 téc.
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderMovimientosTab = () => {
    if (!activeDoll) return null;
    const affinityTypes = getCreatureAffinityTypes(activeDoll);
    const hasRune = Boolean(activeDoll.vesselCalibration?.affinityOverride);

    return (
      <div className="space-y-3">
        {/* Técnicas actuales */}
        <PxPanel variant="card" padding="sm" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-resonant-gold">
                Ranuras Activas ({activeDoll.moves.length}/4)
              </span>
              {affinityTypes.map((t) => (
                <PxTypeBadge key={t} type={t} size="chip" />
              ))}
              {hasRune && (
                <PxBadge tone="violet" size="xs">
                  Runa Activa
                </PxBadge>
              )}
            </div>
            <span className="text-[11px] text-bone-gray">
              Compatibles: Común + tipos/runa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeDoll.moves.map((slot, idx) => (
              <MoveSlotCard
                key={`${slot.moveId}-${idx}`}
                slotIdx={idx}
                moveId={slot.moveId}
                pp={slot.pp}
                maxPp={slot.maxPp}
                replacingFor={pendingReplace?.moveName}
                onReplace={
                  pendingReplace
                    ? () => handleLearnAction(pendingReplace.mode, pendingReplace.moveId, idx)
                    : undefined
                }
              />
            ))}
          </div>

          {pendingReplace && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-ash-purple">
              <span className="text-xs text-ki-cyan font-bold">
                Elige una ranura arriba para aprender {pendingReplace.moveName}.
              </span>
              <PxButton
                variant="secondary"
                size="xs"
                onClick={() => {
                  setPendingReplace(null);
                  setNotice(null);
                }}
              >
                Cancelar cambio
              </PxButton>
            </div>
          )}
        </PxPanel>

        {/* Recordador de técnicas naturales */}
        <PxPanel variant="card" padding="sm" className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-ki-cyan">
              Recordador de Técnicas ({relearnable.length})
            </span>
            <span className="text-[11px] text-bone-gray tabular-nums">
              Recordar técnica previa de especie: {RELEARN_MOVE_COST.gold} ◈
            </span>
          </div>
          {relearnable.length === 0 ? (
            <div className="text-xs text-bone-gray">
              Esta SoulDoll ya conoce todas las técnicas naturales disponibles hasta su nivel actual.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {relearnable.map((m) => {
                const canPay = save.money >= RELEARN_MOVE_COST.gold;
                return (
                  <div
                    key={m.id}
                    className="px-panel px-card p-2 border-ash-purple flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-warm-white">{m.name}</span>
                        <PxTypeBadge type={m.type} size="chip" />
                      </div>
                      <div className="text-[10px] text-bone-gray tabular-nums">
                        {CATEGORY_LABELS[m.category]} · Pot {m.power || '—'} · Prec {m.accuracy}% · PP {m.pp}
                      </div>
                    </div>
                    <PxButton
                      variant={canPay ? 'arcane' : 'secondary'}
                      size="xs"
                      disabled={!canPay}
                      onClick={() => handleLearnAction('relearn', m.id)}
                    >
                      Recordar ({RELEARN_MOVE_COST.gold} ◈)
                    </PxButton>
                  </div>
                );
              })}
            </div>
          )}
        </PxPanel>

        {/* Forja de Nuevas Técnicas */}
        <PxPanel variant="card" padding="sm" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-resonant-gold">
              Forja de Técnicas ({filteredForgeable.length})
            </span>
            <div className="flex gap-1">
              {(
                [
                  ['all', 'Todas'],
                  ['affinity', 'Elementales'],
                  ['common', 'Comunes'],
                ] as const
              ).map(([fid, label]) => (
                <PxButton
                  key={fid}
                  variant={moveFilter === fid ? 'primary' : 'secondary'}
                  size="xs"
                  showSelector={false}
                  onClick={() => setMoveFilter(fid)}
                >
                  {label}
                </PxButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredForgeable.map((opt) => {
              const tBadge = TIER_BADGE[opt.tier];
              const canForge =
                opt.unlocked && save.money >= opt.goldCost && dust >= opt.dustCost;
              const tmRecipe = opt.tmItemId
                ? TALLER_CRAFTABLE_TMS.find((t) => t.itemId === opt.tmItemId)
                : undefined;
              const canCraftTm =
                tmRecipe && save.money >= tmRecipe.goldCost && dust >= tmRecipe.dustCost;

              return (
                <div
                  key={opt.move.id}
                  className={`px-panel px-card p-2.5 flex flex-col justify-between gap-2 ${
                    opt.unlocked ? 'border-old-bronze' : 'border-ash-purple opacity-80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-warm-white">{opt.move.name}</span>
                        <PxTypeBadge type={opt.move.type} size="chip" />
                        <PxBadge tone={tBadge.tone} size="xs">
                          {tBadge.label}
                        </PxBadge>
                        {opt.viaRune && (
                          <PxBadge tone="violet" size="xs">
                            Runa
                          </PxBadge>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-ki-cyan tabular-nums">
                        {CATEGORY_LABELS[opt.move.category]}
                      </span>
                    </div>
                    <div className="text-[10px] text-bone-gray tabular-nums">
                      Pot {opt.move.power || '—'} · Prec {opt.move.accuracy}% · PP {opt.move.pp}
                      {opt.move.priority > 0 ? ` · Prioridad +${opt.move.priority}` : ''}
                    </div>
                    <div className="text-[11px] text-porcelain leading-snug">
                      {opt.move.description}
                    </div>
                    {opt.unlockedByCard && (
                      <div className="text-[10px] text-neon-mint">
                        ★ Desbloqueo anticipado gracias a tu Carta SoulDoll
                      </div>
                    )}
                    {opt.reasonLocked && (
                      <div className="text-[10px] text-pale-gold">🔒 {opt.reasonLocked}</div>
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-ash-purple flex flex-wrap gap-1.5">
                    <PxButton
                      variant={canForge ? 'success' : 'secondary'}
                      size="xs"
                      disabled={!canForge}
                      onClick={() => handleLearnAction('forge', opt.move.id)}
                    >
                      Forjar ({opt.goldCost} ◈ + {opt.dustCost} Polvo)
                    </PxButton>
                    {tmRecipe && (
                      <PxButton
                        variant={canCraftTm ? 'violet' : 'secondary'}
                        size="xs"
                        disabled={!canCraftTm}
                        onClick={() => {
                          const res = craftTmScrollAtWorkshop(save, tmRecipe.itemId);
                          if (res.ok) {
                            onCraftSfx?.();
                            onMutated();
                            setNotice({
                              text: `¡Grabaste 1× ${res.itemName} en tu Mochila (Discos MT)!`,
                              tone: 'success',
                            });
                          } else {
                            setNotice({
                              text: res.reason === 'no_dust' ? 'Polvo insuficiente.' : ES.shop.noMoney,
                              tone: 'warning',
                            });
                          }
                          refresh();
                        }}
                      >
                        Crear MT ({tmRecipe.goldCost} ◈ + {tmRecipe.dustCost}p)
                      </PxButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PxPanel>
      </div>
    );
  };

  const renderPasivasTab = () => {
    if (!activeDoll) return null;
    const currentAbility = getCreatureAbilityDef(activeDoll);

    return (
      <div className="space-y-3">
        <PxPanel variant="card" padding="sm" className="border-ki-cyan space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ki-cyan">
            Habilidad Pasiva Activa
          </div>
          <div className="text-sm font-bold text-warm-white">
            {currentAbility?.name ?? 'Sin habilidad'}
          </div>
          <div className="text-xs text-porcelain">
            {currentAbility?.description ?? 'Despierta una habilidad pasiva compatible abajo.'}
          </div>
        </PxPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {passiveOptions.map((opt) => {
            const canAfford = save.money >= opt.goldCost && dust >= opt.dustCost;
            return (
              <PxPanel
                key={opt.ability.id}
                variant="card"
                padding="sm"
                className={`flex flex-col justify-between gap-2 ${
                  opt.active
                    ? 'border-resonant-gold bg-dark-oak'
                    : opt.unlocked
                      ? 'border-ki-cyan'
                      : 'border-ash-purple'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-warm-white">{opt.ability.name}</span>
                    <div className="flex items-center gap-1">
                      <PxBadge
                        tone={
                          opt.source === 'innate'
                            ? 'gold'
                            : opt.source === 'rune'
                              ? 'violet'
                              : 'cyan'
                        }
                        size="xs"
                      >
                        {opt.source === 'innate'
                          ? 'Innata'
                          : opt.source === 'rune'
                            ? 'Runa'
                            : 'Forjada'}
                      </PxBadge>
                      {opt.active && (
                        <PxBadge tone="emerald" size="xs">
                          Activa
                        </PxBadge>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-porcelain leading-snug m-0">
                    {opt.ability.description}
                  </p>
                </div>

                <div className="pt-1.5 border-t border-ash-purple flex items-center justify-between gap-2">
                  <span className="text-[10px] text-bone-gray tabular-nums">
                    {opt.active
                      ? 'Equipada ahora'
                      : opt.unlocked
                        ? `Ya desbloqueada · Cambiar: ${opt.goldCost} ◈`
                        : `Forjar: ${opt.goldCost} ◈ + ${opt.dustCost} Polvo`}
                  </span>
                  <PxButton
                    variant={
                      opt.active
                        ? 'secondary'
                        : !canAfford
                          ? 'secondary'
                          : opt.unlocked
                            ? 'arcane'
                            : 'violet'
                    }
                    size="xs"
                    disabled={opt.active || !canAfford}
                    onClick={() => {
                      const res = unlockOrSetCreatureAbility(save, activeDoll, opt.ability.id);
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: res.newlyForged
                            ? `¡Forjaste y equipaste ${res.abilityName} en ${getCreatureDisplayName(activeDoll)}!`
                            : `¡${getCreatureDisplayName(activeDoll)} ahora usa ${res.abilityName}!`,
                          tone: 'success',
                        });
                      } else {
                        setNotice({
                          text: res.reason === 'no_dust' ? 'Polvo insuficiente.' : ES.shop.noMoney,
                          tone: 'warning',
                        });
                      }
                      refresh();
                    }}
                  >
                    {opt.active ? 'Equipada' : opt.unlocked ? 'Activar' : 'Forjar'}
                  </PxButton>
                </div>
              </PxPanel>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAtributosTab = () => {
    if (!activeDoll) return null;
    const evTotal = getEvTotal(activeDoll);
    const remainingBudget = getRemainingEvBudget(activeDoll);
    const previewRatios = computeBodyPartRatios(
      activeDoll.containerId ?? 'cuerpo_aprendiz',
      activeDoll.ivs,
      activeDoll.evBonuses,
      activeDoll.vesselCalibration
    );

    return (
      <div className="space-y-3">
        <PxPanel variant="card" padding="sm" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-resonant-gold">Entrenamiento de Atributos (EV)</span>
              <span className="text-bone-gray"> · Cada sesión suma +{EV_TRAIN_STEP} EV (máx. {MAX_EV_PER_STAT}/stat)</span>
            </div>
            <span className="font-bold text-ki-cyan tabular-nums">
              Presupuesto: {evTotal}/{MAX_EV_TOTAL} EV (Resta {remainingBudget})
            </span>
          </div>
          <PxProgressBar
            value={evTotal}
            max={MAX_EV_TOTAL}
            tone={evTotal >= MAX_EV_TOTAL ? 'gold' : 'cyan'}
            height="sm"
            ariaLabel="Presupuesto EV total"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-bone-gray pt-1 border-t border-ash-purple">
            <span>Los atributos moldean también el reparto anatómico del armazón:</span>
            <span className="text-porcelain font-bold tabular-nums">
              {BODY_PART_SHORT.head} {previewRatios.head}% · {BODY_PART_SHORT.torso}{' '}
              {previewRatios.torso}% · {BODY_PART_SHORT.arms} {previewRatios.arms}% ·{' '}
              {BODY_PART_SHORT.legs} {previewRatios.legs}%
            </span>
          </div>
        </PxPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {ALL_STAT_NAMES.map((stat) => {
            const evVal = activeDoll.evBonuses?.[stat] ?? 0;
            const ivVal = activeDoll.ivs[stat];
            const cardBonus = activeDoll.socketedCardBonuses?.[stat] ?? 0;
            const totalStat = activeDoll.stats[stat];

            const canTrainEv =
              evVal < MAX_EV_PER_STAT &&
              remainingBudget > 0 &&
              save.money >= EV_TRAIN_COST.gold &&
              dust >= EV_TRAIN_COST.dust;
            const canForgeIv =
              ivVal < MAX_IV && save.money >= IV_FORGE_COST.gold && dust >= IV_FORGE_COST.dust;

            return (
              <PxPanel key={stat} variant="card" padding="sm" className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-warm-white">
                      {STAT_LABELS[stat]}{' '}
                      <span className="text-base text-resonant-gold tabular-nums">{totalStat}</span>
                      {cardBonus > 0 && (
                        <span className="text-[11px] text-ki-cyan tabular-nums ml-1">
                          (+{cardBonus} Carta)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-bone-gray tabular-nums">
                      IV: <strong className="text-porcelain">{ivVal}/{MAX_IV}</strong> · EV:{' '}
                      <strong className="text-ki-cyan">+{evVal}/{MAX_EV_PER_STAT}</strong>
                    </div>
                  </div>
                  <PxBadge
                    tone={evVal >= MAX_EV_PER_STAT ? 'gold' : evVal > 0 ? 'cyan' : 'neutral'}
                    size="xs"
                  >
                    {evVal >= MAX_EV_PER_STAT ? 'EV Máx' : `+${evVal} EV`}
                  </PxBadge>
                </div>

                <PxProgressBar
                  value={evVal}
                  max={MAX_EV_PER_STAT}
                  tone={evVal >= MAX_EV_PER_STAT ? 'gold' : 'cyan'}
                  height="sm"
                  ariaLabel={`EV de ${STAT_LABELS[stat]}`}
                />

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <PxButton
                    variant={canTrainEv ? 'success' : 'secondary'}
                    size="xs"
                    disabled={!canTrainEv}
                    onClick={() => {
                      const res = trainCreatureAttribute(save, activeDoll, stat);
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: `¡Entrenamiento en ${STAT_LABELS[stat]} (+${res.added} EV) completado para ${res.dollName}!`,
                          tone: 'success',
                        });
                      } else if (res.reason === 'no_dust') {
                        setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
                      } else if (res.reason === 'no_money') {
                        setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                      }
                      refresh();
                    }}
                  >
                    +{EV_TRAIN_STEP} EV ({EV_TRAIN_COST.gold} ◈ + {EV_TRAIN_COST.dust}p)
                  </PxButton>
                  <PxButton
                    variant={canForgeIv ? 'arcane' : 'secondary'}
                    size="xs"
                    disabled={!canForgeIv}
                    onClick={() => {
                      const res = forgeCreatureIvBoost(save, activeDoll, stat);
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: `¡Potencial ${STAT_LABELS[stat]} templado a IV ${res.newIv}/${MAX_IV}!`,
                          tone: 'info',
                        });
                      } else if (res.reason === 'no_dust') {
                        setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
                      } else if (res.reason === 'no_money') {
                        setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                      }
                      refresh();
                    }}
                  >
                    {ivVal >= MAX_IV
                      ? `IV ${MAX_IV}/${MAX_IV}`
                      : `+1 IV (${IV_FORGE_COST.gold} ◈ + ${IV_FORGE_COST.dust}p)`}
                  </PxButton>
                </div>
              </PxPanel>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFuentesTab = () => (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <PxPanel variant="card" padding="sm" className="space-y-1.5 border-ki-cyan">
          <div className="text-xs font-bold text-ki-cyan">1. Subida de Nivel & Recordador</div>
          <p className="text-[11px] text-porcelain leading-relaxed m-0">
            Cada especie desbloquea técnicas naturales al subir de nivel en combate. Si olvidaste una o capturaste un alma a nivel alto, usa el{' '}
            <strong className="text-resonant-gold">Recordador de Técnicas</strong> aquí por {RELEARN_MOVE_COST.gold} ◈.
          </p>
        </PxPanel>

        <PxPanel variant="card" padding="sm" className="space-y-1.5 border-resonant-gold">
          <div className="text-xs font-bold text-resonant-gold">2. Forja de Técnicas & Pasivas</div>
          <p className="text-[11px] text-porcelain leading-relaxed m-0">
            En este <strong className="text-ki-cyan">Altar de Habilidades</strong> puedes forjar nuevas técnicas y despertar{' '}
            <strong className="text-ethereal-orchid">Habilidades Pasivas</strong> con Oro + Polvo de Alma. Grabar una{' '}
            <strong>Runa Elemental</strong> en el armazón amplía las técnicas y pasivas compatibles.
          </p>
        </PxPanel>

        <PxPanel variant="card" padding="sm" className="space-y-1.5 border-old-bronze">
          <div className="text-xs font-bold text-pale-gold">3. Comercio de Maestra Lyra (MT & Tónicos)</div>
          <p className="text-[11px] text-porcelain leading-relaxed m-0">
            Maestra Lyra comercia <strong className="text-ki-cyan">Discos MT</strong> (técnicas portátiles para usar desde la Mochila),{' '}
            <strong className="text-neon-mint">Tónicos de Atributos (+4 EV)</strong> y Fragmentos de Alma.
          </p>
        </PxPanel>

        <PxPanel variant="card" padding="sm" className="space-y-1.5 border-soul-violet">
          <div className="text-xs font-bold text-lavender-mist">4. Cartas SoulDoll, EVs & Visor AR</div>
          <p className="text-[11px] text-porcelain leading-relaxed m-0">
            Tener la <strong className="text-resonant-gold">Carta SoulDoll</strong> de una especie adelanta 5 niveles el acceso a sus técnicas maestras. El{' '}
            <strong>Polvo de Alma</strong> (desencantando cartas o piezas) alimenta la Forja de Pasivas y Entrenamiento EV/IV; los{' '}
            <strong>Fragmentos de Alma AR</strong> también invocan técnicas raras.
          </p>
        </PxPanel>
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <PxButton variant="arcane" size="sm" onClick={() => setTab('movimientos')}>
          Ir a Forjar Técnicas
        </PxButton>
        <PxButton variant="primary" size="sm" onClick={() => setTab('atributos')}>
          Ir a Entrenar Atributos
        </PxButton>
        {onOpenShop && (
          <PxButton variant="success" size="sm" onClick={onOpenShop}>
            Comercio de Lyra (MT y Tónicos)
          </PxButton>
        )}
      </div>
    </div>
  );

  return (
    <PxPanel
      variant="cyan"
      padding="md"
      ornate
      className="w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] flex flex-col text-porcelain"
    >
      <PxPanelHeader
        title="ALTAR DE HABILIDADES Y ATRIBUTOS"
        ornate
        subtitle="Forja técnicas de Ki, despierta habilidades pasivas y entrena atributos EV/IV"
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <PxBadge tone="gold" size="md">
              {save.money} ◈
            </PxBadge>
            <PxSoulDustCounter amount={dust} compact />
            {onOpenShop && (
              <PxButton variant="arcane" size="md" onClick={onOpenShop}>
                Comercio MT
              </PxButton>
            )}
            <PxButton variant="secondary" size="md" onClick={onClose}>
              Salir
            </PxButton>
          </div>
        }
      />

      <PxTabs
        items={tabs}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPendingReplace(null);
          setNotice(null);
        }}
        columns={4}
        size="sm"
        className="mb-3"
      />

      {tab !== 'fuentes' && renderPartyBar()}

      {notice && (
        <PxNotice tone={notice.tone} className="mb-2.5">
          {notice.text}
        </PxNotice>
      )}

      <div className="touch-scroll overflow-y-auto pr-0.5 flex-1">
        {tab === 'movimientos' && renderMovimientosTab()}
        {tab === 'pasivas' && renderPasivasTab()}
        {tab === 'atributos' && renderAtributosTab()}
        {tab === 'fuentes' && renderFuentesTab()}
      </div>
    </PxPanel>
  );
};

interface MoveSlotCardProps {
  slotIdx: number;
  moveId: string;
  pp: number;
  maxPp: number;
  replacingFor?: string;
  onReplace?: () => void;
}

const MoveSlotCard: React.FC<MoveSlotCardProps> = ({
  slotIdx,
  moveId,
  pp,
  maxPp,
  replacingFor,
  onReplace,
}) => {
  const m = getMove(moveId);
  return (
    <div
      className={`px-panel px-card p-2 flex flex-col justify-between gap-1.5 ${
        onReplace ? 'border-resonant-gold bg-dark-oak' : 'border-ash-purple'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold text-bone-gray tabular-nums">#{slotIdx + 1}</span>
          <span className="text-xs font-bold text-warm-white truncate">{m.name}</span>
        </div>
        <PxTypeBadge type={m.type} size="chip" />
      </div>
      <div className="flex items-center justify-between text-[10px] text-bone-gray tabular-nums">
        <span>
          {CATEGORY_LABELS[m.category]} · Pot {m.power || '—'} · Prec {m.accuracy}%
        </span>
        <span>
          PP {pp}/{maxPp}
        </span>
      </div>
      {onReplace && (
        <PxButton variant="primary" size="xs" onClick={onReplace}>
          Reemplazar por {replacingFor ?? 'nueva'}
        </PxButton>
      )}
    </div>
  );
};

export function getSkillTmItemName(itemId: string): string {
  return getItem(itemId).name;
}

export default SkillAcademyView;

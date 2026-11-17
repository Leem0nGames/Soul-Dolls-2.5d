import React, { useMemo, useState } from 'react';
import type { Rng } from '../../core/Rng.ts';
import {
  ALL_CONTAINER_IDS,
  getBodyContainer,
  SHARDS_PER_CONTAINER,
} from '../../data/containers.ts';
import { getSpecies } from '../../data/species.ts';
import {
  BODY_PART_LABELS,
  BODY_PART_SHORT,
  computeBodyPartRatios,
  ensureSaveVesselState,
  getContainerAffinityMatch,
} from '../../domain/BodyParts.ts';
import { ensureSoulDust, getSoulDust } from '../../domain/Cards.ts';
import { getCreatureDisplayName } from '../../domain/Creature.ts';
import { ensureSaveSideQuestState } from '../../domain/SideQuests.ts';
import {
  computeCalibrationCost,
  craftContainerAtWorkshop,
  createCustomSoulDollFromReserve,
  dismantleVesselAtWorkshop,
  getBlueprintForContainer,
  getWorkshopRecipe,
  isContainerRecipeUnlocked,
  modifyPartySoulDollBody,
  synthesizeShardFromDust,
  unlockWorkshopBlueprint,
  WORKSHOP_FOCUS_DUST,
  WORKSHOP_FOCUS_GOLD,
  WORKSHOP_MAX_TEMPER,
  WORKSHOP_RUNE_DUST,
  WORKSHOP_RUNE_GOLD,
  WORKSHOP_SHARD_SYNTH_DUST,
  WORKSHOP_SHARD_SYNTH_GOLD,
} from '../../domain/Workshop.ts';
import type {
  BodyPartName,
  CreatureType,
  SaveData,
  Stats,
  VesselCalibration,
} from '../../domain/types.ts';
import type { AssetProvider } from '../../gfx/AssetProvider.ts';
import { ES } from '../../i18n/es.ts';
import { PxBadge, PxTypeBadge } from './PxBadge.tsx';
import { PxButton } from './PxButton.tsx';
import { PxNotice, type PxNoticeTone } from './PxNotice.tsx';
import { PxPanel, PxPanelHeader } from './PxPanel.tsx';
import { PxProgressBar } from './PxProgressBar.tsx';
import { PxSoulDustCounter } from './PxSoulDustCounter.tsx';
import { PxTabs, type PxTabItem } from './PxTabs.tsx';

export type WorkshopTab = 'forja' | 'creacion' | 'piezas' | 'cuerpos';

export interface WorkshopViewProps {
  save: SaveData;
  rng: Rng;
  assets: AssetProvider;
  initialTab?: WorkshopTab;
  onMutated: () => void;
  onCraftSfx?: () => void;
  onClose: () => void;
}

const ALL_TYPES: readonly CreatureType[] = [
  'brasa',
  'marea',
  'flora',
  'chispa',
  'roca',
  'brisa',
  'umbra',
  'comun',
];

const FOCUS_OPTIONS: ReadonlyArray<{ id: 'balanced' | BodyPartName; label: string }> = [
  { id: 'balanced', label: 'Equilibrado' },
  { id: 'head', label: '+Cabeza' },
  { id: 'torso', label: '+Torso' },
  { id: 'arms', label: '+Brazos' },
  { id: 'legs', label: '+Piernas' },
];

const NEUTRAL_IVS: Stats = { hp: 7, atk: 7, def: 7, spa: 7, spd: 7, spe: 7 };

const RARITY_BADGE: Record<'common' | 'rare' | 'epic', { label: string; tone: 'neutral' | 'cyan' | 'gold' }> = {
  common: { label: 'Común', tone: 'neutral' },
  rare: { label: 'Raro', tone: 'cyan' },
  epic: { label: 'Épico', tone: 'gold' },
};

export const WorkshopView: React.FC<WorkshopViewProps> = ({
  save,
  rng,
  assets,
  initialTab = 'forja',
  onMutated,
  onCraftSfx,
  onClose,
}) => {
  ensureSaveVesselState(save);
  ensureSaveSideQuestState(save);
  ensureSoulDust(save);

  const [tab, setTab] = useState<WorkshopTab>(initialTab);
  const [notice, setNotice] = useState<{ text: string; tone: PxNoticeTone } | null>(null);
  const [, setTick] = useState(0);

  // Creación / Moldeo state
  const reserve = save.soulReserve ?? [];
  const vessels = save.vessels ?? {};
  const ownedContainerIds = ALL_CONTAINER_IDS.filter((id) => (vessels[id] ?? 0) > 0);

  const [createSource, setCreateSource] = useState<'reserve' | 'party'>(
    reserve.length > 0 ? 'reserve' : 'party'
  );
  const [selectedSoulUid, setSelectedSoulUid] = useState<string>(reserve[0]?.uid ?? '');
  const [selectedPartyIdx, setSelectedPartyIdx] = useState<number>(0);
  const [selectedContainerId, setSelectedContainerId] = useState<string>(
    ownedContainerIds[0] ?? 'cuerpo_aprendiz'
  );
  const [focusSelection, setFocusSelection] = useState<'balanced' | BodyPartName>('balanced');
  const [temperTarget, setTemperTarget] = useState<number>(0);
  const [runeSelection, setRuneSelection] = useState<'none' | CreatureType>('none');

  const refresh = () => setTick((t) => t + 1);

  const dust = getSoulDust(save);
  const shards = save.bodyPartShards ?? {};
  const totalVessels = ownedContainerIds.reduce((sum, id) => sum + (vessels[id] ?? 0), 0);

  const selectPartyMember = (idx: number) => {
    setSelectedPartyIdx(idx);
    const doll = save.party[idx];
    if (doll) {
      setSelectedContainerId(doll.containerId ?? 'cuerpo_aprendiz');
      setFocusSelection(doll.vesselCalibration?.focusPart ?? 'balanced');
      setTemperTarget(doll.vesselCalibration?.temperLevel ?? 0);
      setRuneSelection(doll.vesselCalibration?.affinityOverride ?? 'none');
    }
  };

  const handleModeSwitch = (mode: 'reserve' | 'party') => {
    setCreateSource(mode);
    setNotice(null);
    if (mode === 'party' && save.party.length > 0) {
      selectPartyMember(Math.min(selectedPartyIdx, save.party.length - 1));
    } else if (mode === 'reserve') {
      setSelectedContainerId(ownedContainerIds[0] ?? 'cuerpo_aprendiz');
      setFocusSelection('balanced');
      setTemperTarget(0);
      setRuneSelection('none');
    }
  };

  const jumpToCreateWithContainer = (cid: string, mode: 'reserve' | 'party') => {
    setTab('creacion');
    setCreateSource(mode);
    setSelectedContainerId(cid);
    if (mode === 'party' && save.party.length > 0) {
      const doll = save.party[selectedPartyIdx] ?? save.party[0];
      if (doll) {
        setFocusSelection(doll.vesselCalibration?.focusPart ?? 'balanced');
        setTemperTarget(doll.vesselCalibration?.temperLevel ?? 0);
        setRuneSelection(doll.vesselCalibration?.affinityOverride ?? 'none');
      }
    } else {
      setFocusSelection('balanced');
      setTemperTarget(0);
      setRuneSelection('none');
    }
    setNotice(null);
  };

  const tabs: PxTabItem<WorkshopTab>[] = [
    { id: 'forja', label: ES.vessels.forgeTab },
    { id: 'creacion', label: ES.vessels.createTab },
    { id: 'piezas', label: ES.vessels.shardsTab },
    { id: 'cuerpos', label: `${ES.vessels.containersTab} (${totalVessels})` },
  ];

  // Active target preview in Creación / Moldeo
  const activeSoul = reserve.find((s) => s.uid === selectedSoulUid) ?? reserve[0];
  const activeDoll = save.party[selectedPartyIdx] ?? save.party[0];

  const previewCalibration: VesselCalibration = useMemo(
    () => ({
      ...(focusSelection !== 'balanced' ? { focusPart: focusSelection } : {}),
      ...(temperTarget > 0 ? { temperLevel: temperTarget } : {}),
      ...(runeSelection !== 'none' ? { affinityOverride: runeSelection } : {}),
    }),
    [focusSelection, temperTarget, runeSelection]
  );

  const renderForjaTab = () => (
    <div className="space-y-2.5">
      <div className="px-panel px-card p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-porcelain">
          Forja armazones con <strong className="text-resonant-gold">Oro</strong> o reduce el precio combinando{' '}
          <strong className="text-ethereal-orchid">Polvo de Alma</strong>.
        </span>
        <span className="text-bone-gray tabular-nums">
          Planos: {ALL_CONTAINER_IDS.filter((cid) => isContainerRecipeUnlocked(save, cid)).length}/
          {ALL_CONTAINER_IDS.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {ALL_CONTAINER_IDS.map((cid) => {
          const cdef = getBodyContainer(cid);
          const bp = getBlueprintForContainer(cid);
          const recipe = getWorkshopRecipe(cid);
          const unlocked = isContainerRecipeUnlocked(save, cid);
          const stock = vessels[cid] ?? 0;
          const rBadge = RARITY_BADGE[cdef.rarity];

          const canGold = unlocked && save.money >= bp.craftGoldCost;
          const canMix =
            unlocked &&
            save.money >= recipe.dustForgeDiscountGold &&
            dust >= recipe.dustForgeCost;

          return (
            <PxPanel
              key={cid}
              variant="card"
              padding="sm"
              className={`flex flex-col justify-between gap-2 ${
                unlocked ? 'border-old-bronze' : 'border-ash-purple opacity-90'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-warm-white truncate">
                        {cdef.name}
                      </span>
                      <PxBadge tone={rBadge.tone} size="xs">
                        {rBadge.label}
                      </PxBadge>
                    </div>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {cdef.affinityTypes.map((t) => (
                        <PxTypeBadge key={t} type={t} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <PxBadge tone={stock > 0 ? 'gold' : 'neutral'} size="sm">
                      Stock ×{stock}
                    </PxBadge>
                  </div>
                </div>

                <p className="text-[11px] text-bone-gray leading-snug m-0">{cdef.description}</p>

                <div className="text-[11px] text-ki-cyan tabular-nums font-bold">
                  Cab {cdef.ratios.head}% · Tor {cdef.ratios.torso}% · Bra {cdef.ratios.arms}% · Pie{' '}
                  {cdef.ratios.legs}%
                </div>
              </div>

              {unlocked ? (
                <div className="pt-1.5 border-t border-ash-purple flex flex-wrap gap-1.5">
                  <PxButton
                    variant={canGold ? 'primary' : 'secondary'}
                    size="xs"
                    disabled={!canGold}
                    onClick={() => {
                      const res = craftContainerAtWorkshop(save, cid, 'gold');
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: `¡Forjaste 1× ${res.containerName} por ${bp.craftGoldCost} ◈!`,
                          tone: 'success',
                        });
                      } else {
                        setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                      }
                      refresh();
                    }}
                  >
                    Forjar ({bp.craftGoldCost} ◈)
                  </PxButton>
                  <PxButton
                    variant={canMix ? 'violet' : 'secondary'}
                    size="xs"
                    disabled={!canMix}
                    onClick={() => {
                      const res = craftContainerAtWorkshop(save, cid, 'dust_mix');
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: `¡Forja mixta completada: 1× ${res.containerName}!`,
                          tone: 'success',
                        });
                      } else if (res.reason === 'no_dust') {
                        setNotice({
                          text: `Necesitas ${recipe.dustForgeCost} Polvo de Alma.`,
                          tone: 'warning',
                        });
                      } else {
                        setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                      }
                      refresh();
                    }}
                  >
                    {recipe.dustForgeDiscountGold} ◈ + {recipe.dustForgeCost} Polvo
                  </PxButton>
                </div>
              ) : recipe.workshopLearnCost ? (
                <div className="pt-1.5 border-t border-ash-purple flex items-center justify-between gap-2">
                  <span className="text-[11px] text-bone-gray">Plano secreto del taller</span>
                  <PxButton
                    variant={
                      save.money >= recipe.workshopLearnCost.gold &&
                      dust >= recipe.workshopLearnCost.dust
                        ? 'arcane'
                        : 'secondary'
                    }
                    size="xs"
                    disabled={
                      save.money < recipe.workshopLearnCost.gold ||
                      dust < recipe.workshopLearnCost.dust
                    }
                    onClick={() => {
                      const res = unlockWorkshopBlueprint(save, cid);
                      if (res.ok) {
                        onCraftSfx?.();
                        onMutated();
                        setNotice({
                          text: `¡Aprendiste ${res.blueprintName}! Ya puedes forjarlo.`,
                          tone: 'info',
                        });
                      } else if (res.reason === 'no_dust') {
                        setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
                      } else {
                        setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                      }
                      refresh();
                    }}
                  >
                    Estudiar ({recipe.workshopLearnCost.gold} ◈ + {recipe.workshopLearnCost.dust} Polvo)
                  </PxButton>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-ash-purple text-[11px] text-pale-gold">
                  🔒 {recipe.questHint ?? 'Desbloquea este plano completando misiones.'}
                </div>
              )}
            </PxPanel>
          );
        })}
      </div>
    </div>
  );

  const renderCreacionTab = () => {
    const isParty = createSource === 'party';
    const targetCreature = isParty ? activeDoll : undefined;
    const speciesId = isParty ? targetCreature?.speciesId : activeSoul?.speciesId;
    const species = speciesId ? getSpecies(speciesId) : null;

    const currentCid = isParty ? (targetCreature?.containerId ?? 'cuerpo_aprendiz') : selectedContainerId;
    const targetCid = selectedContainerId;
    const swapRequired = !isParty || targetCid !== currentCid;
    const hasVesselStock = (vessels[targetCid] ?? 0) > 0;

    const currentTemper = isParty ? (targetCreature?.vesselCalibration?.temperLevel ?? 0) : 0;
    const effectiveTemper = Math.max(currentTemper, temperTarget);
    const effectiveCal: VesselCalibration = {
      ...previewCalibration,
      ...(effectiveTemper > 0 ? { temperLevel: effectiveTemper } : {}),
    };

    const previewRatios = computeBodyPartRatios(
      targetCid,
      targetCreature?.ivs ?? NEUTRAL_IVS,
      targetCreature?.evBonuses,
      effectiveCal
    );

    const affinityPreview = species
      ? getContainerAffinityMatch(
          targetCreature ?? {
            uid: 'preview',
            speciesId: species.id,
            level: activeSoul?.level ?? 5,
            xp: 0,
            ivs: NEUTRAL_IVS,
            stats: species.baseStats,
            currentHp: species.baseStats.hp,
            status: 'none',
            sleepTurns: 0,
            moves: [],
          },
          targetCid,
          effectiveCal
        )
      : null;

    const cost = computeCalibrationCost(
      isParty ? targetCreature?.vesselCalibration : undefined,
      effectiveCal,
      isParty ? currentCid : undefined,
      targetCid
    );

    const nothingChanged =
      isParty &&
      !cost.changedContainer &&
      !cost.changedFocus &&
      !cost.changedRune &&
      cost.temperSteps <= 0;

    const canSubmit =
      Boolean(species) &&
      (!swapRequired || hasVesselStock) &&
      !nothingChanged &&
      save.money >= cost.gold &&
      dust >= cost.dust;

    const resonanceBadge =
      affinityPreview?.level === 'full'
        ? { label: 'Resonancia Plena', tone: 'emerald' as const }
        : affinityPreview?.level === 'partial'
          ? { label: 'Resonancia Parcial', tone: 'cyan' as const }
          : { label: 'Sin Resonancia', tone: 'neutral' as const };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <PxButton
            variant={!isParty ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleModeSwitch('reserve')}
          >
            Despertar Alma en Reserva ({reserve.length})
          </PxButton>
          <PxButton
            variant={isParty ? 'primary' : 'secondary'}
            size="sm"
            disabled={save.party.length === 0}
            onClick={() => handleModeSwitch('party')}
          >
            Moldear SoulDoll del Equipo ({save.party.length})
          </PxButton>
        </div>

        {!isParty && reserve.length === 0 ? (
          <PxPanel variant="card" padding="md" className="text-center space-y-2">
            <div className="text-xs text-bone-gray">{ES.vessels.noSouls}</div>
            {save.party.length > 0 && (
              <PxButton variant="arcane" size="xs" onClick={() => handleModeSwitch('party')}>
                Pasar a Moldear Equipo
              </PxButton>
            )}
          </PxPanel>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Selector de Alma o SoulDoll */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-resonant-gold">
                {isParty ? '1. Elige SoulDoll del Equipo' : '1. Elige Alma en Reserva'}
              </div>
              <div className="space-y-1.5 max-h-56 touch-scroll overflow-y-auto pr-0.5">
                {isParty
                  ? save.party.map((doll, idx) => {
                      const sp = getSpecies(doll.speciesId);
                      const active = idx === selectedPartyIdx;
                      const cName = getBodyContainer(doll.containerId ?? 'cuerpo_aprendiz').name;
                      const temper = doll.vesselCalibration?.temperLevel ?? 0;
                      return (
                        <button
                          key={doll.uid}
                          type="button"
                          onClick={() => selectPartyMember(idx)}
                          className={`px-panel px-card w-full p-2 flex items-center gap-2 text-left transition-colors ${
                            active ? 'border-resonant-gold bg-dark-oak' : 'border-ash-purple'
                          }`}
                        >
                          <img
                            src={assets.getCreatureDataUrl(doll.speciesId, 'front')}
                            data-souldoll-id={doll.speciesId}
                            data-souldoll-view="front"
                            className="souldoll-img w-10 h-10 object-contain shrink-0"
                            alt={sp.name}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-warm-white truncate">
                              {getCreatureDisplayName(doll)}{' '}
                              <span className="text-resonant-gold">Nv.{doll.level}</span>
                            </div>
                            <div className="text-[10px] text-bone-gray truncate">
                              {cName}
                              {temper > 0 ? ` · Templado +${temper}` : ''}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  : reserve.map((soul) => {
                      const sp = getSpecies(soul.speciesId);
                      const active = (activeSoul?.uid ?? '') === soul.uid;
                      return (
                        <button
                          key={soul.uid}
                          type="button"
                          onClick={() => setSelectedSoulUid(soul.uid)}
                          className={`px-panel px-card w-full p-2 flex items-center gap-2 text-left ${
                            active ? 'border-resonant-gold bg-dark-oak' : 'border-ash-purple'
                          }`}
                        >
                          <img
                            src={assets.getCreatureDataUrl(soul.speciesId, 'front')}
                            data-souldoll-id={soul.speciesId}
                            data-souldoll-view="front"
                            className="souldoll-img w-10 h-10 object-contain shrink-0"
                            alt={sp.name}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-warm-white truncate">
                              Alma de {sp.name}{' '}
                              <span className="text-resonant-gold">Nv.{soul.level}</span>
                            </div>
                            <div className="mt-0.5 flex gap-1">
                              {sp.types.map((t) => (
                                <PxTypeBadge key={t} type={t} size="chip" />
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-ki-cyan pt-1">
                2. Armazón Contenedor
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-56 touch-scroll overflow-y-auto pr-0.5">
                {ALL_CONTAINER_IDS.map((cid) => {
                  const cdef = getBodyContainer(cid);
                  const qty = vessels[cid] ?? 0;
                  const isCurrent = isParty && cid === currentCid;
                  const selectable = qty > 0 || isCurrent;
                  const selected = cid === targetCid;
                  return (
                    <button
                      key={cid}
                      type="button"
                      disabled={!selectable}
                      onClick={() => setSelectedContainerId(cid)}
                      className={`px-panel px-card w-full p-2 text-left flex items-center justify-between gap-2 ${
                        selected
                          ? 'border-ki-cyan bg-deep-abyss'
                          : selectable
                            ? 'border-ash-purple'
                            : 'border-ash-purple opacity-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-porcelain truncate">
                          {cdef.name}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {cdef.affinityTypes.map((t) => (
                            <PxTypeBadge key={t} type={t} size="chip" />
                          ))}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums shrink-0 text-resonant-gold">
                        {isCurrent ? 'Actual' : `×${qty}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de Personalización, Calibración y Templado */}
            <div className="lg:col-span-7 space-y-2.5">
              <PxPanel variant="card" padding="sm" className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-resonant-gold">
                    3. Moldeo Anatómico y Forja Rúnica
                  </span>
                  {affinityPreview && (
                    <PxBadge tone={resonanceBadge.tone} size="sm">
                      {resonanceBadge.label}
                    </PxBadge>
                  )}
                </div>

                {/* Enfoque anatómico */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-porcelain">Calibración Anatómica</span>
                    <span className="text-bone-gray tabular-nums">
                      Cambiar: {WORKSHOP_FOCUS_GOLD} ◈ + {WORKSHOP_FOCUS_DUST} Polvo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FOCUS_OPTIONS.map((opt) => (
                      <PxButton
                        key={opt.id}
                        variant={focusSelection === opt.id ? 'arcane' : 'secondary'}
                        size="xs"
                        showSelector={false}
                        onClick={() => setFocusSelection(opt.id)}
                      >
                        {opt.label}
                      </PxButton>
                    ))}
                  </div>
                </div>

                {/* Templado */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-porcelain">Templado de Armazón (+4% PS/nv)</span>
                    <span className="text-bone-gray tabular-nums">
                      Nv.{effectiveTemper}/{WORKSHOP_MAX_TEMPER}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 1, 2, 3].map((lv) => {
                      const lockedLower = lv < currentTemper;
                      return (
                        <PxButton
                          key={lv}
                          variant={effectiveTemper === lv ? 'primary' : 'secondary'}
                          size="xs"
                          showSelector={false}
                          disabled={lockedLower}
                          onClick={() => setTemperTarget(lv)}
                        >
                          {lv === 0 ? 'Base' : `Templado +${lv}`}
                        </PxButton>
                      );
                    })}
                  </div>
                </div>

                {/* Runa elemental */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-porcelain">Grabado de Runa Elemental</span>
                    <span className="text-bone-gray tabular-nums">
                      Grabar: {WORKSHOP_RUNE_GOLD} ◈ + {WORKSHOP_RUNE_DUST} Polvo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <PxButton
                      variant={runeSelection === 'none' ? 'primary' : 'secondary'}
                      size="xs"
                      showSelector={false}
                      disabled={Boolean(isParty && targetCreature?.vesselCalibration?.affinityOverride)}
                      onClick={() => setRuneSelection('none')}
                    >
                      Sin runa
                    </PxButton>
                    {ALL_TYPES.map((t) => (
                      <PxButton
                        key={t}
                        variant={runeSelection === t ? 'violet' : 'secondary'}
                        size="xs"
                        showSelector={false}
                        onClick={() => setRuneSelection(t)}
                      >
                        {ES.types[t]}
                      </PxButton>
                    ))}
                  </div>
                </div>

                {/* Previsualización de Partes */}
                <div className="pt-2 border-t border-ash-purple space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-bone-gray font-bold uppercase tracking-wider">
                      Reparto Anatómico Resultante
                    </span>
                    <span className="text-ki-cyan tabular-nums font-bold">
                      PS +{effectiveTemper * 4}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(['head', 'torso', 'arms', 'legs'] as const).map((part) => (
                      <div
                        key={part}
                        className="px-panel px-card px-2 py-1.5 text-center border-ash-purple"
                      >
                        <div className="text-[10px] text-bone-gray">
                          {BODY_PART_LABELS[part]} ({BODY_PART_SHORT[part]})
                        </div>
                        <div className="text-xs font-bold text-porcelain tabular-nums">
                          {previewRatios[part]}%
                        </div>
                      </div>
                    ))}
                  </div>
                  {affinityPreview && affinityPreview.level !== 'none' && (
                    <div className="text-[11px] text-frosted-glass">
                      Resonancia activa ({affinityPreview.matchedTypes.map((t) => ES.types[t]).join(', ')}):
                      reduce la pérdida de velocidad al fracturarse las piernas.
                    </div>
                  )}
                </div>

                {/* Resumen de Coste y Acción */}
                <div className="pt-2 border-t border-ash-purple flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs tabular-nums">
                    <span className="text-bone-gray">Coste total: </span>
                    <strong className="text-resonant-gold">{cost.gold} ◈</strong>
                    {cost.dust > 0 && (
                      <>
                        {' · '}
                        <strong className="text-ethereal-orchid">{cost.dust} Polvo</strong>
                      </>
                    )}
                    {swapRequired && !hasVesselStock && (
                      <div className="text-[11px] text-coral-red mt-0.5">
                        No tienes {getBodyContainer(targetCid).name} en stock. Fórjalo primero.
                      </div>
                    )}
                  </div>

                  {swapRequired && !hasVesselStock ? (
                    <PxButton variant="primary" size="sm" onClick={() => setTab('forja')}>
                      Ir a Forjar
                    </PxButton>
                  ) : (
                    <PxButton
                      variant={canSubmit ? 'success' : 'secondary'}
                      size="sm"
                      disabled={!canSubmit}
                      onClick={() => {
                        if (!isParty && activeSoul) {
                          const res = createCustomSoulDollFromReserve(
                            save,
                            activeSoul.uid,
                            targetCid,
                            rng,
                            effectiveCal
                          );
                          if (res.ok && res.doll && res.containerName) {
                            onCraftSfx?.();
                            onMutated();
                            setSelectedSoulUid(save.soulReserve?.[0]?.uid ?? '');
                            setNotice({
                              text: ES.vessels.boundSuccess(
                                getCreatureDisplayName(res.doll),
                                res.containerName
                              ),
                              tone: 'success',
                            });
                          } else if (res.reason === 'storage_full') {
                            setNotice({ text: ES.storage.storageFull, tone: 'danger' });
                          } else if (res.reason === 'no_dust') {
                            setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
                          } else if (res.reason === 'no_money') {
                            setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                          }
                          refresh();
                          return;
                        }

                        if (isParty && activeDoll) {
                          const res = modifyPartySoulDollBody(
                            save,
                            activeDoll,
                            targetCid,
                            effectiveCal
                          );
                          if (res.ok && res.dollName && res.containerName) {
                            onCraftSfx?.();
                            onMutated();
                            setNotice({
                              text: ES.vessels.reboundSuccess(res.dollName, res.containerName),
                              tone: 'success',
                            });
                          } else if (res.reason === 'no_dust') {
                            setNotice({ text: 'Polvo de Alma insuficiente.', tone: 'warning' });
                          } else if (res.reason === 'no_money') {
                            setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                          } else {
                            setNotice({
                              text: 'Selecciona algún cambio de armazón, enfoque, templado o runa.',
                              tone: 'info',
                            });
                          }
                          refresh();
                        }
                      }}
                    >
                      {isParty ? 'Aplicar Forja / Moldear' : 'Despertar SoulDoll'}
                    </PxButton>
                  )}
                </div>
              </PxPanel>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPiezasTab = () => (
    <div className="space-y-2.5">
      <div className="px-panel px-card p-2.5 text-xs text-porcelain">
        Reúne <strong className="text-ki-cyan">{SHARDS_PER_CONTAINER} piezas</strong> de un mismo armazón para ensamblarlo gratis,{' '}
        <strong className="text-ethereal-orchid">sintetiza piezas</strong> con Polvo de Alma o{' '}
        <strong className="text-resonant-gold">desmantela</strong> cuerpos sobrantes.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {ALL_CONTAINER_IDS.map((cid) => {
          const cdef = getBodyContainer(cid);
          const recipe = getWorkshopRecipe(cid);
          const count = shards[cid] ?? 0;
          const stock = vessels[cid] ?? 0;
          const canSynth = save.money >= WORKSHOP_SHARD_SYNTH_GOLD && dust >= WORKSHOP_SHARD_SYNTH_DUST;

          return (
            <PxPanel key={cid} variant="card" padding="sm" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-warm-white truncate">{cdef.name}</div>
                  <div className="text-[10px] text-bone-gray tabular-nums">
                    Stock: ×{stock} · Piezas: {count}/{SHARDS_PER_CONTAINER}
                  </div>
                </div>
                <PxBadge tone={stock > 0 ? 'gold' : 'neutral'} size="xs">
                  ×{stock}
                </PxBadge>
              </div>

              <PxProgressBar
                value={count}
                max={SHARDS_PER_CONTAINER}
                tone="cyan"
                height="sm"
                ariaLabel={`Piezas de ${cdef.name}`}
              />

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <PxButton
                  variant={canSynth ? 'arcane' : 'secondary'}
                  size="xs"
                  disabled={!canSynth}
                  onClick={() => {
                    const res = synthesizeShardFromDust(save, cid);
                    if (res.ok && res.containerName) {
                      onCraftSfx?.();
                      onMutated();
                      setNotice({
                        text:
                          res.assembledCount && res.assembledCount > 0
                            ? `¡Completaste las piezas y ensamblaste 1× ${res.containerName}!`
                            : `Sintetizada +1 pieza de ${res.containerName} (${res.currentShards}/${SHARDS_PER_CONTAINER}).`,
                        tone: 'success',
                      });
                    } else if (res.reason === 'no_dust') {
                      setNotice({
                        text: `Necesitas ${WORKSHOP_SHARD_SYNTH_DUST} Polvo de Alma.`,
                        tone: 'warning',
                      });
                    } else {
                      setNotice({ text: ES.shop.noMoney, tone: 'danger' });
                    }
                    refresh();
                  }}
                >
                  +1 Pieza ({WORKSHOP_SHARD_SYNTH_GOLD} ◈ + {WORKSHOP_SHARD_SYNTH_DUST} Polvo)
                </PxButton>

                <PxButton
                  variant={stock > 0 ? 'danger' : 'secondary'}
                  size="xs"
                  disabled={stock <= 0}
                  onClick={() => {
                    const res = dismantleVesselAtWorkshop(save, cid);
                    if (res.ok && res.containerName) {
                      onCraftSfx?.();
                      onMutated();
                      setNotice({
                        text: `Desmantelaste ${res.containerName}: +${res.shardsGained} piezas, +${res.dustGained} Polvo y +${res.goldGained} ◈.`,
                        tone: 'info',
                      });
                    }
                    refresh();
                  }}
                >
                  Desmantelar (+{recipe.dismantleShards}p, +{recipe.dismantleDust} Polvo)
                </PxButton>
              </div>
            </PxPanel>
          );
        })}
      </div>
    </div>
  );

  const renderCuerposTab = () =>
    ownedContainerIds.length === 0 ? (
      <PxPanel variant="card" padding="md" className="text-center space-y-2.5 py-6">
        <div className="text-xs text-bone-gray">{ES.vessels.noContainers}</div>
        <PxButton variant="primary" size="sm" onClick={() => setTab('forja')}>
          Ir a Forja y Planos
        </PxButton>
      </PxPanel>
    ) : (
      <div className="space-y-2">
        {ownedContainerIds.map((cid) => {
          const def = getBodyContainer(cid);
          const rBadge = RARITY_BADGE[def.rarity];
          return (
            <PxPanel
              key={cid}
              variant="card"
              padding="sm"
              className="flex flex-wrap items-center justify-between gap-2.5"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-warm-white">{def.name}</span>
                  <span className="text-xs font-bold text-resonant-gold tabular-nums">
                    ×{vessels[cid]}
                  </span>
                  <PxBadge tone={rBadge.tone} size="xs">
                    {rBadge.label}
                  </PxBadge>
                  {def.affinityTypes.map((t) => (
                    <PxTypeBadge key={t} type={t} size="chip" />
                  ))}
                </div>
                <div className="text-xs text-bone-gray">{def.description}</div>
                <div className="text-[11px] text-ki-cyan tabular-nums">
                  Cab {def.ratios.head}% · Tor {def.ratios.torso}% · Bra {def.ratios.arms}% · Pie{' '}
                  {def.ratios.legs}%
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {reserve.length > 0 && (
                  <PxButton
                    variant="success"
                    size="xs"
                    onClick={() => jumpToCreateWithContainer(cid, 'reserve')}
                  >
                    Vincular Alma
                  </PxButton>
                )}
                {save.party.length > 0 && (
                  <PxButton
                    variant="arcane"
                    size="xs"
                    onClick={() => jumpToCreateWithContainer(cid, 'party')}
                  >
                    Moldear en Equipo
                  </PxButton>
                )}
              </div>
            </PxPanel>
          );
        })}
      </div>
    );

  return (
    <PxPanel
      variant="gold"
      padding="md"
      ornate
      className="w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] flex flex-col text-porcelain"
    >
      <PxPanelHeader
        title={ES.vessels.title}
        ornate
        subtitle="Forja armazones, graba runas elementales y despierta SoulDolls"
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <PxBadge tone="gold" size="md">
              {save.money} ◈
            </PxBadge>
            <PxSoulDustCounter amount={dust} compact />
            <PxButton variant="secondary" size="md" onClick={onClose}>
              {ES.vessels.back}
            </PxButton>
          </div>
        }
      />

      <PxTabs
        items={tabs}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setNotice(null);
        }}
        columns={4}
        size="sm"
        className="mb-3"
      />

      {notice && (
        <PxNotice tone={notice.tone} className="mb-2.5">
          {notice.text}
        </PxNotice>
      )}

      <div className="touch-scroll overflow-y-auto pr-0.5 flex-1">
        {tab === 'forja' && renderForjaTab()}
        {tab === 'creacion' && renderCreacionTab()}
        {tab === 'piezas' && renderPiezasTab()}
        {tab === 'cuerpos' && renderCuerposTab()}
      </div>
    </PxPanel>
  );
};

export default WorkshopView;

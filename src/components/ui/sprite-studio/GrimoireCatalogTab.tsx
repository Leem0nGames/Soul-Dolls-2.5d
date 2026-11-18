import React, { useMemo, useState } from 'react';
import {
  ALL_SPECIES_IDS_WITH_ANIMATION,
  SPECIES_ANIMATION_REGISTRY,
  type SpeciesAnimationEntry,
} from '../../../data/animations.ts';
import { ALL_SPECIES_IDS_WITH_WILD_SOUL } from '../../../data/soulForms.ts';
import { SPECIES } from '../../../data/species.ts';
import {
  type CatalogViewMode,
  filterGrimoireSpecies,
  type GrimoireFilter,
  pad2,
  type StudioCreationMode,
} from '../../../domain/SpriteStudioLogic.ts';
import { getSoulDollSheetUrl, SOULDOLL_MAX_SHEET_ID } from '../../../gfx/SoulDollSheets.ts';
import { PxTypeBadge } from '../PxBadge.tsx';
import { PxButton } from '../PxButton.tsx';
import { PxPanel } from '../PxPanel.tsx';

export interface GrimoireCatalogTabProps {
  onSelectForCreate: (speciesId: number, mode?: StudioCreationMode) => void;
  onInspectAnimation: (entry: SpeciesAnimationEntry) => void;
}

export const GrimoireCatalogTab: React.FC<GrimoireCatalogTabProps> = ({
  onSelectForCreate,
  onInspectAnimation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<GrimoireFilter>('all');
  const [viewMode, setViewMode] = useState<CatalogViewMode>('front');

  const entries = useMemo(
    () =>
      filterGrimoireSpecies({
        maxId: SOULDOLL_MAX_SHEET_ID,
        query: searchQuery,
        filter,
        speciesMap: SPECIES,
        registry: SPECIES_ANIMATION_REGISTRY,
      }),
    [searchQuery, filter]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      {/* Compact Search, View Mode & Filter Bar */}
      <div className="flex flex-col gap-2 bg-abyss-ink border-2 border-ash-purple p-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="search"
            aria-label="Buscar SoulDoll por ID o nombre"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar #ID o nombre..."
            className="flex-1 min-w-0 min-h-[44px] bg-crypt-ink border-2 border-cold-stone px-2.5 text-xs sm:text-sm text-warm-white placeholder:text-bone-gray font-mono"
          />

          <div
            className="grid grid-cols-3 gap-1 shrink-0"
            role="group"
            aria-label="Vista de sprite"
          >
            {(
              [
                { id: 'front', label: 'Frente' },
                { id: 'back', label: 'Espalda' },
                { id: 'wild', label: 'Salvaje' },
              ] as { id: CatalogViewMode; label: string }[]
            ).map((opt) => (
              <PxButton
                key={opt.id}
                size="sm"
                variant={viewMode === opt.id ? 'arcane' : 'secondary'}
                showSelector={false}
                onClick={() => setViewMode(opt.id)}
                className="min-h-[44px] px-2.5 whitespace-nowrap"
              >
                {opt.label}
              </PxButton>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <PxButton
            size="sm"
            variant={filter === 'all' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => setFilter('all')}
            className="px-1 min-h-[44px] whitespace-nowrap"
          >
            Todas ({SOULDOLL_MAX_SHEET_ID})
          </PxButton>
          <PxButton
            size="sm"
            variant={filter === 'animated' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => setFilter('animated')}
            className="px-1 min-h-[44px] whitespace-nowrap"
          >
            Ataques ({ALL_SPECIES_IDS_WITH_ANIMATION.length})
          </PxButton>
          <PxButton
            size="sm"
            variant={filter === 'wild' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => setFilter('wild')}
            className="px-1 min-h-[44px] whitespace-nowrap"
          >
            Almas ({ALL_SPECIES_IDS_WITH_WILD_SOUL.length})
          </PxButton>
          <PxButton
            size="sm"
            variant={filter === 'pending' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => setFilter('pending')}
            className="px-1 min-h-[44px] whitespace-nowrap"
          >
            Faltan
          </PxButton>
        </div>
      </div>

      {/* Responsive SoulDoll Grid: 2 cols mobile -> 4-5 cols desktop */}
      <div className="flex-1 min-h-0 touch-scroll overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {entries.map(
            ({
              id,
              spec,
              name,
              anims,
              hasAnim,
              hasWildSoul,
              hasFollowerPet,
              wildSoulUrl,
              followerPetUrl,
            }) => {
              const sheetUrl = getSoulDollSheetUrl(id);
              const primaryAnim = anims[0];
              const statusText =
                viewMode === 'wild'
                  ? hasWildSoul
                    ? hasFollowerPet
                      ? 'Alma + Pet'
                      : 'Alma lista'
                    : 'Sin alma'
                  : hasAnim
                    ? `Lista (${anims.length})`
                    : 'Sin anim.';
              const statusOk = viewMode === 'wild' ? hasWildSoul : hasAnim;

              return (
                <PxPanel
                  key={id}
                  variant="card"
                  padding="sm"
                  className="flex flex-col gap-2 bg-crypt-ink"
                >
                  {/* Clean Unboxed Metadata Header (Zero-Pill) */}
                  <div className="flex items-baseline justify-between gap-1 text-xs">
                    <span className="font-extrabold text-pale-gold tabular-nums">
                      #{pad2(id)}
                    </span>
                    <span
                      className={`font-bold truncate ${
                        statusOk ? 'text-neon-mint' : 'text-bone-gray'
                      }`}
                    >
                      {statusText}
                    </span>
                  </div>

                  {/* Preview Area: Embodied Front/Back or Wild Soul + Reserved Pixel Pet */}
                  <div className="w-full flex justify-center py-1.5 bg-abyss-ink border border-ash-purple">
                    {viewMode === 'wild' ? (
                      wildSoulUrl ? (
                        <div className="w-full px-1.5 flex items-end justify-center gap-2 min-h-[120px] sm:min-h-[144px]">
                          <img
                            src={wildSoulUrl}
                            alt={`Alma salvaje #${pad2(id)} ${name}`}
                            loading="lazy"
                            className="max-h-28 sm:max-h-34 max-w-[68%] object-contain"
                          />
                          {followerPetUrl && (
                            <div className="flex flex-col items-center gap-0.5 shrink-0 pb-0.5">
                              <img
                                src={followerPetUrl}
                                alt={`Mascota pixel #${pad2(id)} ${name}`}
                                loading="lazy"
                                className="w-9 h-12 sm:w-10 sm:h-14 object-contain pixel-canvas"
                              />
                              <span className="text-[9px] text-ki-cyan font-mono">Pet</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-20 sm:w-24 aspect-[600/896] flex flex-col items-center justify-center text-center px-1 gap-1.5">
                          <img
                            src={sheetUrl}
                            alt={`Base #${pad2(id)} ${name}`}
                            loading="lazy"
                            className="h-16 max-w-none w-[200%] object-contain opacity-30"
                          />
                          <span className="text-[10px] text-bone-gray leading-tight">
                            Sin alma salvaje
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="relative w-20 sm:w-24 aspect-[600/896] overflow-hidden">
                        <img
                          src={sheetUrl}
                          alt={`SoulDoll #${pad2(id)} ${name}`}
                          loading="lazy"
                          className={`h-full max-w-none w-[200%] object-contain transition-transform duration-150 ${
                            viewMode === 'back' ? '-translate-x-1/2' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <div
                      className="text-xs sm:text-sm font-bold text-warm-white truncate"
                      title={name}
                    >
                      {name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 min-h-[18px]">
                      {spec ? (
                        spec.types.map((t) => <PxTypeBadge key={t} type={t} size="chip" />)
                      ) : (
                        <span className="text-[11px] text-bone-gray font-mono">
                          sheet {pad2(id)}
                        </span>
                      )}
                      {hasWildSoul && viewMode !== 'wild' && (
                        <span className="text-[10px] text-ki-cyan font-mono">· Alma</span>
                      )}
                    </div>
                  </div>

                  {/* Clear Primary Action (>=44px tap target) */}
                  <div className="mt-auto flex flex-col gap-1.5 pt-1.5 border-t border-ash-purple">
                    {viewMode === 'wild' ? (
                      <PxButton
                        size="md"
                        variant={hasWildSoul ? 'secondary' : 'arcane'}
                        fullWidth
                        showSelector={false}
                        onClick={() => onSelectForCreate(id, 'soul_dual')}
                        className="px-2 text-xs"
                      >
                        {hasWildSoul ? 'Reemplazar Alma' : '+ Alma + Mascota'}
                      </PxButton>
                    ) : primaryAnim ? (
                      <>
                        <PxButton
                          size="md"
                          variant="primary"
                          fullWidth
                          showSelector={false}
                          onClick={() => onInspectAnimation(primaryAnim)}
                          className="px-2 text-xs"
                        >
                          Probar Ataque
                        </PxButton>
                        <PxButton
                          size="sm"
                          variant="ghost"
                          fullWidth
                          showSelector={false}
                          onClick={() => onSelectForCreate(id, 'physical_attack')}
                          className="px-2 min-h-[44px] text-xs"
                        >
                          + Añadir otra
                        </PxButton>
                      </>
                    ) : (
                      <PxButton
                        size="md"
                        variant="arcane"
                        fullWidth
                        showSelector={false}
                        onClick={() => onSelectForCreate(id, 'physical_attack')}
                        className="px-2 text-xs"
                      >
                        + Crear Animación
                      </PxButton>
                    )}
                  </div>
                </PxPanel>
              );
            }
          )}
          {entries.length === 0 && (
            <div className="col-span-full text-center py-10 text-sm text-bone-gray">
              No se encontró ninguna SoulDoll con ese filtro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

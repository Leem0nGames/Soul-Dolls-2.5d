import React, { useEffect, useState } from 'react';
import { ALL_SPECIES_IDS_WITH_ANIMATION } from '../../data/animations.ts';
import type {
  StudioCreationMode,
  StudioDestination,
} from '../../domain/SpriteStudioLogic.ts';
import { SOULDOLL_MAX_SHEET_ID } from '../../gfx/SoulDollSheets.ts';
import { PxButton } from './PxButton.tsx';
import { PxPanel, PxPanelHeader } from './PxPanel.tsx';
import { PxTabs, type PxTabItem } from './PxTabs.tsx';
import { CreateAnimationWizard } from './sprite-studio/CreateAnimationWizard.tsx';
import { GrimoireCatalogTab } from './sprite-studio/GrimoireCatalogTab.tsx';
import {
  QUICK_INSPECTOR_PRESETS,
  QuickInspectorTab,
} from './sprite-studio/QuickInspectorTab.tsx';

export interface SpriteInspectorViewProps {
  onClose: () => void;
}

export const SpriteInspectorView: React.FC<SpriteInspectorViewProps> = ({ onClose }) => {
  const [destination, setDestination] = useState<StudioDestination>('catalog');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number>(1);
  const [selectedCreationMode, setSelectedCreationMode] =
    useState<StudioCreationMode>('physical_attack');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    QUICK_INSPECTOR_PRESETS[0]?.id ?? 'placeholder-5x5'
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabItems: PxTabItem<StudioDestination>[] = [
    { id: 'catalog', label: 'Catálogo' },
    { id: 'create', label: 'Crear' },
    { id: 'inspect', label: 'Probar' },
  ];

  return (
    <PxPanel
      variant="gold"
      padding="sm"
      ornate
      className="w-full max-w-5xl h-[calc(100dvh-0.75rem)] sm:h-[min(92dvh,860px)] mx-auto flex flex-col gap-2 text-porcelain overflow-hidden"
    >
      <PxPanelHeader
        title="Sprite Studio"
        ornate
        subtitle={`${ALL_SPECIES_IDS_WITH_ANIMATION.length} animadas · ${SOULDOLL_MAX_SHEET_ID} SoulDolls`}
        className="mb-1 shrink-0"
        right={
          <PxButton
            variant="secondary"
            size="md"
            showSelector={false}
            aria-label="Cerrar Sprite Studio"
            onClick={onClose}
            className="px-3"
          >
            Cerrar
          </PxButton>
        }
      />

      <PxTabs
        items={tabItems}
        value={destination}
        onChange={setDestination}
        columns={3}
        size="md"
        className="shrink-0"
      />

      {destination === 'catalog' && (
        <GrimoireCatalogTab
          onSelectForCreate={(id, mode) => {
            setSelectedSpeciesId(id);
            setSelectedCreationMode(mode ?? 'physical_attack');
            setDestination('create');
          }}
          onInspectAnimation={(entry) => {
            setSelectedPresetId(`anim-${entry.speciesId}-${entry.role}`);
            setDestination('inspect');
          }}
        />
      )}

      {destination === 'create' && (
        <CreateAnimationWizard
          speciesId={selectedSpeciesId}
          initialMode={selectedCreationMode}
          onOpenCatalog={() => setDestination('catalog')}
        />
      )}

      {destination === 'inspect' && (
        <QuickInspectorTab
          selectedPresetId={selectedPresetId}
          onSelectPreset={setSelectedPresetId}
        />
      )}
    </PxPanel>
  );
};

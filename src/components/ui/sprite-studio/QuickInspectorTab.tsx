import React, { useEffect, useMemo, useState } from 'react';
import {
  PLACEHOLDER_ATTACK_SHEET_PATH,
  SPECIES_ANIMATION_REGISTRY,
} from '../../../data/animations.ts';
import { stepBounded } from '../../../domain/SpriteStudioLogic.ts';
import { getSoulDollSheetUrl } from '../../../gfx/SoulDollSheets.ts';
import { PxButton } from '../PxButton.tsx';
import { SpriteStagePreview } from './SpriteStagePreview.tsx';

export interface QuickInspectorPreset {
  id: string;
  name: string;
  path: string;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  aspect: number;
}

export const QUICK_INSPECTOR_PRESETS: QuickInspectorPreset[] = [
  ...SPECIES_ANIMATION_REGISTRY.map((entry) => ({
    id: `anim-${entry.speciesId}-${entry.role}`,
    name: entry.label,
    path: entry.spec.path,
    cols: entry.spec.cols,
    rows: entry.spec.rows,
    totalFrames: entry.spec.totalFrames,
    impactFrame: entry.spec.impactFrame,
    aspect: entry.spec.aspectRatio,
  })),
  {
    id: 'placeholder-5x5',
    name: 'Placeholder Ataque Genérico (5×5)',
    path: PLACEHOLDER_ATTACK_SHEET_PATH,
    cols: 5,
    rows: 5,
    totalFrames: 25,
    impactFrame: 11,
    aspect: 1,
  },
  {
    id: 'doll-01-idle',
    name: 'SoulDoll #01 — Hoja Idle (1×2)',
    path: getSoulDollSheetUrl(1),
    cols: 2,
    rows: 1,
    totalFrames: 2,
    impactFrame: 0,
    aspect: 600 / 896,
  },
];

export interface QuickInspectorTabProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
}

export const QuickInspectorTab: React.FC<QuickInspectorTabProps> = ({
  selectedPresetId,
  onSelectPreset,
}) => {
  const activePreset = useMemo(
    () =>
      QUICK_INSPECTOR_PRESETS.find((p) => p.id === selectedPresetId) ?? QUICK_INSPECTOR_PRESETS[0],
    [selectedPresetId]
  );

  const [cols, setCols] = useState<number>(activePreset.cols);
  const [rows, setRows] = useState<number>(activePreset.rows);
  const [totalFrames, setTotalFrames] = useState<number>(activePreset.totalFrames);
  const [impactFrame, setImpactFrame] = useState<number>(activePreset.impactFrame);
  const [gridOpen, setGridOpen] = useState<boolean>(false);

  useEffect(() => {
    setCols(activePreset.cols);
    setRows(activePreset.rows);
    setTotalFrames(activePreset.totalFrames);
    setImpactFrame(activePreset.impactFrame);
  }, [activePreset]);

  const applyPreset = (id: string) => {
    const found = QUICK_INSPECTOR_PRESETS.find((p) => p.id === id);
    if (!found) return;
    onSelectPreset(found.id);
  };

  return (
    <div className="flex-1 min-h-0 touch-scroll overflow-y-auto pr-0.5">
      <div className="flex flex-col gap-3 max-w-3xl mx-auto">
        {/* Clean Preset Selector */}
        <div className="bg-abyss-ink border-2 border-ash-purple p-2.5 flex flex-col gap-2">
          <label htmlFor="inspector-preset-select" className="text-xs font-bold text-pale-gold">
            Animación seleccionada
          </label>
          <select
            id="inspector-preset-select"
            value={activePreset.id}
            onChange={(e) => applyPreset(e.target.value)}
            className="w-full min-h-[44px] bg-crypt-ink border-2 border-cold-stone px-3 text-xs sm:text-sm text-warm-white font-mono"
          >
            {QUICK_INSPECTOR_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Main Interactive Player */}
        <div className="bg-abyss-ink border-2 border-ash-purple p-2.5">
          <SpriteStagePreview
            assetPath={activePreset.path}
            cols={cols}
            rows={rows}
            totalFrames={totalFrames}
            impactFrame={impactFrame}
            fallbackAspect={activePreset.aspect}
            onImpactFrameChange={setImpactFrame}
            showTechnicalDetails
          />
        </div>

        {/* Optional Collapsible Grid Adjustment */}
        <div className="bg-abyss-ink border border-ash-purple">
          <button
            type="button"
            aria-expanded={gridOpen}
            onClick={() => setGridOpen((o) => !o)}
            className="w-full min-h-[44px] px-3 flex items-center justify-between text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
          >
            <span>Ajustar grilla manualmente ({cols}×{rows} · {totalFrames}f)</span>
            <span className="font-mono text-pale-gold">{gridOpen ? 'Ocultar' : 'Editar'}</span>
          </button>
          {gridOpen && (
            <div className="p-2.5 border-t border-ash-purple grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center justify-between bg-crypt-ink border border-ash-purple px-2.5 py-1.5">
                <span className="text-xs">Cols</span>
                <div className="flex items-center gap-1">
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setCols((c) => stepBounded(c, -1, 1, 16))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    -
                  </PxButton>
                  <span className="w-7 text-center text-xs font-mono">{cols}</span>
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setCols((c) => stepBounded(c, 1, 1, 16))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    +
                  </PxButton>
                </div>
              </div>
              <div className="flex items-center justify-between bg-crypt-ink border border-ash-purple px-2.5 py-1.5">
                <span className="text-xs">Filas</span>
                <div className="flex items-center gap-1">
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setRows((r) => stepBounded(r, -1, 1, 16))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    -
                  </PxButton>
                  <span className="w-7 text-center text-xs font-mono">{rows}</span>
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setRows((r) => stepBounded(r, 1, 1, 16))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    +
                  </PxButton>
                </div>
              </div>
              <div className="flex items-center justify-between bg-crypt-ink border border-ash-purple px-2.5 py-1.5">
                <span className="text-xs">Frames</span>
                <div className="flex items-center gap-1">
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setTotalFrames((f) => stepBounded(f, -1, 1, cols * rows))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    -
                  </PxButton>
                  <span className="w-7 text-center text-xs font-mono">{totalFrames}</span>
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={() => setTotalFrames((f) => stepBounded(f, 1, 1, cols * rows))}
                    className="min-h-[44px] min-w-[44px] px-0"
                  >
                    +
                  </PxButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

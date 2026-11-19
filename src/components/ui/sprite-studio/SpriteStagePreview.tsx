import React, { useEffect, useState } from 'react';
import { computeStabFrameUvRect } from '../../../domain/MeleeStabTiming.ts';
import type { BgMode } from '../../../domain/SpriteStudioLogic.ts';
import { PxBadge } from '../PxBadge.tsx';
import { PxButton } from '../PxButton.tsx';

export const CHECKER_STYLE_CLEAN: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'><rect width='8' height='8' fill='%2314101C'/><rect x='8' width='8' height='8' fill='%232A1F2D'/><rect y='8' width='8' height='8' fill='%232A1F2D'/><rect x='8' y='8' width='8' height='8' fill='%2314101C'/></svg>")`,
  backgroundSize: '16px 16px',
};

export interface SpriteStagePreviewProps {
  assetPath: string;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  fallbackAspect: number;
  initialFps?: number;
  onImpactFrameChange?: (nextImpactFrame: number) => void;
  showTechnicalDetails?: boolean;
}

const BG_LABELS: { id: BgMode; label: string }[] = [
  { id: 'checker', label: 'Cuadros' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'grey', label: 'Gris' },
  { id: 'sand', label: 'Arena' },
];

export const SpriteStagePreview: React.FC<SpriteStagePreviewProps> = ({
  assetPath,
  cols,
  rows,
  totalFrames,
  impactFrame,
  fallbackAspect,
  initialFps = 10,
  onImpactFrameChange,
  showTechnicalDetails = false,
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(initialFps);
  const [flipX, setFlipX] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>('checker');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setCurrentFrame(0);
    setNaturalSize(null);
    setFps(initialFps);
  }, [assetPath, initialFps]);

  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) return;
    const interval = Math.max(24, Math.round(1000 / Math.max(1, fps)));
    const timer = window.setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % totalFrames);
    }, interval);
    return () => clearInterval(timer);
  }, [isPlaying, fps, totalFrames]);

  const safeTotal = Math.max(1, totalFrames);
  const clampedFrame = Math.max(0, Math.min(safeTotal - 1, currentFrame));
  const uvRect = computeStabFrameUvRect(clampedFrame, flipX, cols, rows);
  const cellAspect = naturalSize
    ? naturalSize.w / Math.max(1, cols) / Math.max(1, naturalSize.h / Math.max(1, rows))
    : fallbackAspect;
  const bgPosX = cols > 1 ? (uvRect.col / (cols - 1)) * 100 : 0;
  const bgPosY = rows > 1 ? (uvRect.row / (rows - 1)) * 100 : 0;

  const bgClass =
    bgMode === 'checker'
      ? 'bg-abyss-ink'
      : bgMode === 'grey'
        ? 'bg-stone-mid'
        : bgMode === 'sand'
          ? 'bg-sand-desert'
          : 'bg-void-black';

  return (
    <div className="flex flex-col gap-2.5">
      {/* Stage Canvas */}
      <div
        className={`relative w-full h-48 sm:h-60 flex items-center justify-center overflow-hidden border-2 border-ash-purple p-2 ${bgClass}`}
        style={bgMode === 'checker' ? CHECKER_STYLE_CLEAN : undefined}
        data-testid="sprite-frame-stage"
      >
        <div
          className="h-full max-w-full bg-no-repeat"
          style={{
            aspectRatio: String(cellAspect),
            backgroundImage: `url("${assetPath}")`,
            backgroundPosition: `${bgPosX}% ${bgPosY}%`,
            backgroundSize: `${cols * 100}% ${rows * 100}%`,
            transform: flipX ? 'scaleX(-1)' : 'none',
          }}
        />
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 bg-void-black px-2 py-0.5 border border-ash-purple text-[11px] font-mono tabular-nums text-pale-gold">
          <span>
            {clampedFrame + 1} / {safeTotal}
          </span>
        </div>
        {impactFrame > 0 && clampedFrame === impactFrame && (
          <div className="absolute top-1.5 right-1.5">
            <PxBadge tone="gold" size="xs">
              Impacto #{impactFrame}
            </PxBadge>
          </div>
        )}
      </div>

      {/* Scrub Slider */}
      <div className="flex items-center gap-2 bg-abyss-ink border border-ash-purple px-2.5 py-2">
        <label htmlFor="sprite-scrub" className="text-[11px] text-bone-gray font-mono shrink-0">
          Frame
        </label>
        <input
          id="sprite-scrub"
          type="range"
          min={0}
          max={Math.max(0, safeTotal - 1)}
          value={clampedFrame}
          onChange={(e) => {
            setIsPlaying(false);
            setCurrentFrame(Number(e.target.value));
          }}
          className="flex-1 min-w-0 accent-resonant-gold cursor-pointer h-6"
        />
        <span className="text-xs font-mono text-warm-white tabular-nums shrink-0">
          {clampedFrame}/{safeTotal - 1}
        </span>
      </div>

      {/* Touch-friendly 44px Playback Bar */}
      <div className="grid grid-cols-4 gap-1.5">
        <PxButton
          size="md"
          variant="secondary"
          showSelector={false}
          aria-label="Frame anterior"
          onClick={() => {
            setIsPlaying(false);
            setCurrentFrame((f) => (f - 1 + safeTotal) % safeTotal);
          }}
          className="px-1"
        >
          -1
        </PxButton>
        <PxButton
          size="md"
          variant={isPlaying ? 'secondary' : 'primary'}
          showSelector={false}
          aria-label={isPlaying ? 'Pausar animación' : 'Reproducir animación'}
          onClick={() => setIsPlaying((p) => !p)}
          className="px-1"
        >
          {isPlaying ? 'Pausa' : 'Play'}
        </PxButton>
        <PxButton
          size="md"
          variant="secondary"
          showSelector={false}
          aria-label="Frame siguiente"
          onClick={() => {
            setIsPlaying(false);
            setCurrentFrame((f) => (f + 1) % safeTotal);
          }}
          className="px-1"
        >
          +1
        </PxButton>
        <PxButton
          size="md"
          variant={flipX ? 'arcane' : 'ghost'}
          showSelector={false}
          aria-label="Voltear horizontalmente"
          onClick={() => setFlipX((v) => !v)}
          className="px-1"
        >
          {flipX ? 'Espejo' : 'Normal'}
        </PxButton>
      </div>

      {/* 1-tap Impact Picker + Speed */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {onImpactFrameChange && (
          <PxButton
            size="md"
            variant={clampedFrame === impactFrame ? 'success' : 'arcane'}
            fullWidth
            showSelector={false}
            onClick={() => onImpactFrameChange(clampedFrame)}
            className="sm:flex-1"
          >
            {clampedFrame === impactFrame
              ? `Impacto fijado en frame ${impactFrame}`
              : `Marcar frame ${clampedFrame} como impacto`}
          </PxButton>
        )}
        <div className="flex items-center gap-2 bg-abyss-ink border border-ash-purple px-2.5 min-h-[44px] sm:w-52 shrink-0">
          <span className="text-[11px] text-bone-gray whitespace-nowrap">Vel.</span>
          <input
            type="range"
            aria-label="Velocidad FPS"
            min={2}
            max={24}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="flex-1 min-w-0 accent-resonant-gold cursor-pointer"
          />
          <span className="text-xs font-mono text-pale-gold tabular-nums whitespace-nowrap">
            {fps} fps
          </span>
        </div>
      </div>

      {/* Background Switcher */}
      <div className="grid grid-cols-4 gap-1.5">
        {BG_LABELS.map((m) => (
          <PxButton
            key={m.id}
            size="sm"
            variant={bgMode === m.id ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => setBgMode(m.id)}
            className="px-1 min-h-[44px]"
          >
            {m.label}
          </PxButton>
        ))}
      </div>

      {/* Collapsible Technical Sheet Overview (optional) */}
      {showTechnicalDetails && (
        <div className="border border-ash-purple bg-abyss-ink">
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((o) => !o)}
            className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
          >
            <span className="truncate">Detalles técnicos y hoja</span>
            <span className="font-mono text-pale-gold shrink-0">{detailsOpen ? 'Ocultar' : 'Abrir'}</span>
          </button>
          {detailsOpen && (
            <div className="p-2.5 border-t border-ash-purple flex flex-col gap-2">
              <div
                className="w-full h-36 flex items-center justify-center overflow-hidden border border-ash-purple p-1 bg-abyss-ink"
                style={CHECKER_STYLE_CLEAN}
              >
                <div className="relative inline-block max-h-full max-w-full">
                  <img
                    src={assetPath}
                    alt="Spritesheet completo"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                      }
                    }}
                    className="block max-h-32 max-w-full object-contain"
                  />
                  <div
                    className="absolute border-2 border-neon-mint pointer-events-none"
                    style={{
                      left: `${(uvRect.col / cols) * 100}%`,
                      top: `${(uvRect.row / rows) * 100}%`,
                      width: `${(1 / cols) * 100}%`,
                      height: `${(1 / rows) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-[11px] font-mono text-bone-gray tabular-nums">
                <span>
                  Grilla: {cols}×{rows} ({safeTotal}f) · Impacto: {impactFrame}
                </span>
                {naturalSize && (
                  <span>
                    {naturalSize.w}×{naturalSize.h} (celda {Math.round(naturalSize.w / cols)}×
                    {Math.round(naturalSize.h / rows)})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

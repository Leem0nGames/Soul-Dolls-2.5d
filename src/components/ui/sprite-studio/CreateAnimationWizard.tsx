import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AnimationRole,
  SPECIES_ANIMATION_REGISTRY,
} from '../../../data/animations.ts';
import { SPECIES } from '../../../data/species.ts';
import {
  applyChromaKeyRgba,
  buildAgentPromptSummary,
  buildDualSoulAgentPrompt,
  buildDualSoulTsSnippet,
  buildOutputFileName,
  buildTsSnippet,
  type ChromaMode,
  computeTrimSamplingPlan,
  detectDualSoulRegions,
  pad2,
  stepBounded,
  type StudioCreationMode,
  type StudioSourceKind,
} from '../../../domain/SpriteStudioLogic.ts';
import { getSoulDollSheetUrl } from '../../../gfx/SoulDollSheets.ts';
import { PxButton } from '../PxButton.tsx';
import { CHECKER_STYLE_CLEAN, SpriteStagePreview } from './SpriteStagePreview.tsx';

const SAMPLE_VIDEO_PATH = '/assets/aistudio/427091123_1794872957946986_d5bb03ea.mp4';
const SAMPLE_DUAL_SOUL_PATH = '/assets/aistudio/818944007_1794972743245373_5b1a5cb3.jpg';

type WizardStep = 1 | 2 | 3;

export interface CreateAnimationWizardProps {
  speciesId: number;
  initialMode?: StudioCreationMode;
  onOpenCatalog: () => void;
}

interface GeneratedResult {
  dataUrl: string;
  cols: number;
  rows: number;
  totalFrames: number;
  cellW: number;
  cellH: number;
  impactFrame: number;
  sourceKind: StudioSourceKind;
}

interface DualSoulGeneratedResult {
  soulDataUrl: string;
  followerDataUrl: string;
  followerW: number;
  followerH: number;
}

const StepperRow: React.FC<{
  label: string;
  value: number;
  onStep: (delta: number) => void;
}> = ({ label, value, onStep }) => (
  <div className="flex items-center justify-between gap-2 bg-crypt-ink border border-ash-purple px-2.5 py-1.5">
    <span className="text-xs text-porcelain truncate">{label}</span>
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        aria-label={`Disminuir ${label}`}
        onClick={() => onStep(-1)}
        className="min-h-[44px] min-w-[44px] bg-smoked-wood border-2 border-cold-stone text-warm-white font-bold text-base active:bg-dark-oak cursor-pointer"
      >
        -
      </button>
      <span className="w-8 text-center text-sm font-mono font-bold text-pale-gold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        onClick={() => onStep(1)}
        className="min-h-[44px] min-w-[44px] bg-smoked-wood border-2 border-cold-stone text-warm-white font-bold text-base active:bg-dark-oak cursor-pointer"
      >
        +
      </button>
    </div>
  </div>
);

export const CreateAnimationWizard: React.FC<CreateAnimationWizardProps> = ({
  speciesId,
  initialMode = 'physical_attack',
  onOpenCatalog,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [mode, setMode] = useState<StudioCreationMode>(initialMode);
  const [sourceKind, setSourceKind] = useState<StudioSourceKind>(
    initialMode === 'soul_dual' ? 'image' : 'video'
  );
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [facing, setFacing] = useState<'left' | 'right'>('left');

  // Video settings
  const [videoDuration, setVideoDuration] = useState<number>(6);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [trimStart, setTrimStart] = useState<number>(1.8);
  const [trimEnd, setTrimEnd] = useState<number>(4.5);
  const [sampleFps, setSampleFps] = useState<number>(8);

  // Grid settings (shared or image-specific)
  const [cols, setCols] = useState<number>(4);
  const [rows, setRows] = useState<number>(5);
  const [totalFrames, setTotalFrames] = useState<number>(20);

  // Dual Soul + Pet split settings
  const [autoSplitDual, setAutoSplitDual] = useState<boolean>(true);
  const [splitPercent, setSplitPercent] = useState<number>(62);

  // Chroma settings
  const [chromaMode, setChromaMode] = useState<ChromaMode>('green');
  const [tolerance, setTolerance] = useState<number>(54);
  const [despill, setDespill] = useState<number>(75);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  // Generation & Export
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [dualResult, setDualResult] = useState<DualSoulGeneratedResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedTs, setCopiedTs] = useState<boolean>(false);
  const [tsOpen, setTsOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isDualMode = mode === 'soul_dual';
  const attackRole: AnimationRole =
    mode === 'special_attack' ? 'special_attack' : 'physical_attack';

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, speciesId]);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const speciesDef = SPECIES[speciesId];
  const speciesName = speciesDef?.name ?? `SoulDoll #${pad2(speciesId)}`;
  const existingSpeciesAnim = useMemo(
    () => SPECIES_ANIMATION_REGISTRY.find((a) => a.speciesId === speciesId),
    [speciesId]
  );

  const trimPlan = useMemo(
    () =>
      computeTrimSamplingPlan({
        start: trimStart,
        end: trimEnd,
        fps: sampleFps,
        cols,
        duration: videoDuration,
        maxFrames: 36,
      }),
    [trimStart, trimEnd, sampleFps, cols, videoDuration]
  );

  const drawVideoCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    if (chromaMode !== 'none') {
      const img = ctx.getImageData(0, 0, w, h);
      applyChromaKeyRgba(img.data, chromaMode, tolerance, despill);
      ctx.putImageData(img, 0, 0);
    }
  }, [chromaMode, tolerance, despill]);

  const drawImageCanvas = useCallback(() => {
    const imgEl = imageElRef.current;
    const canvas = previewCanvasRef.current;
    if (!imgEl || !canvas || !imgEl.complete || imgEl.naturalWidth === 0) return;
    const w = imgEl.naturalWidth;
    const h = imgEl.naturalHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgEl, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    if (chromaMode !== 'none') {
      applyChromaKeyRgba(img.data, chromaMode, tolerance, despill);
      ctx.putImageData(img, 0, 0);
    }

    ctx.save();
    const lw = Math.max(2, Math.round(w / 320));
    ctx.lineWidth = lw;

    if (isDualMode) {
      const regions = detectDualSoulRegions(
        img.data,
        w,
        h,
        autoSplitDual ? undefined : splitPercent / 100
      );
      ctx.strokeStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(0, regions.splitY);
      ctx.lineTo(w, regions.splitY);
      ctx.stroke();

      if (regions.soulBox) {
        ctx.strokeStyle = '#5FE3D2';
        ctx.strokeRect(
          regions.soulBox.x0,
          regions.soulBox.y0,
          regions.soulBox.w,
          regions.soulBox.h
        );
      }
      if (regions.followerBox) {
        ctx.strokeStyle = '#E8B84A';
        ctx.strokeRect(
          regions.followerBox.x0,
          regions.followerBox.y0,
          regions.followerBox.w,
          regions.followerBox.h
        );
      }
    } else {
      ctx.strokeStyle = '#5FE3D2';
      const safeCols = Math.max(1, cols);
      const safeRows = Math.max(1, rows);
      for (let c = 1; c < safeCols; c++) {
        const x = Math.round((w / safeCols) * c);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let r = 1; r < safeRows; r++) {
        const y = Math.round((h / safeRows) * r);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [chromaMode, tolerance, despill, cols, rows, isDualMode, autoSplitDual, splitPercent]);

  useEffect(() => {
    if (step !== 2 || !sourceUrl) return;
    if (sourceKind === 'image') {
      drawImageCanvas();
      return;
    }
    let rafId = 0;
    const loop = () => {
      drawVideoCanvas();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [step, sourceUrl, sourceKind, drawVideoCanvas, drawImageCanvas]);

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    setErrorMsg('');
    setResult(null);
    setDualResult(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;

    if (!isDualMode && (file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name))) {
      setSourceKind('video');
      setSourceUrl(nextUrl);
      setSourceLabel(file.name);
      setChromaMode('green');
      setCols(4);
      setStep(2);
    } else {
      setSourceKind('image');
      setSourceUrl(nextUrl);
      setSourceLabel(file.name);
      setChromaMode(isDualMode ? 'green' : 'grey');
      setCols(4);
      setRows(5);
      setTotalFrames(20);
      setStep(2);
    }
  };

  const loadSampleVideo = () => {
    setErrorMsg('');
    setResult(null);
    setDualResult(null);
    setSourceKind('video');
    setSourceUrl(SAMPLE_VIDEO_PATH);
    setSourceLabel('Video demo (Guerrera Cósmica)');
    setTrimStart(1.85);
    setTrimEnd(4.55);
    setSampleFps(7.5);
    setCols(4);
    setChromaMode('green');
    setFacing('left');
    setStep(2);
  };

  const loadSampleDualSheet = () => {
    setErrorMsg('');
    setResult(null);
    setDualResult(null);
    setMode('soul_dual');
    setSourceKind('image');
    setSourceUrl(SAMPLE_DUAL_SOUL_PATH);
    setSourceLabel('Hoja demo #01 (Alma + Pet)');
    setAutoSplitDual(true);
    setChromaMode('green');
    setStep(2);
  };

  const loadExistingForEdit = () => {
    if (!existingSpeciesAnim) return;
    setErrorMsg('');
    setResult(null);
    setDualResult(null);
    setMode(existingSpeciesAnim.role);
    setSourceKind('image');
    setSourceUrl(existingSpeciesAnim.spec.path);
    setSourceLabel(existingSpeciesAnim.label);
    setCols(existingSpeciesAnim.spec.cols);
    setRows(existingSpeciesAnim.spec.rows);
    setTotalFrames(existingSpeciesAnim.spec.totalFrames);
    setFacing(existingSpeciesAnim.spec.facing ?? 'right');
    setChromaMode('none');
    setStep(2);
  };

  const handleProcess = async () => {
    if (isProcessing || !sourceUrl) return;
    setErrorMsg('');
    setIsProcessing(true);

    try {
      if (sourceKind === 'video') {
        const video = videoRef.current;
        if (!video || video.readyState < 1) {
          setErrorMsg('El video aún está cargando. Espera un segundo e inténtalo de nuevo.');
          return;
        }
        video.pause();
        setVideoPlaying(false);

        const cellW = video.videoWidth || 640;
        const cellH = video.videoHeight || 360;
        const cCols = Math.max(1, cols);
        const cRows = trimPlan.rows;

        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = cellW * cCols;
        sheetCanvas.height = cellH * cRows;
        const sheetCtx = sheetCanvas.getContext('2d');
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = cellW;
        frameCanvas.height = cellH;
        const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
        if (!sheetCtx || !frameCtx) return;

        const seekTo = (t: number) =>
          new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = t;
          });

        for (let i = 0; i < trimPlan.timestamps.length; i++) {
          await seekTo(trimPlan.timestamps[i]);
          frameCtx.clearRect(0, 0, cellW, cellH);
          frameCtx.drawImage(video, 0, 0, cellW, cellH);
          if (chromaMode !== 'none') {
            const img = frameCtx.getImageData(0, 0, cellW, cellH);
            applyChromaKeyRgba(img.data, chromaMode, tolerance, despill);
            frameCtx.putImageData(img, 0, 0);
          }
          sheetCtx.drawImage(
            frameCanvas,
            (i % cCols) * cellW,
            Math.floor(i / cCols) * cellH
          );
        }

        const dataUrl = sheetCanvas.toDataURL('image/webp', 0.92);
        setResult({
          dataUrl,
          cols: cCols,
          rows: cRows,
          totalFrames: trimPlan.totalFrames,
          cellW,
          cellH,
          impactFrame: Math.floor(trimPlan.totalFrames * 0.45),
          sourceKind: 'video',
        });
        setStep(3);
      } else if (isDualMode) {
        const imgEl = imageElRef.current;
        if (!imgEl || !imgEl.complete || imgEl.naturalWidth === 0) {
          setErrorMsg('La imagen aún está cargando. Inténtalo de nuevo.');
          return;
        }
        const w = imgEl.naturalWidth;
        const h = imgEl.naturalHeight;
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = w;
        cleanCanvas.height = h;
        const cleanCtx = cleanCanvas.getContext('2d', { willReadFrequently: true });
        if (!cleanCtx) return;
        cleanCtx.drawImage(imgEl, 0, 0, w, h);
        const imgData = cleanCtx.getImageData(0, 0, w, h);
        if (chromaMode !== 'none') {
          applyChromaKeyRgba(imgData.data, chromaMode, tolerance, despill);
          cleanCtx.putImageData(imgData, 0, 0);
        }

        const regions = detectDualSoulRegions(
          imgData.data,
          w,
          h,
          autoSplitDual ? undefined : splitPercent / 100
        );
        if (!regions.soulBox || !regions.followerBox) {
          setErrorMsg('No se pudieron detectar ambas figuras (arriba y abajo). Ajusta la división o el fondo.');
          return;
        }

        // Normalize Wild Soul (top) onto 512x512 canvas
        const soulOut = document.createElement('canvas');
        soulOut.width = 512;
        soulOut.height = 512;
        const soulCtx = soulOut.getContext('2d');
        if (!soulCtx) return;
        const scale = Math.min((512 - 16) / regions.soulBox.w, (512 - 24) / regions.soulBox.h);
        const drawW = Math.max(1, Math.round(regions.soulBox.w * scale));
        const drawH = Math.max(1, Math.round(regions.soulBox.h * scale));
        const dx = Math.round((512 - drawW) * 0.5);
        const dy = 512 - 16 - drawH;
        soulCtx.imageSmoothingEnabled = true;
        soulCtx.imageSmoothingQuality = 'high';
        soulCtx.drawImage(
          cleanCanvas,
          regions.soulBox.x0,
          regions.soulBox.y0,
          regions.soulBox.w,
          regions.soulBox.h,
          dx,
          dy,
          drawW,
          drawH
        );

        // Tightly crop reserved Pixel-Art Pet (bottom)
        const pad = 4;
        const fw = regions.followerBox.w + pad * 2;
        const fh = regions.followerBox.h + pad * 2;
        const petOut = document.createElement('canvas');
        petOut.width = fw;
        petOut.height = fh;
        const petCtx = petOut.getContext('2d');
        if (!petCtx) return;
        petCtx.imageSmoothingEnabled = false;
        petCtx.drawImage(
          cleanCanvas,
          regions.followerBox.x0,
          regions.followerBox.y0,
          regions.followerBox.w,
          regions.followerBox.h,
          pad,
          pad,
          regions.followerBox.w,
          regions.followerBox.h
        );

        setResult(null);
        setDualResult({
          soulDataUrl: soulOut.toDataURL('image/webp', 0.94),
          followerDataUrl: petOut.toDataURL('image/webp', 0.96),
          followerW: fw,
          followerH: fh,
        });
        setStep(3);
      } else {
        const imgEl = imageElRef.current;
        if (!imgEl || !imgEl.complete || imgEl.naturalWidth === 0) {
          setErrorMsg('La imagen aún está cargando. Inténtalo de nuevo.');
          return;
        }
        const w = imgEl.naturalWidth;
        const h = imgEl.naturalHeight;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(imgEl, 0, 0, w, h);
        if (chromaMode !== 'none') {
          const img = ctx.getImageData(0, 0, w, h);
          applyChromaKeyRgba(img.data, chromaMode, tolerance, despill);
          ctx.putImageData(img, 0, 0);
        }
        const safeCols = Math.max(1, cols);
        const safeRows = Math.max(1, rows);
        const safeTotal = Math.max(1, Math.min(safeCols * safeRows, totalFrames));
        const dataUrl = outCanvas.toDataURL('image/webp', 0.94);

        setDualResult(null);
        setResult({
          dataUrl,
          cols: safeCols,
          rows: safeRows,
          totalFrames: safeTotal,
          cellW: Math.round(w / safeCols),
          cellH: Math.round(h / safeRows),
          impactFrame: Math.floor(safeTotal * 0.45),
          sourceKind: 'image',
        });
        setStep(3);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const exportMeta = result
    ? {
        speciesId,
        speciesName,
        role: attackRole,
        cols: result.cols,
        rows: result.rows,
        totalFrames: result.totalFrames,
        impactFrame: result.impactFrame,
        cellW: result.cellW,
        cellH: result.cellH,
        facing,
        sourceKind: result.sourceKind,
      }
    : null;

  const outputFileName = buildOutputFileName(speciesId, attackRole);
  const agentPromptText = isDualMode && dualResult
    ? buildDualSoulAgentPrompt({
        speciesId,
        speciesName,
        followerW: dualResult.followerW,
        followerH: dualResult.followerH,
      })
    : exportMeta
      ? buildAgentPromptSummary(exportMeta)
      : '';
  const tsSnippetText = isDualMode && dualResult
    ? buildDualSoulTsSnippet(speciesId)
    : exportMeta
      ? buildTsSnippet(exportMeta)
      : '';
  const step3Ready = Boolean(result || dualResult);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
      {/* Compact Selected SoulDoll Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-abyss-ink border-2 border-ash-purple px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-10 bg-crypt-ink border border-resonant-gold overflow-hidden shrink-0">
            <img
              src={getSoulDollSheetUrl(speciesId)}
              alt={speciesName}
              className="h-full max-w-none w-[200%] object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-pale-gold truncate">
              #{pad2(speciesId)} · {speciesName}
            </div>
            <button
              type="button"
              onClick={onOpenCatalog}
              className="text-[11px] font-bold text-ki-cyan underline cursor-pointer"
            >
              Cambiar
            </button>
          </div>
        </div>

        {/* Mode Selector (Físico / Especial / Alma + Pet) */}
        <div className="grid grid-cols-3 gap-1 shrink-0">
          <PxButton
            size="sm"
            variant={mode === 'physical_attack' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => {
              setMode('physical_attack');
              setDualResult(null);
            }}
            className="min-h-[44px] px-2 whitespace-nowrap"
          >
            Físico
          </PxButton>
          <PxButton
            size="sm"
            variant={mode === 'special_attack' ? 'primary' : 'ghost'}
            showSelector={false}
            onClick={() => {
              setMode('special_attack');
              setDualResult(null);
            }}
            className="min-h-[44px] px-2 whitespace-nowrap"
          >
            Especial
          </PxButton>
          <PxButton
            size="sm"
            variant={mode === 'soul_dual' ? 'arcane' : 'ghost'}
            showSelector={false}
            onClick={() => {
              setMode('soul_dual');
              setSourceKind('image');
              setChromaMode('green');
              setResult(null);
            }}
            className="min-h-[44px] px-2 whitespace-nowrap"
          >
            Alma + Pet
          </PxButton>
        </div>
      </div>

      {/* 3-Step Visual Stepper */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0" role="navigation" aria-label="Pasos del asistente">
        <PxButton
          size="sm"
          variant={step === 1 ? 'primary' : 'secondary'}
          showSelector={false}
          onClick={() => setStep(1)}
          className="min-h-[44px] px-1"
        >
          1. Archivo
        </PxButton>
        <PxButton
          size="sm"
          variant={step === 2 ? 'primary' : 'secondary'}
          showSelector={false}
          disabled={!sourceUrl}
          onClick={() => setStep(2)}
          className="min-h-[44px] px-1"
        >
          2. Ajustar
        </PxButton>
        <PxButton
          size="sm"
          variant={step === 3 ? 'primary' : 'secondary'}
          showSelector={false}
          disabled={!step3Ready}
          onClick={() => setStep(3)}
          className="min-h-[44px] px-1"
        >
          3. Guardar
        </PxButton>
      </div>

      {/* Scrollable Step Content */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 touch-scroll overflow-y-auto pr-0.5">
        {/* ==================== PASO 1: ELEGIR ARCHIVO ==================== */}
        {step === 1 && (
          <div className="flex flex-col gap-3 bg-abyss-ink border-2 border-ash-purple p-3 sm:p-4 max-w-2xl mx-auto">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-pale-gold">
                {isDualMode
                  ? 'Paso 1: Sube tu hoja Alma Salvaje + Mascota'
                  : 'Paso 1: Sube tu video o spritesheet'}
              </h3>
              <p className="text-xs text-bone-gray mt-1 leading-relaxed">
                {isDualMode
                  ? 'Imagen vertical con el alma sin cuerpo arriba y la mascota pixel art abajo sobre fondo verde/gris.'
                  : 'Acepta videos con fondo verde/gris (MP4, WebM) o imágenes en rejilla (PNG, WebP).'}
              </p>
            </div>

            <label className="px-btn px-btn-primary min-h-[52px] w-full flex items-center justify-center text-sm font-bold cursor-pointer text-center px-3">
              {isDualMode ? 'Elegir Imagen (Alma + Mascota)' : 'Elegir Video o Imagen'}
              <input
                type="file"
                accept={isDualMode ? 'image/*' : 'video/*,image/*'}
                className="hidden"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              {isDualMode ? (
                <PxButton
                  size="md"
                  variant="secondary"
                  fullWidth
                  showSelector={false}
                  onClick={loadSampleDualSheet}
                >
                  Usar hoja demo (#01 Alma + Pet)
                </PxButton>
              ) : (
                <PxButton
                  size="md"
                  variant="secondary"
                  fullWidth
                  showSelector={false}
                  onClick={loadSampleVideo}
                >
                  Usar video demo (Guerrera)
                </PxButton>
              )}

              {!isDualMode && existingSpeciesAnim && (
                <PxButton
                  size="md"
                  variant="arcane"
                  fullWidth
                  showSelector={false}
                  onClick={loadExistingForEdit}
                >
                  Editar hoja actual (#{pad2(speciesId)})
                </PxButton>
              )}
            </div>
          </div>
        )}

        {/* ==================== PASO 2: AJUSTAR RECORTE Y FONDO ==================== */}
        {step === 2 && sourceUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Hidden video/img decoders */}
            {sourceKind === 'video' ? (
              <video
                ref={videoRef}
                src={sourceUrl}
                muted
                loop
                playsInline
                crossOrigin="anonymous"
                className="hidden"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 6;
                  setVideoDuration(dur);
                  setTrimStart((prev) => Math.min(prev, Math.max(0, dur - 0.5)));
                  setTrimEnd((prev) => Math.min(dur, Math.max(0.5, prev)));
                  v.currentTime = Math.min(trimStart, dur - 0.1);
                }}
                onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
              />
            ) : (
              <img
                ref={imageElRef}
                src={sourceUrl}
                alt={sourceLabel}
                crossOrigin="anonymous"
                className="hidden"
                onLoad={() => drawImageCanvas()}
              />
            )}

            {/* Single Unified Live Chroma Preview */}
            <div className="bg-abyss-ink border-2 border-ash-purple p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-pale-gold truncate">{sourceLabel}</span>
                <span className="font-mono text-ki-cyan tabular-nums shrink-0">
                  {isDualMode
                    ? 'Cian: Alma · Oro: Pet'
                    : sourceKind === 'video'
                      ? `${trimPlan.totalFrames}f · ${cols}×${trimPlan.rows}`
                      : `${cols}×${rows} (${totalFrames}f)`}
                </span>
              </div>

              <div
                className="w-full h-48 sm:h-64 flex items-center justify-center overflow-hidden border-2 border-ash-purple p-1 bg-abyss-ink"
                style={CHECKER_STYLE_CLEAN}
              >
                <canvas
                  ref={previewCanvasRef}
                  data-testid="studio-live-canvas"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {sourceKind === 'video' && !isDualMode && (
                <div className="flex items-center gap-2">
                  <PxButton
                    size="sm"
                    variant={videoPlaying ? 'secondary' : 'primary'}
                    showSelector={false}
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      if (v.paused) v.play().catch(() => {});
                      else v.pause();
                    }}
                    className="min-h-[44px] px-3 shrink-0"
                  >
                    {videoPlaying ? 'Pausa' : 'Play'}
                  </PxButton>
                  <input
                    type="range"
                    aria-label="Posición del video"
                    min={0}
                    max={videoDuration}
                    step={0.05}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setVideoCurrentTime(t);
                      if (videoRef.current) videoRef.current.currentTime = t;
                    }}
                    className="flex-1 min-w-0 accent-ki-cyan cursor-pointer"
                  />
                  <span className="text-xs font-mono text-bone-gray tabular-nums shrink-0">
                    {videoCurrentTime.toFixed(1)}s
                  </span>
                </div>
              )}
            </div>

            {/* Logical Controls Column */}
            <div className="bg-abyss-ink border-2 border-ash-purple p-2.5 flex flex-col gap-3">
              {isDualMode ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-pale-gold">1. Separación vertical</span>
                    <PxButton
                      size="sm"
                      variant={autoSplitDual ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => setAutoSplitDual((a) => !a)}
                      className="min-h-[44px] px-3"
                    >
                      {autoSplitDual ? 'Auto (Activado)' : 'Manual'}
                    </PxButton>
                  </div>
                  {!autoSplitDual && (
                    <div className="bg-crypt-ink border border-ash-purple px-2.5 py-2">
                      <div className="flex justify-between text-[11px] text-bone-gray mb-1">
                        <span>Corte horizontal</span>
                        <span className="font-mono text-ki-cyan">{splitPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={80}
                        value={splitPercent}
                        onChange={(e) => setSplitPercent(Number(e.target.value))}
                        className="w-full accent-resonant-gold"
                      />
                    </div>
                  )}
                </div>
              ) : sourceKind === 'video' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-pale-gold">1. Tramo del ataque</span>
                      <span className="font-mono text-ki-cyan tabular-nums">
                        {trimPlan.start.toFixed(1)}s – {trimPlan.end.toFixed(1)}s
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-crypt-ink border border-ash-purple px-2.5 py-2">
                        <div className="flex justify-between text-[11px] text-bone-gray mb-1">
                          <span>Inicio</span>
                          <span className="font-mono text-warm-white">{trimStart.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0.2, videoDuration - 0.2)}
                          step={0.05}
                          value={trimStart}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTrimStart(v);
                            if (videoRef.current) videoRef.current.currentTime = v;
                          }}
                          className="w-full accent-resonant-gold"
                        />
                      </div>
                      <div className="bg-crypt-ink border border-ash-purple px-2.5 py-2">
                        <div className="flex justify-between text-[11px] text-bone-gray mb-1">
                          <span>Fin</span>
                          <span className="font-mono text-warm-white">{trimEnd.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min={0.2}
                          max={videoDuration}
                          step={0.05}
                          value={trimEnd}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTrimEnd(v);
                            if (videoRef.current) videoRef.current.currentTime = v;
                          }}
                          className="w-full accent-resonant-gold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-pale-gold">2. Fluidez (FPS)</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Compacto (6)', fps: 6 },
                        { label: 'Normal (8)', fps: 8 },
                        { label: 'Suave (12)', fps: 12 },
                      ].map((opt) => (
                        <PxButton
                          key={opt.fps}
                          size="sm"
                          variant={Math.round(sampleFps) === opt.fps ? 'primary' : 'ghost'}
                          showSelector={false}
                          onClick={() => setSampleFps(opt.fps)}
                          className="min-h-[44px] px-1 text-xs"
                        >
                          {opt.label}
                        </PxButton>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-pale-gold">1. Cuadrícula de la imagen</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <PxButton
                      size="sm"
                      variant={cols === 4 && rows === 5 ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => {
                        setCols(4);
                        setRows(5);
                        setTotalFrames(20);
                      }}
                      className="min-h-[44px]"
                    >
                      4×5 (20f)
                    </PxButton>
                    <PxButton
                      size="sm"
                      variant={cols === 5 && rows === 5 ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => {
                        setCols(5);
                        setRows(5);
                        setTotalFrames(25);
                      }}
                      className="min-h-[44px]"
                    >
                      5×5 (25f)
                    </PxButton>
                    <PxButton
                      size="sm"
                      variant={cols === 2 && rows === 1 ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => {
                        setCols(2);
                        setRows(1);
                        setTotalFrames(2);
                      }}
                      className="min-h-[44px]"
                    >
                      1×2 Idle
                    </PxButton>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <StepperRow
                      label="Columnas"
                      value={cols}
                      onStep={(d) => setCols((c) => stepBounded(c, d, 1, 16))}
                    />
                    <StepperRow
                      label="Filas"
                      value={rows}
                      onStep={(d) => setRows((r) => stepBounded(r, d, 1, 16))}
                    />
                  </div>
                  <StepperRow
                    label="Total de frames"
                    value={totalFrames}
                    onStep={(d) => setTotalFrames((f) => stepBounded(f, d, 1, cols * rows))}
                  />
                </div>
              )}

              {/* Background Removal Preset */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-pale-gold">
                  {sourceKind === 'video' && !isDualMode ? '3. Quitar fondo' : '2. Quitar fondo'}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'green', label: 'Verde' },
                      { id: 'grey', label: 'Gris' },
                      { id: 'white', label: 'Blanco' },
                      { id: 'black', label: 'Negro' },
                      { id: 'none', label: 'Ninguno' },
                    ] as { id: ChromaMode; label: string }[]
                  ).map((bg) => (
                    <PxButton
                      key={bg.id}
                      size="sm"
                      variant={chromaMode === bg.id ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => setChromaMode(bg.id)}
                      className="min-h-[44px] px-1"
                    >
                      {bg.label}
                    </PxButton>
                  ))}
                </div>
              </div>

              {/* Facing Direction (attack modes only) */}
              {!isDualMode && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pale-gold">Hacia dónde ataca</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <PxButton
                      size="sm"
                      variant={facing === 'left' ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => setFacing('left')}
                      className="min-h-[44px]"
                    >
                      Izquierda (←)
                    </PxButton>
                    <PxButton
                      size="sm"
                      variant={facing === 'right' ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => setFacing('right')}
                      className="min-h-[44px]"
                    >
                      Derecha (→)
                    </PxButton>
                  </div>
                </div>
              )}

              {/* Collapsible Advanced Chroma Tuning */}
              <div className="border border-ash-purple bg-crypt-ink">
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((o) => !o)}
                  className="w-full min-h-[44px] px-3 flex items-center justify-between text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
                >
                  <span>
                    {isDualMode ? 'Ajustes finos (tolerancia / bordes)' : 'Ajustes finos (tolerancia / columnas)'}
                  </span>
                  <span className="font-mono text-pale-gold">
                    {advancedOpen ? 'Ocultar' : 'Abrir'}
                  </span>
                </button>
                {advancedOpen && (
                  <div className="p-2.5 border-t border-ash-purple flex flex-col gap-2">
                    {!isDualMode && (
                      <StepperRow
                        label="Columnas de salida"
                        value={cols}
                        onStep={(d) => setCols((c) => stepBounded(c, d, 1, 10))}
                      />
                    )}
                    <div className="bg-abyss-ink border border-ash-purple px-2.5 py-2">
                      <div className="flex justify-between text-[11px] text-bone-gray mb-1">
                        <span>Tolerancia de color</span>
                        <span className="font-mono text-ki-cyan">{tolerance}</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-full accent-ki-cyan"
                      />
                    </div>
                    <div className="bg-abyss-ink border border-ash-purple px-2.5 py-2">
                      <div className="flex justify-between text-[11px] text-bone-gray mb-1">
                        <span>Limpieza de bordes (despill)</span>
                        <span className="font-mono text-ki-cyan">{despill}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={despill}
                        onChange={(e) => setDespill(Number(e.target.value))}
                        className="w-full accent-ki-cyan"
                      />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="text-xs text-coral-red bg-dried-blood border border-rift-crimson px-2.5 py-2">
                  {errorMsg}
                </div>
              )}

              {/* Primary CTA */}
              <div className="flex items-center gap-2 pt-1">
                <PxButton
                  size="md"
                  variant="ghost"
                  showSelector={false}
                  onClick={() => setStep(1)}
                  className="shrink-0"
                >
                  Atrás
                </PxButton>
                <PxButton
                  size="md"
                  variant="primary"
                  fullWidth
                  showSelector={false}
                  disabled={isProcessing}
                  onClick={handleProcess}
                >
                  {isProcessing ? 'Procesando...' : 'Generar y Probar →'}
                </PxButton>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PASO 3: PROBAR Y EXPORTAR ==================== */}
        {step === 3 && isDualMode && dualResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-abyss-ink border-2 border-ash-purple p-2.5 grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-ki-cyan truncate">Alma (512×512)</span>
                <div
                  className="h-44 sm:h-56 flex items-center justify-center border border-ash-purple p-2 bg-abyss-ink"
                  style={CHECKER_STYLE_CLEAN}
                >
                  <img
                    src={dualResult.soulDataUrl}
                    alt={`Alma Salvaje #${pad2(speciesId)}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-pale-gold truncate">
                  Pet ({dualResult.followerW}×{dualResult.followerH})
                </span>
                <div
                  className="h-44 sm:h-56 flex items-center justify-center border border-ash-purple p-2 bg-abyss-ink"
                  style={CHECKER_STYLE_CLEAN}
                >
                  <img
                    src={dualResult.followerDataUrl}
                    alt={`Mascota Pixel #${pad2(speciesId)}`}
                    className="max-h-full max-w-full object-contain pixel-canvas"
                  />
                </div>
              </div>
            </div>

            <div className="bg-abyss-ink border-2 border-resonant-gold p-3 flex flex-col gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neon-mint">
                  Alma y Mascota separadas
                </h3>
                <p className="text-xs text-bone-gray font-mono mt-1 tabular-nums">
                  souls/{pad2(speciesId)}.webp (512×512) · followers/{pad2(speciesId)}.webp ({dualResult.followerW}×{dualResult.followerH})
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={dualResult.soulDataUrl}
                  download={`soul_${pad2(speciesId)}.webp`}
                  className="px-btn px-btn-primary min-h-[48px] w-full inline-flex items-center justify-center text-xs sm:text-sm font-bold text-center px-2 whitespace-nowrap"
                >
                  Descargar Alma ({pad2(speciesId)})
                </a>
                <a
                  href={dualResult.followerDataUrl}
                  download={`follower_${pad2(speciesId)}.webp`}
                  className="px-btn px-btn-arcane min-h-[48px] w-full inline-flex items-center justify-center text-xs sm:text-sm font-bold text-center px-2 whitespace-nowrap"
                >
                  Descargar Pet ({pad2(speciesId)})
                </a>
              </div>

              <PxButton
                size="md"
                variant="secondary"
                fullWidth
                showSelector={false}
                onClick={() => {
                  navigator.clipboard?.writeText(agentPromptText);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
              >
                {copiedPrompt ? 'Instrucción copiada' : 'Copiar instrucción para Agente'}
              </PxButton>

              <div className="bg-crypt-ink border border-ash-purple p-2.5 text-xs text-porcelain leading-relaxed select-text">
                {agentPromptText}
              </div>

              <div className="border border-ash-purple bg-crypt-ink">
                <button
                  type="button"
                  aria-expanded={tsOpen}
                  onClick={() => setTsOpen((o) => !o)}
                  className="w-full min-h-[44px] px-3 flex items-center justify-between text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
                >
                  <span>Código TypeScript (soulForms.ts)</span>
                  <span className="font-mono text-pale-gold">{tsOpen ? 'Ocultar' : 'Ver'}</span>
                </button>
                {tsOpen && (
                  <div className="p-2.5 border-t border-ash-purple flex flex-col gap-2">
                    <pre className="text-[11px] font-mono text-ki-cyan overflow-x-auto select-text">
                      {tsSnippetText}
                    </pre>
                    <PxButton
                      size="sm"
                      variant="secondary"
                      showSelector={false}
                      onClick={() => {
                        navigator.clipboard?.writeText(tsSnippetText);
                        setCopiedTs(true);
                        setTimeout(() => setCopiedTs(false), 2000);
                      }}
                    >
                      {copiedTs ? 'Snippet copiado' : 'Copiar código TS'}
                    </PxButton>
                  </div>
                )}
              </div>

              <PxButton
                size="md"
                variant="ghost"
                fullWidth
                showSelector={false}
                onClick={() => setStep(2)}
              >
                ← Volver a ajustar corte o fondo
              </PxButton>
            </div>
          </div>
        )}

        {step === 3 && !isDualMode && result && exportMeta && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-abyss-ink border-2 border-ash-purple p-2.5">
              <SpriteStagePreview
                assetPath={result.dataUrl}
                cols={result.cols}
                rows={result.rows}
                totalFrames={result.totalFrames}
                impactFrame={result.impactFrame}
                fallbackAspect={result.cellW / result.cellH}
                onImpactFrameChange={(nextImpact) =>
                  setResult((prev) => (prev ? { ...prev, impactFrame: nextImpact } : prev))
                }
              />
            </div>

            <div className="bg-abyss-ink border-2 border-resonant-gold p-3 flex flex-col gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neon-mint">
                  Spritesheet listo para usar
                </h3>
                <p className="text-xs text-bone-gray font-mono mt-1 tabular-nums">
                  {outputFileName} · {result.cols}×{result.rows} ({result.totalFrames} frames) ·
                  celda {result.cellW}×{result.cellH} · impacto #{result.impactFrame}
                </p>
              </div>

              <a
                href={result.dataUrl}
                download={outputFileName}
                className="px-btn px-btn-primary min-h-[48px] w-full inline-flex items-center justify-center text-sm font-bold"
              >
                Descargar {outputFileName}
              </a>

              <PxButton
                size="md"
                variant="arcane"
                fullWidth
                showSelector={false}
                onClick={() => {
                  navigator.clipboard?.writeText(agentPromptText);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
              >
                {copiedPrompt ? 'Instrucción copiada' : 'Copiar instrucción para Agente'}
              </PxButton>

              <div className="bg-crypt-ink border border-ash-purple p-2.5 text-xs text-porcelain leading-relaxed select-text">
                {agentPromptText}
              </div>

              {/* Collapsible TS Config */}
              <div className="border border-ash-purple bg-crypt-ink">
                <button
                  type="button"
                  aria-expanded={tsOpen}
                  onClick={() => setTsOpen((o) => !o)}
                  className="w-full min-h-[44px] px-3 flex items-center justify-between text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
                >
                  <span>Código TypeScript (animations.ts)</span>
                  <span className="font-mono text-pale-gold">{tsOpen ? 'Ocultar' : 'Ver'}</span>
                </button>
                {tsOpen && (
                  <div className="p-2.5 border-t border-ash-purple flex flex-col gap-2">
                    <pre className="text-[11px] font-mono text-ki-cyan overflow-x-auto select-text">
                      {tsSnippetText}
                    </pre>
                    <PxButton
                      size="sm"
                      variant="secondary"
                      showSelector={false}
                      onClick={() => {
                        navigator.clipboard?.writeText(tsSnippetText);
                        setCopiedTs(true);
                        setTimeout(() => setCopiedTs(false), 2000);
                      }}
                    >
                      {copiedTs ? 'Snippet copiado' : 'Copiar código TS'}
                    </PxButton>
                  </div>
                )}
              </div>

              <PxButton
                size="md"
                variant="ghost"
                fullWidth
                showSelector={false}
                onClick={() => setStep(2)}
              >
                ← Volver a ajustar recorte o fondo
              </PxButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPropAtlasSnippet,
  PROP_ASSET_CATEGORIES,
  PROP_ATLAS_REGISTRY,
  PROP_CATEGORY_DEFAULTS,
  slugifyPropBaseName,
  type PropAssetCategory,
} from '../../../data/propAssets.ts';
import {
  applyChromaKeyRgba,
  type ChromaMode,
  stepBounded,
} from '../../../domain/SpriteStudioLogic.ts';
import { PxButton } from '../PxButton.tsx';
import { CHECKER_STYLE_CLEAN } from './SpriteStagePreview.tsx';

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
        className="min-h-[40px] min-w-[40px] bg-smoked-wood border-2 border-cold-stone text-warm-white font-bold text-base active:bg-dark-oak cursor-pointer"
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
        className="min-h-[40px] min-w-[40px] bg-smoked-wood border-2 border-cold-stone text-warm-white font-bold text-base active:bg-dark-oak cursor-pointer"
      >
        +
      </button>
    </div>
  </div>
);

const ToggleButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <PxButton
    size="sm"
    variant={active ? 'success' : 'ghost'}
    showSelector={false}
    aria-pressed={active}
    onClick={onClick}
    className="min-h-[40px] px-1.5"
  >
    {label}
  </PxButton>
);

export const PropAssetStudioTab: React.FC = () => {
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [sourceName, setSourceName] = useState<string>('');
  const [imageReady, setImageReady] = useState<boolean>(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cols, setCols] = useState<number>(4);
  const [rows, setRows] = useState<number>(4);
  const [category, setCategory] = useState<PropAssetCategory>('flower');
  const [baseName, setBaseName] = useState<string>('flower');
  const defaults = PROP_CATEGORY_DEFAULTS[category];
  const [width, setWidth] = useState<number>(defaults.width);
  const [height, setHeight] = useState<number>(defaults.height);
  const [windAmp, setWindAmp] = useState<number>(defaults.windAmp);
  const [shadow, setShadow] = useState<boolean>(defaults.shadow);
  const [occludable, setOccludable] = useState<boolean>(defaults.occludable);
  const [solid, setSolid] = useState<boolean>(defaults.solid);
  const [grass, setGrass] = useState<boolean>(defaults.grass);
  const [chromaMode, setChromaMode] = useState<ChromaMode>('grey');
  const [tolerance, setTolerance] = useState<number>(54);
  const [despill, setDespill] = useState<number>(75);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [snippet, setSnippet] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const slug = slugifyPropBaseName(baseName);
  const sheetPath = `/assets/props/${category}/${slug}.webp`;
  const cellW = imageSize.width / Math.max(1, cols);
  const cellH = imageSize.height / Math.max(1, rows);
  const cellsSquare =
    imageSize.width > 0 &&
    Math.abs(cellW - cellH) / Math.max(cellW, cellH, 1) <= 0.02;
  const selectedIndices = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected]
  );
  const canExport = imageReady && cellsSquare && selectedIndices.length > 0;
  const registryByCategory = useMemo(() => {
    const counts = new Map<PropAssetCategory, number>();
    for (const entry of PROP_ATLAS_REGISTRY) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  useEffect(() => {
    if (!imageReady) return;
    setSelected(new Set(Array.from({ length: cols * rows }, (_, index) => index)));
    setSnippet('');
  }, [imageReady, imageSize.width, imageSize.height, cols, rows]);

  useEffect(() => {
    if (!imageReady) return;
    const img = sourceImgRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    if (chromaMode !== 'none') {
      const imgData = ctx.getImageData(0, 0, w, h);
      applyChromaKeyRgba(imgData.data, chromaMode, tolerance, despill);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [imageReady, sourceUrl, chromaMode, tolerance, despill]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setSourceUrl(nextUrl);
    setSourceName(file.name);
    setImageReady(false);
    setImageSize({ width: 0, height: 0 });
    setSelected(new Set());
    setSnippet('');
    setErrorMsg('');
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
      setErrorMsg('No se pudo leer la imagen.');
      return;
    }
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageReady(true);
  };

  const handleCategory = (next: PropAssetCategory) => {
    const nextDefaults = PROP_CATEGORY_DEFAULTS[next];
    setCategory(next);
    setWidth(nextDefaults.width);
    setHeight(nextDefaults.height);
    setWindAmp(nextDefaults.windAmp);
    setShadow(nextDefaults.shadow);
    setOccludable(nextDefaults.occludable);
    setSolid(nextDefaults.solid);
    setGrass(nextDefaults.grass);
    setSnippet('');
  };

  const toggleCell = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setSnippet('');
  };

  const downloadAtlas = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/webp', 0.94);
    link.download = `${slug}.webp`;
    link.click();
  };

  const generateSnippet = () => {
    if (!canExport) return;
    setSnippet(
      buildPropAtlasSnippet({
        baseName,
        category,
        sheetPath,
        cols,
        rows,
        cellIndices: selectedIndices,
        width,
        height,
        windAmp,
        shadow,
        occludable,
        solid,
        grass,
      })
    );
  };

  const copySnippet = () => {
    if (!snippet) return;
    navigator.clipboard?.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 touch-scroll overflow-y-auto pr-0.5">
      <div className="flex flex-col gap-3 max-w-4xl mx-auto">
        <div className="bg-abyss-ink border-2 border-ash-purple p-3">
          <h3 className="text-sm sm:text-base font-bold text-pale-gold">
            Importar atlas de props 1:1
          </h3>
          <p className="text-xs text-bone-gray mt-1 leading-relaxed">
            Sube una hoja con celdas cuadradas. Cada celda se registra como una variante
            independiente y se guarda como atlas + UV para usarse en el overworld.
          </p>
          <label className="px-btn px-btn-primary min-h-[48px] w-full flex items-center justify-center text-sm font-bold cursor-pointer text-center px-3 mt-3">
            Elegir hoja de props
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
          </label>
          {sourceName && (
            <div className="text-[11px] text-bone-gray mt-2 font-mono truncate">
              {sourceName}
              {imageSize.width > 0 ? ` - ${imageSize.width} x ${imageSize.height}` : ''}
            </div>
          )}
          {errorMsg && (
            <div className="text-xs text-coral-red bg-dried-blood border border-rift-crimson px-2.5 py-2 mt-2">
              {errorMsg}
            </div>
          )}
        </div>

        {sourceUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-abyss-ink border-2 border-ash-purple p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-pale-gold">Celdas del atlas</span>
                <span className="text-[11px] text-bone-gray">
                  {selectedIndices.length} / {cols * rows} seleccionadas
                </span>
              </div>

              <div
                className="w-full flex justify-center bg-crypt-ink border border-ash-purple p-2"
                style={CHECKER_STYLE_CLEAN}
              >
                <div className="relative inline-flex max-w-full max-h-[42vh]">
                  <canvas
                    ref={previewCanvasRef}
                    className="block max-h-[42vh] max-w-full w-auto h-auto"
                  />
                  <div className="absolute inset-0">
                    {Array.from({ length: cols * rows }, (_, index) => {
                      const col = index % cols;
                      const row = Math.floor(index / cols);
                      const isSelected = selected.has(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          aria-label={`Celda ${index}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleCell(index)}
                          className={`absolute border-2 flex items-start justify-start p-0.5 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-pale-gold bg-pale-gold/20'
                              : 'border-warm-white/25 bg-transparent hover:bg-warm-white/10'
                          }`}
                          style={{
                            left: `${(col * 100) / cols}%`,
                            top: `${(row * 100) / rows}%`,
                            width: `${100 / cols}%`,
                            height: `${100 / rows}%`,
                          }}
                        >
                          <span className="text-[9px] leading-none text-warm-white/80 font-mono">
                            {index}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <img
                ref={sourceImgRef}
                src={sourceUrl}
                alt=""
                className="hidden"
                onLoad={handleImageLoad}
                onError={() => setErrorMsg('No se pudo cargar la imagen.')}
              />

              <div className="grid grid-cols-2 gap-1.5">
                <PxButton
                  size="sm"
                  variant="secondary"
                  showSelector={false}
                  onClick={() =>
                    setSelected(
                      new Set(Array.from({ length: cols * rows }, (_, index) => index))
                    )
                  }
                >
                  Todas
                </PxButton>
                <PxButton
                  size="sm"
                  variant="ghost"
                  showSelector={false}
                  onClick={() => setSelected(new Set())}
                >
                  Ninguna
                </PxButton>
              </div>

              <div
                className={`text-[11px] px-2.5 py-2 border ${
                  cellsSquare
                    ? 'text-bone-gray bg-crypt-ink border-ash-purple'
                    : 'text-coral-red bg-dried-blood border-rift-crimson'
                }`}
              >
                Celda: {Math.round(cellW)} x {Math.round(cellH)} px
                {cellsSquare
                  ? ' (1:1 válido)'
                  : ' - las celdas deben ser cuadradas; ajusta filas/columnas.'}
              </div>
            </div>

            <div className="bg-abyss-ink border-2 border-ash-purple p-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="prop-category" className="text-xs font-bold text-pale-gold">
                  Categoría
                </label>
                <select
                  id="prop-category"
                  value={category}
                  onChange={(e) => handleCategory(e.target.value as PropAssetCategory)}
                  className="w-full min-h-[44px] bg-crypt-ink border-2 border-cold-stone px-3 text-xs sm:text-sm text-warm-white font-mono"
                >
                  {PROP_ASSET_CATEGORIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="prop-base-name" className="text-xs font-bold text-pale-gold">
                  Nombre base
                </label>
                <input
                  id="prop-base-name"
                  type="text"
                  value={baseName}
                  onChange={(e) => {
                    setBaseName(e.target.value);
                    setSnippet('');
                  }}
                  className="w-full min-h-[44px] bg-crypt-ink border-2 border-cold-stone px-3 text-xs sm:text-sm text-warm-white font-mono"
                  placeholder="flower"
                />
                <span className="text-[10px] text-bone-gray font-mono break-all">
                  {sheetPath}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <StepperRow
                  label="Columnas"
                  value={cols}
                  onStep={(delta) => setCols((value) => stepBounded(value, delta, 1, 16))}
                />
                <StepperRow
                  label="Filas"
                  value={rows}
                  onStep={(delta) => setRows((value) => stepBounded(value, delta, 1, 16))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-bone-gray">
                  Ancho mundo
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={width}
                    onChange={(e) => {
                      setWidth(Math.max(0.05, Number(e.target.value) || 0.05));
                      setSnippet('');
                    }}
                    className="min-h-[40px] bg-crypt-ink border-2 border-cold-stone px-2 text-xs text-warm-white font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-bone-gray">
                  Alto mundo
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={height}
                    onChange={(e) => {
                      setHeight(Math.max(0.05, Number(e.target.value) || 0.05));
                      setSnippet('');
                    }}
                    className="min-h-[40px] bg-crypt-ink border-2 border-cold-stone px-2 text-xs text-warm-white font-mono"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-pale-gold">Física y render</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <ToggleButton
                    label="Sombra"
                    active={shadow}
                    onClick={() => {
                      setShadow((value) => !value);
                      setSnippet('');
                    }}
                  />
                  <ToggleButton
                    label="Ocluir"
                    active={occludable}
                    onClick={() => {
                      setOccludable((value) => !value);
                      setSnippet('');
                    }}
                  />
                  <ToggleButton
                    label="Sólido"
                    active={solid}
                    onClick={() => {
                      setSolid((value) => !value);
                      setSnippet('');
                    }}
                  />
                  <ToggleButton
                    label="Pasto vivo"
                    active={grass}
                    onClick={() => {
                      setGrass((value) => !value);
                      setSnippet('');
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-pale-gold">Quitar fondo</span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'green', label: 'Verde' },
                      { id: 'grey', label: 'Gris' },
                      { id: 'white', label: 'Blanco' },
                      { id: 'black', label: 'Negro' },
                      { id: 'none', label: 'Ninguno' },
                    ] as { id: ChromaMode; label: string }[]
                  ).map((item) => (
                    <PxButton
                      key={item.id}
                      size="sm"
                      variant={chromaMode === item.id ? 'primary' : 'ghost'}
                      showSelector={false}
                      onClick={() => setChromaMode(item.id)}
                      className="min-h-[40px] px-1"
                    >
                      {item.label}
                    </PxButton>
                  ))}
                </div>
                {chromaMode !== 'none' && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-[11px] text-bone-gray">
                      Tolerancia
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-full accent-ki-cyan"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-bone-gray">
                      Despill
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={despill}
                        onChange={(e) => setDespill(Number(e.target.value))}
                        className="w-full accent-ki-cyan"
                      />
                    </label>
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-bone-gray">
                Viento (amplitud)
                <input
                  type="range"
                  min={0}
                  max={0.12}
                  step={0.005}
                  value={windAmp}
                  onChange={(e) => {
                    setWindAmp(Number(e.target.value));
                    setSnippet('');
                  }}
                  className="w-full accent-ki-cyan"
                />
                <span className="font-mono text-ki-cyan">{windAmp.toFixed(3)}</span>
              </label>
            </div>
          </div>
        )}

        {sourceUrl && (
          <div className="bg-abyss-ink border-2 border-ash-purple p-3 flex flex-col gap-2">
            <div className="text-xs text-bone-gray">
              {canExport
                ? `${selectedIndices.length} variantes listas para exportar.`
                : 'Selecciona celdas y corrige el grid 1:1 para exportar.'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PxButton
                size="md"
                variant="primary"
                fullWidth
                showSelector={false}
                disabled={!canExport}
                onClick={downloadAtlas}
              >
                Descargar atlas ({slug}.webp)
              </PxButton>
              <PxButton
                size="md"
                variant="arcane"
                fullWidth
                showSelector={false}
                disabled={!canExport}
                onClick={generateSnippet}
              >
                Generar registro TS
              </PxButton>
            </div>

            {snippet && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-pale-gold">
                    Registro para PROP_ATLAS_REGISTRY
                  </span>
                  <PxButton
                    size="sm"
                    variant="secondary"
                    showSelector={false}
                    onClick={copySnippet}
                  >
                    {copied ? 'Copiado' : 'Copiar TS'}
                  </PxButton>
                </div>
                <pre className="bg-crypt-ink border border-ash-purple p-2.5 text-[10px] leading-relaxed text-porcelain overflow-x-auto select-text">
                  {snippet}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="bg-abyss-ink border-2 border-ash-purple p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-pale-gold">Registro actual</h3>
            <span className="text-[11px] text-bone-gray font-mono">
              {PROP_ATLAS_REGISTRY.length} assets
            </span>
          </div>
          {PROP_ATLAS_REGISTRY.length === 0 ? (
            <p className="text-xs text-bone-gray mt-2 leading-relaxed">
              Aún no hay props atlas registrados. Importa una hoja, descarga el WebP y pega
              el registro generado en src/data/propAssets.ts.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
              {PROP_ASSET_CATEGORIES.map((item) => (
                <div
                  key={item.id}
                  className="bg-crypt-ink border border-ash-purple px-2.5 py-2 text-[11px] text-bone-gray"
                >
                  <span className="text-porcelain font-bold">{item.label}</span>
                  <span className="float-right font-mono text-ki-cyan">
                    {registryByCategory.get(item.id) ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-crypt-ink border border-ash-purple p-3 text-[11px] text-bone-gray leading-relaxed">
          <span className="text-pale-gold font-bold">Integración:</span> 1) guarda el WebP
          en la ruta indicada, 2) pega el registro en PROP_ATLAS_REGISTRY, 3) las categorías
          rock/bush/flower/mushroom/grass se eligen automáticamente durante la decoración
          del overworld.
        </div>
      </div>
    </div>
  );
};

export default PropAssetStudioTab;

import React, { useEffect, useMemo, useRef } from 'react';
import { BRAND_PALETTE_64 as PALETTE } from './palette.ts';

export interface HorizonLayerSpec {
  id: string;
  depth: number;
  className: string;
}

export interface BackgroundLayerProps {
  /** Normalized pointer offset in [-1, 1] for deterministic/external parallax control. */
  pointerOffset?: { x: number; y: number };
  /** Base horizontal shift multiplier (in px at depth=1). Vertical shift is half. */
  maxOffsetPx?: number;
  /** Disable pointer motion transitions when reduced motion is active. */
  reducedMotion?: boolean;
  /** Optional override for layer depth specs. */
  layers?: readonly HorizonLayerSpec[];
  className?: string;
}

export const DEFAULT_HORIZON_LAYERS: readonly HorizonLayerSpec[] = [
  { id: 'distant', depth: 0.65, className: 'parallax-layer-distant' },
  { id: 'mid', depth: 1.35, className: 'parallax-layer-mid' },
  { id: 'near', depth: 2.25, className: 'parallax-layer-near' },
] as const;

const MAX_MARGIN_SHIFT_PX = 32;

export function clampUnitOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function computeParallaxShift(
  nx: number,
  ny: number,
  depth: number,
  maxOffsetPx = 12
): { marginLeft: number; marginTop: number } {
  const cx = clampUnitOffset(nx);
  const cy = clampUnitOffset(ny);
  const safeDepth = Math.max(0, depth);
  const rawX = -cx * safeDepth * maxOffsetPx;
  const rawY = -cy * safeDepth * maxOffsetPx * 0.5;
  return {
    marginLeft: Math.round(
      Math.max(-MAX_MARGIN_SHIFT_PX, Math.min(MAX_MARGIN_SHIFT_PX, rawX)) * 100
    ) / 100,
    marginTop: Math.round(
      Math.max(-MAX_MARGIN_SHIFT_PX, Math.min(MAX_MARGIN_SHIFT_PX, rawY)) * 100
    ) / 100,
  };
}

function renderLayerArtwork(layerId: string): React.ReactNode {
  if (layerId === 'distant') {
    return (
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        shapeRendering="crispEdges"
      >
        {/* Crisp stepped night sky bands (zero gradients, strict 64-color palette) */}
        <rect x="0" y="0" width="1440" height="145" fill={PALETTE.abyssInk} />
        <rect x="0" y="145" width="1440" height="135" fill={PALETTE.cryptInk} />
        <rect x="0" y="280" width="1440" height="140" fill={PALETTE.darkSlate} />

        {/* Unboxed pixel-stepped crescent moon in open upper-left sky */}
        <rect x="366" y="72" width="20" height="6" fill={PALETTE.paleGold} />
        <rect x="358" y="78" width="20" height="6" fill={PALETTE.paleGold} />
        <rect x="352" y="84" width="16" height="8" fill={PALETTE.paleGold} />
        <rect x="350" y="92" width="14" height="16" fill={PALETTE.paleGold} />
        <rect x="352" y="108" width="16" height="8" fill={PALETTE.paleGold} />
        <rect x="358" y="116" width="22" height="6" fill={PALETTE.paleGold} />
        <rect x="366" y="122" width="22" height="6" fill={PALETTE.paleGold} />
        <rect x="360" y="94" width="4" height="12" fill={PALETTE.resonantGold} />
        <rect x="364" y="110" width="8" height="4" fill={PALETTE.resonantGold} />

        {/* Astral diamond constellations & stars */}
        <rect x="148" y="74" width="4" height="4" fill={PALETTE.paleGold} />
        <rect x="272" y="128" width="6" height="6" fill={PALETTE.kiCyan} />
        <rect x="274" y="124" width="2" height="14" fill={PALETTE.kiCyan} />
        <rect x="268" y="130" width="14" height="2" fill={PALETTE.kiCyan} />
        <rect x="412" y="66" width="4" height="4" fill={PALETTE.warmWhite} />
        <rect x="556" y="116" width="4" height="4" fill={PALETTE.paleGold} />
        <rect x="646" y="54" width="4" height="4" fill={PALETTE.kiCyan} />
        <rect x="768" y="62" width="4" height="4" fill={PALETTE.warmWhite} />
        <rect x="942" y="96" width="4" height="4" fill={PALETTE.kiCyan} />
        <rect x="1088" y="64" width="4" height="4" fill={PALETTE.paleGold} />
        <rect x="1264" y="118" width="6" height="6" fill={PALETTE.kiCyan} />
        <rect x="196" y="196" width="4" height="4" fill={PALETTE.ashPurple} />
        <rect x="488" y="182" width="4" height="4" fill={PALETTE.kiCyan} />
        <rect x="978" y="176" width="4" height="4" fill={PALETTE.paleGold} />
        <rect x="1192" y="192" width="4" height="4" fill={PALETTE.ashPurple} />

        {/* Distant jagged mountain horizon sitting visibly above the 3D meadow */}
        <polygon
          points="-40,410 95,256 235,326 390,214 550,312 720,198 880,308 1040,210 1200,306 1355,232 1480,320 1480,900 -40,900"
          fill={PALETTE.stoneShadow}
        />
        <polyline
          points="-40,410 95,256 235,326 390,214 550,312 720,198 880,308 1040,210 1200,306 1355,232 1480,320"
          fill="none"
          stroke={PALETTE.ashPurple}
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (layerId === 'mid') {
    return (
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        shapeRendering="crispEdges"
      >
        {/* Mid-ground sanctuary ruins & forested ridge silhouette */}
        <polygon
          points="-40,440 85,322 210,368 340,278 468,362 598,292 720,348 852,268 986,356 1122,276 1265,364 1390,304 1480,374 1480,900 -40,900"
          fill={PALETTE.nightshade}
        />
        {/* Ancient shrine obelisks on ridge */}
        <rect x="332" y="236" width="16" height="48" fill={PALETTE.nightshade} />
        <polygon points="332,236 340,220 348,236" fill={PALETTE.ashPurple} />
        <rect x="338" y="250" width="4" height="8" fill={PALETTE.kiCyan} />

        <rect x="1114" y="232" width="18" height="50" fill={PALETTE.nightshade} />
        <polygon points="1114,232 1123,214 1132,232" fill={PALETTE.ashPurple} />
        <rect x="1121" y="246" width="4" height="8" fill={PALETTE.resonantGold} />

        {/* Subtle teal rim contour along mid ridge */}
        <polyline
          points="-40,440 85,322 210,368 340,278 468,362 598,292 720,348 852,268 986,356 1122,276 1265,364 1390,304 1480,374"
          fill="none"
          stroke={PALETTE.oceanicTeal}
          strokeWidth="3"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full block"
      shapeRendering="crispEdges"
    >
      {/* Closer framing twilight tree-line & monolith peaks behind the 3D meadow */}
      <polygon
        points="-40,470 68,376 154,412 240,344 332,408 432,358 538,414 654,378 770,404 896,356 1018,412 1140,346 1248,402 1356,356 1480,420 1480,900 -40,900"
        fill={PALETTE.abyssInk}
      />
      {/* Drifting near-horizon astral wisps */}
      <rect x="182" y="316" width="6" height="6" fill={PALETTE.kiCyan} />
      <rect x="528" y="302" width="4" height="4" fill={PALETTE.resonantGold} />
      <rect x="912" y="310" width="6" height="6" fill={PALETTE.kiCyan} />
      <rect x="1280" y="318" width="4" height="4" fill={PALETTE.soulViolet} />
    </svg>
  );
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  pointerOffset,
  maxOffsetPx = 12,
  reducedMotion: reducedMotionProp,
  layers = DEFAULT_HORIZON_LAYERS,
  className = '',
}) => {
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isReducedMotion = useMemo(() => {
    if (reducedMotionProp !== undefined) return reducedMotionProp;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [reducedMotionProp]);

  useEffect(() => {
    if (isReducedMotion) return;

    const applyShifts = (nx: number, ny: number) => {
      layers.forEach((layer, idx) => {
        const el = layerRefs.current[idx];
        if (!el) return;
        const { marginLeft, marginTop } = computeParallaxShift(nx, ny, layer.depth, maxOffsetPx);
        el.style.marginLeft = `${marginLeft}px`;
        el.style.marginTop = `${marginTop}px`;
      });
    };

    if (pointerOffset) {
      applyShifts(pointerOffset.x, pointerOffset.y);
      return;
    }

    if (typeof window === 'undefined') return;
    let rafId = 0;
    let latestNx = 0;
    let latestNy = 0;

    const onPointerMove = (e: PointerEvent) => {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      latestNx = (e.clientX / vw - 0.5) * 2;
      latestNy = (e.clientY / vh - 0.5) * 2;
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        applyShifts(latestNx, latestNy);
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion, layers, maxOffsetPx, pointerOffset]);

  return (
    <div
      data-background-layer
      aria-hidden="true"
      className={`parallax-horizon-container ${className}`.trim()}
    >
      {layers.map((layer, idx) => {
        const initialShift =
          !isReducedMotion && pointerOffset
            ? computeParallaxShift(pointerOffset.x, pointerOffset.y, layer.depth, maxOffsetPx)
            : { marginLeft: 0, marginTop: 0 };
        return (
          <div
            key={layer.id}
            ref={(el) => {
              layerRefs.current[idx] = el;
            }}
            data-parallax-id={layer.id}
            data-parallax-depth={layer.depth}
            className={`parallax-horizon-layer ${layer.className}`.trim()}
            style={{
              marginLeft: `${initialShift.marginLeft}px`,
              marginTop: `${initialShift.marginTop}px`,
            }}
          >
            {renderLayerArtwork(layer.id)}
          </div>
        );
      })}
    </div>
  );
};

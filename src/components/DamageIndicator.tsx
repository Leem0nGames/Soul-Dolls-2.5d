import React, { useEffect, useState } from 'react';
import type { BodyPartName } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export interface DamageIndicatorProps {
  /** Extremidad afectada sobre la que se superpone el indicador. */
  part?: BodyPartName | null;
  /** Contador incremental de impactos para reiniciar la animación en golpes consecutivos. */
  tick?: number;
  /** Cantidad de daño recibido para mostrar feedback numérico junto al impacto. */
  amount?: number;
  /** Si el impacto fue crítico. */
  crit?: boolean;
  /** Multiplicador de efectividad (>=2 súper eficaz, <1 resistente). */
  effectiveness?: number;
  /** Si el impacto rompió la extremidad. */
  broken?: boolean;
  /** Duración visible en ms antes de ocultarse automáticamente (0 = persistente mientras tick > 0). */
  durationMs?: number;
  className?: string;
}

export const DAMAGE_PART_ANCHORS: Record<BodyPartName, { top: string; left: string }> = {
  head: { top: '14%', left: '50%' },
  torso: { top: '44%', left: '50%' },
  arms: { top: '46%', left: '50%' },
  legs: { top: '78%', left: '50%' },
};

interface IndicatorTone {
  primary: string;
  secondary: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

function resolveIndicatorTone(
  crit?: boolean,
  effectiveness?: number,
  broken?: boolean
): IndicatorTone {
  if (broken) {
    return {
      primary: PALETTE.uiDanger,
      secondary: PALETTE.peachBlush,
      badgeBg: PALETTE.driedBlood,
      badgeBorder: PALETTE.riftCrimson,
      badgeText: PALETTE.warmWhite,
    };
  }
  if (crit) {
    return {
      primary: PALETTE.uiGold,
      secondary: PALETTE.warmWhite,
      badgeBg: PALETTE.darkOak,
      badgeBorder: PALETTE.uiGold,
      badgeText: PALETTE.paleGold,
    };
  }
  if (effectiveness !== undefined && effectiveness >= 2) {
    return {
      primary: PALETTE.coralRed,
      secondary: PALETTE.paleGold,
      badgeBg: PALETTE.bloodMoon,
      badgeBorder: PALETTE.coralRed,
      badgeText: PALETTE.warmWhite,
    };
  }
  if (effectiveness !== undefined && effectiveness < 1) {
    return {
      primary: PALETTE.boneGray,
      secondary: PALETTE.porcelain,
      badgeBg: PALETTE.cryptInk,
      badgeBorder: PALETTE.coldStone,
      badgeText: PALETTE.boneGray,
    };
  }
  return {
    primary: PALETTE.rubyGlow,
    secondary: PALETTE.warmWhite,
    badgeBg: PALETTE.cryptInk,
    badgeBorder: PALETTE.riftCrimson,
    badgeText: PALETTE.warmWhite,
  };
}

function PixelImpactBurst({
  part,
  tone,
}: {
  part: BodyPartName;
  tone: IndicatorTone;
}) {
  const ink = PALETTE.uiInk;
  const p = tone.primary;
  const s = tone.secondary;
  const isWide = part === 'arms' || part === 'legs';

  if (isWide) {
    // Doble destello de impacto alineado sobre ambas extremidades (brazos o piernas)
    return (
      <svg
        width={part === 'arms' ? 28 : 22}
        height={12}
        viewBox={part === 'arms' ? '0 0 14 6' : '0 0 11 6'}
        shapeRendering="crispEdges"
        className="pixel-canvas block shrink-0"
        aria-hidden="true"
      >
        {/* Destello izquierdo */}
        <rect x="0" y="2" width="1" height="2" fill={ink} />
        <rect x="1" y="1" width="1" height="1" fill={p} />
        <rect x="1" y="2" width="2" height="2" fill={s} />
        <rect x="2" y="0" width="1" height="1" fill={p} />
        <rect x="2" y="4" width="1" height="1" fill={p} />
        {/* Destello derecho */}
        {part === 'arms' ? (
          <>
            <rect x="13" y="2" width="1" height="2" fill={ink} />
            <rect x="12" y="1" width="1" height="1" fill={p} />
            <rect x="11" y="2" width="2" height="2" fill={s} />
            <rect x="11" y="0" width="1" height="1" fill={p} />
            <rect x="11" y="4" width="1" height="1" fill={p} />
          </>
        ) : (
          <>
            <rect x="10" y="2" width="1" height="2" fill={ink} />
            <rect x="9" y="1" width="1" height="1" fill={p} />
            <rect x="8" y="2" width="2" height="2" fill={s} />
            <rect x="8" y="0" width="1" height="1" fill={p} />
            <rect x="8" y="4" width="1" height="1" fill={p} />
          </>
        )}
      </svg>
    );
  }

  // Retícula / chispa pixelada centrada para cabeza o torso
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      className="pixel-canvas block shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="0" width="2" height="1" fill={ink} />
      <rect x="3" y="7" width="2" height="1" fill={ink} />
      <rect x="0" y="3" width="1" height="2" fill={ink} />
      <rect x="7" y="3" width="1" height="2" fill={ink} />
      <rect x="1" y="1" width="1" height="1" fill={p} />
      <rect x="6" y="1" width="1" height="1" fill={p} />
      <rect x="1" y="6" width="1" height="1" fill={p} />
      <rect x="6" y="6" width="1" height="1" fill={p} />
      <rect x="3" y="1" width="2" height="2" fill={p} />
      <rect x="3" y="5" width="2" height="2" fill={p} />
      <rect x="1" y="3" width="2" height="2" fill={p} />
      <rect x="5" y="3" width="2" height="2" fill={p} />
      <rect x="3" y="3" width="2" height="2" fill={s} />
    </svg>
  );
}

export const DamageIndicator: React.FC<DamageIndicatorProps> = ({
  part,
  tick = 0,
  amount,
  crit = false,
  effectiveness,
  broken = false,
  durationMs = 650,
  className = '',
}) => {
  const isActive = Boolean(part) && tick > 0;
  const [visible, setVisible] = useState<boolean>(isActive);

  useEffect(() => {
    if (!part || tick <= 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (durationMs <= 0) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [part, tick, durationMs]);

  if (!part || !visible) return null;

  const anchor = DAMAGE_PART_ANCHORS[part];
  const tone = resolveIndicatorTone(crit, effectiveness, broken);
  const label =
    amount !== undefined
      ? `-${amount}${crit ? '!' : ''}`
      : broken
        ? 'ROT!'
        : crit
          ? 'CRIT!'
          : null;

  return (
    <div
      data-damage-indicator={part}
      data-damage-tick={tick}
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none ${className}`}
      style={{ top: anchor.top, left: anchor.left }}
    >
      <div
        key={`${part}-${tick}`}
        className="battle-part-hit relative flex items-center justify-center"
      >
        <PixelImpactBurst part={part} tone={tone} />
        {label && (
          <span
            className="absolute left-full ml-0.5 top-1/2 -translate-y-1/2 px-1 py-[1px] rounded-none border text-[9px] font-black leading-none tabular-nums whitespace-nowrap px-text-outline shadow-[1px_1px_0_#050505]"
            style={{
              backgroundColor: tone.badgeBg,
              borderColor: tone.badgeBorder,
              color: tone.badgeText,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default DamageIndicator;

import React from 'react';
import { BODY_PART_ORDER, ensureBodyParts } from '../domain/BodyParts.ts';
import type { BodyPartHp, BodyPartName, BodyPartsHp, CreatureInstance } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export interface BattleContainerProps {
  creature?: CreatureInstance;
  bodyParts?: BodyPartsHp;
  variant?: 'player' | 'enemy' | 'summary';
  damagedPart?: BodyPartName | null;
  damageTick?: number;
  labels?: Partial<Record<BodyPartName, string>>;
  statusLabels?: {
    ok?: string;
    warn?: string;
    crit?: string;
    broken?: string;
  };
  showSilhouette?: boolean;
  className?: string;
}

const DEFAULT_LABELS: Record<BodyPartName, string> = {
  head: 'Head',
  torso: 'Torso',
  arms: 'Arms',
  legs: 'Legs',
};

interface LimbVisualTone {
  fillHex: string;
  hiHex: string;
  barCls: string;
  barSheenCls: string;
  valueCls: string;
  statusCls: string;
  statusTag: 'ok' | 'warn' | 'crit' | 'broken';
  broken: boolean;
}

function resolveLimbTone(part: BodyPartHp): LimbVisualTone {
  if (part.current <= 0) {
    return {
      fillHex: PALETTE.ashPurple,
      hiHex: PALETTE.coldStone,
      barCls: 'bg-dried-blood',
      barSheenCls: 'bg-rift-crimson/50',
      valueCls: 'text-coral-red font-bold',
      statusCls: 'text-coral-red',
      statusTag: 'broken',
      broken: true,
    };
  }
  const pct = (part.current / Math.max(1, part.max)) * 100;
  if (pct > 60) {
    return {
      fillHex: PALETTE.kiCyan,
      hiHex: PALETTE.iceCyan,
      barCls: 'bg-ki-cyan',
      barSheenCls: 'bg-ice-cyan',
      valueCls: 'text-porcelain',
      statusCls: 'text-neon-mint',
      statusTag: 'ok',
      broken: false,
    };
  }
  if (pct > 25) {
    return {
      fillHex: PALETTE.resonantGold,
      hiHex: PALETTE.paleGold,
      barCls: 'bg-resonant-gold',
      barSheenCls: 'bg-pale-gold',
      valueCls: 'text-pale-gold',
      statusCls: 'text-resonant-gold',
      statusTag: 'warn',
      broken: false,
    };
  }
  return {
    fillHex: PALETTE.coralRed,
    hiHex: PALETTE.peachBlush,
    barCls: 'bg-coral-red',
    barSheenCls: 'bg-peach-blush',
    valueCls: 'text-coral-red font-bold',
    statusCls: 'text-coral-red',
    statusTag: 'crit',
    broken: false,
  };
}

function LimbPixelIcon({
  part,
  tone,
}: {
  part: BodyPartName;
  tone: LimbVisualTone;
}) {
  const ink = PALETTE.abyssInk;
  const crack = PALETTE.riftCrimson;
  const fill = tone.fillHex;
  const hi = tone.hiHex;

  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      className="pixel-canvas shrink-0"
      aria-hidden="true"
    >
      {part === 'head' && (
        <>
          <rect x="2" y="0" width="4" height="1" fill={ink} />
          <rect x="1" y="1" width="6" height="5" fill={ink} />
          <rect x="2" y="1" width="4" height="4" fill={fill} />
          <rect x="3" y="0" width="2" height="1" fill={hi} />
          <rect x="2" y="3" width="1" height="1" fill={ink} />
          <rect x="5" y="3" width="1" height="1" fill={ink} />
          <rect x="3" y="6" width="2" height="1" fill={ink} />
        </>
      )}
      {part === 'torso' && (
        <>
          <rect x="1" y="1" width="6" height="5" fill={ink} />
          <rect x="2" y="6" width="4" height="1" fill={ink} />
          <rect x="2" y="1" width="4" height="4" fill={fill} />
          <rect x="3" y="2" width="2" height="2" fill={hi} />
          <rect x="3" y="5" width="2" height="1" fill={fill} />
        </>
      )}
      {part === 'arms' && (
        <>
          <rect x="0" y="1" width="3" height="5" fill={ink} />
          <rect x="5" y="1" width="3" height="5" fill={ink} />
          <rect x="1" y="2" width="1" height="3" fill={fill} />
          <rect x="6" y="2" width="1" height="3" fill={fill} />
          <rect x="1" y="2" width="1" height="1" fill={hi} />
          <rect x="6" y="2" width="1" height="1" fill={hi} />
        </>
      )}
      {part === 'legs' && (
        <>
          <rect x="1" y="1" width="2" height="6" fill={ink} />
          <rect x="5" y="1" width="2" height="6" fill={ink} />
          <rect x="0" y="6" width="3" height="2" fill={ink} />
          <rect x="5" y="6" width="3" height="2" fill={ink} />
          <rect x="1" y="1" width="1" height="5" fill={fill} />
          <rect x="6" y="1" width="1" height="5" fill={fill} />
          <rect x="1" y="6" width="1" height="1" fill={hi} />
          <rect x="6" y="6" width="1" height="1" fill={hi} />
        </>
      )}
      {tone.broken && (
        <>
          <rect x="1" y="1" width="1" height="1" fill={crack} />
          <rect x="6" y="1" width="1" height="1" fill={crack} />
          <rect x="3" y="3" width="2" height="2" fill={crack} />
          <rect x="1" y="6" width="1" height="1" fill={crack} />
          <rect x="6" y="6" width="1" height="1" fill={crack} />
        </>
      )}
    </svg>
  );
}

function PixelMarionetteSilhouette({
  parts,
  scale,
  damagedPart,
  damageTick,
}: {
  parts: BodyPartsHp;
  scale: 2 | 3;
  damagedPart?: BodyPartName | null;
  damageTick?: number;
}) {
  const head = resolveLimbTone(parts.head);
  const torso = resolveLimbTone(parts.torso);
  const arms = resolveLimbTone(parts.arms);
  const legs = resolveLimbTone(parts.legs);

  const ink = PALETTE.abyssInk;
  const joint = PALETTE.cryptInk;
  const crack = PALETTE.riftCrimson;
  const crackHi = PALETTE.coralRed;

  const hitCls = (part: BodyPartName) =>
    damagedPart === part && (damageTick ?? 0) > 0 ? 'battle-part-hit' : '';

  return (
    <svg
      width={16 * scale}
      height={20 * scale}
      viewBox="0 0 16 20"
      shapeRendering="crispEdges"
      className={`pixel-canvas shrink-0 select-none ${
        scale === 2 ? 'w-7 h-[35px] sm:w-8 sm:h-10' : ''
      }`}
      aria-hidden="true"
    >
      <rect x="7" y="5" width="2" height="1" fill={joint} />

      <g
        key={`head-${damagedPart === 'head' ? damageTick : 0}`}
        data-part="head"
        className={hitCls('head')}
        style={{ transformOrigin: '8px 2px' }}
      >
        <rect x="6" y="0" width="4" height="1" fill={ink} />
        <rect x="5" y="1" width="6" height="4" fill={ink} />
        <rect x="6" y="1" width="4" height="3" fill={head.fillHex} />
        <rect x="7" y="0" width="2" height="1" fill={head.hiHex} />
        <rect x="6" y="1" width="2" height="1" fill={head.hiHex} />
        <rect x="6" y="2" width="1" height="1" fill={joint} />
        <rect x="9" y="2" width="1" height="1" fill={joint} />
        {head.broken && (
          <>
            <rect x="6" y="1" width="1" height="1" fill={crack} />
            <rect x="9" y="1" width="1" height="1" fill={crackHi} />
            <rect x="7" y="2" width="2" height="1" fill={crack} />
            <rect x="6" y="3" width="1" height="1" fill={crackHi} />
            <rect x="9" y="3" width="1" height="1" fill={crack} />
          </>
        )}
      </g>

      <g
        key={`torso-${damagedPart === 'torso' ? damageTick : 0}`}
        data-part="torso"
        className={hitCls('torso')}
        style={{ transformOrigin: '8px 9px' }}
      >
        <rect x="5" y="6" width="6" height="5" fill={ink} />
        <rect x="6" y="11" width="4" height="2" fill={ink} />
        <rect x="6" y="6" width="4" height="4" fill={torso.fillHex} />
        <rect x="7" y="10" width="2" height="2" fill={torso.fillHex} />
        <rect x="7" y="7" width="2" height="2" fill={torso.hiHex} />
        {torso.broken && (
          <>
            <rect x="6" y="6" width="1" height="1" fill={crack} />
            <rect x="7" y="7" width="1" height="1" fill={crackHi} />
            <rect x="8" y="8" width="1" height="1" fill={crack} />
            <rect x="9" y="9" width="1" height="1" fill={crackHi} />
          </>
        )}
      </g>

      <g
        key={`arms-${damagedPart === 'arms' ? damageTick : 0}`}
        data-part="arms"
        className={hitCls('arms')}
        style={{ transformOrigin: '8px 9px' }}
      >
        <rect x="2" y="6" width="3" height="6" fill={ink} />
        <rect x="1" y="11" width="3" height="2" fill={ink} />
        <rect x="3" y="7" width="1" height="4" fill={arms.fillHex} />
        <rect x="2" y="11" width="1" height="1" fill={arms.fillHex} />
        <rect x="3" y="7" width="1" height="1" fill={arms.hiHex} />

        <rect x="11" y="6" width="3" height="6" fill={ink} />
        <rect x="12" y="11" width="3" height="2" fill={ink} />
        <rect x="12" y="7" width="1" height="4" fill={arms.fillHex} />
        <rect x="13" y="11" width="1" height="1" fill={arms.fillHex} />
        <rect x="12" y="7" width="1" height="1" fill={arms.hiHex} />
        {arms.broken && (
          <>
            <rect x="3" y="8" width="1" height="1" fill={crack} />
            <rect x="2" y="9" width="1" height="1" fill={crackHi} />
            <rect x="12" y="8" width="1" height="1" fill={crack} />
            <rect x="13" y="9" width="1" height="1" fill={crackHi} />
          </>
        )}
      </g>

      <g
        key={`legs-${damagedPart === 'legs' ? damageTick : 0}`}
        data-part="legs"
        className={hitCls('legs')}
        style={{ transformOrigin: '8px 16px' }}
      >
        <rect x="4" y="13" width="3" height="5" fill={ink} />
        <rect x="3" y="18" width="4" height="2" fill={ink} />
        <rect x="5" y="13" width="1" height="5" fill={legs.fillHex} />
        <rect x="4" y="18" width="2" height="1" fill={legs.fillHex} />
        <rect x="5" y="15" width="1" height="1" fill={legs.hiHex} />

        <rect x="9" y="13" width="3" height="5" fill={ink} />
        <rect x="9" y="18" width="4" height="2" fill={ink} />
        <rect x="10" y="13" width="1" height="5" fill={legs.fillHex} />
        <rect x="10" y="18" width="2" height="1" fill={legs.fillHex} />
        <rect x="10" y="15" width="1" height="1" fill={legs.hiHex} />
        {legs.broken && (
          <>
            <rect x="5" y="14" width="1" height="1" fill={crack} />
            <rect x="4" y="16" width="1" height="1" fill={crackHi} />
            <rect x="10" y="14" width="1" height="1" fill={crack} />
            <rect x="11" y="16" width="1" height="1" fill={crackHi} />
          </>
        )}
      </g>
    </svg>
  );
}

export const BattleContainer: React.FC<BattleContainerProps> = ({
  creature,
  bodyParts,
  variant = 'player',
  damagedPart = null,
  damageTick = 0,
  labels,
  statusLabels,
  showSilhouette = true,
  className = '',
}) => {
  const parts: BodyPartsHp =
    bodyParts ??
    (creature
      ? ensureBodyParts(creature)
      : {
          head: { current: 20, max: 20 },
          torso: { current: 40, max: 40 },
          arms: { current: 20, max: 20 },
          legs: { current: 20, max: 20 },
        });

  const resolvedLabels: Record<BodyPartName, string> = {
    head: labels?.head ?? DEFAULT_LABELS.head,
    torso: labels?.torso ?? DEFAULT_LABELS.torso,
    arms: labels?.arms ?? DEFAULT_LABELS.arms,
    legs: labels?.legs ?? DEFAULT_LABELS.legs,
  };

  const resolvedStatus = {
    ok: statusLabels?.ok ?? 'OK',
    warn: statusLabels?.warn ?? 'LOW',
    crit: statusLabels?.crit ?? 'CRIT',
    broken: statusLabels?.broken ?? 'BRK',
  };

  const isCompact = variant !== 'summary';
  const totalPips = isCompact ? 4 : 8;

  return (
    <div
      className={`flex items-center ${isCompact ? 'gap-1.5 sm:gap-2' : 'gap-3'} ${className}`}
      data-battle-container
    >
      {showSilhouette && (
        <PixelMarionetteSilhouette
          parts={parts}
          scale={isCompact ? 2 : 3}
          damagedPart={damagedPart}
          damageTick={damageTick}
        />
      )}

      <div
        className={`flex-1 min-w-0 grid ${
          isCompact ? 'grid-cols-2 gap-1' : 'grid-cols-1 sm:grid-cols-2 gap-1.5'
        }`}
      >
        {BODY_PART_ORDER.map((partKey) => {
          const p = parts[partKey];
          const pct = Math.max(
            0,
            Math.min(100, Math.round((p.current / Math.max(1, p.max)) * 100))
          );
          const tone = resolveLimbTone(p);
          const filledPips = tone.broken
            ? 0
            : Math.max(1, Math.min(totalPips, Math.ceil((pct / 100) * totalPips)));

          const statusText = resolvedStatus[tone.statusTag];
          const valueText = tone.broken
            ? statusText
            : variant === 'enemy'
              ? `${pct}%`
              : `${p.current}/${p.max}`;

          const isHit = damagedPart === partKey && damageTick > 0;

          return (
            <div
              key={`${partKey}-${isHit ? damageTick : 0}`}
              data-part-row={partKey}
              className={`pixel-limb-wrap ${
                tone.broken ? 'pixel-limb-wrap--broken' : ''
              } ${isHit ? 'battle-part-hit border-warm-white' : ''} ${
                isCompact ? 'px-1 py-[2px] gap-1' : 'px-1.5 py-[3px] gap-1.5'
              } flex items-center min-w-0`}
              aria-label={`${resolvedLabels[partKey]}: ${p.current}/${p.max} (${statusText})`}
            >
              <LimbPixelIcon part={partKey} tone={tone} />

              <span
                className={`${
                  isCompact ? 'text-[9px] sm:text-[10px]' : 'w-11 text-[11px]'
                } shrink-0 text-porcelain font-bold leading-none whitespace-nowrap`}
              >
                {resolvedLabels[partKey]}
              </span>

              <div
                className="pixel-limb-bar-track flex-1 min-w-[20px] p-[1px] flex items-center gap-[1px]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={p.max}
                aria-valuenow={p.current}
              >
                {Array.from({ length: totalPips }).map((_, idx) => {
                  const active = idx < filledPips;
                  return (
                    <span
                      key={idx}
                      className={`${
                        isCompact ? 'h-1' : 'h-1.5'
                      } flex-1 relative overflow-hidden ${
                        active ? tone.barCls : 'bg-smoked-wood/50'
                      }`}
                    >
                      {active && (
                        <span
                          className={`block w-full h-[1px] ${tone.barSheenCls}`}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  );
                })}
              </div>

              <span
                className={`${
                  isCompact ? 'text-[9px] sm:text-[10px]' : 'w-12 text-[11px]'
                } shrink-0 text-right tabular-nums leading-none whitespace-nowrap ${
                  tone.valueCls
                }`}
              >
                {valueText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BattleContainer;

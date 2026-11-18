import React, { useEffect, useState } from 'react';
import type { CreatureType } from '../../domain/types.ts';
import { PALETTE } from '../../gfx/Palette.ts';
import { PxTypeBadge } from './PxBadge.tsx';
import { PxButton } from './PxButton.tsx';

export interface ArcaneBindingOverlayProps {
  creatureName: string;
  speciesId: number;
  level: number;
  creatureType: CreatureType;
  vesselName?: string;
  spriteUrl?: string;
  durationMs?: number;
  onComplete: () => void;
}

const BINDING_PHASES = [
  { id: 'attune', label: '1. SINTONIZACIÓN', detail: 'Frecuencia de alma' },
  { id: 'threads', label: '2. FILAMENTOS', detail: 'Hilos etéreos unidos' },
  { id: 'anchor', label: '3. ANCLAJE', detail: 'Núcleo de marioneta' },
  { id: 'bound', label: '4. VÍNCULO FIJADO', detail: 'Alma atada al cuerpo' },
];

export const ArcaneBindingOverlay: React.FC<ArcaneBindingOverlayProps> = ({
  creatureName,
  speciesId,
  level,
  creatureType,
  vesselName,
  spriteUrl,
  durationMs = 2400,
  onComplete,
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [pulseTick, setPulseTick] = useState(0);

  useEffect(() => {
    const phaseInterval = durationMs / 4;
    const t1 = setTimeout(() => setPhaseIndex(1), phaseInterval * 0.5);
    const t2 = setTimeout(() => setPhaseIndex(2), phaseInterval * 1.5);
    const t3 = setTimeout(() => setPhaseIndex(3), phaseInterval * 2.5);
    const autoDone = setTimeout(() => {
      onComplete();
    }, durationMs);

    const pulseTimer = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 4);
    }, 120);

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      onComplete();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(autoDone);
      clearInterval(pulseTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [durationMs, onComplete]);

  const numStr = String(speciesId).padStart(3, '0');
  const vesselText = vesselName || 'Muñeca Artesanal Primaria';
  const threadColor = pulseTick % 2 === 0 ? PALETTE.kiCyan : PALETTE.soulViolet;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vínculo Arcano"
      onClick={onComplete}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-3 sm:p-5 select-none bg-[#0B080E]/90 cursor-pointer overflow-hidden"
    >
      {/* 1. Marionette Crossbar (Cruceta de Titiritero) with Soul Filaments */}
      <div className="relative w-full max-w-xl flex flex-col items-center pointer-events-none">
        {/* Ornate Wooden Crossbar */}
        <div className="w-full flex items-center justify-center relative">
          {/* Main horizontal beam */}
          <div className="h-4 sm:h-5 w-4/5 max-w-md bg-[#5C4227] border-2 border-[#E8B84A] flex items-center justify-between px-2 shadow-[2px_2px_0_#050505] relative">
            <span className="w-2 h-2 bg-[#FCEDB8] border border-[#3B2B1A] inline-block" />
            <span className="w-1.5 h-1.5 bg-[#5FE3D2] border border-[#14101C] inline-block" />
            {/* Center diamond seal */}
            <div className="w-6 h-6 bg-[#24123B] border-2 border-[#E8B84A] rotate-45 flex items-center justify-center -my-2 shadow-[1px_1px_0_#050505]">
              <span className="w-2.5 h-2.5 bg-[#9B6BFF] -rotate-45 block" />
            </div>
            <span className="w-1.5 h-1.5 bg-[#5FE3D2] border border-[#14101C] inline-block" />
            <span className="w-2 h-2 bg-[#FCEDB8] border border-[#3B2B1A] inline-block" />
          </div>

          {/* Crossbar wings */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 sm:px-8">
            <div className="w-8 h-2 bg-[#3B2B1A] border border-[#8A6A3B]" />
            <div className="w-8 h-2 bg-[#3B2B1A] border border-[#8A6A3B]" />
          </div>
        </div>

        {/* Descending Ethereal Soul Filaments */}
        <svg
          className="w-full h-16 sm:h-24 overflow-visible"
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Left Anchor Thread */}
          <line
            x1="80"
            y1="0"
            x2="170"
            y2="80"
            stroke={threadColor}
            strokeWidth="2"
            strokeDasharray={pulseTick % 2 === 0 ? '4 2' : '2 4'}
          />
          {/* Mid-Left Thread */}
          <line
            x1="140"
            y1="0"
            x2="185"
            y2="80"
            stroke={PALETTE.soulViolet}
            strokeWidth="2"
            strokeDasharray="6 2"
          />
          {/* Center Crown Thread */}
          <line
            x1="200"
            y1="0"
            x2="200"
            y2="80"
            stroke={PALETTE.brightBrass}
            strokeWidth="3"
          />
          {/* Mid-Right Thread */}
          <line
            x1="260"
            y1="0"
            x2="215"
            y2="80"
            stroke={PALETTE.soulViolet}
            strokeWidth="2"
            strokeDasharray="6 2"
          />
          {/* Right Anchor Thread */}
          <line
            x1="320"
            y1="0"
            x2="230"
            y2="80"
            stroke={threadColor}
            strokeWidth="2"
            strokeDasharray={pulseTick % 2 === 0 ? '4 2' : '2 4'}
          />
        </svg>
      </div>

      {/* 2. Central Doll Presentation & Runic Mandala */}
      <div className="relative flex flex-col items-center justify-center my-auto w-full max-w-md">
        {/* Concentric Rotating Runic Mandala Rings */}
        <div className="relative w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center">
          {/* Outer Runic Circle */}
          <svg
            className={`absolute inset-0 w-full h-full text-[#9B6BFF] transition-transform duration-700 ${
              pulseTick % 2 === 0 ? 'rotate-6' : '-rotate-6'
            }`}
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              stroke={PALETTE.royalPurple}
              strokeWidth="2"
              strokeDasharray="8 6"
            />
            <circle
              cx="100"
              cy="100"
              r="86"
              fill="none"
              stroke={PALETTE.resonantGold}
              strokeWidth="1.5"
            />
            {/* 8 Cardinal Sacred Glyphs */}
            <text x="100" y="20" fill={PALETTE.brightBrass} fontSize="11" textAnchor="middle">✦</text>
            <text x="180" y="104" fill={PALETTE.brightBrass} fontSize="11" textAnchor="middle">◈</text>
            <text x="100" y="188" fill={PALETTE.brightBrass} fontSize="11" textAnchor="middle">✦</text>
            <text x="20" y="104" fill={PALETTE.brightBrass} fontSize="11" textAnchor="middle">◈</text>
            <text x="156" y="44" fill={PALETTE.kiCyan} fontSize="9" textAnchor="middle">ᛟ</text>
            <text x="156" y="164" fill={PALETTE.kiCyan} fontSize="9" textAnchor="middle">ᚱ</text>
            <text x="44" y="164" fill={PALETTE.kiCyan} fontSize="9" textAnchor="middle">ᛉ</text>
            <text x="44" y="44" fill={PALETTE.kiCyan} fontSize="9" textAnchor="middle">ᛋ</text>
          </svg>

          {/* Middle Octagram Square Seal */}
          <div
            className={`absolute w-36 h-36 sm:w-44 sm:h-44 border-2 border-[#5FE3D2] transition-transform duration-500 ${
              pulseTick % 2 === 0 ? 'rotate-45' : 'rotate-12'
            }`}
          />
          <div
            className={`absolute w-36 h-36 sm:w-44 sm:h-44 border-2 border-[#9B6BFF] transition-transform duration-500 ${
              pulseTick % 2 === 0 ? 'rotate-12' : 'rotate-45'
            }`}
          />

          {/* Central Doll Portrait Container */}
          <div className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 bg-[#14101C] border-2 border-[#E8B84A] p-2 flex items-center justify-center shadow-[3px_3px_0_#050505]">
            {/* 4 Corner Puppet Joint Pins */}
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#FCEDB8] border border-[#3B2B1A]" />
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#FCEDB8] border border-[#3B2B1A]" />
            <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#FCEDB8] border border-[#3B2B1A]" />
            <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#FCEDB8] border border-[#3B2B1A]" />

            {spriteUrl ? (
              <img
                src={spriteUrl}
                alt={creatureName}
                className="w-full h-full object-contain pixel-canvas animate-pulse"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-3xl sm:text-4xl">🪆</span>
                <span className="text-[10px] text-[#FCEDB8] font-bold mt-1 uppercase tracking-wider">
                  #{numStr}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Title & Resonance Telemetry */}
        <div className="mt-3 w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#24123B] border-2 border-[#E8B84A] text-[#FCEDB8] text-xs sm:text-sm font-bold tracking-widest uppercase shadow-[2px_2px_0_#050505]">
            <span className="text-[#5FE3D2]">✦</span>
            <span>VÍNCULO ARCANO</span>
            <span className="text-[#5FE3D2]">✦</span>
          </div>

          <h2 className="mt-2 text-lg sm:text-2xl font-black text-[#FFF9F0] tracking-wide uppercase drop-shadow-[2px_2px_0_#050505]">
            {creatureName}
          </h2>

          <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-[#14101C] border border-[#8A6A3B] text-[#FCEDB8] text-[11px] font-bold">
              #{numStr}
            </span>
            <span className="px-2 py-0.5 bg-[#14101C] border border-[#8A6A3B] text-[#FFF9F0] text-[11px] font-bold">
              Nv. {level}
            </span>
            <PxTypeBadge type={creatureType} size="sm" />
          </div>

          {/* Bound Vessel Telemetry */}
          <div className="mt-2 text-xs sm:text-sm text-[#5FE3D2] font-semibold tracking-wide flex items-center justify-center gap-1.5">
            <span className="text-[#E8B84A]">RECIPIENTE:</span>
            <span className="text-[#FFF9F0] uppercase underline decoration-[#E8B84A]">
              {vesselText}
            </span>
            <span className="text-[#5FE3D2] font-bold">[ATADO]</span>
          </div>
        </div>

        {/* 3. 4-Phase Resonance Badges */}
        <div className="mt-3 w-full grid grid-cols-2 gap-1.5 sm:gap-2">
          {BINDING_PHASES.map((phase, idx) => {
            const isDone = phaseIndex >= idx;
            const isCurrent = phaseIndex === idx;
            const borderColor = isDone
              ? 'border-[#5FE3D2]'
              : isCurrent
                ? 'border-[#E8B84A]'
                : 'border-[#3D3242]';
            const bgColor = isDone
              ? 'bg-[#123F3C]'
              : isCurrent
                ? 'bg-[#2A1F2D]'
                : 'bg-[#14101C]';
            const textColor = isDone
              ? 'text-[#85EADD]'
              : isCurrent
                ? 'text-[#FCEDB8]'
                : 'text-[#6B5C70]';

            return (
              <div
                key={phase.id}
                className={`p-1.5 sm:p-2 border-2 ${borderColor} ${bgColor} flex flex-col shadow-[1px_1px_0_#050505]`}
              >
                <div className={`text-[10px] sm:text-[11px] font-bold tracking-wider ${textColor} flex items-center justify-between`}>
                  <span>{phase.label}</span>
                  <span>{isDone ? '✓' : isCurrent ? '⋯' : '○'}</span>
                </div>
                <span className="text-[9px] text-[#A89BA8] font-normal truncate">
                  {phase.detail}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom Dismissal Button / Hint */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 pointer-events-auto">
        <PxButton
          variant="primary"
          size="md"
          className="w-full justify-center tracking-wider font-bold shadow-[2px_2px_0_#050505]"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
        >
          ✦ ALMA SELLADA CON ÉXITO [CONTINUAR] ✦
        </PxButton>

        <span className="text-[10px] text-[#A89BA8] tracking-widest uppercase">
          Toca la pantalla o pulsa cualquier tecla
        </span>
      </div>
    </div>
  );
};

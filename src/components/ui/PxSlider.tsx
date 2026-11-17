import React from 'react';

export interface PxSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  displayValue: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export const PxSlider: React.FC<PxSliderProps> = ({
  label,
  value,
  min,
  max,
  displayValue,
  disabled = false,
  onChange,
  className = '',
}) => (
  <div
    className={`px-panel px-card px-3 py-2 ${disabled ? 'opacity-60' : ''} ${className}`}
  >
    <div className="flex justify-between items-center mb-1 text-xs font-semibold">
      <span className="text-porcelain">{label}</span>
      <span className="tabular-nums font-bold text-resonant-gold">{displayValue}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-8 accent-resonant-gold touch-pan-x cursor-pointer disabled:cursor-not-allowed"
    />
  </div>
);

export default PxSlider;

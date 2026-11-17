import React from 'react';
import { PxButton, type PxButtonSize } from './PxButton.tsx';

export interface PxTabItem<T extends string> {
  id: T;
  label: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface PxTabsProps<T extends string> {
  items: readonly PxTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  columns?: 2 | 3 | 4 | 'auto';
  size?: PxButtonSize;
  className?: string;
}

const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'grid grid-cols-2 gap-1.5',
  3: 'grid grid-cols-3 gap-1.5',
  4: 'grid grid-cols-4 gap-1',
};

export function PxTabs<T extends string>({
  items,
  value,
  onChange,
  columns = 'auto',
  size = 'sm',
  className = '',
}: PxTabsProps<T>): React.ReactElement {
  const layoutClass =
    columns === 'auto' ? 'flex flex-wrap gap-1.5' : GRID_COLUMNS[columns];

  return (
    <div className={`${layoutClass} ${className}`} role="tablist">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <PxButton
            key={item.id}
            role="tab"
            aria-selected={selected}
            variant={selected ? 'primary' : 'secondary'}
            size={size}
            showSelector={columns === 'auto'}
            disabled={item.disabled}
            onClick={() => {
              if (!selected) onChange(item.id);
            }}
            className={columns === 'auto' ? '' : 'w-full px-1.5'}
          >
            {selected && (
              <span className="text-[9px] leading-none shrink-0" aria-hidden="true">
                ◆
              </span>
            )}
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && (
              <span className="tabular-nums text-[10px] opacity-90">{item.badge}</span>
            )}
          </PxButton>
        );
      })}
    </div>
  );
}

export default PxTabs;

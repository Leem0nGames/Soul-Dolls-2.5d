import { evaluateAchievements } from '../domain/Achievements.ts';
import type { SaveData } from '../domain/types.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';

type AchFilter = 'all' | 'unlocked' | 'locked';

function renderTrophyIcon(unlocked: boolean): string {
  if (unlocked) {
    return `<svg viewBox="0 0 16 16" class="w-7 h-7 shrink-0" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="4" y="2" width="8" height="6" fill="#FFD700" stroke="#050505" stroke-width="1"/>
      <rect x="2" y="3" width="2" height="3" fill="#E8B84A" stroke="#050505" stroke-width="1"/>
      <rect x="12" y="3" width="2" height="3" fill="#E8B84A" stroke="#050505" stroke-width="1"/>
      <rect x="7" y="8" width="2" height="3" fill="#8A6A3B"/>
      <rect x="5" y="11" width="6" height="3" fill="#E8B84A" stroke="#050505" stroke-width="1"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 16 16" class="w-7 h-7 shrink-0" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="5" y="3" width="6" height="4" fill="none" stroke="#6B5C70" stroke-width="1.5"/>
    <rect x="3" y="7" width="10" height="7" fill="#2A1F2D" stroke="#6B5C70" stroke-width="1"/>
    <rect x="7" y="9" width="2" height="3" fill="#6B5C70"/>
  </svg>`;
}

export class AchievementsScreen extends ModalOverlay {
  private filter: AchFilter = 'all';

  constructor(parent: HTMLElement) {
    super(parent);
  }

  open(save: SaveData, onClose: () => void): void {
    const render = () => {
      const { items, unlockedCount, totalCount } = evaluateAchievements(save);
      const totalPct =
        totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

      const filtered = items.filter((item) => {
        if (this.filter === 'unlocked') return item.unlocked;
        if (this.filter === 'locked') return !item.unlocked;
        return true;
      });

      const filters: Array<{ id: AchFilter; label: string }> = [
        { id: 'all', label: `${ES.achievements.filterAll} (${totalCount})` },
        {
          id: 'unlocked',
          label: `${ES.achievements.filterUnlocked} (${unlockedCount})`,
        },
        {
          id: 'locked',
          label: `${ES.achievements.filterLocked} (${totalCount - unlockedCount})`,
        },
      ];

      const filterBtns = filters
        .map(
          (f) =>
            `<button data-ach-filter="${f.id}" class="px-btn min-h-[44px] px-3 text-xs font-bold whitespace-nowrap ${
              this.filter === f.id ? 'px-btn-primary' : 'px-btn-secondary'
            }">${f.label}</button>`
        )
        .join('');

      const listHtml = filtered
        .map((st) => {
          const borderCls = st.unlocked ? 'border-resonant-gold' : 'border-ash-purple';
          const statusCls = st.unlocked
            ? 'border-resonant-gold bg-deep-abyss text-pale-gold'
            : 'border-ash-purple bg-abyss-ink text-bone-gray';
          const statusText = st.unlocked
            ? ES.achievements.unlockedTag
            : ES.achievements.lockedTag;
          const barColor = st.unlocked ? 'bg-resonant-gold' : 'bg-ki-cyan';
          return `
            <div class="px-panel px-card ${borderCls} p-3 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-2.5">
                <div class="flex items-start gap-2.5 min-w-0">
                  ${renderTrophyIcon(st.unlocked)}
                  <div class="min-w-0">
                    <div class="font-bold text-sm ${st.unlocked ? 'text-pale-gold' : 'text-porcelain'}">${st.def.title}</div>
                    <div class="text-xs text-bone-gray leading-snug mt-0.5">${st.def.description}</div>
                  </div>
                </div>
                <span class="shrink-0 rounded-none border px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap ${statusCls}">${statusText}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="relative flex-1 h-2.5 rounded-none border border-ash-purple bg-abyss-ink overflow-hidden shadow-[inset_0_1px_0_#050505]">
                  <div class="h-full ${barColor}" style="width: ${st.pct}%"></div>
                  <div class="pointer-events-none absolute inset-0 px-meter-segmented"></div>
                </div>
                <span class="text-[11px] font-bold tabular-nums ${st.unlocked ? 'text-resonant-gold' : 'text-ki-cyan'} whitespace-nowrap">${st.current}/${st.target}</span>
              </div>
            </div>
          `;
        })
        .join('');

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-4 text-porcelain">
          <div class="mb-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-base font-bold text-resonant-gold truncate">${ES.achievements.title}</div>
                <div class="text-xs text-bone-gray">${ES.achievements.subtitle}</div>
              </div>
              <button data-ach-close class="px-btn px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.achievements.close}</button>
            </div>
            <div class="px-divider mt-2" aria-hidden="true"></div>
          </div>

          <div class="px-panel px-card border-resonant-gold p-2.5 mb-3">
            <div class="flex items-center justify-between gap-2 text-xs font-bold mb-1">
              <span class="text-pale-gold">Progreso del Mural</span>
              <span class="text-resonant-gold tabular-nums">${unlockedCount}/${totalCount} · ${totalPct}%</span>
            </div>
            <div class="relative w-full h-3 rounded-none border border-ash-purple bg-abyss-ink overflow-hidden shadow-[inset_0_1px_0_#050505]">
              <div class="h-full bg-resonant-gold" style="width: ${totalPct}%"></div>
              <div class="pointer-events-none absolute inset-0 px-meter-segmented"></div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1.5 mb-3">${filterBtns}</div>

          <div class="touch-scroll overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-0.5">
            ${listHtml}
          </div>
        </div>
      `;

      this.root.querySelector('[data-ach-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelectorAll<HTMLElement>('[data-ach-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.filter = btn.dataset.achFilter as AchFilter;
          render();
        });
      });
    };

    this.showOverlay();
    render();
  }
}

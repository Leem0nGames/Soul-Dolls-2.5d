import { swapPartySlots } from '../domain/Party.ts';
import type { CreatureInstance } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';
import { renderPartyGalleryMarkup, type PartyMode } from './renderPartyGalleryMarkup.ts';
import type { SummaryScreen } from './SummaryScreen.ts';

export type { PartyMode };

export class PartyScreen extends ModalOverlay {
  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider,
    private readonly summary: SummaryScreen
  ) {
    super(parent);
  }

  open(party: CreatureInstance[], mode: PartyMode, onClose: () => void): void {
    const render = () => {
      this.root.innerHTML = renderPartyGalleryMarkup(party, mode, this.assets);

      const msgEl = this.root.querySelector('[data-msg]') as HTMLElement;

      this.root.querySelectorAll<HTMLElement>('[data-summary]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.summary);
          const heldCfg =
            mode.kind === 'manage' && mode.bag
              ? { bag: mode.bag, onChanged: () => render() }
              : undefined;
          const cardCfg =
            mode.kind === 'manage' && mode.save
              ? { save: mode.save, onChanged: () => render() }
              : undefined;
          this.summary.open(party[i], () => {}, heldCfg, cardCfg);
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-lead]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.lead);
          swapPartySlots(party, 0, i);
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.pick);
          if (mode.kind === 'switch') {
            if (party[i].currentHp <= 0) {
              msgEl.textContent = ES.party.cantSwitchFainted;
              return;
            }
            if (i === mode.activeIndex) {
              msgEl.textContent = ES.party.cantSwitchActive;
              return;
            }
            this.close();
            mode.onPick(i);
          } else if (mode.kind === 'item_target') {
            this.close();
            mode.onPick(i);
          }
        });
      });

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        if (mode.kind === 'item_target') mode.onCancel();
        else onClose();
      });
    };

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }
}

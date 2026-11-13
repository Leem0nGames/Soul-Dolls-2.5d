export type UiLayerName =
  | 'overworldHud'
  | 'touchControls'
  | 'battleHud'
  | 'battleFx'
  | 'dialog'
  | 'battleTransition'
  | 'menus'
  | 'toast';

const LAYER_Z_ORDER: Record<UiLayerName, number> = {
  overworldHud: 15,
  touchControls: 20,
  battleHud: 22,
  battleFx: 25,
  dialog: 30,
  battleTransition: 35,
  menus: 40,
  toast: 50,
};

export class UiLayerManager {
  private layers = new Map<UiLayerName, HTMLElement[]>();

  register(name: UiLayerName, ...els: HTMLElement[]): void {
    const z = String(LAYER_Z_ORDER[name]);
    for (const el of els) {
      el.style.zIndex = z;
    }
    this.layers.set(name, els);
  }

  unregister(name: UiLayerName): void {
    this.layers.delete(name);
  }

  setVisible(name: UiLayerName, visible: boolean): void {
    const els = this.layers.get(name);
    if (!els) return;
    for (const el of els) {
      el.style.display = visible ? '' : 'none';
    }
  }

  applySceneVisibility(config: Partial<Record<UiLayerName, boolean>>): void {
    for (const [name, visible] of Object.entries(config) as [UiLayerName, boolean][]) {
      this.setVisible(name, visible);
    }
  }
}

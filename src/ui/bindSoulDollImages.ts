import type { AssetProvider } from '../gfx/AssetProvider.ts';

/**
 * Subscribes to async SoulDoll spritesheet loads and updates matching <img> nodes
 * in-place so UI modals/galleries swap from fallback to the loaded 256x256 artwork immediately.
 */
export function bindSoulDollImageUpdates(
  root: HTMLElement,
  assets: AssetProvider
): () => void {
  if (!assets.onCreatureLoaded) return () => {};
  return assets.onCreatureLoaded((speciesId) => {
    const selector = `img[data-souldoll-id="${speciesId}"]`;
    root.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
      const view = img.dataset.souldollView;
      if (view === 'silhouette') {
        img.src = assets.getCreatureSilhouetteDataUrl(speciesId);
      } else if (view === 'back') {
        img.src = assets.getCreatureDataUrl(speciesId, 'back');
      } else {
        img.src = assets.getCreatureDataUrl(speciesId, 'front');
      }
    });
  });
}

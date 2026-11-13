import type * as THREE from 'three';

export interface Disposable {
  dispose(): void;
}

export class DisposableRegistry {
  private items: Disposable[] = [];

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  trackObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        this.items.push(mesh.geometry);
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          for (const m of mesh.material) this.items.push(m);
        } else {
          this.items.push(mesh.material);
        }
      }
    });
  }

  disposeAll(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].dispose();
    }
    this.items.length = 0;
  }
}

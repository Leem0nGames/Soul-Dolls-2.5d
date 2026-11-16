export interface Scene {
  readonly name: string;
  onEnter?(): void;
  onExit?(): void;
  onPause?(): void;
  onResume?(): void;
  fixedUpdate(dt: number): void;
  render(alpha: number): void;
}

export class SceneStack {
  private stack: Scene[] = [];

  peek(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene): void {
    this.peek()?.onPause?.();
    this.stack.push(scene);
    scene.onEnter?.();
  }

  pop(): Scene | undefined {
    const top = this.stack.pop();
    top?.onExit?.();
    this.peek()?.onResume?.();
    return top;
  }

  replaceTop(scene: Scene): Scene | undefined {
    const top = this.stack.pop();
    top?.onExit?.();
    this.stack.push(scene);
    scene.onEnter?.();
    return top;
  }

  replace(scene: Scene): void {
    while (this.stack.length > 0) {
      const top = this.stack.pop();
      top?.onExit?.();
    }
    this.stack.push(scene);
    scene.onEnter?.();
  }

  fixedUpdate(dt: number): void {
    this.peek()?.fixedUpdate(dt);
  }

  render(alpha: number): void {
    this.peek()?.render(alpha);
  }
}

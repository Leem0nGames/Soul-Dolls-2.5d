export function playCardSocketFx(
  targetEl: HTMLElement | null,
  accentColor = '#5FE3D2',
  boostedStatEls: Iterable<HTMLElement> = []
): void {
  if (!targetEl) return;

  targetEl.classList.remove('card-socket-flash');
  void targetEl.offsetWidth;
  targetEl.classList.add('card-socket-flash');

  for (const statEl of boostedStatEls) {
    statEl.classList.remove('card-stat-boosted');
    void statEl.offsetWidth;
    statEl.classList.add('card-stat-boosted');
  }

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const rect = targetEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'pointer-events-none fixed inset-0 z-[70] overflow-hidden';
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;

  const ring = document.createElement('div');
  ring.className = 'card-socket-ring';
  ring.style.left = `${cx}px`;
  ring.style.top = `${cy}px`;
  ring.style.setProperty('--fx-color', accentColor);
  overlay.appendChild(ring);

  const ring2 = document.createElement('div');
  ring2.className = 'card-socket-ring';
  ring2.style.left = `${cx}px`;
  ring2.style.top = `${cy}px`;
  ring2.style.animationDelay = '70ms';
  ring2.style.setProperty('--fx-color', '#E8B84A');
  overlay.appendChild(ring2);

  const count = 12;
  const palette = [accentColor, '#5FE3D2', '#E8B84A', '#FFF9F0'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const dist = 26 + (i % 3) * 16;
    const tx = Math.round(Math.cos(angle) * dist);
    const ty = Math.round(Math.sin(angle) * dist);
    const spark = document.createElement('div');
    spark.className = 'card-socket-spark';
    spark.style.left = `${cx}px`;
    spark.style.top = `${cy}px`;
    spark.style.backgroundColor = palette[i % palette.length];
    spark.style.border = '1px solid #050505';
    spark.style.setProperty('--tx', `${tx}px`);
    spark.style.setProperty('--ty', `${ty}px`);
    spark.style.animationDelay = `${(i % 4) * 28}ms`;
    overlay.appendChild(spark);
  }

  document.body.appendChild(overlay);
  window.setTimeout(() => {
    overlay.remove();
  }, 600);
}

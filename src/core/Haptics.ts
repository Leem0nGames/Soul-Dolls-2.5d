export function triggerHaptic(duration = 15): void {
  try {
    if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
      window.navigator.vibrate(duration);
    }
  } catch {
    // Ignore if not supported / permission denied
  }
}

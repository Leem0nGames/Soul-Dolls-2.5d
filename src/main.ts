import './index.css';
import { Game } from './core/Game.ts';

const mount = document.getElementById('app');
if (!mount) {
  throw new Error('Missing #app root element');
}

const game = new Game(mount);
void game;

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        // ignore SW registration failure in restricted environments
      });
    });
  }
}

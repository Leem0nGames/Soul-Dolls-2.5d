export type EventMap = {
  'audio:sfx': {
    sfx:
      | 'menu'
      | 'confirm'
      | 'cancel'
      | 'hit'
      | 'hit_weak'
      | 'super'
      | 'crit'
      | 'low_hp'
      | 'victory_fanfare'
      | 'rustle'
      | 'throw'
      | 'levelup'
      | 'capture'
      | 'faint'
      | 'heal'
      | 'bump';
  };
  'audio:music': {
    track:
      | 'title'
      | 'town'
      | 'route'
      | 'cave'
      | 'battle'
      | 'trainer_battle'
      | 'boss'
      | 'victory'
      | 'none';
  };
  'game:toast': { message: string };
  'game:save': { manual: boolean };
  'options:changed': Record<string, never>;
};

type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<never>);
    return () => {
      set?.delete(fn as Listener<never>);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      (fn as Listener<EventMap[K]>)(payload);
    }
  }
}

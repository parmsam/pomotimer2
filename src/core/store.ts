type Listener<T> = (state: T, prev: T) => void;

export interface Store<T> {
  get(): T;
  set(next: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: Listener<T>): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set(next) {
      const prev = state;
      const patch = typeof next === 'function' ? next(state) : next;
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Persists a store on change, coalescing bursts of updates. */
export function persist<T extends object>(store: Store<T>, save: (s: T) => void, delay = 150): void {
  let handle: number | undefined;
  const flush = () => {
    handle = undefined;
    save(store.get());
  };
  store.subscribe(() => {
    if (handle === undefined) handle = window.setTimeout(flush, delay);
  });
  window.addEventListener('pagehide', () => {
    if (handle !== undefined) {
      clearTimeout(handle);
      flush();
    }
  });
}

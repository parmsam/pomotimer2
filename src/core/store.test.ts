import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore, persist } from './store';

afterEach(() => vi.useRealTimers());

describe('createStore', () => {
  it('merges partial and function updates and notifies with the previous state', () => {
    const store = createStore({ a: 1, b: 'x' });
    const seen: [number, number][] = [];
    store.subscribe((s, prev) => seen.push([s.a, prev.a]));
    store.set({ a: 2 });
    store.set((s) => ({ a: s.a + 1 }));
    expect(store.get()).toEqual({ a: 3, b: 'x' });
    expect(seen).toEqual([
      [2, 1],
      [3, 2],
    ]);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ a: 1 });
    const fn = vi.fn();
    const off = store.subscribe(fn);
    off();
    store.set({ a: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('persist', () => {
  it('coalesces a burst of updates into one save', () => {
    vi.useFakeTimers();
    const store = createStore({ n: 0 });
    const save = vi.fn();
    persist(store, save, 100);
    for (let i = 1; i <= 5; i++) store.set({ n: i });
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ n: 5 });
  });

  it('flushes a pending save when the page is hidden', () => {
    vi.useFakeTimers();
    const store = createStore({ n: 0 });
    const save = vi.fn();
    persist(store, save, 1000);
    store.set({ n: 1 });
    window.dispatchEvent(new Event('pagehide'));
    expect(save).toHaveBeenCalledWith({ n: 1 });
  });
});

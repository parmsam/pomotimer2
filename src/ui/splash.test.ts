import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liftSplash } from './splash';

describe('liftSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="splash"></div>';
    document.documentElement.className = '';
  });
  afterEach(() => vi.useRealTimers());

  const splash = () => document.getElementById('splash');

  it('stays up for the minimum time, then fades and is removed', () => {
    const onLift = vi.fn();
    liftSplash(onLift, { minMs: 1000, elapsed: 300 });
    vi.advanceTimersByTime(699);
    expect(onLift).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLift).toHaveBeenCalledOnce();
    expect(splash()?.classList.contains('out')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(splash()).toBeNull();
  });

  it('lifts right away when it is turned off', () => {
    document.documentElement.classList.add('no-splash');
    const onLift = vi.fn();
    liftSplash(onLift, { minMs: 1000, elapsed: 0 });
    expect(onLift).toHaveBeenCalledOnce();
    expect(splash()).toBeNull();
  });

  it('a key press skips it and is swallowed so it does not reach shortcuts', () => {
    const onLift = vi.fn();
    const shortcut = vi.fn();
    document.addEventListener('keydown', shortcut);
    liftSplash(onLift, { minMs: 1000, elapsed: 0 });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onLift).toHaveBeenCalledOnce();
    expect(shortcut).not.toHaveBeenCalled();
    // Later keys work normally, and the timer doesn't lift it twice.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(shortcut).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(2000);
    expect(onLift).toHaveBeenCalledOnce();
    document.removeEventListener('keydown', shortcut);
  });
});

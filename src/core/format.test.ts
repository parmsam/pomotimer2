import { describe, expect, it } from 'vitest';
import { formatDuration, formatTime } from './format';

describe('formatTime', () => {
  it.each([
    [25 * 60_000, '25:00'],
    [59_001, '01:00'], // rounds up so the clock never shows 00:00 early
    [1, '00:01'],
    [0, '00:00'],
    [125 * 60_000, '125:00'],
  ])('%i ms → %s', (ms, text) => expect(formatTime(ms)).toBe(text));
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [30_000, '<1m'],
    [25 * 60_000, '25m'],
    [65 * 60_000, '1h 05m'],
  ])('%i ms → %s', (ms, text) => expect(formatDuration(ms)).toBe(text));
});

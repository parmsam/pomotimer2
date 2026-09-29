import { describe, expect, it } from 'vitest';
import { parseUrlAction, stripAction } from './urlActions';

describe('parseUrlAction', () => {
  it('ignores URLs without an action', () => {
    expect(parseUrlAction('')).toBeNull();
    expect(parseUrlAction('?utm_source=x')).toBeNull();
    expect(parseUrlAction('?do=')).toBeNull();
  });

  it('reads start with optional mode, length and task', () => {
    expect(parseUrlAction('?do=start')).toEqual({ kind: 'start', mode: null, minutes: null, task: null });
    expect(parseUrlAction('?do=start&mode=focus&min=50&task=Write+report')).toEqual({ kind: 'start', mode: 'focus', minutes: 50, task: 'Write report' });
    expect(parseUrlAction('?do=START&mode=break&min=1h')).toMatchObject({ mode: 'short', minutes: 60 });
    expect(parseUrlAction('?do=start&mode=long')).toMatchObject({ mode: 'long' });
  });

  it('reads the simple actions', () => {
    expect(parseUrlAction('?do=pause')).toEqual({ kind: 'pause' });
    expect(parseUrlAction('?do=skip')).toEqual({ kind: 'skip' });
    expect(parseUrlAction('?do=reset')).toEqual({ kind: 'reset' });
  });

  it('reads add-task with a clamped estimate', () => {
    expect(parseUrlAction('?do=add-task&task=Email%20Sam&estimate=3')).toEqual({ kind: 'add-task', title: 'Email Sam', estimate: 3 });
    expect(parseUrlAction('?do=add-task&task=A&estimate=99')).toMatchObject({ estimate: 1 });
    expect(parseUrlAction('?do=add-task&task=A&estimate=abc')).toMatchObject({ estimate: 1 });
  });

  it('explains links it can’t run', () => {
    expect(parseUrlAction('?do=explode')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('explode') });
    expect(parseUrlAction('?do=start&mode=nap')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('nap') });
    expect(parseUrlAction('?do=start&min=0')).toMatchObject({ kind: 'invalid' });
    expect(parseUrlAction('?do=start&min=soon')).toMatchObject({ kind: 'invalid' });
    expect(parseUrlAction('?do=add-task')).toMatchObject({ kind: 'invalid' });
  });

  it('caps very long task titles', () => {
    const a = parseUrlAction(`?do=start&task=${'x'.repeat(500)}`);
    expect(a).toMatchObject({ kind: 'start' });
    expect((a as { task: string }).task).toHaveLength(200);
  });
});

describe('stripAction', () => {
  it('removes only the action parameters', () => {
    expect(stripAction('https://x.io/pomotimer2/?do=start&mode=focus&min=5&task=A&estimate=2')).toBe('/pomotimer2/');
    expect(stripAction('https://x.io/pomotimer2/?utm=1&do=pause#top')).toBe('/pomotimer2/?utm=1#top');
  });
});

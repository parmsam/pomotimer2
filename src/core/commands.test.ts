import { describe, expect, it } from 'vitest';
import { fuzzyMatch, matchCommand, parseCommand, parseMinutes } from './commands';

const MIN = 60_000;

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively and reports indices', () => {
    expect(fuzzyMatch('tm', 'Theme: Midnight')?.indices).toEqual([0, 7]);
    expect(fuzzyMatch('xyz', 'Theme: Midnight')).toBeNull();
  });

  it('ranks word starts and substrings above scattered letters', () => {
    const start = fuzzyMatch('ra', 'Ambient sound: Rain')!.score;
    const scattered = fuzzyMatch('ra', 'Clear finished tasks')?.score ?? -Infinity;
    expect(start).toBeGreaterThan(scattered);
    expect(fuzzyMatch('mid', 'Theme: Midnight')!.score).toBeGreaterThan(fuzzyMatch('mdn', 'Theme: Midnight')!.score);
  });
});

describe('matchCommand', () => {
  it('needs every word to match the title or keywords', () => {
    expect(matchCommand('face tetris', 'Clock face: Tetris')).not.toBeNull();
    expect(matchCommand('toggle rain', 'Ambient sound: Rain', 'toggle noise')).not.toBeNull();
    expect(matchCommand('toggle snow', 'Ambient sound: Rain', 'toggle noise')).toBeNull();
  });

  it('only highlights letters in the title', () => {
    const m = matchCommand('toggle rain', 'Ambient sound: Rain', 'toggle noise')!;
    expect(m.indices.map((i) => 'Ambient sound: Rain'[i]).join('')).toBe('Rain');
  });

  it('ranks a title containing the whole phrase first', () => {
    const phrase = matchCommand('switch to', 'Switch to focus')!.score;
    const scattered = matchCommand('switch to', 'Clock face: Tomato', 'switch timer style')!.score;
    expect(phrase).toBeGreaterThan(scattered);
  });

  it('prefers the command whose title contains the query', () => {
    const tama = matchCommand('tama', 'Clock face: Tamagotchi')!.score;
    const other = matchCommand('tama', 'Start a timer', 'pomodoro')?.score ?? -Infinity;
    expect(tama).toBeGreaterThan(other);
  });
});

describe('parseMinutes', () => {
  it.each([
    ['50', 50],
    ['50m', 50],
    ['50 min', 50],
    ['45 minutes', 45],
    ['1h', 60],
    ['1.5h', 90],
    ['1h 30m', 90],
    ['2 hours', 120],
  ])('%s → %i', (text, minutes) => expect(parseMinutes(text)).toBe(minutes));

  it.each(['0', '0m', 'abc', '5000h', '30m 1h'])('rejects %s', (text) => expect(parseMinutes(text)).toBeNull());
});

describe('parseCommand', () => {
  it.each([
    ['Start 50m focus', 'focus', 50],
    ['start a 50 min focus session', 'focus', 50],
    ['50m focus', 'focus', 50],
    ['focus 50', 'focus', 50],
    ['focus for 1h', 'focus', 60],
    ['10m break', 'short', 10],
    ['start short break for 7m', 'short', 7],
    ['long break 20', 'long', 20],
    ['25', null, 25],
    ['start 25m', null, 25],
  ])('%s → start %s for %i min', (input, mode, minutes) => {
    expect(parseCommand(input)).toEqual({ kind: 'start', mode, ms: minutes * MIN });
  });

  it('starts a mode at its usual length with a verb', () => {
    expect(parseCommand('start long break')).toEqual({ kind: 'start', mode: 'long', ms: null });
    expect(parseCommand('start')).toEqual({ kind: 'start', mode: null, ms: null });
  });

  it('leaves bare words to the fuzzy search', () => {
    expect(parseCommand('focus')).toBeNull();
    expect(parseCommand('theme')).toBeNull();
    expect(parseCommand('add a minute')).toBeNull();
    expect(parseCommand('new task')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });

  it('changes the saved length with "set"', () => {
    expect(parseCommand('set focus to 50m')).toEqual({ kind: 'set-length', mode: 'focus', minutes: 50 });
    expect(parseCommand('set long break 20')).toEqual({ kind: 'set-length', mode: 'long', minutes: 20 });
    expect(parseCommand('short break = 3')).toEqual({ kind: 'set-length', mode: 'short', minutes: 3 });
  });

  it('adds tasks, keeping the title as typed', () => {
    expect(parseCommand('add task Write Report 🍅2')).toEqual({ kind: 'add-task', title: 'Write Report 🍅2' });
    expect(parseCommand('New task: Email Sam')).toEqual({ kind: 'add-task', title: 'Email Sam' });
    expect(parseCommand('task Plan sprint')).toEqual({ kind: 'add-task', title: 'Plan sprint' });
  });

  it('rejects out-of-range lengths', () => {
    expect(parseCommand('start 0m focus')).toBeNull();
    expect(parseCommand('set focus to 99999')).toBeNull();
  });
});

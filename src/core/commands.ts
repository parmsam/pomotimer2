import type { Mode } from './types';

// ---- Fuzzy matching

export interface FuzzyMatch {
  score: number;
  /** Indices of matched characters in the text, for highlighting. */
  indices: number[];
}

const isBoundary = (text: string, i: number) => i === 0 || /[\s:/(\-–—“"]/.test(text[i - 1]);

/**
 * Subsequence match of `needle` in `text` (case-insensitive). Prefers matches at word
 * starts and runs of consecutive characters. Returns null when not every character is found.
 */
export function fuzzyMatch(needle: string, text: string): FuzzyMatch | null {
  const n = needle.toLowerCase();
  const h = text.toLowerCase();
  if (!n) return { score: 0, indices: [] };
  // A plain substring is the strongest signal; take the earliest one at a word start if any.
  let sub = -1;
  for (let i = h.indexOf(n); i !== -1; i = h.indexOf(n, i + 1)) {
    if (sub === -1) sub = i;
    if (isBoundary(text, i)) {
      sub = i;
      break;
    }
  }
  if (sub !== -1) {
    return { score: 100 + n.length * 10 + (isBoundary(text, sub) ? 30 : 0) - sub, indices: [...n].map((_, k) => sub + k) };
  }
  const indices: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of n) {
    // Jump to the next word start holding this character when one exists, else the next occurrence.
    let at = -1;
    for (let i = from; i < h.length; i++) {
      if (h[i] !== ch) continue;
      if (isBoundary(text, i)) {
        at = i;
        break;
      }
      if (at === -1) at = i;
    }
    if (at === -1) return null;
    const prev = indices.at(-1);
    score += isBoundary(text, at) ? 8 : prev === at - 1 ? 5 : 1;
    indices.push(at);
    from = at + 1;
  }
  return { score: score - indices[0] * 0.1, indices };
}

/** Every word of the query must match the title or one of the keywords; the title wins ties. */
export function matchCommand(query: string, title: string, keywords = ''): FuzzyMatch | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { score: 0, indices: [] };
  const titleHits = new Set<number>();
  let score = 0;
  // The whole phrase appearing in the title beats words scattered across title and keywords.
  const phrase = query.trim().replace(/\s+/g, ' ').toLowerCase();
  const at = title.toLowerCase().indexOf(phrase);
  if (words.length > 1 && at !== -1) {
    return { score: 1000 + phrase.length * 10 - at, indices: [...phrase].map((_, k) => at + k) };
  }
  for (const w of words) {
    const inTitle = fuzzyMatch(w, title);
    const inKeywords = keywords ? fuzzyMatch(w, keywords) : null;
    if (!inTitle && !inKeywords) return null;
    if (inTitle && (!inKeywords || inTitle.score >= inKeywords.score * 0.8)) {
      score += inTitle.score;
      inTitle.indices.forEach((i) => titleHits.add(i));
    } else {
      score += inKeywords!.score * 0.8;
    }
  }
  return { score, indices: [...titleHits].sort((a, b) => a - b) };
}

// ---- Command-bar syntax

export type ParsedCommand =
  /** Start a session, optionally in another mode and with a one-off length. */
  | { kind: 'start'; mode: Mode | null; ms: number | null }
  /** Change the saved length of a mode. */
  | { kind: 'set-length'; mode: Mode; minutes: number }
  | { kind: 'add-task'; title: string };

const MODE_WORDS: [RegExp, Mode][] = [
  [/^(?:long(?:\s+break)?)$/, 'long'],
  [/^(?:short(?:\s+break)?|break|rest)$/, 'short'],
  [/^(?:focus|work|pomodoro|pomo)$/, 'focus'],
];
const MODE_RE = '(long(?:\\s+break)?|short(?:\\s+break)?|break|rest|focus|work|pomodoro|pomo)';
const DURATION_RE = '(\\d+(?:\\.\\d+)?\\s*h(?:ours?|rs?)?(?:\\s*\\d+\\s*m(?:in(?:ute)?s?)?)?|\\d+(?:\\.\\d+)?\\s*(?:m(?:in(?:ute)?s?)?)?)';
const MAX_MINUTES = 24 * 60;

function toMode(word: string): Mode | null {
  const w = word.trim().replace(/\s+/g, ' ');
  return MODE_WORDS.find(([re]) => re.test(w))?.[1] ?? null;
}

/** "50", "50m", "50 min", "1h", "1.5h", "1h 30m" → minutes. */
export function parseMinutes(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:m(?:in(?:ute)?s?)?)?$/);
  if (!m) return null;
  const minutes = m[2] ? Number(m[1]) * 60 + Number(m[3] ?? 0) : Number(m[1]);
  if (m[3] && !m[2]) return null;
  const rounded = Math.round(minutes);
  return rounded >= 1 && rounded <= MAX_MINUTES ? rounded : null;
}

/**
 * Understands a few natural phrasings typed into the palette:
 *   "start 50m focus", "50 min focus", "focus 50", "10m break", "start long break", "25"
 *   "set focus to 50m", "short break = 10"
 *   "add task Write report", "new task Email Sam"
 */
export function parseCommand(input: string): ParsedCommand | null {
  const q = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return null;

  const task = input.trim().match(/^(?:(?:add|new)\s+)?task\s*:?\s+(.+)$/i);
  if (task) return { kind: 'add-task', title: task[1].trim() };

  let m = q.match(new RegExp(`^set\\s+${MODE_RE}(?:\\s+(?:length|duration|time))?\\s*(?:to|=|:)?\\s*${DURATION_RE}$`));
  if (!m) m = q.match(new RegExp(`^${MODE_RE}\\s*(?:=|:)\\s*${DURATION_RE}$`));
  if (m) {
    const mode = toMode(m[1]);
    const minutes = parseMinutes(m[2]);
    return mode && minutes ? { kind: 'set-length', mode, minutes } : null;
  }

  const body = q.replace(/^(?:start|begin|go|run|timer)\b\s*(?:a\s+|an\s+)?/, '');
  const verb = body !== q;
  if (!body) return verb ? { kind: 'start', mode: null, ms: null } : null;
  // "<duration> [of] <mode>", "<mode> [for] <duration>", "<duration>", "<mode>" (the last only with a verb)
  const withSession = `(?:\\s+session)?`;
  const patterns: [RegExp, (m: RegExpMatchArray) => [string | null, string | null]][] = [
    [new RegExp(`^${DURATION_RE}\\s*(?:of\\s+)?${MODE_RE}${withSession}$`), (x) => [x[2], x[1]]],
    [new RegExp(`^${MODE_RE}${withSession}\\s*(?:for\\s+)?${DURATION_RE}$`), (x) => [x[1], x[2]]],
    [new RegExp(`^(?:for\\s+)?${DURATION_RE}${withSession}$`), (x) => [null, x[1]]],
    [new RegExp(`^${MODE_RE}${withSession}$`), (x) => [x[1], null]],
  ];
  for (const [re, pick] of patterns) {
    const hit = body.match(re);
    if (!hit) continue;
    const [modeWord, durWord] = pick(hit);
    if (!verb && !durWord) return null; // a bare "focus" is a search, not a command
    const mode = modeWord ? toMode(modeWord) : null;
    const minutes = durWord ? parseMinutes(durWord) : null;
    if (durWord && !minutes) return null;
    return { kind: 'start', mode, ms: minutes ? minutes * 60_000 : null };
  }
  return null;
}

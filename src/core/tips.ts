/** Short, practical things to do on a break. Shown as the subtitle during breaks. */
export const BREAK_TIPS: Record<'short' | 'long', string[]> = {
  short: [
    'Stretch your shoulders and neck',
    'Look at something 20 feet away for 20 seconds',
    'Refill your water',
    'Stand up and walk around',
    'Take five slow breaths',
    'Roll your wrists, unclench your jaw',
    'Step away from the screen',
    'Tidy one thing on your desk',
  ],
  long: [
    'Go for a short walk',
    'Get some daylight or fresh air',
    'Have a snack or make a drink',
    'Move: a few squats, a stretch, some stairs',
    'Chat with someone for a bit',
    'Rest your eyes; no screens if you can',
  ],
};

/** Stable per break (changes each session, not every render). */
export function breakTip(mode: 'short' | 'long', seed: number): string {
  const list = BREAK_TIPS[mode];
  return list[((seed % list.length) + list.length) % list.length];
}

import type { AlarmSound } from './types';

let ctx: AudioContext | null = null;

/** The shared context (created on first unlock). */
export const audioContext = (): AudioContext | null => ctx;

// Safari can suspend or "interrupt" audio (calls, backgrounding); any tap or key brings it back.
for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(type, () => {
    if (ctx && ctx.state !== 'running') void ctx.resume();
  }, { capture: true, passive: true });
}

/** Call from a user gesture so browsers allow playback later. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

interface Note {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Extra partials as frequency multipliers, for bell-like tones. */
  partials?: number[];
}

function play(notes: Note[], volume: number): void {
  unlockAudio();
  if (!ctx || volume <= 0) return;
  const now = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  for (const n of notes) {
    for (const [i, mult] of [1, ...(n.partials ?? [])].entries()) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.freq * mult;
      const peak = (n.gain ?? 0.4) / (i + 1);
      const t0 = now + n.at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.05);
    }
  }
}

const bellStrike = (at: number, freq = 880): Note => ({ freq, at, dur: 2.2, partials: [2.76, 5.4], gain: 0.35 });

const SOUNDS: Record<Exclude<AlarmSound, 'none'>, Note[]> = {
  bell: [bellStrike(0), bellStrike(0.9), bellStrike(1.8)],
  chime: [523.25, 659.25, 783.99, 1046.5].map((freq, i) => ({ freq, at: i * 0.18, dur: 1.4, type: 'triangle' as const, gain: 0.3 })),
  digital: [0, 0.16, 0.6, 0.76, 1.2, 1.36].map((at) => ({ freq: 1760, at, dur: 0.1, type: 'square' as const, gain: 0.12 })),
  marimba: [392, 523.25, 659.25, 523.25, 783.99].map((freq, i) => ({ freq, at: i * 0.14, dur: 0.5, partials: [4], gain: 0.4 })),
};

export const ALARM_OPTIONS: { id: AlarmSound; label: string }[] = [
  { id: 'bell', label: 'Bell' },
  { id: 'chime', label: 'Chime' },
  { id: 'digital', label: 'Digital' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'none', label: 'Silent' },
];

/**
 * Audio Session API (Safari 17+). No browser reveals the silent switch, but on iOS the
 * default "ambient" session is muted by it. A "playback" session is not, like a
 * real timer app. It may pause other audio while it's active, so we only switch for
 * the alarm itself and hand control back afterwards.
 */
type AudioSession = { type: string };
const audioSession = (): AudioSession | undefined => (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
export const canPlayThroughSilentMode = () => !!audioSession();

/**
 * Who currently needs a "playback" session (the alarm while ringing, ambient sound while
 * playing). Shared so one finishing doesn't switch the session back under the other.
 */
const playbackOwners = new Set<string>();
export function holdPlaybackSession(owner: string, on: boolean) {
  if (on) playbackOwners.add(owner);
  else playbackOwners.delete(owner);
  const session = audioSession();
  if (!session) return;
  try {
    session.type = playbackOwners.size ? 'playback' : 'auto';
  } catch {
    // Unsupported value in this browser.
  }
}

let sessionReset: number | undefined;

export function playAlarm(sound: AlarmSound, volume: number, opts: { ignoreSilentMode?: boolean } = {}): void {
  if (sound === 'none') return;
  if (opts.ignoreSilentMode && audioSession()) {
    holdPlaybackSession('alarm', true);
    clearTimeout(sessionReset);
    const lengthMs = Math.max(...SOUNDS[sound].map((n) => n.at + n.dur)) * 1000;
    sessionReset = window.setTimeout(() => holdPlaybackSession('alarm', false), lengthMs + 500);
  }
  play(SOUNDS[sound], volume);
}

export function playTick(volume: number): void {
  play([{ freq: 2000, at: 0, dur: 0.03, type: 'square', gain: 0.04 }], volume);
}

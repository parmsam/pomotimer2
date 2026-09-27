export type Mode = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type AlarmSound = 'bell' | 'chime' | 'digital' | 'marimba' | 'none';

export interface Settings {
  /** Minutes per mode. */
  durations: Record<Mode, number>;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  theme: string;
  /** Overrides the theme's focus color when set. */
  accent: string | null;
  alarm: AlarmSound;
  volume: number;
  tick: boolean;
  notifications: boolean;
  titleCountdown: boolean;
}

export interface TimerState {
  mode: Mode;
  status: TimerStatus;
  /** Epoch ms when the running session ends. Only meaningful while running. */
  endsAt: number | null;
  /** Remaining ms while idle or paused. */
  remainingMs: number;
  /** Focus sessions completed toward the next long break. */
  cycleCount: number;
}

export interface SessionRecord {
  mode: Mode;
  endedAt: number;
  durationMs: number;
}

export interface AppData {
  timer: TimerState;
  history: SessionRecord[];
}

export const MODE_LABELS: Record<Mode, string> = {
  focus: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

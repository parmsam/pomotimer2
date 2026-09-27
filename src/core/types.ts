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
  /** Per-mode color overrides; null uses the theme's color. */
  modeColors: Record<Mode, string | null>;
  /** Page background: CSS blobs, a three.js scene, or nothing. */
  background: 'blobs' | 'fireflies' | 'aurora' | 'rain' | 'none';
  /** Timer face: ring, tomato, tamagotchi. */
  clockFace: 'ring' | 'tomato' | 'tamagotchi';
  /** Roll each digit in as the clock changes. */
  rollingDigits: boolean;
  alarm: AlarmSound;
  volume: number;
  tick: boolean;
  notifications: boolean;
  titleCountdown: boolean;
  /** Keep the screen on while a session runs. */
  keepAwake: boolean;
  /** No pausing: stopping a focus session abandons it. */
  strictMode: boolean;
  showTasks: boolean;
  muted: boolean;
  ambient: 'off' | 'rain' | 'brown' | 'pink' | 'vinyl';
  ambientVolume: number;
  /** Keep the ambient sound playing during breaks too (default: focus only). */
  ambientOnBreaks: boolean;
  /** Vibrate on phones (start/pause, task done, session end). */
  haptics: boolean;
  /** iOS: let the alarm sound even when the phone's silent switch is on. */
  alarmIgnoresSilent: boolean;
  /** The one-time tip about phone audio/notifications has been shown. */
  mobileTipSeen: boolean;
  /** Show the interruption logger during focus (Cirillo's internal/external marks). */
  trackInterruptions: boolean;
  /** Pomodoros per day to aim for. */
  dailyGoal: number;
  /** Enter focus mode automatically when a focus session starts. */
  focusModeOnStart: boolean;
  /** The one-time "press ? for shortcuts" tip has been shown. */
  shortcutsHintSeen: boolean;
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
  /** Start of the current uninterrupted running stretch (focus only). */
  segmentStart: number | null;
  /** Focus time accumulated in this session across pauses, excluding the open segment. */
  focusedMs: number;
  interruptions: Interruptions;
}

export interface Interruptions {
  /** Your own urge to switch (Cirillo's '). */
  internal: number;
  /** Someone or something else (Cirillo's -). */
  external: number;
}

/** A distraction jotted down during focus, kept apart from tasks until you decide. */
export interface InterruptionNote {
  id: string;
  at: number;
  kind: keyof Interruptions;
  text: string;
}

export interface SessionRecord {
  mode: Mode;
  endedAt: number;
  /** Planned length. */
  durationMs: number;
  /** Time actually spent focusing (focus sessions only). */
  focusedMs?: number;
  /** Stopped before it counted. */
  abandoned?: boolean;
  taskId?: string | null;
  interruptions?: Interruptions;
}

export interface Task {
  id: string;
  title: string;
  /** Estimated pomodoros. */
  estimate: number;
  /** Completed pomodoros credited to this task. */
  pomodoros: number;
  trackedMs: number;
  done: boolean;
  createdAt: number;
  doneAt: number | null;
}

export interface AppData {
  timer: TimerState;
  history: SessionRecord[];
  tasks: Task[];
  activeTaskId: string | null;
  notes: InterruptionNote[];
  /** Day key when the daily-goal celebration last played, so it plays once per day across tabs. */
  goalCelebratedOn: string | null;
}

export const MODE_LABELS: Record<Mode, string> = {
  focus: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

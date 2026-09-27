import type { Mode, TimerStatus } from '../core/types';

export type FaceId = 'ring' | 'tomato' | 'tamagotchi';

export interface FaceContext {
  mode: Mode;
  status: TimerStatus;
  remainingMs: number;
  durationMs: number;
  /** All-time counted pomodoros (the Tamagotchi grows with these). */
  totalPomodoros: number;
}

/** Moments a face may want to react to. */
export type FaceEvent = 'start' | 'pause' | 'complete' | 'abandon' | 'mode';

/**
 * A timer face draws the visual clock. The digits (#time) and subtitle stay real,
 * accessible text owned by the timer view; faces only add artwork around them.
 */
export interface Face {
  id: FaceId;
  label: string;
  /** Small static SVG for the picker in settings. */
  preview: string;
  mount(layer: HTMLElement, ctx: FaceContext): void;
  /** `p` is the share of the session remaining, 1 → 0. Called every frame while running. */
  setProgress(p: number, ctx: FaceContext): void;
  event?(e: FaceEvent, ctx: FaceContext): void;
  unmount(): void;
}

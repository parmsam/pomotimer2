import { audioContext, unlockAudio } from './audio';

export type AmbientSound = 'off' | 'rain' | 'brown' | 'pink' | 'vinyl';

export const AMBIENT_OPTIONS: { id: AmbientSound; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'rain', label: 'Rain' },
  { id: 'brown', label: 'Brown noise' },
  { id: 'pink', label: 'Pink noise' },
  { id: 'vinyl', label: 'Vinyl crackle' },
];

const SECONDS = 12; // long enough that the loop point isn't noticeable
const FADE = 1.5;

/** Noise buffers, generated once per sound. Pure DSP, no audio files to license. */
function makeBuffer(ctx: AudioContext, kind: Exclude<AmbientSound, 'off'>): AudioBuffer {
  const len = ctx.sampleRate * SECONDS;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // Pink (Paul Kellet) and brown (integrated) noise state.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      brown = (brown + 0.02 * white) / 1.02;

      if (kind === 'pink') d[i] = pink;
      else if (kind === 'brown') d[i] = brown * 3.5;
      else if (kind === 'rain') {
        // Steady hiss plus sparse droplets.
        const drop = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0;
        d[i] = pink * 0.8 + drop;
      } else {
        // Vinyl: warm low rumble with random crackles.
        const crackle = Math.random() < 0.00035 ? (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6) : 0;
        d[i] = brown * 1.2 + crackle;
      }
    }
  }
  return buf;
}

/** Each sound's filter chain, tuned so it sits quietly under focus. */
function chain(ctx: AudioContext, kind: Exclude<AmbientSound, 'off'>): { input: AudioNode; output: AudioNode } {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  const settings = { rain: [8000, 300], brown: [900, 20], pink: [6000, 40], vinyl: [4500, 60] }[kind];
  lp.frequency.value = settings[0];
  hp.frequency.value = settings[1];
  hp.connect(lp);
  return { input: hp, output: lp };
}

const buffers = new Map<string, AudioBuffer>();

/** One looping ambient sound at a time, with smooth fades. */
export function createAmbientPlayer() {
  let current: { kind: AmbientSound; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let volume = 0.4;

  function stop() {
    const ctx = audioContext();
    if (!current || !ctx) return;
    const { source, gain } = current;
    current = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE);
    source.stop(t + FADE + 0.05);
  }

  function play(kind: AmbientSound) {
    if (kind === 'off') return stop();
    if (current?.kind === kind) return;
    stop();
    unlockAudio();
    const ctx = audioContext();
    if (!ctx) return;
    let buf = buffers.get(kind);
    if (!buf) buffers.set(kind, (buf = makeBuffer(ctx, kind)));
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const { input, output } = chain(ctx, kind);
    source.connect(input);
    output.connect(gain).connect(ctx.destination);
    source.start();
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + FADE);
    current = { kind, source, gain };
  }

  return {
    play,
    stop,
    setVolume(v: number) {
      volume = v;
      const ctx = audioContext();
      if (current && ctx) current.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    playing: () => current?.kind ?? 'off',
  };
}

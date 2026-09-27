import type { Mode } from '../core/types';

export interface Theme {
  id: string;
  name: string;
  scheme: 'dark' | 'light';
  bg: string;
  bg2: string;
  blobs: [string, string, string];
  text: string;
  /** Text color on top of a mode-colored button. */
  onAccent: string;
  modes: Record<Mode, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'lofi-dusk',
    name: 'Lofi Dusk',
    scheme: 'dark',
    bg: '#1c1930',
    bg2: '#2d2144',
    blobs: ['#ff9a8b', '#8b6cf0', '#f6c177'],
    text: '#f5eeff',
    onAccent: '#1c1930',
    modes: { focus: '#ff8e7f', short: '#7dd3c0', long: '#a5b4fc' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    scheme: 'dark',
    bg: '#080d1c',
    bg2: '#111a36',
    blobs: ['#22d3ee', '#4f46e5', '#0ea5e9'],
    text: '#e2e8f0',
    onAccent: '#080d1c',
    modes: { focus: '#38bdf8', short: '#34d399', long: '#c4b5fd' },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    scheme: 'light',
    bg: '#eaf0e3',
    bg2: '#d6e4c9',
    blobs: ['#9bbf85', '#e9d9a6', '#b9d4a8'],
    text: '#22311f',
    onAccent: '#ffffff',
    modes: { focus: '#4f7d40', short: '#b86b3c', long: '#4d77a3' },
  },
  {
    id: 'paper',
    name: 'Paper',
    scheme: 'light',
    bg: '#f6f1e9',
    bg2: '#ece3d5',
    blobs: ['#e9d2b0', '#d5c4e3', '#f3c3b0'],
    text: '#2d2a26',
    onAccent: '#ffffff',
    modes: { focus: '#c2410c', short: '#0f766e', long: '#4338ca' },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    scheme: 'light',
    bg: '#fdf1f4',
    bg2: '#f9dde6',
    blobs: ['#f7a3c1', '#fbcfe8', '#fcd9c4'],
    text: '#4a2533',
    onAccent: '#ffffff',
    modes: { focus: '#d9466f', short: '#3f8f73', long: '#7658c9' },
  },
];

export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function applyTheme(id: string, accent: string | null): Theme {
  const theme = getTheme(id);
  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--bg': theme.bg,
    '--bg2': theme.bg2,
    '--blob1': theme.blobs[0],
    '--blob2': theme.blobs[1],
    '--blob3': theme.blobs[2],
    '--text': theme.text,
    '--on-accent': theme.onAccent,
    '--focus': accent ?? theme.modes.focus,
    '--short': theme.modes.short,
    '--long': theme.modes.long,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.scheme = theme.scheme;
  root.style.colorScheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
  return theme;
}

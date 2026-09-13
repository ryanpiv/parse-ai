export const VIBE_STORAGE_KEY = 'parse-analyzer-vibe'

export const VIBES = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'The current HUD: gold on near-black, uppercase Rajdhani, tight corners.',
    fontUi: 'IBM Plex Sans, sans-serif',
    fontDisplay: 'Rajdhani, sans-serif',
    fontMono: 'IBM Plex Mono, monospace',
    radius: 6,
    tracking: '0.08em',
    transform: 'uppercase' as const,
    colors: {
      bg: '#0a0c0f',
      bg2: '#111418',
      bg3: '#181d23',
      border: '#2a3340',
      text: '#e8edf2',
      muted: '#8a9bb0',
      dim: '#4a5a6a',
      accent: '#c9a227',
      accent2: '#e8be40',
      onAccent: '#0a0c0f',
      blue: '#5aadf0',
      red: '#d44040',
      green: '#40a060',
    },
  },
  {
    id: 'linen',
    name: 'Linen',
    blurb: 'Warm charcoal, terracotta, Outfit. Rounder and less like a game overlay.',
    fontUi: 'Outfit, IBM Plex Sans, sans-serif',
    fontDisplay: 'Outfit, sans-serif',
    fontMono: 'IBM Plex Mono, monospace',
    radius: 12,
    tracking: '0.01em',
    transform: 'none' as const,
    colors: {
      bg: '#161310',
      bg2: '#1f1b18',
      bg3: '#28221d',
      border: '#3f362e',
      text: '#f4ebe3',
      muted: '#b6a898',
      dim: '#7c6f64',
      accent: '#d4784a',
      accent2: '#e8a070',
      onAccent: '#1a120e',
      blue: '#8eb4c8',
      red: '#e07070',
      green: '#6aaa78',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    blurb: 'Cool product dark with a blue accent. Closer to Linear than Warcraft Logs.',
    fontUi: 'DM Sans, IBM Plex Sans, sans-serif',
    fontDisplay: 'DM Sans, sans-serif',
    fontMono: 'IBM Plex Mono, monospace',
    radius: 10,
    tracking: '0.01em',
    transform: 'none' as const,
    colors: {
      bg: '#0c0d10',
      bg2: '#13141a',
      bg3: '#1a1b24',
      border: '#2c2e3a',
      text: '#eceef4',
      muted: '#9aa3b5',
      dim: '#6b7384',
      accent: '#5b8def',
      accent2: '#8eb0ff',
      onAccent: '#0c0d10',
      blue: '#7eb8ff',
      red: '#e06a6a',
      green: '#5bb98a',
    },
  },
  {
    id: 'orchid',
    name: 'Orchid',
    blurb: 'Quiet black and soft violet. Same layout, calmer color.',
    fontUi: 'Outfit, IBM Plex Sans, sans-serif',
    fontDisplay: 'Outfit, sans-serif',
    fontMono: 'IBM Plex Mono, monospace',
    radius: 12,
    tracking: '0.02em',
    transform: 'none' as const,
    colors: {
      bg: '#0e0e12',
      bg2: '#16161c',
      bg3: '#1c1c26',
      border: '#2e2e3c',
      text: '#f0eef6',
      muted: '#a8a4b8',
      dim: '#6e6a7c',
      accent: '#a78bfa',
      accent2: '#c4b5fd',
      onAccent: '#120e18',
      blue: '#93c5fd',
      red: '#e07a8a',
      green: '#6aba9a',
    },
  },
  {
    id: 'harbor',
    name: 'Harbor',
    blurb: 'Blue-gray surfaces, teal accent. Soft dark, not gold HUD.',
    fontUi: 'DM Sans, IBM Plex Sans, sans-serif',
    fontDisplay: 'DM Sans, sans-serif',
    fontMono: 'IBM Plex Mono, monospace',
    radius: 10,
    tracking: '0.01em',
    transform: 'none' as const,
    colors: {
      bg: '#11161a',
      bg2: '#171d22',
      bg3: '#1e262c',
      border: '#2f3b44',
      text: '#e6eef2',
      muted: '#93a4b0',
      dim: '#5d6f7a',
      accent: '#3d9b8f',
      accent2: '#6ec4b4',
      onAccent: '#0e1614',
      blue: '#7eb6d4',
      red: '#d07070',
      green: '#5aaa88',
    },
  },
] as const

export type VibeId = (typeof VIBES)[number]['id']
export type VibeKit = (typeof VIBES)[number]

export function isVibeId(v: string): v is VibeId {
  return VIBES.some(x => x.id === v)
}

export function applyVibe(id: VibeId) {
  if (typeof document === 'undefined') return
  if (id === 'classic') document.documentElement.removeAttribute('data-vibe')
  else document.documentElement.setAttribute('data-vibe', id)
  try {
    localStorage.setItem(VIBE_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function readStoredVibe(): VibeId {
  if (typeof window === 'undefined') return 'classic'
  try {
    const stored = localStorage.getItem(VIBE_STORAGE_KEY) || 'classic'
    return isVibeId(stored) ? stored : 'classic'
  } catch {
    return 'classic'
  }
}

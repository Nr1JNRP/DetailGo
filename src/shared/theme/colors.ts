// DETAILGO - Sistema de cores centralizado
//
// Paletas:
//   colors      -> Theme Light legacy bridge
//   darkColors  -> Garage Dark
//   lightColors -> Theme Light

// 1. Theme Light legacy bridge
// Usada por componentes antigos que ainda importam `colors` diretamente.
export const colors = {
  primary: {
    main: '#23B5D3',
    light: '#D7F3F8',
    dark: '#071013',
  },
  secondary: {
    main: '#75ABBC',
    light: '#E8F2F5',
  },
  status: {
    success: '#2F8F6B',
    warning: '#B7791F',
    error: '#D94A3A',
    disabled: '#A2AEBB',
  },
  text: {
    primary: '#071013',
    secondary: '#42505B',
    tertiary: '#6E7E8B',
    disabled: '#A2AEBB',
    white: '#FFFFFF',
  },
  background: {
    main: '#DFE0E2',
    surface: '#EEF1F3',
    card: '#FFFFFF',
    drawer: '#071013',
  },
  border: {
    main: '#A2AEBB',
    focus: '#23B5D3',
    error: '#D94A3A',
    light: '#D8DDE2',
  },
  overlay: 'rgba(7,16,19,0.48)',
} as const;

export type ColorPalette = typeof colors;

// 2. Garage Dark
// Paleta do redesign escuro: escuro, neon amarelo-verde, acento laranja.
export const darkColors = {
  bg: '#0B0D0E',
  surface: '#121517',
  card: '#191D20',

  ink: '#F5F7F8',
  ink2: '#A8B0B4',
  ink3: '#6B7378',

  primary: '#D4FF3D',
  primaryDark: '#B6E300',
  primaryLight: 'rgba(212,255,61,0.12)',
  onPrimary: '#050708',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  borderFocus: 'rgba(212,255,61,0.45)',

  accent: '#FF5C39',

  status: {
    success: '#22C55E',
    error: '#FF5C39',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  overlay: 'rgba(0,0,0,0.65)',
} as const;

export type DarkColorPalette = typeof darkColors;
export type AppColors = {
  readonly [Key in keyof typeof darkColors]: Key extends 'status'
    ? { readonly [StatusKey in keyof typeof darkColors.status]: string }
    : string;
};

// 3. Theme Light
// Paleta base: #071013, #23B5D3, #75ABBC, #A2AEBB, #DFE0E2.
export const lightColors = {
  bg: '#DFE0E2',
  surface: '#EEF1F3',
  card: '#FFFFFF',

  ink: '#071013',
  ink2: '#42505B',
  ink3: '#6E7E8B',

  primary: '#23B5D3',
  primaryDark: '#148DA7',
  primaryLight: 'rgba(35,181,211,0.16)',
  onPrimary: '#071013',

  border: 'rgba(7,16,19,0.10)',
  borderStrong: 'rgba(7,16,19,0.18)',
  borderFocus: 'rgba(35,181,211,0.48)',

  accent: '#D94A3A',

  status: {
    success: '#2F8F6B',
    error: '#D94A3A',
    warning: '#B7791F',
    info: '#23B5D3',
  },

  overlay: 'rgba(7,16,19,0.38)',
} as const;

export type LightColorPalette = typeof lightColors;

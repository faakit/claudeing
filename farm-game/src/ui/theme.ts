export const C = {
  ink: 0x14101f,
  panel: 0x2a2238,
  panelLight: 0x3a3050,
  cream: 0xf4ead2,
  creamDim: 0xb9ae98,
  gold: 0xf4d35e,
  green: 0x7fc96b,
  red: 0xe0574a,
  blue: 0x6fa3e0,
  warn: 0xf2a65a,
  slot: 0x1d1830,
} as const;

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

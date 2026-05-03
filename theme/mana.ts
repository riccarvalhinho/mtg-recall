// Cores de mana MTG — MTG Recall
// Fonte de verdade: design/handoff.md § 1.3
//
// Usado pelo componente ManaPip (components/ManaPip.tsx)
// Cada cor tem estado normal e seleccionado (selected)

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export const manaColors: Record<ManaColor, {
  bg: string;
  border: string;
  text: string;
  bgSel: string;
  borderSel: string;
}> = {
  W: {
    bg:        '#F2EDD0',
    bgSel:     '#F2EDD0',
    border:    '#C8B870',
    borderSel: '#E0C840',
    text:      '#4A3A10',
  },
  U: {
    bg:        '#0E2A48',
    bgSel:     '#1A4A7A',
    border:    '#1E3A60',
    borderSel: '#2E6AAA',
    text:      '#C8DCF0',
  },
  B: {
    bg:        '#1A1020',
    bgSel:     '#2A1E2E',
    border:    '#3A2A48',
    borderSel: '#6A4A7A',
    text:      '#C0A8D0',
  },
  R: {
    bg:        '#3A100E',
    bgSel:     '#7A1E1A',
    border:    '#5A2018',
    borderSel: '#C03020',
    text:      '#F0C0A8',
  },
  G: {
    bg:        '#0E2A18',
    bgSel:     '#1A4A2A',
    border:    '#1A3A22',
    borderSel: '#2E7A3E',
    text:      '#A8D0B0',
  },
};

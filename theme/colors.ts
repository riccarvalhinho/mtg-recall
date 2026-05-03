// Paleta de cores — MTG Recall "Scholar's Archive"
// Fonte de verdade: design/handoff.md § 1.2
// Usar sempre estes tokens — nunca valores hardcoded nos écrans

export const colors = {
  // Fundos
  bg:        '#130F0A',  // fundo principal
  bgCard:    '#1E1812',  // cards, inputs, painéis
  bgCardHov: '#252019',  // pressed state de cards

  // Bordas
  border:    '#3A3020',  // bordas gerais

  // Acentos dourados
  gold:      '#C9A96E',  // accent principal — CTAs, estados activos
  goldDim:   '#8B7248',  // gold secundário — labels, ornamentos

  // Texto
  textPrim:  '#E8DCC8',  // texto principal
  textSec:   '#A8967A',  // texto secundário
  textDim:   '#6B5C3E',  // labels, placeholders, dim

  // Estados de resultado
  win:       '#5A8B5C',  // vitória
  winBg:     '#1A3020',
  winBorder: '#2E5A38',
  loss:      '#8B4A4A',  // derrota
  lossBg:    '#301A1A',
  lossBorder:'#5A2E2E',
  draw:      '#7A7060',  // empate
  drawBg:    '#252018',
  drawBorder:'#4A4030',

  // Tab bar
  tabBar:    '#16120D',  // fundo da tab bar
};

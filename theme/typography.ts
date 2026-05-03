// Tipografia — MTG Recall "Scholar's Archive"
// Fonte de verdade: design/handoff.md § 1.1
//
// Instalar:
//   npx expo install @expo-google-fonts/playfair-display @expo-google-fonts/eb-garamond expo-font
//
// Usar com useFonts() no root layout antes de renderizar.

export const fonts = {
  // Playfair Display — títulos, nomes de eventos, destaque
  display:     'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
  displayMed:  'PlayfairDisplay_500Medium',
  displayReg:  'PlayfairDisplay_400Regular',
  displayItal: 'PlayfairDisplay_400Italic',

  // EB Garamond — corpo, labels, listas, notas
  body:        'EBGaramond_400Regular',
  bodyItal:    'EBGaramond_400Italic',
  bodyMed:     'EBGaramond_500Medium',
};

// Tamanhos de referência (não exaustivo — ver handoff.md por écran)
export const fontSize = {
  h1:      30,  // títulos de écran (Playfair 700)
  h2:      22,  // títulos de secção (Playfair 700)
  h3:      18,  // subtítulos (Playfair 700)
  title:   15,  // nome de evento/adversário (Playfair 500)
  body:    15,  // texto corrido (EB Garamond)
  label:   11,  // labels uppercase (EB Garamond italic)
  caption: 10,  // captions, badges (EB Garamond)
  tiny:     9,  // info muito secundária
};

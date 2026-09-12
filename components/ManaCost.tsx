// ManaCost — um custo de mana desenhado com os símbolos, em vez de `{2}{G}{U}` em cru.
//
// Três níveis de recurso, por esta ordem:
//
//   1. O símbolo descarregado da Scryfall (assets/mana/costSymbols.ts). Cobre tudo — genéricos,
//      híbridos, Phyrexian, neve, incolor.
//   2. Os cinco WUBRG que já estavam no projecto (assets/mana/symbols.ts).
//   3. O texto entre parênteses do símbolo, numa bolha.
//
// O nível 3 existe para isto funcionar **antes** de alguém correr o workflow que descarrega os
// símbolos, e para o dia em que a Scryfall inventar um símbolo novo. Um custo em texto é feio;
// um custo em branco seria um erro.

import { View, Text, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { COST_SYMBOL_SVG } from '../assets/mana/costSymbols';
import { MANA_SVG } from '../assets/mana/symbols';
import { parseManaCost } from '../domain/manaCost';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { ManaColor } from '../types';

interface ManaCostProps {
  /** O custo como a Scryfall o escreve: `{2}{G}{U}`. Ausente ou vazio não desenha nada. */
  cost?: string;
  size?: number;
}

/** Os cinco de sempre, para o segundo nível de recurso. */
function isBaseColor(key: string): key is ManaColor {
  return key === 'W' || key === 'U' || key === 'B' || key === 'R' || key === 'G';
}

export function ManaCost({ cost, size = 14 }: ManaCostProps) {
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;

  return (
    <View style={styles.row}>
      {symbols.map((symbol, index) => {
        const svg = COST_SYMBOL_SVG[symbol.key] ?? (isBaseColor(symbol.key) ? MANA_SVG[symbol.key] : undefined);

        // A chave inclui o índice: `{B}{B}` são dois símbolos iguais e legítimos.
        const key = `${symbol.key}-${index}`;

        if (svg) return <SvgXml key={key} xml={svg} width={size} height={size} />;

        return (
          <View key={key} style={[styles.fallback, { minWidth: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.fallbackText, { fontSize: Math.max(size - 5, 8) }]}>{symbol.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fallback: {
    paddingHorizontal: 3,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { fontFamily: fonts.bodyMed, color: colors.textSec },
});

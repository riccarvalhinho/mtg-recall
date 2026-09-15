// RecordScore — o recorde de um registo, em números coloridos
//
// Existe porque três écrans desenham a mesma coisa em escalas diferentes: a lista de eventos e a
// grelha de decks (dentro do `RecordBadge`), a StatsBar do Event Detail e a do Deck Detail. Estava
// copiado à letra e em dois deles tinha ficado cinzento — a cor é metade da leitura, porque é ela
// que faz um 2–2 dizer "duas ganhas, duas perdidas" antes de alguém ler os números.
//
// Só desenha. Não faz contas nenhumas: quem chama já as tem feitas.

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface RecordScoreProps {
  wins: number;
  losses: number;
  draws?: number;
  /**
   * Quando desenhar o empate.
   *
   * `auto` (o omisso) só o desenha se houver algum: numa lista, `2 – 2 – 0` é um zero a ocupar
   * espaço para dizer que não aconteceu nada. `always` desenha-o sempre, e serve onde há uma
   * etiqueta por baixo a prometer três números — escrever `W – L – D` e mostrar dois era mentira.
   */
  showDraws?: 'auto' | 'always';
  /** A altura dos números. O separador sai daqui, para as proporções aguentarem qualquer escala. */
  size?: number;
}

export function RecordScore({ wins, losses, draws = 0, showDraws = 'auto', size = 20 }: RecordScoreProps) {
  const withDraws = showDraws === 'always' || draws > 0;

  // O separador é mais pequeno do que os números de propósito: é pontuação, não é informação.
  const sep = { ...styles.separator, fontSize: Math.round(size * 0.7) };
  const num = { ...styles.number, fontSize: size };

  return (
    <View style={styles.row}>
      <Text style={[num, { color: colors.win }]}>{wins}</Text>
      <Text style={sep}> – </Text>
      <Text style={[num, { color: colors.loss }]}>{losses}</Text>
      {withDraws && (
        <>
          <Text style={sep}> – </Text>
          {/* O empate em cinzento: aconteceu, conta para o win rate, mas não é nem boa nem má
              notícia — e a cor diz isso sem precisar de legenda. */}
          <Text style={[num, { color: colors.draw }]}>{draws}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Pela linha de base e não pelo centro: os números e o travessão têm alturas diferentes.
  row: { flexDirection: 'row', alignItems: 'baseline' },
  number: { fontFamily: fonts.display },
  separator: { fontFamily: fonts.body, color: colors.textDim },
});

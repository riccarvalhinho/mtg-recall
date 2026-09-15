/**
 * O selector de cores de três estados — um toque é cor principal, dois é splash, três limpa.
 *
 * A lógica dos três estados vive em `domain/manaSelection.ts` e é testada lá; isto é só o dedo em
 * cima dela. Existe como componente porque o mesmo bloco estava copiado à letra no registo de match
 * e no editor de deck, e o registo das cores de um evento (ADR 0013) ia ser a terceira cópia.
 *
 * O bloco inteiro é o componente — a etiqueta, o "clear" e a legenda —, e não só os cinco pips: era
 * tudo isso que estava duplicado, e uma etiqueta que cada écran desenhasse à sua maneira acabaria
 * com três aspectos diferentes para a mesma coisa.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { ManaPip } from './ManaPip';
import {
  MANA_ORDER,
  ManaStates,
  cycleManaState,
  emptyManaStates,
  hasAnyMana,
} from '../domain/manaSelection';

interface ManaSelectorProps {
  /** O que aparece por cima, em maiúsculas pequenas. Ex.: "Opponent colors". */
  label: string;
  states: ManaStates;
  onChange: (states: ManaStates) => void;
  /**
   * A legenda com as três regras. Vem ligada: quem toca nos pips pela primeira vez não tem como
   * adivinhar que o segundo toque faz splash.
   */
  showHint?: boolean;
}

export function ManaSelector({ label, states, onChange, showHint = true }: ManaSelectorProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hasAnyMana(states) && (
          <Pressable onPress={() => onChange(emptyManaStates())} hitSlop={12}>
            <Text style={styles.clearBtn}>clear</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.colorSelector}>
        {MANA_ORDER.map(color => {
          const state = states[color];
          return (
            <Pressable
              key={color}
              onPress={() => onChange(cycleManaState(states, color))}
              style={styles.colorPip}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${color}`}
            >
              <View style={{ opacity: state === 0 ? 0.3 : 1 }}>
                <ManaPip color={color} size={state === 2 ? 34 : 48} isSplash={state === 2} />
              </View>
              <Text
                style={[
                  styles.colorLabel,
                  state === 0 && { opacity: 0 },
                  state === 1 && { color: colors.gold },
                  state === 2 && { color: '#8B9CBB' },
                ]}
              >
                {state === 2 ? 'splash' : 'main'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showHint && (
        <Text style={styles.hint}>1 tap = main · 2 taps = splash · 3 taps = clear</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearBtn: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
  },
  colorSelector: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  colorPip: {
    alignItems: 'center',
    gap: 6,
    width: 52,
    minHeight: 64,
    justifyContent: 'center',
  },
  colorLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 9,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

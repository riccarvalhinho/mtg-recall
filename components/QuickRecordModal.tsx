/**
 * Quick record — o torneio inteiro numa folha, uma ronda por toque.
 *
 * Existe para os torneios antigos, de que se sabe o recorde e mais nada: sem decklist, sem
 * adversários, sem games. Ver `domain/quickRecord.ts` para o porquê de isto **gerar rondas** em vez
 * de gravar um "6-2" — e a lógica toda, que é testada lá.
 *
 * A folha guarda a **sequência** e não dois contadores, porque a ordem é de quem escreve. Quem se
 * lembra de ter perdido as duas últimas regista isso; quem não se lembra toca nas vitórias primeiro
 * e fica com o mesmo recorde. Nenhum dos dois tem de explicar à app qual é o caso.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { MAX_QUICK_ROUNDS, recordOf } from '../domain/quickRecord';
import type { MatchResult } from '../types';

/** O aspecto de cada resultado: a cor, o fundo e como se lê por extenso. */
const RESULTS: { value: MatchResult; label: string; color: string; bg: string; border: string }[] = [
  { value: 'W', label: 'Win',  color: colors.win,  bg: colors.winBg,  border: colors.winBorder },
  { value: 'L', label: 'Loss', color: colors.loss, bg: colors.lossBg, border: colors.lossBorder },
  { value: 'D', label: 'Draw', color: colors.draw, bg: colors.drawBg, border: colors.drawBorder },
];

interface QuickRecordModalProps {
  visible: boolean;
  /** O nome do torneio, para se ver a que folha se está a escrever. */
  eventName: string;
  /**
   * Quantas rondas já lá estão. O registo rápido acrescenta ao que existe, e é este número que faz
   * a primeira pastilha dizer R4 em vez de R1 quando já se registaram três à mão.
   */
  existingRounds: number;
  sequence: MatchResult[];
  onChange: (sequence: MatchResult[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function QuickRecordModal({
  visible,
  eventName,
  existingRounds,
  sequence,
  onChange,
  onConfirm,
  onCancel,
}: QuickRecordModalProps) {
  const record = recordOf(sequence);
  const full = sequence.length >= MAX_QUICK_ROUNDS;
  const empty = sequence.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Quick record</Text>
        <Text style={styles.subtitle}>{eventName}</Text>

        <Text style={styles.blurb}>
          Tap each round&apos;s result, in the order they happened. No opponents, no games — just the
          record. You can fill in the details later.
        </Text>

        {/* A sequência até agora. Vazia, fica a dizer o que falta fazer em vez de um espaço em branco. */}
        <View style={styles.sequenceBox}>
          {empty ? (
            <Text style={styles.sequenceEmpty}>No rounds yet</Text>
          ) : (
            <ScrollView
              horizontal={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sequenceRow}
              style={styles.sequenceScroll}
            >
              {sequence.map((result, index) => {
                const style = RESULTS.find(option => option.value === result)!;
                return (
                  <View
                    key={index}
                    style={[styles.chip, { backgroundColor: style.bg, borderColor: style.border }]}
                  >
                    <Text style={styles.chipRound}>R{existingRounds + index + 1}</Text>
                    <Text style={[styles.chipResult, { color: style.color }]}>{result}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* O recorde, na mesma leitura do resto da app: vitórias – derrotas, empates só se houver. */}
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>Record</Text>
          <Text style={styles.recordValue}>
            <Text style={{ color: colors.win }}>{record.wins}</Text>
            <Text style={styles.recordSep}> – </Text>
            <Text style={{ color: colors.loss }}>{record.losses}</Text>
            {record.draws > 0 && (
              <>
                <Text style={styles.recordSep}> – </Text>
                <Text style={{ color: colors.draw }}>{record.draws}</Text>
              </>
            )}
          </Text>
        </View>

        {/* Os três botões, e o apagar ao lado. */}
        <View style={styles.pad}>
          {RESULTS.map(option => (
            <Pressable
              key={option.value}
              disabled={full}
              onPress={() => onChange([...sequence, option.value])}
              accessibilityRole="button"
              accessibilityLabel={`Add a ${option.label.toLowerCase()}`}
              style={({ pressed }) => [
                styles.padBtn,
                { backgroundColor: option.bg, borderColor: option.border },
                pressed && { opacity: 0.7 },
                full && styles.padBtnOff,
              ]}
            >
              <Text style={[styles.padLetter, { color: option.color }]}>{option.value}</Text>
              <Text style={styles.padLabel}>{option.label}</Text>
            </Pressable>
          ))}

          <Pressable
            disabled={empty}
            onPress={() => onChange(sequence.slice(0, -1))}
            accessibilityRole="button"
            accessibilityLabel="Remove the last round"
            style={({ pressed }) => [
              styles.undoBtn,
              pressed && { opacity: 0.7 },
              empty && styles.padBtnOff,
            ]}
          >
            <Feather name="delete" size={18} color={colors.textSec} />
          </Pressable>
        </View>

        {full && (
          <Text style={styles.warning}>
            {MAX_QUICK_ROUNDS} rounds is as far as this goes — add the rest one by one.
          </Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && { opacity: 0.75 }]}
            onPress={onCancel}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>

          <Pressable
            disabled={empty}
            style={({ pressed }) => [
              styles.btn,
              styles.confirmBtn,
              pressed && { opacity: 0.75 },
              empty && styles.confirmBtnOff,
            ]}
            onPress={onConfirm}
          >
            <Text style={[styles.confirmLabel, empty && styles.confirmLabelOff]}>
              {empty
                ? 'Add rounds'
                : sequence.length === 1
                  ? 'Add 1 round'
                  : `Add ${sequence.length} rounds`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: '#1E1812',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.textPrim,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textSec,
    textAlign: 'center',
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 4,
  },

  sequenceBox: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 64,
    maxHeight: 132,
    justifyContent: 'center',
    padding: 10,
  },
  sequenceScroll: {
    flexGrow: 0,
  },
  sequenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sequenceEmpty: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  chipRound: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
  },
  chipResult: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
  },

  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recordLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recordValue: {
    fontFamily: fonts.display,
    fontSize: 22,
  },
  recordSep: {
    color: colors.textDim,
  },

  pad: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  padBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  padBtnOff: {
    opacity: 0.35,
  },
  padLetter: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
  },
  padLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSec,
  },
  undoBtn: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  warning: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  cancelLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSec,
  },
  confirmBtn: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '88',
  },
  confirmBtnOff: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  confirmLabel: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.gold,
  },
  confirmLabelOff: {
    color: colors.textDim,
  },
});

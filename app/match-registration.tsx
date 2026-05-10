// Match Registration Screen — modal
// Spec: design/handoff.md § 6
// Print: design/screen-match-registration.png

import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { ManaColor, MatchResult } from '../types';
import { useEventsStore } from '../store/useEventsStore';
import { ManaPip } from '../components/ManaPip';

const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

type ManaState = 0 | 1 | 2; // 0: off, 1: principal, 2: splash

// ─── Seletor de Resultado ─────────────────────────────────────────────────────

const RESULT_CONFIG: Record<MatchResult, { label: string; bg: string; border: string; color: string }> = {
  W: { label: 'Vitória',  bg: colors.winBg,  border: colors.winBorder,  color: colors.win  },
  L: { label: 'Derrota',  bg: colors.lossBg, border: colors.lossBorder, color: colors.loss },
  D: { label: 'Empate',   bg: colors.drawBg, border: colors.drawBorder, color: colors.draw },
};

function ResultSelector({ value, onChange }: {
  value: MatchResult | null;
  onChange: (r: MatchResult) => void;
}) {
  return (
    <View style={resultSel.row}>
      {(['W', 'L', 'D'] as MatchResult[]).map(r => {
        const cfg = RESULT_CONFIG[r];
        const active = value === r;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            style={({ pressed }) => [
              resultSel.btn,
              { backgroundColor: cfg.bg, borderColor: cfg.border },
              active && resultSel.btnActive,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={[resultSel.letter, { color: active ? cfg.color : cfg.color + '88' }]}>
              {r}
            </Text>
            <Text style={[resultSel.label, { color: active ? cfg.color : colors.textDim }]}>
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const resultSel = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 62,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnActive: {
    transform: [{ scale: 1.02 }],
  },
  letter: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchRegistrationScreen() {
  const { eventId, round, eventName } = useLocalSearchParams<{
    eventId: string;
    round: string;
    eventName: string;
  }>();

  const [opponent, setOpponent]   = useState('');
  const [result, setResult]       = useState<MatchResult | null>(null);
  const [colorStates, setColorStates] = useState<Record<ManaColor, ManaState>>({
    W: 0, U: 0, B: 0, R: 0, G: 0,
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const addMatch = useEventsStore(s => s.addMatch);

  const canSave = opponent.trim().length > 0 && result !== null && !saving;
  const roundNum = round ?? '1';

  // Cicla estado de cor: 0 → 1 → 2 → 0
  function cycleColor(color: ManaColor) {
    setColorStates(prev => ({
      ...prev,
      [color]: ((prev[color] + 1) % 3) as ManaState,
    }));
  }

  function clearColors() {
    setColorStates({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  }

  const hasAnyColor = Object.values(colorStates).some(s => s > 0);

  async function handleSave() {
    if (!canSave || !eventId) return;
    setSaving(true);

    const main   = MANA_ORDER.filter(c => colorStates[c] === 1);
    const splash = MANA_ORDER.filter(c => colorStates[c] === 2);

    await addMatch(eventId, {
      opponent:       opponent.trim(),
      opponentColors: { main, splash },
      result:         result!,
      notes:          notes.trim() || undefined,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 1000);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* NavBar */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancelBtn}>Cancelar</Text>
          </Pressable>

          <View style={styles.navCenter}>
            <Text style={styles.navTitle}>Novo Match</Text>
            <View style={styles.roundBadge}>
              <Text style={styles.roundBadgeText}>Ronda {roundNum}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            {opponent.trim().length > 0 && result !== null ? (
              <LinearGradient
                colors={[colors.gold, '#A07840']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveActive}
              >
                {saving
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.saveActiveText}>{saved ? '✓ Guardado' : 'Guardar'}</Text>
                }
              </LinearGradient>
            ) : (
              <View style={styles.saveInactive}>
                <Text style={styles.saveInactiveText}>Guardar</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nome do adversário */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nome do adversário</Text>
            <View style={[styles.inputContainer, opponent.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={opponent}
                onChangeText={setOpponent}
                placeholder="ex: João Ferreira"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Seletor de cores */}
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Cores do adversário</Text>
              {hasAnyColor && (
                <Pressable onPress={clearColors}>
                  <Text style={styles.clearBtn}>limpar</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.colorSelector}>
              {MANA_ORDER.map(color => {
                const state = colorStates[color];
                return (
                  <Pressable
                    key={color}
                    onPress={() => cycleColor(color)}
                    style={styles.colorPip}
                  >
                    <View style={{ opacity: state === 0 ? 0.3 : 1 }}>
                      <ManaPip
                        color={color}
                        size={state === 2 ? 34 : 48}
                        isSplash={state === 2}
                      />
                    </View>
                    <Text style={[
                      styles.colorLabel,
                      state === 0 && { opacity: 0 },
                      state === 1 && { color: colors.gold },
                      state === 2 && { color: '#8B9CBB' },
                    ]}>
                      {state === 1 ? 'principal' : state === 2 ? 'splash' : 'principal'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Hint */}
            <Text style={styles.colorHint}>
              1 tap = principal · 2 taps = splash · 3 taps = limpar
            </Text>
          </View>

          {/* Seletor de resultado */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Resultado</Text>
            <ResultSelector value={result} onChange={setResult} />
          </View>

          {/* Notas opcionais */}
          <View style={styles.field}>
            <Pressable
              style={styles.notesToggle}
              onPress={() => setNotesOpen(v => !v)}
            >
              <View style={[styles.notesToggleCircle, notesOpen && styles.notesToggleCircleActive]}>
                <Text style={styles.notesToggleIcon}>{notesOpen ? '−' : '+'}</Text>
              </View>
              <Text style={[styles.notesToggleText, notesOpen && { color: colors.textSec }]}>
                Notas opcionais
              </Text>
            </Pressable>

            {notesOpen && (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Cartas relevantes, notas da partida…"
                placeholderTextColor={colors.textDim}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // NavBar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSec,
  },
  navCenter: {
    alignItems: 'center',
    gap: 4,
  },
  navTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.textPrim,
  },
  roundBadge: {
    backgroundColor: colors.gold + '22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roundBadgeText: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.gold,
  },
  saveActive: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveActiveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.bg,
  },
  saveInactive: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveInactiveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.textDim,
  },

  // Content
  content: {
    padding: 20,
    gap: 24,
  },
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

  // Input adversário
  inputContainer: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputFilled: {
    borderColor: colors.gold + '66',
  },
  input: {
    fontFamily: fonts.displayMed,
    fontSize: 18,
    color: colors.textPrim,
  },

  // Seletor de cores
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
  colorHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Notas
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesToggleCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesToggleCircleActive: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '66',
  },
  notesToggleIcon: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
  notesToggleText: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
  },
  notesInput: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrim,
    lineHeight: 22,
    minHeight: 90,
  },
});

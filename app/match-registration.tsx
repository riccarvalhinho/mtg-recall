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
import { Game, GameResult, ManaColor, ManaSelection, MatchResult } from '../types';
import { useEventsStore } from '../store/useEventsStore';
import { ManaPip } from '../components/ManaPip';
import {
  MAX_GAMES,
  addGame,
  cycleGameWentFirst,
  matchWentFirst,
  removeGame,
  resultFromGames,
  setGameResult,
} from '../domain/match';

const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

type ManaState = 0 | 1 | 2; // 0: off, 1: principal, 2: splash

// ─── Seletor de Resultado ─────────────────────────────────────────────────────

const RESULT_CONFIG: Record<MatchResult, { label: string; bg: string; border: string; color: string }> = {
  W: { label: 'Win',  bg: colors.winBg,  border: colors.winBorder,  color: colors.win  },
  L: { label: 'Loss', bg: colors.lossBg, border: colors.lossBorder, color: colors.loss },
  D: { label: 'Draw', bg: colors.drawBg, border: colors.drawBorder, color: colors.draw },
};

function ResultSelector({ value, onChange, derived }: {
  value: MatchResult | null;
  onChange: (r: MatchResult) => void;
  /** Com games registados o resultado vem deles e deixa de se poder escolher à mão. */
  derived?: boolean;
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
            disabled={derived}
            style={({ pressed }) => [
              resultSel.btn,
              { backgroundColor: cfg.bg, borderColor: cfg.border },
              active && resultSel.btnActive,
              derived && !active && resultSel.btnMuted,
              pressed && !derived && { transform: [{ scale: 0.95 }] },
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
  btnMuted: {
    opacity: 0.35,
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

// ─── Play / Draw ──────────────────────────────────────────────────────────────

/**
 * Quem jogou primeiro. Três estados, não dois: "não registei" não é o mesmo que "joguei segundo",
 * e gravar `false` por omissão seria inventar um dado que ninguém introduziu. Tocar no que já está
 * activo limpa-o.
 */
function PlayDrawToggle({ value, onChange }: {
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
}) {
  const options: { label: string; state: boolean }[] = [
    { label: 'On the play', state: true },
    { label: 'On the draw', state: false },
  ];

  return (
    <View style={playDraw.row}>
      {options.map(option => {
        const active = value === option.state;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(active ? undefined : option.state)}
            style={({ pressed }) => [
              playDraw.btn,
              active && playDraw.btnActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[playDraw.label, active && playDraw.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const playDraw = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '88',
  },
  label: { fontFamily: fonts.body, fontSize: 14, color: colors.textDim },
  labelActive: { color: colors.gold },
});

// ─── Games ────────────────────────────────────────────────────────────────────

/**
 * Registo game a game. Opcional — entre rondas o que se quer é um toque no resultado e seguir.
 *
 * Quando há games o resultado do match deixa de ser escolhido e passa a ser derivado deles. É o que
 * garante que a app nunca escreve um ficheiro que o `npm run validate` vai chumbar.
 */
function GamesSection({ games, onChange }: {
  games: Game[];
  onChange: (next: Game[]) => void;
}) {
  return (
    <View style={gamesSel.list}>
      {games.map(game => (
        <View key={game.number} style={gamesSel.row}>
          <Text style={gamesSel.number}>G{game.number}</Text>

          <View style={gamesSel.resultPair}>
            {(['W', 'L'] as GameResult[]).map(option => {
              const active = game.result === option;
              const cfg = RESULT_CONFIG[option];
              return (
                <Pressable
                  key={option}
                  onPress={() => onChange(setGameResult(games, game.number, option))}
                  style={({ pressed }) => [
                    gamesSel.resultBtn,
                    active && { backgroundColor: cfg.bg, borderColor: cfg.border },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[gamesSel.resultText, { color: active ? cfg.color : colors.textDim }]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onChange(cycleGameWentFirst(games, game.number))}
            style={({ pressed }) => [gamesSel.playBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={[gamesSel.playText, game.wentFirst !== undefined && { color: colors.gold }]}>
              {game.wentFirst === undefined ? 'play?' : game.wentFirst ? 'play' : 'draw'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onChange(removeGame(games, game.number))}
            style={({ pressed }) => [gamesSel.removeBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={gamesSel.removeText}>×</Text>
          </Pressable>
        </View>
      ))}

      {games.length < MAX_GAMES && (
        <View style={gamesSel.addRow}>
          {(['W', 'L'] as GameResult[]).map(option => (
            <Pressable
              key={option}
              onPress={() => onChange(addGame(games, option))}
              style={({ pressed }) => [gamesSel.addBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={gamesSel.addText}>
                + Game {games.length + 1} {option === 'W' ? 'won' : 'lost'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const gamesSel = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: {
    fontFamily: fonts.displayMed,
    fontSize: 14,
    color: colors.textSec,
    width: 26,
  },
  resultPair: { flexDirection: 'row', gap: 6 },
  resultBtn: {
    width: 46,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { fontFamily: fonts.displaySemi, fontSize: 16 },
  playBtn: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    textTransform: 'lowercase',
  },
  removeBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontFamily: fonts.body, fontSize: 22, color: colors.textDim },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  addBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec },
});

/** As cores de um match já gravado, de volta aos três estados por pip do selector. */
function colorStatesFrom(selection: ManaSelection | undefined): Record<ManaColor, ManaState> {
  const base: Record<ManaColor, ManaState> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!selection) return base;
  for (const color of selection.main) base[color] = 1;
  for (const color of selection.splash) base[color] = 2;
  return base;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchRegistrationScreen() {
  const { eventId, round, eventName, mode } = useLocalSearchParams<{
    eventId: string;
    round: string;
    eventName: string;
    /** 'edit' corrige a ronda indicada; sem isto, regista uma nova. */
    mode?: string;
  }>();

  const isEdit = mode === 'edit';
  const roundNum = Number(round ?? '1');

  // Em edição, o match que se vai corrigir. O estado abaixo arranca a partir dele.
  const existing = useEventsStore(s =>
    isEdit
      ? s.events.find(e => e.id === eventId)?.matches.find(m => m.round === roundNum)
      : undefined,
  );

  const [opponent, setOpponent]   = useState(existing?.opponent ?? '');
  const [result, setResult]       = useState<MatchResult | null>(existing?.result ?? null);
  const [colorStates, setColorStates] = useState<Record<ManaColor, ManaState>>(
    colorStatesFrom(existing?.opponentColors),
  );
  const [games, setGames]         = useState<Game[]>(existing?.games ?? []);
  const [gamesOpen, setGamesOpen] = useState((existing?.games?.length ?? 0) > 0);
  const [wentFirst, setWentFirst] = useState<boolean | undefined>(existing?.wentFirst);
  const [notesOpen, setNotesOpen] = useState((existing?.notes ?? '').length > 0);
  const [notes, setNotes]         = useState(existing?.notes ?? '');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const addMatch    = useEventsStore(s => s.addMatch);
  const updateMatch = useEventsStore(s => s.updateMatch);

  // Com games registados, o resultado vem deles — nunca do que estivesse escolhido à mão.
  const derivedResult = resultFromGames(games);
  const effectiveResult = derivedResult ?? result;

  const canSave = opponent.trim().length > 0 && effectiveResult !== null && !saving;

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
    if (!canSave || !eventId || effectiveResult === null) return;
    setSaving(true);

    const main   = MANA_ORDER.filter(c => colorStates[c] === 1);
    const splash = MANA_ORDER.filter(c => colorStates[c] === 2);

    const payload = {
      opponent:       opponent.trim(),
      opponentColors: { main, splash },
      result:         effectiveResult,
      // Com games, quem jogou primeiro no match é quem jogou primeiro no game 1 — dois sítios a
      // dizerem coisas diferentes sobre o mesmo facto era um bug à espera de acontecer.
      wentFirst:      matchWentFirst(games, wentFirst),
      games:          games.length > 0 ? games : undefined,
      notes:          notes.trim() || undefined,
    };

    if (isEdit) await updateMatch(eventId, roundNum, payload);
    else await addMatch(eventId, payload);

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
            <Text style={styles.cancelBtn}>Cancel</Text>
          </Pressable>

          <View style={styles.navCenter}>
            <Text style={styles.navTitle}>{isEdit ? 'Edit Match' : 'New Match'}</Text>
            <View style={styles.roundBadge}>
              <Text style={styles.roundBadgeText}>Round {roundNum}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            {opponent.trim().length > 0 && effectiveResult !== null ? (
              <LinearGradient
                colors={[colors.gold, '#A07840']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveActive}
              >
                {saving
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.saveActiveText}>{saved ? '✓ Saved' : 'Save'}</Text>
                }
              </LinearGradient>
            ) : (
              <View style={styles.saveInactive}>
                <Text style={styles.saveInactiveText}>Save</Text>
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
            <Text style={styles.fieldLabel}>Opponent name</Text>
            <View style={[styles.inputContainer, opponent.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={opponent}
                onChangeText={setOpponent}
                placeholder="e.g. John Smith"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Seletor de cores */}
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Opponent colors</Text>
              {hasAnyColor && (
                <Pressable onPress={clearColors}>
                  <Text style={styles.clearBtn}>clear</Text>
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
                      {state === 1 ? 'main' : state === 2 ? 'splash' : 'main'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Hint */}
            <Text style={styles.colorHint}>
              1 tap = main · 2 taps = splash · 3 taps = clear
            </Text>
          </View>

          {/* Seletor de resultado */}
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Result</Text>
              {derivedResult !== null && (
                <Text style={styles.derivedHint}>from games</Text>
              )}
            </View>
            <ResultSelector
              value={effectiveResult}
              onChange={setResult}
              derived={derivedResult !== null}
            />
          </View>

          {/* Quem jogou primeiro — só quando não há games, senão o game 1 é que manda */}
          {games.length === 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Who played first</Text>
              <PlayDrawToggle value={wentFirst} onChange={setWentFirst} />
            </View>
          )}

          {/* Registo game a game, opcional */}
          <View style={styles.field}>
            <Pressable
              style={styles.notesToggle}
              onPress={() => setGamesOpen(v => !v)}
            >
              <View style={[styles.notesToggleCircle, gamesOpen && styles.notesToggleCircleActive]}>
                <Text style={styles.notesToggleIcon}>{gamesOpen ? '−' : '+'}</Text>
              </View>
              <Text style={[styles.notesToggleText, gamesOpen && { color: colors.textSec }]}>
                Game by game{games.length > 0 ? ` · ${games.filter(g => g.result === 'W').length}-${games.filter(g => g.result === 'L').length}` : ''}
              </Text>
            </Pressable>

            {gamesOpen && (
              <View style={{ marginTop: 12 }}>
                <GamesSection games={games} onChange={setGames} />
                <Text style={styles.colorHint}>
                  The match result follows the games. Tap play/draw to record who started each one.
                </Text>
              </View>
            )}
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
                Optional notes
              </Text>
            </Pressable>

            {notesOpen && (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Relevant cards, match notes…"
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
  derivedHint: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.gold,
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

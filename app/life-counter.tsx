// Life Counter — modal
// Spec: design/life-counter-canvas/ (Main, AGameEnd, Options, Exit) + ADR 0011
//
// A disposição é a "mesa partilhada": o telemóvel fica entre os dois, cada metade é de um deles, a
// do adversário virada ao contrário. Com dois jogadores não há segunda disposição a escolher — esta
// usa o telemóvel inteiro, e por isso não há selector de orientação nenhum (ADR 0011).

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { GameResult } from '../types';
import {
  STARTING_LIFE_OPTIONS,
  adjust,
  canFinishGame,
  finishGame,
  newSession,
  proposedResult,
  restorable,
  sessionKey,
  sessionScore,
  toGames,
  undoLastGame,
  type LifeSession,
  type LifeSide,
} from '../domain/lifeCounter';
import { createHoldRepeat, type HoldRepeat } from '../domain/holdRepeat';
import { readStartingLife, writeStartingLife } from '../services/preferences';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../services/lifeSession';
import { useLifeStore } from '../store/useLifeStore';

/** Abaixo disto o número muda de cor. Não é regra do jogo — é o aviso que já se dava a si próprio. */
const LOW_LIFE = 5;

/** Quanto tempo a bolha do "−3" fica à vista depois do último toque. */
const DELTA_LINGER = 1600;

function lifeColor(value: number): string {
  if (value <= 0) return colors.loss;
  if (value <= LOW_LIFE) return '#B06A5A';
  return colors.textPrim;
}

// ─── Metade de um jogador ─────────────────────────────────────────────────────

/**
 * Um lado da mesa.
 *
 * As duas zonas de toque ocupam a metade inteira, não um botão pequeno: conta-se vida de pé, com o
 * telemóvel na mesa e a atenção nas cartas, e um alvo de 195×390 acerta-se sem olhar. O número fica
 * por cima sem receber toques (`pointerEvents: none`), senão o meio do painel seria um buraco morto
 * precisamente onde o dedo cai.
 */
function PlayerHalf({ label, life, delta, height, flipped, onChange }: {
  label: string;
  life: number;
  delta: number;
  height: number;
  /** A metade do adversário está virada para ele. */
  flipped?: boolean;
  onChange: (by: number) => void;
}) {
  return (
    <View style={[
      half.panel,
      { height, backgroundColor: flipped ? '#1A150F' : colors.bgCard },
      flipped && half.flipped,
    ]}>
      <HoldZone side="left" height={height} onChange={onChange} by={-1} />
      <HoldZone side="right" height={height} onChange={onChange} by={1} />

      <View style={half.center} pointerEvents="none">
        <Text style={half.label}>{label}</Text>
        <View style={half.numberRow}>
          <Text style={[half.number, { color: lifeColor(life) }]}>{life}</Text>
          {delta !== 0 && (
            <View style={half.delta}>
              <Text style={half.deltaText}>{delta > 0 ? `+${delta}` : String(delta)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Metade de uma metade: toca-se para um, mantém-se para muitos.
 *
 * O manter existe porque um ataque de 12 não se conta com doze toques. Não muda nada no desenho —
 * é a mesma zona —, e quem não souber que existe continua a tocar uma vez de cada vez.
 *
 * A máquina de estados da repetição vive em `domain/holdRepeat.ts` e tem testes. Esteve aqui, e
 * tinha um erro que só aparecia a tocar depressa: dois `onPressIn` seguidos deixavam um
 * temporizador sem dono, a descontar vida sozinho e sem forma de o parar.
 */
function HoldZone({ side, height, by, onChange }: {
  side: 'left' | 'right';
  height: number;
  by: number;
  onChange: (by: number) => void;
}) {
  // O repetidor cria-se uma vez e dura o que a zona durar. O que ele chama é lido de uma ref, para
  // um redesenho a meio de um toque não o deixar preso a uma versão antiga da função.
  const tick = useRef<() => void>(() => {});
  tick.current = () => onChange(by);

  const hold = useRef<HoldRepeat | null>(null);
  if (hold.current === null) hold.current = createHoldRepeat(() => tick.current());

  // Sair do écran com o dedo ainda em baixo — o modal a fechar-se, uma chamada a entrar — não pode
  // deixar o contador a andar sozinho.
  useEffect(() => () => hold.current?.release(), []);

  return (
    <Pressable
      onPressIn={() => hold.current?.press()}
      onPressOut={() => hold.current?.release()}
      style={[half.zone, { height }, side === 'left' ? half.zoneLeft : half.zoneRight]}
    >
      <Text style={half.glyph}>{by > 0 ? '+' : '−'}</Text>
    </Pressable>
  );
}

const half = StyleSheet.create({
  panel: {
    position: 'relative',
    overflow: 'hidden',
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  zone: {
    position: 'absolute',
    top: 0,
    width: '50%',
    justifyContent: 'center',
  },
  zoneLeft: { left: 0, alignItems: 'flex-start', paddingLeft: 44 },
  zoneRight: { right: 0, alignItems: 'flex-end', paddingRight: 44 },
  glyph: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: 'rgba(168,150,122,0.40)',
    includeFontPadding: false,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.goldDim,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  number: {
    fontFamily: fonts.display,
    fontSize: 150,
    lineHeight: 158,
    includeFontPadding: false,
  },
  delta: {
    marginLeft: 10,
    marginTop: 26,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: colors.gold + '24',
    borderWidth: 1,
    borderColor: colors.gold + '73',
  },
  deltaText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.gold,
  },
});

// ─── A costura ────────────────────────────────────────────────────────────────

/** A única cromagem do écran: onde se recomeça, onde se vê a ronda, e por onde se sai. */
function Seam({ title, subtitle, onReset, onOptions, onDone }: {
  title: string;
  subtitle?: string;
  onReset: () => void;
  onOptions: () => void;
  onDone: () => void;
}) {
  return (
    <View style={seam.bar}>
      <Pressable onPress={onReset} hitSlop={6} style={({ pressed }) => [seam.icon, pressed && { opacity: 0.6 }]}>
        <Feather name="rotate-ccw" size={18} color={colors.textDim} />
      </Pressable>

      <Pressable onPress={onOptions} style={seam.center}>
        {subtitle && <Text style={seam.subtitle} numberOfLines={1}>{subtitle}</Text>}
        <View style={seam.pill}>
          <Text style={seam.pillText}>{title}</Text>
        </View>
      </Pressable>

      <Pressable onPress={onDone} style={({ pressed }) => [seam.done, pressed && { opacity: 0.85 }]}>
        <Text style={seam.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const seam = StyleSheet.create({
  bar: {
    height: 64,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    maxWidth: 200,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.gold + '21',
    borderWidth: 1,
    borderColor: colors.gold + '6B',
  },
  pillText: {
    fontFamily: fonts.displaySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.gold,
  },
  done: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.bg,
  },
});

// ─── A faixa do fim de game ───────────────────────────────────────────────────

/**
 * A costura cresce quando alguém chega a zero.
 *
 * Aparece sozinha, porque a essa altura já se sabe o que aconteceu e escrever outra vez seria
 * trabalho a troco de nada. "Keep counting" existe para o engano: tirou-se vida a mais, a faixa
 * apareceu, e não se quer fechar game nenhum.
 */
function GameEndBand({ result, life, gameNumber, canContinue, onKeepCounting, onNextGame, onFinish }: {
  result: GameResult;
  life: { me: number; opponent: number };
  gameNumber: number;
  canContinue: boolean;
  onKeepCounting: () => void;
  onNextGame: () => void;
  onFinish: () => void;
}) {
  const won = result === 'W';
  return (
    <View style={[band.bar, { borderColor: (won ? colors.winBorder : colors.lossBorder) + 'CC' }]}>
      <View style={band.headline}>
        <Text style={band.game}>Game {gameNumber}</Text>
        <Text style={[band.verdict, { color: won ? colors.win : colors.loss }]}>
          {won ? 'Won' : 'Lost'}
        </Text>
        <View style={band.score}>
          <Text style={band.scoreMine}>{life.me}</Text>
          <Text style={band.scoreSep}>–</Text>
          <Text style={[band.scoreTheirs, { color: colors.goldDim }]}>{life.opponent}</Text>
          <Text style={band.scoreNote}>saved with the round</Text>
        </View>
      </View>

      <View style={band.actions}>
        <Pressable onPress={onKeepCounting} style={({ pressed }) => [band.ghost, pressed && { opacity: 0.7 }]}>
          <Text style={band.ghostText}>Keep counting</Text>
        </Pressable>

        {canContinue && (
          <Pressable onPress={onNextGame} style={({ pressed }) => [band.primary, pressed && { opacity: 0.85 }]}>
            <Text style={band.primaryText}>Game {gameNumber + 1}</Text>
            <Feather name="chevron-right" size={15} color={colors.bg} />
          </Pressable>
        )}

        <Pressable onPress={onFinish} style={({ pressed }) => [band.ghost, pressed && { opacity: 0.7 }]}>
          <Text style={band.ghostText}>Finish</Text>
        </Pressable>
      </View>
    </View>
  );
}

const band = StyleSheet.create({
  bar: {
    height: 244,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  headline: { alignItems: 'center', gap: 4 },
  game: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  verdict: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreMine: { fontFamily: fonts.displaySemi, fontSize: 19, color: colors.textPrim },
  scoreSep: { fontFamily: fonts.body, fontSize: 15, color: colors.textDim },
  scoreTheirs: { fontFamily: fonts.displaySemi, fontSize: 19 },
  scoreNote: { fontFamily: fonts.bodyItal, fontSize: 12, color: colors.textDim, marginLeft: 4 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  ghost: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSec },
  primary: {
    flex: 1.2,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.bg },
});

// ─── Opções ───────────────────────────────────────────────────────────────────

/**
 * A gaveta que não está entre ninguém e o jogo.
 *
 * O contador abre logo numa partida — a esmagadora maioria delas é 2 jogadores a 20 — e as opções
 * ficam a um toque na ronda. A escolha é lembrada, portanto um mês de Commander escolhe 40 uma vez.
 */
function OptionsSheet({ startingLife, onPick, onClose }: {
  startingLife: number;
  onPick: (life: number) => void;
  onClose: () => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, sheet.scrim]} onPress={onClose} />

      <View style={sheet.drawer}>
        <View style={sheet.grabber} />
        <Text style={sheet.title}>Game options</Text>

        <View style={sheet.field}>
          <Text style={sheet.label}>Starting life</Text>
          <View style={sheet.chips}>
            {STARTING_LIFE_OPTIONS.map(life => {
              const active = life === startingLife;
              return (
                <Pressable
                  key={life}
                  onPress={() => onPick(life)}
                  style={({ pressed }) => [sheet.chip, active && sheet.chipActive, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[sheet.chipText, active && sheet.chipTextActive]}>{life}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={sheet.hint}>
            Changing this starts a new game. Games already finished keep the life they ended on.
          </Text>
        </View>

        <Text style={sheet.footer}>
          Remembered for next time. Two players split the screen head to head — that layout uses the
          whole phone, so there is nothing else to pick.
        </Text>
      </View>
    </View>
  );
}

const sheet = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(10,8,5,0.74)' },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderColor: colors.gold + '66',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 18,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrim },
  field: { gap: 10 },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.gold + '26', borderColor: colors.gold },
  chipText: { fontFamily: fonts.displayMed, fontSize: 16, color: colors.textSec },
  chipTextActive: { fontFamily: fonts.displaySemi, color: colors.gold },
  hint: { fontFamily: fonts.bodyItal, fontSize: 11, color: colors.textDim },
  footer: { fontFamily: fonts.bodyItal, fontSize: 11, color: colors.textDim, textAlign: 'center' },
});

// ─── O resumo, à saída ────────────────────────────────────────────────────────

/**
 * O que o contador está prestes a entregar ao registo.
 *
 * Existe para não haver surpresas: o resultado sai dos games, como já saía, e vê-se antes de o
 * formulário o mostrar. Numa partida casual não há registo nenhum — e o écran diz isso em vez de
 * fingir um botão que não leva a lado nenhum (ADR 0011).
 */
function Summary({ session, casual, onBack, onContinue, onCloseGame, onDiscardGame }: {
  session: LifeSession;
  casual: boolean;
  onBack: () => void;
  onContinue: () => void;
  onCloseGame: (result: GameResult) => void;
  onDiscardGame: () => void;
}) {
  const { wins, losses } = sessionScore(session);
  const games = toGames(session);
  const result = wins > losses ? 'W' : losses > wins ? 'L' : games.length > 0 ? 'D' : null;

  // Um game a decorrer não se deita fora em silêncio. Concede-se o game 1 a toda a hora, e nesse
  // ninguém chegou a zero — sem isto, o jogo mais comum de todos não tinha como ser fechado.
  const started = session.current.me !== session.startingLife || session.current.opponent !== session.startingLife;
  const openGame = started && canFinishGame(session);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={summary.navBar}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={summary.back}>Back</Text>
        </Pressable>
        <Text style={summary.navTitle}>Match summary</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={summary.content} showsVerticalScrollIndicator={false}>
        {result !== null ? (
          <View style={summary.verdict}>
            <Text style={summary.verdictLabel}>
              {games.length} {games.length === 1 ? 'game' : 'games'}
            </Text>
            <View style={summary.scoreRow}>
              <Text style={[summary.scoreBig, { color: colors.win }]}>{wins}</Text>
              <Text style={summary.scoreDash}>–</Text>
              <Text style={[summary.scoreBig, { color: colors.loss }]}>{losses}</Text>
            </View>
            <View style={[
              summary.resultBadge,
              {
                backgroundColor: result === 'W' ? colors.winBg : result === 'L' ? colors.lossBg : colors.drawBg,
                borderColor: result === 'W' ? colors.winBorder : result === 'L' ? colors.lossBorder : colors.drawBorder,
              },
            ]}>
              <Text style={[
                summary.resultText,
                { color: result === 'W' ? colors.win : result === 'L' ? colors.loss : colors.draw },
              ]}>
                {result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={summary.empty}>No games finished yet.</Text>
        )}

        {games.length > 0 && (
          <View style={summary.list}>
            <Text style={summary.sectionLabel}>Games</Text>
            {games.map(game => (
              <View
                key={game.number}
                style={[
                  summary.row,
                  { borderLeftColor: game.result === 'W' ? colors.winBorder : colors.lossBorder },
                ]}
              >
                <Text style={summary.rowNumber}>G{game.number}</Text>
                <Text style={[
                  summary.rowResult,
                  { color: game.result === 'W' ? colors.win : colors.loss },
                ]}>
                  {game.result === 'W' ? 'Won' : 'Lost'}
                </Text>
                <View style={summary.rowLife}>
                  <Text style={summary.rowLifeMine}>{game.life?.me}</Text>
                  <Text style={summary.rowLifeSep}>–</Text>
                  <Text style={summary.rowLifeTheirs}>{game.life?.opponent}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {openGame && (
          <View style={summary.open}>
            <Text style={summary.sectionLabel}>Game {games.length + 1}, still open</Text>
            <View style={summary.openRow}>
              <View style={summary.rowLife}>
                <Text style={summary.rowLifeMine}>{session.current.me}</Text>
                <Text style={summary.rowLifeSep}>–</Text>
                <Text style={summary.rowLifeTheirs}>{session.current.opponent}</Text>
              </View>
            </View>
            <View style={summary.openActions}>
              <Pressable
                onPress={() => onCloseGame('W')}
                style={({ pressed }) => [summary.openBtn, summary.openWin, pressed && { opacity: 0.8 }]}
              >
                <Text style={[summary.openBtnText, { color: colors.win }]}>I won it</Text>
              </Pressable>
              <Pressable
                onPress={() => onCloseGame('L')}
                style={({ pressed }) => [summary.openBtn, summary.openLoss, pressed && { opacity: 0.8 }]}
              >
                <Text style={[summary.openBtnText, { color: colors.loss }]}>I lost it</Text>
              </Pressable>
              <Pressable
                onPress={onDiscardGame}
                style={({ pressed }) => [summary.openBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={[summary.openBtnText, { color: colors.textDim }]}>Drop</Text>
              </Pressable>
            </View>
            <Text style={summary.note}>
              Conceded, or won without anyone hitting zero? Close it here — the life it is on now is
              what gets saved.
            </Text>
          </View>
        )}

        <View style={summary.info}>
          <Feather name="info" size={15} color={colors.goldDim} style={{ marginTop: 2 }} />
          <Text style={summary.infoText}>
            {casual
              ? 'Nothing is saved from a casual game. This counter only hands games over when it was opened for a round.'
              : 'The result comes from the games, as it already does. The life each game ended on is saved with it — nothing else about the counting is kept.'}
          </Text>
        </View>
      </ScrollView>

      <View style={summary.footer}>
        <Pressable
          onPress={onContinue}
          disabled={!casual && games.length === 0}
          style={({ pressed }) => [
            summary.cta,
            !casual && games.length === 0 && summary.ctaOff,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={[
            summary.ctaText,
            !casual && games.length === 0 && { color: colors.textDim },
          ]}>
            {casual ? 'Done' : 'Continue to registration'}
          </Text>
          {!casual && games.length > 0 && <Feather name="chevron-right" size={15} color={colors.bg} />}
        </Pressable>
        <Pressable onPress={onBack} style={({ pressed }) => [summary.secondary, pressed && { opacity: 0.7 }]}>
          <Text style={summary.secondaryText}>Back to the counter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const summary = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontFamily: fonts.body, fontSize: 16, color: colors.textSec },
  navTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrim },
  content: { padding: 20, gap: 22 },
  verdict: { alignItems: 'center', gap: 4 },
  verdictLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  scoreBig: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60 },
  scoreDash: { fontFamily: fonts.display, fontSize: 34, color: colors.textDim },
  resultBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  resultText: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  empty: { fontFamily: fonts.bodyItal, fontSize: 14, color: colors.textDim, textAlign: 'center' },
  list: { gap: 8 },
  sectionLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 2,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  rowNumber: { fontFamily: fonts.displayMed, fontSize: 14, color: colors.textSec, width: 26 },
  rowResult: { fontFamily: fonts.displaySemi, fontSize: 15, width: 46 },
  rowLife: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 7 },
  rowLifeMine: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.textPrim },
  rowLifeSep: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  rowLifeTheirs: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.goldDim },
  open: { gap: 8 },
  openRow: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.gold + '47',
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  openActions: { flexDirection: 'row', gap: 8 },
  openBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openWin: { backgroundColor: colors.winBg, borderColor: colors.winBorder },
  openLoss: { backgroundColor: colors.lossBg, borderColor: colors.lossBorder },
  openBtnText: { fontFamily: fonts.body, fontSize: 14 },
  note: { fontFamily: fonts.bodyItal, fontSize: 11, color: colors.textDim, lineHeight: 16 },
  info: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.tabBar,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  infoText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSec },
  footer: { padding: 20, paddingTop: 0, gap: 10 },
  cta: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  ctaText: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.bg },
  secondary: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSec },
});

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function LifeCounterScreen() {
  const { eventId, round, eventName, returnTo } = useLocalSearchParams<{
    eventId?: string;
    round?: string;
    eventName?: string;
    /** 'form' quando o contador foi aberto de dentro do registo — aí, sair é voltar atrás. */
    returnTo?: string;
  }>();

  const roundNum = round ? Number(round) : undefined;
  const key = sessionKey(eventId, roundNum);
  const casual = key === null;

  const handOff = useLifeStore(s => s.handOff);

  const [session, setSession] = useState<LifeSession | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [keepCounting, setKeepCounting] = useState(false);
  const [delta, setDelta] = useState({ me: 0, opponent: 0 });

  // Uma ronda inteira sem tocar no ecrã e o Android apagava-o a meio de um combate.
  useKeepAwake();

  // A partida a meio volta — mas só para a ronda de onde saiu (ver `restorable`).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, startingLife] = await Promise.all([readStoredSession(), readStartingLife()]);
      if (!alive) return;
      setSession(restorable(stored, key) ?? newSession(startingLife));
    })();
    return () => { alive = false; };
  }, [key]);

  // Gravar com atraso: vinte toques seguidos são vinte escritas, e o que interessa é o estado em
  // que o dedo parou.
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => { void writeStoredSession(key, session); }, 400);
    return () => clearTimeout(timer);
  }, [session, key]);

  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (deltaTimer.current) clearTimeout(deltaTimer.current); }, []);

  function change(side: LifeSide, by: number) {
    setSession(current => (current ? adjust(current, side, by) : current));
    setDelta(current => ({ ...current, [side]: current[side] + by }));
    setKeepCounting(false);

    if (deltaTimer.current) clearTimeout(deltaTimer.current);
    deltaTimer.current = setTimeout(() => setDelta({ me: 0, opponent: 0 }), DELTA_LINGER);
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.gold} />
      </SafeAreaView>
    );
  }

  function closeGame(result: GameResult, thenSummary: boolean) {
    const next = finishGame(session!, result);
    setSession(next);
    setDelta({ me: 0, opponent: 0 });
    setKeepCounting(false);
    if (thenSummary) setShowSummary(true);
  }

  async function leave() {
    const games = toGames(session!);
    await clearStoredSession();

    if (casual || games.length === 0) {
      router.back();
      return;
    }

    handOff(games);

    // Aberto de dentro do registo, sair é voltar lá — um `replace` deixaria dois formulários
    // empilhados. Aberto da Home ou do evento, é o registo que se abre a seguir.
    if (returnTo === 'form') router.back();
    else router.replace({ pathname: '/match-registration', params: { eventId, round, eventName } });
  }

  if (showSummary) {
    return (
      <Summary
        session={session}
        casual={casual}
        onBack={() => setShowSummary(false)}
        onContinue={() => { void leave(); }}
        onCloseGame={result => closeGame(result, false)}
        onDiscardGame={() => {
          // Larga só o game a decorrer. Os que já fecharam aconteceram e ficam — deitar fora a
          // ronda inteira por se querer descartar o jogo em curso seria um estrago, não uma opção.
          setSession({
            ...session,
            current: { me: session.startingLife, opponent: session.startingLife },
          });
        }}
      />
    );
  }

  const proposed = keepCounting ? null : proposedResult(session);
  const gameNumber = session.finished.length + 1;
  const { wins, losses } = sessionScore(session);
  const panelHeight = proposed ? 300 : 390;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.table}>
        <PlayerHalf
          label="Opponent"
          life={session.current.opponent}
          delta={delta.opponent}
          height={panelHeight}
          flipped
          onChange={by => change('opponent', by)}
        />

        {proposed ? (
          <GameEndBand
            result={proposed}
            life={session.current}
            gameNumber={gameNumber}
            canContinue={canFinishGame(finishGame(session, proposed))}
            onKeepCounting={() => setKeepCounting(true)}
            onNextGame={() => closeGame(proposed, false)}
            onFinish={() => closeGame(proposed, true)}
          />
        ) : (
          <Seam
            title={`${roundNum ? `ROUND ${roundNum} · ` : ''}GAME ${gameNumber}${
              session.finished.length > 0 ? ` · ${wins}-${losses}` : ''
            }`}
            subtitle={eventName}
            onReset={() => {
              setSession(newSession(session.startingLife));
              setDelta({ me: 0, opponent: 0 });
            }}
            onOptions={() => setShowOptions(true)}
            onDone={() => setShowSummary(true)}
          />
        )}

        <PlayerHalf
          label="You"
          life={session.current.me}
          delta={delta.me}
          height={panelHeight}
          onChange={by => change('me', by)}
        />
      </View>

      {showOptions && (
        <OptionsSheet
          startingLife={session.startingLife}
          onPick={life => {
            // Os games fechados ficam como estão: a vida deles é o que aconteceu, e mudar a vida
            // inicial a meio não pode reescrever o passado. O que recomeça é o game a decorrer.
            setSession({ ...session, startingLife: life, current: { me: life, opponent: life } });
            setDelta({ me: 0, opponent: 0 });
            void writeStartingLife(life);
            setShowOptions(false);
          }}
          onClose={() => setShowOptions(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { alignItems: 'center', justifyContent: 'center' },
  table: { flex: 1, justifyContent: 'center' },
});

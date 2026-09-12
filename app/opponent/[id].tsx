// Opponent Detail Screen — Fase 5
//
// O que um adversário responde: quantas vezes o enfrentei, como ficou o registo, e onde é que cada
// encontro aconteceu. Antes disto o histórico vivia expandido dentro da lista das Stats, que é um
// écran de resumo — cabia lá o "quem", não o "o quê".
//
// As contas estão todas em `domain/opponents.ts` e têm testes. Aqui só se desenha.

import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';
import { formatDate } from '../../domain/dates';
import {
  MIN_HIGHLIGHT_ENCOUNTERS,
  favouriteMatchup,
  headToHead,
  nemesis,
  opponentRecord,
} from '../../domain/opponents';
import type { MatchResult } from '../../types';

// ─── Pedaços ──────────────────────────────────────────────────────────────────

const RESULT_STYLES: Record<MatchResult, { bg: string; border: string; text: string }> = {
  W: { bg: colors.winBg, border: colors.winBorder, text: colors.win },
  L: { bg: colors.lossBg, border: colors.lossBorder, text: colors.loss },
  D: { bg: colors.drawBg, border: colors.drawBorder, text: colors.draw },
};

/**
 * A etiqueta de nemesis ou de melhor matchup, quando é esta a pessoa.
 *
 * Existe para o écran responder à pergunta que trouxe cá o dedo — porque é que este nome aparecia
 * em destaque nas Stats.
 */
function HighlightTag({ label, tone }: { label: string; tone: 'win' | 'loss' }) {
  const accent = tone === 'win' ? colors.win : colors.loss;
  const background = tone === 'win' ? colors.winBg : colors.lossBg;
  const borderColor = tone === 'win' ? colors.winBorder : colors.lossBorder;

  return (
    <View style={[styles.tag, { backgroundColor: background, borderColor }]}>
      <Text style={[styles.tagText, { color: accent }]}>{label}</Text>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function OpponentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const events = useEventsStore(s => s.events);
  const opponents = useEventsStore(s => s.opponents);

  // A taxonomia manda no nome (`rankOpponents` faz o mesmo): o match guarda o nome como estava no
  // dia em que foi registado, e renomear uma pessoa não reescreve os eventos antigos.
  const known = opponents.find(o => o.id === id);

  const record = useMemo(() => opponentRecord(id ?? '', events), [id, events]);
  const history = useMemo(() => headToHead(id ?? '', events), [id, events]);

  const worst = useMemo(() => nemesis(opponents, events), [opponents, events]);
  const best = useMemo(() => favouriteMatchup(opponents, events), [opponents, events]);

  // Sem taxonomia e sem encontros não há nada para mostrar: ou a referência ficou para trás, ou o
  // link veio de um sítio onde o adversário já não existe. Dizê-lo é melhor do que um écran de zeros.
  if (!known && record.played === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={24} color={colors.textSec} />
          </Pressable>
        </View>
        <View style={styles.missing}>
          <Text style={styles.missingText}>This opponent no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = known?.name || record.name || 'Unknown opponent';
  const isNemesis = worst?.opponentId === record.opponentId;
  const isFavourite = best?.opponentId === record.opponentId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.textSec} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.archiveLabel}>opponent</Text>
          <Text style={styles.name}>{name}</Text>

          {(isNemesis || isFavourite) && (
            <View style={styles.tags}>
              {isNemesis && <HighlightTag label="NEMESIS" tone="loss" />}
              {isFavourite && <HighlightTag label="BEST MATCHUP" tone="win" />}
            </View>
          )}

          {record.lastPlayed && (
            <Text style={styles.lastPlayed}>Last played {formatDate(record.lastPlayed)}</Text>
          )}

          {/* Um adversário fora da taxonomia continua a ter história: mostra-se, com o aviso. */}
          {!known && (
            <Text style={styles.lastPlayed}>
              Not in your opponents list anymore — name taken from the matches.
            </Text>
          )}
        </View>

        {/* Registo */}
        <View style={stats.bar}>
          <View style={stats.cell}>
            <Text style={stats.record}>
              {record.wins} – {record.losses} – {record.draws}
            </Text>
            <Text style={stats.label}>W – L – D</Text>
          </View>
          <View style={stats.divider} />
          <View style={stats.cell}>
            <Text style={stats.big}>{record.winRate}%</Text>
            <Text style={stats.label}>Win Rate</Text>
          </View>
          <View style={stats.divider} />
          <View style={stats.cell}>
            <Text style={stats.big}>{record.events}</Text>
            <Text style={stats.label}>Events</Text>
          </View>
        </View>

        {/* Porque é que o win rate ainda não quer dizer grande coisa */}
        {record.played > 0 && record.played < MIN_HIGHLIGHT_ENCOUNTERS && (
          <Text style={styles.hint}>
            {record.played === 1 ? 'One match so far' : `${record.played} matches so far`} — a win
            rate starts meaning something at {MIN_HIGHLIGHT_ENCOUNTERS}.
          </Text>
        )}

        {/* Histórico, do encontro mais recente para o mais antigo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {record.played === 1 ? '1 match' : `${record.played} matches`}
          </Text>

          {history.length === 0 ? (
            <Text style={styles.hint}>
              No matches against this player yet.
            </Text>
          ) : (
            history.map(({ event, match }) => {
              const rs = RESULT_STYLES[match.result];
              return (
                <Pressable
                  key={`${event.id}-${match.round}`}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
                  style={({ pressed }) => [row.card, pressed && { backgroundColor: colors.bgCardHov }]}
                >
                  {/* Pill de resultado */}
                  <View style={[row.pill, { backgroundColor: rs.bg, borderColor: rs.border }]}>
                    <Text style={[row.pillText, { color: rs.text }]}>{match.result}</Text>
                  </View>

                  <View style={row.info}>
                    <Text style={row.event} numberOfLines={1}>{event.name}</Text>
                    <Text style={row.meta} numberOfLines={1}>
                      Round {match.round} · {formatDate(event.date)}
                    </Text>
                  </View>

                  {/* As cores que ele jogou nesse dia — não as de agora: ficam guardadas no match */}
                  <View style={row.pips}>
                    {match.opponentColors.main.map(c => (
                      <ManaPip key={`main-${c}`} color={c} size={17} />
                    ))}
                    {match.opponentColors.splash.map(c => (
                      <ManaPip key={`splash-${c}`} color={c} size={17} isSplash />
                    ))}
                  </View>

                  <Feather name="chevron-right" size={13} color={colors.textDim} />
                </Pressable>
              );
            })
          )}
        </View>

        {known?.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{known.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: { paddingBottom: 48 },
  header: { paddingHorizontal: 20, gap: 6, marginBottom: 20 },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
  },
  name: { fontFamily: fonts.display, fontSize: 27, color: colors.textPrim, lineHeight: 34 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 2 },
  tag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: { fontFamily: fonts.bodyItal, fontSize: 10, letterSpacing: 0.8 },
  lastPlayed: { fontFamily: fonts.bodyItal, fontSize: 13, color: colors.textSec },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    lineHeight: 21,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  section: { paddingHorizontal: 20, marginBottom: 26 },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
    marginBottom: 12,
  },
  notes: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec, lineHeight: 23 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec },
});

const stats = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 24,
  },
  cell: { flex: 1, alignItems: 'center', gap: 3 },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
  record: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrim },
  big: { fontFamily: fonts.display, fontSize: 22, color: colors.gold },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
});

const row = StyleSheet.create({
  card: {
    // 44 px de alvo de toque mínimo, com folga: a app usa-se de pé numa loja
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 6,
  },
  pill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.displaySemi, fontSize: 14 },
  info: { flex: 1, gap: 2 },
  event: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.textPrim },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  pips: { flexDirection: 'row', gap: 4 },
});

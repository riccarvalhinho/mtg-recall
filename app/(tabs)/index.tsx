// Home Screen — MTG Recall
// Spec: design/handoff.md § 3
// Print de referência: design/screen-home.png
//
// Estado actual: empty state (primeiro uso)
// TODO: adicionar variante "com dados" (StatsBlock + EventoActivo + EventosRecentes)

import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { fonts, fontSize } from '../../theme/typography';
import { ManaPip } from '../../components/ManaPip';
import { ManaColor } from '../../types';

// ─── Ornamento central ────────────────────────────────────────────────────────
// Pentágono com um pip de mana em cada vértice (WUBRG, sentido horário desde topo)
// Linhas de ligação entre todos os vértices + anel exterior dashed + ponto central

const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

function calcPentagonVertices(cx: number, cy: number, radius: number) {
  return MANA_ORDER.map((color, i) => {
    const angle = (-90 + i * 72) * (Math.PI / 180);
    return {
      color,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function ScholarOrnament({ size = 140 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const pipSize = Math.round(size * 0.20);   // tamanho de cada ManaPip
  const pipRadius = size * 0.365;             // raio do círculo de posicionamento dos pips

  const vertices = calcPentagonVertices(cx, cy, pipRadius);

  // Todas as combinações de pares para as linhas de ligação
  const lines: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      lines.push([i, j]);
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      {/* SVG — anéis, linhas de ligação, ponto central */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {/* Anel exterior dashed */}
        <Circle
          cx={cx} cy={cy}
          r={pipRadius + pipSize * 0.6}
          fill="none"
          stroke={colors.gold}
          strokeWidth={0.8}
          strokeOpacity={0.18}
          strokeDasharray="3,5"
        />
        {/* Anel interior sólido */}
        <Circle
          cx={cx} cy={cy}
          r={pipRadius - pipSize * 0.7}
          fill="none"
          stroke={colors.goldDim}
          strokeWidth={0.6}
          strokeOpacity={0.25}
        />
        {/* Linhas de ligação entre vértices (pentáculo) */}
        {lines.map(([i, j]) => (
          <Line
            key={`${i}-${j}`}
            x1={vertices[i].x} y1={vertices[i].y}
            x2={vertices[j].x} y2={vertices[j].y}
            stroke={colors.goldDim}
            strokeWidth={0.6}
            strokeOpacity={0.22}
          />
        ))}
        {/* Círculo central */}
        <Circle
          cx={cx} cy={cy} r={6}
          fill={colors.gold}
          fillOpacity={0.18}
          stroke={colors.gold}
          strokeWidth={1}
          strokeOpacity={0.45}
        />
        {/* Ponto central */}
        <Circle
          cx={cx} cy={cy} r={2.5}
          fill={colors.gold}
          fillOpacity={0.65}
        />
      </Svg>

      {/* ManaPips posicionados sobre cada vértice */}
      {vertices.map(v => (
        <View
          key={v.color}
          style={{
            position: 'absolute',
            left: v.x - pipSize / 2,
            top: v.y - pipSize / 2,
          }}
        >
          <ManaPip color={v.color} size={pipSize} />
        </View>
      ))}
    </View>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  // TODO: substituir por dados reais do Supabase
  const hasEvents = false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.archiveLabel}>Scholar's Archive</Text>
          <Text style={styles.headerTitle}>Home</Text>
        </View>
        {/* Botão "Novo Evento" só aparece quando há dados */}
        {hasEvents && (
          <Pressable style={styles.newEventBtn}>
            <Text style={styles.newEventBtnText}>+ Novo Evento</Text>
          </Pressable>
        )}
      </View>

      {/* Empty State */}
      {!hasEvents && (
        <View style={styles.emptyState}>
          <ScholarOrnament size={148} />

          <Text style={styles.emptyTitle}>Bem-vindo ao Scholar's Archive</Text>
          <Text style={styles.emptySubtitle}>
            Regista o teu primeiro torneio e começa a construir o teu arquivo de vitórias.
          </Text>

          {/* Flavour text */}
          <View style={styles.flavourCard}>
            <Text style={styles.flavourQuote}>
              "Knowledge is the greatest spell ever cast."
            </Text>
            <Text style={styles.flavourSource}>— Scholar's Archive</Text>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            onPress={() => { /* TODO: navegar para Add Event */ }}
          >
            <LinearGradient
              colors={[colors.gold, '#A07840']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>+ Registar primeiro evento</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h1,
    color: colors.textPrim,
    lineHeight: 34,
  },
  newEventBtn: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 4,
  },
  newEventBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    color: colors.bg,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
    gap: 20,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    color: colors.textPrim,
    textAlign: 'center',
    lineHeight: 30,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -4,
  },

  // Flavour text card
  flavourCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  flavourQuote: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 20,
  },
  flavourSource: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // CTA Button
  ctaButton: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 240,
  },
  ctaText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.bg,
    letterSpacing: 0.3,
  },
});

// Deck Scan — encher uma decklist a partir de fotografias (ADR 0009)
//
// Fluxo, e a ordem é a decisão: primeiro **explica-se a montagem**, depois fotografa-se, e no fim
// confirma-se. O aviso não é decoração — a fiabilidade disto depende de as cartas de baixo irem
// tapadas, e ninguém adivinha isso sozinho.
//
// A unidade é a **porção**, não a fotografia nem a carta: um Limited cabe numa foto (22 ou 23
// cartas fora os terrenos), um Commander fotografa-se em três ou quatro porções. Uma porção que
// saiu mal deita-se fora e o resto mantém-se — por isso as porções ficam guardadas já lidas, e
// repetir uma não obriga a reprocessar as outras.
//
// Nada é gravado aqui. A lista aprovada vai para o editor de deck, que é quem grava.

import { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import {
  catalogueFrom,
  mergeBatches,
  type OcrDecklist,
} from '../domain/ocrDecklist';
import { isAvailable, readDeckPhoto } from '../services/ocr';
import { resolveCardNames } from '../services/scryfall';
import { completeFromCatalogue } from '../domain/cards';
import { useEventsStore } from '../store/useEventsStore';
import { useScanStore } from '../store/useScanStore';
import type { DeckCard } from '../types';

type Step = 'briefing' | 'camera' | 'review';

export default function DeckScanScreen() {
  const decks = useEventsStore(s => s.decks);
  const collection = useEventsStore(s => s.collection);
  const handOff = useScanStore(s => s.handOff);

  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>('briefing');
  const [batches, setBatches] = useState<OcrDecklist[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Os nomes que a app já conhece. Não é o catálogo do Magic inteiro e não precisa de ser: um deck
  // é quase todo feito de cartas que já passaram por aqui, e o que faltar escreve-se à mão.
  const catalogue = useMemo(
    () => catalogueFrom(
      decks.flatMap(deck => (deck.cards ?? []).map(card => card.name)),
      collection.map(card => card.name),
    ),
    [decks, collection],
  );

  const merged = useMemo(() => mergeBatches(batches), [batches]);
  const total = merged.cards.reduce((sum, card) => sum + card.quantity, 0);

  async function shoot() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('The camera returned no image.');

      // A imagem é lida e esquecida: não é guardada nem commitada (ADR 0009).
      const batch = await readDeckPhoto(photo.uri, catalogue);
      setBatches(current => [...current, batch]);
      setStep('review');
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Completa os nomes lidos com os dados a sério e entrega a lista ao editor.
   *
   * Sem isto o deck entra com nomes e mais nada: sem tipo não há agrupamento, sem custo não há
   * curva de mana e sem arte não há imagem — o deck fica registado e não se pode analisar.
   *
   * Falhar não impede nada: sem rede as cartas entram com o nome, como sempre foi, e completam-se
   * depois pelo botão do editor.
   */
  async function confirm() {
    const read: DeckCard[] = merged.cards.map(card => ({
      name: card.name,
      quantity: card.quantity,
    }));

    setMatching(true);
    // Uma carta lida de uma fotografia não traz colecção nenhuma: só há o nome para perguntar.
    const { found, message } = await resolveCardNames(read.map(card => ({ name: card.name })));
    setMatching(false);

    if (message) setNotice(message);

    handOff(completeFromCatalogue(read, found));
    router.back();
  }

  // ─── O módulo nativo pode não estar neste APK ──────────────────────────────

  if (!isAvailable()) {
    return (
      <Screen title="Scan deck">
        <View style={styles.notice}>
          <Feather name="alert-circle" size={18} color={colors.gold} />
          <Text style={styles.noticeText}>
            Text recognition is native code and is not in this build. Generate a new APK from the
            Actions tab and install it — your data stays as it is.
          </Text>
        </View>
      </Screen>
    );
  }

  // ─── Permissão da câmara ───────────────────────────────────────────────────

  if (!permission) {
    return <Screen title="Scan deck"><ActivityIndicator color={colors.gold} /></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen title="Scan deck">
        <Text style={styles.paragraph}>
          Reading a decklist needs the camera. The photo is processed on the phone and never saved
          or uploaded.
        </Text>
        <Pressable onPress={requestPermission} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
      </Screen>
    );
  }

  // ─── Briefing — a montagem da mesa ─────────────────────────────────────────

  if (step === 'briefing') {
    return (
      <Screen title="Scan deck">
        <Text style={styles.heading}>Lay the cards out first</Text>

        <View style={styles.steps}>
          <Step number={1} text="Spread the cards in columns, overlapping, with every title bar visible." />
          <Step number={2} text="Cover the rest of each card with a sleeve or another card's back — the only text in the photo should be card names." />
          <Step number={3} text="Shoot one portion at a time. 20 to 30 cards per photo reads best." />
        </View>

        <Text style={styles.footnote}>
          Rules text contains card names, so anything left showing can turn into cards you do not
          have. Basic lands are not photographed — add them with the counters in the deck editor.
        </Text>

        <Pressable onPress={() => setStep('camera')} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.primaryText}>I'm ready</Text>
        </Pressable>
      </Screen>
    );
  }

  // ─── Câmara ────────────────────────────────────────────────────────────────

  if (step === 'camera') {
    return (
      <View style={styles.cameraWrap}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />

        <SafeAreaView style={styles.cameraUi} edges={['top', 'bottom']}>
          <View style={styles.cameraTop}>
            <Pressable onPress={() => setStep(batches.length > 0 ? 'review' : 'briefing')} hitSlop={12}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.cameraHint}>
              {batches.length === 0 ? 'Portion 1' : `Portion ${batches.length + 1}`}
            </Text>
          </View>

          {error && <Text style={styles.cameraError}>{error}</Text>}

          <View style={styles.cameraBottom}>
            <Pressable onPress={shoot} disabled={busy} style={styles.shutter}>
              {busy
                ? <ActivityIndicator color={colors.bg} />
                : <View style={styles.shutterCore} />}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Confirmação ───────────────────────────────────────────────────────────

  return (
    <Screen title="Scan deck" scroll>
      <View style={styles.summaryRow}>
        <Text style={styles.heading}>{total} card{total === 1 ? '' : 's'}</Text>
        <Text style={styles.summaryMeta}>
          {batches.length} portion{batches.length === 1 ? '' : 's'}
        </Text>
      </View>

      {merged.crossBatch.length > 0 && (
        <View style={styles.notice}>
          <Feather name="alert-circle" size={16} color={colors.gold} />
          <Text style={styles.noticeText}>
            {merged.crossBatch.join(', ')} turned up in more than one portion. Either you have
            several copies, or the portions overlapped — check the count before adding.
          </Text>
        </View>
      )}

      <View style={styles.list}>
        {merged.cards.map(card => (
          <View key={card.name} style={styles.row}>
            <Text style={styles.quantity}>{card.quantity}</Text>
            <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
            {merged.crossBatch.includes(card.name) && (
              <Feather name="alert-circle" size={13} color={colors.gold} />
            )}
            {card.source === 'read' ? (
              <Text style={styles.corrected}>as read</Text>
            ) : !card.exact ? (
              <Text style={styles.corrected}>corrected</Text>
            ) : null}
          </View>
        ))}
      </View>

      {merged.cards.some(card => card.source === 'read') && (
        <Text style={styles.footnote}>
          “As read” means the name came straight from the photo — the app had never seen that card
          before, which is normal for a new deck. Check the spelling in the deck editor.
        </Text>
      )}

      {merged.unmatched.length > 0 && (
        <View style={styles.unmatched}>
          <Text style={styles.unmatchedLabel}>Left out</Text>
          <Text style={styles.unmatchedText}>{merged.unmatched.join(' · ')}</Text>
          <Text style={styles.footnote}>
            Too short to be a card name — usually a piece of a mana cost. Shown so nothing is
            dropped in silence; add anything real by name in the deck editor.
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setStep('camera')}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
        >
          <Feather name="camera" size={15} color={colors.gold} />
          <Text style={styles.secondaryText}>Another portion</Text>
        </Pressable>

        {batches.length > 0 && (
          <Pressable
            onPress={() => setBatches(current => current.slice(0, -1))}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          >
            <Feather name="rotate-ccw" size={15} color={colors.textSec} />
            <Text style={[styles.secondaryText, { color: colors.textSec }]}>Drop last portion</Text>
          </Pressable>
        )}
      </View>

      {notice && <Text style={styles.footnote}>{notice}</Text>}

      <Pressable
        onPress={() => void confirm()}
        disabled={merged.cards.length === 0 || matching}
        style={({ pressed }) => [
          styles.primary,
          (merged.cards.length === 0 || matching) && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.primaryText}>
          {matching ? 'Matching cards…' : 'Add to deck'}
        </Text>
      </Pressable>
    </Screen>
  );
}

// ─── Moldura comum ────────────────────────────────────────────────────────────

function Screen({ title, children, scroll }: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const Body = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.textSec} />
        </Pressable>
        <Text style={styles.navTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Body contentContainerStyle={scroll ? styles.content : undefined} style={scroll ? undefined : styles.content}>
        {children}
      </Body>
    </SafeAreaView>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{number}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  navTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.textPrim },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },

  heading: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrim },
  paragraph: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec, lineHeight: 22 },
  footnote: { fontFamily: fonts.bodyItal, fontSize: 12, color: colors.textDim, lineHeight: 18 },

  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    fontFamily: fonts.displayMed,
    fontSize: 13,
    color: colors.gold,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.goldDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrim, lineHeight: 22 },

  primary: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.bg },

  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { fontFamily: fonts.body, fontSize: 14, color: colors.gold },

  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSec, lineHeight: 19 },

  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },

  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  quantity: {
    fontFamily: fonts.displayMed,
    fontSize: 14,
    color: colors.gold,
    minWidth: 22,
    textAlign: 'right',
  },
  cardName: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrim },
  corrected: { fontFamily: fonts.bodyItal, fontSize: 11, color: colors.textDim },

  unmatched: { gap: 6 },
  unmatchedLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  unmatchedText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSec, lineHeight: 20 },

  cameraWrap: { flex: 1, backgroundColor: '#000' },
  cameraUi: { flex: 1, justifyContent: 'space-between' },
  cameraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cameraHint: { fontFamily: fonts.body, fontSize: 15, color: '#fff' },
  cameraError: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    marginHorizontal: 20,
    borderRadius: 8,
  },
  cameraBottom: { alignItems: 'center', paddingBottom: 24 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});

// CardSearchModal — procurar uma carta na Scryfall e escolhê-la
//
// Não está preso ao deck de propósito: devolve uma `PickedCard` e quem chama decide o que fazer com
// ela. A colecção há-de usar o mesmo componente.
//
// Regra que manda aqui: **escrever o nome à mão nunca deixa de funcionar**. Sem rede, sem cache, ou
// com a Scryfall em baixo, continua a dar para acrescentar a carta — o schema só exige nome e
// quantidade. Numa loja sem sinal é a diferença entre a app servir e não servir.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { searchCards, type CardSearchResult } from '../services/scryfall';
import {
  isSearchableQuery,
  isValidCardName,
  toManualCard,
  type PickedCard,
  type ScryfallCard,
} from '../domain/cards';

/** Espera antes de ir à rede, para não disparar um pedido por tecla. */
const DEBOUNCE_MS = 350;

interface CardSearchModalProps {
  visible: boolean;
  onPick: (card: PickedCard) => void;
  onClose: () => void;
  title?: string;
}

export function CardSearchModal({ visible, onPick, onClose, title = 'Add card' }: CardSearchModalProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CardSearchResult>({ cards: [], source: 'none' });
  const [searching, setSearching] = useState(false);

  // Identifica a procura em curso: uma resposta lenta de uma procura antiga não pode escrever por
  // cima de uma mais recente.
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) return;

    if (!isSearchableQuery(query)) {
      setResult({ cards: [], source: 'none' });
      setSearching(false);
      return;
    }

    const id = ++requestId.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      const found = await searchCards(query);
      if (requestId.current !== id) return;
      setResult(found);
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, visible]);

  /** Limpa ao fechar, para a procura anterior não estar lá na próxima abertura. */
  function close() {
    setQuery('');
    setResult({ cards: [], source: 'none' });
    onClose();
  }

  function pick(card: PickedCard) {
    setQuery('');
    setResult({ cards: [], source: 'none' });
    onPick(card);
  }

  const manual = toManualCard(query);
  const canAddManually = manual !== null && isValidCardName(query);

  // Só vale a pena oferecer a escrita à mão quando não há um resultado exactamente com esse nome.
  const exactMatch = result.cards.some(
    card => card.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Feather name="x" size={20} color={colors.textSec} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.textDim} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Card name"
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.gold} />}
          </View>

          {result.message && <Text style={styles.notice}>{result.message}</Text>}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {result.cards.map(card => (
              <CardRow key={card.scryfallId} card={card} onPress={() => pick(card)} />
            ))}

            {/* A saída que nunca falha. */}
            {canAddManually && !exactMatch && (
              <Pressable
                onPress={() => pick(manual)}
                style={({ pressed }) => [styles.manualRow, pressed && { opacity: 0.7 }]}
              >
                <Feather name="edit-3" size={15} color={colors.gold} />
                <Text style={styles.manualText}>
                  Add “{query.trim()}” by name
                </Text>
              </Pressable>
            )}

            {!searching && isSearchableQuery(query) && result.cards.length === 0 && !result.message && (
              <Text style={styles.empty}>No card found.</Text>
            )}

            {!isSearchableQuery(query) && (
              <Text style={styles.empty}>Type at least two letters.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CardRow({ card, onPress }: { card: ScryfallCard; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[card.typeLine, card.setCode?.toUpperCase()].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {card.manaCost ? <Text style={styles.cost}>{card.manaCost}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    height: '85%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrim },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.textPrim },
  notice: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textSec,
    marginTop: 10,
    lineHeight: 18,
  },
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  cardName: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrim },
  cardMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  cost: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 2,
  },
  manualText: { fontFamily: fonts.body, fontSize: 15, color: colors.gold },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 28,
  },
});

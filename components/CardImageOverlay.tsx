// CardImageOverlay — a carta inteira por cima da lista
//
// Serve para ler o texto de regras, que é a pergunta que uma decklist não responde: a linha mostra
// nome, custo e um recorte da arte, e às vezes o que falta saber é o que a carta *faz*.
//
// Sobreposição e não écran novo, de propósito: quem está a percorrer uma lista de quarenta cartas
// quer espreitar uma e voltar, e um push obrigaria a perder o sítio onde ia.
//
// O URL da imagem é **construído** a partir do `scryfallId`, pelo caminho documentado da Scryfall:
// `cards.scryfall.io/<tamanho>/front/<1.ª letra>/<2.ª letra>/<id>.jpg`. Não se guarda no ficheiro do
// deck porque se deduz, e uma string por carta que se pode calcular é peso que não paga renda. A
// regra vive em domain/thumbnails.ts (`cardImageUrl`), onde o relatório de evento também a usa.

import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { DeckCard } from '../types';
import { cardImageUrl } from '../domain/thumbnails';

interface CardImageOverlayProps {
  card?: DeckCard;
  onClose: () => void;
}

export function CardImageOverlay({ card, onClose }: CardImageOverlayProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const url = cardImageUrl(card?.scryfallId);

  return (
    <Modal
      visible={Boolean(card)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tocar fora fecha, como em qualquer sobreposição. O X existe à mesma: nem toda a gente
          tenta o toque fora, e o alvo tem de estar à vista. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.frame} onPress={event => event.stopPropagation()}>
          {url && !failed ? (
            <>
              <Image
                source={{ uri: url }}
                style={styles.card}
                contentFit="contain"
                cachePolicy="memory-disk"
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
              {loading && <ActivityIndicator style={styles.spinner} color={colors.gold} />}
            </>
          ) : (
            <View style={styles.missing}>
              <Text style={styles.missingTitle}>{card?.name}</Text>
              <Text style={styles.missingText}>
                {url
                  ? 'The image could not be loaded. It needs a connection the first time.'
                  : 'This card was added by name only, so there is no printing to show. Use “Get card data” in the deck editor.'}
              </Text>
            </View>
          )}

          <Pressable onPress={onClose} hitSlop={14} style={styles.close}>
            <Feather name="x" size={20} color={colors.textPrim} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Proporção de uma carta de Magic: 63 × 88 mm. */
const CARD_RATIO = 88 / 63;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  frame: { width: '100%', maxWidth: 420 },
  card: { width: '100%', aspectRatio: 1 / CARD_RATIO, borderRadius: 14 },
  spinner: { position: 'absolute', alignSelf: 'center', top: '48%' },
  close: {
    position: 'absolute',
    top: -14,
    right: -6,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    gap: 10,
    padding: 26,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  missingTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrim },
  missingText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSec },
});

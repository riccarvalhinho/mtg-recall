// CardArtPicker — escolher qual das cartas do deck o ilustra
//
// Usado no editor de deck (`Deck.thumbnailCardId`) e no Event Detail (`Event.deckThumbnailCardId`).
// Os dois campos guardam um `scryfallId`, e não um URL: a carta escolhida é sempre uma das cartas
// do próprio deck, portanto o URL da arte sai da lista que já está no ficheiro — sem pedidos à rede
// e sem campo novo no schema. Ver `domain/thumbnails.ts`.
//
// É um componente controlado e sem store: recebe as cartas e o id escolhido, devolve o id novo.
// É o que lhe permite servir os dois écrans, onde o valor vive em sítios diferentes — no editor
// está em estado local até se gravar, no evento está no evento.
//
// Sem cartas com arte não há grelha nenhuma para desenhar. Em vez de desaparecer em silêncio, fica
// uma linha a dizer porquê: é a regra de nada ficar em branco sem explicação.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { thumbnailChoices } from '../domain/thumbnails';
import type { DeckCard } from '../types';
import { CardArtThumb } from './CardArtThumb';

/** A arte é mais larga do que alta — é um recorte, não a carta inteira. */
const ART_WIDTH = 92;
const ART_HEIGHT = 68;

interface CardArtPickerProps {
  /** As cartas do deck. No editor são as da lista que está a ser editada, não as gravadas. */
  cards: DeckCard[] | undefined;
  /** O `scryfallId` escolhido, ou `undefined` enquanto não houver escolha. */
  value?: string;
  onChange: (scryfallId: string | undefined) => void;
  label?: string;
}

export function CardArtPicker({ cards, value, onChange, label = 'Deck art' }: CardArtPickerProps) {
  const choices = thumbnailChoices(cards);

  // A escolha guardada pode apontar para uma carta que entretanto saiu do deck. A grelha mostra-a
  // como não escolhida — que é o que ela é — e `deckThumbnailUrl` trata o mesmo caso a desenhar.
  const chosen = choices.some(choice => choice.scryfallId === value) ? value : undefined;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {chosen && (
          <Pressable onPress={() => onChange(undefined)} hitSlop={12}>
            <Text style={styles.clear}>clear</Text>
          </Pressable>
        )}
      </View>

      {choices.length === 0 ? (
        <Text style={styles.empty}>
          Cards added from search bring their art — none of this deck’s cards have any yet.
        </Text>
      ) : (
        <View style={styles.grid}>
          {choices.map(choice => {
            const selected = choice.scryfallId === chosen;
            return (
              <Pressable
                key={choice.scryfallId}
                // Tocar na escolhida larga-a, como o selector de formato do editor de deck: a
                // ilustração é opcional e tinha de haver forma de a desfazer.
                onPress={() => onChange(selected ? undefined : choice.scryfallId)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${choice.name} as deck art`}
                style={({ pressed }) => [
                  styles.tile,
                  selected && styles.tileSelected,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View>
                  <CardArtThumb url={choice.artCropUrl} width={ART_WIDTH} height={ART_HEIGHT} />
                  {selected && (
                    <View style={styles.check}>
                      <Feather name="check" size={12} color={colors.bg} />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.name, selected && styles.nameSelected]}
                  numberOfLines={1}
                >
                  {choice.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clear: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
  },
  empty: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    // 92 + 2×3 de contorno e espaço à volta: três por linha num telemóvel de 360dp, e um alvo de
    // toque muito acima dos 44 mínimos.
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 4,
  },
  tileSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '14',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    width: ART_WIDTH,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
  },
  nameSelected: {
    fontFamily: fonts.bodyMed,
    color: colors.textSec,
  },
});

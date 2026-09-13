/**
 * Definições → Basic lands.
 *
 * Escolhe a colecção de básicos para os decks que **não dizem de onde são**. Um Sealed diz — as
 * vinte e três cartas saem todas da mesma caixa — e nesse a app deduz sozinha. Um deck de dez
 * colecções não diz nada, e os básicos que se jogam nesses são sempre os mesmos, os que estão na
 * caixa. Escolhe-se aqui uma vez e serve todos.
 *
 * A arte escolhe-se por básico e não só por colecção: muitas colecções trazem a versão normal e a
 * *full art* do mesmo terreno, e escolher a colecção não dizia qual das duas.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { SetSelector } from '../components/SetSelector';
import { CardThumbnailPlaceholder } from '../components/CardThumbnailPlaceholder';
import { artHeightFor } from '../components/CardArtThumb';
import { groupBasicLandPrintings, type BasicLandPreference } from '../domain/basicLands';
import type { ScryfallCard } from '../domain/cards';
import { loadBasicLandPrintings } from '../services/scryfall';
import { readBasicLandPreference, writeBasicLandPreference } from '../services/preferences';

/** Largura de cada arte na fila de escolhas. Cabem duas e meia num telemóvel, que é o que se quer:
 *  a terceira meio à mostra é o que diz que a fila continua. */
const ART_WIDTH = 132;
const ART_HEIGHT = artHeightFor(ART_WIDTH);

export default function BasicLandsScreen() {
  const [setCode, setSetCode] = useState<string | undefined>(undefined);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Ler a preferência antes de mais. Até isso acontecer não se grava nada — senão o primeiro render,
  // com o selector ainda vazio, apagava a escolha que já lá estava.
  useEffect(() => {
    readBasicLandPreference().then(preference => {
      if (preference) {
        setSetCode(preference.setCode);
        setChosen(preference.printings ?? {});
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!setCode) {
      setPrintings([]);
      return;
    }

    let alive = true;
    setLoading(true);
    loadBasicLandPrintings(setCode).then(cards => {
      if (!alive) return;
      setPrintings(cards);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [setCode]);

  const save = useCallback(
    (nextSet: string | undefined, nextChosen: Record<string, string>) => {
      const preference: BasicLandPreference | undefined = nextSet
        ? { setCode: nextSet, printings: Object.keys(nextChosen).length > 0 ? nextChosen : undefined }
        : undefined;
      void writeBasicLandPreference(preference);
    },
    [],
  );

  function chooseSet(code: string | undefined) {
    setSetCode(code);
    // Trocar de colecção larga as artes escolhidas: eram ids da colecção anterior e não existem
    // nesta. `chooseBasicLandPrintings` recuaria para a primeira, mas guardar lixo é lixo na mesma.
    setChosen({});
    if (loaded) save(code, {});
  }

  function chooseArt(land: string, scryfallId: string) {
    setChosen(current => {
      // Tocar na arte já escolhida larga-a e volta à primeira da colecção — sem isto não havia
      // forma de desfazer uma escolha sem trocar de colecção e voltar.
      const next = { ...current };
      if (next[land] === scryfallId) delete next[land];
      else next[land] = scryfallId;

      if (loaded) save(setCode, next);
      return next;
    });
  }

  const byLand = groupBasicLandPrintings(printings);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.textSec} />
        </Pressable>
        <Text style={styles.title}>Basic lands</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Basic lands in a deck have no printing of their own. When most of a deck comes from one
          set — a Sealed pool, a draft — that set&apos;s lands are used automatically. This is the
          set for every other deck.
        </Text>

        <View style={styles.selector}>
          <SetSelector value={setCode} onChange={chooseSet} />
        </View>

        {setCode && loading && (
          <View style={styles.status}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.statusText}>Loading lands…</Text>
          </View>
        )}

        {setCode && !loading && byLand.size === 0 && (
          <Text style={styles.empty}>
            This set has no basic lands. Many sets don&apos;t — pick another one.
          </Text>
        )}

        {[...byLand].map(([land, options]) => (
          <View key={land} style={styles.land}>
            <View style={styles.landHeader}>
              <Text style={styles.landName}>{options[0].name}</Text>
              {options.length > 1 && (
                <Text style={styles.landCount}>{options.length} arts</Text>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.arts}
            >
              {options.map((card, index) => {
                // Sem escolha feita vale a primeira — e mostrá-la já seleccionada é honesto: é
                // mesmo essa que os decks vão usar.
                const picked = chosen[land] ? chosen[land] === card.scryfallId : index === 0;
                return (
                  <Pressable
                    key={card.scryfallId}
                    onPress={() => chooseArt(land, card.scryfallId)}
                    style={({ pressed }) => [
                      styles.art,
                      picked && styles.artPicked,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {card.artCropUrl ? (
                      <Image
                        source={{ uri: card.artCropUrl }}
                        style={styles.artImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    ) : (
                      <CardThumbnailPlaceholder width={ART_WIDTH} height={ART_HEIGHT} />
                    )}
                    <Text style={styles.artMeta} numberOfLines={1}>
                      {card.collectorNumber ? `#${card.collectorNumber}` : ' '}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}

        {setCode && (
          <Pressable
            onPress={() => chooseSet(undefined)}
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.7 }]}
          >
            <Feather name="x" size={15} color={colors.textSec} />
            <Text style={styles.clearText}>Use no set</Text>
          </Pressable>
        )}
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
    height: 48,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrim },
  content: { padding: 16, paddingBottom: 48, gap: 20 },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSec },
  selector: { gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec },
  empty: { fontFamily: fonts.bodyItal, fontSize: 13, color: colors.textDim },
  land: { gap: 8 },
  landHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  landName: { fontFamily: fonts.displayMed, fontSize: 15, color: colors.textPrim },
  landCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  arts: { gap: 8, paddingRight: 16 },
  art: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  artPicked: { borderColor: colors.gold },
  artImage: { width: ART_WIDTH, height: ART_HEIGHT },
  artMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 3,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSec },
});

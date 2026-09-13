// CardArtThumb — o recorte da arte de uma carta, à esquerda de uma linha de decklist.
//
// É **sempre** o recorte (`artCropUrl`) e nunca a carta inteira: a este tamanho a moldura e o texto
// da carta não se leem, e a arte é o que deixa reconhecer a carta de relance.
//
// Usa `expo-image` e não o `Image` do React Native por causa da cache em disco — é a razão de a
// dependência estar no projecto. Numa loja sem rede a lista continua a mostrar as artes que já viu.
//
// Sem URL — um deck escrito à mão não tem nenhuma — ou com o carregamento falhado, cai para o
// `CardThumbnailPlaceholder`. Uma linha sem imagem desalinhava a lista toda.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { CardThumbnailPlaceholder } from './CardThumbnailPlaceholder';

/**
 * A proporção do `art_crop` da Scryfall: 626×457, ou seja **deitada**.
 *
 * Está aqui e não em cada écran porque já foi esquecida uma vez: o Event Detail pedia 38×52, uma
 * caixa ao alto, e o `contentFit: cover` cortava a arte a meio para a encher. O resultado era um
 * pedaço de imagem que não se percebia — pior do que não ter imagem nenhuma.
 */
const ART_RATIO = 457 / 626;

/** A altura que uma arte deve ter para uma dada largura. */
export function artHeightFor(width: number): number {
  return Math.round(width * ART_RATIO);
}

interface CardArtThumbProps {
  /** O recorte da arte. Ausente numa carta escrita à mão, sem passar pela Scryfall. */
  url?: string;
  width?: number;
  /** Só quando há uma razão para fugir à proporção da arte. Por omissão sai da largura. */
  height?: number;
  /**
   * A arte toma a **altura da linha** em vez de um tamanho fixo, e a largura sai da proporção.
   *
   * Serve as linhas cuja altura é definida pelo texto ao lado: com tamanho fixo, a arte ficava
   * centrada com espaço morto por cima e por baixo. A esticar, o cartão fica com a mesma altura e
   * a imagem ocupa-a toda.
   */
  stretch?: boolean;
}

export function CardArtThumb({
  url,
  width = 78,
  height = artHeightFor(width),
  stretch = false,
}: CardArtThumbProps) {
  // Guarda-se o URL que falhou, e não um booleano: se a carta da linha mudar, a nova imagem tem
  // direito a ser tentada em vez de herdar a falha da anterior.
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

  // A proporção faz o trabalho da largura: `alignSelf: stretch` dá a altura da linha, e o
  // `aspectRatio` deduz o resto.
  const size = stretch
    ? { alignSelf: 'stretch' as const, aspectRatio: 1 / ART_RATIO }
    : { width, height };

  if (!url || failedUrl === url) {
    return stretch ? (
      <View style={[styles.image, styles.empty, size]} />
    ) : (
      <CardThumbnailPlaceholder width={width} height={height} />
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.image, size]}
      contentFit="cover"
      transition={120}
      cachePolicy="memory-disk"
      onError={() => setFailedUrl(url)}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  /** A esticar não há placeholder com tamanho: fica a superfície, com a mesma moldura. */
  empty: { backgroundColor: colors.bgCard },
  image: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
});

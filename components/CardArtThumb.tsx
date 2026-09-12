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
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { CardThumbnailPlaceholder } from './CardThumbnailPlaceholder';

interface CardArtThumbProps {
  /** O recorte da arte. Ausente numa carta escrita à mão, sem passar pela Scryfall. */
  url?: string;
  width?: number;
  height?: number;
}

export function CardArtThumb({ url, width = 58, height = 42 }: CardArtThumbProps) {
  // Guarda-se o URL que falhou, e não um booleano: se a carta da linha mudar, a nova imagem tem
  // direito a ser tentada em vez de herdar a falha da anterior.
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

  if (!url || failedUrl === url) {
    return <CardThumbnailPlaceholder width={width} height={height} />;
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.image, { width, height }]}
      contentFit="cover"
      transition={120}
      cachePolicy="memory-disk"
      onError={() => setFailedUrl(url)}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
});

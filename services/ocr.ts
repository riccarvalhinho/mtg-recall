/**
 * A câmara e o ML Kit — o lado sujo da decklist por fotografia (ADR 0009).
 *
 * Aqui só entra o que fala com o mundo: pedir ao ML Kit que leia uma imagem e traduzir o que ele
 * devolve para a forma que `domain/ocrDecklist.ts` sabe tratar. **Nada aqui decide nada** — quem
 * reconstrói colunas, compara nomes e conta repetições é o domínio, que tem testes e não precisa
 * de telemóvel.
 *
 * A fotografia é lida do ficheiro temporário da câmara e **nunca é guardada nem commitada**. O que
 * fica é a lista.
 *
 * O ML Kit é código nativo: só existe num APK compilado com ele (ADR 0008 e 0009). Em
 * desenvolvimento com Expo Go, ou num APK anterior, o módulo não está ligado e a chamada estoira —
 * por isso tudo passa por `isAvailable()` e por um erro explicado, em vez de um écran em branco.
 */
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { NativeModules } from 'react-native';
import { decklistFromBlocks, type OcrDecklist, type TextBlock } from '../domain/ocrDecklist';

/**
 * Se o módulo nativo está mesmo neste APK.
 *
 * Perguntar antes é o que permite ao écran dizer "isto precisa de um APK novo" em vez de rebentar.
 */
export function isAvailable(): boolean {
  return Boolean(NativeModules.TextRecognition);
}

/**
 * Lê uma fotografia e devolve a porção de decklist que estava nela.
 *
 * **Usa as linhas e não os blocos.** O ML Kit agrupa em blocos o que lhe parece um parágrafo, e
 * numa pilha de cartas sobrepostas duas barras de título encostadas podem cair no mesmo bloco — o
 * texto vinha colado e a caixa delimitadora era a das duas juntas, que estragava tanto o nome como
 * a coluna. A linha é a unidade que corresponde a uma barra de título.
 *
 * Uma linha sem caixa delimitadora não tem posição, e sem posição não entra nas colunas. Em vez de
 * desaparecer, vai para `unmatched` com as outras: a regra de nada ser descartado em silêncio vale
 * aqui como vale no domínio.
 */
export async function readDeckPhoto(uri: string, catalogue: string[]): Promise<OcrDecklist> {
  const result = await TextRecognition.recognize(uri);

  const blocks: TextBlock[] = [];
  const unplaced: string[] = [];

  for (const block of result.blocks) {
    for (const line of block.lines) {
      const text = line.text?.trim();
      if (!text) continue;

      const frame = line.frame;
      if (!frame) {
        unplaced.push(text);
        continue;
      }

      blocks.push({
        text,
        x: frame.left,
        y: frame.top,
        width: frame.width,
        height: frame.height,
      });
    }
  }

  const read = decklistFromBlocks(blocks, catalogue);
  return { ...read, unmatched: [...read.unmatched, ...unplaced] };
}

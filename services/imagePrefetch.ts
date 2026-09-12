/**
 * Garante que as miniaturas estão em disco antes de serem precisas.
 *
 * O `expo-image` guarda em disco tudo o que desenha, portanto as artes da decklist ficam em cache
 * sozinhas à medida que os decks vão sendo abertos. O que a cache passiva não garante é o **antes**:
 * um deck que nunca se abriu não tem arte nenhuma guardada, e na loja sem rede aparece cinzento.
 *
 * Por isso só as miniaturas são descarregadas por antecipação. As artes da decklist não — um deck de
 * Commander tem cem cartas, e puxá-las todas seria gastar dados por uma coisa que só se vê ao abrir
 * o deck. Ver a decisão da cache no roadmap, Fase 5.
 *
 * **Nada aqui é urgente e nada aqui pode falhar de forma visível.** É uma conveniência: se não
 * houver rede, as imagens aparecem quando houver, e entretanto o placeholder faz o seu papel.
 */
import { Image } from 'expo-image';

/** Quantas imagens de cada vez. Cem pedidos em paralelo ao arrancar competiriam com a sincronização. */
const BATCH_SIZE = 4;

/** O que já foi pedido nesta sessão, para um segundo `load()` não repetir tudo. */
const requested = new Set<string>();

/**
 * Pede as imagens que ainda não foram pedidas, em lotes pequenos.
 *
 * Não espera pelo fim nem devolve erro: quem chama segue a vida. Uma falha aqui significa uma
 * miniatura que aparece mais tarde, não um écran partido.
 */
export async function prefetchThumbnails(urls: string[]): Promise<void> {
  const pending = urls.filter(url => url && !requested.has(url));
  if (pending.length === 0) return;

  for (const url of pending) requested.add(url);

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);

    // `allSettled` e não `all`: uma imagem que já não existe no CDN não pode impedir as outras.
    await Promise.allSettled(
      batch.map(url =>
        Image.prefetch(url, { cachePolicy: 'disk' }).catch(() => {
          // Sai da lista para poder ser tentada outra vez no próximo arranque.
          requested.delete(url);
        }),
      ),
    );
  }
}

/** Esquece o que foi pedido nesta sessão. Só os testes e um restauro precisam disto. */
export function resetPrefetchMemory(): void {
  requested.clear();
}

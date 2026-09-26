/**
 * Exportar um evento: escrever o relatório num ficheiro HTML e abrir a folha de partilha — ADR 0014.
 *
 * A página em si é `domain/eventReport.ts`. Aqui fica só o que toca no telemóvel:
 *
 *  1. dar aos básicos a arte da colecção, como o Deck Detail;
 *  2. **embutir as imagens**, para o ficheiro levar tudo o que mostra — quem abre no Telegram pode
 *     estar num visualizador que não vai buscar nada à rede;
 *  3. escrever o ficheiro na cache e entregá-lo ao Android, que oferece o Telegram, o WhatsApp e o
 *     resto.
 *
 * Cada imagem procura-se primeiro na cache do `expo-image` — os recortes de um deck que já se abriu
 * estão lá, e as cartas inteiras que já se tocaram também —, depois na rede. O que não se conseguir
 * fica como link para a Scryfall: **exportar nunca falha por causa de uma imagem** (regra 3), só
 * fica com menos coisas dentro.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import {
  basicLandsToIllustrate,
  dominantSetCode,
  withBasicLandArt,
} from '../domain/basicLands';
import { renderEventReport, reportFileName, reportImageUrls } from '../domain/eventReport';
import type { Deck, Event, Opponent } from '../types';
import { readBasicLandPreference } from './preferences';
import { resolveBasicLands } from './scryfall';

/** Quantas imagens de cada vez — o mesmo que o `imagePrefetch`, pela mesma razão. */
const BATCH_SIZE = 4;

/** Uma imagem que não chega nisto não chega. Numa loja com uma barra de rede, esperar mais é pior. */
const DOWNLOAD_TIMEOUT_MS = 10_000;

export interface ExportResult {
  /** Imagens que foram dentro do ficheiro. */
  embedded: number;
  /** Imagens que ficaram como link, por não haver cache nem rede. */
  linked: number;
}

/** O tipo de uma imagem pelo fim do URL. A Scryfall serve `.jpg` e `.svg`; o resto é por cautela. */
function mimeFor(url: string): string {
  const pathname = url.split('?')[0].toLowerCase();
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** A imagem da cache do `expo-image`, se já lá estiver. */
async function fromImageCache(url: string): Promise<string | null> {
  try {
    const cached = await Image.getCachePathAsync(url);
    if (!cached) return null;
    const file = new File(cached.startsWith('file://') ? cached : `file://${cached}`);
    return file.exists ? await file.base64() : null;
  } catch {
    return null;
  }
}

/** A imagem pela rede, para uma pasta temporária, e lida de volta. */
async function fromNetwork(url: string, folder: Directory, index: number): Promise<string | null> {
  try {
    const target = new File(folder, `img-${index}`);
    const file = await withTimeout(File.downloadFileAsync(url, target, { idempotent: true }), DOWNLOAD_TIMEOUT_MS);
    return await file.base64();
  } catch {
    return null;
  }
}

/** URL → `data:` URI, para as que se conseguiram. */
async function collectImages(urls: string[]): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  const folder = new Directory(Paths.cache, 'event-export-images');

  try {
    if (folder.exists) folder.delete();
    folder.create({ intermediates: true });

    for (let start = 0; start < urls.length; start += BATCH_SIZE) {
      const batch = urls.slice(start, start + BATCH_SIZE);
      await Promise.all(
        batch.map(async (url, offset) => {
          const base64 = (await fromImageCache(url)) ?? (await fromNetwork(url, folder, start + offset));
          if (base64) assets.set(url, `data:${mimeFor(url)};base64,${base64}`);
        }),
      );
    }
  } finally {
    // As imagens já estão dentro do HTML; a pasta é lixo a partir daqui.
    try {
      if (folder.exists) folder.delete();
    } catch {
      // Fica para o sistema limpar — é a pasta de cache.
    }
  }

  return assets;
}

/**
 * Os básicos com a arte que o Deck Detail lhes dá: a colecção do deck, senão a das definições.
 * A mesma regra do `useBasicLandArt` do écran do deck, sem o hook.
 */
async function withBasicLands(deck: Deck | undefined): Promise<Deck | undefined> {
  if (!deck?.cards || basicLandsToIllustrate(deck.cards).length === 0) return deck;

  const preference = await readBasicLandPreference();
  const setCode = dominantSetCode(deck.cards) ?? preference?.setCode;
  if (!setCode) return deck;

  const chosen = setCode === preference?.setCode ? preference?.printings : undefined;
  const printings = await resolveBasicLands(setCode, chosen);
  return { ...deck, cards: withBasicLandArt(deck.cards, printings) };
}

/**
 * Gera o relatório e abre a folha de partilha.
 *
 * Resolve quando a folha fecha — tenha-se escolhido uma app ou não, o Android não diz. Atira só se
 * não houver folha de partilha nenhuma ou o ficheiro não se puder escrever.
 */
export async function shareEventReport(
  event: Event,
  deck: Deck | undefined,
  opponents: Opponent[],
): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const input = { event, deck: await withBasicLands(deck), opponents };
  const urls = reportImageUrls(input);
  const assets = await collectImages(urls);
  const html = renderEventReport(input, assets);

  const file = new File(Paths.cache, reportFileName(event));
  if (file.exists) file.delete();
  file.create();
  file.write(html);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/html',
    UTI: 'public.html',
    dialogTitle: `Share ${event.name}`,
  });

  return { embedded: assets.size, linked: urls.length - assets.size };
}

/**
 * Leitura do repositório — o caminho de volta.
 *
 * No dia a dia a app nunca lê daqui: a cópia local é a verdade (ADR 0004). Isto serve para o
 * telemóvel novo, para a reinstalação e para o dia em que alguma coisa se perder — e é o que torna
 * honesta a afirmação de que os dados não vivem no telemóvel.
 *
 * Lê o `bundle.json` publicado em GitHub Pages: um ficheiro estático, sem token e sem limite de
 * rate, gerado pelo CI a partir de `data/`.
 */
import type { CollectionCard, Opponent, PriceEntry, ValueEntry } from '../types';
import { bundleUrl } from './config';

/** Sobe quando a forma do bundle mudar. Tem de bater certo com tools/build-bundle.mts. */
const SUPPORTED_FORMAT = 3;

export interface RemoteData {
  events: unknown[];
  /** Ausente num bundle do formato 1, que não conhecia decks. */
  decks?: unknown[];
  opponents: Opponent[];
  /** Ausentes enquanto a colecção não for usada. */
  collection?: CollectionCard[];
  prices?: PriceEntry[];
  valueHistory?: ValueEntry[];
  generatedAt?: string;
}

export async function fetchBundle(): Promise<RemoteData> {
  const response = await fetch(bundleUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Nothing has been published yet. The bundle shows up after the first push to main.'
        : `The server answered ${response.status} when asking for the data.`,
    );
  }

  const bundle = (await response.json()) as RemoteData & { formatVersion?: number };

  // Recusar em vez de adivinhar: uma app antiga a ler um formato novo escreveria ficheiros errados
  // por cima dos bons.
  if (bundle.formatVersion !== SUPPORTED_FORMAT) {
    throw new Error(
      `The bundle is in format ${bundle.formatVersion} and this version of the app reads format ${SUPPORTED_FORMAT}.`,
    );
  }

  return {
    events: bundle.events ?? [],
    decks: bundle.decks ?? [],
    opponents: bundle.opponents ?? [],
    collection: bundle.collection ?? [],
    prices: bundle.prices ?? [],
    valueHistory: bundle.valueHistory ?? [],
    generatedAt: bundle.generatedAt,
  };
}

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
import type { Opponent } from '../types';
import { bundleUrl } from './config';

/** Sobe quando a forma do bundle mudar. Tem de bater certo com tools/build-bundle.mts. */
const SUPPORTED_FORMAT = 1;

export interface RemoteData {
  events: unknown[];
  opponents: Opponent[];
  generatedAt?: string;
}

export async function fetchBundle(): Promise<RemoteData> {
  const response = await fetch(bundleUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Ainda não há nada publicado. O bundle aparece depois do primeiro push para main.'
        : `O servidor respondeu ${response.status} ao pedir os dados.`,
    );
  }

  const bundle = (await response.json()) as RemoteData & { formatVersion?: number };

  // Recusar em vez de adivinhar: uma app antiga a ler um formato novo escreveria ficheiros errados
  // por cima dos bons.
  if (bundle.formatVersion !== SUPPORTED_FORMAT) {
    throw new Error(
      `O bundle está no formato ${bundle.formatVersion} e esta versão da app lê o formato ${SUPPORTED_FORMAT}.`,
    );
  }

  return { events: bundle.events ?? [], opponents: bundle.opponents ?? [], generatedAt: bundle.generatedAt };
}

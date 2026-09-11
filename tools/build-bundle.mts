/**
 * Junta tudo o que está em data/ num ficheiro só, para a app poder ler de uma vez.
 *
 * A app não precisa disto no dia a dia — a cópia local no telemóvel é a verdade (ADR 0004). O bundle
 * serve para a primeira instalação, para um restauro e para um telemóvel novo: um pedido a um
 * ficheiro estático em vez de uma volta pela API do GitHub a pedir ficheiro a ficheiro.
 *
 * É gerado no CI e publicado em GitHub Pages. **Não é commitado**: um artefacto derivado dentro do
 * repositório entraria em conflito com as escritas que a app faz, e passaria a haver duas versões da
 * mesma verdade.
 */
import fs from 'node:fs';
import path from 'node:path';
import { paths, rel } from './paths.mts';
import { loadAll } from './load-data.mts';

/**
 * Sobe quando a forma do bundle mudar de maneira que uma app antiga não saiba ler.
 * A app recusa um formato que não conhece em vez de adivinhar.
 */
// 2 acrescentou os decks (Fase 2); 3 acrescenta a colecção, os preços e o histórico de valor
// (Fases 3 e 4). Uma app antiga recusa um formato que não conhece em vez de o ler a meio.
const FORMAT_VERSION = 3;

const data = loadAll();

const bundle = {
  formatVersion: FORMAT_VERSION,
  generatedAt: new Date().toISOString(),
  events: data.events.map((entry) => entry.data),
  decks: data.decks.map((entry) => entry.data),
  opponents: (data.opponents.data as { items: unknown[] }).items,
  // Ausentes enquanto a colecção não for usada — a app trata os três como opcionais.
  collection: (data.collection?.data as { items?: unknown[] } | undefined)?.items ?? [],
  prices: (data.prices?.data as { items?: unknown[] } | undefined)?.items ?? [],
  valueHistory: (data.valueHistory?.data as { entries?: unknown[] } | undefined)?.entries ?? [],
};

fs.mkdirSync(paths.bundleDir, { recursive: true });
const target = path.join(paths.bundleDir, 'bundle.json');
fs.writeFileSync(target, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

const size = (fs.statSync(target).size / 1024).toFixed(1);
console.log(
  `✓ ${rel(target)} — ${bundle.events.length} evento(s), ${bundle.decks.length} deck(s), ` +
    `${bundle.opponents.length} adversário(s), ${bundle.collection.length} carta(s), ${size} kB`,
);

/**
 * Actualiza os preços das cartas da colecção e regista o valor do dia.
 *
 * Corre no GitHub Actions, agendado — **nunca no telemóvel**. Ver
 * docs/adr/0007-precos-pela-scryfall-em-vez-da-cardmarket.md: o telemóvel não tem nada que andar a
 * puxar preços, não é uma operação offline-first e fazê-la aqui mantém a app sem mais uma razão
 * para precisar de rede.
 *
 * Escreve dois ficheiros:
 *   data/collection/prices.json         — o preço actual de cada impressão (substituído)
 *   data/collection/value-history.json  — uma linha por dia com o valor total (acrescentado)
 *
 * Se não houver colecção, não faz nada e sai bem: é o estado normal antes de a Fase 3 ser usada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { paths, rel } from './paths.mts';
import { appendValueEntry, collectionValue, priceIndex, pricedIds } from '../domain/collection.ts';
import type { CollectionCard, PriceEntry, ValueEntry } from '../types/index.ts';

/** O `POST /cards/collection` da Scryfall aceita no máximo 75 identificadores por pedido. */
const BATCH_SIZE = 75;

/** A Scryfall pede 50–100 ms entre pedidos. Ficamos pelo lado seguro. */
const DELAY_MS = 120;

const collectionFile = path.join(paths.collection, 'cards.json');
const pricesFile = path.join(paths.collection, 'prices.json');
const historyFile = path.join(paths.collection, 'value-history.json');

function readJsonFile<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Dois espaços e uma linha no fim, como todos os ficheiros de `data/`. */
function writeJsonFile(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ScryfallCard {
  id: string;
  prices?: { eur?: string | null; eur_foil?: string | null };
}

/** `"12.34"` → `12.34`; `null`, `undefined` ou lixo → `undefined`. Ausente não é zero. */
function toNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function fetchBatch(ids: string[]): Promise<PriceEntry[]> {
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // A Scryfall pede um User-Agent que identifique quem está a chamar.
      'User-Agent': 'mtg-recall/1.0 (https://github.com/riccarvalhinho/mtg-recall)',
    },
    body: JSON.stringify({ identifiers: ids.map((id) => ({ id })) }),
  });

  if (!response.ok) {
    throw new Error(`A Scryfall respondeu ${response.status} ao pedir ${ids.length} carta(s).`);
  }

  const body = (await response.json()) as { data?: ScryfallCard[]; not_found?: unknown[] };

  if (body.not_found && body.not_found.length > 0) {
    // Não é erro: uma impressão pode ter sido fundida ou corrigida na Scryfall. Fica sem preço, que
    // é melhor do que inventar um.
    console.warn(`  ⚠ ${body.not_found.length} impressão(ões) sem correspondência na Scryfall`);
  }

  return (body.data ?? []).map((card) => ({
    scryfallId: card.id,
    eur: toNumber(card.prices?.eur),
    eurFoil: toNumber(card.prices?.eur_foil),
  }));
}

// ─── Execução ────────────────────────────────────────────────────────────────

const collection = readJsonFile<{ items?: CollectionCard[] }>(collectionFile, {});
const items = collection.items ?? [];

if (items.length === 0) {
  console.log('Sem colecção — nada a actualizar. (É o estado normal antes da Fase 3 ser usada.)');
  process.exit(0);
}

const ids = pricedIds(items);

if (ids.length === 0) {
  console.log(
    `${items.length} entrada(s) na colecção, nenhuma com scryfallId — sem id não há preço possível (ADR 0007).`,
  );
  process.exit(0);
}

console.log(`A pedir preços de ${ids.length} impressão(ões) em lotes de ${BATCH_SIZE}…`);

const entries: PriceEntry[] = [];
for (let start = 0; start < ids.length; start += BATCH_SIZE) {
  const batch = ids.slice(start, start + BATCH_SIZE);
  entries.push(...(await fetchBatch(batch)));
  if (start + BATCH_SIZE < ids.length) await sleep(DELAY_MS);
}

// Ordenados pelo id para o diff mostrar preços que mudaram e não linhas que trocaram de sítio.
entries.sort((a, b) => a.scryfallId.localeCompare(b.scryfallId));

writeJsonFile(pricesFile, {
  kind: 'prices',
  source: 'scryfall',
  currency: 'EUR',
  updatedAt: new Date().toISOString(),
  items: entries,
});

// ── O valor do dia ──

const value = collectionValue(items, priceIndex(entries));
const today = new Date().toISOString().slice(0, 10);

const history = readJsonFile<{ entries?: ValueEntry[] }>(historyFile, {});
const updated = appendValueEntry(history.entries ?? [], {
  date: today,
  totalEur: value.totalEur,
  cards: value.cards,
  priced: value.priced,
});

writeJsonFile(historyFile, { kind: 'value-history', entries: updated });

console.log(`✓ ${rel(pricesFile)} — ${entries.length} preço(s)`);
console.log(
  `✓ ${rel(historyFile)} — ${value.totalEur.toFixed(2)} € ` +
    `(${value.priced} de ${value.cards} carta(s) com preço conhecido)`,
);

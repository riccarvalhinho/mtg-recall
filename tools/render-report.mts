/**
 * Gera o relatório de um evento a partir de data/, com o mesmo código que a app usa (ADR 0014).
 *
 * Serve para ver a página no computador enquanto se mexe no `domain/eventReport.ts`, sem compilar
 * um APK. As imagens ficam como links para a Scryfall — embuti-las é trabalho do telemóvel
 * (`services/eventExport.ts`), que tem a cache das imagens.
 *
 *   npm run report -- 2026-09-25-pre-release-reality-fracture [saída.html] [--cover=banner|card|backdrop]
 *
 * Sem saída, escreve em design/event-export/<id>.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderEventReport, reportFileName, type CoverStyle } from '../domain/eventReport.ts';
import type { Deck, Event, Opponent } from '../types/index.ts';
import { loadAll } from './load-data.mts';
import { repoRoot, rel } from './paths.mts';

const args = process.argv.slice(2);
const cover = args.find((arg) => arg.startsWith('--cover='))?.slice('--cover='.length) as CoverStyle | undefined;
const [id, output] = args.filter((arg) => !arg.startsWith('--'));
const data = loadAll();

if (!id) {
  console.error('Uso: npm run report -- <id do evento> [saída.html]\n\nEventos:');
  for (const entry of data.events) console.error(`  ${entry.stem}`);
  process.exit(1);
}

const event = data.events.find((entry) => entry.stem === id)?.data as Event | undefined;
if (!event) {
  console.error(`Não há evento "${id}" em data/events/.`);
  process.exit(1);
}

const deck = data.decks.find((entry) => entry.stem === event.deckId)?.data as Deck | undefined;
const opponents = (data.opponents.data as { items: Opponent[] }).items;

const target = output ? path.resolve(output) : path.join(repoRoot, 'design', 'event-export', reportFileName(event));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, renderEventReport({ event, deck, opponents }, new Map(), { cover }));
console.log(`${rel(target)} — ${Math.round(fs.statSync(target).size / 1024)} KB`);

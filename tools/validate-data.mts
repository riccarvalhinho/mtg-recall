/**
 * Valida tudo o que está em data/.
 *
 * Duas camadas:
 *  1. Forma — cada ficheiro bate certo com o seu schema em data/schema/.
 *  2. Coerência — o que o schema não consegue exprimir: ids iguais aos nomes dos ficheiros, rondas
 *     sem buracos, adversários que existem mesmo, e o resultado de um match a bater certo com os
 *     seus games.
 *
 * A segunda camada é a que apanha os erros a sério. Um match a dizer "W" com dois games perdidos
 * passa em qualquer schema e mente nas estatísticas para sempre.
 */
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { paths, rel } from './paths.mts';
import { readJson, loadAll, type LoadedFile } from './load-data.mts';

const problems: string[] = [];
function fail(where: string, message: string) {
  problems.push(`${where}: ${message}`);
}

// ---------------------------------------------------------------- camada 1: schemas

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validators = {
  event: ajv.compile(readJson(path.join(paths.schemas, 'event.schema.json')).data as object),
  opponents: ajv.compile(readJson(path.join(paths.schemas, 'opponents.schema.json')).data as object),
};

function checkSchema(kind: keyof typeof validators, entry: LoadedFile) {
  const validate = validators[kind];
  if (validate(entry.data)) return;
  for (const error of validate.errors ?? []) {
    fail(entry.name, `${error.instancePath || '(raiz)'} ${error.message ?? 'inválido'}`);
  }
}

const data = loadAll();

for (const event of data.events) checkSchema('event', event);
checkSchema('opponents', data.opponents);

// ------------------------------------------------------------- camada 2: coerência

interface ManaSelection {
  main?: string[];
  splash?: string[];
}

interface MatchShape {
  round: number;
  opponentId: string;
  opponentColors?: ManaSelection;
  result: 'W' | 'L' | 'D';
  games?: { number: number; result: 'W' | 'L' }[];
}

interface EventShape {
  id: string;
  date: string;
  status: string;
  deckColors?: ManaSelection;
  matches?: MatchShape[];
}

interface OpponentsShape {
  items?: { id: string; name: string }[];
}

const opponents = data.opponents.data as OpponentsShape;
const opponentIds = new Set<string>();

for (const item of opponents.items ?? []) {
  if (opponentIds.has(item.id)) fail(data.opponents.name, `id duplicado: ${item.id}`);
  opponentIds.add(item.id);
}

// Dois adversários com o mesmo nome são quase de certeza a mesma pessoa registada duas vezes — e
// duas entradas separam as estatísticas dela ao meio, em silêncio.
const byName = new Map<string, string[]>();
for (const item of opponents.items ?? []) {
  const key = item.name.trim().toLowerCase();
  byName.set(key, [...(byName.get(key) ?? []), item.id]);
}
for (const [name, ids] of byName) {
  if (ids.length > 1) fail(data.opponents.name, `"${name}" está registado ${ids.length} vezes: ${ids.join(', ')}`);
}

/** Uma cor não pode ser principal e splash ao mesmo tempo — o pip não saberia como se desenhar. */
function checkColors(where: string, label: string, colors: ManaSelection | undefined) {
  if (!colors) return;
  const splash = new Set(colors.splash ?? []);
  for (const color of colors.main ?? []) {
    if (splash.has(color)) fail(where, `${label}: ${color} está em main e em splash ao mesmo tempo`);
  }
}

let activeEvents = 0;
let totalMatches = 0;

for (const entry of data.events) {
  const event = entry.data as EventShape;
  if (typeof event.id !== 'string') continue; // já reportado pela camada 1

  if (event.id !== entry.stem) {
    fail(entry.name, `o campo id ("${event.id}") tem de ser igual ao nome do ficheiro ("${entry.stem}")`);
  }
  if (typeof event.date === 'string' && !event.id.startsWith(`${event.date}-`)) {
    fail(entry.name, `o id devia começar pela data do evento ("${event.date}-…")`);
  }
  if (event.status === 'active') activeEvents += 1;

  checkColors(entry.name, 'deckColors', event.deckColors);

  const rounds = new Set<number>();
  (event.matches ?? []).forEach((match, index) => {
    totalMatches += 1;
    const where = `match #${index + 1}`;

    // As rondas são a identidade do match dentro do evento: um buraco ou uma repetição
    // desalinhavam tudo o que aponte para elas.
    if (match.round !== index + 1) {
      fail(entry.name, `${where}: está na posição ${index + 1} mas diz round ${match.round} — as rondas são sequenciais a partir de 1`);
    }
    if (rounds.has(match.round)) fail(entry.name, `${where}: round ${match.round} repetido`);
    rounds.add(match.round);

    if (match.opponentId && !opponentIds.has(match.opponentId)) {
      fail(entry.name, `${where}: adversário desconhecido "${match.opponentId}" — acrescentar a data/taxonomies/opponents.json`);
    }

    checkColors(entry.name, `${where} opponentColors`, match.opponentColors);

    if (match.games && match.games.length > 0) {
      const wins = match.games.filter((game) => game.result === 'W').length;
      const losses = match.games.length - wins;
      const expected = wins > losses ? 'W' : losses > wins ? 'L' : 'D';
      if (match.result !== expected) {
        fail(entry.name, `${where}: diz "${match.result}" mas os games dão ${wins}-${losses}, que é "${expected}"`);
      }
      match.games.forEach((game, gameIndex) => {
        if (game.number !== gameIndex + 1) {
          fail(entry.name, `${where}: game na posição ${gameIndex + 1} diz number ${game.number}`);
        }
      });
    }
  });
}

// Não é um erro de dados, mas é quase sempre um esquecimento: um torneio antigo que ficou por
// concluir aparece para sempre na Home como se estivesse a decorrer.
if (activeEvents > 1) {
  fail(rel(paths.events), `${activeEvents} eventos com status "active" — só devia haver um a decorrer`);
}

// ------------------------------------------------------------------------- resultado

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} problema(s) em ${rel(paths.events)}/..:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ dados válidos — ${data.events.length} evento(s), ${totalMatches} match(es), ` +
    `${opponentIds.size} adversário(s)`,
);

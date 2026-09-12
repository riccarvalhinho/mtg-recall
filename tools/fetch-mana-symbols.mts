/**
 * Vai buscar à Scryfall os símbolos que aparecem em custos de mana e escreve-os como assets locais.
 *
 * Corre **uma vez de vez em quando**, à mão, pelo workflow `fetch-mana-symbols.yml`. Não é código
 * que a app corra: o resultado é commitado e passa a fazer parte dos assets fixos, como já
 * acontecia com os cinco símbolos WUBRG que lá estavam.
 *
 * Existe por duas razões. A primeira é que os símbolos não mudam — sai um novo de dez em dez anos,
 * e pedi-los em cada arranque seria rede a mais por nada. A segunda é a regra 3 do projecto: numa
 * loja sem sinal, um custo de mana tem de se ver.
 *
 * Filtra por `appears_in_mana_costs`, que é um campo da própria resposta. A symbology traz também
 * símbolos de texto de regras — o do tap, os de lealdade de planeswalker, o do chaos do Planechase —
 * que nunca aparecem num custo e só encheriam o bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { paths, rel } from './paths.mts';

const SYMBOLOGY_URL = 'https://api.scryfall.com/symbology';

/** A Scryfall pede 50–100 ms entre pedidos. Ficamos pelo lado seguro, como em services/scryfall.ts. */
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ScryfallSymbol {
  symbol?: string;
  svg_uri?: string;
  appears_in_mana_costs?: boolean;
}

/** `{W/U}` → `WU`, que é como a Scryfall nomeia o ficheiro e como `domain/manaCost.ts` o procura. */
function keyOf(symbol: string): string {
  return symbol.replace(/[{}]/g, '').replace(/\//g, '').toUpperCase();
}

/**
 * Tira do SVG o que não precisa de viajar.
 *
 * Comentários e quebras de linha são metade do peso de alguns destes ficheiros, e o que vai para o
 * bundle da app paga-se em megabytes instalados.
 */
function minify(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const response = await fetch(SYMBOLOGY_URL, {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'mtg-recall/1.0 (https://github.com/riccarvalhinho/mtg-recall)',
  },
});

if (!response.ok) {
  throw new Error(`A Scryfall respondeu ${response.status} ao pedir a symbology.`);
}

const body = (await response.json()) as { data?: ScryfallSymbol[] };

const wanted = (body.data ?? []).filter(
  entry => entry.appears_in_mana_costs && entry.symbol && entry.svg_uri,
);

if (wanted.length === 0) {
  throw new Error('A symbology não trouxe símbolos de custo — nada a escrever.');
}

console.log(`${wanted.length} símbolo(s) de custo. A descarregar…`);

const svgs = new Map<string, string>();

for (const entry of wanted) {
  const key = keyOf(entry.symbol!);

  // A mesma chave duas vezes seria a segunda a sobrepor-se à primeira em silêncio.
  if (svgs.has(key)) continue;

  const svgResponse = await fetch(entry.svg_uri!, {
    headers: { 'User-Agent': 'mtg-recall/1.0 (https://github.com/riccarvalhinho/mtg-recall)' },
  });

  if (!svgResponse.ok) {
    console.warn(`  ⚠ ${entry.symbol} devolveu ${svgResponse.status} — fica de fora`);
    continue;
  }

  svgs.set(key, minify(await svgResponse.text()));
  await sleep(DELAY_MS);
}

// Por chave, para o diff mostrar o símbolo que mudou e não a ordem em que a API os devolveu.
const ordered = [...svgs.entries()].sort((a, b) => a[0].localeCompare(b[0]));

const file = `// GERADO por tools/fetch-mana-symbols.mts — não editar à mão.
//
// Os símbolos que aparecem em custos de mana, em SVG, guardados localmente para funcionarem sem
// rede (regra 3). Voltar a gerar: separador Actions → "Actualizar símbolos de mana".
//
// Fonte: https://api.scryfall.com/symbology (só os que têm appears_in_mana_costs).
// Gerado em ${new Date().toISOString().slice(0, 10)} — ${ordered.length} símbolos.

/** A chave é o símbolo sem chavetas nem barras: \`{W/U}\` é \`WU\`. Ver domain/manaCost.ts. */
export const COST_SYMBOL_SVG: Record<string, string> = {
${ordered.map(([key, svg]) => `  ${/^[A-Z]/.test(key) ? key : `'${key}'`}: ${JSON.stringify(svg)},`).join('\n')}
};
`;

const target = path.join(paths.manaAssets, 'costSymbols.ts');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, file, 'utf8');

const size = (fs.statSync(target).size / 1024).toFixed(0);
console.log(`✓ ${rel(target)} — ${ordered.length} símbolo(s), ${size} kB`);

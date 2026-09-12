/**
 * Ler um custo de mana escrito à maneira da Scryfall. Puro, sem I/O.
 *
 * A Scryfall escreve os custos entre chavetas: `{2}{G}{U}`, `{X}{B/R}`, `{W/P}`. A app guarda essa
 * string tal e qual no ficheiro do deck, e até agora mostrava-a em cru — que é legível para quem
 * joga mas feio, e não é o que uma app de Magic faz.
 *
 * Aqui separa-se a string nos seus símbolos. Desenhá-los é problema de quem chama.
 *
 * ## A chave do símbolo
 *
 * A Scryfall nomeia os ficheiros SVG **sem a barra**: `{W/U}` é `WU.svg`, `{2/W}` é `2W.svg`,
 * `{W/P}` é `WP.svg`. A `key` de cada símbolo segue essa convenção, para que quem desenha possa
 * procurar directamente no mapa de assets sem ter de saber disto.
 */

export interface ManaSymbol {
  /** O que estava entre chavetas, tal e qual: `2`, `G`, `W/U`, `W/P`, `X`, `T`. */
  code: string;
  /** A chave do asset, sem barras: `2`, `G`, `WU`, `WP`, `X`, `T`. */
  key: string;
  /** O texto a mostrar quando não há asset para este símbolo. */
  label: string;
}

/**
 * Separa um custo nos seus símbolos.
 *
 * O que não estiver entre chavetas é ignorado em silêncio. Custos de cartas de duas faces vêm com
 * ` // ` pelo meio (`{1}{U} // {4}{U}`) e o separador não é um símbolo — cai aqui, e quem desenha
 * trata as duas faces como uma sequência só, que é como a Scryfall as escreve.
 *
 * Um custo vazio devolve lista vazia: terrenos não têm custo, e isso não é um erro.
 */
export function parseManaCost(cost: string | undefined): ManaSymbol[] {
  if (!cost) return [];

  const symbols: ManaSymbol[] = [];

  for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
    const code = match[1].trim();
    if (!code) continue;

    symbols.push({
      code,
      key: code.replace(/\//g, '').toUpperCase(),
      label: code,
    });
  }

  return symbols;
}

/** `true` se a string tem pelo menos um símbolo legível. Serve para decidir se vale a pena desenhar. */
export function hasManaSymbols(cost: string | undefined): boolean {
  return parseManaCost(cost).length > 0;
}

/**
 * O número de símbolos coloridos de um custo, por cor.
 *
 * Conta pips e não cartas: `{B}{B}` são dois pretos. Um híbrido conta nas duas cores, pela mesma
 * razão que `colorDistribution` em `domain/deck.ts` — a pergunta é de quanto de cada cor se precisa.
 *
 * Existe para uma eventual estatística de exigência de cor. Não é usada ainda.
 */
export function pipCounts(cost: string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const symbol of parseManaCost(cost)) {
    for (const part of symbol.code.split('/')) {
      // O `P` de Phyrexian e os números não são cores.
      if (!/^[WUBRG]$/i.test(part)) continue;
      const color = part.toUpperCase();
      counts[color] = (counts[color] ?? 0) + 1;
    }
  }

  return counts;
}

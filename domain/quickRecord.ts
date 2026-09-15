/**
 * O registo rápido de um torneio inteiro: uma sequência de W/L/D que vira rondas. Puro, sem I/O —
 * ver CLAUDE.md § Convenções.
 *
 * **Porquê.** Uma parte do arquivo de torneios antigos não tem detalhe nenhum por ronda — sabe-se
 * que acabou 6-2 e mais nada. Sem isto, esse 6-2 não existia em lado nenhum: o recorde de um evento
 * calcula-se sempre a partir de `event.matches` (`calcEventStats`), e um evento com a lista vazia
 * aparece como 0-0 no cartão, na Home e no desempenho do deck.
 *
 * **Porquê uma sequência e não dois números.** Guardar `{ wins: 6, losses: 2 }` no ficheiro criaria
 * uma segunda fonte para a mesma verdade, e os seis sítios que somam matches teriam de saber das
 * duas. Em vez disso o registo rápido **gera as rondas**: a forma dos dados é a mesma que o registo
 * ronda a ronda produz, e daí para a frente nada na app sabe a diferença.
 *
 * A ordem é de quem escreve, incluindo quando é inventada: numa ronda suíça perder cedo ou perder
 * tarde não é a mesma coisa, e quem se lembra da ordem não devia ser obrigado a deitá-la fora. Quem
 * não se lembra põe as vitórias primeiro e não perde nada — o recorde é o mesmo.
 */
import type { Match, MatchResult } from '../types';

/**
 * Tecto de rondas do registo rápido.
 *
 * Não é uma regra de Magic nem do schema — o registo ronda a ronda não tem limite nenhum e um
 * torneio de 21 rondas continua a poder ser registado por aí. É só uma travagem para um dedo preso
 * não criar duzentas rondas de uma vez, e 20 chega com folga para qualquer suíço a sério.
 */
export const MAX_QUICK_ROUNDS = 20;

/** O recorde que uma sequência dá. É a mesma conta do `calcEventStats`, sobre a lista por gravar. */
export interface QuickRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** Acrescenta uma ronda ao fim, até ao tecto. Devolve a lista inalterada quando já lá está. */
export function appendResult(sequence: MatchResult[], result: MatchResult): MatchResult[] {
  if (sequence.length >= MAX_QUICK_ROUNDS) return sequence;
  return [...sequence, result];
}

/** Tira a última ronda. Numa lista vazia não faz nada — é o "apagar" do teclado. */
export function removeLast(sequence: MatchResult[]): MatchResult[] {
  return sequence.slice(0, -1);
}

/** Quantas vitórias, derrotas e empates a sequência tem. */
export function recordOf(sequence: MatchResult[]): QuickRecord {
  return {
    wins: sequence.filter(result => result === 'W').length,
    losses: sequence.filter(result => result === 'L').length,
    draws: sequence.filter(result => result === 'D').length,
  };
}

/**
 * A sequência como rondas prontas a gravar, a começar em `startRound`.
 *
 * **São rondas nuas de propósito.** Sem adversário (`opponentId` ausente quer dizer "não registado",
 * e nunca uma pessoa chamada Unknown — CLAUDE.md § Os dados), sem cores do adversário, sem games e
 * sem quem jogou primeiro. Nada disso se sabe num torneio carregado de memória, e escrever um valor
 * por omissão em qualquer um deles seria inventar um facto.
 *
 * `opponentColors` vai vazio e não ausente porque o schema exige o campo no match. Uma selecção
 * vazia é o que a app já escreve quando ninguém toca nos pips, portanto não é um caso novo.
 *
 * `startRound` é `event.matches.length + 1`: o registo rápido **acrescenta** ao que lá está, como o
 * registo normal, em vez de substituir. Quem registou três rondas à mão e se lembrou do resto do
 * torneio não perde as três.
 */
export function bareMatches(sequence: MatchResult[], startRound = 1): Match[] {
  return sequence.map((result, index) => ({
    round: startRound + index,
    opponentColors: { main: [], splash: [] },
    result,
  }));
}

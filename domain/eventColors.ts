/**
 * As cores de um evento, e de onde elas vêm. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * Existe porque a pergunta "com que cores é que joguei este torneio" tinha três respostas espalhadas
 * por três écrans, e as três liam `event.deckColors` directamente — um campo que estava marcado como
 * legado e que nada escrevia. O resultado era um evento criado pela app sem pips em lado nenhum e
 * fora das estatísticas por cor. O porquê todo está em
 * docs/adr/0013-as-cores-do-evento-sao-registo-proprio.md.
 *
 * A precedência é a do ADR, e vive aqui e em mais lado nenhum:
 *
 *   1. as cores escritas à mão no evento;
 *   2. senão, as do deck ligado;
 *   3. senão, nada.
 *
 * O degrau 1 ganha de propósito: a decklist sabe que cartas lá estão, mas **não sabe o que foi
 * splash** — isso é uma leitura de quem jogou o torneio, e um torneio retroactivo nem deck tem.
 */
import type { Deck, Event, ManaColor, ManaSelection } from '../types';

/**
 * Se uma selecção diz alguma coisa.
 *
 * `{ main: [], splash: [] }` é uma selecção vazia e conta como ausência: o serializador já a deixa
 * cair antes do ficheiro, mas o estado em memória pode tê-la depois de alguém limpar os pips, e uma
 * selecção vazia a ganhar ao deck ligado apagava as cores dele sem ninguém ter escrito nada.
 */
export function hasColors(selection: ManaSelection | undefined): selection is ManaSelection {
  if (!selection) return false;
  return selection.main.length > 0 || selection.splash.length > 0;
}

/**
 * As cores por que um evento se desenha, ou `undefined` quando não há nenhumas.
 *
 * Quem desenha não mostra pips nenhuns nesse caso — e não cinco pips apagados, que sugeririam uma
 * escolha que ninguém fez.
 */
export function eventColors(event: Event, decks: Deck[]): ManaSelection | undefined {
  if (hasColors(event.deckColors)) return event.deckColors;

  const linked = event.deckId ? decks.find(deck => deck.id === event.deckId) : undefined;
  if (hasColors(linked?.colors)) return linked.colors;

  return undefined;
}

/** `true` quando as cores do evento foram escritas à mão, e não herdadas do deck. */
export function hasOwnColors(event: Event): boolean {
  return hasColors(event.deckColors);
}

/**
 * Se um evento conta para a estatística de uma cor.
 *
 * **Só as principais contam.** Um splash de vermelho em duas cartas não faz do torneio um torneio
 * vermelho, e contá-lo diluía a única pergunta que a secção responde: como é que corre com cada cor
 * a sério. É a mesma regra que lá estava antes do ADR 0013 — o que muda é a cor passar a ser
 * encontrada também pelo deck ligado, e não só pelo campo escrito à mão.
 */
export function eventPlaysColor(event: Event, decks: Deck[], color: ManaColor): boolean {
  return eventColors(event, decks)?.main.includes(color) ?? false;
}

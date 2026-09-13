/**
 * Procura no arquivo de eventos — o predicado, sem interface e sem rede.
 *
 * A procura é local, sobre o que já está no store: numa loja de cartas não há rede, e mesmo que
 * houvesse, pedir uma lista que já está em memória era tempo perdido.
 *
 * Procura-se por três coisas, que são as três maneiras de alguém se lembrar de um torneio: o nome do
 * evento, o sítio onde foi, e quem lá se enfrentou ("aquele FNM em que joguei contra o João").
 */
import type { Event } from '../types';

/** Minúsculas e sem acentos — "João" tem de ser encontrado por "joao". Mesmo princípio de `domain/slug.ts`. */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * O texto de um evento onde a procura vai bater: nome, local e o nome de cada adversário.
 *
 * Os adversários chegam já resolvidos do store (`Match.opponent`) — no ficheiro são referências, mas
 * procurar por `joao-ferreira` não era o que ninguém escreveria.
 */
function haystack(event: Event): string {
  const parts = [event.name, event.location ?? '', ...event.matches.map(match => match.opponent ?? '')];
  return normalizeText(parts.join(' '));
}

/**
 * Parte a procura em termos e exige que **todos** apareçam.
 *
 * "fnm joao" tem de encontrar o FNM contra o João e não todos os FNM mais todos os torneios contra o
 * João — com poucas dezenas de eventos, um OR devolvia quase tudo e não servia de nada.
 */
export function matchesQuery(event: Event, query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(term => term.length > 0);
  if (terms.length === 0) return true;

  const text = haystack(event);
  return terms.every(term => text.includes(term));
}

/** Os eventos que correspondem, pela ordem em que vieram. Uma procura vazia devolve tudo. */
export function searchEvents(events: Event[], query: string): Event[] {
  if (query.trim().length === 0) return events;
  return events.filter(event => matchesQuery(event, query));
}

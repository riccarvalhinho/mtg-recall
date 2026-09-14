/**
 * A posição final num torneio, e os escalões que se deduzem dela. Puro, sem I/O — ver
 * CLAUDE.md § Convenções.
 *
 * **Porque é que o ficheiro guarda a posição e não o escalão.** Registar um 5.º lugar entre 32 como
 * "Top 8" deita fora a única coisa que o distingue de um 8.º lugar, e ao fim de um ano de torneios
 * o registo só sabe dizer que se chegou lá — não onde. A posição é o facto; o escalão é uma leitura
 * do facto, e leituras calculam-se em runtime, como o win rate e os pontos (CLAUDE.md § Os dados).
 * O porquê todo está em docs/adr/0012-posicao-final-em-vez-de-escalao.md.
 *
 * **Um escalão só conta se o campo for maior do que ele.** Um 5.º lugar entre 6 jogadores é, à
 * letra, um Top 8 — mas o escalão inteiro era o torneio todo, e contá-lo encheria a pirâmide das
 * estatísticas de Top 8 que não significam nada. Por isso um escalão exige mais jogadores do que o
 * tamanho dele: Top 8 pede 9 ou mais. A excepção é ganhar, que conta sempre.
 */
import type { Event } from '../types';
import { isActive } from '../types';

// ─── Escalões ────────────────────────────────────────────────────────────────

/** Os escalões que existem, do melhor para o pior. `1` é ganhar o torneio. */
export const TIERS = [1, 2, 4, 8, 16, 32] as const;

export type Tier = (typeof TIERS)[number];

/** Como o escalão aparece na interface — em inglês, como toda a app. */
export function tierLabel(tier: Tier): string {
  return tier === 1 ? '1st Place' : `Top ${tier}`;
}

/**
 * O ordinal inglês de um número: 1st, 2nd, 3rd, 4th… e 11th, 12th, 13th, que são a excepção que
 * estraga a regra dos últimos dígitos (21st é 21st, mas 11th não é 11st).
 */
export function ordinal(position: number): string {
  if (!isPosition(position)) return String(position);

  const lastTwo = position % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`;

  switch (position % 10) {
    case 1:  return `${position}st`;
    case 2:  return `${position}nd`;
    case 3:  return `${position}rd`;
    default: return `${position}th`;
  }
}

/** Uma posição é um inteiro a partir de 1. Zero, negativos e decimais não são posições. */
function isPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/**
 * O escalão de uma posição, ou `null` quando não há nenhum a atribuir.
 *
 * Devolve `null` em três casos, e são todos deliberados:
 *  - a posição não é uma posição (ausente, zero, decimal);
 *  - a posição está fora do último escalão (33.º não é Top 32 coisa nenhuma);
 *  - o campo não era maior do que o escalão — a regra do cabeçalho deste ficheiro.
 *
 * Sem `playersCount` não há como recusar o escalão, e recusá-lo à cautela apagaria o resultado dos
 * eventos antigos, que é o contrário do que se quer: na dúvida, o escalão conta.
 */
export function tierFor(placement?: number, playersCount?: number): Tier | null {
  if (!isPosition(placement)) return null;

  const tier = TIERS.find(candidate => placement <= candidate);
  if (tier === undefined) return null;

  // Ganhar é ganhar, haja quantos jogadores houver.
  if (tier === 1) return 1;

  if (!isPosition(playersCount)) return tier;
  return playersCount > tier ? tier : null;
}

/**
 * O escalão de um evento antigo, lido da string `rank` que se escrevia antes do `placement`.
 *
 * Só serve para os eventos que já existiam: nada novo escreve `rank` (ADR 0012). Aceita as opções
 * que o écran de concluir oferecia e mais umas quantas formas de dizer o primeiro lugar, porque o
 * campo chegou a ser texto livre.
 */
export function legacyTier(rank?: string): Tier | null {
  const text = rank?.trim().toLowerCase();
  if (!text) return null;

  if (text === '1st' || text === '1st place' || text === 'first' || text === 'winner') return 1;

  const topMatch = /^top\s*(\d+)$/.exec(text);
  if (topMatch) {
    const size = Number(topMatch[1]);
    return TIERS.find(tier => tier === size) ?? null;
  }

  return null;
}

/**
 * O escalão de um evento: a posição manda, e a string antiga só entra quando não há posição.
 *
 * Havendo posição, ela decide **inclusive quando a resposta é "escalão nenhum"** — um 40.º entre
 * 128 não é Top coisa nenhuma, e deixar o `rank` antigo responder por cima disso era pôr uma
 * suposição à frente de um facto.
 */
export function eventTier(event: Event): Tier | null {
  if (isPosition(event.placement)) return tierFor(event.placement, event.playersCount);
  return legacyTier(event.rank);
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

/** O que o écran recolhe ao fechar um torneio. Ambos opcionais: um torneio antigo pode não saber. */
export interface EventStanding {
  placement?: number;
  playersCount?: number;
}

/**
 * Limpa uma classificação antes de ir para o ficheiro: o que não for posição não se escreve.
 *
 * Um campo mais pequeno do que a posição não pode ser verdade, e nesse caso é o número de jogadores
 * que cai — a posição é aquilo de que se tem a certeza, o campo é a estimativa. O écran já não
 * deixa gravar a contradição; isto é a rede por baixo, para dados antigos ou restaurados.
 *
 * Devolve sempre as duas chaves, com `undefined` onde não há valor, para que espalhar o resultado
 * por cima de um evento **apague** o que lá estava em vez de o deixar meio corrigido.
 */
export function cleanStanding(
  standing?: EventStanding,
): { placement: number | undefined; playersCount: number | undefined } {
  const raw = standing ?? {};
  const placement = isPosition(raw.placement) ? raw.placement : undefined;
  let playersCount = isPosition(raw.playersCount) ? raw.playersCount : undefined;

  if (placement !== undefined && playersCount !== undefined && playersCount < placement) {
    playersCount = undefined;
  }

  return { placement, playersCount };
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * Como a posição aparece na interface: "5th of 32", ou só "5th" quando não se registou o campo.
 *
 * Um evento sem posição cai no `rank` antigo, tal e qual como foi escrito. Sem nada, `undefined` —
 * e quem desenha não mostra linha nenhuma, em vez de mostrar um travessão.
 */
export function formatPlacement(event: Event): string | undefined {
  if (!isPosition(event.placement)) return event.rank?.trim() || undefined;

  const position = ordinal(event.placement);
  return isPosition(event.playersCount) ? `${position} of ${event.playersCount}` : position;
}

/**
 * Quanto do campo ficou atrás, de 0 a 1. É isto que torna dois torneios comparáveis: um 5.º lugar
 * entre 32 (0.87) foi mais difícil do que um 5.º entre 8 (0.43), e a posição sozinha não o diz.
 *
 * `null` quando falta a posição, falta o campo, ou os dois números não podem ser verdade ao mesmo
 * tempo. Num torneio de um jogador só não há campo nenhum a bater, e ganhar vale 1.
 */
export function fieldStrength(placement?: number, playersCount?: number): number | null {
  if (!isPosition(placement) || !isPosition(playersCount)) return null;
  if (placement > playersCount) return null;
  if (playersCount === 1) return 1;

  return (playersCount - placement) / (playersCount - 1);
}

/**
 * Quanto do campo um escalão deixa supor, quando é só o escalão que se sabe.
 *
 * É uma **aproximação**, e por isso quem a usa marca o valor como estimado: "Top 8" sem número de
 * jogadores tanto pode ser 0.5 do campo como 0.99, e fingir que sabemos qual seria pior do que
 * deixar o evento de fora. A escada só existe para os eventos antigos continuarem a aparecer no
 * gráfico em vez de desaparecerem no dia em que o campo passou a registar-se.
 */
const TIER_STRENGTH: Record<Tier, number> = {
  1:  1.00,
  2:  0.92,
  4:  0.82,
  8:  0.68,
  16: 0.50,
  32: 0.30,
};

export interface TrendPoint {
  /** 0 a 1 — a fracção do campo que ficou atrás. */
  value: number;
  /** `true` quando o valor saiu do escalão e não de dois números a sério. */
  estimated: boolean;
}

/**
 * O ponto de um evento no gráfico de tendência, ou `null` se o evento não tem resultado nenhum.
 *
 * Eventos a decorrer ficam de fora: ainda não têm posição, e a que viessem a ter não é esta.
 */
export function trendPoint(event: Event): TrendPoint | null {
  if (isActive(event)) return null;

  const measured = fieldStrength(event.placement, event.playersCount);
  if (measured !== null) return { value: measured, estimated: false };

  const tier = eventTier(event);
  if (tier !== null) return { value: TIER_STRENGTH[tier], estimated: true };

  return null;
}

// ─── Contas sobre vários eventos ─────────────────────────────────────────────

/** Um evento tem resultado final se tem posição registada ou escalão que se lhe deduza. */
export function hasStanding(event: Event): boolean {
  return isPosition(event.placement) || eventTier(event) !== null;
}

/**
 * Quantos eventos caíram em cada escalão, mais os que ficaram de fora de todos.
 *
 * `outside` são os eventos com posição registada a que não coube escalão nenhum — o 5.º entre 6, o
 * 40.º entre 128. Contam como resultado (a pirâmide divide por eles), só não contam como Top.
 */
export function tierCounts(events: Event[]): { byTier: Record<Tier, number>; outside: number; total: number } {
  const byTier = { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0, 32: 0 } as Record<Tier, number>;
  let outside = 0;
  let total = 0;

  for (const event of events) {
    if (isActive(event) || !hasStanding(event)) continue;

    total += 1;
    const tier = eventTier(event);
    if (tier === null) outside += 1;
    else byTier[tier] += 1;
  }

  return { byTier, outside, total };
}

/**
 * O melhor resultado de sempre, já formatado — "1st of 24".
 *
 * Melhor é o que deixou mais campo para trás, e não a posição mais baixa: um 2.º entre 64 (0.98)
 * vale mais do que um 5.º entre 8 (0.43), que a posição sozinha diria ao contrário. Ganhar deixa
 * sempre o campo todo atrás, portanto nenhum segundo lugar ultrapassa uma vitória — e entre
 * vitórias o desempate é o tamanho do torneio, que é a única coisa que as separa. Eventos que só
 * têm escalão entram pela estimativa, o mesmo critério do gráfico.
 */
export function bestFinish(events: Event[]): string | undefined {
  let best: { event: Event; value: number; players: number } | undefined;

  for (const event of events) {
    if (isActive(event) || !hasStanding(event)) continue;

    const point = trendPoint(event);
    if (point === null) continue;

    const players = isPosition(event.playersCount) ? event.playersCount : 0;
    if (!best || point.value > best.value || (point.value === best.value && players > best.players)) {
      best = { event, value: point.value, players };
    }
  }

  return best && formatPlacement(best.event);
}

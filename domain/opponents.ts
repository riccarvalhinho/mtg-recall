/**
 * Contas sobre adversários. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * Os matches guardam uma referência para `data/taxonomies/opponents.json` (`opponentId`) e o nome já
 * resolvido só para a interface (`opponent`). É a referência que manda aqui dentro: duas grafias do
 * mesmo nome dariam duas pessoas se as contas fossem feitas por texto.
 *
 * Nada disto é guardado em ficheiro: calcula-se em runtime, como o win rate dos eventos
 * (CLAUDE.md § Os dados).
 */
import type { Event, Match, Opponent } from '../types';

// ─── Registo ─────────────────────────────────────────────────────────────────

export interface OpponentRecord {
  opponentId: string;
  /** Nome como aparece no encontro mais recente. Vazio quando nunca houve encontro nenhum. */
  name: string;
  /** Matches contra esta pessoa, somados todos os eventos. */
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0–100, arredondado. Sem encontros dá 0. */
  winRate: number;
  /** Eventos distintos em que a enfrentei — dois torneios diferentes contam dois. */
  events: number;
  /** Data do encontro mais recente (AAAA-MM-DD), ou `null` se nunca houve. */
  lastPlayed: string | null;
}

/** Um encontro: o match e o evento a que pertence, que sozinho não diz quando foi. */
export interface HeadToHeadEntry {
  event: Event;
  match: Match;
}

/**
 * Todos os matches contra uma pessoa, do mais recente para o mais antigo.
 *
 * A ordem é a da data do evento; dentro do mesmo dia manda o id do evento (que começa pela data e
 * portanto é estável) e, dentro do mesmo evento, a ronda mais alta é a mais recente.
 */
export function headToHead(opponentId: string, events: Event[]): HeadToHeadEntry[] {
  const entries: HeadToHeadEntry[] = [];

  for (const event of events) {
    for (const match of event.matches) {
      if (match.opponentId === opponentId) entries.push({ event, match });
    }
  }

  return entries.sort((a, b) => {
    if (a.event.date !== b.event.date) return a.event.date < b.event.date ? 1 : -1;
    if (a.event.id !== b.event.id) return a.event.id < b.event.id ? 1 : -1;
    return b.match.round - a.match.round;
  });
}

/**
 * O registo contra uma pessoa, somando os matches de todos os eventos.
 *
 * Um adversário sem nenhum match dá zeros em vez de rebentar: um match apagado deixa a referência
 * na taxonomia, e isso é normal, não é um erro.
 */
export function opponentRecord(opponentId: string, events: Event[]): OpponentRecord {
  const history = headToHead(opponentId, events);

  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const { match } of history) {
    if (match.result === 'W') wins += 1;
    else if (match.result === 'L') losses += 1;
    else draws += 1;
  }

  const played = history.length;
  const eventIds = new Set(history.map((entry) => entry.event.id));

  return {
    opponentId,
    name: history[0]?.match.opponent ?? '',
    played,
    wins,
    losses,
    draws,
    winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
    events: eventIds.size,
    lastPlayed: history[0]?.event.date ?? null,
  };
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

/**
 * O registo contra cada adversário, do mais enfrentado para o menos.
 *
 * **Porquê ordenar por número de encontros e não por win rate.** O win rate é a ordenação óbvia e é
 * a errada: quem se enfrentou uma vez e ganhou fica com 100% e vai parar ao topo, à frente de um
 * rival de vinte jogos a 55%. O número de encontros não tem esse problema — é uma contagem, não uma
 * média, e não se deixa inflacionar por uma amostra de um. É também a pergunta que a lista faz:
 * quem é que eu enfrento mais vezes. O win rate entra só a desempatar, e a seguir o encontro mais
 * recente.
 *
 * **Porquê não há mínimo de encontros aqui.** Esconder metade da lista para proteger uma média que
 * a lista nem usa para ordenar seria perder informação real — e num registo pessoal, com poucos
 * eventos, quase toda a lista ficaria de fora. O mínimo existe onde faz falta: no `nemesis` e no
 * `favouriteMatchup`, que são médias e só essas.
 *
 * Adversários ainda sem matches ficam no fim em vez de desaparecerem, como em `rankDecks`.
 */
export function rankOpponents(opponents: Opponent[], events: Event[]): OpponentRecord[] {
  return opponents
    .map((opponent) => ({
      // A taxonomia é a fonte de verdade do nome: o match guarda o nome como estava no dia em que
      // foi registado, e renomear uma pessoa não reescreve os eventos antigos.
      ...opponentRecord(opponent.id, events),
      name: opponent.name,
    }))
    .sort((a, b) => {
      if (a.played !== b.played) return b.played - a.played;
      if (a.winRate !== b.winRate) return b.winRate - a.winRate;
      if (a.lastPlayed !== b.lastPlayed) {
        if (a.lastPlayed === null) return 1;
        if (b.lastPlayed === null) return -1;
        return a.lastPlayed < b.lastPlayed ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
}

// ─── Destaques ───────────────────────────────────────────────────────────────

/**
 * Mínimo de encontros para alguém poder ser nemesis ou melhor matchup.
 *
 * Com um ou dois encontros o win rate não é uma média, é o resultado do último jogo com outro nome:
 * só pode dar 0%, 50% ou 100%. Três é o primeiro número onde uma tendência se distingue do acaso, e
 * é baixo de propósito — num registo pessoal os adversários repetem-se devagar, e exigir cinco ou
 * dez deixaria a secção vazia durante meses, que é a maneira mais certa de ninguém voltar a olhar
 * para ela.
 */
export const MIN_HIGHLIGHT_ENCOUNTERS = 3;

/** Os registos com encontros que cheguem para a média dizer alguma coisa, já ordenados. */
function highlightCandidates(opponents: Opponent[], events: Event[]): OpponentRecord[] {
  return rankOpponents(opponents, events).filter(
    (record) => record.played >= MIN_HIGHLIGHT_ENCOUNTERS,
  );
}

/**
 * O adversário contra quem o registo é pior, de entre os suficientemente enfrentados.
 *
 * `null` quando ninguém chega ao mínimo — que é o caso normal nos primeiros torneios, e não uma
 * falha a esconder.
 *
 * Empates de win rate vão para quem se enfrentou mais vezes: `highlightCandidates` já vem por
 * ordem de encontros e o `reduce` só troca quando encontra estritamente pior, portanto o primeiro
 * empatado aguenta o lugar. Perder três vezes em dez contra a mesma pessoa é mais nemesis do que
 * perder uma em três.
 */
export function nemesis(opponents: Opponent[], events: Event[]): OpponentRecord | null {
  const candidates = highlightCandidates(opponents, events);
  if (candidates.length === 0) return null;
  return candidates.reduce((worst, record) => (record.winRate < worst.winRate ? record : worst));
}

/** O espelho do `nemesis`: o melhor registo, com o mesmo mínimo e o mesmo critério de desempate. */
export function favouriteMatchup(opponents: Opponent[], events: Event[]): OpponentRecord | null {
  const candidates = highlightCandidates(opponents, events);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, record) => (record.winRate > best.winRate ? record : best));
}

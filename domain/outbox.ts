/**
 * Fila de escritas por enviar para o GitHub. Ver docs/adr/0004-escrita-via-github-api-com-outbox.md.
 *
 * Tudo aqui é puro: recebe a fila e devolve uma fila nova. Quem persiste e quem fala com a rede é
 * `services/outbox.ts`. Foi assim de propósito — a ADR avisa que é aqui que vão aparecer os bugs
 * difíceis, e um módulo sem I/O testa-se sem simular rede nenhuma.
 *
 * ## A unidade é o ficheiro, não a alteração
 *
 * Uma entrada da fila é "este ficheiro passa a ter este conteúdo", e a chave é o caminho. Registar
 * cinco rondas do mesmo torneio antes de haver rede deixa **uma** entrada, com o evento completo — e
 * portanto um commit, não cinco. É a resposta ao "a vigiar: o número de commits" da ADR.
 *
 * Funciona porque cada ficheiro é escrito por inteiro a partir do estado local. Não há fusão parcial
 * a fazer.
 */

export interface OutboxEntry {
  /** Caminho no repositório, ex.: `data/events/2026-04-12-fnm-sealed.json`. É a chave da fila. */
  path: string;
  /** Conteúdo completo do ficheiro, já serializado. `null` significa apagar o ficheiro. */
  content: string | null;
  /** Mensagem do commit. */
  message: string;
  /** Quando entrou na fila pela primeira vez. Alimenta o "à espera há 5 minutos". */
  queuedAt: number;
  /** Tentativas falhadas desde a última alteração. */
  attempts: number;
  /** Instante a partir do qual vale a pena tentar outra vez. */
  retryAfter?: number;
  /** O que correu mal da última vez, para a interface poder dizer. */
  lastError?: string;
}

/** O que a interface precisa de saber para dizer como está a sincronização. */
export interface OutboxStatus {
  pending: number;
  /** Erro mais recente de alguma entrada, se houver. */
  lastError?: string;
  /** Quando a entrada mais antiga entrou na fila. */
  oldestQueuedAt?: number;
}

const BASE_BACKOFF_MS = 2_000;

/**
 * Tecto de cinco minutos.
 *
 * Sem tecto, um torneio inteiro sem rede levava o intervalo a horas, e a app ficaria com o evento
 * por enviar durante muito tempo depois de haver rede outra vez. Cinco minutos é curto para não
 * desistir e longo para não martelar a API.
 */
const MAX_BACKOFF_MS = 5 * 60_000;

export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

/**
 * Põe um ficheiro na fila, substituindo o que lá estivesse para o mesmo caminho.
 *
 * A data de entrada é a da primeira vez, para o "à espera há X" ser honesto. As tentativas voltam a
 * zero: o conteúdo é outro, e a falha anterior pode nem se aplicar ao novo.
 */
export function enqueue(
  queue: OutboxEntry[],
  file: { path: string; content: string | null; message: string },
  now: number,
): OutboxEntry[] {
  const existing = queue.find((entry) => entry.path === file.path);
  const replacement: OutboxEntry = {
    path: file.path,
    content: file.content,
    message: file.message,
    queuedAt: existing?.queuedAt ?? now,
    attempts: 0,
  };

  return existing
    ? queue.map((entry) => (entry.path === file.path ? replacement : entry))
    : [...queue, replacement];
}

/** As entradas que já podem ser tentadas, por ordem de entrada na fila. */
export function dueEntries(queue: OutboxEntry[], now: number): OutboxEntry[] {
  return queue
    .filter((entry) => entry.retryAfter === undefined || entry.retryAfter <= now)
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Tira uma entrada da fila depois de enviada.
 *
 * Compara o conteúdo: se mudou enquanto o pedido estava em voo, a entrada fica, porque o que foi
 * enviado já não é o que está no ecrã. Sem isto, registar um match durante uma sincronização
 * perdia-o.
 */
export function markSent(queue: OutboxEntry[], path: string, sentContent: string | null): OutboxEntry[] {
  return queue.filter((entry) => !(entry.path === path && entry.content === sentContent));
}

export function markFailed(
  queue: OutboxEntry[],
  path: string,
  error: string,
  now: number,
): OutboxEntry[] {
  return queue.map((entry) => {
    if (entry.path !== path) return entry;
    const attempts = entry.attempts + 1;
    return { ...entry, attempts, lastError: error, retryAfter: now + backoffMs(attempts) };
  });
}

export function outboxStatus(queue: OutboxEntry[]): OutboxStatus {
  if (queue.length === 0) return { pending: 0 };

  const failed = queue.filter((entry) => entry.lastError !== undefined);
  const lastError = failed.sort((a, b) => (b.retryAfter ?? 0) - (a.retryAfter ?? 0))[0]?.lastError;

  return {
    pending: queue.length,
    lastError,
    oldestQueuedAt: Math.min(...queue.map((entry) => entry.queuedAt)),
  };
}

/** Caminhos dos ficheiros que a app sabe escrever. Um sítio só, para não os espalhar em strings. */
export const repoPaths = {
  event: (id: string) => `data/events/${id}.json`,
  opponents: 'data/taxonomies/opponents.json',
} as const;

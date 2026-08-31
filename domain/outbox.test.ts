import { describe, expect, it } from 'vitest';
import {
  backoffMs,
  dueEntries,
  enqueue,
  markFailed,
  markSent,
  outboxStatus,
  type OutboxEntry,
} from './outbox.ts';

const file = (path: string, content: string | null = '{}') => ({
  path,
  content,
  message: `guarda ${path}`,
});

describe('enqueue', () => {
  it('acumula ficheiros diferentes', () => {
    const queue = enqueue(enqueue([], file('a.json'), 1), file('b.json'), 2);
    expect(queue.map((entry) => entry.path)).toEqual(['a.json', 'b.json']);
  });

  it('coalesce o mesmo ficheiro numa entrada só', () => {
    // É isto que faz um torneio inteiro sem rede dar um commit e não cinco.
    let queue = enqueue([], file('a.json', '{"round":1}'), 1);
    queue = enqueue(queue, file('a.json', '{"round":2}'), 2);
    queue = enqueue(queue, file('a.json', '{"round":3}'), 3);

    expect(queue).toHaveLength(1);
    expect(queue[0].content).toBe('{"round":3}');
  });

  it('mantém a hora da primeira entrada, para o "à espera há X" ser honesto', () => {
    const queue = enqueue(enqueue([], file('a.json'), 100), file('a.json', '{"novo":true}'), 500);
    expect(queue[0].queuedAt).toBe(100);
  });

  it('põe as tentativas a zero quando o conteúdo muda', () => {
    const failed = markFailed(enqueue([], file('a.json'), 0), 'a.json', 'erro', 0);
    expect(failed[0].attempts).toBe(1);

    const requeued = enqueue(failed, file('a.json', '{"outro":true}'), 10);
    expect(requeued[0].attempts).toBe(0);
    expect(requeued[0].retryAfter).toBeUndefined();
  });

  it('trata um apagar como qualquer outra escrita', () => {
    const queue = enqueue(enqueue([], file('a.json', '{}'), 1), file('a.json', null), 2);
    expect(queue).toHaveLength(1);
    expect(queue[0].content).toBeNull();
  });
});

describe('backoffMs', () => {
  it('duplica a cada tentativa', () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(3)).toBe(8_000);
  });

  it('não passa de cinco minutos', () => {
    // Sem tecto, uma noite sem rede levava o intervalo a horas e a app ficava parada de manhã.
    expect(backoffMs(50)).toBe(5 * 60_000);
  });
});

describe('dueEntries', () => {
  it('esconde as que ainda estão de castigo', () => {
    const queue = markFailed(enqueue([], file('a.json'), 0), 'a.json', 'sem rede', 0);
    expect(dueEntries(queue, 1_000)).toHaveLength(0);
    expect(dueEntries(queue, 2_001)).toHaveLength(1);
  });

  it('devolve as mais antigas primeiro, e não pela ordem do array', () => {
    let queue = enqueue([], file('b.json'), 200);
    queue = enqueue(queue, file('a.json'), 100);
    expect(dueEntries(queue, 300).map((entry) => entry.path)).toEqual(['a.json', 'b.json']);
  });
});

describe('markSent', () => {
  it('tira a entrada quando o conteúdo enviado ainda é o actual', () => {
    const queue = enqueue([], file('a.json', '{"v":1}'), 0);
    expect(markSent(queue, 'a.json', '{"v":1}')).toHaveLength(0);
  });

  it('mantém a entrada se o ficheiro mudou durante o envio', () => {
    // Registar um match enquanto a sincronização está em voo não se pode perder.
    const queue = enqueue(enqueue([], file('a.json', '{"v":1}'), 0), file('a.json', '{"v":2}'), 5);
    const after = markSent(queue, 'a.json', '{"v":1}');
    expect(after).toHaveLength(1);
    expect(after[0].content).toBe('{"v":2}');
  });

  it('tira uma entrada de apagar', () => {
    const queue = enqueue([], file('a.json', null), 0);
    expect(markSent(queue, 'a.json', null)).toHaveLength(0);
  });
});

describe('outboxStatus', () => {
  it('diz que não há nada quando a fila está vazia', () => {
    expect(outboxStatus([])).toEqual({ pending: 0 });
  });

  it('conta as pendentes e mostra o erro mais recente', () => {
    let queue: OutboxEntry[] = enqueue([], file('a.json'), 100);
    queue = enqueue(queue, file('b.json'), 200);
    queue = markFailed(queue, 'b.json', 'O token expirou.', 300);

    const status = outboxStatus(queue);
    expect(status.pending).toBe(2);
    expect(status.lastError).toBe('O token expirou.');
    expect(status.oldestQueuedAt).toBe(100);
  });
});

/**
 * A fila de escritas, do lado que tem estado: persistência e o worker que a esvazia.
 *
 * A lógica de decidir — o que coalesce, quando vale a pena tentar outra vez, o que já está enviado —
 * vive em `domain/outbox.ts`, pura e testada. Aqui só há I/O e temporizadores. Ver
 * docs/adr/0004-escrita-via-github-api-com-outbox.md.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import {
  dueEntries,
  enqueue,
  markFailed,
  markSent,
  outboxStatus,
  type OutboxEntry,
  type OutboxStatus,
} from '../domain/outbox';
import { readToken, writeFile } from './github';

const QUEUE_KEY = 'mtgrecall.outbox';

/** Rede de segurança: mesmo que nenhum evento dispare, tenta de meio em meio minuto. */
const SWEEP_MS = 30_000;

let queue: OutboxEntry[] = [];
let loaded = false;
let flushing = false;
let started = false;
let sweep: ReturnType<typeof setInterval> | undefined;

export interface SyncState extends OutboxStatus {
  /** Sem token não há sincronização — e a interface tem de o poder dizer. */
  hasToken: boolean;
  /** Há um envio em curso agora. */
  syncing: boolean;
}

let hasToken = false;

const listeners = new Set<(state: SyncState) => void>();

export function currentState(): SyncState {
  return { ...outboxStatus(queue), hasToken, syncing: flushing };
}

function notify(): void {
  const state = currentState();
  for (const listener of listeners) listener(state);
}

export function subscribe(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  listener(currentState());
  return () => listeners.delete(listener);
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify();
}

async function load(): Promise<void> {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (raw) {
    try {
      queue = JSON.parse(raw) as OutboxEntry[];
    } catch {
      // Uma fila corrompida não pode impedir a app de abrir. Perde-se o que estava por enviar; os
      // dados em si estão no localStore e voltam a ser enviados na próxima alteração.
      console.warn('[outbox] Fila ilegível — a começar do zero.');
      queue = [];
    }
  }
  loaded = true;
}

/**
 * Põe um ficheiro na fila e tenta enviar já.
 *
 * `content: null` significa apagar. Quem chama não espera pelo envio: o écran já foi actualizado a
 * partir do estado local muito antes disto.
 */
export async function enqueueFile(file: {
  path: string;
  content: string | null;
  message: string;
}): Promise<void> {
  await load();
  queue = enqueue(queue, file, Date.now());
  await persist();
  void flush();
}

/**
 * Tenta enviar tudo o que já pode ser tentado.
 *
 * Um envio de cada vez: dois flushes em paralelo sobre o mesmo ficheiro pisavam-se no `sha` e o
 * segundo falhava sempre por conflito.
 */
export async function flush(): Promise<void> {
  if (flushing) return;

  await load();
  if (queue.length === 0) return;

  const token = await readToken();
  hasToken = Boolean(token);
  if (!token) {
    notify();
    return;
  }

  flushing = true;
  notify();

  try {
    for (const entry of dueEntries(queue, Date.now())) {
      try {
        await writeFile({ path: entry.path, content: entry.content, message: entry.message }, token);
        queue = markSent(queue, entry.path, entry.content);
      } catch (error) {
        queue = markFailed(queue, entry.path, (error as Error).message, Date.now());
      }
      await persist();
    }
  } finally {
    flushing = false;
    notify();
  }
}

function onAppStateChange(state: AppStateStatus): void {
  // O momento que mais interessa num telemóvel: a app passa a maior parte do tempo em segundo
  // plano, e voltar a ela é quase sempre quando há rede outra vez.
  if (state === 'active') void flush();
}

/** Liga os disparos automáticos. Chamado uma vez, do layout raiz. */
export async function start(): Promise<void> {
  if (started) return;
  started = true;

  await load();
  hasToken = Boolean(await readToken());
  notify();

  AppState.addEventListener('change', onAppStateChange);

  try {
    Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable !== false) void flush();
    });
  } catch (error) {
    // Sem eventos de rede a app continua a sincronizar — só depende da varredura e do regresso ao
    // primeiro plano.
    console.warn('[outbox] Sem eventos de rede:', error);
  }

  sweep ??= setInterval(() => void flush(), SWEEP_MS);

  void flush();
}

/** Depois de mudar o token nas Definições, vale a pena tentar outra vez sem esperar. */
export async function tokenChanged(): Promise<void> {
  hasToken = Boolean(await readToken());
  notify();
  void flush();
}

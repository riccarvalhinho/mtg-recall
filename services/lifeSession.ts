/**
 * A partida que está a ser contada, guardada no telemóvel.
 *
 * Não é registo e por isso não vive em `data/` — ADR 0011, pela mesma fronteira do ADR 0010. O que
 * fica no ficheiro do evento é só a vida com que cada game acabou, e só quando o match for
 * registado; isto aqui é o jogo a meio.
 *
 * Existe por uma razão prática: entre a ronda 3 e a 4 o telemóvel vai para o bolso, o Android mata
 * a app para poupar bateria, e sem isto voltava-se a 20-20 no meio de um jogo. É a diferença entre
 * o contador servir numa loja e ser um brinquedo.
 *
 * Como as preferências, **nunca atira**. Uma sessão ilegível é o mesmo que não haver sessão: o
 * contador abre num jogo novo, que é sempre melhor do que não abrir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStoredSession, type LifeSession, type StoredSession } from '../domain/lifeCounter';

const SESSION_KEY = 'mtgrecall.lifeCounter.session';

/** O que está guardado, ou `undefined` se não houver nada de jeito. */
export async function readStoredSession(): Promise<StoredSession | undefined> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;

    const value: unknown = JSON.parse(raw);
    return isStoredSession(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Guarda a partida a decorrer. `key` diz a que ronda pertence — `null` numa partida casual. */
export async function writeStoredSession(key: string | null, session: LifeSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ key, session }));
  } catch (error) {
    console.warn('[lifeSession] não foi possível guardar a partida a decorrer:', error);
  }
}

/**
 * Apaga a partida guardada.
 *
 * Chama-se quando o contador entrega os games ao registo e quando se começa de novo: uma partida
 * já registada que voltasse a aparecer seria pior do que não haver memória nenhuma.
 */
export async function clearStoredSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('[lifeSession] não foi possível limpar a partida guardada:', error);
  }
}

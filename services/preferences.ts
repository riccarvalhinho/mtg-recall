/**
 * As preferências da app — o que é gosto, e não registo.
 *
 * Vivem no AsyncStorage e **não** em `data/`. A distinção é a que vale a pena guardar: `data/` é o
 * que aconteceu — torneios, matches, decks, colecção —, e isso é para durar, para ser versionado e
 * para se poder restaurar noutro telemóvel. Uma preferência de aparência não é nada disso; gravá-la
 * no repositório dava um commit por cada mudança de gosto e um schema a manter para nada. Está em
 * `docs/adr/0010-preferencias-locais-fora-dos-dados.md`.
 *
 * O custo assumido: um telemóvel novo começa sem preferências e escolhem-se outra vez. É uma vez
 * na vida do telemóvel, contra um commit de cada vez que se muda de ideias.
 *
 * Tudo aqui **nunca atira**. Uma preferência ilegível é o mesmo que não haver preferência nenhuma,
 * e a app abre à mesma — que é a regra 3, offline-first: nada disto pode estar entre o utilizador e
 * o registo de um match.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBasicLandPreference, type BasicLandPreference } from '../domain/basicLands';

const BASIC_LANDS_KEY = 'mtgrecall.preferences.basicLands';

/**
 * A colecção de básicos preferida, para os decks que não dizem de onde são.
 *
 * `undefined` quer dizer "sem preferência" — os básicos ficam com o placeholder, como ficavam antes
 * de isto existir.
 */
export async function readBasicLandPreference(): Promise<BasicLandPreference | undefined> {
  try {
    const raw = await AsyncStorage.getItem(BASIC_LANDS_KEY);
    if (!raw) return undefined;

    const value: unknown = JSON.parse(raw);
    return isBasicLandPreference(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Guarda a preferência. `undefined` apaga-a. */
export async function writeBasicLandPreference(
  preference: BasicLandPreference | undefined,
): Promise<void> {
  try {
    if (!preference) await AsyncStorage.removeItem(BASIC_LANDS_KEY);
    else await AsyncStorage.setItem(BASIC_LANDS_KEY, JSON.stringify(preference));
  } catch (error) {
    console.warn('[preferences] não foi possível guardar a preferência dos básicos:', error);
  }
}

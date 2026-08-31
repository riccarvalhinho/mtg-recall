/**
 * A cópia local dos ficheiros do repositório.
 *
 * É isto que a app lê para desenhar os écrans — nunca o GitHub. O GitHub é para onde as alterações
 * vão depois (ADR 0004), e a app tem de abrir e funcionar sem rede nenhuma.
 *
 * Guarda **o conteúdo dos ficheiros**, não objectos: a verdade é o texto que vai ser commitado, e
 * assim não há duas representações a divergir entre o que está no ecrã e o que está no repositório.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILE_PREFIX = 'mtgrecall.file:';
/** A lista de caminhos guardados. O AsyncStorage sabe listar chaves, mas não as nossas. */
const INDEX_KEY = 'mtgrecall.files';

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeIndex(paths: string[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...new Set(paths)].sort()));
}

const key = (path: string) => `${FILE_PREFIX}${path}`;

/** Todos os ficheiros guardados, do caminho para o conteúdo. */
export async function readAll(): Promise<Record<string, string>> {
  const paths = await readIndex();
  if (paths.length === 0) return {};

  const pairs = await AsyncStorage.multiGet(paths.map(key));
  const files: Record<string, string> = {};

  for (const [storageKey, value] of pairs) {
    if (value !== null) files[storageKey.slice(FILE_PREFIX.length)] = value;
  }

  return files;
}

export async function readFile(path: string): Promise<string | null> {
  return AsyncStorage.getItem(key(path));
}

export async function writeFile(path: string, content: string): Promise<void> {
  await AsyncStorage.setItem(key(path), content);
  await writeIndex([...(await readIndex()), path]);
}

export async function removeFile(path: string): Promise<void> {
  await AsyncStorage.removeItem(key(path));
  await writeIndex((await readIndex()).filter((entry) => entry !== path));
}

/**
 * Substitui tudo o que está guardado. É o que um restauro faz.
 *
 * Não passa pela outbox de propósito: estes ficheiros vieram do repositório, e reenviá-los seria
 * commitar o que já lá está.
 */
export async function replaceAll(files: Record<string, string>): Promise<void> {
  const previous = await readIndex();
  if (previous.length > 0) await AsyncStorage.multiRemove(previous.map(key));

  const entries = Object.entries(files);
  if (entries.length > 0) {
    await AsyncStorage.multiSet(entries.map(([path, content]) => [key(path), content]));
  }
  await writeIndex(entries.map(([path]) => path));
}

import fs from 'node:fs';
import path from 'node:path';
import { paths, rel } from './paths.mts';

export interface LoadedFile<T = unknown> {
  /** Caminho absoluto no disco. */
  file: string;
  /** Caminho relativo à raiz do repositório, para mensagens. */
  name: string;
  /** Nome do ficheiro sem extensão — usado para confirmar que bate certo com o id interno. */
  stem: string;
  data: T;
}

export function readJson<T = unknown>(file: string): LoadedFile<T> {
  const raw = fs.readFileSync(file, 'utf8');
  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`${rel(file)}: JSON inválido — ${(error as Error).message}`);
  }
  return { file, name: rel(file), stem: path.basename(file, '.json'), data };
}

export function readJsonDir<T = unknown>(dir: string): LoadedFile<T>[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => readJson<T>(path.join(dir, entry)));
}

/** Lê tudo o que está em data/, sem validar. Validar é trabalho do validate-data.mts. */
export function loadAll() {
  return {
    events: readJsonDir(paths.events),
    opponents: readJson(path.join(paths.taxonomies, 'opponents.json')),
  };
}

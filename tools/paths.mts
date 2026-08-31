import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const paths = {
  schemas: path.join(repoRoot, 'data', 'schema'),
  events: path.join(repoRoot, 'data', 'events'),
  taxonomies: path.join(repoRoot, 'data', 'taxonomies'),
  /** Onde o bundle é gerado. Não é commitado — o CI gera-o e publica-o no Pages. */
  bundleDir: path.join(repoRoot, 'site', 'data'),
} as const;

/** Caminho relativo à raiz do repositório, para mensagens de erro legíveis. */
export function rel(absolute: string): string {
  return path.relative(repoRoot, absolute);
}

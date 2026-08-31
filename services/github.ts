/**
 * Escrita de ficheiros no repositório, pela Contents API do GitHub.
 *
 * Ver docs/adr/0004-escrita-via-github-api-com-outbox.md. Só escreve — ler é o `bundle.json` do
 * Pages (services/sync.ts), que é um pedido em vez de um por evento.
 *
 * ## O token
 *
 * Um fine-grained personal access token, limitado a este repositório e a `Contents: read and write`,
 * guardado no `expo-secure-store` — que no Android é o keystore do sistema. **Nunca é commitado e
 * nunca sai daqui para lado nenhum além de api.github.com.**
 *
 * Quem tiver o telemóvel desbloqueado na mão consegue, com esforço, extraí-lo. É o risco assumido na
 * ADR: telemóvel pessoal, repositório pessoal, token limitado a um repositório e a uma permissão.
 * Mitiga-se com validade curta e revogação.
 */
import * as SecureStore from 'expo-secure-store';
import { toBase64 } from '../domain/base64';
import { repo } from './config';

const TOKEN_KEY = 'mtgrecall.githubToken';

export async function readToken(): Promise<string | undefined> {
  try {
    return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? undefined;
  } catch {
    // Armazenamento indisponível: a app funciona à mesma, só não sincroniza.
    return undefined;
  }
}

export async function writeToken(token: string | undefined): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.warn('[github] Não foi possível guardar o token:', error);
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

function apiUrl(path: string): string {
  // Os segmentos do caminho vão codificados, mas as barras têm de sobreviver.
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${encoded}`;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Mensagens em português para os erros que se podem mesmo resolver. */
function describe(status: number, fallback: string): string {
  if (status === 401) return 'O token não é válido ou expirou.';
  if (status === 403) return 'O token não tem permissão de escrita neste repositório.';
  if (status === 404) return 'Repositório ou ramo não encontrado. Confirma o token e o repositório.';
  if (status === 409 || status === 422) return 'O ficheiro mudou no GitHub entretanto.';
  if (status >= 500) return 'O GitHub está com problemas. Tenta mais tarde.';
  return fallback;
}

/** O `sha` da versão actual de um ficheiro, ou `undefined` se ainda não existir. */
async function currentSha(path: string, token: string): Promise<string | undefined> {
  const response = await fetch(`${apiUrl(path)}?ref=${encodeURIComponent(repo.branch)}`, {
    headers: headers(token),
    cache: 'no-store',
  });

  // Um ficheiro que ainda não existe não é erro: é o primeiro torneio a ser registado.
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new GitHubError(describe(response.status, 'Não foi possível ler o ficheiro.'), response.status);
  }

  const body = (await response.json()) as { sha?: string };
  return body.sha;
}

async function put(
  file: { path: string; content: string; message: string },
  token: string,
  sha: string | undefined,
): Promise<void> {
  const response = await fetch(apiUrl(file.path), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: file.message,
      content: toBase64(file.content),
      branch: repo.branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!response.ok) {
    throw new GitHubError(describe(response.status, `O GitHub respondeu ${response.status}.`), response.status);
  }
}

async function remove(
  file: { path: string; message: string },
  token: string,
  sha: string,
): Promise<void> {
  const response = await fetch(apiUrl(file.path), {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: file.message, sha, branch: repo.branch }),
  });

  if (!response.ok) {
    throw new GitHubError(describe(response.status, `O GitHub respondeu ${response.status}.`), response.status);
  }
}

/**
 * Escreve um ficheiro, criando-o se não existir. `content: null` apaga-o.
 *
 * Se o `sha` estiver desactualizado — o ficheiro mudou no GitHub desde que o lemos — relê e escreve
 * outra vez. **A última escrita ganha.** É o comportamento certo para um utilizador só (ADR 0006).
 *
 * Uma só repetição, de propósito: se falhar duas vezes seguidas por conflito, alguma coisa está a
 * escrever em ciclo e insistir aqui só esconde o problema. A entrada volta para a fila e o recuo
 * exponencial trata do resto.
 */
export async function writeFile(
  file: { path: string; content: string | null; message: string },
  token: string,
): Promise<void> {
  const attempt = async () => {
    const sha = await currentSha(file.path, token);

    if (file.content === null) {
      // Apagar um ficheiro que já não existe é o resultado que se queria.
      if (!sha) return;
      await remove(file, token, sha);
      return;
    }

    await put({ ...file, content: file.content }, token, sha);
  };

  try {
    await attempt();
  } catch (error) {
    const conflict = error instanceof GitHubError && (error.status === 409 || error.status === 422);
    if (!conflict) throw error;
    await attempt();
  }
}

/** Confirma que o token serve, para as Definições poderem dizer alguma coisa em vez de nada. */
export async function checkToken(token: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
      headers: headers(token),
      cache: 'no-store',
    });

    if (!response.ok) return { ok: false, reason: describe(response.status, `HTTP ${response.status}`) };

    const body = (await response.json()) as { permissions?: { push?: boolean } };
    return body.permissions?.push
      ? { ok: true }
      : { ok: false, reason: 'O token lê o repositório mas não tem permissão de escrita.' };
  } catch {
    return { ok: false, reason: 'Não foi possível falar com o GitHub. Há rede?' };
  }
}

/**
 * Onde é que os dados vivem.
 *
 * Vêm de variáveis de ambiente para o mesmo código servir uma bifurcação sem editar ficheiros, mas
 * os valores por omissão são os deste projecto — não há configuração obrigatória para pôr a
 * funcionar. Nada disto é segredo: o repositório é público (ADR 0005) e o token, esse, vive no
 * `expo-secure-store` e nunca aqui.
 */
export const repo = {
  owner: process.env.EXPO_PUBLIC_REPO_OWNER ?? 'riccarvalhinho',
  name: process.env.EXPO_PUBLIC_REPO_NAME ?? 'mtg-recall',
  branch: process.env.EXPO_PUBLIC_REPO_BRANCH ?? 'main',
} as const;

/**
 * O bundle publicado em GitHub Pages pelo workflow deploy-pages.yml.
 *
 * A app só lê isto quando é instalada de novo ou quando é preciso restaurar: um pedido a um ficheiro
 * estático, sem token e sem limite de rate.
 */
export const bundleUrl =
  process.env.EXPO_PUBLIC_BUNDLE_URL ??
  `https://${repo.owner.toLowerCase()}.github.io/${repo.name}/data/bundle.json`;

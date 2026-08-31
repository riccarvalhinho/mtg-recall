/**
 * Slugs — a forma como um nome vira um id de ficheiro ou de adversário.
 *
 * Vive aqui, em domain/, porque é usado dos dois lados: a app cria slugs quando regista um evento ou
 * um adversário novo, e o `npm run validate` verifica-os. Duas implementações acabariam por
 * divergir, e o dia em que divergissem seria o dia em que a app escreveria um ficheiro que o CI
 * recusa.
 */

/**
 * Minúsculas, sem acentos, com hífens em vez de tudo o resto.
 *
 * Os acentos são removidos em vez de traduzidos porque o alvo é um nome de ficheiro: "João" e "Joao"
 * têm de dar o mesmo id, senão o mesmo adversário aparece duas vezes nas estatísticas.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * O id de um evento: a data à frente, para o directório sair por ordem cronológica num `ls`.
 *
 * @param date data do torneio em AAAA-MM-DD
 * @param name nome do evento como o utilizador o escreveu
 */
export function eventId(date: string, name: string): string {
  const slug = slugify(name);
  return slug ? `${date}-${slug}` : `${date}-event`;
}

/**
 * Um id que ainda não esteja tomado, acrescentando -2, -3, … como qualquer sistema de ficheiros.
 * Existe para o caso de dois torneios no mesmo dia com o mesmo nome (open-questions Q4).
 */
export function uniqueId(candidate: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(candidate)) return candidate;

  let suffix = 2;
  while (used.has(`${candidate}-${suffix}`)) suffix += 1;
  return `${candidate}-${suffix}`;
}

/**
 * Formatação de datas de calendário. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * **Porque é que isto não usa o `Date`.** As datas do repositório são dias de calendário, escritos
 * como `AAAA-MM-DD` (ver `data-model.md`). O `new Date('2026-02-14')` não lê isso como um dia: lê
 * como o instante meia-noite **em UTC**, e depois o `getDate()` devolve esse instante no fuso do
 * telemóvel. Em Lisboa no Inverno dá o dia certo por sorte; em qualquer fuso negativo — ou em
 * Lisboa se o telemóvel estiver posto em fuso americano — dá o dia anterior. Um torneio de 14 de
 * Fevereiro aparecia como 13 de Fevereiro.
 *
 * A solução é não envolver o `Date` de todo: a string já tem as três peças, basta separá-las. Uma
 * data que não venha na forma esperada devolve-se como está, porque mostrar o texto original é mais
 * honesto do que mostrar "NaN undefined" ou um dia inventado.
 */

/** Nomes dos meses em inglês, como toda a interface (CLAUDE.md § Convenções). */
export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** As três peças de uma data `AAAA-MM-DD`, ou `null` se a string não for uma. */
function parts(date: string): { year: string; month: number; day: number } | null {
  const pieces = typeof date === 'string' ? date.split('-') : [];
  if (pieces.length !== 3) return null;

  const [year, month, day] = pieces;
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);

  if (!/^\d{4}$/.test(year)) return null;
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return null;

  return { year, month: monthIndex, day: dayNumber };
}

/** "14 Feb 2026" — a data por extenso, para cabeçalhos e cards de evento. */
export function formatDate(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "14 Feb" — sem o ano, para listas onde o ano já se percebe pelo contexto. */
export function formatShortDate(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${p.day} ${MONTHS[p.month]}`;
}

/** "Feb" — só o mês, para eixos de gráficos. `null` quando a data não se percebe. */
export function monthLabel(date: string): string | null {
  const p = parts(date);
  return p ? MONTHS[p.month] : null;
}

/**
 * Compara duas datas `AAAA-MM-DD` para ordenar da mais antiga para a mais recente.
 *
 * Não precisa de as converter: em `AAAA-MM-DD` os campos vêm do mais significativo para o menos e
 * têm largura fixa, portanto a ordem alfabética **é** a ordem cronológica. Passar pelo `Date` só
 * para ordenar seria trabalho a mais e mais uma oportunidade para o fuso se meter.
 */
export function compareDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

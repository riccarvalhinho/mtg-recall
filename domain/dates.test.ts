import { afterAll, describe, expect, it } from 'vitest';
import { compareDates, formatDate, formatShortDate, monthLabel } from './dates';

describe('formatDate', () => {
  it('escreve a data por extenso', () => {
    expect(formatDate('2026-02-14')).toBe('14 Feb 2026');
    expect(formatDate('2025-12-31')).toBe('31 Dec 2025');
  });

  it('não põe zero à frente do dia', () => {
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
  });

  it('devolve a string original quando não é uma data', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('amanhã')).toBe('amanhã');
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
    expect(formatDate('26-02-14')).toBe('26-02-14');
  });
});

describe('formatShortDate', () => {
  it('deixa o ano de fora', () => {
    expect(formatShortDate('2026-02-14')).toBe('14 Feb');
  });

  it('devolve a string original quando não é uma data', () => {
    expect(formatShortDate('2026-00-14')).toBe('2026-00-14');
  });
});

describe('monthLabel', () => {
  it('devolve o mês', () => {
    expect(monthLabel('2026-02-14')).toBe('Feb');
    expect(monthLabel('2026-11-02')).toBe('Nov');
  });

  it('devolve null quando não é uma data', () => {
    expect(monthLabel('qualquer coisa')).toBeNull();
  });
});

describe('compareDates', () => {
  it('ordena da mais antiga para a mais recente', () => {
    const dates = ['2026-03-01', '2025-12-31', '2026-02-14'];
    expect([...dates].sort(compareDates)).toEqual([
      '2025-12-31',
      '2026-02-14',
      '2026-03-01',
    ]);
  });

  it('dá zero para a mesma data', () => {
    expect(compareDates('2026-02-14', '2026-02-14')).toBe(0);
  });
});

// ─── O bug do fuso horário ───────────────────────────────────────────────────

/**
 * A razão de existir deste módulo: num fuso negativo, o `new Date('2026-02-14')` é a meia-noite em
 * UTC vista de cá, ou seja o dia 13 à tarde. Este teste fixa o fuso no processo, prova que o `Date`
 * escorrega mesmo — se um dia deixar de escorregar, o teste avisa — e prova que as funções daqui
 * não escorregam.
 */
describe('datas num fuso negativo', () => {
  const originalTz = process.env.TZ;
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it('o Date recua um dia, estas funções não', () => {
    process.env.TZ = 'America/Los_Angeles';

    // A armadilha, demonstrada: 14 de Fevereiro lido pelo Date dá dia 13.
    expect(new Date('2026-02-14').getDate()).toBe(13);

    // O mesmo dia, formatado sem passar pelo Date.
    expect(formatDate('2026-02-14')).toBe('14 Feb 2026');
    expect(formatShortDate('2026-02-14')).toBe('14 Feb');
    expect(monthLabel('2026-02-14')).toBe('Feb');
  });

  it('o primeiro dia do mês não cai no mês anterior', () => {
    process.env.TZ = 'America/Los_Angeles';

    // Pior caso: dia 1 recua para o último dia do mês anterior, e o eixo do gráfico trocava o mês.
    expect(new Date('2026-03-01').getMonth()).toBe(1);

    expect(formatDate('2026-03-01')).toBe('1 Mar 2026');
    expect(monthLabel('2026-03-01')).toBe('Mar');
  });
});

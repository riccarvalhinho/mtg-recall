import { describe, expect, it } from 'vitest';
import { eventId, slugify, uniqueId } from './slug.ts';

describe('slugify', () => {
  it('tira acentos em vez de os traduzir', () => {
    // "João" e "Joao" têm de dar o mesmo id, senão o mesmo adversário conta duas vezes nas
    // estatísticas — que é precisamente o problema que a taxonomia existe para evitar.
    expect(slugify('João Ferreira')).toBe('joao-ferreira');
    expect(slugify('Joao Ferreira')).toBe('joao-ferreira');
  });

  it('junta tudo o que não é letra nem número num hífen só', () => {
    expect(slugify('FNM Sealed — Aetherdrift!')).toBe('fnm-sealed-aetherdrift');
  });

  it('não deixa hífens nas pontas', () => {
    expect(slugify('  Draft  ')).toBe('draft');
    expect(slugify('— Draft —')).toBe('draft');
  });

  it('devolve string vazia quando não sobra nada', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('eventId', () => {
  it('põe a data à frente para o directório sair por ordem', () => {
    expect(eventId('2026-04-12', 'FNM Sealed — Aetherdrift')).toBe('2026-04-12-fnm-sealed-aetherdrift');
  });

  it('não produz um id que acabe em hífen quando o nome não deixa slug nenhum', () => {
    // O schema exige que o id case com o padrão data-slug; "2026-04-12-" seria recusado no CI
    // depois de o commit já estar feito.
    expect(eventId('2026-04-12', '???')).toBe('2026-04-12-event');
  });
});

describe('uniqueId', () => {
  it('deixa o id em paz quando está livre', () => {
    expect(uniqueId('2026-04-12-draft', [])).toBe('2026-04-12-draft');
  });

  it('acrescenta um sufixo quando dois torneios no mesmo dia têm o mesmo nome', () => {
    const taken = ['2026-04-12-draft'];
    expect(uniqueId('2026-04-12-draft', taken)).toBe('2026-04-12-draft-2');
    expect(uniqueId('2026-04-12-draft', [...taken, '2026-04-12-draft-2'])).toBe('2026-04-12-draft-3');
  });
});

import { describe, expect, it } from 'vitest';
import {
  filterSets,
  isLimitedFormat,
  isValidSetCode,
  normalizeSets,
  sortSets,
  toSetCode,
  type MtgSet,
} from './sets.ts';

/** Um set cru como a Scryfall o devolve, com o mínimo para passar nos filtros. */
function rawSet(overrides: Record<string, unknown> = {}) {
  return {
    code: 'dft',
    name: 'Aetherdrift',
    released_at: '2025-02-14',
    set_type: 'expansion',
    digital: false,
    ...overrides,
  };
}

function payload(...sets: Record<string, unknown>[]) {
  return { object: 'list', data: sets };
}

describe('normalizeSets', () => {
  it('deixa passar os tipos que se jogam num torneio', () => {
    const result = normalizeSets(
      payload(
        rawSet({ code: 'dft', set_type: 'expansion' }),
        rawSet({ code: 'fdn', set_type: 'core', released_at: '2024-11-15' }),
        rawSet({ code: 'mh3', set_type: 'draft_innovation', released_at: '2024-06-14' }),
        rawSet({ code: 'ltr', set_type: 'masters', released_at: '2023-06-23' }),
      ),
    );

    expect(result.map(set => set.code)).toEqual(['dft', 'fdn', 'mh3', 'ltr']);
  });

  it('deita fora o que não se joga', () => {
    // Ninguém faz Sealed de memorabilia nem de um deck de oferta — e uma lista com mil entradas
    // dessas era pior do que escrever o código à mão, que é o que isto veio substituir.
    const result = normalizeSets(
      payload(
        rawSet({ code: 'pdft', set_type: 'promo' }),
        rawSet({ code: 'ovnt', set_type: 'memorabilia' }),
        rawSet({ code: 'ddu', set_type: 'duel_deck' }),
        rawSet({ code: 'dft' }),
      ),
    );

    expect(result.map(set => set.code)).toEqual(['dft']);
  });

  it('deita fora sets digitais, mesmo quando são expansões', () => {
    // Um set de Arena tem set_type expansion, mas não existe em papel e não há torneio dele.
    const result = normalizeSets(
      payload(rawSet({ code: 'ymid', digital: true }), rawSet({ code: 'dft' })),
    );

    expect(result.map(set => set.code)).toEqual(['dft']);
  });

  it('deita fora códigos que o schema recusaria', () => {
    // data/schema/event.schema.json exige ^[a-z0-9]{3,6}$. Um código fora disso só daria erro no
    // `npm run validate` — ou seja, depois de o commit já estar feito.
    const result = normalizeSets(
      payload(
        rawSet({ code: 'pf' }),           // curto de mais
        rawSet({ code: 'seteletras' }),   // comprido de mais
        rawSet({ code: 'p-dft' }),        // hífen não entra no padrão
        rawSet({ code: 'dft' }),
      ),
    );

    expect(result.map(set => set.code)).toEqual(['dft']);
  });

  it('ordena do mais recente para o mais antigo', () => {
    const result = normalizeSets(
      payload(
        rawSet({ code: 'ltr', released_at: '2023-06-23' }),
        rawSet({ code: 'dft', released_at: '2025-02-14' }),
        rawSet({ code: 'fdn', released_at: '2024-11-15' }),
      ),
    );

    expect(result.map(set => set.code)).toEqual(['dft', 'fdn', 'ltr']);
  });

  it('põe o código em minúsculas', () => {
    expect(normalizeSets(payload(rawSet({ code: 'DFT' })))[0].code).toBe('dft');
  });

  it('ignora entradas estragadas em vez de deitar a lista abaixo', () => {
    const result = normalizeSets(
      payload(
        rawSet({ code: undefined }),
        rawSet({ name: undefined, code: 'abc' }),
        rawSet({ released_at: undefined, code: 'def' }),
        rawSet({ code: 'dft' }),
      ),
    );

    expect(result.map(set => set.code)).toEqual(['dft']);
  });

  it('devolve lista vazia quando a resposta não tem a forma esperada', () => {
    // Sem rede a app pode apanhar um portal cativo a responder HTML. Vazio é melhor do que rebentar.
    expect(normalizeSets(null)).toEqual([]);
    expect(normalizeSets({})).toEqual([]);
    expect(normalizeSets({ data: 'nope' })).toEqual([]);
  });
});

describe('sortSets', () => {
  it('desempata pelo código para a ordem ser sempre a mesma', () => {
    const sets: MtgSet[] = [
      { code: 'blb', name: 'Bloomburrow', releasedAt: '2024-08-02', setType: 'expansion' },
      { code: 'acr', name: 'Assassin’s Creed', releasedAt: '2024-08-02', setType: 'masters' },
    ];

    expect(sortSets(sets).map(set => set.code)).toEqual(['acr', 'blb']);
  });
});

describe('filterSets', () => {
  const sets: MtgSet[] = [
    { code: 'dft', name: 'Aetherdrift', releasedAt: '2025-02-14', setType: 'expansion' },
    { code: 'fdn', name: 'Foundations', releasedAt: '2024-11-15', setType: 'core' },
    { code: 'thb', name: 'Theros Beyond Death', releasedAt: '2020-01-24', setType: 'expansion' },
  ];

  it('devolve tudo quando não há procura', () => {
    expect(filterSets(sets, '   ')).toHaveLength(3);
  });

  it('encontra por nome, sem ligar a maiúsculas nem a acentos', () => {
    expect(filterSets(sets, 'théros').map(set => set.code)).toEqual(['thb']);
    expect(filterSets(sets, 'FOUNDA').map(set => set.code)).toEqual(['fdn']);
  });

  it('encontra por código', () => {
    expect(filterSets(sets, 'fd').map(set => set.code)).toEqual(['fdn']);
  });

  it('põe o código exacto à frente', () => {
    // Quem escreve "dft" já sabe o que quer; não deve ter de procurar na lista.
    const withCollision: MtgSet[] = [
      { code: 'dftx', name: 'Outro qualquer', releasedAt: '2026-01-01', setType: 'expansion' },
      ...sets,
    ];

    expect(filterSets(withCollision, 'dft').map(set => set.code)).toEqual(['dft', 'dftx']);
  });
});

describe('isValidSetCode / toSetCode', () => {
  it('aceita o que o schema aceita', () => {
    expect(isValidSetCode('dft')).toBe(true);
    expect(isValidSetCode('mh3')).toBe(true);
    expect(isValidSetCode('  DFT ')).toBe(true);
  });

  it('recusa o que o schema recusaria', () => {
    expect(isValidSetCode('df')).toBe(false);
    expect(isValidSetCode('seteletras')).toBe(false);
    expect(isValidSetCode('p-dft')).toBe(false);
    expect(isValidSetCode('')).toBe(false);
  });

  it('normaliza o que se escreve à mão', () => {
    expect(toSetCode(' DFT ')).toBe('dft');
    expect(toSetCode('não')).toBeUndefined();
  });
});

describe('isLimitedFormat', () => {
  it('só Sealed e Draft é que têm set', () => {
    expect(isLimitedFormat('Sealed')).toBe(true);
    expect(isLimitedFormat('Draft')).toBe(true);
    expect(isLimitedFormat('Modern')).toBe(false);
    expect(isLimitedFormat('Commander')).toBe(false);
  });
});

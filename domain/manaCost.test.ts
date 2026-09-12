import { describe, expect, it } from 'vitest';
import { hasManaSymbols, parseManaCost, pipCounts } from './manaCost';

describe('parseManaCost', () => {
  it('separa um custo simples', () => {
    expect(parseManaCost('{2}{G}{U}').map(s => s.key)).toEqual(['2', 'G', 'U']);
  });

  it('um custo vazio não é erro — terrenos não têm custo', () => {
    expect(parseManaCost(undefined)).toEqual([]);
    expect(parseManaCost('')).toEqual([]);
    expect(parseManaCost('{0}')).toHaveLength(1);
  });

  it('tira a barra da chave, que é como a Scryfall nomeia os ficheiros', () => {
    // {W/U} é WU.svg, não W/U.svg nem W-U.svg.
    expect(parseManaCost('{W/U}')[0]).toMatchObject({ code: 'W/U', key: 'WU' });
    expect(parseManaCost('{2/W}')[0].key).toBe('2W');
    expect(parseManaCost('{W/P}')[0].key).toBe('WP');
  });

  it('mantém o código original para o texto de recurso', () => {
    expect(parseManaCost('{B/G}')[0].label).toBe('B/G');
  });

  it('aceita X, tap e neve', () => {
    expect(parseManaCost('{X}{T}{S}').map(s => s.key)).toEqual(['X', 'T', 'S']);
  });

  it('custos grandes não partem', () => {
    expect(parseManaCost('{15}')[0].key).toBe('15');
  });

  it('o separador de faces não é um símbolo', () => {
    // As cartas de duas faces vêm como "{1}{U} // {4}{U}". A barra dupla não está entre chavetas.
    const symbols = parseManaCost('{1}{U} // {4}{U}');
    expect(symbols.map(s => s.key)).toEqual(['1', 'U', '4', 'U']);
  });

  it('lixo fora de chavetas é ignorado em silêncio', () => {
    expect(parseManaCost('custo: {R} mais coisas')).toHaveLength(1);
  });

  it('chavetas vazias não viram símbolos', () => {
    expect(parseManaCost('{}{R}')).toHaveLength(1);
  });

  it('minúsculas sobem para a chave mas o código fica como estava', () => {
    const symbol = parseManaCost('{g}')[0];
    expect(symbol.key).toBe('G');
    expect(symbol.code).toBe('g');
  });
});

describe('hasManaSymbols', () => {
  it('distingue um custo de uma string sem símbolos', () => {
    expect(hasManaSymbols('{R}')).toBe(true);
    expect(hasManaSymbols('')).toBe(false);
    expect(hasManaSymbols('Instant')).toBe(false);
  });
});

describe('pipCounts', () => {
  it('conta pips e não cartas', () => {
    expect(pipCounts('{B}{B}')).toEqual({ B: 2 });
  });

  it('genéricos não são cor', () => {
    expect(pipCounts('{3}{R}')).toEqual({ R: 1 });
  });

  it('um híbrido conta nas duas cores', () => {
    expect(pipCounts('{W/U}')).toEqual({ W: 1, U: 1 });
  });

  it('o P de Phyrexian não é cor', () => {
    expect(pipCounts('{W/P}')).toEqual({ W: 1 });
  });

  it('um custo sem cor nenhuma dá objecto vazio', () => {
    expect(pipCounts('{2}{C}{T}')).toEqual({});
  });
});

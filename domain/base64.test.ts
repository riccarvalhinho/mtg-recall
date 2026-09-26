import { describe, expect, it } from 'vitest';
import { bytesToBase64, toBase64 } from './base64.ts';

/** O Node sabe fazer isto bem; o telemóvel é que pode não saber. Comparar com o Node é a prova. */
const reference = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe('toBase64', () => {
  const cases = [
    '',
    'a',
    'ab',
    'abc',
    '{}\n',
    'João Ferreira',
    'FNM Sealed — Aetherdrift',
    '{\n  "name": "Deck â€” estranho"\n}\n',
    'emoji: 🃏♠️',
  ];

  for (const text of cases) {
    it(`bate certo com o Node para ${JSON.stringify(text).slice(0, 32)}`, () => {
      expect(toBase64(text)).toBe(reference(text));
    });
  }

  it('aguenta um ficheiro grande sem rebentar a pilha', () => {
    // Um evento com muitas rondas e notas compridas chega facilmente aos milhares de caracteres.
    const big = '{"notes":"' + 'á'.repeat(50_000) + '"}';
    expect(toBase64(big)).toBe(reference(big));
  });
});

describe('bytesToBase64', () => {
  it('bate certo com o Node para bytes que não são texto', () => {
    // O cabeçalho de um JPEG e todos os valores de um byte: nada de UTF-8 pelo meio.
    const bytes = [0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 256 }, (_, i) => i)];
    for (const length of [0, 1, 2, 3, 4, bytes.length]) {
      const slice = bytes.slice(0, length);
      expect(bytesToBase64(slice)).toBe(Buffer.from(slice).toString('base64'));
    }
  });
});

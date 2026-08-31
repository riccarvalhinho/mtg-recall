import { describe, expect, it } from 'vitest';
import { toBase64 } from './base64.ts';

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

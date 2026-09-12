import { describe, expect, it } from 'vitest';
import {
  BASIC_LANDS,
  MAX_BASIC,
  basicLandQuantity,
  setBasicLandQuantity,
  totalBasics,
} from './basicLands';
import { manaCurve, typeCounts } from './deck';
import type { DeckCard } from '../types';

const island = BASIC_LANDS.find(land => land.name === 'Island')!;
const forest = BASIC_LANDS.find(land => land.name === 'Forest')!;

describe('BASIC_LANDS', () => {
  it('são seis, em WUBRG e o incolor no fim', () => {
    expect(BASIC_LANDS.map(land => land.name)).toEqual([
      'Plains',
      'Island',
      'Swamp',
      'Mountain',
      'Forest',
      'Wastes',
    ]);
  });

  it('o Wastes não tem cor', () => {
    expect(BASIC_LANDS[5].color).toBeNull();
  });
});

describe('setBasicLandQuantity', () => {
  it('acrescenta quando ainda não há nenhum', () => {
    const cards = setBasicLandQuantity([], island, 8);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ name: 'Island', quantity: 8 });
  });

  it('altera em vez de duplicar quando já lá está', () => {
    const cards = setBasicLandQuantity(setBasicLandQuantity([], island, 8), island, 12);
    expect(cards).toHaveLength(1);
    expect(cards[0].quantity).toBe(12);
  });

  it('zero remove a linha — o schema exige quantity mínimo de 1', () => {
    const cards = setBasicLandQuantity(setBasicLandQuantity([], island, 8), island, 0);
    expect(cards).toEqual([]);
  });

  it('não passa do tecto', () => {
    expect(setBasicLandQuantity([], island, 500)[0].quantity).toBe(MAX_BASIC);
  });

  it('não mexe nas outras cartas', () => {
    const bicho: DeckCard = { name: 'Llanowar Elves', quantity: 4, typeLine: 'Creature — Elf Druid' };
    const cards = setBasicLandQuantity([bicho], forest, 20);
    expect(cards).toHaveLength(2);
    expect(cards.find(card => card.name === 'Llanowar Elves')?.quantity).toBe(4);
  });

  it('main e sideboard são linhas separadas', () => {
    const cards = setBasicLandQuantity(setBasicLandQuantity([], island, 8), island, 2, 'side');
    expect(cards).toHaveLength(2);
    expect(basicLandQuantity(cards, island, 'main')).toBe(8);
    expect(basicLandQuantity(cards, island, 'side')).toBe(2);
  });
});

describe('o que o typeLine dos básicos garante', () => {
  const comBasicos = setBasicLandQuantity(
    [{ name: 'Consider', quantity: 4, cmc: 1, typeLine: 'Instant', colors: ['U'] }],
    island,
    20,
  );

  it('vinte ilhas NÃO enchem a barra do zero da curva', () => {
    // É para isto que os básicos levam typeLine: sem ela, manaCurve contava-os como cmc 0.
    const curve = manaCurve(comBasicos);
    expect(curve.find(bucket => bucket.cmc === 0)?.count ?? 0).toBe(0);
  });

  it('mas contam como Land na divisão por tipo', () => {
    expect(typeCounts(comBasicos).find(entry => entry.type === 'Land')?.count).toBe(20);
  });

  it('não entram na distribuição de cores do deck', () => {
    // Um básico produz a sua cor mas não a tem. `colors: []` é o que evita vinte ilhas a
    // fazerem um deck mono-azul parecer mais azul do que é.
    expect(comBasicos.find(card => card.name === 'Island')?.colors).toEqual([]);
  });
});

describe('totalBasics', () => {
  it('soma os seis', () => {
    let cards = setBasicLandQuantity([], island, 8);
    cards = setBasicLandQuantity(cards, forest, 9);
    expect(totalBasics(cards)).toBe(17);
  });

  it('sem básicos dá zero', () => {
    expect(totalBasics([{ name: 'X', quantity: 1 }])).toBe(0);
  });
});

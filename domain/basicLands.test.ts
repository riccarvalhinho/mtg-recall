import { describe, expect, it } from 'vitest';
import {
  BASIC_LANDS,
  MAX_BASIC,
  basicLandQuantity,
  basicLandsToIllustrate,
  dominantSetCode,
  setBasicLandQuantity,
  totalBasics,
  withBasicLandArt,
  type BasicLandPrinting,
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

describe('dominantSetCode', () => {
  const sealed: DeckCard[] = [
    { name: 'Berta, Wise Extrapolator', quantity: 1, setCode: 'stx' },
    { name: 'Cuboid Colony', quantity: 2, setCode: 'stx' },
    { name: 'Island', quantity: 8 },
    { name: 'Forest', quantity: 9 },
  ];

  it('um Sealed de uma colecção dá essa colecção', () => {
    expect(dominantSetCode(sealed)).toBe('stx');
  });

  it('os básicos não votam — não têm setCode e são a maioria das cartas', () => {
    // Dezassete terrenos contra três feitiços: se contassem, não havia maioria nenhuma.
    expect(dominantSetCode(sealed)).toBe('stx');
  });

  it('conta por quantidade e não por linha', () => {
    expect(
      dominantSetCode([
        { name: 'A', quantity: 4, setCode: 'mh3' },
        { name: 'B', quantity: 1, setCode: 'ltr' },
        { name: 'C', quantity: 1, setCode: 'dmu' },
      ]),
    ).toBe('mh3');
  });

  it('sem maioria absoluta não há colecção — um Commander de trinta colecções', () => {
    expect(
      dominantSetCode([
        { name: 'A', quantity: 1, setCode: 'ltr' },
        { name: 'B', quantity: 1, setCode: 'mh3' },
        { name: 'C', quantity: 1, setCode: 'dmu' },
      ]),
    ).toBeUndefined();
  });

  it('metade não chega: um empate a 50% não dá maioria a ninguém', () => {
    expect(
      dominantSetCode([
        { name: 'A', quantity: 1, setCode: 'ltr' },
        { name: 'B', quantity: 1, setCode: 'mh3' },
      ]),
    ).toBeUndefined();
  });

  it('um deck sem impressões conhecidas não tem colecção', () => {
    expect(dominantSetCode([{ name: 'Island', quantity: 8 }])).toBeUndefined();
    expect(dominantSetCode(undefined)).toBeUndefined();
  });

  it('o código normaliza-se para minúsculas', () => {
    expect(dominantSetCode([{ name: 'A', quantity: 1, setCode: 'LTR' }])).toBe('ltr');
  });
});

describe('basicLandsToIllustrate', () => {
  it('devolve os básicos sem arte, sem repetições e com a grafia canónica', () => {
    expect(
      basicLandsToIllustrate([
        { name: 'island', quantity: 8 },
        { name: 'Island', quantity: 1, board: 'side' },
        { name: 'Forest', quantity: 9 },
        { name: 'Berta', quantity: 1, setCode: 'stx' },
      ]),
    ).toEqual(['Island', 'Forest']);
  });

  it('um básico com impressão escolhida à mão fica de fora', () => {
    expect(
      basicLandsToIllustrate([{ name: 'Island', quantity: 8, scryfallId: 'abc' }]),
    ).toEqual([]);
  });

  it('só básicos', () => {
    expect(basicLandsToIllustrate([{ name: 'Lightning Bolt', quantity: 4 }])).toEqual([]);
  });
});

describe('withBasicLandArt', () => {
  const printing: BasicLandPrinting = {
    scryfallId: 'ltr-island',
    setCode: 'ltr',
    rarity: 'common',
    artCropUrl: 'https://cards.scryfall.io/art_crop/ltr-island.jpg',
  };
  const printings = new Map<string, BasicLandPrinting>([['island', printing]]);

  it('empresta a arte ao básico que não tem nenhuma', () => {
    const [card] = withBasicLandArt([{ name: 'Island', quantity: 8 }], printings);
    expect(card.artCropUrl).toBe(printing.artCropUrl);
    expect(card.setCode).toBe('ltr');
    expect(card.rarity).toBe('common');
  });

  it('não mexe nas cores — vinte ilhas com cor inflacionavam a distribuição do deck', () => {
    const [card] = withBasicLandArt([{ name: 'Island', quantity: 8, colors: [] }], printings);
    expect(card.colors).toEqual([]);
  });

  it('mantém quantidade, board e linha de tipo', () => {
    const [card] = withBasicLandArt(
      [{ name: 'Island', quantity: 3, board: 'side', typeLine: 'Basic Land — Island' }],
      printings,
    );
    expect(card.quantity).toBe(3);
    expect(card.board).toBe('side');
    expect(card.typeLine).toBe('Basic Land — Island');
  });

  it('a escolha de quem pôs a carta ganha à colecção do deck', () => {
    const escolhido: DeckCard = { name: 'Island', quantity: 8, scryfallId: 'o-meu', setCode: 'unf' };
    const [card] = withBasicLandArt([escolhido], printings);
    expect(card).toBe(escolhido);
  });

  it('um básico que a colecção não tem fica como está', () => {
    const [card] = withBasicLandArt([{ name: 'Swamp', quantity: 8 }], printings);
    expect(card.artCropUrl).toBeUndefined();
  });

  it('sem impressões devolve a mesma lista', () => {
    const list: DeckCard[] = [{ name: 'Island', quantity: 8 }];
    expect(withBasicLandArt(list, new Map())).toBe(list);
  });

  it('os básicos continuam a contar como Land depois de ganharem arte', () => {
    const cards = withBasicLandArt(
      [{ name: 'Island', quantity: 8, typeLine: 'Basic Land — Island', colors: [] }],
      printings,
    );
    expect(typeCounts(cards)).toEqual([{ type: 'Land', count: 8 }]);
    expect(manaCurve(cards).every(bucket => bucket.count === 0)).toBe(true);
  });
});

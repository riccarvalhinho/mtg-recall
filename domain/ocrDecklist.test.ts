import { describe, expect, it } from 'vitest';
import {
  allowedErrors,
  catalogueFrom,
  columnsOf,
  decklistFromBlocks,
  editDistance,
  matchCardName,
  normalizeCardText,
  titleSized,
  type TextBlock,
} from './ocrDecklist';

/** Um bloco do tamanho de um título, na posição dada. */
function title(text: string, x: number, y: number, width = 200, height = 30): TextBlock {
  return { text, x, y, width, height };
}

describe('columnsOf', () => {
  it('separa três colunas de cartas espalhadas na mesa', () => {
    const blocks = [
      // Chegam baralhados de propósito: o OCR não devolve coluna a coluna.
      title('Llanowar Elves', 20, 300),
      title('Lightning Bolt', 520, 100),
      title('Birds of Paradise', 20, 100),
      title('Counterspell', 1020, 100),
    ];

    const columns = columnsOf(blocks);
    expect(columns.map(column => column.map(block => block.text))).toEqual([
      ['Birds of Paradise', 'Llanowar Elves'],
      ['Lightning Bolt'],
      ['Counterspell'],
    ]);
  });

  it('dentro da coluna manda a posição vertical', () => {
    const blocks = [title('Terceira', 20, 500), title('Primeira', 30, 100), title('Segunda', 25, 300)];
    expect(columnsOf(blocks)[0].map(b => b.text)).toEqual(['Primeira', 'Segunda', 'Terceira']);
  });

  it('pequenos desalinhamentos não partem a coluna — as cartas não estão a régua', () => {
    const blocks = [title('Uma', 20, 100), title('Outra', 55, 300), title('Mais', 8, 500)];
    expect(columnsOf(blocks)).toHaveLength(1);
  });

  it('sem blocos não há colunas', () => {
    expect(columnsOf([])).toEqual([]);
  });

  it('o limiar é relativo à largura dos blocos, não a pixels fixos', () => {
    // A mesma mesa fotografada ao dobro da distância: tudo a metade, e o resultado tem de ser igual.
    const perto = [title('A', 20, 100, 200, 30), title('B', 520, 100, 200, 30)];
    const longe = [title('A', 10, 50, 100, 15), title('B', 260, 50, 100, 15)];
    expect(columnsOf(perto)).toHaveLength(2);
    expect(columnsOf(longe)).toHaveLength(2);
  });
});

describe('titleSized', () => {
  it('deita fora o texto de regras que espreita por baixo da carta de cima', () => {
    // É o erro que mais custava: "sacrifice a Mountain" casaria com Mountain e inflacionava a
    // quantidade de uma carta que nem sequer está na mesa.
    const blocks = [
      title('Lightning Bolt', 20, 100, 200, 30),
      title('Llanowar Elves', 20, 300, 200, 30),
      title('Birds of Paradise', 20, 500, 200, 30),
      { text: 'sacrifice a Mountain', x: 20, y: 140, width: 180, height: 12 },
    ];

    expect(titleSized(blocks).map(b => b.text)).not.toContain('sacrifice a Mountain');
    expect(titleSized(blocks)).toHaveLength(3);
  });

  it('uma leitura gigante de um bloco mal segmentado não leva a fotografia atrás', () => {
    // Por isto a referência é a mediana e não o máximo.
    const blocks = [
      title('Lightning Bolt', 20, 100, 200, 30),
      title('Llanowar Elves', 20, 300, 200, 30),
      { text: 'BLOCO ENORME', x: 0, y: 0, width: 900, height: 300 },
    ];
    expect(titleSized(blocks)).toHaveLength(3);
  });

  it('sem blocos devolve lista vazia', () => {
    expect(titleSized([])).toEqual([]);
  });
});

describe('normalizeCardText', () => {
  it('a pontuação que o OCR come não conta', () => {
    expect(normalizeCardText('Jace, the Mind Sculptor')).toBe('jace the mind sculptor');
    expect(normalizeCardText("Gaea's Cradle")).toBe('gaea s cradle');
  });

  it('acentos fora — o OCR não é de confiança neles', () => {
    expect(normalizeCardText('Juzám Djinn')).toBe('juzam djinn');
  });

  it('a barra dupla das cartas de duas faces vira espaço', () => {
    expect(normalizeCardText('Delver of Secrets // Insectile Aberration'))
      .toBe('delver of secrets insectile aberration');
  });
});

describe('editDistance', () => {
  it('conta as correcções precisas', () => {
    expect(editDistance('bolt', 'bolt')).toBe(0);
    expect(editDistance('boit', 'bolt')).toBe(1);
    expect(editDistance('bol', 'bolt')).toBe(1);
  });

  it('desiste quando passa do limite, em vez de contar até ao fim', () => {
    // O valor devolvido não interessa — interessa ser maior do que o limite.
    expect(editDistance('completamente diferente', 'bolt', 2)).toBeGreaterThan(2);
  });

  it('comprimentos incompatíveis nem chegam a ser comparados', () => {
    expect(editDistance('a', 'abcdefghij', 2)).toBeGreaterThan(2);
  });
});

describe('allowedErrors', () => {
  it('um nome curto tolera pouco — um erro em Opt é outra carta', () => {
    expect(allowedErrors('opt')).toBe(1);
  });

  it('um nome longo tolera mais, mas não sem fim', () => {
    expect(allowedErrors('yawgmoth thran physician')).toBe(4);
    expect(allowedErrors('a'.repeat(200))).toBe(4);
  });
});

describe('matchCardName', () => {
  const catalogue = ['Lightning Bolt', 'Llanowar Elves', 'Birds of Paradise', 'Opt', 'Ponder'];

  it('leitura exacta', () => {
    expect(matchCardName('Lightning Bolt', catalogue)).toEqual({ name: 'Lightning Bolt', distance: 0 });
  });

  it('corrige as letras que o OCR troca', () => {
    // l/I e rn/m são os enganos clássicos de OCR.
    expect(matchCardName('Lightnlng Bolt', catalogue)?.name).toBe('Lightning Bolt');
    expect(matchCardName('Llanowar E1ves', catalogue)?.name).toBe('Llanowar Elves');
  });

  it('devolve o nome do catálogo e não o que foi lido — a grafia certa é a que se grava', () => {
    expect(matchCardName('BIRDS OF PARADlSE', catalogue)?.name).toBe('Birds of Paradise');
  });

  it('texto que não é carta nenhuma não vira carta', () => {
    expect(matchCardName('Creature — Elf Druid', catalogue)).toBeNull();
    expect(matchCardName('sacrifice a land', catalogue)).toBeNull();
  });

  it('uma leitura de dois caracteres não é uma procura', () => {
    expect(matchCardName('op', catalogue)).toBeNull();
  });

  it('entre dois parecidos fica o mais próximo', () => {
    expect(matchCardName('Pondar', ['Ponder', 'Plunder'])?.name).toBe('Ponder');
  });
});

describe('decklistFromBlocks', () => {
  const catalogue = ['Lightning Bolt', 'Llanowar Elves', 'Mountain', 'Birds of Paradise'];

  it('repetições viram quantidade — é a informação que não se quer escrever à mão', () => {
    const blocks = [
      title('Lightning Bolt', 20, 100),
      title('Lightning Bolt', 20, 300),
      title('Lightning Bolt', 20, 500),
      title('Llanowar Elves', 520, 100),
    ];

    const { cards } = decklistFromBlocks(blocks, catalogue);
    expect(cards).toEqual([
      { name: 'Lightning Bolt', quantity: 3, exact: true, readings: ['Lightning Bolt', 'Lightning Bolt', 'Lightning Bolt'] },
      { name: 'Llanowar Elves', quantity: 1, exact: true, readings: ['Llanowar Elves'] },
    ]);
  });

  it('o texto de regras não inflaciona quantidades', () => {
    // Sem o filtro do tamanho, esta fotografia dava uma Mountain que não está na mesa.
    const blocks = [
      title('Lightning Bolt', 20, 100),
      title('Llanowar Elves', 20, 300),
      title('Birds of Paradise', 20, 500),
      { text: 'Mountain', x: 20, y: 150, width: 120, height: 11 },
    ];

    const { cards } = decklistFromBlocks(blocks, catalogue);
    expect(cards.map(card => card.name)).not.toContain('Mountain');
  });

  it('o que não se reconheceu aparece, em vez de desaparecer', () => {
    const blocks = [title('Lightning Bolt', 20, 100), title('Xyzzy Frobnicate', 20, 300)];
    const { cards, unmatched } = decklistFromBlocks(blocks, catalogue);

    expect(cards.map(c => c.name)).toEqual(['Lightning Bolt']);
    expect(unmatched).toEqual(['Xyzzy Frobnicate']);
  });

  it('uma carta só com leituras corrigidas fica marcada como não exacta', () => {
    const blocks = [title('Lightnlng Bolt', 20, 100)];
    expect(decklistFromBlocks(blocks, catalogue).cards[0]).toMatchObject({
      name: 'Lightning Bolt',
      exact: false,
    });
  });

  it('a ordem é a da mesa: coluna a coluna, de cima para baixo', () => {
    const blocks = [
      title('Llanowar Elves', 520, 300),
      title('Lightning Bolt', 20, 100),
      title('Birds of Paradise', 520, 100),
      title('Mountain', 20, 300),
    ];

    expect(decklistFromBlocks(blocks, catalogue).cards.map(c => c.name)).toEqual([
      'Lightning Bolt',
      'Mountain',
      'Birds of Paradise',
      'Llanowar Elves',
    ]);
  });

  it('uma fotografia sem nada legível não rebenta', () => {
    expect(decklistFromBlocks([], catalogue)).toEqual({ cards: [], unmatched: [] });
  });
});

describe('catalogueFrom', () => {
  it('junta as fontes sem repetir', () => {
    expect(catalogueFrom(['Opt', 'Ponder'], ['Ponder', 'Brainstorm'])).toEqual([
      'Brainstorm',
      'Opt',
      'Ponder',
    ]);
  });

  it('ignora vazios e apara espaços', () => {
    expect(catalogueFrom(['  Opt  ', '', undefined])).toEqual(['Opt']);
  });

  it('sem fontes devolve lista vazia', () => {
    expect(catalogueFrom()).toEqual([]);
  });
});

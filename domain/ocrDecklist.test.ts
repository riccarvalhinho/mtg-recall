import { describe, expect, it } from 'vitest';
import {
  allowedErrors,
  catalogueFrom,
  columnsOf,
  decklistFromBlocks,
  editDistance,
  looksLikeCardName,
  matchCardName,
  mergeBatches,
  normalizeCardText,
  stripManaCost,
  stripTrailingCost,
  type OcrDecklist,
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
      { name: 'Lightning Bolt', quantity: 3, exact: true, source: 'catalogue', readings: ['Lightning Bolt', 'Lightning Bolt', 'Lightning Bolt'] },
      { name: 'Llanowar Elves', quantity: 1, exact: true, source: 'catalogue', readings: ['Llanowar Elves'] },
    ]);
  });

  it('tudo o que se lê tem destino: ou vira carta, ou vai para unmatched', () => {
    // Nada é descartado. O que o catálogo não conhece entra como foi lido — incluindo texto de
    // regras que tenha escapado à montagem, que assim aparece na confirmação e se apaga com um
    // toque. Só fica de fora o que nem cara de nome tem.
    const blocks = [
      title('Lightning Bolt', 20, 100),
      { text: 'sacrifice a land', x: 20, y: 150, width: 180, height: 11 },
      { text: '3', x: 20, y: 190, width: 20, height: 11 },
    ];

    const { cards, unmatched } = decklistFromBlocks(blocks, catalogue);
    expect(cards.map(c => c.name)).toEqual(['Lightning Bolt', 'sacrifice a land']);
    expect(unmatched).toEqual(['3']);
  });

  it('um nome que o catálogo não conhece entra à mesma, marcado como lido', () => {
    const blocks = [title('Lightning Bolt', 20, 100), title('Xyzzy Frobnicate', 20, 300)];
    const { cards, unmatched } = decklistFromBlocks(blocks, catalogue);

    expect(cards.map(c => c.name)).toEqual(['Lightning Bolt', 'Xyzzy Frobnicate']);
    expect(cards.map(c => c.source)).toEqual(['catalogue', 'read']);
    expect(unmatched).toEqual([]);
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

describe('stripManaCost', () => {
  it('tira o custo que vem colado ao nome — está na mesma barra do título', () => {
    expect(stripManaCost('llanowar elves 6')).toBe('llanowar elves');
    expect(stripManaCost('opt 1')).toBe('opt');
    expect(stripManaCost('lightning bolt r')).toBe('lightning bolt');
    expect(stripManaCost('counterspell u u')).toBe('counterspell');
  });

  it('não come palavras a sério do fim do nome', () => {
    // "ice" tem três letras e fica. É o que impede isto de estragar nomes verdadeiros.
    expect(stripManaCost('fire ice')).toBe('fire ice');
    expect(stripManaCost('birds of paradise')).toBe('birds of paradise');
  });

  it('nunca deixa a linha vazia', () => {
    expect(stripManaCost('x')).toBe('x');
  });
});

describe('com as cartas de baixo tapadas', () => {
  const catalogue = ['Lightning Bolt', 'Llanowar Elves', 'Opt', 'Birds of Paradise'];

  it('um título lido mais pequeno não é deitado fora', () => {
    // Um título do canto da imagem, ou de uma carta inclinada, sai mais pequeno. Era isto que o
    // filtro antigo comia em silêncio — e uma carta que desaparece sem aviso é o pior erro que
    // esta funcionalidade pode ter.
    const blocks = [
      title('Lightning Bolt', 20, 100, 200, 30),
      title('Llanowar Elves', 20, 300, 200, 30),
      title('Birds of Paradise', 20, 500, 160, 18),
    ];

    expect(decklistFromBlocks(blocks, catalogue).cards.map(c => c.name)).toEqual([
      'Lightning Bolt',
      'Llanowar Elves',
      'Birds of Paradise',
    ]);
  });

  it('o custo de mana da barra do título não estraga um nome curto', () => {
    // Tapar a carta de baixo não esconde o custo: ele está na mesma barra que o nome.
    const blocks = [title('Opt 1', 20, 100), title('Llanowar Elves 6', 20, 300)];
    const { cards, unmatched } = decklistFromBlocks(blocks, catalogue);

    expect(cards.map(c => c.name)).toEqual(['Opt', 'Llanowar Elves']);
    expect(unmatched).toEqual([]);
  });
});

describe('mergeBatches', () => {
  function batch(names: string[]): OcrDecklist {
    const blocks = names.map((name, i) => title(name, 20, 100 + i * 200));
    return decklistFromBlocks(blocks, [
      'Lightning Bolt',
      'Llanowar Elves',
      'Opt',
      'Birds of Paradise',
    ]);
  }

  it('junta porções disjuntas da mesma pilha', () => {
    // Um Commander não cabe numa fotografia: fotografa-se em três ou quatro porções.
    const merged = mergeBatches([batch(['Lightning Bolt', 'Opt']), batch(['Llanowar Elves'])]);

    expect(merged.cards.map(c => c.name)).toEqual(['Lightning Bolt', 'Opt', 'Llanowar Elves']);
    expect(merged.cards.every(c => c.quantity === 1)).toBe(true);
    expect(merged.crossBatch).toEqual([]);
  });

  it('duas cópias na mesma porção somam sem levantar suspeita', () => {
    const merged = mergeBatches([batch(['Opt', 'Opt'])]);

    expect(merged.cards[0]).toMatchObject({ name: 'Opt', quantity: 2 });
    expect(merged.crossBatch).toEqual([]);
  });

  it('o mesmo nome em duas porções soma, mas fica marcado', () => {
    // Ou são mesmo duas cópias em porções diferentes, ou as porções sobrepuseram-se e a carta foi
    // fotografada duas vezes. O código não consegue decidir — quem confirma é que decide.
    const merged = mergeBatches([batch(['Opt']), batch(['Opt', 'Lightning Bolt'])]);

    expect(merged.cards.find(c => c.name === 'Opt')?.quantity).toBe(2);
    expect(merged.crossBatch).toEqual(['Opt']);
  });

  it('as leituras de todas as porções ficam guardadas, para se ver de onde veio', () => {
    const merged = mergeBatches([batch(['Opt']), batch(['Opt'])]);
    expect(merged.cards[0].readings).toEqual(['Opt', 'Opt']);
  });

  it('o lixo de cada porção continua a aparecer, separado das cartas', () => {
    const comLixo = decklistFromBlocks([title('3e)', 20, 100)], []);
    const merged = mergeBatches([comLixo, batch(['Opt'])]);

    expect(merged.cards.map(c => c.name)).toEqual(['Opt']);
    expect(merged.unmatched).toEqual(['3e)']);
  });

  it('uma porção só devolve o mesmo que ela — é o caso do Limited', () => {
    // Vinte e poucas cartas fora os terrenos cabem numa fotografia.
    const merged = mergeBatches([batch(['Lightning Bolt', 'Opt'])]);
    expect(merged.cards).toHaveLength(2);
    expect(merged.crossBatch).toEqual([]);
  });

  it('sem porções nenhumas não rebenta', () => {
    expect(mergeBatches([])).toEqual({ cards: [], unmatched: [], crossBatch: [] });
  });

  it('juntar não mexe nas porções originais', () => {
    // A confirmação deixa tirar uma fotografia que saiu mal e voltar a juntar o resto: se juntar
    // estragasse as porções, a segunda junção saía errada.
    const primeira = batch(['Opt']);
    mergeBatches([primeira, batch(['Opt'])]);
    expect(primeira.cards[0].quantity).toBe(1);
    expect(primeira.cards[0].readings).toEqual(['Opt']);
  });
});

describe('stripTrailingCost', () => {
  it('tira o custo colado ao nome, sem lhe mexer na grafia', () => {
    expect(stripTrailingCost('Down, Down to Goblin-town 2')).toBe('Down, Down to Goblin-town');
    expect(stripTrailingCost("Bilbo's Deadly Slice 1B")).toBe("Bilbo's Deadly Slice");
  });

  it('não come palavras verdadeiras', () => {
    expect(stripTrailingCost('Well-Worn Spatula')).toBe('Well-Worn Spatula');
    expect(stripTrailingCost('The Black Arrow')).toBe('The Black Arrow');
  });

  it('nunca deixa o nome vazio', () => {
    expect(stripTrailingCost('3')).toBe('3');
  });
});

describe('looksLikeCardName', () => {
  it('aceita nomes', () => {
    expect(looksLikeCardName('Hobbit Hole')).toBe(true);
    expect(looksLikeCardName('Opt')).toBe(true);
  });

  it('recusa o lixo que vem do custo de mana', () => {
    // Tirados de uma fotografia a sério: o ML Kit devolve estes pedaços como linhas próprias.
    expect(looksLikeCardName('3')).toBe(false);
    expect(looksLikeCardName('3e)')).toBe(false);
    expect(looksLikeCardName('2')).toBe(false);
  });
});

describe('um deck que a app nunca viu', () => {
  // O caso que a primeira fotografia real destapou: catálogo vazio, e a lista saía com zero cartas.
  const fotografia = [
    title('Gandalf, Spark Starter', 20, 100),
    title('Hobbit Hole', 20, 300),
    title('3', 20, 340),
    title("Bilbo's Deadly Slice", 520, 100),
    title("Bilbo's Deadly Slice", 520, 300),
    title('Down, Down to Goblin-town 2', 520, 500),
  ];

  it('sem catálogo nenhum, as leituras entram como nomes', () => {
    const { cards } = decklistFromBlocks(fotografia, []);
    expect(cards.map(c => c.name)).toEqual([
      'Gandalf, Spark Starter',
      'Hobbit Hole',
      "Bilbo's Deadly Slice",
      'Down, Down to Goblin-town',
    ]);
  });

  it('as repetições continuam a contar', () => {
    const { cards } = decklistFromBlocks(fotografia, []);
    expect(cards.find(c => c.name === "Bilbo's Deadly Slice")?.quantity).toBe(2);
  });

  it('os pedaços de custo ficam de fora, mas à vista', () => {
    const { cards, unmatched } = decklistFromBlocks(fotografia, []);
    expect(cards.map(c => c.name)).not.toContain('3');
    expect(unmatched).toEqual(['3']);
  });

  it('vêm marcadas como lidas, não como reconhecidas', () => {
    const { cards } = decklistFromBlocks(fotografia, []);
    expect(cards.every(c => c.source === 'read')).toBe(true);
  });

  it('o catálogo, quando conhece a carta, corrige a grafia', () => {
    const { cards } = decklistFromBlocks([title('Hobbit Hoie', 20, 100)], ['Hobbit Hole']);
    expect(cards[0]).toMatchObject({ name: 'Hobbit Hole', source: 'catalogue' });
  });
});

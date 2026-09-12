/**
 * Da fotografia à decklist — a parte que não precisa de câmara. Puro, sem I/O.
 *
 * O ADR 0009 decidiu OCR local (ML Kit). O ML Kit é código nativo e só entra por APK novo, mas
 * **nada do que decide vive lá dentro**: o que ele devolve são blocos de texto com caixas
 * delimitadoras, e tudo o que transforma esses blocos numa lista de cartas está aqui, testável sem
 * telemóvel e sem fotografia.
 *
 * As cartas estão espalhadas na mesa, sobrepostas de maneira a que só a barra do título de cada uma
 * fique visível, em várias colunas. O que sai do OCR é, portanto, uma salganhada de blocos que é
 * preciso reorganizar:
 *
 *  1. `columnsOf` agrupa por posição horizontal e reconstrói as colunas.
 *  2. `matchCardName` compara com tolerância a erros, porque o OCR troca letras e um nome próprio
 *     de Magic não perdoa comparação exacta.
 *  3. `decklistFromBlocks` conta as repetições: quatro cópias espalhadas dão quatro leituras do
 *     mesmo nome, que é exactamente a informação que não se quer escrever à mão.
 *
 * **Nada é descartado em silêncio.** Houve aqui um filtro que deitava fora as leituras com letras
 * pequenas, para apanhar o texto de regras que espreita por baixo da carta de cima — texto de
 * regras está cheio de nomes de cartas ("sacrifice a Mountain"). Saiu, e a razão está no ADR 0009:
 * a montagem da mesa (tapar as cartas de baixo) resolve isso na origem, e os dois erros não custam
 * o mesmo. Uma linha a mais aparece na confirmação e apaga-se com um toque; uma carta deitada fora
 * por um filtro não aparece em lado nenhum, e a única maneira de dar por ela é contar as cartas da
 * mesa.
 *
 * Nada disto grava seja o que for. O resultado é uma **proposta** para o écran de confirmação, com
 * o que ficou por reconhecer à vista — a regra de nada ficar em branco em silêncio aplica-se aqui
 * mais do que em qualquer outro sítio, porque a alternativa é um deck com cartas inventadas.
 */

/** Um bloco de texto como o ML Kit o devolve: o que leu e onde. Coordenadas em pixels da imagem. */
export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** O centro horizontal de um bloco — é por ele que as colunas se reconhecem. */
function centerX(block: TextBlock): number {
  return block.x + block.width / 2;
}

/**
 * Reconstrói as colunas a partir das caixas delimitadoras.
 *
 * O OCR não devolve os blocos por coluna: devolve-os mais ou menos por ordem de leitura, que numa
 * mesa com três pilhas lado a lado salta de uma para outra. Sem este passo a lista sairia
 * baralhada — e a ordem interessa, porque é ela que deixa a confirmação ser lida de um lado ao
 * outro contra a mesa.
 *
 * O corte é o **espaço horizontal entre blocos consecutivos**: dentro de uma coluna os centros
 * ficam quase alinhados, entre colunas há um salto. O limiar sai da largura mediana dos blocos, e
 * não de um número fixo de pixels, para a mesma foto tirada mais perto ou mais longe dar o mesmo
 * resultado.
 */
export function columnsOf(blocks: TextBlock[], gapRatio = 0.6): TextBlock[][] {
  if (blocks.length === 0) return [];

  const widths = blocks.map(block => block.width).sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)];
  const threshold = medianWidth * gapRatio;

  const sorted = [...blocks].sort((a, b) => centerX(a) - centerX(b));

  const columns: TextBlock[][] = [];
  let current: TextBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = centerX(sorted[i]) - centerX(sorted[i - 1]);
    if (gap > threshold) {
      columns.push(current);
      current = [];
    }
    current.push(sorted[i]);
  }
  columns.push(current);

  // Dentro da coluna manda a posição vertical: é a ordem em que as cartas estão na mesa.
  return columns.map(column => [...column].sort((a, b) => a.y - b.y));
}

/**
 * O texto reduzido ao que se pode comparar.
 *
 * Tira acentos, pontuação e maiúsculas, e junta os espaços. A vírgula de "Jace, the Mind Sculptor"
 * e o apóstrofo de "Gaea's Cradle" são exactamente o tipo de coisa que o OCR come ou inventa, e
 * compará-los seria falhar por causa de um sinal.
 *
 * A barra dupla das cartas de duas faces fica reduzida a um espaço: o OCR lê só a face de cima.
 */
export function normalizeCardText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\/\//g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * O nome sem o custo de mana que vem colado a ele.
 *
 * O custo está na **mesma barra** do título, portanto tapar a carta de baixo não o esconde: o OCR
 * devolve "Llanowar Elves 6" ou "Opt 1" e o custo vira lixo no fim da linha. Num nome longo a
 * tolerância a erros absorvia isso, mas em "Opt" dois caracteres a mais são mais erros do que os
 * permitidos — e era logo aí que falhava.
 *
 * Só se tiram palavras **curtas** e feitas de dígitos ou das letras que aparecem num custo. É o que
 * impede isto de comer o fim de um nome a sério: "Fire // Ice" acaba em "ice", que tem três letras
 * e fica onde está.
 */
export function stripManaCost(normalized: string): string {
  const words = normalized.split(' ').filter(Boolean);

  while (words.length > 1) {
    const last = words[words.length - 1];
    if (last.length > 2 || !/^[wubrgcxsp0-9]+$/.test(last)) break;
    words.pop();
  }

  return words.join(' ');
}

/**
 * Distância de edição, com limite.
 *
 * Pára assim que toda a linha da matriz passa do limite — sem isso, comparar cada leitura contra um
 * catálogo de dezenas de milhares de nomes seria trabalho a sério no telemóvel. O valor devolvido
 * quando se desiste é `limit + 1`, que é o suficiente para quem chama saber que não serve.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < best) best = value;
    }

    if (best > limit) return limit + 1;
    previous = current;
  }

  return previous[b.length];
}

/**
 * Quantos erros se toleram num nome deste tamanho.
 *
 * Proporcional ao comprimento, porque um erro em "Opt" é outra carta e três erros em
 * "Yawgmoth, Thran Physician" continuam a ser a mesma. O mínimo de 1 existe para nomes curtos não
 * ficarem com tolerância zero, e o máximo de 4 para nomes muito longos não passarem a casar com
 * tudo.
 */
export function allowedErrors(name: string): number {
  return Math.max(1, Math.min(4, Math.round(name.length * 0.2)));
}

/** Um nome de carta reconhecido, e o quanto se confia nele. */
export interface NameMatch {
  /** O nome do catálogo, com a grafia certa — não o que o OCR leu. */
  name: string;
  /** Quantos caracteres foram precisos corrigir. Zero é leitura exacta. */
  distance: number;
}

/**
 * O nome do catálogo mais parecido com o que o OCR leu, ou `null` se nenhum servir.
 *
 * Exacto primeiro, e só depois a procura tolerante: a esmagadora maioria das leituras é exacta, e
 * não vale a pena percorrer o catálogo para as encontrar. Empates ficam com o primeiro — o catálogo
 * chega ordenado e a escolha é estável.
 *
 * Devolver `null` é um resultado legítimo e frequente: é o que acontece a um pedaço de texto de
 * regras que escapou ao filtro do tamanho, e é o que impede uma linha ilegível de virar carta.
 */
export function matchCardName(text: string, catalogue: string[]): NameMatch | null {
  const reading = normalizeCardText(text);
  if (reading.length < 3) return null;

  // Duas leituras da mesma linha: com e sem o custo de mana colado ao fim. A exacta ganha sempre,
  // portanto tentar as duas nunca piora nada — só apanha o caso em que o custo estragava a conta.
  const stripped = stripManaCost(reading);
  const readings = stripped !== reading && stripped.length >= 3 ? [reading, stripped] : [reading];

  let best: NameMatch | null = null;

  for (const name of catalogue) {
    const candidate = normalizeCardText(name);
    if (readings.includes(candidate)) return { name, distance: 0 };

    const limit = Math.min(allowedErrors(candidate), best ? best.distance - 1 : Infinity);
    if (limit < 0) continue;

    for (const attempt of readings) {
      const distance = editDistance(attempt, candidate, limit);
      if (distance <= limit) best = { name, distance };
    }
  }

  return best;
}

/** Uma carta proposta a partir da fotografia, para o écran de confirmação. */
export interface OcrCandidate {
  name: string;
  /** Quantas vezes o nome foi lido. Quatro cópias na mesa dão quatro leituras. */
  quantity: number;
  /** `true` quando alguma das leituras foi exacta. Uma carta só com leituras corrigidas merece olhar. */
  exact: boolean;
  /** O que o OCR leu, tal e qual, pela ordem em que apareceu. Para se perceber de onde veio. */
  readings: string[];
}

/** O que saiu da fotografia: o que se reconheceu e o que não se reconheceu. */
export interface OcrDecklist {
  cards: OcrCandidate[];
  /** As leituras que não casaram com nome nenhum. Mostram-se — não se escondem. */
  unmatched: string[];
}

/**
 * A proposta de decklist, a partir dos blocos que o OCR devolveu.
 *
 * A ordem é a da mesa: coluna a coluna, de cima para baixo. É o que permite conferir a lista contra
 * a fotografia sem andar a saltar.
 *
 * O catálogo é uma lista de nomes conhecidos — em produção, os nomes das cartas que já passaram
 * pela app (decks, colecção, cache da procura). Um catálogo pequeno não é problema para o que
 * interessa: o que ele não conhecer aparece em `unmatched` e escreve-se à mão, em vez de virar
 * silenciosamente outra carta.
 *
 * **Toda a leitura tem destino:** ou vira carta, ou vai para `unmatched`. Se a mesa não tiver sido
 * bem tapada, o que entra a mais fica à vista na confirmação, e apaga-se. Nenhuma leitura
 * desaparece pelo caminho.
 */
export function decklistFromBlocks(blocks: TextBlock[], catalogue: string[]): OcrDecklist {
  const ordered = columnsOf(blocks).flat();

  const byName = new Map<string, OcrCandidate>();
  const unmatched: string[] = [];

  for (const block of ordered) {
    const reading = block.text.trim();
    if (!reading) continue;

    const match = matchCardName(reading, catalogue);
    if (!match) {
      unmatched.push(reading);
      continue;
    }

    const existing = byName.get(match.name);
    if (existing) {
      existing.quantity += 1;
      existing.exact = existing.exact || match.distance === 0;
      existing.readings.push(reading);
    } else {
      byName.set(match.name, {
        name: match.name,
        quantity: 1,
        exact: match.distance === 0,
        readings: [reading],
      });
    }
  }

  return { cards: [...byName.values()], unmatched };
}

/**
 * O catálogo de nomes contra o qual se compara, sem repetições e por ordem.
 *
 * Junta o que a app já conhece — os nomes dos decks, os da colecção, os que a procura guardou em
 * cache. Não é o catálogo inteiro do Magic e não precisa de ser: trazer trinta mil nomes para o
 * telemóvel para reconhecer um deck que é quase todo feito de cartas que já lá estão seria pagar
 * caro por pouco. O que faltar aparece em `unmatched` e escreve-se à mão, que é honesto e é o
 * mesmo caminho de sempre.
 *
 * Ordenado para a escolha entre dois nomes igualmente próximos ser sempre a mesma — um resultado
 * que muda de fotografia para fotografia sem a fotografia mudar é impossível de depurar.
 */
export function catalogueFrom(...sources: (string | undefined)[][]): string[] {
  const names = new Set<string>();

  for (const source of sources) {
    for (const name of source) {
      const clean = name?.trim();
      if (clean) names.add(clean);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, 'en'));
}

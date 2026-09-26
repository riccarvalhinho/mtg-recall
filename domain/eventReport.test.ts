import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderEventReport, reportFileName, reportImageUrls, setSymbolUrl, type ReportInput } from './eventReport';
import { cardImageUrl } from './thumbnails';
import type { Deck, DeckCard, Event, Opponent } from '../types';

// ─── Os dados a sério ────────────────────────────────────────────────────────
//
// O Pre release — Reality Fracture, tal como está em data/: 4-2, W/B, quarenta cartas. É o evento
// do protótipo em design/event-export/, e testar contra ele é testar contra o que se vai partilhar.

const DATA = path.join(__dirname, '..', 'data');
const read = <T,>(...parts: string[]): T => JSON.parse(fs.readFileSync(path.join(DATA, ...parts), 'utf8'));

const realEvent = read<Event>('events', '2026-09-25-pre-release-reality-fracture.json');
const realDeck = read<Deck>('decks', 'pre-release-reality-fracture.json');
const realOpponents = read<{ items: Opponent[] }>('taxonomies', 'opponents.json').items;
const real: ReportInput = { event: realEvent, deck: realDeck, opponents: realOpponents };

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function event(extra: Partial<Event> = {}): Event {
  return { id: '2026-01-10-fnm', name: 'FNM', type: 'Modern', date: '2026-01-10', status: 'completed', matches: [], ...extra };
}

function card(extra: Partial<DeckCard> & { name: string }): DeckCard {
  return { quantity: 1, ...extra };
}

/** O texto visível de um pedaço de HTML, sem etiquetas — para procurar frases sem depender do markup. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('reportFileName', () => {
  it('é o id do evento, que já começa pela data', () => {
    expect(reportFileName(realEvent)).toBe('2026-09-25-pre-release-reality-fracture.html');
  });
});

describe('renderEventReport — o evento a sério', () => {
  const html = renderEventReport(real);

  it('abre pelo nome, o recorde e os números da app', () => {
    expect(html).toContain('<title>Pre release - Reality Fracture — 4–2</title>');
    expect(text(html)).toContain('4 – 2 – 0 W – L – D');
    expect(text(html)).toContain('12 Pts');
    expect(text(html)).toContain('67% Win rate');
    expect(text(html)).toContain('Games 9–7');
  });

  it('um evento a decorrer diz em que ronda vai', () => {
    expect(text(html)).toContain('In progress · after round 6');
  });

  it('põe os terrenos no fim da decklist', () => {
    const headings = [...html.matchAll(/<h3>(\w+) <span>(\d+)<\/span><\/h3>/g)].map(m => `${m[1]} ${m[2]}`);
    expect(headings[headings.length - 1]).toBe('Lands 17');
    expect(headings[0]).toBe('Creatures 10');
  });

  it('cada carta com impressão abre a carta inteira ao toque, sem JavaScript', () => {
    const withPrinting = realDeck.cards!.filter(c => c.scryfallId).length;
    expect(html.match(/class="lb"/g)).toHaveLength(withPrinting);
    expect(html).toContain('.lb:target { display: grid; }');
    expect(html).toContain('href="#c-vindictive-triumph-');
  });

  it('os básicos sem impressão aparecem, mas não abrem nada', () => {
    expect(html).toMatch(/<li><span class="card">.*?Plains<\/span>/);
  });

  it('as rondas dizem contra quem, e abrem com <details>', () => {
    expect(html.match(/<details class="rnd /g)).toHaveLength(6);
    expect(text(html)).toContain('R3 L João Rocha');
    expect(text(html)).toContain('Game 2 Lost');
  });

  it('a curva empilhada soma o mesmo que o deck tem de não-terrenos', () => {
    expect(text(html)).toContain('Creatures 10 Other 13');
  });

  it('o anel das cores segue o colorDistribution', () => {
    expect(html).toContain('aria-label="Color split: W 42%, U 4%, B 50%, R 4%"');
  });

  it('sem imagens embutidas, as imagens ficam como links para a Scryfall', () => {
    expect(html).toContain(realDeck.cards![0].artCropUrl!);
    expect(html).not.toContain('data:image/jpeg');
  });
});

describe('renderEventReport — imagens embutidas', () => {
  it('troca cada URL pela versão embutida', () => {
    const urls = reportImageUrls(real);
    const assets = new Map(urls.map(url => [url, `data:image/jpeg;base64,EMBED${urls.indexOf(url)}`]));
    const html = renderEventReport(real, assets);

    for (const url of urls) expect(html).not.toContain(url);
    expect(html).toContain('EMBED0');
  });

  it('com o símbolo da colecção embutido, pinta-o pela raridade; sem ele, fica o losango', () => {
    const symbol = setSymbolUrl('fra');
    const withSymbol = renderEventReport(real, new Map([[symbol, 'data:image/svg+xml;base64,SYM']]));
    expect(withSymbol).toContain('class="set-sym" style="--r:#D2703A;--m:url(&quot;data:image/svg+xml;base64,SYM&quot;)"');

    const without = renderEventReport(real);
    expect(without).toContain('class="gem" style="--r:#D2703A"');
    expect(without).not.toContain('class="set-sym"');
  });
});

describe('reportImageUrls', () => {
  it('sem repetições, com as cartas inteiras no fim', () => {
    const urls = reportImageUrls(real);
    expect(new Set(urls).size).toBe(urls.length);

    const firstFull = urls.findIndex(url => url.includes('/normal/'));
    expect(urls.slice(firstFull).every(url => url.includes('/normal/'))).toBe(true);
    expect(urls[0]).toBe(setSymbolUrl('fra'));
  });

  it('uma carta por impressão, e os básicos sem impressão não pedem nada', () => {
    const urls = reportImageUrls(real);
    const printed = realDeck.cards!.filter(c => c.scryfallId);
    expect(urls.filter(url => url.includes('/normal/'))).toHaveLength(printed.length);
    expect(urls).toContain(cardImageUrl(printed[0].scryfallId)!);
  });
});

describe('renderEventReport — casos de fronteira', () => {
  it('escapa o que vem do utilizador', () => {
    const html = renderEventReport({
      event: event({ name: 'FNM <script>alert(1)</script>', notes: 'Tom & "Jerry"' }),
      opponents: [],
    });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('FNM &lt;script&gt;');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot;');
  });

  it('uma ronda sem adversário não inventa ninguém', () => {
    const html = renderEventReport({
      event: event({ matches: [{ round: 1, opponentColors: { main: [], splash: [] }, result: 'W' }] }),
      opponents: [],
    });
    expect(text(html)).toContain('Unknown opponent');
    expect(text(html)).toContain('Only the result was recorded for this round.');
  });

  it('um evento sem deck não desenha secção de deck; com o nome à mão, desenha só o nome', () => {
    expect(renderEventReport({ event: event(), opponents: [] })).not.toContain('id="deck"');

    const legacy = renderEventReport({ event: event({ deckName: 'Mono Red' }), opponents: [] });
    expect(text(legacy)).toContain('The deck Mono Red');
    expect(legacy).not.toContain('class="analysis"');
  });

  it('a classificação aparece com o escalão, menos quando ganhar já diz tudo', () => {
    const top8 = renderEventReport({ event: event({ placement: 5, playersCount: 32 }), opponents: [] });
    expect(text(top8)).toContain('5th of 32 · Top 8');

    const won = renderEventReport({ event: event({ placement: 1, playersCount: 16 }), opponents: [] });
    expect(text(won)).toContain('1st of 16');
    expect(text(won)).not.toContain('1st Place');
  });

  it('o sideboard vai fechado, depois da lista principal', () => {
    const deck: Deck = {
      id: 'd',
      name: 'Deck',
      colors: { main: ['R'], splash: [] },
      cards: [
        card({ name: 'Bolt', cmc: 1, typeLine: 'Instant', manaCost: '{R}' }),
        card({ name: 'Smash', cmc: 2, typeLine: 'Instant', manaCost: '{1}{R}', board: 'side' }),
      ],
    };
    const html = renderEventReport({ event: event({ deckId: 'd' }), deck, opponents: [] });
    expect(html).toMatch(/<details class="side"><summary>Sideboard <span>1<\/span><\/summary>.*Smash/);
  });

  it('cada símbolo de mana vai uma vez só no CSS, por muitas cartas que o usem', () => {
    const html = renderEventReport(real);
    const classes = [...html.matchAll(/^\.(s\d+)\{background-image/gm)].map(m => m[1]);
    expect(new Set(classes).size).toBe(classes.length);
    // O custo {1} usa o SVG local de costSymbols, e não uma bolha de texto.
    expect(html).not.toContain('class="sym txt"');
  });
});

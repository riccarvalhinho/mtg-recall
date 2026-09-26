/**
 * O relatório de um evento, numa página HTML só. Puro, sem I/O — ver ADR 0014.
 *
 * É o que o botão de partilhar do Event Detail manda para o Telegram: o torneio, os números, o deck
 * com a carta inteira ao toque, e ronda a ronda. Quem recebe não tem a app, e por isso a página
 * leva tudo o que precisa dentro dela.
 *
 * Três regras moldam este ficheiro:
 *
 *  1. **Nada do que é essencial depende de JavaScript.** No iPhone o Telegram e o WhatsApp abrem
 *     documentos num visualizador que pode não correr scripts. As rondas abrem com `<details>`, a
 *     carta inteira com uma âncora e `:target`. O único script é conforto.
 *  2. **As imagens chegam embutidas quando se consegue.** Quem chama descarrega-as (a lista está em
 *     `reportImageUrls`) e passa-as em `assets`, URL → `data:` URI. O que faltar fica como link para
 *     a Scryfall, e a página continua a valer — só precisa de rede para essas.
 *  3. **Os números são os da app, pelas mesmas funções.** Nada aqui recalcula à sua maneira o que
 *     `domain/deck.ts`, `placement.ts` ou `eventColors.ts` já sabem.
 *
 * O texto da página está em inglês, como a app.
 */
import { MANA_SVG } from '../assets/mana/symbols';
import { COST_SYMBOL_SVG } from '../assets/mana/costSymbols';
import { colors } from '../theme/colors';
import { manaColors } from '../theme/mana';
import { RARITY_COLOR, UNKNOWN_RARITY_COLOR } from '../theme/rarity';
import { calcEventStats, isActive } from '../types';
import type { Deck, DeckCard, Event, ManaColor, ManaSelection, Match, Opponent } from '../types';
import { formatDate } from './dates';
import { colorDistribution, groupByType, stackedManaCurve } from './deck';
import { eventColors } from './eventColors';
import { parseManaCost } from './manaCost';
import { eventTier, formatPlacement, tierLabel } from './placement';
import { cardImageUrl, eventThumbnailUrl } from './thumbnails';
import { toBase64 } from './base64';

export interface ReportInput {
  event: Event;
  /**
   * O deck ligado ao evento, já com a arte emprestada aos básicos (`withBasicLandArt`) — é o que
   * o Deck Detail desenha, e o relatório mostra o mesmo.
   */
  deck?: Deck;
  opponents: Opponent[];
}

/** URL → `data:` URI. O que não estiver aqui vai como link. */
export type ReportAssets = ReadonlyMap<string, string>;

/** O nome do ficheiro partilhado. O id já começa pela data e é seguro como nome de ficheiro. */
export function reportFileName(event: Event): string {
  return `${event.id}.html`;
}

/** O símbolo de uma colecção, como o `SetSymbol` o pede. */
export function setSymbolUrl(setCode: string): string {
  return `https://svgs.scryfall.io/sets/${setCode.trim().toLowerCase()}.svg`;
}

/**
 * Todas as imagens da página, sem repetições, pela ordem em que faltam mais.
 *
 * Símbolos das colecções e a arte do topo primeiro, depois os recortes da lista, e só no fim as
 * cartas inteiras — que são as maiores e as que só se veem ao toque. Se a exportação tiver de
 * desistir a meio, desiste do que menos se nota.
 */
export function reportImageUrls({ event, deck }: ReportInput): string[] {
  const urls = new Set<string>();
  const cards = deck?.cards ?? [];

  if (event.setCode) urls.add(setSymbolUrl(event.setCode));
  for (const card of cards) if (card.setCode) urls.add(setSymbolUrl(card.setCode));

  const hero = eventThumbnailUrl(event, deck ? [deck] : []);
  if (hero) urls.add(hero);

  for (const card of cards) if (card.artCropUrl) urls.add(card.artCropUrl);
  for (const card of cards) {
    const full = cardImageUrl(card.scryfallId);
    if (full) urls.add(full);
  }

  return [...urls];
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

const TYPE_PLURAL: Record<string, string> = {
  Creature: 'Creatures',
  Planeswalker: 'Planeswalkers',
  Battle: 'Battles',
  Instant: 'Instants',
  Sorcery: 'Sorceries',
  Enchantment: 'Enchantments',
  Artifact: 'Artifacts',
  Land: 'Lands',
  Other: 'Other',
  Unknown: 'Other',
};

/**
 * As cores do anel. As de `theme/mana.ts`, mas não o `bg` de todas: os fundos de U, B, R e G são
 * quase pretos e desapareciam no cartão. O branco usa o `bg` (creme); as outras, o `borderSel`.
 */
const RING_COLOR: Record<ManaColor, string> = {
  W: manaColors.W.bg,
  U: manaColors.U.borderSel,
  B: manaColors.B.borderSel,
  R: manaColors.R.borderSel,
  G: manaColors.G.borderSel,
};

const RESULT_WORD = { W: 'Won', L: 'Lost', D: 'Draw' } as const;

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

/** Um id de âncora a partir de um nome — só letras, números e hífenes. */
function anchor(prefix: string, text: string, index: number): string {
  const slug = text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${slug || 'card'}-${index}`;
}

/**
 * Os símbolos de mana usados na página, cada um desenhado uma vez só no CSS.
 *
 * Um pip repetido em quarenta linhas como `<img src="data:…">` eram quarenta cópias do mesmo SVG —
 * o protótipo chegou aos 200 KB por isso. Aqui cada símbolo vira uma classe.
 */
class SymbolSheet {
  private readonly classes = new Map<string, string>();

  /** A classe de um símbolo, ou `null` quando não há SVG para ele e vai como texto. */
  classFor(key: string): string | null {
    const svg = (MANA_SVG as Record<string, string>)[key] ?? COST_SYMBOL_SVG[key];
    if (!svg) return null;

    let name = this.classes.get(key);
    if (!name) {
      name = `s${this.classes.size}`;
      this.classes.set(key, name);
    }
    return name;
  }

  css(): string {
    return [...this.classes.entries()]
      .map(([key, name]) => {
        const svg = (MANA_SVG as Record<string, string>)[key] ?? COST_SYMBOL_SVG[key];
        return `.${name}{background-image:url("${svgDataUri(svg)}")}`;
      })
      .join('\n');
  }
}

interface Context {
  assets: ReportAssets;
  symbols: SymbolSheet;
}

/** A versão embutida de um URL, se houver; senão o próprio URL. */
function src(ctx: Context, url: string): string {
  return ctx.assets.get(url) ?? url;
}

function pip(ctx: Context, color: ManaColor, splash = false): string {
  const name = ctx.symbols.classFor(color)!;
  return `<i class="pip ${splash ? 'splash ' : ''}${name}" role="img" aria-label="${color}"></i>`;
}

function pips(ctx: Context, selection: ManaSelection | undefined): string {
  if (!selection) return '';
  return selection.main.map(c => pip(ctx, c)).join('') + selection.splash.map(c => pip(ctx, c, true)).join('');
}

function manaCost(ctx: Context, cost: string | undefined): string {
  if (!cost) return '';

  // As duas faces separam-se como na carta: `{1}{U/B} // {U/B}`.
  const faces = cost.split(' // ').map(face =>
    parseManaCost(face)
      .map(symbol => {
        const name = ctx.symbols.classFor(symbol.key);
        return name
          ? `<i class="sym ${name}" role="img" aria-label="{${esc(symbol.code)}}"></i>`
          : `<span class="sym txt">${esc(symbol.label)}</span>`;
      })
      .join(''),
  );

  return `<span class="cost">${faces.join('<span class="slash">//</span>')}</span>`;
}

/**
 * O símbolo da colecção, pintado pela raridade como no Deck Detail.
 *
 * Pinta-se com `mask`, que só funciona com o SVG embutido: um SVG remoto como máscara, num ficheiro
 * aberto do disco, é recusado pelo browser. Sem ele fica um losango da mesma cor — a raridade
 * continua a ler-se, que é o que o símbolo dizia.
 */
function rarityMark(ctx: Context, card: DeckCard): string {
  const color = card.rarity ? RARITY_COLOR[card.rarity] : UNKNOWN_RARITY_COLOR;
  const embedded = card.setCode ? ctx.assets.get(setSymbolUrl(card.setCode)) : undefined;
  const title = esc([card.setCode?.toUpperCase(), card.rarity].filter(Boolean).join(' · '));

  return embedded
    ? `<i class="set-sym" style="--r:${color};--m:url(&quot;${embedded}&quot;)" title="${title}"></i>`
    : `<i class="gem" style="--r:${color}" title="${title}"></i>`;
}

function cardRow(ctx: Context, card: DeckCard, id: string): { row: string; overlay: string } {
  const art = card.artCropUrl
    ? `<img class="art" src="${src(ctx, card.artCropUrl)}" alt="" loading="lazy">`
    : '<span class="art blank"></span>';

  const inner =
    `${art}<span class="qty">${card.quantity}</span>` +
    `<span class="nm">${esc(card.name)}</span>` +
    rarityMark(ctx, card) +
    manaCost(ctx, card.manaCost);

  const full = cardImageUrl(card.scryfallId);
  if (!full) return { row: `<li><span class="card">${inner}</span></li>`, overlay: '' };

  return {
    row: `<li id="${id}-row"><a class="card" href="#${id}">${inner}</a></li>`,
    overlay:
      `<div class="lb" id="${id}" role="dialog" aria-label="${esc(card.name)}">` +
      `<a class="lb-bg" href="#${id}-row" aria-label="Close"></a>` +
      `<figure><img src="${src(ctx, full)}" alt="${esc(card.name)}" loading="lazy">` +
      `<figcaption>${esc(card.name)}${card.typeLine ? ` <span>· ${esc(card.typeLine)}</span>` : ''}</figcaption></figure>` +
      `<a class="lb-x" href="#${id}-row">Close</a></div>`,
  };
}

/**
 * Os grupos por tipo, pela ordem da app (`groupByType`, pela contagem) — mas com os terrenos no
 * fim. Num Limited são o grupo maior e saíam primeiro; para quem recebe o relatório, o que
 * interessa são os feitiços.
 */
function orderedGroups(cards: DeckCard[], board: 'main' | 'side') {
  const groups = groupByType(cards, board);
  return [...groups.filter(g => g.type !== 'Land'), ...groups.filter(g => g.type === 'Land')];
}

function cardList(ctx: Context, cards: DeckCard[], board: 'main' | 'side', overlays: string[]): string {
  return orderedGroups(cards, board)
    .map(group => {
      const rows = group.cards.map(card => {
        const { row, overlay } = cardRow(ctx, card, anchor(board === 'main' ? 'c' : 'sb', card.name, overlays.length));
        if (overlay) overlays.push(overlay);
        return row;
      });
      return (
        `<section class="grp"><h3>${TYPE_PLURAL[group.type] ?? group.type} <span>${group.count}</span></h3>` +
        `<ul>${rows.join('')}</ul></section>`
      );
    })
    .join('');
}

function curveChart(cards: DeckCard[]): string {
  const buckets = stackedManaCurve(cards);
  if (buckets.length === 0) return '';

  const peak = Math.max(...buckets.map(b => b.creatures + b.other), 1);
  const creatures = buckets.reduce((sum, b) => sum + b.creatures, 0);
  const other = buckets.reduce((sum, b) => sum + b.other, 0);

  const bars = buckets
    .map(b => {
      const total = b.creatures + b.other;
      const label = b.isTop ? `${b.cmc}+` : String(b.cmc);
      return (
        `<div class="bar" title="${label} mana: ${b.creatures} creatures, ${b.other} other">` +
        `<span class="v">${total || ''}</span>` +
        `<span class="stack" style="height:${Math.round((100 * total) / peak)}%">` +
        `<i class="o" style="flex:${b.other}"></i><i class="c" style="flex:${b.creatures}"></i></span>` +
        `<span class="k">${label}</span></div>`
      );
    })
    .join('');

  return (
    `<figure class="an-curve"><figcaption>Mana curve <span class="key">` +
    `<i class="c"></i>Creatures ${creatures}<i class="o"></i>Other ${other}</span></figcaption>` +
    `<div class="curve" style="grid-template-columns:repeat(${buckets.length},1fr)">${bars}</div></figure>`
  );
}

/**
 * O anel das cores. A regra é a do `colorDistribution`: uma carta de duas cores conta nas duas, e
 * por isso as fatias são proporção entre cores, não partes de um total de cartas.
 */
function colorRing(ctx: Context, cards: DeckCard[]): string {
  const slices = colorDistribution(cards);
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return '';

  // Raio escolhido para a circunferência dar 100: os traços ficam percentagens directas.
  const r = 15.9155;
  let done = 0;
  const arcs = slices
    .map(s => {
      const share = (100 * s.count) / total;
      const arc =
        `<circle r="${r}" cx="21" cy="21" fill="none" stroke="${RING_COLOR[s.color]}" stroke-width="6" ` +
        `stroke-dasharray="${share.toFixed(2)} ${(100 - share).toFixed(2)}" stroke-dashoffset="${(25 - done).toFixed(2)}"/>`;
      done += share;
      return arc;
    })
    .join('');

  const label = slices.map(s => `${s.color} ${Math.round((100 * s.count) / total)}%`).join(', ');
  const legend = slices
    .map(s => `<li>${pip(ctx, s.color)}<span>${Math.round((100 * s.count) / total)}%</span></li>`)
    .join('');

  return (
    `<figure class="an-split"><figcaption>Colors</figcaption>` +
    `<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Color split: ${label}">` +
    `<circle r="${r}" cx="21" cy="21" fill="none" stroke="${colors.bgCardHov}" stroke-width="6"/>${arcs}</svg>` +
    `<ul class="split-lg">${legend}</ul></figure>`
  );
}

function typeLine(cards: DeckCard[]): string {
  return orderedGroups(cards, 'main')
    .map(g => `${TYPE_PLURAL[g.type] ?? g.type} ${g.count}`)
    .join(' · ');
}

/** O nome do adversário: o da taxonomia, senão o que o match já trouxer resolvido. */
function opponentName(match: Match, opponents: Opponent[]): string | undefined {
  return opponents.find(o => o.id === match.opponentId)?.name ?? match.opponent;
}

function roundBlock(ctx: Context, match: Match, opponents: Opponent[]): string {
  const name = opponentName(match, opponents);
  const games = match.games ?? [];
  const score = games.length
    ? `${games.filter(g => g.result === 'W').length}–${games.filter(g => g.result === 'L').length}`
    : '';

  const lines = games
    .map(g => {
      const extras = [
        g.wentFirst === undefined ? '' : `<em>${g.wentFirst ? 'on the play' : 'on the draw'}</em>`,
        g.life ? `<em>life ${g.life.me}–${g.life.opponent}</em>` : '',
      ].join('');
      return `<li class="${g.result.toLowerCase()}"><span>Game ${g.number}</span><b>${RESULT_WORD[g.result]}</b>${extras}</li>`;
    })
    .join('');

  const notes = match.notes ? `<p class="note">${esc(match.notes)}</p>` : '';
  const body =
    lines || notes
      ? `${lines ? `<ol class="games">${lines}</ol>` : ''}${notes}`
      : '<p class="note">Only the result was recorded for this round.</p>';

  const r = match.result.toLowerCase();
  return (
    `<details class="rnd ${r}" id="r${match.round}"><summary>` +
    `<span class="rn">R${match.round}</span><span class="res">${match.result}</span>` +
    `<span class="op">${name ? esc(name) : '<i>Unknown opponent</i>'}</span>` +
    `<span class="op-c">${pips(ctx, match.opponentColors)}</span>` +
    `<span class="gs">${score}</span></summary>${body}</details>`
  );
}

/**
 * A linha da classificação, debaixo do nome.
 *
 * A posição e o escalão, como no Event Detail: "5th of 32 · Top 8". O escalão só aparece se
 * acrescentar alguma coisa — "1st of 16 · 1st Place" diria o mesmo duas vezes. Um evento a decorrer
 * diz em que ronda vai.
 */
function standingLine(event: Event): string | undefined {
  if (isActive(event)) {
    const rounds = event.matches.length;
    return rounds ? `In progress · after round ${rounds}` : 'In progress';
  }

  const placement = formatPlacement(event);
  if (!placement) return undefined;

  const tier = event.placement !== undefined && event.placement > 1 ? eventTier(event) : null;
  return tier ? `${placement} · ${tierLabel(tier)}` : placement;
}

export function renderEventReport(input: ReportInput, assets: ReportAssets = new Map()): string {
  const { event, deck, opponents } = input;
  const ctx: Context = { assets, symbols: new SymbolSheet() };

  const stats = calcEventStats(event);
  const games = event.matches.flatMap(m => m.games ?? []);
  const gamesWon = games.filter(g => g.result === 'W').length;
  const gamesLost = games.filter(g => g.result === 'L').length;

  const shownColors = eventColors(event, deck ? [deck] : []);
  const standing = standingLine(event);
  const hero = eventThumbnailUrl(event, deck ? [deck] : []);

  const record = `${stats.wins}–${stats.losses}${stats.draws ? `–${stats.draws}` : ''}`;
  const deckName = deck?.name ?? event.deckName;
  const title = `${event.name} — ${record}`;
  const description = [record, event.type, deckName].filter(Boolean).join(' · ');

  const badges =
    `<span class="badge">${esc(event.type)}</span>` +
    (event.setCode
      ? `<span class="badge set">${
          assets.has(setSymbolUrl(event.setCode))
            ? `<i class="set-sym" style="--r:${colors.gold};--m:url(&quot;${assets.get(setSymbolUrl(event.setCode))}&quot;)"></i>`
            : ''
        }${esc(event.setCode.toUpperCase())}</span>`
      : '');

  const chips = event.matches
    .map(m => `<a class="chip ${m.result.toLowerCase()}" href="#r${m.round}"><b>${m.result}</b><span>R${m.round}</span></a>`)
    .join('');

  // ── O deck ──
  const overlays: string[] = [];
  const cards = deck?.cards ?? [];
  const mainCount = cards.filter(c => c.board !== 'side').reduce((n, c) => n + c.quantity, 0);
  const sideCount = cards.filter(c => c.board === 'side').reduce((n, c) => n + c.quantity, 0);

  let deckSection = '';
  if (deck && cards.length > 0) {
    const analysis = curveChart(cards) + colorRing(ctx, cards);
    deckSection = `
  <section class="deck" id="deck">
    <header class="sec-h">
      <p class="eyebrow">The deck</p>
      <h2>${esc(deck.name)}</h2>
      <p class="sub">${shownColors ? `<span class="pips">${pips(ctx, shownColors)}</span>` : ''}${
        deck.archetype ? `<span class="arch">${esc(deck.archetype)}</span>` : ''
      }<span>${mainCount} cards</span></p>
    </header>
    ${analysis ? `<div class="analysis"><div class="an-grid">${analysis}</div><p class="types">${typeLine(cards)}</p></div>` : ''}
    <p class="hint">Tap a card to read it.</p>
    ${cardList(ctx, cards, 'main', overlays)}
    ${
      sideCount > 0
        ? `<details class="side"><summary>Sideboard <span>${sideCount}</span></summary>${cardList(ctx, cards, 'side', overlays)}</details>`
        : ''
    }
  </section>`;
  } else if (deckName) {
    // Um evento antigo com o deck escrito à mão: não há lista, mas há nome.
    deckSection = `
  <section class="deck" id="deck">
    <header class="sec-h"><p class="eyebrow">The deck</p><h2>${esc(deckName)}</h2>${
      shownColors ? `<p class="sub"><span class="pips">${pips(ctx, shownColors)}</span></p>` : ''
    }</header>
  </section>`;
  }

  const rounds = event.matches.map(m => roundBlock(ctx, m, opponents)).join('');
  const roundsSection = event.matches.length
    ? `
  <section id="rounds">
    <header class="sec-h"><p class="eyebrow">Round by round</p><h2>Matches</h2></header>
    ${rounds}
  </section>`
    : '';

  // O resto dos pips pede classes a meio do desenho; o CSS só se escreve no fim.
  const metaPips = shownColors ? `<span class="pips">${pips(ctx, shownColors)}</span>` : '';
  const heroStyle = hero ? ` style="background-image:url(&quot;${src(ctx, hero)}&quot;)"` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="MTG Recall">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Playfair+Display:wght@600;700&display=swap">
<style>
${STYLE}
${ctx.symbols.css()}
</style>
</head>
<body>
<div class="page">
  <header class="hero${hero ? '' : ' flat'}"${heroStyle}>
    <div class="hero-in">
      <div class="badges">${badges}</div>
      <h1>${esc(event.name)}</h1>
      <p class="meta"><span>${esc(formatDate(event.date))}</span>${
        event.location ? `<span>${esc(event.location)}</span>` : ''
      }${metaPips}</p>
      ${standing ? `<p class="meta standing">${esc(standing)}</p>` : ''}
    </div>
  </header>

  <section aria-label="Result">
    <div class="stats">
      <div class="rec"><span class="score"><span class="w">${stats.wins}</span><span class="sep">–</span><span class="l">${stats.losses}</span><span class="sep">–</span><span class="d">${stats.draws}</span></span><span class="lbl">W – L – D</span></div>
      <div><span class="big">${stats.points}</span><span class="lbl">Pts</span></div>
      <div><span class="big">${stats.winRate}%</span><span class="lbl">Win rate</span></div>
    </div>
    ${chips ? `<nav class="strip" aria-label="Rounds">${chips}</nav>` : ''}
    ${games.length ? `<p class="games-line">Games ${gamesWon}–${gamesLost}</p>` : ''}
  </section>
${deckSection}
${roundsSection}
  ${event.notes ? `<section class="ev-notes"><p class="eyebrow">Notes</p><p>${esc(event.notes)}</p></section>` : ''}

  <footer><span>Recorded with <b>MTG Recall</b></span><span>${esc(formatDate(event.date))}</span></footer>
</div>
${overlays.join('\n')}
<script>
/* Só conforto: abrir a ronda quando se chega a ela pela pastilha. Sem isto a página vale na mesma. */
function openRound(){var el=location.hash&&document.getElementById(location.hash.slice(1));if(el&&el.tagName==='DETAILS')el.open=true;}
addEventListener('hashchange',openRound);openRound();
</script>
</body>
</html>
`;
}

// ─── Estilo ──────────────────────────────────────────────────────────────────

/** O "Scholar's Archive" da app, em CSS. As cores saem de `theme/colors.ts`. */
const STYLE = `
:root {
  color-scheme: dark;
  --bg: ${colors.bg}; --card: ${colors.bgCard}; --hover: ${colors.bgCardHov}; --border: ${colors.border};
  --gold: ${colors.gold}; --gold-dim: ${colors.goldDim};
  --text: ${colors.textPrim}; --text-sec: ${colors.textSec}; --text-dim: ${colors.textDim};
  --win: ${colors.win}; --win-bg: ${colors.winBg}; --win-bd: ${colors.winBorder};
  --loss: ${colors.loss}; --loss-bg: ${colors.lossBg}; --loss-bd: ${colors.lossBorder};
  --draw: ${colors.draw}; --draw-bg: ${colors.drawBg}; --draw-bd: ${colors.drawBorder};
  --display: "Playfair Display", Georgia, "Times New Roman", serif;
  --body: "EB Garamond", Garamond, Georgia, serif;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.45 var(--body); }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; }
.page { max-width: 600px; margin: 0 auto; padding-inline: 16px; padding-block: 0 48px; }

.hero { position: relative; margin-inline: -16px; min-height: 260px; display: flex; align-items: flex-end;
  background: var(--card) center 30% / cover no-repeat; }
.hero.flat { min-height: 0; padding-top: 32px; background: none; }
.hero::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(19,15,10,.15) 0%, rgba(19,15,10,.55) 45%, var(--bg) 100%); }
.hero.flat::after { display: none; }
.hero-in { position: relative; z-index: 1; padding: 0 16px 18px; width: 100%; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.badge { font: 500 12px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--gold);
  border: 1px solid var(--gold-dim); border-radius: 999px; padding: 5px 10px; background: rgba(19,15,10,.6);
  display: inline-flex; gap: 6px; align-items: center; }
h1 { font: 700 clamp(26px, 7vw, 34px)/1.15 var(--display); margin: 0; text-wrap: balance; }
.meta { color: var(--text-sec); margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.pips { display: inline-flex; gap: 3px; align-items: center; }
.standing { font-style: italic; color: var(--gold); }

.pip, .sym { display: inline-block; background-position: center; background-size: contain; background-repeat: no-repeat; }
.pip { width: 18px; height: 18px; vertical-align: -3px; }
.pip.splash { width: 13px; height: 13px; opacity: .65; vertical-align: -1px; }
.set-sym { display: inline-block; width: 14px; height: 14px; background: var(--r);
  -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.gem { width: 8px; height: 8px; transform: rotate(45deg); background: var(--r); border-radius: 1px; opacity: .9; }

.stats { display: grid; grid-template-columns: 2fr 1fr 1fr; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; margin-top: 4px; }
.stats > div { display: grid; place-items: center; align-content: center; padding: 14px 6px; gap: 2px; }
.stats > div + div { border-left: 1px solid var(--border); }
.stats .rec { background: rgba(201,169,110,.06); }
.score { font: 700 34px/1 var(--display); font-variant-numeric: tabular-nums; display: flex; gap: .18em; align-items: baseline; }
.score .w { color: var(--win); } .score .l { color: var(--loss); } .score .d { color: var(--draw); }
.score .sep { color: var(--text-dim); font-size: .7em; }
.big { font: 700 24px/1 var(--display); font-variant-numeric: tabular-nums; }
.lbl { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--text-sec); }

.strip { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 0; }
.chip { display: grid; justify-items: center; width: 42px; padding: 6px 0 5px; border-radius: 8px; border: 1px solid; }
.chip b { font: 700 17px/1 var(--display); }
.chip span { font-size: 11px; letter-spacing: .08em; color: var(--text-sec); margin-top: 3px; }
.chip.w { background: var(--win-bg); border-color: var(--win-bd); color: var(--win); }
.chip.l { background: var(--loss-bg); border-color: var(--loss-bd); color: var(--loss); }
.chip.d { background: var(--draw-bg); border-color: var(--draw-bd); color: var(--draw); }
.games-line { color: var(--text-sec); font-size: 15px; margin: 8px 0 0; }

.sec-h { margin: 40px 0 14px; }
.eyebrow { font-style: italic; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--gold-dim); margin: 0 0 2px; }
h2 { font: 600 24px/1.2 var(--display); margin: 0; text-wrap: balance; }
.sub { margin: 6px 0 0; color: var(--text-sec); display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
.arch { font-style: italic; }

.analysis { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 14px 12px; }
.an-grid { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; }
.an-grid figure { margin: 0; min-width: 0; }
.an-grid figcaption { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--text-sec); margin-bottom: 8px;
  display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: center; }
.key { letter-spacing: .04em; text-transform: none; color: var(--text-dim); font-size: 13px; display: inline-flex; gap: 4px 5px; align-items: center; flex-wrap: wrap; }
.key i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.key i.o { margin-left: 6px; }
.c { background: var(--gold); } .o { background: var(--gold-dim); }
.curve { display: grid; gap: 5px; height: 110px; align-items: end; }
.bar { display: grid; grid-template-rows: 16px 1fr 16px; height: 100%; justify-items: center; }
.stack { align-self: end; width: 100%; max-width: 26px; display: flex; flex-direction: column; gap: 1px;
  border-radius: 3px 3px 0 0; overflow: hidden; }
.stack i { display: block; min-height: 0; }
.bar .v, .bar .k { font-size: 12px; color: var(--text-sec); font-variant-numeric: tabular-nums; }
.bar .k { color: var(--text-dim); border-top: 1px solid var(--border); width: 100%; text-align: center; }
.an-split { display: grid; justify-items: center; }
.an-split figcaption { justify-self: stretch; justify-content: center; }
.donut { width: 64px; height: 64px; display: block; }
.split-lg { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 3px; }
.split-lg li { display: flex; gap: 6px; align-items: center; font-size: 14px; color: var(--text-sec); font-variant-numeric: tabular-nums; }
.split-lg .pip { width: 14px; height: 14px; }
.types { margin: 10px 0 0; font-size: 14px; color: var(--text-sec); }
.hint { font-style: italic; color: var(--text-dim); font-size: 14px; margin: 14px 0 0; }

.grp h3 { font: 500 13px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: var(--gold);
  margin: 22px 0 6px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
.grp h3 span { color: var(--text-dim); }
.grp ul { list-style: none; margin: 0; padding: 0; }
.card { display: grid; grid-template-columns: 72px 22px 1fr auto auto; align-items: center; gap: 10px;
  padding: 5px 4px 5px 0; border-radius: 8px; }
a.card:hover, a.card:focus-visible { background: var(--hover); outline: none; }
a.card:focus-visible { box-shadow: 0 0 0 2px var(--gold-dim); }
.art { width: 72px; aspect-ratio: 626 / 457; object-fit: cover; border-radius: 4px; background: var(--hover); display: block; }
.qty { color: var(--text-sec); font-variant-numeric: tabular-nums; text-align: right; }
.nm { min-width: 0; overflow-wrap: anywhere; line-height: 1.2; }
.cost { display: inline-flex; gap: 2px; align-items: center; justify-self: end; }
.sym { width: 16px; height: 16px; }
.sym.txt { display: inline-grid; place-items: center; min-width: 16px; border-radius: 8px; padding: 0 3px;
  background: #CAC5C0; color: #0D0F0F; font: 600 10px/1 system-ui, sans-serif; }
.slash { color: var(--text-dim); margin: 0 3px; font-size: 13px; }

.side { margin-top: 24px; border-top: 1px solid var(--border); }
.side > summary { cursor: pointer; padding: 14px 0 0; color: var(--text-sec); font-style: italic; }
.side > summary span { color: var(--text-dim); }

.lb { display: none; position: fixed; inset: 0; z-index: 10; place-items: center; padding: 24px 16px; }
.lb:target { display: grid; }
.lb-bg { position: absolute; inset: 0; background: rgba(8,6,4,.88); }
.lb figure { position: relative; margin: 0; width: min(100%, 420px); }
.lb figure img { width: 100%; aspect-ratio: 488 / 680; border-radius: 4.75% / 3.5%; display: block; background: var(--card);
  box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.lb figcaption { text-align: center; margin-top: 10px; font-size: 15px; }
.lb figcaption span { color: var(--text-sec); }
.lb-x { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); right: 16px; color: var(--gold);
  border: 1px solid var(--gold-dim); border-radius: 999px; padding: 6px 14px; background: var(--bg); }

.rnd { border: 1px solid var(--border); border-radius: 10px; background: var(--card); margin-top: 8px; }
.rnd summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 30px 28px 1fr auto auto 14px;
  gap: 8px; align-items: center; padding: 11px 12px; }
.rnd summary::-webkit-details-marker { display: none; }
.rnd summary::after { content: "›"; color: var(--text-dim); font-size: 20px; line-height: 1; transition: transform .2s; }
.rnd[open] summary::after { transform: rotate(90deg); }
.rnd summary:focus-visible { outline: 2px solid var(--gold-dim); outline-offset: -2px; border-radius: 10px; }
.rn { color: var(--text-dim); font-size: 14px; letter-spacing: .06em; }
.res { font: 700 17px/1 var(--display); text-align: center; border-radius: 6px; padding: 5px 0; border: 1px solid; }
.rnd.w .res { color: var(--win); background: var(--win-bg); border-color: var(--win-bd); }
.rnd.l .res { color: var(--loss); background: var(--loss-bg); border-color: var(--loss-bd); }
.rnd.d .res { color: var(--draw); background: var(--draw-bg); border-color: var(--draw-bd); }
.op { font: 500 17px/1.2 var(--body); min-width: 0; overflow-wrap: anywhere; }
.op i { color: var(--text-dim); }
.op-c { display: inline-flex; gap: 2px; align-items: center; }
.op-c .pip { width: 15px; height: 15px; } .op-c .pip.splash { width: 11px; height: 11px; }
.gs { color: var(--text-sec); font-variant-numeric: tabular-nums; font-size: 15px; }
.games { list-style: none; margin: 0; padding: 2px 12px 12px 78px; display: grid; gap: 4px; }
.games li { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 15px; color: var(--text-sec); }
.games b { font-weight: 500; } .games .w b { color: var(--win); } .games .l b { color: var(--loss); }
.games em { color: var(--text-dim); }
.note { margin: 0; padding: 0 12px 12px 78px; font-style: italic; color: var(--text-sec); font-size: 15px; }
.ev-notes { margin-top: 32px; } .ev-notes p:last-child { margin: 4px 0 0; color: var(--text-sec); white-space: pre-line; }

footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 14px;
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
footer b { font: 600 14px var(--display); color: var(--gold-dim); }

@media (max-width: 380px) {
  .card { grid-template-columns: 56px 18px 1fr auto auto; gap: 8px; }
  .art { width: 56px; }
  .games, .note { padding-left: 12px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .rnd summary::after { transition: none; } }
`;

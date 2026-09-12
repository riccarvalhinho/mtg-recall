# Brief — ícone da app

> Para entregar a quem desenhar o ícone (Claude Design ou outro). Escrito para ser lido por quem
> não conhece o projecto: tudo o que é preciso saber está aqui.

## O que a app é

Registo pessoal de torneios de Magic: The Gathering, para telemóvel Android. **Um utilizador só** —
não é um produto, não vai para a Play Store, não tem contas. Usa-se **numa loja de cartas, entre
rondas**, muitas vezes sem rede: abre-se, regista-se o resultado de um match, fecha-se.

Hoje o ícone é o **placeholder do Expo** (três círculos cinzentos numa grelha). Nunca foi tocado.

## O conceito, que já existe e manda

O design system chama-se **"Scholar's Archive"** e está em `design-brief.md` e no `CLAUDE.md`:
biblioteca académica semi-minimalista. **Warm, culta, organizada. Não épico, não gaming.** Sem
dragões, sem chamas, sem espadas, sem brilhos.

A app por dentro é escura e dourada, com tipografia serifada — Playfair Display nos títulos, EB
Garamond no corpo. O ícone tem de parecer da mesma família que isto:

| Papel | Cor |
|---|---|
| Fundo | `#130F0A` (quase preto, quente) |
| Superfície | `#1E1812` |
| Dourado (acento) | `#C9A96E` |
| Dourado esbatido | `#8B7248` |
| Texto claro | `#E8DCC8` |
| Linhas / bordas | `#3A3020` |

## Restrições duras

1. **Tem de ler a 48 dp.** É o tamanho real no ecrã do telemóvel — à volta de meio centímetro. Uma
   forma só, cheia, com contraste. Detalhe fino, traços de 1 px e texto pequeno desaparecem.
2. **Sem marcas registadas da Wizards of the Coast.** Nada de símbolos de mana, verso de carta,
   o "M" da Magic ou tipografia da marca. Por dentro a app usa os símbolos oficiais, o que é uma
   coisa; o ícone é a *cara* da app e não deve parecer um produto oficial. Uma carta genérica —
   rectângulo de cantos redondos — não é marca de ninguém e está bem.
3. **Tem de aguentar qualquer fundo.** O ícone assenta no papel de parede que o utilizador tiver,
   claro ou escuro. Não pode depender de o fundo ser escuro para se ver.
4. **Sem letras nem palavras.** "MTG Recall" já aparece escrito por baixo do ícone. Um monograma de
   uma ou duas letras é aceitável se for tratado como forma, não como texto.

## O que entregar

Tudo **PNG, quadrado, sem transparência a fazer de fundo** (excepto onde indicado), sRGB.

| Ficheiro | Tamanho | O que é |
|---|---|---|
| `icon.png` | 1024×1024 | O ícone completo, já com fundo. Serve de base a tudo o resto |
| `adaptive-icon.png` | 1024×1024 | **Só o primeiro plano**, fundo transparente. O Android põe-lhe o fundo por trás e recorta a forma (círculo, quadrado redondo, gota — varia com o telemóvel) |
| `monochrome-icon.png` | 1024×1024 | A mesma forma a **branco sobre transparente**. É o ícone temático do Android 13+, que o sistema pinta com as cores do papel de parede |
| `splash-icon.png` | 1024×1024 | Marca do arranque, transparente, sobre `#130F0A`. Pode ser o mesmo desenho ou uma versão mais simples |
| `favicon.png` | 48×48 | Para a versão web. Menos importante |

### A zona segura do `adaptive-icon.png` — o erro mais fácil de cometer

O Android recorta este ficheiro com uma máscara que **muda de telemóvel para telemóvel**, e ainda o
anima ao tocar. Só se pode contar com o **centro**:

- Tela de 1024×1024.
- Tudo o que interessa dentro de um **círculo central de ~660 px** de diâmetro.
- A faixa de fora (cerca de 180 px de cada lado) é margem que pode ser cortada. Não pôr lá nada que
  faça falta.

Desenhar até às bordas parece bem no ficheiro e aparece cortado no telemóvel.

## Onde isto entra

Os ficheiros vão para `assets/` e substituem os que lá estão. No `app.json`, dentro de
`expo.android.adaptiveIcon`, fica assim:

```json
"adaptiveIcon": {
  "foregroundImage": "./assets/adaptive-icon.png",
  "monochromeImage": "./assets/monochrome-icon.png",
  "backgroundColor": "#130F0A"
}
```

O `backgroundColor` é o que se vê por trás do primeiro plano. Está posto no fundo da app; se o
desenho pedir outro, diz-se qual.

Depois é gerar um APK novo (Actions → **Gerar APK (Gradle)**) — o ícone é nativo e não entra por
actualização, tal como o resto (ADR 0008).

## Direcções possíveis

Não são obrigatórias — são três pontos de partida que cabem no conceito. Escolher uma e levá-la a
sério é melhor do que misturar as três.

1. **Ex-libris.** O carimbo que se põe num livro para dizer de quem é. Moldura fina dourada, um
   monograma ou uma forma simples ao centro, fundo escuro. É o que mais directamente diz "arquivo
   pessoal" — e é literalmente o que a app é.
2. **Cartas como lombadas.** Três ou quatro rectângulos verticais lado a lado, como livros numa
   estante vistos de frente — que são também cartas de Magic vistas de topo. Lê bem em pequeno
   porque são formas grandes e o ritmo é reconhecível.
3. **A marca de página.** Uma fita ou separador dourado sobre uma superfície escura. Simples,
   assimétrico, e diz "registo" sem dizer "jogo".

## O que evitar

- Gradientes complexos: viram lama a 48 dp.
- Mais do que duas cores além do fundo.
- Contornos finos — a máscara do Android come-os na borda.
- Perspectiva e sombras realistas. O resto da app é plano.
- Qualquer coisa que pareça um logótipo de torneio ou de e-sports.

## Como validar antes de dar por fechado

1. Reduzir a 48×48 px e olhar. Se não se percebe o que é, não está feito.
2. Pôr sobre um fundo branco e sobre um fundo preto.
3. Cortar em círculo e em quadrado de cantos redondos — as duas máscaras mais comuns.

## Ponta solta

O fundo do arranque no `app.json` é `#1C1A14`, que **não é nenhuma das cores do design system** (o
fundo da app é `#130F0A`). É provavelmente um resto do template. Quem mexer no ícone que decida se
alinha os dois.

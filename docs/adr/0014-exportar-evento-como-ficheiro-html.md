# ADR 0014 — Um evento exporta-se como um ficheiro HTML, partilhado pela folha de partilha do Android

**Data:** 2026-09-26
**Estado:** Aceite

## Contexto

Quero mandar o relatório de um torneio a um grupo de amigos no Telegram (às vezes WhatsApp): o
resultado, os números, o deck — com a carta inteira ao toque, para quem recebe poder ler o que ela
faz — e contra quem se ganhou e perdeu.

Três formas de o fazer foram desenhadas e comparadas em `design/event-export/README.md`: um ficheiro
HTML gerado no telemóvel, um link para uma página no GitHub Pages, e um PDF. As três partem do mesmo
HTML.

Duas restrições pesaram. A app é **offline-first** (regra 3): acaba-se um torneio numa loja muitas
vezes sem rede. E no iPhone o Telegram e o WhatsApp abrem documentos num visualizador próprio que pode
não correr JavaScript.

## Decisão

**O relatório é sempre um ficheiro `.html`**, escrito pela app a partir dos dados locais e entregue à
**folha de partilha do Android** (`expo-sharing`), onde se escolhe o Telegram, o WhatsApp ou outra
coisa qualquer.

- O HTML sai de uma função pura, `domain/eventReport.ts`, testada. A app escreve-o na cache
  (`expo-file-system`) e partilha-o; nada passa pela outbox nem por `data/`.
- **Nada do que é essencial depende de JavaScript.** As rondas abrem com `<details>`, a carta
  inteira abre com uma âncora e `:target`. O único script é conforto.
- As imagens das cartas são **links para a Scryfall**, não vão embutidas: gerar não precisa de rede,
  o ficheiro fica em ~60 KB, e as imagens carregam no telemóvel de quem abre. A carta inteira só
  descarrega quando se toca nela.
- Os símbolos de mana WUBRG vão embutidos, os mesmos de `assets/mana/symbols.ts`.

## Alternativas consideradas

**Link para o GitHub Pages.** A melhor experiência no chat — pré-visualização com a arte e o
recorde. Recusado como forma principal porque depende de o evento já ter sincronizado e de o Pages
ter publicado, o que na loja sem rede não acontece, e um link partilhado cedo demais dá 404. Não fica
fechado: o renderer está em `domain/` e pode ser chamado pelo `build-bundle` no dia em que se queira.

**PDF (`expo-print`).** Abre em qualquer lado, mas perde o toque na carta — o ponto da coisa. Para as
cartas se lerem teriam de ir todas em tamanho de leitura, e um Sealed passava a quatro páginas. E
precisa de rede ao gerar, para as imagens.

## Consequências

**Fica fácil:** exportar na loja sem rede; mandar para qualquer app que a folha de partilha ofereça;
um dia, publicar a mesma página no Pages sem escrever outro renderer.

**Fica difícil:** dois módulos nativos novos (`expo-sharing`, `expo-file-system`) — APK novo, como
qualquer alteração (ADR 0008). No chat o relatório aparece como ficheiro, sem pré-visualização, e
no Android abre-se por "Abrir com…" → browser.

**A vigiar:** se no iPhone de alguém do grupo o ficheiro abrir sem imagens (o visualizador a
recusar recursos remotos), a saída é embutir os recortes da lista na geração — com rede — e deixar a
carta inteira como link. Ou voltar ao link do Pages.

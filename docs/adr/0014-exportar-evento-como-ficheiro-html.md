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
- **As imagens vão dentro do ficheiro** — os recortes da lista, a carta inteira de cada uma, a arte
  do topo e os símbolos das colecções. O ficheiro leva tudo o que mostra, e quem o abre não precisa
  de rede nem de um visualizador que aceite ir buscar imagens fora (revisão de 2026-09-26, abaixo).
- Cada imagem procura-se primeiro na **cache do `expo-image`** (o que o Deck Detail já desenhou),
  depois na rede. **O que não se conseguir fica como link para a Scryfall**: exportar nunca falha
  por causa de uma imagem, e na loja sem rede sai o ficheiro com o que houver em cache (regra 3).
  O Event Detail diz quantas ficaram de fora.
- Os símbolos de mana vão embutidos a partir dos SVG locais (`assets/mana/symbols.ts` e
  `costSymbols.ts`), cada um uma vez só no CSS.

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
no Android abre-se por "Abrir com…" → browser. E o ficheiro pesa: ~3–4 MB num Limited (umas 23
cartas diferentes, recorte e carta inteira de cada uma); um Commander de cem cartas diferentes
chega aos 15 MB. O Telegram e o WhatsApp aceitam documentos muito maiores.

**A vigiar:** um Commander a passar do razoável — a saída seria deixar as cartas inteiras como link
e embutir só os recortes. E o `:target` no visualizador do iPhone, que ainda ninguém experimentou.

## Revisão de 2026-09-26 — as imagens vão dentro

A primeira versão desta decisão deixava as imagens como links para a Scryfall, para o ficheiro ficar
leve e gerar-se sem rede. A pergunta que a desfez foi a certa: *quem recebe vê as cartas?* Só se
tiver rede **e** se o visualizador em que o abrir aceitar ir buscar imagens fora — e o do Telegram
e do WhatsApp no iPhone é justamente o que não se sabe. Um relatório de cartas sem cartas não serve.

Embutir custa o peso e precisa de rede ao gerar. O peso aceita-se (ver acima). A rede resolve-se
pela cache: as imagens de um deck que já se abriu no telemóvel estão em disco, e o que não estiver
fica como link — o mesmo comportamento da primeira versão, só que agora como recurso e não como
regra.

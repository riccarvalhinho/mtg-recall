# ADR 0009 — A decklist por fotografia usa OCR local, não um serviço de visão

**Data:** 2026-09-12
**Estado:** Proposto — por validar contra uma fotografia real

## Contexto

Escrever uma decklist de sessenta cartas no telemóvel é trabalho a sério, e foi por isso que a lista
ficou opcional no schema (ADR da Fase 2, `data/schema/deck.schema.json`). A forma como o autor já
regista decks hoje é outra: espalha as cartas na mesa, sobrepostas de maneira a que **todos os
títulos fiquem visíveis**, em várias colunas, e tira uma fotografia.

O que a fotografia contém é, portanto, **texto** — nomes de cartas, repetidos tantas vezes quantas as
cópias — e não arte a reconhecer. Isto muda a natureza do problema: não é visão computacional a
identificar ilustrações, é leitura de texto com posição conhecida.

A fotografia em si não interessa guardar. O que interessa é a lista que sai dela.

Há uma menção a "câmara para ler cartas" no ADR 0003, a justificar a escolha de app nativa, que diz
estar no roadmap. **Não estava.** Esta é a primeira vez que a ideia é desenhada.

## Decisão

O reconhecimento é feito **no telemóvel, com OCR local** (ML Kit Text Recognition do Android), e não
enviando a fotografia para um serviço de visão.

O fluxo:

1. Fotografar. A imagem fica em memória; **não é guardada nem commitada**.
2. OCR devolve blocos de texto **com as respectivas caixas delimitadoras**.
3. Agrupar os blocos por posição horizontal para reconstruir as colunas, e ordenar por posição
   vertical dentro de cada coluna. É isto que faz o esquema de várias colunas funcionar.
4. Comparar cada linha com os nomes de cartas conhecidos, com tolerância a erros — o OCR vai trocar
   letras, e um nome próprio de Magic não perdoa uma comparação exacta.
5. **Nomes repetidos viram quantidade.** Quatro cópias espalhadas dão quatro leituras do mesmo nome,
   que é exactamente a informação que faltaria escrever à mão.
6. Mostrar o resultado para confirmação **antes** de gravar. Nada entra no deck sem passar por aqui.

## Alternativas consideradas

**Mandar a fotografia para a API do Claude (ou outro modelo de visão).** Funcionaria, e bem: à volta
de um cêntimo por fotografia. Recusada porque obriga a uma conta com facturação e a uma chave no
telemóvel, e porque põe a funcionalidade a depender de rede. É o mesmo custo que o ADR 0006 saiu a
eliminar quando tirou o Supabase, e o ADR 0007 recusou outra vez ao escolher a Scryfall em vez da
Cardmarket. Um modelo de linguagem para ler uma coluna de nomes é um martelo para uma tarefa de
pinça.

**Usar a integração de Claude Code que o autor já usa.** Não existe: o Claude Code é uma ferramenta
de desenvolvimento a correr num contentor, não um serviço que o APK possa chamar. Fica registado
porque a pergunta foi feita e a resposta não é óbvia.

**Reconhecer as cartas pela arte.** Foi o que se assumiu de início, e estava errado. Com os títulos
à vista, é muito mais difícil do que o necessário.

## Consequências

**Fica fácil:** um deck inteiro entra na app com uma fotografia, sem rede, sem conta, sem custo e sem
enviar nada para lado nenhum. Funciona na loja em modo de avião, como o resto da app.

**Fica difícil:** o ML Kit é código nativo, portanto entra por APK novo e não por actualização.
A qualidade depende da fotografia — luz, foco, inclinação das cartas, quanto da barra do título fica
visível. Não vai acertar sempre, e é por isso que o passo de confirmação não é opcional.

Nomes que existem em várias impressões continuam sem impressão determinada: o OCR dá o nome, não o
set. Cartas assim entram sem `scryfallId` e, por consequência, sem preço (ver ADR 0007).

**A vigiar:** se o passo de confirmação der mais trabalho a corrigir do que dava a escrever a lista
de raiz, a funcionalidade não está a cumprir. Nessa altura a saída é a API de visão como **segunda**
tentativa, só para as fotografias que o OCR local não resolver — não como caminho principal.

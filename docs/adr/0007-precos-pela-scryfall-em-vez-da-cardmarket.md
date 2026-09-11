# ADR 0007 — Os preços das cartas vêm da Scryfall, não da Cardmarket API

**Data:** 2026-09-11
**Estado:** Aceite

## Contexto

A Fase 4 do roadmap — valor da colecção e a sua evolução ao longo do tempo — precisa de um preço por
carta. O `CLAUDE.md` dava a Cardmarket API como escolha feita, mas nunca foi decidida em lado nenhum:
era uma linha numa tabela de stack, herdada do plano original.

A Cardmarket API tem dois requisitos que só aparecem quando se vai mesmo usá-la. Primeiro, exige uma
aplicação registada e **aprovada** pela Cardmarket, com um processo de pedido que não é imediato nem
garantido para uso pessoal. Segundo, autentica por OAuth 1.0a — assinatura HMAC de cada pedido, com
os quatro segredos que isso implica.

Isto colide de frente com a razão de ser do ADR 0006. A app foi reestruturada precisamente para
deixar de depender de infraestrutura online que é preciso pedir, manter e renovar, porque esse
trabalho estava entre o autor e a app que ele queria usar. Trocar o Supabase por um processo de
aprovação da Cardmarket seria repetir o erro com outro nome.

A Scryfall, que a app já usa para dados de cartas e sets (ADR por escrever, prática assente), devolve
em cada carta um objecto `prices` com `eur` e `eur_foil` — que são, eles próprios, preços da
Cardmarket. Sem conta, sem autenticação, sem aprovação. Publica também bulk data diário, que é um
ficheiro só em vez de milhares de pedidos.

## Decisão

Os preços vêm da Scryfall, pelo campo `prices.eur` / `prices.eur_foil`.

São actualizados por um **workflow agendado no GitHub Actions**, nunca pelo telemóvel. O telemóvel
não tem nada que andar a puxar preços: não é uma operação offline-first, não é urgente, e fazê-la no
CI mantém a app sem mais uma razão para precisar de rede.

Os preços vivem num ficheiro próprio, separado da colecção. Um preço que muda todas as semanas não
tem nada que sujar o diff do ficheiro onde está registado que se tem quatro cópias de uma carta.

A evolução do valor é um **registo append-only**: uma entrada por actualização, com data e total.
Isto parece contrariar a regra de não guardar campos calculados, e é de propósito — uma entrada
destas não é derivável do estado actual, é a medição de um momento que já passou. É um registo de
pesagens, não um campo somado.

## Alternativas consideradas

**Cardmarket API.** Dá o preço real do mercado onde o autor compra, incluindo condição e idioma, que
a Scryfall não distingue. Recusada pelo processo de aprovação e pelo OAuth 1.0a: é exactamente o tipo
de dependência que o ADR 0006 saiu a eliminar, e o ganho — precisão de preço numa colecção pessoal —
não paga esse custo.

**Puxar preços do telemóvel, ao abrir a colecção.** Mais simples de escrever e sem workflow nenhum.
Recusada porque põe a app a precisar de rede para mostrar um número, e porque cada abertura do écran
seria um pedido à Scryfall por carta — que o rate limit dela não justifica nem agradece.

**Guardar o preço dentro de `cards.json`, ao lado da quantidade.** Recusada pelo diff: cada
actualização reescreveria o ficheiro inteiro da colecção, e o histórico do Git deixaria de mostrar
quando é que se comprou uma carta, que é a informação que ali interessa.

**Calcular a evolução do valor a partir do histórico do Git, em vez de a guardar.** É o que o
roadmap sugeria ("que o Git dá quase de graça"). Recusada porque a app lê o `bundle.json`, não o
repositório: não tem acesso ao histórico. Fazer o CI reconstruir a série a cada publicação seria ler
todos os commits do ficheiro de preços para produzir o que um append resolve.

## Consequências

**Fica fácil:** não há nada a pedir a ninguém nem segredos novos a guardar. O workflow corre com o
`GITHUB_TOKEN` que a Action já tem, e a Scryfall responde a um pedido sem cabeçalho de autenticação.

**Fica difícil:** os preços são de referência e não do mercado real do autor. A Scryfall não
distingue condição nem idioma, e a própria documentação dela avisa que os preços não servem para
decisões de valor elevado. Uma colecção avaliada assim dá uma ordem de grandeza, não um número para
levar a uma loja. Foils e impressões diferentes só ficam certos se a colecção guardar o
`scryfallId` da impressão concreta, e não apenas o nome da carta.

**A vigiar:** se a diferença entre o valor que a app mostra e o que a Cardmarket dá passar a
incomodar a sério, a saída não é a API — é exportar a colecção no formato que a Cardmarket importa e
ver lá o número, uma vez por ano, à mão.

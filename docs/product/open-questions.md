# Perguntas em aberto

> Uma pergunta que aparece a meio de uma implementação vem para aqui em vez de ser respondida em
> silêncio. Quando for respondida, sai daqui e vai para onde pertence: um ADR, o `data-model.md`, ou
> o roadmap.

| # | Pergunta | Onde se decide | Estado |
|---|---|---|---|
| Q1 | Um evento apagado deve deixar de existir no repositório, ou ficar com `status: "deleted"`? | `data-model.md` | **Respondida:** apaga mesmo. O histórico do Git é a rede de segurança e um ficheiro marcado como apagado voltaria no restauro seguinte. Ver § Ciclo de vida dos registos |
| Q2 | Vale a pena um limite ao número de eventos que o `bundle.json` traz, ou carrega-se sempre tudo? | `tools/build-bundle.ts` | Adiado — com dezenas de eventos por ano, não é problema nesta década |
| Q3 | Os nomes dos adversários ficam como são, num repositório público? | ADR 0005 | Respondida: ficam; a saída é a alcunha em `opponents.json` |
| Q4 | O que acontece se dois eventos forem criados no mesmo dia com o mesmo nome? O slug colide. | `data-model.md` | **Respondida:** sufixo `-2`, `-3`, como qualquer sistema de ficheiros. Já implementado em `domain/slug.ts` (`uniqueId`). Ver § Ciclo de vida dos registos |
| Q5 | Quando um match é apagado a meio, renumerar as rondas seguintes ou deixar o buraco? | `data-model.md` | **Respondida:** renumerar — a validação recusa saltos na sequência. Custo assumido: a ronda 3 real passa a estar guardada como 2. Ver § Ciclo de vida dos registos |
| Q6 | A app deve impedir criar um evento enquanto outro está `active`? | écran Add Event | Respondida: impede. O modal mostra qual é o torneio a decorrer e um atalho para o abrir, em vez de concluir o anterior em silêncio. O `validate` mantém-se em aviso, porque um ficheiro editado à mão ainda pode ficar com dois |
| Q7 | Um restauro com alterações por enviar deve descartar a fila ou enviá-la primeiro? | `store/useEventsStore.ts` + Settings | **Respondida:** o restauro recusa-se a correr com fila pendente e manda enviá-la (`Sync now`). Se o utilizador insistir, a fila é mesmo descartada — e agora o aviso é verdade, porque `outbox.clear()` existe e é chamado. Ver § Ciclo de vida dos registos |
| Q8 | De onde vêm os preços das cartas na Fase 4 — Cardmarket ou Scryfall? | ADR novo + `docs/product/roadmap.md` | Proposta: **Scryfall**. A Cardmarket API exige app aprovada e OAuth, que é a dependência online que o ADR 0006 existe para evitar; a Scryfall devolve `prices.eur` (que vem da Cardmarket) sem conta nenhuma e tem bulk data diário para um workflow agendado. Custo: preços de referência, não os anúncios reais do mercado |

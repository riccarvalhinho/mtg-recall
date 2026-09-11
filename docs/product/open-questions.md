# Perguntas em aberto

> Uma pergunta que aparece a meio de uma implementação vem para aqui em vez de ser respondida em
> silêncio. Quando for respondida, sai daqui e vai para onde pertence: um ADR, o `data-model.md`, ou
> o roadmap.

| # | Pergunta | Onde se decide | Estado |
|---|---|---|---|
| Q1 | Um evento apagado deve deixar de existir no repositório, ou ficar com `status: "deleted"`? Hoje o Supabase fazia soft delete; num repositório, o Git já guarda o que foi apagado. | ADR ou `data-model.md` | Proposta: apagar mesmo o ficheiro, porque o histórico do Git é a rede de segurança |
| Q2 | Vale a pena um limite ao número de eventos que o `bundle.json` traz, ou carrega-se sempre tudo? | `tools/build-bundle.ts` | Adiado — com dezenas de eventos por ano, não é problema nesta década |
| Q3 | Os nomes dos adversários ficam como são, num repositório público? | ADR 0005 | Respondida: ficam; a saída é a alcunha em `opponents.json` |
| Q4 | O que acontece se dois eventos forem criados no mesmo dia com o mesmo nome? O slug colide. | `services/repoFiles.ts` | Proposta: sufixo `-2`, como qualquer sistema de ficheiros |
| Q5 | Quando um match é apagado a meio, renumerar as rondas seguintes ou deixar o buraco? | `data-model.md` | Proposta: renumerar, que é o que a app já faz hoje |
| Q6 | A app deve impedir criar um evento enquanto outro está `active`? | écran Add Event | Respondida: impede. O modal mostra qual é o torneio a decorrer e um atalho para o abrir, em vez de concluir o anterior em silêncio. O `validate` mantém-se em aviso, porque um ficheiro editado à mão ainda pode ficar com dois |
| Q7 | Um restauro com alterações por enviar deve **descartar** a fila, ou **esvaziá-la primeiro** e só depois puxar do GitHub? Hoje não faz nem uma coisa nem outra: o modal avisa que se perdem, mas a fila sobrevive ao `replaceAll` e é enviada a seguir, por cima do que foi restaurado. | `store/useEventsStore.ts` + écran de Settings | Proposta: **esvaziar primeiro**. Um restauro é quase sempre "o telemóvel novo" ou "alguma coisa correu mal", e nos dois casos o que está por enviar é trabalho real que ainda não chegou ao repositório. Só se descarta se o envio falhar e o utilizador insistir — e aí o aviso passa a ser verdade |
| Q8 | De onde vêm os preços das cartas na Fase 4 — Cardmarket ou Scryfall? | ADR novo + `docs/product/roadmap.md` | Proposta: **Scryfall**. A Cardmarket API exige app aprovada e OAuth, que é a dependência online que o ADR 0006 existe para evitar; a Scryfall devolve `prices.eur` (que vem da Cardmarket) sem conta nenhuma e tem bulk data diário para um workflow agendado. Custo: preços de referência, não os anúncios reais do mercado |

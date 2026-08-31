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
| Q6 | A app deve impedir criar um evento enquanto outro está `active` — concluindo o anterior, avisando, ou deixando andar? Hoje deixa andar e o `validate` só avisa. | `docs/specs` ou o écran Add Event | Em aberto. Dois torneios ao mesmo tempo não existem na prática, mas concluir o anterior em silêncio mexeria em dados sem pedir |

# ADR 0012 — O ficheiro guarda a posição final; os escalões deduzem-se dela

**Data:** 2026-09-14
**Estado:** Aceite

## Contexto

Até aqui, fechar um torneio era escolher um escalão de uma grelha de botões — `1st Place`, `Top 2`,
`Top 4`, `Top 8`, `Top 16`, `Top 32`, `Other` — que ia para o ficheiro como uma string no campo
`rank`. O número de jogadores era um segundo campo, opcional, que não fazia nada: nenhuma
estatística lhe tocava.

Registar um 5.º lugar entre 32 como "Top 8" **deita fora a única coisa que o distingue de um 8.º
lugar**. Um 5.º lugar é quase a mesa final; um 8.º entrou por pouco. Ao fim de um ano de torneios o
registo só sabe dizer que se chegou lá, nunca onde — e é exactamente a pergunta que um registo
pessoal de torneios existe para responder.

Havia ainda dois problemas mais pequenos e reais:

- **`Other` não é resultado nenhum.** Um 9.º entre 16 e um 60.º entre 64 iam os dois para o mesmo
  balde, que na pirâmide das estatísticas aparecia como uma barra sem significado.
- **Não havia como corrigir.** O escalão só se escrevia na folha de concluir o torneio, que nunca
  mais volta a abrir. Um engano ficava lá para sempre.

## Decisão

O ficheiro do evento passa a guardar **`placement`** — a posição final, um inteiro a começar em 1 —
ao lado do `playersCount` que já existia. São os dois campos que a folha de concluir pede, lado a
lado: *Finished [5] out of [32]*.

**Os escalões deixam de ser guardados e passam a ser calculados**, em `domain/placement.ts`, como o
win rate e os pontos já eram (CLAUDE.md § Os dados). Continuam a ser os mesmos seis — 1st Place,
Top 2, Top 4, Top 8, Top 16, Top 32 — e continuam a dar a pirâmide das estatísticas; só não vivem
em disco.

**Um escalão só conta se o campo tiver sido maior do que ele.** Um 5.º lugar entre 6 jogadores é, à
letra, um Top 8 — mas o escalão inteiro era o torneio todo, e contá-lo enchia a pirâmide de Top 8
que não significam nada. Por isso Top 8 exige 9 jogadores ou mais, Top 16 exige 17, e assim por
diante. A excepção é ganhar, que conta sempre: um torneio ganho é um torneio ganho.

Um resultado a que não coube escalão nenhum — o 5.º entre 6, o 40.º entre 128 — **não desaparece**:
conta no degrau `Outside` da pirâmide, para as percentagens dos outros serem sobre os torneios
todos e não só sobre os bons.

**O gráfico de tendência passa a desenhar a fracção do campo que ficou atrás**, de 0 a 1, e não o
escalão. É a única forma de comparar torneios de tamanhos diferentes: um 5.º entre 32 (0.87) foi
mais difícil do que um 5.º entre 8 (0.43), e a posição sozinha diria que são iguais.

**O `rank` antigo continua a ler-se, e nada novo o escreve.** Fica no schema, marcado como legado;
`domain/placement.ts` traduz as strings que a grelha de botões produzia para os mesmos escalões, e
o serializador continua a escrevê-lo nos eventos que só têm isso — um evento antigo restaurado do
repositório é regravado à primeira alteração, e perder o resultado nessa gravação seria apagá-lo.
Um evento que só tem escalão entra no gráfico por **estimativa**, e a barra é desenhada apagada
para não se ler como uma medição.

**A posição passa a poder corrigir-se** depois do torneio fechado, em *Event details* no Event
Detail, pelos mesmos dois campos. E passa a **ver-se**: o resultado final aparece no cabeçalho do
evento, que é onde faltava.

## Alternativas consideradas

**Guardar os dois — a posição e o escalão.** Recusada por ser a definição de campo calculado num
ficheiro, que o `data-model.md` proíbe desde a Fase 0. Divergiriam à primeira correcção da posição,
e depois havia duas verdades e nenhuma forma de saber qual.

**Deduzir o escalão só da posição, sem olhar ao número de jogadores.** Mais simples de explicar e
funciona sem o segundo campo. Recusada porque devolve o problema que motivou este ADR pelo avesso:
um 5.º entre 6 aparecia na pirâmide como Top 8, e um registo que diz "Top 8" quando o torneio tinha
seis pessoas é pior do que não dizer nada.

**Manter o `rank` e acrescentar só a posição a seu lado.** Evitava mexer nas estatísticas. Recusada
porque deixava duas formas de responder à mesma pergunta e obrigava cada écran a escolher uma — e
foi o `rank` que se percebeu estar a perder informação, não a faltar-lhe companhia.

**Um gráfico de tendência pela posição em bruto.** Recusada porque a posição não se compara entre
torneios: 5.º entre 8 e 5.º entre 128 davam a mesma barra.

## Consequências

**Fica fácil:** ver onde se ficou, e não só que se chegou lá. Comparar torneios de tamanhos
diferentes. Saber qual foi o melhor resultado de sempre — `bestFinish` responde, e é o que passa a
estar no cabeçalho da secção *Positions Reached*. Corrigir um engano. E acrescentar escalões novos
um dia, se fizer sentido, sem tocar em ficheiro nenhum.

**Fica difícil:** o `playersCount` deixou de ser decorativo e passou a fazer falta. Sem ele a
posição ainda se regista e ainda se mostra, mas o escalão fica por confirmar e o evento só entra no
gráfico por estimativa. Quem carregar torneios antigos de memória vai ter de se lembrar de quantos
eram — ou aceitar a barra apagada. *(Revisto em 2026-09-15: já não se regista. Ver abaixo.)*

**Fica difícil, também:** dois números em vez de um toque num botão. Fechar um torneio passou de um
toque a escrever dois algarismos, entre rondas, numa loja. É o preço assumido, e a folha mostra ali
mesmo em que escalão a posição cai para o segundo número não parecer burocracia.

**A vigiar:** se ao fim de uns meses a maioria dos eventos ficar sem `playersCount`, a estimativa
deixa de ser a excepção e o gráfico passa a ser quase todo suposição. Se isso acontecer, ou o campo
passa a obrigatório ao concluir, ou o gráfico volta aos escalões e a fracção do campo passa a ser
uma segunda vista.

---

## Revisão — 2026-09-15: a posição e o campo andam juntos

**Estado:** Aceite. A decisão acima mantém-se inteira; muda só a opcionalidade de um campo.

Isto resolve a **Q15**, que era a "A vigiar" deste ADR. Não se esperou pelos meses de uso: a
pergunta foi decidida à cabeça, e a favor de apertar.

**A posição passa a exigir o número de jogadores.** Registam-se os dois ou nenhum. No schema é uma
dependência (`dependencies: { placement: ["playersCount"] }`, a forma de draft-07 — a `dependentRequired`
de 2019-09 passaria despercebida ao Ajv com `strict: false` e a restrição não valeria nada). Em
código é o `cleanStanding`, que deixa cair a posição órfã, e o `standingWritable`, que trava o botão
de concluir antes de lá chegar.

O que **não** muda: continua a poder fechar-se um torneio sem resultado nenhum. Um torneio antigo
carregado de memória pode não ter posição de que alguém se lembre, pela mesma razão que um match
pode não ter adversário — e forçar um número inventado era o erro que o ADR 0002 evita em todo o
lado. O `playersCount` também pode ficar sozinho: é um facto sobre o torneio, sabido sem se saber em
que lugar se ficou.

**Alternativa recusada: exigir o número de jogadores em todos os torneios concluídos**, mesmo nos
que não registam posição. Seria a leitura literal de "obrigatório ao concluir", e recusa-se porque
nenhuma estatística lê o `playersCount` sozinho: obrigava a escrever um número que não alimenta
nada, e fechava a porta ao registo retroactivo de um torneio de que só se sabe que se jogou.

**Consequência:** a estimativa deixa de existir para dados novos — só a alcançam os eventos que só
têm o `rank` antigo. A barra apagada do gráfico passa a ser exclusivamente um sinal de legado, e no
dia em que não houver eventos desses desaparece sozinha, com a legenda. O preço é o esperado: quem
não se lembrar de quantos jogadores eram fica sem registar a posição, e não com meia posição
registada.

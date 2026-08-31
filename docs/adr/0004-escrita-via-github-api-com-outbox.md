# ADR 0004 — Escritas otimistas em disco, sincronizadas para o GitHub por outbox

**Data:** 2026-08-31
**Estado:** Aceite

## Contexto

Do ADR 0002, os dados são ficheiros no repositório. Mas a app tem de conseguir escrever: criar um
evento, registar um match, concluir um torneio. E tem de o fazer a partir do telemóvel, sem servidor
no meio.

Duas dificuldades. Escrever no GitHub é uma chamada de API que demora segundos. E o sítio onde a app
é mais usada — uma loja de cartas, entre rondas — é precisamente onde a rede falha. Registar o
resultado de uma ronda não pode ficar à espera nem falhar por causa disso.

## Decisão

Modelo local-first com uma outbox, copiado do que já está provado no projecto Ratatouille:

1. Toda a alteração escreve **primeiro** em disco no telemóvel (AsyncStorage, uma chave por caminho
   de ficheiro) e a interface actualiza logo. Zero latência percebida.
2. A alteração entra numa fila de outbox persistente.
3. Um worker esvazia a fila quando há rede, usando a Contents API do GitHub — um commit por ficheiro.
4. Se falhar, fica na fila e tenta outra vez com recuo exponencial, com tecto de cinco minutos. Se
   falhar por conflito de `sha`, relê o ficheiro e volta a escrever.
5. O écran de Settings mostra o estado da sincronização. Nada de commits a falhar em silêncio.

**A unidade da fila é o ficheiro, não a alteração.** Uma entrada diz "este ficheiro passa a ter este
conteúdo", e a chave é o caminho. Registar cinco rondas de um torneio sem rede deixa **uma** entrada e
portanto **um** commit, com o evento completo — não cinco. É o que torna aceitável commitar a cada
toque.

**Conflitos resolvem-se por última-escrita-ganha.** É o correto para um utilizador só (ADR 0006). Com
duas pessoas a escrever, teria de mudar; não há duas pessoas.

**Leitura.** No dia a dia a app nunca lê do GitHub: a cópia local é a verdade no telemóvel. Ler serve
para primeira instalação, restauro e telemóvel novo, e faz-se a partir do `bundle.json` publicado em
GitHub Pages — um pedido, sem token e sem limite de rate.

**Autenticação:** um fine-grained personal access token, limitado a este repositório e a
`Contents: read and write`, introduzido uma vez no écran de Settings e guardado no
`expo-secure-store`. Nunca chega ao repositório.

## Alternativas consideradas

**GitHub App com OAuth.** Correcto do ponto de vista de segurança e exige um servidor para guardar o
client secret — o servidor que esta arquitectura inteira existe para não ter.

**Uma função serverless como proxy de escrita.** Esconderia o token e reintroduz uma dependência
externa que pode adormecer ou passar a custar. Mesmo argumento do ADR 0002.

**Escrita síncrona, com a interface à espera do commit.** Muito mais simples de implementar e
inaceitável de usar: registar um match ficaria dois segundos a pensar, e falharia sem rede — que é
metade das vezes em que vai ser usado.

**Guardar só local e sincronizar quando o utilizador carregar num botão.** Simples, e transforma a
cópia de segurança numa coisa que só acontece quando alguém se lembra. A outbox faz acontecer sozinha.

## Consequências

**Fica fácil:** a interface é sempre instantânea e funciona offline por construção. Um torneio inteiro
regista-se em modo de avião e sai quando houver rede. Cada alteração fica como um commit, portanto o
"quando é que isto mudou" vem de graça.

**Fica difícil:** a outbox é código com estado, e é onde vão aparecer os bugs difíceis. Por isso a
lógica pura vive em `domain/outbox.ts`, sem I/O, com testes a sério para retries, conflitos e arranque
com fila pendente. Os serializadores vivem em `services/repoFiles.ts` e são testados byte a byte
contra os ficheiros reais de `data/` — um ficheiro mal formado só daria erro depois do commit, no
`npm run validate` do CI, e até lá a app continuaria a mandar mais.

**Risco de segurança aceite:** quem tiver o telemóvel desbloqueado na mão consegue, com esforço,
extrair o token. É um telemóvel pessoal, o repositório é pessoal, e o token está limitado a um
repositório e a uma permissão. Mitigações: definir validade no token e revogá-lo se o telemóvel se
perder.

**A vigiar:** o número de commits. A coalescência por ficheiro resolve o caso normal; se mesmo assim
incomodar, agrupar as escritas numa janela de tempo antes de enviar.

## Quando é que tenta enviar

Ao arrancar (se ficou fila), sempre que algo entra na fila, quando o `AppState` volta a `active`,
quando o `NetInfo` diz que há rede outra vez, e de 30 em 30 segundos como rede de segurança. O
`AppState` é o que mais interessa num telemóvel: a app passa a maior parte do tempo em segundo plano,
e voltar a ela é o momento em que quase sempre há rede outra vez.

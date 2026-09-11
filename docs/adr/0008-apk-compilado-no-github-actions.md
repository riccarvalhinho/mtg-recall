# ADR 0008 — O APK é compilado no GitHub Actions e publicado numa Release

**Data:** 2026-09-11
**Estado:** Aceite

## Contexto

O ADR 0003 escolheu uma app nativa em Expo e a distribuição ficou assente em EAS Build para gerar o
APK e EAS Update para entregar alterações de JavaScript sem APK novo. Nunca chegou a ser usada: o
primeiro build ainda não foi feito.

Ao preparar esse primeiro build apareceram duas restrições que não estavam no plano.

A primeira é que o autor nem sempre tem computador à mão, e o `eas-cli` pressupõe um. Isso
resolveu-se pondo o EAS a correr no GitHub Actions, disparado do browser do telemóvel.

A segunda é mais de fundo. O EAS obriga a uma conta na Expo, a um token de acesso próprio e a um
plano gratuito com limites de build e fila de espera. Para uma app de um utilizador só, é uma
dependência externa a mais — exactamente o género de coisa que o ADR 0006 saiu a eliminar quando
tirou o Supabase do caminho.

Entretanto percebeu-se uma coisa que muda a conta toda: **neste projecto, reinstalar a app é barato**.
Os dados vivem no repositório (ADR 0002), não no telemóvel. Um APK instalado por cima de outro
mantém os dados locais desde que a assinatura seja a mesma; e mesmo que se perdessem, o botão
_Restore from GitHub_ trá-los de volta. O valor do EAS Update — evitar reinstalar — é muito menor
aqui do que numa app normal.

## Decisão

O APK é compilado pelo GitHub Actions, com `expo prebuild` e Gradle, e publicado como ficheiro de
uma **Release** do repositório. Não há EAS Build, não há EAS Update, não há conta na Expo.

A Release, e não um artefacto da execução, porque o destino é um telemóvel: um artefacto é um ZIP
que obriga a ter sessão iniciada e a descompactar à mão; uma Release dá um link directo para o
`.apk`, que se toca e instala.

Três consequências que o workflow tem de garantir, e garante:

- **A assinatura é sempre a mesma chave.** Vive num segredo do repositório
  (`ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`) e nunca no repositório, que é público
  (ADR 0005). Assinar com uma chave diferente faria o Android recusar a instalação por cima e
  obrigaria a desinstalar — perdendo os dados locais de cada vez.
- **O `versionCode` sobe sempre**, vindo do número da execução. O Android recusa instalar por cima
  um APK com um número menor.
- **A pasta `android/` não é commitada.** É gerada a cada build, para o `app.json` continuar a ser a
  única fonte de configuração e não haver dois sítios a dizer o mesmo.

## Alternativas consideradas

**Manter o EAS Build, a correr no GitHub Actions.** Foi o primeiro caminho e chegou a ficar escrito.
Resolve a falta de computador mas mantém a conta na Expo, o token, a quota e a fila. Recusada por
isso — e porque obrigava a resolver primeiro a falta do `projectId` no `app.json`, que o `eas init`
nunca escreveu.

**Manter o EAS só pelo EAS Update.** É a única coisa que se perde mesmo. Recusada porque o que o
Update evita — reinstalar — custa aqui dois minutos e não perde dados. Num produto com utilizadores
a sério a conta seria outra.

**Publicar o APK como artefacto da execução em vez de Release.** Mais simples de escrever e sem
poluir a lista de Releases. Recusada pela experiência no telemóvel, que é o único sítio onde este
APK vai ser instalado.

**Commitar a pasta `android/`.** Tornaria os builds mais rápidos e reprodutíveis. Recusada porque
passaria a haver duas fontes de configuração — o `app.json` e os ficheiros gerados — e a segunda
só se descobre desactualizada quando alguma coisa deixa de funcionar.

## Consequências

**Fica fácil:** gerar um APK deixa de depender de contas, quotas ou filas de terceiros. Abre-se o
separador Actions no telemóvel, corre-se o workflow, e o APK aparece numa Release com link directo.
O GitHub já é a source of truth do projecto (ADR 0001); passa a ser também de onde a app vem.

**Fica difícil:** cada alteração de JavaScript passa a exigir um APK novo e uma instalação à mão.
Antes chegaria um update silencioso. Para iterar várias vezes ao dia isto é pior, e se um dia
incomodar a saída é reabrir o EAS — os workflows do EAS ficaram no repositório em vez de serem
apagados, precisamente por isso.

**A chave é insubstituível.** Perder a keystore significa não conseguir voltar a assinar com a mesma
identidade: a partir daí, qualquer APK novo obriga a desinstalar a app antes de instalar, e os dados
locais vão com ela. Os dados em si sobrevivem no repositório, mas o token tem de ser colado outra
vez. A keystore vale a pena ser guardada fora do GitHub também.

**A vigiar:** se compilar passar a demorar tanto que se evite gerar um APK por preguiça, e as
correcções fiquem por instalar, a decisão está a custar mais do que parecia.

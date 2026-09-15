# Pôr a app a funcionar no telemóvel

Guia de uma vez só. No fim ficas com o APK instalado, o token colado e o primeiro torneio a
sincronizar sozinho. Ver `docs/adr/0003-app-nativa-expo-em-vez-de-pwa.md` para o porquê de ser um
APK e não uma página web.

---

## 1. Ligar o GitHub Pages (uma vez)

O Pages serve o `bundle.json` que a app lê quando é instalada de novo. Sem isto, tudo o resto
funciona — só o botão **Restore from GitHub** é que não.

No repositório: **Settings → Pages → Source: GitHub Actions**. Depois, o primeiro push para `main`
publica sozinho.

Confirmar em `https://riccarvalhinho.github.io/mtg-recall/data/bundle.json`.

---

## 2. Criar o token (uma vez, e a repetir quando expirar)

O token é o que deixa a app escrever no repositório. É pessoal, dá para escrever aqui e mais nada.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**
2. **Repository access:** _Only select repositories_ → `riccarvalhinho/mtg-recall`
3. **Permissions → Repository permissions → Contents: Read and write**
   (só esta; nenhuma outra é precisa)
4. **Expiration:** **No expiration.** O GitHub desaconselha, e com razão no caso geral — mas aqui o
   que o token dá é escrita num repositório que já é público (ADR 0005), e mais nada: não lê nada
   privado, não apaga o repositório, não toca na conta. Contra isso, uma validade curta traz uma
   tarefa de manutenção a cada 90 dias para uma app de uso pessoal que é suposto estar só a
   funcionar. **A defesa é a revogação, não o calendário:** se o telemóvel se perder, revoga-se o
   token aqui e fica feito. Quem preferir um meio-termo, um ano é uma escolha defensável.
5. Copiar o token. **Só aparece uma vez.**

> **Expirar não perde dados.** Quando um token expira, a outbox não se esvazia — fica à espera. O
> écran de Settings mostra quantos ficheiros estão em fila e porquê, cola-se um token novo e a fila
> vai sozinha. É por isso que a validade é uma questão de conveniência e não de segurança dos dados.

Não commitar o token em lado nenhum — o repositório é público (ADR 0005). Se acontecer por engano,
revogar (não basta apagar o ficheiro: fica no histórico).

---

## 3. Gerar o APK — sem computador

O APK é compilado pelo próprio GitHub e publicado numa Release. Não é preciso computador nem conta
na Expo. O porquê está no `docs/adr/0008-apk-compilado-no-github-actions.md`.

### 3.1. Uma vez: guardar a chave de assinatura

O Android só deixa instalar um APK por cima de outro se os dois estiverem assinados com a **mesma
chave**. É isso que faz uma actualização manter os dados em vez de obrigar a desinstalar. A chave
vive em segredos do repositório e nunca no código — o repositório é público (ADR 0005).

No GitHub, **Settings → Secrets and variables → Actions → New repository secret**, dois segredos:

| Nome | Conteúdo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a keystore em base64 |
| `ANDROID_KEYSTORE_PASSWORD` | a palavra-passe da keystore |

> **Guardar a keystore fora do GitHub também.** Se se perder, deixa de ser possível assinar com a
> mesma identidade: a partir daí, cada APK novo obriga a desinstalar a app antes de instalar, e os
> dados locais vão com ela. Os eventos e decks sobrevivem no repositório e voltam com o _Restore
> from GitHub_, mas o token tem de ser colado outra vez.

### 3.2. Sempre que quiseres um APK novo

1. GitHub → separador **Actions** → **Gerar APK (Gradle)** → **Run workflow**
2. Esperar (~15 min). O workflow valida o código, compila e assina.
3. Ir a **Releases** no repositório e abrir a mais recente.
4. Tocar no ficheiro `.apk`. O Android avisa que a origem é desconhecida — é uma app própria,
   autorizar.

Instalar por cima **mantém tudo**: eventos, decks, colecção e o token. Não é preciso desinstalar.

> Antes de actualizar, vale a pena abrir **Settings** e confirmar que a sincronização está a zero.
> O que estiver na fila por enviar é a única coisa que não está no GitHub — e portanto a única que
> um problema na instalação faria perder.

### 3.3. Quando é preciso um APK novo

Sempre que alguma coisa mudar. Ao contrário do EAS Update, não há entrega de JavaScript pelo ar: uma
correcção num écran só chega ao telemóvel com um APK novo.

É o preço assumido no ADR 0008, e é suportável porque instalar por cima não perde nada. Se um dia
incomodar, os workflows do EAS ficaram no repositório (`build-apk.yml` e `publish-update.yml`) e
bastam um `EXPO_TOKEN` para voltarem a servir.

---

## 4. Colar o token na app

Abrir a app → separador **Settings** → **GitHub token** → colar → **Verify and save**.

A app confirma o token contra o GitHub antes de o guardar, portanto ou diz que ficou guardado ou diz
exactamente o que está errado. Fica no armazenamento seguro do Android e nunca sai dali a não ser
para `api.github.com`.

---

## 5. Confirmar que funciona

1. Criar um evento na app.
2. Ver em **Settings → Sync** — deve dizer que está tudo guardado passados poucos segundos.
3. Ver o repositório no GitHub: aparece um commit novo com `data/events/<data>-<nome>.json`.

Se ficar em "waiting", o texto no écran diz porquê: sem token, sem rede, ou o erro que o GitHub
devolveu.

---

## Depois: actualizações

**Alterações só de JavaScript** — écrans, lógica, estilos — chegam sem APK novo:

```bash
eas update --branch preview --message "o que mudou"
```

O telemóvel apanha a actualização no arranque seguinte.

**APK novo só é preciso** quando muda uma dependência nativa (uma biblioteca com código Android),
o `app.json`, ou a versão do Expo SDK.

---

## Quando alguma coisa corre mal

| Sintoma | O que é | O que fazer |
|---|---|---|
| _"The token is not valid, or it has expired."_ | O token foi revogado ou chegou ao fim da validade | Gerar outro (passo 2) e colar de novo |
| _"The token cannot write to this repository."_ | Faltou o `Contents: read and write`, ou o repositório não está seleccionado | Rever as permissões do token |
| Fica sempre em "waiting" com rede | O ficheiro pode estar a ser recusado pelo GitHub | Ver a mensagem no écran de Settings; o erro vem de lá |
| Telemóvel novo, app vazia | Falta trazer os dados | **Settings → Restore from GitHub** |
| O CI falhou depois de um commit da app | Um ficheiro escrito pela app não passou no `npm run validate` | Ver o erro na Action; é um bug do serializador, não dos dados |

Esse último caso é o que se quer evitar de todo, e é por isso que `services/repoFiles.test.ts` valida
o que a app escreve contra o mesmo schema que o CI usa.

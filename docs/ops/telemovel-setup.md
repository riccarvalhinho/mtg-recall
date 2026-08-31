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
4. **Expiration:** 90 dias é um bom compromisso. Quando expirar, a app diz "O token não é válido ou
   expirou" no écran de Settings e basta gerar outro.
5. Copiar o token. **Só aparece uma vez.**

Não commitar o token em lado nenhum — o repositório é público (ADR 0005). Se acontecer por engano,
revogar (não basta apagar o ficheiro: fica no histórico).

---

## 3. Gerar o APK

Uma vez, no computador:

```bash
npm install -g eas-cli
eas login                    # conta Expo, gratuita
eas init                     # cria o projecto e escreve o id no app.json
eas update:configure         # liga o EAS Update, para as próximas actualizações não precisarem de APK novo
```

E depois, sempre que for preciso um APK novo:

```bash
eas build --profile preview --platform android
```

O build corre na nuvem e demora ~15 minutos. No fim aparece um link e um QR code: abrir no telemóvel,
descarregar o `.apk` e instalar. O Android vai avisar que a origem é desconhecida — é sideload de uma
app própria, autorizar.

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
| "O token não é válido ou expirou" | O token chegou ao fim da validade | Gerar outro (passo 2) e colar de novo |
| "O token não tem permissão de escrita" | Faltou o `Contents: read and write`, ou o repositório não está seleccionado | Rever as permissões do token |
| Fica sempre em "waiting" com rede | O ficheiro pode estar a ser recusado pelo GitHub | Ver a mensagem no écran de Settings; o erro vem de lá |
| Telemóvel novo, app vazia | Falta trazer os dados | **Settings → Restore from GitHub** |
| O CI falhou depois de um commit da app | Um ficheiro escrito pela app não passou no `npm run validate` | Ver o erro na Action; é um bug do serializador, não dos dados |

Esse último caso é o que se quer evitar de todo, e é por isso que `services/repoFiles.test.ts` valida
o que a app escreve contra o mesmo schema que o CI usa.

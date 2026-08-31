# ADR 0003 — A app continua nativa em Expo, distribuída por APK no Android

**Data:** 2026-08-31
**Estado:** Aceite

## Contexto

Ao adoptar o modelo de dados do Ratatouille (ADR 0002), a pergunta seguinte foi se também se devia
adoptar a sua forma: uma progressive web app publicada em GitHub Pages. No Ratatouille essa decisão
resolveu um problema real — instalar seja o que for num tablet Amazon Fire é desagradável, e o deploy
passou a ser um push.

O MTG Recall não está na mesma situação:

- O alvo é um **telemóvel Android** pessoal, onde instalar um APK por sideload é gratuito e directo.
- Existem já **seis écrans construídos e polidos** em React Native, com um design system próprio
  ("Scholar's Archive"), tipografia carregada por `expo-font` e símbolos de mana em SVG.
- O uso é numa loja de cartas, entre rondas, muitas vezes sem rede.

Converter para web significava passar tudo por `react-native-web` e voltar a testar `SvgUri`,
modais, safe-area e fontes — risco a troco de uma conveniência que o Android já dá de borla.

## Decisão

A app continua a ser Expo + React Native + Expo Router, e chega ao telemóvel como APK gerado pelo
**EAS Build**. As alterações de JavaScript chegam por **EAS Update**, sem reinstalar nada.

O token de escrita fica no `expo-secure-store`, que usa o keystore do Android — melhor do que o
`localStorage` que a rota web obrigaria a aceitar.

## Alternativas consideradas

**Exportar o mesmo código para web (`expo export --platform web`) e publicar em Pages.** Aproveitaria
os écrans já feitos e daria instalação por "adicionar ao ecrã inicial", sem loja. Rejeitada por agora
pelo risco de regressão visual descrito acima, e porque não resolve nenhum problema que exista. Fica
como opção barata de reverter: o modelo de dados do ADR 0002 e a camada de escrita do ADR 0004 não
dependem de ser nativo — só `expo-secure-store` teria de passar a `localStorage`.

**Reescrever a app de raiz como PWA em Vite, à imagem do Ratatouille.** Um código mais simples e sem
a camada de compatibilidade do React Native. Rejeitada por deitar fora seis écrans que já funcionam,
para chegar exactamente ao mesmo sítio.

**Correr em Expo Go.** É como o desenvolvimento acontece hoje e não serve para uso a sério: exige o
Metro a correr num computador, portanto a app morre à porta da loja.

## Consequências

**Fica fácil:** offline por construção, sem service worker para acertar. Sem barra de browser. Fica
aberta a porta a coisas que só o nativo dá e que estão no roadmap: câmara para ler cartas,
notificações para o tempo de ronda.

**Fica difícil:** uma alteração que toque em dependências nativas obriga a um build novo no EAS (~15
minutos) e a reinstalar o APK. Só as alterações de JavaScript é que viajam pelo EAS Update.

**A vigiar:** o dia em que apetecer ver as estatísticas num ecrã grande. A resposta nessa altura não é
migrar a app — é publicar em Pages uma vista de leitura sobre o mesmo `bundle.json`, que o ADR 0004
já obriga a existir.

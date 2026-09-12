# O ícone da app

O desenho, porque é assim, e como se mexe nele sem partir nada.

## O que é

Duas cartas, uma atrás da outra, douradas sobre o fundo escuro da app. Saiu de três direcções
exploradas no canvas do Claude Design a partir de `design/icon-brief.md`; ganhou a que se chamava
**ex-libris**, já sem o anel que tinha à volta — era o anel que se perdia primeiro em pequeno.

Nada aqui é marca da Wizards of the Coast: não há símbolos de mana nem verso de carta. Um
rectângulo de cantos redondos não é marca de ninguém.

## Os ficheiros

Os **SVG desta pasta são o original**. Os PNG em `assets/` são derivados e refazem-se com o script.
Mexer num PNG à mão é trabalho que se perde no próximo export.

| Original | Derivado | O que é |
|---|---|---|
| `icon.svg` | `assets/icon.png` (1024) e `assets/favicon.png` (48) | O quadrado completo, com fundo |
| `adaptive-foreground.svg` | `assets/adaptive-icon.png` (1024) | O primeiro plano do Android, sem fundo |
| `adaptive-foreground.svg` | `assets/splash-icon.png` (1024) | A marca do arranque |
| `monochrome.svg` | `assets/monochrome-icon.png` (1024) | O ícone temático do Android 13+ |

```bash
pip install cairosvg
python3 design/icon/export.py
```

Não corre no CI nem faz parte do build: o ícone muda de longe a longe, e um PNG commitado é mais
simples de servir do que uma dependência de rasterização dentro do workflow do APK.

## As três decisões que não são óbvias

**O quadrado é maior do que o adaptativo, e é de propósito.** O `icon.svg` ocupa 78% do lado porque
não é recortado por máscara nenhuma. O `adaptive-foreground.svg` tem de caber na **zona segura** —
o círculo central de 660 px dos 1024 — porque o Android recorta o primeiro plano com uma máscara
que muda de telemóvel para telemóvel. O desenho é o mesmo; muda a escala.

O `export.py` mede isto sempre que corre e **recusa exportar** se o desenho passar do limite. Hoje o
canto mais distante está a 162 px de um máximo de 165: está encostado, com quatro pixels de folga.
Quem alargar as cartas vai dar de caras com o erro, que é exactamente o que se quer — o corte não se
vê no ficheiro, vê-se no telemóvel de quem instalou.

**O monocromático não é o desenho pintado de branco.** Ali só existe forma e vazio, e daí duas
diferenças: a barra do título é um buraco feito por `fill-rule="evenodd"`, e a carta de trás está
reduzida a uma nesga que acaba antes da da frente — a cores as duas distinguem-se pelo tom, a branco
seriam uma mancha só. A folga faz o trabalho que o tom fazia.

**Sem `<mask>` nem `<clipPath>`.** O cairosvg ignora-as *em silêncio*: o PNG sai branco cheio e não
há erro nenhum. Foi assim a primeira tentativa. Os recortes fazem-se por geometria, que qualquer
rasterizador respeita. Se um dia se trocar de ferramenta, isto continua a funcionar.

## Se um dia se quiser melhorar

- **A barra escura dentro da carta da frente** é o que a faz ler como carta e não como rectângulo
  dourado. A 32 px quase desaparece. Tirá-la deixa a silhueta mais limpa; é uma linha no SVG.
- **Uma terceira carta** cabe em composição, mas não na zona segura — obrigaria a encolher as três,
  e o que se ganha em ideia perde-se em legibilidade.
- **O `backgroundColor` do adaptive icon** (`app.json`) é uma cor chapada. Podia ser um
  `backgroundImage` com textura de papel, à Scholar's Archive. Tem de ter as mesmas dimensões do
  primeiro plano.
- As direcções descartadas — lombadas de livros e marca de página — estão na segunda página do
  canvas e nos artboards em `design/icon-canvas/`, caso valha a pena voltar atrás.

## Depois de mexer

O ícone é nativo: **não entra por actualização de JavaScript**. Depois de trocar os PNG é preciso
gerar um APK novo (Actions → *Gerar APK (Gradle)*) e instalá-lo por cima — os dados mantêm-se.

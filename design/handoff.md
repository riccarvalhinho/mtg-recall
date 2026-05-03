# MTG Recall — React Native Implementation Handoff

> Gerado a partir dos protótipos HTML finais. Plataforma: iPhone 14 Pro (390×844px). Stack: React Native + Expo.

---

## 1. Design System

### 1.1 Tipografia

| Uso | Família | Variante |
|---|---|---|
| Títulos / display | `Playfair_Display` | 400, 500, 600, 700; italic onde indicado |
| Body / labels | `EB_Garamond` | 400, 500; italic frequente |

Instalar via `@expo-google-fonts/playfair-display` e `@expo-google-fonts/eb-garamond`.

```ts
// theme/typography.ts
export const fonts = {
  display:     'PlayfairDisplay_700Bold',
  displayMed:  'PlayfairDisplay_600SemiBold',
  displayReg:  'PlayfairDisplay_400Regular',
  displayItal: 'PlayfairDisplay_400Italic',
  body:        'EBGaramond_400Regular',
  bodyItal:    'EBGaramond_400Italic',
  bodyMed:     'EBGaramond_500Medium',
};
```

### 1.2 Paleta de cores

```ts
// theme/colors.ts
export const colors = {
  bg:        '#130F0A',  // fundo principal
  bgCard:    '#1E1812',  // cards, inputs, painéis
  bgCardHov: '#252019',  // pressed state de cards
  border:    '#3A3020',  // bordas gerais
  gold:      '#C9A96E',  // accent principal — CTAs, estados activos
  goldDim:   '#8B7248',  // gold secundário — labels, ornamentos
  textPrim:  '#E8DCC8',  // texto principal
  textSec:   '#A8967A',  // texto secundário
  textDim:   '#6B5C3E',  // labels, placeholders, dim
  win:       '#5A8B5C',  // resultado vitória
  winBg:     '#1A3020',
  winBorder: '#2E5A38',
  loss:      '#8B4A4A',  // resultado derrota
  lossBg:    '#301A1A',
  lossBorder:'#5A2E2E',
  draw:      '#7A7060',  // empate
  drawBg:    '#252018',
  drawBorder:'#4A4030',
  tabBar:    '#16120D',  // fundo da tab bar
};
```

### 1.3 Símbolos de mana MTG

```ts
// theme/mana.ts
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export const manaColors: Record<ManaColor, {
  bg: string; border: string; text: string;
  bgSel: string; borderSel: string;
}> = {
  W: { bg:'#F2EDD0', bgSel:'#F2EDD0', border:'#C8B870', borderSel:'#E0C840', text:'#4A3A10' },
  U: { bg:'#0E2A48', bgSel:'#1A4A7A', border:'#1E3A60', borderSel:'#2E6AAA', text:'#C8DCF0' },
  B: { bg:'#1A1020', bgSel:'#2A1E2E', border:'#3A2A48', borderSel:'#6A4A7A', text:'#C0A8D0' },
  R: { bg:'#3A100E', bgSel:'#7A1E1A', border:'#5A2018', borderSel:'#C03020', text:'#F0C0A8' },
  G: { bg:'#0E2A18', bgSel:'#1A4A2A', border:'#1A3A22', borderSel:'#2E7A3E', text:'#A8D0B0' },
};
```

#### Componente `ManaPip`

```tsx
// components/ManaPip.tsx
import { View, Text, StyleSheet } from 'react-native';
import { manaColors, ManaColor } from '../theme/mana';

interface ManaPipProps {
  color: ManaColor;
  size?: number;
  isSplash?: boolean; // 70% size, 70% opacity, sem letra
}

export function ManaPip({ color, size = 16, isSplash = false }: ManaPipProps) {
  const m = manaColors[color];
  const pipSize = isSplash ? Math.round(size * 0.70) : size;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: pipSize, height: pipSize, borderRadius: pipSize / 2,
        backgroundColor: m.bgSel,
        borderWidth: 1.5,
        borderColor: isSplash ? m.border : m.borderSel,
        opacity: isSplash ? 0.70 : 1,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {!isSplash && (
          <Text style={{
            fontFamily: 'EBGaramond_700Bold',
            fontSize: pipSize * 0.52,
            color: m.text,
            lineHeight: pipSize * 0.65,
          }}>{color}</Text>
        )}
      </View>
    </View>
  );
}
```

---

## 2. Componentes partilhados

### 2.1 Tab Bar

4 tabs: **Home**, **Events** (activa por écran), **Stats**, **Profile**.

```tsx
// components/TabBar.tsx
// Props: activeTab: 'home' | 'events' | 'stats' | 'profile'
// Layout: Row, altura 49 + safeAreaInsets.bottom
// Fundo: colors.tabBar (#16120D)
// Border top: 1px solid colors.border
// Cada tab: flex:1, coluna centrada, ícone SVG 22×22 + label 10px EB Garamond
// Cor activa: colors.gold; inactiva: colors.textDim
// Ícones: SVG custom (ver protótipos — Home, Calendar grid, Barras, Pessoa)
```

**Dimensões:**
- Altura: `49 + insets.bottom`
- Ícone: 22×22
- Label: 10px, letterSpacing 0.03em
- Gap ícone→label: 3px

### 2.2 TypeBadge

Badge de formato de torneio (Sealed / Draft).

```tsx
// Sealed: bg #3A3020, border #5A4A28, text #A8967A
// Draft:  bg #1E2830, border #2A4050, text #8A9CA8
// Font: EB Garamond italic, 10px, lowercase, padding 1px 6px, borderRadius 4
```

### 2.3 RecordBadge

Score W–L com win rate por baixo.

```tsx
// wins: Playfair 700, 20px, cor colors.win
// separador "—": textDim, 14px
// losses: colors.loss
// WR%: EB Garamond uppercase, 10px, textSec, letterSpacing 0.08em
```

### 2.4 CardThumbnailPlaceholder

Placeholder 36×50px (Events List) ou 40×56px (Home). Fase 2+ terá imagem real via Scryfall.

```tsx
// borderRadius: 4–5
// bg: linear gradient #2E2618 → #1A1410
// border: colors.border
// Conteúdo: círculo dim 16×16 + inner frame border
```

---

## 3. Écran: Home / Dashboard

**Ficheiro de referência:** `Home.html`

### 3.1 Layout (com dados)

```
SafeAreaView (bg: #130F0A)
├── StatusBar (dark content)
├── Header (horizontal, alignItems: flex-end)
│   ├── Left: label "Scholar's Archive" (goldDim, italic 11px) + H1 "Home" (Playfair 700, 30px, textPrim)
│   └── Right: Button "Novo Evento" (gold gradient pill)
├── ScrollView
│   ├── StatsBlock (ver 3.2)
│   ├── [Se evento activo] SecçãoEventoActivo (ver 3.3)
│   ├── OrnamentDivider
│   └── SecçãoEventosRecentes (ver 3.4)
└── TabBar (Home activo)
```

### 3.2 StatsBlock — variante Trivia (padrão)

```
Card (bgCard, border, borderRadius 12, padding 14×16)
├── Label "Stats" (goldDim, italic, 10px uppercase)
├── Row (Win Rate Recente | Win Rate Histórico)
│   ├── Left: label "Recente" (textDim 9px) + valor XX% (Playfair 700, 24px, cor win/loss) + delta ↑/↓
│   └── Right: label "Histórico" (textDim 9px) + valor XX% (Playfair 700, 24px, textPrim) + nº torneios
├── Barra de tendência (altura 3px, bg border, fill win/loss a recentWR%)
└── Grid 2×2 (gap 6)
    ├── Cor favorita: pip mana G + "Verde"
    ├── Nemesis: pip mana U + "Azul"
    ├── Melhor formato: "Sealed" (Playfair 700, 18px)
    └── Matches jogados: número (Playfair 700, 18px)
```

Cada célula do grid: `bg: colors.bg, borderRadius 8, padding 8×10`.

### 3.3 Secção Evento Activo

```
Label "Evento Activo" (gold, italic uppercase 11px) com accent bar (3×14 gold gradient)
EventCard (o evento com active: true)
Button "Adicionar Match"
  ├── Ícone círculo gold (32×32, gold+18 bg, border gold+55)
  ├── Texto "Adicionar Match" (Playfair 600, 14px, textPrim)
  └── Subtítulo "Ronda N · [Nome Evento]" (EB Garamond italic 11px, textSec)
```

### 3.4 Secção Eventos Recentes

```
Header row: label "Eventos Recentes" (textDim, italic uppercase) + "Ver todos →" (textDim 12px)
Lista de EventCards (eventos sem active:true)
```

### 3.5 Empty State (primeiro uso)

```
SafeAreaView
├── Header (igual ao normal mas sem CTA)
└── Centrado verticalmente:
    ├── SVG ornamento arcano (120×120)
    │   Pentágono com 5 mana pips nas pontas (W/U/B/R/G)
    │   Linhas de ligação entre pontas
    │   Estrela central translúcida gold
    │   Anéis concêntricos dashed/solid
    ├── H2 "Bem-vindo ao Scholar's Archive" (Playfair 700, 22px)
    ├── Parágrafo explicativo (EB Garamond 15px, textSec)
    ├── [Opcional] Card com flavour text (italic, textSec)
    └── Button "Registar primeiro evento" (gold gradient, borderRadius 24, padding 14×28)
```

---

## 4. Écran: Events List

**Ficheiro de referência:** `Events List v2.html`

### 4.1 Layout

```
SafeAreaView (bg: #130F0A)
├── StatusBar
├── Header (horizontal, alignItems: flex-end)
│   ├── Left: label "Arquivo Pessoal" (goldDim italic 11px) + H1 "Eventos" (Playfair 700, 30px)
│   └── Right: Button "Novo Evento" (gold gradient pill)
├── StatsStrip (3 células horizontais: Torneios / Win Rate / Vitórias)
├── FlatList (scrollável)
│   ├── Secção "Em Curso" (label gold italic uppercase 11px)
│   │   └── EventCards (active:true)
│   ├── OrnamentDivider (estrela gold entre secções)
│   └── Secção "Histórico" (horizontal: label textDim + Button "Filtrar")
│       └── EventCards (active:false)
└── TabBar (Events activo)
```

### 4.2 StatsStrip

```
Row (bg bgCard, border, borderRadius 8, marginTop 12, marginBottom 4)
├── Célula "Torneios": valor (Playfair 700, 20px, textPrim) + label (EB Garamond 10px uppercase textSec)
├── Divisor vertical (border color)
├── Célula "Win Rate": idem
├── Divisor vertical
└── Célula "Vitórias": idem
Cada célula: flex:1, padding 7×0, textAlign center
```

### 4.3 EventCard

```
Pressable (activeOpacity 0.9, scale 0.985 on press)
bg: bgCard → bgCardHov on press
border: active ? gold+55 : border
borderRadius: 12
padding: 14×16

Conteúdo (Row, gap 12):
├── [Se active] Accent bar esquerda (3px wide, 70% height, gold gradient, borderRadius right)
├── [Se showThumbnails] CardThumbnailPlaceholder (36×50)
├── Coluna flex:1
│   ├── Row gap 6: [Se active] Badge "Em curso" (gold pill) + TypeBadge
│   ├── Título evento (Playfair 500, 15px, textPrim, numberOfLines:1)
│   └── Row gap 5 (mana pips + separador "·" + ícone calendário + data)
│       Mana pips: ManaPip size=14 (splash se em event.splash[])
├── RecordBadge
└── Chevron (7×13, opacity 0.3)
```

**Animação de entrada:** `FadeInUp` com delay escalonado por index (60ms × index).

**Mana pips inline:**
- Pips principais: `ManaPip size=14 isSplash=false`
- Pips splash: `ManaPip size=14 isSplash=true` (70% tamanho, 70% opacidade, sem letra)
- Separador "·" entre pips e data

---

## 5. Écran: Event Detail

**Ficheiro de referência:** `Event Detail.html`  
**Navegação:** push a partir de EventCard; back chevron no topo.

### 5.1 Layout

```
SafeAreaView (bg: #130F0A)
├── StatusBar
├── NavBar (horizontal)
│   ├── Back button (círculo bgCard 34×34, chevron esquerda)
│   └── Breadcrumb "Eventos" (EB Garamond italic, textDim)
├── EventHeader (padding 10×16)
│   ├── Row de badges: Badge "sealed" + Badge "Aetherdrift" (variante set)
│   ├── H1 nome evento (Playfair 700, 22px, lineHeight 1.2)
│   └── Row: [ícone calendário + data] gap 16 [ícone pin + local]
├── StatsBar (ver 5.2)
├── DeckSection (colapsável, ver 5.3)
└── ScrollView
    ├── SectionHeader "Matches" + count
    ├── Lista de MatchCards (ver 5.4)
    └── Button "Adicionar Match" (dashed border)
    └── TabBar (Events activo)
```

### 5.2 StatsBar

```
Row (bgCard, border, borderRadius 12, overflow hidden, margin 12×16)

Bloco Rank (flex:2 = 50% largura):
  bg: gold gradient sutil (gold+1A → gold+06)
  borderRight: border
  Conteúdo centrado:
    "1st Place" (Playfair 700, 18px, gold)
    "4 – 0 – 1" (Playfair 600, 16px, textSec)
    "W – L – D" (EB Garamond 9px uppercase, textDim)

Bloco Pts (flex:1 = 25%):
  "13" (Playfair 700, 22px, textPrim)
  "Pts" (EB Garamond 10px uppercase, textSec)

Divisor vertical (1px, border, margin 10×0)

Bloco Win Rate (flex:1 = 25%):
  "67%" (Playfair 700, 22px, textPrim)
  "Win Rate" (EB Garamond 10px uppercase, textSec)
```

### 5.3 DeckSection (colapsável)

```
Card (bgCard, border, borderRadius 12, margin 12×16)

Header row (sempre visível, Pressable):
├── CardThumbnailPlaceholder (38×52)
├── Coluna flex:1:
│   ├── Label "Deck" (EB Garamond italic 10px uppercase, textDim)
│   ├── Nome "Selesnya Midrange" (Playfair 600, 15px, textPrim)
│   └── ManaPips row: G (principal) + W (principal) + U (splash)
└── Chevron (rotação 0°→90° ao expandir, transition 250ms)

Expanded content (animado):
  borderTop: border
  padding 12×14
  Texto placeholder "Deck disponível na Fase 2 →"
```

### 5.4 MatchCard

```
Pressable (scale 0.985 on press)
Row (bgCard, border, borderRadius 10, padding 13×14, gap 12)

Result pill (34×34, borderRadius 8):
  W: bg #1A3020, border #2E5A38, text #5A8B5C
  L: bg #301A1A, border #5A2E2E, text #8B4A4A
  D: bg #252018, border #4A4030, text #7A7060
  Letra W/L/D: Playfair 700, 17px

Info coluna flex:1:
  "Ronda N" (EB Garamond 10px uppercase, textDim)
  Nome adversário (Playfair 500, 15px, textPrim, numberOfLines:1)

ManaGroup (cores adversário com splash):
  ManaPip size=17 por cor
  gap 4

Chevron (opacity 0.25)
```

### 5.5 Button "Adicionar Match"

```
width: 100%
border: 1.5px dashed colors.border (hover/focus: goldDim)
borderRadius: 10
padding: 13×0
Row centrado:
  Círculo gold (22×22, gold+22 bg, border gold+66): ícone "+"
  "Adicionar Match" (EB Garamond 14px, textSec)
```

---

## 6. Écran: Match Registration

**Ficheiro de referência:** `Match Registration.html`  
**Apresentação:** Modal (sheet) a partir de Event Detail ou Home CTA.

### 6.1 Layout

```
SafeAreaView (bg: #130F0A)
├── StatusBar
├── NavBar (horizontal, justifyContent: space-between)
│   ├── Button "Cancelar" (EB Garamond 16px, textSec)
│   ├── Centro: "Novo Match" (Playfair 600, 17px) + Badge "Ronda N" (gold pill italic)
│   └── Button "Guardar" (disabled: borda sem fundo; enabled: gold gradient pill)
└── ScrollView
    ├── Campo "Nome do adversário" (ver 6.2)
    ├── Selector de cores (ver 6.3)
    ├── Selector de resultado (ver 6.4)
    └── Notas opcionais (ver 6.5)
```

### 6.2 Campo Nome do Adversário

```
Label: "Nome do adversário" (EB Garamond italic 11px uppercase, textDim)
Input container (bgInput #1A1510, border → gold+66 quando preenchido, borderRadius 12, padding 0×16):
  TextInput altura 52
  Font: Playfair Display 500, 18px, textPrim
  Placeholder: "ex: João Ferreira" (textDim)
```

### 6.3 Selector de Cores — Tap Cíclico

```
Label: "Cores do adversário" + Button "limpar" (se alguma cor seleccionada)
Container (bgCard, border, borderRadius 14, padding 14×8 top, 8×8 bottom):
  Row de 5 ManaPips grandes (size 44–52)

Estado por pip (ciclo ao tap: 0 → 1 → 2 → 0):
  0 (off):      pip normal, opacity 0.3, sem glow
  1 (principal): pip cheio, opacity 1, glow (0 0 0 3px borderSel+44)
  2 (splash):   pip 70% tamanho, opacity 0.70, sem letra

Label por baixo de cada pip (EB Garamond italic 9px):
  estado 0: transparente (espaço reservado)
  estado 1: "principal" (gold)
  estado 2: "splash" (#8B9CBB)

Animação de tap: ripple ring (popIn 0.4s) no pip tocado

Hint (abaixo do selector):
  Row: "principal = 1 tap" · "splash = 2 taps" · "limpar = 3 taps"
  Font: EB Garamond 10px, textDim
```

### 6.4 Selector de Resultado

```
Label: "Resultado" (EB Garamond italic 11px uppercase, textDim)
Row de 3 botões (gap 10):

Cada botão (flex:1, height 62, borderRadius 12):
  Inactivo: bg lossBg/winBg/drawBg, border lossBorder/winBorder/drawBorder
  Activo:   bg mais escuro, border colorida, glow (0 0 0 3px cor+33, 0 4px 16px cor+44), scale 1.02
  Letra W/L/D: Playfair 700, 26px (activo: cor; inactivo: cor+88)
  Label: "Vitória"/"Derrota"/"Empate" (EB Garamond 10px uppercase)
  Press: scale 0.95
```

### 6.5 Notas Opcionais

```
Toggle row (Pressable):
  Círculo 18×18 (border: border/gold+66; bg: transparente/gold+22)
  Ícone "+" (inactivo) → "−" (activo)
  "Notas opcionais" (EB Garamond italic 13px, textDim→textSec)

Expanded:
  TextArea (bgInput, border, borderRadius 12, padding 12×16)
  Font: EB Garamond 15px, lineHeight 1.5
  Placeholder: "Cartas relevantes, notas da partida…"
  rows: 3 (minHeight)
```

### 6.6 Comportamento do Botão "Guardar"

```
canSave = opponent.trim().length > 0 && result !== null

Inactivo (canSave=false):
  bg: transparent
  border: 1px solid colors.border
  text: textDim

Activo (canSave=true):
  bg: linear-gradient(135deg, gold, #A07840)
  border: none
  boxShadow: 0 2px 10px gold+44
  text: colors.bg (escuro)

On press (saved):
  Texto muda para "✓ Guardado" durante 1.8s
  Depois volta a "Guardar"
```

---

## 7. Modelos de dados (TypeScript)

```ts
// types/index.ts

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';
export type MatchResult = 'W' | 'L' | 'D';
export type EventType = 'Sealed' | 'Draft' | 'Standard' | 'Modern' | 'Legacy' | 'Pioneer' | 'Commander';

export interface ManaSelection {
  main: ManaColor[];
  splash: ManaColor[];
}

export interface Match {
  id: string;
  round: number;                  // calculado: índice na lista + 1
  opponent: string;
  opponentColors: ManaSelection;
  result: MatchResult;
  notes?: string;
  createdAt: string;              // ISO date
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  date: string;                   // ISO date (permite datas retroactivas)
  location?: string;
  active: boolean;                // torneio em curso
  deckName?: string;              // Fase 2+
  deckColors?: ManaSelection;     // Fase 2+
  deckThumbnailCardId?: string;   // Fase 3+ (Scryfall card ID)
  matches: Match[];
  // campos calculados (não guardar na DB):
  // wins, losses, draws, winRate, points, rank
}
```

---

## 8. Navegação

```
Stack principal:
  Home          ← tab 1
  Events List   ← tab 2
    Event Detail  ← push
  Stats         ← tab 3 (Fase 2+)
  Profile       ← tab 4 (Fase 2+)

Modal (sheet, bottom-up):
  Match Registration  ← apresentado a partir de Event Detail + Home CTA
```

Usar `@react-navigation/native` com `createBottomTabNavigator` e `createNativeStackNavigator`.

---

## 9. Comportamentos e animações

| Elemento | Comportamento |
|---|---|
| EventCard | scale(0.985) on press, fadeInUp com delay escalonado (60ms × index) |
| MatchCard | idem, delay 55ms × index |
| ResultButton | scale(0.95) on press, scale(1.02) quando activo |
| DeckSection chevron | rotate 0°→90° em 250ms ao expandir |
| Guardar button | transição suave de estado inactive→active com cor e shadow |
| ManaPip cíclico | ripple ring + spring scale ao tap |
| "Adicionar Match" btn | border-color muda de `border` para `goldDim` on hover/focus |

**Nota sobre grain overlay:** No protótipo HTML usamos um SVG de fractalNoise. Em React Native, pode-se omitir (sem impacto no design base) ou usar uma imagem PNG de noise com `ImageBackground` e opacity 0.04–0.06.

---

## 10. Notas de implementação

1. **Fontes:** Carregar com `expo-font` ou `@expo-google-fonts`. Aguardar `fontsLoaded` antes de renderizar.

2. **Splash colours:** A distinção principal/splash é um detalhe visual subtil mas importante. Implementar o `ManaPip` correctamente com `isSplash` antes de qualquer écran que mostre cores.

3. **Datas retroactivas:** O `DatePicker` no Match Registration e em "Novo Evento" não deve fazer `defaultValue = today`. Permitir qualquer data passada.

4. **Ronda auto-calculada:** `round = event.matches.length + 1`. Mostrar no header do Match Registration.

5. **Thumbnail de carta (Fase 2+):** Placeholder actual é um rectângulo 36–40×50–56px com borda e círculo dim. Fase 3 usa `Image` com URL do Scryfall.

6. **Safe Areas:** Usar `useSafeAreaInsets()` para padding top (status bar já existe em iOS mas Android varia) e bottom (home indicator + tab bar).

7. **Scrollview vs FlatList:** Events List e Event Detail (matches) devem usar `FlatList` para performance. Home usa `ScrollView` (poucos itens).

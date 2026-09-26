// Event Detail Screen
// Spec: design/handoff.md § 5
// Print: design/screen-event-detail.png

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { calcEventStats, isActive } from '../../types';
import type { Deck, Event, MatchResult } from '../../types';
import { formatDate } from '../../domain/dates';
import { deckPerformance } from '../../domain/deck';
import { eventColors, hasColors } from '../../domain/eventColors';
import { manaSelectionFrom, manaStatesFrom } from '../../domain/manaSelection';
import { isLimitedFormat } from '../../domain/sets';
import { eventThumbnailUrl, thumbnailChoices } from '../../domain/thumbnails';
import {
  cleanStanding,
  eventTier,
  formatPlacement,
  ordinal,
  tierFor,
  tierLabel,
} from '../../domain/placement';
import { useEventsStore } from '../../store/useEventsStore';
import { MatchCard } from '../../components/MatchCard';
import { TypeBadge } from '../../components/TypeBadge';
import { ManaPip } from '../../components/ManaPip';
import { ManaSelector } from '../../components/ManaSelector';
import { QuickRecordModal } from '../../components/QuickRecordModal';
import { CardArtThumb } from '../../components/CardArtThumb';
import { CardArtPicker } from '../../components/CardArtPicker';
import { SetSelector } from '../../components/SetSelector';
import { ConfirmModal } from '../../components/ConfirmModal';
import { RecordScore } from '../../components/RecordScore';
import { shareEventReport } from '../../services/eventExport';

// ─── Classificação final ──────────────────────────────────────────────────────

/**
 * Os dois números que fecham um torneio, enquanto ainda são texto no teclado.
 *
 * Guardam-se como string e não como número porque um campo a meio de ser escrito ("3" a caminho de
 * "32") não é um número que se queira gravar — e um `undefined` a passar pelo `value` de um
 * `TextInput` apagava o que lá estava por baixo dos dedos de quem escreve.
 */
interface StandingDraft {
  placement: string;
  playersCount: string;
}

/** O texto de um campo como posição, ou `undefined` enquanto ainda não for uma. */
function toPosition(text: string): number | undefined {
  const value = parseInt(text.trim(), 10);
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/**
 * Lê o rascunho e diz o que está mal, se estiver.
 *
 * Dois erros, e são os dois que o `cleanStanding` resolve deitando a posição fora — mas quem está a
 * escrever tem de ver o aviso, não o número a desaparecer por baixo dos dedos. Por isso detectam-se
 * aqui, **antes** de limpar:
 *
 *  - `orphan` — há posição e não há campo. Uma posição sozinha não se compara com nada, e o schema
 *    recusa-a (Q15, revisão do ADR 0012).
 *  - `contradictory` — o campo é mais pequeno do que a posição, e os dois não podem ser verdade.
 *
 * `writable` é a soma: se este rascunho pode ir para o ficheiro.
 */
function readStanding(draft: StandingDraft) {
  const placement = toPosition(draft.placement);
  const playersCount = toPosition(draft.playersCount);

  // Um campo por acabar ("3" a caminho de "32") já não é nada, mas também não é ausência: quem
  // escreveu alguma coisa ali quer aquele número, e dizer-lhe "isto está vazio" seria mentira.
  const playersTyped = draft.playersCount.trim().length > 0;

  const orphan = placement !== undefined && playersCount === undefined;
  const contradictory =
    placement !== undefined && playersCount !== undefined && playersCount < placement;

  return {
    placement,
    playersCount,
    playersTyped,
    orphan,
    contradictory,
    writable: !orphan && !contradictory,
  };
}

/** O rascunho de um evento que já existe, para os campos abrirem com o que lá está. */
function draftFrom(event: Event): StandingDraft {
  return {
    placement: event.placement ? String(event.placement) : '',
    playersCount: event.playersCount ? String(event.playersCount) : '',
  };
}

/**
 * A linha por baixo dos campos, que diz em que escalão a posição cai — ou porque não cai em nenhum.
 *
 * É ela que faz a diferença entre pedir dois números e pedir dois números com sentido: mostra ali
 * mesmo que um 5.º entre 6 não é Top 8 nenhum, em vez de o deixar descobrir nas estatísticas.
 */
function standingPreview(reading: ReturnType<typeof readStanding>): string {
  const { placement, playersCount, playersTyped, orphan, contradictory } = reading;

  if (contradictory) {
    return `Only ${playersCount} players — ${ordinal(placement!)} doesn't fit.`;
  }

  if (orphan) {
    return playersTyped
      ? 'How many players? That number needs to be at least 1.'
      : `${ordinal(placement!)} of how many? A position on its own can't be compared.`;
  }

  if (placement === undefined) {
    return playersCount === undefined
      ? 'Leave both empty if there is no finish worth recording.'
      : 'Add the finishing position to place this tournament.';
  }

  const label = `${ordinal(placement)} of ${playersCount}`;
  const tier = tierFor(placement, playersCount);

  return tier !== null
    ? `${label} · counts as ${tierLabel(tier)}`
    : `${label} · outside the brackets`;
}

/** Os dois campos e a pré-visualização. Serve para fechar o torneio e para corrigir depois. */
function StandingFields({ draft, onChange, onCommit }: {
  draft: StandingDraft;
  onChange: (next: StandingDraft) => void;
  /** Chamado ao sair de um campo, para quem grava à medida em vez de ter botão de confirmar. */
  onCommit?: () => void;
}) {
  const reading = readStanding(draft);

  return (
    <View style={complete.group}>
      <View style={complete.pair}>
        <View style={complete.half}>
          <Text style={complete.label}>Finished</Text>
          <TextInput
            style={[complete.input, reading.contradictory && complete.inputBad]}
            value={draft.placement}
            onChangeText={placement => onChange({ ...draft, placement })}
            onBlur={onCommit}
            placeholder="e.g. 5"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>

        <View style={complete.half}>
          <Text style={complete.label}>Out of</Text>
          <TextInput
            // A posição órfã é falta deste campo, portanto é aqui que o aviso se vê.
            style={[complete.input, (reading.contradictory || reading.orphan) && complete.inputBad]}
            value={draft.playersCount}
            onChangeText={playersCount => onChange({ ...draft, playersCount })}
            onBlur={onCommit}
            placeholder="e.g. 32"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
      </View>

      <Text style={[complete.preview, !reading.writable && complete.previewBad]}>
        {standingPreview(reading)}
      </Text>
    </View>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ wins, losses, draws, points, winRate }: {
  wins: number; losses: number; draws: number; points: number; winRate: number;
}) {
  return (
    <View style={statsBar.container}>
      {/* Record. É o facto principal da folha e ocupa metade da barra — por isso os números são
          os maiores do écran e têm cor, como na lista de eventos. Neutros e a 16 px estavam a
          desperdiçar o espaço que já tinham. O bloco não cresce: só o que está lá dentro. */}
      <View style={statsBar.recordBlock}>
        <RecordScore wins={wins} losses={losses} draws={draws} showDraws="always" size={30} />
        <Text style={statsBar.recordLabel}>W – L – D</Text>
      </View>

      <View style={statsBar.vDivider} />

      {/* Pontos */}
      <View style={statsBar.cell}>
        <Text style={statsBar.bigValue}>{points}</Text>
        <Text style={statsBar.cellLabel}>Pts</Text>
      </View>

      <View style={statsBar.vDivider} />

      {/* Win Rate */}
      <View style={statsBar.cell}>
        <Text style={statsBar.bigValue}>{winRate}%</Text>
        <Text style={statsBar.cellLabel}>Win Rate</Text>
      </View>
    </View>
  );
}

const statsBar = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  recordBlock: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.gold + '0F',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  recordLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  vDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  bigValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textPrim,
  },
  cellLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

// ─── DeckSection ──────────────────────────────────────────────────────────────

/**
 * O deck com que se jogou este torneio.
 *
 * Três casos, por ordem de preferência:
 *  1. `deckId` — a forma da Fase 2. Mostra o deck a sério e abre-o ao toque.
 *  2. `deckName`/`deckColors` — legado, eventos anteriores à Fase 2. Continuam a ver-se, e dá para
 *     ligá-los a um deck de verdade sem perder o que lá está.
 *  3. Nada — convida a escolher.
 */
function DeckSection({ event }: { event: Event }) {
  const decks = useEventsStore(s => s.decks);
  const events = useEventsStore(s => s.events);
  const setEventDeck = useEventsStore(s => s.setEventDeck);

  const [picking, setPicking] = useState(false);

  const linked = decks.find(d => d.id === event.deckId);
  const legacyName = event.deckName;

  // As cores que se mostram são as do evento, e só depois as do deck — ADR 0013. O deck responde
  // por omissão; quem escreveu as cores à mão sabia o que foi splash, e a decklist não sabe.
  const shownColors = eventColors(event, decks);

  // A carta que ilustra o evento, se houver uma escolhida — e, sem escolha própria, a do deck. Sai
  // da lista de cartas do deck ligado, portanto não custa rede nenhuma. O `CardArtThumb` volta ao
  // placeholder sozinho quando não há arte ou quando ela falha a carregar.
  const artUrl = eventThumbnailUrl(event, decks);

  const performance = linked ? deckPerformance(linked.id, events) : null;

  function choose(deckId: string | undefined) {
    setPicking(false);
    void setEventDeck(event.id, deckId);
  }

  return (
    <View style={deck.card}>
      <Pressable
        style={deck.header}
        onPress={() => (linked ? router.push({ pathname: '/deck/[id]', params: { id: linked.id } }) : setPicking(true))}
      >
        <CardArtThumb url={artUrl} width={112} />

        <View style={deck.info}>
          <Text style={deck.label}>Deck</Text>

          {linked ? (
            <>
              <Text style={deck.name}>{linked.name}</Text>
              <View style={deck.pips}>
                {(shownColors?.main ?? []).map(c => <ManaPip key={`m-${c}`} color={c} size={14} />)}
                {(shownColors?.splash ?? []).map(c => <ManaPip key={`s-${c}`} color={c} size={14} isSplash />)}
                {performance && performance.events > 1 && (
                  <Text style={deck.meta}>
                    {performance.winRate}% over {performance.events} events
                  </Text>
                )}
              </View>
            </>
          ) : legacyName ? (
            <>
              <Text style={deck.name}>{legacyName}</Text>
              <View style={deck.pips}>
                {(shownColors?.main ?? []).map(c => <ManaPip key={`m-${c}`} color={c} size={14} />)}
                {(shownColors?.splash ?? []).map(c => <ManaPip key={`s-${c}`} color={c} size={14} isSplash />)}
                <Text style={deck.meta}>not linked to a deck</Text>
              </View>
            </>
          ) : shownColors ? (
            /* Sem deck e sem nome, mas com cores: é a forma de um torneio retroactivo, e as cores
               são tudo o que dele se sabe. Valem por si — ver ADR 0013. */
            <View style={deck.pips}>
              {shownColors.main.map(c => <ManaPip key={`m-${c}`} color={c} size={14} />)}
              {shownColors.splash.map(c => <ManaPip key={`s-${c}`} color={c} size={14} isSplash />)}
              <Text style={deck.meta}>no deck recorded</Text>
            </View>
          ) : (
            <Text style={deck.empty}>Tap to choose a deck</Text>
          )}
        </View>

        <Feather name="chevron-right" size={16} color={colors.textDim} style={{ opacity: 0.5 }} />
      </Pressable>

      {/*
        Trocar o deck é raro — em Sealed e Draft ele é feito na hora e o que se faz a seguir é
        editá-lo, não substituí-lo por outro. Uma linha inteira com texto dava-lhe o destaque de uma
        acção frequente. Fica um ícone no canto, com área de toque a sério por baixo dele.
      */}
      {(linked || legacyName) && (
        <View style={deck.actions}>
          {/*
            Editar vem primeiro e a dourado porque é o que se faz a seguir quase sempre: em Sealed
            e Draft o deck é construído na hora e depois corrige-se. Trocar por outro é raro, e fica
            esbatido ao lado.
          */}
          {linked && (
            <Pressable
              onPress={() => router.push({ pathname: '/deck-editor', params: { deckId: linked.id } })}
              hitSlop={6}
              accessibilityLabel="Edit deck"
              style={({ pressed }) => [deck.iconBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="edit-2" size={15} color={colors.gold} />
            </Pressable>
          )}

          <Pressable
            onPress={() => setPicking(true)}
            hitSlop={6}
            accessibilityLabel={linked ? 'Change deck' : 'Link to a deck'}
            style={({ pressed }) => [deck.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="repeat" size={15} color={colors.textDim} />
          </Pressable>
        </View>
      )}

      <DeckPicker
        visible={picking}
        event={event}
        currentId={event.deckId}
        decks={decks}
        onPick={choose}
        onCancel={() => setPicking(false)}
      />
    </View>
  );
}

/**
 * O que se corrige num evento depois de ele existir: o set e a carta que o ilustra.
 *
 * Está atrás de um toque de propósito. São coisas que se mexem uma vez e nunca mais — abertas por
 * omissão, empurravam os matches para baixo em todos os torneios para servir o caso raro, e os
 * matches são o que se vem cá ver entre rondas.
 *
 * Cada uma só aparece quando quer dizer alguma coisa: o set só em Limited (num Modern não significa
 * nada), a arte só quando há um deck ligado com cartas que tenham arte.
 */
function EventSettings({ event }: { event: Event }) {
  const decks = useEventsStore(s => s.decks);
  const setEventSetCode = useEventsStore(s => s.setEventSetCode);
  const setEventDeckThumbnail = useEventsStore(s => s.setEventDeckThumbnail);
  const setEventStanding = useEventsStore(s => s.setEventStanding);
  const setEventColors = useEventsStore(s => s.setEventColors);

  const [open, setOpen] = useState(false);
  const [standing, setStanding] = useState<StandingDraft>(() => draftFrom(event));

  // Os pips abrem com o que está gravado no evento — e **não** com as cores do deck ligado. Herdar
  // aqui faria a primeira gravação copiar as cores do deck para dentro do evento sem ninguém as ter
  // escolhido, e a partir daí trocar de deck deixava de mudar coisa nenhuma (ADR 0013).
  const [colorStates, setColorStates] = useState(() => manaStatesFrom(event.deckColors));

  // Os campos seguem o que está gravado. Sem isto, concluir o torneio com este écran montado
  // deixava-os vazios por cima de uma posição que já existe — e a gravação ao sair apagava-a.
  // Enquanto se escreve nada muda: o que grava é o `commitStanding`, e ele grava o mesmo valor.
  useEffect(() => {
    setStanding(draftFrom(event));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.placement, event.playersCount]);

  useEffect(() => {
    setColorStates(manaStatesFrom(event.deckColors));
  }, [event.deckColors]);

  const linked = decks.find(d => d.id === event.deckId);
  const showSet = isLimitedFormat(event.type);
  const showArt = thumbnailChoices(linked?.cards).length > 0;
  // Só depois de o torneio fechar: a meio dele ainda não há posição nenhuma para corrigir.
  const showStanding = !isActive(event);

  /**
   * Grava ao sair do campo, e não a cada tecla: a meio de escrever "32" passa-se por "3", que é uma
   * posição válida e ficaria gravada. Um par que não possa ir para o ficheiro — uma posição sem
   * campo, ou um campo mais pequeno do que ela — não se grava de todo: o aviso fica no écran até os
   * dois números fazerem sentido, em vez de a posição desaparecer em silêncio.
   */
  function commitStanding() {
    const { placement, playersCount, writable } = readStanding(standing);
    if (!writable) return;
    void setEventStanding(event.id, { placement, playersCount });
  }

  /**
   * As cores gravam a cada toque, ao contrário da classificação.
   *
   * Um pip não tem estado intermédio: `W` é `W` no instante em que se toca, e não há um "3" a
   * caminho de "32" que se possa gravar por engano. Esperar por um `onBlur` que num selector de
   * pips nunca chega deixaria a escolha por gravar.
   */
  function chooseColors(next: typeof colorStates) {
    setColorStates(next);
    void setEventColors(event.id, manaSelectionFrom(next));
  }

  // Não há mais `return null`: as cores registam-se sempre, e num torneio antigo são muitas vezes a
  // única coisa que dele se sabe. Antes disto a secção inteira desaparecia num evento sem set, sem
  // arte e a decorrer — que é exactamente a forma de um evento acabado de criar.

  return (
    <View style={settings.wrap}>
      <Pressable
        style={settings.toggle}
        onPress={() => setOpen(current => !current)}
        hitSlop={8}
      >
        <Feather name="sliders" size={13} color={colors.textDim} />
        <Text style={settings.toggleText}>Event details</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textDim} />
      </Pressable>

      {open && (
        <View style={settings.body}>
          {showStanding && (
            <View style={settings.standing}>
              <Text style={settings.sectionLabel}>Final standing</Text>
              <StandingFields draft={standing} onChange={setStanding} onCommit={commitStanding} />
            </View>
          )}

          {/* As cores com que se jogou este torneio — ADR 0013. */}
          <View style={settings.colors}>
            <ManaSelector
              label="Colors played"
              states={colorStates}
              onChange={chooseColors}
            />
            <Text style={settings.colorsNote}>
              {hasColors(event.deckColors)
                ? 'Recorded for this tournament — this is what the stats count.'
                : linked
                  ? `Following ${linked.name}. Tap to record what you actually played.`
                  : 'Not recorded. Tap the colors you played.'}
            </Text>
          </View>

          {showSet && (
            <SetSelector
              value={event.setCode}
              onChange={code => void setEventSetCode(event.id, code)}
            />
          )}

          {showArt && (
            <CardArtPicker
              cards={linked?.cards}
              value={event.deckThumbnailCardId}
              onChange={cardId => void setEventDeckThumbnail(event.id, cardId)}
              label="Event art"
            />
          )}
        </View>
      )}
    </View>
  );
}

const settings = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  toggleText: {
    flex: 1,
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: { paddingBottom: 4 },
  standing: { gap: 8, paddingBottom: 14 },
  colors: { gap: 8, paddingBottom: 14 },
  colorsNote: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

/**
 * Escolher entre os decks que existem — ou criar um aqui mesmo.
 *
 * Criar daqui não é conveniência: em Sealed e Draft o deck **nasce no torneio**, com as cartas que
 * saíram das boosters, e mandar alguém ao tab Decks a meio de um registo era um beco sem saída
 * disfarçado de instrução ("cria um lá e ele aparece aqui").
 *
 * O editor abre com o formato e o nome do evento já preenchidos, e o deck fica ligado sozinho ao
 * voltar. É lá que está a procura de cartas e o scan por fotografia.
 */
function DeckPicker({ visible, event, currentId, decks, onPick, onCancel }: {
  visible: boolean;
  event: Event;
  currentId: string | undefined;
  decks: Deck[];
  onPick: (deckId: string | undefined) => void;
  onCancel: () => void;
}) {
  function createAndLink() {
    onCancel();
    router.push({
      pathname: '/deck-editor',
      params: { linkToEventId: event.id, presetFormat: event.type, presetName: event.name },
    });
  }
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={picker.overlay} onPress={onCancel}>
        <Pressable style={picker.card} onPress={e => e.stopPropagation()}>
          <Text style={picker.title}>Deck</Text>

          {decks.length === 0 ? (
            <Text style={picker.empty}>
              No decks yet — build this event's deck now and it gets linked here.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {decks.map(item => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [picker.row, pressed && { opacity: 0.7 }]}
                  onPress={() => onPick(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={picker.rowName}>{item.name}</Text>
                    {item.format && <Text style={picker.rowMeta}>{item.format}</Text>}
                  </View>
                  <View style={picker.rowPips}>
                    {item.colors.main.map(c => <ManaPip key={`m-${c}`} color={c} size={13} />)}
                    {item.colors.splash.map(c => <ManaPip key={`s-${c}`} color={c} size={13} isSplash />)}
                  </View>
                  {currentId === item.id && <Feather name="check" size={15} color={colors.gold} />}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Sempre visível, e não só na lista vazia: o deck de um Sealed é novo de cada vez. */}
          <Pressable
            onPress={createAndLink}
            style={({ pressed }) => [picker.createRow, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={15} color={colors.gold} />
            <Text style={picker.createText}>Build a new deck for this event</Text>
          </Pressable>

          <View style={picker.actions}>
            <Pressable style={picker.actionBtn} onPress={onCancel}>
              <Text style={picker.cancelText}>Cancel</Text>
            </Pressable>
            {currentId && (
              <Pressable style={picker.actionBtn} onPress={() => onPick(undefined)}>
                <Text style={picker.clearText}>Remove</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const picker = StyleSheet.create({
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 48,
    marginTop: 6,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createText: { fontFamily: fonts.body, fontSize: 14, color: colors.gold },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#252019',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.textPrim,
    textAlign: 'center',
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 21,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  rowName: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrim },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  rowPips: { flexDirection: 'row', gap: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec },
  clearText: { fontFamily: fonts.body, fontSize: 15, color: colors.loss },
});

const deck = StyleSheet.create({
  meta: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
    marginLeft: 4,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
  },
  actions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
  },
  /** Pequeno à vista, 44×44 ao dedo — que é o mínimo para não se falhar o toque. */
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  pips: {
    flexDirection: 'row',
    gap: 3,
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
  },
  expandedText: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
  },
});

// ─── Botão Add Match ────────────────────────────────────────────────────

/**
 * Acrescentar uma ronda — a escrever, ou a contar.
 *
 * As duas levam ao mesmo sítio. Registar continua a ser o caminho normal e fica com a largura toda
 * que sobra; contar a vida é o quadrado ao lado, para quem vai jogar agora e regista no fim.
 */
function AddMatchButton({ onPress, onCount }: { onPress: () => void; onCount: () => void }) {
  return (
    <View style={addBtn.row}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [addBtn.btn, pressed && { borderColor: colors.goldDim }]}
      >
        <View style={addBtn.circle}>
          <Text style={addBtn.plus}>+</Text>
        </View>
        <Text style={addBtn.text}>Add Match</Text>
      </Pressable>

      <Pressable
        onPress={onCount}
        style={({ pressed }) => [addBtn.life, pressed && { opacity: 0.8 }]}
      >
        <Feather name="heart" size={19} color={colors.gold} />
      </Pressable>
    </View>
  );
}

const addBtn = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  life: {
    width: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + '80',
    backgroundColor: colors.gold + '17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 8,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold + '22',
    borderWidth: 1,
    borderColor: colors.gold + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    color: colors.gold,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSec,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event       = useEventsStore(s => s.events.find(e => e.id === id));
  const deleteEvent   = useEventsStore(s => s.deleteEvent);
  const completeEvent = useEventsStore(s => s.completeEvent);
  const deleteMatch   = useEventsStore(s => s.deleteMatch);
  const addBareMatches = useEventsStore(s => s.addBareMatches);
  const decks          = useEventsStore(s => s.decks);
  const opponents      = useEventsStore(s => s.opponents);

  // All useState calls must be above any early return
  const [deleteEventModal,   setDeleteEventModal]   = useState(false);
  const [completeEventModal, setCompleteEventModal] = useState(false);
  const [standing,           setStanding]           = useState<StandingDraft>({ placement: '', playersCount: '' });
  const [deleteMatchModal,   setDeleteMatchModal]   = useState<{ round: number; opponent: string } | null>(null);
  const [quickOpen,          setQuickOpen]          = useState(false);
  const [quickSequence,      setQuickSequence]      = useState<MatchResult[]>([]);
  const [exporting,          setExporting]          = useState(false);
  const [exportNotice,       setExportNotice]       = useState<string | null>(null);

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={{ color: colors.textSec, padding: 20 }}>Event not found.</Text>
      </SafeAreaView>
    );
  }

  const stats = calcEventStats(event);
  const reading = readStanding(standing);

  // O resultado final, para o cabeçalho. `formatPlacement` já trata do `rank` antigo.
  const standingLabel = formatPlacement(event);
  const standingTier  = eventTier(event);

  // O set do torneio, ao lado do formato. `setCode` é o campo a sério e só existe em Limited; o
  // pedaço do nome a seguir ao travessão é o que se fazia antes de o campo ter interface, e
  // continua a valer para os eventos antigos que não o têm.
  const setCode = event.setCode?.trim().toUpperCase();
  const legacySetLabel = setCode
    ? undefined
    : event.name.split('—')[1]?.trim().toLowerCase() || undefined;

  /**
   * Fecha o registo rápido gravando a sequência, e limpa-a.
   *
   * A sequência vive no écran e não no store porque não é um registo — é um formulário a meio. Só
   * passa a existir em `data/` quando alguém carrega em "Add N rounds".
   */
  function commitQuickRecord() {
    const sequence = quickSequence;
    setQuickOpen(false);
    setQuickSequence([]);
    void addBareMatches(event!.id, sequence);
  }

  function goToMatchRegistration() {
    router.push({
      pathname: '/match-registration',
      params: {
        eventId: event!.id,
        round: String(event!.matches.length + 1),
        eventName: event!.name,
      },
    });
  }

  /**
   * O relatório do torneio, para mandar aos amigos — ADR 0014.
   *
   * Pode demorar uns segundos: as imagens das cartas vão dentro do ficheiro. Enquanto isso o botão
   * mostra que está a trabalhar e não aceita um segundo toque. O aviso por baixo da barra só aparece
   * quando há alguma coisa a dizer — imagens que ficaram de fora, ou uma falha.
   */
  async function shareReport() {
    if (exporting) return;
    setExporting(true);
    setExportNotice(null);
    try {
      const linked = decks.find(d => d.id === event!.deckId);
      const result = await shareEventReport(event!, linked, opponents);
      if (result.linked > 0) {
        setExportNotice(
          `${result.linked} image${result.linked === 1 ? '' : 's'} couldn't be saved into the file ` +
          `(no connection). ${result.linked === 1 ? 'It loads' : 'They load'} from the internet when opened.`,
        );
      }
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : 'Could not export this event.');
    } finally {
      setExporting(false);
    }
  }

  /** Contar a vida da ronda seguinte. À saída, o contador abre o registo já preenchido. */
  function goToLifeCounter() {
    router.push({
      pathname: '/life-counter',
      params: {
        eventId: event!.id,
        round: String(event!.matches.length + 1),
        eventName: event!.name,
      },
    });
  }

  /** Toque num match abre-o para corrigir; o toque longo continua a apagar. */
  function goToMatchEdit(round: number) {
    router.push({
      pathname: '/match-registration',
      params: {
        eventId: event!.id,
        round: String(round),
        eventName: event!.name,
        mode: 'edit',
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={colors.textPrim} />
        </Pressable>
        <Text style={styles.breadcrumb}>Events</Text>
        <Pressable
          style={styles.shareBtn}
          onPress={shareReport}
          disabled={exporting}
          accessibilityLabel="Share event report"
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.gold} />
            : <Feather name="share-2" size={16} color={colors.gold} />}
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => setDeleteEventModal(true)}>
          <Feather name="trash-2" size={16} color={colors.loss} />
        </Pressable>
      </View>
      {exporting && <Text style={styles.exportNotice}>Preparing the report…</Text>}
      {exportNotice && (
        <Pressable onPress={() => setExportNotice(null)}>
          <Text style={styles.exportNotice}>{exportNotice}</Text>
        </Pressable>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Event Header */}
        <View style={styles.eventHeader}>
          <View style={styles.badges}>
            <TypeBadge type={event.type} />
            <View style={[styles.statusBadge, isActive(event) ? styles.statusActive : styles.statusDone]}>
              <Text style={[styles.statusText, isActive(event) ? styles.statusTextActive : styles.statusTextDone]}>
                {isActive(event) ? 'Active' : 'Completed'}
              </Text>
            </View>
            {setCode ? (
              <View style={styles.setBadge}>
                <Text style={[styles.setBadgeText, styles.setBadgeCode]}>{setCode}</Text>
              </View>
            ) : legacySetLabel ? (
              <View style={styles.setBadge}>
                <Text style={styles.setBadgeText}>{legacySetLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.eventName}>{event.name}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={12} color={colors.textDim} />
              <Text style={styles.metaText}>{formatDate(event.date)}</Text>
            </View>
            {event.location && (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={12} color={colors.textDim} />
                <Text style={styles.metaText}>{event.location}</Text>
              </View>
            )}
          </View>

          {/* O resultado final. Antes disto só se escrevia e nunca mais se via. */}
          {standingLabel && (
            <View style={styles.standing}>
              <Feather name="award" size={13} color={colors.gold} />
              <Text style={styles.standingText}>{standingLabel}</Text>
              {standingTier !== null && (
                <Text style={styles.standingTier}>{tierLabel(standingTier)}</Text>
              )}
            </View>
          )}
        </View>

        {/* Stats Bar */}
        <StatsBar
          wins={stats.wins}
          losses={stats.losses}
          draws={stats.draws}
          points={stats.points}
          winRate={stats.winRate}
        />

        {/* Deck Section */}
        <DeckSection
          event={event}
        />

        <EventSettings event={event} />

        {/* Matches */}
        <View style={styles.matchesHeader}>
          <Text style={styles.matchesTitle}>Matches</Text>
          <Text style={styles.matchesCount}>{event.matches.length}</Text>
        </View>

        {event.matches.map(match => (
          <MatchCard
            key={match.round}
            match={match}
            onPress={() => goToMatchEdit(match.round)}
            onLongPress={() => setDeleteMatchModal({ round: match.round, opponent: match.opponent ?? 'an unrecorded opponent' })}
          />
        ))}

        {/* Botão adicionar match */}
        {isActive(event) && (
          <AddMatchButton onPress={goToMatchRegistration} onCount={goToLifeCounter} />
        )}

        {/* Registo rápido — o torneio antigo de que só se sabe o recorde. Ver ADR 0013 e
            domain/quickRecord.ts. Fica a seguir ao Add Match de propósito: entre rondas o que se
            quer é registar a ronda, e este caminho é para quando se está a carregar o arquivo. */}
        {isActive(event) && (
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setQuickOpen(true)}
          >
            <Feather name="fast-forward" size={14} color={colors.textSec} />
            <Text style={styles.quickBtnText}>
              {event.matches.length === 0 ? 'Quick record' : 'Quick record more rounds'}
            </Text>
          </Pressable>
        )}

        {/* Botão concluir torneio */}
        {isActive(event) && (
          <Pressable
            style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setCompleteEventModal(true)}
          >
            <Feather name="check-circle" size={15} color={colors.gold} />
            <Text style={styles.completeBtnText}>Complete Tournament</Text>
          </Pressable>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
      {/* Sheet: concluir evento */}
      <Modal
        visible={completeEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCompleteEventModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={complete.overlay} onPress={() => setCompleteEventModal(false)} />
          <View style={complete.sheet}>
            <View style={complete.handle} />
            <Text style={complete.title}>Complete Tournament</Text>
            <Text style={complete.subtitle}>{event.name}</Text>

            <StandingFields draft={standing} onChange={setStanding} />

            <View style={complete.actions}>
              <Pressable
                style={({ pressed }) => [complete.btn, complete.cancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setCompleteEventModal(false)}
              >
                <Text style={complete.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                // A posição e o campo andam juntos (Q15): sem os dois, ou com dois que não podem
                // ser verdade ao mesmo tempo, não se conclui. O aviso já está no écran e corrigir é
                // escrever um número. Deixar os dois em branco continua a valer — um torneio antigo
                // pode não ter resultado nenhum de que alguém se lembre.
                disabled={!reading.writable}
                style={({ pressed }) => [
                  complete.btn,
                  complete.confirmBtn,
                  !reading.writable && complete.btnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={async () => {
                  setCompleteEventModal(false);
                  await completeEvent(event.id, cleanStanding(reading));
                  router.replace('/(tabs)/');
                }}
              >
                <Text style={complete.confirmLabel}>Complete</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Folha: registo rápido de várias rondas */}
      <QuickRecordModal
        visible={quickOpen}
        eventName={event.name}
        existingRounds={event.matches.length}
        sequence={quickSequence}
        onChange={setQuickSequence}
        onConfirm={commitQuickRecord}
        onCancel={() => setQuickOpen(false)}
      />

      {/* Modal: apagar evento */}
      <ConfirmModal
        visible={deleteEventModal}
        title="Delete event"
        message={`Are you sure you want to delete "${event.name}"?\n\nAll matches will be deleted.`}
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={() => {
          setDeleteEventModal(false);
          router.back();
          deleteEvent(event.id);
        }}
        onCancel={() => setDeleteEventModal(false)}
      />

      {/* Modal: apagar match */}
      <ConfirmModal
        visible={deleteMatchModal !== null}
        title="Delete match"
        message={`Delete match against ${deleteMatchModal?.opponent}?`}
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={() => {
          if (deleteMatchModal) deleteMatch(event.id, deleteMatchModal.round);
          setDeleteMatchModal(null);
        }}
        onCancel={() => setDeleteMatchModal(null)}
      />
    </SafeAreaView>
  );
}

const complete = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1E1812',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.textPrim,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textSec,
    textAlign: 'center',
    marginTop: -8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 50,
    paddingHorizontal: 16,
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.textPrim,
  },
  group: {
    gap: 10,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
    gap: 8,
  },
  inputBad: {
    borderColor: colors.lossBorder,
  },
  preview: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textSec,
    lineHeight: 17,
  },
  previewBad: {
    color: colors.loss,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '88',
  },
  cancelLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSec,
  },
  confirmLabel: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.gold,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: -12,
    marginBottom: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  quickBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSec,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    borderRadius: 10,
  },
  completeBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.gold,
  },
  shareBtn: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportNotice: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textSec,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.lossBg,
    borderWidth: 1,
    borderColor: colors.lossBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumb: {
    fontFamily: fonts.bodyItal,
    fontSize: 14,
    color: colors.textDim,
  },
  eventHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
    gap: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  statusActive: {
    backgroundColor: colors.gold + '18',
    borderColor: colors.gold + '66',
  },
  statusDone: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  statusText: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
  },
  statusTextActive: {
    color: colors.gold,
  },
  statusTextDone: {
    color: colors.textDim,
  },
  setBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  setBadgeText: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
  },
  // Um código a sério lê-se como código: maiúsculas e espaçado, como no SetSelector.
  setBadgeCode: {
    fontFamily: fonts.bodyMed,
    color: colors.goldDim,
    letterSpacing: 0.6,
  },
  eventName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textPrim,
    lineHeight: 28,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  standingText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.gold,
    includeFontPadding: false,
  },
  standingTier: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textSec,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 7,
  },
  matchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  matchesTitle: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  matchesCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
  },
});

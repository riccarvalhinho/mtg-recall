// Deck Editor — modal
//
// Um écran para as duas coisas: sem `deckId` cria um deck, com `deckId` altera o que lá está. São o
// mesmo formulário e separá-los em dois ficheiros era manter duas cópias do mesmo campo.
//
// **A lista de cartas não se edita aqui.** Isso precisa do Card Search (Fase 3). Enquanto não
// existir, o editor tem de passar `deck.cards` de volta ao store tal como o encontrou — o
// `updateDeck` substitui o deck inteiro, e não o fazer apagaria a lista de cartas de um deck só
// porque se lhe corrigiu o nome.

import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { EventType, ManaColor } from '../types';
import {
  MANA_ORDER,
  cycleManaState,
  hasAnyMana,
  emptyManaStates,
  manaSelectionFrom,
  manaStatesFrom,
} from '../domain/manaSelection';
import { cardCount } from '../domain/deck';
import { useEventsStore } from '../store/useEventsStore';
import { ManaPip } from '../components/ManaPip';
import { CardSearchModal } from '../components/CardSearchModal';
import { toDeckCard } from '../domain/cards';
import {
  addCard,
  cardKey,
  cardsForBoard,
  changeQuantity,
  normalizeDeckCards,
  removeCard,
  setBoard,
  toStoredCards,
} from '../domain/deckList';
import type { DeckBoard, DeckCard } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

// A mesma ordem do add-event, para os dois écrans não apresentarem os formatos ao contrário
const FORMATS: EventType[] = ['Sealed', 'Draft', 'Standard', 'Modern', 'Pioneer', 'Commander', 'Legacy'];

export default function DeckEditorScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();

  const deck = useEventsStore(s => (deckId ? s.decks.find(d => d.id === deckId) : undefined));
  const createDeck = useEventsStore(s => s.createDeck);
  const updateDeck = useEventsStore(s => s.updateDeck);
  const deleteDeck = useEventsStore(s => s.deleteDeck);

  // Um `deckId` que não existe no store (deck apagado noutro écran) cai para o modo de criação em
  // vez de ficar preso num formulário vazio a dizer "Edit Deck"
  const isEdit = deck !== undefined;

  const [name, setName]           = useState(deck?.name ?? '');
  const [colorStates, setColorStates] = useState(manaStatesFrom(deck?.colors));
  const [format, setFormat]       = useState<EventType | undefined>(deck?.format);
  const [archetype, setArchetype] = useState(deck?.archetype ?? '');
  const [notes, setNotes]         = useState(deck?.notes ?? '');
  const [saving, setSaving]       = useState(false);
  const [cardList, setCardList]   = useState<DeckCard[]>(normalizeDeckCards(deck?.cards));
  const [searchOpen, setSearchOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Quantos eventos impedem o apagar. `null` enquanto ninguém tentou. */
  const [blockedBy, setBlockedBy] = useState<number | null>(null);

  const canSave = name.trim().length > 0 && !saving;
  const cards = cardCount(cardList);

  function cycleColor(color: ManaColor) {
    setColorStates(prev => cycleManaState(prev, color));
  }

  /** Tocar no formato activo larga-o: o formato é opcional e tinha de haver forma de o desfazer. */
  function chooseFormat(next: EventType) {
    setFormat(current => (current === next ? undefined : next));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    const data = {
      name:      name.trim(),
      colors:    manaSelectionFrom(colorStates),
      format,
      archetype: archetype.trim() || undefined,
      cards:     toStoredCards(cardList),
      notes:     notes.trim() || undefined,
    };

    if (isEdit && deckId) await updateDeck(deckId, data);
    else await createDeck(data);

    setSaving(false);
    router.back();
  }

  async function handleDelete() {
    if (!deckId) return;
    setConfirmDelete(false);

    const result = await deleteDeck(deckId);
    if (result.ok) {
      router.back();
      return;
    }

    // O store recusa apagar um deck que algum evento use — apagá-lo deixaria esses eventos a
    // apontar para um ficheiro que já não existe. Aqui só se explica porquê.
    setBlockedBy(result.usedBy);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* NavBar */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </Pressable>

          <Text style={styles.navTitle}>{isEdit ? 'Edit Deck' : 'New Deck'}</Text>

          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={12}>
            {canSave || saving ? (
              <LinearGradient
                colors={[colors.gold, '#A07840']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveActive}
              >
                {saving
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.saveActiveText}>{isEdit ? 'Save' : 'Create'}</Text>
                }
              </LinearGradient>
            ) : (
              <View style={styles.saveInactive}>
                <Text style={styles.saveInactiveText}>{isEdit ? 'Save' : 'Create'}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nome */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Deck name *</Text>
            <View style={[styles.inputContainer, name.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Boros Energy"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Cores — o mesmo selector de três estados do registo de match */}
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Colors</Text>
              {hasAnyMana(colorStates) && (
                <Pressable onPress={() => setColorStates(emptyManaStates())} hitSlop={12}>
                  <Text style={styles.clearBtn}>clear</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.colorSelector}>
              {MANA_ORDER.map(color => {
                const state = colorStates[color];
                return (
                  <Pressable
                    key={color}
                    onPress={() => cycleColor(color)}
                    style={styles.colorPip}
                  >
                    <View style={{ opacity: state === 0 ? 0.3 : 1 }}>
                      <ManaPip
                        color={color}
                        size={state === 2 ? 34 : 48}
                        isSplash={state === 2}
                      />
                    </View>
                    <Text style={[
                      styles.colorLabel,
                      state === 0 && { opacity: 0 },
                      state === 1 && { color: colors.gold },
                      state === 2 && { color: '#8B9CBB' },
                    ]}>
                      {state === 2 ? 'splash' : 'main'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.hint}>
              1 tap = main · 2 taps = splash · 3 taps = clear
            </Text>
          </View>

          {/* Formato — opcional: um deck de casa pode não ter formato nenhum */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Format (optional)</Text>
            <View style={styles.formatGrid}>
              {FORMATS.map(f => (
                <Pressable
                  key={f}
                  onPress={() => chooseFormat(f)}
                  style={[styles.formatBtn, format === f && styles.formatBtnActive]}
                >
                  <Text style={[styles.formatBtnText, format === f && styles.formatBtnTextActive]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Arquétipo */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Archetype (optional)</Text>
            <View style={[styles.inputContainer, archetype.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={archetype}
                onChangeText={setArchetype}
                placeholder="e.g. Aggro, Control, Midrange"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Notas */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Sideboard plans, changes to try…"
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Lista de cartas */}
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Decklist</Text>
              <Text style={styles.fieldHint}>{cards} card{cards === 1 ? '' : 's'}</Text>
            </View>

            {(['main', 'side'] as DeckBoard[]).map(board => {
              const list = cardsForBoard(cardList, board);
              if (list.length === 0) return null;
              return (
                <View key={board} style={{ marginBottom: 10 }}>
                  <Text style={styles.boardLabel}>
                    {board === 'main' ? 'Main' : 'Sideboard'} · {cardCount(list)}
                  </Text>
                  {list.map(card => {
                    const key = cardKey(card);
                    return (
                      <View key={key} style={styles.cardRow}>
                        <Pressable
                          onPress={() =>
                            setCardList(current =>
                              setBoard(current, key, board === 'main' ? 'side' : 'main'),
                            )
                          }
                          hitSlop={6}
                          style={({ pressed }) => [styles.boardBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.boardBtnText}>{board === 'main' ? 'M' : 'S'}</Text>
                        </Pressable>

                        <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>

                        {/* +/− em vez de teclado: 60 cartas com o polegar tem de ser suportável */}
                        <Pressable
                          onPress={() => setCardList(current => changeQuantity(current, key, -1))}
                          hitSlop={6}
                          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Feather name="minus" size={14} color={colors.textSec} />
                        </Pressable>
                        <Text style={styles.quantity}>{card.quantity}</Text>
                        <Pressable
                          onPress={() => setCardList(current => changeQuantity(current, key, 1))}
                          hitSlop={6}
                          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Feather name="plus" size={14} color={colors.textSec} />
                        </Pressable>

                        <Pressable
                          onPress={() => setCardList(current => removeCard(current, key))}
                          hitSlop={6}
                          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Feather name="x" size={14} color={colors.textDim} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <Pressable
              onPress={() => setSearchOpen(true)}
              style={({ pressed }) => [styles.addCardBtn, pressed && { opacity: 0.75 }]}
            >
              <Feather name="plus" size={15} color={colors.gold} />
              <Text style={styles.addCardText}>Add card</Text>
            </Pressable>

            <Text style={styles.listNoticeText}>
              A deck works without a list — it still tracks its record across events.
            </Text>
          </View>

          {/* Apagar — só faz sentido num deck que já existe */}
          {isEdit && (
            <View style={styles.dangerZone}>
              {blockedBy !== null && (
                <View style={styles.notice}>
                  <Feather name="alert-circle" size={16} color={colors.gold} />
                  <Text style={styles.noticeText}>
                    {blockedBy === 1
                      ? '1 event uses this deck, so it cannot be deleted.'
                      : `${blockedBy} events use this deck, so it cannot be deleted.`}
                    {' '}Change the deck on those events first.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => setConfirmDelete(true)}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.75 }]}
              >
                <Feather name="trash-2" size={15} color={colors.loss} />
                <Text style={styles.deleteBtnText}>Delete deck</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CardSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={card => {
          setSearchOpen(false);
          // addCard junta quantidades quando a carta já lá está na mesma board — é o que impede
          // escrever duas entradas iguais, que o npm run validate chumba.
          setCardList(current => addCard(current, toDeckCard(card, 1, 'main')));
        }}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete deck"
        message={`Delete “${deck?.name ?? name}”? This cannot be undone.`}
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // NavBar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSec,
  },
  navTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.textPrim,
  },
  saveActive: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 62,
    alignItems: 'center',
  },
  saveActiveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.bg,
  },
  saveInactive: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 62,
    alignItems: 'center',
  },
  saveInactiveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.textDim,
  },

  // Content
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  field: {
    gap: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearBtn: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Inputs
  inputContainer: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputFilled: {
    borderColor: colors.gold + '66',
  },
  input: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.textPrim,
  },
  notesInput: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrim,
    lineHeight: 22,
    minHeight: 90,
  },

  // Selector de cores
  colorSelector: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  colorPip: {
    alignItems: 'center',
    gap: 6,
    width: 52,
    minHeight: 64,
    justifyContent: 'center',
  },
  colorLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 9,
    textAlign: 'center',
  },

  // Formato
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard,
  },
  formatBtnActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  formatBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSec,
  },
  formatBtnTextActive: {
    color: colors.gold,
    fontFamily: fonts.bodyMed,
  },

  // Aviso da lista de cartas
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  boardLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.goldDim,
    marginBottom: 6,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  boardBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardBtnText: { fontFamily: fonts.displayMed, fontSize: 11, color: colors.textSec },
  cardName: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrim },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontFamily: fonts.displayMed,
    fontSize: 14,
    color: colors.textPrim,
    minWidth: 20,
    textAlign: 'center',
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold + '66',
    marginTop: 4,
  },
  addCardText: { fontFamily: fonts.body, fontSize: 14, color: colors.gold },
  listNotice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 14,
  },
  listNoticeText: {
    flex: 1,
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 19,
  },

  // Apagar
  dangerZone: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    borderColor: colors.goldDim,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSec,
    lineHeight: 20,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lossBorder,
    backgroundColor: colors.lossBg,
  },
  deleteBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.loss,
  },
});

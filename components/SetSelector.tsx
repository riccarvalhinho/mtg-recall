// SetSelector — escolher o set de um torneio de Limited
// Estilo: design/handoff.md § 6.2 (campos) e § 2 (componentes partilhados)
// Usado em: Add Event (só quando o formato é Sealed ou Draft)
//
// A lista vem da Scryfall por `services/scryfall.ts`, que trata da cache e do offline. Este
// componente só desenha: nunca chama a rede directamente.
//
// O mesmo campo de procura serve de caminho de recurso — sem lista (primeira utilização sem rede),
// escrever "dft" mostra na mesma a opção de usar esse código, que é o que se fazia à mão antes.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, Modal, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { filterSets, isValidSetCode, type MtgSet } from '../domain/sets';
import { loadSets, type SetsSource } from '../services/scryfall';

interface SetSelectorProps {
  /** O código escolhido, ou `undefined` enquanto não houver nenhum. */
  value?: string;
  onChange: (code: string | undefined) => void;
}

export function SetSelector({ value, onChange }: SetSelectorProps) {
  const [open, setOpen]         = useState(false);
  const [sets, setSets]         = useState<MtgSet[]>([]);
  const [source, setSource]     = useState<SetsSource>('none');
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState('');

  // `mounted` existe porque o pedido pode chegar depois de o modal de Add Event fechar — actualizar
  // estado de um componente que já não existe é um aviso em runtime e mais nada de útil.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function fetchSets(force = false) {
    setLoading(true);
    const result = await loadSets({ force });
    if (!mounted.current) return;
    setSets(result.sets);
    setSource(result.source);
    setLoading(false);
  }

  // Vai buscar a lista assim que o campo aparece — quando o modal abrir, já cá está. Com cache
  // válida isto nem toca na rede.
  useEffect(() => {
    fetchSets();
  }, []);

  const results = useMemo(() => filterSets(sets, query), [sets, query]);

  /** O set escolhido, se estiver na lista — é o que permite mostrar o nome e não só o código. */
  const selected = useMemo(
    () => sets.find(set => set.code === value),
    [sets, value],
  );

  // "dft" escrito à mão vale como opção quando não é nenhum dos resultados. É o caminho de recurso.
  const typedCode = query.trim().toLowerCase();
  const showManual =
    isValidSetCode(typedCode) && !results.some(set => set.code === typedCode);

  function choose(code: string) {
    onChange(code);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange(undefined);
    setQuery('');
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>Set (optional)</Text>
        {value && (
          <Pressable onPress={clear} hitSlop={12}>
            <Text style={styles.clearLink}>Clear</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.inputContainer,
          styles.row,
          value ? styles.inputFilled : null,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen(true)}
      >
        {value ? (
          <View style={styles.row}>
            <Text style={styles.code}>{value.toUpperCase()}</Text>
            {selected && (
              <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.placeholder}>Choose set</Text>
        )}
        <Feather name="chevron-down" size={16} color={colors.textDim} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Set</Text>
            <View style={styles.sheetHeaderSpacer} />
          </View>

          {/* Procura — e, sem lista, a forma de escrever o código à mão */}
          <View style={styles.searchWrap}>
            <Feather name="search" size={15} color={colors.textDim} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search sets or type a code"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={14}>
                <Feather name="x" size={16} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          {/* Sem lista nenhuma: dizer porquê, em vez de mostrar uma lista vazia sem explicação */}
          {sets.length === 0 && !loading && (
            <View style={styles.notice}>
              <Feather name="wifi-off" size={14} color={colors.goldDim} />
              <Text style={styles.noticeText}>
                Set list unavailable offline. Type the code (e.g. dft) to use it anyway.
              </Text>
              <Pressable onPress={() => fetchSets(true)} hitSlop={10}>
                <Text style={styles.noticeLink}>Retry</Text>
              </Pressable>
            </View>
          )}

          {loading && sets.length === 0 && (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
          )}

          <FlatList
            data={results}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              showManual ? (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => choose(typedCode)}
                >
                  <Text style={styles.optionCode}>{typedCode.toUpperCase()}</Text>
                  <Text style={styles.optionName} numberOfLines={1}>Use this code</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              !loading && sets.length > 0 && !showManual ? (
                <Text style={styles.empty}>No sets match “{query.trim()}”.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  item.code === value && styles.optionActive,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => choose(item.code)}
              >
                <Text style={[styles.optionCode, item.code === value && styles.optionCodeActive]}>
                  {item.code.toUpperCase()}
                </Text>
                <Text style={styles.optionName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.optionYear}>{item.releasedAt.slice(0, 4)}</Text>
              </Pressable>
            )}
          />

          {/* Uma lista velha continua a servir — mas convém dizer que é velha */}
          {source === 'cache' && sets.length > 0 && (
            <Text style={styles.footerNote}>Offline copy of the set list.</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSec,
  },
  inputContainer: {
    backgroundColor: '#1A1510',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 52,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  inputFilled: {
    borderColor: colors.gold + '66',
  },
  pressed: {
    backgroundColor: colors.bgCardHov,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  code: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  selectedName: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSec,
    flexShrink: 1,
  },
  placeholder: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.textDim,
  },

  // ─── Modal ────────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    height: '72%',
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  sheetCancel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSec,
  },
  sheetHeaderSpacer: {
    width: 50,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1510',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrim,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 8,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSec,
    lineHeight: 18,
  },
  noticeLink: {
    fontFamily: fonts.bodyMed,
    fontSize: 13,
    color: colors.gold,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54, // alvo de toque grande: usa-se de pé, numa loja
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  optionActive: {
    borderColor: colors.gold + '88',
    backgroundColor: colors.gold + '14',
  },
  optionPressed: {
    backgroundColor: colors.bgCardHov,
  },
  optionCode: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.textSec,
    letterSpacing: 0.5,
    minWidth: 52,
  },
  optionCodeActive: {
    color: colors.gold,
  },
  optionName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textPrim,
  },
  optionYear: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  empty: {
    fontFamily: fonts.bodyItal,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 28,
  },
  footerNote: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
    paddingTop: 6,
  },
});

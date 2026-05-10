// Add Event Screen — modal
// Permite criar um novo evento com nome, formato, data e localização

import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { EventType } from '../types';
import { useEventsStore } from '../store/useEventsStore';

const FORMATS: EventType[] = ['Sealed', 'Draft', 'Standard', 'Modern', 'Pioneer', 'Commander', 'Legacy'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Formata Date para exibição: "9 Mai 2026"
function formatDisplay(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Converte Date para YYYY-MM-DD (formato Supabase)
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddEventScreen() {
  const [name, setName]           = useState('');
  const [format, setFormat]       = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker]     = useState(false);
  // iOS: data temporária enquanto o picker está aberto
  const [tempDate, setTempDate]   = useState<Date>(new Date());
  const [location, setLocation]   = useState('');
  const [saving, setSaving]       = useState(false);

  const createEvent = useEventsStore(s => s.createEvent);
  const canSave = name.trim().length > 0 && format !== null && !saving;

  // ─── Handlers do DatePicker ─────────────────────────────────────────────────

  function openPicker() {
    setTempDate(selectedDate);
    setShowPicker(true);
  }

  // Android: o picker é um dialog nativo — confirma imediatamente ao seleccionar
  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      setSelectedDate(date);
    }
  }

  // iOS: o picker aparece num modal com botão de confirmação
  function onIosChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setTempDate(date);
  }

  function confirmIosDate() {
    setSelectedDate(tempDate);
    setShowPicker(false);
  }

  // ─── Guardar ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canSave || !format) return;
    setSaving(true);

    const eventId = await createEvent({
      name:     name.trim(),
      type:     format,
      date:     toIsoDate(selectedDate),
      location: location.trim() || undefined,
    });

    setSaving(false);

    if (eventId) {
      router.replace(`/event/${eventId}`);
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* NavBar */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.navTitle}>New Event</Text>
          <Pressable onPress={handleSave} disabled={!canSave}>
            {name.trim().length > 0 && format !== null ? (
              <LinearGradient
                colors={[colors.gold, '#A07840']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveActive}
              >
                {saving
                  ? <ActivityIndicator size="small" color={colors.bg} />
                  : <Text style={styles.saveActiveText}>Create</Text>
                }
              </LinearGradient>
            ) : (
              <View style={styles.saveInactive}>
                <Text style={styles.saveInactiveText}>Create</Text>
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
            <Text style={styles.fieldLabel}>Event name *</Text>
            <View style={[styles.inputContainer, name.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. FNM Sealed — Aetherdrift"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Formato */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Format *</Text>
            <View style={styles.formatGrid}>
              {FORMATS.map(f => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  style={[styles.formatBtn, format === f && styles.formatBtnActive]}
                >
                  <Text style={[styles.formatBtnText, format === f && styles.formatBtnTextActive]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Data — Pressable que abre o picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date</Text>
            <Pressable
              style={[styles.inputContainer, styles.inputFilled, styles.dateRow]}
              onPress={openPicker}
            >
              <Text style={styles.input}>{formatDisplay(selectedDate)}</Text>
              <Feather name="calendar" size={16} color={colors.textDim} />
            </Pressable>
          </View>

          {/* Android: picker aparece directamente (é um dialog nativo) */}
          {Platform.OS === 'android' && showPicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onAndroidChange}
              maximumDate={new Date(2100, 0, 1)}
              minimumDate={new Date(2000, 0, 1)}
            />
          )}

          {/* Localização */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location (optional)</Text>
            <View style={[styles.inputContainer, location.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Town Hall, Lisbon"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS: picker num modal com confirmação */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Event date</Text>
              <Pressable onPress={confirmIosDate}>
                <Text style={styles.modalConfirm}>Confirm</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={onIosChange}
              maximumDate={new Date(2100, 0, 1)}
              minimumDate={new Date(2000, 0, 1)}
              locale="pt-PT"
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
    minWidth: 56,
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
  },
  saveInactiveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.textDim,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  field: {
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.textPrim,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 7,
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

  // Modal iOS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#1E1812',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  modalCancel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSec,
  },
  modalConfirm: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.gold,
  },
  iosPicker: {
    backgroundColor: '#1E1812',
  },
});

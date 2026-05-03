// Add Event Screen — modal básico
// Permite criar um novo evento com nome, formato, data e localização

import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { EventType } from '../types';

const FORMATS: EventType[] = ['Sealed', 'Draft', 'Standard', 'Modern', 'Pioneer', 'Commander', 'Legacy'];

export default function AddEventScreen() {
  const [name, setName]         = useState('');
  const [format, setFormat]     = useState<EventType | null>(null);
  const [date, setDate]         = useState('');
  const [location, setLocation] = useState('');

  const canSave = name.trim().length > 0 && format !== null;

  function handleSave() {
    if (!canSave) return;
    // TODO: persistir no Supabase via services/events.ts
    router.back();
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
            <Text style={styles.cancelBtn}>Cancelar</Text>
          </Pressable>
          <Text style={styles.navTitle}>Novo Evento</Text>
          <Pressable onPress={handleSave} disabled={!canSave}>
            {canSave ? (
              <LinearGradient
                colors={[colors.gold, '#A07840']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveActive}
              >
                <Text style={styles.saveActiveText}>Criar</Text>
              </LinearGradient>
            ) : (
              <View style={styles.saveInactive}>
                <Text style={styles.saveInactiveText}>Criar</Text>
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
            <Text style={styles.fieldLabel}>Nome do evento *</Text>
            <View style={[styles.inputContainer, name.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="ex: FNM Sealed — Aetherdrift"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Formato */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Formato *</Text>
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

          {/* Data */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Data</Text>
            <View style={[styles.inputContainer, date.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Localização */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Localização (opcional)</Text>
            <View style={[styles.inputContainer, location.length > 0 && styles.inputFilled]}>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="ex: Nave Espacial, Lisboa"
                placeholderTextColor={colors.textDim}
                returnKeyType="done"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});

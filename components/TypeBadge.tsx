// TypeBadge — badge de formato de torneio (Sealed / Draft / etc.)
// Spec: design/handoff.md § 2.2

import { View, Text, StyleSheet } from 'react-native';
import { EventType } from '../types';
import { fonts } from '../theme/typography';

interface TypeBadgeProps {
  type: EventType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const isSealed = type === 'Sealed';
  const isDraft  = type === 'Draft';

  return (
    <View style={[styles.badge, isSealed ? styles.sealed : isDraft ? styles.draft : styles.other]}>
      <Text style={[styles.text, isSealed ? styles.sealedText : isDraft ? styles.draftText : styles.otherText]}>
        {type.toLowerCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 1,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
  },
  // Sealed
  sealed: {
    backgroundColor: '#3A3020',
    borderColor: '#5A4A28',
  },
  sealedText: {
    color: '#A8967A',
  },
  // Draft
  draft: {
    backgroundColor: '#1E2830',
    borderColor: '#2A4050',
  },
  draftText: {
    color: '#8A9CA8',
  },
  // Outros formatos (Standard, Modern, etc.)
  other: {
    backgroundColor: '#201E2A',
    borderColor: '#3A3050',
  },
  otherText: {
    color: '#9A90A8',
  },
});

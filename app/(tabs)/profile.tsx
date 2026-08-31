// Settings Screen — token do GitHub, estado da sincronização e restauro
//
// É aqui que se liga a app ao repositório. Sem token, tudo funciona à mesma: os dados ficam
// guardados no telemóvel e a fila espera. Ver docs/adr/0004-escrita-via-github-api-com-outbox.md.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ConfirmModal } from '../../components/ConfirmModal';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { repo } from '../../services/config';
import { checkToken, readToken, writeToken } from '../../services/github';
import { currentState, flush, subscribe, tokenChanged, type SyncState } from '../../services/outbox';
import { useEventsStore } from '../../store/useEventsStore';

// ─── Estado da sincronização, em texto ───────────────────────────────────────

/** Quanto tempo o mais antigo está à espera, para o "waiting" não ser uma vaga promessa. */
function waitingFor(since: number | undefined): string {
  if (!since) return '';
  const minutes = Math.floor((Date.now() - since) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}

function statusLine(sync: SyncState): { icon: keyof typeof Feather.glyphMap; color: string; text: string } {
  if (sync.pending === 0) {
    // Sem token, uma fila vazia não quer dizer que está tudo guardado — quer dizer que nada foi
    // sequer tentado. Dizer o contrário seria mentir sobre onde os dados estão.
    return sync.hasToken
      ? { icon: 'check-circle', color: colors.win, text: 'Everything is saved to GitHub.' }
      : { icon: 'alert-circle', color: colors.textSec, text: 'No token yet — nothing is being sent to GitHub.' };
  }
  if (!sync.hasToken) {
    return {
      icon: 'alert-circle',
      color: colors.loss,
      text: `${sync.pending} file(s) waiting — add a token below to sync them.`,
    };
  }
  if (sync.lastError) {
    return { icon: 'alert-circle', color: colors.loss, text: sync.lastError };
  }
  return {
    icon: 'upload-cloud',
    color: colors.gold,
    text: `${sync.pending} file(s) waiting${sync.oldestQueuedAt ? ` — ${waitingFor(sync.oldestQueuedAt)}` : ''}.`,
  };
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  destructive,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.loss : colors.gold;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        destructive && styles.buttonDestructive,
        (disabled || busy) && styles.buttonDisabled,
        pressed && !disabled && !busy && { opacity: 0.7 },
      ]}
      onPress={onPress}
      disabled={disabled || busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Feather name={icon} size={15} color={disabled ? colors.textDim : tint} />
      )}
      <Text style={[styles.buttonText, { color: disabled ? colors.textDim : tint }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Écran ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [sync, setSync] = useState<SyncState>(currentState);
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [restoreModal, setRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const restoreFromGitHub = useEventsStore(s => s.restoreFromGitHub);
  const eventCount = useEventsStore(s => s.events.length);

  useEffect(() => subscribe(setSync), []);
  useEffect(() => {
    readToken().then(setSavedToken);
  }, []);

  const status = statusLine(sync);

  async function saveToken() {
    const value = token.trim();
    if (!value) return;

    setChecking(true);
    setTokenMessage(null);

    // Verificar antes de guardar: um token errado guardado em silêncio dava uma fila que nunca
    // esvazia e nenhuma pista do porquê.
    const result = await checkToken(value);
    if (result.ok) {
      await writeToken(value);
      await tokenChanged();
      setSavedToken(value);
      setToken('');
      setTokenMessage({ ok: true, text: 'Token saved. Syncing what is waiting.' });
    } else {
      setTokenMessage({ ok: false, text: result.reason });
    }
    setChecking(false);
  }

  async function removeToken() {
    await writeToken(undefined);
    await tokenChanged();
    setSavedToken(undefined);
    setTokenMessage({ ok: true, text: 'Token removed. Nothing is sent until a new one is added.' });
  }

  async function restore() {
    setRestoring(true);
    setRestoreMessage(null);
    const result = await restoreFromGitHub();
    setRestoreMessage(
      result.ok
        ? { ok: true, text: `Restored ${result.events} event(s) from GitHub.` }
        : { ok: false, text: result.reason },
    );
    setRestoring(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.archiveLabel}>Scholar's Archive</Text>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Sincronização */}
        <Section label="Sync">
          <View style={styles.statusRow}>
            <Feather name={status.icon} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
          <Text style={styles.hint}>
            Matches are saved on this phone first and pushed to GitHub when there is signal. Nothing
            is lost without a connection.
          </Text>
          <ActionButton
            label="Sync now"
            icon="refresh-cw"
            onPress={() => void flush()}
            disabled={sync.pending === 0 || !sync.hasToken}
            busy={sync.syncing}
          />
        </Section>

        {/* Token */}
        <Section label="GitHub token">
          {savedToken ? (
            <>
              <View style={styles.statusRow}>
                <Feather name="key" size={16} color={colors.gold} />
                <Text style={styles.tokenSet}>Token set · {savedToken.slice(0, 7)}…</Text>
              </View>
              <ActionButton label="Remove token" icon="trash-2" onPress={removeToken} destructive />
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                A fine-grained token, this repository only, with Contents: read and write. It is kept
                in the phone's secure storage and never leaves it except to api.github.com.
              </Text>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="github_pat_…"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <ActionButton
                label="Verify and save"
                icon="check"
                onPress={saveToken}
                disabled={token.trim().length === 0}
                busy={checking}
              />
            </>
          )}
          {tokenMessage && (
            <Text style={[styles.message, { color: tokenMessage.ok ? colors.win : colors.loss }]}>
              {tokenMessage.text}
            </Text>
          )}
        </Section>

        {/* Repositório */}
        <Section label="Repository">
          <Text style={styles.repoLine}>
            {repo.owner}/{repo.name}
          </Text>
          <Text style={styles.hint}>
            Branch {repo.branch} · {eventCount} event(s) on this phone
          </Text>
        </Section>

        {/* Restauro */}
        <Section label="Restore">
          <Text style={styles.hint}>
            Replaces everything on this phone with what is published on GitHub. For a new phone, or
            when something goes wrong.
          </Text>
          <ActionButton
            label="Restore from GitHub"
            icon="download-cloud"
            onPress={() => setRestoreModal(true)}
            busy={restoring}
            destructive
          />
          {restoreMessage && (
            <Text style={[styles.message, { color: restoreMessage.ok ? colors.win : colors.loss }]}>
              {restoreMessage.text}
            </Text>
          )}
        </Section>

        <Text style={styles.footer}>
          Data lives in {repo.owner}/{repo.name} as JSON files. The app is only a way to write them.
        </Text>
      </ScrollView>

      <ConfirmModal
        visible={restoreModal}
        title="Restore from GitHub"
        message={
          sync.pending > 0
            ? `${sync.pending} change(s) have not been pushed yet and will be lost. Restore anyway?`
            : 'This replaces everything stored on this phone with what is on GitHub. Continue?'
        }
        confirmLabel="Restore"
        confirmDestructive
        onConfirm={() => {
          setRestoreModal(false);
          void restore();
        }}
        onCancel={() => setRestoreModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.textPrim, lineHeight: 34 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },

  section: { gap: 8 },
  sectionLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    gap: 12,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontFamily: fonts.bodyMed, fontSize: 14, flex: 1, lineHeight: 19 },
  tokenSet: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.textPrim },

  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec, lineHeight: 19 },
  message: { fontFamily: fonts.bodyItal, fontSize: 13, lineHeight: 18 },
  repoLine: { fontFamily: fonts.displayMed, fontSize: 17, color: colors.textPrim },

  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrim,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderColor: colors.goldDim,
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 11,
  },
  buttonDestructive: { borderColor: colors.lossBorder },
  buttonDisabled: { borderColor: colors.border },
  buttonText: { fontFamily: fonts.bodyMed, fontSize: 14, letterSpacing: 0.3 },

  footer: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
    paddingTop: 4,
  },
});

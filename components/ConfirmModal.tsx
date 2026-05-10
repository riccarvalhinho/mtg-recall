// ConfirmModal — modal de confirmação com design da app
// Substitui Alert.alert() para manter consistência visual
//
// Uso:
//   <ConfirmModal
//     visible={showConfirm}
//     title="Apagar match"
//     message="Apagar o match contra João?"
//     confirmLabel="Apagar"
//     confirmDestructive
//     onConfirm={handleDelete}
//     onCancel={() => setShowConfirm(false)}
//   />

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface ConfirmModalProps {
  visible:             boolean;
  title:               string;
  message:             string;
  confirmLabel?:       string;   // default: "Confirmar"
  cancelLabel?:        string;   // default: "Cancelar"
  confirmDestructive?: boolean;  // true: botão vermelho
  onConfirm:           () => void;
  onCancel:            () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel       = 'Confirmar',
  cancelLabel        = 'Cancelar',
  confirmDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Overlay */}
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Card — stopPropagation para não fechar ao clicar no card */}
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          {/* Título */}
          <Text style={styles.title}>{title}</Text>

          {/* Mensagem */}
          <Text style={styles.message}>{message}</Text>

          {/* Botões */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={onCancel}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                confirmDestructive ? styles.destructiveBtn : styles.confirmBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={onConfirm}
            >
              <Text style={[
                styles.confirmLabel,
                confirmDestructive && styles.destructiveLabel,
              ]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#252019',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.textPrim,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.75,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '88',
  },
  destructiveBtn: {
    backgroundColor: colors.lossBg,
    borderColor: colors.lossBorder,
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
  destructiveLabel: {
    color: colors.loss,
  },
});

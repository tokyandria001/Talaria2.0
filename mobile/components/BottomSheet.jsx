import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

/** Feuille modale du design (poignée, titre, bouton ✕, fond sable de lune) */
export default function BottomSheet({ visible, title, onClose, children, footer, maxHeight = '88%' }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { maxHeight, paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Puce de sélection (catégories, distances...) */
export function Chip({ label, active, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive, disabled && { opacity: 0.4 }]}
      onPress={onPress} disabled={disabled} activeOpacity={0.8}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Libellé de section */
export const SheetLabel = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,8,22,0.35)' },
  sheet: {
    backgroundColor: Colors.sableLune,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d9cfd4', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 8 },
  title:  { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: Colors.parme, marginRight: 12 },
  close:  { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 22, paddingBottom: 8 },
  footer:  { paddingHorizontal: 22, paddingTop: 12 },

  chip: {
    borderWidth: 1, borderColor: '#d9cfd4', borderRadius: 100,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.white,
  },
  chipActive:     { backgroundColor: Colors.parme, borderColor: Colors.parme },
  chipText:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },

  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme, marginTop: 14, marginBottom: 10 },
});

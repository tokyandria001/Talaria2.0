import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import BottomSheet from '../../components/BottomSheet';
import { SettingsPage, Section, Row, SwitchRow, Chips, Label, settingsStyles as ss } from '../../components/settings/SettingsUI';
import { REIMBURSEMENT_TYPES } from '../../constants/Settings';
import { Colors } from '../../constants/Colors';

const typeOf = (v) => REIMBURSEMENT_TYPES.find(t => t.value === v) ?? REIMBURSEMENT_TYPES[0];
const describe = (m) => (m.type === 'virement'
  ? `IBAN se terminant par ${m.ibanLast4}${m.holder ? ` · ${m.holder}` : ''}`
  : m.handle);

/**
 * Moyens de remboursement (maquette 37) : comment les autres participants peuvent te rembourser.
 * Aucune donnée bancaire complète : pour un virement, seuls les 4 derniers chiffres de l'IBAN.
 */
export default function ReimbursementsScreen() {
  const { user, updateProfile } = useAuth();
  const r = user?.settings?.reimbursements ?? { methods: [], remindDebts: true, roundHalfEuro: false };
  const [sheet, setSheet] = useState(null); // moyen en cours d'ajout
  const [saving, setSaving] = useState(false);

  const saveMethods = async (methods) => {
    setSaving(true);
    try {
      await updateProfile({ settings: { reimbursements: { methods } } });
      return true;
    } catch (err) {
      Alert.alert('Remboursements', err.response?.data?.message || "Impossible d'enregistrer.");
      return false;
    } finally { setSaving(false); }
  };

  const add = async () => {
    const item = { type: sheet.type, isDefault: r.methods.length === 0 };
    if (sheet.type === 'virement') { item.ibanLast4 = sheet.value; item.holder = sheet.holder; } else item.handle = sheet.value;
    if (await saveMethods([...r.methods, item])) setSheet(null);
  };

  const manage = (m, index) => Alert.alert(typeOf(m.type).label, describe(m), [
    !m.isDefault && { text: 'Utiliser par défaut', onPress: () => saveMethods(r.methods.map((x, i) => ({ ...x, isDefault: i === index }))) },
    { text: 'Retirer', style: 'destructive', onPress: () => saveMethods(r.methods.filter((_, i) => i !== index)) },
    { text: 'Annuler', style: 'cancel' },
  ].filter(Boolean));

  const setReminder = (key, value) => updateProfile({ settings: { reimbursements: { [key]: value } } })
    .catch(() => Alert.alert('Remboursements', "Impossible d'enregistrer ce réglage."));

  const type = sheet ? typeOf(sheet.type) : null;

  return (
    <SettingsPage title="Remboursements">
      <Section title="Mes moyens">
        {r.methods.map((m, i) => (
          <Row key={i} icon={typeOf(m.type).icon} title={typeOf(m.type).label} subtitle={describe(m)}
            value={m.isDefault ? 'Par défaut' : null} onPress={() => manage(m, i)} />
        ))}
        {r.methods.length < 5 && (
          <Row icon="add" title="Ajouter un moyen" onPress={() => setSheet({ type: 'lydia', value: '', holder: '' })} />
        )}
      </Section>

      <Section title="Rappels">
        <SwitchRow title="Me rappeler les remboursements dus" subtitle="Notification 3 jours après une dépense — bientôt"
          value={r.remindDebts} onChange={(v) => setReminder('remindDebts', v)} />
        <SwitchRow title="Arrondir au demi-euro" value={r.roundHalfEuro} onChange={(v) => setReminder('roundHalfEuro', v)} />
      </Section>

      <View style={s.info}>
        <Ionicons name="shield-checkmark-outline" size={16} color={Colors.parme} />
        <Text style={s.infoText}>Talaria ne stocke aucune donnée bancaire complète : les paiements passent par le service choisi.</Text>
      </View>

      <BottomSheet visible={!!sheet} title="Ajouter un moyen" onClose={() => setSheet(null)} footer={(
        <TouchableOpacity style={[ss.primaryBtn, (saving || !sheet?.value?.trim()) && { opacity: 0.6 }]} onPress={add} disabled={saving || !sheet?.value?.trim()}>
          <Text style={ss.primaryText}>Ajouter</Text>
        </TouchableOpacity>
      )}>
        {sheet && (
          <>
            <Label style={{ marginTop: 4 }}>Service</Label>
            <Chips single options={REIMBURSEMENT_TYPES} selected={sheet.type} onChange={(v) => setSheet({ type: v, value: '', holder: '' })} />
            <Label>{type.field}</Label>
            <TextInput style={ss.input} placeholder={type.placeholder} placeholderTextColor="#b9aeb5" autoFocus
              keyboardType={sheet.type === 'paypal' ? 'email-address' : 'number-pad'} autoCapitalize="none"
              maxLength={sheet.type === 'virement' ? 4 : 120}
              value={sheet.value} onChangeText={(v) => setSheet(p => ({ ...p, value: v }))} />
            {sheet.type === 'virement' && (
              <>
                <Label>Titulaire du compte (facultatif)</Label>
                <TextInput style={ss.input} placeholder="Alec Froissard" placeholderTextColor="#b9aeb5"
                  value={sheet.holder} onChangeText={(v) => setSheet(p => ({ ...p, holder: v }))} />
                <Text style={ss.note}>L'IBAN complet n'est jamais enregistré : tu le communiques directement à la personne qui te rembourse.</Text>
              </>
            )}
          </>
        )}
      </BottomSheet>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  info: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#efe6e9', borderRadius: 14, padding: 14, marginTop: 18 },
  infoText: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, lineHeight: 17 },
});

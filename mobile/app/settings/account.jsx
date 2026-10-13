import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import BottomSheet from '../../components/BottomSheet';
import { comingSoon } from '../../components/AuthUI';
import { SettingsPage, Section, Row, Label, since, settingsStyles as ss } from '../../components/settings/SettingsUI';
import { Colors } from '../../constants/Colors';

/** Compte (maquette 29) : identifiants, comptes liés, export des données, suppression */
export default function AccountScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const savePhone = async () => {
    setBusy(true);
    try {
      await updateProfile({ phone: phone.trim() || null });
      setPhoneOpen(false);
    } catch (err) {
      Alert.alert('Téléphone', err.response?.data?.message || 'Numéro invalide.');
    } finally { setBusy(false); }
  };

  /** Export RGPD : le fichier JSON est partagé (mail, Drive, Fichiers...) */
  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await client.get('/api/profile/export');
      await Share.share({ title: 'Mes données Talaria', message: JSON.stringify(data, null, 2) });
    } catch {
      Alert.alert('Export', "Impossible de préparer l'export de tes données.");
    } finally { setExporting(false); }
  };

  const requestDeletion = async () => {
    setBusy(true);
    try {
      const { data } = await client.delete('/api/profile', { data: { password } });
      setDeleteOpen(false);
      Alert.alert('Suppression programmée', data.message, [{
        text: 'OK',
        onPress: async () => { await logout(); router.replace('/welcome'); },
      }]);
    } catch (err) {
      Alert.alert('Suppression', err.response?.data?.message || 'Mot de passe incorrect.');
    } finally { setBusy(false); }
  };

  const changed = since(user?.passwordChangedAt);

  return (
    <SettingsPage title="Compte">
      <Section title="Identifiants">
        <Row icon="mail-outline" title="E-mail" subtitle={user?.email} onPress={() => comingSoon("Le changement d'adresse e-mail")} />
        <Row icon="phone-portrait-outline" title="Téléphone" subtitle={user?.phone || 'Ajouter un numéro'}
          onPress={() => { setPhone(user?.phone ?? ''); setPhoneOpen(true); }} />
        <Row icon="key-outline" title="Mot de passe" subtitle={changed ? `Modifié ${changed}` : 'Modifier le mot de passe'}
          onPress={() => router.push('/settings/password')} />
      </Section>

      <Section title="Comptes liés">
        <Row icon="logo-google" title="Google" soon />
        <Row icon="logo-apple" title="Apple" soon />
      </Section>

      <Section title="Données">
        <Row icon="download-outline" title="Télécharger mes données" subtitle="Export RGPD au format JSON"
          onPress={exporting ? undefined : exportData}
          right={exporting ? <ActivityIndicator color={Colors.parme} /> : undefined} />
      </Section>

      <Section title="Zone sensible">
        <Row icon="trash-outline" title="Supprimer mon compte" subtitle="Action définitive après 30 jours" danger
          onPress={() => { setPassword(''); setDeleteOpen(true); }} />
      </Section>

      <BottomSheet visible={phoneOpen} title="Téléphone" onClose={() => setPhoneOpen(false)} footer={(
        <TouchableOpacity style={[ss.primaryBtn, busy && { opacity: 0.6 }]} onPress={savePhone} disabled={busy}>
          <Text style={ss.primaryText}>Enregistrer</Text>
        </TouchableOpacity>
      )}>
        <Label style={{ marginTop: 4 }}>Numéro de téléphone</Label>
        <TextInput style={ss.input} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" placeholderTextColor="#b9aeb5"
          value={phone} onChangeText={setPhone} autoFocus />
        <Text style={ss.note}>Visible seulement par toi. Il servira à la double authentification, bientôt disponible.</Text>
      </BottomSheet>

      <BottomSheet visible={deleteOpen} title="Supprimer mon compte" onClose={() => setDeleteOpen(false)} footer={(
        <TouchableOpacity style={[ss.primaryBtn, { backgroundColor: Colors.error }, (busy || !password) && { opacity: 0.6 }]}
          onPress={requestDeletion} disabled={busy || !password}>
          <Text style={ss.primaryText}>Supprimer dans 30 jours</Text>
        </TouchableOpacity>
      )}>
        <Text style={[ss.note, { fontSize: 13, color: Colors.text, marginTop: 0 }]}>
          Ton compte, tes voyages, tes articles et tes messages seront supprimés définitivement dans 30 jours.
          Te reconnecter d'ici là annule la suppression.
        </Text>
        <Label>Mot de passe</Label>
        <TextInput style={ss.input} secureTextEntry placeholder="••••••••" placeholderTextColor="#b9aeb5"
          value={password} onChangeText={setPassword} />
      </BottomSheet>
    </SettingsPage>
  );
}

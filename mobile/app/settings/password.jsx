import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import client, { saveTokens } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SettingsPage, Label, settingsStyles as ss } from '../../components/settings/SettingsUI';
import { Colors } from '../../constants/Colors';

const FIELDS = [
  { key: 'currentPassword', label: 'Mot de passe actuel' },
  { key: 'newPassword',     label: 'Nouveau mot de passe' },
  { key: 'confirm',         label: 'Confirmer le nouveau mot de passe' },
];

/** Changer de mot de passe (Paramètres › Compte) */
export default function PasswordScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  // Compte créé avec Google : pas encore de mot de passe, il en choisit un
  const hasPassword = user?.hasPassword !== false;
  const fields = hasPassword ? FIELDS : FIELDS.filter(f => f.key !== 'currentPassword');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if ((hasPassword && !form.currentPassword) || !form.newPassword) { setError('Remplis tous les champs.'); return; }
    if (form.newPassword.length < 8) { setError('Le nouveau mot de passe doit faire au moins 8 caractères.'); return; }
    if (form.newPassword !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setError('');
    setSaving(true);
    try {
      const { data } = await client.put('/api/profile/password', { currentPassword: hasPassword ? form.currentPassword : undefined, newPassword: form.newPassword });
      // Les autres appareils sont déconnectés ; celui-ci garde sa session avec le nouveau jeton
      await saveTokens(data);
      await refreshUser();
      Alert.alert(hasPassword ? 'Mot de passe modifié' : 'Mot de passe créé', hasPassword
        ? 'Ton nouveau mot de passe est enregistré. Tes autres appareils ont été déconnectés.'
        : 'Tu peux maintenant te connecter avec ton e-mail et ce mot de passe, en plus de Google.');
      router.back();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Impossible de modifier le mot de passe.');
    } finally { setSaving(false); }
  };

  return (
    <SettingsPage label="Compte" title={hasPassword ? 'Mot de passe' : 'Créer un mot de passe'} footer={(
      <TouchableOpacity style={[ss.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={ss.primaryText}>Enregistrer</Text>}
      </TouchableOpacity>
    )}>
      {!hasPassword && (
        <Text style={ss.note}>Ton compte utilise la connexion Google. Choisis un mot de passe pour pouvoir aussi te connecter avec ton e-mail.</Text>
      )}
      {fields.map(f => (
        <View key={f.key}>
          <Label>{f.label}</Label>
          <TextInput style={ss.input} secureTextEntry placeholder="••••••••" placeholderTextColor="#b9aeb5"
            value={form[f.key]} onChangeText={(v) => setForm(p => ({ ...p, [f.key]: v }))} />
        </View>
      ))}
      {error ? <Text style={{ fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.error, marginTop: 12 }}>{error}</Text> : null}
    </SettingsPage>
  );
}

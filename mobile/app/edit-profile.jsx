import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { SettingsPage, Section, SwitchRow, Chips, Label, settingsStyles as ss } from '../components/settings/SettingsUI';
import { ACTIVITY_TAGS } from '../constants/Preferences';
import { Colors } from '../constants/Colors';
import { GENDERS, genderPayload } from '../constants/Gender';

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,50}$/;
const INTERESTS = ACTIVITY_TAGS.map(t => ({ value: t.value, label: t.label.replace(/^\S+\s/, '') }));

/** Mon profil (maquette 27) : photo, nom affiché, pseudo, bio, centres d'intérêt, budget, mobilité */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name:     [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    username: user?.username ?? '',
    gender:   user?.gender ?? 'neutre',
    bio:      user?.bio ?? '',
    activityTags: user?.activityTags ?? [],
    averageBudget: user?.averageBudget != null ? String(user.averageBudget) : '',
    hasCar: !!user?.hasCar,
    hasDrivingLicense: !!user?.hasDrivingLicense,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const changePicture = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const data = new FormData();
    data.append('picture', { uri, name: `avatar.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    setUploading(true);
    try {
      await client.post('/api/profile/picture', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
    } catch (err) {
      Alert.alert('Photo', err.response?.data?.message || "Impossible d'envoyer la photo.");
    } finally { setUploading(false); }
  };

  const save = async () => {
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    const username = form.username.trim().replace(/^@/, '');
    if (!firstName) { setError('Indique ton nom pour que tes amis te reconnaissent.'); return; }
    if (!USERNAME_RE.test(username)) { setError('Le pseudo fait 3 à 50 caractères : lettres, chiffres, _ . ou -'); return; }
    setError('');
    setSaving(true);
    try {
      await updateProfile({
        firstName, lastName: rest.join(' '), username, gender: genderPayload(form.gender),
        bio: form.bio.trim() || null,
        activityTags: form.activityTags,
        averageBudget: form.averageBudget === '' ? null : parseInt(form.averageBudget, 10),
        hasCar: form.hasCar, hasDrivingLicense: form.hasDrivingLicense,
      });
      router.back();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Impossible d\'enregistrer le profil.');
    } finally { setSaving(false); }
  };

  return (
    <SettingsPage label="Modifier" title="Mon profil" footer={(
      <TouchableOpacity style={[ss.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={ss.primaryText}>Enregistrer</Text>}
      </TouchableOpacity>
    )}>
      <TouchableOpacity style={s.photo} onPress={changePicture} activeOpacity={0.85}>
        <View>
          <UserAvatar user={user} size={96} style={{ borderWidth: 3, borderColor: Colors.parme }} />
          <View style={s.camera}>
            {uploading ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="camera" size={14} color={Colors.white} />}
          </View>
        </View>
        <Text style={s.photoText}>Changer la photo</Text>
      </TouchableOpacity>

      <Label>Nom affiché</Label>
      <TextInput style={ss.input} placeholder="Alec Froissard" placeholderTextColor="#b9aeb5" value={form.name} onChangeText={set('name')} />

      <Label>Pseudo</Label>
      <TextInput style={ss.input} placeholder="@aleclamalice" placeholderTextColor="#b9aeb5" autoCapitalize="none"
        value={form.username ? `@${form.username.replace(/^@/, '')}` : ''} onChangeText={(v) => set('username')(v.replace(/^@/, ''))} />

      <Label>Comment s'adresser à toi ?</Label>
      <Chips single options={GENDERS} selected={form.gender} onChange={set('gender')} />
      <Text style={ss.note}>Pour accorder les textes de l'app. Jamais montré aux autres.</Text>

      <Label>Bio</Label>
      <TextInput style={[ss.input, s.bio]} multiline maxLength={500} placeholderTextColor="#b9aeb5"
        placeholder="Amoureux des road trips et des tacos. Toujours partant pour un week-end improvisé."
        value={form.bio} onChangeText={set('bio')} />

      <Label>Centres d'intérêt</Label>
      <Chips options={INTERESTS} selected={form.activityTags} onChange={set('activityTags')} />

      <Label>Budget personnel par voyage</Label>
      <TextInput style={ss.input} keyboardType="number-pad" placeholder="300 €" placeholderTextColor="#b9aeb5"
        value={form.averageBudget} onChangeText={(v) => set('averageBudget')(v.replace(/\D/g, ''))} />

      <Section title="Mobilité">
        <SwitchRow title="J'ai une voiture" subtitle="Proposée pour les trajets du groupe" value={form.hasCar} onChange={set('hasCar')} />
        <SwitchRow title="Permis de conduire" subtitle="Pour les locations de voiture" value={form.hasDrivingLicense} onChange={set('hasDrivingLicense')} />
      </Section>

      {error ? <Text style={s.error}>{error}</Text> : null}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  photo: { alignItems: 'center', marginTop: 4 },
  camera: {
    position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.parme, borderWidth: 2, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  photoText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, marginTop: 8 },
  bio: { borderRadius: 18, minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  error: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.error, marginTop: 14 },
});

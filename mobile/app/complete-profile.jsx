import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { AuthInput, AuthHeader } from '../components/AuthUI';
import { Chip, SheetLabel } from '../components/BottomSheet';
import UserAvatar from '../components/UserAvatar';
import { Colors } from '../constants/Colors';
import { ACTIVITY_TAGS, TRAVEL_STYLES, TRAVEL_PACES, skipKey } from '../constants/Preferences';

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,50}$/;

/**
 * Complétion du profil : après l'inscription (mode par défaut, bouton « Plus tard »)
 * ou depuis le Profil (?mode=edit).
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const isEdit = mode === 'edit';
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({
    firstName:    user?.firstName ?? '',
    lastName:     user?.lastName ?? '',
    username:     user?.username ?? '',
    activityTags: user?.activityTags ?? [],
    travelStyle:  user?.travelStyle ?? '',
    travelPace:   user?.travelPace ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const toggleTag = (v) => setForm(f => ({
    ...f,
    activityTags: f.activityTags.includes(v) ? f.activityTags.filter(t => t !== v) : [...f.activityTags, v],
  }));
  const pickOne = (k, v) => setForm(f => ({ ...f, [k]: f[k] === v ? '' : v }));

  const done = () => (isEdit ? router.back() : router.replace('/(tabs)/home'));

  const save = async () => {
    const username = form.username.trim().replace(/^@/, '');
    if (!form.firstName.trim())       { setError('Indique ton prénom pour que tes amis te reconnaissent.'); return; }
    if (!USERNAME_RE.test(username))  { setError('Le pseudo doit faire 3 à 50 caractères : lettres, chiffres, _ . ou -'); return; }
    setError('');
    setSaving(true);
    try {
      await updateProfile({
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        username,
        activityTags: form.activityTags,
        travelStyle:  form.travelStyle || null,
        travelPace:   form.travelPace || null,
      });
      done();
    } catch (err) {
      setError(err.response?.data?.message || "Impossible d'enregistrer ton profil.");
    } finally {
      setSaving(false);
    }
  };

  const later = async () => {
    try { await SecureStore.setItemAsync(skipKey(user?.id), '1'); } catch { /* sans gravité */ }
    done();
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {isEdit
            ? <AuthHeader title="Mon profil" onBack={() => router.back()} />
            : (
              <View style={s.intro}>
                <Text style={s.title}>Complète ton profil</Text>
                <Text style={s.subtitle}>
                  Pour que tes amis te reconnaissent, et que Talaria te propose des activités qui te ressemblent.
                </Text>
              </View>
            )}

          <View style={s.avatarRow}>
            <UserAvatar user={{ ...user, firstName: form.firstName, lastName: form.lastName, profilePicture: user?.profilePicture }} size={72} />
          </View>

          <View style={s.row}>
            <AuthInput label="Prénom" placeholder="Alice" value={form.firstName} onChangeText={set('firstName')}
              autoCapitalize="words" autoComplete="given-name" style={{ flex: 1 }} />
            <AuthInput label="Nom (optionnel)" placeholder="Durand" value={form.lastName} onChangeText={set('lastName')}
              autoCapitalize="words" autoComplete="family-name" style={{ flex: 1 }} />
          </View>
          <AuthInput label="Pseudo" placeholder="alice.voyage" value={form.username} onChangeText={set('username')} />
          <Text style={s.hint}>C'est grâce à lui que tes amis te trouveront dans Talaria.</Text>

          <SheetLabel>Tes centres d'intérêt</SheetLabel>
          <View style={s.chips}>
            {ACTIVITY_TAGS.map(t => (
              <Chip key={t.value} label={t.label} active={form.activityTags.includes(t.value)} onPress={() => toggleTag(t.value)} />
            ))}
          </View>
          <Text style={[s.hint, { marginTop: 8 }]}>Ils servent à remplir automatiquement le planning de tes voyages.</Text>

          <SheetLabel>Ton style de voyage</SheetLabel>
          <View style={s.chips}>
            {TRAVEL_STYLES.map(t => (
              <Chip key={t.value} label={t.label} active={form.travelStyle === t.value} onPress={() => pickOne('travelStyle', t.value)} />
            ))}
          </View>

          <SheetLabel>Ton rythme</SheetLabel>
          <View style={s.chips}>
            {TRAVEL_PACES.map(t => (
              <Chip key={t.value} label={t.label} active={form.travelPace === t.value} onPress={() => pickOne('travelPace', t.value)} />
            ))}
          </View>

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

          <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
            <Text style={s.btnText}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : "C'est parti !"}</Text>
          </TouchableOpacity>

          {!isEdit && (
            <TouchableOpacity onPress={later} style={s.later}>
              <Text style={s.laterText}>Plus tard</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  scroll: { paddingHorizontal: 22, paddingBottom: 32 },

  intro:    { marginTop: 24, marginBottom: 8 },
  title:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 28, color: Colors.parme },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 15, lineHeight: 21, color: Colors.textMuted, marginTop: 6 },

  avatarRow: { alignItems: 'center', marginVertical: 16 },
  row:   { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: -6, marginLeft: 12, marginBottom: 4 },

  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginTop: 18 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },
  later:     { alignItems: 'center', marginTop: 14 },
  laterText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme, textDecorationLine: 'underline' },
});

import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import UserAvatar from '../../components/UserAvatar';
import { Colors } from '../../constants/Colors';

const clean = (v) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** Rejoindre un groupe avec un code (ou via le lien talaria://groups/join?code=...) */
export default function JoinGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [code,    setCode]    = useState(clean(params.code));
  const [preview, setPreview] = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  const check = useCallback(async (value) => {
    setError(''); setPreview(null);
    if (value.length !== 8) return;
    setBusy(true);
    try { setPreview((await client.get(`/api/groups/join/${value}`)).data); }
    catch (err) { setError(err.response?.data?.message || 'Code invalide.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { check(code); }, [code, check]);

  const join = async () => {
    if (preview?.alreadyMember) { router.replace(`/groups/${preview.id}`); return; }
    setBusy(true);
    try {
      const { data } = await client.post(`/api/groups/join/${code}`);
      router.replace(`/groups/${data.id}`);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de rejoindre le groupe.');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <Text style={s.title}>Rejoindre un groupe</Text>
        <Text style={s.subtitle}>Saisis le code d'invitation à 8 caractères que ton ami t'a envoyé.</Text>

        <TextInput
          style={s.code} value={code} onChangeText={(v) => setCode(clean(v))}
          placeholder="ABCD2345" placeholderTextColor="#cfc4ca" autoCapitalize="characters" autoCorrect={false} maxLength={8} autoFocus={!code}
        />

        {busy && <ActivityIndicator color={Colors.parme} style={{ marginTop: 16 }} />}
        {!!error && <Text style={s.error}>{error}</Text>}

        {preview && (
          <View style={s.preview}>
            <Text style={s.groupName}>{preview.name}</Text>
            {preview.description ? <Text style={s.groupDesc}>{preview.description}</Text> : null}
            <View style={s.members}>
              {preview.membersPreview.map((u, i) => (
                <UserAvatar key={u.id} user={u} size={32} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: Colors.white }} />
              ))}
              <Text style={s.membersText}>{preview.membersCount} membre{preview.membersCount > 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={join} disabled={busy}>
              <Text style={s.btnText}>{preview.alreadyMember ? 'Ouvrir le groupe' : 'Rejoindre le groupe'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  back:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  body:   { paddingHorizontal: 24, paddingTop: 12 },

  title:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 26, color: Colors.parme },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, marginTop: 6 },
  code: {
    marginTop: 24, backgroundColor: Colors.white, borderRadius: 18, paddingVertical: 16, textAlign: 'center',
    fontFamily: 'BricolageGrotesque_700Bold', fontSize: 28, letterSpacing: 6, color: Colors.parme,
  },
  error: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error, textAlign: 'center', marginTop: 14 },

  preview:   { backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginTop: 22 },
  groupName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: Colors.text },
  groupDesc: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  members:   { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  membersText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text, marginLeft: 10 },
  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});

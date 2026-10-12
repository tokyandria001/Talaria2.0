import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Switch, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client, { assetUrl } from '../../api/client';
import GroupHero from '../../components/groups/GroupHero';
import FriendPickerSheet from '../../components/groups/FriendPickerSheet';
import UserAvatar from '../../components/UserAvatar';
import { Colors } from '../../constants/Colors';

/** Envoie la photo choisie (multipart) une fois le groupe créé ou modifié */
async function uploadPhoto(groupId, uri) {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const form = new FormData();
  form.append('photo', { uri, name: `groupe.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  await client.post(`/api/groups/${groupId}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
}

/** 12 · Nouveau groupe (ou modification avec ?id=) */
export default function GroupFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const isEdit = !!id;

  const [form, setForm] = useState({ name: '', description: '', isPrivate: true, sharedBudget: true });
  const [photo,       setPhoto]       = useState(null);  // chemin serveur actuel
  const [localPhoto,  setLocalPhoto]  = useState(null);  // nouvelle photo choisie
  const [members,     setMembers]     = useState([]);    // amis à inviter (création)
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    client.get(`/api/groups/${id}`)
      .then(({ data }) => {
        setForm({ name: data.name, description: data.description ?? '', isPrivate: data.isPrivate, sharedBudget: data.sharedBudget });
        setPhoto(data.photo);
      })
      .catch(() => { Alert.alert('Erreur', 'Groupe introuvable.'); router.back(); })
      .finally(() => setLoading(false));
  }, [id, isEdit, router]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setLocalPhoto(res.assets[0].uri);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Nom requis', 'Donnez un nom au groupe.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), description: form.description.trim() };
      const { data } = isEdit
        ? await client.patch(`/api/groups/${id}`, payload)
        : await client.post('/api/groups', { ...payload, memberIds: members.map(m => m.id) });

      if (localPhoto) {
        try { await uploadPhoto(data.id, localPhoto); }
        catch { Alert.alert('Photo non enregistrée', "Le groupe est enregistré, mais la photo n'a pas pu être envoyée."); }
      }

      if (isEdit) router.back();
      else router.replace(`/groups/${data.id}`);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'enregistrer le groupe.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  const shownPhoto = localPhoto ?? assetUrl(photo);

  return (
    <View style={s.root}>
      <GroupHero
        photo={photo}
        label={isEdit ? 'Modifier le groupe' : 'Créer un groupe'}
        title={isEdit ? form.name || 'Groupe' : 'Nouveau groupe'}
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.photoPicker} onPress={pickPhoto} activeOpacity={0.85}>
            {shownPhoto
              ? <Image source={{ uri: shownPhoto }} style={s.photo} />
              : <View style={s.photoEmpty}><Ionicons name="camera-outline" size={26} color={Colors.parme} /></View>}
          </TouchableOpacity>
          <Text style={s.photoLabel}>{shownPhoto ? 'Changer la photo' : 'Ajouter une photo'}</Text>

          <Text style={s.label}>Nom du groupe</Text>
          <TextInput style={s.input} placeholder="Monterrey 2026" placeholderTextColor="#b9aeb5"
            value={form.name} onChangeText={set('name')} maxLength={100} />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, s.textarea]} multiline maxLength={500} placeholderTextColor="#b9aeb5"
            placeholder="Le voyage de l'été : tacos, randonnée et plongée !"
            value={form.description} onChangeText={set('description')} />

          {!isEdit && (
            <>
              <Text style={s.label}>Membres</Text>
              <View style={s.members}>
                {members.map(m => (
                  <TouchableOpacity key={m.id} style={s.member} onPress={() => setMembers(ms => ms.filter(x => x.id !== m.id))}>
                    <UserAvatar user={m} size={48} />
                    <Text style={s.memberName} numberOfLines={1}>{m.firstName || m.displayName}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.member} onPress={() => setPickerOpen(true)}>
                  <View style={s.addMember}><Ionicons name="add" size={24} color={Colors.white} /></View>
                  <Text style={s.memberName}>Ajouter</Text>
                </TouchableOpacity>
              </View>
              {members.length > 0 && <Text style={s.hint}>Touchez un ami pour le retirer. Il recevra une invitation à accepter.</Text>}
            </>
          )}

          <ToggleRow title="Groupe privé" subtitle="Seul l'organisateur peut inviter et partager le lien"
            value={form.isPrivate} onChange={set('isPrivate')} />
          <ToggleRow title="Budget partagé" subtitle="Suivre les dépenses et les remboursements"
            value={form.sharedBudget} onChange={set('sharedBudget')} />

          <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
            {!isEdit && <Ionicons name="add" size={18} color={Colors.white} />}
            <Text style={s.btnText}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le groupe'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <FriendPickerSheet
        visible={pickerOpen}
        title="Ajouter des membres"
        confirmLabel="Valider"
        initial={members}
        onClose={() => setPickerOpen(false)}
        onConfirm={(users) => { setMembers(users); setPickerOpen(false); }}
      />
    </View>
  );
}

function ToggleRow({ title, subtitle, value, onChange }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  photoPicker: { alignSelf: 'center' },
  photo:       { width: 96, height: 96, borderRadius: 48 },
  photoEmpty: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#ece3e7',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#c9b2d7', alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 8 },

  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  textarea: { borderRadius: 18, minHeight: 80, textAlignVertical: 'top' },

  members:    { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  member:     { alignItems: 'center', width: 56 },
  memberName: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text, marginTop: 4 },
  addMember:  { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  hint:       { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8 },

  toggle:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  toggleTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  toggleSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 15, marginTop: 26,
  },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});

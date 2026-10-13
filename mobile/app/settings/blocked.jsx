import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import client from '../../api/client';
import UserAvatar from '../../components/UserAvatar';
import { SettingsPage, Section } from '../../components/settings/SettingsUI';
import { Colors } from '../../constants/Colors';

/** Utilisateurs bloqués : ils ne voient plus ton profil et ne peuvent plus t'ajouter */
export default function BlockedScreen() {
  const [list, setList] = useState(null);

  const load = useCallback(() => {
    client.get('/api/profile/blocked').then(({ data }) => setList(data)).catch(() => setList([]));
  }, []);
  useFocusEffect(load);

  const unblock = (u) => Alert.alert(`Débloquer ${u.displayName} ?`, 'Cette personne pourra de nouveau voir ton profil et t\'envoyer une demande d\'ami.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Débloquer', onPress: async () => {
      try { await client.delete(`/api/users/${u.id}/block`); load(); }
      catch { Alert.alert('Erreur', 'Impossible de débloquer cette personne.'); }
    } },
  ]);

  return (
    <SettingsPage label="Confidentialité" title="Utilisateurs bloqués">
      {list === null ? <ActivityIndicator color={Colors.parme} style={{ marginTop: 24 }} />
        : list.length === 0 ? <Text style={s.empty}>Tu n'as bloqué personne.</Text>
        : (
          <Section>
            {list.map(u => (
              <View key={u.id} style={s.row}>
                <UserAvatar user={u} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{u.displayName}</Text>
                  {u.username ? <Text style={s.sub}>@{u.username}</Text> : null}
                </View>
                <TouchableOpacity style={s.btn} onPress={() => unblock(u)}>
                  <Text style={s.btnText}>Débloquer</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Section>
        )}
      <Text style={s.hint}>Pour bloquer quelqu'un, ouvre son profil puis le menu « ⋯ ».</Text>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 28 },
  hint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 14, textAlign: 'center' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  name:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  sub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },
  btn:   { borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },
});

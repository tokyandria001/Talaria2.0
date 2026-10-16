import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import GroupHero from '../../../components/groups/GroupHero';
import FriendPickerSheet from '../../../components/groups/FriendPickerSheet';
import { shareInvite } from '../../../components/groups/shareInvite';
import UserAvatar from '../../../components/UserAvatar';
import { Colors } from '../../../constants/Colors';

const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });

/** 14 · Liste des participants */
export default function GroupMembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [group,  setGroup]  = useState(null);
  const [picker, setPicker] = useState(false);

  const load = useCallback(() => client.get(`/api/groups/${id}`)
    .then(({ data }) => setGroup(data))
    .catch(() => router.back()), [id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const invite = async (users) => {
    setPicker(false);
    if (!users.length) return;
    try { setGroup((await client.post(`/api/groups/${id}/members`, { userIds: users.map(u => u.id) })).data); }
    catch (err) { Alert.alert('Erreur', err.response?.data?.message || "Impossible d'inviter."); }
  };

  const manage = (m) => {
    const pending = m.status === 'invited';
    Alert.alert(m.user.displayName, pending ? "Annuler l'invitation ?" : 'Retirer ce membre du groupe ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: pending ? "Annuler l'invitation" : 'Retirer', style: 'destructive',
        onPress: async () => {
          try { setGroup((await client.delete(`/api/groups/${id}/members/${m.user.id}`)).data); }
          catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Action impossible.'); }
        },
      },
    ]);
  };

  if (!group) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  const activeCount = group.members.filter(m => m.status === 'active').length;
  const subtitle = (m) => {
    if (m.status === 'invited') return `Invitation envoyée le ${fmtDay(m.invitedAt)}`;
    return m.role === 'owner' ? 'Organisateur' : 'Membre';
  };

  return (
    <View style={s.root}>
      <GroupHero photo={group.photo} label={group.name} title="Participants" onBack={() => router.back()} />

      <FlatList
        data={group.members}
        keyExtractor={(m) => String(m.user.id)}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={(
          <View style={s.counter}>
            <Text style={s.counterText}>{activeCount} participant{activeCount > 1 ? 's' : ''}</Text>
            {group.members.length > activeCount && (
              <Text style={s.counterBadge}>{group.members.length - activeCount} en attente</Text>
            )}
          </View>
        )}
        renderItem={({ item: m }) => (
          <View style={s.row}>
            <UserAvatar user={m.user} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{m.user.displayName}{m.user.id === user?.id ? ' (vous)' : ''}</Text>
              <Text style={s.sub}>{subtitle(m)}</Text>
            </View>
            {m.status === 'invited' && <Text style={s.pending}>En attente</Text>}
            {group.permissions.canRemove && m.user.id !== user?.id && (
              <TouchableOpacity onPress={() => manage(m)} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListFooterComponent={group.permissions.canInvite ? (
          <View style={{ gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={s.primary} onPress={() => setPicker(true)}>
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={s.primaryText}>Inviter un participant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.outline} onPress={() => shareInvite(group)}>
              <Ionicons name="link-outline" size={16} color={Colors.parme} />
              <Text style={s.outlineText}>Partager le lien d'invitation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.note}>Groupe privé : seule la personne qui organise peut inviter de nouveaux participants.</Text>
        )}
      />

      <FriendPickerSheet visible={picker} excludeIds={group.members.map(m => m.user.id)} onClose={() => setPicker(false)} onConfirm={invite} />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },
  list:   { paddingHorizontal: 18, paddingTop: 14 },

  counter:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#efe6e9', borderRadius: 14, padding: 12, marginBottom: 6 },
  counterText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  counterBadge: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#efe6e9' },
  name: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  sub:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  pending: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  primary:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14 },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
  outline:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 13 },
  outlineText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  note: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 18 },
});

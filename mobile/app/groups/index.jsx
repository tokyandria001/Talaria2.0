import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client, { assetUrl } from '../../api/client';
import UserAvatar from '../../components/UserAvatar';
import { Colors } from '../../constants/Colors';

/** Mes groupes : invitations reçues + groupes dont je fais partie */
export default function GroupsScreen() {
  const router = useRouter();
  const [data,       setData]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => client.get('/api/groups')
    .then(({ data: d }) => setData(d))
    .catch(() => setData({ groups: [], invitations: [] }))
    .finally(() => setRefreshing(false)), []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (group, accept) => {
    try {
      await client.post(`/api/groups/${group.id}/${accept ? 'accept' : 'decline'}`);
      if (accept) router.push(`/groups/${group.id}`);
      load();
    } catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Action impossible.'); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Mes groupes</Text>
        <TouchableOpacity style={s.back} onPress={() => router.push('/groups/new')}>
          <Ionicons name="add" size={22} color={Colors.parme} />
        </TouchableOpacity>
      </View>

      {!data ? (
        <ActivityIndicator color={Colors.parme} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data.groups}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.parme} />}
          ListHeaderComponent={(
            <>
              {data.invitations.map(inv => (
                <View key={inv.id} style={s.invite}>
                  <Text style={s.inviteTitle}>{inv.invitedBy?.displayName ?? "Quelqu'un"} vous invite dans « {inv.name} »</Text>
                  <View style={s.inviteActions}>
                    <TouchableOpacity style={[s.smallBtn, s.smallOutline]} onPress={() => respond(inv, false)}>
                      <Text style={[s.smallText, { color: Colors.white }]}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.smallBtn} onPress={() => respond(inv, true)}>
                      <Text style={s.smallText}>Rejoindre</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.joinCode} onPress={() => router.push('/groups/join')}>
                <Ionicons name="key-outline" size={16} color={Colors.parme} />
                <Text style={s.joinCodeText}>Rejoindre avec un code</Text>
              </TouchableOpacity>
            </>
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Ionicons name="people-circle-outline" size={48} color={Colors.orchidee} />
              <Text style={s.emptyTitle}>Pas encore de groupe</Text>
              <Text style={s.emptyText}>Créez un groupe avec vos amis pour organiser vos voyages ensemble.</Text>
              <TouchableOpacity style={s.primary} onPress={() => router.push('/groups/new')}>
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={s.primaryText}>Créer un groupe</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item: g }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/groups/${g.id}`)} activeOpacity={0.85}>
              {g.photo
                ? <Image source={{ uri: assetUrl(g.photo) }} style={s.cover} />
                : <View style={[s.cover, s.coverEmpty]}><Text style={s.coverLetter}>{g.name[0]?.toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{g.name}</Text>
                <Text style={s.sub}>
                  {g.membersCount} membre{g.membersCount > 1 ? 's' : ''}{g.myRole === 'owner' ? ' · Vous organisez' : ''}
                </Text>
                <View style={s.avatars}>
                  {g.membersPreview.map((u, i) => (
                    <UserAvatar key={u.id} user={u} size={24} style={{ marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: Colors.white }} />
                  ))}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.parme} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  title:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 24, color: Colors.parme },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10, flexGrow: 1 },

  invite:        { backgroundColor: Colors.parme, borderRadius: 18, padding: 14, marginBottom: 10 },
  inviteTitle:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn:      { flex: 1, backgroundColor: Colors.white, borderRadius: 100, paddingVertical: 9, alignItems: 'center' },
  smallOutline:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.white },
  smallText:     { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  joinCode:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.parme, borderStyle: 'dashed', borderRadius: 100, paddingVertical: 11, marginBottom: 10 },
  joinCodeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  card:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 18, padding: 12 },
  cover: { width: 64, height: 64, borderRadius: 14 },
  coverEmpty:  { backgroundColor: Colors.orchidee, alignItems: 'center', justifyContent: 'center' },
  coverLetter: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 26, color: Colors.parme },
  name: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text },
  sub:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  avatars: { flexDirection: 'row', marginTop: 6 },

  empty:      { alignItems: 'center', paddingHorizontal: 30, paddingTop: 40 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 17, color: Colors.text, marginTop: 10 },
  emptyText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  primary:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 13, paddingHorizontal: 22, marginTop: 18 },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
});

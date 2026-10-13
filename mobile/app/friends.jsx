import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import UserAvatar from '../components/UserAvatar';
import { Colors } from '../constants/Colors';

const TABS = [
  { value: 'friends',  label: 'Amis' },
  { value: 'requests', label: 'Demandes' },
  { value: 'search',   label: 'Ajouter' },
];

const fmtSince = (iso) => iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : '';
const errorMessage = (err, fallback) => err.response?.data?.message || fallback;

/** Phase 7 — amis : liste, demandes reçues / envoyées, recherche d'utilisateurs */
export default function FriendsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [tab,        setTab]        = useState(['friends', 'requests', 'search'].includes(params.tab) ? params.tab : 'friends');
  const [friends,    setFriends]    = useState([]);
  const [requests,   setRequests]   = useState({ received: [], sent: [] });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([client.get('/api/friends'), client.get('/api/friends/requests')]);
      setFriends(f.data);
      setRequests(r.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger vos amis.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (request, okMessage) => {
    try {
      await request();
      if (okMessage) Alert.alert(okMessage);
      load();
    } catch (err) {
      Alert.alert('Erreur', errorMessage(err, 'Action impossible.'));
    }
  };

  const removeFriend = (f) => Alert.alert('Retirer cet ami ?', f.user.displayName, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: () => act(() => client.delete(`/api/friends/${f.user.id}`)) },
  ]);

  const pending = requests.received.length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Mes amis</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.value} style={[s.tab, tab === t.value && s.tabActive]} onPress={() => setTab(t.value)}>
            <Text style={[s.tabText, tab === t.value && s.tabTextActive]}>
              {t.label}{t.value === 'friends' && friends.length ? ` (${friends.length})` : ''}
            </Text>
            {t.value === 'requests' && pending > 0 && <View style={s.badge}><Text style={s.badgeText}>{pending}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.parme} style={{ marginTop: 40 }} />
      ) : tab === 'search' ? (
        <SearchTab onChanged={load} />
      ) : (
        <FlatList
          data={tab === 'friends' ? friends : [...requests.received.map(r => ({ ...r, kind: 'received' })), ...requests.sent.map(r => ({ ...r, kind: 'sent' }))]}
          keyExtractor={(item) => `${item.kind ?? 'friend'}-${item.friendshipId ?? item.id}`}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.parme} />}
          ListEmptyComponent={(
            <Empty
              icon={tab === 'friends' ? 'people-outline' : 'mail-open-outline'}
              text={tab === 'friends' ? 'Pas encore d\'amis. Retrouvez vos compagnons de voyage dans l\'onglet « Ajouter ».' : 'Aucune demande en attente.'}
              action={tab === 'friends' ? { label: 'Ajouter des amis', onPress: () => setTab('search') } : null}
            />
          )}
          renderItem={({ item }) => tab === 'friends' ? (
            <UserRow user={item.user} subtitle={item.since ? `Amis depuis ${fmtSince(item.since)}` : null}>
              <TouchableOpacity onPress={() => removeFriend(item)} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </UserRow>
          ) : item.kind === 'received' ? (
            <UserRow user={item.user} subtitle="Vous a envoyé une demande">
              <TouchableOpacity style={[s.roundBtn, s.roundBtnPrimary]}
                onPress={() => act(() => client.post(`/api/friends/requests/${item.id}/accept`), `Vous êtes maintenant ami avec ${item.user.displayName}.`)}>
                <Ionicons name="checkmark" size={18} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={s.roundBtn} onPress={() => act(() => client.post(`/api/friends/requests/${item.id}/decline`))}>
                <Ionicons name="close" size={18} color={Colors.parme} />
              </TouchableOpacity>
            </UserRow>
          ) : (
            <UserRow user={item.user} subtitle="Demande envoyée">
              <TouchableOpacity style={s.pillBtn} onPress={() => act(() => client.delete(`/api/friends/requests/${item.id}`))}>
                <Text style={s.pillBtnText}>Annuler</Text>
              </TouchableOpacity>
            </UserRow>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Recherche d'utilisateurs ─────────────── */
function SearchTab({ onChanged }) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState([]);
  const [busy,    setBusy]    = useState(false);

  const search = useCallback(async (query) => {
    if (query.trim().length < 2) { setResults([]); return; }
    setBusy(true);
    try {
      const { data } = await client.get('/api/users/search', { params: { q: query.trim() } });
      setResults(data);
    } catch { setResults([]); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => search(q), 300);
    return () => clearTimeout(id);
  }, [q, search]);

  const run = async (request) => {
    try {
      await request();
      await search(q);
      onChanged();
    } catch (err) {
      Alert.alert('Erreur', errorMessage(err, 'Action impossible.'));
    }
  };

  const actionFor = (u) => {
    switch (u.relation) {
      case 'friends':
        return <View style={s.statusTag}><Ionicons name="checkmark" size={14} color={Colors.parme} /><Text style={s.statusText}>Amis</Text></View>;
      case 'request_sent':
        return (
          <TouchableOpacity style={s.pillBtn} onPress={() => run(() => client.delete(`/api/friends/requests/${u.requestId}`))}>
            <Text style={s.pillBtnText}>Envoyée · Annuler</Text>
          </TouchableOpacity>
        );
      case 'request_received':
        return (
          <TouchableOpacity style={[s.pillBtn, s.pillBtnPrimary]} onPress={() => run(() => client.post(`/api/friends/requests/${u.requestId}/accept`))}>
            <Text style={[s.pillBtnText, { color: Colors.white }]}>Accepter</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity style={[s.pillBtn, s.pillBtnPrimary]} onPress={() => run(() => client.post('/api/friends/requests', { userId: u.id }))}>
            <Ionicons name="person-add-outline" size={14} color={Colors.white} />
            <Text style={[s.pillBtnText, { color: Colors.white }]}>Ajouter</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput} value={q} onChangeText={setQ} autoFocus autoCapitalize="none"
          placeholder="Pseudo, nom ou email exact" placeholderTextColor="#b9aeb5"
        />
        {busy && <ActivityIndicator size="small" color={Colors.parme} />}
      </View>
      <FlatList
        data={results}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={q.trim().length >= 2 && !busy
          ? <Empty icon="search-outline" text="Aucun voyageur trouvé. Essayez son pseudo, son nom ou son adresse email exacte." />
          : <Empty icon="person-add-outline" text="Recherchez vos amis par pseudo, nom ou adresse email exacte." />}
        renderItem={({ item }) => (
          <UserRow user={item} subtitle={item.username ? `@${item.username}` : null}>{actionFor(item)}</UserRow>
        )}
      />
    </View>
  );
}

/* ── Éléments communs ─────────────────────── */
function UserRow({ user, subtitle, children }) {
  const router = useRouter();
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.rowMain} onPress={() => router.push(`/users/${user.id}`)} activeOpacity={0.7}>
        <UserAvatar user={user} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{user.displayName}</Text>
          {subtitle ? <Text style={s.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
      <View style={s.actions}>{children}</View>
    </View>
  );
}

function Empty({ icon, text, action }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={Colors.orchidee} />
      <Text style={s.emptyText}>{text}</Text>
      {action && (
        <TouchableOpacity style={[s.pillBtn, s.pillBtnPrimary, { marginTop: 14 }]} onPress={action.onPress}>
          <Text style={[s.pillBtnText, { color: Colors.white }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  root: { flex: 1, backgroundColor: Colors.sableLune },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  title:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 24, color: Colors.parme },

  tabs: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 10, backgroundColor: 'rgba(79,32,63,0.08)', borderRadius: 100, padding: 3 },
  tab:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 100 },
  tabActive:     { backgroundColor: Colors.parme },
  tabText:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  tabTextActive: { color: Colors.white },
  badge:     { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e5484d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 10, color: Colors.white },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 16, padding: 12,
  },
  name:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  sub:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  roundBtn:        { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  roundBtnPrimary: { backgroundColor: Colors.parme },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12,
  },
  pillBtnPrimary: { backgroundColor: Colors.parme },
  pillBtnText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },
  statusTag:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, padding: 0 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 20 },
});

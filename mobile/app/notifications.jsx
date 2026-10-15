import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { Colors } from '../constants/Colors';
import { TYPE_ICON, TYPE_COLOR } from '../constants/Notifications';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}


export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await client.get('/api/notifications');
      setNotifs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markAllRead = async () => {
    await client.post('/api/notifications/read-all');
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id) => {
    await client.post(`/api/notifications/${id}/read`);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const unread = notifs.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.readAllBtn}>
            <Text style={s.readAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.parme} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-outline" size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>Aucune notification</Text>
          <Text style={s.emptySub}>Vous serez notifié quand quelqu'un like ou commente vos articles.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={n => String(n.id)}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.item, !item.isRead && s.itemUnread]}
              activeOpacity={0.8}
              onPress={() => {
                markRead(item.id);
                if (item.type?.startsWith('friend_')) router.push('/friends');
                else if (item.trip) router.push(`/trip/${item.trip.id}`);
                else if (item.group) router.push(`/groups/${item.group.id}`);
              }}
            >
              <View style={[s.iconWrap, { backgroundColor: (TYPE_COLOR[item.type] ?? Colors.parme) + '20' }]}>
                <Ionicons
                  name={TYPE_ICON[item.type] ?? 'notifications'}
                  size={20}
                  color={TYPE_COLOR[item.type] ?? Colors.parme}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.msg, !item.isRead && s.msgBold]}>{item.message}</Text>
                <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.isRead && <View style={s.dot} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: Colors.text, flex: 1 },
  readAllBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  readAllText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  itemUnread: { backgroundColor: '#fdf4ff' },

  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  msg:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text, lineHeight: 18 },
  msgBold: { fontFamily: 'BricolageGrotesque_600SemiBold' },
  time:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.parme },
});

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../BottomSheet';
import UserAvatar from '../UserAvatar';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';

/**
 * Choix d'amis à inviter dans un groupe.
 * `excludeIds` : utilisateurs déjà membres ou invités ; `onConfirm(users)` reçoit les amis choisis.
 */
export default function FriendPickerSheet({ visible, title = 'Inviter des amis', excludeIds = [], initial = [], confirmLabel = 'Inviter', onConfirm, onClose }) {
  const router = useRouter();
  const [friends,  setFriends]  = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setSelected(initial.map(u => u.id));
    client.get('/api/friends')
      .then(({ data }) => setFriends(data.map(f => f.user)))
      .catch(() => setFriends([]));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = (friends ?? []).filter(f => !excludeIds.includes(f.id));
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={available.length > 0 && (
        <TouchableOpacity
          style={[s.btn, !selected.length && !initial.length && { opacity: 0.5 }]}
          disabled={!selected.length && !initial.length}
          onPress={() => onConfirm(available.filter(f => selected.includes(f.id)))}
        >
          <Text style={s.btnText}>{confirmLabel}{selected.length ? ` (${selected.length})` : ''}</Text>
        </TouchableOpacity>
      )}
    >
      {friends === null ? (
        <ActivityIndicator color={Colors.parme} style={{ marginVertical: 24 }} />
      ) : available.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={36} color={Colors.orchidee} />
          <Text style={s.emptyText}>
            {friends.length ? 'Tous vos amis font déjà partie du groupe.' : 'Ajoutez d\'abord des amis pour pouvoir les inviter.'}
          </Text>
          <TouchableOpacity style={s.link} onPress={() => { onClose(); router.push('/friends'); }}>
            <Text style={s.linkText}>Gérer mes amis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {available.map(f => {
            const on = selected.includes(f.id);
            return (
              <TouchableOpacity key={f.id} style={s.row} onPress={() => toggle(f.id)} activeOpacity={0.85}>
                <UserAvatar user={f} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{f.displayName}</Text>
                  {f.username ? <Text style={s.sub}>@{f.username}</Text> : null}
                </View>
                <View style={[s.check, on && s.checkOn]}>
                  {on && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 10 },
  name: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  sub:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  check:   { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#d9cfd4', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.parme, borderColor: Colors.parme },

  empty:     { alignItems: 'center', paddingVertical: 20, gap: 10 },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  link:      { paddingVertical: 6 },
  linkText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme, textDecorationLine: 'underline' },

  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});

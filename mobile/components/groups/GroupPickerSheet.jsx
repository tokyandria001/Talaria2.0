import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../BottomSheet';
import client, { assetUrl } from '../../api/client';
import { Colors } from '../../constants/Colors';

/** Choix d'un de mes groupes (membre actif) : ses membres deviennent les participants du voyage */
export default function GroupPickerSheet({ visible, selectedId, onPick, onClose }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    if (!visible) return;
    client.get('/api/groups')
      .then(({ data }) => setGroups((data.groups ?? []).filter(g => g.myStatus === 'active')))
      .catch(() => setGroups([]));
  }, [visible]);

  return (
    <BottomSheet visible={visible} title="Choisir un groupe" onClose={onClose}>
      {groups === null ? (
        <ActivityIndicator color={Colors.parme} style={{ marginVertical: 20 }} />
      ) : groups.length === 0 ? (
        <Text style={s.empty}>Vous n'avez pas encore de groupe. Ajoutez des amis : un groupe sera créé pour ce voyage.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {groups.map(g => (
            <TouchableOpacity key={g.id} style={[s.row, selectedId === g.id && s.rowActive]} onPress={() => onPick(g)} activeOpacity={0.85}>
              {g.photo
                ? <Image source={{ uri: assetUrl(g.photo) }} style={s.photo} />
                : <View style={[s.photo, s.photoEmpty]}><Ionicons name="people" size={20} color={Colors.parme} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{g.name}</Text>
                <Text style={s.sub}>{g.membersCount} membre{g.membersCount > 1 ? 's' : ''}</Text>
              </View>
              <Ionicons name={selectedId === g.id ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={Colors.parme} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, marginVertical: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  rowActive:  { borderColor: Colors.parme },
  photo:      { width: 44, height: 44, borderRadius: 22 },
  photoEmpty: { backgroundColor: Colors.parmeLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  sub:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 1 },
});

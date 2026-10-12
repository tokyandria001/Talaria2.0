import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { comingSoon } from './AuthUI';
import { Colors } from '../constants/Colors';

const ACTIONS = [
  { key: 'trip',    icon: 'airplane-outline', title: 'Créer un voyage',  sub: 'Destination, dates, budget, transport',      href: '/new-trip' },
  { key: 'place',   icon: 'location-outline', title: 'Ajouter un lieu',  sub: 'Un resto, un bar, une activité à partager',  href: { pathname: '/(tabs)/discover', params: { view: 'map', action: 'add-place' } } },
  { key: 'article', icon: 'create-outline',   title: 'Écrire un article', sub: 'Partager un itinéraire ou un bon plan',      href: { pathname: '/(tabs)/discover', params: { view: 'community', action: 'write' } } },
  { key: 'group',   icon: 'people-outline',   title: 'Créer un groupe',  sub: 'Organiser un voyage avec vos amis',          href: '/groups/new' },
];

/** Menu du bouton central « + Nouveau » de la barre d'onglets */
export default function CreateMenu({ visible, onClose }) {
  const router = useRouter();

  const choose = (a) => {
    onClose();
    if (a.soon) { comingSoon(a.soon); return; }
    router.navigate(a.href);
  };

  return (
    <BottomSheet visible={visible} title="Nouveau" onClose={onClose}>
      <View style={s.list}>
        {ACTIONS.map(a => (
          <TouchableOpacity key={a.key} style={s.row} onPress={() => choose(a)} activeOpacity={0.85}>
            <View style={s.icon}><Ionicons name={a.icon} size={20} color={Colors.parme} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{a.title}</Text>
              <Text style={s.sub}>{a.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.parme} />
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  list: { gap: 10, paddingTop: 4, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 14,
  },
  icon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79,32,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  sub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});

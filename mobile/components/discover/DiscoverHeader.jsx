import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';

const VIEWS = [
  { value: 'map',       label: 'Carte' },
  { value: 'community', label: 'Communauté' },
];

/** En-tête de l'onglet Découvrir : sélecteur Carte / Communauté (à la place du titre) et avatar */
export default function DiscoverHeader({ view, onChangeView, style }) {
  const router   = useRouter();
  const { user } = useAuth();

  const picture  = user?.profilePicture;
  const avatar   = picture?.startsWith('/') ? `${client.defaults.baseURL}${picture}` : picture;
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || user?.email?.[0] || '?').toUpperCase();

  return (
    <View style={[s.row, style]}>
      <View style={s.switch}>
        {VIEWS.map(v => (
          <TouchableOpacity key={v.value} style={[s.switchItem, view === v.value && s.switchItemActive]}
            onPress={() => onChangeView(v.value)} activeOpacity={0.85}>
            <Text style={[s.switchText, view === v.value && s.switchTextActive]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
        {avatar
          ? <Image source={{ uri: avatar }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.initials}>{initials}</Text></View>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },

  switch: { flexDirection: 'row', backgroundColor: 'rgba(79,32,63,0.08)', borderRadius: 100, padding: 3 },
  switchItem:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100 },
  switchItemActive: { backgroundColor: Colors.parme },
  switchText:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  switchTextActive: { color: Colors.white },

  avatar:      { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: Colors.white },
  avatarEmpty: { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  initials:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});

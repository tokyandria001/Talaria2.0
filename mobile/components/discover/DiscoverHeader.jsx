import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { assetUrl } from '../../api/client';
import TalariaLogo from '../TalariaLogo';
import { Colors } from '../../constants/Colors';

const TITLES = { map: 'La Carte', community: 'Communauté' };

/**
 * En-tête de l'onglet Découvrir (maquette 4) : titre, logo au centre, avatar.
 * Le titre bascule entre la carte et la communauté.
 */
export default function DiscoverHeader({ view, onChangeView, style }) {
  const router   = useRouter();
  const { user } = useAuth();

  const avatar   = assetUrl(user?.profilePicture);
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || user?.email?.[0] || '?').toUpperCase();
  const other    = view === 'map' ? 'community' : 'map';

  return (
    <View style={[s.row, style]}>
      <TouchableOpacity style={s.side} onPress={() => onChangeView(other)} activeOpacity={0.8}
        accessibilityRole="button" accessibilityLabel={`${TITLES[view]}, afficher ${TITLES[other]}`}>
        <Text style={s.title}>{TITLES[view]}</Text>
        <Ionicons name="swap-horizontal" size={15} color={Colors.parme} />
      </TouchableOpacity>

      <TalariaLogo height={30} />

      <View style={[s.side, s.right]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
          {avatar
            ? <Image source={{ uri: avatar }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.initials}>{initials}</Text></View>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  side:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  right: { justifyContent: 'flex-end' },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.parme },

  avatar:      { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.parme },
  avatarEmpty: { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  initials:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});

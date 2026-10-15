import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { assetUrl } from '../../api/client';
import TalariaLogo from '../TalariaLogo';
import { Colors } from '../../constants/Colors';

const TITLES = { map: 'Carte', community: 'Communauté' };

/**
 * En-tête de l'onglet Découvrir (maquette 4) : bouton vers l'autre vue, logo au centre, avatar.
 * Sur la carte le bouton mène à la communauté, sur la communauté à la carte.
 */
export default function DiscoverHeader({ view, onChangeView, style }) {
  const router   = useRouter();
  const { user } = useAuth();

  const avatar   = assetUrl(user?.profilePicture);
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || user?.email?.[0] || '?').toUpperCase();
  const other    = view === 'map' ? 'community' : 'map';

  return (
    <View style={[s.row, style]}>
      <View style={s.side}>
        <TouchableOpacity style={s.switch} onPress={() => onChangeView(other)} activeOpacity={0.85}
          accessibilityRole="button" accessibilityLabel={`Afficher ${TITLES[other]}`}>
          <Text style={s.switchText} numberOfLines={1}>{TITLES[other]}</Text>
        </TouchableOpacity>
      </View>

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
  switch:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12 },
  switchText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },

  avatar:      { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.parme },
  avatarEmpty: { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  initials:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});

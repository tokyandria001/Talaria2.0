import { View, Text, Image, StyleSheet } from 'react-native';
import client from '../api/client';
import { Colors } from '../constants/Colors';

/** Avatar d'un utilisateur : photo de profil, sinon initiales sur fond parme */
export default function UserAvatar({ user, size = 40, style }) {
  const picture = user?.profilePicture;
  const uri = picture?.startsWith('/') ? `${client.defaults.baseURL}${picture}` : picture;
  const initials = (
    ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')) ||
    user?.username?.[0] || user?.displayName?.[0] || user?.email?.[0] || '?'
  ).toUpperCase();

  const box = { width: size, height: size, borderRadius: size / 2 };
  return uri
    ? <Image source={{ uri }} style={[box, style]} />
    : (
      <View style={[box, s.empty, style]}>
        <Text style={[s.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
    );
}

const s = StyleSheet.create({
  empty:    { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.white },
});

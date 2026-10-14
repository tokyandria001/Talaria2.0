import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { assetUrl } from '../../api/client';
import { Colors } from '../../constants/Colors';

const DEFAULT_COVER = require('../../assets/auth/welcome-2.jpg');

/** En-tête des écrans de groupe (maquette) : photo atténuée, retour, étiquette, titre */
export default function GroupHero({ photo, label, title, onBack, right }) {
  const insets = useSafeAreaInsets();
  const source = photo ? { uri: assetUrl(photo) } : DEFAULT_COVER;

  return (
    <View style={[s.hero, { paddingTop: insets.top + 8 }]}>
      <Image source={source} style={s.cover} resizeMode="cover" />
      <View style={s.veil} />
      <View style={s.row}>
        <TouchableOpacity style={s.back} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        {label ? <Text style={s.label}>{label}</Text> : <View />}
        <View style={s.right}>{right}</View>
      </View>
      <Text style={s.title} numberOfLines={2}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero:  { paddingHorizontal: 18, paddingBottom: 18, overflow: 'hidden' },
  // Ancrée aux 4 bords, sans largeur en % (qui la décalait de la marge du bandeau)
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: undefined, height: undefined },
  veil:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,249,241,0.55)' },
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back:  { width: 44, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden',
  },
  right: { width: 44, alignItems: 'flex-end' },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 28, color: Colors.parme, textAlign: 'center', marginTop: 10 },
});

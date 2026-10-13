import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

/**
 * À la place de la carte quand l'app ne contient pas MapLibre (Expo Go, ancien build) :
 * le reste de l'app reste utilisable.
 */
export default function MapUnavailable({ header }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {header}
      <View style={s.box}>
        <Ionicons name="map-outline" size={44} color={Colors.orchidee} />
        <Text style={s.title}>Carte indisponible dans cette version</Text>
        <Text style={s.text}>
          La carte utilise MapLibre, qui n'est pas inclus dans Expo Go. Ouvre l'app avec l'app de développement
          Talaria (build EAS « development ») ou installe la dernière version de test.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.sableLune },
  box:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: Colors.parme, textAlign: 'center' },
  text:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
});

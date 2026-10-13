import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { MapPanel } from '../../components/discover/mapSupport';
import { Colors } from '../../constants/Colors';

const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Ajouter une activité depuis la carte : la carte s'ouvre sur la destination du voyage, avec les
 * activités affichées ; choisir un lieu l'ajoute au planning (ou le propose au vote) pour le jour choisi.
 * Paramètres : id (voyage), day (AAAA-MM-JJ).
 */
export default function TripMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, day } = useLocalSearchParams();
  const [trip, setTrip] = useState(null);
  const [center, setCenter] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.get(`/api/trips/${id}`);
        setTrip(data);
        if (data.destinationLatitude != null && data.destinationLongitude != null) {
          setCenter([data.destinationLongitude, data.destinationLatitude]);
          return;
        }
        // Voyage créé avant les suggestions de villes : on retrouve la destination par son nom
        const { data: geo } = await client.get('/api/geo/search', { params: { q: data.destination } }).catch(() => ({ data: {} }));
        const first = geo.results?.[0];
        setCenter(first ? [first.longitude, first.latitude] : [2.5, 46.5]);
      } catch {
        Alert.alert('Voyage introuvable', "Ce voyage n'existe plus ou vous n'y avez plus accès.");
        router.back();
      }
    })();
  }, [id, router]);

  if (!trip || !center) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  const header = (
    <View style={s.header}>
      <TouchableOpacity style={s.back} onPress={() => router.back()} accessibilityLabel="Retour">
        <Ionicons name="arrow-back" size={20} color={Colors.parme} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>Activités · {trip.title || trip.destination}</Text>
        {day ? <Text style={s.sub} numberOfLines={1}>Pour le {fmtDay(day)} · touchez un lieu pour l'ajouter</Text> : null}
      </View>
    </View>
  );

  return (
    <MapPanel
      header={header}
      initialCamera={{ center, zoom: 12.5 }}
      initialShortcut="activites"
      tripTarget={{ trip, day: typeof day === 'string' ? day : trip.startDate }}
      onAddedToTrip={() => router.back()}
      bottomOffset={insets.bottom + 8}
    />
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  back:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  title:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: Colors.parme },
  sub:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text },
});

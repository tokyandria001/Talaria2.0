import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';

/**
 * Logements proposés par Talaria près de la destination (les plus proches du centre), avec un prix
 * estimé selon le type, le style de voyage, les nuits et les voyageurs.
 * - `place` : destination ({ latitude, longitude, name }) ; sans position, rien n'est cherché
 * - `onLoaded(list)` : appelé à chaque nouvelle liste (présélection du premier)
 * - `onPick(suggestion)` / `selectedName` : choix courant ; `pickLabel` : texte du bouton (sinon la carte se touche)
 */
export default function AccommodationSuggestions({ place, type, checkIn, checkOut, travelers, selectedName, onPick, onLoaded, pickLabel }) {
  const [list, setList] = useState(null);      // null : en cours ; [] : rien trouvé
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  const lat = place?.latitude, lon = place?.longitude, city = place?.name;

  useEffect(() => {
    if (lat == null || !checkIn || !checkOut || checkOut <= checkIn) { setList([]); return undefined; }
    let cancelled = false;
    setList(null); setFailed(false);
    client.get('/api/geo/accommodations', { params: { lat, lon, city, type, checkIn, checkOut, travelers } })
      .then(({ data }) => { if (!cancelled) { setList(data.suggestions ?? []); loadedRef.current?.(data.suggestions ?? []); } })
      .catch(() => { if (!cancelled) { setList([]); setFailed(true); } });
    return () => { cancelled = true; };
  }, [lat, lon, city, type, checkIn, checkOut, travelers]);

  if (lat == null) return <Text style={s.empty}>Choisis la destination dans les suggestions pour voir les logements proposés par Talaria.</Text>;
  if (list === null) return <View style={s.loading}><ActivityIndicator color={Colors.parme} /><Text style={s.empty}>Talaria cherche des logements...</Text></View>;
  if (!list.length) return <Text style={s.empty}>{failed ? 'Suggestions indisponibles pour le moment.' : 'Aucun logement de ce type trouvé près du centre.'}</Text>;

  return (
    <View style={{ gap: 8 }}>
      {list.map(sg => {
        const on = selectedName === sg.name;
        const Wrapper = pickLabel ? View : TouchableOpacity;
        return (
          <Wrapper key={sg.name} style={[s.card, on && s.cardOn]} {...(pickLabel ? {} : { onPress: () => onPick(sg), activeOpacity: 0.85 })}>
            <View style={s.head}>
              <Ionicons name={on ? 'checkmark-circle' : 'bed-outline'} size={18} color={on ? Colors.white : Colors.parme} />
              <Text style={[s.name, on && { color: Colors.white }]} numberOfLines={1}>{sg.name}</Text>
              <Text style={[s.distance, on && { color: 'rgba(255,255,255,0.8)' }]}>{sg.distanceKm < 1 ? `${Math.round(sg.distanceKm * 1000)} m` : `${sg.distanceKm} km`} du centre</Text>
            </View>
            {sg.address ? <Text style={[s.meta, on && { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>{sg.address}</Text> : null}
            <View style={s.foot}>
              <Text style={[s.price, on && { color: Colors.white }]}>≈ {sg.estimatedPrice.toLocaleString('fr-FR')} € <Text style={s.estimate}>(estimation)</Text></Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => Linking.openURL(sg.link)} hitSlop={6}>
                  <Text style={[s.link, on && { color: Colors.white }]}>Voir le prix réel</Text>
                </TouchableOpacity>
                {pickLabel && (
                  <TouchableOpacity style={s.pick} onPress={() => onPick(sg)}><Text style={s.pickText}>{pickLabel}</Text></TouchableOpacity>
                )}
              </View>
            </View>
          </Wrapper>
        );
      })}
      <Text style={s.empty}>Prix estimé d'après le type de logement et ton style de voyage : vérifie le prix réel avec le lien.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#ece3e7', padding: 12, gap: 4 },
  cardOn: { backgroundColor: Colors.parme, borderColor: Colors.parme },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  distance: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },
  meta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginLeft: 26 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginLeft: 26 },
  price: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  estimate: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11 },
  link: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, textDecorationLine: 'underline' },
  pick: { backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  pickText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },
});

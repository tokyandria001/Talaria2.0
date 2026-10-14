import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { Colors } from '../constants/Colors';

/** Drapeau à partir du code pays (FR → 🇫🇷) */
export const flagOf = (code) => (code && /^[A-Z]{2}$/i.test(code)
  ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)))
  : '');

/**
 * Champ de ville avec suggestions (villes et pays, via /api/geo/search) : on choisit une destination
 * exacte, avec sa région, son code postal et son pays. Modifier le texte annule le choix.
 *
 * - `place` : suggestion choisie ({ name, label, details, country, countryCode, latitude, longitude }) ou null
 * - `onUnavailable(true)` : la recherche ne répond pas (la saisie libre est alors acceptée)
 */
export default function PlaceAutocomplete({ value, place, onChangeText, onSelect, onUnavailable, placeholder, icon = 'location-outline', required, type = 'city', near }) {
  const isAddress = type === 'address';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastQuery = useRef('');
  // Fonction du parent gardée à part : la recréer à chaque affichage ne relance pas la recherche
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  // Position de référence en nombres : un nouvel objet `near` à chaque affichage ne relance pas la recherche
  const nearLat = near?.latitude, nearLon = near?.longitude;

  useEffect(() => {
    const q = value.trim();
    if (place || q.length < (isAddress ? 3 : 2)) { setResults([]); return undefined; }
    let cancelled = false;
    const id = setTimeout(async () => {
      lastQuery.current = q;
      setLoading(true);
      try {
        // Adresse : résultats proches de la destination du voyage d'abord
        const params = isAddress
          ? { q, type: 'address', ...(nearLat != null ? { lat: nearLat, lon: nearLon } : {}) }
          : { q };
        const { data } = await client.get('/api/geo/search', { params });
        if (cancelled) return;
        setResults(data.results ?? []);
        setFailed(false); unavailableRef.current?.(false);
      } catch {
        if (cancelled) return;
        setResults([]);
        setFailed(true); unavailableRef.current?.(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [value, place, isAddress, nearLat, nearLon]);

  const pick = (r) => {
    setResults([]);
    onSelect(r);
  };

  const showList = focused && !place && results.length > 0;
  const noMatch = focused && !place && !loading && !failed && value.trim().length >= 2 && results.length === 0 && lastQuery.current === value.trim();

  return (
    <View style={s.wrap}>
      <View style={s.inputWrap}>
        <Ionicons name={icon} size={16} color={Colors.text} style={s.icon} />
        <TextInput
          style={[s.input, place && s.inputChosen]}
          placeholder={placeholder} placeholderTextColor="#b9aeb5"
          value={value} onChangeText={onChangeText}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCorrect={false}
        />
        <View style={s.right}>
          {loading ? <ActivityIndicator size="small" color={Colors.parme} />
            : place ? <Ionicons name="checkmark-circle" size={18} color="#2f9e5b" /> : null}
        </View>
      </View>

      {place && (
        <Text style={s.chosen} numberOfLines={1}>
          {isAddress ? '📍' : flagOf(place.countryCode)} {place.details || place.country}
        </Text>
      )}

      {showList && (
        <View style={s.list}>
          {results.map((r, i) => (
            <TouchableOpacity key={`${r.label}-${i}`} style={[s.item, i > 0 && s.itemBorder]} onPress={() => pick(r)} activeOpacity={0.7}>
              <Text style={s.flag}>{isAddress ? '📍' : flagOf(r.countryCode) || '📍'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                <Text style={s.details} numberOfLines={1}>{r.details}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {noMatch && <Text style={s.hint}>{isAddress ? 'Aucune adresse trouvée : ajoute le numéro, la rue et la ville.' : "Aucune ville trouvée : vérifie l'orthographe."}</Text>}
      {failed && <Text style={s.hint}>Suggestions indisponibles pour le moment : tu peux saisir {isAddress ? "l'adresse" : 'la ville'} librement.</Text>}
      {required && !place && !failed && value.trim().length >= 2 && results.length > 0 && !focused && (
        <Text style={[s.hint, { color: Colors.error }]}>Choisis {isAddress ? "l'adresse" : 'la ville'} dans la liste des suggestions.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10 },
  inputWrap: { justifyContent: 'center' },
  icon:  { position: 'absolute', left: 16, zIndex: 1 },
  right: { position: 'absolute', right: 14 },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingLeft: 40, paddingRight: 40, paddingVertical: 12,
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  inputChosen: { borderColor: '#2f9e5b' },
  chosen: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 6, marginLeft: 16 },

  list: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#ece3e7', marginTop: 6, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  itemBorder: { borderTopWidth: 1, borderTopColor: '#f2ebee' },
  flag: { fontSize: 18, width: 24, textAlign: 'center' },
  name: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  details: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  hint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6, marginLeft: 16 },
});

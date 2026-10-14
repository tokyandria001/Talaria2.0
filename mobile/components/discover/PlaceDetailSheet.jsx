import { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';
import { categoryOf, priceLevel, distanceMeters, fmtDistance } from '../../constants/PlaceCategories';

const toDate = (hm) => { const d = new Date(); const [h, m] = (hm || '10:00').split(':'); d.setHours(+h, +m, 0, 0); return d; };
const toHm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const photoUrl = (path) => (path?.startsWith('/') ? `${client.defaults.baseURL}${path}` : path);
const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });

function tripDays(start, end) {
  const days = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && days.length < 60) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return days;
}

export default function PlaceDetailSheet({ place, userLoc, onClose, onToggleLike, presetTrip, presetDay, presetMode, onAdded }) {
  const [step,    setStep]    = useState('detail'); // detail | trip
  const [mode,    setMode]    = useState('add');    // add : planning · vote : proposition au groupe
  const [trips,   setTrips]   = useState(null);
  const [trip,    setTrip]    = useState(null);
  const [day,     setDay]     = useState(null);
  const [time,    setTime]    = useState('10:00');
  const [showTime, setShowTime] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [photos,  setPhotos]  = useState([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  useEffect(() => { if (place) { setStep('detail'); setTrip(null); setDay(null); setPhotos(place.photos ?? []); } }, [place]);

  /** Photo du lieu (créateur uniquement) : elle illustre aussi les activités liées dans les plannings */
  const addPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const form = new FormData();
    form.append('photo', { uri, name: `lieu.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    setUploading(true);
    try {
      const { data } = await client.post(`/api/places/${place.id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPhotos(data.place.photos);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'envoyer la photo.");
    } finally { setUploading(false); }
  };

  const openTripPicker = async (nextMode = 'add') => {
    setMode(nextMode);
    const cat = categoryOf(place).value;
    setTime(cat === 'restaurant' || cat === 'marche' ? '12:30' : cat === 'bar' ? '20:00' : '10:00');
    setStep('trip');
    // Ouvert depuis un voyage : pas de choix de voyage, le jour est déjà connu
    if (presetTrip) {
      setTrip(presetTrip);
      setDay(presetDay && presetDay >= presetTrip.startDate && presetDay <= presetTrip.endDate ? presetDay : presetTrip.startDate);
      return;
    }
    if (trips) return;
    try {
      const { data } = await client.get('/api/trips');
      setTrips(data.filter(t => t.endDate >= new Date().toISOString().slice(0, 10)));
    } catch { setTrips([]); }
  };

  const addToTrip = async () => {
    setSaving(true);
    try {
      const payload = {
        date: day, time,
        title: place.name,
        placeId: place.id,
        category: categoryOf(place).value || null,
        description: place.description || null,
      };
      if (mode === 'vote') {
        await client.post(`/api/trips/${trip.id}/votes`, payload);
        Alert.alert('Proposé au vote', `Les participants de ${trip.destination} peuvent voter pour ${place.name}.`);
      } else {
        await client.post(`/api/trips/${trip.id}/activities`, payload);
        Alert.alert('Ajouté au voyage', `${place.name} est dans le planning de ${trip.destination}.`);
      }
      if (onAdded) onAdded(); else onClose();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'ajouter le lieu au voyage.");
    } finally {
      setSaving(false);
    }
  };

  if (!place) return null;
  const cat = categoryOf(place);
  const level = priceLevel(place.averagePrice);
  const distance = userLoc ? distanceMeters(userLoc, place) : null;
  const photo = photos[0];
  const isCreator = !!user && place.createdBy?.id === user.id;

  return (
    <BottomSheet visible={!!place} title={step === 'detail' ? place.name : mode === 'vote' ? 'Proposer au vote' : 'Ajouter au voyage'} onClose={onClose}>
      {step === 'detail' ? (
        <>
          {photo ? (
            <Image source={{ uri: photoUrl(photo) }} style={s.photo} resizeMode="cover" />
          ) : (
            <View style={[s.photo, s.photoEmpty, { backgroundColor: cat.color }]}>
              <Ionicons name={cat.icon} size={48} color="rgba(255,255,255,0.9)" />
            </View>
          )}
          {isCreator && photos.length < 8 && (
            <TouchableOpacity style={s.addPhoto} onPress={addPhoto} disabled={uploading}>
              <Ionicons name="camera-outline" size={15} color={Colors.parme} />
              <Text style={s.addPhotoText}>{uploading ? 'Envoi...' : photos.length ? 'Ajouter une photo' : 'Ajouter la première photo'}</Text>
            </TouchableOpacity>
          )}

          <View style={s.badges}>
            <Text style={s.badge}>{cat.label}</Text>
            {level && <Text style={s.badge}>{level}</Text>}
            <TouchableOpacity style={s.likes} onPress={() => onToggleLike(place)} hitSlop={8}>
              <Ionicons name={place.liked ? 'heart' : 'heart-outline'} size={15} color={place.liked ? '#e5484d' : Colors.text} />
              <Text style={s.likesText}>{place.likesCount ?? 0}</Text>
            </TouchableOpacity>
          </View>

          {place.description ? <Text style={s.desc}>{place.description}</Text> : null}

          <View style={s.infos}>
            {(place.address || distance != null) && (
              <InfoRow icon="location-outline">
                {[place.address, distance != null ? fmtDistance(distance) : null].filter(Boolean).join(' · ')}
              </InfoRow>
            )}
            {place.openingHours ? <InfoRow icon="time-outline">{place.openingHours}</InfoRow> : null}
            {place.averagePrice != null && (
              <InfoRow icon="cash-outline">Prix moyen : {place.averagePrice} € par personne</InfoRow>
            )}
            {place.source === 'osm' && <Text style={s.osm}>Données © les contributeurs OpenStreetMap</Text>}
          </View>

          {/* Ouvert depuis l'onglet Votes : « Proposer au vote » en bouton principal */}
          <View style={s.actions}>
            <TouchableOpacity style={presetMode === 'vote' ? s.primaryBtn : s.outlineBtn} onPress={() => openTripPicker('vote')}>
              <Ionicons name="thumbs-up-outline" size={16} color={presetMode === 'vote' ? Colors.white : Colors.parme} />
              <Text style={presetMode === 'vote' ? s.primaryText : s.outlineText}>Proposer au vote</Text>
            </TouchableOpacity>
            <TouchableOpacity style={presetMode === 'vote' ? s.outlineBtn : s.primaryBtn} onPress={() => openTripPicker('add')}>
              <Ionicons name="add" size={18} color={presetMode === 'vote' ? Colors.parme : Colors.white} />
              <Text style={presetMode === 'vote' ? s.outlineText : s.primaryText}>Ajouter au voyage</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => setStep('detail')} style={s.backLink}>
            <Ionicons name="chevron-back" size={16} color={Colors.parme} />
            <Text style={s.backLinkText}>{place.name}</Text>
          </TouchableOpacity>

          {presetTrip ? null : <SheetLabel style={{ marginTop: 4 }}>Voyage</SheetLabel>}
          {presetTrip ? null : trips === null ? (
            <ActivityIndicator color={Colors.parme} style={{ alignSelf: 'flex-start' }} />
          ) : trips.length === 0 ? (
            <Text style={s.empty}>Aucun voyage à venir. Créez un voyage avec le bouton + pour y ajouter des lieux.</Text>
          ) : (
            <View style={s.chips}>
              {trips.map(t => (
                <Chip key={t.id} label={t.title || t.destination} active={trip?.id === t.id}
                  onPress={() => { setTrip(t); setDay(t.startDate); }} />
              ))}
            </View>
          )}

          {trip && (
            <>
              <SheetLabel>Jour</SheetLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {tripDays(trip.startDate, trip.endDate).map((d, i) => (
                  <Chip key={d} label={`J${i + 1} · ${fmtDay(d)}`} active={day === d} onPress={() => setDay(d)} />
                ))}
              </ScrollView>

              <SheetLabel>Heure</SheetLabel>
              <View style={s.chips}>
                <TouchableOpacity style={s.timeBtn} onPress={() => setShowTime(true)} activeOpacity={0.8}>
                  <Ionicons name="time-outline" size={16} color={Colors.parme} />
                  <Text style={s.timeText}>{time}</Text>
                </TouchableOpacity>
                {showTime && (
                  <DateTimePicker value={toDate(time)} mode="time" is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => { if (Platform.OS === 'android') setShowTime(false); if (e.type === 'set' && d) setTime(toHm(d)); }} />
                )}
                {showTime && Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setShowTime(false)}><Text style={s.timeOk}>OK</Text></TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={[s.primaryBtn, s.fullBtn, saving && { opacity: 0.6 }]} onPress={addToTrip} disabled={saving}>
                <Text style={s.primaryText}>{saving ? 'Envoi...' : mode === 'vote' ? 'Proposer au groupe' : 'Ajouter au planning'}</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function InfoRow({ icon, children }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.text} />
      <Text style={s.infoText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  photo:      { width: '100%', height: 170, borderRadius: 16, marginTop: 4 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  addPhoto:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  addPhotoText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  badge: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text,
    backgroundColor: '#ece3e7', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden',
  },
  likes:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  likesText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },

  desc: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, lineHeight: 20, color: Colors.textMuted, marginTop: 12 },

  infos:    { gap: 8, marginTop: 14 },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  osm:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 10, color: Colors.textMuted },
  infoText: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  outlineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 13,
  },
  outlineText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 13,
  },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },
  fullBtn:     { flex: 0, marginTop: 22 },

  backLink:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLinkText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.parme, paddingHorizontal: 16, paddingVertical: 9 },
  timeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme },
  timeOk: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme, marginLeft: 8 },
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
});

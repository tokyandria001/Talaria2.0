import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, Platform, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import { comingSoon } from '../AuthUI';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';

/** Catégories de la maquette (Foodie, Culture, Nature, Sport, Soirée) + visite et plage */
export const ACTIVITY_CATEGORIES = [
  { value: 'restaurant', label: 'Foodie' },
  { value: 'culture',    label: 'Culture' },
  { value: 'nature',     label: 'Nature' },
  { value: 'sport',      label: 'Sport' },
  { value: 'bar',        label: 'Soirée' },
  { value: 'visite',     label: 'Visite' },
  { value: 'plage',      label: 'Plage' },
];
const VENUE_TAGS = ['restaurant', 'bar'];
const RADIUS_DEG = 0.25;

const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
const toDate = (hm) => { const d = new Date(); const [h, m] = (hm || '12:00').split(':'); d.setHours(+h, +m, 0, 0); return d; };
const toHm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Coordonnées de la destination (null si introuvable), mises en cache par voyage */
const coordsCache = {};
async function destinationCoords(destination) {
  if (!(destination in coordsCache)) {
    coordsCache[destination] = (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
        const [geo] = await Location.geocodeAsync(destination);
        return geo ? { lat: geo.latitude, lng: geo.longitude } : null;
      } catch { return null; }
    })();
  }
  return coordsCache[destination];
}

/**
 * « Nouvelle activité » / modification (maquette) : nom, date, heure, prix par personne, catégorie,
 * restos/bars à proximité, tarif spécial, proposer au vote (phase 9).
 */
export default function ActivitySheet({ visible, trip, days, initial, priceDefaults = {}, onClose, onSaved, onDeleted }) {
  const isEdit = !!initial?.id;
  const [form, setForm]     = useState({});
  const [place, setPlace]   = useState(null);
  const [venues, setVenues] = useState({ category: null, places: [] });
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedFor = useRef(null);

  useEffect(() => {
    if (!visible || loadedFor.current === initial) return;
    loadedFor.current = initial;
    setForm({
      title: initial?.title ?? '', date: initial?.date ?? days[0], time: initial?.time ?? '',
      price: initial?.price != null ? String(initial.price) : '', category: initial?.category ?? '',
      description: initial?.description ?? '', hasSpecialPrice: initial?.hasSpecialPrice ?? false,
      specialPriceNote: initial?.specialPriceNote ?? '',
    });
    setPlace(initial?.place ?? null);
  }, [visible, initial, days]);

  useEffect(() => { if (!visible) loadedFor.current = null; }, [visible]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  // Changer de catégorie propose le prix moyen du tag, sauf prix saisi à la main
  const pickCategory = (value) => setForm(f => {
    const category = f.category === value ? '' : value;
    const priceIsDefault = f.price === '' || +f.price === priceDefaults[f.category];
    const next = priceDefaults[category];
    return { ...f, category, price: priceIsDefault && !place ? (next != null ? String(next) : '') : f.price };
  });

  // Restos / bars de la carte autour de la destination
  const isVenue = VENUE_TAGS.includes(form.category);
  useEffect(() => {
    if (!visible || !VENUE_TAGS.includes(form.category) || !trip) return;
    let cancelled = false;
    const category = form.category;
    destinationCoords(trip.destination)
      .then(c => (c ? client.get('/api/places', {
        params: { tags: category, recommended: true, bbox: [c.lat - RADIUS_DEG, c.lng - RADIUS_DEG, c.lat + RADIUS_DEG, c.lng + RADIUS_DEG].join(',') },
      }).then(r => r.data.places) : []))
      .catch(() => [])
      .then(places => { if (!cancelled) setVenues({ category, places }); });
    return () => { cancelled = true; };
  }, [visible, form.category, trip]);

  const pickVenue = (p) => {
    setPlace({ id: p.id, name: p.name });
    setForm(f => ({ ...f, title: p.name, description: f.description || p.description || '', price: String(p.averagePrice ?? priceDefaults[f.category] ?? '') }));
  };

  const save = async () => {
    if (!form.title?.trim()) { Alert.alert('Nom requis', "Donnez un nom à l'activité."); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), date: form.date, time: form.time || null,
        price: form.price !== '' ? parseInt(form.price, 10) : null,
        category: form.category || null, description: form.description.trim() || null,
        hasSpecialPrice: form.hasSpecialPrice, specialPriceNote: form.specialPriceNote.trim() || null,
        placeId: place?.id ?? null,
      };
      if (!form.time) payload.slot = initial?.slot ?? 'apres-midi';
      const { data } = isEdit
        ? await client.patch(`/api/trips/${trip.id}/activities/${initial.id}`, payload)
        : await client.post(`/api/trips/${trip.id}/activities`, payload);
      onSaved(data);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'enregistrer l'activité.");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => Alert.alert('Supprimer cette activité ?', initial.title, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try { await client.delete(`/api/trips/${trip.id}/activities/${initial.id}`); onDeleted(initial); }
      catch { Alert.alert('Erreur', "Impossible de supprimer l'activité."); }
    } },
  ]);

  const onTime = (event, date) => {
    if (Platform.OS === 'android') setShowTime(false);
    if (event.type === 'set' && date) set('time')(toHm(date));
  };

  return (
    <BottomSheet
      visible={visible}
      title={isEdit ? "Modifier l'activité" : 'Nouvelle activité'}
      onClose={onClose}
      footer={(
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {!isEdit && <Ionicons name="add" size={18} color={Colors.white} />}
            <Text style={s.btnText}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Ajouter au planning'}</Text>
          </TouchableOpacity>
          {isEdit && (
            <TouchableOpacity onPress={remove} style={{ alignItems: 'center' }}>
              <Text style={s.delete}>Supprimer l'activité</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    >
      <SheetLabel style={{ marginTop: 4 }}>Nom de l'activité</SheetLabel>
      <TextInput style={s.input} placeholder="Tacos tour au Barrio Antiguo" placeholderTextColor="#b9aeb5"
        value={form.title} onChangeText={set('title')} />

      <SheetLabel>Date</SheetLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map(d => <Chip key={d} label={fmtDay(d)} active={form.date === d} onPress={() => set('date')(d)} />)}
      </ScrollView>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <SheetLabel>Heure</SheetLabel>
          <TouchableOpacity style={s.field} onPress={() => setShowTime(true)}>
            <Ionicons name="time-outline" size={16} color={Colors.text} />
            <Text style={[s.fieldText, !form.time && { color: '#b9aeb5' }]}>{form.time || 'Facultative'}</Text>
            {!!form.time && (
              <TouchableOpacity onPress={() => set('time')('')} hitSlop={8}><Ionicons name="close-circle" size={16} color="#b9aeb5" /></TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <SheetLabel>Prix par personne</SheetLabel>
          <View style={s.field}>
            <Ionicons name="cash-outline" size={16} color={Colors.text} />
            <TextInput style={s.fieldInput} placeholder="25" placeholderTextColor="#b9aeb5" keyboardType="number-pad"
              value={form.price} onChangeText={(v) => set('price')(v.replace(/[^0-9]/g, ''))} />
            <Text style={s.fieldText}>€</Text>
          </View>
        </View>
      </View>
      {showTime && (Platform.OS === 'android'
        ? <DateTimePicker value={toDate(form.time)} mode="time" is24Hour onChange={onTime} />
        : (
          <View>
            <DateTimePicker value={toDate(form.time)} mode="time" display="spinner" locale="fr-FR" onChange={onTime} />
            <TouchableOpacity onPress={() => setShowTime(false)}><Text style={s.ok}>OK</Text></TouchableOpacity>
          </View>
        ))}

      <SheetLabel>Catégorie</SheetLabel>
      <View style={s.chips}>
        {ACTIVITY_CATEGORIES.map(c => <Chip key={c.value} label={c.label} active={form.category === c.value} onPress={() => pickCategory(c.value)} />)}
      </View>
      {priceDefaults[form.category] != null && (
        <Text style={s.hint}>Prix moyen : {priceDefaults[form.category]} € / pers. — modifiable</Text>
      )}

      {isVenue && (
        <>
          <SheetLabel>{form.category === 'bar' ? 'Bars' : 'Restaurants'} à proximité</SheetLabel>
          {venues.category !== form.category ? <ActivityIndicator color={Colors.parme} style={{ alignSelf: 'flex-start' }} />
            : venues.places.length === 0 ? <Text style={s.hint}>Aucun lieu de ce type sur la carte autour de {trip?.destination}.</Text>
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {venues.places.slice(0, 8).map(p => (
                  <TouchableOpacity key={p.id} style={[s.venue, place?.id === p.id && s.venueOn]} onPress={() => pickVenue(p)}>
                    <Text style={s.venueName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.venueMeta}>{p.averagePrice != null ? `~${p.averagePrice} €` : 'prix moyen'} · ❤️ {p.likesCount}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
        </>
      )}
      {place && (
        <View style={s.linked}>
          <Text style={s.linkedText} numberOfLines={1}>📍 {place.name}</Text>
          <TouchableOpacity onPress={() => setPlace(null)}><Text style={s.linkedBtn}>Détacher</Text></TouchableOpacity>
        </View>
      )}

      <SheetLabel>Notes</SheetLabel>
      <TextInput style={[s.input, s.textarea]} multiline placeholder="RDV à 8:15 à l'adresse communiquée..." placeholderTextColor="#b9aeb5"
        value={form.description} onChangeText={set('description')} />

      <ToggleRow title="Tarif spécial" subtitle="Réduction CE, code promo..." value={!!form.hasSpecialPrice} onChange={set('hasSpecialPrice')} />
      {form.hasSpecialPrice && (
        <TextInput style={s.input} placeholder="Ex : -15 % avec la carte CE" placeholderTextColor="#b9aeb5"
          value={form.specialPriceNote} onChangeText={set('specialPriceNote')} />
      )}
      <ToggleRow title="Proposer au vote" subtitle="Le budget de chacun est mis à jour si l'activité est validée — bientôt"
        value={false} onChange={() => comingSoon('Le vote en groupe')} />
    </BottomSheet>
  );
}

function ToggleRow({ title, subtitle, value, onChange }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  textarea: { borderRadius: 18, minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 100,
    borderWidth: 1, borderColor: '#ece3e7', paddingHorizontal: 14, paddingVertical: 11,
  },
  fieldText:  { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  fieldInput: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, padding: 0 },
  ok: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.parme, textAlign: 'right', padding: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  venue:     { borderWidth: 1.5, borderColor: '#ece3e7', backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 180 },
  venueOn:   { borderColor: Colors.parme },
  venueName: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  venueMeta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  linked:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, padding: 10, marginTop: 10 },
  linkedText: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  linkedBtn:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },

  toggle:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  toggleSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  btn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 15 },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
  delete:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: '#dc2626' },
});

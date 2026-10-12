import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import { comingSoon } from '../AuthUI';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';
import { PLACE_CATEGORIES } from '../../constants/PlaceCategories';

const EMPTY = { name: '', address: '', category: 'restaurant', averagePrice: '', note: '' };

const formatAddress = (a) => [
  [a.streetNumber, a.street].filter(Boolean).join(' '),
  a.district, a.city,
].filter(Boolean).join(', ');

/**
 * Ajout d'un lieu. `coords` vient d'un appui long sur la carte (l'adresse est alors pré-remplie) ;
 * sans coords (bouton +), la position est retrouvée à partir de l'adresse saisie.
 */
export default function AddPlaceSheet({ visible, coords, onClose, onSaved }) {
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(EMPTY);
    if (!coords) return;
    let cancelled = false;
    Location.reverseGeocodeAsync(coords)
      .then(([a]) => { if (!cancelled && a) setForm(f => (f.address ? f : { ...f, address: formatAddress(a) })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, coords]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Nom requis', 'Donnez un nom au lieu.'); return; }
    setSaving(true);
    try {
      let position = coords;
      if (!position) {
        if (!form.address.trim()) { Alert.alert('Adresse requise', "Indiquez l'adresse du lieu pour le placer sur la carte."); return; }
        const [geo] = await Location.geocodeAsync(form.address.trim()).catch(() => []);
        if (!geo) { Alert.alert('Adresse introuvable', "Vérifiez l'adresse, ou faites un appui long sur la carte à l'emplacement du lieu."); return; }
        position = { latitude: geo.latitude, longitude: geo.longitude };
      }

      const { data } = await client.post('/api/places', {
        name: form.name.trim(),
        address: form.address.trim() || null,
        description: form.note.trim() || null,
        averagePrice: form.averagePrice !== '' ? parseInt(form.averagePrice, 10) : null,
        tags: [form.category],
        latitude: position.latitude,
        longitude: position.longitude,
      });
      onSaved(data.place);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'ajouter le lieu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Ajouter un lieu"
      onClose={onClose}
      footer={(
        <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={s.btnText}>{saving ? 'Ajout...' : 'Ajouter le lieu'}</Text>
        </TouchableOpacity>
      )}
    >
      <SheetLabel style={s.first}>Nom du lieu</SheetLabel>
      <TextInput style={s.input} placeholder="Mercado Juárez" placeholderTextColor="#b9aeb5"
        value={form.name} onChangeText={set('name')} />

      <SheetLabel>Adresse</SheetLabel>
      <View style={s.addressWrap}>
        <Ionicons name="location-outline" size={16} color={Colors.text} style={s.addressIcon} />
        <TextInput style={[s.input, s.addressInput]} placeholder="Av. Juárez 1000, Centro, Monterrey" placeholderTextColor="#b9aeb5"
          value={form.address} onChangeText={set('address')} />
      </View>
      {coords && <Text style={s.hint}>Position choisie sur la carte.</Text>}

      <SheetLabel>Catégorie</SheetLabel>
      <View style={s.chips}>
        {PLACE_CATEGORIES.map(c => (
          <Chip key={c.value} label={c.label} active={form.category === c.value} onPress={() => set('category')(c.value)} />
        ))}
      </View>

      <SheetLabel>Prix moyen par personne (€)</SheetLabel>
      <TextInput style={s.input} placeholder="25" placeholderTextColor="#b9aeb5" keyboardType="number-pad"
        value={form.averagePrice} onChangeText={(v) => set('averagePrice')(v.replace(/[^0-9]/g, ''))} />

      <SheetLabel>Note pour le groupe</SheetLabel>
      <TextInput style={[s.input, s.note]} multiline placeholderTextColor="#b9aeb5"
        placeholder="Parfait pour goûter des tacos le midi, pas cher et très animé."
        value={form.note} onChangeText={set('note')} />

      <View style={s.share}>
        <View style={{ flex: 1 }}>
          <Text style={s.shareTitle}>Partager avec le groupe</Text>
          <Text style={s.shareSub}>Bientôt disponible avec les groupes de voyage</Text>
        </View>
        <Switch value={false} onValueChange={() => comingSoon('Le partage avec le groupe')}
          thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  first: { marginTop: 4 },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 18, paddingVertical: 13,
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  addressWrap:  { justifyContent: 'center' },
  addressIcon:  { position: 'absolute', left: 16, zIndex: 1 },
  addressInput: { paddingLeft: 40, borderColor: Colors.parme },
  note: { borderRadius: 18, minHeight: 90, textAlignVertical: 'top', paddingTop: 13 },
  hint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6, marginLeft: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  share:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  shareTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  shareSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 15,
  },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});

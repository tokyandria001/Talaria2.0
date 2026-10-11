import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, Alert, Platform,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';

const CATEGORIES = [
  { value: '',            label: 'Tous',       icon: '🗺' },
  { value: 'restaurant',  label: 'Restos',     icon: '🍽' },
  { value: 'bar',         label: 'Bars',       icon: '🍸' },
  { value: 'hotel',       label: 'Hôtels',     icon: '🛏' },
  { value: 'visite',      label: 'Visites',    icon: '🏛' },
];

const TAG_ICONS = { restaurant: '🍽', bar: '🍸', hotel: '🛏', visite: '🏛', plage: '🏖', sport: '🏄', culture: '🎨' };

export default function MapScreen() {
  const mapRef = useRef(null);
  const [places,      setPlaces]      = useState([]);
  const [search,      setSearch]      = useState('');
  const [activeTags,  setActiveTags]  = useState([]);
  const [recommended, setRecommended] = useState(false);
  const [userLoc,     setUserLoc]     = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [addCoords,   setAddCoords]   = useState(null);
  const [addForm,     setAddForm]     = useState({ name: '', description: '', tags: [] });
  const [saving,      setSaving]      = useState(false);
  const [selected,    setSelected]    = useState(null);

  // Géolocalisation
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc(loc.coords);
      }
    })();
  }, []);

  const fetchPlaces = useCallback(async () => {
    try {
      const params = {};
      if (activeTags.length) params.tags = activeTags.join(',');
      if (search)            params.search = search;
      if (recommended)       params.recommended = 'true';
      const { data } = await client.get('/api/places', { params });
      setPlaces(data.places ?? []);
    } catch { /* silently ignore if places API not available */ }
  }, [activeTags, search, recommended]);

  const toggleTag = (value) => {
    if (value === '') { setActiveTags([]); return; }
    setActiveTags((prev) => prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]);
  };

  const toggleLike = async (place) => {
    try {
      const { data } = await client.post(`/api/places/${place.id}/like`);
      const patch = (p) => p.id === place.id ? { ...p, liked: data.liked, likesCount: data.likesCount } : p;
      setPlaces((prev) => prev.map(patch));
      setSelected((prev) => prev && prev.id === place.id ? patch(prev) : prev);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchPlaces(); }, [fetchPlaces]);

  const flyToUser = async () => {
    if (userLoc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLoc.latitude, longitude: userLoc.longitude,
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 800);
    }
  };

  const handleLongPress = (e) => {
    setAddCoords(e.nativeEvent.coordinate);
    setAddForm({ name: '', description: '', tags: [] });
    setShowAdd(true);
  };

  const handleSavePlace = async () => {
    if (!addForm.name.trim()) { Alert.alert('Nom requis'); return; }
    setSaving(true);
    try {
      await client.post('/api/places', {
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        latitude:  addCoords.latitude,
        longitude: addCoords.longitude,
        tags: addForm.tags,
      });
      setShowAdd(false);
      fetchPlaces();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible d\'ajouter le lieu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: 46.5, longitude: 2.5, latitudeDelta: 10, longitudeDelta: 10 }}
        onLongPress={handleLongPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.name}
          >
            <View style={styles.markerPin}>
              <Text style={styles.markerIcon}>{TAG_ICONS[p.tags?.[0]] ?? '📍'}</Text>
            </View>
            <Callout style={styles.callout} onPress={() => setSelected(p)}>
              <Text style={styles.calloutName}>{p.name}</Text>
              {p.description && <Text style={styles.calloutDesc}>{p.description}</Text>}
              <View style={styles.calloutMeta}>
                {p.averagePrice ? <Text style={styles.calloutPrice}>~{p.averagePrice} €</Text> : null}
                <Text style={styles.calloutLikes}>❤️ {p.likesCount ?? 0}</Text>
              </View>
              <Text style={styles.calloutHint}>Toucher pour voir / aimer</Text>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Top overlay */}
      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un lieu..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: Colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category filters (multi-sélection) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.pill, recommended && styles.pillActive]}
            onPress={() => setRecommended((v) => !v)}
          >
            <Text style={styles.pillIcon}>✨</Text>
            <Text style={[styles.pillLabel, recommended && styles.pillLabelActive]}>Pour vous</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => {
            const active = c.value === '' ? activeTags.length === 0 : activeTags.includes(c.value);
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => toggleTag(c.value)}
              >
                <Text style={styles.pillIcon}>{c.icon}</Text>
                <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Controls bottom-right */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={flyToUser}>
          <Text style={{ fontSize: 18 }}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>Appui long pour ajouter un lieu</Text>
      </View>

      {/* Add Place Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau lieu</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={{ fontSize: 20, color: Colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nom *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Nom du lieu"
              placeholderTextColor={Colors.textMuted}
              value={addForm.name}
              onChangeText={(v) => setAddForm(f => ({ ...f, name: v }))}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80 }]}
              placeholder="Description optionnelle..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={addForm.description}
              onChangeText={(v) => setAddForm(f => ({ ...f, description: v }))}
            />

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {CATEGORIES.filter(c => c.value).map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.pill, addForm.tags.includes(c.value) && styles.pillActive, { marginLeft: 0, marginRight: 8 }]}
                  onPress={() => setAddForm(f => ({
                    ...f,
                    tags: f.tags.includes(c.value) ? f.tags.filter(t => t !== c.value) : [...f.tags, c.value],
                  }))}
                >
                  <Text style={styles.pillIcon}>{c.icon}</Text>
                  <Text style={[styles.pillLabel, addForm.tags.includes(c.value) && styles.pillLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSavePlace}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveBtnText}>Ajouter le lieu</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Place Detail Modal */}
      <Modal visible={!!selected} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selected.name}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={{ fontSize: 20, color: Colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {selected.description ? (
                  <Text style={[styles.calloutDesc, { marginBottom: 16, fontSize: 14 }]}>{selected.description}</Text>
                ) : null}

                <View style={styles.calloutMeta}>
                  {selected.averagePrice ? <Text style={styles.calloutPrice}>~{selected.averagePrice} €</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 }]}
                  onPress={() => toggleLike(selected)}
                >
                  <Text style={{ fontSize: 16 }}>{selected.liked ? '❤️' : '🤍'}</Text>
                  <Text style={styles.saveBtnText}>{selected.likesCount ?? 0} j'aime</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 12, gap: 8,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: {
    flex: 1, fontSize: 14,
    fontFamily: 'BricolageGrotesque_400Regular', color: Colors.text,
  },

  filtersScroll: { paddingBottom: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9,
    marginRight: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillActive:      { backgroundColor: Colors.parme },
  pillIcon:        { fontSize: 14 },
  pillLabel:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  pillLabelActive: { color: Colors.white },

  markerPin: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.parme,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  markerIcon: { fontSize: 18 },

  callout:      { width: 200, padding: 10, backgroundColor: Colors.white, borderRadius: 10 },
  calloutName:  { fontSize: 14, fontWeight: '700', color: Colors.parme, marginBottom: 4 },
  calloutDesc:  { fontSize: 12, color: Colors.textMuted },
  calloutMeta:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  calloutPrice: { fontSize: 12, fontWeight: '600', color: Colors.text },
  calloutLikes: { fontSize: 12, fontWeight: '600', color: Colors.text },
  calloutHint:  { fontSize: 10, color: Colors.textMuted, marginTop: 6, fontStyle: 'italic' },

  controls: {
    position: 'absolute', right: 16, bottom: 130,
    gap: 8,
  },
  ctrlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  hint: {
    position: 'absolute', bottom: 110, alignSelf: 'center',
    backgroundColor: 'rgba(79,32,63,0.85)',
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8,
  },
  hintText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.white },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 20, color: Colors.parme },

  fieldLabel: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.text, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, marginBottom: 16, textAlignVertical: 'top',
  },

  saveBtn: {
    backgroundColor: Colors.parme, borderRadius: 100,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },
});

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, Images, UserLocation } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';
import { categoryOf, priceLevel, PLACE_CATEGORIES, FILTER_CATEGORIES } from '../../constants/PlaceCategories';
import { comingSoon } from '../AuthUI';
import MapFiltersSheet, { DEFAULT_FILTERS, applyFilters } from './MapFiltersSheet';
import PlaceDetailSheet from './PlaceDetailSheet';
import AddPlaceSheet from './AddPlaceSheet';
import { CLUSTER_IMAGES, PIN_IMAGES, PIN_ACTIVE_IMAGES } from '../../constants/MarkerImages';
import { MAP_STYLE, MAP_ATTRIBUTION } from '../../constants/mapStyle';

/* Raccourcis du design : Logements et Activités filtrent la carte ; Vols et Destinations arrivent plus tard */
const SHORTCUTS = [
  { value: 'vols',         label: 'Vols',         icon: 'airplane' },
  { value: 'logements',    label: 'Logements',    icon: 'business' },
  { value: 'activites',    label: 'Activités',    icon: 'bicycle' },
  { value: 'destinations', label: 'Destinations', icon: 'earth' },
];
/** Tags envoyés au serveur pour les raccourcis Logements / Activités */
const LODGING_TAGS = ['hotel', 'auberge', 'camping'];
const ACTIVITY_TAGS = PLACE_CATEGORIES.flatMap(c => c.tags).filter(t => !LODGING_TAGS.includes(t));

/** Zone visible de la carte ([ouest, sud, est, nord]) → bbox « sud,ouest,nord,est » de l'API */
const toBbox = ([west, south, east, north]) => [south, west, north, east].map(v => v.toFixed(4)).join(',');

/** Libellé d'une bulle (une image par libellé, voir scripts/generate-markers.py) : 7, 40+, 300+, 5k+, 20k+ */
const clusterLabel = (n) => {
  if (n < 10) return String(Math.max(2, n));
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  if (n < 10000) return `${Math.floor(n / 1000)}k+`;
  return n < 20000 ? '10k+' : n < 50000 ? '20k+' : '50k+';
};

/** Vue de départ : la France entière (zone approximative tant que la carte n'a pas donné la sienne) */
const FRANCE = { center: [2.5, 46.5], zoom: 4.6, bounds: [-5.5, 41.3, 10.5, 51.5] };

/** Images des marqueurs (PNG générés par scripts/generate-markers.py), dessinées par la carte elle-même */
const MARKER_IMAGES = {
  ...Object.fromEntries(Object.entries(PIN_IMAGES).map(([cat, img]) => [`pin-${cat}`, img])),
  ...Object.fromEntries(Object.entries(PIN_ACTIVE_IMAGES).map(([cat, img]) => [`pin-${cat}-active`, img])),
  ...Object.fromEntries(Object.entries(CLUSTER_IMAGES).map(([label, img]) => [`cluster-${label}`, img])),
};

/**
 * Carte des lieux. Depuis un voyage : `initialCamera` centre la carte sur la destination et
 * `tripTarget` ({ trip, day }) fait ajouter les lieux directement à ce voyage (`onAddedToTrip` ensuite).
 */
export default function MapPanel({ header, autoAdd, onAutoAddHandled, initialShortcut, onShortcutHandled, bottomOffset = 100, initialCamera, tripTarget, onAddedToTrip }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const markerPressedAt = useRef(0); // un appui sur un marqueur ne ferme pas l'aperçu

  const [places,     setPlaces]     = useState([]);
  const [clusters,   setClusters]   = useState([]); // bulles numérotées quand la zone contient trop de lieux
  // Zone de départ : la destination du voyage (environ 30 km autour) ou la France
  const [view,       setView]       = useState(() => (initialCamera ? {
    center: initialCamera.center, zoom: initialCamera.zoom,
    bounds: [initialCamera.center[0] - 0.2, initialCamera.center[1] - 0.15, initialCamera.center[0] + 0.2, initialCamera.center[1] + 0.15],
  } : FRANCE));
  const [truncated,  setTruncated]  = useState(false);
  const [search,     setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [shortcut,   setShortcut]   = useState(null);
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [userLoc,    setUserLoc]    = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [addCoords,  setAddCoords]  = useState(undefined); // undefined = fermé, null = sans position

  // Géolocalisation (facultative)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        // Dernière position connue en secours si la localisation est désactivée ou indisponible
        const loc = await Location.getCurrentPositionAsync({})
          .catch(() => Location.getLastKnownPositionAsync());
        if (loc) setUserLoc(loc.coords);
      } catch {
        // Localisation indisponible : la carte reste centrée sur la France
      }
    })();
  }, []);

  // Lieux de la zone visible uniquement (près de 100 000 lieux en base) : catégories filtrées par le serveur,
  // rechargement quand la carte bouge, léger délai pendant la frappe et les déplacements
  const tagsFor = useCallback((categories) => {
    const chosen = FILTER_CATEGORIES.filter(c => categories.includes(c.value)).flatMap(c => c.tags);
    if (shortcut === 'logements') return chosen.length ? chosen.filter(t => LODGING_TAGS.includes(t)) : LODGING_TAGS;
    if (shortcut === 'activites') return chosen.length ? chosen.filter(t => ACTIVITY_TAGS.includes(t)) : ACTIVITY_TAGS;
    return chosen;
  }, [shortcut]);
  const serverTags = useMemo(() => tagsFor(filters.categories), [tagsFor, filters.categories]);

  const hasFilter = serverTags.length > 0 || search !== '';

  useEffect(() => {
    // Carte vide à l'ouverture : les lieux n'apparaissent qu'après le choix d'un filtre
    if (!hasFilter) {
      setPlaces([]); setClusters([]); setTruncated(false);
      return undefined;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      // Au-delà de 150 lieux dans la zone, le serveur renvoie des bulles regroupées
      const params = { bbox: toBbox(view.bounds), clusters: 'true', limit: 150 };
      if (search) params.search = search;
      if (serverTags.length) params.tags = serverTags.join(',');
      client.get('/api/places', { params })
        .then(({ data }) => { if (!cancelled) { setPlaces(data.places ?? []); setClusters(data.clusters ?? []); setTruncated(!!data.truncated); } })
        .catch(() => {});
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [search, view.bounds, serverTags, hasFilter]);

  // Raccourci choisi depuis l'accueil : la carte s'ouvre déjà filtrée
  useEffect(() => {
    if (initialShortcut === 'logements' || initialShortcut === 'activites') {
      setShortcut(initialShortcut);
      onShortcutHandled?.();
    }
  }, [initialShortcut, onShortcutHandled]);

  // Ouverture de l'ajout de lieu depuis le bouton +
  useEffect(() => {
    if (autoAdd) { setAddCoords(null); onAutoAddHandled?.(); }
  }, [autoAdd, onAutoAddHandled]);

  // Catégories déjà filtrées par le serveur ; ici le budget et la distance
  const visible = useMemo(() => applyFilters(places, filters, userLoc), [places, filters, userLoc]);

  const activeFilterCount = filters.categories.length
    + (filters.budget[0] > DEFAULT_FILTERS.budget[0] || filters.budget[1] < DEFAULT_FILTERS.budget[1] ? 1 : 0)
    + (filters.distance ? 1 : 0);

  const pressShortcut = (value) => {
    if (value === 'vols' || value === 'destinations') {
      comingSoon(value === 'vols' ? 'La recherche de vols' : 'La découverte de destinations');
      return;
    }
    setShortcut(s => (s === value ? null : value));
  };

  const toggleLike = async (place) => {
    try {
      const { data } = await client.post(`/api/places/${place.id}/like`);
      const patch = (p) => (p && p.id === place.id ? { ...p, liked: data.liked, likesCount: data.likesCount } : p);
      setPlaces(prev => prev.map(patch));
      setPreview(patch);
      setDetail(patch);
    } catch { /* ignore */ }
  };

  // Bulle touchée : zoom centré dessus, elle se divise en bulles plus petites ou en lieux
  const zoomInto = (c) => {
    cameraRef.current?.easeTo({ center: [c.longitude, c.latitude], zoom: Math.min(view.zoom + 1.6, 18), duration: 500 });
  };

  // Vue rapprochée inclinée : les bâtiments 3D apparaissent à partir du zoom 14
  const flyToUser = () => {
    if (!userLoc) { comingSoon('Le centrage sur votre position (activez la localisation)'); return; }
    cameraRef.current?.flyTo({ center: [userLoc.longitude, userLoc.latitude], zoom: 15, pitch: 45, duration: 1200 });
  };

  const onPlaceAdded = (place) => {
    setAddCoords(undefined);
    if (!place) return;
    setPlaces(prev => [place, ...prev]);
    setPreview(place);
    cameraRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 15.5, pitch: 45, duration: 1000 });
  };

  /** Lieux et bulles au format GeoJSON, chaque point avec le nom de son image */
  const placesGeoJson = useMemo(() => ({
    type: 'FeatureCollection',
    features: visible.map(p => {
      const cat = PIN_IMAGES[categoryOf(p).value] ? categoryOf(p).value : 'default';
      const selected = preview?.id === p.id;
      return {
        type: 'Feature', id: p.id,
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id, icon: selected ? `pin-${cat}-active` : `pin-${cat}`, sort: selected ? 1 : 0 },
      };
    }),
  }), [visible, preview?.id]);

  const clustersGeoJson = useMemo(() => ({
    type: 'FeatureCollection',
    features: clusters.map((c, i) => ({
      type: 'Feature', id: i,
      geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
      properties: { latitude: c.latitude, longitude: c.longitude, icon: `cluster-${clusterLabel(c.count)}`, count: c.count },
    })),
  }), [clusters]);

  const onPlacePress = (e) => {
    const id = e.nativeEvent.features?.[0]?.properties?.id;
    const place = visible.find(p => p.id === id);
    if (!place) return;
    markerPressedAt.current = Date.now();
    setPreview(place);
  };

  const onClusterPress = (e) => {
    const props = e.nativeEvent.features?.[0]?.properties;
    if (!props) return;
    markerPressedAt.current = Date.now();
    zoomInto(props);
  };

  return (
    <View style={s.root}>
      {/* Carte MapLibre, même style que le site (tuiles OpenFreeMap, bâtiments 3D à partir du zoom 14) */}
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        attribution={false}
        logo={false}
        compass={false}
        onRegionDidChange={(e) => {
          const { bounds, zoom, center } = e.nativeEvent;
          if (bounds) setView({ bounds, zoom, center });
        }}
        onPress={() => { if (Date.now() - markerPressedAt.current > 400) setPreview(null); }}
        onLongPress={(e) => {
          const [longitude, latitude] = e.nativeEvent.lngLat;
          setAddCoords({ latitude, longitude });
        }}
      >
        <Camera ref={cameraRef} initialViewState={initialCamera ?? { center: FRANCE.center, zoom: FRANCE.zoom }} />
        <Images images={MARKER_IMAGES} />
        {userLoc && <UserLocation />}

        <GeoJSONSource id="clusters" data={clustersGeoJson} onPress={onClusterPress}>
          <Layer id="clusters-icons" type="symbol" layout={{
            'icon-image': ['get', 'icon'], 'icon-anchor': 'center',
            'icon-allow-overlap': true, 'icon-ignore-placement': true,
          }} />
        </GeoJSONSource>

        <GeoJSONSource id="places" data={placesGeoJson} onPress={onPlacePress}>
          <Layer id="places-pins" type="symbol" layout={{
            'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom',
            'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'symbol-sort-key': ['get', 'sort'],
          }} />
        </GeoJSONSource>
      </MapLibreMap>

      {/* En-tête + raccourcis */}
      <View style={[s.top, { paddingTop: insets.top }]}>
        {header}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shortcuts}>
          {SHORTCUTS.map(sc => (
            <TouchableOpacity key={sc.value} style={[s.shortcut, shortcut === sc.value && s.shortcutActive]}
              onPress={() => pressShortcut(sc.value)} activeOpacity={0.85}>
              <Text style={s.shortcutText}>{sc.label}</Text>
              <Ionicons name={sc.icon} size={16} color={Colors.parme} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        {showSearch && (
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Rechercher un lieu..." placeholderTextColor={Colors.textMuted}
              value={search} onChangeText={setSearch} autoFocus returnKeyType="search" />
            <TouchableOpacity onPress={() => { setSearch(''); setShowSearch(false); }} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Aperçu du lieu sélectionné */}
      {preview && <PreviewCard place={preview} onClose={() => setPreview(null)} onOpen={() => setDetail(preview)} onLike={() => toggleLike(preview)} />}

      {/* Trop de lieux dans la zone : on n'affiche que les plus populaires */}
      {!hasFilter && !preview && (
        <View style={[s.zoomHint, { bottom: bottomOffset + 124 }]} pointerEvents="none">
          <Text style={s.zoomHintText}>Choisissez un filtre pour afficher les lieux</Text>
        </View>
      )}

      {truncated && (
        <View style={[s.zoomHint, { bottom: bottomOffset + 124 }]} pointerEvents="none">
          <Text style={s.zoomHintText}>Zoomez pour voir tous les lieux de la zone</Text>
        </View>
      )}

      {/* Mentions obligatoires : fond de carte OpenFreeMap / OpenMapTiles, données OpenStreetMap (ODbL) */}
      <Text style={[s.attribution, { bottom: bottomOffset + 2 }]} pointerEvents="none">{MAP_ATTRIBUTION}</Text>

      {/* Bouton position */}
      <TouchableOpacity style={[s.locate, { bottom: bottomOffset + 70 }]} onPress={flyToUser}>
        <Ionicons name="locate" size={20} color={Colors.parme} />
      </TouchableOpacity>

      {/* Filtrer / Rechercher */}
      <View style={[s.actions, { bottom: bottomOffset + 12 }]}>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowFilters(true)} activeOpacity={0.85}>
          <Ionicons name="funnel-outline" size={15} color={Colors.white} />
          <Text style={s.actionText}>Filtrer{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowSearch(v => !v)} activeOpacity={0.85}>
          <Ionicons name="search" size={15} color={Colors.white} />
          <Text style={s.actionText}>Rechercher</Text>
        </TouchableOpacity>
      </View>

      <MapFiltersSheet
        visible={showFilters}
        filters={filters}
        bbox={toBbox(view.bounds)}
        search={search}
        tagsFor={tagsFor}
        userLoc={userLoc}
        onApply={(f) => { setFilters(f); setShowFilters(false); }}
        onClose={() => setShowFilters(false)}
      />
      <PlaceDetailSheet place={detail} userLoc={userLoc} onClose={() => setDetail(null)} onToggleLike={toggleLike}
        presetTrip={tripTarget?.trip} presetDay={tripTarget?.day} presetMode={tripTarget?.mode}
        onAdded={() => { setDetail(null); setPreview(null); onAddedToTrip?.(); }} />
      <AddPlaceSheet visible={addCoords !== undefined} coords={addCoords} onClose={() => setAddCoords(undefined)} onSaved={onPlaceAdded} />
    </View>
  );
}

/** Petite carte d'aperçu (design : nom, puces, description, « Voir cet établissement », cœur) */
function PreviewCard({ place, onClose, onOpen, onLike }) {
  const cat = categoryOf(place);
  const level = priceLevel(place.averagePrice);
  return (
    <View style={s.preview}>
      <View style={s.previewHeader}>
        <Text style={s.previewName} numberOfLines={1}>{place.name}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={s.previewClose}>
          <Ionicons name="close" size={14} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <View style={s.previewBadges}>
        <Text style={s.previewBadge}>{cat.label}</Text>
        {level && <Text style={s.previewBadge}>{level}</Text>}
      </View>
      {place.description ? <Text style={s.previewDesc} numberOfLines={2}>{place.description}</Text> : null}
      <View style={s.previewFooter}>
        <TouchableOpacity style={s.previewBtn} onPress={onOpen} activeOpacity={0.85}>
          <Text style={s.previewBtnText}>Voir cet établissement</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLike} hitSlop={8}>
          <Ionicons name={place.liked ? 'heart' : 'heart-outline'} size={20} color={place.liked ? '#e5484d' : Colors.parme} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 };

const s = StyleSheet.create({
  root: { flex: 1 },
  zoomHint:     { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(30,8,22,0.75)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  zoomHintText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },
  attribution:  { position: 'absolute', left: 8, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 9, color: 'rgba(30,8,22,0.6)' },

  top: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(252,249,241,0.92)', paddingBottom: 10 },
  shortcuts: { paddingHorizontal: 16, gap: 8 },
  shortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent',
    paddingVertical: 8, paddingHorizontal: 12,
  },
  shortcutActive: { borderColor: Colors.parme },
  shortcutText:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, padding: 0 },

  preview: {
    position: 'absolute', top: 170, alignSelf: 'center', width: 250,
    backgroundColor: Colors.sableLune, borderRadius: 14, padding: 12, ...shadow,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewName:   { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme },
  previewClose:  { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ece3e7', alignItems: 'center', justifyContent: 'center' },
  previewBadges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  previewBadge: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.text,
    backgroundColor: '#ece3e7', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  previewDesc:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  previewBtn:    { flex: 1, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 8, alignItems: 'center' },
  previewBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },

  locate: {
    position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...shadow,
  },

  actions: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(79,32,63,0.85)', borderRadius: 100, paddingVertical: 11, paddingHorizontal: 18, ...shadow,
  },
  actionText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },
});

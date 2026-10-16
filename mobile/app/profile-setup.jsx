import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Image, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing,
  PanResponder, Dimensions, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import UserAvatar from '../components/UserAvatar';
import { ValueSlider } from '../components/settings/SettingsUI';
import { Colors } from '../constants/Colors';
import { GENDERS, accord, genderPayload } from '../constants/Gender';
import { skipKey } from '../constants/Preferences';

const { width: SCREEN_W } = Dimensions.get('window');
const QUESTIONS = 7;
const DONE = QUESTIONS + 1;              // étapes : 0 bienvenue, 1 à 7 questions, 8 profil prêt
const YEAR = new Date().getFullYear();
const MIN_AGE = 13, MAX_AGE = 99, TICK = 14;

// Libellé neutre, au féminin (f) et au masculin (m) : voir typeLabel()
const TYPES = [
  { value: 'aventurier', label: 'Aventure', f: 'Aventurière', m: 'Aventurier', sub: 'Rando, sensations', icon: 'compass-outline' },
  { value: 'foodie',     label: 'Foodie',     sub: 'Street-food, marchés', icon: 'star-outline' },
  { value: 'culture',    label: 'Culture',    sub: 'Musées, histoire',    icon: 'globe-outline' },
  { value: 'nature',     label: 'Nature',     sub: 'Parcs, plages',       icon: 'leaf-outline' },
  { value: 'fetard',     label: 'Fête',       f: 'Fêtarde', m: 'Fêtard', sub: 'Bars, festivals',     icon: 'calendar-outline' },
  { value: 'romantique', label: 'Romantique', sub: 'Couchers de soleil',  icon: 'heart-outline' },
];
const typeLabel = (t, gender) => accord({ gender }, t.f ?? t.label, t.m ?? t.label, t.label);

// Titre du profil voyageur : nom du 1er style + qualificatif du 2e (mots valables au masculin comme au féminin)
const TYPE_NOUN = { aventurier: 'Globe-trotter', foodie: 'Gourmet', culture: 'Esthète', nature: 'Âme sauvage', fetard: 'Noctambule', romantique: 'Romantique' };
const TYPE_ADJ  = { aventurier: 'intrépide', foodie: 'gourmet', culture: 'esthète', nature: 'nature', fetard: 'noctambule', romantique: 'romantique' };

const COMPANIONS = [
  { value: 'amis',    label: 'Entre amis', sub: 'Week-ends, city-trips, festivals', icon: 'people-outline' },
  { value: 'couple',  label: 'En couple',  sub: 'Escapades à deux',                 icon: 'heart-outline' },
  { value: 'famille', label: 'En famille', sub: 'Vacances avec enfants ou parents', icon: 'person-outline' },
  { value: 'solo',    label: 'En solo',    sub: "Rencontrer d'autres voyageurs",   icon: 'airplane-outline' },
];

const BUDGET_RANGES = [
  { label: '< 150 €',     min: 0,   max: 149,  value: 100, name: 'Petit budget' },
  { label: '150 – 300 €', min: 150, max: 299,  value: 250, name: 'Budget malin' },
  { label: '300 – 500 €', min: 300, max: 499,  value: 400, name: 'Budget confort' },
  { label: '500 € +',     min: 500, max: 1e9,  value: 600, name: 'Grand voyageur' },
];
const rangeOf = (v) => BUDGET_RANGES.find(r => v >= r.min && v <= r.max) ?? BUDGET_RANGES[1];

const DESTINATIONS = [
  { key: 'paris',    name: 'Paris, France',        sub: 'Musées · Croissants · 3 jours',  image: require('../assets/destinations/paris.jpg') },
  { key: 'islande',  name: 'Reykjavik, Islande',   sub: 'Aurores · Geysers · 5 jours',    image: require('../assets/destinations/islande.jpg') },
  { key: 'pise',     name: 'Pise, Italie',         sub: 'Tour penchée · Pizza · 3 jours', image: require('../assets/destinations/pise.jpg') },
  { key: 'new-york', name: 'New York, États-Unis', sub: 'Skyline · Brunchs · 6 jours',    image: require('../assets/destinations/new-york.jpg') },
  { key: 'alpes',    name: 'Chamonix, France',     sub: 'Ski · Raclette · 4 jours',       image: require('../assets/destinations/alpes.jpg') },
  { key: 'laponie',  name: 'Tromsø, Norvège',      sub: 'Aurores · Fjords · 5 jours',     image: require('../assets/destinations/laponie.jpg') },
  { key: 'casablanca', name: 'Casablanca, Maroc',  sub: 'Médina · Tajines · 4 jours',     image: require('../assets/destinations/casablanca.jpg') },
  { key: 'sydney',   name: 'Sydney, Australie',    sub: 'Opéra · Surf · 10 jours',        image: require('../assets/destinations/sydney.jpg') },
  { key: 'maldives', name: 'Maldives',             sub: 'Lagons · Snorkeling · 7 jours',  image: require('../assets/destinations/maldives.jpg') },
];

const POLAROIDS = [
  { image: require('../assets/destinations/islande.jpg'), caption: 'Islande', style: { left: 14, top: 40, transform: [{ rotate: '-9deg' }] } },
  { image: require('../assets/destinations/paris.jpg'),   caption: 'Paris',   style: { right: 18, top: 0, transform: [{ rotate: '8deg' }] } },
  { image: require('../assets/destinations/alpes.jpg'),   caption: 'Rando',   style: { left: 92, top: 108, transform: [{ rotate: '-2deg' }] } },
];

// Formes du fond : elles glissent d'une position à l'autre à chaque étape
const SHAPES = [
  { x: 150, y: -60,  x2: -120, y2: 420 },
  { x: -170, y: -40, x2: 170,  y2: 480 },
  { x: 120, y: 30,   x2: -150, y2: 380 },
  { x: -140, y: 10,  x2: 160,  y2: 440 },
];

/**
 * Onboarding après l'inscription : 7 questions pour personnaliser Talaria (prénom et photo, âge,
 * ville de départ, style, budget, compagnons, envies), puis le profil voyageur. Chaque question
 * peut être passée ; les réponses sont enregistrées au fur et à mesure.
 */
export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, updateProfile, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => ({
    firstName: user?.firstName ?? '',
    gender: user?.gender ?? 'neutre',
    age: user?.birthYear ? YEAR - user.birthYear : 24,
    ageTouched: !!user?.birthYear,
    homeCity: user?.homeCity ?? '',
    homePlace: user?.homeLatitude != null ? { name: user.homeCity, latitude: user.homeLatitude, longitude: user.homeLongitude } : null,
    homeHubs: user?.homeHubs ?? [],
    travelerTypes: user?.travelerTypes ?? [],
    weekendBudget: user?.weekendBudget ?? 250,
    companions: user?.companions ?? null,
    wishlist: user?.wishlist ?? [],
  }));
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  // Transition entre étapes : le contenu glisse, les formes du fond se déplacent
  const enter = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const shape = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.spring(shape, { toValue: step, friction: 9, tension: 30, useNativeDriver: true }).start();
  }, [step, enter, shape]);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const go = (next) => { dir.current = next > step ? 1 : -1; setStep(Math.max(0, Math.min(DONE, next))); };

  /** Réponses de l'étape courante (null : rien à enregistrer) */
  const payloadFor = (s) => {
    switch (s) {
      case 1: return f.firstName.trim() ? { firstName: f.firstName.trim(), gender: genderPayload(f.gender) } : null;
      case 2: return f.ageTouched ? { birthYear: YEAR - f.age } : null;
      case 3: return f.homeCity.trim() ? {
        homeCity: f.homeCity.trim(), homeLatitude: f.homePlace?.latitude ?? null, homeLongitude: f.homePlace?.longitude ?? null, homeHubs: f.homeHubs,
      } : null;
      case 4: return f.travelerTypes.length ? { travelerTypes: f.travelerTypes } : null;
      case 5: return { weekendBudget: f.weekendBudget };
      case 6: return f.companions ? { companions: f.companions } : null;
      case 7: return { wishlist: f.wishlist };
      default: return null;
    }
  };

  const next = async (skip = false) => {
    const payload = skip ? null : payloadFor(step);
    const finishing = step === QUESTIONS;
    if (!payload && !finishing) { go(step + 1); return; }
    setSaving(true);
    try {
      await updateProfile({ ...(payload ?? {}), ...(finishing ? { completeOnboarding: true } : {}) });
      go(step + 1);
    } catch (err) {
      const data = err.response?.data;
      Alert.alert('Talaria', data?.errors ? Object.values(data.errors).join('\n') : data?.message || "Impossible d'enregistrer ta réponse.");
    } finally { setSaving(false); }
  };

  const later = async () => {
    try { await SecureStore.setItemAsync(skipKey(user?.id), '1'); } catch { /* sans gravité */ }
    router.replace('/(tabs)/home');
  };

  const canContinue = step !== 1 || f.firstName.trim().length > 0;
  const ctaLabel = step === 0 ? "C'est parti" : step === 4 && f.travelerTypes.length ? `Continuer · ${f.travelerTypes.length}/3`
    : step === QUESTIONS ? 'Voir mon profil' : step === DONE ? 'Découvrir mes voyages' : 'Continuer';
  const onCta = () => (step === DONE ? router.replace('/(tabs)/trips') : step === 0 ? go(1) : next());

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.root}>
      {/* Formes animées du fond */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[s.blob, { transform: [
          { translateX: shape.interpolate({ inputRange: [0, DONE], outputRange: [SHAPES[0].x, SHAPES[2].x] }) },
          { translateY: shape.interpolate({ inputRange: [0, DONE], outputRange: [SHAPES[0].y, SHAPES[3].y + 60] }) },
          { scale: shape.interpolate({ inputRange: [0, 4, DONE], outputRange: [1, 0.8, 1.1] }) },
        ] }]} />
        <Animated.View style={[s.star, { transform: [
          { translateX: shape.interpolate({ inputRange: [0, 4, DONE], outputRange: [SHAPES[1].x2, SHAPES[3].x2, SHAPES[0].x2] }) },
          { translateY: shape.interpolate({ inputRange: [0, 4, DONE], outputRange: [SHAPES[1].y2, SHAPES[2].y2, SHAPES[0].y2 - 260] }) },
          { rotate },
        ] }]} />
        <Animated.View style={[s.blobSmall, { transform: [
          { translateX: shape.interpolate({ inputRange: [0, DONE], outputRange: [80, -60] }) },
          { translateY: shape.interpolate({ inputRange: [0, DONE], outputRange: [560, 640] }) },
        ] }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step >= 1 && step <= QUESTIONS && (
            <View style={s.topBar}>
              <TouchableOpacity style={s.backBtn} onPress={() => go(step - 1)} hitSlop={8}>
                <Ionicons name="arrow-back" size={18} color={Colors.parme} />
              </TouchableOpacity>
              <View style={s.progress}>
                {Array.from({ length: QUESTIONS }, (_, i) => <View key={i} style={[s.progressSeg, i < step && s.progressOn]} />)}
              </View>
              <TouchableOpacity onPress={() => next(true)} hitSlop={8} disabled={saving}><Text style={s.skip}>Passer</Text></TouchableOpacity>
            </View>
          )}
          {step === 0 && (
            <View style={[s.topBar, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity onPress={later} hitSlop={8}><Text style={s.skip}>Plus tard</Text></TouchableOpacity>
            </View>
          )}

          <Animated.View style={{ flex: 1, opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28 * dir.current, 0] }) }] }}>
            {step === 0 && <Welcome />}
            {step === 1 && <NameStep f={f} set={set} user={user} refreshUser={refreshUser} />}
            {step === 2 && <AgeStep age={f.age} onChange={(age) => setF(p => ({ ...p, age, ageTouched: true }))} />}
            {step === 3 && <CityStep f={f} setF={setF} />}
            {step === 4 && <StyleStep value={f.travelerTypes} onChange={set('travelerTypes')} gender={f.gender} />}
            {step === 5 && <BudgetStep value={f.weekendBudget} onChange={set('weekendBudget')} />}
            {step === 6 && <CompanionsStep value={f.companions} onChange={set('companions')} />}
            {step === 7 && <SwipeStep wishlist={f.wishlist} onChange={set('wishlist')} onFinished={() => next()} />}
            {step === DONE && <ReadyStep user={user} f={f} />}
          </Animated.View>

          <View style={s.footer}>
            <TouchableOpacity style={[s.cta, (!canContinue || saving) && { opacity: 0.5 }]} onPress={onCta} disabled={!canContinue || saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={Colors.white} /> : (
                <>
                  <Text style={s.ctaText}>{ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Question({ n, title, subtitle }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.pill}>Question {n} sur {QUESTIONS}</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/* ── 00 · Bienvenue ── */
function Welcome() {
  return (
    <View style={s.page}>
      <View style={s.polaroids}>
        {POLAROIDS.map(p => (
          <View key={p.caption} style={[s.polaroid, p.style]}>
            <Image source={p.image} style={s.polaroidImg} />
            <Text style={s.polaroidCaption}>{p.caption}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text style={s.welcomeTitle}>Faisons{'\n'}connaissance !</Text>
        <Text style={s.subtitle}>7 questions rapides pour te proposer des voyages, des activités et des groupes qui te ressemblent.</Text>
        <View style={s.badges}>
          <Badge icon="time-outline" label="7 questions" dark />
          <Badge icon="calendar-outline" label="≈ 1 minute" />
          <Badge icon="checkmark" label="Modifiable" />
        </View>
      </View>
    </View>
  );
}

function Badge({ icon, label, dark }) {
  return (
    <View style={[s.badge, dark && { backgroundColor: Colors.parme }]}>
      <Ionicons name={icon} size={12} color={dark ? Colors.white : Colors.parme} />
      <Text style={[s.badgeText, dark && { color: Colors.white }]}>{label}</Text>
    </View>
  );
}

/* ── 01 · Prénom et photo ── */
function NameStep({ f, set, user, refreshUser }) {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState(null);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const data = new FormData();
    data.append('picture', { uri, name: `avatar.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    setLocalUri(uri);
    setUploading(true);
    try {
      await client.post('/api/profile/picture', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
    } catch (err) {
      setLocalUri(null);
      Alert.alert('Photo', err.response?.data?.message || "Impossible d'envoyer la photo.");
    } finally { setUploading(false); }
  };

  const hasPhoto = localUri || user?.profilePicture;
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Question n={1} title="Comment on t'appelle ?" subtitle="C'est le nom que verront tes potes de voyage." />
      <TouchableOpacity style={s.photo} onPress={pick} activeOpacity={0.85}>
        {localUri ? <Image source={{ uri: localUri }} style={s.photoImg} />
          : hasPhoto ? <UserAvatar user={user} size={104} />
          : <Ionicons name="camera-outline" size={26} color={Colors.parme} />}
        {uploading && <View style={s.photoLoading}><ActivityIndicator color={Colors.white} /></View>}
        <View style={s.photoPlus}><Ionicons name={hasPhoto ? 'pencil' : 'add'} size={16} color={Colors.white} /></View>
      </TouchableOpacity>
      <Text style={s.photoLabel}>{hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}</Text>
      <TextInput style={s.nameInput} value={f.firstName} onChangeText={set('firstName')} placeholder="Ton prénom"
        placeholderTextColor="#cdbfc8" autoCapitalize="words" autoComplete="given-name" maxLength={40} returnKeyType="done" />
      <View style={s.nameLine} />
      <View style={s.note}><Ionicons name="information-circle-outline" size={13} color={Colors.parme} /><Text style={s.noteText}>Tu pourras le modifier dans ton profil</Text></View>

      <Text style={s.genderTitle}>Comment s'adresser à toi ?</Text>
      <View style={s.genderRow}>
        {GENDERS.map(g => (
          <TouchableOpacity key={g.value} style={[s.genderChip, f.gender === g.value && s.genderChipOn]}
            onPress={() => set('gender')(g.value)} activeOpacity={0.85}>
            <Text style={[s.genderText, f.gender === g.value && { color: Colors.white }]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── 02 · Âge (règle à faire défiler) ── */
function AgeStep({ age, onChange }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  const ages = useMemo(() => Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i), []);
  const scrollTo = (a, animated = true) => ref.current?.scrollTo({ x: (a - MIN_AGE) * TICK, animated });
  useEffect(() => { if (w) setTimeout(() => scrollTo(age, false), 0); }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = (e) => {
    const a = Math.min(MAX_AGE, Math.max(MIN_AGE, MIN_AGE + Math.round(e.nativeEvent.contentOffset.x / TICK)));
    if (a !== age) onChange(a);
  };
  const side = (d) => age + d >= MIN_AGE && age + d <= MAX_AGE ? (
    <TouchableOpacity onPress={() => { onChange(age + d); scrollTo(age + d); }} hitSlop={6}>
      <Text style={[s.ageSide, Math.abs(d) === 2 && { opacity: 0.45 }]}>{age + d}</Text>
    </TouchableOpacity>
  ) : <Text style={[s.ageSide, { opacity: 0 }]}>00</Text>;

  return (
    <View style={s.page}>
      <Question n={2} title="Tu as quel âge ?" subtitle="Ça nous aide à te proposer des activités et des tarifs adaptés (-26 ans, étudiants...)." />
      <View style={s.ageRow}>
        {side(-2)}{side(-1)}
        <Text style={s.ageBig}>{age}</Text>
        {side(1)}{side(2)}
      </View>
      <Text style={s.ageUnit}>ans</Text>
      <View style={s.ruler} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={TICK} decelerationRate="fast"
            onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: (w - TICK) / 2 }}>
            {ages.map(a => (
              <View key={a} style={s.tickCell}>
                <View style={[s.tick, a % 5 === 0 && s.tickMajor]} />
              </View>
            ))}
          </ScrollView>
        )}
        <View style={s.rulerCursor} pointerEvents="none" />
      </View>
      <View style={[s.note, { alignSelf: 'center', marginTop: 22 }]}><Ionicons name="lock-closed-outline" size={12} color={Colors.parme} /><Text style={s.noteText}>Jamais affiché sur ton profil</Text></View>
    </View>
  );
}

/* ── 03 · Ville de départ, gares et aéroports proches ── */
function CityStep({ f, setF }) {
  const [hubs, setHubs] = useState(null);   // null : pas encore cherché
  const place = f.homePlace;
  useEffect(() => {
    if (!place?.latitude) { setHubs(null); return undefined; }
    let cancelled = false;
    client.get('/api/geo/hubs', { params: { city: place.name, lat: place.latitude, lon: place.longitude } })
      .then(({ data }) => {
        if (cancelled) return;
        setHubs(data.hubs ?? []);
        // Par défaut : la gare et l'aéroport les plus proches
        setF(p => (p.homeHubs.length ? p : { ...p, homeHubs: ['train', 'avion'].map(k => data.hubs?.find(h => h.kind === k)?.name).filter(Boolean) }));
      })
      .catch(() => { if (!cancelled) setHubs([]); });
    return () => { cancelled = true; };
  }, [place?.latitude, place?.longitude, place?.name, setF]);

  const toggle = (name) => setF(p => ({ ...p, homeHubs: p.homeHubs.includes(name) ? p.homeHubs.filter(h => h !== name) : [...p.homeHubs, name] }));

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Question n={3} title="D'où pars-tu en général ?" subtitle="On calcule les trajets et les prix depuis chez toi." />
      <PlaceAutocomplete placeholder="Ta ville" icon="search" value={f.homeCity} place={f.homePlace}
        onChangeText={(v) => setF(p => ({ ...p, homeCity: v, homePlace: null, homeHubs: [] }))}
        onSelect={(r) => setF(p => ({ ...p, homeCity: r.name, homePlace: r, homeHubs: [] }))} />
      {place && (
        <>
          <Text style={s.hubsTitle}>Aéroports et gares à proximité</Text>
          {hubs === null ? <ActivityIndicator color={Colors.parme} style={{ alignSelf: 'flex-start' }} />
            : hubs.length === 0 ? <Text style={s.subtitle}>Aucune gare ni aucun aéroport trouvé autour de {place.name}.</Text>
            : (
              <View style={s.hubs}>
                {hubs.map(h => {
                  const on = f.homeHubs.includes(h.name);
                  return (
                    <TouchableOpacity key={h.name} style={[s.hub, on && s.hubOn]} onPress={() => toggle(h.name)} activeOpacity={0.85}>
                      <Ionicons name={on ? 'checkmark' : h.kind === 'avion' ? 'airplane' : 'train'} size={13} color={on ? Colors.white : Colors.parme} />
                      <Text style={[s.hubText, on && { color: Colors.white }]} numberOfLines={1}>{h.name}{h.distanceKm > 3 ? ` · ${h.distanceKm} km` : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
        </>
      )}
    </ScrollView>
  );
}

/* ── 04 · Style de voyageur (3 au plus) ── */
function StyleStep({ value, onChange, gender }) {
  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else if (value.length < 3) onChange([...value, v]);
  };
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Question n={4} title={accord({ gender }, 'Quelle voyageuse es-tu ?', 'Quel voyageur es-tu ?', 'Quel style de voyage te ressemble ?')}
        subtitle="Choisis jusqu'à 3 styles : on s'en sert pour tes suggestions." />
      <View style={s.grid}>
        {TYPES.map((t, i) => {
          const on = value.includes(t.value);
          const tint = i % 3 === 2 || i === 5 ? Colors.orchidee : Colors.white;
          return (
            <TouchableOpacity key={t.value} style={[s.typeCard, { backgroundColor: on ? Colors.parme : tint }, on && s.typeCardOn]}
              onPress={() => toggle(t.value)} activeOpacity={0.85}>
              <View style={[s.typeIcon, on && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name={t.icon} size={17} color={on ? Colors.white : Colors.parme} />
              </View>
              {on && <View style={s.typeCheck}><Ionicons name="checkmark" size={12} color={Colors.parme} /></View>}
              <Text style={[s.typeLabel, on && { color: Colors.white }]}>{typeLabel(t, gender)}</Text>
              <Text style={[s.typeSub, on && { color: 'rgba(255,255,255,0.8)' }]}>{t.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ── 05 · Budget week-end ── */
function BudgetStep({ value, onChange }) {
  const range = rangeOf(value);
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Question n={5} title="Ton budget pour un week-end ?" subtitle="Par personne, transport et logement compris." />
      <Text style={s.budgetBig}>{value >= 1000 ? '1 000 €+' : `${value} €`}</Text>
      <View style={s.budgetTag}><Ionicons name="wallet-outline" size={12} color={Colors.white} /><Text style={s.budgetTagText}>{range.name}</Text></View>
      <View style={{ marginTop: 22 }}>
        <ValueSlider min={50} max={1000} step={10} value={value} onChange={onChange} format={(v) => `${v.toLocaleString('fr-FR')} €`} />
      </View>
      <View style={s.ranges}>
        {BUDGET_RANGES.map(r => (
          <TouchableOpacity key={r.label} style={[s.range, range === r && s.rangeOn]} onPress={() => onChange(r.value)}>
            <Text style={[s.rangeText, range === r && { color: Colors.white }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.info}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.parme} />
        <Text style={s.infoText}>Il sert à te suggérer des destinations et des activités à ta portée. Tu pourras fixer un budget précis pour chaque voyage.</Text>
      </View>
    </ScrollView>
  );
}

/* ── 06 · Compagnons ── */
function CompanionsStep({ value, onChange }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Question n={6} title="Avec qui pars-tu le plus souvent ?" subtitle="Un seul choix : tu pourras créer tous types de groupes." />
      {COMPANIONS.map(c => {
        const on = value === c.value;
        return (
          <TouchableOpacity key={c.value} style={[s.option, on && s.optionOn]} onPress={() => onChange(c.value)} activeOpacity={0.85}>
            <View style={[s.optionIcon, on && { backgroundColor: Colors.orchidee }]}><Ionicons name={c.icon} size={18} color={Colors.parme} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.optionLabel, on && { color: Colors.white }]}>{c.label}</Text>
              <Text style={[s.optionSub, on && { color: 'rgba(255,255,255,0.8)' }]}>{c.sub}</Text>
            </View>
            <View style={[s.radio, on && s.radioOn]}>{on && <Ionicons name="checkmark" size={13} color={Colors.parme} />}</View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ── 07 · Envies : glisser à droite les destinations qui tentent ── */
function SwipeStep({ wishlist, onChange, onFinished }) {
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const live = useRef({});
  live.current = { index, wishlist, onChange };

  const decide = (liked) => {
    const { index: i, wishlist: w, onChange: change } = live.current;
    const d = DESTINATIONS[i];
    if (!d) return;
    if (liked && !w.includes(d.key)) change([...w, d.key]);
    if (!liked && w.includes(d.key)) change(w.filter(k => k !== d.key));
    pan.setValue({ x: 0, y: 0 });
    setIndex(i + 1);
  };
  const fling = (liked, dy = 0) => {
    Animated.timing(pan, { toValue: { x: (liked ? 1 : -1) * SCREEN_W * 1.4, y: dy }, duration: 240, useNativeDriver: true }).start(() => decide(liked));
  };

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
    onPanResponderMove: (_, g) => pan.setValue({ x: g.dx, y: g.dy * 0.3 }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 110 || g.vx > 0.8) fling(true, g.dy * 0.3);
      else if (g.dx < -110 || g.vx < -0.8) fling(false, g.dy * 0.3);
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: true }).start();
    },
  })).current;

  const rotate = pan.x.interpolate({ inputRange: [-220, 0, 220], outputRange: ['-12deg', '0deg', '12deg'] });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, 90], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pan.x.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const finished = index >= DESTINATIONS.length;

  return (
    <View style={s.page}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><Question n={7} title="Ça te tente ?" subtitle="Glisse à droite les destinations qui te font envie." /></View>
        <Text style={s.counter}>{Math.min(index + 1, DESTINATIONS.length)} / {DESTINATIONS.length}</Text>
      </View>

      <View style={s.deck}>
        {finished ? (
          <View style={s.deckDone}>
            <Ionicons name="heart" size={30} color={Colors.parme} />
            <Text style={s.deckDoneTitle}>{wishlist.length ? `${wishlist.length} destination${wishlist.length > 1 ? 's' : ''} dans tes envies` : 'Aucune envie pour le moment'}</Text>
            <TouchableOpacity onPress={() => { onChange([]); setIndex(0); }}><Text style={s.skip}>Recommencer</Text></TouchableOpacity>
          </View>
        ) : DESTINATIONS.slice(index, index + 3).reverse().map((d, k, arr) => {
          const depth = arr.length - 1 - k;             // 0 : carte du dessus
          const top = depth === 0;
          return (
            <Animated.View key={d.key} {...(top ? responder.panHandlers : {})}
              style={[s.card, top ? { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }
                : { transform: [{ translateY: depth * 12 }, { scale: 1 - depth * 0.05 }, { rotate: `${depth * -4}deg` }], opacity: 1 - depth * 0.2 }]}>
              <Image source={d.image} style={StyleSheet.absoluteFill} />
              <View style={s.cardShade} />
              {top && <Animated.Text style={[s.stamp, s.stampLike, { opacity: likeOpacity }]}>ÇA ME TENTE</Animated.Text>}
              {top && <Animated.Text style={[s.stamp, s.stampNope, { opacity: nopeOpacity }]}>BOF</Animated.Text>}
              <View style={s.cardText}>
                <Text style={s.cardTitle}>{d.name}</Text>
                <Text style={s.cardSub}>{d.sub}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {!finished && (
        <View style={s.swipeBtns}>
          <TouchableOpacity style={s.swipeBtn} onPress={() => fling(false)}><Ionicons name="close" size={20} color={Colors.parme} /></TouchableOpacity>
          <TouchableOpacity style={[s.swipeBtn, s.swipeBtnMain]} onPress={() => fling(true)}><Ionicons name="heart-outline" size={24} color={Colors.parme} /></TouchableOpacity>
          <TouchableOpacity style={s.swipeBtn} onPress={() => fling(true)}><Ionicons name="star" size={18} color={Colors.parme} /></TouchableOpacity>
        </View>
      )}
      {finished && <Text style={[s.subtitle, { textAlign: 'center' }]} onPress={onFinished}>Touche « Voir mon profil » pour terminer.</Text>}
    </View>
  );
}

/* ── 08 · Profil prêt ── */
function ReadyStep({ user, f }) {
  const [friends, setFriends] = useState(null);
  useEffect(() => { client.get('/api/friends').then(({ data }) => setFriends(data.length)).catch(() => setFriends(0)); }, []);

  const [a, b] = f.travelerTypes;
  const title = a ? `${TYPE_NOUN[a]}${b ? ` ${TYPE_ADJ[b]}` : ''}` : 'Esprit libre';
  const types = f.travelerTypes.map(t => TYPES.find(x => x.value === t)).filter(Boolean);
  const companion = COMPANIONS.find(c => c.value === f.companions);
  const name = user?.firstName || f.firstName;

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.readyTitle}>Bienvenue à bord{name ? `,\n${name}` : ''} !</Text>
      <Text style={s.subtitle}>Voici ton profil voyageur. Tes amis le verront dans vos groupes.</Text>
      <View style={s.readyCard}>
        <View style={s.readyHead}>
          <View style={s.readyAvatar}><UserAvatar user={user} size={52} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.readyKicker}>TON PROFIL VOYAGEUR</Text>
            <Text style={s.readyName}>{title}</Text>
          </View>
        </View>
        <View style={s.readyLine} />
        <View style={s.readyChips}>
          {types.map(t => <ReadyChip key={t.value} icon={t.icon} label={typeLabel(t, f.gender)} light />)}
          <ReadyChip icon="wallet-outline" label={rangeOf(f.weekendBudget).label} />
          {companion && <ReadyChip icon={companion.icon} label={companion.label} light />}
          {user?.homeCity ? <ReadyChip icon="location-outline" label={`Départ ${user.homeCity}`} light /> : null}
          {user?.birthYear ? <ReadyChip icon="person-outline" label={`${YEAR - user.birthYear} ans`} /> : null}
        </View>
        <View style={s.readyStats}>
          <View style={s.readyStat}>
            <Text style={s.readyStatValue}>{f.wishlist.length}</Text>
            <Text style={s.readyStatLabel}>destination{f.wishlist.length > 1 ? 's' : ''} qui te tente{f.wishlist.length > 1 ? 'nt' : ''}</Text>
          </View>
          <View style={s.readyStat}>
            <Text style={s.readyStatValue}>{friends ?? '…'}</Text>
            <Text style={s.readyStatLabel}>{friends ? `ami${friends > 1 ? 's' : ''} déjà sur Talaria` : 'invite tes potes depuis tes groupes'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ReadyChip({ icon, label, light }) {
  return (
    <View style={[s.readyChip, light ? { backgroundColor: Colors.orchidee } : { backgroundColor: Colors.sableOr }]}>
      <Ionicons name={icon} size={11} color={Colors.parme} />
      <Text style={s.readyChipText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune, overflow: 'hidden' },
  blob: { position: 'absolute', top: 0, left: SCREEN_W / 2 - 170, width: 340, height: 340, borderRadius: 170, backgroundColor: Colors.orchidee, opacity: 0.32 },
  star: { position: 'absolute', top: 0, left: SCREEN_W / 2 - 110, width: 220, height: 220, borderRadius: 64, backgroundColor: Colors.sableOr, opacity: 0.55 },
  blobSmall: { position: 'absolute', top: 0, left: 0, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.sableOr, opacity: 0.4 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, height: 52 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e6dadf' },
  progressOn: { backgroundColor: Colors.parme },
  skip: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, textDecorationLine: 'underline' },

  page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12 },
  pill: { alignSelf: 'flex-start', backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden',
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme, marginBottom: 14 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 28, lineHeight: 33, color: Colors.parme },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, lineHeight: 20, color: Colors.text, opacity: 0.75, marginTop: 8 },

  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: Colors.parme, borderRadius: 100, height: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },

  // 00
  polaroids: { height: 290, marginTop: 10 },
  polaroid: { position: 'absolute', backgroundColor: Colors.white, padding: 8, paddingBottom: 26, borderRadius: 10,
    shadowColor: '#4f203f', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  polaroidImg: { width: 128, height: 128, borderRadius: 4 },
  polaroidCaption: { position: 'absolute', left: 12, bottom: 6, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },
  welcomeTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 36, lineHeight: 40, color: Colors.parme },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  // 01
  photo: { alignSelf: 'center', width: 108, height: 108, borderRadius: 54, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bfa9b7',
    alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  photoImg: { width: 104, height: 104, borderRadius: 52 },
  photoLoading: { ...StyleSheet.absoluteFillObject, borderRadius: 54, backgroundColor: 'rgba(79,32,63,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { position: 'absolute', right: -2, bottom: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.parme,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.sableLune },
  photoLabel: { alignSelf: 'center', fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, marginTop: 10 },
  nameInput: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 34, color: Colors.parme, textAlign: 'center', marginTop: 36, paddingVertical: 6 },
  nameLine: { height: 2, backgroundColor: Colors.parme, marginHorizontal: 20, borderRadius: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 14, backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  noteText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.parme },
  genderTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text, textAlign: 'center', marginTop: 26, marginBottom: 10 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  genderChip: { backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1.5, borderColor: '#ece3e7', paddingVertical: 8, paddingHorizontal: 14 },
  genderChipOn: { backgroundColor: Colors.parme, borderColor: Colors.parme },
  genderText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  // 02
  ageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 30 },
  ageSide: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: '#a8949f' },
  ageBig: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 92, lineHeight: 100, color: Colors.parme, minWidth: 120, textAlign: 'center' },
  ageUnit: { alignSelf: 'center', fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  ruler: { height: 56, marginTop: 22, marginHorizontal: -24, justifyContent: 'center' },
  tickCell: { width: TICK, height: 56, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 1.5, height: 18, backgroundColor: '#bfa9b7', borderRadius: 1 },
  tickMajor: { height: 30, backgroundColor: '#8f7686' },
  rulerCursor: { position: 'absolute', alignSelf: 'center', width: 3, height: 44, borderRadius: 2, backgroundColor: Colors.parme },

  // 03
  hubsTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 24, marginBottom: 10 },
  hubs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hub: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  hubOn: { backgroundColor: Colors.parme },
  hubText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, flexShrink: 1 },

  // 04
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  typeCard: { width: (SCREEN_W - 48 - 12) / 2, borderRadius: 18, padding: 14, minHeight: 112, justifyContent: 'flex-end' },
  typeCardOn: { shadowColor: '#4f203f', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  typeIcon: { position: 'absolute', top: 14, left: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(79,32,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  typeCheck: { position: 'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.orchidee, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme },
  typeSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.parme, opacity: 0.75, marginTop: 2 },

  // 05
  budgetBig: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 72, color: Colors.parme, textAlign: 'center', marginTop: 24 },
  budgetTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  budgetTagText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  range: { backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  rangeOn: { backgroundColor: Colors.parme },
  rangeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },
  info: { flexDirection: 'row', gap: 8, backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginTop: 20, alignItems: 'flex-start' },
  infoText: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, lineHeight: 17, color: Colors.text },

  // 06
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 18, padding: 14, marginBottom: 10 },
  optionOn: { backgroundColor: Colors.parme },
  optionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sableOr, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme },
  optionSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#bfa9b7', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: Colors.orchidee, borderColor: Colors.orchidee },

  // 07
  counter: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.textMuted, marginBottom: 22 },
  deck: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', width: SCREEN_W - 88, aspectRatio: 0.78, maxHeight: '100%', borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.orchidee,
    shadowColor: '#4f203f', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: 'rgba(30,10,24,0.38)' },
  cardText: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  cardTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, color: Colors.white },
  cardSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
  stamp: { position: 'absolute', top: 18, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden',
    fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },
  stampLike: { right: 16, backgroundColor: Colors.orchidee, transform: [{ rotate: '8deg' }] },
  stampNope: { left: 16, backgroundColor: Colors.white, transform: [{ rotate: '-8deg' }] },
  deckDone: { alignItems: 'center', gap: 10 },
  deckDoneTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.parme },
  swipeBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 12 },
  swipeBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(201,178,215,0.4)', alignItems: 'center', justifyContent: 'center' },
  swipeBtnMain: { width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.orchidee },

  // 08
  readyTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, lineHeight: 35, color: Colors.parme, marginTop: 16 },
  readyCard: { backgroundColor: Colors.parme, borderRadius: 26, padding: 18, marginTop: 22,
    shadowColor: '#4f203f', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  readyHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  readyAvatar: { borderWidth: 2, borderColor: Colors.orchidee, borderRadius: 30, padding: 2 },
  readyKicker: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 10, letterSpacing: 0.6, color: 'rgba(255,255,255,0.7)' },
  readyName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 21, color: Colors.white, marginTop: 2 },
  readyLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },
  readyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  readyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  readyChipText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },
  readyStats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  readyStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14 },
  readyStatValue: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, color: Colors.white },
  readyStatLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});

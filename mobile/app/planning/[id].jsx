import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, Alert, Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client from '../../api/client';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';

const SLOTS = [
  { value: 'matin',      label: 'Matin',      icon: '🌅' },
  { value: 'midi',       label: 'Midi',       icon: '🍽' },
  { value: 'apres-midi', label: 'Après-midi', icon: '☀️' },
  { value: 'soir',       label: 'Soir',       icon: '🌙' },
];

const CATEGORIES = [
  { value: 'visite',     label: 'Visite',     icon: '🏛' },
  { value: 'culture',    label: 'Culture',    icon: '🎨' },
  { value: 'restaurant', label: 'Resto',      icon: '🍽' },
  { value: 'bar',        label: 'Bar',        icon: '🍸' },
  { value: 'plage',      label: 'Plage',      icon: '🏖' },
  { value: 'sport',      label: 'Sport',      icon: '🏄' },
];

const EMPTY_ACTIVITY = {
  title: '', description: '', category: '', price: '',
  hasSpecialPrice: false, specialPriceNote: '',
};

/** Tags pour lesquels on propose les établissements de la carte autour de la destination */
const VENUE_TAGS = ['restaurant', 'bar'];

/** Zone de recherche autour de la destination (~25 km), au format bbox de /api/places */
const RADIUS_DEG = 0.25;

/** Coordonnées de la destination (null si introuvable). Android exige la permission de localisation. */
async function geocode(destination) {
  try {
    await Location.requestForegroundPermissionsAsync();
    const [geo] = await Location.geocodeAsync(destination);
    return geo ? { lat: geo.latitude, lng: geo.longitude } : null;
  } catch {
    return null;
  }
}

const fmtEur = (n) => `${(n ?? 0).toLocaleString('fr-FR')} €`;
const catIcon = (v) => CATEGORIES.find(c => c.value === v)?.icon ?? '📍';

/** Jours du voyage au format AAAA-MM-JJ (calculés en UTC pour éviter les décalages de fuseau). */
function tripDays(start, end) {
  const days = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && days.length < 60) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

const fmtDay = (iso, opts) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...opts });

/* ════════════════════════════════════
   ACTIVITY CARD
   ════════════════════════════════════ */
function ActivityCard({ activity, onEdit, onDelete }) {
  return (
    <TouchableOpacity style={s.activity} activeOpacity={0.85} onPress={() => onEdit(activity)}>
      <Text style={s.activityIcon}>{catIcon(activity.category)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.activityTitle}>{activity.title}</Text>
        {activity.description ? <Text style={s.activityDesc} numberOfLines={2}>{activity.description}</Text> : null}
        <View style={s.activityMeta}>
          {activity.price != null && <Text style={s.activityPrice}>💰 {fmtEur(activity.price)} / pers.</Text>}
          {activity.place && <Text style={s.activityPrice}>📍 Lieu de la carte</Text>}
          {activity.hasSpecialPrice && (
            <Text style={s.badge}>🏷 {activity.specialPriceNote || 'Prix spécial'}</Text>
          )}
          {activity.isAuto && <Text style={[s.badge, s.badgeAuto]}>✨ Suggestion</Text>}
        </View>
      </View>
      <TouchableOpacity onPress={() => onDelete(activity)} hitSlop={10}>
        <Ionicons name="trash-outline" size={16} color="#dc2626" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════
   CREATE / EDIT MODAL
   ════════════════════════════════════ */
function ActivityFormModal({ visible, tripId, days, initial, priceDefaults, getCoords, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form,    setForm]    = useState(EMPTY_ACTIVITY);
  const [date,    setDate]    = useState('');
  const [slot,    setSlot]    = useState('matin');
  const [place,   setPlace]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [venues,  setVenues]  = useState({ category: null, places: [] });

  useEffect(() => {
    if (!visible || !initial) return;
    setError('');
    setDate(initial.date);
    setSlot(initial.slot);
    setPlace(initial.place ?? null);
    setForm({
      title:            initial.title            ?? '',
      description:      initial.description      ?? '',
      category:         initial.category         ?? '',
      price:            initial.price != null ? String(initial.price) : '',
      hasSpecialPrice:  initial.hasSpecialPrice  ?? false,
      specialPriceNote: initial.specialPriceNote ?? '',
    });
  }, [visible, initial]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  /* Changer de type pré-remplit le prix moyen du tag, sauf si l'utilisateur a saisi son propre prix */
  const selectCategory = (value) => setForm(f => {
    const category = f.category === value ? '' : value;
    const priceIsDefault = f.price === '' || parseInt(f.price) === priceDefaults[f.category];
    const nextDefault = priceDefaults[category];
    return {
      ...f,
      category,
      price: priceIsDefault && !place ? (nextDefault != null ? String(nextDefault) : '') : f.price,
    };
  });

  /* Restos / bars : établissements de la carte autour de la destination */
  const isVenue = VENUE_TAGS.includes(form.category);
  const venuesLoading = isVenue && venues.category !== form.category;
  useEffect(() => {
    if (!visible || !VENUE_TAGS.includes(form.category)) return;
    let cancelled = false;
    const category = form.category;
    getCoords()
      .then(coords => {
        if (!coords) return [];
        const bbox = [coords.lat - RADIUS_DEG, coords.lng - RADIUS_DEG, coords.lat + RADIUS_DEG, coords.lng + RADIUS_DEG].join(',');
        return client.get('/api/places', { params: { tags: category, bbox, recommended: true } }).then(res => res.data.places);
      })
      .catch(() => [])
      .then(places => !cancelled && setVenues({ category, places }));
    return () => { cancelled = true; };
  }, [visible, form.category, getCoords]);

  const pickVenue = (p) => {
    setPlace({ id: p.id, name: p.name });
    setForm(f => {
      const price = p.averagePrice ?? priceDefaults[f.category];
      return {
        ...f,
        title: p.name,
        description: f.description || p.description || '',
        price: price != null ? String(price) : '',
      };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Donnez un titre à l\'activité.'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        ...form,
        date, slot,
        placeId: place?.id ?? null,
        price: form.price !== '' ? parseInt(form.price) : null,
      };
      const res = isEdit
        ? await client.patch(`/api/trips/${tripId}/activities/${initial.id}`, payload)
        : await client.post(`/api/trips/${tripId}/activities`, payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur serveur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={ms.headerTitle}>{isEdit ? 'Modifier l\'activité' : 'Nouvelle activité'}</Text>
        </View>

        <ScrollView contentContainerStyle={ms.content} keyboardShouldPersistTaps="handled">
          <Text style={ms.label}>Titre</Text>
          <TextInput style={ms.input} placeholder="Visite du Colisée" placeholderTextColor={Colors.textMuted}
            value={form.title} onChangeText={set('title')} />

          <Text style={ms.label}>Jour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {days.map((d, i) => (
              <TouchableOpacity key={d} style={[ms.pill, date === d && ms.pillActive, { marginRight: 6 }]}
                onPress={() => setDate(d)}>
                <Text style={[ms.pillText, date === d && ms.pillTextActive]}>
                  J{i + 1} · {fmtDay(d, { day: '2-digit', month: 'short' })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Créneau</Text>
          <View style={ms.pills}>
            {SLOTS.map(sl => (
              <TouchableOpacity key={sl.value} style={[ms.pill, slot === sl.value && ms.pillActive]}
                onPress={() => setSlot(sl.value)}>
                <Text style={[ms.pillText, slot === sl.value && ms.pillTextActive]}>{sl.icon} {sl.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={ms.label}>Type</Text>
          <View style={ms.pills}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c.value} style={[ms.pill, form.category === c.value && ms.pillActive]}
                onPress={() => selectCategory(c.value)}>
                <Text style={[ms.pillText, form.category === c.value && ms.pillTextActive]}>{c.icon} {c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isVenue && (
            <>
              <Text style={ms.label}>{form.category === 'bar' ? 'Bars' : 'Restaurants'} à proximité</Text>
              {venuesLoading ? (
                <ActivityIndicator color={Colors.parme} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
              ) : venues.places.length === 0 ? (
                <Text style={ms.hint}>Aucun lieu de ce type sur la carte autour de la destination — saisissez-le librement.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {venues.places.slice(0, 8).map(p => (
                    <TouchableOpacity key={p.id} style={[ms.venue, place?.id === p.id && ms.pillActive]} onPress={() => pickVenue(p)}>
                      <Text style={ms.venueName} numberOfLines={1}>{p.name}</Text>
                      <Text style={ms.venueMeta}>
                        {p.averagePrice != null ? `~${fmtEur(p.averagePrice)}` : 'prix moyen'} · ❤️ {p.likesCount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {place && (
            <View style={ms.linkedPlace}>
              <Text style={ms.linkedPlaceText} numberOfLines={1}>📍 Lieu de la carte : {place.name}</Text>
              <TouchableOpacity onPress={() => setPlace(null)}>
                <Text style={ms.linkedPlaceBtn}>Détacher</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={ms.label}>Prix par personne (€, optionnel)</Text>
          <TextInput style={ms.input} placeholder="25" placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad" value={form.price} onChangeText={set('price')} />
          {priceDefaults[form.category] != null && (
            <Text style={ms.hint}>
              Prix moyen {CATEGORIES.find(c => c.value === form.category)?.label.toLowerCase()} : {fmtEur(priceDefaults[form.category])} / pers. — modifiable
            </Text>
          )}

          <View style={ms.checkRow}>
            <Switch value={form.hasSpecialPrice} onValueChange={set('hasSpecialPrice')}
              thumbColor={form.hasSpecialPrice ? Colors.parme : '#f4f4f4'} trackColor={{ true: Colors.orchidee }} />
            <Text style={ms.checkLabel}>Tarif spécial (réduction CE, promo...)</Text>
          </View>
          {form.hasSpecialPrice && (
            <TextInput style={ms.input} placeholder="Ex: -15% avec la carte CE" placeholderTextColor={Colors.textMuted}
              value={form.specialPriceNote} onChangeText={set('specialPriceNote')} />
          )}

          <Text style={ms.label}>Notes (optionnel)</Text>
          <TextInput style={[ms.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline
            placeholder="Réserver à l'avance, horaires..." placeholderTextColor={Colors.textMuted}
            value={form.description} onChangeText={set('description')} />

          {!!error && <View style={ms.errorBox}><Text style={ms.errorText}>{error}</Text></View>}
        </ScrollView>

        <View style={ms.footer}>
          <TouchableOpacity style={ms.backBtn} onPress={onClose}>
            <Text style={ms.backBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ms.nextBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
            <Text style={ms.nextBtnText}>{saving ? 'Enregistrement...' : isEdit ? 'Sauvegarder' : 'Ajouter'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ════════════════════════════════════
   SCREEN
   ════════════════════════════════════ */
export default function PlanningScreen() {
  const { id }    = useLocalSearchParams();
  const router    = useRouter();
  const { theme } = useTheme();

  const [trip,           setTrip]           = useState(null);
  const [activities,     setActivities]     = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [selectedDay,    setSelectedDay]    = useState(null);
  const [modalInitial,   setModalInitial]   = useState(null);
  const [priceDefaults,  setPriceDefaults]  = useState({});

  const fetchAll = useCallback(async () => {
    try {
      const [t, a, acc, defaults] = await Promise.all([
        client.get(`/api/trips/${id}`),
        client.get(`/api/trips/${id}/activities`),
        client.get(`/api/trips/${id}/accommodations`),
        client.get('/api/price-defaults'),
      ]);
      setTrip(t.data);
      setActivities(a.data);
      setAccommodations(acc.data);
      setPriceDefaults(defaults.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le planning.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const days = useMemo(() => trip ? tripDays(trip.startDate, trip.endDate) : [], [trip]);

  useEffect(() => {
    if (days.length && !days.includes(selectedDay)) setSelectedDay(days[0]);
  }, [days, selectedDay]);

  const countByDay = useMemo(() => {
    const m = {};
    activities.forEach(a => { m[a.date] = (m[a.date] ?? 0) + 1; });
    return m;
  }, [activities]);

  /*
   * Budget. Les prix d'activités sont par personne ; logements et transport sont des totaux.
   * Budget du groupe = activités × voyageurs + logements + transport, comparé au budget prévu
   * (peut devenir négatif). Budget individuel = part de chacun.
   */
  const costs = useMemo(() => {
    const travelers = Math.max(1, trip?.travelers ?? 1);
    const isFood = (a) => VENUE_TAGS.includes(a.category);
    const food   = activities.filter(isFood).reduce((sum, a) => sum + (a.price ?? 0), 0);
    const other  = activities.filter(a => !isFood(a)).reduce((sum, a) => sum + (a.price ?? 0), 0);
    const accom  = accommodations.reduce((sum, a) => sum + (a.price ?? 0), 0);
    const trans  = trip?.computedTotalCost ?? 0;
    const group  = (food + other) * travelers + accom + trans;
    return { travelers, food, other, accom, trans, group, perPerson: Math.round(group / travelers) };
  }, [activities, accommodations, trip]);

  const remaining = trip?.budget != null ? trip.budget - costs.group : null;

  /* Coordonnées de la destination, géocodées une seule fois par écran */
  const coordsRef = useRef(null);
  const destination = trip?.destination;
  const getCoords = useCallback(() => {
    if (!coordsRef.current) coordsRef.current = geocode(destination);
    return coordsRef.current;
  }, [destination]);

  const runGenerate = async (replaceAuto) => {
    setGenerating(true);
    try {
      // Coordonnées de la destination pour proposer des lieux de la carte à proximité
      const coords = await getCoords();

      const { data } = await client.post(`/api/trips/${id}/activities/generate`, { ...coords, replaceAuto });
      setActivities(data.activities);
      if (data.created === 0) {
        Alert.alert('Planning complet', 'Tous les créneaux du matin et du midi sont déjà remplis.');
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de générer le planning.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (!activities.some(a => a.isAuto)) { runGenerate(false); return; }
    Alert.alert('Remplir le planning', 'Vos activités ajoutées ou modifiées à la main sont toujours conservées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Compléter les créneaux vides', onPress: () => runGenerate(false) },
      { text: 'Refaire les suggestions', style: 'destructive', onPress: () => runGenerate(true) },
    ]);
  };

  const handleSaved = (activity) => {
    setActivities(prev => {
      const next = prev.some(a => a.id === activity.id)
        ? prev.map(a => a.id === activity.id ? activity : a)
        : [...prev, activity];
      return next;
    });
    setSelectedDay(activity.date);
    setModalInitial(null);
  };

  const handleDelete = (activity) => {
    Alert.alert('Supprimer cette activité ?', activity.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/api/trips/${id}/activities/${activity.id}`);
            setActivities(prev => prev.filter(a => a.id !== activity.id));
          } catch {}
        },
      },
    ]);
  };

  if (loading || !trip) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: theme.sableLune, justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.parme} />
      </SafeAreaView>
    );
  }

  const dayActivities = activities.filter(a => a.date === selectedDay);
  const dayIndex = days.indexOf(selectedDay);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.sableLune }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.white, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Planning · {trip.destination}</Text>
          <Text style={[s.headerSub, { color: theme.textMuted }]}>
            {days.length} jour{days.length > 1 ? 's' : ''} · {activities.length} activité{activities.length > 1 ? 's' : ''}
            {trip.group ? ` · 👥 ${trip.group.name}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.parme} />}
      >
        {/* Budget */}
        <View style={s.budgetBox}>
          <Text style={s.budgetCaption}>Par personne</Text>
          <View style={s.costRow}><Text style={s.costLabel}>🎯 Activités</Text><Text style={s.costVal}>{fmtEur(costs.other)}</Text></View>
          <View style={s.costRow}><Text style={s.costLabel}>🍽 Restos & bars</Text><Text style={s.costVal}>{fmtEur(costs.food)}</Text></View>

          <Text style={s.budgetCaption}>Groupe · {costs.travelers} voyageur{costs.travelers > 1 ? 's' : ''}</Text>
          <View style={s.costRow}>
            <Text style={s.costLabel}>Activités, restos & bars (× {costs.travelers})</Text>
            <Text style={s.costVal}>{fmtEur((costs.other + costs.food) * costs.travelers)}</Text>
          </View>
          <View style={s.costRow}><Text style={s.costLabel}>🏨 Logements</Text><Text style={s.costVal}>{fmtEur(costs.accom)}</Text></View>
          <View style={s.costRow}><Text style={s.costLabel}>🚗 Transport</Text><Text style={s.costVal}>{fmtEur(costs.trans)}</Text></View>
          <View style={[s.costRow, s.costTotal]}>
            <Text style={[s.costLabel, s.costLabelBold]}>Total du groupe</Text>
            <Text style={[s.costVal, { color: Colors.parme }]}>{fmtEur(costs.group)}</Text>
          </View>
          {costs.travelers > 1 && (
            <View style={s.costRow}>
              <Text style={s.costLabel}>Soit par personne</Text>
              <Text style={s.costVal}>{fmtEur(costs.perPerson)}</Text>
            </View>
          )}
          {remaining != null && (
            <View style={s.costRow}>
              <Text style={s.costLabel}>Budget restant (sur {fmtEur(trip.budget)})</Text>
              <Text style={[s.costVal, { color: remaining < 0 ? Colors.error : '#16a34a' }]}>{fmtEur(remaining)}</Text>
            </View>
          )}
        </View>

        {/* Auto-remplissage */}
        <TouchableOpacity style={[s.generateBtn, generating && { opacity: 0.6 }]} disabled={generating} onPress={handleGenerate}>
          {generating
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={s.generateBtnText}>✨ Remplir automatiquement</Text>}
        </TouchableOpacity>
        <Text style={s.generateHint}>2 activités par jour (matin + midi) selon vos préférences et les lieux de la carte.</Text>

        {/* Calendrier */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayStrip}>
          {days.map((d, i) => {
            const active = d === selectedDay;
            return (
              <TouchableOpacity key={d} style={[s.dayChip, active && s.dayChipActive]} onPress={() => setSelectedDay(d)}>
                <Text style={[s.dayChipWeek, active && s.dayChipTextActive]}>{fmtDay(d, { weekday: 'short' })}</Text>
                <Text style={[s.dayChipNum, active && s.dayChipTextActive]}>{fmtDay(d, { day: '2-digit' })}</Text>
                <Text style={[s.dayChipWeek, active && s.dayChipTextActive]}>J{i + 1}</Text>
                <View style={[s.dayDot, !countByDay[d] && { opacity: 0 }, active && { backgroundColor: Colors.white }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Journée sélectionnée */}
        <Text style={[s.dayTitle, { color: theme.text }]}>
          Jour {dayIndex + 1} — {fmtDay(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}
          <Text style={s.dayTotal}>{'  '}{fmtEur(dayActivities.reduce((sum, a) => sum + (a.price ?? 0), 0))} / pers.</Text>
        </Text>

        {SLOTS.map(sl => {
          const items = dayActivities.filter(a => a.slot === sl.value);
          return (
            <View key={sl.value} style={s.slot}>
              <View style={s.slotHeader}>
                <Text style={[s.slotTitle, { color: theme.text }]}>{sl.icon} {sl.label}</Text>
                <TouchableOpacity onPress={() => setModalInitial({ date: selectedDay, slot: sl.value })}>
                  <Text style={s.slotAdd}>+ Ajouter</Text>
                </TouchableOpacity>
              </View>
              {items.length === 0
                ? <Text style={s.slotEmpty}>Rien de prévu</Text>
                : items.map(a => (
                    <ActivityCard key={a.id} activity={a} onEdit={setModalInitial} onDelete={handleDelete} />
                  ))}
            </View>
          );
        })}
      </ScrollView>

      <ActivityFormModal
        visible={!!modalInitial}
        tripId={id}
        days={days}
        initial={modalInitial}
        priceDefaults={priceDefaults}
        getCoords={getCoords}
        onClose={() => setModalInitial(null)}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

/* ════════════════════════════════════
   STYLES
   ════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 17, color: Colors.text },
  headerSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },

  budgetBox: {
    backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    margin: 16, marginBottom: 12, padding: 14, gap: 6,
  },
  costRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costTotal:     { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 6 },
  costLabel:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  costLabelBold: { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.text },
  costVal:       { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },

  generateBtn: {
    backgroundColor: Colors.parme, borderRadius: 100, marginHorizontal: 16,
    paddingVertical: 13, alignItems: 'center',
  },
  generateBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
  generateHint: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted,
    textAlign: 'center', marginTop: 6, marginHorizontal: 24,
  },

  dayStrip: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  dayChip: {
    width: 58, paddingVertical: 8, borderRadius: 14, alignItems: 'center', gap: 2,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  dayChipActive:     { backgroundColor: Colors.parme, borderColor: Colors.parme },
  dayChipWeek:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 10, color: Colors.textMuted, textTransform: 'capitalize' },
  dayChipNum:        { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: Colors.text },
  dayChipTextActive: { color: Colors.white },
  dayDot:            { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.parme, marginTop: 2 },

  dayTitle: {
    fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 16, color: Colors.text,
    marginHorizontal: 16, marginBottom: 8, textTransform: 'capitalize',
  },

  slot:       { marginHorizontal: 16, marginBottom: 14 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  slotTitle:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  slotAdd:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },
  slotEmpty: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, textAlign: 'center',
  },

  activity: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 12, marginBottom: 6,
  },
  activityIcon:  { fontSize: 20 },
  activityTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  activityDesc:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  activityMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  activityPrice: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  badge: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme,
    backgroundColor: Colors.parmeLight, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeAuto: { backgroundColor: Colors.sableOr },

  budgetCaption: {
    fontFamily: 'BricolageGrotesque_700Bold', fontSize: 10, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
  },
  dayTotal: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.textMuted, textTransform: 'none' },
});

const ms = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 17, color: Colors.text },

  content: { padding: 16, paddingBottom: 24, gap: 4 },
  label: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.text, marginBottom: 5, marginTop: 4 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, marginBottom: 10,
  },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 100, paddingVertical: 8, paddingHorizontal: 14,
  },
  pillActive:     { borderColor: Colors.parme, backgroundColor: Colors.parmeLight },
  pillText:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  pillTextActive: { color: Colors.parme },

  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },

  hint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: -4, marginBottom: 12 },

  venue: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, maxWidth: 180,
  },
  venueName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.text },
  venueMeta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  linkedPlace: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.sableLune, borderRadius: 10, padding: 10, marginBottom: 12,
  },
  linkedPlaceText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, flex: 1 },
  linkedPlaceBtn:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },
  checkLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text, flex: 1 },

  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 8 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white,
  },
  backBtn:     { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.border },
  backBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  nextBtn:     { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100, backgroundColor: Colors.parme },
  nextBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});

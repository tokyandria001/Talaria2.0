import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, TextInput,
  Modal, Alert, Switch, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import TalariaLogo from '../../components/TalariaLogo';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';

const TRANSPORT = [
  { value: 'voiture', label: 'Voiture', icon: '🚗' },
  { value: 'avion',   label: 'Avion',   icon: '✈️' },
  { value: 'train',   label: 'Train',   icon: '🚄' },
  { value: 'bus',     label: 'Bus',     icon: '🚌' },
];

const BOOKING_TYPES = [
  { value: 'vol',      label: 'Vol',      icon: '✈️' },
  { value: 'hotel',    label: 'Hôtel',    icon: '🏨' },
  { value: 'activite', label: 'Activité', icon: '🎯' },
  { value: 'autre',    label: 'Autre',    icon: '🔗' },
];

const ACCOM_TYPES = [
  { value: 'hotel',  label: 'Hôtel',  icon: '🏨' },
  { value: 'airbnb', label: 'Airbnb', icon: '🏠' },
  { value: 'autre',  label: 'Autre',  icon: '🔗' },
];

const EMPTY_ACCOM = {
  name: '', type: 'hotel', checkIn: '', checkOut: '',
  price: '', hasSpecialPrice: false, specialPriceNote: '', link: '',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
/** Ajoute https:// si l'utilisateur a saisi un lien sans protocole (ex. booking.com/...) */
const withScheme = (u) => { const v = (u ?? '').trim(); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `https://${v}` : v; };
const fmtEur  = (n) => n != null ? `${n.toLocaleString('fr-FR')} €` : '—';
const nights  = (s, e) => Math.max(0, Math.round((new Date(e) - new Date(s)) / 86_400_000));
const tIcon   = (v) => TRANSPORT.find(t => t.value === v)?.icon ?? '✈️';
const tLabel  = (v) => TRANSPORT.find(t => t.value === v)?.label ?? v;

function computeFuel(km, price, conso) {
  const d = parseFloat(km), p = parseFloat(price), c = parseFloat(conso);
  if (!d || !p || !c) return null;
  return Math.round((d * 2) * (c / 100) * p);
}

/* ════════════════════════════════════
   TRIP CARD
   ════════════════════════════════════ */
function TripCard({ trip, onEdit, onDelete, onPlanning }) {
  const n = nights(trip.startDate, trip.endDate);

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => onEdit(trip)}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardDest}>{trip.destination}</Text>
          {trip.title ? <Text style={s.cardTitle}>{trip.title}</Text> : null}
        </View>
        <View style={s.transBadge}>
          <Text style={s.transBadgeText}>{tIcon(trip.transportMode)} {tLabel(trip.transportMode)}</Text>
        </View>
      </View>

      <View style={s.cardDates}>
        <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
        <Text style={s.cardDateText}>
          {fmtDate(trip.startDate)} → {fmtDate(trip.endDate)}
          {'  '}<Text style={s.cardNights}>({n} nuit{n > 1 ? 's' : ''})</Text>
        </Text>
      </View>

      <View style={s.cardMeta}>
        <Text style={s.metaItem}>👥 <Text style={s.metaBold}>{trip.travelers}</Text> voyageur{trip.travelers > 1 ? 's' : ''}</Text>
        <Text style={s.metaItem}>📍 <Text style={s.metaBold}>{trip.departureCity}</Text></Text>
        {trip.budget ? <Text style={s.metaItem}>💰 <Text style={s.metaBold}>{fmtEur(trip.budget)}</Text></Text> : null}
      </View>

      {trip.transportMode === 'voiture' && (trip.computedFuelCost || trip.tollCost) ? (
        <View style={s.costsBox}>
          {trip.computedFuelCost != null && (
            <View style={s.costRow}>
              <Text style={s.costLabel}>⛽ Carburant A/R</Text>
              <Text style={s.costVal}>{fmtEur(trip.computedFuelCost)}</Text>
            </View>
          )}
          {trip.tollCost != null && (
            <View style={s.costRow}>
              <Text style={s.costLabel}>🛣 Péages</Text>
              <Text style={s.costVal}>{fmtEur(trip.tollCost)}</Text>
            </View>
          )}
          {trip.computedTotalCost != null && (
            <View style={[s.costRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 4 }]}>
              <Text style={[s.costLabel, { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.text }]}>Total transport</Text>
              <Text style={[s.costVal, { color: Colors.parme }]}>{fmtEur(trip.computedTotalCost)}</Text>
            </View>
          )}
        </View>
      ) : null}

      {trip.bookingLinks?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {trip.bookingLinks.map((b, i) => (
            <TouchableOpacity key={i} style={s.bookingChip} onPress={() => Linking.openURL(b.url)}>
              <Text style={s.bookingChipText}>
                {BOOKING_TYPES.find(t => t.value === b.type)?.icon} {b.label}
              </Text>
            </TouchableOpacity>
          ))}
          {trip.rentalLink ? (
            <TouchableOpacity style={s.bookingChip} onPress={() => Linking.openURL(trip.rentalLink)}>
              <Text style={s.bookingChipText}>🚙 Location</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      <View style={s.cardActions}>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => onPlanning(trip)}>
          <Ionicons name="calendar-outline" size={13} color={Colors.white} />
          <Text style={[s.actionBtnText, { color: Colors.white }]}>Planning</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onEdit(trip)}>
          <Ionicons name="pencil-outline" size={13} color={Colors.parme} />
          <Text style={s.actionBtnText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => onDelete(trip)}>
          <Ionicons name="trash-outline" size={13} color="#dc2626" />
          <Text style={[s.actionBtnText, { color: '#dc2626' }]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════
   CREATE / EDIT MODAL
   ════════════════════════════════════ */
const EMPTY = {
  title: '', destination: '', departureCity: '',
  startDate: '', endDate: '', travelers: '2', budget: '',
  transportMode: 'avion',
  distanceKm: '', fuelPricePerLiter: '', fuelConsumption: '', tollCost: '',
  needsRental: false, rentalLink: '', rentalCost: '',
  bookingLinks: [],
};

function TripFormModal({ visible, trip, onClose, onSaved }) {
  const isEdit = !!trip;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bType, setBType] = useState('hotel');
  const [bLabel, setBLabel] = useState('');
  const [bUrl, setBUrl] = useState('');

  const [accommodations,  setAccommodations]  = useState([]);
  const [accomForm,       setAccomForm]       = useState(EMPTY_ACCOM);
  const [editingAccomId,  setEditingAccomId]  = useState(null);
  const [savingAccom,     setSavingAccom]     = useState(false);

  const resetAccomForm = () => { setAccomForm(EMPTY_ACCOM); setEditingAccomId(null); };

  const fetchAccommodations = useCallback(async () => {
    if (!trip?.id) return;
    try {
      const { data } = await client.get(`/api/trips/${trip.id}/accommodations`);
      setAccommodations(data);
    } catch { setAccommodations([]); }
  }, [trip?.id]);

  const startEditAccom = (a) => {
    setAccomForm({
      name: a.name, type: a.type, checkIn: a.checkIn, checkOut: a.checkOut,
      price: a.price != null ? String(a.price) : '',
      hasSpecialPrice: a.hasSpecialPrice, specialPriceNote: a.specialPriceNote ?? '',
      link: a.link ?? '',
    });
    setEditingAccomId(a.id);
  };

  const saveAccom = async () => {
    if (!accomForm.name.trim() || !accomForm.checkIn || !accomForm.checkOut) {
      Alert.alert('Champs manquants', 'Nom et dates sont requis.');
      return;
    }
    setSavingAccom(true);
    try {
      const payload = { ...accomForm, link: withScheme(accomForm.link), price: accomForm.price !== '' ? parseInt(accomForm.price) : null };
      const res = editingAccomId
        ? await client.patch(`/api/trips/${trip.id}/accommodations/${editingAccomId}`, payload)
        : await client.post(`/api/trips/${trip.id}/accommodations`, payload);
      setAccommodations(prev => {
        const next = editingAccomId ? prev.map(a => a.id === res.data.id ? res.data : a) : [...prev, res.data];
        return [...next].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      });
      resetAccomForm();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'enregistrer le logement.");
    } finally {
      setSavingAccom(false);
    }
  };

  const deleteAccom = (a) => {
    Alert.alert('Supprimer ce logement ?', a.name, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/api/trips/${trip.id}/accommodations/${a.id}`);
            setAccommodations(prev => prev.filter(x => x.id !== a.id));
            if (editingAccomId === a.id) resetAccomForm();
          } catch {}
        },
      },
    ]);
  };

  useEffect(() => {
    if (visible) {
      setStep(0); setError('');
      resetAccomForm();
      fetchAccommodations();
      setForm(trip ? {
        title:            trip.title            ?? '',
        destination:      trip.destination,
        departureCity:    trip.departureCity,
        startDate:        trip.startDate,
        endDate:          trip.endDate,
        travelers:        String(trip.travelers),
        budget:           trip.budget           != null ? String(trip.budget) : '',
        transportMode:    trip.transportMode,
        distanceKm:       trip.distanceKm       != null ? String(trip.distanceKm) : '',
        fuelPricePerLiter:trip.fuelPricePerLiter != null ? String(trip.fuelPricePerLiter) : '',
        fuelConsumption:  trip.fuelConsumption  != null ? String(trip.fuelConsumption) : '',
        tollCost:         trip.tollCost         != null ? String(trip.tollCost) : '',
        needsRental:      trip.needsRental,
        rentalLink:       trip.rentalLink       ?? '',
        rentalCost:       trip.rentalCost       != null ? String(trip.rentalCost) : '',
        bookingLinks:     trip.bookingLinks     ?? [],
      } : { ...EMPTY });
    }
  }, [visible, trip, fetchAccommodations]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const fuelPreview = computeFuel(form.distanceKm, form.fuelPricePerLiter, form.fuelConsumption);

  const addBooking = () => {
    if (!bUrl.trim()) return;
    const label = bLabel.trim() || BOOKING_TYPES.find(t => t.value === bType)?.label || bType;
    setForm(f => ({ ...f, bookingLinks: [...f.bookingLinks, { type: bType, label, url: withScheme(bUrl) }] }));
    setBLabel(''); setBUrl('');
  };

  const canNext = () => step !== 0 || (form.destination.trim() && form.departureCity.trim() && form.startDate && form.endDate);

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        travelers:        parseInt(form.travelers)        || 1,
        budget:           form.budget           !== '' ? parseInt(form.budget)           : null,
        distanceKm:       form.distanceKm       !== '' ? parseInt(form.distanceKm)       : null,
        fuelPricePerLiter:form.fuelPricePerLiter !== '' ? parseFloat(form.fuelPricePerLiter) : null,
        fuelConsumption:  form.fuelConsumption  !== '' ? parseFloat(form.fuelConsumption)  : null,
        tollCost:         form.tollCost         !== '' ? parseInt(form.tollCost)         : null,
        rentalCost:       form.rentalCost       !== '' ? parseInt(form.rentalCost)       : null,
        rentalLink:       withScheme(form.rentalLink),
      };
      const res = isEdit
        ? await client.patch(`/api/trips/${trip.id}`, payload)
        : await client.post('/api/trips', payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
        {/* Header */}
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ms.headerTitle}>{isEdit ? 'Modifier le voyage' : 'Nouveau voyage'}</Text>
            <Text style={ms.headerSub}>
              {['Infos de base', 'Transport', 'Réservations', 'Logements'][step]}
            </Text>
          </View>
        </View>

        {/* Steps */}
        <View style={ms.steps}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[ms.stepDot, i < step ? ms.stepDone : i === step ? ms.stepActive : null]} />
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={ms.content} keyboardShouldPersistTaps="handled">

          {/* ── Step 0 ── */}
          {step === 0 && (
            <>
              <View style={ms.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Ville de départ</Text>
                  <TextInput style={ms.input} placeholder="Paris" placeholderTextColor={Colors.textMuted}
                    value={form.departureCity} onChangeText={set('departureCity')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Destination</Text>
                  <TextInput style={ms.input} placeholder="Rome" placeholderTextColor={Colors.textMuted}
                    value={form.destination} onChangeText={set('destination')} />
                </View>
              </View>

              <View style={ms.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Départ (AAAA-MM-JJ)</Text>
                  <TextInput style={ms.input} placeholder="2026-06-01" placeholderTextColor={Colors.textMuted}
                    value={form.startDate} onChangeText={set('startDate')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Retour (AAAA-MM-JJ)</Text>
                  <TextInput style={ms.input} placeholder="2026-06-05" placeholderTextColor={Colors.textMuted}
                    value={form.endDate} onChangeText={set('endDate')} />
                </View>
              </View>

              <View style={ms.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Voyageurs</Text>
                  <TextInput style={ms.input} keyboardType="number-pad" value={form.travelers} onChangeText={set('travelers')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Budget (€, optionnel)</Text>
                  <TextInput style={ms.input} placeholder="1200" placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad" value={form.budget} onChangeText={set('budget')} />
                </View>
              </View>

              <Text style={ms.label}>Nom du voyage <Text style={{ fontFamily: 'BricolageGrotesque_400Regular', color: Colors.textMuted }}>(optionnel)</Text></Text>
              <TextInput style={ms.input} placeholder="Week-end à Rome" placeholderTextColor={Colors.textMuted}
                value={form.title} onChangeText={set('title')} />
            </>
          )}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <Text style={ms.label}>Moyen de transport</Text>
              <View style={ms.pills}>
                {TRANSPORT.map(opt => (
                  <TouchableOpacity key={opt.value}
                    style={[ms.pill, form.transportMode === opt.value && ms.pillActive]}
                    onPress={() => setForm(f => ({ ...f, transportMode: opt.value }))}
                  >
                    <Text style={[ms.pillText, form.transportMode === opt.value && ms.pillTextActive]}>
                      {opt.icon} {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.transportMode === 'voiture' && (
                <View style={ms.carBox}>
                  <View style={ms.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Distance aller (km)</Text>
                      <TextInput style={ms.input} placeholder="500" placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad" value={form.distanceKm} onChangeText={set('distanceKm')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Prix carburant (€/L)</Text>
                      <TextInput style={ms.input} placeholder="1.85" placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad" value={form.fuelPricePerLiter} onChangeText={set('fuelPricePerLiter')} />
                    </View>
                  </View>
                  <View style={ms.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Conso. (L/100km)</Text>
                      <TextInput style={ms.input} placeholder="6.5" placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad" value={form.fuelConsumption} onChangeText={set('fuelConsumption')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Péages A/R (€)</Text>
                      <TextInput style={ms.input} placeholder="40" placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad" value={form.tollCost} onChangeText={set('tollCost')} />
                    </View>
                  </View>
                  {fuelPreview !== null && (
                    <View style={ms.fuelPreview}>
                      <Text style={ms.fuelPreviewText}>
                        ⛽ Carburant A/R estimé : {fmtEur(fuelPreview)}
                        {form.tollCost ? ` + péages ${fmtEur(parseInt(form.tollCost))} = ${fmtEur(fuelPreview + parseInt(form.tollCost))}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              <Text style={ms.label}>Liens de réservation <Text style={{ fontFamily: 'BricolageGrotesque_400Regular', color: Colors.textMuted }}>(optionnel)</Text></Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {BOOKING_TYPES.map(t => (
                  <TouchableOpacity key={t.value} style={[ms.pill, bType === t.value && ms.pillActive, { marginRight: 6 }]}
                    onPress={() => setBType(t.value)}>
                    <Text style={[ms.pillText, bType === t.value && ms.pillTextActive]}>{t.icon} {t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput style={ms.input} placeholder="Libellé (ex: Hôtel Roma)" placeholderTextColor={Colors.textMuted}
                value={bLabel} onChangeText={setBLabel} />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput style={[ms.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="https://booking.com/..." placeholderTextColor={Colors.textMuted}
                  value={bUrl} onChangeText={setBUrl} autoCapitalize="none" />
                <TouchableOpacity style={ms.addBtn} onPress={addBooking}>
                  <Text style={ms.addBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {form.bookingLinks.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {form.bookingLinks.map((b, i) => (
                    <TouchableOpacity key={i} style={ms.chipEdit}
                      onPress={() => setForm(f => ({ ...f, bookingLinks: f.bookingLinks.filter((_, j) => j !== i) }))}>
                      <Text style={ms.chipEditText}>{BOOKING_TYPES.find(t => t.value === b.type)?.icon} {b.label}  ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={ms.checkRow}>
                <Switch value={form.needsRental} onValueChange={set('needsRental')} thumbColor={form.needsRental ? Colors.parme : '#f4f4f4'} trackColor={{ true: Colors.orchidee }} />
                <Text style={ms.checkLabel}>Location de véhicule sur place</Text>
              </View>

              {form.needsRental && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <View style={ms.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Coût location (€)</Text>
                      <TextInput style={ms.input} placeholder="180" placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad" value={form.rentalCost} onChangeText={set('rentalCost')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Lien loueur</Text>
                      <TextInput style={ms.input} placeholder="https://..." placeholderTextColor={Colors.textMuted}
                        value={form.rentalLink} onChangeText={set('rentalLink')} autoCapitalize="none" />
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ── Step 3 : Logements ── */}
          {step === 3 && (
            <>
              {!isEdit ? (
                <View style={ms.fuelPreview}>
                  <Text style={ms.fuelPreviewText}>
                    Enregistrez le voyage pour pouvoir ajouter ses logements (road trip = plusieurs logements à des dates différentes).
                  </Text>
                </View>
              ) : (
                <>
                  {accommodations.length > 0 && (
                    <View style={{ gap: 10, marginBottom: 16 }}>
                      {accommodations.map((a) => (
                        <View key={a.id} style={ms.accomCard}>
                          <View style={ms.accomHeader}>
                            <Text style={ms.accomName}>
                              {ACCOM_TYPES.find(t => t.value === a.type)?.icon} {a.name}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                              <TouchableOpacity onPress={() => startEditAccom(a)}>
                                <Ionicons name="pencil-outline" size={15} color={Colors.parme} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteAccom(a)}>
                                <Ionicons name="trash-outline" size={15} color="#dc2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={ms.accomDates}>
                            {fmtDate(a.checkIn)} → {fmtDate(a.checkOut)}{'  '}
                            <Text style={{ color: Colors.textMuted }}>({nights(a.checkIn, a.checkOut)} nuit{nights(a.checkIn, a.checkOut) > 1 ? 's' : ''})</Text>
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            {a.price != null && <Text style={ms.accomMeta}>💰 {fmtEur(a.price)}</Text>}
                            {a.hasSpecialPrice && (
                              <Text style={ms.accomBadge}>🏷 {a.specialPriceNote || 'Prix spécial'}</Text>
                            )}
                            {a.link ? (
                              <TouchableOpacity onPress={() => Linking.openURL(a.link)}>
                                <Text style={[ms.accomMeta, { color: Colors.parme }]}>🔗 Lien</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={ms.label}>{editingAccomId ? 'Modifier le logement' : 'Ajouter un logement'}</Text>

                  <TextInput style={ms.input} placeholder="Nom (ex: Hôtel Roma)" placeholderTextColor={Colors.textMuted}
                    value={accomForm.name} onChangeText={(v) => setAccomForm(f => ({ ...f, name: v }))} />

                  <View style={ms.pills}>
                    {ACCOM_TYPES.map(t => (
                      <TouchableOpacity key={t.value} style={[ms.pill, accomForm.type === t.value && ms.pillActive]}
                        onPress={() => setAccomForm(f => ({ ...f, type: t.value }))}>
                        <Text style={[ms.pillText, accomForm.type === t.value && ms.pillTextActive]}>{t.icon} {t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={ms.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Arrivée (AAAA-MM-JJ)</Text>
                      <TextInput style={ms.input} placeholder="2026-06-01" placeholderTextColor={Colors.textMuted}
                        value={accomForm.checkIn} onChangeText={(v) => setAccomForm(f => ({ ...f, checkIn: v }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Départ (AAAA-MM-JJ)</Text>
                      <TextInput style={ms.input} placeholder="2026-06-03" placeholderTextColor={Colors.textMuted}
                        value={accomForm.checkOut} onChangeText={(v) => setAccomForm(f => ({ ...f, checkOut: v }))} />
                    </View>
                  </View>

                  <Text style={ms.label}>Prix (€, optionnel)</Text>
                  <TextInput style={ms.input} placeholder="250" placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad" value={accomForm.price} onChangeText={(v) => setAccomForm(f => ({ ...f, price: v }))} />

                  <View style={ms.checkRow}>
                    <Switch value={accomForm.hasSpecialPrice}
                      onValueChange={(v) => setAccomForm(f => ({ ...f, hasSpecialPrice: v }))}
                      thumbColor={accomForm.hasSpecialPrice ? Colors.parme : '#f4f4f4'} trackColor={{ true: Colors.orchidee }} />
                    <Text style={ms.checkLabel}>Prix spécial (réduction CE, code promo...)</Text>
                  </View>

                  {accomForm.hasSpecialPrice && (
                    <TextInput style={ms.input} placeholder="Ex: -20% code CE2026" placeholderTextColor={Colors.textMuted}
                      value={accomForm.specialPriceNote} onChangeText={(v) => setAccomForm(f => ({ ...f, specialPriceNote: v }))} />
                  )}

                  <Text style={ms.label}>Lien (Airbnb, Booking...)</Text>
                  <TextInput style={ms.input} placeholder="https://..." placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none" value={accomForm.link} onChangeText={(v) => setAccomForm(f => ({ ...f, link: v }))} />

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {editingAccomId && (
                      <TouchableOpacity style={[ms.backBtn, { flex: 1 }]} onPress={resetAccomForm}>
                        <Text style={ms.backBtnText}>Annuler</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[ms.nextBtn, { flex: 1 }, savingAccom && { opacity: 0.6 }]}
                      disabled={savingAccom} onPress={saveAccom}>
                      <Text style={ms.nextBtnText}>
                        {savingAccom ? 'Enregistrement...' : editingAccomId ? 'Mettre à jour' : '+ Ajouter le logement'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {!!error && <View style={ms.errorBox}><Text style={ms.errorText}>{error}</Text></View>}
        </ScrollView>

        {/* Footer */}
        <View style={ms.footer}>
          <TouchableOpacity style={ms.backBtn}
            onPress={() => step === 0 ? onClose() : setStep(p => p - 1)}>
            <Text style={ms.backBtnText}>{step === 0 ? 'Annuler' : '← Retour'}</Text>
          </TouchableOpacity>

          {step < 3 ? (
            <TouchableOpacity style={[ms.nextBtn, !canNext() && { opacity: 0.5 }]}
              disabled={!canNext()} onPress={() => setStep(p => p + 1)}>
              <Text style={ms.nextBtnText}>Suivant →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[ms.nextBtn, loading && { opacity: 0.6 }]}
              disabled={loading} onPress={handleSubmit}>
              <Text style={ms.nextBtnText}>{loading ? 'Enregistrement...' : isEdit ? 'Sauvegarder' : 'Créer le voyage'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ════════════════════════════════════
   SCREEN
   ════════════════════════════════════ */
export default function TripsScreen() {
  const { user }   = useAuth();
  const { theme }  = useTheme();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const tabBarH    = 64 + (insets.bottom || 16);

  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editTrip,   setEditTrip]   = useState(null);

  const fetchTrips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await client.get('/api/trips');
      setTrips(data);
    } catch { setTrips([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleRefresh = () => { setRefreshing(true); fetchTrips(true); };

  const handleSaved = (trip) => {
    setTrips(prev => {
      const idx = prev.findIndex(t => t.id === trip.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = trip; return n; }
      return [trip, ...prev];
    });
    setShowModal(false);
    setEditTrip(null);
  };

  const handleEdit = (trip) => { setEditTrip(trip); setShowModal(true); };

  const handleDelete = (trip) => {
    Alert.alert(
      'Supprimer ce voyage ?',
      `"${trip.destination}" sera définitivement supprimé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/api/trips/${trip.id}`);
              setTrips(prev => prev.filter(t => t.id !== trip.id));
            } catch {}
          },
        },
      ]
    );
  };

  const openCreate = () => { setEditTrip(null); setShowModal(true); };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.sableLune }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.white, borderBottomColor: theme.border }]}>
        <TalariaLogo height={28} />
      </View>

      <View style={s.titleRow}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Mes voyages</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>
            {trips.length > 0
              ? `${trips.length} voyage${trips.length > 1 ? 's' : ''} planifié${trips.length > 1 ? 's' : ''}`
              : 'Planifiez votre prochain voyage'}
          </Text>
        </View>
        <TouchableOpacity style={s.createBtn} onPress={openCreate}>
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={s.createBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.parme} />
        </View>
      ) : trips.length === 0 ? (
        <View style={s.empty}>
          <Image source={require('../../assets/STICKERS.png')} style={s.emptyIcon} resizeMode="contain" />
          <Text style={[s.emptyTitle, { color: theme.text }]}>Aucun voyage planifié</Text>
          <Text style={[s.emptySub, { color: theme.textMuted }]}>Créez votre premier voyage et gérez votre budget et vos réservations.</Text>
          <TouchableOpacity style={s.createBtn} onPress={openCreate}>
            <Text style={s.createBtnText}>Créer mon premier voyage</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={t => String(t.id)}
          renderItem={({ item }) => (
            <TripCard trip={item} onEdit={handleEdit} onDelete={handleDelete}
              onPlanning={(t) => router.push(`/planning/${t.id}`)} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarH + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.parme} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TripFormModal
        visible={showModal}
        trip={editTrip}
        onClose={() => { setShowModal(false); setEditTrip(null); }}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

/* ════════════════════════════════════
   STYLES
   ════════════════════════════════════ */
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune ?? '#fcf9f1' },

  header: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  title:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 22, color: Colors.text },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.parme, borderRadius: 100,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  createBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.white },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon:  { width: 140, height: 140, marginBottom: 16 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: Colors.text, marginBottom: 8 },
  emptySub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },

  card: {
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardDest:  { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 17, color: Colors.text },
  cardTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  transBadge: {
    backgroundColor: Colors.parmeLight ?? '#f5eef8', borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  transBadgeText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 11, color: Colors.parme },

  cardDates: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDateText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  cardNights: { color: Colors.textMuted },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  metaBold: { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.text },

  costsBox: {
    backgroundColor: '#fcf9f1', borderRadius: 10,
    padding: 12, gap: 5,
  },
  costRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  costVal:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.text },

  bookingChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 10, marginRight: 6,
  },
  bookingChipText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.textMuted },

  cardActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 100,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  actionBtnDanger: { borderColor: '#fca5a5' },
  actionBtnPrimary: { borderColor: Colors.parme, backgroundColor: Colors.parme },
  actionBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },
});

const ms = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 17, color: Colors.text },
  headerSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },

  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  stepDot:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  stepDone:   { backgroundColor: Colors.parme },
  stepActive: { backgroundColor: Colors.orchidee ?? '#c9b2d7' },

  content: { padding: 16, paddingBottom: 24, gap: 4 },

  row:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
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
  pillActive: { borderColor: Colors.parme, backgroundColor: Colors.parmeLight ?? '#f5eef8' },
  pillText:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  pillTextActive: { color: Colors.parme },

  carBox: { backgroundColor: '#fcf9f1', borderRadius: 12, padding: 12 },
  fuelPreview: { backgroundColor: Colors.parmeLight ?? '#f5eef8', borderRadius: 8, padding: 10, marginTop: 6 },
  fuelPreviewText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },

  addBtn: {
    backgroundColor: Colors.parme, borderRadius: 12,
    width: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  addBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: Colors.white },

  chipEdit: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 100,
    paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#fcf9f1',
  },
  chipEditText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.text },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  checkLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text, flex: 1 },

  accomCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    padding: 12, backgroundColor: '#fcf9f1',
  },
  accomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  accomName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text, flex: 1, marginRight: 8 },
  accomDates: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },
  accomMeta: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  accomBadge: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme,
    backgroundColor: Colors.parmeLight ?? '#f5eef8', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2,
  },

  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 8 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.border },
  backBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  nextBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100, backgroundColor: Colors.parme },
  nextBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});

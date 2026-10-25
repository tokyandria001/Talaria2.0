import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Linking, Modal, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import client from '../api/client';
import { fuelPriceToday, formatFuelPrice, DEFAULT_FUEL_PRICE } from '../api/fuel';
import GroupHero from '../components/groups/GroupHero';
import FriendPickerSheet from '../components/groups/FriendPickerSheet';
import GroupPickerSheet from '../components/groups/GroupPickerSheet';
import UserAvatar from '../components/UserAvatar';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import AccommodationSuggestions from '../components/trip/AccommodationSuggestions';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

const STEPS = ['Général', 'Transport', 'Logement', 'Inviter'];

const WISHES = [
  { value: 'plongee',    label: 'Plongée' },
  { value: 'randonnee',  label: 'Randonnée' },
  { value: 'motorise',   label: 'Activités motorisées' },
  { value: 'excursions', label: 'Excursions touristiques' },
];

const TRANSPORTS = [
  { value: 'avion',   label: 'Avion',   icon: 'airplane',   hint: 'Billet par personne' },
  { value: 'bus',     label: 'Bus',     icon: 'bus',        hint: 'Billet par personne' },
  { value: 'voiture', label: 'Voiture', icon: 'car',        hint: 'Essence + péages' },
  { value: 'train',   label: 'Train',   icon: 'train',      hint: 'Billet par personne' },
];

const ACCOM_TYPES = [
  { value: 'hotel',    label: 'Hôtel' },
  { value: 'airbnb',   label: 'Airbnb' },
  { value: 'auberge',  label: 'Auberge' },
  { value: 'habitant', label: "Chez l'habitant" },
  { value: 'camping',  label: 'Camping' },
];

const iso    = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
const fmt    = (d) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const short  = (d) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');
const nights = (a, b) => (a && b ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0);
const int    = (v) => (v === '' || v == null ? null : parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0);

/** Lien de comparaison de billets (gratuit, sans API) */
function compareUrl(mode, from, to, start, end) {
  if (mode === 'train') return 'https://www.thetrainline.com/fr';
  if (mode === 'bus') return 'https://global.flixbus.com/';
  const q = `Vols de ${from} à ${to} le ${iso(start)}${end ? ` retour le ${iso(end)}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=fr`;
}

/** Assistant « Créer un voyage » (maquettes 17 à 20). ?groupId= pour un voyage de groupe existant. */
export default function NewTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const presetGroupId = params.groupId ? Number(params.groupId) : null;

  const { user } = useAuth();
  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [group, setGroup]   = useState(null);        // groupe existant : lancé depuis un groupe ou choisi ici
  const [groupId, setGroupId] = useState(presetGroupId);
  const [groupPicker, setGroupPicker] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);      // amis invités (ids)
  const [friendQuery, setFriendQuery] = useState('');
  const [picker, setPicker] = useState(false);
  const [dateField, setDateField] = useState(null);  // 'start' | 'end' | null

  const [f, setF] = useState({
    title: '',
    destination: typeof params.destination === 'string' ? params.destination : '', start: null, end: null, budgetPerPerson: '', wishes: [],
    destinationPlace: null,                          // suggestions choisies (ville exacte, pays, position)
    // Départ : la ville indiquée à l'onboarding
    departurePlace: user?.homeCity && user.homeLatitude != null ? { name: user.homeCity, label: user.homeCity, latitude: user.homeLatitude, longitude: user.homeLongitude } : null,
    transportMode: 'avion', departureCity: user?.homeCity ?? '', ticketPrice: '', eachBooksOwnTransport: false,
    distanceKm: '', distanceManual: false, fuelPrice: formatFuelPrice(DEFAULT_FUEL_PRICE), fuelConsumption: '7', tollCost: '',
    accomType: 'airbnb', accomName: '', accomPrice: '', accomAddress: '', accomAddressPlace: null, accomLink: '',
    accomSuggestion: null, accomManual: false,     // logement proposé par Talaria (son nom) ; « saisir le mien »
    needsRental: false, rentalCost: '', splitCostsEqually: true,
  });
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  // Prix moyen du jour du SP95-E10 (flux officiel), tant que la personne n'a pas saisi le sien
  useEffect(() => {
    fuelPriceToday().then(price => setF(p => (p.fuelPrice === formatFuelPrice(DEFAULT_FUEL_PRICE) ? { ...p, fuelPrice: formatFuelPrice(price) } : p)));
  }, []);
  // Recherche de villes indisponible : la destination tapée librement est acceptée
  const [geoDown, setGeoDown] = useState(false);
  // Texte modifié = choix annulé ; suggestion choisie = son nom dans le champ
  const typeDestination = (v) => setF(p => ({ ...p, destination: v, destinationPlace: null }));
  const pickDestination = (place) => setF(p => ({ ...p, destination: place.name, destinationPlace: place }));
  const typeDeparture = (v) => setF(p => ({ ...p, departureCity: v, departurePlace: null }));
  const pickDeparture = (place) => setF(p => ({ ...p, departureCity: place.name, departurePlace: place }));

  useEffect(() => {
    client.get('/api/friends').then(({ data }) => setFriends(data.map(x => x.user))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!groupId) { setGroup(null); return; }
    client.get(`/api/groups/${groupId}`).then(({ data }) => setGroup(data)).catch(() => setGroup(null));
  }, [groupId]);

  // Les amis déjà membres du groupe choisi ne sont pas invités une seconde fois
  useEffect(() => {
    if (group && !group.permissions?.canInvite) { setSelected([]); return; }
    const ids = (group?.members ?? []).map(m => m.user.id);
    if (ids.length) setSelected(sel => sel.filter(id => !ids.includes(id)));
  }, [group]);

  // Voiture : distance aller calculée dès que le départ et l'arrivée sont choisis (sauf saisie à la main)
  const [route, setRoute] = useState(null); // { distanceKm, durationMin } | 'loading' | 'error'
  const from = f.departurePlace, to = f.destinationPlace;
  useEffect(() => {
    if (f.transportMode !== 'voiture' || !from || !to) { setRoute(null); return undefined; }
    let cancelled = false;
    setRoute('loading');
    client.get('/api/geo/route', { params: { from: `${from.latitude},${from.longitude}`, to: `${to.latitude},${to.longitude}` } })
      .then(({ data }) => {
        if (cancelled) return;
        setRoute(data);
        setF(p => (p.distanceManual ? p : { ...p, distanceKm: String(data.distanceKm) }));
      })
      .catch(() => { if (!cancelled) setRoute('error'); });
    return () => { cancelled = true; };
  }, [f.transportMode, from, to]);

  const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const carCost = useMemo(() => {
    const fuel = num(f.distanceKm) * 2 * num(f.fuelConsumption) / 100 * num(f.fuelPrice);
    const total = fuel + num(f.tollCost) + (f.needsRental ? num(f.rentalCost) : 0);
    return { fuel: Math.round(fuel), total: Math.round(total) };
  }, [f.distanceKm, f.fuelConsumption, f.fuelPrice, f.tollCost, f.needsRental, f.rentalCost]);

  const memberIds = useMemo(() => (group?.members ?? []).map(m => m.user.id), [group]);
  const invitable = friends.filter(u => !memberIds.includes(u.id));
  const travelers = (group ? group.membersCount : 1) + selected.length;
  const n = nights(f.start, f.end);
  const accomPerPerson = int(f.accomPrice) ? Math.round(int(f.accomPrice) / travelers) : null;
  const stayEnd = f.start && f.end && f.end > f.start ? f.end : f.start ? new Date(f.start.getTime() + 86_400_000) : null;

  // Logement présélectionné par Talaria : le plus proche du centre, remplacé si le type change
  const applySuggestion = (sg) => setF(p => ({
    ...p, accomName: sg.name, accomAddress: sg.address ?? '', accomAddressPlace: null,
    accomPrice: String(sg.estimatedPrice), accomLink: sg.link, accomSuggestion: sg.name, accomManual: false,
  }));
  const onSuggestionsLoaded = (list) => {
    const first = list[0];
    if (!first) return;
    setF(p => (p.accomManual || (p.accomName.trim() && p.accomName !== p.accomSuggestion) ? p : {
      ...p, accomName: first.name, accomAddress: first.address ?? '', accomAddressPlace: null,
      accomPrice: String(first.estimatedPrice), accomLink: first.link, accomSuggestion: first.name,
    }));
  };
  const enterOwnAccommodation = () => setF(p => ({
    ...p, accomManual: true, accomSuggestion: null, accomName: '', accomAddress: '', accomAddressPlace: null, accomPrice: '', accomLink: '',
  }));
  const isSuggested = !!f.accomSuggestion && f.accomName.trim() === f.accomSuggestion;

  const canNext = [
    f.destination.trim() && (f.destinationPlace || geoDown) && f.start && f.end && f.end >= f.start,
    f.departureCity.trim().length > 0,
    true,
    true,
  ][step];

  const toggleWish = (v) => setF(p => ({ ...p, wishes: p.wishes.includes(v) ? p.wishes.filter(w => w !== v) : [...p.wishes, v] }));
  const toggleFriend = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = async () => {
    setSaving(true);
    let groupId = group?.id ?? null;
    let createdGroup = null;
    try {
      // 1. Groupe : invitations dans le groupe existant, ou nouveau groupe si on invite des amis
      if (groupId && selected.length) {
        await client.post(`/api/groups/${groupId}/members`, { userIds: selected });
      } else if (!groupId && selected.length) {
        const year = f.start.getFullYear();
        const { data } = await client.post('/api/groups', { name: `${f.destination.trim()} ${year}`, memberIds: selected, isPrivate: true });
        createdGroup = data;
        groupId = data.id;
      }

      // 2. Voyage
      const perPerson = int(f.budgetPerPerson);
      const car = f.transportMode === 'voiture';
      const { data: trip } = await client.post('/api/trips', {
        title: f.title.trim() || null,
        destination: f.destination.trim(),
        ...(f.destinationPlace ? {
          destinationLatitude: f.destinationPlace.latitude,
          destinationLongitude: f.destinationPlace.longitude,
          destinationCountry: f.destinationPlace.country,
          destinationCountryCode: f.destinationPlace.countryCode,
        } : {}),
        departureCity: f.departureCity.trim(),
        startDate: iso(f.start), endDate: iso(f.end),
        travelers,
        budget: perPerson != null ? perPerson * travelers : null,
        transportMode: f.transportMode,
        transportPricePerPerson: car ? null : int(f.ticketPrice),
        distanceKm: car ? int(f.distanceKm) : null,
        fuelPricePerLiter: car && f.fuelPrice ? num(f.fuelPrice) : null,
        fuelConsumption: car && f.fuelConsumption ? num(f.fuelConsumption) : null,
        tollCost: car ? int(f.tollCost) : null,
        needsRental: f.needsRental,
        rentalCost: f.needsRental ? int(f.rentalCost) : null,
        eachBooksOwnTransport: f.eachBooksOwnTransport,
        splitCostsEqually: f.splitCostsEqually,
        wishedActivities: f.wishes,
        groupId,
      });

      // 3. Logement (facultatif)
      if (f.accomName.trim()) {
        const link = f.accomLink.trim();
        await client.post(`/api/trips/${trip.id}/accommodations`, {
          name: f.accomName.trim(), type: f.accomType,
          checkIn: iso(f.start), checkOut: iso(f.end > f.start ? f.end : new Date(f.start.getTime() + 86_400_000)),
          price: int(f.accomPrice), address: f.accomAddress.trim() || null, suggested: isSuggested,
          link: link && !/^https?:\/\//i.test(link) ? `https://${link}` : link || null,
        }).catch(() => Alert.alert('Logement non enregistré', 'Le voyage est créé ; ajoutez le logement depuis « Modifier ».'));
      }

      const code = createdGroup?.inviteCode ?? group?.inviteCode;
      router.replace(`/trip/${trip.id}`);
      if (code) {
        Alert.alert('Voyage créé 🎉', createdGroup
          ? `Le groupe « ${createdGroup.name} » a été créé et tes amis sont invités. Tu peux aussi partager le code ${code}.`
          : 'Tes amis sont invités au voyage.', [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Partager le lien', onPress: () => Share.share({ message: `Rejoins notre voyage à ${f.destination} sur Talaria ! Code : ${code}\ntalaria://groups/join?code=${code}` }) },
        ]);
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de créer le voyage.');
    } finally {
      setSaving(false);
    }
  };

  const onDate = (event, date) => {
    const field = dateField;
    if (Platform.OS === 'android') setDateField(null);
    if (event.type !== 'set' || !date) return;
    setF(p => {
      const next = { ...p, [field]: date };
      if (field === 'start' && (!p.end || p.end < date)) next.end = new Date(date.getTime() + 7 * 86_400_000);
      return next;
    });
  };

  const transportLabel = TRANSPORTS.find(t => t.value === f.transportMode)?.label;

  return (
    <View style={s.root}>
      <GroupHero
        photo={group?.photo}
        label={`Étape ${step + 1}/4 · ${STEPS[step]}`}
        title="Créer un voyage"
        onBack={() => (step ? setStep(step - 1) : router.back())}
      />

      {/* Progression */}
      <View style={s.progress}>
        {STEPS.map((label, i) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={[s.bar, i <= step && s.barOn]} />
            <Text style={[s.barLabel, i === step && s.barLabelOn]}>{label}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">

          {/* ── 17 · Général ── */}
          {step === 0 && (
            <>
              {group && <Text style={s.groupNote}>👥 Voyage du groupe « {group.name} »</Text>}
              <Label>Nom du voyage</Label>
              <Input placeholder={f.destination ? `Week-end à ${f.destination}` : 'Week-end entre potes'} value={f.title} onChangeText={set('title')} maxLength={255} />

              <Label>Rechercher une destination</Label>
              <PlaceAutocomplete required placeholder="Entrez une ville, un pays..." icon="search"
                value={f.destination} place={f.destinationPlace} onChangeText={typeDestination} onSelect={pickDestination} onUnavailable={setGeoDown} />

              <Label>Les dates du voyage</Label>
              <DateButton placeholder="Date de l'aller" value={fmt(f.start)} onPress={() => setDateField('start')} />
              <DateButton placeholder="Date du retour" value={fmt(f.end)} onPress={() => setDateField('end')} />
              {f.start && f.end && f.end < f.start && <Text style={s.error}>Le retour doit être après l'aller.</Text>}

              <Label>Budget par personne</Label>
              <Input placeholder="Exemple : 950 €" keyboardType="number-pad" value={f.budgetPerPerson} onChangeText={set('budgetPerPerson')} />

              <Label>Les participants</Label>
              {group ? (
                <View style={s.groupChip}>
                  <Ionicons name="people" size={16} color={Colors.parme} />
                  <Text style={s.groupChipText} numberOfLines={1}>Groupe « {group.name} »</Text>
                  {!presetGroupId && (
                    <TouchableOpacity onPress={() => setGroupPicker(true)} hitSlop={8}>
                      <Text style={s.groupChipLink}>Changer</Text>
                    </TouchableOpacity>
                  )}
                  {!presetGroupId && (
                    <TouchableOpacity onPress={() => setGroupId(null)} hitSlop={8} accessibilityLabel="Retirer le groupe">
                      <Ionicons name="close" size={16} color={Colors.parme} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity style={s.groupChip} onPress={() => setGroupPicker(true)} activeOpacity={0.85}>
                  <Ionicons name="people-outline" size={16} color={Colors.parme} />
                  <Text style={s.groupChipText}>Partir avec un de mes groupes</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.parme} />
                </TouchableOpacity>
              )}
              <View style={s.participants}>
                {(group?.members ?? []).filter(m => m.status === 'active').map(m => (
                  <View key={m.user.id} style={s.participant}>
                    <UserAvatar user={m.user} size={48} />
                    <Text style={s.participantName} numberOfLines={1}>{m.user.firstName || m.user.displayName}</Text>
                  </View>
                ))}
                {friends.filter(u => selected.includes(u.id)).map(u => (
                  <TouchableOpacity key={u.id} style={s.participant} onPress={() => toggleFriend(u.id)}>
                    <UserAvatar user={u} size={48} />
                    <Text style={s.participantName} numberOfLines={1}>{u.firstName || u.displayName}</Text>
                  </TouchableOpacity>
                ))}
                {/* Groupe privé : seul l'organisateur peut inviter de nouveaux membres */}
                {(!group || group.permissions?.canInvite) && (
                  <TouchableOpacity style={s.participant} onPress={() => setPicker(true)}>
                    <View style={s.addCircle}><Ionicons name="add" size={26} color={Colors.white} /></View>
                    <Text style={s.participantName}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Label>Activités souhaitées</Label>
              <View style={{ gap: 8 }}>
                {WISHES.map(w => (
                  <View key={w.value} style={s.wish}>
                    <Text style={s.wishText}>{w.label}</Text>
                    <Switch value={f.wishes.includes(w.value)} onValueChange={() => toggleWish(w.value)}
                      thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── 18 · Transport ── */}
          {step === 1 && (
            <>
              <Label>Mode de transport</Label>
              <View style={s.grid}>
                {TRANSPORTS.map(t => {
                  const on = f.transportMode === t.value;
                  return (
                    <TouchableOpacity key={t.value} style={[s.tile, on && s.tileOn]} onPress={() => set('transportMode')(t.value)} activeOpacity={0.85}>
                      <Ionicons name={t.icon} size={20} color={on ? Colors.white : Colors.parme} />
                      <Text style={[s.tileTitle, on && { color: Colors.white }]}>{t.label}</Text>
                      <Text style={[s.tileHint, on && { color: 'rgba(255,255,255,0.8)' }]}>{t.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Label>Trajet</Label>
              <SubLabel>Départ</SubLabel>
              <PlaceAutocomplete placeholder="Paris" value={f.departureCity} place={f.departurePlace}
                onChangeText={typeDeparture} onSelect={pickDeparture} />
              <SubLabel>Arrivée</SubLabel>
              <PlaceAutocomplete required value={f.destination} place={f.destinationPlace}
                onChangeText={typeDestination} onSelect={pickDestination} onUnavailable={setGeoDown} />

              {f.transportMode === 'voiture' ? (
                <>
                  <Label>Coût de la route</Label>
                  {route === 'loading' && <Text style={s.hint}>Calcul de l'itinéraire...</Text>}
                  {route && typeof route === 'object' && (
                    <Text style={s.hint}>
                      Itinéraire : {route.distanceKm} km, environ {Math.floor(route.durationMin / 60)} h {String(route.durationMin % 60).padStart(2, '0')} de route (aller)
                    </Text>
                  )}
                  {route === 'error' && <Text style={s.hint}>Distance non calculée : saisis-la à la main.</Text>}
                  {!from && <Text style={s.hint}>Choisis la ville de départ dans les suggestions pour calculer la distance.</Text>}

                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <SubLabel>Distance aller (km)</SubLabel>
                      <Input placeholder="466" keyboardType="number-pad" value={f.distanceKm}
                        onChangeText={(v) => setF(p => ({ ...p, distanceKm: v, distanceManual: v !== '' }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SubLabel>Péages A/R (€)</SubLabel>
                      <Input placeholder="0" keyboardType="number-pad" value={f.tollCost} onChangeText={set('tollCost')} />
                    </View>
                  </View>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <SubLabel>Carburant (€/L)</SubLabel>
                      <Input placeholder={formatFuelPrice(DEFAULT_FUEL_PRICE)} keyboardType="decimal-pad" value={f.fuelPrice} onChangeText={set('fuelPrice')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SubLabel>Conso. (L/100 km)</SubLabel>
                      <Input placeholder="7" keyboardType="decimal-pad" value={f.fuelConsumption} onChangeText={set('fuelConsumption')} />
                    </View>
                  </View>
                  {from && to && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=driving`)}>
                      <Text style={s.link}>Voir l'itinéraire et les péages sur Google Maps</Text>
                    </TouchableOpacity>
                  )}

                  {num(f.distanceKm) > 0 && (
                    <View style={s.costCard}>
                      <View style={s.costRow}><Text style={s.costLabel}>Carburant aller-retour</Text><Text style={s.costValue}>{carCost.fuel} €</Text></View>
                      {num(f.tollCost) > 0 && <View style={s.costRow}><Text style={s.costLabel}>Péages</Text><Text style={s.costValue}>{Math.round(num(f.tollCost))} €</Text></View>}
                      {f.needsRental && num(f.rentalCost) > 0 && <View style={s.costRow}><Text style={s.costLabel}>Location</Text><Text style={s.costValue}>{Math.round(num(f.rentalCost))} €</Text></View>}
                      <View style={[s.costRow, s.costTotal]}>
                        <Text style={s.costTotalText}>Total route</Text>
                        <Text style={s.costTotalText}>{carCost.total} € · {Math.round(carCost.total / travelers)} €/pers</Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={s.sectionRow}>
                    <Label>{f.transportMode === 'avion' ? 'Vol suggéré' : 'Billets'}</Label>
                  </View>
                  <TouchableOpacity
                    style={s.flight}
                    onPress={() => Linking.openURL(compareUrl(f.transportMode, f.departureCity || '?', f.destination || '?', f.start, f.end))}
                    activeOpacity={0.85}
                  >
                    <View style={s.flightRow}>
                      <Text style={s.flightCity}>{f.departureCity || 'Départ'}</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                      <Text style={s.flightCity}>{f.destination || 'Arrivée'}</Text>
                    </View>
                    <Text style={s.flightDate}>{f.start ? f.start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }) : ''}</Text>
                    <View style={s.flightCta}>
                      <Text style={s.flightCtaText}>Comparer les {f.transportMode === 'avion' ? 'vols' : f.transportMode === 'train' ? 'trains' : 'bus'}</Text>
                      <Ionicons name="open-outline" size={14} color={Colors.parme} />
                    </View>
                  </TouchableOpacity>
                  <SubLabel>Prix du billet (€ / personne)</SubLabel>
                  <Input placeholder="290" keyboardType="number-pad" value={f.ticketPrice} onChangeText={set('ticketPrice')} />
                </>
              )}

              <ToggleRow title="Chacun réserve son billet" subtitle="Sinon, l'organisateur avance les frais et le budget se met à jour"
                value={f.eachBooksOwnTransport} onChange={set('eachBooksOwnTransport')} />
            </>
          )}

          {/* ── 19 · Logement ── */}
          {step === 2 && (
            <>
              <Label>Type de logement</Label>
              <View style={s.chips}>
                {ACCOM_TYPES.map(t => (
                  <TouchableOpacity key={t.value} style={[s.chip, f.accomType === t.value && s.chipOn]} onPress={() => set('accomType')(t.value)}>
                    <Text style={[s.chipText, f.accomType === t.value && { color: Colors.white }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Label>Proposé par Talaria</Label>
              <AccommodationSuggestions place={f.destinationPlace} type={f.accomType} travelers={travelers}
                checkIn={iso(f.start)} checkOut={iso(stayEnd)}
                selectedName={isSuggested ? f.accomSuggestion : null} onPick={applySuggestion} onLoaded={onSuggestionsLoaded} />
              {!f.accomManual && (
                <TouchableOpacity onPress={enterOwnAccommodation} hitSlop={6} style={{ marginTop: 10 }}>
                  <Text style={s.ownAccom}>J'ai déjà mon logement : le saisir</Text>
                </TouchableOpacity>
              )}

              <Label>{isSuggested ? 'Logement choisi' : 'Logement'}</Label>
              <View style={s.accomCard}>
                <Input placeholder="Nom (ex. Loft lumineux · Barrio Antiguo)" value={f.accomName} onChangeText={set('accomName')} />
                <View style={s.row}>
                  <Input style={{ flex: 1 }} placeholder="Prix total (€)" keyboardType="number-pad" value={f.accomPrice} onChangeText={set('accomPrice')} />
                  <Input style={{ flex: 1 }} placeholder="Lien (Airbnb...)" autoCapitalize="none" value={f.accomLink} onChangeText={set('accomLink')} />
                </View>
                {int(f.accomPrice) ? (
                  <View style={s.accomFooter}>
                    <Text style={s.accomMeta}>{int(f.accomPrice)} € · {n} nuit{n > 1 ? 's' : ''}</Text>
                    <Text style={s.perPerson}>{accomPerPerson} €/pers</Text>
                  </View>
                ) : (
                  <Text style={s.hint}>Facultatif : tu pourras l'ajouter plus tard, ou plusieurs logements pour un road trip.</Text>
                )}
              </View>

              <Label>Adresse</Label>
              {/* Adresse exacte ou nom de l'établissement, cherchés près de la destination */}
              <PlaceAutocomplete type="address" placeholder="Adresse ou nom de l'hôtel" near={f.destinationPlace}
                value={f.accomAddress} place={f.accomAddressPlace}
                onChangeText={(v) => setF(p => ({ ...p, accomAddress: v, accomAddressPlace: null }))}
                onSelect={(r) => setF(p => ({
                  ...p,
                  accomAddress: [r.name, r.details].filter(Boolean).join(', '),
                  accomAddressPlace: r,
                  // Établissement choisi (hôtel...) : son nom devient celui du logement s'il n'est pas saisi
                  accomName: p.accomName.trim() || (/\d/.test(r.name) ? p.accomName : r.name),
                }))} />

              <ToggleRow title="Location de voiture" subtitle="Ajouter une voiture au budget du groupe" value={f.needsRental} onChange={set('needsRental')} />
              {f.needsRental && <Input placeholder="Coût de la location (€)" keyboardType="number-pad" value={f.rentalCost} onChangeText={set('rentalCost')} />}
              <ToggleRow title="Partager les frais équitablement" subtitle="Chaque participant paie la même part" value={f.splitCostsEqually} onChange={set('splitCostsEqually')} />
            </>
          )}

          {/* ── 20 · Inviter ── */}
          {step === 3 && (
            <>
              <View style={s.linkBox}>
                <Ionicons name="link-outline" size={18} color={Colors.parme} />
                <View style={{ flex: 1 }}>
                  <Text style={s.linkTitle}>Lien d'invitation</Text>
                  <Text style={s.linkSub}>
                    {group?.inviteCode ? `Code : ${group.inviteCode}` : selected.length ? 'Disponible dès la création du voyage' : 'Invite au moins un ami pour créer un groupe'}
                  </Text>
                </View>
                {group?.inviteCode && (
                  <TouchableOpacity style={s.copy} onPress={() => Share.share({ message: `Code Talaria : ${group.inviteCode}\ntalaria://groups/join?code=${group.inviteCode}` })}>
                    <Text style={s.copyText}>Partager</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.sectionRow}>
                <Label>Inviter des amis</Label>
                <Text style={s.count}>{selected.length} sélectionné{selected.length > 1 ? 's' : ''}</Text>
              </View>
              <Input icon="search" placeholder="Rechercher un ami" value={friendQuery} onChangeText={setFriendQuery} />
              {invitable.length === 0 ? (
                <Text style={s.hint}>{friends.length ? 'Tous tes amis font déjà partie du groupe.' : 'Ajoute des amis (Profil → Mes amis) pour les inviter.'}</Text>
              ) : invitable
                .filter(u => !friendQuery.trim() || `${u.displayName} ${u.username ?? ''}`.toLowerCase().includes(friendQuery.trim().toLowerCase()))
                .map(u => (
                  <TouchableOpacity key={u.id} style={s.friend} onPress={() => toggleFriend(u.id)} activeOpacity={0.85}>
                    <UserAvatar user={u} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{u.displayName}</Text>
                      {u.username ? <Text style={s.friendSub}>@{u.username}</Text> : null}
                    </View>
                    <View style={[s.check, selected.includes(u.id) && s.checkOn]}>
                      {selected.includes(u.id) && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                    </View>
                  </TouchableOpacity>
                ))}

              <View style={s.recap}>
                <Text style={s.recapTitle}>Récapitulatif</Text>
                {f.title.trim() ? <RecapRow label="Nom" value={f.title.trim()} /> : null}
                <RecapRow label="Destination" value={f.destination} />
                <RecapRow label="Dates" value={`${short(f.start)} → ${short(f.end)}`} />
                <RecapRow label="Transport" value={`${transportLabel}${int(f.ticketPrice) && f.transportMode !== 'voiture' ? ` · ${int(f.ticketPrice)} €/pers` : ''}`} />
                <RecapRow label="Logement" value={f.accomName ? `${ACCOM_TYPES.find(t => t.value === f.accomType)?.label}${accomPerPerson ? ` · ${accomPerPerson} €/pers` : ''}` : '—'} />
                <RecapRow label="Budget" value={int(f.budgetPerPerson) ? `${int(f.budgetPerPerson)} €/pers` : '—'} />
                <RecapRow label="Participants" value={`${travelers - 1} + toi`} />
              </View>
            </>
          )}

          {/* Navigation */}
          <View style={s.nav}>
            {step > 0 && (
              <TouchableOpacity style={s.prev} onPress={() => setStep(step - 1)}>
                <Ionicons name="arrow-back" size={16} color={Colors.parme} />
                <Text style={s.prevText}>Précédent</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.next, (!canNext || saving) && { opacity: 0.5 }]}
              disabled={!canNext || saving}
              onPress={() => (step < 3 ? setStep(step + 1) : submit())}
            >
              <Text style={s.nextText}>{step < 3 ? 'Suivant' : saving ? 'Création...' : 'Créer le voyage'}</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sélecteur de date : boîte de dialogue sur Android, fenêtre sur iOS */}
      {dateField && Platform.OS === 'android' && (
        <DateTimePicker value={f[dateField] ?? f.start ?? new Date()} mode="date" minimumDate={dateField === 'end' && f.start ? f.start : new Date()} onChange={onDate} />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={!!dateField} transparent animationType="fade" onRequestClose={() => setDateField(null)}>
          <View style={s.dateOverlay}>
            <View style={s.dateSheet}>
              {dateField && (
                <DateTimePicker value={f[dateField] ?? f.start ?? new Date()} mode="date" display="inline" locale="fr-FR"
                  minimumDate={dateField === 'end' && f.start ? f.start : new Date()} onChange={onDate} />
              )}
              <TouchableOpacity style={s.next} onPress={() => setDateField(null)}><Text style={s.nextText}>OK</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <GroupPickerSheet
        visible={groupPicker}
        selectedId={group?.id}
        onPick={(g) => { setGroupId(g.id); setGroupPicker(false); }}
        onClose={() => setGroupPicker(false)}
      />
      <FriendPickerSheet
        visible={picker}
        title="Ajouter des participants"
        confirmLabel="Valider"
        excludeIds={memberIds}
        initial={friends.filter(u => selected.includes(u.id))}
        onClose={() => setPicker(false)}
        onConfirm={(users) => { setSelected(users.map(u => u.id)); setPicker(false); }}
      />
    </View>
  );
}

/* ── Petits composants ─────────────────── */
const Label    = ({ children }) => <Text style={s.label}>{children}</Text>;
const SubLabel = ({ children }) => <Text style={s.subLabel}>{children}</Text>;

function Input({ icon, style, ...props }) {
  return (
    <View style={[s.inputWrap, style]}>
      {icon && <Ionicons name={icon} size={16} color={Colors.text} style={s.inputIcon} />}
      <TextInput style={[s.input, icon && { paddingLeft: 40 }]} placeholderTextColor="#b9aeb5" {...props} />
    </View>
  );
}

function DateButton({ placeholder, value, onPress }) {
  return (
    <TouchableOpacity style={s.dateBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={[s.dateText, !value && { color: '#b9aeb5' }]}>{value || placeholder}</Text>
      <Ionicons name="calendar-outline" size={18} color="#b9aeb5" />
    </TouchableOpacity>
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

const RecapRow = ({ label, value }) => (
  <View style={s.recapRow}>
    <Text style={s.recapLabel}>{label}</Text>
    <Text style={s.recapValue} numberOfLines={1}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  scroll: { paddingHorizontal: 20 },

  progress:   { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  bar:        { height: 4, borderRadius: 2, backgroundColor: '#e3d6dd' },
  barOn:      { backgroundColor: Colors.parme },
  barLabel:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  barLabelOn: { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.parme },

  groupNote: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, marginTop: 12 },
  label:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text, marginTop: 18, marginBottom: 8 },
  subLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text, marginBottom: 6 },
  hint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  error: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.error, marginTop: 4 },
  row:   { flexDirection: 'row', gap: 10 },
  link:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, textDecorationLine: 'underline', marginBottom: 10 },
  costCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#ece3e7', padding: 14, gap: 6, marginBottom: 10 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  costValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  costTotal: { backgroundColor: Colors.parme, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  costTotalText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },

  inputWrap: { justifyContent: 'center', marginBottom: 10 },
  inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7', paddingHorizontal: 16, paddingVertical: 13,
  },
  dateText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },

  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '100%',
  },
  groupChipText: { flexShrink: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  groupChipLink: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.parme, textDecorationLine: 'underline' },
  participants:    { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  participant:     { alignItems: 'center', width: 60 },
  participantName: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text, marginTop: 4 },
  addCircle:       { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },

  wish:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ece3e7' },
  wishText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#ece3e7', gap: 4 },
  tileOn:    { backgroundColor: Colors.parme, borderColor: Colors.parme },
  tileTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text, marginTop: 6 },
  tileHint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 10 },

  flight:     { backgroundColor: Colors.parme, borderRadius: 18, padding: 16, marginBottom: 12 },
  flightRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flightCity: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: Colors.white, flexShrink: 1 },
  flightDate: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  flightCta:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  flightCtaText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { borderWidth: 1, borderColor: '#d9cfd4', borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: Colors.white },
  chipOn:   { backgroundColor: Colors.parme, borderColor: Colors.parme },
  chipText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },

  ownAccom:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, textDecorationLine: 'underline' },
  accomCard:   { backgroundColor: Colors.white, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#ece3e7' },
  accomFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accomMeta:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  perPerson:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: '#15803d', backgroundColor: '#dcfce7', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },

  toggle:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  toggleSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  linkBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#efe6e9', borderRadius: 16, padding: 14, marginTop: 14 },
  linkTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  linkSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  copy:      { backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  copyText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },

  friend:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  friendName: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  friendSub:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  check:   { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#d9cfd4', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.parme, borderColor: Colors.parme },

  recap:      { backgroundColor: Colors.white, borderRadius: 18, padding: 16, marginTop: 16, gap: 6, borderWidth: 1, borderColor: '#ece3e7' },
  recapTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text, marginBottom: 4 },
  recapRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  recapLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  recapValue: { flexShrink: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text, textAlign: 'right' },

  nav:  { flexDirection: 'row', gap: 10, marginTop: 24 },
  prev: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 14 },
  prevText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  next: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14 },
  nextText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },

  dateOverlay: { flex: 1, backgroundColor: 'rgba(30,8,22,0.35)', justifyContent: 'center', padding: 20 },
  dateSheet:   { backgroundColor: Colors.white, borderRadius: 20, padding: 12, gap: 8 },
});

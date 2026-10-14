import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import PlaceAutocomplete from '../PlaceAutocomplete';
import UserAvatar from '../UserAvatar';
import { Colors } from '../../constants/Colors';

const ACCOM_TYPES = [
  { value: 'hotel', label: 'Hôtel' }, { value: 'airbnb', label: 'Airbnb' },
  { value: 'auberge', label: 'Auberge' }, { value: 'habitant', label: "Chez l'habitant" }, { value: 'autre', label: 'Autre' },
];
const MODES = [
  { value: 'train', label: 'Train', icon: 'train' }, { value: 'avion', label: 'Avion', icon: 'airplane' },
  { value: 'voiture', label: 'Voiture', icon: 'car' }, { value: 'bus', label: 'Bus', icon: 'bus' },
  { value: 'covoiturage', label: 'Covoiturage', icon: 'people' }, { value: 'autre', label: 'Autre', icon: 'navigate' },
];
const STATUS = {
  booked:   { label: 'Réservé',    bg: '#dcefdc', color: '#2f7a3a' },
  proposed: { label: 'Proposé',    bg: Colors.sableOr, color: Colors.parme },
  rejected: { label: 'Non retenu', bg: '#ece3e7', color: Colors.textMuted },
};

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const fmt = (iso) => utc(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const nights = (a, b) => Math.max(1, Math.round((utc(b) - utc(a)) / 864e5));
const eur = (n) => `${Math.round(n ?? 0).toLocaleString('fr-FR')} €`;
const int = (v) => { const n = parseInt(String(v ?? '').replace(/\s/g, ''), 10); return Number.isFinite(n) ? n : null; };
const withScheme = (url) => (url && !/^https?:\/\//i.test(url) ? `https://${url}` : url);
function tripDays(start, end) {
  const days = []; const d = utc(start);
  while (d <= utc(end) && days.length < 60) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return days;
}

/**
 * Onglet Logistique : mes réglages (budget, personnes rattachées), hébergements proposés au groupe
 * (👍/👎, réservation validée par l'organisateur → dépense partagée) et trajets de chacun (le trajet
 * choisi devient une dépense personnelle).
 */
export default function LogisticsTab({ trip, onChanged }) {
  const [data, setData] = useState(null);
  const [accomSheet, setAccomSheet] = useState(null);       // {} nouveau, ou hébergement à modifier
  const [transportSheet, setTransportSheet] = useState(null);
  const [meSheet, setMeSheet] = useState(false);
  const base = `/api/trips/${trip.id}`;

  const load = useCallback(() => {
    client.get(`${base}/logistics`).then(({ data: d }) => setData(d)).catch(() => setData(null));
  }, [base]);
  useFocusEffect(load);

  /** Toutes les actions renvoient la vue à jour */
  const run = async (request, changedBudget) => {
    try {
      const { data: d } = await request();
      if (d?.accommodations) setData(d); else load();
      if (changedBudget) onChanged?.();
    } catch (err) {
      Alert.alert('Logistique', err.response?.data?.message || 'Action impossible.');
    }
  };

  if (!data) return <ActivityIndicator color={Colors.parme} style={{ marginTop: 30 }} />;
  const me = data.travelers.find(t => t.isMe);

  return (
    <View style={{ marginTop: 4 }}>
      {/* Mes réglages pour ce voyage */}
      <TouchableOpacity style={s.meCard} onPress={() => setMeSheet(true)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={s.meTitle}>Mon voyage</Text>
          <Text style={s.meSub}>
            {data.me.dependents ? `Moi + ${data.me.dependents} personne${data.me.dependents > 1 ? 's' : ''} rattachée${data.me.dependents > 1 ? 's' : ''}` : 'Je voyage seul·e'}
            {' · '}{data.me.budget != null ? `budget ${eur(data.me.budget)}` : 'budget à définir'}
          </Text>
        </View>
        <Ionicons name="create-outline" size={18} color={Colors.white} />
      </TouchableOpacity>

      {/* Hébergements */}
      <View style={s.sectionRow}>
        <Text style={s.section}>Hébergements</Text>
        <Text style={s.count}>{data.travelersCount} voyageur{data.travelersCount > 1 ? 's' : ''}</Text>
      </View>
      {data.accommodations.length === 0 && <Text style={s.empty}>Aucun hébergement proposé pour l'instant.</Text>}
      {data.accommodations.map(a => (
        <AccommodationCard key={a.id} a={a} travelers={data.travelersCount}
          onReact={(liked) => run(() => client.post(`${base}/accommodations/${a.id}/reaction`, { liked }))}
          onBook={() => Alert.alert('Valider la réservation ?', `« ${a.name} » devient une dépense de ${eur(a.price)} partagée entre les participants, et les autres hébergements aux mêmes dates ne sont pas retenus.`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Valider', onPress: () => run(() => client.post(`${base}/accommodations/${a.id}/book`), true) },
          ])}
          onUnbook={() => run(() => client.post(`${base}/accommodations/${a.id}/unbook`), true)}
          onEdit={() => setAccomSheet(a)} />
      ))}
      <TouchableOpacity style={s.add} onPress={() => setAccomSheet({})} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color={Colors.parme} />
        <Text style={s.addText}>Proposer un hébergement</Text>
      </TouchableOpacity>

      {/* Trajets de chacun */}
      <Text style={s.section}>Trajets</Text>
      <Text style={s.hint}>Chacun part d'où il veut et compare ses options ; le trajet choisi s'ajoute à ses dépenses.</Text>
      {data.travelers.map(t => (
        <View key={t.user.id} style={s.traveler}>
          <View style={s.travelerHead}>
            <UserAvatar user={t.user} size={30} />
            <Text style={s.travelerName}>{t.isMe ? 'Moi' : t.user.firstName || t.user.displayName}</Text>
            {t.dependents > 0 && <Text style={s.heads}>+{t.dependents}</Text>}
          </View>
          {t.transports.length === 0 && <Text style={s.emptySmall}>{t.isMe ? 'Aucun trajet proposé.' : 'Pas encore de trajet.'}</Text>}
          {t.transports.map(o => (
            <TransportRow key={o.id} o={o} mine={t.isMe}
              onChoose={() => run(() => client.post(`${base}/transports/${o.id}/${o.chosen ? 'unchoose' : 'choose'}`), true)}
              onEdit={() => setTransportSheet(o)}
              onDelete={() => Alert.alert('Supprimer ce trajet ?', `${o.departureCity}`, [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => run(() => client.delete(`${base}/transports/${o.id}`), o.chosen) },
              ])} />
          ))}
          {t.isMe && (
            <TouchableOpacity style={s.addSmall} onPress={() => setTransportSheet({})} hitSlop={6}>
              <Ionicons name="add" size={15} color={Colors.parme} />
              <Text style={s.addSmallText}>Proposer un trajet</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <MeSheet visible={meSheet} me={data.me} onClose={() => setMeSheet(false)}
        onSave={(payload) => { setMeSheet(false); run(() => client.patch(`${base}/traveler`, payload), true); }} />
      <AccommodationSheet trip={trip} initial={accomSheet} onClose={() => setAccomSheet(null)}
        onSaved={() => { setAccomSheet(null); load(); onChanged?.(); }}
        onDelete={(a) => run(() => client.delete(`${base}/accommodations/${a.id}`), true).then(() => { setAccomSheet(null); load(); })} />
      <TransportSheet trip={trip} initial={transportSheet} meHeads={me?.heads ?? 1} onClose={() => setTransportSheet(null)}
        onSave={(payload, id) => {
          setTransportSheet(null);
          run(() => (id ? client.patch(`${base}/transports/${id}`, payload) : client.post(`${base}/transports`, payload)), true);
        }} />
    </View>
  );
}

function AccommodationCard({ a, travelers, onReact, onBook, onUnbook, onEdit }) {
  const st = STATUS[a.status] ?? STATUS.proposed;
  return (
    <View style={[s.card, a.status === 'rejected' && { opacity: 0.6 }]}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle} numberOfLines={1}>{a.name}</Text>
        <Text style={[s.status, { backgroundColor: st.bg, color: st.color }]}>{st.label}</Text>
      </View>
      <Text style={s.meta}>
        {fmt(a.checkIn)} → {fmt(a.checkOut)} · {nights(a.checkIn, a.checkOut)} nuit{nights(a.checkIn, a.checkOut) > 1 ? 's' : ''}
        {a.price ? ` · ${eur(a.price)} (${eur(a.price / Math.max(1, travelers))}/pers)` : ' · prix à compléter'}
      </Text>
      {a.address ? <Text style={s.meta} numberOfLines={1}>📍 {a.address}</Text> : null}
      {a.proposedBy && <Text style={s.by}>Proposé par {a.proposedBy.firstName || a.proposedBy.displayName}</Text>}

      <View style={s.reactions}>
        <TouchableOpacity style={[s.react, a.myReaction === 'like' && s.reactOn]} onPress={() => onReact(a.myReaction === 'like' ? null : true)}>
          <Ionicons name="thumbs-up" size={14} color={a.myReaction === 'like' ? Colors.white : Colors.parme} />
          <Text style={[s.reactText, a.myReaction === 'like' && { color: Colors.white }]}>{a.likes.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.react, a.myReaction === 'dislike' && s.reactOn]} onPress={() => onReact(a.myReaction === 'dislike' ? null : false)}>
          <Ionicons name="thumbs-down" size={14} color={a.myReaction === 'dislike' ? Colors.white : Colors.parme} />
          <Text style={[s.reactText, a.myReaction === 'dislike' && { color: Colors.white }]}>{a.dislikes.length}</Text>
        </TouchableOpacity>
        <Text style={s.who} numberOfLines={2}>
          {a.likes.length ? `👍 ${a.likes.map(u => u.firstName || u.displayName).join(', ')}` : ''}
          {a.likes.length && a.dislikes.length ? '   ' : ''}
          {a.dislikes.length ? `👎 ${a.dislikes.map(u => u.firstName || u.displayName).join(', ')}` : ''}
        </Text>
      </View>

      <View style={s.cardActions}>
        {a.link ? (
          <TouchableOpacity onPress={() => Linking.openURL(withScheme(a.link))} hitSlop={6}><Text style={s.linkText}>Voir l'annonce</Text></TouchableOpacity>
        ) : <View />}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <TouchableOpacity onPress={onEdit} hitSlop={6}><Ionicons name="create-outline" size={18} color={Colors.textMuted} /></TouchableOpacity>
          {a.canBook && a.status === 'proposed' && (
            <TouchableOpacity style={s.bookBtn} onPress={onBook}><Text style={s.bookText}>Valider la réservation</Text></TouchableOpacity>
          )}
          {a.canBook && a.status === 'booked' && (
            <TouchableOpacity onPress={onUnbook} hitSlop={6}><Text style={s.unbookText}>Annuler la réservation</Text></TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function TransportRow({ o, mine, onChoose, onEdit, onDelete }) {
  const mode = MODES.find(m => m.value === o.mode) ?? MODES[5];
  return (
    <View style={[s.option, o.chosen && s.optionChosen]}>
      <Ionicons name={mode.icon} size={18} color={Colors.parme} />
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle} numberOfLines={1}>{mode.label} · depuis {o.departureCity}</Text>
        <Text style={s.optionSub} numberOfLines={1}>{o.price != null ? eur(o.price) : 'Prix à compléter'}{o.note ? ` · ${o.note}` : ''}</Text>
      </View>
      {o.link ? <TouchableOpacity onPress={() => Linking.openURL(withScheme(o.link))} hitSlop={6}><Ionicons name="open-outline" size={16} color={Colors.textMuted} /></TouchableOpacity> : null}
      {mine ? (
        <>
          <TouchableOpacity onPress={onEdit} hitSlop={6}><Ionicons name="create-outline" size={17} color={Colors.textMuted} /></TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={6}><Ionicons name="trash-outline" size={16} color={Colors.textMuted} /></TouchableOpacity>
          <TouchableOpacity style={[s.choose, o.chosen && s.chooseOn]} onPress={onChoose}>
            <Text style={[s.chooseText, o.chosen && { color: Colors.white }]}>{o.chosen ? 'Choisi ✓' : 'Choisir'}</Text>
          </TouchableOpacity>
        </>
      ) : (o.chosen ? <Text style={s.chosenTag}>Choisi</Text> : null)}
    </View>
  );
}

/** Mes réglages : budget personnel et personnes rattachées */
function MeSheet({ visible, me, onClose, onSave }) {
  const [budget, setBudget] = useState('');
  const [dependents, setDependents] = useState(0);
  useEffect(() => {
    if (visible) { setBudget(me.budget != null ? String(me.budget) : ''); setDependents(me.dependents ?? 0); }
  }, [visible, me]);

  return (
    <BottomSheet visible={visible} title="Mon voyage" onClose={onClose} footer={(
      <TouchableOpacity style={s.primary} onPress={() => onSave({ budget: budget === '' ? null : int(budget), dependents })}>
        <Text style={s.primaryText}>Enregistrer</Text>
      </TouchableOpacity>
    )}>
      <SheetLabel style={{ marginTop: 4 }}>Personnes rattachées (enfants...)</SheetLabel>
      <Text style={s.hint}>Elles voyagent avec toi : ta part des dépenses communes et des activités compte pour {1 + dependents} personne{dependents ? 's' : ''}.</Text>
      <View style={s.stepper}>
        <TouchableOpacity style={s.stepBtn} onPress={() => setDependents(d => Math.max(0, d - 1))}><Ionicons name="remove" size={18} color={Colors.parme} /></TouchableOpacity>
        <Text style={s.stepValue}>{dependents}</Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => setDependents(d => Math.min(20, d + 1))}><Ionicons name="add" size={18} color={Colors.parme} /></TouchableOpacity>
      </View>
      <SheetLabel>Mon budget pour ce voyage (€)</SheetLabel>
      <TextInput style={s.input} keyboardType="number-pad" placeholder="Pour toi et tes personnes rattachées" placeholderTextColor="#b9aeb5"
        value={budget} onChangeText={(v) => setBudget(v.replace(/\D/g, ''))} />
      <Text style={s.hint}>Le budget du voyage est la somme des budgets de chacun.</Text>
    </BottomSheet>
  );
}

/** Proposer ou modifier un hébergement */
function AccommodationSheet({ trip, initial, onClose, onSaved, onDelete }) {
  const days = tripDays(trip.startDate, trip.endDate);
  const lastDay = days[days.length - 1];
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!initial) return;
    setF({
      name: initial.name ?? '', type: initial.type ?? 'airbnb',
      checkIn: initial.checkIn ?? trip.startDate, checkOut: initial.checkOut ?? lastDay,
      price: initial.price != null ? String(initial.price) : '', link: initial.link ?? '',
      address: initial.address ?? '', addressPlace: null,
    });
  }, [initial, trip.startDate, lastDay]);
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));
  const near = trip.destinationLatitude != null ? { latitude: trip.destinationLatitude, longitude: trip.destinationLongitude } : null;

  const save = async () => {
    if (!f.name?.trim()) { Alert.alert('Nom requis', "Donne un nom à l'hébergement."); return; }
    setSaving(true);
    const payload = {
      name: f.name.trim(), type: f.type, checkIn: f.checkIn, checkOut: f.checkOut,
      price: f.price === '' ? null : int(f.price), link: f.link.trim() || null, address: f.address.trim() || null,
    };
    try {
      if (initial?.id) await client.patch(`/api/trips/${trip.id}/accommodations/${initial.id}`, payload);
      else await client.post(`/api/trips/${trip.id}/accommodations`, payload);
      onSaved();
    } catch (err) {
      Alert.alert('Hébergement', err.response?.data?.message || "Impossible d'enregistrer.");
    } finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={!!initial} title={initial?.id ? "Modifier l'hébergement" : 'Proposer un hébergement'} onClose={onClose} footer={(
      <TouchableOpacity style={[s.primary, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        <Text style={s.primaryText}>{initial?.id ? 'Enregistrer' : 'Proposer au groupe'}</Text>
      </TouchableOpacity>
    )}>
      {initial && (
        <>
          <SheetLabel style={{ marginTop: 4 }}>Type</SheetLabel>
          <View style={s.chips}>{ACCOM_TYPES.map(t => <Chip key={t.value} label={t.label} active={f.type === t.value} onPress={() => set('type')(t.value)} />)}</View>
          <SheetLabel>Nom</SheetLabel>
          <TextInput style={s.input} placeholder="Loft lumineux · Alfama" placeholderTextColor="#b9aeb5" value={f.name} onChangeText={set('name')} />
          <SheetLabel>Adresse</SheetLabel>
          <PlaceAutocomplete type="address" placeholder="Adresse ou nom de l'hôtel" near={near}
            value={f.address ?? ''} place={f.addressPlace}
            onChangeText={(v) => setF(p => ({ ...p, address: v, addressPlace: null }))}
            onSelect={(r) => setF(p => ({ ...p, address: [r.name, r.details].filter(Boolean).join(', '), addressPlace: r, name: p.name?.trim() || (/\d/.test(r.name) ? p.name : r.name) }))} />
          <SheetLabel>Arrivée</SheetLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map(d => <Chip key={d} label={fmt(d)} active={f.checkIn === d} onPress={() => setF(p => ({ ...p, checkIn: d, checkOut: p.checkOut <= d ? days[days.indexOf(d) + 1] ?? d : p.checkOut }))} />)}
          </ScrollView>
          <SheetLabel>Départ</SheetLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.filter(d => d > f.checkIn).map(d => <Chip key={d} label={fmt(d)} active={f.checkOut === d} onPress={() => set('checkOut')(d)} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SheetLabel>Prix total (€)</SheetLabel>
              <TextInput style={s.input} keyboardType="number-pad" placeholder="600" placeholderTextColor="#b9aeb5" value={f.price} onChangeText={(v) => set('price')(v.replace(/\D/g, ''))} />
            </View>
            <View style={{ flex: 1 }}>
              <SheetLabel>Lien (Airbnb...)</SheetLabel>
              <TextInput style={s.input} autoCapitalize="none" placeholder="airbnb.fr/..." placeholderTextColor="#b9aeb5" value={f.link} onChangeText={set('link')} />
            </View>
          </View>
          {initial.id && (
            <TouchableOpacity style={{ alignSelf: 'center', marginTop: 16 }} onPress={() => Alert.alert('Supprimer cet hébergement ?', initial.name, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(initial) },
            ])}>
              <Text style={s.unbookText}>Supprimer l'hébergement</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </BottomSheet>
  );
}

/** Proposer ou modifier un trajet (le mien) ; en voiture, le prix est estimé depuis la distance */
function TransportSheet({ trip, initial, meHeads, onClose, onSave }) {
  const [f, setF] = useState({});
  const [estimate, setEstimate] = useState(null);
  useEffect(() => {
    if (!initial) return;
    setF({
      mode: initial.mode ?? 'train', departureCity: initial.departureCity ?? trip.departureCity ?? '',
      departurePlace: initial.departureLatitude != null ? { latitude: initial.departureLatitude, longitude: initial.departureLongitude, name: initial.departureCity } : null,
      price: initial.price != null ? String(initial.price) : '', link: initial.link ?? '', note: initial.note ?? '',
    });
    setEstimate(null);
  }, [initial, trip.departureCity]);
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  // Voiture : essence aller-retour (7 L/100 km à 1,72 €/L) d'après l'itinéraire
  useEffect(() => {
    const from = f.departurePlace;
    if (f.mode !== 'voiture' || !from || trip.destinationLatitude == null) { setEstimate(null); return undefined; }
    let cancelled = false;
    client.get('/api/geo/route', { params: { from: `${from.latitude},${from.longitude}`, to: `${trip.destinationLatitude},${trip.destinationLongitude}` } })
      .then(({ data }) => { if (!cancelled) setEstimate({ km: data.distanceKm, fuel: Math.round(data.distanceKm * 2 * 7 / 100 * 1.72) }); })
      .catch(() => { if (!cancelled) setEstimate(null); });
    return () => { cancelled = true; };
  }, [f.mode, f.departurePlace, trip.destinationLatitude, trip.destinationLongitude]);

  const submit = () => {
    if (!f.departureCity?.trim()) { Alert.alert('Départ requis', "D'où pars-tu ?"); return; }
    onSave({
      mode: f.mode, departureCity: f.departureCity.trim(),
      departureLatitude: f.departurePlace?.latitude ?? null, departureLongitude: f.departurePlace?.longitude ?? null,
      price: f.price === '' ? null : int(f.price), link: f.link.trim() || null, note: f.note.trim() || null,
    }, initial?.id);
  };

  return (
    <BottomSheet visible={!!initial} title={initial?.id ? 'Modifier le trajet' : 'Proposer un trajet'} onClose={onClose} footer={(
      <TouchableOpacity style={s.primary} onPress={submit}><Text style={s.primaryText}>Enregistrer</Text></TouchableOpacity>
    )}>
      {initial && (
        <>
          <SheetLabel style={{ marginTop: 4 }}>Moyen de transport</SheetLabel>
          <View style={s.chips}>{MODES.map(m => <Chip key={m.value} label={m.label} active={f.mode === m.value} onPress={() => set('mode')(m.value)} />)}</View>
          <SheetLabel>Départ</SheetLabel>
          <PlaceAutocomplete placeholder="Ville de départ" value={f.departureCity ?? ''} place={f.departurePlace}
            onChangeText={(v) => setF(p => ({ ...p, departureCity: v, departurePlace: null }))}
            onSelect={(r) => setF(p => ({ ...p, departureCity: r.name, departurePlace: r }))} />
          <SheetLabel>Prix aller-retour (€){meHeads > 1 ? ` · pour ${meHeads} personnes` : ''}</SheetLabel>
          <TextInput style={s.input} keyboardType="number-pad" placeholder="120" placeholderTextColor="#b9aeb5" value={f.price} onChangeText={(v) => set('price')(v.replace(/\D/g, ''))} />
          {estimate && (
            <TouchableOpacity onPress={() => set('price')(String(estimate.fuel))}>
              <Text style={s.estimate}>{estimate.km} km : essence aller-retour ≈ {estimate.fuel} € (hors péages) · utiliser</Text>
            </TouchableOpacity>
          )}
          <SheetLabel>Lien (billet, covoiturage...)</SheetLabel>
          <TextInput style={s.input} autoCapitalize="none" placeholder="sncf-connect.com/..." placeholderTextColor="#b9aeb5" value={f.link} onChangeText={set('link')} />
          <SheetLabel>Note</SheetLabel>
          <TextInput style={s.input} placeholder="Départ 8 h 12, retour dimanche soir" placeholderTextColor="#b9aeb5" value={f.note} onChangeText={set('note')} />
        </>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  meCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.parme, borderRadius: 16, padding: 14 },
  meTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
  meSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text, marginTop: 20, marginBottom: 10 },
  count: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  hint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginBottom: 10, lineHeight: 17 },
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, marginBottom: 10 },
  emptySmall: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginLeft: 40 },

  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#efe6e9', padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  status: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  meta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  by: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  reactions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  react: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  reactOn: { backgroundColor: Colors.parme },
  reactText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },
  who: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  linkText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, textDecorationLine: 'underline' },
  bookBtn: { backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  bookText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },
  unbookText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.error },

  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.parme, borderRadius: 100, paddingVertical: 12 },
  addText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },

  traveler: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#efe6e9', padding: 12, marginBottom: 10, gap: 8 },
  travelerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  travelerName: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  heads: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme, backgroundColor: Colors.parmeLight, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#efe6e9', paddingHorizontal: 10, paddingVertical: 8 },
  optionChosen: { borderColor: '#2f9e5b', backgroundColor: '#f1faf2' },
  optionTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  optionSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },
  choose: { borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  chooseOn: { backgroundColor: '#2f9e5b', borderColor: '#2f9e5b' },
  chooseText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },
  chosenTag: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: '#2f7a3a' },
  addSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginLeft: 40 },
  addSmallText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  estimate: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme, marginTop: 8, textDecorationLine: 'underline' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18, alignSelf: 'flex-start' },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: Colors.parme, minWidth: 24, textAlign: 'center' },
  primary: { backgroundColor: Colors.parme, borderRadius: 100, height: 50, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});

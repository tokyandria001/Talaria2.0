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
import GroupHero from '../components/groups/GroupHero';
import FriendPickerSheet from '../components/groups/FriendPickerSheet';
import UserAvatar from '../components/UserAvatar';
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

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [group, setGroup]   = useState(null);        // groupe existant (voyage lancé depuis un groupe)
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);      // amis invités (ids)
  const [friendQuery, setFriendQuery] = useState('');
  const [picker, setPicker] = useState(false);
  const [dateField, setDateField] = useState(null);  // 'start' | 'end' | null

  const [f, setF] = useState({
    destination: '', start: null, end: null, budgetPerPerson: '', wishes: [],
    transportMode: 'avion', departureCity: '', ticketPrice: '', eachBooksOwnTransport: false,
    distanceKm: '', fuelPrice: '', fuelConsumption: '', tollCost: '',
    accomType: 'airbnb', accomName: '', accomPrice: '', accomAddress: '', accomLink: '',
    needsRental: false, rentalCost: '', splitCostsEqually: true,
  });
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    client.get('/api/friends').then(({ data }) => setFriends(data.map(x => x.user))).catch(() => {});
    if (presetGroupId) client.get(`/api/groups/${presetGroupId}`).then(({ data }) => setGroup(data)).catch(() => {});
  }, [presetGroupId]);

  const memberIds = useMemo(() => (group?.members ?? []).map(m => m.user.id), [group]);
  const invitable = friends.filter(u => !memberIds.includes(u.id));
  const travelers = (group ? group.membersCount : 1) + selected.length;
  const n = nights(f.start, f.end);
  const accomPerPerson = int(f.accomPrice) ? Math.round(int(f.accomPrice) / travelers) : null;

  const canNext = [
    f.destination.trim() && f.start && f.end && f.end >= f.start,
    f.departureCity.trim().length > 0,
    true,
    true,
  ][step];

  const toggleWish = (v) => setF(p => ({ ...p, wishes: p.wishes.includes(v) ? p.wishes.filter(w => w !== v) : [...p.wishes, v] }));
  const toggleFriend = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = async () => {
    setSaving(true);
    let groupId = presetGroupId;
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
        destination: f.destination.trim(),
        departureCity: f.departureCity.trim(),
        startDate: iso(f.start), endDate: iso(f.end),
        travelers,
        budget: perPerson != null ? perPerson * travelers : null,
        transportMode: f.transportMode,
        transportPricePerPerson: car ? null : int(f.ticketPrice),
        distanceKm: car ? int(f.distanceKm) : null,
        fuelPricePerLiter: car && f.fuelPrice ? parseFloat(f.fuelPrice.replace(',', '.')) : null,
        fuelConsumption: car && f.fuelConsumption ? parseFloat(f.fuelConsumption.replace(',', '.')) : null,
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
          price: int(f.accomPrice), address: f.accomAddress.trim() || null,
          link: link && !/^https?:\/\//i.test(link) ? `https://${link}` : link || null,
        }).catch(() => Alert.alert('Logement non enregistré', 'Le voyage est créé ; ajoutez le logement depuis « Modifier ».'));
      }

      const code = createdGroup?.inviteCode ?? group?.inviteCode;
      router.replace(`/planning/${trip.id}`);
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
              <Label>Rechercher une destination</Label>
              <Input placeholder="Entrez un pays, une ville..." value={f.destination} onChangeText={set('destination')} />

              <Label>Les dates du voyage</Label>
              <DateButton placeholder="Date de l'aller" value={fmt(f.start)} onPress={() => setDateField('start')} />
              <DateButton placeholder="Date du retour" value={fmt(f.end)} onPress={() => setDateField('end')} />
              {f.start && f.end && f.end < f.start && <Text style={s.error}>Le retour doit être après l'aller.</Text>}

              <Label>Budget par personne</Label>
              <Input placeholder="Exemple : 950 €" keyboardType="number-pad" value={f.budgetPerPerson} onChangeText={set('budgetPerPerson')} />

              <Label>Les participants</Label>
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
                <TouchableOpacity style={s.participant} onPress={() => setPicker(true)}>
                  <View style={s.addCircle}><Ionicons name="add" size={26} color={Colors.white} /></View>
                  <Text style={s.participantName}>Ajouter</Text>
                </TouchableOpacity>
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
              <Input icon="location-outline" placeholder="Paris (CDG)" value={f.departureCity} onChangeText={set('departureCity')} />
              <SubLabel>Arrivée</SubLabel>
              <Input icon="location-outline" value={f.destination} onChangeText={set('destination')} />

              {f.transportMode === 'voiture' ? (
                <>
                  <Label>Coût de la route</Label>
                  <View style={s.row}>
                    <Input style={{ flex: 1 }} placeholder="Distance aller (km)" keyboardType="number-pad" value={f.distanceKm} onChangeText={set('distanceKm')} />
                    <Input style={{ flex: 1 }} placeholder="Péages A/R (€)" keyboardType="number-pad" value={f.tollCost} onChangeText={set('tollCost')} />
                  </View>
                  <View style={s.row}>
                    <Input style={{ flex: 1 }} placeholder="Carburant (€/L)" keyboardType="decimal-pad" value={f.fuelPrice} onChangeText={set('fuelPrice')} />
                    <Input style={{ flex: 1 }} placeholder="Conso. (L/100 km)" keyboardType="decimal-pad" value={f.fuelConsumption} onChangeText={set('fuelConsumption')} />
                  </View>
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

              <Label>Logement</Label>
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
              <Input icon="location-outline" placeholder="Calle Morelos 812, Barrio Antiguo" value={f.accomAddress} onChangeText={set('accomAddress')} />

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

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client, { assetUrl } from '../../api/client';
import GroupHero from '../../components/groups/GroupHero';
import FriendPickerSheet from '../../components/groups/FriendPickerSheet';
import ActivitySheet from '../../components/trip/ActivitySheet';
import BudgetTab from '../../components/trip/BudgetTab';
import VotesTab from '../../components/trip/VotesTab';
import LogisticsTab from '../../components/trip/LogisticsTab';
import ChatTab from '../../components/trip/ChatTab';
import UserAvatar from '../../components/UserAvatar';
import { Colors } from '../../constants/Colors';
import { categoryOf } from '../../constants/PlaceCategories';

const TABS = ['Planning', 'Logistique', 'Budget', 'Votes', 'Chat'];
const SLOT_TIMES = { matin: 'Matin', midi: 'Midi', 'apres-midi': 'Après-midi', soir: 'Soir' };
const TRANSPORT = { avion: ['airplane', 'Vol'], train: ['train', 'Train'], bus: ['bus', 'Bus'], voiture: ['car', 'Route'] };

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const fmt = (iso, opts) => utc(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...opts });
const eur = (n) => `${(n ?? 0).toLocaleString('fr-FR')} €`;

function tripDays(start, end) {
  const days = [];
  const d = utc(start);
  while (d <= utc(end) && days.length < 60) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return days;
}

/** Détail d'un voyage (maquette) : onglets Planning, Budget, Votes, Chat */
export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, tab: initialTab } = useLocalSearchParams();

  const [trip, setTrip]             = useState(null);
  const [activities, setActivities] = useState([]);
  const [priceDefaults, setPriceDefaults]   = useState({});
  const [tab, setTab]               = useState(TABS.includes(initialTab) ? initialTab : 'Planning');
  const [day, setDay]               = useState(null);
  const [sheet, setSheet]           = useState(null);   // activité en cours d'édition, ou {} pour une nouvelle
  const [picker, setPicker]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [votesKey, setVotesKey]     = useState(0);       // recharge l'onglet Votes après une proposition

  const load = useCallback(async () => {
    try {
      const [t, a, d] = await Promise.all([
        client.get(`/api/trips/${id}`),
        client.get(`/api/trips/${id}/activities`),
        client.get('/api/price-defaults'),
      ]);
      setTrip(t.data); setActivities(a.data); setPriceDefaults(d.data);
    } catch {
      Alert.alert('Voyage introuvable', "Ce voyage n'existe plus ou vous n'y avez plus accès.");
      router.back();
    } finally { setRefreshing(false); }
  }, [id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(() => (trip ? tripDays(trip.startDate, trip.endDate) : []), [trip]);
  const currentDay = days.includes(day) ? day : days[0];
  const dayActivities = activities.filter(a => a.date === currentDay);

  const coords = useRef(null);
  const generate = async () => {
    setGenerating(true);
    try {
      if (!coords.current) {
        coords.current = (async () => {
          try {
            await Location.requestForegroundPermissionsAsync();
            const [g] = await Location.geocodeAsync(trip.destination);
            return g ? { lat: g.latitude, lng: g.longitude } : {};
          } catch { return {}; }
        })();
      }
      const { data } = await client.post(`/api/trips/${id}/activities/generate`, { ...(await coords.current) });
      setActivities(data.activities);
      if (!data.created) Alert.alert('Planning complet', 'Le matin et le midi de chaque jour sont déjà prévus.');
    } catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Impossible de remplir le planning.'); }
    finally { setGenerating(false); }
  };

  /** Ajouter des participants : dans le groupe du voyage, ou création d'un groupe pour un voyage perso */
  const addParticipants = async (users) => {
    setPicker(false);
    if (!users.length) return;
    try {
      if (trip.group) {
        await client.post(`/api/groups/${trip.group.id}/members`, { userIds: users.map(u => u.id) });
      } else {
        if (!trip.permissions?.canManage) return;
        const { data: g } = await client.post('/api/groups', { name: trip.title || `${trip.destination} ${trip.startDate.slice(0, 4)}`, memberIds: users.map(u => u.id) });
        await client.patch(`/api/trips/${id}`, { groupId: g.id });
      }
      Alert.alert('Invitations envoyées', 'Tes amis verront le voyage dès qu\'ils auront rejoint le groupe.');
      load();
    } catch (err) { Alert.alert('Erreur', err.response?.data?.message || "Impossible d'inviter."); }
  };

  const onSaved = (activity) => {
    setActivities(prev => {
      const others = prev.filter(a => a.id !== activity.id);
      return [...others, activity].sort((x, y) => `${x.date}${x.time ?? '99'}`.localeCompare(`${y.date}${y.time ?? '99'}`));
    });
    setDay(activity.date);
    setSheet(null);
  };

  if (!trip) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  return (
    <View style={s.root}>
      <GroupHero
        label={`du ${fmt(trip.startDate, { day: '2-digit', month: '2-digit' })} au ${fmt(trip.endDate, { day: '2-digit', month: '2-digit' })}`}
        title={trip.title || trip.destination}
        onBack={() => router.back()}
      />

      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]} numberOfLines={1} adjustsFontSizeToFit>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Le chat a sa propre liste et sa barre de saisie */}
      {tab === 'Chat' ? <ChatTab trip={trip} bottomInset={insets.bottom} /> : (
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.parme} />}
      >
        {tab === 'Planning' && (
          <>
            {/* Participants */}
            <Text style={s.section}>Les participants</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {trip.participants.map(p => (
                <View key={p.id} style={s.person}>
                  <UserAvatar user={p} size={48} />
                  <Text style={s.personName} numberOfLines={1}>{p.firstName || p.displayName}</Text>
                </View>
              ))}
              {(trip.group || trip.permissions?.canManage) && (
                <TouchableOpacity style={s.person} onPress={() => setPicker(true)}>
                  <View style={s.add}><Ionicons name="add" size={24} color={Colors.white} /></View>
                  <Text style={s.personName}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Billets / trajet */}
            <Text style={s.section}>{trip.transportMode === 'voiture' ? 'Le trajet' : `Les billets ${trip.transportMode === 'avion' ? "d'avion" : `de ${TRANSPORT[trip.transportMode]?.[1].toLowerCase()}`}`}</Text>
            <View style={s.ticket}>
              <View style={s.ticketRow}>
                <Text style={s.ticketCity} numberOfLines={1}>{trip.departureCity}</Text>
                <Ionicons name={TRANSPORT[trip.transportMode]?.[0] ?? 'airplane'} size={18} color={Colors.white} />
                <Text style={[s.ticketCity, { textAlign: 'right' }]} numberOfLines={1}>{trip.destination}</Text>
              </View>
              <View style={s.ticketRow}>
                <Text style={s.ticketMeta}>{fmt(trip.startDate, { weekday: 'short', day: 'numeric', month: 'long' })}</Text>
                <Text style={s.ticketMeta}>
                  {trip.transportMode === 'voiture'
                    ? (trip.computedTotalCost ? `${eur(trip.computedTotalCost)} essence + péages` : 'Coût à compléter')
                    : (trip.transportPricePerPerson ? `${eur(trip.transportPricePerPerson)} / pers` : 'Prix à compléter')}
                </Text>
              </View>
            </View>
            <Text style={s.small}>
              {trip.transportMode === 'voiture' ? 'Frais de route partagés entre les participants'
                : trip.eachBooksOwnTransport ? 'Chacun réserve son billet' : "L'organisateur réserve et avance les billets"}
            </Text>

            {/* Programme : jours du voyage */}
            <Text style={s.section}>Programme</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map(d => {
                const on = d === currentDay;
                const count = activities.filter(a => a.date === d).length;
                return (
                  <TouchableOpacity key={d} style={[s.dayPill, on && s.dayPillOn]} onPress={() => setDay(d)}>
                    <Text style={[s.dayNum, on && { color: Colors.white }]}>{fmt(d, { day: '2-digit' })}</Text>
                    <View style={[s.dayDot, !count && { opacity: 0 }, on && { backgroundColor: Colors.white }]} />
                    <Text style={[s.dayName, on && { color: Colors.white }]}>{fmt(d, { weekday: 'short' }).replace('.', '')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Détail de la journée */}
            <View style={s.sectionRow}>
              <Text style={s.section}>Détail de la journée</Text>
              <TouchableOpacity onPress={generate} disabled={generating}>
                <Text style={s.link}>{generating ? 'Remplissage...' : '✨ Remplir'}</Text>
              </TouchableOpacity>
            </View>
            {dayActivities.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Rien de prévu le {fmt(currentDay, { weekday: 'long', day: 'numeric', month: 'long' })}.</Text>
              </View>
            ) : (
              <View>
                {dayActivities.map(a => <TimelineItem key={a.id} activity={a} onPress={() => setSheet(a)} />)}
              </View>
            )}
            {/* Ajout depuis la carte de la destination ; ou une activité sans lieu (réunion, temps libre...) */}
            <TouchableOpacity style={s.addActivity} onPress={() => router.push({ pathname: '/trip-map/[id]', params: { id: String(trip.id), day: currentDay } })}>
              <Ionicons name="map-outline" size={18} color={Colors.parme} />
              <Text style={s.addActivityText}>Ajouter une activité</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addManual} onPress={() => setSheet({ date: currentDay })} hitSlop={8}>
              <Text style={s.addManualText}>ou saisir une activité sans lieu</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'Logistique' && <LogisticsTab trip={trip} onChanged={load} />}
        {tab === 'Budget' && <BudgetTab trip={trip} />}
        {tab === 'Votes' && (
          <VotesTab trip={trip} refreshKey={votesKey}
            onPropose={() => router.push({ pathname: '/trip-map/[id]', params: { id: String(trip.id), day: currentDay, mode: 'vote' } })}
            onProposeManual={() => setSheet({ date: currentDay, propose: true })}
            onChanged={load} />
        )}
      </ScrollView>
      )}

      {tab === 'Planning' && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[s.footerBtn, s.footerPrimary]} onPress={() => setTab('Chat')}>
            <Ionicons name="chatbubble-outline" size={16} color={Colors.white} />
            <Text style={[s.footerText, { color: Colors.white }]}>Accéder à la conversation</Text>
          </TouchableOpacity>
          {trip.permissions?.canManage && (
            <TouchableOpacity style={s.footerBtn} onPress={() => router.push({ pathname: '/(tabs)/trips', params: { edit: String(trip.id) } })}>
              <Ionicons name="pencil-outline" size={16} color={Colors.parme} />
              <Text style={s.footerText}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ActivitySheet
        visible={!!sheet}
        trip={trip}
        days={days}
        initial={sheet}
        priceDefaults={priceDefaults}
        onClose={() => setSheet(null)}
        onSaved={onSaved}
        onDeleted={(a) => { setActivities(prev => prev.filter(x => x.id !== a.id)); setSheet(null); }}
        onProposed={() => { setSheet(null); setTab('Votes'); setVotesKey(k => k + 1); load(); }}
      />
      <FriendPickerSheet visible={picker} excludeIds={trip.participants.map(p => p.id)} onClose={() => setPicker(false)} onConfirm={addParticipants} />
    </View>
  );
}

/** Élément de la frise horaire : heure, photo du lieu (ou illustration de la catégorie), titre, détails */
function TimelineItem({ activity: a, onPress }) {
  const cat = categoryOf({ tags: a.category ? [a.category] : [] });
  const photo = a.place?.photo;
  const subtitle = a.description || (a.place?.address ? `RDV : ${a.place.address}` : null);
  return (
    <View style={s.tlRow}>
      <View style={s.tlLeft}>
        <Text style={s.tlTime}>{a.time ?? SLOT_TIMES[a.slot]}</Text>
        <View style={s.tlLine} />
      </View>
      <TouchableOpacity style={s.tlCard} onPress={onPress} activeOpacity={0.85}>
        {/* Carte compacte (vignette à gauche) : une journée de 4-5 activités tient à l'écran */}
        {photo
          ? <Image source={{ uri: assetUrl(photo) }} style={s.tlImage} />
          : <View style={[s.tlImage, s.tlImageEmpty, { backgroundColor: cat.color }]}><Ionicons name={cat.icon} size={26} color="rgba(255,255,255,0.9)" /></View>}
        <View style={s.tlBody}>
          <Text style={s.tlTitle} numberOfLines={1}>{a.title}</Text>
          {subtitle ? <Text style={s.tlSub} numberOfLines={1}>{subtitle}</Text> : null}
          <View style={s.tlMeta}>
            {a.price != null && <Text style={s.tlTag}>{eur(a.price)} / pers</Text>}
            {a.hasSpecialPrice && <Text style={s.tlTag}>🏷 {a.specialPriceNote || 'Tarif spécial'}</Text>}
            {a.isAuto && <Text style={[s.tlTag, { backgroundColor: Colors.sableOr }]}>✨ Suggestion</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18 },

  tabs:      { flexDirection: 'row', marginHorizontal: 18, marginVertical: 12, backgroundColor: '#efe6e9', borderRadius: 100, padding: 4 },
  tab:       { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 100 },
  tabOn:     { backgroundColor: Colors.parme },
  tabText:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  tabTextOn: { color: Colors.white },

  section:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text, marginTop: 18, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, marginTop: 8 },
  small:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  person:     { alignItems: 'center', width: 56 },
  personName: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text, marginTop: 4 },
  add:        { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },

  ticket:     { backgroundColor: Colors.parme, borderRadius: 18, padding: 16, gap: 8 },
  ticketRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ticketCity: { flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: Colors.white },
  ticketMeta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  dayPill:   { width: 46, height: 92, borderRadius: 23, backgroundColor: '#efe6e9', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  dayPillOn: { backgroundColor: Colors.parme },
  dayNum:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.text },
  dayDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.parme },
  dayName:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },

  tlRow:   { flexDirection: 'row', gap: 10 },
  tlLeft:  { width: 44, alignItems: 'center' },
  tlTime:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.textMuted },
  tlLine:  { flex: 1, width: 2, backgroundColor: '#e3d6dd', marginVertical: 4, borderRadius: 1 },
  tlCard:  { flex: 1, flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  tlImage: { width: 78, alignSelf: 'stretch', minHeight: 78 },
  tlImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  tlBody:  { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  tlTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  tlSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tlMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tlTag:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme, backgroundColor: 'rgba(79,32,63,0.08)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  empty:     { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 18 },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  addActivity:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.parme, borderRadius: 100, paddingVertical: 12, marginTop: 6 },
  addManual:     { alignSelf: 'center', marginTop: 10 },
  addManualText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme, textDecorationLine: 'underline' },
  addActivityText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },

  stats:     { flexDirection: 'row', backgroundColor: Colors.parme, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8 },
  statValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.white },
  statLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  card:      { backgroundColor: Colors.white, borderRadius: 16, padding: 14, gap: 10 },
  rowLine:   { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  rowValue:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  cardTotal: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.parme, borderRadius: 10, padding: 10, marginTop: 4 },
  cardTotalText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, backgroundColor: Colors.sableLune },
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 13, paddingHorizontal: 16 },
  footerPrimary: { flex: 1, backgroundColor: Colors.parme },
  footerText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
});

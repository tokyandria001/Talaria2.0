import { useState, useCallback } from 'react';
import {
  View, Text, Image, ImageBackground, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import client, { assetUrl } from '../../api/client';
import { comingSoon } from '../../components/AuthUI';
import { Colors } from '../../constants/Colors';
import { TAB_BAR_HEIGHT } from '../../constants/Layout';
import { tripPhoto, today, shortDate, daysUntil, initialsOf } from '../../constants/Trips';

/** Raccourcis « Vous êtes à la recherche de ? » : Logements et Activités ouvrent la carte filtrée */
const SEARCHES = [
  { value: 'vols',         label: 'Vols',         icon: 'airplane' },
  { value: 'logements',    label: 'Logements',    icon: 'business' },
  { value: 'activites',    label: 'Activités',    icon: 'bicycle' },
  { value: 'destinations', label: 'Destinations', icon: 'earth' },
];

const euros = (v) => `${Math.round(v ?? 0).toLocaleString('fr-FR')} €`;

/**
 * Préparation du prochain voyage en 6 étapes : destination et dates, transport, budget,
 * logement, première activité, planning complet (au moins une activité chaque jour).
 */
function preparation(trip, accommodations, activities) {
  const days = new Set(activities.map(a => a.date));
  const tripDays = Math.max(1, daysUntil(trip.endDate) - daysUntil(trip.startDate) + 1);
  const steps = [
    true,
    !!trip.transportMode,
    trip.budget != null,
    accommodations.length > 0,
    activities.length > 0,
    days.size >= tripDays,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [trips,    setTrips]    = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [prep,     setPrep]     = useState(null);
  const [finances, setFinances] = useState(null);
  const [idea,     setIdea]     = useState('');

  const load = useCallback(() => {
    client.get('/api/notifications/unread-count').then(({ data }) => setUnread(data.count ?? 0)).catch(() => {});
    client.get('/api/groups').then(({ data }) => setGroups(data.groups ?? [])).catch(() => {});
    client.get('/api/trips').then(async ({ data }) => {
      setTrips(data);

      // Préparation du prochain voyage
      const next = data.find(t => t.endDate >= today());
      if (next) {
        const [acc, act] = await Promise.all([
          client.get(`/api/trips/${next.id}/accommodations`).then(r => r.data).catch(() => []),
          client.get(`/api/trips/${next.id}/activities`).then(r => r.data).catch(() => []),
        ]);
        setPrep(preparation(next, Array.isArray(acc) ? acc : [], Array.isArray(act) ? act : []));
      } else {
        setPrep(null);
      }

      // Finances : ma part des dépenses et ce que je dois encore, sur mes 10 derniers voyages
      const budgets = await Promise.all(data.slice(-10).map(t => client.get(`/api/trips/${t.id}/budget`).then(r => r.data).catch(() => null)));
      let spent = 0, owed = 0;
      for (const b of budgets) {
        const mine = b?.balances?.find(x => x.user.id === user?.id);
        if (!mine) continue;
        spent += mine.share ?? 0;
        if (mine.balance < 0) owed += -mine.balance;
      }
      setFinances({ spent, owed });
    }).catch(() => {});
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const upcoming = trips.filter(t => t.endDate >= today());
  const next = upcoming[0];
  // Voyages à venir d'abord, puis les passés du plus récent au plus ancien
  const ordered = [...upcoming, ...trips.filter(t => t.endDate < today()).reverse()];

  const pressSearch = (value) => {
    if (value === 'vols' || value === 'destinations') {
      comingSoon(value === 'vols' ? 'La recherche de vols' : 'La découverte de destinations');
      return;
    }
    router.navigate({ pathname: '/(tabs)/discover', params: { view: 'map', shortcut: value } });
  };

  const submitIdea = () => {
    const destination = idea.trim();
    router.push(destination ? { pathname: '/new-trip', params: { destination } } : '/new-trip');
    setIdea('');
  };

  const name = user?.firstName || user?.username || '';
  const avatar = assetUrl(user?.profilePicture);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 24 }}
      showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* En-tête */}
      <View style={[s.pad, s.header]}>
        <Text style={s.hello} numberOfLines={1}>Bonjour{name ? ` ${name}` : ''}</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={8} style={s.bell}
          accessibilityLabel={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
          <Ionicons name="notifications-outline" size={22} color={Colors.parme} />
          {unread > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.navigate('/(tabs)/profile')} activeOpacity={0.85}>
          {avatar
            ? <Image source={{ uri: avatar }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.avatarText}>{initialsOf(user)}</Text></View>}
        </TouchableOpacity>
      </View>

      {/* Idée de voyage → assistant de création */}
      <View style={[s.pad, s.search]}>
        <Ionicons name="search" size={17} color={Colors.text} />
        <TextInput style={s.searchInput} placeholder="Une idée de voyage ?" placeholderTextColor={Colors.textMuted}
          value={idea} onChangeText={setIdea} onSubmitEditing={submitIdea} returnKeyType="go" />
      </View>

      <Text style={[s.pad, s.lookingFor]}>Vous êtes à la recherche de ?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SEARCHES.map(c => (
          <TouchableOpacity key={c.value} style={s.chip} onPress={() => pressSearch(c.value)} activeOpacity={0.85}>
            <Text style={s.chipText}>{c.label}</Text>
            <Ionicons name={c.icon} size={16} color={Colors.parme} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Prochain voyage */}
      <View style={s.pad}>
        {next ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/trip/${next.id}`)}>
            <ImageBackground source={tripPhoto(next)} style={s.nextCard} imageStyle={s.nextImage} resizeMode="cover">
              <View style={s.nextVeil} />
              <View style={s.nextTop}>
                <View style={s.nextPill}>
                  <Ionicons name="airplane" size={13} color={Colors.parme} />
                  <Text style={s.nextPillText}>
                    Prochain voyage{daysUntil(next.startDate) > 0 ? ` · J-${daysUntil(next.startDate)}` : ' · en cours'}
                  </Text>
                </View>
                <Avatars people={next.participants?.length ? next.participants : [next.createdBy]} />
              </View>

              <View>
                <Text style={s.nextTitle} numberOfLines={1}>{next.title || next.destination}</Text>
                <Text style={s.nextSub} numberOfLines={1}>
                  {next.title ? `${next.destination} · ` : ''}{shortDate(next.startDate)} → {shortDate(next.endDate)} · {next.travelers} voyageur{next.travelers > 1 ? 's' : ''}
                </Text>
                <View style={s.nextBottom}>
                  <View style={{ flex: 1 }}>
                    {prep && (
                      <>
                        <Text style={s.prepText}>Préparation · {prep.done}/{prep.total} étapes</Text>
                        <View style={s.prepTrack}><View style={[s.prepFill, { width: `${(prep.done / prep.total) * 100}%` }]} /></View>
                      </>
                    )}
                  </View>
                  <View style={s.planningBtn}>
                    <Text style={s.planningText}>Planning</Text>
                    <Ionicons name="arrow-forward" size={15} color={Colors.parme} />
                  </View>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ) : (
          <View style={s.emptyTrip}>
            <Text style={s.emptyTitle}>Aucun voyage prévu</Text>
            <Text style={s.emptySub}>Choisissez une destination et des dates, Talaria s'occupe du reste.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/new-trip')}>
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={s.emptyBtnText}>Créer un voyage</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Groupes */}
      <Text style={[s.pad, s.section]}>Vos groupes de voyage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {groups.map(g => (
          <TouchableOpacity key={g.id} style={s.group} onPress={() => router.push(`/groups/${g.id}`)} activeOpacity={0.85}>
            {g.photo
              ? <Image source={{ uri: assetUrl(g.photo) }} style={s.groupPhoto} />
              : <GroupFaces members={g.membersPreview ?? []} />}
            <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.group} onPress={() => router.push('/groups/new')} activeOpacity={0.85}>
          <View style={[s.groupPhoto, s.groupNew]}><Ionicons name="add" size={28} color={Colors.white} /></View>
          <Text style={s.groupName}>Créer</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Voyages */}
      <Text style={[s.pad, s.section]}>Vos voyages</Text>
      {ordered.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {ordered.map(t => (
            <TouchableOpacity key={t.id} style={s.trip} onPress={() => router.push(`/trip/${t.id}`)} activeOpacity={0.85}>
              <Image source={tripPhoto(t)} style={s.tripPhoto} resizeMode="cover" />
              <Text style={s.tripName} numberOfLines={1}>{t.title || t.destination}</Text>
              <Text style={s.tripDates}>{shortDate(t.startDate)} → {shortDate(t.endDate)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={[s.pad, s.muted]}>Vos voyages apparaîtront ici.</Text>
      )}

      {/* Finances */}
      <View style={s.finances}>
        <Text style={s.financesTitle}>Vos finances</Text>
        <View style={s.financeRow}>
          <FinanceCard icon="card-outline" value={finances ? euros(finances.spent) : '…'} label="Dépensés" />
          <FinanceCard icon="cash-outline" value={finances ? euros(finances.owed) : '…'} label="À rembourser" />
        </View>
      </View>
    </ScrollView>
  );
}

/** Pastilles des participants (3 visibles, puis « +N ») */
function Avatars({ people }) {
  const shown = people.filter(Boolean).slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <View style={s.faces}>
      {shown.map((p, i) => (
        <View key={p.id ?? i} style={[s.face, i > 0 && { marginLeft: -10 }]}>
          {p.profilePicture
            ? <Image source={{ uri: assetUrl(p.profilePicture) }} style={s.faceImg} />
            : <Text style={s.faceText}>{initialsOf(p)}</Text>}
        </View>
      ))}
      {extra > 0 && <View style={[s.face, s.faceExtra, { marginLeft: -10 }]}><Text style={s.faceExtraText}>+{extra}</Text></View>}
    </View>
  );
}

/** Groupe sans photo : initiales des deux premiers membres dans le rond */
function GroupFaces({ members }) {
  return (
    <View style={[s.groupPhoto, s.groupFaces]}>
      {members.length
        ? members.slice(0, 2).map((m, i) => <Text key={m.id} style={[s.groupInitials, i > 0 && { marginLeft: 2 }]}>{initialsOf(m)}</Text>)
        : <Ionicons name="people" size={24} color={Colors.parme} />}
    </View>
  );
}

function FinanceCard({ icon, value, label }) {
  return (
    <View style={s.financeCard}>
      <View style={s.financeTop}>
        <Ionicons name={icon} size={20} color={Colors.parme} />
        <Text style={s.financeValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
      <Text style={s.financeLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune },
  pad:  { marginHorizontal: 18 },
  muted: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  hello:  { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 26, color: Colors.parme },
  bell:   { padding: 2 },
  bellDot: { position: 'absolute', top: 2, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: Colors.parme },
  avatarEmpty: { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#ece3e7',
  },
  searchInput: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, padding: 0 },

  lookingFor: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 14, marginBottom: 8 },
  chips: { paddingHorizontal: 18, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: '#ece3e7',
  },
  chipText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },

  nextCard:  { height: 200, marginTop: 20, padding: 14, justifyContent: 'space-between' },
  nextImage: { borderRadius: 20 },
  nextVeil:  { ...StyleSheet.absoluteFillObject, borderRadius: 20, backgroundColor: 'rgba(30,8,22,0.38)' },
  nextTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  nextPillText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },
  nextTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: Colors.white },
  nextSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  nextBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 10 },
  prepText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.9)', marginBottom: 5 },
  prepTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  prepFill:  { height: 4, borderRadius: 2, backgroundColor: Colors.white },
  planningBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9,
  },
  planningText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  faces: { flexDirection: 'row', alignItems: 'center' },
  face: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: Colors.white,
    backgroundColor: Colors.orchidee, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  faceImg:  { width: '100%', height: '100%' },
  faceText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 10, color: Colors.parme },
  faceExtra:     { backgroundColor: Colors.parmeLight },
  faceExtraText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 10, color: Colors.parme },

  emptyTrip: { marginTop: 20, backgroundColor: Colors.parme, borderRadius: 20, padding: 18 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: Colors.white },
  emptySub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9,
  },
  emptyBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },

  section: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.parme, marginTop: 24, marginBottom: 12 },
  row: { paddingHorizontal: 18, gap: 12 },

  group:      { width: 68, alignItems: 'center' },
  groupPhoto: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: Colors.white },
  groupFaces: { backgroundColor: Colors.parmeLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  groupInitials: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },
  groupNew:   { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  groupName:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, marginTop: 6 },

  trip:      { width: 112 },
  tripPhoto: { width: 112, height: 100, borderRadius: 14 },
  tripName:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 6, textAlign: 'center' },
  tripDates: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  finances: { backgroundColor: Colors.parme, marginTop: 28, paddingHorizontal: 18, paddingVertical: 20 },
  financesTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.white, marginBottom: 12 },
  financeRow: { flexDirection: 'row', gap: 12 },
  financeCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 12 },
  financeTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.sableLune, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  financeValue: { flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: Colors.parme },
  financeLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.parme, marginTop: 8 },
});

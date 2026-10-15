import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import GroupHero from '../../../components/groups/GroupHero';
import FriendPickerSheet from '../../../components/groups/FriendPickerSheet';
import { shareInvite } from '../../../components/groups/shareInvite';
import BottomSheet from '../../../components/BottomSheet';
import UserAvatar from '../../../components/UserAvatar';
import { comingSoon } from '../../../components/AuthUI';
import { Colors } from '../../../constants/Colors';

/** 13 · Écran groupe principal (+ 16 · Actions du groupe) */
export default function GroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [group,      setGroup]      = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actions,    setActions]    = useState(false);
  const [picker,     setPicker]     = useState(false);

  const load = useCallback(() => client.get(`/api/groups/${id}`)
    .then(({ data }) => setGroup(data))
    .catch(() => { Alert.alert('Groupe introuvable', "Ce groupe n'existe plus ou vous n'en faites plus partie."); router.back(); })
    .finally(() => setRefreshing(false)), [id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (accept) => {
    try {
      if (accept) setGroup((await client.post(`/api/groups/${id}/accept`)).data);
      else { await client.post(`/api/groups/${id}/decline`); router.back(); }
    } catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Action impossible.'); }
  };

  const invite = async (users) => {
    setPicker(false);
    if (!users.length) return;
    try {
      setGroup((await client.post(`/api/groups/${id}/members`, { userIds: users.map(u => u.id) })).data);
      Alert.alert('Invitations envoyées', `${users.length} ami${users.length > 1 ? 's' : ''} invité${users.length > 1 ? 's' : ''}.`);
    } catch (err) { Alert.alert('Erreur', err.response?.data?.message || "Impossible d'inviter."); }
  };

  const leave = () => {
    setActions(false);
    const owner = group.myRole === 'owner';
    Alert.alert('Quitter le groupe ?', owner && group.membersCount > 1
      ? 'Le membre le plus ancien deviendra organisateur.'
      : owner ? 'Vous êtes le dernier membre : le groupe sera supprimé.' : `Vous ne ferez plus partie de « ${group.name} ».`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter', style: 'destructive',
        onPress: async () => {
          try { await client.delete(`/api/groups/${id}/members/${user.id}`); router.replace('/groups'); }
          catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Impossible de quitter le groupe.'); }
        },
      },
    ]);
  };

  if (!group) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  const invited = group.myStatus === 'invited';
  const active = group.members.filter(m => m.status === 'active');
  const pendingCount = group.members.length - active.length;
  const memberIds = group.members.map(m => m.user.id);

  return (
    <View style={s.root}>
      <GroupHero
        photo={group.photo}
        label={`${group.membersCount} membre${group.membersCount > 1 ? 's' : ''}`}
        title={group.name}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.parme} />}
      >
        {invited && (
          <View style={s.inviteBox}>
            <Text style={s.inviteText}>Vous êtes invité à rejoindre ce groupe.</Text>
            <View style={s.inviteActions}>
              <TouchableOpacity style={[s.smallBtn, s.smallBtnOutline]} onPress={() => respond(false)}>
                <Text style={[s.smallBtnText, { color: Colors.white }]}>Refuser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.smallBtn} onPress={() => respond(true)}>
                <Text style={s.smallBtnText}>Rejoindre</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!invited && (
          <TouchableOpacity style={s.stats} activeOpacity={0.85} disabled={!group.nextTrip}
            onPress={() => router.push({ pathname: `/trip/${group.nextTrip.id}`, params: { tab: 'Budget' } })}>
            <Stat value={group.stats?.budget != null ? `${group.stats.budget.toLocaleString('fr-FR')} €` : '—'} label="Budget" />
            <Stat value={group.stats?.spent != null ? `${group.stats.spent.toLocaleString('fr-FR')} €` : '—'} label="Dépensé" />
            <Stat value={String(group.stats?.activitiesCount ?? 0)} label="Activités" />
          </TouchableOpacity>
        )}

        {group.description ? <Text style={s.description}>{group.description}</Text> : null}

        <View style={s.badges}>
          <Badge icon={group.isPrivate ? 'lock-closed-outline' : 'earth-outline'} text={group.isPrivate ? 'Groupe privé' : 'Groupe ouvert'} />
          {group.sharedBudget && <Badge icon="wallet-outline" text="Budget partagé" />}
          {group.myRole === 'owner' && <Badge icon="star-outline" text="Vous organisez" />}
        </View>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Membres</Text>
          <TouchableOpacity onPress={() => router.push(`/groups/${id}/members`)}>
            <Text style={s.seeAll}>Voir tout{pendingCount ? ` · ${pendingCount} en attente` : ''}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.avatars}>
          {active.slice(0, 7).map((m, i) => (
            <UserAvatar key={m.user.id} user={m.user} size={42} style={[s.avatar, { marginLeft: i ? -10 : 0 }]} />
          ))}
          {group.permissions.canInvite && !invited && (
            <TouchableOpacity style={s.addAvatar} onPress={() => setPicker(true)}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {!invited && (
          <>
            <Text style={s.sectionTitle}>Prochain voyage</Text>
            {group.nextTrip ? (
              <TripRow trip={group.nextTrip} highlight onPress={() => router.push(`/trip/${group.nextTrip.id}`)} />
            ) : (
              <View style={s.placeholder}>
                <Ionicons name="airplane-outline" size={22} color={Colors.orchidee} />
                <Text style={s.placeholderText}>Aucun voyage prévu. Créez le premier voyage du groupe : tous les membres pourront le compléter.</Text>
              </View>
            )}

            {group.trips.filter(t => t.id !== group.nextTrip?.id).length > 0 && (
              <>
                <Text style={s.sectionTitle}>Autres voyages</Text>
                <View style={{ gap: 8 }}>
                  {group.trips.filter(t => t.id !== group.nextTrip?.id).map(t => (
                    <TripRow key={t.id} trip={t} onPress={() => router.push(`/trip/${t.id}`)} />
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={s.newTrip}
              onPress={() => router.push({ pathname: '/new-trip', params: { groupId: String(group.id) } })}>
              <Ionicons name="add" size={18} color={Colors.parme} />
              <Text style={s.newTripText}>Créer un voyage pour le groupe</Text>
            </TouchableOpacity>

            {group.activity?.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Activité récente</Text>
                <View style={{ gap: 12 }}>
                  {group.activity.map(a => (
                    <TouchableOpacity key={a.id} style={s.event} disabled={!a.tripId}
                      onPress={() => router.push(`/trip/${a.tripId}`)} activeOpacity={0.85}>
                      <UserAvatar user={a.actor} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.eventText}>{a.message}</Text>
                        <Text style={s.eventMeta}>{timeAgo(a.createdAt)} · {EVENT_LABEL[a.type] ?? 'Groupe'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {!invited && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[s.footerBtn, s.footerPrimary]} onPress={() => comingSoon('La conversation de groupe')}>
            <Ionicons name="chatbubble-outline" size={16} color={Colors.white} />
            <Text style={[s.footerText, { color: Colors.white }]}>Conversation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.footerBtn} onPress={() => setActions(true)}>
            <Ionicons name="ellipsis-horizontal" size={16} color={Colors.parme} />
            <Text style={s.footerText}>Actions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 16 · Actions du groupe */}
      <BottomSheet visible={actions} title="Actions du groupe" onClose={() => setActions(false)}>
        <View style={{ gap: 4, paddingBottom: 8 }}>
          {group.permissions.canEdit && (
            <ActionRow icon="pencil-outline" title="Modifier le groupe" sub="Nom, photo, description"
              onPress={() => { setActions(false); router.push({ pathname: '/groups/new', params: { id } }); }} />
          )}
          {group.permissions.canInvite && (
            <ActionRow icon="person-add-outline" title="Inviter des membres" onPress={() => { setActions(false); setPicker(true); }} />
          )}
          {group.permissions.canInvite && (
            <ActionRow icon="link-outline" title="Partager le lien d'invitation" sub={`Code : ${group.inviteCode}`} onPress={() => shareInvite(group)} />
          )}
          <View style={s.actionRow}>
            <View style={s.actionIcon}><Ionicons name="notifications-outline" size={18} color={Colors.parme} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Notifications</Text>
              <Text style={s.actionSub}>Messages, votes et dépenses — bientôt réglables</Text>
            </View>
            <Switch value onValueChange={() => comingSoon('Le réglage des notifications du groupe')}
              thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
          </View>
          <ActionRow icon="document-text-outline" title="Exporter le budget (PDF)" onPress={() => comingSoon("L'export du budget en PDF")} />
          <ActionRow icon="exit-outline" title="Quitter le groupe" danger onPress={leave} />
        </View>
      </BottomSheet>

      <FriendPickerSheet visible={picker} excludeIds={memberIds} onClose={() => setPicker(false)} onConfirm={invite} />
    </View>
  );
}

const fmtShort = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const nightsBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000);
const daysUntil = (iso) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`) - today) / 86_400_000);
};

/** Voyage du groupe : destination, dates, nuits et compte à rebours (J-12, « En cours ») */
function TripRow({ trip, highlight, onPress }) {
  const n = nightsBetween(trip.startDate, trip.endDate);
  const d = daysUntil(trip.startDate);
  const countdown = d > 0 ? `J-${d}` : daysUntil(trip.endDate) >= 0 ? 'En cours' : 'Terminé';
  return (
    <TouchableOpacity style={[s.trip, highlight && s.tripHighlight]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.tripIcon}><Ionicons name="airplane" size={20} color={Colors.parme} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.tripName} numberOfLines={1}>{trip.title || trip.destination}</Text>
        <Text style={s.tripDates}>{fmtShort(trip.startDate)} → {fmtShort(trip.endDate)} · {n} nuit{n > 1 ? 's' : ''}</Text>
        <Text style={s.tripCountdown}>{countdown}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.parme} />
    </TouchableOpacity>
  );
}

const EVENT_LABEL = { trip_update: 'Planning', group_trip: 'Voyage', group_join: 'Membres', group_created: 'Groupe', expense: 'Budget', settlement: 'Budget' };

function timeAgo(isoDate) {
  const m = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Hier' : `Il y a ${d} j`;
}

function Stat({ value, label }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ icon, text }) {
  return (
    <View style={s.badge}>
      <Ionicons name={icon} size={13} color={Colors.parme} />
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function ActionRow({ icon, title, sub, danger, onPress }) {
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.actionIcon, danger && { backgroundColor: '#fde8e8' }]}>
        <Ionicons name={icon} size={18} color={danger ? '#dc2626' : Colors.parme} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.actionTitle, danger && { color: '#dc2626' }]}>{title}</Text>
        {sub ? <Text style={s.actionSub}>{sub}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={Colors.parme} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 14 },

  inviteBox:     { backgroundColor: Colors.parme, borderRadius: 18, padding: 16, marginBottom: 14 },
  inviteText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallBtn:        { flex: 1, backgroundColor: Colors.white, borderRadius: 100, paddingVertical: 10, alignItems: 'center' },
  smallBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.white },
  smallBtnText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },

  stats:     { flexDirection: 'row', backgroundColor: Colors.parme, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 14 },
  stat:      { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.white },
  statLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  event:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  eventMeta: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  description: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, lineHeight: 20, color: Colors.text },
  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(79,32,63,0.08)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  sectionTitle:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: Colors.text, marginTop: 22, marginBottom: 10 },
  seeAll:        { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },

  avatars:   { flexDirection: 'row', alignItems: 'center' },
  avatar:    { borderWidth: 2, borderColor: Colors.sableLune },
  addAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  trip:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 12 },
  tripHighlight: { borderWidth: 1.5, borderColor: Colors.orchidee },
  tripIcon:      { width: 52, height: 52, borderRadius: 12, backgroundColor: 'rgba(79,32,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  tripName:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  tripDates:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tripCountdown: {
    alignSelf: 'flex-start', marginTop: 6, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme,
    backgroundColor: 'rgba(79,32,63,0.08)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  newTrip:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.parme, borderRadius: 100, paddingVertical: 12, marginTop: 16 },
  newTripText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  placeholder:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 14 },
  placeholderText: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, lineHeight: 18 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
    paddingHorizontal: 18, paddingTop: 12, backgroundColor: Colors.sableLune,
  },
  footerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 13,
  },
  footerPrimary: { backgroundColor: Colors.parme },
  footerText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },

  actionRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#efe6e9' },
  actionIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(79,32,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  actionSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});

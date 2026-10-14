import { useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client, { assetUrl } from '../../api/client';
import UserAvatar from '../../components/UserAvatar';
import { Colors } from '../../constants/Colors';
import { ACTIVITY_TAGS } from '../../constants/Preferences';
import { tripPhoto, shortDate, daysUntil } from '../../constants/Trips';

const COVER = require('../../assets/paris.jpg');
const interestLabel = (v) => (ACTIVITY_TAGS.find(t => t.value === v)?.label ?? v).replace(/^\S+\s/, '');

/** Profil d'un autre voyageur (maquette 36) : statistiques, centres d'intérêt, voyages en commun */
export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    client.get(`/api/users/${id}`).then(({ data }) => setProfile(data)).catch(() => {
      Alert.alert('Profil introuvable', "Ce profil n'est pas disponible.");
      router.back();
    });
  }, [id, router]);
  useFocusEffect(load);

  const run = async (request, done) => {
    setBusy(true);
    try { await request(); if (done) done(); else load(); }
    catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Action impossible.'); }
    finally { setBusy(false); }
  };

  const menu = () => Alert.alert(profile.displayName, null, [
    profile.relation === 'friends' && {
      text: 'Retirer des amis', style: 'destructive',
      onPress: () => run(() => client.delete(`/api/friends/${profile.id}`)),
    },
    {
      text: 'Bloquer', style: 'destructive',
      onPress: () => Alert.alert(`Bloquer ${profile.displayName} ?`, 'Cette personne ne verra plus ton profil et ne pourra plus t\'ajouter. Vous ne serez plus amis.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Bloquer', style: 'destructive', onPress: () => run(() => client.post(`/api/users/${profile.id}/block`), () => router.back()) },
      ]),
    },
    { text: 'Annuler', style: 'cancel' },
  ].filter(Boolean));

  if (!profile) return <View style={[s.root, s.center]}><ActivityIndicator color={Colors.parme} /></View>;

  const p = profile;
  const next = p.nextTripTogether;

  const friendAction = {
    none:             { label: 'Ajouter', icon: 'person-add-outline', onPress: () => run(() => client.post('/api/friends/requests', { userId: p.id })) },
    request_sent:     { label: 'Demande envoyée', icon: 'time-outline', onPress: () => run(() => client.delete(`/api/friends/requests/${p.requestId}`)) },
    request_received: { label: 'Accepter', icon: 'checkmark', onPress: () => run(() => client.post(`/api/friends/requests/${p.requestId}/accept`)) },
  }[p.relation];

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={[s.coverBox, { height: insets.top + 150 }]}>
          <Image source={p.coverPhoto ? { uri: assetUrl(p.coverPhoto) } : COVER} style={s.coverImage} resizeMode="cover" />
          {!p.coverPhoto && <View style={s.veil} />}
          <View style={[s.heroRow, { marginTop: insets.top + 8 }]}>
            <TouchableOpacity style={s.roundBtn} onPress={() => router.back()} accessibilityLabel="Retour">
              <Ionicons name="arrow-back" size={20} color={Colors.parme} />
            </TouchableOpacity>
            {p.relation !== 'self' && (
              <TouchableOpacity style={s.roundBtn} onPress={menu} accessibilityLabel="Plus d'actions">
                <Ionicons name="ellipsis-horizontal" size={20} color={Colors.parme} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <UserAvatar user={p} size={104} style={s.avatar} />

        <View style={s.identity}>
          <Text style={s.name}>{p.displayName}</Text>
          {p.username ? <Text style={s.handle}>@{p.username}</Text> : null}
          {p.stats?.tripsTogether > 0
            ? <Text style={s.badge}>{p.stats.tripsTogether} voyage{p.stats.tripsTogether > 1 ? 's' : ''} ensemble</Text>
            : p.memberSince ? <Text style={s.badge}>Membre depuis {p.memberSince}</Text> : null}
          {friendAction && (
            <TouchableOpacity style={[s.friendBtn, busy && { opacity: 0.6 }]} onPress={friendAction.onPress} disabled={busy}>
              <Ionicons name={friendAction.icon} size={15} color={Colors.white} />
              <Text style={s.friendText}>{friendAction.label}</Text>
            </TouchableOpacity>
          )}
        </View>

        {p.isPrivate ? (
          <View style={s.private}>
            <Ionicons name="lock-closed-outline" size={22} color={Colors.parme} />
            <Text style={s.privateText}>Ce profil est privé. Ajoute {p.firstName || 'cette personne'} en ami pour voir ses voyages et ses centres d'intérêt.</Text>
          </View>
        ) : (
          <>
            {p.bio ? <Text style={s.bio}>{p.bio}</Text> : null}

            <View style={s.stats}>
              <Stat value={p.stats.trips} label={p.stats.trips > 1 ? 'voyages' : 'voyage'} />
              <Stat value={p.stats.articles} label={p.stats.articles > 1 ? 'articles' : 'article'} />
              <Stat value={p.stats.friends} label={p.stats.friends > 1 ? 'amis' : 'ami'} />
            </View>

            {p.activityTags?.length > 0 && (
              <>
                <Text style={s.section}>Centres d'intérêts</Text>
                <View style={s.tags}>{p.activityTags.map(t => <Text key={t} style={s.tag}>{interestLabel(t)}</Text>)}</View>
              </>
            )}

            {p.tripsTogether?.length > 0 && (
              <>
                <Text style={s.section}>Voyages en commun</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
                  {p.tripsTogether.map(t => (
                    <TouchableOpacity key={t.id} style={s.trip} onPress={() => router.push(`/trip/${t.id}`)} activeOpacity={0.85}>
                      <Image source={tripPhoto(t)} style={s.tripPhoto} resizeMode="cover" />
                      <Text style={s.tripName} numberOfLines={1}>{t.title || t.destination}</Text>
                      <Text style={s.tripDates}>{shortDate(t.startDate)} → {shortDate(t.endDate)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {next && (
              <>
                <Text style={s.section}>Prochain voyage ensemble</Text>
                <TouchableOpacity style={s.next} onPress={() => router.push(`/trip/${next.id}`)} activeOpacity={0.9}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nextTitle} numberOfLines={1}>{next.title || next.destination}</Text>
                    <Text style={s.nextSub}>Du {shortDate(next.startDate)} au {shortDate(next.endDate)} · {next.participantsCount} participant{next.participantsCount > 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={s.nextPill}>{daysUntil(next.startDate) > 0 ? `J-${daysUntil(next.startDate)}` : 'En cours'}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Pas encore de messages privés : on écrit dans le chat du prochain voyage ensemble */}
      {next && (
        <TouchableOpacity style={[s.message, { bottom: insets.bottom + 20 }]} activeOpacity={0.85}
          onPress={() => router.push({ pathname: `/trip/${next.id}`, params: { tab: 'Chat' } })}>
          <Ionicons name="chatbubble-outline" size={16} color={Colors.white} />
          <Text style={s.messageText}>Message</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value ?? '…'}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  center: { alignItems: 'center', justifyContent: 'center' },

  coverBox:   { width: '100%', overflow: 'hidden', backgroundColor: Colors.parmeLight },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: undefined, height: undefined },
  veil:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,249,241,0.55)' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  avatar:  { alignSelf: 'center', marginTop: -52, borderWidth: 3, borderColor: Colors.white },
  roundBtn: { width: 44, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', marginTop: 12, paddingHorizontal: 18 },
  name:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: Colors.parme, textAlign: 'center' },
  handle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text, marginTop: 2 },
  badge: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, marginTop: 8,
    backgroundColor: '#ece3e7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden',
  },
  friendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  friendText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },

  bio: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text, textAlign: 'center', lineHeight: 19, marginTop: 14, marginHorizontal: 28 },
  private: { alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 16, padding: 18, margin: 18 },
  privateText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, marginHorizontal: 18 },
  stat:  { alignItems: 'center', minWidth: 80 },
  statValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 24, color: Colors.parme },
  statLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 15, color: Colors.parme },

  section: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: Colors.parme, marginTop: 24, marginBottom: 10, marginHorizontal: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 18 },
  tag: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme,
    borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden',
  },

  row: { paddingHorizontal: 18, gap: 12 },
  trip:      { width: 112 },
  tripPhoto: { width: 112, height: 100, borderRadius: 14 },
  tripName:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, marginTop: 6, textAlign: 'center' },
  tripDates: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  next: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18,
    backgroundColor: Colors.parme, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16,
  },
  nextTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: Colors.white },
  nextSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  nextPill: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden',
  },

  message: {
    position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(79,32,63,0.88)', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 12,
  },
  messageText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
});

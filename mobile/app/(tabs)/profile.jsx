import { useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import client, { assetUrl } from '../../api/client';
import { Colors } from '../../constants/Colors';
import { TAB_BAR_HEIGHT } from '../../constants/Layout';
import { ACTIVITY_TAGS } from '../../constants/Preferences';
import { tripPhoto, today, shortDate, daysUntil, initialsOf } from '../../constants/Trips';

const COVER = require('../../assets/paris.jpg');

/** Libellé d'un centre d'intérêt sans son émoji (« 🌿 Nature » → « Nature ») */
const interestLabel = (value) => (ACTIVITY_TAGS.find(t => t.value === value)?.label ?? value).replace(/^\S+\s/, '');

/** Profil (maquette 7) : photo, statistiques, centres d'intérêt, voyages récents, prochain départ */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [counts,    setCounts]    = useState(null);
  const [friends,   setFriends]   = useState(null);
  const [trips,     setTrips]     = useState([]);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(useCallback(() => {
    client.get('/api/profile').then(({ data }) => setCounts(data.counts)).catch(() => {});
    client.get('/api/friends').then(({ data }) => setFriends(data.length)).catch(() => {});
    client.get('/api/trips').then(({ data }) => setTrips(data)).catch(() => {});
  }, []));

  const past = trips.filter(t => t.endDate < today()).reverse();
  const next = trips.find(t => t.endDate >= today());
  const recent = past.length ? past : trips;

  /** Choisir une image et l'envoyer : photo de profil (carrée) ou couverture (bandeau 16:9) */
  const pickAndUpload = async (kind) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: kind === 'cover' ? [16, 9] : [1, 1], quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
    const field = kind === 'cover' ? 'cover' : 'picture';
    const form = new FormData();
    form.append(field, { uri, name: `${field}.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    setUploading(kind);
    try {
      await client.post(kind === 'cover' ? '/api/profile/cover' : '/api/profile/picture', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'envoyer l'image.");
    } finally {
      setUploading(false);
    }
  };

  const coverMenu = () => Alert.alert('Photo de couverture', null, [
    { text: 'Choisir une photo', onPress: () => pickAndUpload('cover') },
    user?.coverPhoto && { text: 'Retirer la photo', style: 'destructive', onPress: async () => {
      try { await client.delete('/api/profile/cover'); await refreshUser(); }
      catch { Alert.alert('Erreur', 'Impossible de retirer la photo.'); }
    } },
    { text: 'Annuler', style: 'cancel' },
  ].filter(Boolean));

  // Statistiques : vers la liste si elle n'est pas vide, sinon vers l'ajout
  const openTrips = () => (trips.length ? router.navigate('/(tabs)/trips') : router.push('/new-trip'));
  const openArticles = () => router.navigate({
    pathname: '/(tabs)/discover',
    params: counts?.articles ? { view: 'community', filter: 'mine' } : { view: 'community', action: 'write', from: '/profile' },
  });
  const openFriends = () => router.push(friends ? '/friends' : { pathname: '/friends', params: { tab: 'search' } });

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home'));

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Voyageur';
  const avatar = assetUrl(user?.profilePicture);
  const cover = user?.coverPhoto ? { uri: assetUrl(user.coverPhoto) } : COVER;
  const since = user?.createdAt?.slice(0, 4);
  const interests = user?.activityTags ?? [];
  const bottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);
  const participants = next ? (next.participants?.length || next.travelers || 1) : 0;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 150 }} showsVerticalScrollIndicator={false}>
        {/* Bandeau : photo de couverture (modifiable), retour, paramètres */}
        <View style={[s.coverBox, { height: insets.top + 150 }]}>
          <Image source={cover} style={s.coverImage} resizeMode="cover" />
          {!user?.coverPhoto && <View style={s.veil} />}
          <View style={[s.heroRow, { marginTop: insets.top + 8 }]}>
            <TouchableOpacity style={s.roundBtn} onPress={goBack} accessibilityLabel="Retour">
              <Ionicons name="arrow-back" size={20} color={Colors.parme} />
            </TouchableOpacity>
            <TouchableOpacity style={s.roundBtn} onPress={() => router.push('/settings')} accessibilityLabel="Paramètres">
              <Ionicons name="settings-outline" size={20} color={Colors.parme} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.coverBtn} onPress={coverMenu} activeOpacity={0.85} accessibilityLabel="Changer la photo de couverture">
            {uploading === 'cover' ? <ActivityIndicator size="small" color={Colors.parme} /> : <Ionicons name="image-outline" size={15} color={Colors.parme} />}
            <Text style={s.coverBtnText}>Couverture</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => pickAndUpload('picture')} activeOpacity={0.85} style={s.avatarWrap} accessibilityLabel="Changer la photo de profil">
          {avatar
            ? <Image source={{ uri: avatar }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.avatarText}>{initialsOf(user)}</Text></View>}
          <View style={s.cameraBadge}>
            {uploading === 'picture' ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="camera" size={14} color={Colors.white} />}
          </View>
        </TouchableOpacity>

        {/* Identité */}
        <View style={s.identity}>
          <Text style={s.name}>{fullName}</Text>
          {user?.username ? <Text style={s.handle}>@{user.username}</Text> : null}
          {since ? <Text style={s.since}>Membre depuis {since}</Text> : null}
        </View>

        {/* Statistiques */}
        <View style={s.stats}>
          <Stat value={trips.length} label={trips.length > 1 ? 'voyages' : 'voyage'} onPress={openTrips} />
          <Stat value={counts?.articles} label={counts?.articles > 1 ? 'articles' : 'article'} onPress={openArticles} />
          <Stat value={friends} label={friends > 1 ? 'amis' : 'ami'} onPress={openFriends} />
        </View>

        {/* Centres d'intérêt */}
        <Text style={s.section}>Centres d'intérêts</Text>
        {interests.length ? (
          <View style={s.tags}>
            {interests.map(v => (
              <TouchableOpacity key={v} onPress={() => router.push('/edit-profile')} activeOpacity={0.7}>
                <Text style={s.tag}>{interestLabel(v)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity onPress={() => router.push('/edit-profile')}>
            <Text style={[s.pad, s.link]}>Ajouter vos centres d'intérêt</Text>
          </TouchableOpacity>
        )}

        {/* Voyages récents */}
        <Text style={s.section}>Voyages récents</Text>
        {recent.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
            {recent.map(t => (
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

        {/* Prochain départ */}
        {next && (
          <>
            <Text style={s.section}>Prochain départ</Text>
            <TouchableOpacity style={s.next} onPress={() => router.push(`/trip/${next.id}`)} activeOpacity={0.9}>
              <View style={{ flex: 1 }}>
                <Text style={s.nextTitle} numberOfLines={1}>{next.title || next.destination}</Text>
                <Text style={s.nextSub}>
                  Du {shortDate(next.startDate)} au {shortDate(next.endDate)} · {participants} participant{participants > 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={s.nextPill}>{daysUntil(next.startDate) > 0 ? `J-${daysUntil(next.startDate)}` : 'En cours'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modifier le profil */}
      <TouchableOpacity style={[s.edit, { bottom: bottom + 16 }]} activeOpacity={0.85}
        onPress={() => router.push('/edit-profile')}>
        <Ionicons name="pencil" size={16} color={Colors.white} />
        <Text style={s.editText}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ value, label, onPress }) {
  const content = (
    <>
      <Text style={s.statValue}>{value ?? '…'}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </>
  );
  return onPress
    ? <TouchableOpacity style={s.stat} onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>
    : <View style={s.stat}>{content}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune },
  pad:  { marginHorizontal: 18 },
  muted: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  link:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  coverBox:   { width: '100%', overflow: 'hidden', backgroundColor: Colors.parmeLight },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: undefined, height: undefined },
  veil:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,249,241,0.55)' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  roundBtn: {
    width: 44, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  coverBtn: {
    position: 'absolute', right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6,
  },
  coverBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  avatarWrap: { alignSelf: 'center', marginTop: -56 },
  avatar:     { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: Colors.white },
  avatarEmpty: { backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 34, color: Colors.white },
  cameraBadge: {
    position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.parme, borderWidth: 2, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },

  identity: { alignItems: 'center', marginTop: 12 },
  name:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: Colors.parme, textAlign: 'center' },
  handle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text, marginTop: 2 },
  since: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, marginTop: 8,
    backgroundColor: '#ece3e7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden',
  },

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

  edit: {
    position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(79,32,63,0.88)', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 12,
  },
  editText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
});

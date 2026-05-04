import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import TalariaLogo from '../../components/TalariaLogo';
import { Colors } from '../../constants/Colors';
import { useFadeIn, useSlideUp, useScaleFade } from '../../_hooks/useEntryAnim';

const { width } = Dimensions.get('window');

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function todayLabel() {
  const d = new Date();
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function greeting(firstName) {
  const h = new Date().getHours();
  const name = firstName ? `, ${firstName}` : '';
  if (h < 5)  return `Bonne nuit${name} 🌙`;
  if (h < 12) return `Bonjour${name} ☀️`;
  if (h < 18) return `Bon après-midi${name} 🌤`;
  return `Bonsoir${name} 🌆`;
}

const QUICK_ACTIONS = [
  { key: 'map',       label: 'Carte',       sub: 'Explorez des lieux',       icon: 'map',            bg: '#1a1a2e', iconColor: '#c9b2d7' },
  { key: 'community', label: 'Communauté',  sub: 'Articles & conseils',      icon: 'people',         bg: '#4f203f', iconColor: '#f5eef8' },
  { key: 'trips',     label: 'Voyages',     sub: 'Planifier & budgéter',     icon: 'airplane',       bg: '#2d1b4e', iconColor: '#c9b2d7' },
  { key: 'profile',   label: 'Mon profil',  sub: 'Paramètres & préférences', icon: 'person-circle',  bg: '#3a1830', iconColor: '#f0dacb' },
];

const INSPIRATIONS = [
  { emoji: '🇯🇵', city: 'Tokyo',     tag: 'Asie',    color: '#fef3c7' },
  { emoji: '🇵🇹', city: 'Lisbonne',  tag: 'Europe',  color: '#dbeafe' },
  { emoji: '🇲🇦', city: 'Marrakech', tag: 'Afrique', color: '#fce7f3' },
  { emoji: '🇨🇴', city: 'Medellín',  tag: 'Amérique',color: '#d1fae5' },
];

export default function HomeScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();
  const tabBarH = 60 + Math.max(insets.bottom, 8);

  const [tripCount,    setTripCount]    = useState(null);
  const [articleCount, setArticleCount] = useState(null);

  // Animations
  const { opacity: headerOp, scale: headerScale } = useScaleFade(0);
  const { opacity: avatarOp, translateY: avatarY } = useSlideUp(150, 20);
  const { opacity: cardsOp,  translateY: cardsY  } = useSlideUp(300, 40);
  const { opacity: inspoOp,  translateY: inspoY  } = useSlideUp(450, 40);

  useEffect(() => {
    client.get('/api/trips').then(r  => setTripCount(r.data.length)).catch(() => {});
    client.get('/api/articles').then(r => setArticleCount(r.data.articles?.length ?? null)).catch(() => {});
  }, []);

  const initial = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || (user?.email?.[0] ?? '?')).toUpperCase();

  return (
    <View style={s.root}>
      {/* ── Hero header ── */}
      <Animated.View style={[s.hero, { opacity: headerOp, transform: [{ scale: headerScale }] }]}>
        <SafeAreaView edges={['top']}>
          <View style={s.heroTop}>
            <TalariaLogo height={28} light />
            <TouchableOpacity style={s.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <View style={s.heroBody}>
            {/* Avatar */}
            <Animated.View style={[s.avatarWrap, { opacity: avatarOp, transform: [{ translateY: avatarY }] }]}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
              {/* Glow ring */}
              <View style={s.avatarRing} />
            </Animated.View>

            <Animated.View style={{ opacity: avatarOp, transform: [{ translateY: avatarY }] }}>
              <Text style={s.greetText}>{greeting(user?.firstName)}</Text>
              <Text style={s.dateText}>{todayLabel()}</Text>
            </Animated.View>
          </View>

          {/* Accroche */}
          <Animated.View style={[s.taglineWrap, { opacity: avatarOp, transform: [{ translateY: avatarY }] }]}>
            <Text style={s.tagline}>Voyagez plus. Dépensez moins.{'\n'}Vivez mieux.</Text>
          </Animated.View>

          {/* Stat chips */}
          <Animated.View style={[s.chips, { opacity: avatarOp, transform: [{ translateY: avatarY }] }]}>
            <View style={s.chip}>
              <Ionicons name="airplane-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.chipText}>
                {tripCount == null ? '…' : tripCount} voyage{tripCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={s.chipDivider} />
            <View style={s.chip}>
              <Ionicons name="reader-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.chipText}>
                {articleCount == null ? '…' : articleCount} article{articleCount !== 1 ? 's' : ''} dans la communauté
              </Text>
            </View>
          </Animated.View>
        </SafeAreaView>

        {/* Decorative blobs */}
        <View style={[s.blob, { top: -40, right: -40, width: 160, height: 160, opacity: 0.12 }]} />
        <View style={[s.blob, { bottom: 20, left: -30, width: 100, height: 100, opacity: 0.08 }]} />
      </Animated.View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarH + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick actions */}
        <Animated.View style={{ opacity: cardsOp, transform: [{ translateY: cardsY }] }}>
          <Text style={s.sectionTitle}>Explorer</Text>
          <View style={s.actionsGrid}>
            {QUICK_ACTIONS.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={[s.actionCard, { backgroundColor: a.bg }]}
                activeOpacity={0.82}
                onPress={() => router.push(`/(tabs)/${a.key}`)}
              >
                <View style={[s.actionIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <Ionicons name={a.icon} size={26} color={a.iconColor} />
                </View>
                <Text style={s.actionLabel}>{a.label}</Text>
                <Text style={s.actionSub}>{a.sub}</Text>
                <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.4)" style={{ marginTop: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Inspirations */}
        <Animated.View style={{ opacity: inspoOp, transform: [{ translateY: inspoY }] }}>
          <Text style={s.sectionTitle}>Destinations tendance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.inspoRow}>
            {INSPIRATIONS.map((d) => (
              <View key={d.city} style={[s.inspoCard, { backgroundColor: d.color }]}>
                <Text style={s.inspoEmoji}>{d.emoji}</Text>
                <Text style={s.inspoCity}>{d.city}</Text>
                <View style={s.inspoTag}>
                  <Text style={s.inspoTagText}>{d.tag}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* CTA banner */}
        <Animated.View style={[s.banner, { opacity: inspoOp, transform: [{ translateY: inspoY }] }]}>
          <View style={s.bannerLeft}>
            <Text style={s.bannerTitle}>Planifiez votre prochain voyage</Text>
            <Text style={s.bannerSub}>Budget, transport, réservations — tout en un.</Text>
          </View>
          <TouchableOpacity style={s.bannerBtn} onPress={() => router.push('/(tabs)/trips')}>
            <Ionicons name="add" size={20} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f0f7' },

  /* Hero */
  hero: {
    backgroundColor: Colors.parme,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, marginBottom: 20,
  },
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },

  avatarWrap: { position: 'relative' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.orchidee,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  avatarRing: {
    position: 'absolute', inset: -4,
    borderRadius: 32, borderWidth: 2,
    borderColor: 'rgba(201,178,215,0.4)',
    zIndex: 1,
  },
  avatarText: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 20, color: Colors.parme },

  greetText: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 20, color: Colors.white, lineHeight: 26 },
  dateText:  { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  taglineWrap: { marginBottom: 18 },
  tagline: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 15, color: 'rgba(255,255,255,0.9)',
    lineHeight: 22, letterSpacing: 0.2,
  },

  chips: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  chipDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.25)' },

  blob: { position: 'absolute', borderRadius: 999, backgroundColor: Colors.orchidee },

  /* Scroll */
  scroll: { padding: 16 },

  sectionTitle: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 17, color: Colors.text,
    marginTop: 20, marginBottom: 12,
  },

  /* Grid */
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: (width - 42) / 2,
    borderRadius: 20, padding: 18,
    justifyContent: 'flex-end',
    minHeight: 140,
  },
  actionIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 'auto',
  },
  actionLabel: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white, marginTop: 10 },
  actionSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  /* Inspirations */
  inspoRow: { marginHorizontal: -4 },
  inspoCard: {
    width: 120, borderRadius: 18,
    padding: 16, marginHorizontal: 4,
    alignItems: 'center', gap: 6,
  },
  inspoEmoji: { fontSize: 34 },
  inspoCity:  { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  inspoTag:   { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 100, paddingVertical: 3, paddingHorizontal: 10 },
  inspoTagText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 10, color: Colors.text },

  /* Banner */
  banner: {
    marginTop: 20, backgroundColor: Colors.white,
    borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    gap: 12,
  },
  bannerLeft:  { flex: 1 },
  bannerTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.text },
  bannerSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  bannerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.parme,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});

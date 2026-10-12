import { useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions,
  FlatList, TouchableOpacity, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { comingSoon } from '../components/AuthUI';
import { useTextSwap } from '../_hooks/useEntryAnim';

const { width, height } = Dimensions.get('window');
const CARD_H = Math.round(height * 0.66);

// Photos remplaçables : garder les mêmes noms dans assets/auth/
const SLIDES = [
  { id: '1', bg: require('../assets/auth/onboarding-1.jpg'), title: 'Meilleurs deals\nvoyages.',       subtitle: 'Vols, hôtels, au bon prix.' },
  { id: '2', bg: require('../assets/auth/onboarding-2.jpg'), title: 'Vols, hôtels et\nactivités.',     subtitle: 'Tout votre voyage au même endroit.' },
  { id: '3', bg: require('../assets/auth/onboarding-3.jpg'), title: 'Un planning\nsur mesure.',        subtitle: 'Selon vos envies et votre budget.' },
  { id: '4', bg: require('../assets/auth/onboarding-4.jpg'), title: 'Voyagez mieux,\nensemble.',       subtitle: 'Une communauté de voyageurs malins.' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [text,   setText]   = useState(SLIDES[0]);
  const { opacity: textOpacity, translateY: textY, swap } = useTextSwap();

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== active && SLIDES[idx]) {
      setActive(idx);
      swap(() => setText(SLIDES[idx]));
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Carte photo ── */}
      <View style={s.card}>
        <FlatList
          data={SLIDES}
          keyExtractor={(sl) => sl.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <Image source={item.bg} style={s.photo} resizeMode="cover" />}
        />

        {/* Langue + logo */}
        <View style={[s.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <TouchableOpacity style={s.lang} activeOpacity={0.85} onPress={() => comingSoon('Le choix de la langue')}>
            <Text style={s.langText}>🇫🇷 FR</Text>
            <Ionicons name="chevron-down" size={12} color={Colors.text} />
          </TouchableOpacity>
          <View style={s.logo} pointerEvents="none">
            <TalariaLogo height={30} light />
          </View>
        </View>

        {/* Pagination */}
        <View style={s.dots} pointerEvents="none">
          {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === active && s.dotActive]} />)}
        </View>
      </View>

      {/* ── Texte + bouton ── */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
          <Text style={s.title}>{text.title}</Text>
          <Text style={s.subtitle}>{text.subtitle}</Text>
        </Animated.View>

        <View style={{ width: '100%' }}>
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/welcome')} activeOpacity={0.85}>
            <Text style={s.btnText}>Commencer mon voyage</Text>
          </TouchableOpacity>
          <Text style={s.version}>version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune },

  card: {
    height: CARD_H, overflow: 'hidden',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    backgroundColor: Colors.parmeDark,
  },
  photo: { width, height: CARD_H },

  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
  },
  lang: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 100,
    paddingVertical: 5, paddingHorizontal: 10, zIndex: 1,
  },
  langText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center', bottom: 0, top: 0, justifyContent: 'flex-end' },

  dots: {
    position: 'absolute', bottom: 22, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 22, backgroundColor: Colors.white },

  bottom: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 28,
  },
  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 30, lineHeight: 36,
    color: Colors.parme, textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 16,
    color: Colors.textMuted, textAlign: 'center', marginTop: 10,
  },
  btn: { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },
  version: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11,
    color: '#b9aeb5', textAlign: 'center', marginTop: 10,
  },
});

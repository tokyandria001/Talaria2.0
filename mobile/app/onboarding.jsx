import { useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions,
  FlatList, TouchableOpacity, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    bg:       require('../assets/slide1.jpg'),
    title:    'Meilleurs deals\nvoyages.',
    subtitle: 'Vols, hôtels, au bon prix.',
    overlay:  'rgba(30,5,20,0.42)',
  },
  {
    id: '2',
    bg:       require('../assets/slide2.jpg'),
    title:    'Vols, hôtels et\nactivités optimisés.',
    subtitle: 'Les meilleurs prix, au bon moment.',
    overlay:  'rgba(20,0,30,0.50)',
  },
  {
    id: '3',
    bg:       require('../assets/slide3.jpg'),
    title:    'Voyagez mieux,\nensemble.',
    subtitle: 'Une communauté de voyageurs malins.',
    overlay:  'rgba(79,32,63,0.48)',
  },
];

export default function OnboardingScreen() {
  const router  = useRouter();
  const listRef = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActive(idx);
  };

  const next = () => {
    if (active < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: active + 1 });
    } else {
      router.replace('/welcome');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={item.bg} style={styles.bg} resizeMode="cover" />
            <View style={[styles.overlay, { backgroundColor: item.overlay }]} />

            {/* Top bar */}
            <SafeAreaView style={styles.topBar}>
              <TalariaLogo height={36} light />
            </SafeAreaView>
          </View>
        )}
      />

      {/* Bottom card */}
      <View style={styles.card}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.title}>{SLIDES[active].title}</Text>
        <Text style={styles.subtitle}>{SLIDES[active].subtitle}</Text>

        <TouchableOpacity style={styles.btn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.btnText}>
            {active < SLIDES.length - 1 ? 'Suivant' : 'Commencer mon voyage'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0a14' },

  slide: { width, height, position: 'relative' },
  bg:    { position: 'absolute', inset: 0, width, height },
  overlay: { position: 'absolute', inset: 0 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    alignItems: 'center', paddingTop: 16,
  },
  logo: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 28, color: Colors.white, letterSpacing: 0.5,
  },

  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 44,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e0d0dc' },
  dotActive: { width: 22, backgroundColor: Colors.parme },

  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 30, color: Colors.text, lineHeight: 38, marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 15, color: Colors.textMuted, marginBottom: 28,
  },

  btn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 15, color: Colors.white,
  },
});

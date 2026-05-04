import { useRef, useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions,
  FlatList, TouchableOpacity, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useSlideUp, useTextSwap } from '../_hooks/useEntryAnim';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    bg:       require('../assets/roma.jpg'),
    title:    'Meilleurs deals\nvoyages.',
    subtitle: 'Vols, hôtels, au bon prix.',
    overlay:  'rgba(30,5,20,0.42)',
  },
  {
    id: '2',
    bg:       require('../assets/paris.jpg'),
    title:    'Vols, hôtels et\nactivités optimisés.',
    subtitle: 'Les meilleurs prix, au bon moment.',
    overlay:  'rgba(20,0,30,0.50)',
  },
  {
    id: '3',
    bg:       require('../assets/n.jpg'),
    title:    'Voyagez mieux,\nensemble.',
    subtitle: 'Une communauté de voyageurs malins.',
    overlay:  'rgba(79,32,63,0.48)',
  },
];

export default function OnboardingScreen() {
  const router  = useRouter();
  const listRef = useRef(null);
  const [active,   setActive]   = useState(0);
  const [titleTxt, setTitleTxt] = useState(SLIDES[0].title);
  const [subTxt,   setSubTxt]   = useState(SLIDES[0].subtitle);

  // Mount animations
  const { opacity: cardOpacity,
          translateY: cardY }    = useSlideUp(400, 120);

  // Text swap animation
  const { opacity: textOpacity,
          translateY: textY,
          swap }                 = useTextSwap();

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== active) {
      swap(() => {
        setActive(idx);
        setTitleTxt(SLIDES[idx].title);
        setSubTxt(SLIDES[idx].subtitle);
      });
    }
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

          </View>
        )}
      />

      {/* Bottom card — slide-up à l'entrée */}
      <Animated.View style={[
        styles.card,
        { opacity: cardOpacity, transform: [{ translateY: cardY }] },
      ]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>

        {/* Titre et sous-titre animés */}
        <Animated.Text style={[
          styles.title,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}>
          {titleTxt}
        </Animated.Text>
        <Animated.Text style={[
          styles.subtitle,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}>
          {subTxt}
        </Animated.Text>

        <TouchableOpacity style={styles.btn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.btnText}>
            {active < SLIDES.length - 1 ? 'Suivant' : 'Commencer mon voyage'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a0a14' },

  slide:   { width, height, position: 'relative' },
  bg:      { position: 'absolute', inset: 0, width, height },
  overlay: { position: 'absolute', inset: 0 },


  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 44,
  },
  dots:      { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e0d0dc' },
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

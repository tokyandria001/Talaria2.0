import { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { SocialButton } from '../components/AuthUI';

// Photos remplaçables : garder les mêmes noms dans assets/auth/
const BACKGROUNDS = [
  require('../assets/auth/welcome-1.jpg'),
  require('../assets/auth/welcome-2.jpg'),
  require('../assets/auth/welcome-3.jpg'),
  require('../assets/auth/welcome-4.jpg'),
];
const STORY_MS = 5000;

export default function WelcomeScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  // Opacité de chaque photo (fondu enchaîné) + remplissage de la barre en cours
  const opacities = useRef(BACKGROUNDS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const progress  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    BACKGROUNDS.forEach((_, i) => {
      Animated.timing(opacities[i], { toValue: i === index ? 1 : 0, duration: 500, useNativeDriver: true }).start();
    });

    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1, duration: STORY_MS, easing: Easing.linear, useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setIndex(i => (i + 1) % BACKGROUNDS.length);
    });
    return () => anim.stop();
  }, [index, opacities, progress]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {BACKGROUNDS.map((bg, i) => (
        <Animated.Image key={i} source={bg} style={[s.bg, { opacity: opacities[i] }]} resizeMode="cover" />
      ))}
      <View style={s.overlay} />
      <View style={s.overlayBottom} />

      <SafeAreaView style={s.safe}>
        {/* Barres de progression */}
        <View style={s.bars}>
          {BACKGROUNDS.map((_, i) => (
            <TouchableOpacity key={i} style={s.bar} onPress={() => setIndex(i)} hitSlop={{ top: 12, bottom: 12 }}>
              <Animated.View style={[
                s.barFill,
                { width: i < index ? '100%' : i === index ? barWidth : '0%' },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.logo}>
          <TalariaLogo height={40} light />
        </View>

        <View style={{ flex: 1 }} />

        <Text style={s.headline}>Vols, hôtels et activités optimisés.</Text>
        <Text style={s.sub}>Les meilleurs prix, au bon moment.</Text>

        <View style={{ gap: 12, marginTop: 28 }}>
          <SocialButton provider="google" label="Se connecter avec Google" variant="glass" />
          <SocialButton provider="apple"  label="Se connecter avec Apple"  variant="glass" />
        </View>

        <View style={s.authRow}>
          <TouchableOpacity style={s.authBtn} onPress={() => router.push('/login')} activeOpacity={0.85}>
            <Text style={s.authBtnText}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.authBtn} onPress={() => router.push('/register')} activeOpacity={0.85}>
            <Text style={s.authBtnText}>Inscription</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.parmeDark },
  bg:      { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,8,22,0.25)' },
  overlayBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%',
    backgroundColor: 'rgba(30,8,22,0.30)',
  },

  safe: { flex: 1, paddingHorizontal: 22, paddingBottom: 16 },

  bars:    { flexDirection: 'row', gap: 6, marginTop: 8 },
  bar:     { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.white },

  logo: { alignItems: 'center', marginTop: 22 },

  headline: {
    fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 30, lineHeight: 36,
    color: Colors.white, textAlign: 'center',
  },
  sub: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 16,
    color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8,
  },

  authRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  authBtn: { flex: 1, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 15, alignItems: 'center' },
  authBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },
});

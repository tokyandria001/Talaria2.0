import { useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('screen');

const LOGO_H   = 64;
const LOGO_W   = Math.round(LOGO_H * 8476 / 2211); // ~245 px
const MASCOT_H = 170;
const MASCOT_W = 132;
const TALI_H   = 70;

const MASCOT_DELAY = 300;
const MASCOT_DUR   = 4200;

const _T      = 2 * (width + MASCOT_W);
const P_START = Math.max(0, (width / 2 + 2 * MASCOT_W - LOGO_W / 2) / _T);
const P_END   = Math.min(1, (width / 2 + 2 * MASCOT_W + LOGO_W / 2) / _T);

const BG     = require('../assets/aurore.jpg');
const MASCOT = require('../assets/mascotte.png');
const TALI   = require('../assets/Logo-09.png');

export default function WelcomeScreen() {
  const router = useRouter();

  const progress   = useRef(new Animated.Value(0)).current;
  const btnsAnim   = useRef(new Animated.Value(0)).current;
  const taliOpacity = useRef(new Animated.Value(0)).current;
  const taliScale   = useRef(new Animated.Value(0)).current;

  // Délai boutons : 0.5s après que le logo est entièrement révélé (pas après fin du vol)
  const BTNS_DELAY = MASCOT_DELAY + Math.round(MASCOT_DUR * P_END) + 500;

  useEffect(() => {
    Animated.parallel([
      // Mascotte + logo (JS thread)
      Animated.sequence([
        Animated.delay(MASCOT_DELAY),
        Animated.timing(progress, {
          toValue: 1,
          duration: MASCOT_DUR,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
      // Tali + boutons, 0.5s après fin de révélation du logo
      Animated.sequence([
        Animated.delay(BTNS_DELAY),
        Animated.parallel([
          Animated.timing(btnsAnim, {
            toValue: 1, duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(taliOpacity, {
            toValue: 1, duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(taliScale, {
            toValue: 1,
            damping: 7, stiffness: 220, mass: 0.8,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const mascotX = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [width + MASCOT_W, -(width + MASCOT_W)],
  });
  const mascotY = progress.interpolate({
    inputRange:  [0, 0.45, 1],
    outputRange: [8, -18, 4],
  });
  const revealW = progress.interpolate({
    inputRange:  [P_START, P_END],
    outputRange: [0, LOGO_W],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image source={BG} style={s.bg} resizeMode="cover" />
      <View style={s.overlay} />

      <SafeAreaView style={s.safe}>

        {/* ── Logo + Tali côte à côte ── */}
        <View style={s.logoRow}>
          {/* Logo révélé par balayage */}
          <View style={{ width: LOGO_W, height: LOGO_H }}>
            <Animated.View style={{
              position: 'absolute', top: 0, right: 0,
              height: LOGO_H, width: revealW, overflow: 'hidden',
            }}>
              <View style={{ position: 'absolute', right: 0 }}>
                <TalariaLogo height={LOGO_H} light />
              </View>
            </Animated.View>
          </View>

          {/* Tali — rebond après l'animation */}
          <Animated.Image
            source={TALI}
            style={[s.tali, {
              opacity: taliOpacity,
              transform: [{ scale: taliScale }],
            }]}
            resizeMode="contain"
          />
        </View>

        <View style={{ height: 72 }} />

        {/* ── Boutons ── */}
        <Animated.View style={{ opacity: btnsAnim }}>
          <View style={s.bottom}>
            <Text style={s.headline}>Vols, hôtels et activités{'\n'}optimisés.</Text>
            <Text style={s.sub}>Les meilleurs prix, au bon moment.</Text>

            <TouchableOpacity style={s.socialBtn} activeOpacity={0.85}>
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={s.socialLabel}>Se connecter avec Google</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <TouchableOpacity style={s.socialBtn} activeOpacity={0.85}>
              <Ionicons name="logo-apple" size={18} color="#fff" />
              <Text style={s.socialLabel}>Se connecter avec Apple</Text>
            </TouchableOpacity>

            <View style={s.authRow}>
              <TouchableOpacity
                style={[s.authBtn, s.authBtnPrimary]}
                onPress={() => router.push('/login')}
                activeOpacity={0.85}
              >
                <Text style={[s.authBtnText, { color: Colors.white }]}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.authBtn, s.authBtnOutline]}
                onPress={() => router.push('/register')}
                activeOpacity={0.85}
              >
                <Text style={[s.authBtnText, { color: Colors.white }]}>Inscription</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* ── Mascotte qui traverse ── */}
      <Animated.Image
        source={MASCOT}
        style={[s.mascot, {
          transform: [{ translateX: mascotX }, { translateY: mascotY }],
        }]}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#090510' },
  bg:      { position: 'absolute', top: 0, left: 0, width, height },
  overlay: { position: 'absolute', top: 0, left: 0, width, height,
             backgroundColor: 'rgba(10,4,22,0.50)' },

  safe: {
    flex: 1, paddingHorizontal: 24, paddingBottom: 32,
    justifyContent: 'center',
  },

  // Logo et Tali alignés sur la même ligne
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  tali: {
    width:  TALI_H,
    height: TALI_H,
    marginBottom: -8,
    tintColor: '#ffffff',
  },

  mascot: {
    position: 'absolute',
    width: MASCOT_W, height: MASCOT_H,
    top: height * 0.28 - MASCOT_H / 2,
    left: 0,
    zIndex: 20, elevation: 20,
  },

  bottom: { gap: 12 },

  headline: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 28, color: Colors.white, lineHeight: 36, marginBottom: 6,
  },
  sub: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 8,
  },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  socialLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },

  authRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  authBtn: { flex: 1, borderRadius: 100, paddingVertical: 15, alignItems: 'center' },
  authBtnPrimary: { backgroundColor: Colors.parme },
  authBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.white },
  authBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15 },
});

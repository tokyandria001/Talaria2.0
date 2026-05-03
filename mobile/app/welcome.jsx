import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { AntDesign } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const BG = require('../assets/slide1.jpg');

const SocialBtn = ({ provider, label, onPress }) => (
  <TouchableOpacity style={styles.socialBtn} onPress={onPress} activeOpacity={0.85}>
    <AntDesign
      name={provider === 'google' ? 'google' : 'apple1'}
      size={18}
      color="#fff"
    />
    <Text style={styles.socialLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Image source={BG} style={styles.bg} resizeMode="cover" />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        {/* Logo */}
        <TalariaLogo height={36} light />

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Bottom content */}
        <View style={styles.bottom}>
          <Text style={styles.headline}>Vols, hôtels et activités{'\n'}optimisés.</Text>
          <Text style={styles.sub}>Les meilleurs prix, au bon moment.</Text>

          <SocialBtn provider="google" label="Se connecter avec Google" onPress={() => {}} />
          <SocialBtn provider="apple"  label="Se connecter avec Apple"  onPress={() => {}} />

          <View style={styles.authRow}>
            <TouchableOpacity
              style={[styles.authBtn, styles.authBtnPrimary]}
              onPress={() => router.push('/login')}
              activeOpacity={0.85}
            >
              <Text style={[styles.authBtnText, { color: Colors.white }]}>Connexion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authBtn, styles.authBtnOutline]}
              onPress={() => router.push('/register')}
              activeOpacity={0.85}
            >
              <Text style={[styles.authBtnText, { color: Colors.white }]}>Inscription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#1a0a14' },
  bg:      { position: 'absolute', inset: 0, width, height },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(30,5,20,0.55)' },

  safe: { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },

  logo: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 28, color: Colors.white,
    textAlign: 'center', marginTop: 12,
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
  socialIcon:  { fontSize: 18, color: Colors.white, fontWeight: '700', width: 22, textAlign: 'center' },
  socialLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },

  authRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  authBtn: {
    flex: 1, borderRadius: 100, paddingVertical: 15, alignItems: 'center',
  },
  authBtnPrimary: { backgroundColor: Colors.parme },
  authBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.white },
  authBtnText: {
    fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15,
  },
});

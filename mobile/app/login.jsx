import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { Ionicons } from '@expo/vector-icons';
import { useScaleFade, useSlideUp } from '../_hooks/useEntryAnim';

const SocialBtn = ({ provider, label }) => (
  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
    <Ionicons
      name={provider === 'google' ? 'logo-google' : 'logo-apple'}
      size={18}
      color={provider === 'google' ? '#4285F4' : '#000'}
    />
    <Text style={styles.socialLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function LoginScreen() {
  const router    = useRouter();
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Animations
  const { opacity: logoOpacity, scale: logoScale } = useScaleFade(0);
  const { opacity: formOpacity, translateY: formY } = useSlideUp(200, 40);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Remplis tous les champs.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Logo animé */}
          <Animated.View style={[
            { alignItems: 'center', marginBottom: 24 },
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}>
            <TalariaLogo height={52} />
          </Animated.View>

          {/* Formulaire animé */}
          <Animated.View style={{
            opacity: formOpacity,
            transform: [{ translateY: formY }],
          }}>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Ravi de vous revoir ! Prêt pour de nouveaux voyages malins ?</Text>

            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
              <Ionicons name="logo-google" size={18} color="#4285F4" />
              <Text style={styles.socialLabel}>Se connecter avec Google</Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
              <Ionicons name="logo-apple" size={18} color="#000" />
              <Text style={styles.socialLabel}>Se connecter avec Apple</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Ou alors...</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Entrez votre mail"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Entrez votre mot de passe"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)}>
                <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotWrap}>
              <Text style={styles.forgot}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/register')} style={styles.switchWrap}>
              <Text style={styles.switchText}>
                Vous n'avez pas de compte ? <Text style={styles.switchLink}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  back:      { marginTop: 8, marginBottom: 16, width: 36 },
  backArrow: { fontSize: 22, color: Colors.text },

  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 28, color: Colors.text, marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 14, color: Colors.textMuted, marginBottom: 24, lineHeight: 20,
  },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
  },
  socialLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },

  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13, color: Colors.textMuted,
  },

  label: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.text, marginBottom: 6, marginTop: 4,
  },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, marginBottom: 12,
  },

  pwdWrap:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyeBtn:   { position: 'absolute', right: 14 },
  eyeIcon:  { fontSize: 16 },

  forgotWrap: { alignItems: 'flex-end', marginBottom: 20 },
  forgot: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.parme,
  },

  errorBox: {
    backgroundColor: '#fef2f2', borderRadius: 10,
    padding: 12, marginBottom: 14,
  },
  errorText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13, color: Colors.error,
  },

  btn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
  },
  btnText: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 15, color: Colors.white,
  },

  switchWrap: { alignItems: 'center' },
  switchText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13, color: Colors.textMuted,
  },
  switchLink: {
    fontFamily: 'BricolageGrotesque_700Bold',
    color: Colors.parme,
  },
});

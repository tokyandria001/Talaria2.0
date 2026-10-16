import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import { SocialButton, AuthInput, OrDivider, AuthHeader, comingSoon } from '../components/AuthUI';
import { useSlideUp } from '../_hooks/useEntryAnim';

// Photo remplaçable : garder le même nom dans assets/auth/
const BG = require('../assets/auth/login-bg.jpg');

export default function LoginScreen() {
  const router    = useRouter();
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const { opacity, translateY } = useSlideUp(100, 30);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Remplis tous les champs.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err.response?.status === 401
        ? 'Email ou mot de passe incorrect.'
        : err.response?.data?.message || 'Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <Image source={BG} style={s.bg} resizeMode="cover" />
      <View style={s.veil} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <AuthHeader title="Connexion" onBack={() => router.back()} />

            <Animated.View style={{ flex: 1, justifyContent: 'center', opacity, transform: [{ translateY }] }}>
              <Text style={s.intro}>Bon retour parmi nous ! On prépare de{'\n'}nouveaux voyages malins ?</Text>

              <View style={{ gap: 12 }}>
                <SocialButton provider="google" label="Se connecter avec Google" variant="parme" />
                <SocialButton provider="apple"  label="Se connecter avec Apple"  variant="parme" />
              </View>

              <OrDivider />

              <AuthInput
                label="Mail"
                placeholder="Entrez votre mail"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <AuthInput
                label="Mot de passe"
                placeholder="Entrez votre mot de passe"
                secure
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity onPress={() => comingSoon('La réinitialisation du mot de passe')} style={s.forgot}>
                <Text style={s.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.6 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={s.btnText}>{loading ? 'Connexion...' : 'Je me connecte'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={() => router.replace('/register')} style={s.switch}>
              <Text style={s.switchText}>
                Vous n'avez pas de compte ? <Text style={s.switchLink}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  bg:     { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.18 },
  veil:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,249,241,0.55)' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 20 },

  intro: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 17, lineHeight: 23,
    color: Colors.textMuted, textAlign: 'center', marginBottom: 24,
  },

  forgot:     { alignSelf: 'center', marginTop: 4, marginBottom: 18 },
  forgotText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme, textDecorationLine: 'underline' },

  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },

  switch:     { alignItems: 'center', marginTop: 24 },
  switchText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  switchLink: { color: Colors.parme, textDecorationLine: 'underline' },
});

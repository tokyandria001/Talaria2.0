import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import { SocialButton, AuthInput, OrDivider, AuthHeader } from '../components/AuthUI';
import { useSlideUp } from '../_hooks/useEntryAnim';

// Photo remplaçable : garder le même nom dans assets/auth/
const BG = require('../assets/auth/register-bg.jpg');

export default function RegisterScreen() {
  const router       = useRouter();
  const { register } = useAuth();

  const [form,    setForm]    = useState({ email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const { opacity, translateY } = useSlideUp(100, 30);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.email.trim() || !form.password) { setError('Mail et mot de passe sont requis.'); return; }
    if (form.password !== form.confirm)       { setError('Les mots de passe ne correspondent pas.'); return; }
    setError('');
    setLoading(true);
    try {
      // Prénom, photo et préférences : les questions de l'onboarding juste après
      await register({ email: form.email.trim(), password: form.password });
      router.replace('/profile-setup');
    } catch (err) {
      const data = err.response?.data;
      setError(data?.errors ? Object.values(data.errors).join('\n') : data?.message || 'Impossible de joindre le serveur.');
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
            <AuthHeader title="Inscription" onBack={() => router.back()} backStyle={s.back} />

            <Animated.View style={{ flex: 1, justifyContent: 'center', opacity, transform: [{ translateY }] }}>
              <AuthInput
                label="Mail"
                placeholder="Entrez votre mail"
                keyboardType="email-address"
                autoComplete="email"
                value={form.email}
                onChangeText={set('email')}
              />
              <AuthInput
                label="Mot de passe"
                placeholder="Entrez votre mot de passe"
                secure
                autoComplete="new-password"
                value={form.password}
                onChangeText={set('password')}
              />
              <AuthInput
                label="Confirmer le mot de passe"
                placeholder="Entrez votre mot de passe"
                secure
                autoComplete="new-password"
                value={form.confirm}
                onChangeText={set('confirm')}
                onSubmitEditing={handleRegister}
              />

              {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.6 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={s.btnText}>{loading ? 'Inscription...' : "Je m'inscris"}</Text>
              </TouchableOpacity>

              <OrDivider />

              <View style={{ gap: 12 }}>
                <SocialButton provider="google" label="S'inscrire avec Google" variant="soft" />
                <SocialButton provider="apple"  label="S'inscrire avec Apple"  variant="soft" />
              </View>

              <TouchableOpacity onPress={() => router.replace('/login')} style={s.switch}>
                <Text style={s.switchText}>
                  Vous avez déjà un compte ? <Text style={s.switchLink}>Se connecter</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={s.legal}>
              En créant un compte, vous acceptez nos{'\n'}
              <Text style={s.legalLink} onPress={() => router.push('/cgu')}>Conditions générales d'utilisation</Text>
              . Veuillez lire notre{' '}
              <Text style={s.legalLink} onPress={() => router.push('/privacy')}>Politique de confidentialité</Text>.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  bg:     { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.12 },
  veil:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(252,249,241,0.6)' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 16 },

  back: { backgroundColor: 'rgba(79,32,63,0.10)' },

  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },

  switch:     { alignItems: 'center', marginTop: 24 },
  switchText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  switchLink: { color: Colors.parme, textDecorationLine: 'underline' },

  legal: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, lineHeight: 16,
    color: Colors.textMuted, textAlign: 'center', marginTop: 24,
  },
  legalLink: { textDecorationLine: 'underline' },
});

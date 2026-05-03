import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import TalariaLogo from '../components/TalariaLogo';
import { AntDesign } from '@expo/vector-icons';

const SocialBtn = ({ provider, label }) => (
  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
    <AntDesign
      name={provider === 'google' ? 'google' : 'apple1'}
      size={18}
      color={provider === 'google' ? '#4285F4' : '#000'}
    />
    <Text style={styles.socialLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function RegisterScreen() {
  const router        = useRouter();
  const { register }  = useAuth();

  const [form, setForm]       = useState({ email: '', firstName: '', lastName: '', username: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.firstName) {
      setError('Email, prénom et mot de passe sont requis.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.'); return;
    }
    setError('');
    setLoading(true);
    try {
      await register({
        email:     form.email.trim(),
        password:  form.password,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim() || undefined,
        username:  form.username.trim() || undefined,
      });
      router.replace('/(tabs)/community');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.email;
      setError(msg || 'Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <TalariaLogo height={52} />
          </View>
          <Text style={styles.title}>Inscription</Text>

          <SocialBtn provider="google" label="S'inscrire avec Google" />
          <View style={{ height: 8 }} />
          <SocialBtn provider="apple" label="S'inscrire avec Apple" />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Ou alors...</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <Text style={styles.label}>Mail</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre mail"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={set('email')}
          />

          {/* First + Last name */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Jean"
                placeholderTextColor={Colors.textMuted}
                value={form.firstName}
                onChangeText={set('firstName')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Dupont"
                placeholderTextColor={Colors.textMuted}
                value={form.lastName}
                onChangeText={set('lastName')}
              />
            </View>
          </View>

          {/* Pseudo */}
          <Text style={[styles.label, { marginTop: 12 }]}>
            Pseudo <Text style={styles.optional}>(optionnel)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="@explorateur"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            value={form.username}
            onChangeText={set('username')}
          />

          {/* Password */}
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.pwdWrap}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Entrez votre mot de passe"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPwd}
              value={form.password}
              onChangeText={set('password')}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)}>
              <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez votre mot de passe"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={form.confirm}
            onChangeText={set('confirm')}
          />

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{loading ? 'Inscription...' : "Je m'inscris"}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            En créant un compte, vous acceptez nos{' '}
            <Text style={styles.legalLink}>Conditions générales d'utilisation</Text>
            {' '}et notre{' '}
            <Text style={styles.legalLink}>Politique de confidentialité</Text>.
          </Text>

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.switchWrap}>
            <Text style={styles.switchText}>
              Vous avez déjà un compte ? <Text style={styles.switchLink}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

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

  logo: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 26, color: Colors.parme, textAlign: 'center', marginBottom: 24,
  },
  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 28, color: Colors.text, marginBottom: 20,
  },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
  },
  socialIcon:  { fontSize: 16, color: Colors.text, fontWeight: '700', width: 22, textAlign: 'center' },
  socialLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },

  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted,
  },

  label: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.text, marginBottom: 6, marginTop: 4,
  },
  optional: { fontFamily: 'BricolageGrotesque_400Regular', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, marginBottom: 12,
  },

  row:     { flexDirection: 'row', gap: 10 },
  pwdWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyeBtn:  { position: 'absolute', right: 14 },
  eyeIcon: { fontSize: 16 },

  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.error },

  btn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16,
  },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },

  legal: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 18, marginBottom: 16,
  },
  legalLink: { color: Colors.parme, fontFamily: 'BricolageGrotesque_600SemiBold' },

  switchWrap: { alignItems: 'center' },
  switchText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  switchLink: { fontFamily: 'BricolageGrotesque_700Bold', color: Colors.parme },
});

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

/* Composants partagés des écrans d'accueil / connexion / inscription (design Figma « Auth ») */

/** Fonctionnalités affichées dans le design mais pas encore disponibles */
export const comingSoon = (what) =>
  Alert.alert('Bientôt disponible', `${what} arrive bientôt dans Talaria.`);

const SOCIAL = {
  google: { icon: 'logo-google', color: '#4285F4', name: 'Google' },
  apple:  { icon: 'logo-apple',  color: '#000000', name: 'Apple' },
};

/**
 * Bouton « Se connecter avec Google / Apple ».
 * variant : 'glass' (sur photo), 'parme' (connexion), 'soft' (inscription)
 */
export function SocialButton({ provider, label, variant = 'glass' }) {
  const p = SOCIAL[provider];
  const onParme = variant === 'parme';
  return (
    <TouchableOpacity
      style={[s.social, s[`social_${variant}`]]}
      activeOpacity={0.85}
      onPress={() => comingSoon(`La connexion avec ${p.name}`)}
    >
      <Ionicons name={p.icon} size={18} color={onParme ? Colors.white : p.color} />
      <Text style={[s.socialLabel, onParme && { color: Colors.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Champ avec libellé ; `secure` ajoute l'icône œil pour afficher le mot de passe */
export function AuthInput({ label, secure, style, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          placeholderTextColor="#b9aeb5"
          secureTextEntry={secure && !visible}
          autoCapitalize="none"
          {...props}
        />
        {secure && (
          <TouchableOpacity onPress={() => setVisible(v => !v)} hitSlop={10} style={s.eye}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#b9aeb5" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Séparateur « Ou alors... » */
export function OrDivider() {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerText}>Ou alors...</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

/** En-tête : bouton retour rond + titre centré */
export function AuthHeader({ title, onBack, backStyle }) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={[s.back, backStyle]} onPress={onBack} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color={Colors.text} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 48 }} />
    </View>
  );
}

const s = StyleSheet.create({
  social: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 100, paddingVertical: 14,
  },
  social_glass: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  social_parme: { backgroundColor: 'rgba(79,32,63,0.72)' },
  social_soft:  { backgroundColor: 'rgba(79,32,63,0.08)' },
  socialLabel:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },

  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, marginBottom: 6, marginLeft: 12 },
  inputWrap: { justifyContent: 'center' },
  input: {
    backgroundColor: Colors.white, borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 14, paddingRight: 46,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular', color: Colors.text,
  },
  eye: { position: 'absolute', right: 18 },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18, paddingHorizontal: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.parme, opacity: 0.6 },
  dividerText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  back: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 26, color: Colors.parme },
});

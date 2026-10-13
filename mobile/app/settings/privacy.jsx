import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SettingsPage, Section, Row, SwitchRow, Chips } from '../../components/settings/SettingsUI';
import { INVITE_POLICIES } from '../../constants/Settings';
import { Colors } from '../../constants/Colors';

/** Confidentialité & sécurité (maquette 31) */
export default function PrivacyScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [blockedCount, setBlockedCount] = useState(null);

  useFocusEffect(useCallback(() => {
    client.get('/api/profile/blocked').then(({ data }) => setBlockedCount(data.length)).catch(() => {});
  }, []));

  const save = async (payload) => {
    try { await updateProfile(payload); }
    catch (err) { Alert.alert('Confidentialité', err.response?.data?.message || "Impossible d'enregistrer ce réglage."); }
  };

  return (
    <SettingsPage title="Confidentialité">
      <Section title="Visibilité">
        <SwitchRow icon="eye-outline" title="Profil public" subtitle="Visible par les autres voyageurs. Sinon, seuls tes amis voient ta bio et tes voyages."
          value={user?.profilePublic} onChange={(v) => save({ profilePublic: v })} />
        <SwitchRow icon="location-outline" title="Partager ma position" subtitle="Uniquement pendant un voyage, avec le groupe — bientôt"
          value={user?.settings?.sharePosition} onChange={(v) => save({ settings: { sharePosition: v } })} />
      </Section>

      <Text style={s.label}>Qui peut m'inviter dans un groupe ?</Text>
      <Chips single options={INVITE_POLICIES} selected={user?.invitePolicy ?? 'friends'} onChange={(v) => save({ invitePolicy: v })} />
      <Text style={s.hint}>Seuls tes amis peuvent t'inviter aujourd'hui ; « Personne » bloque toutes les invitations. Le code d'invitation d'un groupe reste utilisable par toi.</Text>

      <Section title="Sécurité">
        <Row icon="shield-checkmark-outline" title="Double authentification" subtitle="Code par SMS à la connexion" soon />
        <Row icon="phone-portrait-outline" title="Appareils connectés" soon />
      </Section>

      <Section title="Autres">
        <Row icon="ban-outline" title="Utilisateurs bloqués" value={blockedCount != null ? String(blockedCount) : null}
          onPress={() => router.push('/settings/blocked')} />
        <Row icon="lock-closed-outline" title="Politique de confidentialité" onPress={() => router.push('/privacy')} />
        <Row icon="document-text-outline" title="Conditions générales d'utilisation" onPress={() => router.push('/cgu')} />
      </Section>
      <View style={{ height: 8 }} />
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text, marginTop: 20, marginBottom: 10 },
  hint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
});

import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import { comingSoon } from '../../components/AuthUI';
import { SettingsPage, Section, Row } from '../../components/settings/SettingsUI';
import { Colors } from '../../constants/Colors';

/** Paramètres (maquette 28) et fenêtre de déconnexion (maquette 35) */
export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Mon profil';
  const methods = user?.settings?.reimbursements?.methods ?? [];

  const doLogout = async () => {
    setConfirmLogout(false);
    await logout();
    router.replace('/welcome');
  };

  return (
    <SettingsPage label={null} title="Paramètres">
      <TouchableOpacity style={s.me} onPress={() => router.push('/edit-profile')} activeOpacity={0.85}>
        <UserAvatar user={user} size={46} style={{ borderWidth: 2, borderColor: Colors.white }} />
        <View style={{ flex: 1 }}>
          <Text style={s.meName} numberOfLines={1}>{name}</Text>
          <Text style={s.meMail} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.white} />
      </TouchableOpacity>

      <Section title="Compte">
        <Row icon="person-outline" title="Compte" subtitle="E-mail, téléphone, mot de passe" onPress={() => router.push('/settings/account')} />
        <Row icon="notifications-outline" title="Notifications" onPress={() => router.push('/settings/notifications')} />
        <Row icon="lock-closed-outline" title="Confidentialité & sécurité" onPress={() => router.push('/settings/privacy')} />
      </Section>

      <Section title="Voyages">
        <Row icon="compass-outline" title="Préférences de voyage" subtitle="Intérêts, budget, transport" onPress={() => router.push('/settings/preferences')} />
        <Row icon="globe-outline" title="Langue & devise" value="FR · €" onPress={() => router.push('/settings/language')} />
        <Row icon="card-outline" title="Moyens de remboursement"
          subtitle={methods.length ? methods.map(m => m.type === 'virement' ? 'virement' : m.type.charAt(0).toUpperCase() + m.type.slice(1)).join(', ') : 'Lydia, PayPal, virement…'}
          onPress={() => router.push('/settings/reimbursements')} />
      </Section>

      <Section title="Assistance">
        <Row icon="help-circle-outline" title="Aide & support" onPress={() => router.push('/settings/help')} />
        <Row icon="star-outline" title="Noter Talaria" onPress={() => comingSoon('La note sur les stores (après la publication de l\'app)')} />
        <Row icon="information-circle-outline" title="À propos" value={`v${version}`} onPress={() => Alert.alert('Talaria', `Version ${version}\nVoyager mieux, moins cher, ensemble.\n\nDonnées des lieux © les contributeurs OpenStreetMap.`)} />
      </Section>

      <Section>
        <Row icon="log-out-outline" title="Se déconnecter" danger onPress={() => setConfirmLogout(true)} />
      </Section>

      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalIcon}><Ionicons name="log-out-outline" size={22} color={Colors.error} /></View>
            <Text style={s.modalTitle}>Se déconnecter ?</Text>
            <Text style={s.modalText}>Tu pourras te reconnecter à tout moment. Tes voyages et tes groupes restent sauvegardés.</Text>
            <TouchableOpacity style={s.modalDanger} onPress={doLogout}>
              <Text style={s.modalDangerText}>Se déconnecter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setConfirmLogout(false)}>
              <Text style={s.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.parme, borderRadius: 18, padding: 14, marginTop: 4 },
  meName: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.white },
  meMail: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(30,8,22,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modal: { width: '100%', backgroundColor: Colors.white, borderRadius: 24, padding: 22, alignItems: 'center' },
  modalIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fdecec', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: Colors.parme, marginTop: 12 },
  modalText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  modalDanger: { alignSelf: 'stretch', backgroundColor: '#fde3e3', borderRadius: 100, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  modalDangerText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.error },
  modalCancel: { alignSelf: 'stretch', backgroundColor: '#efe6e9', borderRadius: 100, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalCancelText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
});

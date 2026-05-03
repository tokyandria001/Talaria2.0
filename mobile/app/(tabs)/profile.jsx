import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import TalariaLogo from '../../components/TalariaLogo';
import { Colors } from '../../constants/Colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const tabBarH  = 64 + (insets.bottom || 16);

  const [pwdForm,     setPwdForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPwd,   setSavingPwd]   = useState(false);
  const [pwdMsg,      setPwdMsg]      = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd,   setDeletePwd]   = useState('');
  const [deleting,    setDeleting]    = useState(false);

  const initials = user
    ? (((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')) || (user.email?.[0] ?? '?')).toUpperCase()
    : '?';

  const handleChangePwd = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      setPwdMsg({ type: 'error', text: 'Remplis tous les champs.' }); return;
    }
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return;
    }
    setSavingPwd(true); setPwdMsg(null);
    try {
      await client.put('/api/profile/password', {
        currentPassword: pwdForm.currentPassword,
        newPassword:     pwdForm.newPassword,
      });
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié ✓' });
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message ?? 'Erreur.' });
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  const handleDeleteAccount = async () => {
    if (!deletePwd) { Alert.alert('Mot de passe requis'); return; }
    setDeleting(true);
    try {
      await client.delete('/api/profile', { data: { password: deletePwd } });
      await logout();
      router.replace('/');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message ?? 'Mot de passe incorrect.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarH + 16 }]} showsVerticalScrollIndicator={false}>

        <TalariaLogo height={42} />
        <Text style={styles.pageTitle}>Mon profil</Text>

        {/* Avatar card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.firstName ?? ''} {user?.lastName ?? ''}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.username && <Text style={styles.userPseudo}>@{user.username}</Text>}
          </View>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Changer le mot de passe</Text>

          <Text style={styles.label}>Mot de passe actuel</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={pwdForm.currentPassword}
            onChangeText={v => setPwdForm(f => ({ ...f, currentPassword: v }))}
          />
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={pwdForm.newPassword}
            onChangeText={v => setPwdForm(f => ({ ...f, newPassword: v }))}
          />
          <Text style={styles.label}>Confirmer</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={pwdForm.confirm}
            onChangeText={v => setPwdForm(f => ({ ...f, confirm: v }))}
          />

          {pwdMsg && (
            <Text style={[styles.msg, { color: pwdMsg.type === 'success' ? '#16a34a' : Colors.error }]}>
              {pwdMsg.text}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btn, savingPwd && { opacity: 0.6 }]}
            onPress={handleChangePwd}
            disabled={savingPwd}
          >
            {savingPwd
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.btnText}>Modifier le mot de passe</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>Zone dangereuse</Text>
          <Text style={styles.dangerText}>
            La suppression de votre compte est définitive. Tous vos articles, commentaires et likes seront effacés.
          </Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => { setDeleteModal(true); setDeletePwd(''); }}
          >
            <Text style={styles.dangerBtnText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Delete account modal */}
      {deleteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.modalText}>
              Cette action est irréversible. Entrez votre mot de passe pour confirmer.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoFocus
              value={deletePwd}
              onChangeText={setDeletePwd}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { flex: 1 }, deleting && { opacity: 0.6 }]}
                onPress={handleDeleteAccount}
                disabled={deleting || !deletePwd}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.dangerBtnText}>Confirmer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.sableLune },
  scroll:    { padding: 16, gap: 14 },
  pageTitle: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 26, color: Colors.parme, marginBottom: 4,
  },

  card: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 18, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 22, color: Colors.white },
  userName:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: Colors.text },
  userEmail:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  userPseudo: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme },

  sectionTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: Colors.text },

  label: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.text,
  },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular', color: Colors.text,
  },

  msg: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13 },

  btn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingVertical: 13, alignItems: 'center',
  },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },

  logoutBtn: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 100, paddingVertical: 13, alignItems: 'center',
    backgroundColor: Colors.white,
  },
  logoutText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.textMuted },

  dangerCard:  { borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  dangerTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: '#dc2626' },
  dangerText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  dangerBtn:   { backgroundColor: '#dc2626', borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },

  modalOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, width: '100%', gap: 14,
  },
  modalTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: '#dc2626' },
  modalText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 100, paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.textMuted },
});

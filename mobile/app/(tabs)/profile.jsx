import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import client from '../../api/client';
import TalariaLogo from '../../components/TalariaLogo';

export default function ProfileScreen() {
  const { user, logout }      = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const tabBarH  = 64 + (insets.bottom || 16);

  const [pwdForm,     setPwdForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPwd,   setSavingPwd]   = useState(false);
  const [pwdMsg,      setPwdMsg]      = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd,   setDeletePwd]   = useState('');
  const [deleting,    setDeleting]    = useState(false);
  const [pendingFriends, setPendingFriends] = useState(0);

  // Nombre de demandes d'ami reçues, rafraîchi à chaque retour sur l'écran
  useFocusEffect(useCallback(() => {
    client.get('/api/friends/requests')
      .then(({ data }) => setPendingFriends(data.received.length))
      .catch(() => {});
  }, []));

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

  const t = theme;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.sableLune }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarH + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <TalariaLogo height={42} />
        <Text style={[s.pageTitle, { color: t.parme }]}>Mon profil</Text>

        {/* Avatar card — appui : modifier prénom, pseudo et préférences */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: t.white, borderColor: t.border }]}
          onPress={() => router.push({ pathname: '/complete-profile', params: { mode: 'edit' } })}
          activeOpacity={0.85}
        >
          <View style={[s.avatarCircle, { backgroundColor: t.parme }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.userName, { color: t.text }]}>{user?.firstName ?? ''} {user?.lastName ?? ''}</Text>
            <Text style={[s.userEmail, { color: t.textMuted }]}>{user?.email}</Text>
            {user?.username
              ? <Text style={[s.userPseudo, { color: t.parme }]}>@{user.username}</Text>
              : <Text style={[s.userPseudo, { color: t.parme }]}>Ajouter un pseudo pour que tes amis te trouvent</Text>}
          </View>
          <Ionicons name="create-outline" size={20} color={t.parme} />
        </TouchableOpacity>

        {/* Amis (phase 7) */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: t.white, borderColor: t.border }]}
          onPress={() => router.push('/friends')}
          activeOpacity={0.85}
        >
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: isDark ? '#2e1a40' : '#f0e8f5' }]}>
                <Ionicons name="people" size={18} color={t.parme} />
              </View>
              <View>
                <Text style={[s.settingLabel, { color: t.text }]}>Mes amis</Text>
                <Text style={[s.settingDesc, { color: t.textMuted }]}>
                  {pendingFriends > 0
                    ? `${pendingFriends} demande${pendingFriends > 1 ? 's' : ''} en attente`
                    : 'Retrouvez vos compagnons de voyage'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.parme} />
          </View>
        </TouchableOpacity>

        {/* Apparence */}
        <View style={[s.card, { backgroundColor: t.white, borderColor: t.border }]}>
          <Text style={[s.sectionTitle, { color: t.text }]}>Apparence</Text>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: isDark ? '#2e1a40' : '#f0e8f5' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={t.parme} />
              </View>
              <View>
                <Text style={[s.settingLabel, { color: t.text }]}>Mode sombre</Text>
                <Text style={[s.settingDesc, { color: t.textMuted }]}>{isDark ? 'Activé' : 'Désactivé'}</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              thumbColor={isDark ? t.parme : '#f4f4f4'}
              trackColor={{ false: t.border, true: t.parmeLight }}
            />
          </View>
        </View>

        {/* Change password */}
        <View style={[s.card, { backgroundColor: t.white, borderColor: t.border }]}>
          <Text style={[s.sectionTitle, { color: t.text }]}>Changer le mot de passe</Text>

          {['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer'].map((label, i) => {
            const key = ['currentPassword', 'newPassword', 'confirm'][i];
            return (
              <View key={key}>
                <Text style={[s.label, { color: t.text }]}>{label}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: t.inputBg, color: t.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={t.textMuted}
                  secureTextEntry
                  value={pwdForm[key]}
                  onChangeText={v => setPwdForm(f => ({ ...f, [key]: v }))}
                />
              </View>
            );
          })}

          {pwdMsg && (
            <Text style={[s.msg, { color: pwdMsg.type === 'success' ? '#16a34a' : t.error }]}>
              {pwdMsg.text}
            </Text>
          )}

          <TouchableOpacity
            style={[s.btn, { backgroundColor: t.parme }, savingPwd && { opacity: 0.6 }]}
            onPress={handleChangePwd}
            disabled={savingPwd}
          >
            {savingPwd
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.btnText}>Modifier le mot de passe</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[s.logoutBtn, { borderColor: t.border, backgroundColor: t.white }]}
          onPress={handleLogout}
        >
          <Text style={[s.logoutText, { color: t.textMuted }]}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={[s.card, s.dangerCard]}>
          <Text style={s.dangerTitle}>Zone dangereuse</Text>
          <Text style={[s.dangerText, { color: t.textMuted }]}>
            La suppression de votre compte est définitive. Tous vos articles, commentaires et likes seront effacés.
          </Text>
          <TouchableOpacity
            style={s.dangerBtn}
            onPress={() => { setDeleteModal(true); setDeletePwd(''); }}
          >
            <Text style={s.dangerBtnText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Delete account modal */}
      {deleteModal && (
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: t.white }]}>
            <Text style={s.modalTitle}>Confirmer la suppression</Text>
            <Text style={[s.modalText, { color: t.textMuted }]}>
              Cette action est irréversible. Entrez votre mot de passe pour confirmer.
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: t.inputBg, color: t.text }]}
              placeholder="Mot de passe"
              placeholderTextColor={t.textMuted}
              secureTextEntry
              autoFocus
              value={deletePwd}
              onChangeText={setDeletePwd}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: t.border }]}
                onPress={() => setDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={[s.cancelBtnText, { color: t.textMuted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dangerBtn, { flex: 1 }, deleting && { opacity: 0.6 }]}
                onPress={handleDeleteAccount}
                disabled={deleting || !deletePwd}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.dangerBtnText}>Confirmer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1 },
  scroll:    { padding: 16, gap: 14 },
  pageTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 26, marginBottom: 4 },

  card: { borderRadius: 20, padding: 18, gap: 10, borderWidth: 1,
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  avatarCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 22, color: '#fff' },
  userName:     { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16 },
  userEmail:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13 },
  userPseudo:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13 },
  sectionTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16 },

  settingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingLabel:{ fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14 },
  settingDesc: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, marginTop: 1 },

  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
           fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular' },
  msg:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13 },

  btn:     { borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: '#fff' },

  logoutBtn:  { borderWidth: 1.5, borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  logoutText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14 },

  dangerCard:    { borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  dangerTitle:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: '#dc2626' },
  dangerText:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13 },
  dangerBtn:     { backgroundColor: '#dc2626', borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: '#fff' },

  modalOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                  justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:    { borderRadius: 24, padding: 24, width: '100%', gap: 14 },
  modalTitle:   { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: '#dc2626' },
  modalText:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14 },
});

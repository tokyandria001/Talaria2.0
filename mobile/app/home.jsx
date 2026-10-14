import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.logo}>Talaria</Text>
      <Text style={styles.welcome}>
        Bonjour{user?.firstName ? `, ${user.firstName}` : ''} 👋
      </Text>
      <Text style={styles.sub}>L'app mobile est en cours de développement.</Text>
      <TouchableOpacity style={styles.btn} onPress={handleLogout}>
        <Text style={styles.btnText}>Se déconnecter</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.sableLune, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 32, color: Colors.parme, marginBottom: 24 },
  welcome: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, color: Colors.text, marginBottom: 10 },
  sub:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, marginBottom: 32, textAlign: 'center' },
  btn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, color: Colors.white },
});

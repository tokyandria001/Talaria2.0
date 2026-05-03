import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.parme }}>
      <ActivityIndicator color={Colors.white} size="large" />
    </View>
  );
  return user ? <Redirect href="/(tabs)/community" /> : <Redirect href="/onboarding" />;
}

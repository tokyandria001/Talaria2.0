import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import { isProfileComplete, skipKey } from '../constants/Preferences';

export default function Index() {
  const { user, loading } = useAuth();
  const [skipped, setSkipped] = useState(null); // null = pas encore lu

  useEffect(() => {
    if (!user) return;
    SecureStore.getItemAsync(skipKey(user.id))
      .then(v => setSkipped(v === '1'))
      .catch(() => setSkipped(false));
  }, [user]);

  if (loading || (user && skipped === null)) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.parme }}>
      <ActivityIndicator color={Colors.white} size="large" />
    </View>
  );
  if (!user) return <Redirect href="/onboarding" />;
  if (!isProfileComplete(user) && !skipped) return <Redirect href="/complete-profile" />;
  return <Redirect href="/(tabs)/home" />;
}

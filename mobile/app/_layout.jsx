import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Colors } from '../constants/Colors';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.parme }}>
        <ActivityIndicator color={Colors.white} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index"      options={{ animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="welcome"    options={{ animation: 'fade' }} />
            <Stack.Screen name="login"      options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="register"   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="(tabs)"     options={{ animation: 'fade' }} />
            <Stack.Screen name="cgu"        options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="privacy"       options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="friends"       options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="complete-profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="profile-setup" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="new-trip"      options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="trip/[id]"     options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="trip-map/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="planning/[id]" options={{ animation: 'slide_from_right' }} />
          </Stack>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

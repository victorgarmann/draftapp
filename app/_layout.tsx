import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { requestNotificationPermissions } from '@/services/notification.service';
import { T } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading, user } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  useEffect(() => {
    if (!isLoading && user) {
      requestNotificationPermissions();
    }
  }, [isLoading, user]);

  if (!fontsLoaded) return null;

  const stackHeaderStyle = {
    headerShown: true as const,
    headerStyle: { backgroundColor: T.bgGradientStart },
    headerTintColor: T.accentLight,
    headerTitleStyle: { color: T.text, fontFamily: 'Fredoka_600SemiBold' },
    headerBackTitle: 'Back',
    title: '',
  };

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="group" options={stackHeaderStyle} />
        <Stack.Screen name="draft" options={stackHeaderStyle} />
        <Stack.Screen name="join" options={{ ...stackHeaderStyle, title: 'Joining Group' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

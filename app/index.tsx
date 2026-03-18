import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // Splash screen is still visible — render nothing
    return <View style={{ flex: 1 }} />;
  }

  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/login'} />;
}

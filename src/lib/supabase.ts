import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import secureStoreAdapter from './secure-store-adapter';
import env from '../config/env';

// Use SecureStore (Keychain) on native, localStorage on web.
// AsyncStorage triggers file I/O that throws NSException on iOS 26.
const storage =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.localStorage
      : undefined
    : secureStoreAdapter;

export const supabase = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import env from '../config/env';

const firebaseConfig = env.firebase;

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Use initializeAuth with AsyncStorage persistence so sessions survive app restarts.
// Wrap in try/catch: initializeAuth throws if called twice (e.g. during hot reload).
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export default app;

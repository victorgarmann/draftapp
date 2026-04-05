import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import secureStoreAdapter from './secure-store-adapter';
import env from '../config/env';

const firebaseConfig = env.firebase;

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Use SecureStore (Keychain) for persistence — avoids AsyncStorage file I/O
// which throws NSException on iOS 26 via the old bridge dispatch path.
// Wrap in try/catch: initializeAuth throws if called twice (e.g. during hot reload).
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(secureStoreAdapter),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export default app;

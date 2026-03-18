// Web-compatible Firebase initialisation — uses browser persistence instead of AsyncStorage
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import env from '../config/env';

const app = getApps().length === 0
  ? initializeApp(env.firebase)
  : getApps()[0];

// getAuth() defaults to browserLocalPersistence on web — no AsyncStorage needed
export const auth = getAuth(app);
export default app;

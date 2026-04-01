import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import env from '@/config/env';

// Google Sign-In native module removed — plugin not configured for this build.
// signInWithGoogle() will throw on native until re-integrated.
const GoogleSignin: null = null;

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  fcmToken: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SignUpParams {
  email: string;
  password: string;
  username: string;
}

interface SignInParams {
  email: string;
  password: string;
}

export async function signUp({ email, password, username }: SignUpParams) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await createProfile(credential.user.uid, username);
  } catch (err) {
    // Roll back the Firebase account so the user can try again
    await credential.user.delete();
    throw err;
  }
  return credential.user;
}

export async function signIn({ email, password }: SignInParams) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle() {
  let result;

  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    result = await signInWithPopup(auth, provider);
  } else {
    if (!GoogleSignin) throw new Error('Google Sign-In is not available on this device.');
    await GoogleSignin.hasPlayServices();
    const { data } = await GoogleSignin.signIn();
    const credential = GoogleAuthProvider.credential(data?.idToken ?? null);
    result = await signInWithCredential(auth, credential);
  }

  // Create profile if first sign-in
  const existing = await getProfile(result.user.uid);
  if (!existing) {
    const baseUsername = (result.user.displayName ?? result.user.email ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    await createProfile(result.user.uid, baseUsername);
  }

  return result.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return firebaseOnAuthStateChanged(auth, callback);
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    fcmToken: data.fcm_token,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateUsername(uid: string, username: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username, display_name: username })
    .eq('id', uid)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    fcmToken: data.fcm_token,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createProfile(uid: string, username: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: uid,
      username,
      display_name: username,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    fcmToken: data.fcm_token,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

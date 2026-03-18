import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  getProfile,
  updateUsername,
  type UserProfile,
} from '@/services/auth.service';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUp: (params: { email: string; password: string; username: string }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const p = await getProfile(firebaseUser.uid);
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signUp(params: { email: string; password: string; username: string }) {
    const firebaseUser = await authSignUp(params);
    const p = await getProfile(firebaseUser.uid);
    setUser(firebaseUser);
    setProfile(p);
  }

  async function signIn(params: { email: string; password: string }) {
    await authSignIn(params);
    // onAuthStateChanged will handle setting user/profile
  }

  async function signOut() {
    await authSignOut();
    // onAuthStateChanged will handle clearing user/profile
  }

  async function updateProfileFn(username: string) {
    if (!user) return;
    const updated = await updateUsername(user.uid, username);
    setProfile(updated);
  }

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signUp, signIn, signOut, updateProfile: updateProfileFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

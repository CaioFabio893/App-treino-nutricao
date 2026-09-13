"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "./firebase";
import { DEMO_MODE } from "./config";

interface AuthCtx {
  user: User | null;
  initializing: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** ID token atualizado do Firebase Auth (usado no header Authorization). */
  getToken: () => Promise<string>;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_USER = { uid: "demo-user", email: "demo@treino.app" } as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_MODE ? DEMO_USER : null);
  const [initializing, setInitializing] = useState(DEMO_MODE ? false : true);

  useEffect(() => {
    if (DEMO_MODE) {
      setInitializing(false);
      return;
    }
    if (!firebaseAuth) {
      setInitializing(false);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    if (DEMO_MODE) return DEMO_USER;
    if (!firebaseAuth) throw new Error("Firebase não configurado");
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, _password);
    return cred.user;
  }, []);

  const signup = useCallback(async (email: string, _password: string) => {
    if (DEMO_MODE) return DEMO_USER;
    if (!firebaseAuth) throw new Error("Firebase não configurado");
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, _password);
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    if (DEMO_MODE) {
      setUser(null);
      return;
    }
    if (firebaseAuth) await fbSignOut(firebaseAuth);
  }, []);

  const getToken = useCallback(async () => {
    if (DEMO_MODE) return "demo-token";
    if (!firebaseAuth || !firebaseAuth.currentUser) {
      throw new Error("Sem sessão ativa");
    }
    return await firebaseAuth.currentUser.getIdToken(true);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      initializing,
      configured: DEMO_MODE ? true : firebaseConfigured,
      login,
      signup,
      logout,
      getToken,
    }),
    [user, initializing, login, signup, logout, getToken]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
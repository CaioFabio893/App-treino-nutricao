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
import { getMe as apiGetMe } from "./api";
import type { Role, UserProfile } from "./types";

interface AuthCtx {
  user: User | null;
  initializing: boolean;
  configured: boolean;
  profile: UserProfile | null;
  role: Role;
  /** true quando o usuário logou mas ainda não tem perfil cadastrado. */
  needsProfile: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** ID token atualizado do Firebase Auth (usado no header Authorization). */
  getToken: () => Promise<string>;
  /** Modo demo: papel ativo ("nutritionist" | "student") para testes. */
  demoAs: "nutritionist" | "student";
  setDemoAs: (r: "nutritionist" | "student") => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_USER = { uid: "demo-user", email: "demo@treino.app" } as unknown as User;
const DEMO_STUDENT_USER = { uid: "student-joao", email: "joao@email.com" } as unknown as User;

const DEMO_NUTRITIONIST: UserProfile = {
  id: "demo-user",
  name: "Demo (Nutricionista)",
  email: "demo@treino.app",
  role: "nutritionist",
  status: "active",
};

const DEMO_STUDENT: UserProfile = {
  id: "student-joao",
  name: "João Silva",
  email: "joao@email.com",
  role: "student",
  nutritionistID: "demo-user",
  status: "active",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_MODE ? DEMO_USER : null);
  const [initializing, setInitializing] = useState(DEMO_MODE ? false : true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Modo demo: alterna entre ver o painel do nutricionista e a visão do aluno.
  const [demoAs, setDemoAs] = useState<"nutritionist" | "student">("nutritionist");

  const refreshProfile = useCallback(async () => {
    try {
      let token: string;
      if (DEMO_MODE) {
        token = "demo-token";
      } else if (firebaseAuth?.currentUser) {
        token = await firebaseAuth.currentUser.getIdToken(true);
      } else {
        return;
      }
      const p = await apiGetMe(token);
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (DEMO_MODE) {
      // No modo demo simula o perfil de acordo com o papel ativo.
      setUser(demoAs === "student" ? DEMO_STUDENT_USER : DEMO_USER);
      setProfile(demoAs === "student" ? DEMO_STUDENT : DEMO_NUTRITIONIST);
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
  }, [demoAs]);

  // Quando o usuário loga, carrega o perfil (role) dele da API.
  useEffect(() => {
    if (!user || DEMO_MODE) return;
    void refreshProfile();
  }, [user, refreshProfile]);

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
      setProfile(null);
      return;
    }
    if (firebaseAuth) await fbSignOut(firebaseAuth);
    setProfile(null);
  }, []);

  const getToken = useCallback(async () => {
    if (DEMO_MODE) return "demo-token";
    if (!firebaseAuth || !firebaseAuth.currentUser) {
      throw new Error("Sem sessão ativa");
    }
    return await firebaseAuth.currentUser.getIdToken(true);
  }, []);

  // O role vem do perfil; em modo demo força "nutritionist".
  const role: Role = DEMO_MODE
    ? (profile?.role ?? "nutritionist")
    : (profile?.role ?? "student");

  const needsProfile = !DEMO_MODE && !!user && profile !== null && profile.needsProfile === true;

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      initializing,
      configured: DEMO_MODE ? true : firebaseConfigured,
      profile,
      role,
      needsProfile,
      refreshProfile,
      login,
      signup,
      logout,
      getToken,
      demoAs,
      setDemoAs,
    }),
    [user, initializing, profile, role, needsProfile, refreshProfile, login, signup, logout, getToken, demoAs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
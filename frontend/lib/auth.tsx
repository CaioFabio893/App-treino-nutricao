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
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured, googleProvider } from "./firebase";
import { DEMO_MODE } from "./config";
import { ApiError, getMe as apiGetMe } from "./api";
import type { Feature, Role, UserProfile } from "./types";

interface AuthCtx {
  user: User | null;
  initializing: boolean;
  configured: boolean;
  profile: UserProfile | null;
  role: Role;
  /** Feature do plano snapshotado no perfil (gate de UI; o backend valida). */
  features: Feature[];
  /** true quando o usuário logou mas ainda não tem perfil cadastrado. */
  needsProfile: boolean;
  /** true quando o cadastro está pendente de aprovação ou foi recusado. */
  needsApproval: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  /** Login com conta Google (popup). Cadastro novo entra como pending_approval. */
  loginWithGoogle: () => Promise<User>;
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
    } catch (err) {
      // Sessão expirada/inválida (401): desloga para não deixar o usuário em
      // estado inconsistente (role errado, telas de "sem acesso").
      if (!DEMO_MODE && err instanceof ApiError && err.status === 401) {
        if (firebaseAuth) await fbSignOut(firebaseAuth);
        setUser(null);
        setProfile(null);
      }
      // Falhas transitórias (rede, timeout, 5xx): mantém o perfil atual em
      // vez de apagá-lo — evita "piscar" o usuário entre papéis por um erro
      // momentâneo de conexão.
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

  const loginWithGoogle = useCallback(async () => {
    if (DEMO_MODE) return DEMO_USER;
    if (!firebaseAuth || !googleProvider) throw new Error("Firebase não configurado");
    // Popup de conta Google. O usuário cai no fluxo normal: perfil novo →
    // GET /api/me devolve needsProfile → criado com status pending_approval.
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
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
    if (DEMO_MODE) {
      // No modo demo o token carrega a identidade ativa ("demo:student-joao"
      // ou "demo:demo-user") para que a API demo atribua posts/likes/ranking
      // ao papel realmente simulado — mesmo mecanismo do token JWT real.
      return `demo:${profile?.id ?? "demo-user"}`;
    }
    if (!firebaseAuth || !firebaseAuth.currentUser) {
      throw new Error("Sem sessão ativa");
    }
    return await firebaseAuth.currentUser.getIdToken(true);
  }, [profile]);

  // O role vem do perfil; em modo demo força "nutritionist".
  const role: Role = DEMO_MODE
    ? (profile?.role ?? "nutritionist")
    : (profile?.role ?? "student");

  // Feature snapshotada no perfil (plano atribuído pelo admin).
  const features: Feature[] = useMemo(() => profile?.features ?? [], [profile]);

  const needsProfile = !DEMO_MODE && !!user && profile !== null && profile.needsProfile === true;

  // Cadastro pendente ou recusado → tela de espera/recusa em vez do app.
  // ADMIN nunca é enviado para a tela de aprovação: mesmo com status legado
  // ou incorreto (pending_approval/rejected), ele precisa chegar ao painel
  // para gerenciar a fila de aprovação.
  const needsApproval =
    !DEMO_MODE &&
    !!user &&
    !!profile &&
    role !== "admin" &&
    (profile.status === "pending_approval" || profile.status === "rejected");

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      initializing,
      configured: DEMO_MODE ? true : firebaseConfigured,
      profile,
      role,
      features,
      needsProfile,
      needsApproval,
      refreshProfile,
      login,
      signup,
      loginWithGoogle,
      logout,
      getToken,
      demoAs,
      setDemoAs,
    }),
    [user, initializing, profile, role, features, needsProfile, needsApproval, refreshProfile, login, signup, loginWithGoogle, logout, getToken, demoAs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
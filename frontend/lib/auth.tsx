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
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "./firebase";
import { ApiError, getMe as apiGetMe } from "./api";
import type { Role, UserProfile } from "./types";
import { canReadBusiness } from "./profileAccess";

interface AuthCtx {
  user: User | null;
  initializing: boolean;
  /** true quando o perfil (role/status) já foi carregado (ou falhou)
   *  para o usuário atual. Evita que guards decidam redirect com o role
   *  default "student" antes de o GET /api/me responder (deep-link). */
  profileLoaded: boolean;
  configured: boolean;
  profile: UserProfile | null;
  role: Role;
  /** true quando o usuário logou mas ainda não tem perfil cadastrado. */
  needsProfile: boolean;
  /** true quando o perfil ainda não tem acesso de negócio (pendente/recusado/bloqueado). */
  needsApproval: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  /** Envia o e-mail oficial de redefinição de senha (Firebase Auth). */
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /** ID token atualizado do Firebase Auth (usado no header Authorization). */
  getToken: () => Promise<string>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      let token: string;
      if (firebaseAuth?.currentUser) {
        token = await firebaseAuth.currentUser.getIdToken(true);
      } else {
        return;
      }
      const p = await apiGetMe(token);
      setProfile(p);
    } catch (err) {
      // Sessão expirada/inválida (401): desloga para não deixar o usuário em
      // estado inconsistente (role errado, telas de "sem acesso").
      if (err instanceof ApiError && err.status === 401) {
        if (firebaseAuth) await fbSignOut(firebaseAuth);
        setUser(null);
        setProfile(null);
      }
      // Falhas transitórias (rede, timeout, 5xx): mantém o perfil atual em
      // vez de apagá-lo — evita "piscar" o usuário entre papéis por um erro
      // momentâneo de conexão.
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      setInitializing(false);
      setProfileLoaded(true);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  // Quando o usuário loga, carrega o perfil (role) dele da API.
  useEffect(() => {
    if (!user) return;
    void refreshProfile();
  }, [user, refreshProfile]);

  const login = useCallback(async (email: string, _password: string) => {
    if (!firebaseAuth) throw new Error("Firebase não configurado");
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, _password);
    return cred.user;
  }, []);

  const signup = useCallback(async (email: string, _password: string) => {
    if (!firebaseAuth) throw new Error("Firebase não configurado");
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, _password);
    return cred.user;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!firebaseAuth) throw new Error("Firebase não configurado");
    await sendPasswordResetEmail(firebaseAuth, email);
  }, []);

  const logout = useCallback(async () => {
    if (firebaseAuth) await fbSignOut(firebaseAuth);
    setProfile(null);
  }, []);

  const getToken = useCallback(async () => {
    if (!firebaseAuth || !firebaseAuth.currentUser) {
      throw new Error("Sem sessão ativa");
    }
    return await firebaseAuth.currentUser.getIdToken(true);
  }, []);

  // O role vem do perfil.
  const role: Role = profile?.role ?? "student";

  const needsProfile = !!user && profile !== null && profile.needsProfile === true;

  // Cadastro sem acesso de negócio → tela de espera, recusa ou suspensão.
  // ADMIN nunca é enviado para a tela de aprovação: mesmo com status legado
  // ou incorreto (pending_approval/rejected), ele precisa chegar ao painel
  // para gerenciar a fila de aprovação.
  const needsApproval =
    !!user &&
    !!profile &&
    !canReadBusiness(profile);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      initializing,
      profileLoaded,
      configured: firebaseConfigured,
      profile,
      role,
      needsProfile,
      needsApproval,
      refreshProfile,
      login,
      signup,
      resetPassword,
      logout,
      getToken,
    }),
    [user, initializing, profileLoaded, profile, role, needsProfile, needsApproval, refreshProfile, login, signup, resetPassword, logout, getToken]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

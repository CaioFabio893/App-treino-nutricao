"use client";

// Inicialização do Firebase (lado do cliente).
// As variáveis NEXT_PUBLIC_FIREBASE_* vêm do arquivo frontend/.env.local.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;

export const firebaseAuth = app ? getAuth(app) : null;

// Suporte aos testes E2E locais: aponta o login para o Auth Emulator local.
// Só liga quando NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=1 está explícito (nunca
// em produção) — o Web SDK não lê FIREBASE_AUTH_EMULATOR_HOST no browser, por
// isso a flag explícita no bundle do cliente.
if (firebaseAuth && process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR === "1") {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
}

// Provider de login com Google (usuários de telefone). Usado no botão
// "Entrar com Google" da tela de login e no fluxo de cadastro novo.
export const googleProvider = app ? new GoogleAuthProvider() : null;
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import ProfileSetup from "@/components/ProfileSetup";
import PendingApproval from "@/components/PendingApproval";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";

export default function Home() {
  const { user, initializing, profileLoaded, configured, role, needsProfile, needsApproval } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !profileLoaded) return;
    if (!initializing && !configured) return;
    if (!initializing && !user) router.replace("/login");
    // Cadastro pendente: a tela de espera cuida do usuário (e do auto-redirect
    // quando o admin aprovar) — nenhum redirect de papel deve disparar antes.
    if (!initializing && user && !needsProfile && !needsApproval && (role === "admin")) {
      router.replace("/admin");
    }
    // Alunos aprovados vão para o dashboard da área do aluno (rota própria).
    if (!initializing && user && !needsProfile && !needsApproval && role === "student") {
      router.replace("/dashboard");
    }
  }, [initializing, profileLoaded, user, configured, role, needsProfile, needsApproval, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing || (user && !profileLoaded)) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  // Usuário sem perfil configurado → monta o cadastro (nome).
  if (needsProfile) return <ProfileSetup />;
  // Cadastro enviado, aguardando liberação da equipe.
  if (needsApproval) return <PendingApproval />;
  // Aguarda o redirect acima (aluno → /treinos; gestão → /admin).
  return <LoadingScreen />;
}

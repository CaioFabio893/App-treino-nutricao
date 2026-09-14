"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import ProfileSetup from "@/components/ProfileSetup";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";

export default function Home() {
  const { user, initializing, configured, role, needsProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !configured) return;
    if (!initializing && !user) router.replace("/login");
    // Nutricionistas e admins vão para o painel de gestão.
    if (!initializing && user && !needsProfile && (role === "nutritionist" || role === "admin")) {
      router.replace("/nutritionist");
    }
    // Alunos vão para a primeira aba da área do aluno (rota própria).
    if (!initializing && user && !needsProfile && role === "student") {
      router.replace("/treinos");
    }
  }, [initializing, user, configured, role, needsProfile, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  // Usuário sem perfil configurado.
  if (needsProfile) return <ProfileSetup />;
  // Aguarda o redirect acima (aluno → /treinos; gestão → /nutritionist).
  return <LoadingScreen />;
}
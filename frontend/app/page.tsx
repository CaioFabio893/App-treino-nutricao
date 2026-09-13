"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import StudentDashboard from "@/components/StudentDashboard";
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
  }, [initializing, user, configured, role, needsProfile, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  // Usuário sem perfil configurado.
  if (needsProfile) return <ProfileSetup />;
  // Alunos veem o treino de hoje + dieta.
  return <StudentDashboard />;
}

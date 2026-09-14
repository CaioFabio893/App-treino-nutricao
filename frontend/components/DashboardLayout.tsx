"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Sidebar, { sectionLabelFor } from "@/components/Sidebar";

/**
 * Layout compartilhado do painel (admin/nutricionista).
 * Faz o guarda de acesso por papel e renderiza sidebar + topbar + conteúdo
 * dentro do escopo .dashboard. Cada layout de rota só informa os papéis
 * permitidos via `allowedRoles`.
 */
export default function DashboardLayout({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, initializing, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const roleOk = !!role && allowedRoles.includes(role);

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (!roleOk) router.replace("/");
  }, [initializing, user, roleOk, router]);

  if (initializing || !user || !roleOk) {
    return <LoadingScreen />;
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <div className="dash-content">
        <header className="dash-topbar no-print">
          <div className="dash-topbar-title">{sectionLabelFor(pathname)}</div>
          <button type="button" className="dash-topbar-logout" onClick={() => void logout()}>
            Sair
          </button>
        </header>
        <main className="nut-main">{children}</main>
      </div>
    </div>
  );
}
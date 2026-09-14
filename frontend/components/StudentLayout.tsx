"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Logo from "./Logo";
import DashIcon from "./DashIcon";

// Navegação inferior do aluno (rotas reais, não abas em estado local).
const NAV_ITEMS = [
  { href: "/treinos", label: "Treinos", icon: "dumbbell" as const },
  { href: "/dietas", label: "Dietas", icon: "leaf" as const },
  { href: "/comunidade", label: "Comunidade", icon: "feed" as const },
];

/**
 * Shell de layout da área do aluno: topbar com logo + nome + sair,
 * conteúdo centralizado (mesmo respiro do painel) e bottom nav fixa
 * com ícones SVG no mesmo estilo do DashIcon do nutricionista.
 * Também faz o guarda de acesso: sem login → /login; papel de gestão → /nutritionist.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, role, profile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isStaff = role === "nutritionist" || role === "admin";

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (isStaff) router.replace("/nutritionist");
  }, [initializing, user, isStaff, router]);

  if (initializing || !user || isStaff) {
    return <LoadingScreen />;
  }

  return (
    <div className="stu-shell">
      <header className="stu-topbar">
        <div className="logo-wrap">
          <Logo />
          <div className="logo-text">
            {profile?.name || "Aluno"}
            <span>Seu espaço</span>
          </div>
        </div>
        <button type="button" className="stu-topbar-logout" onClick={() => void logout()}>
          Sair
        </button>
      </header>

      <main className="stu-main">{children}</main>

      <nav className="stu-nav" aria-label="Seções do aluno">
        <div className="stu-nav-inner">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`stu-nav-link${active ? " active" : ""}`}
              >
                <DashIcon name={item.icon} size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
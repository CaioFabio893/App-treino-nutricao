"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Logo from "./Logo";
import DashIcon from "./DashIcon";
import type { Feature } from "@/lib/types";

// Navegação inferior do aluno (rotas reais, não abas em estado local).
// Treinos é o tier gratuito (sem feature de plano); Dietas e Comunidade
// dependem das features snapshotadas no perfil. O backend também valida.
const NAV_ITEMS: { href: string; label: string; icon: "dumbbell" | "leaf" | "feed"; feature?: Feature }[] = [
  { href: "/treinos", label: "Treinos", icon: "dumbbell" },
  { href: "/dietas", label: "Dietas", icon: "leaf", feature: "diet" },
  { href: "/comunidade", label: "Comunidade", icon: "feed", feature: "community" },
];

/**
 * Shell de layout da área do aluno: topbar com logo + nome + sair,
 * conteúdo centralizado (mesmo respiro do painel) e bottom nav fixa
 * com ícones SVG no mesmo estilo do DashIcon do nutricionista.
 * Também faz o guarda de acesso: sem login → /login; nutricionista → /nutritionist;
 * cadastro ainda não aprovado → volta pra raiz (que mostra a tela de espera).
 * Admins NÃO são redirecionados: podem navegar pela área do aluno (o seletor
 * de áreas do admin permite voltar ao painel quando quiser).
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, role, profile, needsApproval, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Apenas nutricionistas (não-admin) são expulsos da área do aluno.
  const isStaff = role === "nutritionist";
  // Admin/preview enxerga todas as seções; aluno vê só as do plano dele.
  const staffView = role === "admin" || role === "nutritionist";
  const features = profile?.features ?? [];
  const items = staffView
    ? NAV_ITEMS
    : NAV_ITEMS.filter((i) => (i.feature ? features.includes(i.feature) : true));

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (isStaff) router.replace("/nutritionist");
    else if (needsApproval) router.replace("/");
  }, [initializing, user, isStaff, needsApproval, router]);

  if (initializing || !user || isStaff || needsApproval) {
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
          {items.map((item) => {
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
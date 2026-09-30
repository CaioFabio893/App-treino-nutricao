"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Logo from "./Logo";
import DashIcon from "./DashIcon";
import { navAppIcons } from "./icons/AppIcons";
import type { Feature } from "@/lib/types";

// Navegação inferior do aluno (rotas reais, não abas em estado local).
// Programa é o tier gratuito (agrupa os treinos atribuídos, sem feature de
// plano); Treinos mostra o dia a dia; Dietas e Comunidade dependem das features
// snapshotadas no perfil. O backend também valida.
const NAV_ITEMS: { href: string; label: string; icon: "grid" | "dumbbell" | "program" | "leaf" | "feed"; feature?: Feature }[] = [
  { href: "/dashboard", label: "Início", icon: "grid" },
  { href: "/programas", label: "Programa", icon: "program" },
  { href: "/treinos", label: "Treinos", icon: "dumbbell" },
  { href: "/dietas", label: "Dietas", icon: "leaf", feature: "diet" },
];

// Guarda de rota: prefixo → feature exigida para o aluno acessar aquela página.
// Sem a feature no plano, redireciona para o dashboard. Admin/preview ignora.
const PATH_FEATURES: { prefix: string; feature: Feature }[] = [
  { prefix: "/dietas", feature: "diet" },
];

/**
 * Shell de layout da área do aluno: topbar com logo + nome + sair,
 * conteúdo centralizado (mesmo respiro do painel) e bottom nav fixa
 * com ícones SVG no mesmo estilo do DashIcon do nutricionista.
 * Também faz o guarda de acesso: sem login → /login; nutricionista → /admin;
 * cadastro ainda não aprovado → volta pra raiz (que mostra a tela de espera).
 * Admins NÃO são redirecionados: podem navegar pela área do aluno (o seletor
 * de áreas do admin permite voltar ao painel quando quiser).
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, role, profile, needsApproval, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // No modelo de 2 papeis nao existe staff "nao-admin" a ser expulso daqui: o
  // admin navega pela area do aluno (seletor de areas) e pula a guarda de
  // feature, enquanto o aluno e governado pelo plano dele.
  const staffView = role === "admin";
  const features = useMemo(() => profile?.features ?? [], [profile]);
  const items = staffView
    ? NAV_ITEMS
    : NAV_ITEMS.filter((i) => (i.feature ? features.includes(i.feature) : true));

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (needsApproval) router.replace("/");
  }, [initializing, user, needsApproval, router]);

  // Guarda de feature no cliente: aluno tentando abrir rota cujo módulo não
  // está no plano dele volta para o dashboard (o backend também devolve 403).
  // Staff (admin/admin) pula a guarda: admin pode navegar pela área do
  // aluno mesmo sem features no perfil (seletor de áreas do admin).
  useEffect(() => {
    if (initializing || !user || staffView || needsApproval) return;
    const required = PATH_FEATURES.find((p) => pathname.startsWith(p.prefix))?.feature;
    if (required && !features.includes(required)) {
      router.replace("/dashboard");
    }
  }, [initializing, user, staffView, needsApproval, pathname, features, router]);

  if (initializing || !user || needsApproval) {
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
            const AppIcon = navAppIcons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`stu-nav-link${active ? " active" : ""}`}
              >
                {AppIcon ? <AppIcon width={20} height={20} /> : <DashIcon name={item.icon} size={20} />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

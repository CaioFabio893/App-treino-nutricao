"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import Logo from "./Logo";
import DashIcon from "./DashIcon";
import { navAppIcons } from "./icons/AppIcons";

// Navegação inferior do aluno (rotas reais, não abas em estado local).
// Área única de Treino (programas completos) e Dieta para alunos aprovados.
const NAV_ITEMS: { href: string; label: string; icon: "grid" | "dumbbell" | "program" | "leaf" | "feed" }[] = [
  { href: "/dashboard", label: "Início", icon: "grid" },
  { href: "/treinos", label: "Treino", icon: "dumbbell" },
  { href: "/dietas", label: "Dieta", icon: "leaf" },
  { href: "/receitas", label: "Receitas", icon: "leaf" },
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
  const { user, initializing, profile, needsApproval, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const items = NAV_ITEMS;

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (needsApproval) router.replace("/");
  }, [initializing, user, needsApproval, router]);


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

      <main className="stu-main">
        <a className="stu-checkin" href="https://forms.gle/7E8rybhNQEbnqpTe8" target="_blank" rel="noopener noreferrer">
          <span className="stu-checkin-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="5" rx="1.5"/><path d="m8 14 3 3 5-6"/></svg></span>
          <span className="stu-checkin-copy"><strong>Check-in Diário</strong><small>Responda hoje e mantenha a Louise por dentro.</small></span>
          <span className="stu-checkin-action">Responder agora <span aria-hidden="true">↗</span></span>
        </a>
        {children}
      </main>

      <nav className="stu-nav" aria-label="Seções do aluno">
        <div className="stu-nav-inner">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

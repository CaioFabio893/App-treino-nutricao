"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import DashIcon from "./DashIcon";
import { navAppIcons } from "./icons/AppIcons";

export const NAV_ITEMS = [
  { href: "/admin", label: "Painel", icon: "grid" as const },
  { href: "/admin/students", label: "Alunos", icon: "users" as const },
  { href: "/admin/programs", label: "Programas", icon: "program" as const },
  { href: "/admin/workouts", label: "Treinos", icon: "dumbbell" as const },
  { href: "/admin/exercises", label: "Exercícios", icon: "library" as const },
  { href: "/admin/diets", label: "Dietas", icon: "leaf" as const },
  { href: "/admin/feed", label: "Feed", icon: "feed" as const },
  { href: "/admin/activities", label: "Atividades", icon: "activity" as const },
  { href: "/admin/profile", label: "Perfil", icon: "user" as const },
];

// Gestão é uma área só (/admin). "Usuários" é a sub-rota de cadastro/planos e
// entra na lista apenas para admin — o resto já é reachable por ele.
const ADMIN_ITEM = { href: "/admin/usuarios", label: "Usuários", icon: "shield" as const };

function isActive(pathname: string, href: string) {
  // /admin é a raiz da área: casamento exato, senão TODO subdiretório marcaria
  // "Painel" como ativo ao mesmo tempo que a sua própria entrada.
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Título da seção atual, usado no topo do conteúdo (topbar). */
export function sectionLabelFor(pathname: string): string {
  const item = [...NAV_ITEMS, ADMIN_ITEM].find((i) => isActive(pathname, i.href));
  return item?.label ?? "Painel";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { role, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const items = role === "admin" ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
  const initial = (profile?.name || "?").charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        className="dash-burger no-print"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
      >
        <DashIcon name="menu" />
      </button>

      {open && (
        <div className="dash-overlay no-print" onClick={() => setOpen(false)} />
      )}

      <aside className={`dash-sidebar no-print${open ? " open" : ""}`}>
        <div className="dash-brand">
          <div className="dash-brand-mark">LL</div>
          <div className="dash-brand-text">
            Louise Lima
            <span>Treino &amp; Nutrição</span>
          </div>
          <button
            type="button"
            className="dash-sidebar-close"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          >
            <DashIcon name="close" size={16} />
          </button>
        </div>

        <nav className="dash-nav">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const AppIcon = navAppIcons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dash-nav-link${active ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {AppIcon ? <AppIcon width={18} height={18} /> : <DashIcon name={item.icon} />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-user">
            <div className="dash-user-avatar">{initial}</div>
            <div className="dash-user-info">
              <div className="dash-user-name">{profile?.name || "Usuário"}</div>
              <div className="dash-user-role">Admin</div>
            </div>
          </div>
          <button type="button" className="dash-logout" onClick={() => void logout()}>
            <DashIcon name="logout" size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

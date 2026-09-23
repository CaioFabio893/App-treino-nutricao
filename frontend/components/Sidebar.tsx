"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useNewCompletions } from "@/lib/useNewCompletions";
import DashIcon from "./DashIcon";
import { navAppIcons } from "./icons/AppIcons";

export const NAV_ITEMS = [
  { href: "/nutritionist", label: "Painel", icon: "grid" as const },
  { href: "/nutritionist/students", label: "Alunos", icon: "users" as const },
  { href: "/nutritionist/workouts", label: "Treinos", icon: "dumbbell" as const },
  { href: "/nutritionist/exercises", label: "Exercícios", icon: "library" as const },
  { href: "/nutritionist/diets", label: "Dietas", icon: "leaf" as const },
  { href: "/nutritionist/feed", label: "Feed", icon: "feed" as const },
  { href: "/nutritionist/ranking", label: "Ranking", icon: "trophy" as const },
  { href: "/nutritionist/timeline", label: "Timeline", icon: "clock" as const, notif: true },
  { href: "/nutritionist/activities", label: "Atividades", icon: "activity" as const },
  { href: "/nutritionist/profile", label: "Perfil", icon: "user" as const },
];

const ADMIN_ITEM = { href: "/admin", label: "Usuários", icon: "shield" as const };

function isActive(pathname: string, href: string) {
  return href === "/nutritionist" ? pathname === "/nutritionist" : pathname.startsWith(href);
}

/** Título da seção atual, usado no topo do conteúdo (topbar). */
export function sectionLabelFor(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Usuários";
  const item = NAV_ITEMS.find((i) => isActive(pathname, i.href));
  return item?.label ?? "Painel";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { role, profile, logout } = useAuth();
  const { count, consume } = useNewCompletions();
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
                onClick={() => {
                  setOpen(false);
                  if (item.href === "/nutritionist/timeline" && count > 0) consume();
                }}
              >
                {AppIcon ? <AppIcon width={18} height={18} /> : <DashIcon name={item.icon} />}
                <span>{item.label}</span>
                {item.href === "/nutritionist/timeline" && count > 0 && (
                  <span className="dash-nav-badge" title="Novos treinos concluídos">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-user">
            <div className="dash-user-avatar">{initial}</div>
            <div className="dash-user-info">
              <div className="dash-user-name">{profile?.name || "Usuário"}</div>
              <div className="dash-user-role">
                {role === "admin" ? "Admin" : "Nutricionista"}
              </div>
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

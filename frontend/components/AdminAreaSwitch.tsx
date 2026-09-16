"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Botão flutuante de ADMIN para alternar entre as áreas do app:
 * - Aluno  → área do aluno (/treinos, /dietas, /comunidade)
 * - Gestão → painel do nutricionista (dashboard)
 * - Admin  → administração (usuários)
 * Só aparece para usuários com role=admin (que têm acesso a tudo no backend).
 */
export default function AdminAreaSwitch() {
  const { role, initializing } = useAuth();
  const pathname = usePathname();

  if (initializing || role !== "admin") return null;

  const areas = [
    { href: "/treinos", label: "Aluno" },
    { href: "/nutritionist", label: "Gestão" },
    { href: "/admin", label: "Admin" },
  ];

  const isStudentPath =
    pathname === "/" ||
    pathname.startsWith("/treinos") ||
    pathname.startsWith("/dietas") ||
    pathname.startsWith("/comunidade") ||
    pathname.startsWith("/profile/");

  const isActiveArea = (href: string) => {
    if (href === "/treinos") return isStudentPath;
    if (href === "/nutritionist") return pathname.startsWith("/nutritionist");
    return pathname.startsWith("/admin");
  };

  return (
    <nav aria-label="Alternar entre áreas" className="admin-areas no-print">
      {areas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`admin-areas-btn${isActiveArea(a.href) ? " active" : ""}`}
          aria-current={isActiveArea(a.href) ? "page" : undefined}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
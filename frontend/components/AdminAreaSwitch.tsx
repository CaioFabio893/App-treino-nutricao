"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Botão flutuante de ADMIN para alternar entre as áreas do app:
 * - Aluno  -> área do aluno (/treinos, /dietas, /comunidade)
 * - Gestão -> painel operacional (/admin)
 * - Cadastro -> gestão de usuários e planos (/admin/usuarios)
 * Só aparece para role=admin (único papel com acesso a tudo no backend).
 */
export default function AdminAreaSwitch() {
  const { role, initializing } = useAuth();
  const pathname = usePathname();

  if (initializing || role !== "admin") return null;

  const areas = [
    { href: "/treinos", label: "Aluno" },
    { href: "/admin", label: "Gestão" },
    { href: "/admin/usuarios", label: "Cadastro" },
  ];

  const isStudentPath =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/treinos") ||
    pathname.startsWith("/dietas") ||
    pathname.startsWith("/comunidade") ||
    pathname.startsWith("/ranking") ||
    pathname.startsWith("/profile/");

  const isActiveArea = (href: string) => {
    if (href === "/treinos") return isStudentPath;
    // /admin é a raiz da área de gestão: casamento exato, senão a aba "Gestão"
    // ficaria ativa junto com "Cadastro" em toda sub-rota.
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
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

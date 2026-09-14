"use client";

import StudentLayout from "@/components/StudentLayout";

// Grupo de rota (aluno): URLs ficam limpas (/treinos, /dietas, /comunidade)
// e todas as páginas compartilham o StudentLayout (topbar + bottom nav).
export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>;
}
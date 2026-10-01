"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import DashIcon from "@/components/DashIcon";

// Treinos e dietas do aluno aprovado, sem plano de funcionalidades.
const SECTIONS: {
  href: string;
  title: string;
  desc: string;
  icon: "dumbbell" | "leaf";
}[] = [
  {
    href: "/treinos",
    title: "Treino",
    desc: "Seus treinos da semana, PRs e histórico",
    icon: "dumbbell",
  },
  {
    href: "/dietas",
    title: "Dieta",
    desc: "Seu plano alimentar e acompanhamento",
    icon: "leaf",
  },
  { href: "/receitas", title: "Receitas", desc: "Ideias e preparos para sua alimentação", icon: "leaf" },
];

/** Página inicial do aluno: boas-vindas + cards de treino e dieta. */
export default function StudentDashboard() {
  const { profile } = useAuth();

  const visible = SECTIONS;

  const firstName = profile?.name?.trim().split(/\s+/)[0] || "Aluno";
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Olá, {firstName} 👋</h1>
          <div className="page-sub" style={{ textTransform: "capitalize" }}>
            {hoje}
          </div>
        </div>
      </div>

      <div className="stu-dash-grid">
        {visible.map((s) => (
          <Link key={s.href} href={s.href} className="stu-dash-card">
            <span className="stu-dash-icon">
              <DashIcon name={s.icon} size={22} />
            </span>
            <span className="stu-dash-body">
              <span className="stu-dash-title">{s.title}</span>
              <span className="stu-dash-desc">{s.desc}</span>
            </span>
            <span className="stu-dash-arrow" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-box">
          Seu plano ainda não tem módulos liberados. Fale com seu nutricionista.
        </div>
      )}
    </div>
  );
}

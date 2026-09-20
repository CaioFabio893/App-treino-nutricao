"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import DashIcon from "@/components/DashIcon";
import type { Feature } from "@/lib/types";

// Cards do dashboard do aluno. Treinos é sempre liberado (tier gratuito);
// os demais aparecem somente se a feature estiver no plano snapshotado no
// perfil — gate de UI apenas, o backend também valida por rota.
const SECTIONS: {
  feature: Feature | null; // null = sempre visível
  href: string;
  title: string;
  desc: string;
  icon: "dumbbell" | "leaf" | "feed" | "trophy";
}[] = [
  {
    feature: null,
    href: "/treinos",
    title: "Treinos",
    desc: "Seus treinos da semana, PRs e histórico",
    icon: "dumbbell",
  },
  {
    feature: "diet",
    href: "/dietas",
    title: "Dietas",
    desc: "Seu plano alimentar e acompanhamento",
    icon: "leaf",
  },
  {
    feature: "community",
    href: "/comunidade",
    title: "Comunidade",
    desc: "Feed com outros alunos, posts e desafios",
    icon: "feed",
  },
  {
    feature: "ranking",
    href: "/ranking",
    title: "Ranking",
    desc: "Sua nota e posição no ciclo atual",
    icon: "trophy",
  },
];

/** Página inicial do aluno: boas-vindas + cards dos módulos liberados no plano. */
export default function StudentDashboard() {
  const { profile } = useAuth();
  const features = profile?.features ?? [];

  const visible = SECTIONS.filter(
    (s) => s.feature === null || features.includes(s.feature)
  );

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
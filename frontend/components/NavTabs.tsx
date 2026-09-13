"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNewCompletions } from "@/lib/useNewCompletions";

const NAV_ITEMS = [
  { href: "/nutritionist", label: "Dashboard" },
  { href: "/nutritionist/feed", label: "Feed" },
  { href: "/nutritionist/ranking", label: "Ranking" },
  { href: "/nutritionist/students", label: "Meus Alunos" },
  { href: "/nutritionist/workouts", label: "Treinos" },
  { href: "/nutritionist/diets", label: "Dietas" },
  { href: "/nutritionist/timeline", label: "Timeline" },
  { href: "/nutritionist/activities", label: "Atividades" },
  { href: "/nutritionist/profile", label: "Perfil" },
];

interface Props {
  currentPath: string;
}

export default function NavTabs({ currentPath }: Props) {
  const router = useRouter();
  const { count, consume } = useNewCompletions();

  return (
    <nav className="nut-nav">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/nutritionist"
            ? currentPath === "/nutritionist"
            : currentPath.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "active" : ""}
            onClick={
              item.href === "/nutritionist/timeline" && count > 0
                ? () => consume()
                : undefined
            }
          >
            {item.label}
            {item.href === "/nutritionist/timeline" && count > 0 && (
              <span className="nav-notif" title="Novos treinos concluídos desde a sua última visita">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
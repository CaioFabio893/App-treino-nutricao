import React from "react";

// Biblioteca central de ícones SVG de linha do app.
// Segue o mesmo padrão visual já usado no DashIcon (viewBox 24, `currentColor`
// e traço 1.8) para que o ícone acompanhe automaticamente a cor do contexto
// — links da sidebar, botões, estados vazios — sem introduzir novas cores.
type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function WorkoutIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6.5 6.5h11M6.5 17.5h11M2 10h20M2 14h20M4 6.5v11M20 6.5v11" />
    </svg>
  );
}

export function DietIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <path d="M15 2v20" />
      <path d="M6 2v10a3 3 0 0 0 3 3v7" />
    </svg>
  );
}

export function CommunityIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function RankingIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17h4v-2.34l2.67-2.67a4 4 0 0 0-5.34-5.34L10 12l-1.33-3a4 4 0 0 0-5.34 5.34L6 14.66z" />
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export function AchievementsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

export function NotificationsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Mapa dos nomes usados na navegação (Sidebar/bottom nav) para os ícones
// padronizados acima. Nomes sem equivalente continuam no DashIcon — o
// consumidor usa este mapa apenas como primeiro plano, com fallback.
export const navAppIcons: Record<
  string,
  React.ComponentType<IconProps> | undefined
> = {
  grid: DashboardIcon,
  dumbbell: WorkoutIcon,
  leaf: DietIcon,
  feed: CommunityIcon,
  trophy: RankingIcon,
  user: ProfileIcon,
};

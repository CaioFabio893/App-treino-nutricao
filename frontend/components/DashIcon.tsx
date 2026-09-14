// Ícones de linha minimalistas usados na barra lateral e no painel.
// Sem dependência externa — evita adicionar peso ao bundle por causa de
// um punhado de ícones simples.

interface Props {
  name:
    | "grid"
    | "users"
    | "dumbbell"
    | "leaf"
    | "feed"
    | "trophy"
    | "clock"
    | "activity"
    | "user"
    | "shield"
    | "logout"
    | "menu"
    | "close";
  size?: number;
}

export default function DashIcon({ name, size = 18 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
          <circle cx="17" cy="8.5" r="2.3" />
          <path d="M15 14.7c2.6.2 4.6 2.2 5 5.3" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg {...common}>
          <rect x="1.5" y="9.5" width="3" height="5" rx="0.8" />
          <rect x="19.5" y="9.5" width="3" height="5" rx="0.8" />
          <rect x="5.5" y="7.5" width="2.4" height="9" rx="0.8" />
          <rect x="16.1" y="7.5" width="2.4" height="9" rx="0.8" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M5 19c9 1 15-5 15-15C10 4 5 10 5 19z" />
          <path d="M6 18c3-4 6-7 12-12.5" />
        </svg>
      );
    case "feed":
      return (
        <svg {...common}>
          <path d="M4 5.5h16v10H9l-4 4v-4H4z" />
          <line x1="7.5" y1="9.5" x2="16.5" y2="9.5" />
          <line x1="7.5" y1="12.5" x2="13.5" y2="12.5" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <path d="M7 5.5H4a3 3 0 0 0 3.5 4.4" />
          <path d="M17 5.5h3a3 3 0 0 1-3.5 4.4" />
          <line x1="12" y1="14.5" x2="12" y2="18" />
          <path d="M8.5 20h7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.3" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "activity":
      return (
        <svg {...common}>
          <path d="M3 12h3.5l2-6 4 12 2-9 1.5 3H21" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.8 20c0-4 3.2-6.8 7.2-6.8s7.2 2.8 7.2 6.8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3.2l7 2.6v5.4c0 5-3 8.3-7 9.6-4-1.3-7-4.6-7-9.6V5.8l7-2.6z" />
          <path d="M9 12l2 2 4-4.3" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M14.5 8V6a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H12.5a2 2 0 0 0 2-2v-2" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <path d="M17.5 8.3 21.2 12l-3.7 3.7" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      );
  }
}

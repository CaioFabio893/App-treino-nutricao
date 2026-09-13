"use client";

interface HeaderProps {
  week: number;
  onPR: () => void;
  onWeek: () => void;
  onLogout: () => void;
}

export default function Header({ week, onPR, onWeek, onLogout }: HeaderProps) {
  return (
    <div id="header">
      <div className="logo-wrap">
        <svg className="logo-svg" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="26" cy="7" rx="4" ry="2.5" fill="#7a8f4e" transform="rotate(-30 26 7)" />
          <ellipse cx="32" cy="6" rx="4" ry="2.5" fill="#5a6b3a" transform="rotate(20 32 6)" />
          <circle cx="30" cy="33" r="19" stroke="#c0622a" strokeWidth="2" fill="none" />
          <path d="M23 20 Q21 28 22 38 Q26 42 35 41" stroke="#c0622a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M22 38 Q30 35 37 37" stroke="#c0622a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
        <div className="logo-text">
          Louise Lima
          <span>Nutricionista</span>
        </div>
      </div>
      <div id="header-right">
        <button type="button" className="hbtn" onClick={onPR}>
          PRs
        </button>
        <div id="week-badge" onClick={onWeek}>
          SEM {week}
        </div>
        <button type="button" className="hbtn ghost" onClick={onLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/SetupNeeded";
import NavTabs from "@/components/NavTabs";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, initializing, role, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else if (role !== "admin") router.replace("/");
  }, [initializing, user, role, router]);

  if (initializing || !user || role !== "admin") {
    return <LoadingScreen />;
  }

  return (
    <div>
      <div className="nut-header">
        <div className="logo-wrap">
          <svg className="logo-svg" width="36" height="36" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="26" cy="7" rx="4" ry="2.5" fill="#7a8f4e" transform="rotate(-30 26 7)" />
            <ellipse cx="32" cy="6" rx="4" ry="2.5" fill="#5a6b3a" transform="rotate(20 32 6)" />
            <circle cx="30" cy="33" r="19" stroke="#c0622a" strokeWidth="2" fill="none" />
            <path d="M23 20 Q21 28 22 38 Q26 42 35 41" stroke="#c0622a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M22 38 Q30 35 37 37" stroke="#c0622a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
          <div className="logo-text">
            Painel Admin
            <span>Usuários e permissões</span>
          </div>
        </div>
        <div id="header-right">
          <Link className="hbtn" href="/nutritionist">
            Ver painel
          </Link>
          <button type="button" className="hbtn ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
      <div className="nut-main">{children}</div>
    </div>
  );
}
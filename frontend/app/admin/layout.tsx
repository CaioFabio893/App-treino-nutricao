"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rota exclusiva de admin (a sidebar mostra o item "Usuários" só para admin).
  return <DashboardLayout allowedRoles={["admin"]}>{children}</DashboardLayout>;
}
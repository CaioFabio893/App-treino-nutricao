"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function NutritionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nutricionistas e admins usam o painel principal.
  return (
    <DashboardLayout allowedRoles={["nutritionist", "admin"]}>{children}</DashboardLayout>
  );
}
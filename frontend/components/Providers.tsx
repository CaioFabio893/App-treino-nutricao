"use client";

import { AuthProvider } from "@/lib/auth";
import PWA from "./PWA";
import PWAInstall from "./PWAInstall";
import DemoRoleSwitch from "./DemoRoleSwitch";
import AdminAreaSwitch from "./AdminAreaSwitch";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <PWA />
      <PWAInstall />
      <DemoRoleSwitch />
      <AdminAreaSwitch />
    </AuthProvider>
  );
}
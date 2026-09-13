"use client";

import { AuthProvider } from "@/lib/auth";
import PWA from "./PWA";
import DemoRoleSwitch from "./DemoRoleSwitch";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <PWA />
      <DemoRoleSwitch />
    </AuthProvider>
  );
}
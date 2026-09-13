"use client";

import { AuthProvider } from "@/lib/auth";
import PWA from "./PWA";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <PWA />
    </AuthProvider>
  );
}
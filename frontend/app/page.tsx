"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import WorkoutApp from "@/components/WorkoutApp";
import SetupNeeded, { LoadingScreen } from "@/components/SetupNeeded";

export default function Home() {
  const { user, initializing, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !configured) return;
    if (!initializing && !user) router.replace("/login");
  }, [initializing, user, configured, router]);

  if (!configured) return <SetupNeeded />;
  if (initializing) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  return <WorkoutApp />;
}
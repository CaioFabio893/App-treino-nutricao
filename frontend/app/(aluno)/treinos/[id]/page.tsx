"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ProgramDetail from "@/components/programs/ProgramDetail";
import { LoadingScreen } from "@/components/SetupNeeded";

export default function StudentProgramDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <StudentProgramDetailInner />
    </Suspense>
  );
}

function StudentProgramDetailInner() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  if (!id) return <LoadingScreen />;
  return <ProgramDetail programId={id} readOnly backHref="/treinos" backLabel="Treino" />;
}


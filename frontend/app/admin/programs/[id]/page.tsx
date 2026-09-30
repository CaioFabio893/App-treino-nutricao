"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ProgramDetail from "@/components/programs/ProgramDetail";
import { WorkoutsPageSkeleton } from "@/components/Skeleton";

export default function ProgramDetailPage() {
  return (
    <Suspense fallback={<WorkoutsPageSkeleton />}>
      <ProgramDetailInner />
    </Suspense>
  );
}

function ProgramDetailInner() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  if (!id) return <WorkoutsPageSkeleton />;
  return <ProgramDetail programId={id} backHref="/admin/programs" backLabel="Programas" />;
}

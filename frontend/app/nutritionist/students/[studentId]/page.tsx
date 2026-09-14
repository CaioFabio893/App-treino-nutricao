"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { ProfileSkeleton } from "@/components/Skeleton";
import StudentDetail from "@/components/StudentDetail";

// Rota dinâmica /nutritionist/students/[studentId]
// Em Next 16, `params` chega como Promise; client components usam `use()`.
export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const { getToken } = useAuth();
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const s = await api.getStudent(studentId, token);
      setStudent(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aluno não encontrado");
    } finally {
      setReady(true);
    }
  }, [getToken, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <ProfileSkeleton />;

  if (!student || error) {
    return (
      <div className="empty-box">
        {error || "Aluno não encontrado."}
        <div className="btn-row">
          <a className="btn-sm" href="/nutritionist/students">
            ‹ Voltar para alunos
          </a>
        </div>
      </div>
    );
  }

  return <StudentDetail student={student} onStudentChange={setStudent} />;
}
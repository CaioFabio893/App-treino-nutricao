"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { ProfileSkeleton } from "@/components/Skeleton";
import StudentDetail from "@/components/StudentDetail";

/** Mensagens amigáveis para erros conhecidos da API (demo/backend). */
function friendlyError(raw: string): string {
  if (/aluno\s*nao\s*encontrado/i.test(raw)) return "Aluno não encontrado.";
  return raw || "Aluno não encontrado.";
}

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
      setError(friendlyError(e instanceof Error ? e.message : ""));
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
      <div className="load-error" role="alert">
        <p style={{ fontWeight: 600 }}>{error || "Aluno não encontrado."}</p>
        <p style={{ fontSize: 12 }}>
          Verifique se o aluno está cadastrado ou volte para a lista de alunos.
        </p>
        <div className="btn-row">
          <Link className="btn-sm" href="/nutritionist/students">
            ‹ Voltar para alunos
          </Link>
        </div>
      </div>
    );
  }

  return <StudentDetail student={student} onStudentChange={setStudent} />;
}
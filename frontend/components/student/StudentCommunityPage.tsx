"use client";

import Feed from "@/components/Feed";

/** Página "Comunidade" do aluno: feed da turma. */
export default function StudentCommunityPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Comunidade</h1>
          <div className="page-sub">
            Feed da turma — muita gente treinando junto!
          </div>
        </div>
      </div>
      <Feed />
    </div>
  );
}
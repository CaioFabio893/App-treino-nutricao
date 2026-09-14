"use client";

import Ranking from "@/components/Ranking";
import Feed from "@/components/Feed";

/** Página "Comunidade" do aluno: ranking do ciclo + feed. */
export default function StudentCommunityPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Comunidade</h1>
          <div className="page-sub">
            Feed e ranking do ciclo — muita gente treinando junto!
          </div>
        </div>
      </div>
      <div className="section-label">Classificação do ciclo</div>
      <Ranking />
      <div className="section-label stu-feed-label">Feed</div>
      <Feed />
    </div>
  );
}
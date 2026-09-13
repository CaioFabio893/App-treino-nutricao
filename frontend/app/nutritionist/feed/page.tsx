"use client";

import Feed from "@/components/Feed";

export default function FeedPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Feed</h1>
          <div className="page-sub">Postagens de todos os alunos — e suas publicações.</div>
        </div>
      </div>
      <Feed />
    </div>
  );
}
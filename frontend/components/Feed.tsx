"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { Post } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import PostCard from "./PostCard";

export default function Feed() {
  const { getToken, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const page = await api.listPosts(token);
      setPosts(page.posts);
    } catch {
      /* offline */
    } finally {
      setReady(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const neu = await api.createPost({ type: "manual", text: t }, token);
      setPosts((prev) => [neu, ...prev]);
      setText("");
    } catch {
      /* silencioso */
    } finally {
      setBusy(false);
    }
  };

  const updatePost = (updated: Post) => {
    setPosts((prev) =>
      updated.deleted
        ? prev.filter((p) => p.id !== updated.id)
        : prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const meId = profile?.id ?? "";
  const meRole = profile?.role ?? "student";

  return (
    <div className="feed-wrap">
      {profile && (
        <div className="post-composer">
          <div className="post-composer-head">
            <div className="post-avatar">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.name} />
              ) : (
                <span>{profile.name.charAt(0).toUpperCase() || "?"}</span>
              )}
            </div>
            <input
              type="text"
              placeholder="Compartilhe algo com os alunos…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void publish()}
            />
            <button type="button" className="btn-sm acc" disabled={busy || !text.trim()} onClick={() => void publish()}>
              Publicar
            </button>
          </div>
        </div>
      )}

      {!ready ? (
        <div className="empty-box">Carregando feed…</div>
      ) : posts.length === 0 ? (
        <div className="empty-box">
          Nada por aqui ainda. Ao concluir treinos ou marcar a dieta, aparecem posts
          automáticos — e professores podem publicar avisos aqui.
        </div>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} meId={meId} meRole={meRole} getToken={getToken} onPost={updatePost} />
        ))
      )}
    </div>
  );
}
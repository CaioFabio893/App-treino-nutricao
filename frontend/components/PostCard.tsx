"use client";

import { useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import type { Post, Role } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  workout: "Treino",
  diet: "Dieta",
  manual: "Post",
};

function timeAgo(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(min, 1)} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(t).toLocaleDateString("pt-BR");
}

interface Props {
  post: Post;
  meId: string;
  meRole: Role;
  getToken: () => Promise<string>;
  onPost: (updated: Post) => void;
}

export default function PostCard({ post, meId, meRole, getToken, onPost }: Props) {
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const likes = post.likes ?? {};
  const liked = Boolean(likes[meId]);
  const comments = (post.comments ?? []).filter((c) => !c.deleted);
  const canModerate = meRole === "nutritionist" || meRole === "admin";

  const doLike = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const updated = await api.toggleLike(post.id, token);
      onPost(updated);
    } catch {
      /* silencioso */
    } finally {
      setBusy(false);
    }
  };

  const doComment = async () => {
    const text = commentText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const updated = await api.addComment(post.id, { text }, token);
      onPost(updated);
      setCommentText("");
    } catch {
      /* silencioso */
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (cid: string) => {
    try {
      const token = await getToken();
      const updated = await api.deleteComment(post.id, cid, token);
      onPost(updated);
    } catch {
      /* silencioso */
    }
  };

  const delPost = async () => {
    const isOwner = post.userId === meId;
    if (!confirm(`Remover este post${isOwner || canModerate ? "" : "?"}?`)) return;
    try {
      const token = await getToken();
      await api.deletePost(post.id, token);
      onPost({ ...post, deleted: true });
    } catch {
      /* silencioso */
    }
  };

  const avatar = post.userPhotoURL;
  const initials = (post.userName || "?").charAt(0).toUpperCase();

  if (post.deleted) return null;

  return (
    <article className="post-card">
      <div className="post-head">
        <Link href={`/profile/${post.userId}`} className="post-avatar">
          {avatar ? <img src={avatar} alt={post.userName} /> : <span>{initials}</span>}
        </Link>
        <div className="post-who">
          <Link href={`/profile/${post.userId}`} className="post-name">
            {post.userName}
          </Link>
          <div className="post-meta">
            <span className={`post-type t-${post.type}`}>{TYPE_LABEL[post.type] ?? "Post"}</span>
            {post.moderatedBy && <span className="post-moderated">• moderado</span>}
            <span>• {timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {(post.userId === meId || canModerate) && (
          <button type="button" className="post-del" title="Excluir" onClick={() => void delPost()}>
            ✕
          </button>
        )}
      </div>

      <div className="post-body">
        {post.workoutName && <div className="post-linked">🏋 {post.workoutName}</div>}
        {post.dietName && <div className="post-linked">🥗 {post.dietName}</div>}
        {post.text && <p className="post-text">{post.text}</p>}
      </div>

      <div className="post-acts">
        <button type="button" className={`post-act ${liked ? "liked" : ""}`} onClick={() => void doLike()}>
          👍 {post.likeCount ?? 0}
        </button>
        <button type="button" className="post-act" onClick={() => setShowComments((s) => !s)}>
          💬 {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="post-comments">
          {comments.length === 0 && <div className="post-no-comments">Sem comentários ainda.</div>}
          {comments.map((c) => (
            <div key={c.id} className="post-comment">
              <Link href={`/profile/${c.userId}`} className="post-comment-name">
                {c.userName}
              </Link>
              <span className="post-comment-text">{c.text}</span>
              {(c.userId === meId || canModerate) && (
                <button
                  type="button"
                  className="post-comment-del"
                  title="Excluir comentário"
                  onClick={() => void removeComment(c.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="post-comment-input">
            <input
              type="text"
              placeholder="Escreva um comentário…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void doComment()}
            />
            <button type="button" className="btn-sm" disabled={busy || !commentText.trim()} onClick={() => void doComment()}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
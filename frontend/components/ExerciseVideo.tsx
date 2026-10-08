"use client";

import { useState } from "react";

function youtubeEmbed(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (/^\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2];
    }
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
  } catch { return null; }
}

export default function ExerciseVideo({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbed(url);
  if (!/^https:\/\//i.test(url)) return null;
  if (!embed) return <a href={url} target="_blank" rel="noopener noreferrer">{title}</a>;
  return <div className="exercise-video">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Fechar vídeo" : `▶ ${title}`}</button>
    {open && <div className="exercise-video-frame"><iframe src={embed} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
    {open && <small>Se o autor bloquear a reprodução no app, <a href={url} target="_blank" rel="noopener noreferrer">abra no YouTube</a>.</small>}
  </div>;
}

"use client";

import type { CSSProperties } from "react";

// Avatar único do app. Usa <img> legado de propósito: photoURL vem de
// provedores remotos (Firebase Auth / Storage) com dimensões desconhecidas —
// next/image exigiria allowlist de domínios e width/height fixos. O CSS do
// contêiner (.avatar / .post-avatar) define o tamanho e o object-fit. Migração
// para next/image fica registrada como trabalho futuro (fase PWA/otimização).
interface AvatarProps {
  src?: string | null;
  alt?: string | null;
  style?: CSSProperties;
}

export default function Avatar({ src, alt, style }: AvatarProps) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} style={style} />
  );
}
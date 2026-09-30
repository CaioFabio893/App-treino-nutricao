"use client";

import type { CSSProperties } from "react";

// Avatar compartilhado: perfis usam iniciais; src opcional para outros usos.
interface AvatarProps {
  src?: string | null;
  alt?: string | null;
  style?: CSSProperties;
}

export default function Avatar({ src, alt, style }: AvatarProps) {
  if (!src) return <>{alt?.charAt(0)?.toUpperCase() || "?"}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} style={style} />
  );
}

"use client";

// ── Skeletons do painel (área .dashboard) ─────────────────────────────────
// Substituem o LoadingScreen genérico nas telas do nutricionista/admin.
// As classes .dash-skel* vivem dentro do escopo .dashboard no dashboard.css,
// então o app do aluno não é afetado.

import type { CSSProperties } from "react";

export function Skeleton({
  className = "",
  style,
  width,
  height,
  maxWidth,
}: {
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
}) {
  return (
    <div
      className={`dash-skel ${className}`}
      style={{
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(maxWidth !== undefined ? { maxWidth } : {}),
        ...style,
      }}
    />
  );
}

/** Texto simples (1+ linhas). */
export function SkeletonText({
  width = "70%",
  lines = 1,
}: {
  width?: number | string;
  lines?: number;
}) {
  return (
    <div
      style={{ display: "block", width, maxWidth: "100%" }}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="dash-skel dash-skel-line"
          style={{ width: i === lines - 1 && lines > 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="dash-skel dash-skel-avatar"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Card no formato .nut-card das listas. */
export function SkeletonCard({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="nut-card" aria-hidden="true">
      <div className="nut-card-head">
        {avatar && <SkeletonAvatar />}
        <div style={{ flex: 1 }}>
          <SkeletonText width="55%" />
          <SkeletonText width="85%" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Skeleton width={76} height={22} />
        <Skeleton width={96} height={22} />
        <Skeleton width={70} height={22} />
      </div>
    </div>
  );
}

/** Lista de cards (usada em telas estreitas/gerais). */
export function ListCardsSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="cards-view" role="status" aria-label="Carregando…">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} avatar={avatar} />
      ))}
    </div>
  );
}

/** Tabela skeleton (visível em telas largas, >900px). */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-view" role="status" aria-label="Carregando…">
      <table className="dash-table dash-table-skel">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j}>
                  <Skeleton height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cabeçalho de página skeleton. */
export function HeadSkeleton() {
  return (
    <div className="page-head" style={{ alignItems: "flex-start" }}>
      <div>
        <Skeleton width={200} height={22} />
        <div style={{ marginTop: 6 }}>
          <Skeleton width={240} height={12} />
        </div>
      </div>
    </div>
  );
}

// ── Skeletons específicos por tela ─────────────────────────────────────────

export function StudentsPageSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="dash-filters">
        <div className="dash-filter-search">
          <Skeleton height={36} />
        </div>
        <Skeleton width={160} height={36} />
      </div>
      <ListCardsSkeleton rows={5} />
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}

export function WorkoutsPageSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="dash-filters">
        <div className="dash-filter-search">
          <Skeleton height={36} />
        </div>
      </div>
      <ListCardsSkeleton rows={5} />
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}

export function DietsPageSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <ListCardsSkeleton rows={5} />
    </div>
  );
}

export function RankingSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="rank-list" role="status" aria-label="Carregando…">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rank-row" style={{ cursor: "default" }}>
            <Skeleton width={30} height={18} />
            <span style={{ flex: 1 }}>
              <Skeleton width="55%" height={14} />
            </span>
            <Skeleton width={44} height={18} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="stat-grid" role="status" aria-label="Carregando…">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-cell">
            <Skeleton width={52} height={24} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width={88} height={11} />
            </div>
          </div>
        ))}
      </div>
      <div className="section-label">
        <Skeleton width={140} height={14} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} avatar={false} />
      ))}
    </div>
  );
}

export function ActivitiesSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="stat-grid" role="status" aria-label="Carregando…">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="stat-cell">
            <Skeleton width={52} height={24} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width={96} height={11} />
            </div>
          </div>
        ))}
      </div>
      <ListCardsSkeleton rows={2} />
      <div className="section-label">
        <Skeleton width={160} height={14} />
      </div>
      <div style={{ paddingLeft: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <Skeleton width={120} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width="75%" height={13} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelinePageSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="dash-chart-card">
        <div className="dash-chart-head">
          <Skeleton width={220} height={16} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width={300} height={12} />
          </div>
        </div>
        <Skeleton height={200} />
      </div>
      <div style={{ paddingLeft: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <Skeleton width={120} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width="70%" height={13} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="frm-card">
        <Skeleton width={180} height={18} />
        <div className="frm-row-inline" style={{ marginTop: 14 }}>
          <div className="frm-row">
            <Skeleton width={90} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton height={38} />
            </div>
          </div>
          <div className="frm-row">
            <Skeleton width={90} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton height={38} />
            </div>
          </div>
        </div>
      </div>
      <ListCardsSkeleton rows={4} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div>
      <HeadSkeleton />
      <div className="frm-card">
        <Skeleton width={160} height={18} />
        <div className="frm-row-inline" style={{ marginTop: 14 }}>
          <div className="frm-row">
            <Skeleton width={90} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton height={38} />
            </div>
          </div>
          <div className="frm-row">
            <Skeleton width={90} height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton height={38} />
            </div>
          </div>
        </div>
      </div>
      <div className="stat-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="stat-cell">
            <Skeleton width={52} height={24} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width={96} height={11} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
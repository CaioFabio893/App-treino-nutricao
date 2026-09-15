"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DietDailyLog, WorkoutHistoryEntry } from "@/lib/types";
import LoadError from "./LoadError";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DAYS = 14;

interface Point {
  label: string;
  workouts: number;
  diet: number | null;
}

/** Lê uma variável CSS da área .dashboard (fallback p/ hex se não achar). */
function dashVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const el = document.querySelector<HTMLElement>(".dashboard") ?? document.documentElement;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function AdherenceChart() {
  const { getToken } = useAuth();
  const [data, setData] = useState<Point[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [colors, setColors] = useState({
    primary: "#0B6B52",
    accent: "#35C596",
    muted: "#63736C",
    text: "#172420",
  });

  useEffect(() => {
    // Cores vem do tema .dashboard (--d-primary e --d-primary-bright como "accent").
    setColors({
      primary: dashVar("--d-primary", "#0B6B52"),
      accent: dashVar("--d-primary-bright", "#35C596"),
      muted: dashVar("--d-muted", "#63736C"),
      text: dashVar("--d-text", "#172420"),
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - (DAYS - 1));

      const [logs, history] = await Promise.all([
        api.listDietLogs("", token, isoLocal(from), isoLocal(today)),
        api.listHistory(token),
      ]);

      const points: Point[] = [];
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        const iso = isoLocal(d);
        const dayLogs = (logs as DietDailyLog[]).filter((l) => l.date === iso);
        const followed = dayLogs.filter((l) => l.status === "followed").length;
        const partial = dayLogs.filter((l) => l.status === "partial").length;
        const pct =
          dayLogs.length > 0
            ? Math.round(((followed + partial * 0.5) / dayLogs.length) * 100)
            : null;
        const workouts = (history as WorkoutHistoryEntry[]).filter(
          (h) => h.completedAt && isoLocal(new Date(h.completedAt)) === iso
        ).length;
        points.push({
          label: `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` +
            ` ${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}`,
          workouts,
          diet: pct,
        });
      }
      setData(points);
      setLoadError(false);
    } catch {
      setData([]);
      setLoadError(true);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasData = data?.some((p) => p.workouts > 0 || p.diet !== null) ?? false;

  return (
    <div className="dash-chart-card">
      <div className="dash-chart-head">
        <div className="dash-chart-title">Adesão — últimos {DAYS} dias</div>
        <div className="dash-chart-sub">
          Treinos concluídos (barras) e dieta seguida % (linha) — todos os alunos
        </div>
      </div>
      {loadError ? (
        <LoadError
          message="Não foi possível carregar os dados de adesão."
          onRetry={() => void load()}
        />
      ) : !data ? (
        <div className="dash-chart-empty">Calculando…</div>
      ) : !hasData ? (
        <div className="dash-chart-empty">
          Sem registros nos últimos {DAYS} dias. Conclusões de treino e diário
          alimentar aparecem aqui.
        </div>
      ) : (
        <div style={{ width: "100%", height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted + "33"} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: colors.muted }}
                tickLine={false}
                axisLine={{ stroke: colors.muted + "55" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: colors.muted }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 10, fill: colors.muted }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: colors.text,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                yAxisId="left"
                dataKey="workouts"
                name="Treinos concluídos"
                fill={colors.primary}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="diet"
                name="Dieta seguida (%)"
                stroke={colors.accent}
                strokeWidth={2}
                dot={{ r: 2.5, fill: colors.accent, strokeWidth: 0 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
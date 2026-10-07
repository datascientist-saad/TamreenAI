"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ points, dataKey, color = "#8A1538" }: { points: Array<Record<string, string | number>>; dataKey: string; color?: string }) {
  if (!points.length) return <p className="text-sm text-muted">Nothing is logged in this window.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={36} />
          <Tooltip />
          <Area dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.16} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

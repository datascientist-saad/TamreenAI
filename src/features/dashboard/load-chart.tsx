"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function LoadChart({ points, target }: { points: Array<{ day: string; load: number }>; target: number }) {
  const data = points.map((point) => ({ ...point, target }));
  return (
    <div className="h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip />
          <Area dataKey="target" stroke="#C9A876" fill="transparent" strokeDasharray="4 4" />
          <Area dataKey="load" stroke="var(--score)" fill="var(--score)" fillOpacity={0.18} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function LoadChart({ points, target }: { points: Array<{ day: string; load: number }>; target: number }) {
  const data = points.map((point) => ({ ...point, target }));
  return (
    <div className="mt-4 h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={12} />
          <YAxis hide />
          <Tooltip />
          <Area dataKey="target" stroke="#C9A876" fill="transparent" strokeDasharray="4 4" />
          <Area dataKey="load" stroke="#8A1538" fill="#8A1538" fillOpacity={0.18} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export type MiniTrendPoint = { d: string; v: number | null; detail?: string };

type MiniTrendChartProps = {
  data: MiniTrendPoint[];
  color: string;
  /** Shown in tooltip next to the numeric value */
  valueLabel?: string;
  /** How to format the main value in the tooltip */
  formatValue?: (v: number) => string;
  /** Force chart remount when tab/sheet opens so Recharts measures layout */
  chartKey?: string;
};

function TrendTooltip({
  active,
  payload,
  valueLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MiniTrendPoint }>;
  valueLabel: string;
  formatValue: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const v = row.v;
  const valueStr = v == null || Number.isNaN(v) ? "—" : formatValue(v);
  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid var(--border)",
        borderRadius: 10,
        fontSize: 12,
        padding: "10px 12px",
        maxWidth: 280,
      }}
    >
      <div style={{ color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 600 }}>{row.d}</div>
      <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
        {valueLabel}: {valueStr}
      </div>
      {row.detail ? (
        <div style={{ color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{row.detail}</div>
      ) : null}
    </div>
  );
}

export function MiniTrendChart({ data, color, valueLabel = "Value", formatValue = (v) => v.toFixed(2), chartKey }: MiniTrendChartProps) {
  const numeric = useMemo(
    () => data.map((x) => x.v).filter((v): v is number => v != null && typeof v === "number" && !Number.isNaN(v)),
    [data]
  );
  const maxV = numeric.length ? Math.max(...numeric) : 0;
  const minV = numeric.length ? Math.min(...numeric) : 0;
  const yMax = Math.max(maxV * 1.12, minV * 1.12, 1);
  const yMin = numeric.length ? Math.max(0, minV * 0.88) : 0;

  if (!data.length) {
    return <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No data in this window yet.</p>;
  }

  if (!numeric.length) {
    return (
      <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 16 }}>No recorded values in this window yet.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 220, minHeight: 220, minWidth: 0 }} key={chartKey}>
      <ResponsiveContainer width="100%" height="100%" debounce={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="d"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }}
            tickFormatter={(v) => String(v).slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis domain={[yMin, yMax]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={40} allowDecimals />
          <Tooltip
            cursor={{ stroke: `${color}55`, strokeWidth: 1 }}
            content={(tooltipProps) => (
              <TrendTooltip {...tooltipProps} valueLabel={valueLabel} formatValue={formatValue} />
            )}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

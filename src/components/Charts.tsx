import { useId } from "react";
export const COLORS = ["#b7ef69", "#66c8f5", "#f1b47a", "#c2a2ef"];
export function LineChart({
  series,
  height = 120,
  unit = "",
  labels = true,
}: {
  series: { values: number[]; color: string; name?: string }[];
  height?: number;
  unit?: string;
  labels?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const values = series.flatMap((s) => s.values).filter(Number.isFinite);
  const max = Math.max(...values, 1) * 1.12;
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 600,
    pad = labels ? 38 : 3,
    right = 12,
    top = 12,
    bottom = labels ? 24 : 3;
  const y = (v: number) =>
    top + (1 - (v - min) / range) * (height - top - bottom);
  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Chart of ${series.map((s) => s.name || unit).join(", ")}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={series[0]?.color || COLORS[0]}
            stopOpacity=".13"
          />
          <stop offset="100%" stopColor={COLORS[0]} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line
            x1={pad}
            x2={w - right}
            y1={y(min + range * f)}
            y2={y(min + range * f)}
            stroke="#29312e"
            strokeDasharray="3 5"
          />
          {labels && (
            <text
              x={pad - 8}
              y={y(min + range * f) + 3}
              fill="#738078"
              textAnchor="end"
              fontSize="9"
            >
              {(min + range * f).toFixed(max > 100 ? 0 : 1)}
            </text>
          )}
        </g>
      ))}
      {series.map((s, i) => {
        const points = s.values
          .map(
            (v, j) =>
              `${pad + (j / Math.max(s.values.length - 1, 1)) * (w - pad - right)},${y(v)}`,
          )
          .join(" ");
        return (
          <g key={i}>
            {i === 0 && s.values.length > 1 && (
              <polygon
                points={`${pad},${height - bottom} ${points} ${w - right},${height - bottom}`}
                fill={`url(#${id})`}
              />
            )}
            <polyline
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth="1.8"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {labels && (
        <>
          <text x={pad} y={height - 4} fill="#738078" fontSize="9">
            0 s
          </text>
          <text
            x={w - right}
            y={height - 4}
            fill="#738078"
            textAnchor="end"
            fontSize="9"
          >
            {unit}
          </text>
        </>
      )}
    </svg>
  );
}

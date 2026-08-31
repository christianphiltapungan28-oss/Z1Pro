type ChartDataset = {
  label?: string;
  data: number[];
};

type ChartSpec = {
  type?: "bar" | "line" | "pie";
  title?: string;
  labels: string[];
  datasets: ChartDataset[];
};

const CHART_COLORS = [
  "#ff6791",
  "#7b6bff",
  "#34c98a",
  "#ffb020",
  "#3aa0ff",
  "#ff0022",
];

function normalizeChartSpec(parsed: unknown): ChartSpec | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj.type === "line" || obj.type === "pie" ? obj.type : "bar";
  const title = typeof obj.title === "string" ? obj.title : undefined;

  // Canonical shape: { labels: string[], datasets: [{ label?, data: number[] }] }
  if (Array.isArray(obj.labels) && Array.isArray(obj.datasets)) {
    const datasets = obj.datasets
      .filter(
        (d): d is Record<string, unknown> =>
          !!d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).data)
      )
      .map((d) => ({
        label: typeof d.label === "string" ? d.label : undefined,
        data: (d.data as unknown[]).map(Number),
      }));
    if (datasets.length === 0) return null;
    return { type, title, labels: obj.labels.map(String), datasets };
  }

  // Alt shape: { categories: string[], series: [{ name?, data: number[] }] }
  if (Array.isArray(obj.categories) && Array.isArray(obj.series)) {
    const datasets = obj.series
      .filter(
        (d): d is Record<string, unknown> =>
          !!d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).data)
      )
      .map((d) => ({
        label:
          typeof d.name === "string"
            ? d.name
            : typeof d.label === "string"
              ? d.label
              : undefined,
        data: (d.data as unknown[]).map(Number),
      }));
    if (datasets.length === 0) return null;
    return { type, title, labels: obj.categories.map(String), datasets };
  }

  // Alt shape: { data: [{ label, value }] } — a single series of labeled items
  if (
    Array.isArray(obj.data) &&
    obj.data.every((item) => item && typeof item === "object" && !Array.isArray(item))
  ) {
    const items = obj.data as Record<string, unknown>[];
    const labels = items.map((item) =>
      String(item.label ?? item.name ?? item.category ?? "")
    );
    const values = items.map((item) => Number(item.value ?? item.data ?? item.y ?? 0));
    if (labels.length === 0) return null;
    return { type, title, labels, datasets: [{ data: values }] };
  }

  return null;
}

function parseChartSpec(raw: string): ChartSpec | null {
  try {
    return normalizeChartSpec(JSON.parse(raw));
  } catch {
    return null;
  }
}

const WIDTH = 480;
const HEIGHT = 240;
const PADDING = { top: 20, right: 16, bottom: 28, left: 36 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function CartesianChart({
  spec,
  type,
}: {
  spec: ChartSpec;
  type: "bar" | "line";
}) {
  const { labels, datasets } = spec;
  const allValues = datasets.flatMap((d) => d.data);
  const max = niceMax(Math.max(1, ...allValues));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const xFor = (i: number) => PADDING.left + ((i + 0.5) / labels.length) * CHART_W;
  const yFor = (v: number) => PADDING.top + CHART_H - (v / max) * CHART_H;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={spec.title ?? "Chart"}
    >
      {gridLines.map((g) => {
        const y = PADDING.top + CHART_H - g * CHART_H;
        return (
          <g key={g}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text
              x={PADDING.left - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.6}
            >
              {Math.round(max * g)}
            </text>
          </g>
        );
      })}

      {labels.map((label, i) => (
        <text
          key={label + i}
          x={xFor(i)}
          y={HEIGHT - PADDING.bottom + 14}
          textAnchor="middle"
          fontSize={9}
          fill="currentColor"
          opacity={0.7}
        >
          {label.length > 8 ? `${label.slice(0, 7)}…` : label}
        </text>
      ))}

      {type === "bar" &&
        datasets.map((dataset, dIdx) => {
          const barGroupWidth = CHART_W / labels.length;
          const barWidth = (barGroupWidth * 0.6) / datasets.length;
          return dataset.data.map((value, i) => {
            const groupStart = xFor(i) - (barGroupWidth * 0.6) / 2;
            const x = groupStart + dIdx * barWidth;
            const y = yFor(value);
            return (
              <rect
                key={`${dIdx}-${i}`}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 2)}
                height={PADDING.top + CHART_H - y}
                fill={CHART_COLORS[dIdx % CHART_COLORS.length]}
                rx={2}
              />
            );
          });
        })}

      {type === "line" &&
        datasets.map((dataset, dIdx) => {
          const points = dataset.data
            .map((v, i) => `${xFor(i)},${yFor(v)}`)
            .join(" ");
          return (
            <g key={dIdx}>
              <polyline
                points={points}
                fill="none"
                stroke={CHART_COLORS[dIdx % CHART_COLORS.length]}
                strokeWidth={2}
              />
              {dataset.data.map((v, i) => (
                <circle
                  key={i}
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={2.5}
                  fill={CHART_COLORS[dIdx % CHART_COLORS.length]}
                />
              ))}
            </g>
          );
        })}
    </svg>
  );
}

function PieChart({ spec }: { spec: ChartSpec }) {
  const data = spec.datasets[0]?.data ?? [];
  const total = data.reduce((sum, v) => sum + v, 0) || 1;
  const cx = HEIGHT / 2;
  const cy = HEIGHT / 2;
  const r = HEIGHT / 2 - 24;

  const slices = data.map((value, i) => {
    const cumulativeBefore = data.slice(0, i).reduce((sum, v) => sum + v, 0);
    const fraction = value / total;
    const startAngle = -Math.PI / 2 + (cumulativeBefore / total) * Math.PI * 2;
    const endAngle = startAngle + fraction * Math.PI * 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, color: CHART_COLORS[i % CHART_COLORS.length], value };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
      <svg
        viewBox={`0 0 ${HEIGHT} ${HEIGHT}`}
        className="h-48 w-48 shrink-0"
        role="img"
        aria-label={spec.title ?? "Pie chart"}
      >
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} />
        ))}
      </svg>
      <ul className="flex flex-col gap-1 text-xs">
        {spec.labels.map((label, i) => (
          <li key={label + i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-foreground/80">{label}</span>
            <span className="text-muted">{data[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartBlock({ raw }: { raw: string }) {
  const spec = parseChartSpec(raw);

  if (!spec) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-card-border bg-card p-3 text-xs text-muted">
        {raw}
      </pre>
    );
  }

  const type = spec.type ?? "bar";

  return (
    <div className="my-1 rounded-xl border border-card-border bg-card p-3 text-foreground">
      {spec.title && (
        <p className="mb-2 text-xs font-semibold text-foreground/80">
          {spec.title}
        </p>
      )}
      {type === "pie" ? (
        <PieChart spec={spec} />
      ) : (
        <CartesianChart spec={spec} type={type} />
      )}
      {type !== "pie" && spec.datasets.some((d) => d.label) && (
        <div className="mt-2 flex flex-wrap gap-3">
          {spec.datasets.map((dataset, i) =>
            dataset.label ? (
              <span
                key={dataset.label + i}
                className="flex items-center gap-1.5 text-[11px] text-muted"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {dataset.label}
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

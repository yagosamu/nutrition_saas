import type { WeightPoint } from "@/lib/types";

// Gráfico de linha em SVG puro — sem biblioteca de gráficos (decisão do MVP).
const W = 320;
const H = 140;
const PAD_X = 14;
const PAD_TOP = 20;
const PAD_BOTTOM = 20;

function fmtKg(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-line-200 bg-cream-50 px-6 py-8 text-center text-sm text-ink-500">
        Registre seu peso para acompanhar a evolução.
      </div>
    );
  }

  const times = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const weights = points.map((p) => p.weightKg);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const spanT = Math.max(1, maxT - minT);
  const spanW = Math.max(0.5, maxW - minW);

  const toX = (t: number) => PAD_X + ((t - minT) / spanT) * (W - PAD_X * 2);
  const toY = (w: number) =>
    H - PAD_BOTTOM - ((w - minW) / spanW) * (H - PAD_TOP - PAD_BOTTOM);

  const coords = points.map((p, i) => ({
    cx: toX(times[i]),
    cy: toY(p.weightKg),
    source: p.source,
  }));
  const line = coords.map((c) => `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(" ");

  // Labels discretos nos extremos de peso (último ponto vence em caso de empate)
  const iMax = weights.lastIndexOf(maxW);
  const iMin = weights.lastIndexOf(minW);
  const clampX = (x: number) => Math.min(Math.max(x, PAD_X + 8), W - PAD_X - 8);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Evolução do peso"
    >
      <polyline
        points={line}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-caramel-500"
      />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={3}
          className={c.source === "TEAM" ? "fill-brand-500" : "fill-caramel-500"}
        />
      ))}
      <text
        x={clampX(coords[iMax].cx)}
        y={coords[iMax].cy - 8}
        textAnchor="middle"
        className="fill-ink-300 text-[9px]"
      >
        {fmtKg(maxW)}
      </text>
      {iMin !== iMax && (
        <text
          x={clampX(coords[iMin].cx)}
          y={coords[iMin].cy + 14}
          textAnchor="middle"
          className="fill-ink-300 text-[9px]"
        >
          {fmtKg(minW)}
        </text>
      )}
    </svg>
  );
}

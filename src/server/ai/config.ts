// Modelos por tarefa (design doc): Sonnet ranqueia/gera; Haiku extrai/mapeia.
export const AI_MODELS = {
  ranking: "claude-sonnet-5",
  generation: "claude-sonnet-5",
  extraction: "claude-haiku-4-5",
} as const;

// USD por milhão de tokens (console.anthropic.com/pricing, jul/2026)
export const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING_USD_PER_MTOK[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export const SUGGEST_JOBS_PER_SLOT_PER_DAY = 5;
export const GENERATION_MAX_ATTEMPTS = 3; // 1 tentativa + 2 correções

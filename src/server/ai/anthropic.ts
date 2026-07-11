import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { estimateCostUsd } from "./config";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

function client(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic(); // lê ANTHROPIC_API_KEY do env
  }
  return globalForAnthropic.anthropic;
}

export type AiUsage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };

export type StructuredCallParams<T extends z.ZodType> = {
  model: string;
  /** Blocos estáveis primeiro (recebem cache_control), voláteis depois. */
  system: { text: string; cache?: boolean }[];
  userContent: string;
  schema: T;
  maxTokens?: number;
};

/**
 * Chamada estruturada: o Claude responde JSON validado contra o schema Zod.
 * A saída NUNCA contém valores nutricionais — só IDs e quantidades.
 */
export async function runStructured<T extends z.ZodType>(
  params: StructuredCallParams<T>,
): Promise<{ data: z.infer<T>; usage: AiUsage }> {
  const response = await client().messages.parse({
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system.map((block) => ({
      type: "text" as const,
      text: block.text,
      ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
    })),
    messages: [{ role: "user", content: params.userContent }],
    output_config: { format: zodOutputFormat(params.schema) },
  });

  if (response.parsed_output == null) {
    throw new Error(`Resposta da IA não seguiu o formato esperado (stop: ${response.stop_reason})`);
  }

  const inputTokens =
    response.usage.input_tokens +
    (response.usage.cache_creation_input_tokens ?? 0) +
    (response.usage.cache_read_input_tokens ?? 0);
  const usage: AiUsage = {
    model: params.model,
    inputTokens,
    outputTokens: response.usage.output_tokens,
    costUsd: estimateCostUsd(params.model, inputTokens, response.usage.output_tokens),
  };
  return { data: response.parsed_output, usage };
}

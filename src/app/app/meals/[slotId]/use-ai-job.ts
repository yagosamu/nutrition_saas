"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AiJobStatusView } from "@/lib/types";

const TERMINAL = new Set(["COMPLETED", "FAILED"]);
const POLL_MS = 2000;

/**
 * Faz polling de um AiJob até o estado terminal.
 * Ao COMPLETED, dá router.refresh() para o server component recarregar os dados.
 */
export function useAiJob(initialJob: AiJobStatusView | null) {
  const router = useRouter();
  const [job, setJob] = useState<AiJobStatusView | null>(initialJob);
  const refreshed = useRef(false);

  const jobId = job?.id ?? null;
  const isTerminal = job ? TERMINAL.has(job.status) : true;

  useEffect(() => {
    if (!jobId || isTerminal) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/app/ai-jobs/${jobId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as AiJobStatusView;
        if (cancelled) return;
        setJob(data);
        if (data.status === "COMPLETED" && !refreshed.current) {
          refreshed.current = true;
          router.refresh();
        }
      } catch {
        // rede instável — próxima rodada tenta de novo
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, isTerminal, router]);

  function track(newJobId: string) {
    refreshed.current = false;
    setJob({ id: newJobId, type: "SUGGEST", status: "PENDING", error: null, result: null });
  }

  const processing = job != null && !TERMINAL.has(job.status);

  return { job, track, processing };
}

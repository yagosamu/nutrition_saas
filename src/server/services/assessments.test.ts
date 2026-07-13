import { describe, expect, it } from "vitest";
import { upsertPatientWeightWith, type PatientWeightDeps } from "./assessments";

const TODAY = "2026-07-13";

function makeDeps(existingId: string | null) {
  const calls: Record<string, unknown>[] = [];
  const deps: PatientWeightDeps = {
    findTodayPatientAssessment: async () => (existingId ? { id: existingId } : null),
    createWeight: async (data) => {
      calls.push({ op: "create", ...data });
    },
    updateWeight: async (id, weightKg) => {
      calls.push({ op: "update", id, weightKg });
    },
    today: () => TODAY,
  };
  return { deps, calls };
}

describe("upsertPatientWeightWith", () => {
  it("cria o registro do dia quando não existe", async () => {
    const { deps, calls } = makeDeps(null);
    const result = await upsertPatientWeightWith(deps, "p1", 72.4);
    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({ op: "create", patientId: "p1", weightKg: 72.4, date: TODAY });
  });

  it("atualiza quando já registrou hoje (1 por dia)", async () => {
    const { deps, calls } = makeDeps("a1");
    const result = await upsertPatientWeightWith(deps, "p1", 72.1);
    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({ op: "update", id: "a1", weightKg: 72.1 });
  });

  it("recusa peso não positivo", async () => {
    const { deps, calls } = makeDeps(null);
    const result = await upsertPatientWeightWith(deps, "p1", 0);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

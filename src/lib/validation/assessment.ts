import { z } from "zod";
import { dateStringSchema } from "./meal-log";

const measure = z.coerce.number().positive().max(500).nullable();

export const teamAssessmentSchema = z
  .object({
    date: dateStringSchema,
    weightKg: z.coerce.number().positive().max(400).nullable(),
    heightCm: measure,
    waistCm: measure,
    hipCm: measure,
    chestCm: measure,
    armCm: measure,
    thighCm: measure,
    bodyFatPct: z.coerce.number().min(1).max(70).nullable(),
    muscleMassKg: z.coerce.number().positive().max(150).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .refine(
    (a) =>
      [
        a.weightKg,
        a.heightCm,
        a.waistCm,
        a.hipCm,
        a.chestCm,
        a.armCm,
        a.thighCm,
        a.bodyFatPct,
        a.muscleMassKg,
      ].some((v) => v != null) || (a.notes != null && a.notes.length > 0),
    { message: "Preencha ao menos uma medida ou observação" },
  );

export const patientWeightSchema = z.object({
  weightKg: z.coerce.number().positive("Informe o peso").max(400),
});

export type TeamAssessmentData = z.infer<typeof teamAssessmentSchema>;
export type PatientWeightData = z.infer<typeof patientWeightSchema>;

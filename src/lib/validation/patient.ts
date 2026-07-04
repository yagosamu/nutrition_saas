import { z } from "zod";

export const patientCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Email inválido"),
  birthDate: z.coerce.date().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).nullable(),
  teamNotes: z.string().trim().max(2000).nullable(),
});

export const patientUpdateSchema = patientCreateSchema.omit({ email: true }).extend({
  dailyAiLimit: z.coerce.number().int().min(0).max(100),
  active: z.coerce.boolean(),
});

export type PatientCreateData = z.infer<typeof patientCreateSchema>;
export type PatientUpdateData = z.infer<typeof patientUpdateSchema>;

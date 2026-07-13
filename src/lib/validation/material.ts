import { z } from "zod";

export const materialLinkSchema = z.object({
  title: z.string().trim().min(2, "Dê um título ao material").max(160),
  url: z.url("Link inválido"),
  patientId: z.string().min(1).nullable(), // null = material global (todos os pacientes)
});

export type MaterialLinkData = z.infer<typeof materialLinkSchema>;

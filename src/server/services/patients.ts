import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { ActionResult } from "@/lib/types";
import type { PatientCreateData, PatientUpdateData } from "@/lib/validation/patient";
import { prisma } from "@/server/db";

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha é digitada pelo paciente.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export type PatientCreateDeps = {
  findUserByEmail: (email: string) => Promise<{ id: string } | null>;
  createPatient: (data: {
    email: string;
    name: string;
    passwordHash: string;
    birthDate: Date | null;
    sex: "MALE" | "FEMALE" | null;
    teamNotes: string | null;
  }) => Promise<{ id: string }>;
};

export async function createPatientWith(
  deps: PatientCreateDeps,
  input: PatientCreateData,
): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  const email = input.email.trim().toLowerCase();
  const existing = await deps.findUserByEmail(email);
  if (existing) return { ok: false, error: "Já existe um usuário com esse email" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 12);
  const created = await deps.createPatient({
    email,
    name: input.name.trim(),
    passwordHash,
    birthDate: input.birthDate,
    sex: input.sex,
    teamNotes: input.teamNotes,
  });
  return { ok: true, data: { id: created.id, tempPassword } };
}

export type PasswordResetDeps = {
  updatePassword: (
    userId: string,
    data: { passwordHash: string; mustChangePassword: boolean },
  ) => Promise<void>;
};

export async function resetPatientPasswordWith(
  deps: PasswordResetDeps,
  userId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 12);
  await deps.updatePassword(userId, { passwordHash, mustChangePassword: true });
  return { ok: true, data: { tempPassword } };
}

// ---- wrappers de produção ----

export function createPatient(input: PatientCreateData) {
  return createPatientWith(
    {
      findUserByEmail: (email) => prisma.user.findUnique({ where: { email }, select: { id: true } }),
      createPatient: async (data) => {
        const user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            role: "PATIENT",
            mustChangePassword: true,
            patientProfile: {
              create: { birthDate: data.birthDate, sex: data.sex, teamNotes: data.teamNotes },
            },
          },
          select: { id: true },
        });
        return user;
      },
    },
    input,
  );
}

export function resetPatientPassword(userId: string) {
  return resetPatientPasswordWith(
    {
      updatePassword: async (id, data) => {
        await prisma.user.update({ where: { id, role: "PATIENT" }, data });
      },
    },
    userId,
  );
}

export async function updatePatient(
  userId: string,
  input: PatientUpdateData,
): Promise<ActionResult> {
  await prisma.user.update({
    where: { id: userId, role: "PATIENT" },
    data: {
      name: input.name.trim(),
      active: input.active,
      patientProfile: {
        update: {
          birthDate: input.birthDate,
          sex: input.sex,
          teamNotes: input.teamNotes,
          dailyAiLimit: input.dailyAiLimit,
        },
      },
    },
  });
  return { ok: true, data: undefined };
}

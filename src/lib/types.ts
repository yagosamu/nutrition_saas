// Tipos de domínio compartilhados entre frontend e backend.
// Espelham os enums do Prisma sem importar @prisma/client
// (necessário em código edge-safe como o middleware).

export type Role = "ADMIN" | "PATIENT";

export type MacroTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

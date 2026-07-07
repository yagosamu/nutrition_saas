// Datas do produto seguem o calendário de America/Sao_Paulo.
// Convenção de storage: MealLog.date = meia-noite UTC do dia-calendário SP.
const SP_TZ = "America/Sao_Paulo";

export function todayInSaoPaulo(now: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function utcDateFromDateString(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDatePtBr(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC", // a data já é o dia-calendário; UTC evita drift
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(utcDateFromDateString(dateStr));
}

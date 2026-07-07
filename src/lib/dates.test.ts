import { describe, expect, it } from "vitest";
import { formatDatePtBr, todayInSaoPaulo, utcDateFromDateString } from "./dates";

describe("todayInSaoPaulo", () => {
  it("converte instante UTC para o dia-calendário de São Paulo", () => {
    // 01:00 UTC de 5/jul = 22:00 de 4/jul em SP (UTC-3)
    expect(todayInSaoPaulo(new Date("2026-07-05T01:00:00Z"))).toBe("2026-07-04");
  });
  it("mantém o dia quando já passou de meia-noite em SP", () => {
    expect(todayInSaoPaulo(new Date("2026-07-05T12:00:00Z"))).toBe("2026-07-05");
  });
});

describe("utcDateFromDateString", () => {
  it("gera meia-noite UTC do dia-calendário (convenção de storage do MealLog.date)", () => {
    expect(utcDateFromDateString("2026-07-04").toISOString()).toBe(
      "2026-07-04T00:00:00.000Z",
    );
  });
});

describe("formatDatePtBr", () => {
  it("formata por extenso em pt-BR", () => {
    const label = formatDatePtBr("2026-07-04");
    expect(label.toLowerCase()).toContain("4 de julho");
  });
});

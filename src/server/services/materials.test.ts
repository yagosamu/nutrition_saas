import { describe, expect, it } from "vitest";
import { visibleToPatient } from "./materials";

const materials = [
  { id: "g1", isGlobal: true, assignedPatientIds: [] },
  { id: "m1", isGlobal: false, assignedPatientIds: ["p1"] },
  { id: "m2", isGlobal: false, assignedPatientIds: ["p2"] },
];

describe("visibleToPatient", () => {
  it("paciente vê globais + atribuídos a ele, nunca de outros", () => {
    expect(materials.filter((m) => visibleToPatient(m, "p1")).map((m) => m.id)).toEqual(["g1", "m1"]);
    expect(materials.filter((m) => visibleToPatient(m, "p3")).map((m) => m.id)).toEqual(["g1"]);
  });
});

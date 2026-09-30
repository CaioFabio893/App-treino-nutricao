import { describe, expect, it } from "vitest";
import { todayDateKey } from "@/lib/days";

describe("Validade da dieta no dia de Recife", () => {
  it.each([
    ["2026-10-01T02:59:59Z", "2026-09-30"],
    ["2026-10-01T03:00:00Z", "2026-10-01"],
    ["2027-01-01T01:00:00Z", "2026-12-31"],
    ["2026-09-30T15:00:00Z", "2026-09-30"],
  ])("instante %s pertence ao dia %s", (instant, expected) => {
    expect(todayDateKey(new Date(instant))).toBe(expected);
  });
});
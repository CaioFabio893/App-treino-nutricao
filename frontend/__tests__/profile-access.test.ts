import { describe, expect, it } from "vitest";
import { canReadBusiness } from "@/lib/profileAccess";

describe("Guards de acesso do perfil", () => {
  it.each([
    ["student", "active", true], ["student", "paused", true],
    ["student", undefined, true], ["student", "", true],
    ["student", "inactive", false], ["student", "rejected", false],
    ["student", "pending_approval", false], ["student", "unknown", false],
    ["nutritionist", "active", false], ["", "active", false],
    ["admin", "inactive", true],
  ] as const)("%s / %s: acesso %s", (role, status, allowed) => {
    expect(canReadBusiness({ role, status })).toBe(allowed);
  });
  it("perfil ausente não libera dados", () => expect(canReadBusiness(null)).toBe(false));
});
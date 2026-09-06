import { minRoleFor, roleCan } from "@/lib/rbac";

describe("roleCan", () => {
  it("denies everything without a role (loading / logged out)", () => {
    expect(roleCan(undefined, "agents.write")).toBe(false);
    expect(roleCan(undefined, "batches.write")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(roleCan("viewer", "agents.write")).toBe(false);
    expect(roleCan("viewer", "agents.delete")).toBe(false);
    expect(roleCan("viewer", "calls.simulate")).toBe(false);
    expect(roleCan("viewer", "calls.live")).toBe(false);
    expect(roleCan("viewer", "batches.write")).toBe(false);
    expect(roleCan("viewer", "keys.manage")).toBe(false);
    expect(roleCan("viewer", "workspace.reset")).toBe(false);
  });

  it("lets members build but not administer", () => {
    for (const action of [
      "agents.write",
      "agents.delete",
      "calls.simulate",
      "calls.live",
      "batches.write",
      "library.import",
      "graphs.write",
      "workflows.write",
    ] as const) {
      expect(roleCan("member", action)).toBe(true);
    }
    expect(roleCan("member", "settings.write")).toBe(false);
    expect(roleCan("member", "team.manage")).toBe(false);
    expect(roleCan("member", "keys.manage")).toBe(false);
    expect(roleCan("member", "billing.manage")).toBe(false);
    expect(roleCan("member", "workspace.reset")).toBe(false);
  });

  it("lets admins manage everything except owner-only reset", () => {
    expect(roleCan("admin", "team.manage")).toBe(true);
    expect(roleCan("admin", "keys.manage")).toBe(true);
    expect(roleCan("admin", "settings.write")).toBe(true);
    expect(roleCan("admin", "workspace.reset")).toBe(false);
  });

  it("lets owners do everything", () => {
    expect(roleCan("owner", "workspace.reset")).toBe(true);
    expect(roleCan("owner", "team.manage")).toBe(true);
    expect(roleCan("owner", "calls.live")).toBe(true);
  });

  it("exposes minimum roles for tooltips", () => {
    expect(minRoleFor("workspace.reset")).toBe("owner");
    expect(minRoleFor("team.manage")).toBe("admin");
    expect(minRoleFor("agents.write")).toBe("member");
  });
});

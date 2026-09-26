import {
  addMembershipSchema,
  createTeamSchema,
  membershipSchema,
  meTeamsSchema,
  organizationSchema,
  teamSchema,
  teamWithRoleSchema,
  tenantSchema,
} from "@/lib/schemas/identity";

const teamRow = {
  team_id: "team_abc123def456",
  org_id: "org_abc123def456",
  tenant_id: "68d5f4a1b2c3d4e5f6071829",
  name: "support-apac",
};

describe("identity-schemas", () => {
  it("parses tenant/org/team rows with prefixed ids and hex tenants", () => {
    expect(
      tenantSchema.parse({ tenant_id: "68d5f4a1b2c3d4e5f6071829", slug: "default", name: "Default" })
    ).toMatchObject({ slug: "default", plan: "default", status: "active" });
    expect(
      organizationSchema.parse({ org_id: "org_abc123def456", tenant_id: "68d5f4a1b2c3d4e5f6071829", name: "Acme" })
    ).toMatchObject({ org_id: "org_abc123def456" });
    expect(teamSchema.parse(teamRow)).toMatchObject({ name: "support-apac" });
  });

  it("parses me/teams rows with or without the caller grant", () => {
    const withRole = teamWithRoleSchema.parse({ ...teamRow, role: "admin" });
    expect(withRole.role).toBe("admin");
    // Backend may omit the grant — falls back to the global role for display.
    expect(teamWithRoleSchema.parse(teamRow).role).toBeUndefined();
    expect(meTeamsSchema.parse([teamRow])).toHaveLength(1);
    expect(meTeamsSchema.parse([])).toEqual([]);
  });

  it("parses memberships with per-team roles", () => {
    expect(
      membershipSchema.parse({
        membership_id: "mem_abc123def456",
        user_id: "usr_1",
        team_id: "team_abc123def456",
        org_id: "org_abc123def456",
        tenant_id: "68d5f4a1b2c3d4e5f6071829",
        role: "member",
      }).role
    ).toBe("member");
  });

  it("validates create inputs (org defaulting stays server-side)", () => {
    expect(createTeamSchema.parse({ org_id: "org_1", name: "x" })).toMatchObject({ name: "x" });
    expect(() => createTeamSchema.parse({ org_id: "org_1", name: "" })).toThrow();
    expect(addMembershipSchema.parse({ user_id: "usr_1" })).toMatchObject({ role: "member" });
    expect(() => addMembershipSchema.parse({ user_id: "" })).toThrow();
  });
});

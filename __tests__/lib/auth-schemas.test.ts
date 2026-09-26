import { authMeSchema, userSchema } from "@/lib/schemas/auth";

const baseUser = {
  user_id: "usr_1",
  email: "owner@company.com",
  name: null,
  role: "owner",
  org_id: "default",
  disabled: false,
  created_at: "2026-09-26T00:00:00",
};

describe("auth-schemas", () => {
  it("parses pre-identity users without a tenant id", () => {
    expect(userSchema.parse(baseUser).tenant_id).toBeUndefined();
  });

  it("carries the Phase D tenant hex when present (spec 0040)", () => {
    expect(userSchema.parse({ ...baseUser, tenant_id: "68d5f4a1b2c3d4e5f6071829" }).tenant_id).toBe(
      "68d5f4a1b2c3d4e5f6071829"
    );
    expect(userSchema.parse({ ...baseUser, tenant_id: null }).tenant_id).toBeNull();
  });

  it("parses the session payload with embedded user", () => {
    const me = authMeSchema.parse({ user: { ...baseUser, tenant_id: "abc" }, scopes: ["admin"] });
    expect(me.user.tenant_id).toBe("abc");
    expect(me.scopes).toEqual(["admin"]);
  });
});

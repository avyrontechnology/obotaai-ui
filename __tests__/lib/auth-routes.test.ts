import { isPublicAuthPath, sanitizeReturnTo } from "@/lib/auth-routes";

describe("auth routes", () => {
  it("treats only the auth pages as public", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/signup")).toBe(true);
    expect(isPublicAuthPath("/accept-invite")).toBe(true);
    expect(isPublicAuthPath("/loginx")).toBe(false);
    expect(isPublicAuthPath("/agents")).toBe(false);
    expect(isPublicAuthPath("/")).toBe(false);
  });

  it("accepts only same-origin, non-auth return paths", () => {
    expect(sanitizeReturnTo("/agents/abc")).toBe("/agents/abc");
    expect(sanitizeReturnTo("/calls?agent=1")).toBe("/calls?agent=1");
    expect(sanitizeReturnTo("//evil.com")).toBeNull();
    expect(sanitizeReturnTo("/\\evil.com")).toBeNull();
    expect(sanitizeReturnTo("https://evil.com")).toBeNull();
    expect(sanitizeReturnTo("/signup")).toBeNull();
    expect(sanitizeReturnTo("/login")).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
  });
});

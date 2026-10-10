import {
  findDuplicateToolNames,
  slugifyProvider,
  validateHttpUrl,
  validateProviderName,
  type BuilderToolEntry,
} from "@/lib/integrations/builder-utils";

const tool = (overrides: Partial<BuilderToolEntry> = {}): BuilderToolEntry => ({
  key: 1,
  name: "create_issue",
  description: "",
  method: "POST",
  path: "/issues",
  parametersText: '{"type":"object"}',
  ...overrides,
});

describe("builder-utils", () => {
  it("slugifies provider names to registry ids", () => {
    expect(slugifyProvider("GitHub")).toBe("github");
    expect(slugifyProvider("  My Cool API  ")).toBe("my-cool-api");
    expect(slugifyProvider("a__b  c")).toBe("a-b-c");
    expect(slugifyProvider("!!!")).toBe("");
  });

  it("validates provider names with helpful messages", () => {
    expect(validateProviderName("")).not.toBeNull();
    expect(validateProviderName("a")).not.toBeNull();
    expect(validateProviderName("github")).toBeNull();
    expect(validateProviderName("my-api")).toBeNull();
    expect(validateProviderName("!!!")).not.toBeNull();
  });

  it("validates URLs, required or optional", () => {
    expect(validateHttpUrl("", { required: false, label: "Base URL" })).toBeNull();
    expect(validateHttpUrl("", { required: true, label: "Server URL" })).not.toBeNull();
    expect(validateHttpUrl("https://api.example.com", { required: true, label: "Server URL" })).toBeNull();
    expect(validateHttpUrl("not-a-url", { required: true, label: "Server URL" })).not.toBeNull();
    expect(validateHttpUrl("ftp://x.example.com", { required: true, label: "Server URL" })).not.toBeNull();
  });

  it("finds duplicate tool names case-insensitively", () => {
    expect(findDuplicateToolNames([tool(), tool({ key: 2, name: "other" })]).size).toBe(0);
    expect(findDuplicateToolNames([tool(), tool({ key: 2, name: "Create_Issue" })])).toEqual(
      new Set(["create_issue"])
    );
    expect(findDuplicateToolNames([tool({ name: " " }), tool({ key: 2, name: "" })]).size).toBe(0);
  });
});

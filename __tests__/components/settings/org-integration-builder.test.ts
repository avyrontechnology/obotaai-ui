import { parseParametersJson, validateToolEntry } from "@/components/settings/org-integration-builder";

describe("integration builder validation", () => {
  it("accepts empty parameters as an empty object", () => {
    expect(parseParametersJson("")).toEqual({ ok: true, value: {} });
    expect(parseParametersJson("   ")).toEqual({ ok: true, value: {} });
  });

  it("accepts JSON objects and rejects arrays, scalars, and bad JSON", () => {
    expect(parseParametersJson('{"type":"object"}')).toEqual({ ok: true, value: { type: "object" } });
    expect(parseParametersJson("[1]")).toEqual({ ok: false, error: expect.any(String) });
    expect(parseParametersJson("42")).toEqual({ ok: false, error: expect.any(String) });
    expect(parseParametersJson("{oops")).toEqual({ ok: false, error: expect.any(String) });
  });

  it("flags bad tool names, methods, paths, and schemas", () => {
    const base = { key: 1, name: "ok_name", description: "", method: "POST", path: "", parametersText: "{}" };
    expect(validateToolEntry(base)).toEqual([]);
    expect(validateToolEntry({ ...base, name: "bad name" })).toContain("name");
    expect(validateToolEntry({ ...base, name: "" })).toContain("name");
    expect(validateToolEntry({ ...base, method: "FETCH" })).toContain("method");
    expect(validateToolEntry({ ...base, path: "no-slash" })).toContain("path");
    expect(validateToolEntry({ ...base, parametersText: "{nope" })).toContain("parameters");
  });
});

import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const parsed = parseCsv("phone,name\n+911,Asha\n+912,Ravi");
    expect(parsed.headers).toEqual(["phone", "name"]);
    expect(parsed.rows).toEqual([
      { phone: "+911", name: "Asha" },
      { phone: "+912", name: "Ravi" },
    ]);
  });

  it("handles quoted commas and escaped quotes", () => {
    const parsed = parseCsv('phone,note\n+911,"called, said ""hi"""');
    expect(parsed.rows).toEqual([{ phone: "+911", note: 'called, said "hi"' }]);
  });

  it("skips blank lines and trims whitespace", () => {
    const parsed = parseCsv("phone\n\n  +911  \n");
    expect(parsed.rows).toEqual([{ phone: "+911" }]);
  });

  it("throws on missing headers or ragged rows", () => {
    expect(() => parseCsv("")).toThrow();
    expect(() => parseCsv("phone\n+911\n+912,Ravi")).toThrow();
  });
});

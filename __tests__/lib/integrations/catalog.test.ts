import {
  ADD_GROUPS,
  KINDS,
  OTHER_KINDS,
  PRODUCTIVITY_KINDS,
  TELEPHONY_KINDS,
  filterKindsByCategory,
  getCategoryForKind,
} from "@/lib/integrations/catalog";

describe("integrations catalog", () => {
  it("covers every kind exactly once across telephony/productivity/other", () => {
    const grouped = [...TELEPHONY_KINDS, ...PRODUCTIVITY_KINDS, ...OTHER_KINDS];
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...KINDS].sort());
  });

  it("maps kinds to the right hub category", () => {
    expect(getCategoryForKind("twilio")).toBe("telephony");
    expect(getCategoryForKind("sip")).toBe("telephony");
    expect(getCategoryForKind("talko")).toBe("telephony");
    expect(getCategoryForKind("calcom")).toBe("productivity");
    expect(getCategoryForKind("n8n")).toBe("productivity");
    expect(getCategoryForKind("truecaller")).toBe("other");
  });

  it("filters kinds for hub tabs", () => {
    expect(filterKindsByCategory(KINDS, "all")).toEqual(KINDS);
    expect(filterKindsByCategory(KINDS, "telephony")).toEqual(TELEPHONY_KINDS);
    expect([...filterKindsByCategory(KINDS, "productivity")].sort()).toEqual(
      [...PRODUCTIVITY_KINDS, ...OTHER_KINDS].sort()
    );
    expect(filterKindsByCategory(KINDS, "developers")).toEqual([]);
  });

  it("keeps picker groups inside the catalog", () => {
    const groupedKinds = ADD_GROUPS.flatMap((g) => g.kinds);
    expect(new Set(groupedKinds).size).toBe(groupedKinds.length);
    for (const kind of groupedKinds) {
      expect(KINDS).toContain(kind);
    }
  });
});

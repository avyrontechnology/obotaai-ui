import { visibleGroupsFor, visibleSectionLabels } from "@/components/settings/sections";

describe("configure section visibility", () => {
  it("shows the full pipeline for voice agents", () => {
    const labels = visibleSectionLabels("voice");
    expect(labels).toEqual(
      expect.arrayContaining([
        "Persona & Languages",
        "Transcriber (STT)",
        "Voice (TTS / Realtime)",
        "LLM",
        "Tools · /tools",
        "Knowledge · /knowledgebases",
        "Call Behavior",
        "Inbound · /inbound",
        "Webhooks · /webhooks",
      ])
    );
  });

  it("hides transcriber, voice and llm blocks for s2s agents", () => {
    const labels = visibleSectionLabels("s2s");
    // Core pipeline blocks the s2s record never carries.
    expect(labels).not.toContain("Transcriber (STT)");
    expect(labels).not.toContain("LLM");
    // S2S voice config stays; platform panels stay for every type.
    expect(labels).toContain("Voice (TTS / Realtime)");
    expect(labels).toContain("Persona & Languages");
    expect(labels).toContain("Tools · /tools");
    expect(labels).toContain("Knowledge · /knowledgebases");
    expect(labels).toContain("Call Behavior");
    expect(labels).toContain("Inbound · /inbound");
    expect(labels).toContain("Webhooks · /webhooks");
  });

  it("hides voice pipeline blocks for text agents but keeps the llm", () => {
    const labels = visibleSectionLabels("text");
    expect(labels).not.toContain("Transcriber (STT)");
    expect(labels).not.toContain("Voice (TTS / Realtime)");
    expect(labels).toContain("LLM");
    expect(labels).toContain("Call Behavior");
  });

  it("drops groups left empty", () => {
    expect(visibleGroupsFor("s2s").every((group) => group.sections.length > 0)).toBe(true);
  });

  it("shows every section for unknown types instead of an empty sidebar", () => {
    // An empty group list + tab clamp looped setState forever ("too many
    // re-renders"); unknown types degrade to the full section list.
    const labels = visibleSectionLabels("other");
    expect(labels).toContain("Persona & Languages");
    expect(labels).toContain("Transcriber (STT)");
    expect(labels).toContain("LLM");
    expect(labels).toContain("Voice (TTS / Realtime)");
  });
});

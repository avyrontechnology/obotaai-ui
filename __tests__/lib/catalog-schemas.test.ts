import {
  catalogModalitiesSchema,
  catalogModelSummarySchema,
  catalogModelsSchema,
  catalogProviderSummarySchema,
  catalogVoiceSummarySchema,
  catalogVoicesSchema,
  normalizeCatalogModels,
} from "@/lib/schemas/catalog";

describe("catalog-schemas", () => {
  it("parses the modalities payload", () => {
    expect(catalogModalitiesSchema.parse(["asr", "tts", "s2s", "llm"])).toEqual([
      "asr",
      "tts",
      "s2s",
      "llm",
    ]);
  });

  it("parses provider summaries with model counts", () => {
    const parsed = catalogProviderSummarySchema.parse({ provider: "deepgram", models: 2 });
    expect(parsed.provider).toBe("deepgram");
    expect(parsed.models).toBe(2);
    expect(parsed.deprecated).toBe(false);
  });

  it("parses model summaries mirroring the backend wire shape", () => {
    // Mirrors voiceai/modules/catalog/schemas.py::ModelSummary.
    const parsed = catalogModelSummarySchema.parse({
      catalog_id: "tts:elevenlabs:eleven_turbo_v2_5",
      modality: "tts",
      provider: "elevenlabs",
      model: "eleven_turbo_v2_5",
      languages: ["en", "hi"],
      models_open: true,
      deprecated: false,
    });
    expect(parsed.catalog_id).toBe("tts:elevenlabs:eleven_turbo_v2_5");
    expect(parsed.models_open).toBe(true);
  });

  it("normalizes both the bare items array and the enveloped shape", () => {
    const row = {
      catalog_id: "asr:deepgram:nova-3",
      modality: "asr",
      provider: "deepgram",
      model: "nova-3",
      languages: ["en", "hi"],
      models_open: true,
      deprecated: false,
    };
    // apiClient unwraps { ok, data } so hooks usually see the array directly.
    expect(normalizeCatalogModels([row])).toHaveLength(1);
    expect(normalizeCatalogModels({ items: [row], total: 1 })).toHaveLength(1);
    expect(() => catalogModelsSchema.parse({ items: "nope" })).toThrow();
  });

  it("parses voice summaries with optional sample URLs", () => {
    // Mirrors voiceai/modules/catalog/schemas.py::VoiceSummary.
    const withSample = catalogVoiceSummarySchema.parse({
      name: "Rachel",
      gender: "feminine",
      language: "en",
      sample_url: "https://cdn.example/rachel.mp3",
    });
    expect(withSample.sample_url).toContain("rachel.mp3");
    const bare = catalogVoicesSchema.parse([{ name: "anushka", language: "hi" }]);
    expect(bare[0].sample_url).toBeUndefined();
  });

  it("rejects unknown modalities and empty provider names", () => {
    expect(() => catalogModalitiesSchema.parse(["asr", "smoke"])).toThrow();
    expect(() => catalogProviderSummarySchema.parse({ provider: "", models: 1 })).toThrow();
  });
});

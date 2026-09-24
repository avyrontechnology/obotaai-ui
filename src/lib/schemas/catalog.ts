import { z } from "zod";

/** Zod mirror of voiceai/voiceai/modules/catalog/schemas.py + constants.py.
 *  Keep in sync. Backend spec 0022/0023: cascading builder dropdowns fed by
 *  GET /api/v1/catalog/*; unknown modality/provider answers 404 (never an
 *  empty dropdown for a typo); deprecated rows stay hidden from dropdown
 *  payloads but resolve by id for grandfathered agents.
 */

export const catalogModalitySchema = z.enum(["asr", "tts", "s2s", "llm"]);
export type CatalogModality = z.infer<typeof catalogModalitySchema>;

export const catalogModalitiesSchema = z.array(catalogModalitySchema);

export const catalogProviderSummarySchema = z.object({
  provider: z.string().min(1),
  models: z.number(),
  deprecated: z.boolean().default(false),
});
export type CatalogProvider = z.infer<typeof catalogProviderSummarySchema>;
export const catalogProvidersSchema = z.array(catalogProviderSummarySchema);

export const catalogModelSummarySchema = z.object({
  catalog_id: z.string().min(1),
  modality: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  languages: z.array(z.string()).default([]),
  models_open: z.boolean().default(false),
  deprecated: z.boolean().default(false),
});
export type CatalogModel = z.infer<typeof catalogModelSummarySchema>;

/** GET /catalog/models answers the paginated envelope; apiClient unwraps
 *  { ok, data } so the hook usually sees the items array directly. Accept
 *  both shapes here so the parser never breaks on envelope drift. */
export const catalogModelsSchema = z.union([
  z.array(catalogModelSummarySchema),
  z.object({ items: z.array(catalogModelSummarySchema) }).passthrough(),
]);
export function normalizeCatalogModels(raw: unknown): CatalogModel[] {
  const parsed = catalogModelsSchema.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export const catalogVoiceSummarySchema = z.object({
  name: z.string().min(1),
  gender: z.string().nullable().optional(),
  language: z.string().default("en"),
  sample_url: z.string().nullable().optional(),
});
export type CatalogVoice = z.infer<typeof catalogVoiceSummarySchema>;
export const catalogVoicesSchema = z.array(catalogVoiceSummarySchema);

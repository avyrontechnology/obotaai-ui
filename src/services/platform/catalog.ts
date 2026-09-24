import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  catalogModalitiesSchema,
  catalogProvidersSchema,
  catalogVoicesSchema,
  normalizeCatalogModels,
  type CatalogModality,
} from "@/lib/schemas/catalog";

/** Builder dropdowns bound to the provider catalog (backend spec 0022/0023).
 *
 *  Follows the `voices.ts` react-query pattern. Catalog data is static per
 *  deploy, so `staleTime: Infinity` and no invalidation. A 404 (unknown
 *  modality/provider, or an old backend without the endpoints) propagates to
 *  the caller — the form degrades to its free-text inputs (feature-detect,
 *  never version-gate).
 */

export const catalogKeys = {
  all: ["catalog"] as const,
  modalities: ["catalog", "modalities"] as const,
  providers: (modality: string) => ["catalog", "providers", { modality }] as const,
  models: (modality: string, provider?: string) =>
    ["catalog", "models", { modality, provider: provider ?? null }] as const,
  voices: (provider: string, model: string) =>
    ["catalog", "voices", { provider, model }] as const,
};

export function useCatalogModalities(enabled = true) {
  return useQuery({
    queryKey: catalogKeys.modalities,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/catalog/modalities");
      return catalogModalitiesSchema.parse(raw);
    },
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}

export function useCatalogProviders(modality: CatalogModality | string, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.providers(modality),
    queryFn: async () => {
      const raw = await apiClient<unknown>(
        `/catalog/providers?modality=${encodeURIComponent(modality)}`
      );
      return catalogProvidersSchema.parse(raw);
    },
    staleTime: Infinity,
    retry: false,
    enabled: enabled && modality.length > 0,
  });
}

export function useCatalogModels(
  modality: CatalogModality | string,
  provider?: string,
  enabled = true
) {
  return useQuery({
    queryKey: catalogKeys.models(modality, provider),
    queryFn: async () => {
      const params = new URLSearchParams({ modality });
      if (provider) params.set("provider", provider);
      const raw = await apiClient<unknown>(`/catalog/models?${params.toString()}`);
      return normalizeCatalogModels(raw);
    },
    staleTime: Infinity,
    retry: false,
    enabled: enabled && modality.length > 0,
  });
}

export function useCatalogVoices(provider: string, model: string, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.voices(provider, model),
    queryFn: async () => {
      const params = new URLSearchParams({ provider, model });
      const raw = await apiClient<unknown>(`/catalog/voices?${params.toString()}`);
      return catalogVoicesSchema.parse(raw);
    },
    staleTime: Infinity,
    retry: false,
    enabled: enabled && provider.length > 0 && model.length > 0,
  });
}

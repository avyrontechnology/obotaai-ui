import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  catalogKeys,
  useCatalogModalities,
  useCatalogModels,
  useCatalogProviders,
  useCatalogVoices,
} from "@/services/platform/catalog";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("catalog hooks", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exposes stable query keys", () => {
    expect(catalogKeys.modalities).toEqual(["catalog", "modalities"]);
    expect(catalogKeys.providers("tts")).toEqual(["catalog", "providers", { modality: "tts" }]);
    expect(catalogKeys.models("tts", "elevenlabs")).toEqual([
      "catalog",
      "models",
      { modality: "tts", provider: "elevenlabs" },
    ]);
    expect(catalogKeys.voices("sarvam", "bulbul:v2")).toEqual([
      "catalog",
      "voices",
      { provider: "sarvam", model: "bulbul:v2" },
    ]);
  });

  it("fetches modalities and parses the shape", async () => {
    mockedApiClient.mockResolvedValue(["asr", "tts", "s2s", "llm"]);
    const { result } = renderHook(() => useCatalogModalities(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/catalog/modalities");
    expect(result.current.data).toEqual(["asr", "tts", "s2s", "llm"]);
  });

  it("fetches providers per modality with the modality query", async () => {
    mockedApiClient.mockResolvedValue([{ provider: "deepgram", models: 2, deprecated: false }]);
    const { result } = renderHook(() => useCatalogProviders("asr"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/catalog/providers?modality=asr");
    expect(result.current.data?.[0].provider).toBe("deepgram");
  });

  it("propagates 404s so the form can degrade to free-text inputs", async () => {
    mockedApiClient.mockRejectedValue(new ApiError("Unknown modality", 404));
    const { result } = renderHook(() => useCatalogProviders("smoke"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("fetches models narrowed by provider", async () => {
    mockedApiClient.mockResolvedValue([
      {
        catalog_id: "tts:sarvam:bulbul:v2",
        modality: "tts",
        provider: "sarvam",
        model: "bulbul:v2",
        languages: ["en", "hi"],
        models_open: false,
        deprecated: false,
      },
    ]);
    const { result } = renderHook(() => useCatalogModels("tts", "sarvam"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/catalog/models?modality=tts&provider=sarvam");
    expect(result.current.data?.[0].model).toBe("bulbul:v2");
  });

  it("fetches voices with sample URLs for the sample button", async () => {
    mockedApiClient.mockResolvedValue([
      { name: "anushka", gender: null, language: "hi", sample_url: null },
    ]);
    const { result } = renderHook(() => useCatalogVoices("sarvam", "bulbul:v2"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/catalog/voices?provider=sarvam&model=bulbul%3Av2");
    expect(result.current.data?.[0].name).toBe("anushka");
  });

  it("stays disabled without provider/model", () => {
    const { result } = renderHook(() => useCatalogVoices("", ""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApiClient).not.toHaveBeenCalled();
  });
});

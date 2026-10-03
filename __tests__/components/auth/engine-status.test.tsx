import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthNavbar } from "@/components/auth/auth-navbar";

describe("EngineStatus", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("probes the backend once for both navbar pills, even under StrictMode", async () => {
    const client = new QueryClient();
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <AuthNavbar />
        </QueryClientProvider>
      </StrictMode>
    );

    expect(await screen.findAllByText(/All Voice Engines Operational/)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/health\/live$/);
  });

  it("shows unreachable when the probe fails at the network level", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthNavbar />
      </QueryClientProvider>
    );

    expect(await screen.findAllByText("Voice Engines Unreachable")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

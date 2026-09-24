import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentWizard } from "@/components/dashboard/agent-wizard";

jest.mock("@/services/api", () => ({
  useCreateAgent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateAgent: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = jest.requireMock("@/lib/api-client").apiClient as jest.Mock;

const queryClient = new QueryClient();

function renderWizard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentWizard />
    </QueryClientProvider>
  );
}

describe("AgentWizard", () => {
  it("renders step 1 with the step pill and type cards", () => {
    renderWizard();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Voice Agent")).toBeInTheDocument();
    expect(screen.getByText("Text Assistant")).toBeInTheDocument();
    expect(screen.getByText("Realtime S2S")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent Name")).toBeInTheDocument();
  });

  it("blocks continue when the agent name is missing", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    // Still on step 1.
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("selects the architecture type and advances to the persona step", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText("Agent Name"), { target: { value: "Support Bot" } });
    fireEvent.click(screen.getByText("Realtime S2S"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("System Prompt")).toBeInTheDocument();
    // Completed step is clickable to go back.
    fireEvent.click(screen.getByRole("button", { name: /Identity/ }));
    expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("blocks toolchain continue on a short system prompt", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText("Agent Name"), { target: { value: "Support Bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 2 of 3");

    fireEvent.change(screen.getByLabelText("System Prompt"), { target: { value: "tiny" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Toolchain/ }));
    expect(
      await screen.findByText("System prompt must be at least 10 characters")
    ).toBeInTheDocument();
  });

  it("reaches the unchanged toolchain step with provider selects", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText("Agent Name"), { target: { value: "Support Bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 2 of 3");

    fireEvent.change(screen.getByLabelText("System Prompt"), {
      target: { value: "You are a helpful support assistant." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Toolchain/ }));

    await waitFor(() => expect(screen.getByText("Step 3 of 3")).toBeInTheDocument());
    expect(screen.getByText("Neural Toolchain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deploy Agent/ })).toBeInTheDocument();
  });

  it("binds toolchain providers to the catalog when the backend serves it", async () => {
    // Fresh client: earlier tests cache catalog failures on the shared one.
    const freshClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint === "/catalog/providers?modality=llm") {
        return Promise.resolve([
          { provider: "openai", models: 1, deprecated: false },
          { provider: "cohere", models: 1, deprecated: false },
        ]);
      }
      return Promise.reject(new Error("not mocked"));
    });
    render(
      <QueryClientProvider client={freshClient}>
        <AgentWizard />
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText("Agent Name"), { target: { value: "Support Bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 2 of 3");
    fireEvent.change(screen.getByLabelText("System Prompt"), {
      target: { value: "You are a helpful support assistant." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Toolchain/ }));
    await waitFor(() => expect(screen.getByText("Step 3 of 3")).toBeInTheDocument());

    // Live binding is visible: caption plus catalog-only option.
    expect(await screen.findByText(/Catalog · 2 providers/)).toBeInTheDocument();
    const llmSelect = screen.getByLabelText("LLM Provider") as HTMLSelectElement;
    expect(Array.from(llmSelect.options).map((o) => o.value)).toEqual(["openai", "cohere"]);
    mockedApiClient.mockReset();
  });

  it("clears a stale s2s model when the realtime provider changes", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText("Agent Name"), { target: { value: "Support Bot" } });
    fireEvent.click(screen.getByText("Realtime S2S"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Step 2 of 3");
    fireEvent.change(screen.getByLabelText("System Prompt"), {
      target: { value: "You are a helpful support assistant." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Toolchain/ }));
    await waitFor(() => expect(screen.getByText("Step 3 of 3")).toBeInTheDocument());

    const modelInput = screen.getByPlaceholderText("e.g. gpt-realtime-2.1") as HTMLInputElement;
    fireEvent.change(modelInput, { target: { value: "gpt-realtime-2.1-mini" } });
    fireEvent.change(screen.getByLabelText("Realtime Provider"), { target: { value: "gemini_live" } });

    await waitFor(() => expect(modelInput).toHaveValue(""));
  });
});

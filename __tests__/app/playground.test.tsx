import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlaygroundPage from "@/app/playground/page";

jest.mock("@/services/api", () => ({
  useAgents: () => ({
    data: [
      { agent_id: "voice-1", agent_name: "Voice Agent", agent_type: "voice", agent_config: {}, agent_prompts: {} },
      { agent_id: "text-1", agent_name: "Text Agent", agent_type: "text", agent_config: {}, agent_prompts: {} },
    ],
    isLoading: false,
  }),
}));

jest.mock("@/lib/rbac", () => ({
  useCan: () => true,
  minRoleFor: () => "member",
}));

jest.mock("@/components/playground/live-talk", () => ({
  LiveTalk: ({ agentName }: { agentName: string }) => <div>LiveTalk for {agentName}</div>,
}));

jest.mock("@/components/playground/chat-talk", () => ({
  ChatTalk: ({ agentName }: { agentName: string }) => <div>ChatTalk for {agentName}</div>,
}));

const searchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/playground",
}));

const queryClient = new QueryClient();

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <PlaygroundPage />
    </QueryClientProvider>
  );
}

describe("Playground page", () => {
  beforeEach(() => {
    searchParams.delete("agent");
    searchParams.delete("mode");
  });

  it("greets and shows the two-step picker with no simulation UI", () => {
    renderPage();
    expect(screen.getByText(/Good (morning|afternoon|evening)|Up late/)).toBeInTheDocument();
    expect(screen.getByText(/Pick an agent/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a mode/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Talk/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Chat/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Simulate" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Recipient phone number")).not.toBeInTheDocument();
    expect(screen.queryByText("Place call")).not.toBeInTheDocument();
    expect(screen.getByText("LiveTalk for Voice Agent")).toBeInTheDocument();
  });

  it("switches to chat and normalizes legacy simulate mode to talk", () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /Chat/ }));
    expect(screen.getByText("ChatTalk for Voice Agent")).toBeInTheDocument();
    expect(screen.queryByText(/LiveTalk/)).not.toBeInTheDocument();
  });

  it("disables Talk for text agents with a note", () => {
    searchParams.set("agent", "text-1");
    renderPage();
    expect(screen.queryByText(/LiveTalk/)).not.toBeInTheDocument();
    expect(screen.getByText("ChatTalk for Text Agent")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Talk/ })).toBeDisabled();
    expect(screen.getByText(/no audio pipeline/)).toBeInTheDocument();
  });

  it("deep-links an agent and chat mode from the URL", () => {
    searchParams.set("agent", "voice-1");
    searchParams.set("mode", "chat");
    renderPage();
    expect(screen.getByText("ChatTalk for Voice Agent")).toBeInTheDocument();
  });

  it("normalizes legacy simulate and live modes to talk", () => {
    searchParams.set("mode", "simulate");
    const { unmount } = renderPage();
    expect(screen.getByText("LiveTalk for Voice Agent")).toBeInTheDocument();
    unmount();
    searchParams.set("mode", "live");
    renderPage();
    expect(screen.getByText("LiveTalk for Voice Agent")).toBeInTheDocument();
  });

  it("remembers picked agents in the Continuing strip and resumes them", () => {
    renderPage();
    expect(screen.queryByText("Continuing")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Agent to test with"), { target: { value: "text-1" } });
    // Text agent forces chat; the strip keeps the picked (talk) setup.
    expect(screen.getByText("Continuing")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: /Text Agent/ });
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(screen.getByText("ChatTalk for Text Agent")).toBeInTheDocument();
  });
});

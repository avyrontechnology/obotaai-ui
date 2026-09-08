import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JitterPanel,
  SessionTabs,
  ToolsPanel,
  TranscriptList,
  type SessionTurn,
} from "@/components/playground/session-ui";
import { emitPlaygroundBus, subscribePlaygroundBus } from "@/lib/playground-bus";

jest.mock("@/services/platform/tools", () => ({
  useAgentTools: () => ({
    data: [
      { tool_id: "t1", name: "book_appointment", kind: "function", enabled: true },
      { tool_id: "t2", name: "legacy_lookup", kind: "function", enabled: false },
    ],
    isLoading: false,
  }),
}));

const turns: SessionTurn[] = [
  { id: 1, role: "system", text: "Connected.", ts: "10:00" },
  { id: 2, role: "user", text: "Hello there", ts: "10:01" },
  { id: 3, role: "agent", text: "Hi, how can I help?", ts: "10:01" },
];

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

describe("SessionTabs", () => {
  it("switches tabs and clears via the bus-style callback", () => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    render(<SessionTabs tab="transcript" onChange={onChange} onClear={onClear} />);
    expect(screen.getByRole("tab", { name: /Live Transcript/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /Tools/ }));
    expect(onChange).toHaveBeenCalledWith("tools");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("honors a tab subset for chat mode", () => {
    render(<SessionTabs tab="tools" onChange={() => {}} onClear={() => {}} tabs={["tools", "jitter"]} />);
    expect(screen.queryByRole("tab", { name: /Live Transcript/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Jitter/ })).toBeInTheDocument();
  });
});

describe("TranscriptList", () => {
  it("shows the empty hint and then labelled turns", () => {
    const { rerender } = render(<TranscriptList turns={[]} emptyHint="Press start" />);
    expect(screen.getByText("Press start")).toBeInTheDocument();
    rerender(<TranscriptList turns={turns} emptyHint="Press start" />);
    expect(screen.queryByText("Press start")).not.toBeInTheDocument();
    expect(screen.getByText("Connected.")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi, how can I help?")).toBeInTheDocument();
  });

  it("autoscrolls while pinned and offers a pill when reading history", () => {
    const { rerender } = render(<TranscriptList turns={turns} emptyHint="Press start" />);
    const list = screen.getByTestId("transcript-list");
    const scrollTo = jest.fn();
    (list as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

    // Pinned: a new arrival scrolls to the bottom, no pill.
    rerender(
      <TranscriptList
        turns={[...turns, { id: 4, role: "agent", text: "Anything else?", ts: "10:02" }]}
        emptyHint="Press start"
      />
    );
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
    expect(screen.queryByRole("button", { name: /New messages/ })).not.toBeInTheDocument();

    // Scrolled up: unpins, and the next arrival raises the pill instead.
    scrollTo.mockClear();
    Object.defineProperties(list, {
      scrollHeight: { value: 500, configurable: true },
      clientHeight: { value: 100, configurable: true },
    });
    list.scrollTop = 0;
    fireEvent.scroll(list);
    rerender(
      <TranscriptList
        turns={[
          ...turns,
          { id: 4, role: "agent", text: "Anything else?", ts: "10:02" },
          { id: 5, role: "agent", text: "Still here?", ts: "10:03" },
        ]}
        emptyHint="Press start"
      />
    );
    expect(scrollTo).not.toHaveBeenCalled();
    const pill = screen.getByRole("button", { name: /New messages/ });
    expect(pill).toBeInTheDocument();

    // Jumping back down re-pins and clears the pill.
    fireEvent.click(pill);
    expect(scrollTo).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /New messages/ })).not.toBeInTheDocument();
  });
});

describe("ToolsPanel", () => {
  it("lists tools with an off badge for disabled ones", () => {
    renderWithClient(<ToolsPanel agentId="agent-1" />);
    expect(screen.getByText("book_appointment")).toBeInTheDocument();
    expect(screen.getByText("legacy_lookup")).toBeInTheDocument();
    expect(screen.getByText("off")).toBeInTheDocument();
  });
});

describe("JitterPanel", () => {
  it("shows measured stats and a dash for audio-only jitter on text turns", () => {
    render(
      <JitterPanel
        stats={{ e2eMs: 1234, jitterMs: null, turns: 3, elapsedSec: 65, deviceRate: 48000, playedChunks: 12 }}
        hasAudio={false}
      />
    );
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("01:05")).toBeInTheDocument();
    expect(screen.getByText("48kHz")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/text-only turns/)).toBeInTheDocument();
  });
});

describe("playground bus", () => {
  it("delivers events to subscribers and unsubscribes cleanly", () => {
    const seen: string[] = [];
    const unsubscribe = subscribePlaygroundBus((event) => {
      seen.push(event.type);
    });
    emitPlaygroundBus({ type: "send-text", text: "hi" });
    emitPlaygroundBus({ type: "clear-transcript" });
    unsubscribe();
    emitPlaygroundBus({ type: "clear-transcript" });
    expect(seen).toEqual(["send-text", "clear-transcript"]);
  });
});

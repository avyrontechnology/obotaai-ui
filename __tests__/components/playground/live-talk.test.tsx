import { render, screen, fireEvent, act } from "@testing-library/react";
import { LiveTalk } from "@/components/playground/live-talk";
import { combineLevels } from "@/components/playground/voice-waveform";

jest.mock("@/services/platform/tools", () => ({
  useAgentTools: () => ({ data: [], isLoading: false }),
}));

type Handler = (event: unknown) => void;

class MockSocket {
  static instances: MockSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: Handler | null = null;
  onmessage: Handler | null = null;
  onerror: Handler | null = null;
  onclose: Handler | null = null;

  constructor(public url: string) {
    MockSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({});
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
}

function mockAudioStack() {
  const gainNode = () => ({ gain: { value: 1 }, connect: jest.fn() });
  class MockAudioContext {
    state = "running";
    destination = {};
    close = jest.fn().mockResolvedValue(undefined);
    audioWorklet = { addModule: jest.fn().mockResolvedValue(undefined) };
    resume = jest.fn().mockResolvedValue(undefined);
    createMediaStreamSource = jest.fn(() => ({ connect: jest.fn() }));
    createAnalyser = jest.fn(() => ({
      fftSize: 512,
      frequencyBinCount: 4,
      getByteTimeDomainData: jest.fn(),
      getByteFrequencyData: jest.fn(),
      connect: jest.fn(),
    }));
    createGain = jest.fn(gainNode);
  }
  class MockWorkletNode {
    port: { onmessage: Handler | null } = { onmessage: null };
    connect = jest.fn();
    disconnect = jest.fn();
  }
  Object.defineProperty(window, "AudioContext", { value: MockAudioContext, configurable: true });
  (globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = MockWorkletNode;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [] }) },
    configurable: true,
  });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = jest.fn(() => 0);
  (globalThis as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:fake-worklet");
  URL.revokeObjectURL = jest.fn();
}

describe("LiveTalk session orb", () => {
  beforeEach(() => {
    MockSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockSocket;
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error("no backend"));
    mockAudioStack();
  });

  afterEach(() => {
    delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    jest.restoreAllMocks();
  });

  async function startLive() {
    render(<LiveTalk agentId="agent-1" agentName="Test Agent" canTalk />);
    fireEvent.click(screen.getByRole("button", { name: /Start talking/ }));
    await act(async () => {});
    const socket = MockSocket.instances[0];
    act(() => socket.open());
    return socket;
  }

  it("shows no waves before the session is live", () => {
    render(<LiveTalk agentId="agent-1" agentName="Test Agent" canTalk />);
    expect(screen.queryAllByTestId("session-wave")).toHaveLength(0);
  });

  it("keeps the session card fixed-size with every control reachable", () => {
    render(<LiveTalk agentId="agent-1" agentName="Test Agent" canTalk />);
    const card = screen.getByTestId("session-card");
    expect(card.className).toContain("overflow-hidden");
    expect(card.className).not.toContain("overflow-y-auto");
    // Header, orb, start control, intents and injection input — no scroll needed.
    expect(screen.getByText(/Live session/)).toBeInTheDocument();
    expect(screen.getByTestId("session-orb")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start talking/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Suggested intents/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Type a message to the agent")).toBeInTheDocument();
  });

  it("expands three waves while talking", async () => {
    await startLive();
    expect(screen.getByTestId("session-orb")).toHaveAttribute("data-live", "true");
    expect(screen.getAllByTestId("session-wave")).toHaveLength(3);
  });

  it("keeps the waves when the mic is muted mid-call", async () => {
    await startLive();
    fireEvent.click(screen.getByRole("button", { name: /Mute microphone/ }));
    expect(screen.getAllByTestId("session-wave")).toHaveLength(3);
  });

  it("renders a recorder flatline inside the orb, lit while live", async () => {
    const idle = render(<LiveTalk agentId="agent-1" agentName="Test Agent" canTalk />);
    // Compact density for the smaller orb.
    expect(screen.getByTestId("voice-waveform").children).toHaveLength(12);
    idle.unmount();
    await startLive();
    // rAF never fires in jsdom, so levels stay at the resting flatline —
    // the point is the bars exist inside the live (white) orb.
    expect(screen.getByTestId("voice-waveform").children).toHaveLength(12);
  });
});

describe("combineLevels", () => {
  const silent = new Uint8Array(256);

  it("rests at the floor when both sides are quiet", () => {
    expect(combineLevels(silent, silent, true)).toHaveLength(18);
    expect(combineLevels(silent, silent, true).every((level) => level < 0.1)).toBe(true);
  });

  it("lifts bars from mic energy, or agent energy while muted", () => {
    const hot = new Uint8Array(256).fill(230);
    expect(Math.max(...combineLevels(hot, silent, true))).toBeGreaterThan(0.5);
    // Muted mic contributes nothing…
    expect(combineLevels(hot, silent, false).every((level) => level < 0.1)).toBe(true);
    // …but agent playback still moves the bars.
    expect(Math.max(...combineLevels(silent, hot, false))).toBeGreaterThan(0.5);
  });
});

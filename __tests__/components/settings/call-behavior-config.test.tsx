import { fireEvent, render, screen, act } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { CallBehaviorConfigForm } from "@/components/settings/call-behavior-config";
import { JsonTextField } from "@/components/settings/json-text-field";

function renderBehavior({
  defaults = {},
  onSubmit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaults?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit?: (data: any) => void;
} = {}) {
  function Host() {
    const methods = useForm({ defaultValues: defaults });
    return (
      <FormProvider {...methods}>
        <form onSubmit={onSubmit ? methods.handleSubmit(onSubmit) : undefined}>
          <CallBehaviorConfigForm />
          <button type="submit">Save</button>
        </form>
      </FormProvider>
    );
  }
  return render(<Host />);
}

function renderJsonField({
  defaultValue,
  onSubmit,
}: {
  defaultValue?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => void;
}) {
  function Host() {
    const methods = useForm({ defaultValues: { msg: defaultValue } });
    return (
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <JsonTextField name="msg" label="Message" />
          <button type="submit">Save</button>
        </form>
      </FormProvider>
    );
  }
  return render(<Host />);
}

describe("CallBehaviorConfigForm", () => {
  it("removes the ambient noise switch but keeps the other realism switches", () => {
    renderBehavior();
    expect(screen.queryByRole("switch", { name: "Ambient Noise" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ambient Noise")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Optimize Latency" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Use Fillers" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Backchanneling" })).toBeInTheDocument();
  });

  it("renders the Call Capture recording switch with a call-record note", () => {
    renderBehavior();
    expect(screen.getByText("Call Capture")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Record Calls" })).toBeInTheDocument();
    expect(screen.getByText(/artifact lands on the call record/i)).toBeInTheDocument();
  });

  it("renders promoted fields with ms-unit labels", () => {
    renderBehavior({
      defaults: { agent_config: { conversation: { check_if_user_online: true } } },
    });
    expect(screen.getByLabelText("Welcome Message Delay (ms)")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Discard Pre-Welcome Utterance" })).toBeInTheDocument();
    expect(screen.getByLabelText("Language Injection Mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Language Instruction Template")).toBeInTheDocument();
    expect(screen.getByLabelText("Hangup Message")).toBeInTheDocument();
    expect(screen.getByLabelText("End Call Tool Mode")).toBeInTheDocument();
    // check_user_online_message is gated behind the presence switch.
    expect(screen.getByLabelText("Check Message")).toBeInTheDocument();
  });

  it("renders a dict-valued hangup message without crashing and round-trips it", async () => {
    const dict = { en: "Goodbye!", hi: "Alvida!" };
    const onSubmit = jest.fn();
    renderBehavior({
      defaults: { agent_config: { conversation: { call_hangup_message: dict } } },
      onSubmit,
    });
    const input = screen.getByLabelText("Hangup Message") as HTMLInputElement;
    expect(input.value).toBe(JSON.stringify(dict));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].agent_config.conversation.call_hangup_message).toEqual(dict);
  });

  it("renders a legacy dict check_user_online_message without crashing", () => {
    const dict = { en: "Are you still there?" };
    renderBehavior({
      defaults: {
        agent_config: {
          conversation: { check_if_user_online: true, check_user_online_message: dict },
        },
      },
    });
    const input = screen.getByLabelText("Check Message") as HTMLInputElement;
    expect(input.value).toBe(JSON.stringify(dict));
  });

  it("carries the voice + web copy for Max Call Duration with placeholder 90", () => {
    renderBehavior();
    const input = screen.getByLabelText("Max Call Duration (s)") as HTMLInputElement;
    expect(input.placeholder).toBe("90");
    expect(screen.getByText(/applies to voice \+ web calls, default 90s/i)).toBeInTheDocument();
  });

  it("leaves the interruption backoff copy alone", () => {
    renderBehavior();
    expect(screen.getByLabelText("Interruption Backoff (ms)")).toBeInTheDocument();
    expect(screen.getByText("Pause duration after the agent is interrupted")).toBeInTheDocument();
  });

  it("offers primary end-call tool modes with placeholder-unset", async () => {
    const onSubmit = jest.fn();
    renderBehavior({ onSubmit });
    const select = screen.getByLabelText("End Call Tool Mode") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Primary with Shadow Hangup" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "primary_with_shadow_hangup" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit.mock.calls[0][0].agent_config.conversation.end_call_tool_mode).toBe(
      "primary_with_shadow_hangup"
    );
  });
});

describe("JsonTextField", () => {
  it("round-trips a plain string", async () => {
    const onSubmit = jest.fn();
    renderJsonField({ defaultValue: "hello", onSubmit });
    const input = screen.getByLabelText("Message") as HTMLInputElement;
    expect(input.value).toBe("hello");
    fireEvent.change(input, { target: { value: "bye" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit.mock.calls[0][0].msg).toBe("bye");
  });

  it("displays a dict as JSON and parses edits back to an object", async () => {
    const onSubmit = jest.fn();
    renderJsonField({ defaultValue: { en: "hi" }, onSubmit });
    const input = screen.getByLabelText("Message") as HTMLInputElement;
    expect(input.value).toBe(JSON.stringify({ en: "hi" }));
    fireEvent.change(input, { target: { value: '{"es":"hola"}' } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit.mock.calls[0][0].msg).toEqual({ es: "hola" });
  });

  it("keeps invalid JSON as raw text so typing never wipes", async () => {
    const onSubmit = jest.fn();
    renderJsonField({ defaultValue: "", onSubmit });
    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "{oops" } });
    expect(input.value).toBe("{oops");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit.mock.calls[0][0].msg).toBe("{oops");
  });

  it("clears an empty input to undefined", async () => {
    const onSubmit = jest.fn();
    renderJsonField({ defaultValue: "hello", onSubmit });
    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit.mock.calls[0][0].msg).toBeUndefined();
  });
});

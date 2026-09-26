import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { ChannelSwitcher } from "@/components/settings/channel-config";

interface SwitcherDefaults {
  agent_type: string;
  channels: string[];
}

function renderSwitcher({
  agentType = "voice",
  defaults = { agent_type: "voice", channels: ["voice"] },
  problems = [],
}: {
  agentType?: string;
  defaults?: SwitcherDefaults;
  problems?: string[];
} = {}) {
  function TypeProbe() {
    const { control } = useFormContext();
    const value = useWatch({ control, name: "agent_type" }) as string | undefined;
    return <span data-testid="type-probe">{value ?? "∅"}</span>;
  }
  function ChannelsProbe() {
    const { control } = useFormContext();
    const value = useWatch({ control, name: "channels" }) as unknown;
    return <span data-testid="channels-probe">{JSON.stringify(value ?? null)}</span>;
  }
  function Host() {
    const methods = useForm({ defaultValues: defaults });
    return (
      <FormProvider {...methods}>
        <ChannelSwitcher agentId="a1" agentType={agentType} problems={problems} />
        <TypeProbe />
        <ChannelsProbe />
      </FormProvider>
    );
  }
  return render(<Host />);
}

describe("ChannelSwitcher", () => {
  it("type selector writes agent_type at the form root", () => {
    renderSwitcher();
    expect(screen.getByTestId("type-probe")).toHaveTextContent("voice");
    expect(screen.getByRole("button", { name: /Voice agent type/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /Text agent type/ }));
    expect(screen.getByTestId("type-probe")).toHaveTextContent("text");
    expect(screen.getByRole("button", { name: /Text agent type/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /Voice agent type/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    // Clicking the active type is a no-op (stays staged to text, never unset).
    fireEvent.click(screen.getByRole("button", { name: /Text agent type/ }));
    expect(screen.getByTestId("type-probe")).toHaveTextContent("text");
  });

  it("channel checkboxes stage channels and enforce at-least-one (never [])", () => {
    renderSwitcher();
    const voice = screen.getByRole("checkbox", { name: "Voice channel" });
    const chat = screen.getByRole("checkbox", { name: "Chat channel" });
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice"]');

    // Unchecking the last channel is a no-op — the backend rejects [].
    fireEvent.click(voice);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice"]');
    expect(voice).toBeChecked();

    // Hybrid: both checked stages ["voice","chat"].
    fireEvent.click(chat);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice","chat"]');
    expect(screen.getByText(/voice \+ chat \(hybrid\)/)).toBeInTheDocument();

    fireEvent.click(voice);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["chat"]');

    // Down to the last channel again — no-op, never [].
    fireEvent.click(chat);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["chat"]');
    expect(chat).toBeChecked();
  });

  it("dedupes channel selections", () => {
    renderSwitcher({ defaults: { agent_type: "voice", channels: ["voice", "voice"] } });
    // Adding chat collapses the duplicate voice instead of emitting 3 entries.
    fireEvent.click(screen.getByRole("checkbox", { name: "Chat channel" }));
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice","chat"]');
  });

  it("shows the staged banner on divergence and hides it when back in sync", () => {
    renderSwitcher({ defaults: { agent_type: "voice", channels: ["voice", "chat"] } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Text agent type/ }));
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Staged changes pending save.");
    expect(banner).toHaveTextContent("Type: voice → text");

    // Reverting the type clears the type line but the banner stays: channels
    // still match here, so unstage fully by reverting — banner disappears.
    fireEvent.click(screen.getByRole("button", { name: /Voice agent type/ }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // Channels divergence stages the banner on its own.
    fireEvent.click(screen.getByRole("checkbox", { name: "Chat channel" }));
    const channelBanner = screen.getByRole("status");
    expect(channelBanner).toHaveTextContent("Staged changes pending save.");
    expect(channelBanner).toHaveTextContent("Channels: voice + chat → voice");
  });

  it("renders write-time channel problems in an alert box", () => {
    renderSwitcher({ problems: ["tasks[0].channels[0]: rejected channel 'sms'"] });
    expect(screen.getByRole("alert")).toHaveTextContent("rejected channel");
  });

  it("renders null for unknown agent types", () => {
    function Host() {
      const methods = useForm({
        defaultValues: { agent_type: "other", channels: ["voice"] },
      });
      return (
        <FormProvider {...methods}>
          <ChannelSwitcher agentId="a1" agentType="other" />
        </FormProvider>
      );
    }
    const { container } = render(<Host />);
    expect(container.firstChild).toBeNull();
  });
});

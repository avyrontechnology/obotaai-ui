import { act, fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { TextEncoder as NodeTextEncoder } from "util";
import { ExtensionsEditor } from "@/components/settings/extensions-editor";

// PRODUCTION BUG (loud, reported — not worked around in assertions):
// src/components/settings/extensions-editor.tsx:81 calls `new TextEncoder()`
// at render for every extension row (byte-size hint). Browsers ship
// TextEncoder natively so production is unaffected, but the jsdom test env
// does not expose it on the global and the component crashes with
// `ReferenceError: TextEncoder is not defined` whenever ≥1 row renders.
// jest.setup.ts (not owned by this track) has no polyfill, so this file pins
// one locally. If more components rely on Web APIs, promote this to
// jest.setup.ts. NEVER edit src/ from this track.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = NodeTextEncoder as typeof TextEncoder;
}

/**
 * ExtensionsEditor tests (backend spec 0043 UI contracts).
 *
 * Contract (src/components/settings/extensions-editor.tsx, Dev B):
 * - No props; reads/writes the RHF form path
 *   `agent_config.conversation.extensions` via useFormContext.
 * - Deletion is plain key removal from form state (no tracking field); the
 *   PATCH save layer diffs against the initially loaded keys to derive
 *   `clear_extensions`.
 * - Key syntax is fast-feedback only (server authoritative); invalid JSON
 *   values never reach form state.
 */
function renderEditor({
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
          <ExtensionsEditor />
          <button type="submit">Save</button>
        </form>
      </FormProvider>
    );
  }
  return render(<Host />);
}

describe("extensions editor", () => {
  it("renders with initial extensions", () => {
    renderEditor({
      defaults: {
        agent_config: {
          conversation: { extensions: { tenant_flag: "beta", max_retries: 3 } },
        },
      },
    });
    expect(screen.getByText("tenant_flag")).toBeInTheDocument();
    expect(screen.getByText("max_retries")).toBeInTheDocument();
    // Strings render raw; numbers render as JSON.
    expect(
      (screen.getByLabelText("Value for extension tenant_flag (JSON)") as HTMLTextAreaElement)
        .value
    ).toBe("beta");
    expect(
      (screen.getByLabelText("Value for extension max_retries (JSON)") as HTMLTextAreaElement)
        .value
    ).toBe("3");
  });

  it("shows a key validation message on bad syntax and adds nothing", () => {
    renderEditor({
      defaults: { agent_config: { conversation: { extensions: {} } } },
    });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "bad key!" } });
    fireEvent.change(screen.getByLabelText("Value (JSON)"), { target: { value: '"ok"' } });
    fireEvent.click(screen.getByRole("button", { name: "Add key" }));
    expect(
      screen.getByText(
        "Letters, digits, underscore only; must start with a letter; max 64 chars."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Value for extension bad key! (JSON)")
    ).not.toBeInTheDocument();
  });

  it("delete button removes the row (plain key removal, no tracking field)", async () => {
    const onSubmit = jest.fn();
    renderEditor({
      defaults: {
        agent_config: { conversation: { extensions: { tenant_flag: "beta" } } },
      },
      onSubmit,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete extension tenant_flag" })
    );
    expect(screen.queryByText("tenant_flag")).not.toBeInTheDocument();
    expect(screen.getByText(/No custom extensions yet/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].agent_config.conversation.extensions).toEqual({});
  });

  it("JSON-invalid value blocks write with inline error and keeps the last good value", async () => {
    const onSubmit = jest.fn();
    renderEditor({
      defaults: {
        agent_config: { conversation: { extensions: { tenant_flag: "beta" } } },
      },
      onSubmit,
    });
    const valueField = screen.getByLabelText(
      "Value for extension tenant_flag (JSON)"
    ) as HTMLTextAreaElement;
    fireEvent.change(valueField, { target: { value: "{invalid" } });
    fireEvent.blur(valueField);
    expect(
      screen.getByText("Invalid JSON — fix it or the last saved value stays.")
    ).toBeInTheDocument();
    // The draft stays editable; the form still holds the last good value.
    expect(valueField.value).toBe("{invalid");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].agent_config.conversation.extensions).toEqual({
      tenant_flag: "beta",
    });
  });
});

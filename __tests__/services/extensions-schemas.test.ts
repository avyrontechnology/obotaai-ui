import { conversationSchema } from "@/lib/schemas/agent";
import type { AgentData } from "@/lib/schemas/agent";
import { toCreateAgentPayload } from "@/services/api-transforms";
import type { PatchAgentInput } from "@/services/api";

const baseData: AgentData = {
  agent_name: "Extensions Agent",
  agent_type: "voice",
  agent_prompts: { system_prompt: "You are a helpful assistant." },
  agent_config: {},
};

describe("extensions-schemas (spec 0043)", () => {
  it("accepts a string extension value", () => {
    const parsed = conversationSchema.parse({ extensions: { vendor_mode: "fast" } });
    expect(parsed.extensions).toEqual({ vendor_mode: "fast" });
  });

  it("accepts a dict extension value", () => {
    const parsed = conversationSchema.parse({
      extensions: { vendor_cfg: { retries: 3, nested: { deep: true } } },
    });
    expect(parsed.extensions).toEqual({ vendor_cfg: { retries: 3, nested: { deep: true } } });
  });

  it("accepts number/null/bool/array extension values", () => {
    const parsed = conversationSchema.parse({
      extensions: {
        count: 42,
        nothing: null,
        flag: true,
        list: [1, "two", false, null],
      },
    });
    expect(parsed.extensions).toEqual({
      count: 42,
      nothing: null,
      flag: true,
      list: [1, "two", false, null],
    });
  });

  it("accepts empty extensions and an absent key", () => {
    expect(conversationSchema.parse({ extensions: {} }).extensions).toEqual({});
    expect(conversationSchema.parse({}).extensions).toBeUndefined();
  });

  it("maps extensions through on the create payload", () => {
    const extensions = { vendor_mode: "fast", count: 3 };
    const payload = toCreateAgentPayload({
      ...baseData,
      agent_config: { conversation: { extensions } },
    });
    expect(payload.agent_config.tasks[0].task_config).toEqual(
      expect.objectContaining({ extensions })
    );
  });

  it("omits extensions from the create payload when unset", () => {
    const payload = toCreateAgentPayload(baseData);
    expect(payload.agent_config.tasks[0].task_config).not.toHaveProperty("extensions");
  });

  it("passes clear_extensions through PatchAgentInput untouched", () => {
    const patch: PatchAgentInput = {
      tasks_patch: [{ task_index: 0, clear_extensions: ["vendor_mode", "stale_key"] }],
    };
    // usePatchAgent sends the patch via JSON.stringify — round-trip it the
    // same way to prove the key survives serialization verbatim.
    const revived = JSON.parse(JSON.stringify(patch)) as PatchAgentInput;
    expect(revived.tasks_patch?.[0].clear_extensions).toEqual(["vendor_mode", "stale_key"]);
  });
});

import {
  chatHistorySchema,
  chatMessageSchema,
  chatSessionSchema,
  postChatBodySchema,
  SESSION_ID_HEADER,
  SSE_DONE_MARKER,
} from "@/lib/schemas/chat";

describe("chat-schemas", () => {
  it("mirrors the backend turn request shape (strict)", () => {
    // Mirrors voiceai/modules/chat/schemas.py::PostChatBody.
    expect(postChatBodySchema.parse({ message: "Hello" })).toEqual({ message: "Hello" });
    expect(postChatBodySchema.parse({ session_id: "ses_abc", message: "Hi again" })).toEqual({
      session_id: "ses_abc",
      message: "Hi again",
    });
    expect(() => postChatBodySchema.parse({ message: "" })).toThrow();
    expect(() => postChatBodySchema.parse({})).toThrow();
  });

  it("parses history rows mirroring the backend views", () => {
    // Mirrors ChatMessageView/ChatSessionView (ts serializes to string).
    const session = chatSessionSchema.parse({
      session_id: "ses_abc",
      agent_id: "agent-1",
      messages: [{ role: "user", content: "Hi", ts: "2026-09-26T00:00:00" }],
    });
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].role).toBe("user");
  });

  it("parses the history list envelope payload", () => {
    const parsed = chatHistorySchema.parse([
      { session_id: "ses_1", agent_id: "a1", messages: [] },
      {
        session_id: "ses_2",
        agent_id: "a1",
        messages: [{ role: "assistant", content: "Hey", ts: "2026-09-26T00:01:00" }],
      },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].messages[0].content).toBe("Hey");
  });

  it("rejects unknown message roles", () => {
    expect(() => chatMessageSchema.parse({ role: "system", content: "x", ts: "t" })).toThrow();
  });

  it("pins the SSE transport literals", () => {
    // Mirrors voiceai/modules/chat/constants.py (channel + framing).
    expect(SSE_DONE_MARKER).toBe("[DONE]");
    expect(SESSION_ID_HEADER).toBe("x-session-id");
  });
});

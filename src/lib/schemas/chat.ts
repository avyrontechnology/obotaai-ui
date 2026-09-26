import { z } from "zod";

/** Zod mirror of voiceai/voiceai/modules/chat/{schemas,constants}.py. Keep in sync.
 *
 *  Turn request, history rows, and the SSE terminal sentinel for the HTTP
 *  chat endpoint (specs 0038 + 0039).
 */

export const SSE_DONE_MARKER = "[DONE]";
export const SESSION_ID_HEADER = "x-session-id";

export const postChatBodySchema = z.object({
  session_id: z.string().min(1).optional(),
  message: z.string().min(1),
});
export type PostChatBody = z.infer<typeof postChatBodySchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  ts: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatSessionSchema = z.object({
  session_id: z.string().min(1),
  agent_id: z.string().min(1),
  messages: z.array(chatMessageSchema).default([]),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatHistorySchema = z.array(chatSessionSchema);
export type ChatHistory = z.infer<typeof chatHistorySchema>;

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runAgentGraph } from "@/lib/agent-graph.server";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  slots: z
    .object({
      name: z.string().max(120).optional(),
      address: z.string().max(200).optional(),
      postcode: z.string().max(10).optional(),
      email: z.string().max(160).optional(),
      phone: z.string().max(40).optional(),
    })
    .optional(),
  lang: z.enum(["nl", "en"]).optional(),
});

/**
 * Thin RPC boundary. All orchestration lives in the agent graph engine
 * (src/lib/agent-graph.server.ts).
 */
export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    return await runAgentGraph({
      messages: data.messages,
      slots: data.slots ?? {},
      lang: data.lang ?? "nl",
    });
  });

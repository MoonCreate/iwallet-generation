import OpenAI from "openai";
import {
  agentToolDefinitions,
  executeAgentTool,
  type AgentContext,
} from "./tools.ts";

const SYSTEM_PROMPT = `You are an AI agent operating an iWallet — a policy-enforced smart wallet on the 0G blockchain.

Your role:
- You can check balances, send ETH, and view the policy rules governing this wallet.
- Always check the policy before attempting transactions to avoid unnecessary failures.
- If a transaction is blocked by policy, explain why clearly.
- Be helpful and transparent about what you can and cannot do.
- Report results of all actions clearly.

Important:
- You operate within strict policy rules (daily spending limits, allowed contracts, cooldowns).
- If a transaction fails due to a policy violation, do NOT retry — explain the limitation.
- Always tell the user the current daily spend status when relevant.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "done" | "error";
  content: string;
  toolName?: string;
}

// Convert our tool definitions to OpenAI function format
const openaiTools: OpenAI.ChatCompletionTool[] = agentToolDefinitions.map(
  (tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as Record<string, unknown>,
    },
  })
);

export async function* runAgentChat(
  messages: ChatMessage[],
  ctx: AgentContext,
  apiKey: string
): AsyncGenerator<AgentEvent> {
  const client = new OpenAI({ apiKey });

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map(
      (m) =>
        ({
          role: m.role,
          content: m.content,
        }) as OpenAI.ChatCompletionMessageParam
    ),
  ];

  let continueLoop = true;

  while (continueLoop) {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: openaiMessages,
      tools: openaiTools,
    });

    const choice = response.choices[0];
    if (!choice) break;

    continueLoop = false;

    const message = choice.message;

    // Emit text content
    if (message.content) {
      yield { type: "text", content: message.content };
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      openaiMessages.push(message);

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);

        yield {
          type: "tool_use",
          content: JSON.stringify(toolInput),
          toolName,
        };

        const result = await executeAgentTool(toolName, toolInput, ctx);

        const isBlocked = result.includes("BLOCKED");
        yield {
          type: "tool_result",
          content: result,
          toolName,
        };

        // Add tool result to history
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      continueLoop = true;
    }

    if (choice.finish_reason === "stop") {
      continueLoop = false;
    }
  }

  yield { type: "done", content: "" };
}

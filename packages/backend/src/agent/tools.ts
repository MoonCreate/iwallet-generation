import {
  toolDefinitions as walletToolDefinitions,
  runTool,
  type SessionContext,
} from "../wallet/tools.ts";

export const agentToolDefinitions = walletToolDefinitions;

export type AgentContext = SessionContext;

export async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: AgentContext
): Promise<string> {
  const out = await runTool(toolName, toolInput, ctx);
  if (out.ok) {
    return typeof out.result === "string"
      ? out.result
      : JSON.stringify(out.result, null, 2);
  }
  return out.error ?? "tool failed";
}

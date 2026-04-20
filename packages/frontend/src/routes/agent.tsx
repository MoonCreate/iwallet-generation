import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  Bot,
  User,
  Send,
  Loader2,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { getIWalletMessage } from "#/lib/derive";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface AgentSearch {
  proxy?: string;
}

export const Route = createFileRoute("/agent")({
  component: AgentPage,
  validateSearch: (search: Record<string, unknown>): AgentSearch => ({
    proxy: search.proxy as string | undefined,
  }),
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "done" | "error";
  content: string;
  toolName?: string;
}

interface LogEntry {
  type: "tool_call" | "tool_result" | "error" | "success";
  toolName?: string;
  content: string;
  timestamp: number;
}

function AgentPage() {
  const { proxy } = Route.useSearch();
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [proxyAddress, setProxyAddress] = useState(proxy ?? "");
  const [walletIndex, setWalletIndex] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function startSession() {
    if (!isConnected || !proxyAddress) return;
    setLoading(true);
    try {
      const message = getIWalletMessage(walletIndex);
      const signature = await signMessageAsync({ message: { raw: message } });

      const res = await fetch(`${API_URL}/api/agent/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, proxyAddress }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      addLog("success", `Session started. Agent: ${data.agentAddress}`);
    } catch (err) {
      addLog("error", `Failed to start session: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  function addLog(
    type: LogEntry["type"],
    content: string,
    toolName?: string
  ) {
    setLogs((prev) => [
      ...prev,
      { type, content, toolName, timestamp: Date.now() },
    ]);
  }

  async function sendMessage() {
    if (!sessionId || !input.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: allMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event: AgentEvent = JSON.parse(json);

            switch (event.type) {
              case "text":
                assistantText += event.content;
                setMessages((prev) => {
                  const copy = [...prev];
                  const lastMsg = copy[copy.length - 1];
                  if (lastMsg?.role === "assistant") {
                    copy[copy.length - 1] = {
                      ...lastMsg,
                      content: assistantText,
                    };
                  } else {
                    copy.push({ role: "assistant", content: assistantText });
                  }
                  return copy;
                });
                break;

              case "tool_use":
                addLog("tool_call", event.content, event.toolName);
                break;

              case "tool_result": {
                const isBlocked = event.content.includes("BLOCKED");
                addLog(
                  isBlocked ? "error" : "tool_result",
                  event.content,
                  event.toolName
                );
                break;
              }

              case "error":
                addLog("error", event.content);
                break;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      addLog("error", `Chat error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  // Session setup view
  if (!sessionId) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell mx-auto max-w-lg rounded-2xl p-6 sm:p-8">
          <Bot className="mx-auto mb-3 h-10 w-10 text-[var(--lagoon)]" />
          <h1 className="mb-2 text-center text-2xl font-bold text-[var(--sea-ink)]">
            AI Agent Demo
          </h1>
          <p className="mb-6 text-center text-sm text-[var(--sea-ink-soft)]">
            Connect your wallet and start a session to chat with your AI
            agent. The agent can check balances, send ETH, and view policy
            — all enforced on-chain.
          </p>

          {!isConnected ? (
            <div className="text-center">
              <appkit-button />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
                  PolicyProxy Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={proxyAddress}
                  onChange={(e) => setProxyAddress(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
                  iWallet Index
                </label>
                <input
                  type="number"
                  min="0"
                  value={walletIndex}
                  onChange={(e) => setWalletIndex(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
                />
              </div>
              <button
                type="button"
                onClick={startSession}
                disabled={loading || !proxyAddress}
                className="w-full rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-3 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing...
                  </span>
                ) : (
                  "Start Agent Session"
                )}
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  // Chat + log view
  return (
    <main className="page-wrap flex h-[calc(100vh-4rem)] flex-col gap-4 px-4 py-4 lg:flex-row">
      {/* Chat panel */}
      <div className="flex flex-1 flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            <Bot className="h-4 w-4 text-[var(--lagoon)]" />
            Agent Chat
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              Say something to your AI agent. Try: "Check my balance" or
              "Send 0.01 ETH to 0x..."
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <Bot className="mt-1 h-5 w-5 flex-shrink-0 text-[var(--lagoon)]" />
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-[rgba(79,184,178,0.14)] text-[var(--sea-ink)]"
                    : "bg-[var(--surface)] text-[var(--sea-ink)]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <User className="mt-1 h-5 w-5 flex-shrink-0 text-[var(--sea-ink-soft)]" />
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--line)] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell your agent what to do..."
              disabled={loading}
              className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-[rgba(79,184,178,0.2)] p-2 text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.3)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction log panel */}
      <div className="flex h-80 flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] lg:h-auto lg:w-96">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            <Terminal className="h-4 w-4 text-[var(--sea-ink-soft)]" />
            Transaction Log
          </h2>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {logs.length === 0 && (
            <p className="text-center text-xs text-[var(--sea-ink-soft)]">
              Agent activity will appear here.
            </p>
          )}
          {logs.map((log, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-xs ${
                log.type === "error"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : log.type === "success"
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : log.type === "tool_call"
                      ? "border border-blue-200 bg-blue-50 text-blue-700"
                      : "border border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)]"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                {log.type === "error" ? (
                  <AlertCircle className="h-3 w-3" />
                ) : log.type === "success" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : log.type === "tool_call" ? (
                  <Terminal className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span className="font-semibold">
                  {log.toolName ?? log.type}
                </span>
                <span className="ml-auto opacity-60">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-all">{log.content}</p>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </main>
  );
}

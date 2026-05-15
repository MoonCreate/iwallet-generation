import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount, useBalance, useChainId, useReadContract, useSendTransaction, useSignMessage } from "wagmi";
import { useState, useRef, useEffect, useCallback } from "react";
import { parseEther, formatEther } from "viem";
import { getBackendUrl, getFactoryAddress, IWALLET_FACTORY_ABI } from "#/lib/contracts";
import { Bot, Fuel, History, Loader2, MessageSquarePlus, Send, Zap } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WalletButton } from "#/components/WalletButton";

export const Route = createFileRoute("/agent")({
  component: AgentPage,
});

const SALT = "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const PROVISIONING_MESSAGE = "iWallet session bootstrap";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "done" | "error";
  content: string;
  toolName?: string;
}

interface SessionItem {
  sessionAddress: string;
  label: string | null;
  createdAt: number;
  revokedAt: number | null;
}

interface ChatEntry {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// ── Helpers ─────────────────────────────────────────────────────
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

function getChatKey(wallet: string) {
  return `iwallet-chats-${wallet.toLowerCase()}`;
}

function loadChats(wallet: string): ChatEntry[] {
  try {
    return JSON.parse(localStorage.getItem(getChatKey(wallet)) || "[]");
  } catch { return []; }
}

function saveChats(wallet: string, chats: ChatEntry[]) {
  localStorage.setItem(getChatKey(wallet), JSON.stringify(chats.slice(0, 50)));
}

// ── Main Component ──────────────────────────────────────────────
function AgentPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const factory = getFactoryAddress(chainId);
  const { data: predicted } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: IWALLET_FACTORY_ABI,
    functionName: "computeAddress",
    args: address ? [address, SALT] : undefined,
    query: { enabled: !!factory && factory !== "0x0" && !!address },
  });
  const iWalletAddr = predicted as `0x${string}` | undefined;

  const { signMessageAsync } = useSignMessage();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sessions & chat history
  useEffect(() => {
    if (!iWalletAddr) return;
    fetch(`${getBackendUrl()}/api/wallet/sessions/${iWalletAddr}`)
      .then((r) => r.json())
      .then((j) => setSessions((j.sessions ?? []).filter((s: SessionItem) => !s.revokedAt)))
      .catch(() => {});
    const chats = loadChats(iWalletAddr);
    setChatHistory(chats);
    // Check if there's a pending "continue" chat (just added from dashboard)
    const pendingKey = `iwallet-continue-${iWalletAddr.toLowerCase()}`;
    const pending = localStorage.getItem(pendingKey);
    if (pending) {
      localStorage.removeItem(pendingKey);
      const entry = JSON.parse(pending) as ChatEntry;
      setMessages(entry.messages as Message[]);
      setChatId(entry.id);
    }
  }, [iWalletAddr]);

  // Auto-start session if we have messages but no session (continued from dashboard)
  useEffect(() => {
    if (messages.length > 0 && !sessionId && !starting && sessions.length > 0) {
      startChat();
    }
  }, [messages, sessionId, sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  // Persist messages on change
  const persistChat = useCallback((msgs: Message[]) => {
    if (!iWalletAddr || msgs.length === 0) return;
    const id = chatId || crypto.randomUUID();
    if (!chatId) setChatId(id);
    const firstUser = msgs.find((m) => m.role === "user");
    const title = firstUser?.content.slice(0, 60) || "New chat";
    const chats = loadChats(iWalletAddr);
    const idx = chats.findIndex((c) => c.id === id);
    const entry: ChatEntry = { id, title, messages: msgs, createdAt: idx >= 0 ? chats[idx].createdAt : Date.now() };
    if (idx >= 0) chats[idx] = entry;
    else chats.unshift(entry);
    saveChats(iWalletAddr, chats);
    setChatHistory(chats);
  }, [iWalletAddr, chatId]);

  async function startChat() {
    if (!iWalletAddr) return;
    setStarting(true);
    try {
      // Try cached bearer first
      const cacheKey = `iwallet-bearer-${iWalletAddr.toLowerCase()}`;
      let bearer = localStorage.getItem(cacheKey);

      if (bearer) {
        // Test if bearer is still valid
        const test = await fetch(`${getBackendUrl()}/api/agent/session/bearer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bearerToken: bearer, iWalletAddress: iWalletAddr, chainId }),
        });
        const testData = await test.json();
        if (!testData.error) {
          setSessionId(testData.sessionId);
          setSessionAddress(testData.sessionAddress);
          return;
        }
        // Bearer expired/revoked, clear cache
        localStorage.removeItem(cacheKey);
      }

      // Provision new bearer
      const signature = await signMessageAsync({ message: PROVISIONING_MESSAGE });
      const provRes = await fetch(`${getBackendUrl()}/api/wallet/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, index: 0, iWalletAddress: iWalletAddr, chainId }),
      });
      const prov = await provRes.json();
      if (!prov.bearerToken) throw new Error("Provision failed");

      // Cache the bearer
      localStorage.setItem(cacheKey, prov.bearerToken);

      const res = await fetch(`${getBackendUrl()}/api/agent/session/bearer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearerToken: prov.bearerToken, iWalletAddress: iWalletAddr, chainId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSessionId(data.sessionId);
      setSessionAddress(data.sessionAddress);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function newChat() {
    setMessages([]);
    setChatId(null);
    setShowHistory(false);
  }

  function resumeChat(entry: ChatEntry) {
    setMessages(entry.messages);
    setChatId(entry.id);
    setShowHistory(false);
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${getBackendUrl()}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: newMessages }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let assistantContent = "";
      const withPlaceholder = [...newMessages, { role: "assistant" as const, content: "" }];
      setMessages(withPlaceholder);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event: AgentEvent = JSON.parse(line.slice(6));
          if (event.type === "text") {
            assistantContent += event.content;
          } else if (event.type === "tool_result") {
            assistantContent += `\n\`[${event.toolName}]: ${event.content.slice(0, 200)}\`\n`;
          }
          setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
        }
      }

      const final = [...newMessages, { role: "assistant" as const, content: assistantContent }];
      setMessages(final);
      persistChat(final);
    } catch (e) {
      const errMsg = [...newMessages, { role: "assistant" as const, content: "Error: " + (e as Error).message }];
      setMessages(errMsg);
    } finally {
      setLoading(false);
    }
  }

  // ── Not connected ─────────────────────────────────────────────
  if (!isConnected) {
    return (
      <main className="page-wrap mx-auto max-w-2xl px-4 py-12">
        <h1 className="display-title text-3xl font-bold mb-3">Agent Chat</h1>
        <p className="opacity-70">Connect your wallet to start chatting with your iWallet agent.</p>
        <div className="mt-4"><WalletButton /></div>
      </main>
    );
  }

  // ── No session yet ────────────────────────────────────────────
  if (!sessionId && messages.length === 0) {
    return (
      <main className="page-wrap mx-auto max-w-2xl px-4 py-12">
        <h1 className="display-title text-3xl font-bold mb-3">Agent Chat</h1>
        <p className="opacity-70 mb-6">
          Start a session to chat with your policy-enforced AI agent.
        </p>
        {sessions.length === 0 ? (
          <div className="island-shell rounded-2xl p-6 text-center">
            <p className="text-sm opacity-70 mb-4">No active sessions. Provision one first.</p>
            <Link to="/connect" className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white">
              <Zap className="h-4 w-4" /> Provision Session
            </Link>
          </div>
        ) : (
          <button
            onClick={startChat}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon-deep)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {starting ? "Connecting…" : "Start Agent Chat"}
          </button>
        )}
      </main>
    );
  }

  // ── Chat view ─────────────────────────────────────────────────
  return (
    <main className="page-wrap mx-auto max-w-3xl px-4 py-4 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--lagoon-deep)]" />
          <h1 className="text-lg font-semibold">iWallet Agent</h1>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            0G Storage
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={newChat} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs opacity-70 hover:opacity-100 transition">
            <MessageSquarePlus className="h-3 w-3" /> New
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs opacity-70 hover:opacity-100 transition">
            <History className="h-3 w-3" /> History
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mb-3 max-h-48 overflow-y-auto rounded-xl border p-3 space-y-1">
          {chatHistory.length === 0 ? (
            <p className="text-xs opacity-50 text-center py-2">No previous chats</p>
          ) : chatHistory.map((c) => (
            <button
              key={c.id}
              onClick={() => resumeChat(c)}
              className={`w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition ${c.id === chatId ? "bg-black/5 dark:bg-white/10 font-medium" : "opacity-70"}`}
            >
              <span className="block truncate">{c.title}</span>
              <span className="text-[10px] opacity-50">{new Date(c.createdAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Session gas banner */}
      {sessionAddress && <SessionGasBanner address={sessionAddress as `0x${string}`} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 rounded-xl border p-4">
        {messages.length === 0 && (
          <p className="text-sm opacity-40 text-center py-12">
            Ask anything — "What's my balance?", "Send 0.01 ETH to 0x...", "Show my policy"
          </p>
        )}
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} isLoading={loading && i === messages.length - 1 && !m.content} />
        ))}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message iWallet Agent…"
          disabled={loading}
          className="flex-1 rounded-full border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)]/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-[var(--lagoon-deep)] p-2.5 text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </main>
  );
}

// ── Chat Bubble with Markdown ───────────────────────────────────
function ChatBubble({ message, isLoading }: { message: Message; isLoading: boolean }) {
  const isUser = message.role === "user";
  const content = isUser ? message.content : stripThinking(message.content);

  if (isLoading && !content) {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl px-4 py-2 bg-black/5 dark:bg-white/10">
          <Loader2 className="h-4 w-4 animate-spin opacity-50" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? "bg-[var(--lagoon-deep)] text-white"
          : "bg-black/5 dark:bg-white/10"
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-table:my-2 prose-headings:my-2 prose-li:my-0.5">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session Gas Banner ──────────────────────────────────────────
function SessionGasBanner({ address }: { address: `0x${string}` }) {
  const { data: bal, refetch } = useBalance({ address });
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const [funded, setFunded] = useState(false);

  const balance = bal ? formatEther(bal.value) : "…";
  const low = !bal || bal.value < parseEther("0.005");

  async function fund() {
    try {
      await sendTransactionAsync({ to: address, value: parseEther("0.05") });
      setFunded(true);
      setTimeout(() => refetch(), 3000);
    } catch {}
  }

  if (!low && !funded) return null;

  return (
    <div className={`mb-3 rounded-lg border p-3 text-xs ${low ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium flex items-center gap-1">
            <Fuel className="h-3.5 w-3.5" /> Session Key
            <span className="font-normal opacity-60">— Balance: {balance} {bal?.symbol ?? "ETH"}</span>
          </p>
          {low && <p className="mt-0.5 text-amber-600">⚠ Needs gas to send transactions</p>}
        </div>
        {low && (
          <button
            onClick={fund}
            disabled={isPending}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--lagoon-deep)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Fuel className="h-3 w-3" />}
            Fund 0.05
          </button>
        )}
        {funded && !low && <span className="text-emerald-600 font-medium">✓ Funded</span>}
      </div>
    </div>
  );
}

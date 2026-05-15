import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Bot,
  Database,
  Plug,
  ArrowRight,
  ExternalLink,
  Zap,
  Lock,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/pitch")({
  component: PitchPage,
});

function Slide({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section
      id={id}
      className={`min-h-screen flex flex-col justify-center px-8 md:px-20 py-16 border-b border-emerald-500/10 ${className}`}
    >
      {children}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-mono tracking-[0.3em] uppercase text-emerald-500/70 mb-4">
      {children}
    </span>
  );
}

export default function PitchPage() {
  return (
    <div className="w-full bg-[#02130f] text-emerald-100 font-[Manrope,sans-serif]">

      {/* ── 1. HOOK ─────────────────────────────────────────────── */}
      <Slide id="hook" className="items-center text-center">
        <Tag>iWallet · Built on 0G</Tag>
        <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight max-w-3xl mx-auto">
          AI agents that control wallets —<br />
          <span className="text-[#10b981]">but can't go rogue.</span>
        </h1>
        <p className="mt-6 text-emerald-300/60 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
          On-chain policy rules act as an unbreakable cage around every AI agent.
          Even a compromised model cannot exceed its boundaries.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <a
            href="https://wallet.goon4.site"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Live Demo <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            to="/agent"
            className="flex items-center gap-2 px-6 py-3 border border-emerald-500/30 hover:border-emerald-500 text-emerald-200 font-semibold rounded-lg transition-colors"
          >
            Try Agent <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Slide>

      {/* ── 2. PROBLEM ──────────────────────────────────────────── */}
      <Slide id="problem">
        <Tag>The Problem</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-8 max-w-2xl">
          AI + crypto wallets = <span className="text-red-400">unlimited risk</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
          {[
            { icon: "💀", title: "No guardrails", desc: "Off-chain rate limiters can be bypassed. Nothing stops a hallucinating agent from draining funds." },
            { icon: "🔑", title: "Full key access", desc: "Existing setups give the AI the full private key. One prompt injection = total loss." },
            { icon: "🧠", title: "No memory", desc: "Agents forget context between sessions. Every conversation starts from zero." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-red-300 mb-2">{item.title}</h3>
              <p className="text-emerald-300/50 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 3. WHY NOW ──────────────────────────────────────────── */}
      <Slide id="why-now">
        <Tag>The Risk Is Real</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-4 max-w-2xl">
          AI agents are already <span className="text-red-400">draining wallets</span>
        </h2>
        <p className="text-emerald-300/50 mb-8 max-w-xl text-sm leading-relaxed">
          47–65% of daily crypto trading volume is now handled by AI agents. Most have zero on-chain guardrails.
        </p>
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mb-8">
          {[
            { date: "Nov 2024", name: "Freysa AI", amount: "$47K", method: "Prompt injection disguised as admin override — agent tricked into releasing funds on attempt #482." },
            { date: "May 2025", name: "Grok + Bankrbot", amount: "$200K", method: "Morse code tweet bypassed text filters, triggered unauthorized transfer of 3B DRB tokens." },
            { date: "May 2025", name: "Grok + NFT exploit", amount: "$174K", method: "NFT metadata contained hidden instructions that hijacked agent behavior." },
            { date: "2025", name: "ElizaOS (Princeton research)", amount: "$140M at risk", method: "Memory poisoning attack demonstrated — false context planted to trigger future unauthorized transfers." },
          ].map((item) => (
            <div key={item.name} className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-red-300 text-sm">{item.name}</p>
                <span className="text-xs font-mono text-red-400/70 ml-2 shrink-0">{item.amount}</span>
              </div>
              <p className="text-[10px] font-mono text-emerald-500/40 mb-2">{item.date}</p>
              <p className="text-emerald-300/50 text-xs leading-relaxed">{item.method}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 max-w-3xl">
          <p className="text-sm text-emerald-200 font-semibold mb-1">Why on-chain enforcement is the only real fix</p>
          <p className="text-emerald-300/50 text-xs leading-relaxed">
            Off-chain rate limiters live on a server — prompt injection bypasses them. On-chain policy rules are enforced atomically inside the smart contract. Even a fully compromised AI agent cannot exceed its limits. No trust required.
          </p>
        </div>
      </Slide>

      {/* ── 4. SOLUTION ─────────────────────────────────────────── */}
      <Slide id="solution">
        <Tag>The Solution</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-4 max-w-2xl">
          Policy-enforced session keys,<br />
          <span className="text-[#10b981]">enforced on-chain.</span>
        </h2>
        <p className="text-emerald-300/60 mb-10 max-w-xl leading-relaxed">
          The owner sets rules. The smart contract enforces them. The AI operates freely — within the cage.
        </p>
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
          {[
            { icon: Lock, label: "Daily ETH spend limit", desc: "Agent cannot send more than X ETH per day, period." },
            { icon: ShieldCheck, label: "Contract whitelist", desc: "Only pre-approved addresses can receive funds." },
            { icon: Zap, label: "Cooldown & expiry", desc: "Minimum time between txs. Session auto-expires." },
            { icon: Globe, label: "Token allowances", desc: "Per-ERC20 daily transfer caps enforced on-chain." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Icon className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-100 text-sm">{label}</p>
                <p className="text-emerald-300/50 text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 4. 0G INTEGRATION ───────────────────────────────────── */}
      <Slide id="0g">
        <Tag>0G Ecosystem</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-10 max-w-2xl">
          Built entirely on <span className="text-[#10b981]">0G</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
          {[
            {
              icon: ShieldCheck,
              title: "0G Chain",
              badge: "Mainnet + Testnet",
              desc: "iWallet & iWalletFactory deployed. UUPS + Beacon proxy — upgrade all wallets in one tx.",
              addr: "0x08a7Ea...8aA68d",
            },
            {
              icon: Database,
              title: "0G Storage",
              badge: "Log Layer",
              desc: "Every agent conversation is permanently archived. Loaded back as persistent memory on next session.",
              addr: null,
            },
            {
              icon: Plug,
              title: "MCP over 0G",
              badge: "Protocol",
              desc: "Full MCP server. Claude Desktop, Cursor, VS Code — any AI client can control the wallet.",
              addr: null,
            },
          ].map(({ icon: Icon, title, badge, desc, addr }) => (
            <div key={title} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Icon className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-emerald-100 text-sm">{title}</p>
                  <p className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-wider">{badge}</p>
                </div>
              </div>
              <p className="text-emerald-300/60 text-sm leading-relaxed">{desc}</p>
              {addr && (
                <p className="mt-3 font-mono text-[11px] text-emerald-500/50">{addr}</p>
              )}
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 5. HOW IT WORKS ─────────────────────────────────────── */}
      <Slide id="flow">
        <Tag>How It Works</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-10 max-w-2xl">
          5 steps from wallet to <span className="text-[#10b981]">AI agent</span>
        </h2>
        <ol className="max-w-2xl space-y-4">
          {[
            { n: "01", title: "Connect wallet", desc: "Master EOA connects. iWallet address is deterministically derived — no new seed phrase." },
            { n: "02", title: "Set policy", desc: "Owner configures daily limit, whitelist, cooldown, expiry on-chain." },
            { n: "03", title: "Fund iWallet", desc: "Send 0G to the iWallet address + session key for gas." },
            { n: "04", title: "Chat with agent", desc: "AI agent uses session key to sign txs. Contract enforces policy on every call." },
            { n: "05", title: "Memory persists", desc: "Conversation archived to 0G Storage. Next session loads history automatically." },
          ].map(({ n, title, desc }) => (
            <li key={n} className="flex gap-5 items-start">
              <span className="font-mono text-xs text-emerald-500/40 mt-1 w-6 shrink-0">{n}</span>
              <div className="flex-1 border-b border-emerald-500/10 pb-4">
                <p className="font-semibold text-emerald-100 text-sm">{title}</p>
                <p className="text-emerald-300/50 text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Slide>

      {/* ── 6. TECH STACK ───────────────────────────────────────── */}
      <Slide id="tech">
        <Tag>Tech Stack</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-10">Stack</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl">
          {[
            { layer: "Contracts", items: ["Solidity 0.8.28", "Hardhat v3", "OpenZeppelin UUPS + Beacon"] },
            { layer: "Backend", items: ["Bun + Elysia.js", "OpenAI-compatible LLM (MiniMax M2)", "0G Storage SDK", "MCP SSE server"] },
            { layer: "Frontend", items: ["React 19 + TanStack Start", "wagmi v3 + Reown AppKit", "Tailwind v4 + Three.js"] },
            { layer: "Protocol", items: ["MCP (Model Context Protocol)", "0G Log layer archival", "ERC-1271 signature validation"] },
          ].map(({ layer, items }) => (
            <div key={layer}>
              <p className="text-xs font-mono uppercase tracking-widest text-emerald-500/50 mb-3">{layer}</p>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-emerald-200/70">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 9. MARKET SIZE ──────────────────────────────────────── */}
      <Slide id="market">
        <Tag>Market Opportunity</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-10 max-w-2xl">
          TAM · SAM · SOM
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mb-8">
          {[
            {
              label: "TAM",
              title: "Total Addressable Market",
              value: "$107B",
              sub: "by 2030",
              desc: "Crypto wallet market ($69B) + AI agent infrastructure market ($47B) converging into AI-native wallet infrastructure.",
              color: "emerald",
            },
            {
              label: "SAM",
              title: "Serviceable Addressable Market",
              value: "$15.3B",
              sub: "AI crypto agent sector (2024)",
              desc: "18,000+ AI agents on Virtuals alone. 47–65% of daily crypto volume handled by agents. DeFi TVL exposed to agent risk: $85B+.",
              color: "teal",
            },
            {
              label: "SOM",
              title: "Serviceable Obtainable Market",
              value: "$50M",
              sub: "Year 1–2 target",
              desc: "0G ecosystem developers, DeFAI hackathon builders, DAOs deploying trading agents, early institutional desks. ~500 teams × $100K/year.",
              color: "cyan",
            },
          ].map(({ label, title, value, sub, desc, color }) => (
            <div key={label} className={`rounded-xl border border-${color}-500/20 bg-${color}-500/5 p-6`}>
              <p className={`text-xs font-mono uppercase tracking-widest text-${color}-500/60 mb-3`}>{label}</p>
              <p className={`text-4xl font-black text-${color}-300 mb-1`}>{value}</p>
              <p className={`text-xs text-${color}-400/60 mb-4`}>{sub}</p>
              <p className="text-xs font-semibold text-emerald-100 mb-2">{title}</p>
              <p className="text-emerald-300/50 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl">
          {[
            { stat: "18,000+", label: "AI agents on Virtuals Protocol" },
            { stat: "65%", label: "of daily crypto volume by AI agents (2025)" },
            { stat: "26.7%", label: "CAGR — crypto wallet market to 2034" },
          ].map(({ stat, label }) => (
            <div key={label} className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-4 text-center">
              <p className="text-3xl font-black text-emerald-300">{stat}</p>
              <p className="text-xs text-emerald-300/50 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 9. BUSINESS MODEL ───────────────────────────────────── */}
      <Slide id="business">
        <Tag>Business Model</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-4 max-w-2xl">
          Freemium + <span className="text-[#10b981]">Protocol Fee</span>
        </h2>
        <p className="text-emerald-300/50 mb-10 max-w-xl text-sm leading-relaxed">
          Free to start, pay as you scale. Protocol fee of <strong className="text-emerald-300">0.05%</strong> per agent transaction — below every DeFi benchmark (Uniswap: 0.3%, Curve: 0.04–0.3%).
        </p>
        <div className="grid md:grid-cols-4 gap-4 max-w-5xl mb-8">
          {[
            {
              tier: "Free",
              price: "$0",
              unit: "forever",
              target: "Developers & builders",
              fee: "No protocol fee",
              items: ["1 iWallet", "1 session key", "Basic policy (limit + expiry)", "MCP access", "Community support"],
              highlight: false,
            },
            {
              tier: "Pro",
              price: "$49",
              unit: "/ month",
              target: "Power users & DAOs",
              fee: "0.05% per agent tx",
              items: ["Unlimited wallets", "Multi-session keys", "Full policy (whitelist + tokens)", "Analytics dashboard", "Email support"],
              highlight: false,
            },
            {
              tier: "Team",
              price: "$299",
              unit: "/ month",
              target: "Trading firms & DAOs",
              fee: "0.05% per agent tx",
              items: ["Multi-user access", "Audit logs", "Policy templates", "Multi-agent monitoring", "Priority support"],
              highlight: true,
            },
            {
              tier: "Enterprise",
              price: "Custom",
              unit: "",
              target: "Institutions",
              fee: "Flat fee (no %)",
              items: ["White-label", "SLA guarantee", "Compliance reports", "Dedicated infra", "Custom integrations"],
              highlight: false,
            },
          ].map(({ tier, price, unit, target, fee, items, highlight }) => (
            <div
              key={tier}
              className={`rounded-xl border p-5 flex flex-col ${
                highlight
                  ? "border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20"
                  : "border-emerald-500/15 bg-emerald-500/5"
              }`}
            >
              {highlight && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-2">★ Core Revenue</p>
              )}
              <p className="font-bold text-emerald-100 mb-1 text-sm">{tier}</p>
              <p className="text-3xl font-black text-[#10b981]">{price}<span className="text-sm font-normal text-emerald-400/60">{unit}</span></p>
              <p className="text-[10px] font-mono text-emerald-500/40 mt-1 mb-1">Target: {target}</p>
              <p className="text-[10px] font-mono text-emerald-400/60 mb-4 border-b border-emerald-500/10 pb-3">{fee}</p>
              <ul className="space-y-1.5 flex-1">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-emerald-300/60">
                    <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-5 max-w-5xl">
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-500/40 mb-2">Why 0.05%?</p>
          <p className="text-sm text-emerald-300/60">
            Uniswap charges 0.3% per swap. Curve charges 0.04%. We charge 0.05% per <em>agent transaction</em> — not per swap, but per any on-chain action the agent takes. At $10M/month agent volume → $5K/month protocol revenue, scaling linearly with ecosystem growth.
          </p>
        </div>
      </Slide>

      {/* ── 10. ROADMAP ─────────────────────────────────────────── */}
      <Slide id="roadmap">
        <Tag>Roadmap</Tag>
        <h2 className="text-4xl md:text-5xl font-black mb-10 max-w-2xl">
          Where We're Going
        </h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          {[
            {
              phase: "Phase 1", title: "Foundation", status: "done",
              items: [
                "On-chain policy-enforced smart wallets (0G Mainnet + Testnet)",
                "AI agent with tool calling (balance, send, policy check)",
                "0G Storage for persistent agent memory",
                "MCP protocol support for external AI clients",
              ],
            },
            {
              phase: "Phase 2", title: "Intelligence", status: "next",
              items: [
                "0G Compute Network — decentralized inference, no centralized API dependency",
                "Smart policy suggestions — AI recommends optimal limits from spending patterns",
                "Multi-session agents — multiple agents per wallet with scoped permissions",
              ],
            },
            {
              phase: "Phase 3", title: "Confidential & Identity", status: "future",
              items: [
                "Confidential policy rules — TEE-enforced execution, rules hidden from public state",
                "Encrypted agent memory — ECIES on 0G Storage, only owner decrypts",
                "Agent ID (0G standard) — tokenize agent behavior + memory as on-chain identity",
              ],
            },
            {
              phase: "Phase 4", title: "Ecosystem", status: "future",
              items: [
                "Multi-chain iWallet deployment with 0G DA for cross-chain policy state sync",
                "Agent marketplace — trade/rent pre-configured agent wallets",
                "Community policy templates — audited, reusable presets",
              ],
            },
          ].map((p) => (
            <div
              key={p.phase}
              className={`p-6 rounded-2xl border transition-all duration-300 ${
                p.status === "done"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : p.status === "next"
                  ? "border-emerald-500/20 bg-[#02130f]/50"
                  : "border-emerald-500/10 bg-[#02130f]/30"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-xs text-emerald-500/60">{p.phase}</span>
                <span className="text-lg font-bold text-emerald-100">{p.title}</span>
                {p.status === "done" && (
                  <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
                )}
                {p.status === "next" && (
                  <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Next</span>
                )}
              </div>
              <ul className="space-y-2">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-emerald-300/70">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${p.status === "done" ? "bg-emerald-400" : "bg-emerald-500/30"}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Slide>

      {/* ── 11. TRACTION / CTA ──────────────────────────────────── */}
      <Slide id="cta" className="items-center text-center">
        <Tag>Live & Deployed</Tag>
        <h2 className="text-4xl md:text-6xl font-black mb-6 max-w-2xl mx-auto">
          Ready to demo,<br />
          <span className="text-[#10b981]">right now.</span>
        </h2>
        <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10 w-full">
          {[
            { label: "Frontend", value: "wallet.goon4.site", href: "https://wallet.goon4.site" },
            { label: "Backend / MCP", value: "be-wallet.goon4.site", href: "https://be-wallet.goon4.site" },
            { label: "Contract (Mainnet)", value: "0x08a7...8d", href: "https://chainscan.0g.ai/address/0x08a7Ea416AF2b8DD4614aa6A314ee7c96F8aA68d" },
          ].map(({ label, value, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 p-4 transition-colors group"
            >
              <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/50 mb-1">{label}</p>
              <p className="text-sm font-semibold text-emerald-200 group-hover:text-emerald-100 flex items-center justify-center gap-1">
                {value} <ExternalLink className="h-3 w-3 opacity-50" />
              </p>
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/agent"
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-lg"
          >
            <Bot className="h-5 w-5" /> Try the Agent
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-8 py-4 border border-emerald-500/30 hover:border-emerald-500 text-emerald-200 font-bold rounded-lg transition-colors text-lg"
          >
            Open Dashboard <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </Slide>

    </div>
  );
}

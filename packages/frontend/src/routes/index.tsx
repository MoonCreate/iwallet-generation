import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Brain,
  Key,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      {/* Hero */}
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />

        <p className="island-kicker mb-3">AI-Native Smart Wallet</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          AI wallets need guardrails.
        </h1>
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Every AI agent needs a wallet. But giving an AI agent a wallet without
          limits is like giving a toddler a credit card.{" "}
          <strong>iWallet</strong> creates deterministic sub-wallets with
          on-chain policy rules — so your AI can act, but only within boundaries
          you set.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/create"
            className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          >
            Create iWallet
          </Link>
          <Link
            to="/agent"
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)]"
          >
            Try Live Agent Demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [
              Key,
              "Derived Keys",
              "No new seed phrases. iWallets are deterministically derived from your master wallet signature. Recoverable anytime.",
            ],
            [
              Shield,
              "On-Chain Policy",
              "Daily spend limits, contract whitelists, cooldowns — all enforced by smart contracts, not just software.",
            ],
            [
              Brain,
              "AI Agent Ready",
              "Give your AI agent a wallet it can use. Policy rules ensure it cannot exceed the boundaries you set.",
            ],
            [
              Zap,
              "Live Demo",
              "Try the AI agent right now. Watch it execute transactions — and get blocked when it hits a policy limit.",
            ],
          ] as const
        ).map(([Icon, title, desc], index) => (
          <article
            key={title}
            className="island-shell feature-card rise-in rounded-2xl p-5"
            style={{ animationDelay: `${index * 90 + 80}ms` }}
          >
            <Icon className="mb-3 h-6 w-6 text-[var(--lagoon)]" />
            <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
              {title}
            </h2>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{desc}</p>
          </article>
        ))}
      </section>

      {/* How it works */}
      <section className="island-shell mt-8 rounded-2xl p-6">
        <p className="island-kicker mb-2">How It Works</p>
        <ol className="m-0 list-decimal space-y-2 pl-5 text-sm text-[var(--sea-ink-soft)]">
          <li>
            <strong>Connect</strong> your master wallet (MetaMask, WalletConnect, etc.)
          </li>
          <li>
            <strong>Create</strong> an iWallet — signs a deterministic message to derive a sub-wallet
          </li>
          <li>
            <strong>Configure</strong> policy rules — daily limits, allowed contracts, cooldowns
          </li>
          <li>
            <strong>Activate</strong> — deploys a PolicyProxy that enforces your rules on-chain
          </li>
          <li>
            <strong>Fund</strong> the iWallet and let your AI agent operate within bounds
          </li>
        </ol>
      </section>
    </main>
  );
}

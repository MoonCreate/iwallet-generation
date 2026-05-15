export function Roadmap() {
  const phases = [
    {
      phase: "Phase 1",
      title: "Foundation",
      status: "done" as const,
      items: [
        "On-chain policy-enforced smart wallets (0G Mainnet + Testnet)",
        "AI agent with tool calling (balance, send, policy check)",
        "0G Storage for persistent agent memory",
        "MCP protocol support for external AI clients",
      ],
    },
    {
      phase: "Phase 2",
      title: "Intelligence",
      status: "next" as const,
      items: [
        "0G Compute Network — decentralized inference, no centralized API dependency",
        "Smart policy suggestions — AI recommends optimal limits from spending patterns",
        "Multi-session agents — multiple agents per wallet with scoped permissions",
      ],
    },
    {
      phase: "Phase 3",
      title: "Confidential & Identity",
      status: "future" as const,
      items: [
        "Confidential policy rules — TEE-enforced execution, rules hidden from public state",
        "Encrypted agent memory — ECIES on 0G Storage, only owner decrypts",
        "Agent ID (0G standard) — tokenize agent behavior + memory as on-chain identity",
      ],
    },
    {
      phase: "Phase 4",
      title: "Ecosystem",
      status: "future" as const,
      items: [
        "Multi-chain iWallet deployment with 0G DA for cross-chain policy state sync",
        "Agent marketplace — trade/rent pre-configured agent wallets",
        "Community policy templates — audited, reusable presets",
      ],
    },
  ];

  return (
    <section className="py-24 md:py-32 px-6 relative bg-[#02130f]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#02130f] via-[#0a1f15]/5 to-[#02130f]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-4 uppercase">Roadmap</p>
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            Where We're Going
          </h2>
          <p className="text-emerald-300/70 text-lg max-w-2xl mx-auto">
            Building the full AI agent wallet stack on the 0G ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {phases.map((p) => (
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
                  <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Live
                  </span>
                )}
                {p.status === "next" && (
                  <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                    Next
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-emerald-300/70">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      p.status === "done" ? "bg-emerald-400" : "bg-emerald-500/30"
                    }`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

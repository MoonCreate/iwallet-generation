export function FeaturesGrid() {
  const features = [
    {
      title: 'On-Chain Policy Enforcement',
      description: 'Daily spend limits, allowed contracts, cooldowns — enforced by smart contracts on 0G blockchain. Even a compromised agent cannot exceed its boundaries.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: '0G Decentralized Storage',
      description: 'Every agent conversation is permanently archived on 0G Storage. Cross-session memory that persists forever — not on a server, on the network.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      title: 'AI Agent with Tool Calling',
      description: 'Chat with an AI agent that can check balances, send ETH, and read policy — all through on-chain tool execution.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" strokeLinejoin="round" />
          <rect x="4" y="8" width="16" height="12" rx="2" strokeLinejoin="round" />
          <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      title: 'Deterministic Sub-Wallets',
      description: 'No new seed phrases. iWallets are derived from your master wallet signature. Same key, same wallet — recoverable anytime, anywhere.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <section id="features" className="py-24 md:py-32 px-6 relative bg-[#02130f]">
      <div className="absolute inset-0 bg-[#02130f]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-4 uppercase">Features</p>
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            What iWallet Does
          </h2>
          <p className="text-emerald-300/70 text-lg max-w-2xl mx-auto">
            A complete AI agent wallet stack — policy enforcement, persistent memory, and live tool execution on the 0G network.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl border border-emerald-500/20 bg-[#02130f]/50 hover:bg-[#02130f]/80 hover:border-emerald-500/40 transition-all duration-300"
            >
              <div className="flex flex-col h-full">
                <div className="text-emerald-400 mb-4">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-100 mb-2">{feature.title}</h3>
                  <p className="text-emerald-300/70 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

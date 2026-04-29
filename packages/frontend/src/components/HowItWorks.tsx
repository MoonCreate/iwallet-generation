export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Connect your master wallet',
      description: 'MetaMask, WalletConnect, or any Web3 wallet. This is your key to everything.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
          <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
          <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      number: '02',
      title: 'Create an iWallet',
      description: 'Signs a deterministic message to derive a sub-wallet. No new seed phrases — recoverable anytime.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      number: '03',
      title: 'Configure policy rules',
      description: 'Daily limits, allowed contracts, cooldowns. Set the boundaries for your AI agent.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      number: '04',
      title: 'Activate',
      description: 'Deploys a PolicyProxy that enforces your rules on-chain. Your funds stay safe.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      number: '05',
      title: 'Fund and let your AI operate',
      description: 'Top up your iWallet. Let your AI agent execute — within the boundaries you set.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
          <path d="M12 22V12" strokeLinejoin="round" />
          <path d="M20 12v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" strokeLinejoin="round" />
          <path d="M2 7l10 5 10-5" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <section id="how-it-works" className="py-24 md:py-32 px-6 relative bg-[#02130f]">
      {/* Gradient background at top - 10% opacity */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1d18]/10 to-[#02130f]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-4 uppercase">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            Protection That Actually Works
          </h2>
          <p className="text-emerald-300/70 text-lg max-w-2xl mx-auto">
            No magic — just math. Every transaction goes through the same policy enforcement, whether the agent is compromised or not.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative p-6 rounded-2xl border border-emerald-500/20 bg-[#02130f]/50 hover:bg-[#02130f]/80 hover:border-emerald-500/40 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                {/* Number badge */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <span className="text-emerald-400 font-mono text-sm font-bold">{step.number}</span>
                </div>

                <div className="flex-1">
                  {/* Icon */}
                  <div className="text-emerald-400 mb-3">
                    {step.icon}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-emerald-100 mb-2">{step.title}</h3>
                  <p className="text-emerald-300/70 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
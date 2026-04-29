export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'AI Agent Initiates',
      description: 'Your AI agent attempts to execute a transaction — swap, transfer, or contract interaction.',
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
      title: 'Policy Check',
      description: 'iWallet proxy validates the transaction against your defined rules — daily limits, allowed contracts, cooldown windows.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      number: '03',
      title: 'Execute or Block',
      description: 'If rules pass, transaction executes on-chain. If violated, the tx reverts — funds stay safe, agent gets notified.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    {
      number: '04',
      title: 'You Stay in Control',
      description: 'Dashboard shows all agent activity, policy violations, and real-time wallet status. Update rules anytime.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
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
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="group relative p-6 rounded-2xl border border-emerald-500/20 bg-[#02130f]/50 hover:bg-[#02130f]/80 hover:border-emerald-500/40 transition-all duration-300"
            >
              {/* Connector line for desktop */}
              {index < steps.length - 2 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-emerald-500/30" />
              )}
              {index === 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 w-6 h-px bg-emerald-500/30" />
              )}

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
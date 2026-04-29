export function FeaturesGrid() {
  const features = [
    {
      title: 'Derived Keys',
      description: 'No new seed phrases. iWallets are deterministically derived from your master wallet signature. Recoverable anytime.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'On-Chain Policy',
      description: 'Daily spend limits, contract whitelists, cooldowns — all enforced by smart contracts, not just software.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'AI Agent Ready',
      description: 'Give your AI agent a wallet it can use. Policy rules ensure it cannot exceed the boundaries you set.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
          <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
          <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Live Demo',
      description: 'Try the AI agent right now. Watch it execute transactions — and get blocked when it hits a policy limit.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <polygon points="5 3 19 12 5 21 5 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <section id="features" className="py-24 md:py-32 px-6 relative bg-[#02130f]">
      {/* Solid background */}
      <div className="absolute inset-0 bg-[#02130f]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-4 uppercase">Features</p>
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            Built for Safety
          </h2>
          <p className="text-emerald-300/70 text-lg max-w-2xl mx-auto">
            Every feature designed with one goal: keep your funds safe, even when everything else goes wrong.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl border border-emerald-500/20 bg-[#02130f]/50 hover:bg-[#02130f]/80 hover:border-emerald-500/40 transition-all duration-300"
            >
              <div className="flex flex-col h-full">
                {/* Icon */}
                <div className="text-emerald-400 mb-4">
                  {feature.icon}
                </div>

                {/* Content */}
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
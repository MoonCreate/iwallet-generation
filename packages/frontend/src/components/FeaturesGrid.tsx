export function FeaturesGrid() {
  const features = [
    {
      title: 'Daily Limits',
      description: 'Cap how much your AI agent can spend per day. Even a compromised agent can\'t drain your funds in one go.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: 'Contract Whitelist',
      description: 'Your agent can only interact with pre-approved contracts. Unknown addresses are automatically blocked.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Cooldown Windows',
      description: 'Set time windows between transactions. Prevents rapid draining even if credentials are compromised.',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: 'Emergency Freeze',
      description: 'One-click freeze. Instantly revoke all agent permissions. Your funds stay locked until you unlock.',
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
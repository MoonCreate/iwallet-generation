import { Link } from '@tanstack/react-router'

export function FinalCTA() {
  return (
    <section id="get-started" className="py-24 md:py-32 px-6 relative">
      {/* Gradient from FeaturesGrid bg to very dark footer color */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#02130f] to-[#010a07]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Section header */}
        <div className="mb-10">
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            Stop Hoping AI<br />
            <span className="text-[#10b981]">Behaves Safely.</span><br />
            Enforce It.
          </h2>
          <p className="text-emerald-300/70 text-lg leading-relaxed max-w-xl mx-auto">
            Your AI agents get a wallet that enforces rules. Policy-protected, attack-resistant, human-controlled.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/create"
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 !text-white font-semibold rounded-lg transition-colors"
          >
            Deploy Your Agent Wallet
          </Link>
        </div>
      </div>
    </section>
  )
}
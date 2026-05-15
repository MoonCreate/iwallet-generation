import { Link } from "@tanstack/react-router";

export function FinalCTA() {
  return (
    <section id="get-started" className="py-24 md:py-32 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#02130f] to-[#010a07]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <div className="mb-10">
          <h2 className="text-4xl md:text-5xl font-black text-emerald-100 mb-4 leading-tight">
            Stop Hoping AI<br />
            <span className="text-[#10b981]">Behaves Safely.</span><br />
            Enforce It.
          </h2>
          <p className="text-emerald-300/70 text-lg leading-relaxed max-w-xl mx-auto">
            Your AI agents get a wallet that enforces rules. Policy-protected, attack-resistant, human-controlled. Powered by 0G.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/policy"
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Connect Wallet & Start
          </Link>
          <Link
            to="/agent"
            className="px-8 py-4 border border-emerald-500/40 hover:border-emerald-500 text-emerald-100 font-semibold rounded-lg transition-colors"
          >
            Chat with Agent
          </Link>
        </div>
      </div>
    </section>
  )
}

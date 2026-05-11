import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { HowItWorks } from '#/components/HowItWorks'
import { FeaturesGrid } from '#/components/FeaturesGrid'
import { FinalCTA } from '#/components/FinalCTA'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const [RobotSceneComponent, setRobotSceneComponent] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    import('#/components/RobotScene').then(m => {
      if (mounted) {
        setRobotSceneComponent(() => m.RobotScene)
      }
    }).catch(err => {
      console.error("Failed to load RobotScene", err)
    })
    return () => { mounted = false }
  }, [])

  if (!RobotSceneComponent) {
    return (
      <div className="w-full h-screen bg-[#02130f] flex items-center justify-center">
        <div className="text-emerald-500 font-mono text-sm tracking-widest animate-pulse">
          INITIALIZING SENTINEL UNIT...
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-[#02130f]">
      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#02130f] via-[#0a1f15] to-[#02130f] opacity-50" />

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-6 uppercase">iWallet Protocol</p>

          <h1 className="text-6xl md:text-7xl font-black text-emerald-100 mb-6 leading-tight tracking-tight">
            AI Agents With<br />
            <span className="text-[#10b981]">Policy-Protected</span><br />
            Wallets
          </h1>

          <p className="text-emerald-300/70 text-lg md:text-xl leading-relaxed mb-10 max-w-xl mx-auto">
            Give your AI agents a wallet that enforces rules — daily limits, allowed contracts, cooldowns. Even when compromised, your funds stay protected.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/create"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 !text-white font-semibold rounded-lg transition-colors"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="px-8 py-4 border border-emerald-500/40 hover:border-emerald-500 text-emerald-100 font-semibold rounded-lg transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-emerald-500/50">
          <span className="text-xs font-mono tracking-widest uppercase">Scroll to explore</span>
          <div className="w-[1px] h-8 bg-gradient-to-b from-emerald-500/50 to-transparent" />
        </div>
      </section>

      {/* Robot Scene - scrolls away naturally like Hero */}
      <div className="relative" style={{ height: '300vh' }}>
        <RobotSceneComponent />
      </div>

      {/* How It Works Section */}
      <HowItWorks />

      {/* Features Grid Section */}
      <FeaturesGrid />

      {/* Final CTA Section */}
      <FinalCTA />
    </div>
  )
}

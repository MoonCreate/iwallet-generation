import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { HowItWorks } from '#/components/HowItWorks'
import { FeaturesGrid } from '#/components/FeaturesGrid'
import { Roadmap } from '#/components/Roadmap'
import { FinalCTA } from '#/components/FinalCTA'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const [RobotSceneComponent, setRobotSceneComponent] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    import('#/components/RobotScene').then(m => {
      if (mounted) setRobotSceneComponent(() => m.RobotScene)
    }).catch(() => { })
    return () => { mounted = false }
  }, [])

  return (
    <div className="w-full min-h-screen bg-[#02130f]">
      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#02130f] via-[#0a1f15] to-[#02130f] opacity-50" />

        <div className="relative z-10 max-w-3xl">
          <p className="text-emerald-500/60 font-mono text-xs tracking-[0.5em] mb-6 uppercase">Built on 0G</p>

          <h1 className="text-6xl md:text-7xl font-black text-emerald-100 mb-6 leading-tight tracking-tight">
            AI Agents With<br />
            <span className="text-[#10b981]">Policy-Protected</span><br />
            Wallets
          </h1>

          <p className="text-emerald-300/70 text-lg md:text-xl leading-relaxed mb-10 max-w-xl mx-auto">
            AI-powered wallets with on-chain policy enforcement. Conversations permanently stored on <strong className="text-emerald-300">0G decentralized storage</strong>. Built on the 0G blockchain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/dashboard"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
            >
              Launch App
            </Link>
            <Link
              to="/agent"
              className="px-8 py-4 border border-emerald-500/40 hover:border-emerald-500 text-emerald-100 font-semibold rounded-lg transition-colors"
            >
              Try Agent Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Robot Scene */}
      {RobotSceneComponent && (
        <div className="relative" style={{ height: '300vh' }}>
          <RobotSceneComponent />
        </div>
      )}

      <HowItWorks />
      <FeaturesGrid />
      <Roadmap />
      <FinalCTA />
    </div>
  )
}

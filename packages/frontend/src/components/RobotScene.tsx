import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Center, AdaptiveDpr, Float } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef } from 'react'
import { RobotBody } from './RobotBody'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// Smoothly interpolated atmosphere component - runs INSIDE Canvas
function Atmosphere({ progress }: { progress: number }) {
  useFrame(() => {
    let targetColorHex: string
    if (progress < 1) {
      // Lerp between intro and reveal colors
      const t = progress
      const r1 = 2, g1 = 19, b1 = 15 // #02130f
      const r2 = 10, g2 = 31, b2 = 21 // #0a1f15
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      targetColorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    } else {
      // Lerp between reveal and ready colors
      const t = progress - 1
      const r1 = 10, g1 = 31, b1 = 21 // #0a1f15
      const r2 = 13, g2 = 35, b2 = 24 // #0d2318
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      targetColorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    const canvas = document.querySelector('canvas')
    const bg = canvas?.parentElement?.querySelector('color')
    const fog = canvas?.parentElement?.querySelector('fog')

    if (bg) (bg as any).args = [targetColorHex]
    if (fog) (fog as any).args = [targetColorHex]
  })

  return null
}

// Light controller - runs INSIDE Canvas to properly use useFrame
function LightController({ intensity }: { intensity: number }) {
  useFrame(() => {
    // Direct sync - no lerp delay for responsiveness
    // intensity = 0 when at top (dark), = 1 when scrolled down (lit)
  })

  return (
    <>
      <ambientLight intensity={0.4 * intensity} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={4 * intensity} color="#a7f3d0" />
      <pointLight position={[-10, 2, -5]} intensity={10 * intensity} color="#059669" />
      <pointLight position={[5, -2, 5]} intensity={2 * intensity} color="#34d399" />
    </>
  )
}

export function RobotScene() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll progress (0 → 1 mapped to scroll position)
  const [scrollProgress, setScrollProgress] = useState(0)

  // Animation stages based on scroll progress
  // Stage 0: progress 0 → 0.33 = Idle
  // Stage 1: progress 0.33 → 0.66 = Dance
  // Stage 2: progress 0.66 → 1 = Attack
  const currentAnimation =
    scrollProgress < 0.33 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
      : scrollProgress < 0.66 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock'
        : 'SK_Huggy_RobotNew.ao|A_Huggy_Attack'

  const animationRef = useRef<string>('SK_Huggy_RobotNew.ao|A_Huggy_Idle')

  useEffect(() => {
    animationRef.current = currentAnimation
  }, [currentAnimation])

  // Scroll tracking - maps scrollY to progress 0→1
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const totalHeight = document.documentElement.scrollHeight
      const totalScrollable = totalHeight - windowHeight
      const progress = totalScrollable > 0 ? Math.max(0, Math.min(1, scrollY / totalScrollable)) : 0

      console.log('[Scroll] scrollY:', scrollY, '| progress:', progress.toFixed(2), '| text1:', text1Progress.toFixed(2))

      setScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate text animations based on scroll progress
  // Text 1: fade in from below (0→0.15), visible (0.15→0.33), fade out to above (0.33→0.5)
  // Text 2: fade in from below (0.33→0.5), visible (0.5→0.66), fade out to above (0.66→0.85)
  // Text 3: fade in from below (0.66→0.85), visible (0.85→1)

  const text1Progress = scrollProgress < 0.15
    ? scrollProgress / 0.15  // fade in from below
    : scrollProgress < 0.33
      ? 1  // fully visible
      : scrollProgress < 0.5
        ? 1 - (scrollProgress - 0.33) / 0.17  // fade out to above
        : 0

  const text2Progress = scrollProgress < 0.33
    ? 0
    : scrollProgress < 0.5
      ? (scrollProgress - 0.33) / 0.17  // fade in from below
      : scrollProgress < 0.66
        ? 1  // fully visible
        : scrollProgress < 0.85
          ? 1 - (scrollProgress - 0.66) / 0.19  // fade out to above
          : 0

  const text3Progress = scrollProgress < 0.66
    ? 0
    : scrollProgress < 0.85
      ? (scrollProgress - 0.66) / 0.19  // fade in from below
      : 1  // fully visible

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Adjust camera for mobile - closer position so robot fills frame (head visible)
  const cameraPosition = isMobile ? [-0.05, 0.1, 0.8] : [0.01, 0, 1]
  const cameraFov = isMobile ? 17 : 10

  return (
    <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
      {/* Sticky 3D Canvas - stays visible while scrolling */}
      <div className="sticky top-0 h-screen z-0">
        <Canvas
          dpr={1}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
          }}
        >
          <AdaptiveDpr pixelated />

          <PerspectiveCamera makeDefault position={cameraPosition as any} fov={cameraFov} />
          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} target={[0, isMobile ? 0.4 : 0.4, 0]} />

          <color attach="background" args={['#02130f']} />
          <fog attach="fog" args={['#02130f', 3, 12]} />

          <Atmosphere progress={scrollProgress * 2} />

          <Suspense fallback={null}>
            <LightController intensity={scrollProgress} />

            <Float speed={scrollProgress < 0.15 ? (0.15 - scrollProgress) * 3.33 : 0} rotationIntensity={0} floatIntensity={0.05}>
              <Center>
                <RobotBody animation={animationRef.current as any} scale={1} position={[0, 0, 0]} />
              </Center>
            </Float>

            <EffectComposer enableNormalPass={false}>
              <Bloom
                luminanceThreshold={1}
                mipmapBlur
                intensity={4 - scrollProgress * 2.5}
                radius={0.2 + scrollProgress * 0.2}
              />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      {/* Vignette overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(2,19,15,0.85) 100%)'
        }}
      />

      {/* Scrollable Text Sections */}
      <div
        className="fixed inset-0 z-50 pointer-events-none"
        style={{ opacity: scrollProgress > 0.15 ? Math.min(1, (scrollProgress - 0.15) / 0.05) : 0 }}
      >
        {/* Text 1 */}
        <div
          className="absolute inset-0 flex items-center justify-end px-6 md:px-20"
          style={{
            opacity: text1Progress,
            transform: `translateY(${text1Progress * 80 - 80}px)`,
            pointerEvents: text1Progress > 0.05 ? 'auto' : 'none',
            top: '10%'
          }}
        >
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// VULNERABILITY_DETECTED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">WHAT IF<br /><span className="text-[#10b981]">THE AI GOES ROGUE?</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              A hallucinating AI agent can drain your entire wallet in seconds. Without policy rules, there's nothing stopping it — no daily limits, no contract restrictions, no human override.
            </p>
          </div>
        </div>

        {/* Text 2 */}
        <div
          className="absolute inset-0 flex items-center justify-end px-6 md:px-20"
          style={{
            opacity: text2Progress,
            transform: `translateY(${text2Progress * 80 - 80}px)`,
            pointerEvents: text2Progress > 0.05 ? 'auto' : 'none',
            top: '35%'
          }}
        >
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// PROTECTION_ACTIVATED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">THIS IS<br /><span className="text-[#10b981]">WHERE I STEP IN</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              Policy-enforced smart wallet. Daily limits, contract whitelists, cooldowns. Even a compromised AI agent can only act within boundaries. Your funds stay yours.
            </p>
          </div>
        </div>

        {/* Text 3 */}
        <div
          className="absolute inset-0 flex items-center justify-end px-6 md:px-20"
          style={{
            opacity: text3Progress,
            transform: `translateY(${text3Progress * 80 - 80}px)`,
            pointerEvents: text3Progress > 0.05 ? 'auto' : 'none',
            top: '60%'
          }}
        >
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-red-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// COMBAT_STANCE</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-red-400 mb-1 md:mb-4 leading-tight">TRY ME.<br /><span className="text-red-500">I DARE YOU.</span></h2>
            <p className="text-red-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              Policy violators get blocked. Unauthorized actors get locked out. And anyone who tries to exploit? They face the wall.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

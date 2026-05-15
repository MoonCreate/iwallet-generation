import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Center, AdaptiveDpr, Float } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef } from 'react'
import { RobotBody } from './RobotBody'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// ── Device capability detection ─────────────────────────────────
function isLowEndDevice(): boolean {
  if (typeof window === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 4
  const memory = (navigator as any).deviceMemory || 8
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
  return cores < 4 || memory < 4 || (isMobile && cores < 6)
}

// ── Pause rendering when not visible ────────────────────────────
function RenderController({ visible }: { visible: boolean }) {
  const { invalidate, clock } = useThree()
  const wasVisible = useRef(visible)

  useEffect(() => {
    if (visible && !wasVisible.current) {
      clock.start()
      invalidate()
    }
    if (!visible) {
      clock.stop()
    }
    wasVisible.current = visible
  }, [visible, invalidate, clock])

  return null
}

// ── Light controller ────────────────────────────────────────────
function LightController() {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const spotRef = useRef<THREE.SpotLight>(null)
  const point1Ref = useRef<THREE.PointLight>(null)
  const point2Ref = useRef<THREE.PointLight>(null)

  useFrame(() => {
    const totalScrollable = document.documentElement.scrollHeight - window.innerHeight
    const progress = totalScrollable > 0 ? Math.max(0, Math.min(1, window.scrollY / totalScrollable)) : 0
    const robotIntensity = Math.max(0, Math.min(1, (progress - 0.19) / 0.81))

    if (ambientRef.current) ambientRef.current.intensity = 0.4 * robotIntensity
    if (spotRef.current) spotRef.current.intensity = 4 * robotIntensity
    if (point1Ref.current) point1Ref.current.intensity = 10 * robotIntensity
    if (point2Ref.current) point2Ref.current.intensity = 2 * robotIntensity
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0} />
      <spotLight ref={spotRef} position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={0} color="#a7f3d0" />
      <pointLight ref={point1Ref} position={[-10, 2, -5]} intensity={0} color="#059669" />
      <pointLight ref={point2Ref} position={[5, -2, 5]} intensity={0} color="#34d399" />
    </>
  )
}

function FloatingRobotBody({ animation }: { animation: string }) {
  return (
    <Center>
      <RobotBody animation={animation as any} scale={1} position={[0, 0, 0]} />
    </Center>
  )
}

// ── Simplified post-processing (lighter bloom) ──────────────────
function LightBloom() {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={1.2}
        mipmapBlur
        intensity={2}
        radius={0.3}
        levels={3}
      />
    </EffectComposer>
  )
}

// ── Static fallback for low-end devices ─────────────────────────
function StaticFallback() {
  return (
    <div className="sticky top-0 h-screen z-10 flex items-center justify-center">
      <div className="relative">
        <div className="w-48 h-48 md:w-72 md:h-72 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
            <div className="text-emerald-400 font-mono text-xs md:text-sm tracking-widest">iWALLET</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping" style={{ animationDuration: '3s' }} />
      </div>
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────
export function RobotScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const text1Ref = useRef<HTMLDivElement>(null)
  const text2Ref = useRef<HTMLDivElement>(null)
  const text3Ref = useRef<HTMLDivElement>(null)
  const textsContainerRef = useRef<HTMLDivElement>(null)

  const [animationString, setAnimationString] = useState('SK_Huggy_RobotNew.ao|A_Huggy_Idle')
  const [isVisible, setIsVisible] = useState(false)
  const [lowEnd] = useState(() => isLowEndDevice())

  // IntersectionObserver for visibility-based rendering
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const viewportBottom = scrollY + window.innerHeight

      const containerTop = containerRef.current ? containerRef.current.getBoundingClientRect().top + scrollY : 0
      const containerHeight = containerRef.current?.offsetHeight || 0
      const containerBottom = containerTop + containerHeight

      const containerInView = viewportBottom > containerTop && scrollY < containerBottom

      let containerProgress = 0
      if (containerInView) {
        const scrollIntoContainer = scrollY - containerTop
        containerProgress = Math.max(0, Math.min(1, scrollIntoContainer / (containerHeight - window.innerHeight)))
      }

      const progress = containerInView ? containerProgress : (scrollY > containerBottom ? 1 : 0)

      const newAnim = progress < 0.33 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
        : progress < 0.66 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock'
          : 'SK_Huggy_RobotNew.ao|A_Huggy_Attack'

      setAnimationString(prev => prev !== newAnim ? newAnim : prev)

      // Background color
      const robotIntensity = Math.max(0, Math.min(1, (progress - 0.19) / 0.81))
      const p = robotIntensity * 2
      let r, g, b
      if (p < 1) {
        r = 2 + 8 * p; g = 19 + 12 * p; b = 15 + 6 * p
      } else {
        const t = p - 1; r = 10 + 3 * t; g = 31 + 4 * t; b = 21 + 3 * t
      }
      if (containerRef.current) {
        containerRef.current.style.backgroundColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
      }

      // Text animations
      if (textsContainerRef.current) {
        textsContainerRef.current.style.opacity = progress > 0.2 ? Math.min(1, (progress - 0.2) / 0.05).toString() : "0"
      }
      if (text1Ref.current) {
        const p1 = progress < 0.1 ? 0 : progress < 0.25 ? (progress - 0.1) / 0.15 : progress < 0.48 ? 1 : 1 - (progress - 0.48) / 0.07
        text1Ref.current.style.opacity = p1.toString()
        text1Ref.current.style.transform = `translateY(${p1 < 1 ? (p1 * 80 - 80) : 0}px)`
      }
      if (text2Ref.current) {
        const p2 = progress < 0.5 ? 0 : progress < 0.65 ? (progress - 0.5) / 0.15 : progress < 0.78 ? 1 : 1 - (progress - 0.78) / 0.07
        text2Ref.current.style.opacity = p2.toString()
        text2Ref.current.style.transform = `translateY(${p2 < 1 ? (p2 * 80 - 80) : 0}px)`
      }
      if (text3Ref.current) {
        const p3 = progress < 0.85 ? 0 : progress < 0.95 ? (progress - 0.85) / 0.1 : 1
        text3Ref.current.style.opacity = p3.toString()
        text3Ref.current.style.transform = `translateY(${p3 < 1 ? (p3 * 80 - 80) : 0}px)`
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const cameraPosition = isMobile ? [-0.05, 0.1, 0.8] : [0.01, 0, 1]
  const cameraFov = isMobile ? 17 : 10

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '300vh', backgroundColor: 'rgb(2, 19, 15)' }}>
      {/* 3D Canvas or static fallback */}
      {lowEnd ? (
        <StaticFallback />
      ) : (
        <div className="sticky top-0 h-screen z-10 relative">
          <div className="absolute inset-0 z-10" style={{ touchAction: 'pan-y' }} />
          <Canvas
            dpr={1}
            frameloop={isVisible ? 'always' : 'never'}
            gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
          >
            <AdaptiveDpr pixelated />
            <RenderController visible={isVisible} />
            <PerspectiveCamera makeDefault position={cameraPosition as any} fov={cameraFov} />
            <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} target={[0, isMobile ? 0.4 : 0.4, 0]} />

            <fog attach="fog" args={['#02130f', 3, 12]} />
            <LightController />
            <LightBloom />

            <Float speed={1} rotationIntensity={0} floatIntensity={0.05}>
              <Suspense fallback={null}>
                <FloatingRobotBody animation={animationString} />
              </Suspense>
            </Float>
          </Canvas>
        </div>
      )}

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{ background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(2,19,15,0.85) 100%)' }}
      />

      {/* Text overlays */}
      <div ref={textsContainerRef} className="absolute inset-0 z-50 pointer-events-none" style={{ opacity: 0 }}>
        <div ref={text1Ref} className="absolute inset-0 flex items-center justify-end px-6 md:px-20" style={{ top: '-10%' }}>
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// VULNERABILITY_DETECTED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">WHAT IF<br /><span className="text-[#10b981]">THE AI GOES ROGUE?</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              A hallucinating AI agent can drain your entire wallet in seconds. Without policy rules, there's nothing stopping it — no daily limits, no contract restrictions, no human override.
            </p>
          </div>
        </div>

        <div ref={text2Ref} className="absolute inset-0 flex items-center justify-end px-6 md:px-20" style={{ top: '35%' }}>
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// PROTECTION_ACTIVATED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">THIS IS<br /><span className="text-[#10b981]">WHERE I STEP IN</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              Policy-enforced smart wallet. Daily limits, contract whitelists, cooldowns. Even a compromised AI agent can only act within boundaries. Your funds stay yours.
            </p>
          </div>
        </div>

        <div ref={text3Ref} className="absolute inset-0 flex items-center justify-end px-6 md:px-20" style={{ top: '60%' }}>
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

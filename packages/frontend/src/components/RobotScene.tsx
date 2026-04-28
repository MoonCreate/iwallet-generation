import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Center, AdaptiveDpr, Float } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef } from 'react'
import { RobotBody } from './RobotBody'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// Smoothly interpolated atmosphere component - runs INSIDE Canvas
function Atmosphere({ progress }: { progress: number }) {
  const bgRef = useRef(new THREE.Color('#02130f'))
  const fogRef = useRef(new THREE.Color('#02130f'))

  useFrame((_, delta) => {
    const speed = 3 * delta

    let targetColor: THREE.Color
    if (progress < 1) {
      targetColor = new THREE.Color('#02130f').lerp(new THREE.Color('#0a1f15'), progress)
    } else {
      targetColor = new THREE.Color('#0a1f15').lerp(new THREE.Color('#0d2318'), progress - 1)
    }

    bgRef.current.lerp(targetColor, speed)
    fogRef.current.lerp(targetColor, speed)

    const canvas = document.querySelector('canvas')
    const bg = canvas?.parentElement?.querySelector('color')
    const fog = canvas?.parentElement?.querySelector('fog')

    if (bg) (bg as any).args = [bgRef.current.getHexString()]
    if (fog) (fog as any).args = [fogRef.current.getHexString()]
  })

  return null
}

// Light controller - runs INSIDE Canvas to properly use useFrame
function LightController({ intensity }: { intensity: number }) {
  const lightRef = useRef(0)

  useFrame(() => {
    lightRef.current += (intensity - lightRef.current) * 0.03
  })

  return (
    <>
      <ambientLight intensity={0.4 * lightRef.current} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={4 * lightRef.current} color="#a7f3d0" />
      <pointLight position={[-10, 2, -5]} intensity={10 * lightRef.current} color="#059669" />
      <pointLight position={[5, -2, 5]} intensity={2 * lightRef.current} color="#34d399" />
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

  return (
    <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
      {/* Fixed 3D Canvas - behind everything */}
      <div className="fixed inset-0 z-0">
        <Canvas
          dpr={1}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
          }}
        >
          <AdaptiveDpr pixelated />

          <PerspectiveCamera makeDefault position={[0.01, 0, 1]} fov={10} />
          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} target={[0, 0.4, 0]} />

          <color attach="background" args={['#02130f']} />
          <fog attach="fog" args={['#02130f', 3, 12]} />

          <Atmosphere progress={scrollProgress * 2} />

          <Suspense fallback={null}>
            <LightController intensity={scrollProgress > 0.05 ? 1 : 0} />

            <Float speed={scrollProgress < 0.1 ? 0.5 : 0} rotationIntensity={0} floatIntensity={0.05}>
              <Center>
                <RobotBody animation={animationRef.current as any} scale={1} position={[0, 0, 0]} />
              </Center>
            </Float>

            <EffectComposer enableNormalPass={false}>
              <Bloom
                luminanceThreshold={1}
                mipmapBlur
                intensity={scrollProgress < 0.1 ? 4 : 1.5}
                radius={scrollProgress < 0.1 ? 0.2 : 0.4}
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

      {/* Scrollable Text Sections - ALL fixed at same viewport position */}
      <div className="fixed inset-0 z-20 pointer-events-none">
        {/* Text 1: HUGGY PROTOCOL - AI Agent Wallet Introduction */}
        <div
          className="absolute inset-0 flex items-center justify-end px-20"
          style={{
            opacity: text1Progress,
            transform: `translateY(${text1Progress * 80 - 80}px)`,
            pointerEvents: text1Progress > 0.05 ? 'auto' : 'none'
          }}
        >
          <div className="max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-xs tracking-[0.3em] mb-4">// POLICY_ENFORCED_WALLET</p>
            <h2 className="text-5xl font-black text-emerald-100 mb-4 leading-tight">HUGGY<br /><span className="text-[#10b981]">PROTOCOL</span></h2>
            <p className="text-emerald-300/70 text-sm leading-relaxed">
              An AI agent wallet that executes within defined policy boundaries. The agent acts, but never exceeds — protecting your assets even under adversarial conditions.
            </p>
          </div>
        </div>

        {/* Text 2: POLICY ENFORCEMENT - Security Features */}
        <div
          className="absolute inset-0 flex items-center justify-end px-20"
          style={{
            opacity: text2Progress,
            transform: `translateY(${text2Progress * 80 - 80}px)`,
            pointerEvents: text2Progress > 0.05 ? 'auto' : 'none'
          }}
        >
          <div className="max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-xs tracking-[0.3em] mb-4">// SECURITY_LAYER</p>
            <h2 className="text-5xl font-black text-emerald-100 mb-4 leading-tight">POLICY<br /><span className="text-[#10b981]">ENFORCEMENT</span></h2>
            <p className="text-emerald-300/70 text-sm leading-relaxed">
              Daily spend limits. Allowed contract whitelists. Cooldown periods. Even if an AI agent is compromised or manipulated, your funds remain protected by on-chain rules no one can bypass.
            </p>
          </div>
        </div>

        {/* Text 3: THREAT SHIELD - Guardian Active */}
        <div
          className="absolute inset-0 flex items-center justify-end px-20"
          style={{
            opacity: text3Progress,
            transform: `translateY(${text3Progress * 80 - 80}px)`,
            pointerEvents: text3Progress > 0.05 ? 'auto' : 'none'
          }}
        >
          <div className="max-w-md text-right">
            <p className="text-red-400/80 font-mono text-xs tracking-[0.3em] mb-4">// GUARDIAN_ACTIVE</p>
            <h2 className="text-5xl font-black text-red-400 mb-4 leading-tight">THREAT<br /><span className="text-red-500">SHIELD</span></h2>
            <p className="text-red-300/70 text-sm leading-relaxed">
              Unauthorized access attempts, policy violations, and anomalous behaviors are blocked at the contract level. Your guardian never sleeps.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

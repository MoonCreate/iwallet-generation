import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Center, AdaptiveDpr, Float } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef } from 'react'
import { RobotBody } from './RobotBody'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
// Light controller - React State decoupled
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
  const floatRef = useRef<THREE.Group>(null)

  // Floating speed intensity managed organically without triggering React Re-renders
  useFrame(() => {

    // Fallback: simply use the Float component but its props aren't highly reactive without re-renders. 
    // We update scale slightly for breathing effect or let Float do its thing.
  })

  return (
    <Center ref={floatRef}>
      <RobotBody animation={animation as any} scale={1} position={[0, 0, 0]} />
    </Center>
  )
}

function PostProcessingController() {
  const [intensity, setIntensity] = useState(4)
  const [radius, setRadius] = useState(0.2)

  useEffect(() => {
    const handleScroll = () => {
      const totalScrollable = document.documentElement.scrollHeight - window.innerHeight
      const progress = totalScrollable > 0 ? Math.max(0, Math.min(1, window.scrollY / totalScrollable)) : 0
      const robotIntensity = Math.max(0, Math.min(1, (progress - 0.19) / 0.81))

      setIntensity(4 - robotIntensity * 2.5)
      setRadius(0.2 + robotIntensity * 0.2)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        luminanceThreshold={1}
        mipmapBlur
        intensity={intensity}
        radius={radius}
      />
    </EffectComposer>
  )
}


export function RobotScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const text1Ref = useRef<HTMLDivElement>(null)
  const text2Ref = useRef<HTMLDivElement>(null)
  const text3Ref = useRef<HTMLDivElement>(null)
  const textsContainerRef = useRef<HTMLDivElement>(null)

  // Only state left: The animation string! Triggers a minimal re-render only when thresholds are crossed.
  const [animationString, setAnimationString] = useState('SK_Huggy_RobotNew.ao|A_Huggy_Idle')

  // Highly optimized unified scroll listener outside of React Virtual DOM
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const viewportTop = scrollY
      const viewportBottom = scrollY + window.innerHeight

      // Container position tracking - solid check for when container leaves viewport
      const containerTop = containerRef.current ? containerRef.current.getBoundingClientRect().top + scrollY : 0
      const containerHeight = containerRef.current?.offsetHeight || 0
      const containerBottom = containerTop + containerHeight

      // Check if container is still in viewport
      // Container is in view if: viewport bottom > container top AND viewport top < container bottom
      const containerInView = viewportBottom > containerTop && viewportTop < containerBottom

      // Calculate progress relative to container (0 = container top enters viewport, 1 = container bottom)
      let containerProgress = 0
      if (containerInView) {
        const scrollIntoContainer = scrollY - containerTop
        containerProgress = Math.max(0, Math.min(1, scrollIntoContainer / (containerHeight - window.innerHeight)))
      }

      // Use containerProgress for text animations (0 = container just enters, 1 = container fully passed)
      // Also check if container is out of view to hide texts immediately
      const progress = containerInView ? containerProgress : (scrollY > containerBottom ? 1 : 0)

      // Calculate the specific animation boundary so React doesn't re-render redundantly
      const newAnim = progress < 0.33 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
        : progress < 0.66 ? 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock'
          : 'SK_Huggy_RobotNew.ao|A_Huggy_Attack'

      setAnimationString(prev => prev !== newAnim ? newAnim : prev)

      // Hardware-accelerated DOM background manipulation to guarantee perfect CSS match with Hero Section
      const robotIntensity = Math.max(0, Math.min(1, (progress - 0.19) / 0.81))
      const p = robotIntensity * 2
      let r, g, b

      if (p < 1) {
        const t = p
        r = 2 + (10 - 2) * t
        g = 19 + (31 - 19) * t
        b = 15 + (21 - 15) * t
      } else {
        const t = p - 1
        r = 10 + (13 - 10) * t
        g = 31 + (35 - 31) * t
        b = 21 + (24 - 21) * t
      }

      if (containerRef.current) {
        containerRef.current.style.backgroundColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
      }

      // Hardware-accelerated DOM manipulation for Text Layouts
      // Only show texts when container is in view
      if (textsContainerRef.current) {
        textsContainerRef.current.style.opacity = containerInView && progress > 0.2 ? Math.min(1, (progress - 0.2) / 0.05).toString() : "0"
      }

      if (text1Ref.current) {
        const text1Prog = progress < 0.2 ? 0 : progress < 0.33 ? (progress - 0.2) / 0.13 : progress < 0.5 ? 1 : progress < 0.6 ? 1 - (progress - 0.5) / 0.1 : 0
        text1Ref.current.style.opacity = containerInView ? text1Prog.toString() : "0"
        text1Ref.current.style.transform = `translateY(${text1Prog * 80 - 80}px)`
        text1Ref.current.style.pointerEvents = text1Prog > 0.05 && containerInView ? 'auto' : 'none'
      }

      if (text2Ref.current) {
        const text2Prog = progress < 0.5 ? 0 : progress < 0.6 ? (progress - 0.5) / 0.1 : progress < 0.75 ? 1 : progress < 0.85 ? 1 - (progress - 0.75) / 0.1 : 0
        text2Ref.current.style.opacity = containerInView ? text2Prog.toString() : "0"
        text2Ref.current.style.transform = `translateY(${text2Prog * 80 - 80}px)`
        text2Ref.current.style.pointerEvents = text2Prog > 0.05 && containerInView ? 'auto' : 'none'
      }

      if (text3Ref.current) {
        const text3Prog = progress < 0.85 ? 0 : progress < 0.90 ? (progress - 0.85) / 0.05 : progress < 0.99 ? 1 : 0
        const text3Opacity = (!containerInView || progress >= 1.0) ? 0 : text3Prog
        text3Ref.current.style.opacity = text3Opacity.toString()
        text3Ref.current.style.transform = `translateY(${text3Prog * 80 - 80}px)`
        text3Ref.current.style.pointerEvents = text3Prog > 0.05 && containerInView ? 'auto' : 'none'
      }

      // Debug log
      console.log(`[Scroll] containerInView: ${containerInView} | progress: ${progress.toFixed(3)} | viewportBottom: ${viewportBottom} | containerTop: ${containerTop}`)
    }

    // Call once initially to set the layout
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const cameraPosition = isMobile ? [-0.05, 0.1, 0.8] : [0.01, 0, 1]
  const cameraFov = isMobile ? 17 : 10

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: '1200vh', backgroundColor: 'rgb(2, 19, 15)' }}>
      {/* Sticky 3D Canvas - stays visible during scroll, releases when container passes */}
      <div className="sticky top-0 h-screen z-0">
        <Canvas
          dpr={1}
          gl={{
            antialias: false,
            powerPreference: 'default',
            alpha: true
          }}
        >
          <AdaptiveDpr pixelated />
          <PerspectiveCamera makeDefault position={cameraPosition as any} fov={cameraFov} />
          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} target={[0, isMobile ? 0.4 : 0.4, 0]} />

          {/* Background is fully transparent to reveal CSS backgroundColor */}
          <fog attach="fog" args={['#02130f', 3, 12]} />

          {/* Logic decoupled controllers running natively on GPU frames */}
          <LightController />
          <PostProcessingController />

          <Float speed={1} rotationIntensity={0} floatIntensity={0.05}>
            <Suspense fallback={null}>
              <FloatingRobotBody animation={animationString} />
            </Suspense>
          </Float>
        </Canvas>
      </div>

      {/* Vignette overlay - stays fixed in viewport with sticky canvas */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(2,19,15,0.85) 100%)'
        }}
      />

      {/* Scrollable Text Sections - stays fixed in viewport with sticky canvas */}
      <div ref={textsContainerRef} className="fixed inset-0 z-50 pointer-events-none" style={{ opacity: 0 }}>
        {/* Text 1 */}
        <div ref={text1Ref} className="absolute inset-0 flex items-center justify-end px-6 md:px-20" style={{ top: '10%' }}>
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// VULNERABILITY_DETECTED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">WHAT IF<br /><span className="text-[#10b981]">THE AI GOES ROGUE?</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              A hallucinating AI agent can drain your entire wallet in seconds. Without policy rules, there's nothing stopping it — no daily limits, no contract restrictions, no human override.
            </p>
          </div>
        </div>

        {/* Text 2 */}
        <div ref={text2Ref} className="absolute inset-0 flex items-center justify-end px-6 md:px-20" style={{ top: '35%' }}>
          <div className="max-w-[90%] md:max-w-md text-right">
            <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-4">// PROTECTION_ACTIVATED</p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-100 mb-1 md:mb-4 leading-tight">THIS IS<br /><span className="text-[#10b981]">WHERE I STEP IN</span></h2>
            <p className="text-emerald-300/70 text-[10px] sm:text-xs md:text-sm leading-relaxed">
              Policy-enforced smart wallet. Daily limits, contract whitelists, cooldowns. Even a compromised AI agent can only act within boundaries. Your funds stay yours.
            </p>
          </div>
        </div>

        {/* Text 3 */}
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

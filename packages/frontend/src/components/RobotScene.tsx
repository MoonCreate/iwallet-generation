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
  const animationRef = useRef<string>('SK_Huggy_RobotNew.ao|A_Huggy_Idle')

  // Animation state driven by RAF
  const [atmosphereProgress, setAtmosphereProgress] = useState(0)
  const [bloomIntensity, setBloomIntensity] = useState(4)
  const [bloomRadius, setBloomRadius] = useState(0.2)
  const [floatSpeed, setFloatSpeed] = useState(0.5)
  const [lightIntensity, setLightIntensity] = useState(0)

  useEffect(() => {
    let startTime: number
    let rafId: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = (timestamp - startTime) / 1000

      let targetProgress: number
      let targetBloomIntensity: number
      let targetBloomRadius: number
      let targetFloatSpeed: number
      let targetLightIntensity: number
      let newAnimation: string

      if (elapsed < 2.5) {
        targetProgress = 0.02
        targetBloomIntensity = 4
        targetBloomRadius = 0.2
        targetFloatSpeed = 0.5
        targetLightIntensity = 0
        newAnimation = 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
      } else if (elapsed < 5) {
        const t = (elapsed - 2.5) / 2.5
        targetProgress = 0.02 + (0.98 * t)
        targetBloomIntensity = 4 - (2.5 * t)
        targetBloomRadius = 0.2 + (0.2 * t)
        targetFloatSpeed = 0.5 - (0.5 * Math.min(1, t * 2))
        targetLightIntensity = t
        newAnimation = 'SK_Huggy_RobotNew.ao|A_Huggy_Roar'
      } else {
        const t = Math.min(1, (elapsed - 5) / 2)
        targetProgress = 1 + t
        targetBloomIntensity = 1.5
        targetBloomRadius = 0.4
        targetFloatSpeed = 0
        targetLightIntensity = 1
        newAnimation = 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
      }

      setAtmosphereProgress(targetProgress)
      setBloomIntensity(targetBloomIntensity)
      setBloomRadius(targetBloomRadius)
      setFloatSpeed(targetFloatSpeed)
      setLightIntensity(targetLightIntensity)
      animationRef.current = newAnimation

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#02130f]">
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(2,19,15,0.85) 100%)',
          transition: 'opacity 0.5s ease-out'
        }}
      />

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

        <Atmosphere progress={atmosphereProgress} />

        <Suspense fallback={null}>
          <LightController intensity={lightIntensity} />

          <Float speed={floatSpeed} rotationIntensity={0} floatIntensity={0.05}>
            <Center>
              <RobotBody animation={animationRef.current as any} scale={1} position={[0, 0, 0]} />
            </Center>
          </Float>

          <EffectComposer enableNormalPass={false}>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={bloomIntensity} radius={bloomRadius} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}

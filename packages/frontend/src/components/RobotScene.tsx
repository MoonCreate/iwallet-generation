import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Center, AdaptiveDpr } from '@react-three/drei'
import { Suspense, useState } from 'react'
import { RobotBody } from './RobotBody'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export function RobotScene() {
  const [animation, setAnimation] = useState<any>('SK_Huggy_RobotNew.ao|A_Huggy_Idle')

  const animations = [
    { label: 'Idle', val: 'SK_Huggy_RobotNew.ao|A_Huggy_Idle' },
    { label: 'Dance', val: 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock' },
    { label: 'Walk', val: 'SK_Huggy_RobotNew.ao|A_Huggy_Walk' },
    { label: 'Attack', val: 'SK_Huggy_RobotNew.ao|A_Huggy_Attack' },
    { label: 'Roar', val: 'SK_Huggy_RobotNew.ao|A_Huggy_Roar' },
  ]

  return (
    <div className="relative w-full h-full bg-[#02130f]">
      <Canvas
        dpr={1}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
        }}
      >
        {/* Auto-adapt DPR based on device performance */}
        <AdaptiveDpr pixelated />

        {/* User's choice camera position */}
        <PerspectiveCamera makeDefault position={[0, 0, 1]} fov={10} />
        <OrbitControls
          enablePan={false}
          enableRotate={false}
          enableZoom={false}
          target={[0, 0.4, 0]}
          autoRotate
          autoRotateSpeed={0.1}
        />

        <color attach="background" args={['#02130f']} />
        <fog attach="fog" args={['#02130f', 3, 12]} />

        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />

          {/* Main Key Light */}
          <spotLight
            position={[10, 10, 10]}
            angle={0.15}
            penumbra={1}
            intensity={4}
            color="#a7f3d0"
          />

          {/* Rim Light for silhouette */}
          <pointLight position={[-10, 2, -5]} intensity={10} color="#059669" />

          {/* Fill Light */}
          <pointLight position={[5, -2, 5]} intensity={2} color="#34d399" />

          <Center>
            <RobotBody
              animation={animation}
              scale={1}
              position={[0, 0, 0]}
            />
          </Center>

          {/* Selective Bloom - Only things with intensity > 1 will glow */}
          <EffectComposer enableNormalPass={false}>
            <Bloom
              luminanceThreshold={1}
              mipmapBlur
              intensity={1.5}
              radius={0.4}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-4 z-20">
        {animations.map((anim) => (
          <button
            key={anim.val}
            onClick={() => setAnimation(anim.val)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-[0.2em] uppercase transition-all duration-500 ${animation === anim.val
              ? 'bg-[#10b981] text-[#02130f] shadow-[0_0_25px_rgba(16,185,129,0.45)] scale-105 border-transparent'
              : 'bg-white/5 text-emerald-400/60 hover:text-emerald-300 hover:bg-white/10 backdrop-blur-xl border border-emerald-500/20'
              }`}
          >
            {anim.label}
          </button>
        ))}
      </div>

      <div className="absolute top-10 left-10 text-emerald-100 z-20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-[1px] bg-emerald-500/50" />
          <span className="text-[10px] tracking-[0.5em] font-black text-emerald-500/80 uppercase">Sentinel Project</span>
        </div>
        <h1 className="text-5xl font-black tracking-tighter opacity-90 leading-tight">ROBOT<br />HUGGY</h1>
        <div className="mt-4 px-3 py-1 bg-emerald-950/50 border border-emerald-500/30 rounded inline-block">
          <p className="text-[#10b981] font-mono tracking-widest text-[10px]">STATUS: {animation.split('|')[1].replace('A_Huggy_', '').toUpperCase()}</p>
        </div>
      </div>
    </div>
  )
}

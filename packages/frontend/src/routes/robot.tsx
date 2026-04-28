import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/robot')({
  component: RobotPageFallback,
})

function RobotPageFallback() {
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
      <RobotSceneComponent />
    </div>
  )
}



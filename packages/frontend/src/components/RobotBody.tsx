import * as THREE from 'three'
import React, { useEffect, useRef } from 'react'
import { useGLTF, useAnimations, useTexture } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'

type ActionName =
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Walk'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Attack'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Roar'

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName
}

type GLTFResult = GLTF & {
  nodes: {
    Object_103: THREE.SkinnedMesh
    Object_104: THREE.SkinnedMesh
    Object_105: THREE.SkinnedMesh
    _rootJoint: THREE.Bone
  }
  materials: {
    MI_RobotHuggyLower: THREE.MeshStandardMaterial
    MI_RobotHuggyUpper: THREE.MeshStandardMaterial
    MI_RobotHuggyEye: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}

interface RobotBodyProps extends React.ComponentPropsWithoutRef<'group'> {
  animation?: ActionName
}

export function RobotBody({ animation = 'SK_Huggy_RobotNew.ao|A_Huggy_Idle', ...props }: RobotBodyProps) {
  const group = useRef<THREE.Group>(null)

  const { nodes, materials, animations } = useGLTF('/robot.glb') as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)

  // Load only the eye texture manually for custom control
  const eyeMap = useTexture('/textures/gltf_embedded_6.png')

  // Fix orientation and color space
  if (eyeMap) {
    eyeMap.flipY = false
    eyeMap.colorSpace = THREE.SRGBColorSpace
  }

  useEffect(() => {
    const currentAction = actions[animation]

    if (currentAction) {
      currentAction.reset().fadeIn(0.5).play()
      return () => {
        currentAction.fadeOut(0.5)
      }
    }
  }, [actions, animation])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Sketchfab_Scene">
        <primitive object={nodes._rootJoint} />
        <skinnedMesh
          name="Object_103"
          geometry={nodes.Object_103.geometry}
          material={materials.MI_RobotHuggyLower}
          skeleton={nodes.Object_103.skeleton}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <skinnedMesh
          name="Object_104"
          geometry={nodes.Object_104.geometry}
          material={materials.MI_RobotHuggyUpper}
          skeleton={nodes.Object_104.skeleton}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <skinnedMesh
          name="Object_105"
          geometry={nodes.Object_105.geometry}
          skeleton={nodes.Object_105.skeleton}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial
            map={eyeMap}
            color="black"
            emissive="#ff0000"
            emissiveMap={eyeMap}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </skinnedMesh>
      </group>
    </group>
  )
}


// NOTE: Do NOT use useGLTF.preload() at module scope.
// This project uses TanStack Start with SSR, and module-level side effects
// will execute in Node.js where fetch/WebGL APIs don't exist, causing hangs.

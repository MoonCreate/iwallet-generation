import * as THREE from 'three'
import React, { useEffect, useRef, useMemo } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import type { GLTF } from 'three-stdlib'

type ActionName =
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Idle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Walk'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Attack'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Carry'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Charge'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_CrouchIdle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_CrouchWalk'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_CrouchWalkBackwards'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_CrouchWalkBackwardsNoStride'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_CrouchWalkNoStride'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_Attack'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_FallLoop'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_Idle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_Jump'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_Land'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_FP_Run'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Jump'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Jumpscare_MonsterPOV_Default'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Jumpscare_PlayerPOV_Default'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Jumpscare_ThirdPerson_Default'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_MiniAlert'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_MiniIdle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_MiniTurn'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Roar'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Run'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_SelectScreenIdle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_SelectScreenIntro'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_SitIdle'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_SitTransition'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Smash_3RD'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_Smash_FP'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_TurnLegDown'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_TurnLegLift'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_WalkBackwards'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_WalkBackwardsNoStride'
  | 'SK_Huggy_RobotNew.ao|A_Huggy_WalkNoStride'

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
  const { scene, animations } = useGLTF('/robot.glb')
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone) as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    if (actions[animation]) {
      actions[animation].reset().fadeIn(0.5).play()
      return () => {
        actions[animation]?.fadeOut(0.5)
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
          castShadow
          receiveShadow
        />
        <skinnedMesh
          name="Object_104"
          geometry={nodes.Object_104.geometry}
          material={materials.MI_RobotHuggyUpper}
          skeleton={nodes.Object_104.skeleton}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
        <skinnedMesh
          name="Object_105"
          geometry={nodes.Object_105.geometry}
          material={materials.MI_RobotHuggyEye}
          skeleton={nodes.Object_105.skeleton}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
      </group>
    </group>
  )
}

useGLTF.preload('/robot.glb')

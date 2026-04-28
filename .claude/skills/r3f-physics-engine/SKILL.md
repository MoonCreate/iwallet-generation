---
name: r3f-physics-engine
description: Best practices for React Three Fiber (R3F) and Rapier physics integration. Use when building 3D scenes with physics, collisions, and performance-critical animations.
---

# React Three Fiber & Rapier Physics Skill

This skill provides idiomatic patterns and performance optimization rules for working with `@react-three/fiber` and `@react-three/rapier`.

## Core Principles

1.  **Ref-Based Updates**: Always use `refs` and `useFrame` for position/rotation updates to avoid React re-renders.
2.  **Physics Decoupling**: Keep physics logic inside `RigidBody` components but minimize the complexity of collision shapes.
3.  **Asset Management**: Use `@react-three/drei` hooks like `useGLTF` for efficient loading and automatic disposal.

## Rapier Best Practices

- **Type Selection**: Use `dynamic` for moving objects, `fixed` for environment, and `kinematicPosition` or `kinematicVelocity` for objects controlled by script (e.g., player character).
- **Colliders**: Prefer primitive colliders (`cuboid`, `ball`, `capsule`) over `mesh` colliders for better performance.
- **Sensors**: Use `sensor={true}` for trigger volumes that shouldn't cause physical collisions.

## Performance Optimization

- **Avoid state in useFrame**: Never call `setState` or `dispatch` inside the `useFrame` loop.
- **Geometry Reuse**: Reuse `BufferGeometry` and `Materials` across multiple meshes.
- **Instancing**: For many identical physical objects, use `<InstancedRigidBodies>`.

## References
- [Performance Optimization](references/performance.md)
- [Collision Handling](references/collisions.md)

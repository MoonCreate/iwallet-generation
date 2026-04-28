# Performance Optimization for R3F

## 1. Avoid Component Re-renders
R3F works best when the React scene graph is stable.
- Do not use React state for values that change every frame.
- Use `useFrame` to mutate Three.js objects directly via `refs`.

## 2. Geometry & Material Re-use
```jsx
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 'red' });

function InstancedObject() {
  return <mesh geometry={geometry} material={material} />;
}
```

## 3. Frustum Culling
Ensure that objects not in view are not being rendered. R3F does this by default, but complex logic in `useFrame` should be guarded by visibility checks if possible.

## 4. Rapier Tips
- Reduce the number of `RigidBody` components being updated simultaneously.
- Use `sleep` for objects that aren't moving.

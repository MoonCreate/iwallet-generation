# Collision Handling in Rapier

## Event Listeners

Use `onCollisionEnter`, `onCollisionExit`, `onIntersectionEnter`, and `onIntersectionExit` on `RigidBody` or `Collider` components.

```jsx
<RigidBody
  onCollisionEnter={({ manifold, target, other }) => {
    console.log("Collision with", other.rigidBodyObject.name);
  }}
>
  <CuboidCollider args={[1, 1, 1]} />
</RigidBody>
```

## Collision Filters

Use `collisionGroups` to control which objects collide with each other.
- Format: `(membershipGroups << 16) | maskGroups`

## Sensors

Sensors are colliders that do not produce contacts or forces. They are useful for detection zones.

```jsx
<RigidBody type="fixed">
  <CuboidCollider 
    args={[5, 5, 5]} 
    sensor 
    onIntersectionEnter={() => console.log('Entered zone')} 
  />
</RigidBody>
```

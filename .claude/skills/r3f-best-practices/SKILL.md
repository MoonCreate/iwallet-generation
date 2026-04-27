---
name: r3f-best-practices
description: Core mental model, performance optimization rules, and idiomatic patterns for React Three Fiber (R3F) and Rapier physics. Use when developing 3D scenes, animations, and interactive physics.
---

# React Three Fiber (R3F) — Best Practices & Anti-Patterns Guide

> **Target**: AI Agent reference document  
> **Stack**: React 19 + Vite + `@react-three/fiber@9` + `@react-three/drei` + `@react-three/rapier`  
> **Last updated**: 2025

---

## Table of Contents

1. [Core Mental Model](#1-core-mental-model)
2. [Render Loop & Animation](#2-render-loop--animation)
3. [State Management](#3-state-management)
4. [Geometry & Material](#4-geometry--material)
5. [Asset Pipeline (GLTF)](#5-asset-pipeline-gltf)
6. [Performance Scaling](#6-performance-scaling)
7. [Physics (Rapier)](#7-physics-rapier)
8. [Component Architecture](#8-component-architecture)
9. [TypeScript Patterns](#9-typescript-patterns)
10. [Quick Reference Checklist](#10-quick-reference-checklist)

---

## 1. Core Mental Model

### The Golden Rule

**React** mengelola *kapan* sesuatu terjadi (inisialisasi, mount/unmount, perubahan state global).  
**Three.js** mengelola *bagaimana* sesuatu di-render (posisi, rotasi, animasi tiap frame).

Jangan biarkan kedua sistem saling menginvasi.

```
React layer   →  deklaratif, untuk UI state, committed changes
Three.js layer →  imperatif, untuk real-time updates, per-frame mutation
```

### R3F Version Pairing

| React version | R3F version |
|---|---|
| React 18 | `@react-three/fiber@8` |
| React 19 | `@react-three/fiber@9` |

Selalu pastikan versi ini match. Mismatch menyebabkan error rendering yang tidak jelas.

---

## 2. Render Loop & Animation

### ❌ Anti-Pattern: useState / useEffect untuk animasi

```tsx
// SALAH — memaksa React re-render 60x/detik
function RotatingBox() {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setRotation(r => r + 0.01) // re-render tiap tick!
    }, 16)
    return () => clearInterval(id)
  }, [])

  return <mesh rotation-y={rotation} />
}
```

**Masalah**: `setRotation` men-trigger React reconciliation ~60x/detik. Ini membuang CPU dan menyebabkan jank, terutama jika ada banyak komponen di tree.

---

### ✅ Best Practice: useFrame untuk per-frame update

```tsx
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

function RotatingBox() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    // Mutasi langsung — zero React re-render
    meshRef.current.rotation.y += delta
  })

  return <mesh ref={meshRef} />
}
```

**Prinsip**:
- `delta` adalah waktu sejak frame terakhir (dalam detik). Selalu gunakan `delta` agar animasi frame-rate independent.
- Mutasi `ref.current` secara langsung, jangan update state React.
- Gunakan `Math.min(0.1, delta)` untuk mencegah jump besar saat tab tidak aktif.

```tsx
useFrame((_state, delta) => {
  delta = Math.min(0.1, delta) // cap delta — penting untuk physics/animation
  meshRef.current.rotation.y += delta
})
```

---

### ✅ Best Practice: On-demand rendering untuk scene statis

```tsx
// Scene yang tidak selalu bergerak: hemat baterai & CPU
<Canvas frameloop="demand">
  <OrbitControls /> {/* Drei's controls auto-call invalidate */}
</Canvas>
```

Jika ada mutation manual yang tidak dideteksi React, panggil `invalidate()`:

```tsx
import { useThree } from '@react-three/fiber'

function MyControls() {
  const { invalidate } = useThree()

  useEffect(() => {
    controls.addEventListener('change', invalidate)
    return () => controls.removeEventListener('change', invalidate)
  }, [])
}
```

**Kapan pakai `frameloop`**:
| Value | Gunakan untuk |
|---|---|
| `"always"` (default) | Scene dengan animasi terus-menerus (game, physics sim) |
| `"demand"` | Viewer produk, scene editor, scene yang mostly statis |
| `"never"` | Manual control penuh via `advance()` |

---

## 3. State Management

### ❌ Anti-Pattern: Semua posisi/rotasi di Zustand

```tsx
// SALAH — drag objek = store write tiap frame = re-render masif
const useStore = create(set => ({
  position: [0, 0, 0],
  setPosition: (pos) => set({ position: pos })
}))

function DraggableObject() {
  const { position, setPosition } = useStore()

  useFrame(() => {
    // Ini di-call 60x/detik, tiap call = re-render semua subscriber!
    setPosition([...newPos])
  })
}
```

---

### ✅ Best Practice: Pisahkan real-time state dari UI state

```tsx
// Real-time state: pakai ref, mutasi langsung
function DraggableObject() {
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    // Mutasi langsung, tidak ada re-render
    meshRef.current.position.x = getNewX()
  })

  // Hanya update Zustand saat interaksi selesai (committed)
  const onDragEnd = () => {
    useStore.getState().setPosition(meshRef.current.position.toArray())
  }
}
```

**Aturan praktis**:
- **Masuk Zustand**: UI state, undo history, setting pengguna, data yang di-render HTML
- **Mutasi langsung**: posisi/rotasi real-time, dirty flags, visual side-effects yang tidak perlu history

---

### ✅ Best Practice: Mutasi Set untuk dirty tracking

```tsx
// Untuk tracking node yang perlu update, hindari setter reactive
const dirtyNodes = new Set<string>() // plain mutable Set, bukan state

function markDirty(id: string) {
  dirtyNodes.add(id) // tidak ada re-render
}

// Dibaca di dalam frameloop
useFrame(() => {
  dirtyNodes.forEach(id => {
    const mesh = meshRegistry.get(id)
    if (mesh) updateGeometry(mesh)
  })
  dirtyNodes.clear()
})
```

---

## 4. Geometry & Material

### ❌ Anti-Pattern: Alokasi dalam komponen

```tsx
// SALAH — new THREE.* dipanggil ulang setiap kali komponen re-render
function Bauble({ scale }) {
  return (
    <mesh>
      <sphereGeometry args={[scale, 28, 28]} /> {/* alokasi baru tiap render! */}
      <meshLambertMaterial color="#ffb4a2" />   {/* alokasi baru tiap render! */}
    </mesh>
  )
}
```

Masalah ini lebih parah jika ada banyak instance Bauble.

---

### ✅ Best Practice: Deklarasi di luar komponen (shared instances)

```tsx
import * as THREE from 'three'

// Dibuat sekali, di-share semua instance
const sphereGeometry = new THREE.SphereGeometry(1, 28, 28)
const baubleMaterial = new THREE.MeshLambertMaterial({
  color: '#ffb4a2',
  emissive: '#ffb4a2',
  emissiveIntensity: 0.5
})

function Bauble({ scale }: { scale: number }) {
  return (
    <mesh
      geometry={sphereGeometry}
      material={baubleMaterial}
      scale={scale}
    />
  )
}
```

**Catatan Color Management**: Jika membuat material di luar Canvas context, aktifkan Color Management:

```tsx
import * as THREE from 'three'

THREE.ColorManagement.enabled = true // wajib untuk Three.js r150+
```

---

### ✅ Best Practice: Instancing untuk objek duplikat massal

Maksimal ~1000 draw calls. Jika lebih, gunakan `instancedMesh`:

```tsx
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

function Particles({ count = 5000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const temp = new THREE.Object3D()

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      temp.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      )
      temp.updateMatrix()
      meshRef.current!.setMatrixAt(i, temp.matrix)
    }
    meshRef.current!.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  )
}
```

---

### ✅ Best Practice: dispose={null} pada GLTF shared

```tsx
// useGLTF auto-cache berdasarkan URL — model yang sama tidak di-load ulang
import { useGLTF } from '@react-three/drei'

function Model(props) {
  const { nodes, materials } = useGLTF('/model.glb')
  return (
    <group {...props} dispose={null}> {/* dispose={null} karena di-cache */}
      <mesh geometry={nodes.Body.geometry} material={materials.Metal} />
    </group>
  )
}

// Preload sebelum komponen mount
useGLTF.preload('/model.glb')
```

---

## 5. Asset Pipeline (GLTF)

### Workflow Optimasi Aset

```
Model asli (.blend / .fbx)
  ↓
Blender: Decimate Modifier + Texture Baking (untuk static lighting)
  ↓
Export → .glb (semua-dalam-satu) atau .gltf (flexible)
  ↓
npx gltfjsx model.glb -S -T -t
  ↓
Output: React component + TypeScript types + Draco compression
Ukuran file bisa berkurang hingga 90%
```

### gltfjsx flags

| Flag | Fungsi |
|---|---|
| `-S` | Mesh simplification |
| `-T` | Transform untuk web (Draco, prune, resize) |
| `-t` | Tambah TypeScript definitions |
| `-r /public` | Root path untuk assets |

### Ukuran Texture

Selalu gunakan power-of-2: `128, 256, 512, 1024, 2048`  
Lebih besar tidak selalu lebih baik — sesuaikan dengan jarak mesh ke kamera.

---

## 6. Performance Scaling

### Device Pixel Ratio (DPR)

```tsx
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'

function App() {
  const [dpr, setDpr] = useState(() => {
    const isMobile = /Mobi/i.test(navigator.userAgent)
    return Math.min(isMobile ? 1.5 : 1.0, window.devicePixelRatio)
  })
  const [ppEnabled, setPpEnabled] = useState(true)

  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        bounds={() => [30, 500]}
        flipflops={1}
        onDecline={() => {
          setDpr(d => d * 0.8)   // turunkan resolusi render
          setPpEnabled(false)     // matikan post-processing
        }}
        onFallback={() => {
          // fallback ekstrem: hapus objek dari scene
        }}
      />
      {/* scene */}
    </Canvas>
  )
}
```

### Suspend Rendering Saat Tab Tidak Aktif

```tsx
const [frameloop, setFrameloop] = useState<'always' | 'never'>('always')

useEffect(() => {
  const handler = () =>
    setFrameloop(document.hidden ? 'never' : 'always')
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}, [])

<Canvas frameloop={frameloop}>
```

### Level of Detail (LOD)

```tsx
import { Detailed, useGLTF } from '@react-three/drei'

function Model() {
  const [low, mid, high] = useGLTF(['/model-low.glb', '/model-mid.glb', '/model-high.glb'])
  return (
    <Detailed distances={[0, 15, 40]}>
      <mesh geometry={high.nodes.Body.geometry} />
      <mesh geometry={mid.nodes.Body.geometry} />
      <mesh geometry={low.nodes.Body.geometry} />
    </Detailed>
  )
}
```

### Nested Loading (Progressive)

```tsx
function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Canvas>
        <Suspense fallback={<Model url="/low-quality.glb" />}>
          <Model url="/high-quality.glb" />
        </Suspense>
      </Canvas>
    </Suspense>
  )
}
```

### Tools untuk Profiling

| Tool | Kegunaan |
|---|---|
| `r3f-perf` | Stats shader, texture, vertex count — khusus R3F |
| `stats.js` | FPS monitor — vanilla Three.js & R3F |
| `spector.js` | Chrome/Firefox extension — record tiap draw call |
| Chrome DevTools Performance | Memory, GPU, CPU usage per session |

---

## 7. Physics (Rapier)

### ❌ Anti-Pattern: applyImpulse di dalam useFrame tanpa delta scaling

```tsx
useFrame(() => {
  // SALAH — frame-rate dependent! Di 120fps efeknya 2x lebih kuat dari 60fps
  api.current.applyImpulse({ x: -50, y: -150, z: -50 }, true)
})
```

### ✅ Best Practice: Scale dengan delta

```tsx
useFrame((_state, delta) => {
  if (!api.current) return
  delta = Math.min(0.1, delta) // cap delta

  api.current.applyImpulse(
    vec
      .copy(api.current.translation())
      .normalize()
      .multiply({
        x: -50 * delta * scale,
        y: -150 * delta * scale,
        z: -50 * delta * scale,
      }),
    true
  )
})
```

### ✅ Best Practice: Early return untuk objek yang sudah tidak aktif

```tsx
const [isDiscarded, setIsDiscarded] = useState(false)

useFrame((_state, delta) => {
  if (!api.current || isDiscarded) return // skip physics untuk objek discarded
  // ...
})
```

### ✅ Best Practice: vec sebagai konstanta di luar komponen

```tsx
// JANGAN jadikan default prop parameter — alokasi ulang tiap render
// ❌ function Bauble({ vec = new THREE.Vector3() })

// ✅ Konstanta di luar komponen
const _vec = new THREE.Vector3()

function Bauble({ scale }: BaubleProps) {
  useFrame((_state, delta) => {
    _vec.copy(api.current.translation()).normalize()
    // ...
  })
}
```

---

## 8. Component Architecture

### ❌ Anti-Pattern: Logic kompleks di dalam komponen

```tsx
// SALAH — tiap wall komponen punya geometry calculation sendiri
// Update satu wall = re-render semua wall
function Wall({ id }) {
  const walls = useStore(s => s.walls) // subscriber ke semua walls!

  useEffect(() => {
    recalculateMiter(id, walls) // dipanggil tiap walls berubah
  }, [walls])
}
```

### ✅ Best Practice: Sistem terpusat di useFrame

```tsx
// Registry: Map dari ID ke mesh reference
const meshRegistry = new Map<string, THREE.Mesh>()

// Sistem terpusat yang berjalan di frameloop
function WallSystem() {
  useFrame(() => {
    dirtyWalls.forEach(id => {
      const mesh = meshRegistry.get(id)
      if (mesh) {
        updateWallGeometry(mesh, getWallData(id))
        dirtyWalls.delete(id)
      }
    })
  })
  return null
}

// Tiap wall component hanya render, tidak menghitung
function Wall({ id }: { id: string }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    meshRegistry.set(id, meshRef.current!)
    return () => meshRegistry.delete(id)
  }, [id])

  return <mesh ref={meshRef} />
}
```

**Prinsip**: Geser logic dari *component-driven updates* ke *loop-driven updates*.

### Struktur folder yang disarankan

```
src/
├── components/
│   └── scene/
│       ├── Bauble.tsx          # Pure render component
│       ├── BaubleSystem.tsx    # Logic sistem (useFrame)
│       └── Environment.tsx
├── stores/
│   └── useSceneStore.ts        # Zustand — hanya UI/committed state
├── registries/
│   └── meshRegistry.ts         # Map<id, Mesh> — real-time reference
└── constants/
    └── geometry.ts             # Shared geometries & materials
```

---

## 9. TypeScript Patterns

### Type RigidBody ref

```tsx
import type { RapierRigidBody } from '@react-three/rapier'

const api = useRef<RapierRigidBody>(null)

// Cast ke any jika Rapier ref types belum updated untuk R3F v9
<RigidBody ref={api as any} />
```

### Type GLTF nodes

```tsx
// Sebelum gltfjsx — manual cast
const { nodes } = useGLTF('/cap.glb') as any

// Sesudah gltfjsx -t — fully typed
import { GLTFResult } from './cap.d'
const { nodes } = useGLTF<GLTFResult>('/cap.glb')
```

### Interface props dengan vec optimization

```tsx
interface BaubleProps {
  scale: number
  initialPosition: [number, number, number]
  // Hindari vec sebagai optional prop dengan default new THREE.Vector3()
  // Taruh vec sebagai konstanta di luar komponen
}
```

---

## 10. Quick Reference Checklist

Gunakan checklist ini setiap membuat atau mereview komponen R3F:

### Render & Animation
- [ ] Animasi menggunakan `useFrame`, bukan `useEffect` + `setState`
- [ ] `delta` selalu digunakan untuk frame-rate independent animation
- [ ] `Math.min(0.1, delta)` dipakai untuk cap delta
- [ ] `frameloop="demand"` dipertimbangkan untuk scene statis

### Geometry & Material
- [ ] `new THREE.*` dideklarasikan **di luar** komponen
- [ ] `dispose={null}` pada GLTF yang di-cache via `useGLTF`
- [ ] `THREE.ColorManagement.enabled = true` jika material dibuat di luar Canvas
- [ ] `instancedMesh` digunakan jika ada >100 objek identik

### State
- [ ] Real-time updates (posisi, rotasi) menggunakan `ref`, bukan state
- [ ] Zustand hanya menyimpan committed/UI state
- [ ] Dirty tracking menggunakan `Set` mutable, bukan reactive state

### Assets
- [ ] Model di-optimize via Blender (Decimate)
- [ ] `gltfjsx` digunakan untuk generate komponen dari GLTF
- [ ] Texture ukurannya power-of-2
- [ ] `useGLTF.preload()` dipanggil untuk preload aset kritis

### Performance
- [ ] `PerformanceMonitor` aktif untuk adaptive quality
- [ ] DPR dibatasi (max 1.0 desktop, 1.5 mobile)
- [ ] Visibility change listener untuk suspend rendering
- [ ] Draw calls di bawah ~1000

### Physics (Rapier)
- [ ] `applyImpulse` / `applyForce` di-scale dengan `delta`
- [ ] Early return untuk objek yang tidak aktif (`isDiscarded`, `isOffscreen`)
- [ ] `vec` / `temp` object sebagai konstanta di luar komponen

---

## Referensi

- [R3F Official Docs — Scaling Performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [Codrops — Building Efficient Three.js Scenes (Feb 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [Wawa Sensei — 3 R3F Mistakes](https://wawasensei.dev/tuto/3-react-three-fiber-mistakes)
- [pmndrs/gltfjsx](https://github.com/pmndrs/gltfjsx)
- [pmndrs/drei](https://github.com/pmndrs/drei)

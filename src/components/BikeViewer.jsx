import { useRef, useEffect } from 'react'
import { useGLTF, ContactShadows } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { useShowroomStore } from '../store/useShowroomStore.js'
import components from '../data/components.js'
import { isMeshMatch } from '../utils/meshMapping.js'
import { resolveAsset } from '../utils/resolveAsset.js'

// ── Anchor table (group-local space, same as Hotspot positions) ───────────
const ANCHOR_ENTRIES = components
  .filter(c => c.anchor)
  .map(c => ({ id: c.id, label: c.label, vec: new THREE.Vector3(...c.anchor) }))

// Max distance (group-local) a mesh can be from an anchor to be assigned.
// Set large so every mesh always gets the nearest component (Voronoi partition).
const COMPONENT_RADIUS = 100

// How far parts travel at full explosion
const EXPLODE_SCALE = 2.0

// ── DEV: Anchor calibration mode ─────────────────────────────────────────
// Ctrl+Click any mesh → logs its group-local X,Y,Z to console.
// Copy those values into components.js anchor:[] to recalibrate.
const DEV_PICK_MODE = import.meta.env.DEV

// ── BikeViewer ───────────────────────────────────────────────────────────
export default function BikeViewer({ groupRef }) {
  const { scene } = useGLTF(resolveAsset('/models/Grops_Bikes1_draco.glb'), resolveAsset('/draco/'))
  const { invalidate } = useThree()
  const navigate = useNavigate()

  const setHoveredMeshId = useShowroomStore(s => s.setHoveredMeshId)

  // Smooth explode lerp (read/write via ref to avoid React re-renders)
  const localExplode = useRef(0)

  // componentId → Mesh[] — built once at load time
  const compGroupsRef = useRef({})
  // Pre-built lookup: componentId → Mesh[] for O(k) highlighting instead of O(n) traversal
  const meshesByComponentRef = useRef({})
  // Set of currently highlighted meshes (for O(1) batch clear)
  const highlightedRef = useRef(new Set())
  // Currently active component zone (from 3D hover)
  const activeCompRef = useRef(null)
  // Last Object3D whose onPointerOver fired
  const lastEnteredMeshRef = useRef(null)

  // Subscribe to Side Panel hover so 3D highlights
  const hoveredUiMeshId = useShowroomStore(s => s.hoveredMeshId)

  // ── 1. Scene setup: compute explode dirs + build component groups ────────
  useEffect(() => {
    if (!scene) return

    // ── Wait for the R3F group to mount ────────────────────────────────────
    // groupRef.current changes do NOT re-trigger useEffect (refs are mutable,
    // not reactive). When GLB is preloaded, scene is ready before the R3F
    // group element mounts. We poll with rAF until groupRef.current is set.
    let rafId
    function runMapping() {
      if (!groupRef?.current) {
        rafId = requestAnimationFrame(runMapping)
        return
      }
      doMapping()
    }

    function doMapping() {
      const bbox = new THREE.Box3().setFromObject(scene)
      const bikeCenter = new THREE.Vector3()
      bbox.getCenter(bikeCenter)

      let totalMeshes = 0
      const allMeshNames = []
      scene.traverse(child => {
        if (!child.isMesh) return
        totalMeshes++
        allMeshNames.push(child.name)
        child.userData.origPos = child.position.clone()
        const mbox = new THREE.Box3().setFromObject(child)
        const mCenter = new THREE.Vector3()
        mbox.getCenter(mCenter)
        const dir = mCenter.clone().sub(bikeCenter)
        const len = dir.length()
        child.userData.explodeDir = len > 0.001 ? dir.normalize() : new THREE.Vector3(0, 1, 0)
        child.userData.componentId = null
      })

      if (import.meta.env.DEV) {
        const unique = [...new Set(allMeshNames)].sort()
        console.groupCollapsed('%c[BikeViewer] ALL MESH NAMES IN SCENE (' + unique.length + ' unique)', 'color:#ff8c00;font-weight:bold')
        unique.forEach(n => console.log(n))
        console.groupEnd()
      }

      const setDynamicAnchors = useShowroomStore.getState().setDynamicAnchors
      const calculatedAnchors = {}
      const unmappedIds = []
      const filteredComponents = components.filter(c => c.category !== 'Electrification')

      filteredComponents.forEach(comp => {
        let compBBox = new THREE.Box3()
        let hasMeshes = false

        scene.traverse(child => {
          if (!child.isMesh) return

          let isMatch = isMeshMatch(child.name, comp.targetMeshes, comp.id)
          if (!isMatch) {
            let parent = child.parent
            while (parent && (parent.isGroup || parent.isObject3D)) {
              if (isMeshMatch(parent.name, comp.targetMeshes, comp.id)) {
                isMatch = true
                break
              }
              parent = parent.parent
            }
          }

          if (isMatch) {
            child.userData.componentId = comp.id
            if (!meshesByComponentRef.current[comp.id]) meshesByComponentRef.current[comp.id] = []
            meshesByComponentRef.current[comp.id].push(child)
            const mbox = new THREE.Box3().setFromObject(child)
            compBBox.expandByPoint(mbox.min)
            compBBox.expandByPoint(mbox.max)
            hasMeshes = true
          }
        })

        if (hasMeshes && groupRef.current) {
          const centerWorld = new THREE.Vector3()
          compBBox.getCenter(centerWorld)
          const centerLocal = groupRef.current.worldToLocal(centerWorld.clone())
          calculatedAnchors[comp.id] = [centerLocal.x, centerLocal.y, centerLocal.z]
        } else {
          unmappedIds.push(comp.id)
        }
      })

      setDynamicAnchors(calculatedAnchors)

      if (import.meta.env.DEV) {
        console.groupCollapsed('%c[BikeViewer] MAPPING REPORT', 'color:#00893D;font-weight:bold')
        console.log(`Total meshes in scene: ${totalMeshes}`)
        console.log(`Mapped: ${filteredComponents.length - unmappedIds.length} / ${filteredComponents.length} components`)
        if (unmappedIds.length > 0) console.warn('Unmapped:', unmappedIds)
        console.log('Anchors:', calculatedAnchors)
        console.groupEnd()
      }
    }

    rafId = requestAnimationFrame(runMapping)
    return () => { if (rafId) cancelAnimationFrame(rafId) }
  }, [scene])

  // ── 2. Per-frame explode animation ──────────────────────────────────────
  useFrame(() => {
    /* EXPLODE FEATURE COMMENTED OUT FOR NOW
    const target = useShowroomStore.getState().explodeProgress
    const prev = localExplode.current

    if (Math.abs(prev - target) > 0.001) {
      localExplode.current += (target - prev) * 0.09
      const t = localExplode.current

      scene?.traverse(child => {
        if (!child.isMesh || !child.userData.origPos) return
        const { origPos, explodeDir, explodeMag = 1 } = child.userData
        child.position.set(
          origPos.x + explodeDir.x * explodeMag * EXPLODE_SCALE * t,
          origPos.y + explodeDir.y * explodeMag * EXPLODE_SCALE * t,
          origPos.z + explodeDir.z * explodeMag * EXPLODE_SCALE * t,
        )
      })

      invalidate()
    }
    */
  })

  // ── 3. Highlight helpers ─────────────────────────────────────────────────
  // Lazy material clone: only clone when a mesh is first highlighted
  function ensureOwnMaterial(mesh) {
    if (mesh.userData.isMaterialCloned) return
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(m => m.clone())
    } else {
      mesh.material = mesh.material.clone()
    }
    mesh.userData.isMaterialCloned = true
  }

  function applyEmissive(mesh, hexColor, intensity) {
    if (!mesh) return
    ensureOwnMaterial(mesh)

    const set = mat => {
      // Not all materials (e.g. MeshBasicMaterial) have an emissive property
      if (mat.emissive) {
        mat.emissive.set(hexColor);
        mat.emissiveIntensity = intensity;
      }
      // Backup for materials that ignore emissive: artificially store and change their base color
      if (mat.color && !mat.userData.origColorSaved) {
        mat.userData.origColor = mat.color.getHex()
        mat.userData.origColorSaved = true
      }
      if (mat.color) {
        mat.color.set(hexColor)
      }
    }

    if (Array.isArray(mesh.material)) mesh.material.forEach(set)
    else set(mesh.material)
    highlightedRef.current.add(mesh)
  }

  function clearAllHighlights() {
    for (const mesh of highlightedRef.current) {
      const clear = mat => {
        if (mat.emissive) {
          mat.emissive.set(0, 0, 0);
          mat.emissiveIntensity = 0;
        }
        if (mat.color && mat.userData.origColorSaved) {
          mat.color.setHex(mat.userData.origColor)
        }
      }
      if (Array.isArray(mesh.material)) mesh.material.forEach(clear)
      else clear(mesh.material)
    }
    highlightedRef.current.clear()
  }

  // Pull selected state to keep it highlighted
  const selectedComponentId = useShowroomStore(s => s.selectedComponent)

  // Monitor side panel hover state (hoveredUiMeshId) and highlight all meshes belonging to that component
  // Uses pre-built meshesByComponentRef for O(k) lookup instead of O(n) scene.traverse()
  useEffect(() => {
    // If no hover, but we have a selection, keep selection highlighted
    clearAllHighlights()
    const targetCompId = hoveredUiMeshId || selectedComponentId

    if (targetCompId) {
      const meshes = meshesByComponentRef.current[targetCompId]
      if (meshes) {
        for (const mesh of meshes) {
          applyEmissive(mesh, '#00893D', 1.1)
        }
      }
      invalidate()
    } else {
      invalidate()
    }
  }, [hoveredUiMeshId, selectedComponentId, invalidate])


  // ── 4. Pointer handlers ──────────────────────────────────────────────────
  const handlePointerOver = (e) => {
    e.stopPropagation()
    const obj = e.object
    if (!obj.isMesh) return

    lastEnteredMeshRef.current = obj

    // We update the transient hover state. The useEffect above will handle highlighting!
    const compId = obj.userData.componentId

    if (compId !== activeCompRef.current) {
      activeCompRef.current = compId || null
      setHoveredMeshId(compId || null)
    }

    if (import.meta.env.DEV && compId) {
      const entry = ANCHOR_ENTRIES.find(a => a.id === compId)
      // console.log(`[Hover] mesh: "${obj.name}" → comp: "${entry?.label ?? compId}"`)
    }
  }

  const handlePointerOut = (e) => {
    // Only clear when the pointer leaves the scene entirely.
    if (lastEnteredMeshRef.current !== e.object) return

    if (activeCompRef.current !== null) {
      activeCompRef.current = null
      setHoveredMeshId(null)
    }
  }

  const handleClick = (e) => {
    e.stopPropagation()
    const obj = e.object

    // ── DEV: Ctrl+Click = log this mesh's exact name ────────
    if (DEV_PICK_MODE && e.nativeEvent?.ctrlKey) {
      // console.log(`%c[PICK] Exact mesh name: "${obj.name}"`, 'color:#00893D;font-weight:bold;font-size:16px')
      // console.log(`  To map this, add to components.js:`)
      // console.log(`  targetMeshes: ["${obj.name}"],`)
      return
    }

    // Normal click → Select component (don't navigate yet)
    const compId = obj?.userData?.componentId
    if (compId) useShowroomStore.getState().setSelectedComponent(compId)
  }

  // ── 5. JSX ───────────────────────────────────────────────────────────────
  return (
    <>
      <primitive
        object={scene}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.7}
        scale={10}
        blur={2.5}
        far={2}
        resolution={256}
        color="#000000"
        frames={1}
      />

      {/* Floor glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[2.5, 64]} />
        <meshBasicMaterial color="#00893D" transparent opacity={0.03} />
      </mesh>

      {/*
      DEV: Red spheres at each anchor — shows where current anchors are placed.
      {DEV_PICK_MODE && ANCHOR_ENTRIES.map(({ id, vec }) => (
        <mesh key={id} position={vec.toArray()}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}
      */}
    </>
  )
}

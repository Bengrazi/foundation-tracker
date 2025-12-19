"use client"

import React, { useRef, useMemo, useState, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

// --- Constants ---
const CHERRY_RADIUS = 0.15
const COLLISION_RADIUS = 0.16 // Slightly larger than visual radius to prevent clipping
const GRAVITY = -15
const BOUNCE_DAMPING = 0.5
const VELOCITY_THRESHOLD = 0.05
const BOWL_CENTER_Y = 1.5
const BOWL_RADIUS = 2.5
const BOWL_DEPTH = 1.5

// 1. Static Cherry (Zero Overhead)
function StaticCherry({ position }: { position: [number, number, number] }) {
    return (
        <mesh position={position} castShadow receiveShadow>
            <sphereGeometry args={[CHERRY_RADIUS, 16, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
        </mesh>
    )
}

// 2. Physics Cherry (Falling)
interface PhysicsCherryProps {
    startPosition: [number, number, number]
    delay: number
    onSettle: (finalPos: [number, number, number]) => void
    activeCherries: React.MutableRefObject<CherryState[]>
    staticPositions: [number, number, number][]
    index: number
}

interface CherryState {
    position: THREE.Vector3
    velocity: THREE.Vector3
    settled: boolean
    radius: number
}

function PhysicsCherry({ startPosition, delay, onSettle, activeCherries, staticPositions, index }: PhysicsCherryProps) {
    const meshRef = useRef<THREE.Mesh>(null)
    const [hasStarted, setHasStarted] = useState(false)

    const cherryState = useRef<CherryState>({
        position: new THREE.Vector3(...startPosition),
        velocity: new THREE.Vector3(0, 0, 0),
        settled: false,
        radius: COLLISION_RADIUS,
    })

    useEffect(() => {
        activeCherries.current[index] = cherryState.current
        const timer = setTimeout(() => setHasStarted(true), delay)
        return () => clearTimeout(timer)
    }, [delay, activeCherries, index])

    useFrame((state, delta) => {
        if (!meshRef.current || !hasStarted || cherryState.current.settled) return

        const cs = cherryState.current

        // --- Physics Step ---
        cs.velocity.y += GRAVITY * delta
        cs.position.addScaledVector(cs.velocity, delta)

        // --- Bowl Collision ---
        const bowlRadiusAtHeight = BOWL_RADIUS * Math.sqrt(Math.max(0, 1 - Math.pow((BOWL_CENTER_Y - cs.position.y) / BOWL_DEPTH, 2)))
        const distFromCenter = Math.sqrt(cs.position.x ** 2 + cs.position.z ** 2)

        if (distFromCenter > bowlRadiusAtHeight - cs.radius && cs.position.y < BOWL_CENTER_Y) {
            const angle = Math.atan2(cs.position.z, cs.position.x)
            const maxDist = bowlRadiusAtHeight - cs.radius
            cs.position.x = Math.cos(angle) * maxDist
            cs.position.z = Math.sin(angle) * maxDist

            cs.velocity.x *= -BOUNCE_DAMPING
            cs.velocity.z *= -BOUNCE_DAMPING
            cs.velocity.y *= BOUNCE_DAMPING
        }

        // --- Bottom Floor Collision ---
        const bowlBottom = BOWL_CENTER_Y - BOWL_DEPTH
        if (cs.position.y <= bowlBottom + cs.radius) {
            cs.position.y = bowlBottom + cs.radius
            if (Math.abs(cs.velocity.y) < VELOCITY_THRESHOLD) {
                cs.velocity.set(0, 0, 0)
                cs.settled = true
                onSettle([cs.position.x, cs.position.y, cs.position.z])
                return // Stop processing
            } else {
                cs.velocity.y = Math.abs(cs.velocity.y) * BOUNCE_DAMPING
            }
        }

        // --- Static Collision (Saved Cherries) ---
        // O(500) check per frame per dropping cherry. 500*10 = 5000 ops. Negligible.
        for (let i = 0; i < staticPositions.length; i++) {
            const sx = staticPositions[i][0]
            const sy = staticPositions[i][1]
            const sz = staticPositions[i][2]

            // Simple box check first for optimization
            if (Math.abs(cs.position.x - sx) > 0.4 || Math.abs(cs.position.y - sy) > 0.4 || Math.abs(cs.position.z - sz) > 0.4) continue;

            const dx = cs.position.x - sx
            const dy = cs.position.y - sy
            const dz = cs.position.z - sz
            const distSq = dx * dx + dy * dy + dz * dz
            const minD = cs.radius + CHERRY_RADIUS // Radius of me + radius of static

            if (distSq < minD * minD && distSq > 0.0001) {
                const dist = Math.sqrt(distSq)
                const overlap = minD - dist

                // Normal
                const nx = dx / dist
                const ny = dy / dist
                const nz = dz / dist

                // Push out hard to resolve clipping
                cs.position.x += nx * overlap
                cs.position.y += ny * overlap
                cs.position.z += nz * overlap

                // Transfer momentum / Bounce
                cs.velocity.multiplyScalar(0.5)
                cs.velocity.add(new THREE.Vector3(nx, ny, nz).multiplyScalar(1))
            }
        }

        // --- Active vs Active Collision ---
        for (let i = 0; i < activeCherries.current.length; i++) {
            if (i === index || !activeCherries.current[i]) continue
            const other = activeCherries.current[i]
            if (other.settled) continue // Treat settled actives as statics? No, they might not be in staticPositions yet.

            const dx = cs.position.x - other.position.x
            const dy = cs.position.y - other.position.y
            const dz = cs.position.z - other.position.z
            const distSq = dx * dx + dy * dy + dz * dz
            const minD = cs.radius + other.radius

            if (distSq < minD * minD && distSq > 0.0001) {
                const dist = Math.sqrt(distSq)
                const overlap = minD - dist
                const nx = dx / dist; const ny = dy / dist; const nz = dz / dist

                cs.position.x += nx * overlap * 0.5
                cs.position.y += ny * overlap * 0.5
                cs.position.z += nz * overlap * 0.5

                cs.velocity.multiplyScalar(0.9)
            }
        }

        // Velocity Cap check (Settling)
        const speed = cs.velocity.length()
        // Check if we are stuck on top of others
        if (speed < VELOCITY_THRESHOLD && (cs.position.y <= bowlBottom + cs.radius + 0.5 || cs.velocity.y > -0.1)) {
            // We might be resting on a static cherry.
            // How to verify settling properly? 
            // If low speed for significant time? 
            // For now, if very slow, settle.
            if (cs.position.y < BOWL_CENTER_Y && speed < 0.01) {
                cs.settled = true
                onSettle([cs.position.x, cs.position.y, cs.position.z])
            }
        }

        meshRef.current.position.copy(cs.position)
    })

    return (
        <mesh ref={meshRef} castShadow position={startPosition}>
            <sphereGeometry args={[CHERRY_RADIUS, 16, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
        </mesh>
    )
}

function GreenBowl() {
    return (
        <group position={[0, BOWL_CENTER_Y, 0]}>
            <mesh receiveShadow rotation={[Math.PI, 0, 0]}>
                <sphereGeometry args={[BOWL_RADIUS, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#34d399" roughness={0.3} metalness={0.2} side={THREE.DoubleSide} />
            </mesh>
        </group>
    )
}

function PyramidScene({ visualCount }: { visualCount: number }) {
    // State for saved cherries (static)
    // We strictly use 'initialSaved' for the static rendering to avoid re-rendering entire static list
    // when 'savedPositions' updates via handleSettle.
    // Wait, if we don't update the static list, the newly settled cherry disappears?
    // Correct approach:
    // 1. 'displayStatic' state initialized from LS.
    // 2. onSettle adds to 'displayStatic'. (This acts as LS sync too).
    // 3. 'dropsToRender' is calculated ONE TIME based on visualCount vs initial load.

    // Actually, simple is better.
    const [savedPositions, setSavedPositions] = useState<[number, number, number][]>([]);
    const [drops, setDrops] = useState<[number, number, number][]>([]);

    const activeCherries = useRef<CherryState[]>([])

    // 1. Initial Load
    useEffect(() => {
        try {
            const saved = localStorage.getItem("foundation_cherry_state_v1");
            const parsed = saved ? JSON.parse(saved) : [];
            setSavedPositions(parsed);

            // 2. Calculate Drops ONCE based on this load
            // This prevents re-calc when savedPositions updates during dropping
            const needed = Math.max(0, visualCount - parsed.length);
            const newDrops: [number, number, number][] = [];
            for (let i = 0; i < needed; i++) {
                const rx = (Math.random() - 0.5) * 1.5;
                const rz = (Math.random() - 0.5) * 1.5;
                const rh = Math.random() * 6 + 4;
                newDrops.push([rx, BOWL_CENTER_Y + rh, rz]);
            }
            setDrops(newDrops);

        } catch (e) {
            console.error("Failed load", e);
        }
    }, [visualCount]); // Only run if target total changes (e.g. navigation or new points)

    const handleSettle = (finalPos: [number, number, number]) => {
        setSavedPositions(prev => {
            const next = [...prev, finalPos];
            localStorage.setItem("foundation_cherry_state_v1", JSON.stringify(next));
            return next;
        });
    }

    // We only render drops that correspond to the 'drops' state.
    // Once settled, they technically exist in 'savedPositions' AND 'drops' list (PhysicsCherry stays mounted but settled=true).
    // This double rendering (Static at finalPos + Physics at finalPos) is bad.
    // PhysicsCherry unmounts? No.
    // 
    // Fix: We must NOT add to 'savedPositions' state for rendering until next reload?
    // OR PhysicsCherry should return null if settled?
    // Let's make PhysicsCherry return null or stop rendering mesh if settled AND we rely on StaticCherry taking over.
    // But StaticCherry only updates if 'savedPositions' updates.
    // If 'savedPositions' updates, it triggers re-render of huge list. Rerendering 500 static meshes is cheap in React (virtual DOM diff)?
    // Or we use <InstancedMesh>? For 500, individual meshes are fine.

    // User wants NO lag.
    // Best UX:
    // 1. Drops fall.
    // 2. Settle -> Add to LS.
    // 3. Do NOT add to 'savedPositions' state (Static list) immediately. Leave as PhysicsCherry (settled/sleeping).
    // 4. Next Page Load -> They become Static.

    // This avoids re-rendering the static list every time one settles.

    // Modified handleSettle: Just save to LS.
    const handleSettleOnlyLS = (finalPos: [number, number, number]) => {
        const current = localStorage.getItem("foundation_cherry_state_v1");
        const prev = current ? JSON.parse(current) : [];
        if (prev.length > 500) return; // Cap
        prev.push(finalPos);
        localStorage.setItem("foundation_cherry_state_v1", JSON.stringify(prev));
    };

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />
            <pointLight position={[-10, 10, -10]} intensity={0.5} />

            <GreenBowl />

            {/* Static Cherries (Only those loaded on mount) */}
            {savedPositions.map((pos, i) => (
                <StaticCherry key={`static-${i}`} position={pos} />
            ))}

            {/* Falling Cherries (Become "sleeping" physics bodies when settled) */}
            {drops.map((pos, i) => (
                <PhysicsCherry
                    key={`drop-${i}`}
                    startPosition={pos}
                    delay={i * 100}
                    onSettle={handleSettleOnlyLS}
                    activeCherries={activeCherries}
                    staticPositions={savedPositions} // Collision against STATIC ONLY
                    index={i}
                />
            ))}

            <Environment preset="sunset" />
            <OrbitControls enablePan={false} minDistance={3} maxDistance={20} target={[0, 1.5, 0]} />
        </>
    )
}

export const CherryPyramid = React.memo(function CherryPyramid({ totalCherries }: { totalCherries: number }) {
    const visualCount = Math.floor(totalCherries / 10);
    const safeCount = Math.min(visualCount, 500);

    return (
        <div className="w-full h-full bg-gradient-to-b from-sky-100 to-sky-50 rounded-3xl overflow-hidden relative">
            {(visualCount > 0) && (
                <div className="absolute top-2 right-2 text-[10px] text-black/50 bg-white/50 px-2 rounded-full z-10">
                    {visualCount} Cherries ({totalCherries} pts)
                </div>
            )}
            <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }} gl={{ antialias: true }}>
                <PyramidScene visualCount={safeCount} />
            </Canvas>
        </div>
    )
});

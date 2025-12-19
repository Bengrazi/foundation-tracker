"use client"

import React, { useRef, useMemo, useState, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

interface CherryProps {
    position: [number, number, number]
    delay: number
    onSettle: () => void
    allCherries: React.MutableRefObject<CherryState[]>
    index: number
}

interface CherryState {
    position: THREE.Vector3
    velocity: THREE.Vector3
    settled: boolean
    radius: number
}

const CHERRY_RADIUS = 0.15
const GRAVITY = -15
const BOUNCE_DAMPING = 0.6
const VELOCITY_THRESHOLD = 0.05
const BOWL_CENTER_Y = 1.5
const BOWL_RADIUS = 2.5
const BOWL_DEPTH = 1.5

function Cherry({ position, delay, onSettle, allCherries, index }: CherryProps) {
    const meshRef = useRef<THREE.Mesh>(null)
    const [hasStarted, setHasStarted] = useState(false)

    // Use a stable ref for state to avoid re-inits
    const cherryState = useRef<CherryState>({
        position: new THREE.Vector3(position[0], position[1], position[2]), // Y is already high
        velocity: new THREE.Vector3(0, 0, 0),
        settled: false,
        radius: CHERRY_RADIUS,
    })

    // Start delay
    useEffect(() => {
        allCherries.current[index] = cherryState.current
        const timer = setTimeout(() => {
            setHasStarted(true)
        }, delay)
        return () => clearTimeout(timer)
    }, [delay, allCherries, index])

    useFrame((state, delta) => {
        if (!meshRef.current || !hasStarted || cherryState.current.settled) return

        const cs = cherryState.current
        // Physics Step
        cs.velocity.y += GRAVITY * delta

        cs.position.x += cs.velocity.x * delta
        cs.position.y += cs.velocity.y * delta
        cs.position.z += cs.velocity.z * delta

        // Bowl Collision
        const bowlRadiusAtHeight = BOWL_RADIUS * Math.sqrt(Math.max(0, 1 - Math.pow((BOWL_CENTER_Y - cs.position.y) / BOWL_DEPTH, 2)))
        const distFromCenter = Math.sqrt(cs.position.x ** 2 + cs.position.z ** 2)

        if (distFromCenter > bowlRadiusAtHeight - cs.radius && cs.position.y < BOWL_CENTER_Y) {
            // Wall bounce
            const angle = Math.atan2(cs.position.z, cs.position.x)
            const maxDist = bowlRadiusAtHeight - cs.radius;
            cs.position.x = Math.cos(angle) * maxDist
            cs.position.z = Math.sin(angle) * maxDist

            cs.velocity.x *= -BOUNCE_DAMPING
            cs.velocity.z *= -BOUNCE_DAMPING
            cs.velocity.y *= BOUNCE_DAMPING
        }

        // Bottom Collision
        const bowlBottom = BOWL_CENTER_Y - BOWL_DEPTH
        if (cs.position.y <= bowlBottom + cs.radius) {
            cs.position.y = bowlBottom + cs.radius
            if (Math.abs(cs.velocity.y) < VELOCITY_THRESHOLD) {
                cs.velocity.set(0, 0, 0)
                cs.settled = true
                onSettle()
            } else {
                cs.velocity.y = Math.abs(cs.velocity.y) * BOUNCE_DAMPING
            }
        }

        // Cherry-Cherry Collision (O(N^2) capped by parent)
        // Simplified for performance
        if (index % 2 === 0) { // Optimization: Only check half? No, check all but maybe skip satisfied ones
            for (let i = 0; i < allCherries.current.length; i++) {
                if (i === index || !allCherries.current[i]) continue
                const other = allCherries.current[i]
                const dx = cs.position.x - other.position.x
                const dy = cs.position.y - other.position.y
                const dz = cs.position.z - other.position.z
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
                const minD = cs.radius + other.radius

                if (dist < minD && dist > 0) {
                    const overlap = minD - dist
                    const nx = dx / dist; const ny = dy / dist; const nz = dz / dist;

                    cs.position.x += nx * overlap * 0.5
                    cs.position.y += ny * overlap * 0.5
                    cs.position.z += nz * overlap * 0.5

                    // Velocity transfer logic omitted for stability/speed, just push apart
                    cs.velocity.multiplyScalar(0.9);
                }
            }
        }

        // Velocity Cap check
        const speed = cs.velocity.length()
        if (speed < VELOCITY_THRESHOLD && cs.position.y <= bowlBottom + cs.radius + 0.5) {
            cs.settled = true
            onSettle()
        }

        meshRef.current.position.copy(cs.position)
    })

    return (
        <mesh ref={meshRef} castShadow position={position}>
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

function PyramidScene({ totalCherries }: { totalCherries: number }) {
    const allCherries = useRef<CherryState[]>([])
    const [settled, setSettled] = useState(0)

    // Stable positions creation
    const cherryPositions = useMemo(() => {
        const positions: [number, number, number][] = []
        for (let i = 0; i < totalCherries; i++) {
            const randomX = (Math.random() - 0.5) * 1.0
            const randomZ = (Math.random() - 0.5) * 1.0
            const randomHeight = Math.random() * 5 + 3 // Start higher 3-8 units up
            positions.push([randomX, BOWL_CENTER_Y + randomHeight, randomZ])
        }
        return positions
    }, [totalCherries])

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />
            <pointLight position={[-10, 10, -10]} intensity={0.5} />

            <GreenBowl />

            {cherryPositions.map((pos, index) => (
                <Cherry
                    key={index}
                    position={pos}
                    delay={index * 20} // fast drop
                    onSettle={() => setSettled(s => s + 1)}
                    allCherries={allCherries}
                    index={index}
                />
            ))}

            <Environment preset="sunset" />
            <OrbitControls enablePan={false} minDistance={3} maxDistance={20} target={[0, 1.5, 0]} />
        </>
    )
}

// MEMOIZED Component to prevent re-drops on parent re-renders
export const CherryPyramid = React.memo(function CherryPyramid({ totalCherries }: { totalCherries: number }) {
    // Feedback v5: 1 cherry per 10 points.
    const visualCount = Math.floor(totalCherries / 10);
    const safeCount = Math.min(visualCount, 500);

    return (
        <div className="w-full h-full bg-gradient-to-b from-sky-100 to-sky-50 rounded-3xl overflow-hidden relative">
            {(totalCherries > 0) && (
                <div className="absolute top-2 right-2 text-[10px] text-black/50 bg-white/50 px-2 rounded-full z-10">
                    {visualCount} Cherries ({totalCherries} pts)
                </div>
            )}
            <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }} gl={{ antialias: true }}>
                <PyramidScene totalCherries={safeCount} />
            </Canvas>
        </div>
    )
});

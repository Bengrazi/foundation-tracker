"use client"

import type React from "react"

import { useRef, useMemo, useState, useEffect } from "react"
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
const GROUND_Y = 0.15 // Ground is now the bottom of the bowl
const BOWL_RADIUS = 2.5
const BOWL_CENTER_Y = 1.5
const BOWL_DEPTH = 1.5

function Cherry({ position, delay, onSettle, allCherries, index }: CherryProps) {
    const meshRef = useRef<THREE.Mesh>(null)
    const [hasStarted, setHasStarted] = useState(false)
    const cherryState = useRef<CherryState>({
        position: new THREE.Vector3(position[0], position[1] + 10, position[2]),
        velocity: new THREE.Vector3(0, 0, 0),
        settled: false,
        radius: CHERRY_RADIUS,
    })

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

        cs.velocity.y += GRAVITY * delta

        cs.position.x += cs.velocity.x * delta
        cs.position.y += cs.velocity.y * delta
        cs.position.z += cs.velocity.z * delta

        const dx = cs.position.x
        const dy = cs.position.y - BOWL_CENTER_Y
        const dz = cs.position.z
        const distFromCenter = Math.sqrt(dx * dx + dz * dz)

        const bowlRadiusAtHeight = BOWL_RADIUS * Math.sqrt(1 - Math.pow((BOWL_CENTER_Y - cs.position.y) / BOWL_DEPTH, 2))

        if (distFromCenter > bowlRadiusAtHeight - cs.radius && cs.position.y < BOWL_CENTER_Y) {
            const angle = Math.atan2(cs.position.z, cs.position.x)
            const maxDist = bowlRadiusAtHeight - cs.radius
            cs.position.x = Math.cos(angle) * maxDist
            cs.position.z = Math.sin(angle) * maxDist

            cs.velocity.x *= -BOUNCE_DAMPING
            cs.velocity.z *= -BOUNCE_DAMPING
            cs.velocity.y *= BOUNCE_DAMPING
        }

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

        for (let i = 0; i < allCherries.current.length; i++) {
            if (i === index || !allCherries.current[i]) continue

            const other = allCherries.current[i]
            const dx = cs.position.x - other.position.x
            const dy = cs.position.y - other.position.y
            const dz = cs.position.z - other.position.z
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const minDist = cs.radius + other.radius

            if (distance < minDist && distance > 0) {
                const overlap = minDist - distance
                const nx = dx / distance
                const ny = dy / distance
                const nz = dz / distance

                if (!cs.settled) {
                    cs.position.x += nx * overlap * 0.5
                    cs.position.y += ny * overlap * 0.5
                    cs.position.z += nz * overlap * 0.5

                    const relativeVelocity = cs.velocity.clone().sub(other.velocity)
                    const velocityAlongNormal = relativeVelocity.dot(new THREE.Vector3(nx, ny, nz))

                    if (velocityAlongNormal < 0) {
                        cs.velocity.x -= nx * velocityAlongNormal * BOUNCE_DAMPING
                        cs.velocity.y -= ny * velocityAlongNormal * BOUNCE_DAMPING
                        cs.velocity.z -= nz * velocityAlongNormal * BOUNCE_DAMPING
                    }
                }
            }
        }

        const speed = Math.sqrt(
            cs.velocity.x * cs.velocity.x + cs.velocity.y * cs.velocity.y + cs.velocity.z * cs.velocity.z,
        )
        if (speed < VELOCITY_THRESHOLD && cs.position.y <= bowlBottom + cs.radius + 0.05) {
            cs.velocity.set(0, 0, 0)
            cs.position.y = Math.max(cs.position.y, bowlBottom + cs.radius)
            cs.settled = true
            onSettle()
        }

        meshRef.current.position.copy(cs.position)
    })

    return (
        <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[CHERRY_RADIUS, 16, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
        </mesh>
    )
}

function GreenBowl() {
    return (
        <group position={[0, BOWL_CENTER_Y, 0]}>
            <mesh position={[0, 0, 0]} castShadow receiveShadow rotation={[Math.PI, 0, 0]}>
                <sphereGeometry args={[BOWL_RADIUS, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#34d399" roughness={0.3} metalness={0.2} side={THREE.DoubleSide} />
            </mesh>
        </group>
    )
}

interface PyramidSceneProps {
    totalCherries: number
}

function PyramidScene({ totalCherries }: PyramidSceneProps) {
    const [settledCount, setSettledCount] = useState(0)
    const allCherries = useRef<CherryState[]>([])

    const cherryPositions = useMemo(() => {
        const positions: [number, number, number][] = []

        for (let i = 0; i < totalCherries; i++) {
            // Reduced spread to ensure they fall IN the bowl
            const randomX = (Math.random() - 0.5) * 1.0
            const randomZ = (Math.random() - 0.5) * 1.0
            const randomHeight = Math.random() * 2
            positions.push([randomX, BOWL_CENTER_Y + 3 + randomHeight, randomZ])
        }

        return positions
    }, [totalCherries])

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight
                position={[10, 15, 5]}
                intensity={1.2}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, 10, -10]} intensity={0.5} />

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshStandardMaterial color="#8b6f47" roughness={0.8} />
            </mesh>

            <GreenBowl />

            {cherryPositions.map((pos, index) => (
                <Cherry
                    key={index}
                    position={pos}
                    delay={index * 50} // Faster delay for better feel
                    onSettle={() => setSettledCount((prev) => prev + 1)}
                    allCherries={allCherries}
                    index={index}
                />
            ))}

            <Environment preset="sunset" />

            <OrbitControls
                enablePan={false} // Disabled pan to keep focus on bowl
                enableZoom={true}
                enableRotate={true}
                minDistance={3}
                maxDistance={20}
                target={[0, 1.5, 0]}
            />
        </>
    )
}

// Adapted to accept totalCherries prop from parent
export function CherryPyramid({ totalCherries }: { totalCherries: number }) {
    const safeCount = Math.min(totalCherries, 500); // Cap at 500 for safety O(N^2)

    return (
        <div className="w-full h-full bg-gradient-to-b from-sky-100 to-sky-50 rounded-3xl overflow-hidden relative">
            {(totalCherries > safeCount) && (
                <div className="absolute top-2 right-2 text-[10px] text-black/50 bg-white/50 px-2 rounded-full z-10">
                    Showing 500/{totalCherries}
                </div>
            )}
            <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }} gl={{ antialias: true }}>
                <PyramidScene totalCherries={safeCount} />
            </Canvas>
        </div>
    )
}

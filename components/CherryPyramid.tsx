"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Color, Vector3 } from "three";
import { Environment, Lightformer } from "@react-three/drei";

// --- Configuration ---
const CHERRY_color = "#D92D20"; // Foundation Red
const STEM_COLOR = "#4A2B0F";

// Tier Logic
const TIERS = [
    { limit: 1000, ratio: 1 },       // 1:1
    { limit: 10000, ratio: 5 },      // 1 instance = 5 cherries
    { limit: 100000, ratio: 25 },    // 1 instance = 25 cherries
    { limit: Infinity, ratio: 100 }, // 1 instance = 100 cherries
];

function getRatio(total: number) {
    for (const t of TIERS) {
        if (total < t.limit) return t.ratio;
    }
    return 100;
}

// --- Cherry Mesh Component ---
// We use a simple composite geometry: Sphere for fruit, Cylinder for stem
// But for InstancedMesh, we need ONE geometry.
// We'll create a single geometry instance in the parent or use a simple sphere for now for POC.
// Better: Use a simple low-poly cherry geometry or just a sphere for V1 to ensure it works.
// Let's us a Sphere geometry for the cherry fruit.

function CherryInstances({ count, totalCherries }: { count: number; totalCherries: number }) {
    const meshRef = useRef<InstancedMesh>(null);
    const dummy = useMemo(() => new Object3D(), []);

    // deterministic random positions forming a pile
    const positions = useMemo(() => {
        const pos: Vector3[] = [];
        const seed = 123; // Fixed seed for stability

        // Simple pile algorithm: concentric circles / phyllotaxis or just random in a cone
        // Cone: x = r*cos(theta), z = r*sin(theta), y = height - r*slope
        // Better: Gaussian pile

        for (let i = 0; i < count; i++) {
            // Approximate a pile shape using rejection sampling or simple math
            // Width increases as Y decreases (pyramid)
            // Let's stack them from bottom up? That's hard without physics.
            // Let's just fill a volume defined by a cone equation where Y is up.
            // Cone base at y=0, tip at y=H.
            // Volume grows with count.

            // Simplified: Random point in a sphere, then abs(y)?
            // Let's use a "mound" distribution.

            const radiusFn = (y: number) => Math.max(0, 4 - y * 0.8); // Base radius 4, height ~5

            // Deterministic pseudo-random
            const r1 = Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453) % 1;
            const r2 = Math.abs(Math.sin(i * 78.233 + seed) * 43758.5453) % 1;
            const r3 = Math.abs(Math.sin(i * 32.123 + seed) * 43758.5453) % 1;

            // Just place them randomly within a mound constraint, then sort by Y to simulate stacking order visually
            // This is a hack but works for static piles.

            // Generate random point in cylinder
            const theta = r1 * Math.PI * 2;
            const r = Math.sqrt(r2) * 5; // Max radius 5
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);

            // Height based on gaussian-ish mound
            const maxY = 5 * Math.exp(-(x * x + z * z) / 10);
            const y = r3 * maxY;

            pos.push(new Vector3(x, y, z));
        }

        return pos;
    }, [count]);

    useFrame(() => {
        if (!meshRef.current) return;

        // Animate them falling in?
        // For V1 static pile is safer to get render working.

        positions.forEach((p, i) => {
            dummy.position.copy(p);
            const scale = 0.15; // Cherry size
            dummy.scale.set(scale, scale, scale);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={CHERRY_color} roughness={0.3} metalness={0.1} />
        </instancedMesh>
    );
}

export function CherryPyramid({ totalCherries }: { totalCherries: number }) {
    const ratio = getRatio(totalCherries);
    const visibleCount = Math.floor(Math.max(0, totalCherries) / ratio);
    // Safety cap for visual noise (though instanced mesh can handle 100k easily on desktop, mobile maybe 5-10k)
    // Let's cap visible instances to 2000 for safety and use tiering to manage the rest.

    const safeCount = Math.min(visibleCount, 2000);

    return (
        <div className="w-full h-full min-h-[300px] relative rounded-3xl overflow-hidden bg-gradient-to-b from-app-card/50 to-app-main border border-app-border">
            <Canvas shadows camera={{ position: [0, 4, 8], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <spotLight position={[5, 10, 5]} angle={0.5} penumbra={1} intensity={1} castShadow />
                <Environment preset="sunset" />

                <group position={[0, -2, 0]}>
                    <CherryInstances count={safeCount} totalCherries={totalCherries} />
                </group>

                {/* Simple floor/base for visual grounding */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]} receiveShadow>
                    <circleGeometry args={[6, 32]} />
                    <meshStandardMaterial color="#1a1a1a" transparent opacity={0.3} />
                </mesh>
            </Canvas>

            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <p className="text-[10px] text-app-muted font-bold uppercase tracking-wider">Lifetime Work</p>
                <p className="text-3xl font-bold text-app-main">{totalCherries.toLocaleString()}</p>
                {ratio > 1 && (
                    <p className="text-[9px] text-app-muted mt-1 opacity-70">1 sphere = {ratio} cherries</p>
                )}
            </div>
        </div>
    );
}

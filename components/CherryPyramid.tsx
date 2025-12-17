"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { InstancedMesh, Color } from "three";
import { Physics, usePlane, useSphere } from "@react-three/cannon";
import { Environment } from "@react-three/drei";

// --- Configuration ---
const CHERRY_COLOR = "#D92D20";
const FLOOR_LEVEL = -3;

// Tier Logic
const TIERS = [
    { limit: 300, ratio: 1 },       // Direct mapping up to 300
    { limit: 2000, ratio: 5 },      // 300-2000: 1 ball = 5 cherries
    { limit: 10000, ratio: 25 },    // 2000-10k: 1 ball = 25
    { limit: Infinity, ratio: 100 }, // 10k+: 1 ball = 100
];

function getRatio(total: number) {
    for (const t of TIERS) {
        if (total < t.limit) return t.ratio;
    }
    return 100;
}

// --- Physics Components ---

// The Floor and Walls (Invisible container)
function Container() {
    usePlane(() => ({ position: [0, FLOOR_LEVEL, 0], rotation: [-Math.PI / 2, 0, 0], type: "Static", friction: 0.5 }));
    // Walls to keep them in view
    usePlane(() => ({ position: [0, 0, -3], rotation: [0, 0, 0], type: "Static" })); // Back
    usePlane(() => ({ position: [0, 0, 3], rotation: [Math.PI, 0, 0], type: "Static" })); // Front (invisible but barrier)
    usePlane(() => ({ position: [-4, 0, 0], rotation: [0, Math.PI / 2, 0], type: "Static" })); // Left
    usePlane(() => ({ position: [4, 0, 0], rotation: [0, -Math.PI / 2, 0], type: "Static" })); // Right
    return null;
}

// Instanced Cherries with Physics
function PhysicsCherries({ count }: { count: number }) {
    const [ref] = useSphere<InstancedMesh>(index => ({
        mass: 1,
        position: [
            (Math.random() - 0.5) * 2, // Random X
            5 + (index * 0.2),         // Staggered Y (start high)
            (Math.random() - 0.5) * 2  // Random Z
        ],
        args: [0.18], // Radius matching geometry
        friction: 0.3,
        restitution: 0.2 // Bounciness
    }), React.useRef<InstancedMesh>(null));

    // Color array
    const colorArray = useMemo(() => new Float32Array(count * 3), [count]);
    useMemo(() => {
        const c = new Color(CHERRY_COLOR);
        for (let i = 0; i < count; i++) {
            // Slight variation
            const varC = c.clone().offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
            varC.toArray(colorArray, i * 3);
        }
    }, [count]);

    return (
        <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={CHERRY_COLOR} roughness={0.2} metalness={0.1} />
        </instancedMesh>
    );
}

export function CherryPyramid({ totalCherries }: { totalCherries: number }) {
    const ratio = getRatio(totalCherries);
    // Cap visual count to avoid crashing physics engine on mobile
    const visualCount = Math.min(Math.floor(totalCherries / ratio), 500);

    const [extraDrops, setExtraDrops] = useState(0);

    return (
        <div className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden bg-gradient-to-b from-app-card/50 to-app-main border border-app-border flex flex-col">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <p className="text-[10px] text-app-muted font-bold uppercase tracking-wider">Lifetime Work</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-app-main">{totalCherries.toLocaleString()}</p>
                    <span className="text-xs text-app-muted font-normal">cherries</span>
                </div>
                {ratio > 1 && (
                    <p className="text-[9px] text-app-muted mt-1 opacity-70">1 sphere = {ratio} cherries</p>
                )}
            </div>

            {/* Interaction Button */}
            <div className="absolute bottom-4 right-4 z-10">
                <button
                    onClick={() => setExtraDrops(p => p + 5)}
                    className="bg-app-accent/20 hover:bg-app-accent/40 text-app-accent-text border border-app-accent rounded-full px-3 py-1 text-xs font-bold transition-colors"
                >
                    + Drop 5
                </button>
            </div>

            <Canvas shadows camera={{ position: [0, 2, 7], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <spotLight position={[5, 10, 5]} angle={0.5} penumbra={1} intensity={1} castShadow />
                <Environment preset="studio" />

                <Physics gravity={[0, -10, 0]} allowSleep>
                    <Container />
                    <PhysicsCherries count={visualCount + extraDrops} />
                </Physics>
            </Canvas>
        </div>
    );
}

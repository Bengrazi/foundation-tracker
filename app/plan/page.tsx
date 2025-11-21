"use client";

import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { ChatWidget } from "@/components/ChatWidget";
import { GoalsWidget } from "@/components/GoalsWidget";

export default function PlanPage() {
    return (
        <div className="min-h-screen bg-app-main text-app-main transition-colors duration-300">
            <AuthGuardHeader />

            <main className="mx-auto max-w-md px-4 pb-28 pt-4">
                <ChatWidget />
                <GoalsWidget />
            </main>
        </div>
    );
}

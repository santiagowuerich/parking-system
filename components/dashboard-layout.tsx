"use client";

import { DashboardSidebar } from "./dashboard-sidebar";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

interface DashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
    clockComponent?: React.ReactNode;
}

export function DashboardLayout({ children, className, clockComponent }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <DashboardSidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header con reloj (opcional) */}
                {clockComponent && (
                    <div className="border-b bg-card px-6 py-3 flex justify-end items-center">
                        {clockComponent}
                    </div>
                )}

                {/* Content Area */}
                <main className={cn("flex-1 overflow-auto", className)}>
                    {children}
                </main>
            </div>

            {/* Toaster for notifications */}
            <Toaster />
        </div>
    );
}

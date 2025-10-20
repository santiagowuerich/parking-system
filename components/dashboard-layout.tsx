"use client";

import { DashboardSidebar } from "./dashboard-sidebar";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

interface DashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <DashboardSidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
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

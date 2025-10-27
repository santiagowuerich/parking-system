"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ReactNode } from "react";

interface ReporteLayoutProps {
    title: string;
    description: string;
    children: ReactNode;
}

export function ReporteLayout({ title, description, children }: ReporteLayoutProps) {
    return (
        <DashboardLayout title={title} description={description}>
            <div className="space-y-6">
                {children}
            </div>
        </DashboardLayout>
    );
}

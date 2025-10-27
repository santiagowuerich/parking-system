"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon?: LucideIcon;
    title?: string;
    description?: string;
    className?: string;
}

export function EmptyState({
    icon: Icon = Inbox,
    title = "No hay datos disponibles",
    description = "No se encontraron datos para el período seleccionado.",
    className
}: EmptyStateProps) {
    return (
        <Card className={cn("border-dashed", className)}>
            <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-sm">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

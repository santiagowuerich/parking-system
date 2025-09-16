"use client";

import { Loader2 } from "lucide-react";

export function FullScreenLoader({ title = "Cargando...", subtitle }: { title?: string; subtitle?: string }) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <div className="space-y-1">
                    <h3 className="text-lg font-medium text-foreground">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                </div>
            </div>
        </div>
    );
}



"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Metrica {
    label: string;
    value: string | number;
    subtitle?: string;
    badge?: {
        text: string;
        variant?: "default" | "secondary" | "destructive" | "outline";
    };
    icon?: LucideIcon;
    trend?: "up" | "down" | "neutral";
}

interface MetricasRapidasProps {
    titulo: string;
    metricas: Metrica[];
    className?: string;
}

export function MetricasRapidas({ titulo, metricas, className }: MetricasRapidasProps) {
    return (
        <div className={cn("space-y-4 max-w-6xl mx-auto", className)}>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {titulo}
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {metricas.map((metrica, index) => {
                    const Icon = metrica.icon;
                    return (
                        <Card
                            key={index}
                            className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
                        >
                            <CardContent className="p-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {metrica.label}
                                        </p>
                                        {Icon && (
                                            <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                        )}
                                    </div>

                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {metrica.value}
                                        </p>
                                        {metrica.badge && (
                                            <Badge
                                                variant={metrica.badge.variant || "secondary"}
                                                className={cn(
                                                    "text-xs px-1.5 py-0",
                                                    metrica.trend === "up" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                    metrica.trend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                )}
                                            >
                                                {metrica.badge.text}
                                            </Badge>
                                        )}
                                    </div>

                                    {metrica.subtitle && (
                                        <p className="text-xs text-slate-500 dark:text-slate-500">
                                            {metrica.subtitle}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

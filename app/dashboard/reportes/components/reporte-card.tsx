"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ReporteCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    href?: string;
    badge?: string;
    color?: "blue" | "green" | "purple" | "orange";
    onClick?: () => void;
}

export function ReporteCard({
    icon: Icon,
    title,
    description,
    href,
    badge,
    color = "blue",
    onClick
}: ReporteCardProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (href) {
            router.push(href);
        }
    };

    const colorVariants = {
        blue: {
            gradient: "from-blue-50 to-blue-100/40 dark:from-blue-900/30 dark:to-blue-800/20",
            icon: "text-blue-600 dark:text-blue-400",
            border: "border-blue-200 dark:border-blue-800",
            hover: "hover:shadow-blue-200/50 dark:hover:shadow-blue-900/50"
        },
        green: {
            gradient: "from-green-50 to-green-100/40 dark:from-green-900/30 dark:to-green-800/20",
            icon: "text-green-600 dark:text-green-400",
            border: "border-green-200 dark:border-green-800",
            hover: "hover:shadow-green-200/50 dark:hover:shadow-green-900/50"
        },
        purple: {
            gradient: "from-purple-50 to-purple-100/40 dark:from-purple-900/30 dark:to-purple-800/20",
            icon: "text-purple-600 dark:text-purple-400",
            border: "border-purple-200 dark:border-purple-800",
            hover: "hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50"
        },
        orange: {
            gradient: "from-orange-50 to-orange-100/40 dark:from-orange-900/30 dark:to-orange-800/20",
            icon: "text-orange-600 dark:text-orange-400",
            border: "border-orange-200 dark:border-orange-800",
            hover: "hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50"
        }
    };

    const colors = colorVariants[color];

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-300 cursor-pointer",
                "hover:shadow-lg hover:-translate-y-1",
                "border h-full",
                colors.border,
                colors.hover
            )}
            onClick={handleClick}
        >
            {badge && (
                <Badge
                    className="absolute top-3 right-3 z-10 text-xs"
                    variant="secondary"
                >
                    {badge}
                </Badge>
            )}

            <CardHeader className={cn("pb-3 pt-4 px-4", `bg-gradient-to-br ${colors.gradient}`)}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg",
                        "bg-white dark:bg-slate-900 shadow-sm flex-shrink-0",
                        colors.icon
                    )}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                        {title}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="pt-4 pb-4 px-4">
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                    {description}
                </CardDescription>

                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "w-full justify-between group-hover:bg-slate-100 dark:group-hover:bg-slate-800",
                        "transition-colors h-8 text-sm"
                    )}
                >
                    <span>Ver Reporte</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Button>
            </CardContent>
        </Card>
    );
}

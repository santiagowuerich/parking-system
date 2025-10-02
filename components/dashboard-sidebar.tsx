"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    LayoutDashboard,
    Car,
    Settings,
    CreditCard,
    FileText,
    MapPin,
    User,
    ParkingCircle,
    BarChart3,
    Shield,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Users,
    Wallet,
    Moon,
    Sun,
    Monitor,
    Clock,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { useTheme } from "next-themes";
import ParkingStatusWidget from "./ParkingStatusWidget";
// Debug component removed to prevent loops

interface SidebarProps {
    className?: string;
}

// Elementos de navegación para empleados
const employeeNavigationItems = [
    {
        title: "Panel de Operador",
        href: "/dashboard/operador",
        icon: ParkingCircle,
        description: "Gestión de estacionamientos",
        subItems: [
            {
                title: "Ingreso/Egreso",
                href: "/dashboard/operador"
            },
            {
                title: "Información",
                href: "/dashboard/operador-simple"
            },
            {
                title: "Movimientos",
                href: "/dashboard/movimientos"
            }
        ]
    },
    {
        title: "Gestión de Turnos",
        href: "/dashboard/turnos",
        icon: Clock,
        description: "Registrar entrada y salida de turno"
    },
    {
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    }
];

// Elementos de navegación para dueños
const ownerNavigationItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Panel principal de control"
    },
    {
        title: "Panel de Operador",
        href: "/dashboard/operador",
        icon: ParkingCircle,
        description: "Gestión de estacionamientos",
        subItems: [
            {
                title: "Ingreso/Egreso",
                href: "/dashboard/operador"
            },
            {
                title: "Información",
                href: "/dashboard/operador-simple"
            },
            {
                title: "Movimientos",
                href: "/dashboard/movimientos"
            }
        ]
    },
    {
        title: "Mis Estacionamientos",
        href: "/dashboard/parking",
        icon: Car,
        description: "Administrar estacionamientos"
    },
    {
        title: "Plantillas",
        href: "/dashboard/plantillas",
        icon: FileText,
        description: "Gestionar plantillas de plazas"
    },
    {
        title: "Tarifas",
        href: "/dashboard/tarifas",
        icon: CreditCard,
        description: "Configurar precios y tarifas"
    },
    {
        title: "Empleados",
        href: "/dashboard/empleados",
        icon: Users,
        description: "Gestionar empleados"
    },
    {
        title: "Configuración de Zona",
        href: "/dashboard/configuracion-zona",
        icon: Settings,
        description: "Crear zonas y plazas"
    },
    {
        title: "Visualización de Plazas",
        href: "/dashboard/visualizacion-plazas",
        icon: BarChart3,
        description: "Ver estado de todas las plazas"
    },
    {
        title: "Configuración Tipo de Plazas",
        href: "/dashboard/plazas/configuracion-avanzada",
        icon: Settings,
        description: "Gestionar plantillas de plazas"
    },
    {
        title: "Panel de Administrador",
        href: "/dashboard/panel-administrador",
        icon: Shield,
        description: "Administración avanzada del sistema"
    },
    {
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    },
    {
        title: "Configuración de Pagos",
        href: "/dashboard/configuracion-pagos",
        icon: Wallet,
        description: "Métodos y configuraciones de pago"
    }
];


export function DashboardSidebar({ className }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut, userRole, roleLoading } = useAuth();
    const { role, isEmployee, isOwner } = useUserRole();
    const { theme, setTheme } = useTheme();
    const [collapsed, setCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>(["Panel de Operador"]);

    // Seleccionar elementos de navegación según el rol
    const getNavigationItems = () => {
        // Mientras carga el rol, mostrar elementos básicos
        if (roleLoading) {
            return employeeNavigationItems; // Mostrar solo opciones básicas mientras carga
        }
        if (isOwner) {
            return ownerNavigationItems;
        }
        if (isEmployee) {
            return employeeNavigationItems;
        }
        // Fallback seguro para empleados si el rol no está claro
        return employeeNavigationItems;
    };

    const navigationItems = getNavigationItems();

    const handleNavigation = (href: string) => {
        router.push(href);
    };

    const handleLogout = async () => {
        await signOut();
        router.push('/auth/login');
    };

    const toggleExpanded = (title: string) => {
        setExpandedItems(prev =>
            prev.includes(title)
                ? prev.filter(item => item !== title)
                : [...prev, title]
        );
    };


    return (
        <div className={cn(
            "flex h-full flex-col border-r bg-card",
            collapsed ? "w-16" : "w-64",
            className
        )}>
            {/* Header */}
            <div className={cn(
                "flex h-16 items-center border-b",
                collapsed ? "justify-center px-2" : "justify-between px-4"
            )}>
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <ParkingCircle className="h-6 w-6 text-primary" />
                        <span className="font-semibold text-lg">Parqueo</span>
                    </div>
                )}
                <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
                    {/* Dropdown de cambio de tema */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Cambiar tema"
                            >
                                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">Cambiar tema</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem onClick={() => setTheme("light")}>
                                <Sun className="mr-2 h-4 w-4" />
                                <span>Claro</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}>
                                <Moon className="mr-2 h-4 w-4" />
                                <span>Oscuro</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("system")}>
                                <Monitor className="mr-2 h-4 w-4" />
                                <span>Sistema</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Botón de colapsar/expandir */}
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCollapsed(!collapsed)}
                                    className="h-8 w-8 p-0"
                                >
                                    {collapsed ? (
                                        <ChevronRight className="h-4 w-4" />
                                    ) : (
                                        <ChevronLeft className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{collapsed ? "Expandir menú" : "Colapsar menú"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Navigation */}
            <ScrollArea className={cn("flex-1", collapsed ? "px-1 py-4" : "px-3 py-4")}>
                <TooltipProvider delayDuration={0}>
                    {/* Widget compacto con nombre de estacionamiento - solo visible cuando está expandido */}
                    {!collapsed && (
                        <div className="mb-4">
                            <ParkingStatusWidget />
                        </div>
                    )}

                    <div className={cn(collapsed ? "space-y-1" : "space-y-1")}>
                        {navigationItems.map((item: any) => {
                            const Icon = item.icon;
                            const isExpanded = expandedItems.includes(item.title);
                            const hasSubItems = item.subItems && item.subItems.length > 0;

                            // Verificar si algún subitem está activo
                            const hasActiveSubItem = hasSubItems && item.subItems.some((subItem: any) => pathname === subItem.href);

                            // Un item está activo si coincide su href O si tiene un subitem activo
                            const isActive = pathname === item.href ||
                                (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
                                hasActiveSubItem;

                            // Si está colapsado y tiene subitems, mostrar dropdown con tooltip
                            if (collapsed && hasSubItems) {
                                return (
                                    <Tooltip key={`${item.href}-${item.title}`}>
                                        <DropdownMenu>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant={isActive ? "secondary" : "ghost"}
                                                        className={cn(
                                                            "w-full h-11 flex items-center justify-center p-0 rounded-md",
                                                            isActive && "bg-secondary"
                                                        )}
                                                    >
                                                        <Icon className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" sideOffset={10}>
                                                <p>{item.title}</p>
                                            </TooltipContent>
                                            <DropdownMenuContent
                                                side="right"
                                                align="start"
                                                className="w-56"
                                                sideOffset={8}
                                            >
                                                <div className="px-2 py-1.5 text-sm font-semibold border-b mb-1">
                                                    {item.title}
                                                </div>
                                                {item.subItems.map((subItem: any) => {
                                                    const isSubActive = pathname === subItem.href;
                                                    return (
                                                        <DropdownMenuItem
                                                            key={subItem.href}
                                                            onClick={() => handleNavigation(subItem.href)}
                                                            className={cn(isSubActive && "bg-secondary")}
                                                        >
                                                            {subItem.title}
                                                        </DropdownMenuItem>
                                                    );
                                                })}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </Tooltip>
                                );
                            }

                            // Si está colapsado sin subitems, mostrar con tooltip
                            if (collapsed && !hasSubItems) {
                                return (
                                    <Tooltip key={`${item.href}-${item.title}`}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={isActive ? "secondary" : "ghost"}
                                                className={cn(
                                                    "w-full h-11 flex items-center justify-center p-0 rounded-md",
                                                    isActive && "bg-secondary"
                                                )}
                                                onClick={() => handleNavigation(item.href)}
                                            >
                                                <Icon className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" sideOffset={10}>
                                            <p>{item.title}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            // Vista expandida
                            return (
                                <div key={`${item.href}-${item.title}`} className="space-y-1">
                                    <Button
                                        variant={isActive && !hasSubItems ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start h-auto p-3 px-3",
                                            isActive && !hasSubItems && "bg-secondary"
                                        )}
                                        onClick={() => {
                                            if (hasSubItems) {
                                                toggleExpanded(item.title);
                                            } else {
                                                handleNavigation(item.href);
                                            }
                                        }}
                                    >
                                        <Icon className="h-5 w-5 shrink-0 mr-3" />
                                        <div className="flex flex-col items-start flex-1">
                                            <span className="text-sm font-medium">{item.title}</span>
                                            <span className="text-xs text-muted-foreground">{item.description}</span>
                                        </div>
                                        {hasSubItems && (
                                            isExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />
                                        )}
                                    </Button>

                                    {/* Subitems */}
                                    {hasSubItems && isExpanded && (
                                        <div className="ml-8 space-y-1">
                                            {item.subItems.map((subItem: any) => {
                                                const isSubActive = pathname === subItem.href;
                                                return (
                                                    <Button
                                                        key={subItem.href}
                                                        variant={isSubActive ? "secondary" : "ghost"}
                                                        className={cn(
                                                            "w-full justify-start p-2",
                                                            isSubActive && "bg-secondary"
                                                        )}
                                                        onClick={() => handleNavigation(subItem.href)}
                                                    >
                                                        <span className="text-sm">{subItem.title}</span>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Separator className="my-4" />

                    {/* User Info */}
                    <div className="space-y-1">
                        {!collapsed && (
                            <div className="px-3 py-2">
                                <p className="text-sm font-medium">{user?.email}</p>
                                <p className="text-xs text-muted-foreground">Usuario activo</p>
                            </div>
                        )}
                        {collapsed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="w-full h-11 flex items-center justify-center cursor-pointer hover:bg-accent rounded-md transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={10}>
                                    <p className="text-xs">{user?.email}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="w-full h-11 flex items-center justify-center p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-md"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={10}>
                                    <p>Cerrar sesión</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 px-3"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4 shrink-0 mr-2" />
                                <span className="text-sm">Cerrar sesión</span>
                            </Button>
                        )}
                    </div>
                </TooltipProvider>
            </ScrollArea>
        </div>
    );
}

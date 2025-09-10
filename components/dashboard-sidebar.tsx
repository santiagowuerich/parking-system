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
    Monitor
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/use-role";
import { useTheme } from "next-themes";
import ParkingStatusWidget from "./ParkingStatusWidget";

interface SidebarProps {
    className?: string;
}

// Tipo para los elementos del sidebar
type SidebarItem = {
    id: string;
    title: string;
    href: string;
    icon: React.ComponentType<any>;
    description: string;
};

// Elementos de navegación para empleados
const employeeNavigationItems = [
    {
        id: "employee-dashboard",
        title: "Dashboard",
        href: "/dashboard/operador-simple",
        icon: LayoutDashboard,
        description: "Panel de operador"
    },
    {
        id: "employee-profile",
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    }
];

// Elementos de navegación para dueños
const ownerNavigationItems = [
    {
        id: "owner-dashboard",
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Vista general del sistema"
    },
    {
        id: "owner-operator-panel",
        title: "Panel de Operador",
        href: "/dashboard/operador-simple",
        icon: ParkingCircle,
        description: "Gestión de estacionamientos"
    },
    {
        id: "owner-admin-panel",
        title: "Panel de Administrador",
        href: "/dashboard/panel-administrador",
        icon: BarChart3,
        description: "Administración y estadísticas"
    },
    {
        id: "owner-parkings",
        title: "Mis Estacionamientos",
        href: "/dashboard/parking",
        icon: Car,
        description: "Administrar estacionamientos"
    },
    {
        id: "owner-templates",
        title: "Plantillas",
        href: "/dashboard/plantillas",
        icon: FileText,
        description: "Gestionar plantillas de plazas"
    },
    {
        id: "owner-rates",
        title: "Tarifas",
        href: "/dashboard/tarifas",
        icon: CreditCard,
        description: "Configurar precios y tarifas"
    },
    {
        id: "owner-maps",
        title: "Google Maps",
        href: "/dashboard/google-maps",
        icon: MapPin,
        description: "Configurar mapas y ubicación"
    },
    {
        id: "owner-employees",
        title: "Empleados",
        href: "/dashboard/empleados",
        icon: Users,
        description: "Gestionar empleados"
    },
    {
        id: "owner-zone-config",
        title: "Configuración de Zona",
        href: "/dashboard/configuracion-zona",
        icon: Settings,
        description: "Crear zonas y plazas"
    },
    {
        id: "owner-places-visualization",
        title: "Visualización de Plazas",
        href: "/dashboard/visualizacion-plazas",
        icon: BarChart3,
        description: "Ver estado de todas las plazas"
    },
    {
        id: "owner-advanced-config",
        title: "Configuración Avanzada",
        href: "/dashboard/plazas/configuracion-avanzada",
        icon: Settings,
        description: "Gestionar plantillas de plazas"
    },
    {
        id: "owner-profile",
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    },
    {
        id: "owner-payment-config",
        title: "Configuración de Pagos",
        href: "/dashboard/configuracion-pagos",
        icon: Wallet,
        description: "Métodos y configuraciones de pago"
    }
];

// Elementos de navegación para conductores
const driverNavigationItems = [
    {
        id: "driver-dashboard",
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Vista general del sistema"
    },
    {
        id: "driver-profile",
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    }
];

// Función para normalizar y deduplicar elementos del sidebar
function buildSidebarItems(params: { role: 'dueno' | 'operador' | 'admin' | 'conductor' | string }): SidebarItem[] {
    let items: SidebarItem[] = [];

    // Seleccionar elementos según el rol
    if (params.role === 'dueno' || params.role === 'admin') {
        items = [...ownerNavigationItems];
    } else if (params.role === 'operador') {
        items = [...employeeNavigationItems];
    } else if (params.role === 'conductor') {
        items = [...driverNavigationItems];
    } else {
        // Por defecto, mostrar elementos limitados
        items = [...employeeNavigationItems];
    }

    // Deduplicar por href manteniendo la primera ocurrencia
    const dedupByHref = Array.from(new Map(items.map(item => [item.href, item])).values());

    // Asegurar que cada item tenga un id único y estable
    const normalized = dedupByHref.map((item) => ({
        ...item,
        id: item.id || `sidebar:${item.href}`, // fallback si no hay id
    }));

    // Guard en desarrollo para detectar duplicados
    if (process.env.NODE_ENV !== 'production') {
        const hrefs = normalized.map(item => item.href);
        const dups = hrefs.filter((v, i, arr) => arr.indexOf(v) !== i);
        if (dups.length) {
            console.warn('Duplicate sidebar hrefs detected after normalization:', dups);
        }

        const ids = normalized.map(item => item.id);
        const dupIds = ids.filter((v, i, arr) => arr.indexOf(v) !== i);
        if (dupIds.length) {
            console.warn('Duplicate sidebar IDs detected:', dupIds);
        }
    }

    return normalized;
}

export function DashboardSidebar({ className }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { role, isPlayero, isOwner, isConductor } = useRole();
    const { theme, setTheme } = useTheme();
    const [collapsed, setCollapsed] = useState(false);

    // Construir elementos de navegación normalizados
    const navigationItems = buildSidebarItems({ role: role || 'operador' });

    const handleNavigation = (href: string) => {
        router.push(href);
    };

    const handleLogout = async () => {
        await signOut();
        router.push('/auth/login');
    };


    return (
        <div className={cn(
            "flex h-full flex-col border-r bg-card",
            collapsed ? "w-16" : "w-64",
            className
        )}>
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <ParkingCircle className="h-6 w-6 text-primary" />
                        <span className="font-semibold text-lg">ParkingSys</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
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
                </div>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 px-3 py-4">
                {/* Widget de estado del estacionamiento */}
                <div className="mb-4">
                    <ParkingStatusWidget collapsed={collapsed} />
                </div>

                <div className="space-y-2">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href));

                        return (
                            <Button
                                key={item.id}
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start h-auto p-3",
                                    collapsed ? "px-2" : "px-3",
                                    isActive && "bg-secondary"
                                )}
                                onClick={() => handleNavigation(item.href)}
                            >
                                <Icon className={cn("h-5 w-5 shrink-0", collapsed ? "mr-0" : "mr-3")} />
                                {!collapsed && (
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-medium">{item.title}</span>
                                        <span className="text-xs text-muted-foreground">{item.description}</span>
                                    </div>
                                )}
                            </Button>
                        );
                    })}
                </div>

                <Separator className="my-4" />

                {/* User Info */}
                <div className={cn("space-y-2", collapsed && "text-center")}>
                    {!collapsed && (
                        <div className="px-3 py-2">
                            <p className="text-sm font-medium">{user?.email}</p>
                            <p className="text-xs text-muted-foreground">Usuario activo</p>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
                            collapsed ? "px-2" : "px-3"
                        )}
                        onClick={handleLogout}
                    >
                        <LogOut className={cn("h-4 w-4 shrink-0", collapsed ? "mr-0" : "mr-2")} />
                        {!collapsed && <span className="text-sm">Cerrar sesión</span>}
                    </Button>
                </div>
            </ScrollArea>
        </div>
    );
}

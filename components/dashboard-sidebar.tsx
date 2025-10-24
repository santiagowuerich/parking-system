"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    LogOut,
    Users,
    Wallet,
    Moon,
    Sun,
    Monitor,
    Clock,
    ChevronDown,
    ChevronUp,
    Calendar
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { useTurnos } from "@/lib/hooks/use-turnos";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { Logo } from "@/components/logo";
import { ParkingDisplay } from "@/components/parking-display";

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
                title: "Visualización de Plazas",
                href: "/dashboard/operador-simple"
            },
            {
                title: "Movimientos",
                href: "/dashboard/movimientos"
            }
        ]
    },
    {
        title: "Abonos",
        href: "/dashboard/abonos",
        icon: Calendar,
        description: "Gestión de abonos",
        subItems: [
            {
                title: "Crear Abono",
                href: "/dashboard/crear-abono"
            },
            {
                title: "Gestión de Abonos",
                href: "/dashboard/gestion-abonos"
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

// Elementos de navegación para conductores
const conductorNavigationItems = [
    {
        title: "Mapa de Estacionamientos",
        href: "/conductor",
        icon: MapPin,
        description: "Encontrá estacionamientos cerca"
    },
    {
        title: "Mis Vehículos",
        href: "/conductor/vehiculos",
        icon: Car,
        description: "Administración de mis vehiculos"
    },
    {
        title: "Abonos",
        href: "/dashboard/abonos",
        icon: Calendar,
        description: "Gestiona tus abonos"
    },
    {
        title: "Reservas",
        href: "/dashboard/reservas",
        icon: Shield,
        description: "Reserva plazas con anticipación"
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
        title: "Mis Estacionamientos",
        href: "/dashboard/parking",
        icon: Car,
        description: "Administrar estacionamientos"
    },
    {
        title: "Operaciones",
        href: "/dashboard/panel-administrador",
        icon: Shield,
        description: "Administración avanzada del sistema",
        subItems: [
            {
                title: "Resumen Operativo",
                href: "/dashboard"
            },
            {
                title: "Visualización de Plazas",
                href: "/dashboard/visualizacion-plazas"
            },
            {
                title: "Historial de Movimientos",
                href: "/dashboard/panel-administrador"
            }
        ]
    },
    {
        title: "Zonas",
        href: "/dashboard/configuracion-zona",
        icon: MapPin,
        description: "Crear zonas y plazas"
    },
    {
        title: "Plazas",
        href: "/dashboard/plazas",
        icon: ParkingCircle,
        description: "Gestión de plazas",
        subItems: [
            {
                title: "Plantillas y Tarifas",
                href: "/dashboard/plantillas"
            },
            {
                title: "Asignar Plantillas",
                href: "/dashboard/plazas/configuracion-avanzada"
            }
        ]
    },
    {
        title: "Servicios",
        href: "/dashboard/servicios",
        icon: Calendar,
        description: "Gestión de servicios",
        subItems: [
            {
                title: "Abonos",
                href: "/dashboard/servicios/abonos"
            },
            {
                title: "Reservas",
                href: "/dashboard/servicios/reservas"
            }
        ]
    },
    {
        title: "Empleados",
        href: "/dashboard/empleados",
        icon: Users,
        description: "Gestionar empleados",
        subItems: [
            {
                title: "Playeros",
                href: "/dashboard/empleados"
            },
            {
                title: "Turnos",
                href: "/dashboard/turnos"
            }
        ]
    },
    {
        title: "Métodos de pago",
        href: "/dashboard/configuracion-pagos",
        icon: Wallet,
        description: "Métodos y configuraciones de pago"
    },
    {
        title: "Perfil",
        href: "/account/security",
        icon: User,
        description: "Configuración de cuenta"
    }
];


export function DashboardSidebar({ className }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut, userRole, roleLoading } = useAuth();
    const { role, isEmployee, isOwner, isDriver } = useUserRole();
    const { tieneTurnoActivo, turnoActivo } = useTurnos();
    const { theme, setTheme } = useTheme();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    // Seleccionar elementos de navegación según el rol usando useMemo para estabilidad
    const navigationItems = useMemo(() => {
        // Mientras carga el rol, mostrar elementos neutros (solo perfil y logout)
        if (roleLoading) {
            return [
                {
                    title: "Perfil",
                    href: "/account/security",
                    icon: User,
                    description: "Configuración de cuenta"
                }
            ];
        }
        if (isOwner) {
            return ownerNavigationItems;
        }
        if (isEmployee) {
            return employeeNavigationItems;
        }
        if (isDriver) {
            return conductorNavigationItems;
        }
        // Fallback seguro: mostrar solo perfil si el rol no está claro
        return [
            {
                title: "Perfil",
                href: "/account/security",
                icon: User,
                description: "Configuración de cuenta"
            }
        ];
    }, [roleLoading, isOwner, isEmployee, isDriver]);

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
            "flex h-full flex-col bg-white dark:bg-slate-950 w-72",
            className
        )}>
            {/* Header con card elevado y degradado azul */}
            <div className="px-4 pt-4 pb-1">
                <div className="rounded-2xl shadow-lg transition-all duration-300 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900 p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Logo */}
                            <Logo width={140} height={38} />
                        </div>

                        {/* Dropdown de cambio de tema - ahora en la posición del botón de colapsar */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30"
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
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto">
                <div className="px-3 pt-2">
                    {/* Selector de estacionamiento - solo visible para owners y playeros */}
                    {!isDriver && (
                        <div className="mb-1">
                            <ParkingDisplay />
                        </div>
                    )}

                    {/* Indicador de turno activo - solo visible para empleados */}
                    {isEmployee && (
                        <div className="mb-1">
                            <div className={cn(
                                "rounded-xl p-3.5 shadow-sm border transition-all duration-200",
                                tieneTurnoActivo
                                    ? "bg-gradient-to-r from-green-50/50 to-transparent border-green-200 dark:from-green-950/20 dark:border-green-800"
                                    : "bg-gradient-to-r from-red-50/50 to-transparent border-red-200 dark:from-red-950/20 dark:border-red-800"
                            )}>
                                <div className="flex items-center gap-2.5">
                                    <Clock className={cn(
                                        "h-4 w-4",
                                        tieneTurnoActivo ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )} />
                                    <div className="flex-1">
                                        <Badge variant={tieneTurnoActivo ? "default" : "destructive"} className="text-xs">
                                            {tieneTurnoActivo
                                                ? `Turno activo desde ${turnoActivo?.tur_hora_entrada}`
                                                : "Sin turno activo"
                                            }
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {navigationItems.map((item: any) => {
                            const Icon = item.icon;
                            const hasSubItems = item.subItems && item.subItems.length > 0;

                            // Verificar si algún subitem está activo
                            const hasActiveSubItem = hasSubItems && item.subItems.some((subItem: any) => pathname === subItem.href);

                            // Un item está activo si coincide exactamente su href O si tiene un subitem activo
                            const isActive = pathname === item.href || hasActiveSubItem;

                            // Si el item está activo y tiene subitems, forzar que esté expandido
                            const isExpanded = hasActiveSubItem ? true : expandedItems.includes(item.title);

                            // Vista expandida con efectos neumórficos en azul
                            return (
                                <div key={`${item.href}-${item.title}`} className="space-y-1.5">
                                    <div className="relative group">
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left outline-none transition-all duration-200",
                                                // Estado activo con efecto pill elevado y neumórfico en azul
                                                isActive && [
                                                    "bg-gradient-to-r from-blue-50 to-blue-100/40 dark:from-blue-900/30 dark:to-blue-800/20",
                                                    "shadow-[0_8px_20px_-8px_rgba(59,130,246,0.25)]",
                                                    "ring-1 ring-blue-200 dark:ring-blue-800",
                                                    "font-semibold text-neutral-900 dark:text-white",
                                                    "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-blue-500"
                                                ],
                                                // Estado normal con color de texto gris azulado
                                                !isActive && "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                                                // Efecto hover con transición suave
                                                !isActive && "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 hover:shadow-sm hover:-translate-y-[1px]",
                                                "h-auto min-h-[48px] text-base"
                                            )}
                                            onClick={() => {
                                                if (hasSubItems) {
                                                    // Si tiene un subitem activo, no permitir cerrar
                                                    if (!hasActiveSubItem) {
                                                        toggleExpanded(item.title);
                                                    }
                                                } else {
                                                    handleNavigation(item.href);
                                                }
                                            }}
                                        >
                                            <div className={cn(
                                                "flex items-center justify-center w-5 h-5 transition-colors",
                                                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-500"
                                            )}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <span className="flex-1 text-left font-medium">{item.title}</span>
                                            {/* Solo mostrar chevron si NO tiene un subitem activo */}
                                            {hasSubItems && !hasActiveSubItem && (
                                                isExpanded ?
                                                    <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" /> :
                                                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Subitems con divisor vertical */}
                                    {hasSubItems && isExpanded && (
                                        <div className="ml-8 space-y-1 relative">
                                            {/* Divisor vertical guía */}
                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200/70 dark:bg-slate-700/70" />

                                            {item.subItems.map((subItem: any, index: number) => {
                                                const isSubActive = pathname === subItem.href;
                                                return (
                                                    <div key={subItem.href} className="relative group pl-4">
                                                        <Button
                                                            variant="ghost"
                                                            className={cn(
                                                                "flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left outline-none transition-all duration-200",
                                                                // Estado activo con efecto pill elevado más sutil para subitems en azul
                                                                isSubActive && [
                                                                    "bg-gradient-to-r from-blue-50/70 to-blue-100/30 dark:from-blue-900/20 dark:to-blue-800/10",
                                                                    "shadow-[0_4px_12px_-4px_rgba(59,130,246,0.2)]",
                                                                    "ring-1 ring-blue-200/60 dark:ring-blue-800/60",
                                                                    "font-medium text-neutral-900 dark:text-white",
                                                                    "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-blue-500"
                                                                ],
                                                                // Estado normal
                                                                !isSubActive && "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                                                                // Efecto hover
                                                                !isSubActive && "hover:bg-slate-50/60 dark:hover:bg-slate-800/30 hover:shadow-sm",
                                                                "h-auto min-h-[40px] text-sm"
                                                            )}
                                                            onClick={() => handleNavigation(subItem.href)}
                                                        >
                                                            <span className="flex-1 text-left">{subItem.title}</span>
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Separator className="my-6 bg-slate-200/60 dark:bg-slate-700/60" />

                    {/* User Info con diseño mejorado en azul */}
                    <div className="px-1 space-y-2">
                        {/* Card de información de usuario */}
                        <div className="px-3 py-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{user?.email}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Usuario activo</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botón de cerrar sesión */}
                        <Button
                            variant="ghost"
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:shadow-sm"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Cerrar sesión</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

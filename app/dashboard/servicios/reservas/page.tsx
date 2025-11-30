"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Calendar,
    Search,
    MapPin,
    Clock,
    User,
    Car,
    DollarSign,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertTriangle
} from "lucide-react";
import { ReservaConDetalles } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import dayjs from 'dayjs';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const ITEMS_POR_PAGINA = 10;

export default function ReservasPage() {
    const { estId } = useAuth();
    const [reservas, setReservas] = useState<ReservaConDetalles[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fechaFiltro, setFechaFiltro] = useState('');
    const [mostrarHistorial, setMostrarHistorial] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const cargarReservas = async () => {
        if (!estId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/reservas/list?est_id=${estId}`);
            const data = await response.json();

            if (data.success) {
                setReservas(data.reservas || []);
            } else {
                toast({
                    title: "Error",
                    description: "No se pudieron cargar las reservas",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error cargando reservas:", error);
            toast({
                title: "Error",
                description: "Error al cargar las reservas",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarReservas();
    }, [estId]);

    // Filtrado unificado
    const reservasFiltradas = useMemo(() => {
        return reservas.filter(r => {
            // Filtrar historial si checkbox no está marcado
            if (!mostrarHistorial) {
                const esHistorial = ['completada', 'expirada', 'cancelada', 'no_show'].includes(r.res_estado);
                if (esHistorial) return false;
            }

            // Filtro de búsqueda
            const cumpleBusqueda = !searchTerm || (
                r.res_codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.veh_patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `${r.conductor.usu_nom} ${r.conductor.usu_ape}`.toLowerCase().includes(searchTerm.toLowerCase())
            );

            // Filtro de fecha
            const cumpleFecha = !fechaFiltro ||
                dayjs(r.res_fh_ingreso).format('YYYY-MM-DD') === fechaFiltro;

            return cumpleBusqueda && cumpleFecha;
        });
    }, [reservas, searchTerm, fechaFiltro, mostrarHistorial]);

    const totalPages = Math.ceil(reservasFiltradas.length / ITEMS_POR_PAGINA);
    const startIndex = (currentPage - 1) * ITEMS_POR_PAGINA;
    const endIndex = startIndex + ITEMS_POR_PAGINA;
    const reservasPaginadas = reservasFiltradas.slice(startIndex, endIndex);

    const formatearFecha = (fecha: string): string => {
        return dayjs(fecha).format('DD/MM/YYYY HH:mm');
    };

    const getEstadoBadge = (estado: string, enEstacionamiento?: boolean) => {
        // Si está confirmada pero en estacionamiento, mostrar estado especial
        if (estado === 'confirmada' && enEstacionamiento) {
            estado = 'en_estacionamiento';
        }

        // Si está activa, también está en estacionamiento
        if (estado === 'activa') {
            estado = 'en_estacionamiento';
        }

        const styles: Record<string, { dot: string; text: string; label: string }> = {
            'pendiente_pago': {
                dot: 'bg-yellow-500',
                text: 'text-yellow-600',
                label: 'Pendiente Pago'
            },
            'confirmada': {
                dot: 'bg-green-500',
                text: 'text-green-600',
                label: 'Confirmada'
            },
            'en_estacionamiento': {
                dot: 'bg-blue-500',
                text: 'text-blue-600',
                label: 'En Estacionamiento'
            },
            'completada': {
                dot: 'bg-purple-500',
                text: 'text-purple-600',
                label: 'Completada'
            },
            'expirada': {
                dot: 'bg-gray-500',
                text: 'text-gray-600',
                label: 'Expirada'
            },
            'cancelada': {
                dot: 'bg-red-500',
                text: 'text-red-600',
                label: 'Cancelada'
            },
            'no_show': {
                dot: 'bg-orange-500',
                text: 'text-orange-600',
                label: 'No Show'
            },
        };

        const { dot, text, label } = styles[estado] || {
            dot: 'bg-gray-500',
            text: 'text-gray-600',
            label: estado
        };

        return (
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${text}`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
                {label}
            </span>
        );
    };

    return (
        <DashboardLayout title="Reservas" description="Gestiona las reservas del estacionamiento">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Reservas del Estacionamiento</h1>
                        <p className="text-gray-600 dark:text-zinc-400">Gestiona todas las reservas del estacionamiento</p>
                    </div>
                </div>

                {/* Filtros */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            {/* Buscador con ícono */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar por código, patente o conductor..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-10"
                                />
                            </div>

                            {/* Filtro de fecha */}
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="fecha-filtro" className="text-sm font-medium whitespace-nowrap">
                                    Fecha:
                                </Label>
                                <Input
                                    id="fecha-filtro"
                                    type="date"
                                    value={fechaFiltro}
                                    onChange={(e) => {
                                        setFechaFiltro(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-48"
                                />
                            </div>

                            {/* Checkbox para mostrar historial */}
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="mostrar-historial"
                                    checked={mostrarHistorial}
                                    onCheckedChange={(checked) => {
                                        setMostrarHistorial(checked as boolean);
                                        setCurrentPage(1);
                                    }}
                                />
                                <Label
                                    htmlFor="mostrar-historial"
                                    className="text-sm font-medium cursor-pointer whitespace-nowrap"
                                >
                                    Incluir historial
                                </Label>
                            </div>

                            {/* Botón refrescar */}
                            <Button variant="outline" onClick={cargarReservas} disabled={loading}>
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                </Card>

                {/* Tabla */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-purple-100 to-purple-200 border-b-2 border-gray-400">
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Código</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Conductor</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vehículo</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Plaza</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Ingreso</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fin</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center">
                                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                                            </td>
                                        </tr>
                                    ) : reservasPaginadas.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-gray-500">
                                                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                                {searchTerm || fechaFiltro ? "No se encontraron reservas con esa búsqueda" : "No hay reservas"}
                                            </td>
                                        </tr>
                                    ) : (
                                        reservasPaginadas.map((reserva) => (
                                            <tr key={reserva.res_codigo} className="border-b border-gray-300 hover:bg-purple-50 transition-colors">
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-mono font-medium text-center">
                                                    {reserva.res_codigo}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {getEstadoBadge(reserva.res_estado, reserva.enEstacionamiento)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium text-center">
                                                    {reserva.conductor.usu_nom} {reserva.conductor.usu_ape}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {reserva.veh_patente}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {reserva.plaza.pla_zona} - {reserva.pla_numero}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {formatearFecha(reserva.res_fh_ingreso)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {formatearFecha(reserva.res_fh_fin)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-800 font-semibold text-center">
                                                    {formatCurrency(reserva.res_monto)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-gray-300">
                                <p className="text-sm text-gray-600 dark:text-zinc-400">
                                    Mostrando {startIndex + 1}-{Math.min(endIndex, reservasFiltradas.length)} de {reservasFiltradas.length} reservas
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Siguiente
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

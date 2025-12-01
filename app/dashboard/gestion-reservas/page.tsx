"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DetalleReservaDialog } from "@/components/reservas/detalle-reserva-dialog";
import { TurnoGuard } from "@/components/turno-guard";
import { toast } from "@/components/ui/use-toast";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createBrowserClient } from "@supabase/ssr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

dayjs.extend(utc);
dayjs.extend(timezone);

interface Reserva {
    res_codigo: string;
    res_fh_ingreso: string;
    res_fh_fin: string;
    pla_numero: number;
    pla_zona: string;
    veh_patente: string;
    conductor_nombre: string;
    conductor_apellido: string;
    res_estado: string;
    res_monto: number;
    vehiculo_marca: string;
    vehiculo_modelo: string;
    ocu_fh_entrada?: string;
    ocu_fh_salida?: string;
}

export default function GestionReservasPage() {
    const { estId } = useAuth();
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
    const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);
    const itemsPerPage = 10;
    const [detalleReservaDialog, setDetalleReservaDialog] = useState<string | null>(null);

    // Función para cargar reservas
    const cargarReservas = async () => {
        try {
            setLoading(true);
            const url = `/api/reservas/operador?est_id=${estId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.data?.reservas) {
                // Enriquecer reservas con información de ocupación para detectar si ingresaron
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const reservasEnriquecidas = await Promise.all(
                    data.data.reservas.map(async (res: any) => {
                        // Buscar si existe ocupación con res_codigo
                        const { data: ocupacion } = await supabase
                            .from('ocupacion')
                            .select('ocu_fh_entrada, ocu_fh_salida')
                            .eq('res_codigo', res.res_codigo)
                            .single();

                        return {
                            res_codigo: res.res_codigo,
                            res_fh_ingreso: res.res_fh_ingreso,
                            res_fh_fin: res.res_fh_fin,
                            pla_numero: res.pla_numero,
                            pla_zona: res.plaza?.pla_zona || 'N/A',
                            veh_patente: res.veh_patente,
                            conductor_nombre: res.conductor?.usu_nom || 'N/A',
                            conductor_apellido: res.conductor?.usu_ape || 'N/A',
                            res_estado: res.res_estado?.toLowerCase() || '',
                            res_monto: res.res_monto,
                            vehiculo_marca: res.vehiculo?.veh_marca || 'N/A',
                            vehiculo_modelo: res.vehiculo?.veh_modelo || 'N/A',
                            ocu_fh_entrada: ocupacion?.ocu_fh_entrada || undefined,
                            ocu_fh_salida: ocupacion?.ocu_fh_salida || undefined
                        };
                    })
                );

                setReservas(reservasEnriquecidas);
                // DEBUG: ver qué estados hay en las reservas
                const estados = [...new Set(reservasEnriquecidas.map(r => r.res_estado))];
                console.log('✅ Estados encontrados:', estados);
                console.log('📊 Total reservas:', reservasEnriquecidas.length);
                console.log('🔍 Reservas confirmadas:', reservasEnriquecidas.filter(r => r.res_estado === 'confirmada').length);
            } else {
                console.error('Error cargando reservas:', data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron cargar las reservas"
            });
        } finally {
            setLoading(false);
        }
    };

    // Cargar reservas cuando cambia estId
    useEffect(() => {
        if (estId) {
            cargarReservas();
        }
    }, [estId]);

    // Filtrar reservas por búsqueda, estado y rango de fechas
    const reservasFiltradas = useMemo(() => {
        return reservas.filter(reserva => {
            // Filtro de búsqueda
            const searchLower = searchTerm.toLowerCase();
            const cumpleBusqueda = !searchTerm || (
                reserva.res_codigo.toLowerCase().includes(searchLower) ||
                reserva.veh_patente.toLowerCase().includes(searchLower) ||
                reserva.conductor_nombre.toLowerCase().includes(searchLower) ||
                reserva.conductor_apellido.toLowerCase().includes(searchLower)
            );

            // Filtro de estado (case-insensitive)
            const cumpleEstado = filtroEstado === 'todos' || (reserva.res_estado?.toLowerCase() || '') === filtroEstado.toLowerCase();

            // Filtro de fecha por rango
            let cumpleFecha = true;
            if (fechaDesde) {
                const fromDate = dayjs(fechaDesde).startOf('day');
                const fechaIngreso = dayjs(reserva.res_fh_ingreso);
                cumpleFecha = cumpleFecha && (fechaIngreso.isAfter(fromDate) || fechaIngreso.isSame(fromDate, 'day'));
            }
            if (fechaHasta) {
                const toDate = dayjs(fechaHasta).endOf('day');
                const fechaIngreso = dayjs(reserva.res_fh_ingreso);
                cumpleFecha = cumpleFecha && (fechaIngreso.isBefore(toDate) || fechaIngreso.isSame(toDate, 'day'));
            }

            return cumpleBusqueda && cumpleEstado && cumpleFecha;
        });
    }, [reservas, searchTerm, filtroEstado, fechaDesde, fechaHasta]);

    // Ordenar: confirmadas primero (más recientes), luego otros estados (más recientes)
    const reservasOrdenadas = [...reservasFiltradas].sort((a, b) => {
        // Priorizar confirmadas (case-insensitive)
        const aEsConfirmada = a.res_estado?.toLowerCase() === 'confirmada';
        const bEsConfirmada = b.res_estado?.toLowerCase() === 'confirmada';

        if (aEsConfirmada && !bEsConfirmada) return -1;
        if (!aEsConfirmada && bEsConfirmada) return 1;

        // Si ambas son del mismo grupo, ordenar por fecha (más reciente primero)
        return new Date(b.res_fh_ingreso).getTime() - new Date(a.res_fh_ingreso).getTime();
    });

    // Paginación
    const totalPages = Math.ceil(reservasOrdenadas.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const reservasPaginadas = reservasOrdenadas.slice(startIndex, endIndex);

    const getEstadoBadge = (estado: string, reserva?: Reserva) => {
        // Si es confirmada y está estacionado, mostrar "En Estacionamiento"
        if (estado?.toLowerCase() === 'confirmada' && reserva?.ocu_fh_entrada && !reserva?.ocu_fh_salida) {
            return (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                    En Estacionamiento
                </span>
            );
        }

        const styles: Record<string, { dot: string; text: string; label: string }> = {
            'confirmada': { dot: 'bg-green-500', text: 'text-green-600', label: 'Confirmada' },
            'activa': { dot: 'bg-blue-500', text: 'text-blue-600', label: 'Activa' },
            'pendiente_pago': { dot: 'bg-yellow-500', text: 'text-yellow-600', label: 'Pendiente pago' },
            'no_show': { dot: 'bg-red-500', text: 'text-red-600', label: 'No Show' },
            'expirada': { dot: 'bg-gray-500', text: 'text-gray-600', label: 'Expirada' },
            'completada': { dot: 'bg-purple-500', text: 'text-purple-600', label: 'Completada' },
            'cancelada': { dot: 'bg-red-500', text: 'text-red-600', label: 'Cancelada' },
        };

        const { dot, text, label } = styles[estado] || {
            dot: 'bg-gray-400',
            text: 'text-gray-600',
            label: estado,
        };

        return (
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${text}`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
                {label}
            </span>
        );
    };

    const formatearHora = (fecha: string) => {
        return dayjs.tz(fecha, 'America/Argentina/Buenos_Aires').format('HH:mm');
    };

    const formatearFecha = (fecha: string) => {
        return dayjs.tz(fecha, 'America/Argentina/Buenos_Aires').format('DD/MM/YYYY');
    };

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="container mx-auto p-6 space-y-6">
                        <TurnoGuard showAlert={true} redirectButton={true}>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Gestión de Reservas</h1>
                                <p className="text-gray-600">Listado de todas las reservas con información de ingreso.</p>
                            </div>

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

                                        {/* Filtro de fecha desde */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {fechaDesde ? format(fechaDesde, "PPP", { locale: es }) : "Fecha desde"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={fechaDesde}
                                                    onSelect={(date) => {
                                                        setFechaDesde(date);
                                                        setCurrentPage(1);
                                                    }}
                                                    initialFocus
                                                    locale={es}
                                                />
                                            </PopoverContent>
                                        </Popover>

                                        {/* Filtro de fecha hasta */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {fechaHasta ? format(fechaHasta, "PPP", { locale: es }) : "Fecha hasta"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={fechaHasta}
                                                    onSelect={(date) => {
                                                        setFechaHasta(date);
                                                        setCurrentPage(1);
                                                    }}
                                                    initialFocus
                                                    locale={es}
                                                />
                                            </PopoverContent>
                                        </Popover>

                                        {/* Filtro de estado */}
                                        <Select value={filtroEstado} onValueChange={(value) => {
                                            setFiltroEstado(value);
                                            setCurrentPage(1);
                                        }}>
                                            <SelectTrigger className="w-48">
                                                <SelectValue placeholder="Filtrar por estado" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos los estados</SelectItem>
                                                <SelectItem value="confirmada">Confirmada</SelectItem>
                                                <SelectItem value="activa">Activa</SelectItem>
                                                <SelectItem value="pendiente_pago">Pendiente pago</SelectItem>
                                                <SelectItem value="no_show">No Show</SelectItem>
                                                <SelectItem value="expirada">Expirada</SelectItem>
                                                <SelectItem value="completada">Completada</SelectItem>
                                                <SelectItem value="cancelada">Cancelada</SelectItem>
                                            </SelectContent>
                                        </Select>

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
                                <CardContent>
                                    <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                                        <table className="w-full bg-white border-collapse">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Código</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Hora reservada</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Hora ingresada</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Plaza</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Conductor</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vehículo</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Monto</th>
                                                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr>
                                                        <td colSpan={9} className="py-12 text-center">
                                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                                                        </td>
                                                    </tr>
                                                ) : reservasPaginadas.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="py-12 text-center text-gray-500">
                                                            {searchTerm || fechaDesde || fechaHasta ? 'No se encontraron reservas con esa búsqueda.' : 'No hay reservas.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    reservasPaginadas.map((reserva) => (
                                                        <tr key={reserva.res_codigo} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-mono font-medium text-center">{reserva.res_codigo}</td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                <div className="text-sm">
                                                                    {formatearFecha(reserva.res_fh_ingreso)}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {formatearHora(reserva.res_fh_ingreso)}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                {reserva.ocu_fh_entrada ? (
                                                                    <div>
                                                                        <div className="text-sm font-medium text-green-600">
                                                                            {formatearFecha(reserva.ocu_fh_entrada)}
                                                                        </div>
                                                                        <div className="text-xs text-green-500">
                                                                            {formatearHora(reserva.ocu_fh_entrada)}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-gray-500">
                                                                        No ingresó
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                <div className="text-sm">
                                                                    {reserva.pla_zona}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Plaza {reserva.pla_numero}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium text-center">
                                                                {reserva.conductor_nombre} {reserva.conductor_apellido}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                <div className="text-sm">
                                                                    {reserva.vehiculo_marca} {reserva.vehiculo_modelo}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {reserva.veh_patente}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{getEstadoBadge(reserva.res_estado, reserva)}</td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-semibold text-center">${reserva.res_monto?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="py-4 px-4 text-sm text-gray-800 text-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setDetalleReservaDialog(reserva.res_codigo)}
                                                                >
                                                                    Detalles
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Paginación */}
                                    {!loading && reservasPaginadas.length > 0 && (
                                        <div className="flex items-center justify-between mt-4">
                                            <p className="text-sm text-gray-600">
                                                Mostrando {startIndex + 1}-{Math.min(endIndex, reservasOrdenadas.length)} de {reservasOrdenadas.length}
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

                            <DetalleReservaDialog
                                open={!!detalleReservaDialog}
                                onOpenChange={(v) => !v && setDetalleReservaDialog(null)}
                                res_codigo={detalleReservaDialog}
                            />
                        </TurnoGuard>
                    </div>
                </main>
            </div>
        </div>
    );
}

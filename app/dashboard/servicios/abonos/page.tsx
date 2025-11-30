"use client";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useState, useEffect } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExtenderAbonoDialog } from "@/components/abonos/extender-abono-dialog";
import { AbonoDetailDialog } from "@/components/abonos/abono-detail-dialog";
import { ManageAbonoVehiclesDialog } from "@/components/abonos/manage-abono-vehicles-dialog";

interface Abono {
    abo_nro: number;
    conductor_nombre: string;
    conductor_apellido: string;
    conductor_dni: string;
    zona: string;
    pla_numero: number;
    tipo_abono: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias_restantes: number;
    estado: 'Activo' | 'Por vencer' | 'Vencido';
}

export default function ServiciosAbonosPage() {
    const { estId } = useAuth();
    const [abonos, setAbonos] = useState<Abono[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fechaDesde, setFechaDesde] = useState<Date | undefined>();
    const [fechaHasta, setFechaHasta] = useState<Date | undefined>();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [abonoDialog, setAbonoDialog] = useState<any | null>(null);
    const [abonoDetailDialog, setAbonoDetailDialog] = useState<any | null>(null);
    const [vehiculosDialog, setVehiculosDialog] = useState<number | null>(null);

    // Función para cargar abonos
    const cargarAbonos = async () => {
        try {
            setLoading(true);
            console.log('🔍 Cargando abonos para estId:', estId);
            const url = `/api/abonos/list?est_id=${estId}&incluir_vencidos=true`;
            const response = await fetch(url);
            const data = await response.json();

            console.log('📊 Respuesta de la API:', data);

            if (data.success) {
                console.log('✅ Abonos recibidos:', data.abonos?.length || 0);
                setAbonos(data.abonos);
            } else {
                console.error('❌ Error cargando abonos:', data.error);
            }
        } catch (error) {
            console.error('❌ Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Cargar abonos cuando cambia el estId
    useEffect(() => {
        if (estId) {
            cargarAbonos();
        }
    }, [estId]);

    // Filtrar abonos por búsqueda y fecha
    const abonosFiltrados = abonos.filter(abono => {
        const searchLower = searchTerm.toLowerCase();
        const cumpleSearchTerm =
            abono.conductor_nombre.toLowerCase().includes(searchLower) ||
            abono.conductor_apellido.toLowerCase().includes(searchLower) ||
            abono.conductor_dni.includes(searchTerm);

        let cumpleFecha = true;
        if (fechaDesde) {
            const fromDate = dayjs(fechaDesde).startOf('day');
            const fechaInicio = dayjs(abono.fecha_inicio);
            cumpleFecha = cumpleFecha && (fechaInicio.isAfter(fromDate) || fechaInicio.isSame(fromDate, 'day'));
        }
        if (fechaHasta) {
            const toDate = dayjs(fechaHasta).endOf('day');
            const fechaInicio = dayjs(abono.fecha_inicio);
            cumpleFecha = cumpleFecha && (fechaInicio.isBefore(toDate) || fechaInicio.isSame(toDate, 'day'));
        }

        return cumpleSearchTerm && cumpleFecha;
    });

    // Ordenar: SIEMPRE activos primero (por proximidad a vencer), luego vencidos
    const abonosOrdenados = [...abonosFiltrados].sort((a, b) => {
        // Primero: separar activos de vencidos
        const aVencido = a.estado === 'Vencido';
        const bVencido = b.estado === 'Vencido';

        if (aVencido && !bVencido) return 1;  // a vencido va después
        if (!aVencido && bVencido) return -1; // b vencido va después

        // Dentro de cada grupo, ordenar por días restantes (proximidad a vencer)
        return a.dias_restantes - b.dias_restantes;
    });

    // Paginación
    const totalPages = Math.ceil(abonosOrdenados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const abonosPaginados = abonosOrdenados.slice(startIndex, endIndex);

    const getEstadoBadge = (estado: string) => {
        const styles: Record<string, { dot: string; text: string; label: string }> = {
            'Activo': { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Activo' },
            'Por vencer': { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Por vencer' },
            'Vencido': { dot: 'bg-red-500', text: 'text-red-600', label: 'Vencido' },
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

    const getTipoAbono = (tipo: string) => {
        switch (tipo) {
            case 'semanal':
                return 'Semanal';
            case 'mensual':
                return 'Mensual';
            case 'trimestral':
                return 'Trimestral';
            default:
                return tipo;
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Abonos del Estacionamiento</h1>
                    <p className="text-gray-600 dark:text-zinc-400">Gestiona todos los abonos activos del estacionamiento</p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                <div className="flex-1 w-full sm:w-auto">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Buscar por DNI, nombre, apellido..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                {/* Filtro de fecha desde */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="justify-start text-left font-normal"
                                        >
                                            <CalendarComponent className="mr-2 h-4 w-4" />
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
                                            <CalendarComponent className="mr-2 h-4 w-4" />
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

                                <Button
                                    variant="outline"
                                    onClick={cargarAbonos}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                <span className="ml-2 text-gray-600 dark:text-zinc-400">Cargando abonos...</span>
                            </div>
                        ) : abonosPaginados.length === 0 ? (
                            <Alert>
                                <AlertDescription>
                                    {searchTerm
                                        ? 'No se encontraron abonos con ese criterio de búsqueda.'
                                        : mostrarVencidos
                                            ? 'No hay abonos en este estacionamiento.'
                                            : 'No hay abonos activos en este estacionamiento.'}
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                                    <table className="w-full bg-white border-collapse">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Conductor</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">DNI</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Zona</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Plaza</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Tipo</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Inicio</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vence</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Restan</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Aviso</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {abonosPaginados.map((abono) => (
                                                <tr key={abono.abo_nro} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium text-center">
                                                        {abono.conductor_nombre} {abono.conductor_apellido}
                                                    </td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{abono.conductor_dni}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{abono.zona}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{abono.pla_numero}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{getTipoAbono(abono.tipo_abono)}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{dayjs.utc(abono.fecha_inicio).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{dayjs.utc(abono.fecha_fin).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{abono.dias_restantes} días</td>
                                                    <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">{getEstadoBadge(abono.estado)}</td>
                                                    <td className="py-4 px-4 text-center">
                                                        <div className="flex gap-2 justify-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setAbonoDetailDialog({ abo_nro: abono.abo_nro })}
                                                            >
                                                                Detalles
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="bg-blue-600 hover:bg-blue-700"
                                                                onClick={() => setAbonoDialog({
                                                                    abo_nro: abono.abo_nro,
                                                                    titular: `${abono.conductor_nombre} ${abono.conductor_apellido}`,
                                                                    tipoActual: getTipoAbono(abono.tipo_abono),
                                                                    fechaFinActual: abono.fecha_fin,
                                                                    zona: abono.zona,
                                                                    codigo: `P${abono.pla_numero}`,
                                                                    est_id: (typeof estId === 'number' ? estId : Number(estId)),
                                                                    pla_numero: abono.pla_numero,
                                                                    plantilla_id: 0
                                                                })}
                                                            >
                                                                Extender
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setVehiculosDialog(abono.abo_nro)}
                                                            >
                                                                Vehículos
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                                        Mostrando {startIndex + 1}-{Math.min(endIndex, abonosOrdenados.length)} de {abonosOrdenados.length}
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
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Dialogs */}
                <ExtenderAbonoDialog
                    open={!!abonoDialog}
                    onOpenChange={(v) => {
                        if (!v) {
                            setAbonoDialog(null)
                            // Recargar la lista de abonos después de cerrar el modal
                            cargarAbonos()
                        }
                    }}
                    abono={abonoDialog}
                />
                <AbonoDetailDialog
                    open={!!abonoDetailDialog}
                    onOpenChange={(v) => !v && setAbonoDetailDialog(null)}
                    abo_nro={abonoDetailDialog?.abo_nro}
                />
                <ManageAbonoVehiclesDialog
                    open={vehiculosDialog !== null}
                    onOpenChange={(v) => !v && setVehiculosDialog(null)}
                    abo_nro={vehiculosDialog}
                />
            </div>
        </DashboardLayout>
    );
}

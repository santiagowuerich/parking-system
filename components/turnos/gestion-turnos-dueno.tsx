"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
    Loader2,
    Calendar,
    Clock,
    DollarSign,
    Users,
    Eye,
    Search,
    RefreshCw,
    FileText
} from "lucide-react";
import dayjs from "dayjs";
import ResumenTurnoModal from "./resumen-turno-modal";

interface Turno {
    tur_id: number;
    play_id: number;
    est_id: number;
    tur_fecha: string;
    tur_fecha_salida?: string;
    tur_hora_entrada: string;
    tur_hora_salida: string | null;
    tur_estado: string;
    caja_inicio: number;
    caja_final: number | null;
    tur_observaciones_entrada?: string;
    tur_observaciones_salida?: string;
    usuario: {
        usu_id: number;
        nombre: string;
        apellido: string;
        email: string;
    };
}

interface Empleado {
    usu_id: number;
    nombre: string;
    apellido: string;
    email: string;
}

interface GestionTurnosDuenoProps {
    estId: number | null;
}

export default function GestionTurnosDueno({ estId }: GestionTurnosDuenoProps) {
    const [loading, setLoading] = useState(true);
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [filtroEmpleado, setFiltroEmpleado] = useState<string>("todos");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [turnoParaResumen, setTurnoParaResumen] = useState<number | null>(null);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (estId) {
            // Establecer fechas por defecto (últimos 30 días)
            const hoy = dayjs();
            setFechaHasta(hoy.format('YYYY-MM-DD'));
            setFechaDesde(hoy.subtract(30, 'day').format('YYYY-MM-DD'));
            loadData();
        }
    }, [estId]);

    useEffect(() => {
        if (estId && fechaDesde && fechaHasta) {
            loadTurnos();
        }
    }, [estId, fechaDesde, fechaHasta, filtroEmpleado]);

    const loadData = async () => {
        await Promise.all([loadEmpleados(), loadTurnos()]);
    };

    const loadEmpleados = async () => {
        try {
            const response = await fetch('/api/empleados');
            if (response.ok) {
                const data = await response.json();
                // Extraer empleados únicos
                const empleadosUnicos = data.empleados.reduce((acc: Empleado[], emp: any) => {
                    if (!acc.find(e => e.usu_id === emp.usu_id)) {
                        acc.push({
                            usu_id: emp.usu_id,
                            nombre: emp.nombre,
                            apellido: emp.apellido,
                            email: emp.email
                        });
                    }
                    return acc;
                }, []);
                setEmpleados(empleadosUnicos);
            }
        } catch (error) {
            console.error('Error loading empleados:', error);
        }
    };

    const loadTurnos = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams({
                est_id: estId!.toString(),
                fecha_desde: fechaDesde,
                fecha_hasta: fechaHasta
            });

            if (filtroEmpleado !== "todos") {
                params.append('play_id', filtroEmpleado);
            }

            const response = await fetch(`/api/turnos/gestion?${params}`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Turnos cargados exitosamente:', data.turnos?.length || 0);
                setTurnos(data.turnos || []);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('❌ Error HTTP:', response.status, errorData);
                throw new Error(errorData.error || 'Error al cargar turnos');
            }
        } catch (error: any) {
            console.error('❌ Error loading turnos:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al cargar los turnos"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerResumen = (turId: number) => {
        setTurnoParaResumen(turId);
        setShowResumenModal(true);
    };

    const calcularDuracion = (horaEntrada: string, horaSalida: string | null, fechaTurno: string, fechaSalida?: string) => {
        try {
            const entrada = dayjs(`${fechaTurno} ${horaEntrada}`);
            const salida = horaSalida
                ? dayjs(`${fechaSalida || fechaTurno} ${horaSalida}`)
                : dayjs();

            const duracion = salida.diff(entrada, 'minute');
            const horas = Math.floor(duracion / 60);
            const minutos = duracion % 60;

            return `${horas}h ${minutos}m`;
        } catch (error) {
            return '0h 0m';
        }
    };

    // Filtrar turnos por término de búsqueda
    const turnosFiltrados = turnos.filter(turno => {
        const matchesSearch = searchTerm === '' ||
            `${turno.usuario.nombre} ${turno.usuario.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            turno.usuario.email.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    // Calcular paginación
    const totalPages = Math.ceil(turnosFiltrados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const turnosPaginados = turnosFiltrados.slice(startIndex, endIndex);

    // Resetear a página 1 cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fechaDesde, fechaHasta]);

    if (loading && turnos.length === 0) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Cargando turnos...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Turnos</h1>
                <p className="text-gray-600 mt-2">
                    Visualiza y analiza los turnos de tus empleados
                </p>
            </div>

            {/* Tabla de Turnos */}
            <Card>
                <CardHeader>
                    {/* Filtros compactos en header */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-5">
                            <Input
                                id="search"
                                placeholder="Buscar empleado por nombre, apellido o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <Input
                                id="fecha-desde"
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <Input
                                id="fecha-hasta"
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Button
                                onClick={loadTurnos}
                                variant="outline"
                                size="icon"
                                className="w-full"
                                disabled={loading}
                                title="Actualizar"
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
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : turnosFiltrados.length > 0 ? (
                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Empleado</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha y Hora Entrada</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha y Hora Salida</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Duración</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Caja Inicial</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Caja Final</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {turnosPaginados.map((turno) => (
                                        <tr key={turno.tur_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300">
                                                <div className="text-center">
                                                    <p className="font-medium">
                                                        {turno.usuario.nombre} {turno.usuario.apellido}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{turno.usuario.email}</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-800 text-center border-r border-gray-300">
                                                <div className="font-medium">{dayjs(turno.tur_fecha).format('DD/MM/YYYY')}</div>
                                                <div className="text-gray-600">{turno.tur_hora_entrada}</div>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-800 text-center border-r border-gray-300">
                                                {turno.tur_hora_salida ? (
                                                    <>
                                                        <div className="font-medium">
                                                            {dayjs(turno.tur_fecha_salida || turno.tur_fecha).format('DD/MM/YYYY')}
                                                        </div>
                                                        <div className="text-gray-600">{turno.tur_hora_salida}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-800 text-center border-r border-gray-300">
                                                {calcularDuracion(
                                                    turno.tur_hora_entrada,
                                                    turno.tur_hora_salida,
                                                    turno.tur_fecha,
                                                    turno.tur_fecha_salida
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-800 text-center border-r border-gray-300">
                                                ${turno.caja_inicio.toLocaleString('es-AR')}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-800 text-center border-r border-gray-300">
                                                {turno.caja_final !== null
                                                    ? `$${turno.caja_final.toLocaleString('es-AR')}`
                                                    : '-'
                                                }
                                            </td>
                                            <td className="py-4 px-4 text-center border-r border-gray-300">
                                                <span className={`inline-flex items-center gap-2 text-sm font-medium ${
                                                    turno.tur_estado === 'activo' ? 'text-emerald-600' : 'text-gray-600'
                                                }`}>
                                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                                                        turno.tur_estado === 'activo' ? 'bg-emerald-500' : 'bg-gray-500'
                                                    }`} />
                                                    {turno.tur_estado === 'activo' ? 'Activo' : 'Finalizado'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {turno.tur_estado === 'finalizado' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleVerResumen(turno.tur_id)}
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        Ver Detalle
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-4 border-t-2 border-gray-400 bg-gray-50">
                                    <div className="text-sm text-gray-700">
                                        Mostrando {startIndex + 1} a {Math.min(endIndex, turnosFiltrados.length)} de {turnosFiltrados.length} turnos
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => {
                                                    // Mostrar siempre primera, última, actual y vecinas
                                                    return page === 1 ||
                                                        page === totalPages ||
                                                        Math.abs(page - currentPage) <= 1;
                                                })
                                                .map((page, index, array) => (
                                                    <div key={page} className="flex items-center gap-1">
                                                        {index > 0 && array[index - 1] !== page - 1 && (
                                                            <span className="px-2 text-gray-500">...</span>
                                                        )}
                                                        <Button
                                                            variant={currentPage === page ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setCurrentPage(page)}
                                                            className="min-w-[2.5rem]"
                                                        >
                                                            {page}
                                                        </Button>
                                                    </div>
                                                ))}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                No se encontraron turnos
                            </h3>
                            <p className="text-gray-600">
                                No hay turnos registrados con los filtros seleccionados.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Resumen */}
            <ResumenTurnoModal
                isOpen={showResumenModal}
                onClose={() => setShowResumenModal(false)}
                turnoId={turnoParaResumen}
            />
        </div>
    );
}

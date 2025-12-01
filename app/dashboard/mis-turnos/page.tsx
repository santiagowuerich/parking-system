"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Clock, Calendar, DollarSign, AlertCircle } from "lucide-react";
import dayjs from "dayjs";
import IniciarTurnoModal from "@/components/turnos/iniciar-turno-modal";
import FinalizarTurnoModal from "@/components/turnos/finalizar-turno-modal";
import ResumenTurnoModal from "@/components/turnos/resumen-turno-modal";
import MovimientosTurnoModal from "@/components/turnos/movimientos-turno-modal";

interface TurnoActivo {
    tur_id: number;
    tur_fecha: string;
    tur_fecha_salida?: string;
    tur_hora_entrada: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    caja_inicio: number;
    caja_final?: number;
}

interface HistorialTurno {
    tur_id: number;
    tur_fecha: string;
    tur_fecha_salida?: string;
    tur_hora_entrada: string;
    tur_hora_salida?: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    tur_observaciones_salida?: string;
    caja_inicio: number;
    caja_final?: number;
    efectivo_cobrado?: number;
}

export default function MisTurnosPage() {
    const { estId, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
    const [historial, setHistorial] = useState<HistorialTurno[]>([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [showIniciarModal, setShowIniciarModal] = useState(false);
    const [showFinalizarModal, setShowFinalizarModal] = useState(false);
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [turnoParaResumen, setTurnoParaResumen] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [paginaActual, setPaginaActual] = useState(1);
    const [showMovimientos, setShowMovimientos] = useState(false);
    const [turnoSeleccionado, setTurnoSeleccionado] = useState<number | null>(null);
    const itemsPorPagina = 10;

    // Actualizar la hora actual cada minuto para que la duración sea dinámica
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Actualizar cada minuto

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (estId && user) {
            loadTurnoEstado();
        }
    }, [estId]);

    const loadTurnoEstado = async () => {
        try {
            setLoading(true);

            // Obtener play_id del usuario
            const response = await fetch(`/api/auth/get-employee-parking?est_id=${estId}`);
            if (!response.ok) {
                throw new Error('Error al obtener datos del empleado');
            }

            const empleadoData = await response.json();
            const playId = empleadoData.usuario_id;

            // Obtener estado del turno
            const turnoResponse = await fetch(`/api/turnos/estado?play_id=${playId}&est_id=${estId}`);
            if (turnoResponse.ok) {
                const data = await turnoResponse.json();
                setTurnoActivo(data.turno_activo);
            }

            // Cargar historial completo
            await loadHistorial(playId);
        } catch (error) {
            console.error('Error loading turno estado:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar el estado del turno"
            });
        } finally {
            setLoading(false);
        }
    };

    const loadHistorial = async (playId: number) => {
        try {
            setLoadingHistorial(true);

            const hoy = dayjs();
            const params = new URLSearchParams({
                usu_id: playId.toString(),
                est_id: estId!.toString(),
                fecha_desde: hoy.subtract(50, 'year').format('YYYY-MM-DD'),
                fecha_hasta: hoy.format('YYYY-MM-DD')
            });

            const response = await fetch(`/api/turnos/historial?${params}`);
            if (response.ok) {
                const data = await response.json();
                setHistorial(data.historial || []);
                setPaginaActual(1);
            }
        } catch (error) {
            console.error('Error loading historial:', error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    const handleIniciarTurno = () => {
        setShowIniciarModal(true);
    };

    const handleFinalizarTurno = () => {
        setShowFinalizarModal(true);
    };

    const handleTurnoIniciado = () => {
        setShowIniciarModal(false);
        loadTurnoEstado();
        toast({
            title: "Turno iniciado",
            description: "Tu turno ha comenzado correctamente"
        });
    };

    const handleTurnoFinalizado = (turId: number) => {
        setShowFinalizarModal(false);
        setTurnoParaResumen(turId);
        setShowResumenModal(true);
    };

    const handleVerMovimientos = (turId: number) => {
        setTurnoSeleccionado(turId);
        setShowMovimientos(true);
    };

    const calcularDuracion = (fechaEntrada: string, horaEntrada: string, fechaSalida?: string, horaSalida?: string) => {
        try {
            const entrada = dayjs(`${fechaEntrada} ${horaEntrada}`);

            if (!entrada.isValid()) {
                return '0h 0m';
            }

            let salida;
            if (horaSalida && fechaSalida) {
                salida = dayjs(`${fechaSalida} ${horaSalida}`);
            } else {
                // Si no hay hora de salida, calcular hasta ahora
                salida = dayjs();
            }

            if (!salida.isValid()) {
                return '0h 0m';
            }

            const duracionMinutos = salida.diff(entrada, 'minute');
            const duracionPositiva = Math.max(0, duracionMinutos);
            const horas = Math.floor(duracionPositiva / 60);
            const minutos = duracionPositiva % 60;

            return `${horas}h ${minutos}m`;
        } catch (error) {
            console.error('Error calculando duración:', error);
            return '0h 0m';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    };

    const calcularDiferenciaCaja = (fondoInicial: number, fondoFinal?: number, efectivoCobrado?: number) => {
        if (!fondoFinal) return null;
        const cajaEsperada = fondoInicial + (efectivoCobrado || 0);
        return fondoFinal - cajaEsperada;
    };

    // Lógica de paginación
    const totalPaginas = Math.ceil(historial.length / itemsPorPagina);
    const indiceInicio = (paginaActual - 1) * itemsPorPagina;
    const indiceFin = indiceInicio + itemsPorPagina;
    const historialPaginado = historial.slice(indiceInicio, indiceFin);

    const irAPagina = (numeroPagina: number) => {
        setPaginaActual(Math.max(1, Math.min(numeroPagina, totalPaginas)));
    };

    if (loading) {
        return (
            <RouteGuard allowedRoles={['playero']} redirectTo="/dashboard">
                <DashboardLayout>
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Cargando mis turnos...</p>
                        </div>
                    </div>
                </DashboardLayout>
            </RouteGuard>
        );
    }

    return (
        <RouteGuard allowedRoles={['playero']} redirectTo="/dashboard">
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Mis Turnos</h1>
                        <p className="text-gray-600 mt-2">
                            Registra tus horarios de entrada y salida de trabajo
                        </p>
                    </div>

                    {/* Alert destacado si no hay turno activo */}
                    {!turnoActivo && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-5 w-5" />
                            <AlertTitle className="text-lg font-semibold">No tienes un turno activo</AlertTitle>
                            <AlertDescription className="mt-2">
                                <p>No podrás registrar ingresos, egresos ni crear abonos hasta que inicies tu turno.</p>
                                <p className="mt-1 text-sm">
                                    Para comenzar a trabajar, haz clic en <strong>"Iniciar Turno"</strong> abajo.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-6">
                        {/* Estado Actual del Turno */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Estado Actual del Turno
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {turnoActivo ? (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-semibold">Turno Activo</h3>
                                            <p className="text-sm text-gray-600">
                                                Iniciado el {dayjs(turnoActivo.tur_fecha).format('DD/MM/YYYY')} a las {turnoActivo.tur_hora_entrada}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock className="h-4 w-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-700">Tiempo en turno</span>
                                                </div>
                                                <p className="text-xl font-bold text-gray-900">
                                                    {calcularDuracion(turnoActivo.tur_hora_entrada, turnoActivo.tur_fecha)}
                                                </p>
                                            </div>

                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <DollarSign className="h-4 w-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-700">Caja Inicial</span>
                                                </div>
                                                <p className="text-xl font-bold text-gray-900">
                                                    ${turnoActivo.caja_inicio?.toLocaleString('es-AR') || '0'}
                                                </p>
                                            </div>
                                        </div>

                                        {turnoActivo.tur_observaciones_entrada && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <h4 className="text-sm font-medium text-blue-800 mb-1">Observaciones de Entrada</h4>
                                                <p className="text-sm text-blue-700">{turnoActivo.tur_observaciones_entrada}</p>
                                            </div>
                                        )}

                                        <div className="flex justify-end">
                                            <Button
                                                onClick={handleFinalizarTurno}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                Finalizar Turno
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            No hay turno activo
                                        </h3>
                                        <p className="text-gray-600 mb-6">
                                            Inicia tu turno para comenzar a trabajar
                                        </p>
                                        <Button onClick={handleIniciarTurno} size="lg">
                                            Iniciar Turno
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Historial de Turnos */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Historial de Turnos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingHistorial ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                ) : historial.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                                            <table className="w-full bg-white border-collapse">
                                                <thead>
                                                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha Inicio</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Hora Inicio</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha Fin</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Hora Fin</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Duración</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Caja Inicial</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Caja Final</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Diferencia</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {historialPaginado.map((turno) => {
                                                    const diferencia = calcularDiferenciaCaja(
                                                        turno.caja_inicio || 0,
                                                        turno.caja_final,
                                                        turno.efectivo_cobrado
                                                    );
                                                    const duracion = calcularDuracion(
                                                        turno.tur_fecha,
                                                        turno.tur_hora_entrada,
                                                        turno.tur_fecha_salida,
                                                        turno.tur_hora_salida
                                                    );

                                                    return (
                                                        <tr key={turno.tur_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                {dayjs(turno.tur_fecha).format('DD/MM/YYYY')}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {turno.tur_hora_entrada}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {turno.tur_fecha_salida
                                                                    ? dayjs(turno.tur_fecha_salida).format('DD/MM/YYYY')
                                                                    : '-'
                                                                }
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {turno.tur_hora_salida || '-'}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {duracion}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {formatCurrency(turno.caja_inicio || 0)}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                                {turno.caja_final
                                                                    ? formatCurrency(turno.caja_final)
                                                                    : '-'
                                                                }
                                                            </td>
                                                            <td className="py-4 px-4 text-sm border-r border-gray-300 text-center">
                                                                {diferencia !== null ? (
                                                                    <span className={`font-medium ${diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {diferencia >= 0 ? '+' : ''}{formatCurrency(diferencia)}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-center border-r border-gray-300">
                                                                <span className={`inline-flex items-center gap-2 text-sm font-medium ${
                                                                    turno.tur_estado === 'activo'
                                                                        ? 'text-green-600'
                                                                        : 'text-gray-600'
                                                                }`}>
                                                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                                                                        turno.tur_estado === 'activo'
                                                                            ? 'bg-green-500'
                                                                            : 'bg-gray-400'
                                                                    }`} />
                                                                    {turno.tur_estado === 'activo' ? 'Activo' : 'Finalizado'}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4 text-sm text-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleVerMovimientos(turno.tur_id)}
                                                                >
                                                                    Ver Movimientos
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                            {/* Controles de paginación */}
                                            <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-300">
                                                <div className="text-sm text-gray-600">
                                                    Mostrando {indiceInicio + 1} - {Math.min(indiceFin, historial.length)} de {historial.length} turnos
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => irAPagina(paginaActual - 1)}
                                                        disabled={paginaActual === 1}
                                                    >
                                                        Anterior
                                                    </Button>
                                                    <div className="flex items-center gap-2">
                                                        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => (
                                                            <Button
                                                                key={pagina}
                                                                variant={paginaActual === pagina ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => irAPagina(pagina)}
                                                                className="min-w-[2.5rem]"
                                                            >
                                                                {pagina}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => irAPagina(paginaActual + 1)}
                                                        disabled={paginaActual === totalPaginas}
                                                    >
                                                        Siguiente
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            No hay turnos registrados
                                        </h3>
                                        <p className="text-gray-600">
                                            No se encontraron turnos para este perfil.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Modales */}
                    <IniciarTurnoModal
                        isOpen={showIniciarModal}
                        onClose={() => setShowIniciarModal(false)}
                        onSuccess={handleTurnoIniciado}
                        estId={estId}
                    />

                    <FinalizarTurnoModal
                        isOpen={showFinalizarModal}
                        onClose={() => setShowFinalizarModal(false)}
                        onSuccess={handleTurnoFinalizado}
                        turnoActivo={turnoActivo}
                    />

                    <ResumenTurnoModal
                        isOpen={showResumenModal}
                        onClose={() => {
                            setShowResumenModal(false);
                            loadTurnoEstado();
                            toast({
                                title: "Turno finalizado",
                                description: "Tu turno ha sido cerrado correctamente"
                            });
                        }}
                        turnoId={turnoParaResumen}
                    />

                    <MovimientosTurnoModal
                        isOpen={showMovimientos}
                        onClose={() => setShowMovimientos(false)}
                        turnoId={turnoSeleccionado}
                    />
                </div>
            </DashboardLayout>
        </RouteGuard>
    );
}

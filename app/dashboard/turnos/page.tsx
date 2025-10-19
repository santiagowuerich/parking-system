"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Clock, Calendar, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import dayjs from "dayjs";
import IniciarTurnoModal from "@/components/turnos/iniciar-turno-modal";
import FinalizarTurnoModal from "@/components/turnos/finalizar-turno-modal";
import HistorialTurnos from "@/components/turnos/historial-turnos";

interface TurnoActivo {
    tur_id: number;
    tur_fecha: string;
    tur_hora_entrada: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    caja_inicio: number;
    caja_final?: number;
}

interface HistorialTurno {
    tur_id: number;
    tur_fecha: string;
    tur_hora_entrada: string;
    tur_hora_salida?: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    tur_observaciones_salida?: string;
    caja_inicio: number;
    caja_final?: number;
}

export default function TurnosPage() {
    const { estId, user } = useAuth();
    const { isEmployee, loading: roleLoading } = useUserRole();
    const [loading, setLoading] = useState(true);
    const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
    const [historialHoy, setHistorialHoy] = useState<HistorialTurno[]>([]);
    const [showIniciarModal, setShowIniciarModal] = useState(false);
    const [showFinalizarModal, setShowFinalizarModal] = useState(false);
    const [showHistorial, setShowHistorial] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Actualizar la hora actual cada minuto para que la duración sea dinámica
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Actualizar cada minuto

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (estId && user && isEmployee && !roleLoading) {
            console.log('🔄 Cargando estado de turno para empleado...');
            loadTurnoEstado();
        } else if (user && !isEmployee && !roleLoading) {
            console.log('🚗 Usuario es conductor, no cargando turnos');
        }
    }, [estId, user, isEmployee, roleLoading]);

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
                setHistorialHoy(data.historial_hoy || []);
            }
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

    const handleTurnoFinalizado = () => {
        setShowFinalizarModal(false);
        loadTurnoEstado();
        toast({
            title: "Turno finalizado",
            description: "Tu turno ha sido cerrado correctamente"
        });
    };

    const calcularDuracion = (horaEntrada: string) => {
        try {
            // Intentar diferentes formatos para la hora de entrada
            let entrada;

            // Si viene solo la hora (HH:mm:ss), combinar con fecha actual
            if (horaEntrada && horaEntrada.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                const hoy = dayjs().format('YYYY-MM-DD');
                entrada = dayjs(`${hoy} ${horaEntrada}`);
            } else {
                // Si viene con fecha completa o timestamp
                entrada = dayjs(horaEntrada);
            }

            // Verificar que la entrada sea válida
            if (!entrada.isValid()) {
                console.error('Hora de entrada inválida:', horaEntrada);
                return '0h 0m';
            }

            const ahora = dayjs();
            const duracion = ahora.diff(entrada, 'minute');

            // Asegurar que la duración sea positiva
            const duracionPositiva = Math.max(0, duracion);
            const horas = Math.floor(duracionPositiva / 60);
            const minutos = duracionPositiva % 60;

            return `${horas}h ${minutos}m`;
        } catch (error) {
            console.error('Error calculando duración:', error, 'Hora entrada:', horaEntrada);
            return '0h 0m';
        }
    };


    if (loading || roleLoading) {
        return (
            <RouteGuard allowedRoles={['playero']} redirectTo="/dashboard/operador-simple">
                <DashboardLayout>
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Cargando gestión de turnos...</p>
                        </div>
                    </div>
                </DashboardLayout>
            </RouteGuard>
        );
    }

    if (!isEmployee) {
        return (
            <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
                <DashboardLayout>
                    <div className="p-6 max-w-7xl mx-auto">
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Acceso Restringido
                            </h2>
                            <p className="text-gray-600">
                                Solo los empleados pueden acceder a la gestión de turnos.
                            </p>
                        </div>
                    </div>
                </DashboardLayout>
            </RouteGuard>
        );
    }

    return (
        <RouteGuard allowedRoles={['playero']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Gestión de Turnos</h1>
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
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold">Turno Activo</h3>
                                                <p className="text-sm text-gray-600">
                                                    Iniciado el {dayjs(turnoActivo.tur_fecha).format('DD/MM/YYYY')} a las {turnoActivo.tur_hora_entrada}
                                                </p>
                                            </div>
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Activo
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock className="h-4 w-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-700">Duración Trabajada</span>
                                                </div>
                                                <p className="text-xl font-bold text-gray-900">
                                                    {calcularDuracion(turnoActivo.tur_hora_entrada)}
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

                        {/* Historial de Hoy */}
                        {historialHoy.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Historial de Hoy
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {historialHoy.map((turno) => (
                                            <div key={turno.tur_id} className="flex items-center justify-between p-4 border rounded-lg">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-3 h-3 rounded-full ${turno.tur_estado === 'activo' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                    <div>
                                                        <p className="font-medium">
                                                            {turno.tur_hora_entrada} - {turno.tur_hora_salida || 'En curso'}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            Caja: ${turno.caja_inicio?.toLocaleString('es-AR') || '0'}
                                                            {turno.caja_final && ` → $${turno.caja_final?.toLocaleString('es-AR')}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant={turno.tur_estado === 'activo' ? 'default' : 'secondary'}>
                                                    {turno.tur_estado === 'activo' ? 'Activo' : 'Finalizado'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 text-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowHistorial(true)}
                                        >
                                            Ver Historial Completo
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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

                    <HistorialTurnos
                        isOpen={showHistorial}
                        onClose={() => setShowHistorial(false)}
                        estId={estId}
                    />
                </div>
            </DashboardLayout>
        </RouteGuard>
    );
}

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Calendar,
    Clock,
    MapPin,
    Car,
    Copy,
    Eye,
    Navigation,
    AlertCircle,
    CheckCircle,
    XCircle,
    CreditCard,
    Loader2,
    QrCode,
    ExternalLink
} from 'lucide-react';
import { useReservas } from '@/lib/hooks/use-reservas-unified';
import { ReservaConDetalles } from '@/lib/types';
import {
    obtenerEstadoReservaVisual,
    formatearCodigoReserva,
    formatearFechaReserva
} from '@/lib/utils/reservas-utils';
import { useToast } from '@/hooks/use-toast';
import { DetalleReservaDialog } from './detalle-reserva-dialog';
import TransferInfoDialog from '@/components/transfer-info-dialog';

export function MisReservasPanel() {
    const { misReservas, obtenerMisReservas, loading, error } = useReservas();
    const { toast } = useToast();
    const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservaConDetalles | null>(null);
    const [reservaTransferencia, setReservaTransferencia] = useState<ReservaConDetalles | null>(null);
    const [confirmandoTransferencia, setConfirmandoTransferencia] = useState(false);
    const [transferData, setTransferData] = useState<any>(null);

    useEffect(() => {
        obtenerMisReservas();

        // Ejecutar expiración automática de reservas al cargar
        const expirarReservasAutomaticamente = async () => {
            try {
                await fetch('/api/reservas/expirar', {
                    method: 'GET'
                });
            } catch (error) {
                console.error('Error ejecutando expiración automática:', error);
            }
        };

        expirarReservasAutomaticamente();

        // Escuchar evento de reserva creada para recargar
        const handleReservaCreada = () => {
            console.log('🔄 Recargando reservas después de crear nueva reserva...');
            obtenerMisReservas();
        };

        window.addEventListener('reserva-creada', handleReservaCreada);

        return () => {
            window.removeEventListener('reserva-creada', handleReservaCreada);
        };
    }, [obtenerMisReservas]);

    const copiarCodigo = (codigo: string) => {
        navigator.clipboard.writeText(codigo);
        toast({
            title: "Código copiado",
            description: "El código de reserva se ha copiado al portapapeles",
        });
    };

    const abrirDetalles = (reserva: ReservaConDetalles) => {
        setReservaSeleccionada(reserva);
    };

    const abrirDatosTransferencia = async (reserva: ReservaConDetalles) => {
        try {
            // Obtener datos bancarios del estacionamiento
            const response = await fetch(`/api/estacionamiento/${reserva.est_id}/datos-bancarios`);

            if (!response.ok) {
                throw new Error('No se pudieron obtener los datos bancarios');
            }

            const data = await response.json();

            if (data.success && data.data) {
                setTransferData(data.data);
                setReservaTransferencia(reserva);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se encontraron datos bancarios configurados para este estacionamiento"
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al obtener datos de transferencia"
            });
        }
    };

    const confirmarTransferencia = async () => {
        if (!reservaTransferencia) return;

        setConfirmandoTransferencia(true);
        try {
            const response = await fetch('/api/reservas/confirmar-pago-transferencia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    res_codigo: reservaTransferencia.res_codigo,
                    confirmado: true
                })
            });

            const result = await response.json();

            if (result.success) {
                toast({
                    title: "Pago confirmado",
                    description: "Tu pago ha sido reportado. El operador verificará la transferencia.",
                });
                setReservaTransferencia(null);
                obtenerMisReservas(); // Recargar reservas
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || 'Error confirmando el pago'
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: 'Error de conexión'
            });
        } finally {
            setConfirmandoTransferencia(false);
        }
    };

    const ReservaCard = ({ reserva }: { reserva: ReservaConDetalles }) => {
        const estadoVisual = obtenerEstadoReservaVisual(
            reserva.res_estado,
            reserva.res_fh_ingreso,
            undefined,
            reserva.res_fh_fin,
            reserva.ocupacion
        );

        return (
            <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatearCodigoReserva(reserva.res_codigo)}
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copiarCodigo(reserva.res_codigo)}
                            >
                                <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirDetalles(reserva)}
                            >
                                <Eye className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                    <Badge
                        className={`${estadoVisual.bgColor} ${estadoVisual.textColor} border-0`}
                    >
                        {estadoVisual.label}
                    </Badge>
                </CardHeader>

                <CardContent className="space-y-3">
                    {/* Información básica */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span>Plaza {reserva.pla_numero} - {reserva.plaza.pla_zona}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-gray-500" />
                            <span>{reserva.veh_patente}</span>
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span><strong>Inicio:</strong> {formatearFechaReserva(reserva.res_fh_ingreso)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span><strong>Fin:</strong> {formatearFechaReserva(reserva.res_fh_fin)}</span>
                        </div>
                    </div>

                    {/* Estacionamiento */}
                    <div className="text-sm">
                        <div className="font-medium">{reserva.estacionamiento.est_nombre}</div>
                        <div className="text-gray-600">{reserva.estacionamiento.est_direc}</div>
                    </div>

                    {/* Precio */}
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-gray-600">Total pagado:</span>
                        <span className="font-bold text-green-600">
                            ${reserva.res_monto.toLocaleString()}
                        </span>
                    </div>

                    {/* Acciones según estado */}
                    <div className="flex gap-2 pt-2 flex-wrap">
                        {reserva.res_estado === 'pendiente_pago' && (
                            <>
                                {reserva.metodo_pago === 'transferencia' ? (
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                                        onClick={() => abrirDatosTransferencia(reserva)}
                                    >
                                        <CreditCard className="w-3 h-3 mr-1" />
                                        Pagar por Transferencia
                                    </Button>
                                ) : reserva.metodo_pago === 'link_pago' ? (
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            const paymentInfo = reserva.payment_info as any;
                                            if (paymentInfo?.init_point) {
                                                window.open(paymentInfo.init_point, '_blank');
                                            } else {
                                                toast({
                                                    variant: "destructive",
                                                    title: "Error",
                                                    description: 'No hay link de pago disponible'
                                                });
                                            }
                                        }}
                                    >
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Pagar Ahora
                                    </Button>
                                ) : null}
                            </>
                        )}
                        {reserva.res_estado === 'pendiente_confirmacion_operador' && (
                            <Alert className="border-blue-200 bg-blue-50 w-full">
                                <Clock className="h-4 w-4" />
                                <AlertDescription>
                                    El operador está verificando tu pago
                                </AlertDescription>
                            </Alert>
                        )}
                        {reserva.res_estado === 'confirmada' && (
                            <Button size="sm" className="flex-1">
                                <Navigation className="w-3 h-3 mr-1" />
                                Cómo llegar
                            </Button>
                        )}
                        {reserva.res_estado === 'activa' && (
                            <Button size="sm" variant="outline" className="flex-1">
                                <Car className="w-3 h-3 mr-1" />
                                En uso
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Cargando reservas...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                    <span>Error cargando reservas: {error}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => obtenerMisReservas()}
                    >
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    if (!misReservas || misReservas.length === 0) {
        return (
            <div className="text-center py-8">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes reservas</h3>
                <p className="text-gray-600 mb-4">
                    Cuando hagas una reserva, aparecerá aquí
                </p>
                <Button onClick={() => window.location.href = '/conductor'}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Ver Estacionamientos
                </Button>
            </div>
        );
    }

    // Filtrar reservas por estado
    // NUEVA ESTRUCTURA: 2 SECCIONES
    // 1. "Mis Reservas" - Todas las vigentes (pendiente_pago, confirmada, activa, + completada si vehículo adentro)
    // 2. "Historial" - Finalizadas (completada con salida, expirada, cancelada, no_show)

    const misReservasVigentes = misReservas.filter(r => {
        // Mostrar estados vigentes/activos:
        // - pendiente_pago: esperando confirmación de pago
        // - confirmada: reserva confirmada, esperando ingreso
        // - activa: vehículo está estacionado (En Estacionamiento)
        const esVigente = ['pendiente_pago', 'pendiente_confirmacion_operador', 'confirmada', 'activa'].includes(r.res_estado);

        // NUEVO: Si es completada pero el vehículo todavía está adentro (no tiene salida registrada)
        // entonces mostrarla como vigente
        const completadaPeroEstacionado = r.res_estado === 'completada' &&
                                          r.ocupacion &&
                                          !r.ocupacion.ocu_fh_salida;

        return esVigente || completadaPeroEstacionado;
    }).sort((a, b) => {
        // Ordenar por fecha de inicio (más cercana primero)
        const fechaA = new Date(a.res_fh_ingreso).getTime();
        const fechaB = new Date(b.res_fh_ingreso).getTime();
        return fechaA - fechaB;
    });

    const reservasHistorial = misReservas.filter(r => {
        // Mostrar estados finalizados
        const esFinal = ['cancelada', 'no_show', 'expirada'].includes(r.res_estado);

        // NUEVO: Si es completada Y el vehículo ya salió (tiene ocu_fh_salida)
        // entonces mostrarla en historial
        const completadaYSalio = r.res_estado === 'completada' &&
                                 (!r.ocupacion || r.ocupacion.ocu_fh_salida);

        return esFinal || completadaYSalio;
    }).sort((a, b) => {
        // Ordenar por fecha de inicio (más reciente primero)
        const fechaA = new Date(a.res_fh_ingreso).getTime();
        const fechaB = new Date(b.res_fh_ingreso).getTime();
        return fechaB - fechaA;
    });

    return (
        <div className="space-y-6">
            <Tabs defaultValue="vigentes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="vigentes" className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Mis Reservas ({misReservasVigentes.length})
                    </TabsTrigger>
                    <TabsTrigger value="historial" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Historial ({reservasHistorial.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="vigentes" className="space-y-4">
                    {misReservasVigentes.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No tienes reservas vigentes. ¡Crea una ahora!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {misReservasVigentes.map((reserva) => (
                                <ReservaCard key={`${reserva.res_codigo}-${reserva.res_fh_ingreso}`} reserva={reserva} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="historial" className="space-y-4">
                    {reservasHistorial.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No tienes historial de reservas
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {reservasHistorial.map((reserva) => (
                                <ReservaCard key={`${reserva.res_codigo}-${reserva.res_fh_ingreso}`} reserva={reserva} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Dialog de detalles */}
            {reservaSeleccionada && (
                <DetalleReservaDialog
                    reserva={reservaSeleccionada}
                    open={!!reservaSeleccionada}
                    onOpenChange={(open) => !open && setReservaSeleccionada(null)}
                />
            )}

            {/* Dialog de transferencia */}
            {reservaTransferencia && transferData && (
                <TransferInfoDialog
                    isOpen={!!reservaTransferencia}
                    onClose={() => {
                        setReservaTransferencia(null);
                        setTransferData(null);
                    }}
                    onConfirmTransfer={confirmarTransferencia}
                    transferConfig={transferData}
                    paymentData={{
                        amount: reservaTransferencia.res_monto,
                        vehicleLicensePlate: reservaTransferencia.veh_patente,
                        paymentId: reservaTransferencia.res_codigo,
                        duration: `${Math.round((new Date(reservaTransferencia.res_fh_fin).getTime() - new Date(reservaTransferencia.res_fh_ingreso).getTime()) / (1000 * 60 * 60))} hora(s)`
                    }}
                    loading={confirmandoTransferencia}
                />
            )}
        </div>
    );
}

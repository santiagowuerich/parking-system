"use client";

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
    Search,
    Car,
    MapPin,
    Clock,
    DollarSign,
    User,
    Phone,
    Calendar,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2,
    Copy,
    Check,
    RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useReservas } from '@/lib/hooks/use-reservas-unified';
import { BuscarReservaResponse, ReservaConDetalles } from '@/lib/types';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface BuscarReservaDialogProps {
    isOpen: boolean;
    onClose: () => void;
    estId: number;
    onConfirmarLlegada?: (reserva: ReservaConDetalles) => void;
    modoAutomatico?: boolean; // Si true, muestra automáticamente reservas pendientes de confirmación
}

export function BuscarReservaDialog({
    isOpen,
    onClose,
    estId,
    onConfirmarLlegada,
    modoAutomatico = false
}: BuscarReservaDialogProps) {
    const [busqueda, setBusqueda] = useState('');
    const [tipoBusqueda, setTipoBusqueda] = useState<'codigo' | 'patente'>('codigo');
    const [resultado, setResultado] = useState<ReservaConDetalles | null>(null);
    const [reservasPendientes, setReservasPendientes] = useState<ReservaConDetalles[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingReservas, setLoadingReservas] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [codigoCopiado, setCodigoCopiado] = useState(false);
    const [confirmandoTransferencia, setConfirmandoTransferencia] = useState(false);

    const { buscarReserva, confirmarLlegada } = useReservas(estId);

    // Función para cargar reservas pendientes de confirmación
    const cargarReservasPendientes = async () => {
        setLoadingReservas(true);
        setError(null);

        try {
            // Obtener fecha actual en formato YYYY-MM-DD
            const hoy = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');

            // Cargar reservas confirmadas (pendientes de ingresar) y transferencias pendientes
            const response = await fetch(`/api/reservas/operador?est_id=${estId}&fecha=${hoy}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Filtrar solo las reservas que están pendientes de ingresar
                const reservasPendientesIngreso = data.data.reservas.filter(
                    (r: ReservaConDetalles) =>
                        r.res_estado === 'confirmada' ||
                        r.res_estado === 'pendiente_confirmacion_operador'
                );
                setReservasPendientes(reservasPendientesIngreso);
                console.log(`✅ Cargadas ${reservasPendientesIngreso.length} reservas pendientes de ingreso`);
            } else {
                setError(data.error || 'Error al cargar reservas pendientes');
                setReservasPendientes([]);
            }
        } catch (err) {
            setError('Error al cargar reservas pendientes');
            console.error('Error cargando reservas pendientes:', err);
            setReservasPendientes([]);
        } finally {
            setLoadingReservas(false);
        }
    };

    // Cargar reservas pendientes cuando se abre el modal en modo automático
    useEffect(() => {
        if (isOpen && modoAutomatico) {
            cargarReservasPendientes();
        } else if (!isOpen) {
            // Limpiar estados cuando se cierra
            setReservasPendientes([]);
            setResultado(null);
            setBusqueda('');
            setError(null);
        }
    }, [isOpen, modoAutomatico]);

    const handleBuscar = async () => {
        if (!busqueda.trim()) {
            setError('Por favor ingresa un código o patente');
            return;
        }

        setLoading(true);
        setError(null);
        setResultado(null);

        try {
            const response = await buscarReserva(busqueda.trim(), tipoBusqueda);

            if (response.success && response.data) {
                setResultado(response.data);
                toast({
                    title: "Reserva encontrada",
                    description: `Reserva ${response.data.res_codigo} encontrada exitosamente`,
                });
            } else {
                setError(response.error || 'No se encontró ninguna reserva');
            }
        } catch (err) {
            setError('Error al buscar la reserva');
            console.error('Error buscando reserva:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarLlegada = async (reserva?: ReservaConDetalles) => {
        const reservaAConfirmar = reserva || resultado;
        if (!reservaAConfirmar) return;

        try {
            const response = await confirmarLlegada(reservaAConfirmar.res_codigo);

            if (response.success) {
                toast({
                    title: "Llegada confirmada",
                    description: `La reserva ${reservaAConfirmar.res_codigo} ha sido activada exitosamente`,
                });

                if (onConfirmarLlegada) {
                    onConfirmarLlegada(reservaAConfirmar);
                }

                // Si estamos en modo automático, actualizar la lista removiendo la reserva confirmada
                if (modoAutomatico) {
                    setReservasPendientes(prev =>
                        prev.filter(r => r.res_codigo !== reservaAConfirmar.res_codigo)
                    );
                } else {
                    // Modo manual: cerrar el modal
                    handleCerrar();
                }
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'No se pudo confirmar la llegada',
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: 'Error al confirmar la llegada',
                variant: "destructive",
            });
            console.error('Error confirmando llegada:', err);
        }
    };

    const handleForzarIngreso = async () => {
        if (!resultado) return;

        try {
            // Llamar al mismo endpoint de confirmar llegada
            const response = await confirmarLlegada(resultado.res_codigo);

            if (response.success) {
                toast({
                    title: "Vehículo ingresado",
                    description: `El vehículo de la reserva ${resultado.res_codigo} ha sido ingresado manualmente`,
                });

                if (onConfirmarLlegada) {
                    onConfirmarLlegada(resultado);
                }

                handleCerrar();
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'No se pudo ingresar el vehículo',
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: 'Error al ingresar el vehículo',
                variant: "destructive",
            });
            console.error('Error forzando ingreso:', err);
        }
    };

    const handleConfirmarTransferencia = async () => {
        if (!resultado) return;

        setConfirmandoTransferencia(true);
        try {
            const response = await fetch('/api/reservas/confirmar-pago-transferencia-operador', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    res_codigo: resultado.res_codigo,
                    est_id: estId,
                    confirmado: true
                })
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Pago confirmado",
                    description: `Pago de transferencia para ${resultado.res_codigo} confirmado exitosamente`,
                });
                // Actualizar resultado para reflejar el nuevo estado
                setResultado({ ...resultado, res_estado: 'confirmada' });
            } else {
                toast({
                    title: "Error",
                    description: data.error || 'Error confirmando el pago',
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: 'Error al confirmar el pago',
                variant: "destructive",
            });
            console.error('Error confirmando transferencia:', err);
        } finally {
            setConfirmandoTransferencia(false);
        }
    };

    const handleConfirmarPago = async () => {
        if (!resultado) return;

        setConfirmandoTransferencia(true);
        try {
            const response = await fetch('/api/reservas/confirmar-pago-transferencia-operador', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    res_codigo: resultado.res_codigo,
                    est_id: estId,
                    confirmado: true
                })
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: "Pago confirmado",
                    description: `Pago para reserva ${resultado.res_codigo} confirmado exitosamente`,
                });
                // Actualizar resultado para reflejar el nuevo estado
                setResultado({ ...resultado, res_estado: 'confirmada' });
            } else {
                toast({
                    title: "Error",
                    description: data.error || 'Error confirmando el pago',
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: 'Error al confirmar el pago',
                variant: "destructive",
            });
            console.error('Error confirmando pago:', err);
        } finally {
            setConfirmandoTransferencia(false);
        }
    };

    const handleCerrar = () => {
        setBusqueda('');
        setResultado(null);
        setError(null);
        setCodigoCopiado(false);
        onClose();
    };

    const copiarCodigo = async () => {
        if (!resultado) return;

        try {
            await navigator.clipboard.writeText(resultado.res_codigo);
            setCodigoCopiado(true);
            toast({
                title: "Código copiado",
                description: "El código de reserva ha sido copiado al portapapeles",
            });

            setTimeout(() => setCodigoCopiado(false), 2000);
        } catch (err) {
            toast({
                title: "Error",
                description: "No se pudo copiar el código",
                variant: "destructive",
            });
        }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'confirmada':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'activa':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'pendiente_pago':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'no_show':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'expirada':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'confirmada':
                return <CheckCircle className="w-4 h-4" />;
            case 'activa':
                return <CheckCircle className="w-4 h-4" />;
            case 'pendiente_pago':
                return <Clock className="w-4 h-4" />;
            case 'no_show':
                return <XCircle className="w-4 h-4" />;
            case 'expirada':
                return <XCircle className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    };

    const puedeConfirmarLlegada = (reserva: ReservaConDetalles) => {
        // Permitir confirmar llegada si la reserva está confirmada (sin restricción de tiempo de gracia)
        const puede = reserva.res_estado === 'confirmada';
        console.log('🔍 [CONFIRMAR LLEGADA] Puede confirmar:', puede, 'Estado:', reserva.res_estado);
        return puede;
    };

    const puedeForzarIngreso = (reserva: ReservaConDetalles) => {
        // Permitir forzar ingreso si está confirmada, activa, o incluso si pasó la hora pero aún es válido
        return (reserva.res_estado === 'confirmada' || reserva.res_estado === 'activa');
    };

    const puedeConfirmarTransferencia = (reserva: ReservaConDetalles) => {
        return reserva.res_estado === 'pendiente_confirmacion_operador';
    };

    const puedeConfirmarPago = (reserva: ReservaConDetalles) => {
        return reserva.res_estado === 'pendiente_pago';
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleCerrar}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        {modoAutomatico ? 'Reservas Pendientes de Confirmación' : 'Buscar Reserva'}
                    </DialogTitle>
                    <DialogDescription>
                        {modoAutomatico
                            ? 'Lista de reservas que requieren confirmación de llegada del conductor'
                            : 'Busca una reserva por código o patente para confirmar la llegada del conductor'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Modo automático: Lista de reservas pendientes */}
                    {modoAutomatico ? (
                        <>
                            {/* Loading state */}
                            {loadingReservas && (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                    <span>Cargando reservas pendientes...</span>
                                </div>
                            )}

                            {/* Lista de reservas pendientes */}
                            {!loadingReservas && reservasPendientes.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                                    <p className="text-lg font-medium">¡Todo al día!</p>
                                    <p>No hay reservas pendientes de confirmación</p>
                                </div>
                            )}

                            {!loadingReservas && reservasPendientes.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-gray-700">
                                            Reservas pendientes ({reservasPendientes.length})
                                        </h3>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={cargarReservasPendientes}
                                            disabled={loadingReservas}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${loadingReservas ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>

                                    {reservasPendientes.map((reserva) => (
                                        <Card key={reserva.res_codigo} className="border-l-4 border-l-yellow-400">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-medium text-sm">
                                                            {reserva.res_codigo}
                                                        </span>
                                                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                                            Pendiente
                                                        </Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmarLlegada(reserva)}
                                                        disabled={confirmandoTransferencia}
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Confirmar Llegada
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                                                            <Car className="w-3 h-3" />
                                                            <span>{reserva.veh_patente}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                                                            <MapPin className="w-3 h-3" />
                                                            <span>{reserva.plaza.pla_zona} - {reserva.plaza.catv_segmento}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1 text-gray-600 mb-1">
                                                            <Clock className="w-3 h-3" />
                                                            <span>{dayjs(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires').format('HH:mm')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-gray-600">
                                                            <User className="w-3 h-3" />
                                                            <span>{reserva.conductor.usu_nom} {reserva.conductor.usu_ape}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Formulario de búsqueda tradicional */
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Button
                                    variant={tipoBusqueda === 'codigo' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTipoBusqueda('codigo')}
                                >
                                    Por Código
                                </Button>
                                <Button
                                    variant={tipoBusqueda === 'patente' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTipoBusqueda('patente')}
                                >
                                    Por Patente
                                </Button>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label htmlFor="busqueda">
                                        {tipoBusqueda === 'codigo' ? 'Código de Reserva' : 'Patente del Vehículo'}
                                    </Label>
                                    <Input
                                        id="busqueda"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                                        placeholder={tipoBusqueda === 'codigo' ? 'RES-20250125-0001' : 'ABC123'}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                                    />
                                </div>
                                <Button
                                    onClick={handleBuscar}
                                    disabled={loading || !busqueda.trim()}
                                    className="self-end"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Resultado de la búsqueda */}
                    {resultado && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Car className="w-5 h-5" />
                                        Reserva Encontrada
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getEstadoColor(resultado.res_estado)}>
                                            {getEstadoIcon(resultado.res_estado)}
                                            <span className="ml-1">{resultado.res_estado.replace('_', ' ').toUpperCase()}</span>
                                        </Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={copiarCodigo}
                                        >
                                            {codigoCopiado ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Código de reserva */}
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="text-sm text-gray-600 mb-1">Código de Reserva</div>
                                    <div className="text-xl font-mono font-bold text-gray-900">
                                        {resultado.res_codigo}
                                    </div>
                                </div>

                                {/* Información de la reserva */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Estacionamiento</div>
                                                <div className="font-medium">{resultado.estacionamiento.est_nombre}</div>
                                                <div className="text-sm text-gray-500">{resultado.estacionamiento.est_direc}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Car className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Plaza</div>
                                                <div className="font-medium">
                                                    {resultado.plaza.pla_zona} - {resultado.plaza.catv_segmento}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Monto</div>
                                                <div className="font-medium">{formatCurrency(resultado.res_monto)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Fecha de Inicio</div>
                                                <div className="font-medium">
                                                    {format(dayjs(resultado.res_fh_ingreso).tz('America/Argentina/Buenos_Aires').toDate(), 'dd/MM/yyyy HH:mm', { locale: es })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Fecha de Fin</div>
                                                <div className="font-medium">
                                                    {format(dayjs(resultado.res_fh_fin).tz('America/Argentina/Buenos_Aires').toDate(), 'dd/MM/yyyy HH:mm', { locale: es })}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                <Separator />

                                {/* Información del conductor */}
                                <div className="space-y-3">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Información del Conductor
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-gray-600">Nombre</div>
                                            <div className="font-medium">
                                                {resultado.conductor.usu_nom} {resultado.conductor.usu_ape}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-gray-500" />
                                            <div>
                                                <div className="text-sm text-gray-600">Teléfono</div>
                                                <div className="font-medium">{resultado.conductor.usu_tel}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm text-gray-600">Vehículo</div>
                                        <div className="font-medium">
                                            {resultado.vehiculo.veh_marca} {resultado.vehiculo.veh_modelo} - {resultado.vehiculo.veh_color}
                                        </div>
                                        <div className="text-sm text-gray-500">Patente: {resultado.veh_patente}</div>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={handleCerrar}>
                        Cerrar
                    </Button>

                    {resultado && puedeConfirmarPago(resultado) && (
                        <Button
                            onClick={handleConfirmarPago}
                            disabled={confirmandoTransferencia}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {confirmandoTransferencia ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Confirmando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Confirmar Pago Recibido
                                </>
                            )}
                        </Button>
                    )}

                    {resultado && puedeConfirmarTransferencia(resultado) && (
                        <Button
                            onClick={handleConfirmarTransferencia}
                            disabled={confirmandoTransferencia}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {confirmandoTransferencia ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Confirmando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Confirmar Pago Transferencia
                                </>
                            )}
                        </Button>
                    )}

                    {resultado && puedeConfirmarLlegada(resultado) && (
                        <Button
                            onClick={() => handleConfirmarLlegada()}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Llegada
                        </Button>
                    )}

                    {resultado && puedeForzarIngreso(resultado) && !puedeConfirmarLlegada(resultado) && (
                        <Button
                            onClick={handleForzarIngreso}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Ingresar Vehículo Manualmente
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

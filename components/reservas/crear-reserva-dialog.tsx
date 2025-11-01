"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, MapPin, CreditCard, AlertCircle, CheckCircle, ExternalLink, QrCode, Copy, Check, Loader2 } from 'lucide-react';
import { useReservas } from '@/lib/hooks/use-reservas-unified';
import { CrearReservaRequest, PlazaDisponible } from '@/lib/types';
import { generarOpcionesFechaHora, generarOpcionesDuracion, validarTiempoReserva, calcularPrecioReserva, formatearFechaReserva } from '@/lib/utils/reservas-utils';
import { useToast } from '@/hooks/use-toast';
import QRCode from "react-qr-code";
import TransferInfoDialog from '@/components/transfer-info-dialog';
import QRPaymentDialog from '@/components/qr-payment-dialog';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface CrearReservaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estacionamiento: {
        est_id: number;
        est_nombre: string;
    };
    plazasDisponibles: Array<{
        pla_numero: number;
        pla_zona: string;
        catv_segmento: string;
        precio_por_hora: number;
        plantilla_id: number;
    }>;
    vehiculoSeleccionado: {
        id: string;
        patente: string;
        tipo: 'AUT' | 'MOT' | 'CAM';
        marca: string;
        modelo: string;
        color: string;
    } | null;
}

export function CrearReservaDialog({
    open,
    onOpenChange,
    estacionamiento,
    plazasDisponibles,
    vehiculoSeleccionado
}: CrearReservaDialogProps) {
    const { toast } = useToast();
    const { crearReserva, consultarDisponibilidad, loading: reservasLoading } = useReservas(estacionamiento.est_id);

    const [plazaSeleccionada, setPlazaSeleccionada] = useState<any>(null);
    const [fechaInicio, setFechaInicio] = useState('');
    const [duracionHoras, setDuracionHoras] = useState(1);
    const [metodoPago, setMetodoPago] = useState<'link_pago' | 'qr'>('link_pago');
    const [disponible, setDisponible] = useState(true);
    const [precioTotal, setPrecioTotal] = useState(0);

    // Estados para el flujo de pago
    const [reservaCreada, setReservaCreada] = useState<any>(null);
    const [mostrarQR, setMostrarQR] = useState(false);
    const [mostrarConfirmacionLinkPago, setMostrarConfirmacionLinkPago] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const opcionesFechaHora = generarOpcionesFechaHora();
    const opcionesDuracion = generarOpcionesDuracion();

    // Establecer fecha de inicio automáticamente al abrir el diálogo
    useEffect(() => {
        if (open) {
            const ahora = dayjs().tz('America/Argentina/Buenos_Aires').toISOString();
            setFechaInicio(ahora);
        }
    }, [open]);

    // Calcular precio total cuando cambie la duración o plaza
    useEffect(() => {
        if (plazaSeleccionada) {
            const precio = calcularPrecioReserva(plazaSeleccionada.precio_por_hora, duracionHoras);
            setPrecioTotal(precio);
        } else {
            setPrecioTotal(0);
        }
    }, [duracionHoras, plazaSeleccionada]);

    // Verificar disponibilidad cuando cambien los parámetros
    useEffect(() => {
        if (fechaInicio && duracionHoras && plazaSeleccionada) {
            verificarDisponibilidad();
        }
    }, [fechaInicio, duracionHoras, plazaSeleccionada]);

    const verificarDisponibilidad = async () => {
        if (!fechaInicio || !plazaSeleccionada) return;

        const resultado = await consultarDisponibilidad(
            estacionamiento.est_id,
            fechaInicio,
            duracionHoras
        );

        if (resultado && resultado.success && resultado.data) {
            const plazas = resultado.data.plazas;
            if (Array.isArray(plazas)) {
                const plazaEncontrada = plazas.find(p => p.pla_numero === plazaSeleccionada.pla_numero);
                setDisponible(!!plazaEncontrada);
            } else {
                setDisponible(false);
            }
        } else {
            setDisponible(false);
        }
    };

    const handleCrearReserva = async () => {
        // Validaciones
        if (!plazaSeleccionada) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Debes seleccionar una plaza"
            });
            return;
        }

        if (!fechaInicio) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Debes seleccionar una hora de inicio"
            });
            return;
        }

        if (!vehiculoSeleccionado) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se encontró el vehículo seleccionado"
            });
            return;
        }

        const validacionTiempo = validarTiempoReserva(fechaInicio);
        if (!validacionTiempo.valido) {
            toast({
                variant: "destructive",
                title: "Error",
                description: validacionTiempo.error
            });
            return;
        }

        if (!disponible) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "La plaza ya no está disponible en el horario seleccionado"
            });
            return;
        }

        // Crear reserva
        const request: CrearReservaRequest = {
            est_id: estacionamiento.est_id,
            pla_numero: plazaSeleccionada.pla_numero,
            veh_patente: vehiculoSeleccionado.patente,
            fecha_inicio: fechaInicio,
            duracion_horas: duracionHoras,
            metodo_pago: metodoPago
        };

        const result = await crearReserva(request);

        if (result && result.success && result.data) {
            // Ahora recibimos reserva creada en BD
            setReservaCreada({
                reserva_temporal: result.data.reserva || result.data.reserva_temporal, // Compatibilidad con ambos formatos
                payment_info: result.data.payment_info
            });

            toast({
                title: "Reserva creada",
                description: `Código de reserva: ${result.data.reserva?.res_codigo || result.data.reserva_temporal?.res_codigo}`,
            });

            // Recargar reservas para que aparezca en "Próximas"
            if (typeof window !== 'undefined') {
                // Disparar evento personalizado para recargar reservas
                window.dispatchEvent(new CustomEvent('reserva-creada'));
            }

            // Manejar flujo de pago según el método seleccionado
            if (metodoPago === 'link_pago') {
                // Abrir link de pago automáticamente en nueva pestaña
                if (result.data?.payment_info?.init_point) {
                    window.open(result.data.payment_info.init_point, '_blank');
                }
                // Mostrar modal de confirmación inmediatamente
                setMostrarConfirmacionLinkPago(true);
            } else if (metodoPago === 'qr') {
                setMostrarQR(true);
            }
        }
    };

    const resetForm = () => {
        setPlazaSeleccionada(null);
        setFechaInicio('');
        setDuracionHoras(1);
        setMetodoPago('link_pago');
        setDisponible(true);
        setReservaCreada(null);
        setMostrarQR(false);
        setMostrarConfirmacionLinkPago(false);
        setCopiado(false);
        setConfirmando(false);
    };

    const copiarCodigo = () => {
        if (reservaCreada?.reserva_temporal?.res_codigo) {
            navigator.clipboard.writeText(reservaCreada.reserva_temporal.res_codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
            toast({
                title: "Copiado",
                description: "Código de referencia copiado al portapapeles.",
            });
        }
    };

    const confirmarPagoManual = async () => {
        if (!reservaCreada) return;

        setConfirmando(true);
        try {
            console.log('🔄 Confirmando pago manualmente y creando reserva en BD...');
            const response = await fetch('/api/reservas/confirmar-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Enviar datos temporales para crear la reserva
                    reserva_data: reservaCreada.reserva_temporal,
                    preference_id: reservaCreada.payment_info?.preference_id
                })
            });

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "¡Reserva Confirmada!",
                    description: "Tu reserva ha sido creada y confirmada exitosamente."
                });
                setMostrarConfirmacionLinkPago(false);
                cerrarDialog();
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: data.error || "No se pudo confirmar la reserva"
                });
            }
        } catch (error) {
            console.error('❌ Error confirmando pago:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al confirmar la reserva"
            });
        } finally {
            setConfirmando(false);
        }
    };

    const cerrarDialog = () => {
        onOpenChange(false);
        resetForm();
    };



    return (
        <Dialog open={open} onOpenChange={cerrarDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Crear Reserva
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Información de la plaza */}
                    {/* Selector de Plaza */}
                    <div className="space-y-2">
                        <Label htmlFor="plaza">Seleccionar Plaza</Label>
                        {plazasDisponibles.length === 0 ? (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-yellow-800 text-sm">
                                    No hay plazas disponibles en este estacionamiento para la hora seleccionada.
                                </p>
                            </div>
                        ) : (
                            <Select value={plazaSeleccionada?.pla_numero?.toString() || ''} onValueChange={(value) => {
                                const plaza = plazasDisponibles.find(p => p.pla_numero.toString() === value);
                                setPlazaSeleccionada(plaza);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una plaza disponible" />
                                </SelectTrigger>
                                <SelectContent>
                                    {plazasDisponibles.map((plaza) => (
                                        <SelectItem key={plaza.pla_numero} value={plaza.pla_numero.toString()}>
                                            Plaza {plaza.pla_numero} - Zona {plaza.pla_zona} -
                                            {plaza.catv_segmento === 'AUT' ? 'Auto' :
                                                plaza.catv_segmento === 'MOT' ? 'Moto' : 'Camioneta'} -
                                            ${plaza.precio_por_hora}/hora
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {plazaSeleccionada && (
                            <div className="text-sm text-gray-600">
                                Plaza {plazaSeleccionada.pla_numero} seleccionada -
                                ${plazaSeleccionada.precio_por_hora}/hora
                            </div>
                        )}
                    </div>

                    {/* Información del Vehículo */}
                    {vehiculoSeleccionado ? (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Vehículo Seleccionado
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{vehiculoSeleccionado.patente}</span>
                                    <Badge variant="outline">
                                        {vehiculoSeleccionado.tipo === 'AUT' ? 'Auto' :
                                            vehiculoSeleccionado.tipo === 'MOT' ? 'Moto' : 'Camioneta'}
                                    </Badge>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {vehiculoSeleccionado.marca} {vehiculoSeleccionado.modelo} - {vehiculoSeleccionado.color}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardContent className="pt-6">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ No se encontró información del vehículo. Por favor, selecciona un vehículo en la página anterior.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Formulario de reserva */}
                    <div className="space-y-4">
                        <div className="space-y-4">
                            {/* Información de reserva inmediata */}
                            <Alert>
                                <Clock className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Reserva inmediata:</strong> Tu reserva comenzará en este momento. Selecciona la duración que deseas pagar.
                                </AlertDescription>
                            </Alert>

                            {/* Duración */}
                            <div className="space-y-2">
                                <Label htmlFor="duracion">Duración</Label>
                                <Select value={duracionHoras.toString()} onValueChange={(value) => setDuracionHoras(Number(value))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar duración" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {opcionesDuracion.map((opcion) => (
                                            <SelectItem key={opcion.value} value={opcion.value.toString()}>
                                                {opcion.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>


                        {/* Método de pago */}
                        <div className="space-y-2">
                            <Label htmlFor="metodo-pago">Método de Pago</Label>
                            <Select value={metodoPago} onValueChange={(value: any) => setMetodoPago(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar método de pago" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="link_pago">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-4 h-4" />
                                            Link de Pago (MercadoPago)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="qr">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-4 h-4" />
                                            Código QR (MercadoPago)
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Resumen de precio */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-medium">Total a pagar:</span>
                                <span className="text-2xl font-bold text-green-600">
                                    ${precioTotal.toLocaleString()}
                                </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                                {duracionHoras} hora{duracionHoras > 1 ? 's' : ''} × ${plazaSeleccionada?.precio_por_hora || 0}/hora
                            </div>
                        </CardContent>
                    </Card>

                    {/* Estado de disponibilidad */}
                    {fechaInicio && (
                        <Alert>
                            {disponible ? (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        ✅ Plaza disponible para el horario seleccionado
                                    </AlertDescription>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        ❌ La plaza ya no está disponible en el horario seleccionado
                                    </AlertDescription>
                                </>
                            )}
                        </Alert>
                    )}

                    {/* Términos y condiciones */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Términos importantes:</strong>
                            <ul className="mt-2 space-y-1 text-sm">
                                <li>• Tu reserva comenzará inmediatamente al pagar</li>
                                <li>• Tienes hasta el fin del tiempo pagado para ingresar tu vehículo</li>
                                <li>• Si sales antes del fin del tiempo pagado, no hay reembolso</li>
                                <li>• Si te excedes del tiempo pagado, se cobrará el tiempo adicional</li>
                                <li>• Las reservas no son cancelables ni modificables</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    {/* Botones de acción */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={cerrarDialog}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCrearReserva}
                            disabled={reservasLoading || !disponible || !fechaInicio || !plazaSeleccionada || !vehiculoSeleccionado}
                            className="min-w-[140px]"
                        >
                            {reservasLoading ? (
                                <>
                                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Confirmar y Pagar
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>

            {/* Dialog de confirmación para link_pago */}
            {mostrarConfirmacionLinkPago && reservaCreada && (
                <Dialog open={mostrarConfirmacionLinkPago} onOpenChange={setMostrarConfirmacionLinkPago}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-600" />
                                Confirmar Pago
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Mensaje de instrucción */}
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Completa el pago en MercadoPago (se abrió en nueva pestaña) y luego confirma aquí.
                                </AlertDescription>
                            </Alert>

                            {/* Información de la reserva */}
                            <Card>
                                <CardContent className="pt-6 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Código de Referencia:</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{reservaCreada.reserva_temporal?.res_codigo}</Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={copiarCodigo}
                                            >
                                                {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-gray-600">Plaza</p>
                                            <p className="font-semibold">{plazaSeleccionada?.pla_numero}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Duración</p>
                                            <p className="font-semibold">{duracionHoras} hora(s)</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Monto Total:</span>
                                        <span className="text-xl font-bold text-green-600">${precioTotal}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Botones de acción */}
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={confirmarPagoManual}
                                disabled={confirmando}
                            >
                                {confirmando ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Confirmando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Confirmar Pago
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setMostrarConfirmacionLinkPago(false);
                                    cerrarDialog();
                                }}
                                disabled={confirmando}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Dialog de pago con QR */}
            {mostrarQR && reservaCreada && (
                <QRPaymentDialog
                    isOpen={mostrarQR}
                    onClose={() => {
                        setMostrarQR(false);
                        cerrarDialog();
                    }}
                    onPaymentComplete={async () => {
                        setConfirmando(true);
                        try {
                            console.log('🔄 Confirmando pago QR y creando reserva en BD...');
                            const response = await fetch('/api/reservas/confirmar-manual', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    reserva_data: reservaCreada.reserva_temporal,
                                    preference_id: reservaCreada.payment_info?.preference_id
                                })
                            });

                            const data = await response.json();
                            if (data.success) {
                                toast({
                                    title: "¡Reserva Confirmada!",
                                    description: "Tu reserva ha sido creada y confirmada exitosamente."
                                });
                                setMostrarQR(false);
                                cerrarDialog();
                            } else {
                                toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: data.error || "No se pudo confirmar la reserva"
                                });
                            }
                        } catch (error) {
                            console.error('❌ Error confirmando pago QR:', error);
                            toast({
                                variant: "destructive",
                                title: "Error",
                                description: "Error al confirmar la reserva"
                            });
                        } finally {
                            setConfirmando(false);
                        }
                    }}
                    paymentData={{
                        amount: precioTotal,
                        vehicleLicensePlate: vehiculoSeleccionado?.patente || 'N/A',
                        paymentId: reservaCreada.payment_info?.preference_id || '',
                        duration: `${duracionHoras} hora${duracionHoras > 1 ? 's' : ''}`,
                        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                    }}
                    qrData={{
                        qrCode: reservaCreada.payment_info?.qr_code || reservaCreada.payment_info?.init_point || '',
                        qrCodeImage: reservaCreada.payment_info?.qr_code_base64 
                            ? `data:image/png;base64,${reservaCreada.payment_info.qr_code_base64}`
                            : reservaCreada.payment_info?.qr_code_image || '',
                        preferenceId: reservaCreada.payment_info?.preference_id || ''
                    }}
                    paymentStatus="pendiente"
                    loading={confirmando}
                />
            )}
        </Dialog>
    );
}

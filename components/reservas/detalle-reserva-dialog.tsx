"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Calendar,
    Clock,
    MapPin,
    Car,
    Copy,
    Phone,
    Mail,
    Navigation,
    QrCode,
    Timer,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { ReservaConDetalles } from '@/lib/types';
import {
    obtenerEstadoReservaVisual,
    calcularTiempoRestante,
    formatearCodigoReserva,
    formatearFechaReserva,
    generarInstruccionesReserva
} from '@/lib/utils/reservas-utils';
import { useToast } from '@/hooks/use-toast';

interface DetalleReservaDialogProps {
    reserva: ReservaConDetalles;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DetalleReservaDialog({ reserva, open, onOpenChange }: DetalleReservaDialogProps) {
    const { toast } = useToast();

    const estadoVisual = obtenerEstadoReservaVisual(reserva.res_estado, reserva.res_fh_ingreso, reserva.res_tiempo_gracia_min);
    const tiempoRestante = calcularTiempoRestante(reserva.res_fh_ingreso);

    const copiarCodigo = () => {
        navigator.clipboard.writeText(reserva.res_codigo);
        toast({
            title: "Código copiado",
            description: "El código de reserva se ha copiado al portapapeles",
        });
    };

    const abrirMapa = () => {
        const direccion = encodeURIComponent(reserva.estacionamiento.est_direc);
        const url = `https://www.google.com/maps/search/?api=1&query=${direccion}`;
        window.open(url, '_blank');
    };

    const llamarTelefono = () => {
        if (reserva.estacionamiento.est_telefono) {
            window.location.href = `tel:${reserva.estacionamiento.est_telefono}`;
        }
    };

    const enviarEmail = () => {
        if (reserva.estacionamiento.est_email) {
            window.location.href = `mailto:${reserva.estacionamiento.est_email}`;
        }
    };

    // Generar código QR simple (en una implementación real usarías una librería como qrcode)
    const generarQRCode = (texto: string) => {
        // Por ahora retornamos un placeholder
        return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" font-family="monospace" font-size="12">
          ${texto}
        </text>
      </svg>
    `)}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Detalles de la Reserva
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna izquierda - Información */}
                    <div className="space-y-6">
                        {/* Código de reserva */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <QrCode className="w-4 h-4" />
                                    Código de Reserva
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center">
                                    <div className="text-2xl font-mono font-bold bg-gray-100 p-4 rounded-lg mb-2">
                                        {formatearCodigoReserva(reserva.res_codigo)}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={copiarCodigo}>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copiar Código
                                    </Button>
                                </div>

                                {/* QR Code placeholder */}
                                <div className="text-center">
                                    <div className="inline-block p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                                        <img
                                            src={generarQRCode(reserva.res_codigo)}
                                            alt="Código QR"
                                            className="w-32 h-32 mx-auto"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Código QR</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Estado y tiempo */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Timer className="w-4 h-4" />
                                    Estado y Tiempo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">Estado:</span>
                                    <Badge className={`${estadoVisual.bgColor} ${estadoVisual.textColor} border-0`}>
                                        {estadoVisual.label}
                                    </Badge>
                                </div>

                                {reserva.res_estado === 'confirmada' && tiempoRestante.minutosRestantes > 0 && (
                                    <Alert className={tiempoRestante.esUrgente ? 'border-orange-200 bg-orange-50' : ''}>
                                        <Timer className="h-4 w-4" />
                                        <AlertDescription>
                                            {tiempoRestante.esUrgente ? '⚠️ ' : ''}
                                            Tiempo restante: <strong>{tiempoRestante.tiempoRestante}</strong>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span>Inicio:</span>
                                        <span>{formatearFechaReserva(reserva.res_fh_ingreso)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Fin:</span>
                                        <span>{formatearFechaReserva(reserva.res_fh_fin)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tiempo de gracia:</span>
                                        <span>{reserva.res_tiempo_gracia_min} minutos</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Información del vehículo */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Car className="w-4 h-4" />
                                    Vehículo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-lg font-mono font-bold">{reserva.veh_patente}</div>
                                <div className="text-sm text-gray-600">
                                    {reserva.vehiculo.veh_marca} {reserva.vehiculo.veh_modelo}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Color: {reserva.vehiculo.veh_color}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Información de contacto */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    Contacto
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {reserva.estacionamiento.est_telefono && (
                                    <Button variant="outline" className="w-full justify-start" onClick={llamarTelefono}>
                                        <Phone className="w-4 h-4 mr-2" />
                                        {reserva.estacionamiento.est_telefono}
                                    </Button>
                                )}
                                {reserva.estacionamiento.est_email && (
                                    <Button variant="outline" className="w-full justify-start" onClick={enviarEmail}>
                                        <Mail className="w-4 h-4 mr-2" />
                                        {reserva.estacionamiento.est_email}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Columna derecha - Ubicación y detalles */}
                    <div className="space-y-6">
                        {/* Ubicación */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Ubicación
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="font-medium text-lg">{reserva.estacionamiento.est_nombre}</div>
                                    <div className="text-gray-600">{reserva.estacionamiento.est_direc}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Plaza {reserva.pla_numero}</Badge>
                                    <Badge variant="outline">Zona {reserva.plaza.pla_zona}</Badge>
                                </div>

                                <Button className="w-full" onClick={abrirMapa}>
                                    <Navigation className="w-4 h-4 mr-2" />
                                    Cómo llegar
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Instrucciones */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Instrucciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-2 whitespace-pre-line">
                                    {generarInstruccionesReserva(reserva)}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Información de pago */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Información de Pago
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">Total pagado:</span>
                                    <span className="text-xl font-bold text-green-600">
                                        ${reserva.res_monto.toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Reserva creada: {formatearFechaReserva(reserva.res_created_at)}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Términos importantes */}
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Recordatorios importantes:</strong>
                                <ul className="mt-2 space-y-1 text-sm">
                                    <li>• Llega dentro de los {reserva.res_tiempo_gracia_min} minutos después de la hora de inicio</li>
                                    <li>• Muestra este código QR al operador al llegar</li>
                                    <li>• Si llegas tarde, tu reserva será cancelada automáticamente</li>
                                    <li>• No se permiten cancelaciones ni modificaciones</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>

                {/* Botón cerrar */}
                <div className="flex justify-end pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
    Loader2,
    Clock,
    DollarSign,
    Car,
    CheckCircle2,
    Printer,
    Receipt
} from "lucide-react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

interface ResumenTurnoModalProps {
    isOpen: boolean;
    onClose: () => void;
    turnoId: number | null;
}

interface TurnoData {
    turno: {
        tur_id: number;
        tur_fecha: string;
        tur_fecha_salida?: string;
        tur_hora_entrada: string;
        tur_hora_salida: string;
        caja_inicio: number;
        caja_final: number;
        empleado_nombre: string;
    };
    estadisticas: {
        total_ingresos: number;
        total_egresos: number;
        vehiculos_activos: number;
        cobros_por_metodo: {
            efectivo: { monto: number; cantidad: number };
            transferencia: { monto: number; cantidad: number };
            mercadopago: { monto: number; cantidad: number };
            link_pago: { monto: number; cantidad: number };
        };
        total_cobrado: number;
        abonos_count: number;
        caja_esperada: number;
    };
}

export default function ResumenTurnoModal({ isOpen, onClose, turnoId }: ResumenTurnoModalProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TurnoData | null>(null);

    useEffect(() => {
        if (isOpen && turnoId) {
            loadResumenTurno();
        }
    }, [isOpen, turnoId]);

    const loadResumenTurno = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/turnos/resumen?tur_id=${turnoId}`);

            if (!response.ok) {
                throw new Error('Error al cargar resumen del turno');
            }

            const result = await response.json();
            setData(result.data);
        } catch (error) {
            console.error('Error loading resumen:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo cargar el resumen del turno"
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const calcularDuracion = () => {
        if (!data) return '0h 0m';

        try {
            const entrada = dayjs(`${data.turno.tur_fecha} ${data.turno.tur_hora_entrada}`);
            const fechaSalida = data.turno.tur_fecha_salida || data.turno.tur_fecha;
            const salida = dayjs(`${fechaSalida} ${data.turno.tur_hora_salida}`);
            const diff = salida.diff(entrada, 'minute');

            const horas = Math.floor(diff / 60);
            const minutos = diff % 60;

            return `${horas}h ${minutos}m`;
        } catch (error) {
            return '0h 0m';
        }
    };

    const diferenciaCaja = data ? data.turno.caja_final - data.estadisticas.caja_esperada : 0;

    if (!turnoId) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto resumen-turno-modal">
                <DialogHeader className="no-print">
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Receipt className="h-6 w-6 text-blue-600" />
                        Resumen de Turno
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Generando resumen...</span>
                    </div>
                ) : data ? (
                    <div className="space-y-6 print-content">
                        {/* Header imprimible */}
                        <div className="print-only text-center mb-6">
                            <h1 className="text-2xl font-bold">Resumen de Turno</h1>
                            <p className="text-gray-600">Sistema de Gestión de Estacionamiento</p>
                        </div>

                        {/* Información General */}
                        <Card className="no-page-break">
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                    Información General
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <p className="text-sm text-gray-600">Empleado</p>
                                        <p className="font-semibold">{data.turno.empleado_nombre}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Fecha de Inicio</p>
                                        <p className="font-semibold">{dayjs(data.turno.tur_fecha).format('DD/MM/YYYY')}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Hora de Inicio</p>
                                        <p className="font-semibold">{data.turno.tur_hora_entrada}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Fecha de Fin</p>
                                        <p className="font-semibold">{dayjs(data.turno.tur_fecha_salida || data.turno.tur_fecha).format('DD/MM/YYYY')}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Hora de Fin</p>
                                        <p className="font-semibold">{data.turno.tur_hora_salida}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-gray-600">Duración Total Trabajada</p>
                                        <p className="text-xl font-bold text-blue-600">{calcularDuracion()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Información de Caja */}
                        <Card className="no-page-break">
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-green-600" />
                                    Información de Caja
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Caja Inicio:</span>
                                        <span className="font-semibold">${data.turno.caja_inicio.toLocaleString('es-AR')}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Cobrado en Efectivo:</span>
                                        <span className="font-semibold">${data.estadisticas.cobros_por_metodo.efectivo.monto.toLocaleString('es-AR')}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                                        <span className="font-medium text-blue-900">Caja Esperada:</span>
                                        <span className="font-bold text-blue-900">${data.estadisticas.caja_esperada.toLocaleString('es-AR')}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Caja Final:</span>
                                        <span className="font-semibold">${data.turno.caja_final.toLocaleString('es-AR')}</span>
                                    </div>
                                    <Separator />
                                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                                        diferenciaCaja >= 0
                                            ? 'bg-green-50'
                                            : 'bg-red-50'
                                    }`}>
                                        <span className={`font-medium ${
                                            diferenciaCaja >= 0
                                                ? 'text-green-900'
                                                : 'text-red-900'
                                        }`}>Diferencia:</span>
                                        <span className={`font-bold text-lg ${
                                            diferenciaCaja >= 0
                                                ? 'text-green-700'
                                                : 'text-red-700'
                                        }`}>
                                            {diferenciaCaja >= 0 ? '+' : ''}${diferenciaCaja.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Movimientos de Vehículos */}
                        <Card className="no-page-break">
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Car className="h-5 w-5 text-purple-600" />
                                    Movimientos de Vehículos
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                                        <p className="text-3xl font-bold text-blue-600">{data.estadisticas.total_ingresos}</p>
                                        <p className="text-sm text-gray-600 mt-1">Ingresos</p>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                        <p className="text-3xl font-bold text-green-600">{data.estadisticas.total_egresos}</p>
                                        <p className="text-sm text-gray-600 mt-1">Egresos</p>
                                    </div>
                                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                                        <p className="text-3xl font-bold text-orange-600">{data.estadisticas.vehiculos_activos}</p>
                                        <p className="text-sm text-gray-600 mt-1">Actualmente</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Cobros por Método de Pago */}
                        <Card className="no-page-break">
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    Cobros por Método de Pago
                                </h3>
                                <div className="space-y-3">
                                    {data.estadisticas.cobros_por_metodo.efectivo.cantidad > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">Efectivo</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                    ({data.estadisticas.cobros_por_metodo.efectivo.cantidad} cobros)
                                                </span>
                                            </div>
                                            <span className="font-bold text-green-600">
                                                ${data.estadisticas.cobros_por_metodo.efectivo.monto.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    )}
                                    {data.estadisticas.cobros_por_metodo.transferencia.cantidad > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">Transferencia</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                    ({data.estadisticas.cobros_por_metodo.transferencia.cantidad} cobros)
                                                </span>
                                            </div>
                                            <span className="font-bold text-blue-600">
                                                ${data.estadisticas.cobros_por_metodo.transferencia.monto.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    )}
                                    {data.estadisticas.cobros_por_metodo.mercadopago.cantidad > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">QR/MercadoPago</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                    ({data.estadisticas.cobros_por_metodo.mercadopago.cantidad} cobros)
                                                </span>
                                            </div>
                                            <span className="font-bold text-cyan-600">
                                                ${data.estadisticas.cobros_por_metodo.mercadopago.monto.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    )}
                                    {data.estadisticas.cobros_por_metodo.link_pago.cantidad > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">Link de Pago</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                    ({data.estadisticas.cobros_por_metodo.link_pago.cantidad} cobros)
                                                </span>
                                            </div>
                                            <span className="font-bold text-purple-600">
                                                ${data.estadisticas.cobros_por_metodo.link_pago.monto.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    )}
                                    {data.estadisticas.abonos_count > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">Abono</span>
                                                <span className="text-sm text-gray-600 ml-2">
                                                    ({data.estadisticas.abonos_count} ingresos)
                                                </span>
                                            </div>
                                            <span className="font-medium text-gray-600">Sin cobro</span>
                                        </div>
                                    )}
                                    <Separator />
                                    <div className="flex justify-between items-center p-4 bg-green-100 rounded-lg">
                                        <span className="font-bold text-green-900 text-lg">TOTAL COBRADO:</span>
                                        <span className="font-bold text-green-700 text-2xl">
                                            ${data.estadisticas.total_cobrado.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Botones de acción */}
                        <div className="flex justify-end gap-3 pt-4 no-print">
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                            </Button>
                            <Button onClick={onClose}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No se pudo cargar el resumen del turno</p>
                    </div>
                )}

                {/* Estilos de impresión */}
                <style jsx global>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }

                        .resumen-turno-modal,
                        .resumen-turno-modal * {
                            visibility: visible;
                        }

                        .resumen-turno-modal {
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 100%;
                        }

                        .no-print {
                            display: none !important;
                        }

                        .print-only {
                            display: block !important;
                        }

                        .no-page-break {
                            page-break-inside: avoid;
                        }

                        @page {
                            size: A4;
                            margin: 1.5cm;
                        }

                        button {
                            display: none !important;
                        }
                    }

                    .print-only {
                        display: none;
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Calendar, Clock, DollarSign } from "lucide-react";
import dayjs from "dayjs";

interface HistorialTurno {
    tur_id: number;
    tur_fecha: string;
    tur_fecha_salida?: string;
    tur_hora_entrada: string;
    tur_hora_salida?: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    tur_observaciones_salida?: string;
    cajas_empleados: {
        caj_id: number;
        caj_nombre: string;
        caj_fondo_inicial: number;
        caj_fondo_final?: number;
        caj_estado: string;
    }[];
}

interface HistorialTurnosProps {
    isOpen: boolean;
    onClose: () => void;
    estId: number | null;
}

export default function HistorialTurnos({ isOpen, onClose, estId }: HistorialTurnosProps) {
    const [loading, setLoading] = useState(false);
    const [historial, setHistorial] = useState<HistorialTurno[]>([]);
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [playId, setPlayId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && estId) {
            loadEmpleadoData();
            // Establecer fechas por defecto (últimos 30 días)
            const hoy = dayjs();
            setFechaHasta(hoy.format('YYYY-MM-DD'));
            setFechaDesde(hoy.subtract(30, 'day').format('YYYY-MM-DD'));
        }
    }, [isOpen, estId]);

    useEffect(() => {
        if (playId && estId && fechaDesde && fechaHasta) {
            loadHistorial();
        }
    }, [playId, estId, fechaDesde, fechaHasta]);

    const loadEmpleadoData = async () => {
        try {
            const response = await fetch(`/api/auth/get-employee-parking?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                setPlayId(data.play_id);
            }
        } catch (error) {
            console.error('Error loading empleado data:', error);
        }
    };

    const loadHistorial = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams({
                play_id: playId!.toString(),
                est_id: estId!.toString(),
                fecha_desde: fechaDesde,
                fecha_hasta: fechaHasta
            });

            const response = await fetch(`/api/turnos/historial?${params}`);
            if (response.ok) {
                const data = await response.json();
                setHistorial(data.historial || []);
            } else {
                throw new Error('Error al cargar historial');
            }
        } catch (error) {
            console.error('Error loading historial:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar el historial de turnos"
            });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    };

    const calcularDuracion = (horaEntrada: string, horaSalida: string | undefined, fechaTurno: string, fechaSalida?: string) => {
        if (!horaSalida) {
            // Si no hay hora de salida, calcular duración hasta ahora
            const entrada = dayjs(`${fechaTurno} ${horaEntrada}`);
            const ahora = dayjs();
            const duracion = ahora.diff(entrada, 'minute');
            const horas = Math.floor(duracion / 60);
            const minutos = duracion % 60;
            return `${horas}h ${minutos}m`;
        }

        // Usar fecha de salida si existe, sino usar fecha de entrada como fallback
        const fechaSalidaFinal = fechaSalida || fechaTurno;
        const entrada = dayjs(`${fechaTurno} ${horaEntrada}`);
        const salida = dayjs(`${fechaSalidaFinal} ${horaSalida}`);
        const duracion = salida.diff(entrada, 'minute');

        const horas = Math.floor(Math.abs(duracion) / 60);
        const minutos = Math.abs(duracion) % 60;

        return `${horas}h ${minutos}m`;
    };

    const calcularDiferenciaCaja = (fondoInicial: number, fondoFinal?: number) => {
        if (!fondoFinal) return null;
        return fondoFinal - fondoInicial;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Historial
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Filtros de fecha */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="fecha-desde">Fecha Desde</Label>
                            <Input
                                id="fecha-desde"
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="fecha-hasta">Fecha Hasta</Label>
                            <Input
                                id="fecha-hasta"
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tabla de historial */}
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : historial.length > 0 ? (
                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Horario</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Duración</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Caja</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fondo Inicial</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fondo Final</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Diferencia</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historial.map((turno) => {
                                        const diferencia = calcularDiferenciaCaja(
                                            turno.cajas_empleados[0]?.caj_fondo_inicial || 0,
                                            turno.cajas_empleados[0]?.caj_fondo_final
                                        );

                                        return (
                                            <tr key={turno.tur_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                    {dayjs(turno.tur_fecha).format('DD/MM/YYYY')}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                    <div>
                                                        <div>{turno.tur_hora_entrada}</div>
                                                        {turno.tur_hora_salida && (
                                                            <div className="text-gray-500">{turno.tur_hora_salida}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                    {calcularDuracion(turno.tur_hora_entrada, turno.tur_hora_salida, turno.tur_fecha, turno.tur_fecha_salida)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                    {turno.cajas_empleados[0]?.caj_nombre || 'N/A'}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                    {formatCurrency(turno.cajas_empleados[0]?.caj_fondo_inicial || 0)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 text-center">
                                                    {turno.cajas_empleados[0]?.caj_fondo_final
                                                        ? formatCurrency(turno.cajas_empleados[0].caj_fondo_final)
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
                                                <td className="py-4 px-4 text-sm text-center">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        turno.tur_estado === 'activo'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {turno.tur_estado === 'activo' ? 'Activo' : 'Finalizado'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                No hay turnos registrados
                            </h3>
                            <p className="text-gray-600">
                                No se encontraron turnos en el rango de fechas seleccionado.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button variant="outline" onClick={onClose}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

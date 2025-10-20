"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Clock, DollarSign, AlertCircle } from "lucide-react";
import dayjs from "dayjs";

interface TurnoActivo {
    tur_id: number;
    tur_fecha: string;
    tur_hora_entrada: string;
    tur_estado: string;
    tur_observaciones_entrada?: string;
    caja_inicio: number;
    caja_final?: number;
}

interface FinalizarTurnoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (turId: number) => void;
    turnoActivo: TurnoActivo | null;
}

export default function FinalizarTurnoModal({ isOpen, onClose, onSuccess, turnoActivo }: FinalizarTurnoModalProps) {
    const [loading, setLoading] = useState(false);
    const [observaciones, setObservaciones] = useState("");
    const [cajaFinal, setCajaFinal] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!turnoActivo || !cajaFinal) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Por favor completa todos los campos requeridos"
            });
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/turnos/finalizar', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tur_id: turnoActivo.tur_id,
                    caja_final: parseFloat(cajaFinal),
                    observaciones: observaciones || null
                })
            });

            if (response.ok) {
                onSuccess(turnoActivo.tur_id);
                resetForm();
                onClose();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al finalizar turno');
            }
        } catch (error) {
            console.error('Error finalizando turno:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Error al finalizar turno"
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setObservaciones("");
        setCajaFinal("");
    };

    const handleClose = () => {
        if (!loading) {
            resetForm();
            onClose();
        }
    };

    const calcularDuracion = () => {
        if (!turnoActivo) return "0h 0m";

        try {
            // Intentar diferentes formatos para la hora de entrada
            let entrada;

            // Si viene solo la hora (HH:mm:ss), combinar con fecha del turno
            if (turnoActivo.tur_hora_entrada && turnoActivo.tur_hora_entrada.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                const fechaTurno = turnoActivo.tur_fecha || dayjs().format('YYYY-MM-DD');
                entrada = dayjs(`${fechaTurno} ${turnoActivo.tur_hora_entrada}`);
            } else {
                // Si viene con fecha completa o timestamp
                entrada = dayjs(turnoActivo.tur_hora_entrada);
            }

            // Verificar que la entrada sea válida
            if (!entrada.isValid()) {
                console.error('Hora de entrada inválida:', turnoActivo.tur_hora_entrada);
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
            console.error('Error calculando duración en modal:', error, 'Turno:', turnoActivo);
            return '0h 0m';
        }
    };


    if (!turnoActivo) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Finalizar Turno
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Información del Turno */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <h3 className="font-semibold text-gray-900">Información del Turno</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Fecha:</span>
                                <p className="font-medium">{dayjs(turnoActivo.tur_fecha).format('DD/MM/YYYY')}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Hora de entrada:</span>
                                <p className="font-medium">{turnoActivo.tur_hora_entrada}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Duración total:</span>
                                <p className="font-medium">{calcularDuracion()}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Caja inicial:</span>
                                <p className="font-medium">${turnoActivo.caja_inicio?.toLocaleString('es-AR') || '0'}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="caja-final" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Dinero en Caja (Final)
                        </Label>
                        <Input
                            id="caja-final"
                            type="number"
                            step="0.01"
                            min="0"
                            value={cajaFinal}
                            onChange={(e) => setCajaFinal(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    {/* Diferencia en caja */}
                    {cajaFinal && turnoActivo.caja_inicio && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Diferencia en Caja</h4>
                            <div className="text-sm">
                                <span className="text-blue-600">Diferencia: </span>
                                <span className={`font-medium ${
                                    parseFloat(cajaFinal) - turnoActivo.caja_inicio >= 0
                                        ? 'text-green-700'
                                        : 'text-red-700'
                                }`}>
                                    ${(parseFloat(cajaFinal) - turnoActivo.caja_inicio).toLocaleString('es-AR')}
                                </span>
                            </div>
                        </div>
                    )}

                    <div>
                        <Label htmlFor="observaciones">Observaciones de Cierre</Label>
                        <Textarea
                            id="observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Opcional..."
                            rows={3}
                        />
                    </div>


                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            FINALIZAR
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

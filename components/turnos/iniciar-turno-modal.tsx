"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Clock, DollarSign } from "lucide-react";
import dayjs from "dayjs";

interface IniciarTurnoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    estId: number | null;
}

export default function IniciarTurnoModal({ isOpen, onClose, onSuccess, estId }: IniciarTurnoModalProps) {
    const [loading, setLoading] = useState(false);
    const [observaciones, setObservaciones] = useState("");
    const [cajaInicio, setCajaInicio] = useState("");
    const [playId, setPlayId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && estId) {
            loadEmpleadoData();
        }
    }, [isOpen, estId]);

    const loadEmpleadoData = async () => {
        try {
            const response = await fetch(`/api/auth/get-employee-parking?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                setPlayId(data.usuario_id);
            }
        } catch (error) {
            console.error('Error loading empleado data:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!playId || !cajaInicio) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Por favor completa todos los campos requeridos"
            });
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/turnos/iniciar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    play_id: playId,
                    est_id: estId,
                    caja_inicio: parseFloat(cajaInicio),
                    observaciones: observaciones || null
                })
            });

            if (response.ok) {
                onSuccess();
                resetForm();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al iniciar turno');
            }
        } catch (error) {
            console.error('Error iniciando turno:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "Error al iniciar turno"
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setObservaciones("");
        setCajaInicio("");
    };

    const handleClose = () => {
        if (!loading) {
            resetForm();
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Iniciar Turno
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="horario">Horario de Inicio</Label>
                        <Input
                            id="horario"
                            value={dayjs().format('HH:mm')}
                            disabled
                            className="bg-gray-50"
                        />
                    </div>

                    <div>
                        <Label htmlFor="caja-inicio" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Dinero en Caja (Inicio)
                        </Label>
                        <Input
                            id="caja-inicio"
                            type="number"
                            step="0.01"
                            min="0"
                            value={cajaInicio}
                            onChange={(e) => setCajaInicio(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="observaciones">Observaciones</Label>
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
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            INICIO
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, DollarSign } from "lucide-react"

interface Plantilla {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: string;
    caracteristicas: Record<string, string[]>;
}

interface TariffModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: Plantilla | null;
    onSave: () => void;
}

interface TariffPrices {
    hora: string;
    dia: string;
    mes: string;
    semana: string;
}

export function TariffModal({ isOpen, onClose, template, onSave }: TariffModalProps) {
    const { estId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [prices, setPrices] = useState<TariffPrices>({
        hora: '',
        dia: '',
        mes: '',
        semana: ''
    });

    // Cargar precios existentes cuando se abre el modal con una plantilla
    useEffect(() => {
        if (isOpen && template && estId) {
            loadExistingPrices();
        }
    }, [isOpen, template, estId]);

    const loadExistingPrices = async () => {
        if (!template || !estId) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/tarifas?est_id=${estId}`);

            if (!response.ok) {
                throw new Error('Error al cargar precios existentes');
            }

            const data = await response.json();
            const plantillaData = data.tarifas?.find((p: any) => p.plantilla_id === template.plantilla_id);

            if (plantillaData?.tarifas) {
                setPrices({
                    hora: plantillaData.tarifas['1']?.precio?.toString() || '',
                    dia: plantillaData.tarifas['2']?.precio?.toString() || '',
                    mes: plantillaData.tarifas['3']?.precio?.toString() || '',
                    semana: plantillaData.tarifas['4']?.precio?.toString() || ''
                });
            }
        } catch (error: any) {
            console.error('Error cargando precios:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron cargar los precios existentes"
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePriceChange = (field: keyof TariffPrices, value: string) => {
        // Solo permitir números y un punto decimal
        const regex = /^\d*\.?\d*$/;
        if (regex.test(value) || value === '') {
            setPrices(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const handleSave = async () => {
        if (!template || !estId) return;

        try {
            setSaving(true);

            // Preparar los datos para enviar
            const tarifas = [];

            // Hora (tipo 1)
            if (prices.hora) {
                tarifas.push({
                    plantilla_id: template.plantilla_id,
                    tiptar_nro: 1,
                    tar_precio: parseFloat(prices.hora)
                });
            }

            // Día (tipo 2)
            if (prices.dia) {
                tarifas.push({
                    plantilla_id: template.plantilla_id,
                    tiptar_nro: 2,
                    tar_precio: parseFloat(prices.dia)
                });
            }

            // Mes (tipo 3)
            if (prices.mes) {
                tarifas.push({
                    plantilla_id: template.plantilla_id,
                    tiptar_nro: 3,
                    tar_precio: parseFloat(prices.mes)
                });
            }

            // Semana (tipo 4)
            if (prices.semana) {
                tarifas.push({
                    plantilla_id: template.plantilla_id,
                    tiptar_nro: 4,
                    tar_precio: parseFloat(prices.semana)
                });
            }

            if (tarifas.length === 0) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Debes ingresar al menos un precio"
                });
                return;
            }

            const response = await fetch(`/api/tarifas?est_id=${estId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tarifas })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar tarifas');
            }

            const data = await response.json();

            toast({
                title: "¡Éxito!",
                description: `Se guardaron ${data.tarifas_actualizadas} tarifas correctamente`
            });

            // Llamar al callback para refrescar la lista
            onSave();

            // Cerrar el modal
            onClose();

            // Resetear los precios
            setPrices({
                hora: '',
                dia: '',
                mes: '',
                semana: ''
            });

        } catch (error: any) {
            console.error('Error guardando tarifas:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al guardar las tarifas"
            });
        } finally {
            setSaving(false);
        }
    };

    const getVehicleTypeDisplay = (segmento: string) => {
        switch (segmento) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return segmento;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-gray-900">
                        Definir tarifas • {template?.nombre_plantilla}
                    </DialogTitle>
                    {template && (
                        <p className="text-sm text-gray-600">
                            Vehículo: {getVehicleTypeDisplay(template.catv_segmento)}
                        </p>
                    )}
                </DialogHeader>

                <div className="space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-gray-600">Cargando precios existentes...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Precio por Hora */}
                            <div className="space-y-2">
                                <Label htmlFor="hora" className="text-gray-700 flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" />
                                    Por hora
                                </Label>
                                <Input
                                    id="hora"
                                    type="text"
                                    placeholder="0.00"
                                    value={prices.hora}
                                    onChange={(e) => handlePriceChange('hora', e.target.value)}
                                    className="text-right"
                                    disabled={saving}
                                />
                            </div>

                            {/* Precio por Día */}
                            <div className="space-y-2">
                                <Label htmlFor="dia" className="text-gray-700 flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" />
                                    Por día
                                </Label>
                                <Input
                                    id="dia"
                                    type="text"
                                    placeholder="0.00"
                                    value={prices.dia}
                                    onChange={(e) => handlePriceChange('dia', e.target.value)}
                                    className="text-right"
                                    disabled={saving}
                                />
                            </div>

                            {/* Precio por Mes */}
                            <div className="space-y-2">
                                <Label htmlFor="mes" className="text-gray-700 flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" />
                                    Por mes
                                </Label>
                                <Input
                                    id="mes"
                                    type="text"
                                    placeholder="0.00"
                                    value={prices.mes}
                                    onChange={(e) => handlePriceChange('mes', e.target.value)}
                                    className="text-right"
                                    disabled={saving}
                                />
                            </div>

                            {/* Precio por Semana */}
                            <div className="space-y-2">
                                <Label htmlFor="semana" className="text-gray-700 flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" />
                                    Por semana
                                </Label>
                                <Input
                                    id="semana"
                                    type="text"
                                    placeholder="0.00"
                                    value={prices.semana}
                                    onChange={(e) => handlePriceChange('semana', e.target.value)}
                                    className="text-right"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {saving ? 'Guardando...' : 'Guardar tarifas'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


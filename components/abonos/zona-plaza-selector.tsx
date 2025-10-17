"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { Plaza } from "@/components/Plaza";
import { PlazaInfo } from "@/lib/types";

interface ZonaPlazaSelectorProps {
    isOpen: boolean;
    estacionamientoId: number;
    estacionamientoNombre: string;
    onSelectPlaza: (plaza: PlazaInfo) => void;
    onCancel: () => void;
}

export function ZonaPlazaSelector({
    isOpen,
    estacionamientoId,
    estacionamientoNombre,
    onSelectPlaza,
    onCancel
}: ZonaPlazaSelectorProps) {
    const [plazas, setPlazas] = useState<PlazaInfo[]>([]);
    const [selectedPlaza, setSelectedPlaza] = useState<PlazaInfo | null>(null);
    const [selectedZona, setSelectedZona] = useState<string>("");
    const [selectedTipo, setSelectedTipo] = useState<string>("Todos");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Cargar plazas cuando se abre el modal
    useEffect(() => {
        if (isOpen && estacionamientoId) {
            cargarPlazas();
        }
    }, [isOpen, estacionamientoId]);

    const cargarPlazas = async () => {
        setLoading(true);
        setError('');
        setSelectedPlaza(null);
        setSelectedZona("");
        setSelectedTipo("Todos");

        try {
            console.log(`Cargando plazas para est_id: ${estacionamientoId}`);
            const response = await fetch(`/api/plazas?est_id=${estacionamientoId}`);
            const data = await response.json();

            console.log('Respuesta del API:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            // El endpoint /api/plazas devuelve directamente las plazas con su estado real
            const plazasFormateadas: PlazaInfo[] = data.plazas?.map((p: any) => ({
                pla_numero: p.pla_numero,
                est_id: estacionamientoId,
                pla_estado: p.pla_estado, // Estado real de la base de datos
                catv_segmento: p.catv_segmento || 'AUT',
                zona: p.pla_zona || 'A',
                plantilla_id: p.plantillas?.[0]?.plantilla_id || p.plantilla_id // Obtener de la relación o directo
            })) || [];

            console.log(`Plazas cargadas: ${plazasFormateadas.length}`);
            console.log(`Estados de plazas:`, {
                libres: plazasFormateadas.filter(p => p.pla_estado === 'Libre').length,
                ocupadas: plazasFormateadas.filter(p => p.pla_estado === 'Ocupada').length,
                abonadas: plazasFormateadas.filter(p => p.pla_estado === 'Abonado').length
            });

            if (plazasFormateadas.length === 0) {
                setError('No hay plazas disponibles en este estacionamiento');
            } else {
                // Ordenar plazas por número
                plazasFormateadas.sort((a, b) => a.pla_numero - b.pla_numero);
                setPlazas(plazasFormateadas);
                // Seleccionar primera zona disponible automáticamente
                const primeraZona = plazasFormateadas[0]?.zona || 'A';
                setSelectedZona(primeraZona);
            }
        } catch (err) {
            console.error('Error cargando plazas:', err);
            setError('Error al cargar plazas disponibles');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlaza = (plaza: PlazaInfo) => {
        setSelectedPlaza(plaza);
    };

    const handleConfirmarPlaza = () => {
        if (selectedPlaza) {
            onSelectPlaza(selectedPlaza);
        }
    };

    const handleCancelar = () => {
        setSelectedPlaza(null);
        setPlazas([]);
        setError('');
        setSelectedZona("");
        setSelectedTipo("Todos");
        onCancel();
    };

    const getTipoVehiculo = (segmento: string) => {
        switch (segmento) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return 'Auto';
        }
    };

    // Filtrar plazas por zona seleccionada y solo mostrar libres
    const plazasFiltradasPorZona = selectedZona
        ? plazas.filter(p => (p.zona || 'A') === selectedZona)
        : plazas;

    // Solo mostrar plazas libres (no ocupadas ni abonadas)
    const plazasLibres = plazasFiltradasPorZona.filter(p => p.pla_estado === 'Libre');

    // Filtrar por tipo de vehículo
    const plazasFiltradas = selectedTipo === "Todos"
        ? plazasLibres
        : plazasLibres.filter(p => getTipoVehiculo(p.catv_segmento) === selectedTipo);

    // Zonas disponibles
    const zonasDisponibles = Array.from(new Set(plazas.map(p => p.zona || 'A')));

    // Tipos disponibles (de las plazas libres en la zona seleccionada)
    const tiposDisponibles = Array.from(new Set(plazasLibres.map(p => getTipoVehiculo(p.catv_segmento))));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancelar() }}>
            <DialogContent className="sm:max-w-lg overflow-visible">
                <DialogHeader>
                    <DialogTitle>Seleccionar Plaza</DialogTitle>
                    <DialogDescription>
                        Elige una plaza disponible
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 overflow-visible">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Selector de Zona */}
                    {zonasDisponibles.length > 1 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Zona destino
                            </label>
                            <Select value={selectedZona} onValueChange={setSelectedZona}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Elegir una zona (A, B, C...)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {zonasDisponibles.map((zona) => (
                                        <SelectItem key={zona} value={zona}>
                                            Zona {zona}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Selector de Tipo de Plaza */}
                    {plazasLibres.length > 0 && tiposDisponibles.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Tipo de plaza
                            </label>
                            <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Auto/ Común / Techada" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todos">Todos</SelectItem>
                                    {tiposDisponibles.map((tipo) => (
                                        <SelectItem key={tipo} value={tipo}>
                                            {tipo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Grid de plazas */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-2 text-gray-600">Cargando plazas...</span>
                        </div>
                    ) : plazas.length === 0 ? (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No hay plazas disponibles en este estacionamiento.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            {/* Leyenda */}
                            <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                                <span className="font-medium">Plazas disponibles: {plazasFiltradas.length}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-600 rounded"></div>
                                    <span className="text-xs">Disponibles</span>
                                </div>
                            </div>

                            {/* Grid de plazas */}
                            {plazasFiltradas.length > 0 ? (
                                <div className="border rounded-lg bg-gray-50 p-6 pt-14 pb-8 overflow-visible">
                                    <div className="grid grid-cols-6 gap-3 max-h-64 overflow-y-auto overflow-x-visible pr-2">
                                        {plazasFiltradas.map((plaza) => (
                                            <Plaza
                                                key={plaza.pla_numero}
                                                numero={plaza.pla_numero}
                                                ocupado={false} // Todas son libres
                                                abonado={false} // Todas son libres
                                                tipo={getTipoVehiculo(plaza.catv_segmento)}
                                                onClick={() => handleSelectPlaza(plaza)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        No hay plazas disponibles con los filtros seleccionados.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Plaza seleccionada */}
                            {selectedPlaza && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900">Plaza seleccionada</p>
                                            <p className="text-sm text-blue-800 mt-1">Zona {selectedPlaza.zona || 'A'} - Nº {selectedPlaza.pla_numero}</p>
                                            <p className="text-xs text-blue-600 mt-1">Tipo: {getTipoVehiculo(selectedPlaza.catv_segmento)}</p>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {selectedPlaza.pla_numero}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Botones */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button variant="outline" onClick={handleCancelar}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmarPlaza}
                        disabled={!selectedPlaza || loading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Confirmar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}


'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Play, Eye, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface Preset {
    preset_id: number;
    preset_nombre: string;
    reglas: any[];
}

interface PresetPanelProps {
    presets: Preset[];
    zonaActual: {
        zona_id: number;
        zona_nombre: string;
        grid: {
            rows: number;
            cols: number;
            numbering: string;
        };
    } | null;
    onAplicarPreset: (presetId: number) => void;
    onCrearPreset: () => void;
    estId: number;
}

export const PresetPanel: React.FC<PresetPanelProps> = ({
    presets,
    zonaActual,
    onAplicarPreset,
    onCrearPreset,
    estId
}) => {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [presetSeleccionado, setPresetSeleccionado] = useState<Preset | null>(null);
    const [nuevoPresetNombre, setNuevoPresetNombre] = useState('');
    const [creandoPreset, setCreandoPreset] = useState(false);

    // Función para crear un nuevo preset
    const handleCrearPreset = async () => {
        if (!nuevoPresetNombre.trim()) {
            toast.error('Ingresa un nombre para el preset');
            return;
        }

        // Aquí iría la lógica para crear el preset basado en la configuración actual
        // Por ahora, solo mostramos un mensaje
        toast.info('Funcionalidad de creación de presets próximamente');
        setNuevoPresetNombre('');
        setShowCreateDialog(false);
    };

    // Función para aplicar un preset
    const handleAplicarPreset = async (preset: Preset) => {
        if (!zonaActual) {
            toast.error('Selecciona una zona primero');
            return;
        }

        try {
            const response = await fetch('/api/presets/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    est_id: estId,
                    zona_id: zonaActual.zona_id,
                    preset_id: preset.preset_id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al aplicar preset');
            }

            toast.success(`Preset "${preset.preset_nombre}" aplicado exitosamente`);

            if (data.warnings && data.warnings.length > 0) {
                data.warnings.forEach((warning: string) => {
                    toast.warning(warning);
                });
            }

        } catch (error: any) {
            console.error('Error aplicando preset:', error);
            toast.error(error.message || 'Error al aplicar el preset');
        }
    };

    // Función para eliminar un preset
    const handleEliminarPreset = async (preset: Preset) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar el preset "${preset.preset_nombre}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/presets/${preset.preset_id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Error al eliminar preset');
            }

            toast.success(`Preset "${preset.preset_nombre}" eliminado`);
            // Aquí se debería actualizar la lista de presets

        } catch (error: any) {
            console.error('Error eliminando preset:', error);
            toast.error(error.message || 'Error al eliminar el preset');
        }
    };

    // Función para mostrar preview de un preset
    const handlePreviewPreset = (preset: Preset) => {
        setPresetSeleccionado(preset);
        setShowPreviewDialog(true);
    };

    // Función para formatear las reglas de un preset
    const formatearReglas = (reglas: any[]) => {
        if (!reglas || !Array.isArray(reglas) || reglas.length === 0) return 'Sin reglas definidas';

        return reglas.map((regla, index) => {
            let descripcion = '';

            if (regla && regla.selector) {
                switch (regla.selector.tipo) {
                    case 'individual':
                        descripcion = `Plazas específicas: ${(regla.selector.plazas && Array.isArray(regla.selector.plazas)) ? regla.selector.plazas.join(', ') : 'ninguna'}`;
                        break;
                    case 'rango':
                        descripcion = `Rango: ${regla.selector.desde || '?'} - ${regla.selector.hasta || '?'}`;
                        break;
                    case 'fila':
                        descripcion = `Filas: ${(regla.selector.filas && Array.isArray(regla.selector.filas)) ? regla.selector.filas.join(', ') : 'ninguna'}`;
                        break;
                    case 'columna':
                        descripcion = `Columnas: ${(regla.selector.columnas && Array.isArray(regla.selector.columnas)) ? regla.selector.columnas.join(', ') : 'ninguna'}`;
                        break;
                    default:
                        descripcion = regla.selector.tipo ? `Tipo: ${regla.selector.tipo}` : 'Selector desconocido';
                }
            } else {
                descripcion = 'Sin selector definido';
            }

            const plantilla = regla && regla.plantilla_id ? ` → Plantilla ${regla.plantilla_id}` : '';
            return `${index + 1}. ${descripcion}${plantilla}`;
        }).join('\n');
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Presets de Configuración
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        Guarda y reutiliza configuraciones de plantillas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {presets.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay presets guardados</p>
                            <p className="text-sm">Crea tu primer preset para guardar configuraciones</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {presets
                                .filter(preset => preset && preset.preset_id && preset.preset_nombre)
                                .map((preset) => (
                                    <div
                                        key={preset.preset_id}
                                        className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium">{preset.preset_nombre || 'Sin nombre'}</h4>
                                            <Badge variant="outline">
                                                {(preset.reglas && Array.isArray(preset.reglas)) ? preset.reglas.length : 0} reglas
                                            </Badge>
                                        </div>

                                        <div className="text-xs text-muted-foreground mb-3">
                                            {(preset.reglas && Array.isArray(preset.reglas) && preset.reglas.length > 0) ? (
                                                <div className="max-h-16 overflow-hidden">
                                                    {formatearReglas(preset.reglas).split('\n').slice(0, 2).join('\n')}
                                                    {preset.reglas.length > 2 && '...'}
                                                </div>
                                            ) : (
                                                'Sin reglas definidas'
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAplicarPreset(preset)}
                                                disabled={!zonaActual}
                                                className="flex items-center gap-1"
                                            >
                                                <Play className="h-3 w-3" />
                                                Aplicar
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handlePreviewPreset(preset)}
                                                className="flex items-center gap-1"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleEliminarPreset(preset)}
                                                className="flex items-center gap-1"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}

                    {!zonaActual && presets.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                            💡 Selecciona una zona para poder aplicar presets
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog para crear preset */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Preset</DialogTitle>
                        <DialogDescription>
                            Guarda la configuración actual como un preset reutilizable
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="preset-nombre">Nombre del preset</Label>
                            <Input
                                id="preset-nombre"
                                placeholder="Ej: Auto VIP + Motos económicas"
                                value={nuevoPresetNombre}
                                onChange={(e) => setNuevoPresetNombre(e.target.value)}
                            />
                        </div>

                        <div className="text-sm text-muted-foreground">
                            📝 El preset guardará la configuración actual de plantillas aplicadas a las plazas.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCrearPreset}
                            disabled={!nuevoPresetNombre.trim() || creandoPreset}
                        >
                            {creandoPreset ? 'Creando...' : 'Crear Preset'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog para preview de preset */}
            <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Preview del Preset</DialogTitle>
                        <DialogDescription>
                            {presetSeleccionado?.preset_nombre}
                        </DialogDescription>
                    </DialogHeader>

                    {presetSeleccionado && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <h4 className="font-medium mb-2">Reglas del preset:</h4>
                                <div className="text-sm space-y-2">
                                    {presetSeleccionado.reglas?.map((regla: any, index: number) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <Badge variant="outline" className="mt-0.5">
                                                {index + 1}
                                            </Badge>
                                            <div className="flex-1">
                                                {regla.selector && (
                                                    <div className="text-muted-foreground">
                                                        Selector: {JSON.stringify(regla.selector, null, 2)}
                                                    </div>
                                                )}
                                                {regla.plantilla_id && (
                                                    <div className="text-green-700">
                                                        Plantilla ID: {regla.plantilla_id}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="text-sm text-muted-foreground">
                                🔍 Esta funcionalidad de preview estará disponible próximamente
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowPreviewDialog(false)}
                        >
                            Cerrar
                        </Button>
                        {presetSeleccionado && zonaActual && (
                            <Button
                                onClick={() => {
                                    handleAplicarPreset(presetSeleccionado);
                                    setShowPreviewDialog(false);
                                }}
                            >
                                Aplicar Preset
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
